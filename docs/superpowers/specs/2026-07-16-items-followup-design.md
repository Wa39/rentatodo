# Items follow-up (PATCH / DELETE / GET my items) — Design

## Context

`Item` create/list/detail (`POST /items`, `GET /items`, `GET /items/{id}`)
merged to `develop` via PR #16. `CLAUDE_BACKEND.md`'s "Week 1 — Auth + Items"
grouping lists 9 endpoints; 6 are done. The remaining 3 — deferred at the
time, per `apps/api/ROADMAP.md` and `docs/superpowers/specs/2026-07-16-items-design.md`'s
own "Deferred / out of scope" section — are this piece of work:

- `PATCH /items/{item_id}` — edit own item
- `DELETE /items/{item_id}` — soft delete own item
- `GET /users/me/items` — list my own items (active + inactive)

All three are already fully specified in `packages/contracts/openapi.yaml`
(lines 636-749) and in `CLAUDE_BACKEND.md`'s endpoint table — no open
questions, no contract changes needed.

## File structure

No new files. All three endpoints extend the Items slice already built in
PR #16:

```
apps/api/app/
├── schemas/item.py     # + UpdateItemRequest
├── services/items.py   # + update_item, delete_item, list_my_items
└── routers/items.py    # + 3 endpoints

apps/api/tests/
├── schemas/test_item.py    # + UpdateItemRequest cases
├── services/test_items.py  # + update/delete/list_my_items cases
└── routers/test_items.py   # + 3 endpoints' happy/failure paths
```

## Schemas (`app/schemas/item.py`)

`UpdateItemRequest` — every field optional (contract has no `required`
list), `None`/omitted means "leave unchanged":

```python
class UpdateItemRequest(BaseModel):
    name: str | None = Field(None, min_length=1)
    description: str | None = Field(None, min_length=1)
    category: CategoryEnum | None = None
    price_per_day: int | None = Field(None, gt=0)
    photo_url: AnyUrl | None = None
```

No new response schema — all three endpoints return the existing
`ItemResponse` (`GET /users/me/items` returns `list[ItemResponse]`, per the
contract — unpaginated, unlike `GET /items`).

## Service functions (`app/services/items.py`)

- `update_item(db, item_id, owner_id, data: UpdateItemRequest) -> Item`
  Looks up the item by id (no `is_active` filter — owners can edit an
  inactive item too, e.g. before reactivating; there's just no
  reactivate-toggle in this contract version). Raises `AppError(404,
  "NOT_FOUND", ...)` if missing, `AppError(403, "FORBIDDEN", ...)` if
  `item.owner_id != owner_id`. Applies only the fields the client actually
  sent (`data.model_dump(exclude_unset=True)`), commits, refreshes.

- `delete_item(db, item_id, owner_id) -> Item`
  Same lookup/ownership check as `update_item`. Sets `is_active = False`,
  commits, refreshes. Idempotent — deleting an already-inactive item just
  re-sets the same value, no error.

- `list_my_items(db, owner_id) -> list[Item]`
  `select(Item).options(joinedload(Item.owner)).where(Item.owner_id ==
  owner_id)` — no `is_active` filter (contract: "including inactive
  ones"), no pagination (contract returns a bare array here, unlike `GET
  /items`).

## Endpoints (`app/routers/items.py`)

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| `PATCH` | `/items/{item_id}` | `get_current_user` | 200 / 403 / 404 / 422 | `UpdateItemRequest` body |
| `DELETE` | `/items/{item_id}` | `get_current_user` | 200 / 403 / 404 | No body; returns the deactivated item, not 204 |
| `GET` | `/users/me/items` | `get_current_user` | 200 | Returns `list[ItemResponse]` directly, no envelope |

## Error handling

Reuses existing infrastructure — no new error-handling code:

- No token → `401 UNAUTHORIZED` (`get_current_user`, already built).
- Item doesn't exist → `AppError(404, "NOT_FOUND", ...)`.
- Item exists, caller isn't the owner → `AppError(403, "FORBIDDEN", ...)`.
  Checked *after* the existence check, so a non-owner gets a real 404 for a
  nonexistent item rather than a 403 — matches the contract's distinct 403
  vs. 404 responses on both endpoints.
- `PATCH` with invalid data (price ≤ 0, bad category, non-URI photo) →
  `422 VALIDATION_ERROR` via the existing `RequestValidationError` handler.

## Testing plan

Adds to the existing test files, no new ones:

- `tests/schemas/test_item.py`: `UpdateItemRequest` accepts a partial
  payload (one field only); rejects an invalid value for a field that is
  present (e.g. `price_per_day: 0`).
- `tests/services/test_items.py`: `update_item` happy path (only sent
  fields change, others untouched) and 403/404 failure paths;
  `delete_item` happy path (sets `is_active=False`) and idempotency
  (calling twice doesn't error) and 403/404; `list_my_items` returns both
  active and inactive items for the owner, excludes other owners' items.
- `tests/routers/test_items.py`: one happy-path + one failure-path per
  endpoint (403 for edit/delete by a non-owner, 404 for a nonexistent
  item, 401 with no token for `GET /users/me/items`).

## Deferred / out of scope

Nothing new deferred here — this closes out the 3 endpoints
`2026-07-16-items-design.md` already deferred. `apps/api/CLAUDE.md`'s Week 1
per `CLAUDE_BACKEND.md` is complete after this ships.
