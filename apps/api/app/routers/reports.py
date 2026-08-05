"""Reports endpoint: file a problem report against a reservation."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.report import CreateReportRequest, ReportResponse
from app.services.reports import report_problem

router = APIRouter()


@router.post("/reservations/{reservation_id}/report", status_code=201)
def report_problem_endpoint(
    reservation_id: UUID,
    data: CreateReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportResponse:
    """File a problem report against a reservation, freezing its deposit.

    Args:
        reservation_id: The reservation being reported.
        data: The report's reason and photo_url.
        current_user: Resolved by get_current_user — must be the
            reservation's renter or the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The newly created report's public representation.
    """
    report = report_problem(
        db, reservation_id=reservation_id, reporter_id=current_user.id, data=data
    )
    return ReportResponse.model_validate(report)
