# Audit Report — 2026-08-05

Auditoría de código sobre el repo **RentaTodo**, rama `chore/code-audit-2026-08-05`.
Scope restringido a edición de líneas atribuibles a Wa (identidades: `Wa Perez <yolticwapm@gmail.com>`,
`Wa39 <48028999+Wa39@users.noreply.github.com>`). El resto del repo se analiza y reporta,
pero no se modifica.

---

## 1. Resumen ejecutivo

El repo se encuentra en buen estado operativo al final de la semana 1: la suite de CI corre
en 4 jobs (API, mobile, web, Playwright), hay 25/25 tests pasando en API según el último estado
conocido, y los flujos E2E (Maestro + Playwright) están cubiertos. Las convenciones de Gitflow
y Conventional Commits se respetan en todos los PRs.

**Tres riesgos principales del repo completo (sea de quien sea el código):**

1. **S3/presigned-URL roto en producción** (`apps/api/app/s3.py:14-15`, Trucy):
   `boto3.client()` recibe credenciales como strings vacíos. En producción con IAM role en EC2,
   boto3 NO hace fallback al credential chain — toda la funcionalidad de upload de fotos está rota.

2. **Contrato de error code diverge de la implementación** (`openapi.yaml` vs `services/reservations.py`, Trucy):
   El contrato especifica `INVALID_DATES` para fechas inválidas en `POST /reservations`;
   la implementación devuelve `VALIDATION_ERROR`. Clientes que sigan el contrato manejarán
   mal el error.

3. **Sesión destruida por errores de red en mobile** (`apps/mobile/src/context/session-context.tsx:51`, Zero):
   Un bare `catch {}` convierte cualquier timeout o falla de red en startup en un logout
   permanente con borrado del token. El web lo hace bien (solo atrapa `ApiError`).

---

## 2. Tabla de autoría

| Archivo / Directorio | Clasificación | % Wa | Notas |
|---|---|---|---|
| `.github/CODEOWNERS` | MÍO | 100% | — |
| `.github/ISSUE_TEMPLATE/*.md` | MÍO | 100% | — |
| `.github/pull_request_template.md` | MÍO | 100% | — |
| `.github/workflows/ci.yml` | MÍO | 100% | — |
| `.github/workflows/deploy.yml` | MÍO | 100% | — |
| `.gitignore` | MÍO | 85% | — |
| `CLAUDE.md` | MÍO | 100% | — |
| `README.md` | MÍO | 100% | — |
| `apps/api/Dockerfile` | MÍO | 100% | — |
| `apps/api/entrypoint.sh` | MÍO | 100% | — |
| `apps/api/docker-compose.yml` | MÍO | 100% | — |
| `apps/api/.dockerignore` | MÍO | 100% | — |
| `infra/docker-compose.yml` | MÍO | 100% | — |
| `infra/seed.py` | MÍO | 100% | — |
| `infra/terraform/` (todos) | MÍO | 100% | — |
| `e2e/mobile/.maestro.yaml` | MÍO | 100% | — |
| `e2e/mobile/TESTIDS.md` | COMPARTIDO | 40% | Zero (60%) |
| `e2e/mobile/flows/auth/*.yaml` | MÍO | 100% | incluye `_login-as-renter.yaml` (sub-flow) |
| `e2e/mobile/flows/items/browse.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/navigation/tabs.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/profile/view.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/rentals/*.yaml` | MÍO | 100% | — |
| `e2e/mobile/flows/reservations/*.yaml` | MÍO | 100% | — |
| `e2e/web/package.json` | MÍO | 100% | — |
| `e2e/web/playwright.config.ts` | MÍO | 100% | — |
| `e2e/web/tsconfig.json` | MÍO | 100% | — |
| `e2e/web/tests/auth.setup.ts` | MÍO | 100% | — |
| `e2e/web/tests/auth/login.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/auth/register.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/calendar/calendar.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/dashboard/overview.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/earnings/earnings.spec.ts` | MÍO | 100% | — |
| `e2e/web/tests/items/items.spec.ts` | MÍO | 99% | — |
| `e2e/web/tests/requests/requests.spec.ts` | COMPARTIDO | 60% | Silver (40%) |
| `e2e/web/tests/reservations/reservation-detail.spec.ts` | MÍO | 94% | 2 líneas scaffold de Silver |
| `e2e/web/tests/fixtures.ts` | COMPARTIDO | 43% | Silver (57%) |
| `apps/api/.env.example` | COMPARTIDO | 44% | Trucy (56%) |
| `apps/api/app/services/items.py` | AJENO | 2% | Trucy (~98%) |
| `apps/api/app/services/reservations.py` | AJENO | <1% | Trucy (~100%) |
| `apps/api/app/services/uploads.py` | AJENO | 8% | Trucy (~92%) |
| `apps/api/tests/routers/test_auth.py` | AJENO | 8% | Trucy (~92%) |
| `apps/api/` (resto) | AJENO | 0% | Trucy |
| `apps/web/src/lib/AuthContext.tsx` | COMPARTIDO | 35% | Silver (65%) |
| `apps/web/vite.config.ts` | COMPARTIDO | 31% | Silver (69%) |
| `apps/web/src/lib/api.ts` | AJENO | 1% | Silver (~99%) |
| `apps/web/src/routes/ItemsPage.tsx` | AJENO | 17% | Silver (~83%) |
| `apps/web/` (resto) | AJENO | 0% | Silver |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | AJENO | 10% | Zero (90%) |
| `apps/mobile/` (resto) | AJENO | 0–3% | Zero |
| `packages/contracts/openapi.yaml` | AJENO* | 6% | *requiere PR aprobado por todos |
| `pnpm-workspace.yaml` | COMPARTIDO | 25% | Silver (75%) |
| `pnpm-lock.yaml` | GENERADO | — | lockfile, no tocar |
| `apps/api/alembic/versions/` | GENERADO | — | migraciones auto-generadas |
| `infra/terraform/.terraform.lock.hcl` | GENERADO | — | no tocar |
| `apps/mobile/package-lock.json` | GENERADO | — | no tocar |

