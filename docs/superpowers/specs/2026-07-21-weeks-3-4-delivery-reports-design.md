# Weeks 3-4 — Delivery + Reports — Design

**Date:** 2026-07-21
**Status:** Approved, ready for implementation plan

## Context

`CLAUDE_BACKEND.md`'s Weeks 3-4 grouping is the last of the backend's 22
endpoints: check-in, check-out, close, report, transactions history, and
earnings. `packages/contracts/openapi.yaml` has defined all 6 paths and
their schemas since the contract's first draft (`CheckInOutRequest`,
`CreateReportRequest`, `ReportResponse`, `TransactionResponse`,
`EarningsResponse`) — nothing here is new contract work, only
implementation.

Two models don't exist yet: `CheckEvidence` and `Report`. `Reservation`
and `Transaction` (`app/models/reservation.py`) are done — notably,
`Transaction`'s `CHECK (type IN ('hold','release','freeze'))` and
`Reservation.deposit_status`'s `freeze → "frozen"` mapping already exist
from Week 2, built in anticipation of this piece. No migration is needed
for `Transaction` itself, only for the two new tables.

`app/services/reservations.py`'s `_get_reservation_or_404` carries a
comment from Week 2: row locking was deferred "if/when the ledger
becomes load-bearing (Weeks 3-4)." `close` and `report` are exactly that
moment — both insert real transactions and `close`'s freeze check reads
transaction state — so this piece closes that gap.

## Scope

All 6 endpoints and both models in one spec/plan, executed subagent-driven
— same precedent as Week 2 (Reservations), which CLAUDE_BACKEND.md also
groups as one unit.

## Decisions

These are being made now, not derivable from the contract alone:

1. **Freeze transactions carry `deposit_amount`, not `0`.** Matches
   `hold`/`release` — keeps the transactions audit trail self-describing
   (anyone reading `GET /reservations/{id}/transactions` sees the real
   amount at stake in every row, not just in `hold`/`release`).
2. **Row lock added now.** `.with_for_update()` is added to
   `_get_reservation_or_404`'s `SELECT`, used by every mutating
   endpoint (existing: approve/reject/cancel; new: checkin/checkout/
   close). Closes the gap `services/reservations.py` already flagged for
   this exact piece of work.
3. **`report`'s uniqueness is two layers**, matching the
   `no_double_booking` precedent: an app-level check (`Report` already
   exists for this `reservation_id` → `409 REPORT_EXISTS`) plus a
   `UNIQUE` constraint on `reports.reservation_id` as a database-level
   safety net, caught as an `IntegrityError` on insert.
