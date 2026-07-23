"""Business logic for Reservations: request creation with double-booking
prevention (Task 3), approve/reject/cancel (Task 4), and listing (Task 5).
"""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.exceptions import AppError
from app.models.check_evidence import CheckEvidence
from app.models.item import Item
from app.models.reservation import BLOCKING_STATUSES, Reservation, Transaction
from app.schemas.check_evidence import CheckInOutRequest
from app.schemas.reservation import CreateReservationRequest


def create_reservation(
    db: Session, item_id: uuid.UUID, renter_id: uuid.UUID, data: CreateReservationRequest
) -> Reservation:
    """Request a reservation for an item.

    Runs, in order: date validation, item lookup (with a row lock held
    for the rest of this function — see below), the "can't rent your
    own item" check, the exact-duplicate check, the overlap check, then
    the insert. The Item row lock (SELECT ... FOR UPDATE) is acquired
    at lookup time and held until this transaction commits or rolls
    back, so no concurrent call for the same item can pass its own
    lookup until this one is done — that's what actually prevents the
    race, not the overlap SELECT by itself. The no_double_booking
    EXCLUDE constraint added by this feature's migration is the second,
    database-level layer: if this application-level check ever has a
    bug, Postgres itself rejects the INSERT (caught below).

    Args:
        db: Database session.
        item_id: The item being requested.
        renter_id: The authenticated caller's id — always the renter,
            never taken from the request body.
        data: Validated start_date/end_date.

    Returns:
        The newly created Reservation, status "requested".

    Raises:
        AppError: 422 VALIDATION_ERROR if start_date is in the past or
            end_date < start_date. 404 NOT_FOUND if the item doesn't
            exist or is inactive. 422 CANNOT_RENT_OWN_ITEM if the caller
            owns the item. 409 DUPLICATE_RESERVATION if an identical
            request (same renter+item+dates) is already "requested".
            409 DATES_UNAVAILABLE if the dates overlap an existing
            active reservation, caught either by the application check
            or the database's EXCLUDE constraint.
    """
    if data.start_date < date.today():
        raise AppError(422, "VALIDATION_ERROR", "start_date must be today or in the future")
    if data.end_date < data.start_date:
        raise AppError(422, "VALIDATION_ERROR", "end_date must be on or after start_date")

    item = db.scalar(
        select(Item)
        .where(Item.id == item_id, Item.is_active == True)  # noqa: E712
        .with_for_update()
    )
    if item is None:
        raise AppError(404, "NOT_FOUND", "Item not found")

    if item.owner_id == renter_id:
        raise AppError(422, "CANNOT_RENT_OWN_ITEM", "You cannot rent your own item")

    duplicate = db.scalar(
        select(Reservation.id).where(
            Reservation.item_id == item_id,
            Reservation.renter_id == renter_id,
            Reservation.start_date == data.start_date,
            Reservation.end_date == data.end_date,
            Reservation.status == "requested",
        )
    )
    if duplicate is not None:
        raise AppError(
            409, "DUPLICATE_RESERVATION", "An identical reservation request already exists"
        )

    overlap = db.scalar(
        select(Reservation.id).where(
            Reservation.item_id == item_id,
            Reservation.status.in_(BLOCKING_STATUSES),
            Reservation.start_date <= data.end_date,
            Reservation.end_date >= data.start_date,
        )
    )
    if overlap is not None:
        raise AppError(409, "DATES_UNAVAILABLE", "The requested dates are not available")

    days = (data.end_date - data.start_date).days + 1
    reservation = Reservation(
        item_id=item_id,
        renter_id=renter_id,
        start_date=data.start_date,
        end_date=data.end_date,
        status="requested",
        deposit_amount=item.price_per_day * days,
    )
    db.add(reservation)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "DATES_UNAVAILABLE", "The requested dates are not available")
    db.refresh(reservation)
    return reservation


