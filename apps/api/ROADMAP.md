# apps/api — Roadmap

> This file is the single source of truth for where the backend stands.
> Update it at the end of every work session — see "Session ritual" in
> CLAUDE.md. Claude Code should read this file first thing in any new
> session before touching code.

## Current status

**Week:** 1 — Contracts and scaffolding
**Last updated:** 2026-07-09
**Current focus:** Scaffold done and verified end-to-end. Paused: waiting
on the team to align on business/product details before starting real
models and auth.

## Done

- [x] Docker Compose with Postgres 16 service
- [x] Folder structure (models/, schemas/, routers/, services/)
- [x] Database connection (SQLAlchemy engine + session)
- [x] Alembic initialized and configured
- [x] `Ping` test model + migration
- [x] `GET /health` endpoint
- [x] First pytest test

## In progress

- [ ] Nothing right now — scaffold complete, next session starts on real models

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

## Open questions / blockers

> Things I don't have an answer for yet — Claude Code should flag if
> it needs one of these resolved before proceeding, rather than guessing.

- [ ] Final stack confirmation with the team (day 3 deadline)
- [ ] Exact list of valid item categories
- [ ] Whether `owner_id` gets denormalized onto `reservations` or stays derived via `item_id`

## Session log

> One line per session: date, what got done, what's next. Keep it short —
> this is a changelog, not a diary.

- **2026-07-08** — Repo cloned, CLAUDE.md and ROADMAP.md created. Next: run Prompt 0 (scaffolding).
- **2026-07-09** — Scaffolded FastAPI + Postgres + SQLAlchemy + Alembic: docker-compose `db` service, `app/` folder structure, `database.py`, Alembic init wired to `Base.metadata`, `Ping` test model + migration (applied and verified against real Postgres), `GET /health` endpoint, pytest coverage (happy path + DB-unreachable case) — all passing. Paused: team needs to align on the business/product side before starting real models. Next: real models (User, Item, Reservation, Transaction, CheckEvidence, Report).
