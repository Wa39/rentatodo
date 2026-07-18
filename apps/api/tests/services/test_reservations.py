"""Tests for app.services.reservations: create_reservation."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.schemas.reservation import CreateReservationRequest


def _dates(start_offset: int, days: int) -> CreateReservationRequest:
    """Build a CreateReservationRequest starting `start_offset` days from
    today, spanning `days` inclusive days.
    """
    start = date.today() + timedelta(days=start_offset)
    end = start + timedelta(days=days - 1)
    return CreateReservationRequest(start_date=start, end_date=end)


def test_create_reservation_happy_path_computes_deposit(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a 3-day reservation costs price_per_day * 3."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res1@example.com")
    renter = make_user(email="renter-res1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)

    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    assert reservation.status == "requested"
    assert reservation.deposit_amount == 15000


def test_create_reservation_rejects_past_start_date(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: start_date before today is 422 VALIDATION_ERROR."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res2@example.com")
    renter = make_user(email="renter-res2@example.com")
    item = make_item(owner_id=owner.id)
    data = CreateReservationRequest(
        start_date=date.today() - timedelta(days=1), end_date=date.today()
    )

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "VALIDATION_ERROR"


def test_create_reservation_rejects_end_before_start(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: end_date < start_date is 422 VALIDATION_ERROR."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res3@example.com")
    renter = make_user(email="renter-res3@example.com")
    item = make_item(owner_id=owner.id)
    tomorrow = date.today() + timedelta(days=1)
    data = CreateReservationRequest(start_date=tomorrow, end_date=date.today())

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "VALIDATION_ERROR"


def test_create_reservation_rejects_own_item(db_session: Session, make_user, make_item) -> None:
    """Failure path: an owner can't rent their own item."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res4@example.com")
    item = make_item(owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=owner.id, data=_dates(5, 2))

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "CANNOT_RENT_OWN_ITEM"


def test_create_reservation_raises_not_found_for_missing_item(
    db_session: Session, make_user
) -> None:
    """Failure path: a random item id is 404 NOT_FOUND."""
    from app.services.reservations import create_reservation

    renter = make_user(email="renter-res5@example.com")

    with pytest.raises(AppError) as exc_info:
        create_reservation(
            db_session, item_id=uuid.uuid4(), renter_id=renter.id, data=_dates(5, 2)
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_create_reservation_raises_not_found_for_inactive_item(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: an inactive item can't be reserved."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res6@example.com")
    renter = make_user(email="renter-res6@example.com")
    item = make_item(owner_id=owner.id, is_active=False)

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2))

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_create_reservation_rejects_exact_duplicate(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: same renter+item+dates, already "requested", is
    409 DUPLICATE_RESERVATION, not a generic overlap conflict.
    """
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res7@example.com")
    renter = make_user(email="renter-res7@example.com")
    item = make_item(owner_id=owner.id)
    data = _dates(10, 3)
    create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "DUPLICATE_RESERVATION"


def test_create_reservation_rejects_overlapping_dates_from_a_different_renter(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a second renter can't book overlapping dates on the
    same item.
    """
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res8@example.com")
    renter1 = make_user(email="renter-res8a@example.com")
    renter2 = make_user(email="renter-res8b@example.com")
    item = make_item(owner_id=owner.id)
    create_reservation(db_session, item_id=item.id, renter_id=renter1.id, data=_dates(20, 5))

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter2.id, data=_dates(22, 3))

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "DATES_UNAVAILABLE"


def test_create_reservation_allows_back_to_back_non_overlapping_dates(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: a reservation starting the day after another ends is
    NOT an overlap — both ranges are inclusive but adjacent, not shared.
    """
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res9@example.com")
    renter1 = make_user(email="renter-res9a@example.com")
    renter2 = make_user(email="renter-res9b@example.com")
    item = make_item(owner_id=owner.id)
    first_start_offset, first_days = 30, 3
    first = create_reservation(
        db_session, item_id=item.id, renter_id=renter1.id,
        data=_dates(first_start_offset, first_days),
    )
    next_start_offset = first_start_offset + first_days  # the day right after `first` ends

    second = create_reservation(
        db_session, item_id=item.id, renter_id=renter2.id, data=_dates(next_start_offset, 2)
    )

    assert second.status == "requested"
    assert first.id != second.id
