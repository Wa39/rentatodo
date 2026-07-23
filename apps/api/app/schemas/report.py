"""Pydantic schemas for the Reports endpoint. Mirrors
packages/contracts/openapi.yaml's CreateReportRequest/ReportResponse exactly.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateReportRequest(BaseModel):
    """Payload for POST /reservations/{reservation_id}/report."""

    reason: str = Field(
        ..., min_length=1, description="Free text description of the problem."
    )
    photo_url: str = Field(..., description="Required photo evidence of the problem.")


class ReportResponse(BaseModel):
    """Public report representation, as returned by POST .../report."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reservation_id: UUID
    reported_by: UUID
    reason: str
    photo_url: str
    created_at: datetime
