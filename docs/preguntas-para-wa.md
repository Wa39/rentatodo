# Preguntas para Wa (Plataforma / QA)

> **Quién pregunta:** Zero — App móvil (arrendatario), React Native.
> **Por qué a Wa:** maneja CI/CD, el servicio de imágenes (URLs prefirmadas), el
> servicio de pagos/depósito mock, los ambientes dev/staging, los seeds y las
> convenciones de ramas/commits/PR.
> **Última actualización:** 2026-07-09 (revisado contra el scaffold del repo)

**Leyenda:** 🔴 Bloqueante · 🟡 Importante (semanas 2–3) · 🟢 Puede esperar

---

# ✅ Ya resuelto por el scaffold — no hace falta preguntarlo

Todo esto ya está documentado en el repo:

| Tema | Dónde está | Respuesta |
|---|---|---|
| Convención de ramas | `CLAUDE.md`, `README.md` | `feature/*` cortada de `develop` |
| Convención de commits | `CLAUDE.md` | Conventional Commits — `feat`, `fix`, `chore`, `docs`, `test`, `ci`, `refactor` |
| Plantilla de PR | `.github/pull_request_template.md` | Existe, con checklist |
| Flujo de merge | `README.md` | PR contra `develop` → CI verde + 1 aprobación → **squash and merge** |
| CI | `.github/workflows/ci.yml` | Job `ci-gate`. Hoy es un **placeholder** (`echo && exit 0`); los jobs reales se cablean el día 3+ |

---

# 🔴 Lo que necesito para arrancar

## 1. Ambientes y URL base de la API

`infra/` está vacío todavía.

- ¿Dónde va a correr la API de Trucy en **dev** y en **staging**?
- ¿Cómo la configuro desde el móvil? ¿Una env var tipo `EXPO_PUBLIC_API_URL`?
- ¿Cómo levanto el entorno **local** si lo necesito (docker-compose, `.env.example`)?

## 2. Seeds / usuarios de prueba

Necesito probar sin depender de que Silverk publique artículos a mano cada vez. Idealmente los seeds traen:

- Un usuario **dueño** y un usuario **arrendatario**, con credenciales que me pases
- Varios **items con foto**, de categorías distintas y **precios variados** (para probar los chips de rango de precio)
- Alguna **reserva ya creada** en distintos estados, para poder probar mis pantallas sin recorrer todo el flujo cada vez

## 3. Servicio de imágenes / URLs prefirmadas ⭐

*Es lo que más me bloquea de tu lado.* Lo uso en el **check-in y check-out** (foto del estado del artículo).

- ¿Qué endpoint pido para obtener la URL prefirmada? ¿Qué le mando y qué me devuelve (`uploadUrl` + `publicUrl`)?
- ¿Con qué método subo el archivo? ¿`PUT`? ¿`POST` multipart? ¿Qué headers necesito?
- ¿Cuánto **dura** la URL antes de expirar? (por si el usuario tarda tomando la foto)
- ¿**Límites** de formato y tamaño? (para comprimir en el celular antes de subir)
- ¿Necesito **auth** para pedirla?
- ¿El **mismo servicio** sirve para la foto del artículo (de Silverk) y para mis fotos de check-in/out?
- **Plan B:** si no llega para la semana 1, ¿puedo mandar una `photo_url` placeholder para no bloquearme?

## 4. Servicio de pagos / depósito mock

- ¿Cómo "pago" el depósito desde el móvil? ¿Tiene **endpoint propio**, o es parte de crear la reserva (y lo maneja Trucy)?
- ¿Puedo forzar un **fallo** para probar el camino de error, o siempre devuelve éxito?
- ¿En qué momento se **retiene** (`HOLD`) y se **libera** (`RELEASE`)? ¿Lo disparo yo o pasa solo en el backend?

## 5. El CI del móvil

Cuando cablees los jobs reales (día 3+):

- ¿Qué va a correr sobre `apps/mobile` — lint, test, build?
- ¿Necesitás algo de mí (scripts en el `package.json`, comandos específicos)?
- ¿Hay config de **ESLint/Prettier** que deba respetar, o la defino yo? Prefiero saberlo **antes** de escribir código, no cuando el CI me rebote el PR.

## 6. El stack del móvil

El `CLAUDE.md` dice *"Stack TBD — updated on day 3"*.

Propongo **React Native + Expo**: Expo Go permite probar en el celular escaneando un QR, y `expo-camera` / `expo-image-picker` / `expo-secure-store` ya vienen resueltos — los necesito sí o sí para las fotos y para guardar el token de forma segura.

¿Lo dejamos registrado en el `CLAUDE.md`?

---

# ⚠️ Tres cosas que encontré revisando el scaffold

## A. El `CODEOWNERS` tiene usuarios que no existen

Dice `@trucy @silverk @zero @wa` — son **alias, no usuarios de GitHub**. El propio archivo lo marca como TODO.

Los reales son:

| Alias | Usuario de GitHub |
|---|---|
| Trucy | `@josepicado95` |
| Silverk | `@josmedina` |
| Zero | `@psced10-creator` |
| Wa | `@Wa39` |

## B. Los rulesets no están activos — y sin eso, las reglas del equipo no existen ⭐

**El `CODEOWNERS` por sí solo no hace nada.** GitHub solo lo aplica si además hay un **ruleset activo** con *"Require review from Code Owners"*.

Prueba concreta: **al abrir el PR #1, GitHub me lo puso contra `main` por defecto, con el botón "Squash and merge" habilitado.** Podría haber mergeado directo a producción, sin revisión de nadie, y nada me lo habría impedido.

O sea que hoy *"nadie pushea a develop"*, *"todo pasa por PR"* y *"los 4 aprueban el contrato"* son **acuerdos de palabra**, no reglas técnicas.

En **Settings → Rules → Rulesets**, sobre `develop` y `main`, haría falta:

- Requerir **Pull Request** (bloquear push directo)
- Requerir **1 aprobación** mínimo
- Requerir el check **`ci-gate`** en verde
- Requerir **review de Code Owners** (para que aplique la regla de `packages/contracts/`)

Esto solo lo puede hacer Wa (dueño del repo) desde la configuración de GitHub — **no se puede por código**. Y como el proceso es el **50% de la nota**, parece lo primero a cerrar.

## C. El `openapi.yaml` está vacío

Son 6 líneas y todas son comentarios — ni un endpoint. Y se congela el día 3.

Mis requisitos del móvil están en [`preguntas-para-trucy.md`](./preguntas-para-trucy.md), para que la sesión del contrato arranque con algo concreto en vez de una hoja en blanco. Si te sirve para el E2E, echale un ojo: ahí están los formatos de error y la máquina de estados que también vas a necesitar.

---

# 🟡 Tests E2E (semana 2 en adelante)

- El primer test E2E atraviesa mi flujo (listar → solicitar → ver aprobada). ¿Qué necesitás de mí para escribirlo? ¿Cómo manejás la app móvil dentro del E2E?
- Si rompo el E2E, ¿cómo me entero rápido y cómo lo reproduzco localmente?
