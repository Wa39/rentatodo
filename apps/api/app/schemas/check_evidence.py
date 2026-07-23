"""Pydantic schema for check-in/check-out requests. Mirrors
packages/contracts/openapi.yaml's CheckInOutRequest exactly.
"""

from pydantic import BaseModel, Field


class CheckInOutRequest(BaseModel):
    """Payload for POST /reservations/{reservation_id}/checkin and
    .../checkout.
    """

    photo_url: str = Field(..., description="Photo evidence of item condition.")
    notes: str | None = Field(
        default=None, description="Optional notes about the item condition."
    )
