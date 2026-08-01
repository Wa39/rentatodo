# Audit Report — 2026-07-31

Auditoría de código sobre el repo **RentaTodo**, rama `chore/code-audit-2026-07-31`.
Scope restringido a líneas atribuibles a Wa (identidades: `Wa Perez <yolticwapm@gmail.com>`,
`Wa39 <48028999+Wa39@users.noreply.github.com>`).

---

## 1. Resumen ejecutivo

El código de Wa se encuentra en buen estado general: las convenciones de commit
se respetan, la suite de CI tiene cobertura de los cuatro sub-proyectos y los
flujos E2E son detallados y bien documentados.

**Tres riesgos principales:**

1. **Time-bomb en `request.yaml`** — una aserción `assertVisible: "Agosto 2026"`
   hardcodeada se volvía falsa el 1 de agosto (el día siguiente de la auditoría).
   Corregido en el primer commit.

2. **Boilerplate de login duplicado en 10 flujos Maestro** — un cambio en la
   pantalla de login requería editar 10 archivos en simultáneo, con alto riesgo
   de quedar inconsistentes. Refactored a un sub-flujo reutilizable.

3. **CI sin `concurrency` key** — pushes sucesivos al mismo PR disparaban runs
   paralelos innecesarios. Corregido con un grupo de concurrencia.

---

## 2. Tabla de autoría

| Archivo / Directorio | Clasificación | % Wa | Notas |
|---|---|---|---|
| `.github/CODEOWNERS` | MÍO | 100% | — |
| `.github/ISSUE_TEMPLATE/*.md` | MÍO | 100% | — |
| `.github/pull_request_template.md` | MÍO | 100% | — |
| `.github/workflows/ci.yml` | MÍO | 100% | — |
| `.gitignore` | MÍO | 89% | — |
| `CLAUDE.md` | MÍO | 100% | — |
| `README.md` | MÍO | 100% | — |
| `infra/docker-compose.yml` | MÍO | 100% | — |
| `infra/seed.py` | MÍO | 100% | — |
| `e2e/mobile/.maestro.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/auth/*.yaml` | MÍO | 100% | incluye el nuevo `_login-as-renter.yaml` |
| `e2e/mobile/flows/items/browse.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/navigation/tabs.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/profile/view.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/rentals/*.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/reservations/*.yaml` | MÍO | 100% | — |
| `e2e/mobile/TESTIDS.md` | COMPARTIDO | 40% | Zero (60%) |
| `e2e/web/package.json` | MÍO | 100% | — |
| `e2e/web/playwright.config.ts` | MÍO | 100% | — |
| `e2e/web/tsconfig.json` | MÍO | 100% | — |
| `e2e/web/tests/auth.setup.ts` | MÍO | 100% | — |
| `e2e/web/tests/auth/login.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/auth/register.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/calendar/calendar.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/dashboard/overview.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/earnings/earnings.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/items/items.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/requests/requests.spec.ts` | COMPARTIDO | 60% | Silver (40%) |
| `e2e/web/tests/reservations/reservation-detail.spec.ts` | MÍO | 94% | 2 líneas de Silver (scaffold original) |
| `e2e/web/tests/fixtures.ts` | COMPARTIDO | 43% | Silver (57%) |
| `apps/api/.env.example` | COMPARTIDO | 44% | Trucy (56%) |
| `apps/api/app/services/items.py` | COMPARTIDO | 2% | Trucy (98%) |
| `apps/api/app/services/reservations.py` | COMPARTIDO | <1% | Trucy (~100%) |
| `apps/api/app/services/uploads.py` | COMPARTIDO | 8% | Trucy (92%) |
| `apps/api/tests/routers/test_auth.py` | COMPARTIDO | 8% | Trucy (92%) |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | COMPARTIDO | 10% | Zero (90%) |
| `apps/mobile/src/app/(tabs)/check/[id].tsx` | COMPARTIDO | 1% | Zero (99%) |
| `apps/mobile/src/app/(tabs)/profile.tsx` | COMPARTIDO | 4% | Zero (96%) |
| `apps/mobile/src/app/(tabs)/reservation/[id].tsx` | COMPARTIDO | 1% | Zero (99%) |
| `apps/mobile/src/components/month-calendar.tsx` | COMPARTIDO | 1% | Zero (99%) |
| `apps/mobile/src/components/status-badge.tsx` | COMPARTIDO | 3% | Zero (97%) |
| `apps/web/src/lib/AuthContext.tsx` | COMPARTIDO | 15% | Silver (85%) |
| `apps/web/src/lib/api.ts` | COMPARTIDO | 1% | Silver (99%) |
| `apps/web/src/lib/i18n/index.ts` | COMPARTIDO | 22% | Silver (78%) |
| `apps/web/src/lib/i18n/index.test.ts` | COMPARTIDO | 6% | Silver (94%) |
| `apps/web/tsconfig.json` | COMPARTIDO | 7% | Silver (93%) |
| `pnpm-workspace.yaml` | COMPARTIDO | 25% | Silver (75%) |
| `apps/api/` (resto) | AJENO | 0% | Trucy |
| `apps/mobile/src/` (resto) | AJENO | 0% | Zero |
| `apps/web/src/routes/`, `src/components/` (resto) | AJENO | 0% | Silver |
| `packages/contracts/openapi.yaml` | AJENO* | — | *editable solo con PR aprobado por todos |
| `pnpm-lock.yaml` | GENERADO | — | lockfile, no tocar |
| `apps/api/alembic/versions/` | GENERADO | — | migraciones auto-generadas |

