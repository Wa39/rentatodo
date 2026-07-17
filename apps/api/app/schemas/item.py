"""Pydantic schemas for the Items endpoints: create, list, and detail.
Mirrors packages/contracts/openapi.yaml exactly.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import AnyUrl, BaseModel, ConfigDict, Field


class CategoryEnum(str, Enum):
    """The contract's closed set of item categories."""

    TOOLS = "tools"
    PHOTOGRAPHY = "photography"
    CAMPING = "camping"
    SPORTS = "sports"
    ELECTRONICS = "electronics"
    HOME = "home"
    OTHER = "other"


class CreateItemRequest(BaseModel):
    """Payload for POST /items. owner_id is deliberately absent — it is
    always taken from the authenticated user's token.
    """

    name: str = Field(..., min_length=1, description="Short display name.")
    description: str = Field(..., min_length=1, description="Full text description.")
    category: CategoryEnum = Field(..., description="One of the closed set of categories.")
    price_per_day: int = Field(..., gt=0, description="Price in USD centavos. 5000 = $50.00.")
    photo_url: AnyUrl = Field(..., description="URL to the item's photo.")


class ItemResponse(BaseModel):
    """Public item representation, as returned by create/list/detail."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    category: CategoryEnum
    price_per_day: int
    photo_url: str
    is_active: bool
    owner_id: UUID
    owner_name: str
    created_at: datetime


class ItemDetailResponse(ItemResponse):
    """ItemResponse plus unavailable date ranges. Always empty for now —
    see Global Constraints in the implementation plan for why.
    """

    unavailable_dates: list[dict[str, str]] = Field(default_factory=list)


class ItemListResponse(BaseModel):
    """Paginated response for GET /items."""

    items: list[ItemResponse]
    page: int
    limit: int
    total: int