---

## 3. Hallazgos por severidad

### CRÍTICO

| ID | Archivo:línea | Descripción | Impacto | Estado |
|----|---|---|---|---|
| C1 | `apps/api/app/s3.py:14-15` (Trucy) | `boto3.client()` recibe `aws_access_key_id=""` y `aws_secret_access_key=""` cuando las variables no están configuradas. boto3 trata los strings vacíos como credenciales explícitas y NO hace fallback al credential chain del IAM role. | Upload de fotos completamente roto en producción EC2 | REPORTADO-NO-EDITABLE |
| C2 | `apps/api/app/services/reservations.py:58-61` + `openapi.yaml:907` (Trucy) | Error code `VALIDATION_ERROR` en fechas inválidas; contrato especifica `INVALID_DATES`. Todos los tests confirman el código incorrecto. | Clientes que sigan el contrato no detectan errores de fecha correctamente | REPORTADO-NO-EDITABLE |

### ALTO

| ID | Archivo:línea | Descripción | Impacto | Estado |
|----|---|---|---|---|
| A1 | `apps/api/app/models/reservation.py:125` (Trucy) | `deposit_status` usa lookup de dict sin `.get()`: `{"hold": ..., "release": ..., "freeze": ...}[latest.type]` — lanza `KeyError` para tipos inesperados (corrupción de datos, futuras migraciones, escritura directa a BD) | 500 Internal Server Error en cualquier endpoint que serialice una reservación | REPORTADO-NO-EDITABLE |
| A2 | `apps/api/app/services/reservations.py:475-477` (Trucy) | `get_transactions` (operación de lectura) llama a `_get_reservation_or_404` que siempre emite `SELECT ... FOR UPDATE`. Un write lock en un read-only path bloquea cualquier escritura concurrente sobre la misma reservación. | Lock contention bajo carga moderada | REPORTADO-NO-EDITABLE |
| A3 | `apps/api/app/services/reservations.py:141-149` (Trucy) | `_get_reservation_or_404` no pre-carga `transactions` via `selectinload`. Después de `db.refresh()`, cada acceso a `reservation.transactions` dispara un SELECT implícito adicional. `close_reservation` lo accede dos veces (validación + respuesta). | N+1 oculto en cada endpoint de mutación | REPORTADO-NO-EDITABLE |
| A4 | `apps/web/src/lib/api.ts:125` (Silver) | `apiListMyRequests` hardcodea `limit=50`. La API soporta paginación; el dashboard no tiene UI de paginación. | Owners con >50 requests ven datos truncados sin aviso | REPORTADO-NO-EDITABLE |
| A5 | `apps/web/src/lib/types.ts:89-100` (Silver) | Interface `Earnings` extiende `EarningsSummary` con `by_month: EarningsByMonth[]`, campo que el API nunca devuelve. | Cualquier componente que acceda `earnings.by_month` sin null-check recibe `undefined` | REPORTADO-NO-EDITABLE |
| A6 | `apps/mobile/src/context/session-context.tsx:40-56` (Zero) | `catch {}` en startup captura todo: timeouts, errores DNS, errores de red. Destruye la sesión permanentemente y borra el token. El web solo cierra sesión en `ApiError`. | Usuario pierde sesión por abrir la app sin internet | REPORTADO-NO-EDITABLE |
| A7 | `apps/mobile/src/app/(tabs)/index.tsx:54` (Zero) | `.catch(() => {})` en carga de reservaciones descarta todos los errores silenciosamente, incluyendo errores de autenticación (401) antes de que el handler `onAuthError` actúe. | Pantalla vacía sin feedback; posible estado inconsistente de sesión | REPORTADO-NO-EDITABLE |