def _get_reservation_or_404(db: Session, reservation_id: uuid.UUID) -> Reservation:
    """Look up a reservation by id, with its item and renter pre-loaded,
    holding a row lock for the rest of the caller's transaction.

    Args:
        db: Database session.
        reservation_id: The reservation's id.

    Returns:
        The matching Reservation.

    Raises:
        AppError: 404 NOT_FOUND if no reservation exists with that id.
    """
    # .with_for_update() added now that close_reservation and report_problem
    # insert real ledger entries (release/freeze) whose ordering matters —
    # see design spec 2026-07-21. Two concurrent calls on the same reservation
    # can no longer both pass a status check before either commits.
    # of=Reservation is required: joinedload(item)/joinedload(renter) below
    # produce LEFT OUTER JOINs (neither relationship sets innerjoin=True),
    # and Postgres rejects a bare FOR UPDATE on the nullable side of an outer
    # join. Scoping the lock to just the reservations row also avoids
    # incidentally locking the joined item/user rows.
    reservation = db.scalar(
        select(Reservation)
        .options(joinedload(Reservation.item), joinedload(Reservation.renter))
        .where(Reservation.id == reservation_id)
        .with_for_update(of=Reservation)
    )
    if reservation is None:
        raise AppError(404, "NOT_FOUND", "Reservation not found")
    return reservation


def _assert_participant(reservation: Reservation, user_id: uuid.UUID) -> None:
    """Ensure the caller is either the reservation's renter or the
    rented item's owner.

    Args:
        reservation: The reservation being accessed.
        user_id: The authenticated caller's id.

    Raises:
        AppError: 403 FORBIDDEN if the caller is neither party.
    """
    if user_id != reservation.renter_id and user_id != reservation.item.owner_id:
        raise AppError(403, "FORBIDDEN", "You are not a party to this reservation")


