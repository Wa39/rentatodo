"""Business logic for Items: creation, single-item lookup, and (Task 4)
filtered/paginated listing.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.exceptions import AppError
from app.models.item import Item
from app.schemas.item import CreateItemRequest


def create_item(db: Session, owner_id: uuid.UUID, data: CreateItemRequest) -> Item:
    """Publish a new item.

    Args:
        db: Database session.
        owner_id: The authenticated user's id — always the source of
            truth for ownership, never taken from ``data``.
        data: The validated item payload.

    Returns:
        The newly created Item.
    """
    item = Item(
        owner_id=owner_id,
        name=data.name,
        description=data.description,
        category=data.category.value,
        price_per_day=data.price_per_day,
        photo_url=str(data.photo_url),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_item(db: Session, item_id: uuid.UUID) -> Item:
    """Look up a single active item by id, with its owner pre-loaded.

    Args:
        db: Database session.
        item_id: The item's id.

    Returns:
        The matching, active Item.

    Raises:
        AppError: 404 NOT_FOUND if no item exists with that id, or it
            exists but is inactive (soft-deleted). The contract doesn't
            distinguish the two cases.
    """
    item = db.scalar(
        select(Item)
        .options(joinedload(Item.owner))
        .where(Item.id == item_id, Item.is_active == True)  # noqa: E712
    )
    if item is None:
        raise AppError(404, "NOT_FOUND", "Item not found")
    return item
