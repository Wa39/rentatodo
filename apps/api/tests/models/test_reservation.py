"""Tests for the Reservation and Transaction models and their
database-level constraints.
"""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.reservation import Reservation, Transaction


def test_reservation_gets_id_created_at_updated_at_and_default_status(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a Reservation inserted without setting id/timestamps/
    status still gets sensible values from Postgres.
    """
    owner = make_user(email="resmodel-owner1@example.com")
    renter = make_user(email="resmodel-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.id is not None
    assert reservation.created_at is not None
    assert reservation.updated_at is not None
    assert reservation.status == "requested"


def test_end_date_must_be_on_or_after_start_date(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: the end_date >= start_date CHECK is enforced by
    Postgres, not only by application code.
    """
    owner = make_user(email="resmodel-owner2@example.com")
    renter = make_user(email="resmodel-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 5),
        deposit_amount=15000,
    )
    db_session.add(reservation)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_no_double_booking_constraint_blocks_direct_overlapping_insert(
    db_session: Session, make_user, make_item
) -> None:
    """The migration's EXCLUDE constraint is a second, database-level
    layer — this bypasses any application code entirely to prove
    Postgres itself rejects an overlap.
    """
    owner = make_user(email="resmodel-owner3@example.com")
    renter = make_user(email="resmodel-renter3@example.com")
    item = make_item(owner_id=owner.id)
    first = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 5),
        deposit_amount=25000,
    )
    db_session.add(first)
    db_session.commit()

    second = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 9, 3),
        end_date=date(2026, 9, 7),
        deposit_amount=25000,
    )
    db_session.add(second)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_double_booking_constraint_ignores_rejected_reservations(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: a "rejected" reservation doesn't block a new one on
    overlapping dates — the constraint's WHERE clause excludes
    rejected/cancelled/closed.
    """
    owner = make_user(email="resmodel-owner4@example.com")
    renter = make_user(email="resmodel-renter4@example.com")
    item = make_item(owner_id=owner.id)
    rejected = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 5),
        status="rejected",
        deposit_amount=25000,
    )
    db_session.add(rejected)
    db_session.commit()

    new = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 10, 2),
        end_date=date(2026, 10, 4),
        deposit_amount=25000,
    )
    db_session.add(new)
    db_session.commit()
    db_session.refresh(new)

    assert new.id is not None


def test_transaction_type_must_be_a_valid_value(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: the type CHECK constraint rejects anything outside
    hold/release/freeze.
    """
    owner = make_user(email="resmodel-owner5@example.com")
    renter = make_user(email="resmodel-renter5@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()

    transaction = Transaction(reservation_id=reservation.id, type="not-a-real-type", amount=15000)
    db_session.add(transaction)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_deposit_status_is_none_without_any_transaction(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a fresh reservation with no Transaction rows has
    deposit_status "none".
    """
    owner = make_user(email="resmodel-owner6@example.com")
    renter = make_user(email="resmodel-renter6@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.deposit_status == "none"


def test_deposit_status_reflects_the_latest_transaction(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: after a hold then a release, deposit_status is
    "released", not "held" — proves it reads the latest row, not just
    any row.
    """
    owner = make_user(email="resmodel-owner7@example.com")
    renter = make_user(email="resmodel-renter7@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 12),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()

    db_session.add(Transaction(reservation_id=reservation.id, type="hold", amount=15000))
    db_session.commit()
    db_session.refresh(reservation)
    assert reservation.deposit_status == "held"

    db_session.add(Transaction(reservation_id=reservation.id, type="release", amount=15000))
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.deposit_status == "released"
