"""Tests for the Item Pydantic schemas."""

import pytest
from datetime import datetime
from uuid import UUID, uuid4
from pydantic import ValidationError

from app.models.item import Item
from app.models.user import User
from app.schemas.item import CategoryEnum, CreateItemRequest, ItemResponse


def test_create_item_request_rejects_price_not_positive() -> None:
    """Failure path: price_per_day must be > 0, matching the DB CHECK
    constraint from Task 1.
    """
    with pytest.raises(ValidationError):
        CreateItemRequest(
            name="Taladro",
            description="Taladro percutor",
            category="tools",
            price_per_day=0,
            photo_url="https://example.com/photo.jpg",
        )


def test_create_item_request_rejects_invalid_category() -> None:
    """Failure path: category must be one of CategoryEnum's 7 values."""
    with pytest.raises(ValidationError):
        CreateItemRequest(
            name="Taladro",
            description="Taladro percutor",
            category="not-a-real-category",
            price_per_day=5000,
            photo_url="https://example.com/photo.jpg",
        )


def test_create_item_request_rejects_non_uri_photo_url() -> None:
    """Failure path: photo_url must be a valid URI, not arbitrary text."""
    with pytest.raises(ValidationError):
        CreateItemRequest(
            name="Taladro",
            description="Taladro percutor",
            category="tools",
            price_per_day=5000,
            photo_url="not a url",
        )


def test_create_item_request_succeeds_with_valid_payload() -> None:
    """Happy path: valid CreateItemRequest constructs successfully,
    with all fields round-tripping correctly.
    """
    request = CreateItemRequest(
        name="Taladro Bosch",
        description="Taladro percutor profesional",
        category="tools",
        price_per_day=5000,
        photo_url="https://example.com/photo.jpg",
    )

    assert request.name == "Taladro Bosch"
    assert request.description == "Taladro percutor profesional"
    assert request.category == CategoryEnum.TOOLS
    assert request.price_per_day == 5000
    assert str(request.photo_url) == "https://example.com/photo.jpg"


def test_item_response_builds_from_an_item_model_including_owner_name() -> None:
    """Happy path: ItemResponse resolves owner_name via the owner
    relationship, without needing a separate query.
    """
    owner_id = uuid4()
    item_id = uuid4()
    created_at = datetime.now()

    owner = User(name="Ana Duena", email="ana@example.com", password_hash="hashed")
    item = Item(
        id=item_id,
        owner_id=owner_id,
        name="Taladro Bosch",
        description="Taladro percutor profesional",
        category="tools",
        price_per_day=5000,
        photo_url="https://example.com/photo.jpg",
        is_active=True,
        created_at=created_at,
    )
    item.owner = owner

    response = ItemResponse.model_validate(item)

    assert response.owner_name == "Ana Duena"
    assert response.category == "tools"
