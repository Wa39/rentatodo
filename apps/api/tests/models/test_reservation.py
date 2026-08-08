"""Tests for the Reservation and Transaction models and their
database-level constraints.
"""

from datetime import date, datetime, timezone

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


def test_deposit_status_raises_clear_error_for_unexpected_transaction_type(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: an unexpected Transaction.type must raise a clear
    ValueError, not an opaque KeyError that would surface as a 500 on
    any endpoint serializing this reservation (audit finding A1, PR #94).

    The DB's ck_transactions_type CHECK constraint blocks this today, so
    the Transaction is appended to the in-memory collection without a
    commit — this is deliberately exercising the property in isolation
    from that constraint, the same way a future migration or a direct
    write to the DB (bypassing the ORM) could.
    """
    owner = make_user(email="resmodel-owner8@example.com")
    renter = make_user(email="resmodel-renter8@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 12, 20),
        end_date=date(2026, 12, 22),
        deposit_amount=15000,
    )
    reservation.transactions.append(
        Transaction(reservation_id=reservation.id, type="bogus", amount=15000)
    )

    with pytest.raises(ValueError, match="bogus"):
        reservation.deposit_status


def test_transaction_sequence_increments_with_insertion_order(
    db_session: Session, make_user, make_item
) -> None:
    """`sequence` gives each Transaction a monotonic, gapless-enough
    order independent of created_at — two Transactions inserted in
    separate commits, even if their created_at lands on the exact same
    instant (observed live, see the next test), must still be
    distinguishable by sequence.
    """
    owner = make_user(email="resmodel-owner9@example.com")
    renter = make_user(email="resmodel-renter9@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2027, 1, 1),
        end_date=date(2027, 1, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()

    first = Transaction(reservation_id=reservation.id, type="hold", amount=15000)
    db_session.add(first)
    db_session.commit()
    db_session.refresh(first)

    second = Transaction(reservation_id=reservation.id, type="release", amount=15000)
    db_session.add(second)
    db_session.commit()
    db_session.refresh(second)

    assert second.sequence > first.sequence


def test_deposit_status_resolves_ties_correctly_when_created_at_is_identical(
    db_session: Session, make_user, make_item
) -> None:
    """Regression test for a real failure mode: two Transactions can
    share the exact same created_at (Postgres's now() reflects
    transaction start, and separate transactions can start at the same
    clock tick — reproduced live while building this fix, not a
    hypothetical). created_at alone can't order them; deposit_status
    must still resolve to the one inserted last (release), via
    `sequence`, not by relying on however Postgres happens to break a
    created_at tie.
    """
    owner = make_user(email="resmodel-owner10@example.com")
    renter = make_user(email="resmodel-renter10@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2027, 1, 10),
        end_date=date(2027, 1, 12),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()

    tied_instant = datetime.now(timezone.utc)
    db_session.add(
        Transaction(
            reservation_id=reservation.id, type="hold", amount=15000, created_at=tied_instant
        )
    )
    db_session.commit()
    db_session.add(
        Transaction(
            reservation_id=reservation.id, type="release", amount=15000, created_at=tied_instant
        )
    )
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.deposit_status == "released"


def test_checkin_and_checkout_photo_urls_are_none_without_evidence(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a fresh reservation with no CheckEvidence rows has
    both photo URLs as None.
    """
    owner = make_user(email="resmodel-owner11@example.com")
    renter = make_user(email="resmodel-renter11@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2027, 2, 1),
        end_date=date(2027, 2, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.checkin_photo_url is None
    assert reservation.checkout_photo_url is None


def test_checkin_and_checkout_photo_urls_reflect_recorded_evidence(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: each photo URL appears only after its own evidence
    type is recorded — check-in doesn't leak into checkout_photo_url
    or vice versa.
    """
    from app.models.check_evidence import CheckEvidence

    owner = make_user(email="resmodel-owner12@example.com")
    renter = make_user(email="resmodel-renter12@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2027, 2, 10),
        end_date=date(2027, 2, 12),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()

    db_session.add(
        CheckEvidence(
            reservation_id=reservation.id,
            type="check_in",
            photo_url="https://example.com/in.jpg",
        )
    )
    db_session.commit()
    db_session.refresh(reservation)
    assert reservation.checkin_photo_url == "https://example.com/in.jpg"
    assert reservation.checkout_photo_url is None

    db_session.add(
        CheckEvidence(
            reservation_id=reservation.id,
            type="check_out",
            photo_url="https://example.com/out.jpg",
        )
    )
    db_session.commit()
    db_session.refresh(reservation)
    assert reservation.checkin_photo_url == "https://example.com/in.jpg"
    assert reservation.checkout_photo_url == "https://example.com/out.jpg"