### MEDIO

| ID | Archivo:línea | Descripción | Impacto | Estado |
|----|---|---|---|---|
| M1 | `apps/api/app/services/reservations.py:491-498` (Trucy) | `get_earnings` carga todas las reservaciones cerradas en memoria Python con sus transacciones completas. La agrupación y suma se hacen en Python en vez de SQL. | Uso de memoria no acotado con histórico grande | REPORTADO-NO-EDITABLE |
| M2 | `apps/api/alembic/versions/e7903e5fd01d` (Trucy) | `check_evidence` table sin índice en `reservation_id`. Postgres no crea índices automáticamente en FKs. | Full scan en queries por reservación en check_evidence | REPORTADO-NO-EDITABLE |
| M3 | `apps/api/tests/routers/test_reports.py` (Trucy) | 2 de ~7 paths cubiertos. Faltan: 403 para usuario no participante, 409 INVALID_TRANSITION, 409 REPORT_EXISTS, 404. El path de freeze (único que bloquea close_reservation) no tiene test de router. | Una regresión en la lógica de freeze no sería detectada por tests de router | REPORTADO-NO-EDITABLE |
| M4 | `apps/web/src/lib/AuthContext.tsx:87-90` (Silver) | Excepciones no-`ApiError` (parse errors, TypeErrors) durante profile-load son silenciadas. El usuario queda con token pero `user === null`. | Estado parcialmente autenticado invisible | REPORTADO-NO-EDITABLE |
| M5 | `apps/web/src/routes/ItemsPage.tsx:68` (Silver) | `Math.round(Number(form.priceDollars) * 100)` — susceptible a errores de punto flotante. `Number("1.005") * 100 = 100.4999...` redondea a 100 en vez de 101. | Precio almacenado puede diferir del ingresado en centavos | REPORTADO-NO-EDITABLE |
| M6 | `infra/seed.py:344-348` (Wa) | `session.query(Reservation).count() > 0` omitía el seed de reservaciones si existía cualquier reservación, incluyendo datos de prueba del desarrollador. Los 7 UUIDs fijos quedaban ausentes sin aviso. | Desarrollador que corra seed después de crear datos manuales no recibe las fixtures | **CORREGIDO** — commit `f17b2f6` |
| M7 | `apps/mobile/src/data/auth/token-store.ts:12-16` (Zero) | Fallback a `localStorage` en builds web sin advertencia runtime. | Si el web build se usa en producción, el token es XSS-susceptible sin aviso | REPORTADO-NO-EDITABLE |
| M8 | `openapi.yaml:1052-1094, 1096-1138` (Trucy) | PATCH `/reservations/{id}/reject` y `/cancel` no documentan respuesta 404. La implementación sí la devuelve. | Clientes no tienen comportamiento definido para reservación inexistente | REPORTADO-NO-EDITABLE |

