# apps/api — Roadmap

> This file is the single source of truth for where the backend stands.
> Update it at the end of every work session — see "Session ritual" in
> CLAUDE.md. Claude Code should read this file first thing in any new
> session before touching code.

## Current status

**Week:** 1 — Contracts and scaffolding
**Last updated:** 2026-07-14
**Current focus:** Scaffold and first OpenAPI draft are both up for team
review (see PRs below). Item categories are now decided. Paused: waiting
on the merged contract before starting real models and auth.

## Done

- [x] Docker Compose with Postgres 16 service
- [x] Folder structure (models/, schemas/, routers/, services/)
- [x] Database connection (SQLAlchemy engine + session)
- [x] Alembic initialized and configured
- [x] `Ping` test model + migration
- [x] `GET /health` endpoint
- [x] First pytest test

## In progress

- [ ] PR #3 (`feature/api-scaffolding` → `develop`) — scaffold, awaiting review
- [ ] PR #2 (`feature/openapi-spec` → `develop`) — OpenAPI contract, team review feedback applied (error schema, `expires_in`, duplicate-reservation 409, English translation fix), awaiting merge

## Next up (not started)

- [ ] Real models: User, Item, Reservation, Transaction, CheckEvidence, Report
- [ ] Auth: register, login, JWT middleware
- [ ] Items CRUD (create, list with filters, detail, edit, soft delete)
- [ ] Reservation engine: request, approve, reject, cancel + double-booking prevention
- [ ] Check-in / check-out with photo evidence
- [ ] Deposit lifecycle: HOLD / RELEASE / FREEZE transactions
- [ ] Report problem endpoint
- [ ] Full test suite covering the state machine transitions

## Decisions log

> Record any decision that affects how the API is built, so future
> sessions don't re-litigate it or accidentally contradict it.

| Date | Decision | Why |
|------|----------|-----|
| 2026-07-08 | Money stored as integer cents, never floats | Avoids rounding errors |
| 2026-07-08 | `transactions` and `reservations` history is append-only (no UPDATE/DELETE) | Audit trail requirement |
| 2026-07-08 | Soft delete on items (`is_active` flag) | Preserves reservation history when an item is removed |
| 2026-07-09 | `DATABASE_URL` is read from `.env` via `pydantic-settings` (`app/database.py`); `alembic.ini`'s static `sqlalchemy.url` is left blank and overridden at runtime in `alembic/env.py` | Avoids duplicating DB credentials in two config files |
| 2026-07-09 | `GET /health` checks connectivity with a raw `SELECT 1`, not a query against the `ping` table | Health check shouldn't depend on any specific table existing |
| 2026-07-14 | Stack confirmed with the team: FastAPI + PostgreSQL + SQLAlchemy | Closes the day-3 stack question |
| 2026-07-14 | `owner_id` stays derived via `item_id` — not denormalized onto `reservations` | Matches existing table design; no need for a redundant column |
| 2026-07-14 | Error responses are `{ error: { code, message } }`, not a plain string | Lets clients (web, mobile) branch on `error.code` instead of parsing free text |
| 2026-07-14 | `POST /items/{item_id}/reservations` returns `409 DUPLICATE_RESERVATION` for an exact repeat request (same renter+item+dates, still "requested"), distinct from `409 DATES_UNAVAILABLE` | Avoids silently creating duplicate rows on renter double-submit; distinguishable via `error.code` |
| 2026-07-14 | Item categories: closed enum (`tools, photography, camping, sports, electronics, home`, as already drafted in `CategoryEnum`), no dynamic/admin-managed category table | Team agreed a closed list is enough for this project; adding a category later is a small contract PR, not a new feature. Avoids building an admin/category-management subsystem that isn't otherwise planned |

## Open questions / blockers

> Things I don't have an answer for yet — Claude Code should flag if
> it needs one of these resolved before proceeding, rather than guessing.

_None open right now._

## Session log

> One line per session: date, what got done, what's next. Keep it short —
> this is a changelog, not a diary.

- **2026-07-08** — Repo cloned, CLAUDE.md and ROADMAP.md created. Next: run Prompt 0 (scaffolding).
- **2026-07-09** — Scaffolded FastAPI + Postgres + SQLAlchemy + Alembic: docker-compose `db` service, `app/` folder structure, `database.py`, Alembic init wired to `Base.metadata`, `Ping` test model + migration (applied and verified against real Postgres), `GET /health` endpoint, pytest coverage (happy path + DB-unreachable case) — all passing. Paused: team needs to align on the business/product side before starting real models. Next: real models (User, Item, Reservation, Transaction, CheckEvidence, Report).
- **2026-07-14** — Confirmed stack and `owner_id` design with the team. Opened `feature/api-scaffolding` (PR #3) to get last session's scaffold reviewed, and `feature/openapi-spec` (PR #2) with the first OpenAPI contract draft for team review. Installed and authenticated the GitHub CLI (`gh`) on this machine. Next: wait on PR reviews and item-categories decision before starting real models.
- **2026-07-14** — Applied 4 team review changes to `packages/contracts/openapi.yaml` on PR #2: structured `Error` schema (`code` + `message`), added required `LoginResponse.expires_in`, documented `409 DUPLICATE_RESERVATION` on the create-reservation endpoint, translated `unavailable_dates` status list to English. Committed, pushed, and posted a summary comment on PR #2 for reviewers. Team also agreed on item categories: closed enum, matching the placeholder already in `CategoryEnum` — no contract change needed, no dynamic category table. Next: wait on PR #2/#3 reviews before starting real models.