---

## 3. Hallazgos por severidad

### MEDIO

| ID | Archivo:línea | Descripción | Estado |
|----|---|---|---|
| M1 | `e2e/mobile/flows/reservations/request.yaml:43` | `assertVisible: "Agosto 2026"` hardcodeado — se rompía el 1 agosto 2026 | **CORREGIDO** |
| M2 | `e2e/mobile/flows/*/` (10 archivos) | Bloque de login de 10 pasos repetido verbatim en 10 flujos. Un cambio en la UI de login requería editar 10 archivos simultáneamente | **CORREGIDO** |

### BAJO

| ID | Archivo:línea | Descripción | Estado |
|----|---|---|---|
| B1 | `.github/workflows/ci.yml:15` | Sin `concurrency` key — pushes sucesivos al mismo PR disparan runs paralelos que queman minutos de CI innecesariamente | **CORREGIDO** |
| B2 | `e2e/web/tests/reservations/reservation-detail.spec.ts:3-5` | Comentario indicaba que el mock de transacciones venía de `mockData.ts`, pero PR #63 lo movió a `fixtures.ts`. Referencia obsoleta | **CORREGIDO** |
| B3 | `infra/seed.py:60` | `_PASSWORD = "Rentatodo2026!"` hardcodeado en código fuente. CLAUDE.md prohíbe passwords en código. Contexto mitigante: script de seed únicamente para desarrollo, credencial ya documentada en el docstring del módulo | **PENDIENTE-REQUIERE-DECISIÓN** |
| B4 | `e2e/mobile/flows/items/browse.yaml` (pre-refactor) | Usaba `assertVisible: login-brand` mientras el resto de los flujos usaba `assertVisible: login-submit`. Inconsistencia normalizada por el sub-flujo del commit 2 | **CORREGIDO** (resuelto por M2) |

### REPORTADO — código ajeno, no editable

| ID | Archivo:línea | Descripción | Severidad | Sugerencia |
|----|---|---|---|---|
| A1 | `e2e/web/tests/fixtures.ts:22` (Silver) | `MOCK_USER.id = '1'` — no es UUID. Si el componente valida formato UUID, podría romper silenciosamente | BAJO | Cambiar a `'00000099-0000-4000-8000-000000000099'` para alinearse con el esquema de UUIDs del seed |
| A2 | PR #75 (Zero) | Diff demasiado grande para leer vía `gh pr diff`. No auditado | INFO | Revisar manualmente |

---

## 4. Cambios aplicados

