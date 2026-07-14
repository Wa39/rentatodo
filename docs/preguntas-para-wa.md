# Preguntas para Wa (Plataforma / QA)

> **Quién pregunta:** Zero — App móvil (arrendatario), React Native.
> **Por qué a Wa:** maneja CI/CD, el servicio de imágenes (URLs prefirmadas), el
> servicio de pagos/depósito mock, los ambientes dev/staging, los seeds y las
> convenciones de ramas/commits/PR.
> **Fecha:** 2026-07-09

**Leyenda de prioridad**
- 🔴 **Bloqueante** — lo necesito para arrancar / antes de mi primer PR.
- 🟡 **Importante** — semanas 2–3.
- 🟢 **Puede esperar** — semana 3–4 o nice-to-have.

---

## A. Ambientes y datos de prueba

1. 🔴 ¿Cuál es la **URL base** de la API en `dev` y en `staging`? ¿Cómo la configuro en la app (env var / archivo de config)?
2. 🔴 ¿Hay **seeds / usuarios de prueba** ya cargados que pueda usar? Idealmente: un usuario dueño + un usuario arrendatario + algunos items con foto. Así pruebo sin depender de que Silverk publique a mano.
3. 🟡 ¿Cómo levanto el entorno **local** si lo necesito? (¿docker-compose, instrucciones, `.env` de ejemplo?).
4. 🟢 ¿Los ambientes se resetean seguido? (para saber si mis datos de prueba sobreviven entre días).

## B. Servicio de imágenes / URLs prefirmadas (crítico para mí)

Lo uso en **dos lugares**: la foto del item (aunque la publica Silverk, quiero entender el flujo) y sobre todo las **fotos de check-in/check-out** de mi app.

5. 🔴 ¿Cuál es el endpoint para **pedir una URL prefirmada**? ¿Qué mando (tipo de archivo, tamaño, nombre)? ¿Qué me devuelve — `uploadUrl` + `publicUrl`?
6. 🔴 ¿Con qué método **subo el archivo** a la `uploadUrl`? ¿`PUT`? ¿`POST` multipart? ¿Qué headers necesito (ej. `Content-Type`)?
7. 🔴 ¿La `uploadUrl` **expira**? ¿En cuánto tiempo? (para reintentar si el usuario tarda tomando la foto).
8. 🟡 ¿Restricciones de **formato y tamaño** de imagen? (jpg/png, máximo MB). Así valido/comprimo en el móvil antes de subir.
9. 🟡 ¿El **mismo servicio** sirve para la foto del artículo y para las fotos de check-in/check-out, o son flujos distintos?
10. 🟡 ¿Necesito **auth** (token) para pedir la URL prefirmada?
11. 🔴 **Plan B para el MVP:** si el servicio de imágenes no está listo la primera semana, ¿puedo arrancar mandando una `photo_url` placeholder/manual para no bloquearme?

## C. Servicio de pagos / depósito mock

12. 🔴 ¿Cómo "pago" el depósito desde el móvil? ¿Hay un endpoint del mock (ej. `POST /payments/hold`) o es parte del flujo de crear la reserva (lo maneja Trucy)?
13. 🟡 ¿Qué respuesta **simula** el mock? ¿Siempre éxito, o puedo forzar un **fallo** para probar el camino de error?
14. 🟡 ¿En qué momento se **retiene** el depósito (`HOLD`) y en cuál se **libera** (`RELEASE`)? ¿Eso lo disparo yo desde el móvil o pasa solo en el backend?
15. 🟢 ¿Qué me devuelve el mock para que muestre una **confirmación** de "pago" al usuario (id de transacción, monto, estado)?

## D. Convenciones de equipo (mi insumo requerido según el plan)

16. 🔴 **Convención de nombres de ramas** — ¿`feature/<algo>`? ¿Cómo las nombro exactamente?
17. 🔴 **Convención de mensajes de commit** — ¿Conventional Commits (`feat:`, `fix:`...)? ¿En español o inglés?
18. 🔴 **Plantilla de Pull Request** — ¿qué debe incluir mi PR (descripción, checklist, screenshots)?
19. 🔴 ¿Qué corre el **CI** en cada PR (lint, tests, build)? ¿Qué tengo que tener en **verde** para que me dejen mergear?
20. 🟡 ¿Hay **linter/formatter** configurado que deba usar en el móvil (ESLint/Prettier)? ¿Me pasás la config para no pelearme con el CI?
21. 🟡 ¿Cómo se integra mi **app React Native** al pipeline? ¿El CI hace build del móvil? ¿Necesitás algo especial de mi parte (scripts, comandos)?

## E. Tests E2E (semana 2 en adelante)

22. 🟡 El primer test **E2E** (semana 2) atraviesa mi flujo (listar → solicitar → ver aprobada). ¿Qué necesitás de mí para escribirlo? ¿Cómo simulás/manejás la app móvil en el E2E?
23. 🟢 ¿Tenés autoridad para **bloquear mi merge** si rompo el E2E (según el plan). ¿Cómo me entero rápido si lo rompí y cómo lo reproduzco localmente?

---

## Resumen: lo mínimo que necesito de Wa para arrancar

- **URL base de la API** (dev/staging) y **usuarios/seeds de prueba** (Q1, Q2).
- **Flujo de URL prefirmada** completo, o el **plan B** con `photo_url` manual (Q5–Q7, Q11).
- **Convenciones** de ramas, commits, plantilla de PR y qué exige el CI para mergear (Q16–Q19).
