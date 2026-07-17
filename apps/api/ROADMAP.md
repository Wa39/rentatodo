# apps/api — Roadmap

> This file is the single source of truth for where the backend stands.
> Update it at the end of every work session — see "Session ritual" in
> CLAUDE.md. Claude Code should read this file first thing in any new
> session before touching code.

## Current status

**Week:** 1 (Auth + Items) — all 9 of `CLAUDE_BACKEND.md`'s Week 1
endpoints complete — Week 2 (Reservations, the contract's "vertical
slice") is next.
**Last updated:** 2026-07-17
**Current focus:** All planned Week 1 work is merged to `develop` or in
review. `User` + Auth (PR #8), CORS + validation handler (PR #14), and
`Item` model + all 6 Item endpoints (`POST /items`, `GET /items`
filtered/searchable, `GET /items/{item_id}`, PR #16; `PATCH /items/{id}`,
`DELETE /items/{id}`, `GET /users/me/items`, PR #24) are done. PR #24 is
open, all CI green, 83/83 tests passing, final whole-branch review clean
— awaiting team approval.

PR #16 also picked up 3 fixes from the team's `apps/api` audit before
merging (see Decisions log): removed the dead `Ping` scaffold
model/migration, added `boto3` as a dependency, and added AWS/MiniStack
settings + an S3 client (`app/s3.py`) — verified live against a running
MiniStack container. Two audit items remain **blocked on a contract PR**
that isn't ours to open: `POST /uploads/presign` isn't defined in
`openapi.yaml` yet, and `CANNOT_RENT_OWN_ITEM` (403 vs 422) needs a
contract decision. Wa owns that PR (it also needs to add `required` to
the response schemas and `maxLength: 72` on the password field — both
already flagged below). No blockers to start Reservations design now —
branch off `develop`.

## Done

- [x] Docker Compose with Postgres 16 service
- [x] Folder structure (models/, schemas/, routers/, services/)
- [x] Database connection (SQLAlchemy engine + session)
- [x] Alembic initialized and configured
- [x] `GET /health` endpoint
- [x] First pytest test
- [x] PR #3 (`feature/api-scaffolding` → `develop`) — scaffold, merged 2026-07-15
- [x] PR #2 (`feature/openapi-spec` → `develop`) — OpenAPI contract v1 with team review feedback (structured error schema, `expires_in`, duplicate-reservation 409, English translation fix), merged 2026-07-15
- [x] Item categories decided: closed enum, matches placeholder `CategoryEnum`
- [x] `User` model + Auth (`register`, `login`, `GET /users/me`) — all 9 tasks of `docs/superpowers/plans/2026-07-15-user-auth.md` implemented on `feature/auth-user-model`, TDD throughout, one commit per task. 25/25 tests passing (`app/config.py`, `AppError`, `db_session`/`client`/`make_user` fixtures, `User` model + migration, password hashing + JWT primitives, `get_current_user`, Auth schemas, `register_user`/`authenticate_user`, the 3 live endpoints).
- [x] PR #8 (`feature/auth-user-model` → `develop`) — User model + Auth, merged 2026-07-16.
- [x] PR #13 (`feature/item-category-other` → `develop`) — added `other` to the contract's `CategoryEnum` (Silverk flagged mobile needed a catch-all), merged 2026-07-16.
- [x] `Item` model + `POST /items`, `GET /items` (filters, full-text search, pagination), `GET /items/{item_id}` — all 5 tasks of `docs/superpowers/plans/2026-07-16-items.md` implemented on `feature/item-model` via subagent-driven development, strict TDD, each task independently reviewed (spec + quality) before the next.
- [x] PR #14 (`feature/cors-and-validation-handler` → `develop`) — `CORSMiddleware` (origins via new `CORS_ORIGINS` env var) + a `RequestValidationError` handler translating Pydantic validation failures into the contract's `{error: {code, message}}` shape — built for Zero's mobile-web onboarding, TDD, verified live against a running server. Merged 2026-07-16.
- [x] PR #15 (`feature/mobile-category-other` → `develop`) — mobile `other`-category support + Expo lint/CI fix (opened on Zero's behalf), merged 2026-07-16. This also fixed the `mobile` CI job for everyone (added `declarations.d.ts`, the type declarations CI's clean checkout needs for `*.css`/`*.module.css` imports).
- [x] PR #16 (`feature/item-model` → `develop`) — Items (above) plus 3 fixes from the team's `apps/api` audit, all bundled into the same PR before it merged: resolved a merge conflict in `app/main.py` (duplicate `CORSMiddleware`/validation-handler setup — PR #16's port was identical to #14's, kept develop's version); removed the dead `Ping` scaffold model + migration (`users` is now the migration chain's root); added `boto3` to `requirements.txt`; added AWS/MiniStack settings to `app/config.py` (`resolved_aws_endpoint_url` property, same pattern as `cors_origins_list`) and a new `app/s3.py` client, verified live against a running MiniStack container (created the bucket, round-tripped an object). 65/65 tests passing. Merged 2026-07-17.
- [x] `PATCH /items/{id}`, `DELETE /items/{id}` (soft delete), `GET /users/me/items` — the 3 Items endpoints deferred from Days 4-5, closing out `CLAUDE_BACKEND.md`'s full 9-endpoint Week 1 grouping. Built on `feature/items-followup` via subagent-driven development: 3 TDD tasks (`UpdateItemRequest` schema; `update_item`/`delete_item`/`list_my_items` service functions; router wiring), each independently reviewed (spec + quality, both clean), plus a final whole-branch review (also clean, only cosmetic Minor findings — 2 stale docstrings and one spec-wording fix, applied directly). 83/83 tests passing. PR #24 open.

## In progress

- PR #24 open, all CI green, final whole-branch review clean — awaiting team approval. Not blocking further backend work — Reservations can branch off `develop` directly.

## Next up (not started)

- [ ] Get PR #24 reviewed and merged
- [ ] **Blocked on Wa:** contract PR adding `POST /uploads/presign`, `required` on response schemas, and `maxLength: 72` on `RegisterRequest.password` — needs all 4 team approvals. Unblocks: the presign endpoint implementation below, and the `CANNOT_RENT_OWN_ITEM` decision.
- [ ] `POST /uploads/presign` implementation (`app/s3.py` and MiniStack config already in place) — blocked on the contract PR above defining the endpoint shape
- [ ] Remaining real models: Reservation, Transaction, CheckEvidence, Report
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
| 2026-07-16 | Contract's `CategoryEnum` gets a 7th value, `other` (PR #13) | Silverk flagged mobile needed a catch-all for items that don't fit the 6 fixed categories; team agreed via voice chat |
| 2026-07-16 | `Item.category` is a plain `String` column, not a Postgres native `ENUM` type | `CLAUDE_BACKEND.md` describes it as "String (enum)" and its constraints list has no `CHECK` for `category` — validity is enforced by Pydantic's `CategoryEnum` only. Avoids `ALTER TYPE` friction if more categories get added later |
| 2026-07-16 | `Item.price_per_day` gets a DB-level `CheckConstraint(price_per_day > 0)`, in addition to Pydantic's `gt=0` | Matches `CLAUDE_BACKEND.md`'s "Database constraints" section — DB stays correct even if something writes to it outside the API |
| 2026-07-16 | `GET /items` search (`q`) uses Postgres full-text search (`to_tsvector`/`to_tsquery` + a GIN index), not `ILIKE` | Matches the GIN index `CLAUDE_BACKEND.md` specifies; `ILIKE` can't use that index. Required a custom `immutable_unaccent(text)` SQL wrapper function (found live: raw `unaccent()` is `STABLE`, Postgres rejects `STABLE` functions in a functional index expression) and token sanitization (found in final review: unsanitized tokens containing `&`/`!`/`(`/`)`/`:` broke `to_tsquery`'s own syntax) |
| 2026-07-16 | Items (Days 4-5) scope is exactly `POST /items`, `GET /items`, `GET /items/{id}` | `PATCH`/`DELETE`/`GET /users/me/items` are in the contract and in `CLAUDE_BACKEND.md`'s "Week 1" grouping, but deliberately deferred to a follow-up piece of work — confirmed with Jose |
| 2026-07-16 | `unavailable_dates` (item detail) is always `[]`, `available_from`/`available_to` filters accept but don't exclude anything yet, `sort=popular` sorts identically to `sort=recent` | No `Reservation` table exists yet, so these are simply correct today, not stubs — each starts doing real work once Reservations lands, no schema change needed |
| 2026-07-16 | `photo_url` is a plain string field on `Item`, validated as a URI and stored as-is — no S3 pre-signed upload flow in this piece of work | That flow is separate infra work Jose/Wa are coordinating outside this session |
| 2026-07-16 | `CORS_ORIGINS` is a comma-separated string in `.env`/`app/config.py` (default `http://localhost:8081`, Expo web's dev port), not a JSON list | Simpler for teammates to edit `.env` by hand than JSON-escaping a list |
| 2026-07-16 | `RequestValidationError` responses join every invalid/missing field into one `message` (not just the first) | Client can show the user everything wrong at once instead of round-tripping per field |
| 2026-07-16 | `Ping` model + its migration deleted; `users` is now the migration chain's root | It was scaffold-only (proved the DB/Alembic wiring worked), and every future migration and every environment (including staging/prod) would keep creating it forever the longer it stayed. Flagged by the team's audit — cheaper to remove now than later |
| 2026-07-16 | `app/config.py`'s new `aws_*` settings all default to `""` (or `"us-east-1"` for region), none required | CI doesn't set any `AWS_*` env var; making them required would break `Settings()` at import time for every test and CI run, and nothing consumes them yet (the presign endpoint is still blocked on the contract) |
| 2026-07-16 | S3 client lives in its own `app/s3.py` (module-level singleton, same shape as `app/database.py`'s `engine`), not inside `app/dependencies/` | It's not a FastAPI dependency (nothing injects it into a request yet) — same reasoning as why `engine`/`SessionLocal` live in `database.py` and not `dependencies/` |
| 2026-07-17 | `update_item` applies `UpdateItemRequest` fields via a per-field `is not None` check, not `data.model_dump(exclude_unset=True)` as the design spec originally said | Caught in final review: `exclude_unset=True` would let an explicit `{"name": null}` reach the `NOT NULL` `name` column. The `is not None` approach treats an explicit null the same as "omitted" — matches the schema's own docstring promise |
| 2026-07-17 | `PATCH`/`DELETE /items/{id}` look up the item with no `is_active` filter | Owners can edit or re-delete an inactive item too — there's no reactivate-toggle in this contract version, so this is the only way to touch an already-deactivated item's data at all |

## Open questions / blockers

> Things I don't have an answer for yet — Claude Code should flag if
> it needs one of these resolved before proceeding, rather than guessing.

- [ ] **Blocked on Wa's upcoming contract PR** (see Next up). `CLAUDE_BACKEND.md` documents "renting your own item" as `403 CANNOT_RENT_OWN_ITEM`, but the merged `openapi.yaml` documents that same case as a generic `422` on `POST /items/{item_id}/reservations`. Zero confirmed mobile branches on `error.code`, not status, so mobile needs no changes either way — just needs the contract and API to agree before Reservations ships.
- [ ] **Blocked on Wa's upcoming contract PR** (see Next up). `RegisterRequest.password` gets an implementation-side `max_length=72` (bcrypt's limit) that isn't documented in the merged `openapi.yaml` (which only has `minLength: 8`).
- [ ] **Not blocking current work.** Two `docker-compose.yml` files exist for local Postgres (`apps/api/docker-compose.yml` and `infra/docker-compose.yml`) with different credential sources — `infra/`'s is hardcoded (`rentatodo`/`rentatodo`) and doesn't match `apps/api/.env`'s actual password, so using the wrong one silently fails to connect. `apps/api/docker-compose.yml` is the one that works locally. Worth consolidating to one, whenever there's a slow moment — flagged to Zero already when explaining local setup.

## Session log

> One line per session: date, what got done, what's next. Keep it short —
> this is a changelog, not a diary.

- **2026-07-08** — Repo cloned, CLAUDE.md and ROADMAP.md created. Next: run Prompt 0 (scaffolding).
- **2026-07-09** — Scaffolded FastAPI + Postgres + SQLAlchemy + Alembic: docker-compose `db` service, `app/` folder structure, `database.py`, Alembic init wired to `Base.metadata`, `Ping` test model + migration (applied and verified against real Postgres), `GET /health` endpoint, pytest coverage (happy path + DB-unreachable case) — all passing. Paused: team needs to align on the business/product side before starting real models. Next: real models (User, Item, Reservation, Transaction, CheckEvidence, Report).
- **2026-07-14** — Confirmed stack and `owner_id` design with the team. Opened `feature/api-scaffolding` (PR #3) to get last session's scaffold reviewed, and `feature/openapi-spec` (PR #2) with the first OpenAPI contract draft for team review. Installed and authenticated the GitHub CLI (`gh`) on this machine. Next: wait on PR reviews and item-categories decision before starting real models.
- **2026-07-14** — Applied 4 team review changes to `packages/contracts/openapi.yaml` on PR #2: structured `Error` schema (`code` + `message`), added required `LoginResponse.expires_in`, documented `409 DUPLICATE_RESERVATION` on the create-reservation endpoint, translated `unavailable_dates` status list to English. Committed, pushed, and posted a summary comment on PR #2 for reviewers. Team also agreed on item categories: closed enum, matching the placeholder already in `CategoryEnum` — no contract change needed, no dynamic category table. Next: wait on PR #2/#3 reviews before starting real models.
- **2026-07-15** — PR #2 and PR #3 both merged to `develop`. No open blockers left. Next: start real models, beginning with `User` and Auth (register, login, JWT middleware) per the Days 1-3 plan.
- **2026-07-15** — Reviewed and approved PR #5 (Silverk's web scaffold design update). Brainstormed the `User` model + Auth design; mid-session Jose supplied `CLAUDE_BACKEND.md`, an external reference doc with the full 6-table schema, error codes, and file layout, which reconciled several ad-hoc decisions (DB-generated UUIDs, bare `bcrypt`, `password_hash` naming, `config.py` split, `dependencies/` package). Wrote and committed the design spec and a 9-task TDD implementation plan on `feature/auth-user-model`. Two discrepancies flagged for later (see Open questions). Next: execute the implementation plan (subagent-driven or inline, not yet decided) — nothing coded yet.
- **2026-07-15** — Executed all 9 tasks of the User/Auth implementation plan inline, TDD (failing test → implement → passing test → commit) per task, one commit each. Found and fixed one bug in the plan's own test (`UserResponse` schema test constructed a `User` without persisting it, so the Postgres server-default `id`/`created_at` were `None`; fixed by persisting via `db_session` before validating — matches how the real endpoints call it). Final regression: 25/25 tests passing. Next: push `feature/auth-user-model`, open PR against `develop`.
- **2026-07-15** — Pushed `feature/auth-user-model` and opened PR #8 against `develop`. Reviewed PR #7 (Zero's Expo mobile scaffold): verified `src/data/data-source.ts` and `src/data/types.ts` field-by-field against the merged contract (`ItemResponse`, `ReservationResponse`, enums) — all correct; approved with one non-blocking nit (stale "contract DRAFT" comments left over from before the contract was frozen). Jose is following up with the team tonight to get PR #8 approved/merged. Next: once merged, start Items (Days 4-5) — brainstorm design, write TDD plan, implement, same process as Auth. *(Note: this entry's roadmap update was drafted but never committed at the time — recovered from a stashed diff and added retroactively during the 2026-07-16 session below.)*
- **2026-07-16** — Long session. Confirmed PR #8 had merged since last session. Reviewed and approved PR #11/#12 (docs + CI, targeted `main` intentionally per Wa — release-branch process, not a mistake despite the unusual base). Silverk flagged mobile expected an `other` item category that wasn't in the frozen contract: added it (PR #13, merged), corrected an earlier PR #13 comment claiming mobile didn't reference categories (it does, in `types.ts`/`labels.ts` — Zero was right), opened PR #15 on Zero's behalf for his mobile fix + an Expo-lint CI fix. Found two real API gaps while relaying local-setup info to Zero: no CORS (blocked Expo web) and no `RequestValidationError` handler (wrong error shape on 422s) — built both via TDD, verified live against a running server, PR #14 (open). Brainstormed the `Item` design (reconciled against `CLAUDE_BACKEND.md`: DB-level price CHECK, two indexes, full-text-search approach), wrote the design spec and a 5-task TDD implementation plan, executed via subagent-driven development with per-task spec+quality review — found and fixed two real bugs along the way, both verified live against Postgres: `unaccent()` isn't `IMMUTABLE` (added a wrapper function) and unsanitized search tokens broke `to_tsquery`'s syntax on ordinary punctuation (added token sanitization, moved the guard into the service layer). Final whole-branch review: ready to merge. 57/57 tests passing. Opened PR #16. Also recovered and folded in a roadmap update from the previous session that had been drafted but never committed (see note above). Next: get PR #14/#15/#16 reviewed and merged, then start Reservations (Week 2, the contract's "vertical slice") — same brainstorm → spec → TDD-plan → subagent-driven-implementation process.
- **2026-07-16 (later same day)** — PR #14 and #15 merged since the last update; confirmed all 5 open PRs' CI/mergeability, only #16 and Wa's #20 had real issues (everything else just needed review). Fixed #16: merged `develop` in, resolved a one-line merge conflict in `app/main.py` (duplicate `CORSMiddleware`/validation-handler setup — kept develop's side), pushed — CI went green (the red `mobile` check had been a stale run from before #15's fix landed). Team then sent over an `apps/api` audit with 5 findings; did the 3 that were unblocked: deleted the dead `Ping` model + migration, added `boto3`, added AWS/MiniStack settings + `app/s3.py` client (verified live against MiniStack). Left the other 2 findings (`POST /uploads/presign`, `CANNOT_RENT_OWN_ITEM` 403-vs-422) blocked on a contract PR that's Wa's to open. Pushed to `feature/item-model`. **PR #16 merged while writing this up** (2026-07-17T04:36:35Z) — GitHub auto-deleted the branch; a stray push after the merge recreated it as an orphaned branch, which was then deleted again once noticed. This roadmap update itself lives on a fresh `docs/roadmap-items-merged` branch off `develop` instead. Next: start Reservations design (Week 2) — same brainstorm → spec → TDD-plan → subagent-driven-implementation process used for Items.
- **2026-07-17** — Jose supplied the actual path to `CLAUDE_BACKEND.md` (`C:\Users\Jose\Downloads\documentos\CLAUDE_BACKEND.MD`), read it in full for the first time this session — confirmed it's the same content already reconciled into past decisions, plus new detail for Reservations (exclusion-constraint SQL, full state machine, error-code table). Scoped Reservations to `CLAUDE_BACKEND.md`'s own Week 2 grouping (6 endpoints) rather than the full 12-endpoint vertical slice, matching the Items precedent — but decided to first close out the 3 Items endpoints deferred from Days 4-5, since `CLAUDE_BACKEND.md` counts them as part of Week 1. Brainstormed, wrote the design spec and a 3-task TDD plan (`docs/superpowers/specs/2026-07-16-items-followup-design.md`, `docs/superpowers/plans/2026-07-16-items-followup.md`) on a fresh `feature/items-followup` branch (off `develop`, now including #16/#14/#15). Executed via subagent-driven development — 3 tasks (`UpdateItemRequest` schema; `update_item`/`delete_item`/`list_my_items`; router wiring), each independently reviewed clean, plus a final whole-branch review (clean, only cosmetic Minors — fixed directly). 83/83 tests passing. Pushed, opened PR #24. Also decided: handle `CANNOT_RENT_OWN_ITEM` per the repo's frozen contract (422) once Reservations starts, using the specific error code (not generic `VALIDATION_ERROR`) so a later status-code bump to 403 needs no client changes — Zero confirmed mobile decides by `error.code`, not status. Next: get PR #24 merged, then start Reservations (Week 2) design — same process.
