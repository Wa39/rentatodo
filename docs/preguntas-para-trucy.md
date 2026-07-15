# Preguntas para Trucy (Backend Core)

> **Quién pregunta:** Zero — App móvil (arrendatario), React Native.
> **Por qué a Trucy:** es dueña del contrato OpenAPI, del modelo de datos, del motor de
> disponibilidad y de la máquina de estados de la reserva.
> **Última actualización:** 2026-07-09

**Leyenda:** 🔴 Bloqueante (antes del día 3) · 🟡 Importante (semanas 2–3) · 🟢 Puede esperar

---

# ✅ Decisiones ya cerradas

| Tema | Decisión |
|---|---|
| **Moneda** | **USD, centavos, integer.** `price_per_day: 5000` = **$50.00**. El frontend divide entre 100. |
| **Filtro de texto (`q`)** | Busca en **`name` Y `description`**. Ignora mayúsculas. Ignora acentos. Coincidencia parcial. |
| **Combinar filtros** | `category` + `q` + precio se combinan (AND). |
| **Filtro de precio** | ✅ Aprobado. Parámetros `min_price` / `max_price`, en centavos. |
| **Paginación** | `?page=1&limit=20` |
| **Catálogo público** | `GET /items` y `GET /items/{id}` funcionan **sin sesión**. La respuesta es **idéntica** con o sin token. |
| **Qué ve un invitado** | Listado, búsqueda, detalle **y el calendario de disponibilidad**. No puede solicitar alquiler. |
| **Artículos propios** | **NO se excluyen del listado.** Aparecen como cualquier otro. El bloqueo ocurre **al intentar alquilar**. |
| **Detectar "es mío"** | El item devuelve **`owner_id`** → lo comparo con mi usuario, del lado del cliente. |
| **Alquilar lo propio** | `POST /items/{id}/reservations` → **`403` + `CANNOT_RENT_OWN_ITEM`** |
| **Post-login desde el detalle** | El usuario **vuelve al detalle del artículo** donde estaba, no al home. |

> ⚠️ **A corregir en el modelo de datos:** la tabla `ITEMS` dice *"price_per_day — EN CENTAVOS
> (5000 = ₡5.000)"*. Con la decisión de USD eso quedó **mal**: debe decir **`5000` = `$50.00`**.
> Si no se corrige, el próximo que lo lea muestra $50 como $0.50.

Detalle completo de búsqueda y filtros → [`busqueda-y-filtros.md`](./busqueda-y-filtros.md)

---

# 🔴 Bloqueantes — necesito esto antes del día 3

## A. El calendario (la más urgente)

1. 🔴 ⭐ **¿Cómo viene la disponibilidad en `GET /items/{id}`?** Sin esto no puedo pintar el calendario, y el invitado también lo ve.
   - ¿Fechas **ocupadas** o **libres**?
   - ¿Rangos `[{ "start": "...", "end": "..." }]` o fechas sueltas?
   - ¿Hasta qué fecha en el futuro?
   - ¿Incluye reservas en estado *solicitada* (pendientes) o solo *aprobada/entregada*?

## B. Máquina de estados

2. 🔴 ⭐ Necesito el **diagrama definitivo**. ¿Todos los estados, y qué transición dispara el **arrendatario** vs el **dueño**?
   - Entiendo que yo (arrendatario) solo puedo: cancelar, check-in, check-out, reportar. ¿Correcto?
   - ¿Cuáles son estados terminales?
   - *Esto define directamente qué botones muestro en cada pantalla.*

## C. Convenciones del contrato

3. 🔴 ¿Los campos del JSON van en `snake_case` (`price_per_day`, `photo_url`) o `camelCase`?
4. 🔴 ¿Formato de fechas? ¿`date` = `YYYY-MM-DD` y `timestamp` = ISO 8601 con zona? ¿UTC o local? — clave para el calendario.
5. 🔴 ¿Formato de **errores**? Ya tenemos un código (`CANNOT_RENT_OWN_ITEM`), pero necesito la **estructura general** — ej. `{ "error": { "code": "...", "message": "..." } }` — y códigos estables para: fechas no disponibles, sesión expirada, no autorizado.

## D. Auth

