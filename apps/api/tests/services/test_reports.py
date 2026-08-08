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


def test_get_report_happy_path_by_renter(db_session: Session, make_user, make_item) -> None:
    """Happy path: the renter who filed the report can read it back."""
    from app.services.reports import get_report, report_problem

    owner = make_user(email="report-owner6@example.com")
    renter = make_user(email="report-renter6@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)
    filed = report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=renter.id,
        data=CreateReportRequest(reason="Damaged", photo_url="https://example.com/damaged.jpg"),
    )

    fetched = get_report(db_session, reservation_id=reservation.id, user_id=renter.id)

    assert fetched.id == filed.id
    assert fetched.reason == "Damaged"


def test_get_report_happy_path_by_owner(db_session: Session, make_user, make_item) -> None:
    """Happy path: the item's owner (not just the reporter) can read the
    report back too — anyone who's a participant, not just who filed it.
    """
    from app.services.reports import get_report, report_problem

    owner = make_user(email="report-owner7@example.com")
    renter = make_user(email="report-renter7@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)
    report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=renter.id,
        data=CreateReportRequest(reason="Damaged", photo_url="https://example.com/damaged.jpg"),
    )

    fetched = get_report(db_session, reservation_id=reservation.id, user_id=owner.id)

    assert fetched.reason == "Damaged"


def test_get_report_requires_participant(db_session: Session, make_user, make_item) -> None:
    """Failure path: a stranger can't read the report, 403 FORBIDDEN."""
    from app.services.reports import get_report, report_problem

    owner = make_user(email="report-owner8@example.com")
    renter = make_user(email="report-renter8@example.com")
    stranger = make_user(email="report-stranger8@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)
    report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=renter.id,
        data=CreateReportRequest(reason="Damaged", photo_url="https://example.com/damaged.jpg"),
    )

    with pytest.raises(AppError) as exc_info:
        get_report(db_session, reservation_id=reservation.id, user_id=stranger.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_get_report_raises_not_found_when_none_filed(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a reservation with no report yet is 404 NOT_FOUND,
    not an empty/null body.
    """
    from app.services.reports import get_report

    owner = make_user(email="report-owner9@example.com")
    renter = make_user(email="report-renter9@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)

    with pytest.raises(AppError) as exc_info:
        get_report(db_session, reservation_id=reservation.id, user_id=renter.id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_get_report_raises_not_found_for_missing_reservation(
    db_session: Session, make_user
) -> None:
    """Failure path: a nonexistent reservation is 404 NOT_FOUND."""
    import uuid

    from app.services.reports import get_report

    user = make_user(email="report-owner10@example.com")

    with pytest.raises(AppError) as exc_info:
        get_report(db_session, reservation_id=uuid.uuid4(), user_id=user.id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"
