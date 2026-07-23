"""Tests for app.services.reservations: create_reservation."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.schemas.check_evidence import CheckInOutRequest
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


def test_approve_reservation_happy_path_creates_hold_transaction(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: approving moves status to approved and inserts a hold
    transaction for the full deposit amount.
    """
    from app.services.reservations import approve_reservation, create_reservation

    owner = make_user(email="approve-owner1@example.com")
    renter = make_user(email="approve-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    approved = approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert approved.status == "approved"
    assert approved.deposit_status == "held"


def test_approve_reservation_requires_ownership(db_session: Session, make_user, make_item) -> None:
    """Failure path: a non-owner can't approve, 403 FORBIDDEN."""
    from app.services.reservations import approve_reservation, create_reservation

    owner = make_user(email="approve-owner2@example.com")
    renter = make_user(email="approve-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(10, 2)
    )

    with pytest.raises(AppError) as exc_info:
        approve_reservation(db_session, reservation_id=reservation.id, owner_id=renter.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_approve_reservation_requires_requested_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: approving an already-approved reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import approve_reservation, create_reservation

    owner = make_user(email="approve-owner3@example.com")
    renter = make_user(email="approve-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(15, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_approve_reservation_raises_not_found(db_session: Session, make_user) -> None:
    """Failure path: a random reservation id is 404 NOT_FOUND."""
    from app.services.reservations import approve_reservation

    owner = make_user(email="approve-owner4@example.com")

    with pytest.raises(AppError) as exc_info:
        approve_reservation(db_session, reservation_id=uuid.uuid4(), owner_id=owner.id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_reject_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: rejecting moves status to rejected, no transaction created."""
    from app.services.reservations import create_reservation, reject_reservation

    owner = make_user(email="reject-owner1@example.com")
    renter = make_user(email="reject-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(20, 2)
    )

    rejected = reject_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert rejected.status == "rejected"
    assert rejected.deposit_status == "none"


def test_reject_reservation_requires_ownership(db_session: Session, make_user, make_item) -> None:
    """Failure path: a non-owner can't reject, 403 FORBIDDEN."""
    from app.services.reservations import create_reservation, reject_reservation

    owner = make_user(email="reject-owner2@example.com")
    renter = make_user(email="reject-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(25, 2)
    )

    with pytest.raises(AppError) as exc_info:
        reject_reservation(db_session, reservation_id=reservation.id, owner_id=renter.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_reject_reservation_requires_requested_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: rejecting an already-rejected reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import create_reservation, reject_reservation

    owner = make_user(email="reject-owner3@example.com")
    renter = make_user(email="reject-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(30, 2)
    )
    reject_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        reject_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_cancel_reservation_happy_path_from_requested_no_release(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: cancelling a merely-requested reservation creates no
    transaction — nothing was ever held.
    """
    from app.services.reservations import cancel_reservation, create_reservation

    owner = make_user(email="cancel-owner1@example.com")
    renter = make_user(email="cancel-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(35, 2)
    )

    cancelled = cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    assert cancelled.status == "cancelled"
    assert cancelled.deposit_status == "none"


def test_cancel_reservation_happy_path_from_approved_creates_release(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: cancelling an approved reservation releases the held
    deposit.
    """
    from app.services.reservations import (
        approve_reservation,
        cancel_reservation,
        create_reservation,
    )

    owner = make_user(email="cancel-owner2@example.com")
    renter = make_user(email="cancel-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(40, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    cancelled = cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    assert cancelled.status == "cancelled"
    assert cancelled.deposit_status == "released"


def test_cancel_reservation_requires_renter(db_session: Session, make_user, make_item) -> None:
    """Failure path: the item owner can't cancel on the renter's behalf,
    403 FORBIDDEN.
    """
    from app.services.reservations import cancel_reservation, create_reservation

    owner = make_user(email="cancel-owner3@example.com")
    renter = make_user(email="cancel-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(45, 2)
    )

    with pytest.raises(AppError) as exc_info:
        cancel_reservation(db_session, reservation_id=reservation.id, renter_id=owner.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_cancel_reservation_requires_requested_or_approved_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: cancelling an already-cancelled reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import cancel_reservation, create_reservation

    owner = make_user(email="cancel-owner4@example.com")
    renter = make_user(email="cancel-renter4@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(50, 2)
    )
    cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    with pytest.raises(AppError) as exc_info:
        cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_list_my_reservations_returns_only_callers_own(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: renter A's list doesn't include renter B's reservations."""
    from app.services.reservations import list_my_reservations

    owner = make_user(email="list-owner1@example.com")
    renter_a = make_user(email="list-renter1a@example.com")
    renter_b = make_user(email="list-renter1b@example.com")
    item = make_item(owner_id=owner.id)
    make_reservation(item.id, renter_a.id, start_date=date(2027, 2, 1), end_date=date(2027, 2, 3))
    make_reservation(item.id, renter_b.id, start_date=date(2027, 3, 1), end_date=date(2027, 3, 3))

    reservations, total = list_my_reservations(db_session, renter_id=renter_a.id)

    assert total == 1
    assert reservations[0].renter_id == renter_a.id


def test_list_my_reservations_filters_by_status(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: status filter narrows the results."""
    from app.services.reservations import list_my_reservations

    owner = make_user(email="list-owner2@example.com")
    renter = make_user(email="list-renter2@example.com")
    item = make_item(owner_id=owner.id)
    make_reservation(
        item.id, renter.id, start_date=date(2027, 4, 1), end_date=date(2027, 4, 3),
        status="requested",
    )
    make_reservation(
        item.id, renter.id, start_date=date(2027, 5, 1), end_date=date(2027, 5, 3),
        status="cancelled",
    )

    reservations, total = list_my_reservations(db_session, renter_id=renter.id, status="cancelled")

    assert total == 1
    assert reservations[0].status == "cancelled"


def test_list_my_reservations_paginates(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: limit caps the page size, total reflects all matches."""
    from app.services.reservations import list_my_reservations

    owner = make_user(email="list-owner3@example.com")
    renter = make_user(email="list-renter3@example.com")
    item = make_item(owner_id=owner.id)
    for i in range(3):
        make_reservation(
            item.id, renter.id,
            start_date=date(2027, 6, 1 + i * 10), end_date=date(2027, 6, 2 + i * 10),
        )

    page_1, total = list_my_reservations(db_session, renter_id=renter.id, page=1, limit=2)
    page_2, _ = list_my_reservations(db_session, renter_id=renter.id, page=2, limit=2)

    assert total == 3
    assert len(page_1) == 2
    assert len(page_2) == 1


def test_list_my_requests_returns_requests_on_owned_items_only(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: owner A's requests don't include reservations on
    owner B's items.
    """
    from app.services.reservations import list_my_requests

    owner_a = make_user(email="list-owner4a@example.com")
    owner_b = make_user(email="list-owner4b@example.com")
    renter = make_user(email="list-renter4@example.com")
    item_a = make_item(owner_id=owner_a.id, name="Item A")
    item_b = make_item(owner_id=owner_b.id, name="Item B")
    make_reservation(item_a.id, renter.id, start_date=date(2027, 7, 1), end_date=date(2027, 7, 3))
    make_reservation(item_b.id, renter.id, start_date=date(2027, 8, 1), end_date=date(2027, 8, 3))

    reservations, total = list_my_requests(db_session, owner_id=owner_a.id)

    assert total == 1
    assert reservations[0].item_id == item_a.id


def test_list_my_requests_filters_by_status(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: status filter narrows the owner's incoming requests."""
    from app.services.reservations import list_my_requests

    owner = make_user(email="list-owner5@example.com")
    renter = make_user(email="list-renter5@example.com")
    item = make_item(owner_id=owner.id)
    make_reservation(
        item.id, renter.id, start_date=date(2027, 9, 1), end_date=date(2027, 9, 3),
        status="requested",
    )
    make_reservation(
        item.id, renter.id, start_date=date(2027, 10, 1), end_date=date(2027, 10, 3),
        status="rejected",
    )

    reservations, total = list_my_requests(db_session, owner_id=owner.id, status="rejected")

    assert total == 1
    assert reservations[0].status == "rejected"


def test_get_reservation_or_404_locks_the_row(db_session: Session, make_user, make_item) -> None:
    """The lookup used by every mutating endpoint takes a row lock
    (FOR UPDATE), so two concurrent calls on the same reservation can't
    both pass a status check before either commits.
    """
    from sqlalchemy import event

    from app.services import reservations
    from app.services.reservations import create_reservation

    owner = make_user(email="lock-owner1@example.com")
    renter = make_user(email="lock-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    captured_sql = []

    def _capture(conn, cursor, statement, parameters, context, executemany):
        captured_sql.append(statement)

    event.listen(db_session.get_bind(), "before_cursor_execute", _capture)
    try:
        reservations._get_reservation_or_404(db_session, reservation.id)
    finally:
        event.remove(db_session.get_bind(), "before_cursor_execute", _capture)

    assert any("FOR UPDATE" in sql.upper() for sql in captured_sql)


def test_assert_participant_allows_renter_and_owner(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: both the renter and the item's owner satisfy the check."""
    from app.services.reservations import _assert_participant, create_reservation

    owner = make_user(email="participant-owner1@example.com")
    renter = make_user(email="participant-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    _assert_participant(reservation, renter.id)
    _assert_participant(reservation, owner.id)


def test_assert_participant_rejects_third_party(db_session: Session, make_user, make_item) -> None:
    """Failure path: a user who is neither the renter nor the owner is
    403 FORBIDDEN.
    """
    from app.services.reservations import _assert_participant, create_reservation

    owner = make_user(email="participant-owner2@example.com")
    renter = make_user(email="participant-renter2@example.com")
    stranger = make_user(email="participant-stranger2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    with pytest.raises(AppError) as exc_info:
        _assert_participant(reservation, stranger.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_checkin_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: checking in an approved reservation moves it to
    delivered and records CheckEvidence.
    """
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        create_reservation,
    )

    owner = make_user(email="checkin-owner1@example.com")
    renter = make_user(email="checkin-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    checked_in = checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
    )

    assert checked_in.status == "delivered"


def test_checkin_reservation_requires_renter(db_session: Session, make_user, make_item) -> None:
    """Failure path: the item's owner can't check in on the renter's
    behalf, 403 FORBIDDEN.
    """
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        create_reservation,
    )

    owner = make_user(email="checkin-owner2@example.com")
    renter = make_user(email="checkin-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        checkin_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=owner.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_checkin_reservation_requires_approved_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: checking in a still-requested reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import checkin_reservation, create_reservation

    owner = make_user(email="checkin-owner3@example.com")
    renter = make_user(email="checkin-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    with pytest.raises(AppError) as exc_info:
        checkin_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=renter.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_checkout_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: checking out a delivered reservation moves it to returned."""
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        create_reservation,
    )

    owner = make_user(email="checkout-owner1@example.com")
    renter = make_user(email="checkout-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
    )

    checked_out = checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkout.jpg"),
    )

    assert checked_out.status == "returned"


def test_checkout_reservation_requires_renter(db_session: Session, make_user, make_item) -> None:
    """Failure path: the item's owner can't check out on the renter's
    behalf, 403 FORBIDDEN.
    """
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        create_reservation,
    )

    owner = make_user(email="checkout-owner2@example.com")
    renter = make_user(email="checkout-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
    )

    with pytest.raises(AppError) as exc_info:
        checkout_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=owner.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkout.jpg"),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_checkout_reservation_requires_delivered_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: checking out a still-approved reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import (
        approve_reservation,
        checkout_reservation,
        create_reservation,
    )

    owner = make_user(email="checkout-owner3@example.com")
    renter = make_user(email="checkout-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        checkout_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=renter.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkout.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_close_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: closing a returned reservation releases the deposit."""
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    owner = make_user(email="close-owner1@example.com")
    renter = make_user(email="close-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )

    closed = close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert closed.status == "closed"
    assert closed.deposit_status == "released"


def test_close_reservation_requires_ownership(db_session: Session, make_user, make_item) -> None:
    """Failure path: a non-owner can't close, 403 FORBIDDEN."""
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    owner = make_user(email="close-owner2@example.com")
    renter = make_user(email="close-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )

    with pytest.raises(AppError) as exc_info:
        close_reservation(db_session, reservation_id=reservation.id, owner_id=renter.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_close_reservation_requires_returned_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: closing a still-requested reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import close_reservation, create_reservation

    owner = make_user(email="close-owner3@example.com")
    renter = make_user(email="close-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    with pytest.raises(AppError) as exc_info:
        close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_close_reservation_blocked_by_active_freeze(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a returned reservation with an active freeze (open
    problem report) can't be closed, 409 FREEZE_ACTIVE. The freeze
    transaction is inserted directly here — report_problem (Task 6)
    doesn't exist yet, and close_reservation's check only reads
    deposit_status, never the reports table (see design spec).
    """
    from app.models.reservation import Transaction
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    owner = make_user(email="close-owner4@example.com")
    renter = make_user(email="close-renter4@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )
    db_session.add(
        Transaction(
            reservation_id=reservation.id, type="freeze", amount=reservation.deposit_amount
        )
    )
    db_session.commit()

    with pytest.raises(AppError) as exc_info:
        close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "FREEZE_ACTIVE"


def test_get_transactions_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: after approving, the reservation has one hold transaction."""
    from app.services.reservations import approve_reservation, create_reservation, get_transactions

    owner = make_user(email="transactions-owner1@example.com")
    renter = make_user(email="transactions-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    transactions = get_transactions(db_session, reservation_id=reservation.id, user_id=renter.id)

    assert len(transactions) == 1
    assert transactions[0].type == "hold"
    assert transactions[0].amount == 15000


def test_get_transactions_requires_participant(db_session: Session, make_user, make_item) -> None:
    """Failure path: a stranger can't view the transaction history, 403 FORBIDDEN."""
    from app.services.reservations import create_reservation, get_transactions

    owner = make_user(email="transactions-owner2@example.com")
    renter = make_user(email="transactions-renter2@example.com")
    stranger = make_user(email="transactions-stranger2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    with pytest.raises(AppError) as exc_info:
        get_transactions(db_session, reservation_id=reservation.id, user_id=stranger.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def _make_closed_reservation(db_session: Session, owner, renter, item, start_offset: int):
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(start_offset, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )
    return close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)


def test_get_earnings_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: total_earnings and by_item reflect a closed, released reservation."""
    from app.services.reservations import get_earnings

    owner = make_user(email="earnings-owner1@example.com")
    renter = make_user(email="earnings-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000, name="Taladro Bosch")
    _make_closed_reservation(db_session, owner, renter, item, start_offset=5)

    earnings = get_earnings(db_session, owner_id=owner.id)

    assert earnings.total_earnings == 10000
    assert len(earnings.by_item) == 1
    assert earnings.by_item[0].item_name == "Taladro Bosch"
    assert earnings.by_item[0].total == 10000
    assert len(earnings.by_item[0].rentals) == 1


def test_get_earnings_only_counts_closed_reservations(
    db_session: Session, make_user, make_item
) -> None:
    """Edge path: an approved-but-not-closed reservation doesn't count
    toward earnings.
    """
    from app.services.reservations import approve_reservation, create_reservation, get_earnings

    owner = make_user(email="earnings-owner2@example.com")
    renter = make_user(email="earnings-renter2@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    earnings = get_earnings(db_session, owner_id=owner.id)

    assert earnings.total_earnings == 0
    assert earnings.by_item == []


def test_get_earnings_only_counts_this_owners_items(db_session: Session, make_user, make_item) -> None:
    """Edge path: a different owner's closed reservation isn't counted —
    cross-tenant isolation.
    """
    from app.services.reservations import get_earnings

    owner_a = make_user(email="earnings-ownerA@example.com")
    owner_b = make_user(email="earnings-ownerB@example.com")
    renter = make_user(email="earnings-renter3@example.com")
    item_a = make_item(owner_id=owner_a.id, price_per_day=5000)
    _make_closed_reservation(db_session, owner_a, renter, item_a, start_offset=5)

    earnings_b = get_earnings(db_session, owner_id=owner_b.id)

    assert earnings_b.total_earnings == 0
    assert earnings_b.by_item == []
