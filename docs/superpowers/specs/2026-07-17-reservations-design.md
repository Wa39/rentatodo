# Reservations (Week 2) — Design

## Context

`apps/api`'s Week 1 (Auth + Items, 9 endpoints) is code-complete and in
PR #24, awaiting approval — not a blocker for this work. Per
`CLAUDE_BACKEND.md`'s "Week 2 — Reservations" grouping and
`ROADMAP.md`'s 2026-07-17 decision to scope by `CLAUDE_BACKEND.md`'s own
weekly groupings (same precedent as Items/Items-followup) rather than the
full 12-endpoint reservation "vertical slice", this piece of work is:

- `POST /items/{item_id}/reservations` — request a reservation
- `GET /users/me/reservations` — my reservations as renter
- `GET /users/me/requests` — requests received as owner
- `PATCH /reservations/{id}/approve` — owner approves
- `PATCH /reservations/{id}/reject` — owner rejects
- `PATCH /reservations/{id}/cancel` — renter cancels

Plus wiring `GET /items` (`available_from`/`available_to`) and
`GET /items/{item_id}` (`unavailable_dates`) to real data, since the
`Reservation` table this design introduces is exactly what those two
stubs were waiting on (`ROADMAP.md`, 2026-07-16 decision: "each starts
doing real work once Reservations lands, no schema change needed").
Decided in brainstorming to include this now rather than defer it,
since it's read-only and the underlying data now exists.

Out of scope (Week 3-4, per `CLAUDE_BACKEND.md`): check-in/check-out,
close, report, `GET /reservations/{id}/transactions`, earnings. The
`Transaction` model is created now regardless, because `approve` and
`cancel` already need to insert `hold`/`release` rows — only those two
transaction types are ever produced in this scope; `freeze` doesn't
appear until reports.

All 6 endpoints are already specified in `packages/contracts/openapi.yaml`
(lines 755-1046) and match `CLAUDE_BACKEND.md`'s endpoint table — no
contract changes needed. One known contract gap, already tracked in
`ROADMAP.md` and blocked on Wa's contract PR, not this work: response
schemas (including `ReservationResponse`) have no `required` list yet.

## File structure

```
apps/api/app/
├── models/
│   ├── reservation.py     # new
│   └── transaction.py     # new
├── schemas/
│   └── reservation.py     # new
├── services/
│   ├── reservations.py    # new
│   └── items.py           # + unavailable_dates / availability filter
└── routers/
    └── reservations.py    # new

apps/api/alembic/versions/
└── <rev>_create_reservations_and_transactions_tables.py   # new

apps/api/tests/
├── models/ (or wherever existing model tests live)
├── schemas/test_reservation.py    # new
├── services/test_reservations.py  # new
├── services/test_items.py         # + availability cases
└── routers/test_reservations.py   # new
```

## Data model

### `Reservation` (`app/models/reservation.py`)

Same conventions as `Item`: Postgres-generated UUID PK, plain `String`
status column (no native Postgres enum — same reasoning as
`Item.category`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | `server_default=text("gen_random_uuid()")` |
| `item_id` | UUID, FK → `items.id` | not null |
| `renter_id` | UUID, FK → `users.id` | not null |
| `start_date` | Date | not null |
| `end_date` | Date | not null, `CHECK (end_date >= start_date)` |
| `status` | String | not null, default `"requested"` |
| `deposit_amount` | Integer | not null, centavos, computed at creation |
| `created_at` | DateTime(tz) | `server_default=func.now()` |
| `updated_at` | DateTime(tz) | updated on every status transition |

`owner_id` is **not** denormalized onto `Reservation` — derived via
`reservation.item.owner_id`, per `ROADMAP.md`'s 2026-07-14 decision
("owner_id stays derived via item_id — not denormalized onto
reservations... matches existing table design").

Relationships: `item: Mapped[Item] = relationship()`,
`renter: Mapped[User] = relationship()`.

Indexes (from `CLAUDE_BACKEND.md`, applied via raw SQL in the migration
since they're partial/functional):
- `idx_reservations_item` on `(item_id, start_date, end_date)` WHERE
  `status NOT IN ('rejected','cancelled','closed')`
- `idx_reservations_renter` on `(renter_id)`

### `Transaction` (`app/models/transaction.py`)

Append-only — no `updated_at`, and nothing in this codebase ever calls
`.update()`/`.delete()` on it (enforced by convention + code review, not
a DB trigger, consistent with how `CLAUDE_BACKEND.md` frames it as a
"SACRED RULE" rather than a hard DB-level guarantee elsewhere in this
codebase).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | `server_default=text("gen_random_uuid()")` |
| `reservation_id` | UUID, FK → `reservations.id` | not null |
| `type` | String | not null, `CHECK (type IN ('hold','release','freeze'))` |
| `amount` | Integer | not null, centavos |
| `created_at` | DateTime(tz) | `server_default=func.now()` |

## Double-booking prevention (two layers, both required)

**Application layer:** inside a DB transaction, `SELECT ... FOR UPDATE`
on the target `Item` row, then check for an existing `Reservation` on
the same `item_id` with `status IN ('requested','approved','delivered',
'returned')` whose range overlaps
`existing.start_date <= new.end_date AND existing.end_date >=
new.start_date`. Overlap → `409 DATES_UNAVAILABLE`. The `INSERT`
happens inside the same transaction, before the lock is released, so no
concurrent request can interleave between the check and the insert.

**Database layer:** an `EXCLUDE` constraint, added via raw SQL in the
migration (same pattern already used for `immutable_unaccent` in
`edb3d65c0dce_create_items_table.py`):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    item_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (status NOT IN ('rejected', 'cancelled', 'closed'));
```

If the application-level check has a bug, Postgres rejects the `INSERT`
with an `IntegrityError`, which `create_reservation` catches and
translates to the same `409 DATES_UNAVAILABLE` — the client sees no
difference between the two layers catching it.

**Duplicate exact request:** checked *before* the availability check —
same `renter_id` + `item_id` + `start_date` + `end_date` already
`"requested"` → `409 DUPLICATE_RESERVATION` instead of a generic
overlap conflict.

**Full validation order in `create_reservation`:**
1. `start_date >= today` and `end_date >= start_date` → `422
   VALIDATION_ERROR`. Pure request-shape checks, no DB needed, run
   first.
2. Look up the item (`id == item_id AND is_active == true`) → `404
   NOT_FOUND` if missing or inactive (same "doesn't exist or is
   inactive" treatment as Items). Needed before step 3, since that
   check depends on `item.owner_id`.
3. `renter_id != item.owner_id` → `422 CANNOT_RENT_OWN_ITEM` (see Error
   handling).
4. Duplicate exact request check → `409 DUPLICATE_RESERVATION` (see
   below).
5. Lock + overlap check → `409 DATES_UNAVAILABLE` (see below).
6. Insert.

## Service functions (`app/services/reservations.py`)

Explicit per-action functions (not a generic transition-table FSM —
decided in brainstorming: matches the existing `create_item`/
`update_item`/`delete_item` pattern in `services/items.py`, and keeps
each action's specific business rule directly readable rather than
hidden behind a generic dispatcher).

- `create_reservation(db, item_id, renter_id, data: CreateReservationRequest) -> Reservation`
  Runs all validations above, computes `deposit_amount =
  item.price_per_day * ((end_date - start_date).days + 1)`, inserts
  with `status="requested"`. Day count is inclusive of both endpoints —
  neither the contract nor `CLAUDE_BACKEND.md` spells out the exact
  formula, but `start_date`/`end_date` are documented as "First
  day"/"Last day of rental" (both rental days), and the exclusion
  constraint uses an inclusive `daterange(start_date, end_date, '[]')`
  — so a 1-day rental has `end_date == start_date` and counts as 1 day,
  not 0. Picked here explicitly to remove the ambiguity, not left
  implicit.

- `list_my_reservations(db, renter_id, status=None, page=1, limit=20) -> tuple[list[Reservation], int]`
  Filters `Reservation.renter_id == renter_id`, optional `status`,
  paginated — mirrors `list_items`'s pagination shape.

- `list_my_requests(db, owner_id, status=None, page=1, limit=20) -> tuple[list[Reservation], int]`
  Joins to `Item`, filters `Item.owner_id == owner_id`, same pagination
  shape.

- `approve_reservation(db, reservation_id, owner_id) -> Reservation`
  404 if the reservation doesn't exist. 403 if
  `reservation.item.owner_id != owner_id`. 409 `INVALID_TRANSITION` if
  `status != "requested"`. Otherwise: `status = "approved"`,
  `updated_at = now()`, insert `Transaction(type="hold",
  amount=reservation.deposit_amount)`.

- `reject_reservation(db, reservation_id, owner_id) -> Reservation`
  Same ownership check as `approve`. Only `"requested"` →
  `"rejected"`. No transaction inserted.

- `cancel_reservation(db, reservation_id, renter_id) -> Reservation`
  403 if `reservation.renter_id != renter_id`. Allows `"requested"` or
  `"approved"` → `"cancelled"`. If the prior status was `"approved"`
  (meaning a `hold` transaction exists), insert
  `Transaction(type="release", amount=reservation.deposit_amount)`.

Check order is always existence (404) → ownership (403) → state (409),
matching the precedent in `update_item`/`delete_item`.

### Deriving `deposit_status`

`ReservationResponse.deposit_status` (`none`/`held`/`released`/
`frozen`) is computed live from the latest `Transaction` row per
`CLAUDE_BACKEND.md`'s "SACRED RULE" (query the latest transaction —
never cache/denormalize this onto `Reservation`). For a single
reservation this is one small subquery; for the two list endpoints
(up to 50 rows), it's done as one additional grouped query using
`ROW_NUMBER() OVER (PARTITION BY reservation_id ORDER BY created_at
DESC)` to avoid N+1, then attached in Python before serialization —
same spirit as `joinedload(Item.owner)` avoiding N+1 for `owner_name`.

## Item availability integration (`app/services/items.py`)

Both use the same "blocking" status set as double-booking prevention:
`requested`, `approved`, `delivered`, `returned`.

- **`GET /items/{item_id}` → `unavailable_dates`:** replaces the
  current always-`[]` stub. A query against `Reservation` for
  `item_id` with a blocking status, ordered by `start_date`, returned
  as a list of `{start_date, end_date}` ranges. No merging of adjacent
  ranges — the contract doesn't ask for it.

- **`GET /items` → `available_from` / `available_to`:** replaces the
  current no-op filters. Excludes any item with a blocking reservation
  overlapping `[available_from, available_to]`, via a correlated
  `NOT EXISTS` subquery composed into the existing `select(Item)` query
  alongside the `q`/`category`/price filters already there. A single
  bound (`available_from` or `available_to` alone) acts as an open
  range on the other end — already validated by the router today, this
  just makes the parameter do something.

This is the one cross-domain dependency: `services/items.py` imports
`Reservation` from `app.models.reservation`. One-directional
(Items → Reservations); no import cycle.

## Endpoints (`app/routers/reservations.py`)

| Method | Path | Auth | Status codes | Notes |
|---|---|---|---|---|
| `POST` | `/items/{item_id}/reservations` | renter (any authenticated user) | 201 / 401 / 404 / 409 / 422 | Body: `CreateReservationRequest` |
| `GET` | `/users/me/reservations` | token | 200 / 401 | Query: `status`, `page`, `limit` |
| `GET` | `/users/me/requests` | token | 200 / 401 | Query: `status`, `page`, `limit` |
| `PATCH` | `/reservations/{id}/approve` | owner | 200 / 401 / 403 / 404 / 409 | No body |
| `PATCH` | `/reservations/{id}/reject` | owner | 200 / 401 / 403 / 404 / 409 | No body |
| `PATCH` | `/reservations/{id}/cancel` | renter | 200 / 401 / 403 / 409 | No body |

Thin routers, same shape as `routers/items.py`: parse/inject
dependencies, call the service, wrap the result in
`ReservationResponse`/`ReservationListResponse`.

## Error handling

| HTTP | Code | Where |
|---|---|---|
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` | `get_current_user`, reused as-is |
| 403 | `FORBIDDEN` | `approve`/`reject` when caller isn't `item.owner_id`; `cancel` when caller isn't `renter_id` |
| 404 | `NOT_FOUND` | Reservation doesn't exist (`approve`/`reject`/`cancel`); item doesn't exist or is inactive (`create_reservation`) |
| 409 | `DATES_UNAVAILABLE` | Overlap detected at the application layer or via the `EXCLUDE` constraint's `IntegrityError` |
| 409 | `DUPLICATE_RESERVATION` | Same renter+item+dates already `"requested"` |
| 409 | `INVALID_TRANSITION` | `approve`/`reject` outside `"requested"`; `cancel` outside `"requested"`/`"approved"` |
| 422 | `VALIDATION_ERROR` | Invalid dates (`end < start`, `start < today`) |
| 422 | `CANNOT_RENT_OWN_ITEM` | Renter is the item's owner. Contract maps this case to `422` (`openapi.yaml` line 818), not the `403` `CLAUDE_BACKEND.md` documents — following `ROADMAP.md`'s 2026-07-17 decision to use the specific code at the contract's current status, so a later status-code bump needs no client changes (mobile branches on `error.code`, confirmed by Zero) |

## Testing plan

Same TDD structure as Items: `tests/schemas`, `tests/services`,
`tests/routers`, one happy path + one failure case minimum per
function, plus every row of the error table above.

- **Double-booking, two layers:** a service-level test for the
  application check (second sequential request on overlapping dates →
  `409 DATES_UNAVAILABLE`), and a separate test that does a direct
  SQLAlchemy `INSERT` bypassing `create_reservation` to confirm the
  `EXCLUDE` constraint itself rejects an overlap (`IntegrityError`).
  No real-concurrency/threaded test — decided in brainstorming.
  Additionally, a manual live check (two near-simultaneous requests
  against a running `uvicorn` instance) documented in the roadmap as
  verification evidence, same as the MiniStack S3 check — not an
  automated test.
- **`conftest.py`:** new `make_reservation` fixture (mirrors
  `make_item`/`make_user`), with overrides for `status`/dates so tests
  can construct overlaps and specific state-machine positions directly.
- **`deposit_status` derivation:** a test that inserts a `hold` then a
  `release` transaction and asserts the response reflects `"released"`,
  not `"held"` — direct proof of the "read the latest transaction"
  rule.
- **Availability integration:** new cases in
  `tests/services/test_items.py` for `unavailable_dates` and the
  `available_from`/`available_to` filter, additive to the existing
  search/pagination tests, not modifying them.

## Deferred / out of scope

- `POST /reservations/{id}/checkin`, `POST /reservations/{id}/checkout`,
  `PATCH /reservations/{id}/close`, `POST /reservations/{id}/report`,
  `GET /reservations/{id}/transactions`, `GET /users/me/earnings` —
  `CLAUDE_BACKEND.md`'s Weeks 3-4.
- `CheckEvidence` and `Report` models — not needed until the above.
- Merging adjacent ranges in `unavailable_dates` — not required by the
  contract.
- A real-concurrency/threaded test for the DB lock — deliberately
  deferred to manual live verification (see Testing plan).
