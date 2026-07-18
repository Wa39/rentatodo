"""Business logic for Items: creation, single-item lookup, and (Task 4)
filtered/paginated listing.
"""

import re
import uuid
from datetime import date

from sqlalchemy import TextClause, func, select, text
from sqlalchemy.orm import Session, joinedload

from app.exceptions import AppError
from app.models.item import Item
from app.models.reservation import BLOCKING_STATUSES, Reservation
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


def _sanitize_search_token(token: str) -> str:
    """Strip tsquery operator characters (&, |, !, (, ), :, etc.) from a
    raw search token so it can't be interpreted as tsquery syntax — only
    word characters (Unicode letters/digits/underscore) survive.

    Args:
        token: One raw whitespace-delimited token from the user's query.

    Returns:
        The token with every non-word character removed. May be empty.
    """
    return re.sub(r"[^\w]", "", token, flags=re.UNICODE)


def _search_condition(q: str) -> TextClause | None:
    """Build a full-text search condition matching idx_items_search:
    to_tsvector('simple', immutable_unaccent(name || ' ' || description)),
    with each query token turned into a prefix match, ANDed together.
    Column references are qualified with "items." to avoid ambiguity
    with the joined owner's "name" column — see inline comment below.

    to_tsquery (unlike plainto_tsquery) requires explicit boolean
    operators between lexemes and supports prefix matching (':*') —
    needed for "tala" to find "taladro", which the contract requires.
    Because to_tsquery parses its own mini-language, &, |, !, (, ), and
    : in raw user input would otherwise be interpreted as operators and
    raise a syntax error (e.g. q="camping & hiking") — so every token is
    sanitized down to word characters before being embedded.

    Args:
        q: The raw search string, e.g. "taladro bosch".

    Returns:
        A SQLAlchemy text() clause with one bound parameter per surviving
        token, or None if q contains no usable search term at all (empty,
        whitespace-only, or entirely tsquery-special punctuation) —
        callers should treat None the same as "no search filter".
    """
    tokens = [_sanitize_search_token(token) for token in q.split()]
    tokens = [token for token in tokens if token]
    if not tokens:
        return None
    params = {f"term{i}": token for i, token in enumerate(tokens)}
    tsquery_expr = " || ' & ' || ".join(
        f"(immutable_unaccent(:term{i}) || ':*')" for i in range(len(tokens))
    )
    # Columns are qualified with the "items" table because list_items joins
    # in the owner (users.name also exists), which would otherwise make
    # "name" ambiguous. This doesn't change what the planner matches
    # against idx_items_search: Postgres resolves qualified and
    # unqualified column references to the same Var node internally.
    return text(
        "to_tsvector('simple', immutable_unaccent(items.name || ' ' || items.description)) "
        f"@@ to_tsquery('simple', {tsquery_expr})"
    ).bindparams(**params)


def list_items(
    db: Session,
    *,
    q: str | None = None,
    category: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    available_from: date | None = None,
    available_to: date | None = None,
    sort: str = "recent",
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Item], int]:
    """List active items matching the given filters, paginated.

    Args:
        db: Database session.
        q: Free-text search over name+description (see _search_condition).
            An empty, whitespace-only, or all-punctuation value is treated
            the same as no search filter — never raises.
        category: Exact category match.
        min_price: Inclusive lower bound on price_per_day.
        max_price: Inclusive upper bound on price_per_day.
        available_from: Inclusive lower bound. If given (with or
            without available_to), excludes any item with a blocking
            reservation overlapping [available_from, available_to].
        available_to: Inclusive upper bound. Same exclusion as
            available_from — either can be sent alone as an open-ended
            bound on the other side.
        sort: "recent" or "popular". Both currently sort by created_at
            DESC — "popular" has no real metric until Reservations exists.
        page: 1-indexed page number.
        limit: Items per page.

    Returns:
        A tuple of (items for the requested page, total matching count
        across all pages).
    """
    query = select(Item).options(joinedload(Item.owner)).where(Item.is_active == True)  # noqa: E712

    if q:
        condition = _search_condition(q)
        if condition is not None:
            query = query.where(condition)
    if category:
        query = query.where(Item.category == category)
    if min_price is not None:
        query = query.where(Item.price_per_day >= min_price)
    if max_price is not None:
        query = query.where(Item.price_per_day <= max_price)
    if available_from is not None or available_to is not None:
        range_start = available_from or date.min
        range_end = available_to or date.max
        query = query.where(
            ~Item.id.in_(
                select(Reservation.item_id).where(
                    Reservation.status.in_(BLOCKING_STATUSES),
                    Reservation.start_date <= range_end,
                    Reservation.end_date >= range_start,
                )
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery()))

    query = query.order_by(Item.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)

    items = list(db.scalars(query).unique())
    return items, total


def get_unavailable_dates(db: Session, item_id: uuid.UUID) -> list[dict[str, str]]:
    """List every date range this item is unavailable for, derived from
    its active (blocking) reservations.

    Args:
        db: Database session.
        item_id: The item's id.

    Returns:
        A list of {"start_date": "...", "end_date": "..."} dicts
        (ISO 8601), ordered by start_date. Empty if the item has no
        blocking reservations.
    """
    rows = db.execute(
        select(Reservation.start_date, Reservation.end_date)
        .where(Reservation.item_id == item_id, Reservation.status.in_(BLOCKING_STATUSES))
        .order_by(Reservation.start_date)
    ).all()
    return [
        {"start_date": row.start_date.isoformat(), "end_date": row.end_date.isoformat()}
        for row in rows
    ]
