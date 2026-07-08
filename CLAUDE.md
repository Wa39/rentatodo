# RentaTodo — CLAUDE.md

## Project

P2P item rental platform. Owners list items; renters discover and book them.
Four-person, four-week project. Stack TBD — updated on day 3 once app scaffolds exist.

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

TBD — updated on day 3 once app scaffolds exist.

## What an agent MUST NOT do in this repo

- Push directly to `develop` or `main`.
- Modify `packages/contracts/openapi.yaml` without an approved PR reviewed by all consumers.
- Add or upgrade dependencies without a clear justification in the PR description.
- Commit any file that contains secrets, tokens, or credentials.
- Run `git push --force` on any shared branch.