6. 🔴 El login, ¿devuelve **access + refresh token**? ¿Duración de cada uno?
7. 🔴 ¿Mando el token como `Authorization: Bearer <token>`? (confirmar)
8. 🔴 ¿Hay endpoint de **refresh**? ¿Cómo renuevo el access sin desloguear al usuario?

## E. Cabos sueltos de la búsqueda

9. 🔴 `GET /items` — ¿qué campos **exactos** trae cada item? (necesito al menos: `id`, `name`, `photo_url`, `category`, `price_per_day`, `owner_id`)
10. 🔴 **¿Cómo sé que no hay más páginas?** ¿`total`, `has_more`, o asumo que una página con menos de 20 items es la última? — lo necesito para frenar el scroll infinito.
11. 🔴 ¿`min_price`/`max_price` son **inclusivos**? ¿Puedo mandar **solo uno** de los dos? (lo necesito para los chips `< $10` y `> $30`)
12. 🔴 ¿`category` acepta **una sola** o **varias** a la vez (`?category=herramientas,camping`)? Cambia si mis chips son de selección única o múltiple.

## F. Reservas

13. 🔴 `POST /items/{id}/reservations` — ¿qué mando? (asumo `start_date`, `end_date`). ¿Qué devuelve? ¿La reserva con `status: "solicitada"` y el `deposit_amount` ya calculado?
14. 🔴 ¿Qué error/código devuelve si las fechas **chocan** (doble reserva)? Para mostrar "esas fechas ya no están disponibles".
15. 🔴 **Idempotencia:** si el usuario toca "Solicitar" dos veces (doble tap / reintento por red), ¿cómo evito crear dos reservas? ¿Header `Idempotency-Key`?
16. 🔴 `GET /users/me/reservations` — ¿qué devuelve? ¿Puedo filtrar por estado?
17. 🔴 Para el **polling**: ¿cuál es el endpoint del estado de UNA reserva? (¿`GET /reservations/{id}`?)

---

# 🟡 Importante (semanas 2–3)

18. 🟡 ¿`deposit_amount` y el `amount` de las transacciones usan la misma unidad (USD centavos)? Asumo que sí.
19. 🟡 El **precio total** (`price_per_day × días`) y el `deposit_amount`, ¿los calcula el backend o yo?
20. 🟡 ¿Hay `updated_at` en la reserva para saber si cambió sin re-descargar? ¿Cada cuánto es razonable hacer polling?
21. 🟡 `PATCH /reservations/{id}/cancel` — ¿en qué estados puedo cancelar? ¿Qué pasa con el depósito?
22. 🟡 ¿Qué pasa si toco una reserva que **no es mía**? ¿`403`?
23. 🟡 El registro, ¿auto-loguea (devuelve token) o hay que llamar a login después?
24. 🟡 ¿Qué validaciones de email/contraseña aplica el backend, para reflejarlas en mi formulario?
25. 🟡 ¿Cuál es la lista **cerrada** de categorías válidas? ¿Puede crecer?
26. 🟡 `POST /reservations/{id}/checkin` y `/checkout` — ¿qué mando? (¿`photo_url` + `notes`?) ¿En qué estado debe estar la reserva?
27. 🟡 `POST /reservations/{id}/report` — ¿qué mando? ¿Congela el depósito (transacción `FREEZE`)? ¿En qué estados se puede?
28. 🟡 La foto de evidencia, ¿usa el mismo flujo de URL prefirmada que la foto del item? (lo coordino con Wa, pero necesito saber qué `photo_url` esperás)

---

# 🟢 Puede esperar

29. 🟢 ¿Cómo obtengo el **nombre del dueño** para el detalle? ¿Viene embebido o pido otro endpoint?
30. 🟢 `GET /reservations/{id}/transactions` — ¿cómo sé el **estado actual** del depósito: el último registro o un campo calculado?
31. 🟢 ¿Hay versionado del contrato (`/v1/...`)?

---

## Lo que MÁS urge

1. **Formato de la disponibilidad** (Q1) — sin esto no hay calendario.
2. **Máquina de estados definitiva** (Q2) — sin esto no sé qué botones mostrar.
3. **Formato de errores + códigos estables** (Q5) — sin esto todos los errores se ven igual.
4. **Auth: refresh token** (Q6–Q8) — sin esto la sesión se cae a los 15 min.
5. **Cabos sueltos de la búsqueda** (Q9–Q12) — son 4 respuestas cortas que me desbloquean la pantalla entera.