| Commit | Tipo | Justificación |
|--------|------|---------------|
| `7aa6232` `fix(e2e): remove hardcoded month assertion from Maestro request flow` | Bug | `assertVisible: "Agosto 2026"` se volvía falso a partir del 1 de agosto. Time-bomb activo al momento de la auditoría |
| `aaf4a86` `refactor(e2e): extract shared Maestro login into a renter sub-flow` | Mantenibilidad | 10 flujos repetían 10 pasos de login idénticos. −164 líneas, +41 en el sub-flujo. Centraliza el punto de cambio |
| `17a261c` `ci: cancel stale workflow runs on new push` | Eficiencia CI | Sin `concurrency`, dos pushes al mismo PR en rápida sucesión corren CI dos veces para el commit viejo y el nuevo |
| `c807ec2` `docs(e2e): fix stale comment in reservation-detail spec` | Docs | Comentario apuntaba a `mockData.ts` desde PR #63 el mock vive en `fixtures.ts` como `page.route()` |

---

## 5. Revisión de PRs

### Abiertos

| PR | Autor | Veredicto | Hallazgos |
|----|-------|-----------|-----------|
| **#71** `test(e2e): expand Playwright specs for calendar and dashboard` | Wa | ✅ Aprobado | `MOCK_ITEM_CARPA.category = 'outdoors'` mientras el seed usa `'camping'`. El test no valida `category`, así que no impacta en los assertions — puramente cosmético |
| **#68** `fix(web): upgrade vitest 2.x → 3.2.7` | Wa | ✅ Aprobado | Diff limpio: un cambio de versión en `package.json` + `pnpm-lock.yaml` actualizado. Tests pasan en CI |
| **#75** `fix(mobile): make "Ver todas" navigate...` | Zero | ⚠️ No auditado | Diff demasiado grande (>300 archivos, posiblemente lock incluido). Revisar manualmente |

### Mergeados recientes con hallazgos de deuda

| PR | Deuda detectada |
|----|----------------|
| **#72** `test(e2e): add Maestro tab navigation flow` | Login boilerplate en `tabs.yaml` — resuelto por el commit 2 de esta auditoría |
| **#63** `test(e2e): add missing Playwright route mocks` | Dejó el comentario obsoleto en `reservation-detail.spec.ts` — resuelto por commit 4 |

---

## 6. Backlog priorizado — no corregido y por qué

| # | Hallazgo | Razón de postergación |
|---|---|---|
| B3 | `_PASSWORD` hardcodeado en `seed.py` | Es un script de desarrollo, la contraseña está documentada como credencial de test en el docstring del módulo. Cambiar requiere coordinar con el equipo (cambiaría el onboarding) |
| A1 | `MOCK_USER.id = '1'` en `fixtures.ts` | Línea de Silver — no editable. Requiere que Silver abra un PR |
| A2 | PR #75 (Zero) | Diff no disponible vía CLI. Requiere revisión manual |
| — | react-router-dom open redirect (CVE, sin fix en 6.x) | Requiere decisión de producto sobre migrar a v7 |
| — | JWT en localStorage sin rotación de tokens | Requiere cambio coordinado en `apps/api` (Trucy) |

---

## 7. Antes / después

### Líneas de código (flujos Maestro)

| Métrica | Antes | Después |
|---------|-------|---------|
| Líneas de login boilerplate en flujos | ~110 (11 × 10 pasos) | 11 (11 × 1 `runFlow`) |
| Archivos a editar si cambia la UI de login | 10 | 1 (`_login-as-renter.yaml`) |
| Flujos con `assertVisible: "Agosto 2026"` | 1 | 0 |

### CI

| Métrica | Antes | Después |
|---------|-------|---------|
| Runs concurrentes por PR en push rápido | 2+ | 1 (se cancela el stale) |

### Playwright (sin cambios en lógica de tests)

Los Playwright specs no fueron modificados salvo el comentario en
`reservation-detail.spec.ts`. No hay cambio en la cuenta de tests ni
en los assertions — solo mejora de documentación.

---

*Generado por auditoría en rama `chore/code-audit-2026-07-31` — 2026-07-31.*
