"""Tests for the Report model and its database-level constraints."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.report import Report


def test_report_gets_id_and_created_at(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: a Report inserted without setting id/created_at still
    gets sensible values from Postgres.
    """
    owner = make_user(email="report-owner1@example.com")
    renter = make_user(email="report-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="delivered")

    report = Report(
        reservation_id=reservation.id,
        reported_by=renter.id,
        reason="The drill bit was broken",
        photo_url="https://example.com/broken.jpg",
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)

    assert report.id is not None
    assert report.created_at is not None


def test_report_reservation_id_must_be_unique(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Failure path: a second Report for the same reservation violates
    the UNIQUE constraint at the database level — the database-level
    half of "one report per reservation" (app.services.reports.report_problem
    enforces the other half before ever reaching this constraint).
    """
    owner = make_user(email="report-owner2@example.com")
    renter = make_user(email="report-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="delivered")
    db_session.add(
        Report(
            reservation_id=reservation.id,
            reported_by=renter.id,
            reason="First report",
            photo_url="https://example.com/first.jpg",
        )
    )
    db_session.commit()

    db_session.add(
        Report(
            reservation_id=reservation.id,
            reported_by=owner.id,
            reason="Second report",
            photo_url="https://example.com/second.jpg",
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
