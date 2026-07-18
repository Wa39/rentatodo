"""Business logic for Reservations: request creation with double-booking
prevention (Task 3), approve/reject/cancel (Task 4), and listing (Task 5).
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.models.item import Item
from app.models.reservation import BLOCKING_STATUSES, Reservation
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