4. **`close`'s freeze check reads `Reservation.deposit_status ==
   "frozen"`**, not a separate query against `reports`. Since nothing
   ever un-freezes (no transaction type reverses `freeze`), the derived
   property is equivalent to "does an open report exist" and reuses
   existing logic instead of adding a new query path.
5. **`earnings` is computed in Python, not raw SQL.** Fetch the owner's
   `closed` reservations (with `transactions` preloaded) and filter by
   the existing `deposit_status == "released"` property, then aggregate
   by item in Python. Matches this codebase's preference for ORM +
   Python over raw SQL except where an index specifically requires it
   (the one prior exception being `GET /items`'s full-text search).
6. **No new indexes.** `CLAUDE_BACKEND.md`'s indexes list doesn't include
   one for `check_evidence` or `reports`, and neither table is ever
   queried by `reservation_id` in this scope except `report`'s
   exists-check, which piggybacks on the `UNIQUE` constraint's own
   index. `CheckEvidence` is insert-only here — no endpoint reads it
   back independently of its parent `Reservation`.

## Design

### Models

**`app/models/check_evidence.py`** — `CheckEvidence`:
- `id` (UUID, `gen_random_uuid()`, PK)
- `reservation_id` (UUID, FK → `reservations.id`, not null)
- `type` (`String(20)`, not null, `CHECK (type IN ('check_in', 'check_out'))`)
- `photo_url` (String, not null)
- `notes` (String, nullable)
- `created_at` (DateTime tz, `server_default=func.now()`)
- `reservation` relationship (no back-reference needed — nothing lists a
  reservation's check evidence back through the ORM in this scope)

No `UNIQUE` constraint: the reservation state machine already prevents a
second check-in/out (status has already moved past `approved`/`delivered`
by the time a repeat call would arrive), the same way nothing enforces
"only one approve" at the DB level either.

**`app/models/report.py`** — `Report`:
- `id` (UUID, `gen_random_uuid()`, PK)
- `reservation_id` (UUID, FK → `reservations.id`, not null, **`unique=True`**)
- `reported_by` (UUID, FK → `users.id`, not null)
- `reason` (String, not null)
- `photo_url` (String, not null)
- `created_at` (DateTime tz, `server_default=func.now()`)

One new Alembic migration creates both tables.

### Schemas

- **`app/schemas/check_evidence.py`** — `CheckInOutRequest(photo_url: str, notes: str | None)`. Same convention as `PresignResponse`: `photo_url` is a plain validated-on-input field; look at `CreateItemRequest.photo_url: AnyUrl` for the input-validation pattern (contract says `format: uri`).
- **`app/schemas/report.py`** — `CreateReportRequest(reason: str, photo_url: str)`, `ReportResponse(id, reservation_id, reported_by, reason, photo_url, created_at)` (`from_attributes=True`, mirrors `ReservationResponse`'s style).
- **`app/schemas/transaction.py`** — `TransactionResponse(id, reservation_id, type: TransactionTypeEnum, amount, created_at)`. `TransactionTypeEnum(str, Enum)`: `HOLD`, `RELEASE`, `FREEZE`.
- **`app/schemas/earnings.py`** — `EarningsResponse(total_earnings: int, by_item: list[EarningsByItem])`, `EarningsByItem(item_id, item_name, total: int, rentals: list[EarningsRental])`, `EarningsRental(start_date, end_date, amount: int)`. All plain `BaseModel`s (not ORM-backed — built from aggregated Python data, not `model_validate`'d off a single model instance).

### Services

**`app/services/reservations.py`** (extended):
- `_get_reservation_or_404` gains `.with_for_update()` on its `SELECT` (Decision 2).
- `checkin_reservation(db, reservation_id, renter_id, data: CheckInOutRequest) -> Reservation`: 404 → 403 (`FORBIDDEN`, not the renter) → 409 `INVALID_TRANSITION` (not `approved`) → status → `delivered`, `INSERT CheckEvidence(type="check_in", photo_url=data.photo_url, notes=data.notes)`.
- `checkout_reservation(db, reservation_id, renter_id, data: CheckInOutRequest) -> Reservation`: same shape, `delivered → returned`, `type="check_out"`.
- `close_reservation(db, reservation_id, owner_id) -> Reservation`: 404 → 403 (`FORBIDDEN`, not the owner) → 409 `INVALID_TRANSITION` (not `returned`) → 409 `FREEZE_ACTIVE` if `reservation.deposit_status == "frozen"` (Decision 4) → status → `closed`, `INSERT Transaction(type="release", amount=reservation.deposit_amount)`.
- `_assert_participant(reservation, user_id)`: raises 403 `FORBIDDEN` unless `user_id` is the renter or the item's owner. New helper — first time an endpoint needs "either party" auth instead of "owner only" or "renter only".
- `get_transactions(db, reservation_id, user_id) -> list[Transaction]`: 404 → `_assert_participant` → return `reservation.transactions` (already ordered oldest-first by the model's `relationship`).
- `get_earnings(db, owner_id) -> EarningsResponse`: query the owner's `closed` reservations (via `Item.owner_id`, `selectinload(Reservation.transactions)`), filter to `deposit_status == "released"` in Python, group by `item_id` summing `deposit_amount` into `total`/`total_earnings`, building each item's `rentals` list from the matching reservations' `start_date`/`end_date`/`deposit_amount`.

**`app/services/reports.py`** (new):
- `report_problem(db, reservation_id, reporter_id, data: CreateReportRequest) -> Report`: imports `_get_reservation_or_404` from `app.services.reservations` (one-directional dependency, same shape as `items.py` importing `BLOCKING_STATUSES` from the reservation domain). 404 → `_assert_participant` (403 if neither party) → 409 `INVALID_TRANSITION` if not `delivered`/`returned` → 409 `REPORT_EXISTS` if a `Report` already exists for this `reservation_id` (app-level check) → `INSERT Report` + `INSERT Transaction(type="freeze", amount=reservation.deposit_amount)` in the same commit → catch `IntegrityError` on the `UNIQUE` constraint as the DB-level safety net, re-raising `409 REPORT_EXISTS` (mirrors `create_reservation`'s `IntegrityError` handling for `DATES_UNAVAILABLE`).

### Routers

- **`app/routers/reservations.py`** (extended): `POST /reservations/{reservation_id}/checkin` (201), `POST /reservations/{reservation_id}/checkout` (201), `PATCH /reservations/{reservation_id}/close` (200 default), `GET /reservations/{reservation_id}/transactions` (200, returns `list[TransactionResponse]`), `GET /users/me/earnings` (200, returns `EarningsResponse`). All follow the existing `Depends(get_current_user)` + thin-router-calls-service pattern.
- **`app/routers/reports.py`** (new): `POST /reservations/{reservation_id}/report` (201). Wired into `app/main.py` alongside the existing routers.

### Error handling

| Endpoint | 401 | 403 | 409 |
|---|---|---|---|
| checkin | missing/invalid token | not the renter | not `approved` (`INVALID_TRANSITION`) |
| checkout | missing/invalid token | not the renter | not `delivered` (`INVALID_TRANSITION`) |
| close | missing/invalid token | not the owner | not `returned` (`INVALID_TRANSITION`) or open freeze (`FREEZE_ACTIVE`) |
| report | missing/invalid token | neither owner nor renter | not `delivered`/`returned` (`INVALID_TRANSITION`) or already reported (`REPORT_EXISTS`) |
| transactions | missing/invalid token | neither owner nor renter | — |
| earnings | missing/invalid token | — | — |

All error codes above already exist in `CLAUDE_BACKEND.md`'s error table
and the contract — no new codes needed.

### Testing

Mirrors `app/`'s structure, one happy path + one likely failure per new
piece of business logic:
- `tests/models/test_check_evidence.py`, `tests/models/test_report.py` — the two new `CHECK`/`UNIQUE` constraints.
- `tests/schemas/test_check_evidence.py`, `tests/schemas/test_report.py`, `tests/schemas/test_transaction.py`, `tests/schemas/test_earnings.py`.
- `tests/services/test_reservations.py` (extended): checkin/checkout/close happy paths + wrong-status/wrong-caller failures, the new row lock (a concurrency test analogous to Week 2's double-booking live-verification, or at minimum a unit test confirming `.with_for_update()` is present in the query), `get_transactions`/`get_earnings` happy paths + the `_assert_participant` failure.
- `tests/services/test_reports.py` (new): happy path, `REPORT_EXISTS` (both the app-level check and, in a separate test, the `IntegrityError` safety net via a direct insert bypassing the service), wrong-status, wrong-caller.
- `tests/routers/test_reservations.py` (extended), `tests/routers/test_reports.py` (new): one router-level happy path per new endpoint plus the auth-failure case, same convention as every prior router test file.

No test touches real S3 — `photo_url` values are plain strings in every
test, exactly like `Item.photo_url` and `CreateReservationRequest`'s
existing test fixtures. `generate_presign` is not invoked anywhere in
this piece.
