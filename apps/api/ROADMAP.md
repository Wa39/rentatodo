# apps/api — Roadmap

> This file is the single source of truth for where the backend stands.
> Update it at the end of every work session — see "Session ritual" in
> CLAUDE.md. Claude Code should read this file first thing in any new
> session before touching code.

## Current status

**Week:** 1 — Contracts and scaffolding
**Last updated:** 2026-07-08
**Current focus:** Scaffolding the FastAPI + PostgreSQL + Alembic skeleton

## Done

- [ ] Nothing yet — this is day 0

## In progress

- [ ] Docker Compose with Postgres 16 service
- [ ] Folder structure (models/, schemas/, routers/, services/)
- [ ] Database connection (SQLAlchemy engine + session)
- [ ] Alembic initialized and configured
- [ ] `Ping` test model + migration
- [ ] `GET /health` endpoint
- [ ] First pytest test

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