### BAJO

| ID | Archivo:línea | Descripción | Impacto | Estado |
|----|---|---|---|---|
| B1 | `infra/seed.py:283,300,310,350` (Wa) | `session.query()` es la Legacy Query API de SQLAlchemy 1.x, deprecada en 2.0. El resto del proyecto usa `select()` con `session.scalars()`. | Inconsistencia; ruptura en futura versión de SQLAlchemy | **CORREGIDO** — commit `5ff0622` |
| B2 | `apps/api/app/services/auth.py:100-102` (Trucy) | Pre-check de email antes del `UNIQUE` constraint genera una ventana TOCTOU. Dos registros concurrentes con el mismo email pasan la validación antes de que alguno haga commit. | Riesgo teórico bajo de email duplicado en cargas muy altas | REPORTADO-NO-EDITABLE |
| B3 | `openapi.yaml:396` (Trucy) | Descripción de `filename` dice "Used to derive the S3 key" pero la implementación usa `uuid.uuid4()` e ignora el filename. | Documentación engañosa para clientes | REPORTADO-NO-EDITABLE |
| B4 | `apps/web/src/lib/AuthContext.tsx:25` (Silver) | JWT en `localStorage` — accesible a cualquier script en el mismo origen (XSS). El mobile usa `expo-secure-store` correctamente. | Decisión arquitectónica aceptada para web; debe estar documentada | REPORTADO-NO-EDITABLE |
| B5 | `apps/mobile/src/data/api/api-data-source.ts` (Zero) | Sin `AbortController` timeout en ninguna request HTTP. | UI puede quedar colgada con servidor lento o caído | REPORTADO-NO-EDITABLE |
| B6 | `infra/seed.py:81` (Wa) | `_PASSWORD = "Rentatodo2026!"` hardcodeado. CLAUDE.md prohíbe passwords en código. Contexto mitigante: script de seed solo para desarrollo, credencial documentada en el docstring del módulo. | Policy violation; credencial de prueba | PENDIENTE-REQUIERE-DECISIÓN (equipo) |

---

## 4. Cambios aplicados

| Commit | Tipo | Justificación |
|--------|------|---------------|
| `5ff0622` `style(infra): replace legacy session.query() with SQLAlchemy 2.x select()` | Consistencia / forward-compat | `session.query()` está deprecado en SQLAlchemy 2.0 y será removido. Todo el resto del proyecto usa `select()` con `session.scalars()`. 5 ocurrencias reemplazadas en `infra/seed.py`. |
| `f17b2f6` `fix(infra): narrow reservation idempotency check to fixed UUIDs` | Bug de comportamiento | El check anterior (`count() > 0`) omitía las 7 reservaciones fixture si existía cualquier reservación en la BD. El nuevo check busca uno de los UUIDs fijos del seed. |

---

## 5. Revisión de PRs

### Abierto

| PR | Autor | Veredicto | Hallazgos |
|----|-------|-----------|-----------|
| **#93** `feat(infra): AWS free-tier infrastructure` | Wa | ✅ Aprobado | Ya revisado en sesión anterior con full SDD review + scoped re-review. Hallazgo deferred: `app/s3.py` pasa empty-string credentials (C1 en este reporte — código de Trucy). |

### Mergeados recientes con deuda detectada

| PR | Hallazgo |
|----|---------|
| **#49** `feat(api): Weeks 3-4 — Delivery + Reports` (Trucy) | A2 (write lock en read), A3 (lazy load oculto), M1 (get_earnings en Python), M2 (sin índice en check_evidence), C1 (s3.py credentials), C2 (VALIDATION_ERROR vs INVALID_DATES), M3 (test_reports.py cobertura) |
| **#81** `feat(api): PATCH /items/{item_id}/reactivate` (Trucy) | Ninguno detectado en el endpoint de reactivate en sí |
| **#89** `feat(mobile): sign out centrally when token expires` (Zero) | A6 — el fix de Zero fue parcial: centralizó el logout por 401, pero el `catch {}` genérico en startup (session-context.tsx) sigue destruyendo la sesión en errores de red |
| **#84** `feat(web): add confirm-password field to register form` (Silver) | Ninguno crítico; RegisterPage.tsx nuevo parece correcto |
| **#92** `test(e2e): Playwright specs for reactivate-item action` (Wa) | Ninguno — revisado en sesión anterior |

