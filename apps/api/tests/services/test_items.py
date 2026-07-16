"""Tests for app.services.items: create_item, get_item, and list_items
(including search sanitization, filtering, and pagination).
"""

import uuid
from datetime import date, datetime, timedelta, timezone

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


def test_list_items_filters_by_category(db_session: Session, make_user, make_item) -> None:
    """Happy path: category filter returns only matching items."""
    from app.services.items import list_items

    owner = make_user(email="lister1@example.com")
    make_item(owner_id=owner.id, name="Taladro", category="tools")
    make_item(owner_id=owner.id, name="Camara", category="photography")

    items, total = list_items(db_session, category="photography")

    assert total == 1
    assert items[0].name == "Camara"


def test_list_items_filters_by_price_range(db_session: Session, make_user, make_item) -> None:
    """Happy path: min_price and max_price are both inclusive."""
    from app.services.items import list_items

    owner = make_user(email="lister2@example.com")
    make_item(owner_id=owner.id, name="Barato", price_per_day=1000)
    make_item(owner_id=owner.id, name="Medio", price_per_day=5000)
    make_item(owner_id=owner.id, name="Caro", price_per_day=10000)

    items, total = list_items(db_session, min_price=2000, max_price=8000)

    assert total == 1
    assert items[0].name == "Medio"


def test_list_items_search_finds_partial_accent_insensitive_match(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: searching "camara" (no accent, partial) finds an item
    named "Camara Canon" (also tests the DB's own accent handling by
    storing the accented form and searching the plain form).
    """
    from app.services.items import list_items

    owner = make_user(email="lister3@example.com")
    make_item(owner_id=owner.id, name="Camara Canon", description="Buen estado")
    make_item(owner_id=owner.id, name="Taladro Bosch", description="Percutor")

    items, total = list_items(db_session, q="cama")

    assert total == 1
    assert items[0].name == "Camara Canon"


def test_list_items_search_handles_multiple_words(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a two-word query matches an item containing both terms."""
    from app.services.items import list_items

    owner = make_user(email="lister4@example.com")
    make_item(owner_id=owner.id, name="Taladro Bosch", description="Percutor profesional")
    make_item(owner_id=owner.id, name="Taladro Makita", description="Basico")

    items, total = list_items(db_session, q="taladro bosch")

    assert total == 1
    assert items[0].name == "Taladro Bosch"


def test_list_items_excludes_inactive_items(db_session: Session, make_user, make_item) -> None:
    """Failure/edge path: an inactive item never appears in the list,
    even with no filters at all.
    """
    from app.services.items import list_items

    owner = make_user(email="lister5@example.com")
    make_item(owner_id=owner.id, name="Activo", is_active=True)
    make_item(owner_id=owner.id, name="Inactivo", is_active=False)

    items, total = list_items(db_session)

    assert total == 1
    assert items[0].name == "Activo"


def test_list_items_paginates_and_reports_total(db_session: Session, make_user, make_item) -> None:
    """Happy path: limit caps the page size, total reflects all matches."""
    from app.services.items import list_items

    owner = make_user(email="lister6@example.com")
    for i in range(3):
        make_item(owner_id=owner.id, name=f"Item {i}")

    page_1, total = list_items(db_session, page=1, limit=2)
    page_2, _ = list_items(db_session, page=2, limit=2)

    assert total == 3
    assert len(page_1) == 2
    assert len(page_2) == 1


def test_list_items_sort_popular_falls_back_to_recent_order(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: sort=popular has no real metric yet (no Reservations),
    so it must order identically to sort=recent (newest first).
    """
    from app.services.items import list_items

    owner = make_user(email="lister7@example.com")
    first = make_item(owner_id=owner.id, name="Primero")
    # Backdated: Postgres's now() is frozen for the whole test
    # transaction (db_session wraps the test in one transaction), so
    # both items would otherwise get an identical created_at and the
    # DESC ordering this test checks would be undefined.
    first.created_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.add(first)
    db_session.commit()

    second = make_item(owner_id=owner.id, name="Segundo")

    items, _ = list_items(db_session, sort="popular")

    assert [item.id for item in items] == [second.id, first.id]


def test_list_items_search_sanitizes_tsquery_special_characters(
    db_session: Session, make_user, make_item
) -> None:
    """Regression test: a query containing tsquery operator characters
    (&, parentheses, etc.) must not raise a Postgres syntax error — each
    token is sanitized down to word characters before being fed to
    to_tsquery, and the sanitized tokens still find a matching item.
    """
    from app.services.items import list_items

    owner = make_user(email="lister9@example.com")
    make_item(owner_id=owner.id, name="Taladro Bosch", description="Percutor profesional")
    make_item(owner_id=owner.id, name="Camara Canon", description="Buen estado")

    items, total = list_items(db_session, q="taladro & bosch")

    assert total == 1
    assert items[0].name == "Taladro Bosch"


def test_list_items_search_sanitizes_accented_special_characters(
    db_session: Session, make_user, make_item
) -> None:
    """Regression test: punctuation mixed with accented characters (e.g.
    "cámara (nueva)") doesn't raise either — sanitization is Unicode-aware
    so the accented letters survive stripping, and unaccent still matches
    the plain-text stored name.
    """
    from app.services.items import list_items

    owner = make_user(email="lister10@example.com")
    make_item(owner_id=owner.id, name="Camara Nueva", description="Sin uso")
    make_item(owner_id=owner.id, name="Taladro Bosch", description="Percutor profesional")

    items, total = list_items(db_session, q="cámara (nueva)")

    assert total == 1
    assert items[0].name == "Camara Nueva"


def test_list_items_whitespace_only_query_behaves_like_no_filter(
    db_session: Session, make_user, make_item
) -> None:
    """Regression test: list_items itself (not just the router) must treat
    a whitespace-only q as "no search filter" rather than raising — the
    service is the reusable unit and must be self-protecting.
    """
    from app.services.items import list_items

    owner = make_user(email="lister11@example.com")
    make_item(owner_id=owner.id, name="Cualquiera")

    items, total = list_items(db_session, q="   ")

    assert total == 1
    assert items[0].name == "Cualquiera"


def test_list_items_query_that_sanitizes_to_empty_behaves_like_no_filter(
    db_session: Session, make_user, make_item
) -> None:
    """Regression test: a query made entirely of tsquery-special
    punctuation (nothing survives sanitization) must not raise, and must
    behave exactly like no search filter at all.
    """
    from app.services.items import list_items

    owner = make_user(email="lister12@example.com")
    make_item(owner_id=owner.id, name="Cualquiera")

    items, total = list_items(db_session, q="&&&")

    assert total == 1
    assert items[0].name == "Cualquiera"


def test_list_items_accepts_available_dates_without_excluding_anything(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: available_from/available_to are accepted but don't
    exclude any active item yet — there's no Reservation table to check
    against.
    """
    from app.services.items import list_items

    owner = make_user(email="lister8@example.com")
    make_item(owner_id=owner.id, name="Cualquiera")

    items, total = list_items(
        db_session, available_from=date(2026, 8, 1), available_to=date(2026, 8, 5)
    )

    assert total == 1
