"""Reservations endpoints: request, list mine/requests, approve, reject, cancel."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.reservation import (
    CreateReservationRequest,
    ReservationListResponse,
    ReservationResponse,
    ReservationStatusEnum,
)
from app.services.reservations import (
    approve_reservation,
    cancel_reservation,
    create_reservation,
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