---

## 6. Lista por persona

### Para Trucy

Archivos principales: `apps/api/app/s3.py`, `apps/api/app/services/reservations.py`,
`apps/api/app/models/reservation.py`, `apps/api/tests/routers/test_reports.py`,
`packages/contracts/openapi.yaml`

---

**[CRÍTICO] `apps/api/app/s3.py:14-15` — Empty-string credentials rompen IAM role auth**

```python
# Problema actual:
return boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,   # "" cuando no está seteada
    aws_secret_access_key=settings.aws_secret_access_key,  # "" cuando no está seteada
    ...
)
```

boto3 trata `""` como credenciales explícitas y no hace fallback al credential chain.
En producción (EC2 con IAM role), toda llamada a `generate_presigned_url` falla con un error
de autenticación.

**Fix sugerido:**
```python
return boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id or None,
    aws_secret_access_key=settings.aws_secret_access_key or None,
    ...
)
```

---

**[CRÍTICO] `apps/api/app/services/reservations.py:58-61` + `openapi.yaml:907-914` — Error code incorrecto**

La implementación devuelve `"VALIDATION_ERROR"` para fechas inválidas; el contrato
especifica `"INVALID_DATES"`. Los tests actuales asientan el código incorrecto.

**Fix sugerido:** Cambiar el error code en `reservations.py:58` y `:61` a `"INVALID_DATES"`,
actualizar los tests en `tests/services/test_reservations.py` y abrir un PR que también
toque `openapi.yaml` (requiere review de todos).

---

**[ALTO] `apps/api/app/models/reservation.py:125` — KeyError en deposit_status**

```python
# Problema:
return {"hold": "held", "release": "released", "freeze": "frozen"}[latest.type]
# Si latest.type no está en el dict → KeyError → 500
```

**Fix sugerido:**
```python
_DEPOSIT_STATE = {"hold": "held", "release": "released", "freeze": "frozen"}
result = _DEPOSIT_STATE.get(latest.type)
if result is None:
    raise ValueError(f"Unexpected transaction type: {latest.type!r}")
return result
```

---

**[ALTO] `apps/api/app/services/reservations.py:475` — Write lock en operación de lectura**

`get_transactions` llama a `_get_reservation_or_404` que siempre emite
`SELECT ... FOR UPDATE`. Para una función de solo lectura, esto bloquea escrituras
concurrentes innecesariamente.

**Fix sugerido:** Extraer una función `_get_reservation_or_404_readonly` que use
`select(Reservation).where(Reservation.id == reservation_id)` sin `with_for_update()`,
y usarla en `get_transactions`.

---

**[ALTO] `apps/api/app/services/reservations.py:141-149` — transactions no pre-cargadas**

`_get_reservation_or_404` pre-carga `item` y `renter` pero no `transactions`.
Después de `db.refresh()`, acceder a `reservation.transactions` dispara un SELECT extra.
Esto ocurre en todos los endpoints de mutación, y dos veces en `close_reservation`.

**Fix sugerido:** Agregar `.options(selectinload(Reservation.transactions))` a la query
en `_get_reservation_or_404`.

---

**[MEDIO] `apps/api/app/services/reservations.py:491-498` — get_earnings en Python**

Carga todas las reservaciones cerradas con sus transacciones a memoria Python y hace
la agrupación y suma en Python. Con histórico grande, esto no escala.

**Fix sugerido:** Reemplazar con una query SQL que agrupe por `item_id` y sume el
`deposit_amount` directamente.

---

**[MEDIO] `apps/api/alembic/` — Sin índice en `check_evidence.reservation_id`**

La migración `e7903e5fd01d` crea una FK en `reservation_id` pero no un índice.
Postgres no crea índices automáticamente en FKs.

**Fix sugerido:** Nueva migración de Alembic que agregue:
`op.create_index('ix_check_evidence_reservation_id', 'check_evidence', ['reservation_id'])`

