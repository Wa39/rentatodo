# RentaTodo

P2P item rental platform. Owners list items; renters discover and book them.

## Structure

| Path | Contents |
|------|----------|
| `apps/api/` | Backend API |
| `apps/web/` | Owner dashboard (web) |
| `apps/mobile/` | Renter app (mobile) |
| `packages/contracts/` | OpenAPI spec — source of truth |
| `e2e/` | End-to-end tests |
| `infra/` | docker-compose, seed data |

## Contributing

1. Cut a branch from `develop`: `git checkout -b feature/my-feature develop`
2. Commit with Conventional Commits: `feat(api): add endpoint`
3. Open a PR targeting `develop`
4. CI must be green (`ci-gate` passes) and at least one teammate must approve
5. Squash and merge

> Changes to `packages/contracts/` require approval from all four team members — see [.github/CODEOWNERS](.github/CODEOWNERS).

## Install & run

TBD — see day 3 once app scaffolds exist.
