"""Tests for app.services.items: create_item and get_item."""

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.schemas.item import CreateItemRequest


def test_create_item_sets_owner_from_argument(db_session: Session, make_user) -> None:
    """Happy path: create_item persists an Item whose owner_id is exactly
    the id passed in, regardless of anything else.
    """
    from app.services.items import create_item

    owner = make_user(email="creator@example.com")
    data = CreateItemRequest(
        name="Taladro Bosch",
        description="Taladro percutor profesional",
        category="tools",
        price_per_day=5000,
        photo_url="https://example.com/photo.jpg",
    )

    item = create_item(db_session, owner_id=owner.id, data=data)

    assert item.id is not None
    assert item.owner_id == owner.id
    assert item.is_active is True


def test_create_item_raises_integrity_error_for_nonexistent_owner(db_session: Session) -> None:
    """Failure path: passing a nonexistent owner_id raises IntegrityError
    due to foreign-key constraint violation at commit time.
    """
    from app.services.items import create_item

    data = CreateItemRequest(
        name="Taladro Bosch",
        description="Taladro percutor profesional",
        category="tools",
        price_per_day=5000,
        photo_url="https://example.com/photo.jpg",
    )

    with pytest.raises(IntegrityError):
        create_item(db_session, owner_id=uuid.uuid4(), data=data)


def test_get_item_returns_item_with_owner_name(db_session: Session, make_user, make_item) -> None:
    """Happy path: get_item resolves owner_name via the owner relationship."""
    from app.services.items import get_item

    owner = make_user(email="owner3@example.com", name="Carla Duena")
    created = make_item(owner_id=owner.id)

    item = get_item(db_session, created.id)

    assert item.id == created.id
    assert item.owner_name == "Carla Duena"


def test_get_item_raises_not_found_for_missing_id(db_session: Session) -> None:
    """Failure path: a random, never-created id raises 404 NOT_FOUND."""
    from app.services.items import get_item

    with pytest.raises(AppError) as exc_info:
        get_item(db_session, uuid.uuid4())

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_get_item_raises_not_found_for_inactive_item(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: an inactive (soft-deleted) item is treated as not
    found, same as a missing one — the contract doesn't distinguish them.
    """
    from app.services.items import get_item

    owner = make_user(email="owner4@example.com")
    inactive_item = make_item(owner_id=owner.id, is_active=False)

    with pytest.raises(AppError) as exc_info:
        get_item(db_session, inactive_item.id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"
