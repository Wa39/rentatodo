# RentaTodo — CLAUDE.md

## Project

P2P item rental platform. Owners list items; renters discover and book them.
Four-person, four-week project.

## Repo structure

```
rentatodo/
├── apps/api/           # Backend API (Trucy)
├── apps/web/           # Owner dashboard — web (Silverk)
├── apps/mobile/        # Renter app — mobile (Zero)
├── packages/contracts/ # openapi.yaml — single source of truth
├── e2e/                # End-to-end tests (Wa)
├── infra/              # docker-compose, seed data (Wa)
└── .github/            # CI/CD, templates, CODEOWNERS (Wa)
```

## Gitflow

| Branch | Purpose |
|--------|---------|
| `main` | Production releases only |
| `develop` | Integration branch — all PRs target here |
| `feature/*` | One feature per branch, cut from `develop` |
| `release/*` | Release candidates, cut from `develop` |
| `hotfix/*` | Emergency fixes, cut from `main` |

Nobody pushes directly to `develop` or `main`. All changes go through a PR.

## Commit convention

Conventional Commits — `type(scope): description`

Types: `feat`, `fix`, `chore`, `docs`, `test`, `ci`, `refactor`

## Security rules

- Never commit secrets, tokens, API keys, or passwords.
- Always use environment variables. `.env.example` with safe placeholders is allowed; `.env` is gitignored.
- No hardcoded URLs, IPs, or credentials in source code.

## Stack & commands

| App | Stack |
|-----|-------|
| `apps/api/` | Python 3.12 · FastAPI · PostgreSQL 16 · SQLAlchemy · Alembic · pytest |
| `apps/web/` | Vite · React · Tailwind CSS (scaffold pending — Silverk) |
| `apps/mobile/` | Expo 57 · React Native 0.86 · TypeScript |

### Run locally

**Start the database (run once, from repo root):**
```bash
docker compose -f infra/docker-compose.yml up -d
```

**API:**
```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate  # first time only (Mac/Linux)
# Windows: python -m venv .venv && .venv\Scripts\Activate.ps1
pip install -r requirements.txt                     # first time only
cp .env.example .env                                # first time only — fill in values
alembic upgrade head
uvicorn app.main:app --reload
```

**Seed test users (optional, from repo root with API venv active):**
```bash
DATABASE_URL=postgresql+psycopg://rentatodo:rentatodo@localhost:5432/rentatodo \
JWT_SECRET=dev-secret \
python infra/seed.py
```

**Mobile:**
```bash
cd apps/mobile
npm ci        # first time only
npx expo start
```

**Web:** TBD — Silverk's scaffold pending.

### E2E tests

- Web: Playwright (once `apps/web` scaffold exists)
- Mobile: Maestro (Expo confirmed by Zero)

## What an agent MUST NOT do in this repo

- Push directly to `develop` or `main`.
- Modify `packages/contracts/openapi.yaml` without an approved PR reviewed by all consumers.
- Add or upgrade dependencies without a clear justification in the PR description.
- Commit any file that contains secrets, tokens, or credentials.
- Run `git push --force` on any shared branch.
