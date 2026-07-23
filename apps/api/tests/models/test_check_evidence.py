"""Tests for the CheckEvidence model and its database-level constraints."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.check_evidence import CheckEvidence


def test_check_evidence_gets_id_and_created_at(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: a CheckEvidence inserted without setting id/created_at
    still gets sensible values from Postgres.
    """
    owner = make_user(email="checkevidence-owner1@example.com")
    renter = make_user(email="checkevidence-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="approved")

    evidence = CheckEvidence(
        reservation_id=reservation.id,
        type="check_in",
        photo_url="https://example.com/checkin.jpg",
    )
    db_session.add(evidence)
    db_session.commit()
    db_session.refresh(evidence)

    assert evidence.id is not None
    assert evidence.created_at is not None
    assert evidence.notes is None


def test_check_evidence_type_must_be_check_in_or_check_out(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Failure path: the type CHECK constraint is enforced by Postgres,
    not only by application code.
    """
    owner = make_user(email="checkevidence-owner2@example.com")
    renter = make_user(email="checkevidence-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="approved")

    evidence = CheckEvidence(
        reservation_id=reservation.id,
        type="invalid_type",
        photo_url="https://example.com/checkin.jpg",
    )
    db_session.add(evidence)

    with pytest.raises(IntegrityError):
        db_session.commit()
