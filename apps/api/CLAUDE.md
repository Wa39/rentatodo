# apps/api — Backend API (Trucy)

This file complements the root CLAUDE.md. Gitflow, commit conventions,
security rules, and agent restrictions are already defined there and
apply here too — not repeated below.

## Session ritual — READ THIS FIRST

At the start of every session:
1. Read `ROADMAP.md` in this folder before touching any code.
2. Tell me in plain language what it says the current status is, and
   what you understand the next task to be, before we start working.

At the end of every session (when I say "wrap up" or "cerremos"):
1. Update `ROADMAP.md`: move finished items from "In progress" to
   "Done", add anything new to "Next up", log any decision we made,
   and add one line to "Session log" with today's date.
2. Do NOT commit the roadmap update yourself — show me the diff and
   let me review it.

## Stack for this folder

FastAPI + PostgreSQL + SQLAlchemy + Alembic + Pydantic + pytest,
running via Docker Compose.

## Non-negotiable business rules

- `transactions` and `reservations` history is append-only: never
  UPDATE or DELETE a transaction row, only INSERT. The current
  deposit state is always the LATEST transaction row for that
  reservation.
- All money is stored as integer cents, never floats or decimals.
- Items are never hard-deleted: use soft delete via `is_active = false`.
- Every endpoint that changes a reservation's status must check who
  is calling it (owner vs renter) by reading the JWT — never trust
  the request body for identity.
- The contract lives in `packages/contracts/openapi.yaml`. Implement
  endpoints to match that file — don't invent request/response shapes.

## Documentation standards

All code, comments, and docstrings are written in English — this is
a shared repo other teammates and future maintainers will read.
I'll keep talking to you in Spanish in our conversation; that's just
how we work together, it doesn't change what goes in the code.

- Every function and class gets a docstring: what it does, its
  parameters, what it returns, and any exception it can raise.
  Use Google-style or NumPy-style docstrings consistently — pick one
  and stick with it across the whole codebase.
- Inline comments explain *why*, not *what* — don't narrate obvious
  code line by line. Reserve comments for business-rule context
  (e.g. "// HOLD is created here per the deposit lifecycle, see
  ROADMAP.md decisions log") or non-obvious tradeoffs.
- Every Pydantic schema field that isn't self-explanatory gets a
  `Field(..., description="...")`.
- Every router file gets a short module-level docstring describing
  what resource it exposes.
- Type hints everywhere — function signatures should never rely on
  implicit typing.

## Working style in this folder

- Explain each file to me before creating or editing it.
- Explain new code line by line, especially anything we haven't
  used yet in this project.
- Break large tasks into steps and confirm with me before moving to
  the next one.
- Don't implement anything beyond what's asked in the current
  prompt, even if it's obviously coming up next in the roadmap.
- If something in ROADMAP.md's "Open questions" blocks the current
  task, stop and ask me instead of guessing.

## Testing

Every new piece of business logic needs at least one happy-path test
and one test for the most likely failure (permission denied, invalid
data, etc). pytest, under `tests/`, mirroring the structure of `app/`.
