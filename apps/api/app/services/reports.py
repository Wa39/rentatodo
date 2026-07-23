"""Business logic for Reports: filing a problem report, which freezes
the reservation's deposit.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.models.report import Report
from app.models.reservation import Transaction
from app.schemas.report import CreateReportRequest
from app.services.reservations import _assert_participant, _get_reservation_or_404


def report_problem(
    db: Session, reservation_id: uuid.UUID, reporter_id: uuid.UUID, data: CreateReportRequest
) -> Report:
    """File a problem report against a reservation, freezing its deposit.

    Args:
        db: Database session.
        reservation_id: The reservation being reported.
        reporter_id: The authenticated caller's id — must be the
            reservation's renter or the item's owner.
        data: The report's reason and photo_url.

    Returns:
        The newly created Report. The reservation's status does NOT change.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller is neither the renter nor the owner.
            409 INVALID_TRANSITION if the reservation isn't "delivered"
            or "returned". 409 REPORT_EXISTS if a report already exists
            for this reservation.
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    _assert_participant(reservation, reporter_id)
    if reservation.status not in ("delivered", "returned"):
        raise AppError(
            409, "INVALID_TRANSITION", "Can only report a delivered or returned reservation"
        )

    existing = db.scalar(select(Report.id).where(Report.reservation_id == reservation_id))
    if existing is not None:
        raise AppError(409, "REPORT_EXISTS", "This reservation already has a report")

    report = Report(
        reservation_id=reservation_id,
        reported_by=reporter_id,
        reason=data.reason,
        photo_url=data.photo_url,
    )
    db.add(report)
    db.add(
        Transaction(
            reservation_id=reservation_id, type="freeze", amount=reservation.deposit_amount
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "REPORT_EXISTS", "This reservation already has a report")
    db.refresh(report)
    return report