def checkin_reservation(
    db: Session, reservation_id: uuid.UUID, renter_id: uuid.UUID, data: CheckInOutRequest
) -> Reservation:
    """Renter checks in an approved reservation, recording photo evidence.

    Args:
        db: Database session.
        reservation_id: The reservation to check in.
        renter_id: The authenticated caller's id — must be the
            reservation's renter.
        data: The check-in photo_url and optional notes.

    Returns:
        The reservation, now "delivered".

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't its renter. 409
            INVALID_TRANSITION if the reservation isn't "approved".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.renter_id != renter_id:
        raise AppError(403, "FORBIDDEN", "You are not the renter for this reservation")
    if reservation.status != "approved":
        raise AppError(
            409, "INVALID_TRANSITION", "Only an approved reservation can be checked in"
        )

    reservation.status = "delivered"
    db.add(
        CheckEvidence(
            reservation_id=reservation.id,
            type="check_in",
            photo_url=data.photo_url,
            notes=data.notes,
        )
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def checkout_reservation(
    db: Session, reservation_id: uuid.UUID, renter_id: uuid.UUID, data: CheckInOutRequest
) -> Reservation:
    """Renter checks out a delivered reservation, recording photo evidence.

    Args:
        db: Database session.
        reservation_id: The reservation to check out.
        renter_id: The authenticated caller's id — must be the
            reservation's renter.
        data: The check-out photo_url and optional notes.

    Returns:
        The reservation, now "returned".

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't its renter. 409
            INVALID_TRANSITION if the reservation isn't "delivered".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.renter_id != renter_id:
        raise AppError(403, "FORBIDDEN", "You are not the renter for this reservation")
    if reservation.status != "delivered":
        raise AppError(
            409, "INVALID_TRANSITION", "Only a delivered reservation can be checked out"
        )

    reservation.status = "returned"
    db.add(
        CheckEvidence(
            reservation_id=reservation.id,
            type="check_out",
            photo_url=data.photo_url,
            notes=data.notes,
        )
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def close_reservation(db: Session, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation:
    """Owner closes a returned reservation, releasing the deposit.

    Args:
        db: Database session.
        reservation_id: The reservation to close.
        owner_id: The authenticated caller's id — must be the item's owner.

    Returns:
        The closed Reservation, with a "release" Transaction inserted.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't the item's owner. 409
            INVALID_TRANSITION if the reservation isn't "returned". 409
            FREEZE_ACTIVE if an open problem report exists (deposit is
            frozen).
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")
    if reservation.status != "returned":
        raise AppError(409, "INVALID_TRANSITION", "Only a returned reservation can be closed")
    if reservation.deposit_status == "frozen":
        raise AppError(
            409, "FREEZE_ACTIVE", "Cannot close a reservation with an open problem report"
        )

    reservation.status = "closed"
    db.add(
        Transaction(reservation_id=reservation.id, type="release", amount=reservation.deposit_amount)
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def approve_reservation(db: Session, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation:
    """Owner approves a requested reservation.

    Args:
        db: Database session.
        reservation_id: The reservation to approve.
        owner_id: The authenticated caller's id — must be the item's owner.

    Returns:
        The approved Reservation, with a "hold" Transaction inserted.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't the item's owner. 409
            INVALID_TRANSITION if the reservation isn't "requested".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")
    if reservation.status != "requested":
        raise AppError(409, "INVALID_TRANSITION", "Only a requested reservation can be approved")

    reservation.status = "approved"
    db.add(
        Transaction(reservation_id=reservation.id, type="hold", amount=reservation.deposit_amount)
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def reject_reservation(db: Session, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation:
    """Owner rejects a requested reservation. No transaction is created —
    nothing was ever held.

    Args:
        db: Database session.
        reservation_id: The reservation to reject.
        owner_id: The authenticated caller's id — must be the item's owner.

    Returns:
        The rejected Reservation.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't the item's owner. 409
            INVALID_TRANSITION if the reservation isn't "requested".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")
    if reservation.status != "requested":
        raise AppError(409, "INVALID_TRANSITION", "Only a requested reservation can be rejected")

    reservation.status = "rejected"
    db.commit()
    db.refresh(reservation)
    return reservation


def cancel_reservation(db: Session, reservation_id: uuid.UUID, renter_id: uuid.UUID) -> Reservation:
    """Renter cancels their own reservation. If it had already been
    approved (meaning a "hold" transaction exists), a "release" is
    inserted to return the deposit.

    Args:
        db: Database session.
        reservation_id: The reservation to cancel.
        renter_id: The authenticated caller's id — must be the
            reservation's renter.

    Returns:
        The cancelled Reservation.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't its renter. 409
            INVALID_TRANSITION if it's not "requested" or "approved".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.renter_id != renter_id:
        raise AppError(403, "FORBIDDEN", "You are not the renter for this reservation")
    if reservation.status not in ("requested", "approved"):
        raise AppError(
            409, "INVALID_TRANSITION", "Only a requested or approved reservation can be cancelled"
        )

    had_hold = reservation.status == "approved"
    reservation.status = "cancelled"
    if had_hold:
        db.add(
            Transaction(
                reservation_id=reservation.id, type="release", amount=reservation.deposit_amount
            )
        )
    db.commit()
    db.refresh(reservation)
    return reservation


def list_my_reservations(
    db: Session, renter_id: uuid.UUID, status: str | None = None, page: int = 1, limit: int = 20
) -> tuple[list[Reservation], int]:
    """List the authenticated user's reservations as a renter.

    Args:
        db: Database session.
        renter_id: The authenticated caller's id.
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page.

    Returns:
        A tuple of (reservations for the requested page, total matching
        count across all pages).
    """
    query = (
        select(Reservation)
        .options(
            joinedload(Reservation.item),
            joinedload(Reservation.renter),
            selectinload(Reservation.transactions),
        )
        .where(Reservation.renter_id == renter_id)
    )
    if status is not None:
        query = query.where(Reservation.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    query = query.order_by(Reservation.created_at.desc()).offset((page - 1) * limit).limit(limit)
    reservations = list(db.scalars(query).unique())
    return reservations, total


def list_my_requests(
    db: Session, owner_id: uuid.UUID, status: str | None = None, page: int = 1, limit: int = 20
) -> tuple[list[Reservation], int]:
    """List reservation requests received on items the authenticated
    user owns.

    Args:
        db: Database session.
        owner_id: The authenticated caller's id.
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page.

    Returns:
        A tuple of (reservations for the requested page, total matching
        count across all pages).
    """
    query = (
        select(Reservation)
        .options(
            joinedload(Reservation.item),
            joinedload(Reservation.renter),
            selectinload(Reservation.transactions),
        )
        .where(Reservation.item_id.in_(select(Item.id).where(Item.owner_id == owner_id)))
    )
    if status is not None:
        query = query.where(Reservation.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    query = query.order_by(Reservation.created_at.desc()).offset((page - 1) * limit).limit(limit)
    reservations = list(db.scalars(query).unique())
    return reservations, total
