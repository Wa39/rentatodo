"""Tests for the Reservation Pydantic schemas."""

from datetime import date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.item import Item
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import CreateReservationRequest, ReservationResponse


def test_create_reservation_request_accepts_valid_dates() -> None:
    """Happy path: a well-formed start/end date pair is accepted as-is."""
    request = CreateReservationRequest(start_date=date(2026, 8, 1), end_date=date(2026, 8, 3))

    assert request.start_date == date(2026, 8, 1)
    assert request.end_date == date(2026, 8, 3)


def test_create_reservation_request_rejects_missing_start_date() -> None:
    """Failure path: start_date is required."""
    with pytest.raises(ValidationError):
        CreateReservationRequest(end_date=date(2026, 8, 3))


def test_reservation_response_builds_from_a_reservation_model_including_derived_fields() -> None:
    """Happy path: item_name/item_photo_url/renter_name/deposit_status
    all resolve via relationships/property, without a separate query.
    """
    owner = User(name="Ana Duena", email="ana@example.com", password_hash="hashed")
    item = Item(
        id=uuid4(),
        owner_id=uuid4(),
        name="Taladro Bosch",
        description="Percutor profesional",
        category="tools",
        price_per_day=5000,
        photo_url="https://example.com/photo.jpg",
    )
    item.owner = owner
    renter = User(name="Carlos Renter", email="carlos@example.com", password_hash="hashed")
    now = datetime.now()
    reservation = Reservation(
        id=uuid4(),
        item_id=item.id,
        renter_id=uuid4(),
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 3),
        status="requested",
        deposit_amount=15000,
        created_at=now,
        updated_at=now,
    )
    reservation.item = item
    reservation.renter = renter

    response = ReservationResponse.model_validate(reservation)

    assert response.item_name == "Taladro Bosch"
    assert response.renter_name == "Carlos Renter"
    assert response.deposit_status == "none"
