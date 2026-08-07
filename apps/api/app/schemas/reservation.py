"""Pydantic schemas for the Reservations endpoints. Mirrors
packages/contracts/openapi.yaml exactly.
"""

from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReservationStatusEnum(str, Enum):
    """The reservation state machine's 7 possible statuses."""

    REQUESTED = "requested"
    APPROVED = "approved"
    DELIVERED = "delivered"
    RETURNED = "returned"
    CLOSED = "closed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DepositStatusEnum(str, Enum):
    """Derived from the latest Transaction for a reservation."""

    NONE = "none"
    HELD = "held"
    RELEASED = "released"
    FROZEN = "frozen"


class CreateReservationRequest(BaseModel):
    """Payload for POST /items/{item_id}/reservations."""

    start_date: date = Field(..., description="First day of rental. Must be today or future.")
    end_date: date = Field(..., description="Last day of rental. Must be >= start_date.")


class ReservationResponse(BaseModel):
    """Public reservation representation, as returned by every
    Reservations endpoint.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_id: UUID
    item_name: str
    item_photo_url: str
    renter_id: UUID
    renter_name: str
    start_date: date
    end_date: date
    status: ReservationStatusEnum
    deposit_amount: int
    deposit_status: DepositStatusEnum
    created_at: datetime
    updated_at: datetime


class ReservationListResponse(BaseModel):
    """Paginated response for GET /users/me/reservations and
    GET /users/me/requests.
    """

    reservations: list[ReservationResponse]
    page: int
    limit: int
    total: int
