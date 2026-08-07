"""Tests for the Item model and its database-level constraints."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.item import Item
from app.models.user import User


def test_item_gets_id_created_at_and_default_is_active(db_session: Session, make_user) -> None:
    """Happy path: an Item inserted without setting id/created_at/is_active
    still gets sensible values, because Postgres fills them in.
    """
    owner: User = make_user(email="owner1@example.com")
    item = Item(
        owner_id=owner.id,
        name="Taladro Bosch",
        description="Taladro percutor profesional",
        category="tools",
        price_per_day=5000,
        photo_url="https://example.com/photo.jpg",
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)

    assert item.id is not None
    assert item.created_at is not None
    assert item.is_active is True


def test_price_per_day_must_be_positive(db_session: Session, make_user) -> None:
    """Failure path: the price>0 CHECK constraint is enforced by Postgres
    itself, not only by application code.
    """
    owner: User = make_user(email="owner2@example.com")
    item = Item(
        owner_id=owner.id,
        name="Item gratis",
        description="No deberia poder crearse",
        category="tools",
        price_per_day=0,
        photo_url="https://example.com/photo.jpg",
    )
    db_session.add(item)

    with pytest.raises(IntegrityError):
        db_session.commit()
