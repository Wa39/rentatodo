"""Items endpoints: publish, list with filters, and get detail."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.item import (
    CategoryEnum,
    CreateItemRequest,
    ItemDetailResponse,
    ItemListResponse,
    ItemResponse,
)
from app.services.items import create_item, get_item, get_unavailable_dates, list_items

router = APIRouter()


@router.post("/items", status_code=201)
def publish_item(
    data: CreateItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    """Publish a new item. owner_id is always the authenticated user.

    Args:
        data: The item payload (name, description, category, price, photo).
        current_user: Resolved by get_current_user — the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The newly created item's public representation.
    """
    item = create_item(db, owner_id=current_user.id, data=data)
    return ItemResponse.model_validate(item)


@router.get("/items")
def list_items_endpoint(
    q: str | None = None,
    category: CategoryEnum | None = None,
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    available_from: date | None = None,
    available_to: date | None = None,
    sort: str = Query(default="recent", pattern="^(popular|recent)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
) -> ItemListResponse:
    """List active items, with optional filters, search, and pagination.

    Args:
        q: Free-text search over name and description.
        category: Exact category filter.
        min_price: Inclusive lower price bound, in centavos.
        max_price: Inclusive upper price bound, in centavos.
        available_from: Inclusive lower bound; filters out items with blocking reservations in this range.
        available_to: Inclusive upper bound; filters out items with blocking reservations in this range.
        sort: "recent" or "popular" (currently identical ordering).
        page: 1-indexed page number.
        limit: Items per page, max 50.
        db: Database session injected by FastAPI.

    Returns:
        The matching page of items, plus pagination metadata.
    """
    items, total = list_items(
        db,
        q=q,
        category=category.value if category else None,
        min_price=min_price,
        max_price=max_price,
        available_from=available_from,
        available_to=available_to,
        sort=sort,
        page=page,
        limit=limit,
    )
    return ItemListResponse(
        items=[ItemResponse.model_validate(item) for item in items],
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/items/{item_id}")
def get_item_endpoint(item_id: UUID, db: Session = Depends(get_db)) -> ItemDetailResponse:
    """Get an item's detail, including its unavailable date ranges.

    Args:
        item_id: The item's id.
        db: Database session injected by FastAPI.

    Returns:
        The item's detail representation.
    """
    item = get_item(db, item_id)
    response = ItemDetailResponse.model_validate(item)
    response.unavailable_dates = get_unavailable_dates(db, item_id)
    return response
