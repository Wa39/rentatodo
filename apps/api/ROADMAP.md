# apps/api — Roadmap

> This file is the single source of truth for where the backend stands.
> Update it at the end of every work session — see "Session ritual" in
> CLAUDE.md. Claude Code should read this file first thing in any new
> session before touching code.

## Current status

**Week:** 1 — Contracts and scaffolding
**Last updated:** 2026-07-15
**Current focus:** `User` model + Auth (register, login, JWT) are designed
and planned (branch `feature/auth-user-model`), implementation not started
yet. No open blockers.

## Done

- [x] Docker Compose with Postgres 16 service
- [x] Folder structure (models/, schemas/, routers/, services/)
- [x] Database connection (SQLAlchemy engine + session)
- [x] Alembic initialized and configured
- [x] `Ping` test model + migration
- [x] `GET /health` endpoint
- [x] First pytest test
- [x] PR #3 (`feature/api-scaffolding` → `develop`) — scaffold, merged 2026-07-15
- [x] PR #2 (`feature/openapi-spec` → `develop`) — OpenAPI contract v1 with team review feedback (structured error schema, `expires_in`, duplicate-reservation 409, English translation fix), merged 2026-07-15
- [x] Item categories decided: closed enum, matches placeholder `CategoryEnum`

## In progress

- [ ] `User` model + Auth (`register`, `login`, `GET /users/me`) — spec (`docs/superpowers/specs/2026-07-15-user-auth-design.md`) and implementation plan (`docs/superpowers/plans/2026-07-15-user-auth.md`) both written and committed on `feature/auth-user-model`. Implementation (9 planned tasks) not started.

## Next up (not started)

- [ ] Remaining real models: Item, Reservation, Transaction, CheckEvidence, Report
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
| 2026-07-15 | `CLAUDE_BACKEND.md` (external doc, not committed to this repo — Jose has the source) is the authoritative reference for the 6 database tables, the full error-code table, and the intended `apps/api` file layout. Where it conflicted with earlier ad-hoc session decisions, it wins | Reflects conventions the whole team agreed on, not just this session's guesses |
| 2026-07-15 | Following `CLAUDE_BACKEND.md`: `User.id` is Postgres-generated (`gen_random_uuid()`, native on PG16), password field is named `password_hash`, hashing uses bare `bcrypt` (not `passlib`), `Settings` moves to a new `app/config.py` (out of `database.py`), `app/dependencies/` is a package | Matches the team's documented conventions exactly, avoids future contract drift with what teammates expect |
| 2026-07-15 | Kept `tests/routers/test_auth.py` (mirroring `app/`), not `CLAUDE_BACKEND.md`'s flat `tests/test_auth.py` | Follows the convention already established by the existing `tests/routers/test_health.py` and this file's own testing section — the external doc's tree wasn't taken as literal on this one point |
| 2026-07-15 | `app/exceptions.py` (holds `AppError`) added even though it's not in `CLAUDE_BACKEND.md`'s file tree | Needed cross-cutting infrastructure to produce the doc's mandated `{error: {code, message}}` shape from FastAPI; not Auth-specific, every future router will reuse it |

## Open questions / blockers

> Things I don't have an answer for yet — Claude Code should flag if
> it needs one of these resolved before proceeding, rather than guessing.

- [ ] **Not blocking current work.** `CLAUDE_BACKEND.md` documents "renting your own item" as `403 CANNOT_RENT_OWN_ITEM`, but the merged `openapi.yaml` documents that same case as a generic `422` on `POST /items/{item_id}/reservations`. Needs a decision (and possibly a small contract PR) whenever Reservations work starts.
- [ ] `RegisterRequest.password` gets an implementation-side `max_length=72` (bcrypt's limit) that isn't documented in the merged `openapi.yaml` (which only has `minLength: 8`). Worth a small contract PR to add `maxLength: 72` so the documented contract matches what the API actually accepts.

## Session log

> One line per session: date, what got done, what's next. Keep it short —
> this is a changelog, not a diary.

- **2026-07-08** — Repo cloned, CLAUDE.md and ROADMAP.md created. Next: run Prompt 0 (scaffolding).
- **2026-07-09** — Scaffolded FastAPI + Postgres + SQLAlchemy + Alembic: docker-compose `db` service, `app/` folder structure, `database.py`, Alembic init wired to `Base.metadata`, `Ping` test model + migration (applied and verified against real Postgres), `GET /health` endpoint, pytest coverage (happy path + DB-unreachable case) — all passing. Paused: team needs to align on the business/product side before starting real models. Next: real models (User, Item, Reservation, Transaction, CheckEvidence, Report).
- **2026-07-14** — Confirmed stack and `owner_id` design with the team. Opened `feature/api-scaffolding` (PR #3) to get last session's scaffold reviewed, and `feature/openapi-spec` (PR #2) with the first OpenAPI contract draft for team review. Installed and authenticated the GitHub CLI (`gh`) on this machine. Next: wait on PR reviews and item-categories decision before starting real models.
- **2026-07-14** — Applied 4 team review changes to `packages/contracts/openapi.yaml` on PR #2: structured `Error` schema (`code` + `message`), added required `LoginResponse.expires_in`, documented `409 DUPLICATE_RESERVATION` on the create-reservation endpoint, translated `unavailable_dates` status list to English. Committed, pushed, and posted a summary comment on PR #2 for reviewers. Team also agreed on item categories: closed enum, matching the placeholder already in `CategoryEnum` — no contract change needed, no dynamic category table. Next: wait on PR #2/#3 reviews before starting real models.
- **2026-07-15** — PR #2 and PR #3 both merged to `develop`. No open blockers left. Next: start real models, beginning with `User` and Auth (register, login, JWT middleware) per the Days 1-3 plan.
- **2026-07-15** — Reviewed and approved PR #5 (Silverk's web scaffold design update). Brainstormed the `User` model + Auth design; mid-session Jose supplied `CLAUDE_BACKEND.md`, an external reference doc with the full 6-table schema, error codes, and file layout, which reconciled several ad-hoc decisions (DB-generated UUIDs, bare `bcrypt`, `password_hash` naming, `config.py` split, `dependencies/` package). Wrote and committed the design spec and a 9-task TDD implementation plan on `feature/auth-user-model`. Two discrepancies flagged for later (see Open questions). Next: execute the implementation plan (subagent-driven or inline, not yet decided) — nothing coded yet.
