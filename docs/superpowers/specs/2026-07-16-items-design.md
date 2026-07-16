# Items — Design

## Context

`User` + Auth (`POST /auth/register`, `POST /auth/login`, `GET /users/me`) are
merged to `develop` via PR #8. Per `apps/api/ROADMAP.md`'s "Next up" (Days
4-5), the next piece of work is `Item`.

`CLAUDE_BACKEND.md` (external reference doc, not committed to this repo,
`C:\Users\Jose\Downloads\documentos\CLAUDE_BACKEND.md`) is authoritative over
`packages/contracts/openapi.yaml` where the two add detail the contract
doesn't specify — same rule established in the Auth design. For Items, it
adds: a DB-level `CHECK (price_per_day > 0)` constraint, two specific
indexes (a partial index on `category`, and a GIN full-text index on
`name`/`description`), and the intended search mechanism (Postgres full-text
search, not a plain `ILIKE` scan).

**Scope:** only 3 endpoints — `POST /items`, `GET /items` (filtered list),
`GET /items/{item_id}`. `PATCH /items/{item_id}`, `DELETE /items/{item_id}`,
and `GET /users/me/items` are in the contract and in `CLAUDE_BACKEND.md`'s
"Week 1" grouping, but are deliberately deferred to a follow-up piece of
work — confirmed with Jose, per `apps/api/CLAUDE.md`'s "don't implement
beyond what's asked."

## File structure

```
apps/api/app/
├── models/
│   └── item.py              # NEW
├── schemas/
│   └── item.py               # NEW
├── routers/
│   └── items.py                # NEW
└── services/
    └── items.py                 # NEW

apps/api/alembic/versions/
└── <rev>_create_items_table.py    # NEW — also enables the unaccent extension

apps/api/tests/
├── models/
│   └── test_item.py                 # NEW
├── schemas/
│   └── test_item.py                   # NEW
├── services/
│   └── test_items.py                    # NEW
└── routers/
    └── test_items.py                      # NEW
```

Follows the same layered pattern Auth already established (router → service
→ model, `AppError` for domain errors, `tests/` mirrors `app/`).

## Data model — `Item` (`app/models/item.py`)

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID`, PK | `server_default=text("gen_random_uuid()")` — same as `User.id` |
| `owner_id` | `UUID`, FK → `users.id` | `nullable=False` |
| `name` | `String(255)` | `nullable=False` |
| `description` | `Text` | `nullable=False` |
| `category` | `CategoryEnum` (Postgres enum) | 7 values, includes `other` (added in contract PR #13) |
| `price_per_day` | `Integer` | Centavos, `nullable=False` |
| `photo_url` | `String` | `nullable=False`. Plain string field — no S3 pre-signed upload logic in this piece of work; that's separate infra work Jose/Wa are coordinating. `POST /items` just accepts and stores whatever URI the client sends. |
| `is_active` | `Boolean` | `nullable=False`, `default=True` |
| `created_at` | `DateTime(timezone=True)` | `server_default=func.now()` |

Relationship: `Item.owner` → `User`, used to resolve `owner_name` in
responses via `joinedload` (no N+1 query).

### Constraints and indexes (from `CLAUDE_BACKEND.md`)

```python
__table_args__ = (
    CheckConstraint("price_per_day > 0", name="ck_items_price_per_day_positive"),
    Index("idx_items_category", "category", postgresql_where=text("is_active = true")),
    Index(
        "idx_items_search",
        text("to_tsvector('simple', unaccent(name || ' ' || description))"),
        postgresql_using="gin",
    ),
)
```

The migration also runs `CREATE EXTENSION IF NOT EXISTS unaccent`.

## Schemas (`app/schemas/item.py`)

- `CreateItemRequest`: `name`, `description`, `category` (`CategoryEnum`),
  `price_per_day` (`int`, `gt=0`), `photo_url` (validated as a URI).
  `owner_id` is never accepted here — it comes from `get_current_user`, same
  as every other identity-bearing field in this codebase.
- `ItemResponse`: mirrors the contract's `ItemResponse`, including
  `owner_name` (resolved via the `owner` relationship).
- `ItemDetailResponse`: `ItemResponse` + `unavailable_dates: list = []`.
  Always empty in this piece of work — there is no `Reservation` table yet,
  so no reservation can exist, so the empty list is simply correct, not a
  stub. Populating it for real is Reservations' job later; no follow-up
  change needed here when that lands.
- `ItemListResponse`: `items`, `page`, `limit`, `total`.

## Endpoints (`app/routers/items.py`)

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| `POST` | `/items` | `get_current_user` | 201 | `owner_id` from token |
| `GET` | `/items` | none | 200 | see filtering below |
| `GET` | `/items/{item_id}` | none | 200 / 404 | `404 NOT_FOUND` if missing or `is_active=False` — contract doesn't distinguish the two cases |

## Filtering and search (`app/services/items.py`)

`list_items(db, filters) -> tuple[list[Item], int]` builds one query,
chaining `.where(...)` only for filters that were actually provided —
same style as `services/auth.py`'s `select(User).where(...)`.

- `category`, `min_price`, `max_price`: direct equality/range filters.
- `available_from` / `available_to`: accepted and validated as dates, but
  exclude nothing yet — with no `Reservation` table, every active item is
  trivially available for any range. Starts actually filtering once
  Reservations exists, with no schema change needed here.
- `sort`: `recent` (default) orders by `created_at DESC`. `popular` is
  accepted (doesn't 422) but sorts identically to `recent` for now — there's
  no popularity metric until Reservations exists. Documented as a temporary
  decision in the ROADMAP, revisited when Reservations lands.
- `page` / `limit`: standard offset pagination, `total` from a matching
  `COUNT(*)` query (same `WHERE`, unpaginated).

### Full-text search (`q`)

Per `CLAUDE_BACKEND.md`: case-insensitive, accent-insensitive, partial
match, backed by the `idx_items_search` GIN index — i.e. Postgres full-text
search, not `ILIKE` (the document's parenthetical "(ILIKE)" note is
inconsistent with the GIN `tsvector` index it also specifies; `ILIKE` can't
use that index, and `tsvector` is already case-insensitive on its own, so
this design uses full-text search only).

Query side mirrors the index expression, wrapped in `unaccent()`:

```sql
to_tsvector('simple', unaccent(name || ' ' || description))
  @@ to_tsquery('simple', unaccent(:term) || ':*')
