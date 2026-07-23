"""Tests for app.services.reports: report_problem."""

from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.schemas.check_evidence import CheckInOutRequest
from app.schemas.report import CreateReportRequest
from app.schemas.reservation import CreateReservationRequest


def _dates(start_offset: int, days: int) -> CreateReservationRequest:
    start = date.today() + timedelta(days=start_offset)
    end = start + timedelta(days=days - 1)
    return CreateReservationRequest(start_date=start, end_date=end)


def _make_delivered_reservation(db_session: Session, owner, renter, item):
    from app.services.reservations import approve_reservation, checkin_reservation, create_reservation

    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    return checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )


def test_report_problem_happy_path_by_renter(db_session: Session, make_user, make_item) -> None:
    """Happy path: the renter reports a problem, deposit becomes frozen,
    status does not change.
    """
    from app.services.reports import report_problem

    owner = make_user(email="report-owner1@example.com")
    renter = make_user(email="report-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)

    report = report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=renter.id,
        data=CreateReportRequest(reason="Item arrived damaged", photo_url="https://example.com/damaged.jpg"),
    )

    assert report.reason == "Item arrived damaged"
    db_session.refresh(reservation)
    assert reservation.deposit_status == "frozen"
    assert reservation.status == "delivered"


def test_report_problem_happy_path_by_owner(db_session: Session, make_user, make_item) -> None:
    """Happy path: the owner can also report a problem, not just the renter."""
    from app.services.reports import report_problem

    owner = make_user(email="report-owner2@example.com")
    renter = make_user(email="report-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)

    report = report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=owner.id,
        data=CreateReportRequest(reason="Renter returned it broken", photo_url="https://example.com/broken.jpg"),
    )

    assert report.reported_by == owner.id


def test_report_problem_requires_participant(db_session: Session, make_user, make_item) -> None:
    """Failure path: a stranger can't file a report, 403 FORBIDDEN."""
    from app.services.reports import report_problem

    owner = make_user(email="report-owner3@example.com")
    renter = make_user(email="report-renter3@example.com")
    stranger = make_user(email="report-stranger3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)

    with pytest.raises(AppError) as exc_info:
        report_problem(
            db_session,
            reservation_id=reservation.id,
            reporter_id=stranger.id,
            data=CreateReportRequest(reason="Not my business", photo_url="https://example.com/x.jpg"),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_report_problem_requires_delivered_or_returned_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: reporting a still-requested reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reports import report_problem
    from app.services.reservations import create_reservation

    owner = make_user(email="report-owner4@example.com")
    renter = make_user(email="report-renter4@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    with pytest.raises(AppError) as exc_info:
        report_problem(
            db_session,
            reservation_id=reservation.id,
            reporter_id=renter.id,
            data=CreateReportRequest(reason="Too early", photo_url="https://example.com/x.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_report_problem_rejects_duplicate_report(db_session: Session, make_user, make_item) -> None:
    """Failure path: a second report on the same reservation is 409
    REPORT_EXISTS.
    """
    from app.services.reports import report_problem

    owner = make_user(email="report-owner5@example.com")
    renter = make_user(email="report-renter5@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)
    report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=renter.id,
        data=CreateReportRequest(reason="First problem", photo_url="https://example.com/first.jpg"),
    )

    with pytest.raises(AppError) as exc_info:
        report_problem(
            db_session,
            reservation_id=reservation.id,
            reporter_id=owner.id,
            data=CreateReportRequest(reason="Second problem", photo_url="https://example.com/second.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "REPORT_EXISTS"
