"""Reservations endpoints: request, list mine/requests, approve, reject, cancel."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.check_evidence import CheckInOutRequest
from app.schemas.earnings import EarningsResponse
from app.schemas.reservation import (
    CreateReservationRequest,
    ReservationListResponse,
    ReservationResponse,
    ReservationStatusEnum,
)
from app.schemas.transaction import TransactionResponse
from app.services.reservations import (
    approve_reservation,
    cancel_reservation,
    checkin_reservation,
    checkout_reservation,
    close_reservation,
    create_reservation,
    get_earnings,
    get_transactions,
    list_my_requests,
    list_my_reservations,
    reject_reservation,
)

router = APIRouter()


@router.post("/items/{item_id}/reservations", status_code=201)
def create_reservation_endpoint(
    item_id: UUID,
    data: CreateReservationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Request a reservation. renter_id is always the authenticated user.

    Args:
        item_id: The item to reserve.
        data: The requested start_date/end_date.
        current_user: Resolved by get_current_user — the reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The newly created reservation's public representation.
    """
    reservation = create_reservation(db, item_id=item_id, renter_id=current_user.id, data=data)
    return ReservationResponse.model_validate(reservation)


@router.get("/users/me/reservations")
def list_my_reservations_endpoint(
    status: ReservationStatusEnum | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationListResponse:
    """List my reservations as a renter.

    Args:
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page, max 50.
        current_user: Resolved by get_current_user.
        db: Database session injected by FastAPI.

    Returns:
        The matching page of my reservations, plus pagination metadata.
    """
    reservations, total = list_my_reservations(
        db,
        renter_id=current_user.id,
        status=status.value if status else None,
        page=page,
        limit=limit,
    )
    return ReservationListResponse(
        reservations=[ReservationResponse.model_validate(r) for r in reservations],
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/users/me/requests")
def list_my_requests_endpoint(
    status: ReservationStatusEnum | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationListResponse:
    """List reservation requests received on items I own.

    Args:
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page, max 50.
        current_user: Resolved by get_current_user.
        db: Database session injected by FastAPI.

    Returns:
        The matching page of requests on my items, plus pagination metadata.
    """
    reservations, total = list_my_requests(
        db,
        owner_id=current_user.id,
        status=status.value if status else None,
        page=page,
        limit=limit,
    )
    return ReservationListResponse(
        reservations=[ReservationResponse.model_validate(r) for r in reservations],
        page=page,
        limit=limit,
        total=total,
    )


@router.post("/reservations/{reservation_id}/checkin", status_code=201)
def checkin_reservation_endpoint(
    reservation_id: UUID,
    data: CheckInOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Renter checks in an approved reservation with photo evidence.

    Args:
        reservation_id: The reservation to check in.
        data: The check-in photo_url and optional notes.
        current_user: Resolved by get_current_user — must be the
            reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The reservation's public representation, now "delivered".
    """
    reservation = checkin_reservation(
        db, reservation_id=reservation_id, renter_id=current_user.id, data=data
    )
    return ReservationResponse.model_validate(reservation)


@router.post("/reservations/{reservation_id}/checkout", status_code=201)
def checkout_reservation_endpoint(
    reservation_id: UUID,
    data: CheckInOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Renter checks out a delivered reservation with photo evidence.

    Args:
        reservation_id: The reservation to check out.
        data: The check-out photo_url and optional notes.
        current_user: Resolved by get_current_user — must be the
            reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The reservation's public representation, now "returned".
    """
    reservation = checkout_reservation(
        db, reservation_id=reservation_id, renter_id=current_user.id, data=data
    )
    return ReservationResponse.model_validate(reservation)


@router.patch("/reservations/{reservation_id}/close")
def close_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Owner closes a returned reservation, releasing the deposit.

    Args:
        reservation_id: The reservation to close.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The closed reservation's public representation.
    """
    reservation = close_reservation(db, reservation_id=reservation_id, owner_id=current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.patch("/reservations/{reservation_id}/approve")
def approve_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Owner approves a requested reservation.

    Args:
        reservation_id: The reservation to approve.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The approved reservation's public representation.
    """
    reservation = approve_reservation(db, reservation_id=reservation_id, owner_id=current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.patch("/reservations/{reservation_id}/reject")
def reject_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Owner rejects a requested reservation.

    Args:
        reservation_id: The reservation to reject.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The rejected reservation's public representation.
    """
    reservation = reject_reservation(db, reservation_id=reservation_id, owner_id=current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.patch("/reservations/{reservation_id}/cancel")
def cancel_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Renter cancels their reservation.

    Args:
        reservation_id: The reservation to cancel.
        current_user: Resolved by get_current_user — must be the reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The cancelled reservation's public representation.
    """
    reservation = cancel_reservation(db, reservation_id=reservation_id, renter_id=current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.get("/reservations/{reservation_id}/transactions")
def get_transactions_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TransactionResponse]:
    """Get a reservation's deposit transaction history.

    Args:
        reservation_id: The reservation whose history is requested.
        current_user: Resolved by get_current_user — must be its renter
            or the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The reservation's transactions, oldest first.
    """
    transactions = get_transactions(db, reservation_id=reservation_id, user_id=current_user.id)
    return [TransactionResponse.model_validate(t) for t in transactions]


@router.get("/users/me/earnings")
def get_earnings_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EarningsResponse:
    """Get the authenticated owner's earnings summary.

    Args:
        current_user: Resolved by get_current_user.
        db: Database session injected by FastAPI.

    Returns:
        Total earnings and a per-item breakdown.
    """
    return get_earnings(db, owner_id=current_user.id)
