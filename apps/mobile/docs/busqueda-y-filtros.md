# Búsqueda y filtros — especificación

> **Alcance:** pantalla de búsqueda y detalle de artículo de la app móvil (Zero).
> **Estado:** acordado con Trucy (2026-07-09). Listo para construir contra esto.

---

## 1. El endpoint

```
GET /items          ← público, no requiere sesión
GET /items/{id}     ← público, no requiere sesión
```

**La respuesta es idéntica con o sin token.** El servidor no personaliza el catálogo.

## 2. Parámetros

| Parámetro | Valor | UI en la app |
|---|---|---|
| `category` | `herramientas` · `fotografia` · `camping` · `deportes` · `electronica` · `hogar` | Chips |
| `q` | Texto libre | Barra de búsqueda (debounce 300 ms) |
| `min_price` | Centavos USD (integer) | Chips de rango |
| `max_price` | Centavos USD (integer) | Chips de rango |
| `page` | `1`, `2`, `3`… | Scroll infinito |
| `limit` | `20` | — |

**Llamada completa:**

```
GET /items?category=herramientas&q=taladro&min_price=1000&max_price=3000&page=1&limit=20
```

## 3. Comportamiento del `q`

- Busca en **`name` Y `description`**
- **Ignora mayúsculas** ("Taladro" = "taladro")
- **Ignora acentos** ("camara" encuentra "cámara")
- **Coincidencia parcial** ("tala" encuentra "taladro")
- Se combina con los demás filtros (AND)

## 4. Dinero — USD, centavos, integer

`price_per_day: 5000` significa **$50.00**. El frontend **divide entre 100** para mostrar.

> ⚠️ La tabla `ITEMS` del modelo de datos todavía dice *"5000 = ₡5.000"*. **Está desactualizada**
> y hay que corregirla, o el próximo que la lea muestra $50 como $0.50.

**Chips de precio** (los valores viajan en centavos):

| Chip | Manda |
|---|---|
| `< $10 / día` | `max_price=1000` |
| `$10 – $30 / día` | `min_price=1000&max_price=3000` |
| `> $30 / día` | `min_price=3000` |

Se usan chips en vez de un slider de doble perilla: es más barato de construir, más cómodo con el dedo, y no necesito preguntarle al backend cuál es el artículo más caro del catálogo para pintar la barra.

## 5. Reglas del servidor (automáticas, no son botones)

- ✅ Excluye siempre los items inactivos (`is_active = false` — soft delete)
- ❌ **NO** excluye tus propios artículos → aparecen en la búsqueda como cualquier otro

## 6. Invitado vs. sesión iniciada

El catálogo es **navegable sin login**. Un invitado puede:

- Ver el listado y buscar/filtrar
- Ver el detalle de un artículo
- **Ver el calendario de disponibilidad**

Lo que **no** puede: solicitar un alquiler (eso requiere sesión).

### Los 3 estados del botón "Solicitar"

| Situación | Qué muestra la app |
|---|---|
| **Invitado** (sin sesión) | *"Iniciá sesión para alquilar"* → lleva al login |
| **Con sesión, artículo ajeno** | *"Solicitar alquiler"* → flujo normal de reserva |
| **Con sesión, artículo propio** (`owner_id == mi id`) | Botón **desactivado** + *"No podés alquilar este artículo porque te pertenece"* |

**Cómo detecto que es mío:** el item devuelve `owner_id`; lo comparo con el id del usuario logueado. La comparación es del lado del cliente (el endpoint es público y no personaliza nada).

**Red de seguridad del backend:** si igual intento reservar mi propio artículo, `POST /items/{id}/reservations` responde **`403` + código `CANNOT_RENT_OWN_ITEM`**. Desactivar un botón es UX, no seguridad.

### Después del login, volver al artículo

Si un invitado toca "Iniciá sesión para alquilar" desde el detalle de un taladro, al terminar el login **debe volver al detalle de ese taladro** — no al home. Si aterriza en el home, pierde lo que le interesaba y probablemente abandona.

---

## 7. Todavía abierto

- **¿Cómo sé que no hay más páginas?** ¿Un `total`, un `has_more`, o asumo que una página con menos de 20 items es la última?
- **¿`category` acepta varias a la vez?** (`?category=herramientas,camping`) — cambia si los chips son de selección única o múltiple.
- **¿`min_price`/`max_price` son inclusivos?** ¿Puedo mandar solo uno de los dos? (lo necesito para los chips `< $10` y `> $30`)
- **Campos exactos** que devuelve cada item del listado.