---

**[MEDIO] `apps/api/tests/routers/test_reports.py` — Cobertura insuficiente**

Solo cubre happy path y 401. Faltan:
- 403: usuario no participante intenta reportar
- 409 `INVALID_TRANSITION`: reservación en estado que no permite reporte
- 409 `REPORT_EXISTS`: segundo reporte en la misma reservación
- 404: reservación inexistente

El path de freeze (único que bloquea `close_reservation`) no tiene test de router.

---

**[MEDIO] `packages/contracts/openapi.yaml:1052-1094, 1096-1138` — 404 no documentado**

`PATCH /reservations/{id}/reject` y `PATCH /reservations/{id}/cancel` no documentan
la respuesta 404. La implementación sí la devuelve.

**Fix sugerido:** Agregar el caso 404 (`NOT_FOUND`) a ambos endpoints en el contrato,
abriendo un PR que toque el openapi.yaml con review de todos los consumidores.

---

**[BAJO] `packages/contracts/openapi.yaml:396` — Descripción incorrecta de filename**

`"Original filename. Used to derive the S3 key."` — la implementación ignora el
filename y usa `uuid.uuid4()` como clave S3.

**Fix sugerido:** Actualizar la descripción a algo como `"Original filename (informational only; the S3 key is derived from a UUID)"`.

---

### Para Silverk

Archivos principales: `apps/web/src/lib/api.ts`, `apps/web/src/lib/types.ts`,
`apps/web/src/lib/AuthContext.tsx`, `apps/web/src/routes/ItemsPage.tsx`

---

**[ALTO] `apps/web/src/lib/api.ts:125` — limit=50 hardcodeado en apiListMyRequests**

```typescript
// Problema:
return request('/users/me/requests?page=1&limit=50', ...)
```

Owners con más de 50 requests recibidos ven solo los primeros 50, ordenados por
`created_at DESC`, sin ningún aviso de que hay más datos.

**Fix sugerido:** Implementar paginación en `RequestsContext` y agregar un botón
"Load more" o scroll infinito en `RequestsPage`. El endpoint de API ya soporta
`page` y `limit`.

---

**[ALTO] `apps/web/src/lib/types.ts:89-100` — Campo by_month que el API no devuelve**

```typescript
export interface Earnings extends EarningsSummary {
  by_month: EarningsByMonth[]  // el API NUNCA devuelve esto
}
```

`apiGetEarnings` retorna `Promise<EarningsSummary>` correctamente, pero la interface
`Earnings` agrega un campo que nunca existe. Cualquier acceso a `.by_month` sin
null-check produce `undefined`.

**Fix sugerido:** Eliminar `by_month` de la interface `Earnings`, o agregar
`by_month?: EarningsByMonth[]` (opcional). Verificar que ningún componente lo
use como requerido.

---

**[MEDIO] `apps/web/src/lib/AuthContext.tsx:87-90` — Non-ApiError silenciado en profile-load**

```typescript
.catch((err) => {
  if (tokenRef.current !== mountToken) return
  if (err instanceof ApiError) logout()
  // cualquier otro error (parse error, TypeError, etc.) se silencia
})
```

El usuario queda con token seteado pero `user === null` — estado parcialmente
autenticado que puede producir comportamientos inesperados en la UI.

**Fix sugerido:** Agregar un `else` que al menos loguee el error:
```typescript
else { console.error('[AuthContext] unexpected error loading profile:', err) }
```
O re-throw si el diseño lo permite.

---

**[MEDIO] `apps/web/src/routes/ItemsPage.tsx:68` — Float rounding en conversión de precio**

```typescript
const priceCentavos = Math.round(Number(form.priceDollars) * 100)
```

`Number("1.005") * 100 = 100.4999...` → redondea a 100 en vez de 101.
`Number("10.15") * 100 = 1014.9999...` puede redondear hacia abajo.

**Fix sugerido:** Parsear directamente en centavos:
```typescript
const priceCentavos = Math.round(parseFloat(form.priceDollars) * 100 + Number.EPSILON)
```
O cambiar el input a integer cents directamente.

---