```

Partial match ("tala" finds "taladro") requires prefix search
(`lexeme:*`), which `to_tsquery` supports but `plainto_tsquery` does not.

Multi-word queries: `to_tsquery` requires explicit boolean operators
between lexemes (unlike `plainto_tsquery`, it errors on a raw phrase with
spaces). Not specified in `CLAUDE_BACKEND.md` — this design adds a small
tokenizer that splits `q` on whitespace and joins each term as
`term:* & term:*`, so multi-word search works with prefix matching intact.

## Error handling

Reuses existing infrastructure, nothing new:

- `POST /items` without a token → `401 UNAUTHORIZED` (via `get_current_user`,
  already built).
- `POST /items` with invalid data (price ≤ 0, bad category, non-URI
  `photo_url`) → `422 VALIDATION_ERROR` via the `RequestValidationError`
  handler from PR #14 — no new code needed.
- `GET /items/{item_id}` not found or inactive → `AppError(404, "NOT_FOUND",
  "Item not found")`, same pattern as Auth's `AppError` usage.
- `GET /items` invalid query params (e.g. bad `category` enum value) → also
  falls into the existing `RequestValidationError` handler.

No `403`/`CANNOT_RENT_OWN_ITEM`/`DATES_UNAVAILABLE` here — those belong to
Reservations, out of scope for this piece of work.

## Testing plan

Mirrors `app/`, reuses `db_session`/`client`/`make_user` fixtures, adds a
`make_item` factory fixture:

- `tests/models/test_item.py`: defaults (`is_active=True`, DB-generated
  `created_at`); the `price_per_day > 0` CHECK constraint rejects an invalid
  row at the DB level (not just via Pydantic).
- `tests/services/test_items.py`: each filter individually (category, price
  range, accent/prefix search, combinations), pagination (`total` correct,
  `page`/`limit` respected), `recent` ordering.
- `tests/schemas/test_item.py`: `CreateItemRequest` rejects price ≤ 0,
  invalid category, non-URI `photo_url`.
- `tests/routers/test_items.py`: `POST /items` happy path (201, `owner_id`
  comes from the token, not the body) and no-token failure (401); `GET
  /items` happy path and a filter combination that returns zero results;
  `GET /items/{item_id}` happy path and 404 (both nonexistent and inactive).

## Deferred / out of scope

- `PATCH /items/{item_id}`, `DELETE /items/{item_id}`, `GET
  /users/me/items` — next Items iteration.
- S3 pre-signed upload flow for `photo_url` — separate infra work, Jose/Wa
  coordinating separately.
- `available_from`/`available_to` actually excluding unavailable items,
  `sort=popular` having real semantics, `unavailable_dates` being populated
  — all depend on the `Reservation` table (Week 2).