**[BAJO] `apps/web/src/lib/AuthContext.tsx:25` — JWT en localStorage**

```typescript
localStorage.getItem(TOKEN_KEY)
```

localStorage es accesible a cualquier script del mismo origen. Es una decisión
arquitectónica (sin `httpOnly` cookies no hay alternativa perfecta en SPA pura),
pero debe estar documentada explícitamente como un trade-off aceptado, no como
un olvido.

---

### Para Zero

Archivos principales: `apps/mobile/src/context/session-context.tsx`,
`apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/data/auth/token-store.ts`,
`apps/mobile/src/data/api/api-data-source.ts`

---

**[ALTO] `apps/mobile/src/context/session-context.tsx:40-56` — Sesión destruida por errores de red**

```typescript
// Problema:
try {
  const token = await getStoredToken();
  if (!token) { setStatus('signed_out'); return; }
  setAccessToken(token);
  setUser(await authService.getProfile()); // puede fallar por timeout, DNS, etc.
  setStatus('signed_in');
} catch {
  // Cualquier error destruye la sesión — incluyendo timeouts
  setAccessToken(null);
  await clearStoredToken();
  setStatus('signed_out');
}
```

El web (`AuthContext.tsx:87`) lo hace bien — solo cierra sesión en `ApiError`:
```typescript
.catch((err) => { if (err instanceof ApiError) logout() })
```

**Fix sugerido:** Adaptar el mismo patrón en mobile:
```typescript
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    setAccessToken(null);
    await clearStoredToken();
    setStatus('signed_out');
  } else {
    // error de red/timeout — mantener el token, mostrar pantalla offline
    setStatus('signed_out'); // o un nuevo estado 'offline'
  }
}
```

---

**[ALTO] `apps/mobile/src/app/(tabs)/index.tsx:54` — Errores de reservaciones silenciados**

```typescript
.catch(() => {})  // silencia todo: 401, 500, timeout, etc.
```

**Fix sugerido:**
```typescript
.catch((err) => {
  console.error('[HomeScreen] failed to load reservations:', err);
  // opcionalmente: setError(err) y mostrar un ListState de error con retry
})
```

---

**[MEDIO] `apps/mobile/src/data/auth/token-store.ts:12-16` — localStorage en web build sin advertencia**

El fallback a `localStorage` es una limitación conocida de expo-secure-store en web,
pero no hay ninguna advertencia en runtime que lo indique.

**Fix sugerido:** Agregar un `console.warn` en el branch web:
```typescript
if (Platform.OS === 'web') {
  console.warn('[token-store] Using localStorage (not secure) — web build only');
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}
```

---

**[BAJO] `apps/mobile/src/data/api/api-data-source.ts` — Sin timeout en requests HTTP**

`fetch()` en React Native no tiene timeout incorporado. Un servidor caído deja la UI
colgada indefinidamente.

**Fix sugerido:** Agregar timeout en `http.ts` (o donde se centralice fetch):
```typescript
const controller = new AbortController();
const id = setTimeout(() => controller.abort(), 10_000); // 10s
const response = await fetch(url, { ...options, signal: controller.signal });
clearTimeout(id);
```

---

## 7. Antes / después

### infra/seed.py

| Métrica | Antes | Después |
|---------|-------|---------|
| Llamadas a `session.query()` (legacy) | 5 | 0 |
| Idempotency check de reservaciones | `count() > 0` (cualquier row) | Busca UUIDs fijos específicos |
| Comportamiento con datos de prueba preexistentes | Silencia el seed de fixtures | Seed corre correctamente |

### apps/api/ (sin cambios en código — Trucy)

| Métrica | Estado |
|---------|--------|
| Tests | 25/25 pasan según ROADMAP.md (estado pre-merge a develop) |
| Cobertura de test_reports.py | 2/~7 paths (~29%) |
| Error codes vs contrato | 2 divergencias conocidas (VALIDATION_ERROR/INVALID_DATES, filename desc) |

### CI

Sin cambios en esta auditoría. El job `playwright` usa mocking completo de API
via `page.route()` — no requiere backend real. Diseño válido confirmado.

---

*Generado en rama `chore/code-audit-2026-08-05` — 2026-08-05.*
