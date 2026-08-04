# Search and filters — specification

> **Scope:** the search screen and item detail of the mobile app (Zero).
> **Status:** agreed with Trucy (2026-07-09); the app is built against this.

---

## 1. The endpoint

```
GET /items          ← public, no session required
GET /items/{id}     ← public, no session required
```

**The response is identical with or without a token.** The server does not personalize the catalog.

## 2. Parameters

| Parameter | Value | UI in the app |
|---|---|---|
| `category` | `tools` · `photography` · `camping` · `sports` · `electronics` · `home` · `other` | Chips |
| `q` | Free text | Search bar (300 ms debounce) |
| `min_price` | USD cents (integer) | Range chips |
| `max_price` | USD cents (integer) | Range chips |
| `page` | `1`, `2`, `3`… | Infinite scroll |
| `limit` | `20` | — |

**Full call:**

```
GET /items?category=tools&q=drill&min_price=1000&max_price=3000&page=1&limit=20
```

## 3. `q` behavior

- Searches in **`name` AND `description`**
- **Case-insensitive** ("Drill" = "drill")
- **Accent-insensitive** ("camara" matches "cámara")
- **Partial match** ("dri" matches "drill")
- Combined with the other filters (AND)

## 4. Money — USD, cents, integer

`price_per_day: 5000` means **$50.00**. The frontend **divides by 100** to display it.

**Price chips** (values travel in cents):

| Chip | Sends |
|---|---|
| `< $10 / day` | `max_price=1000` |
| `$10 – $30 / day` | `min_price=1000&max_price=3000` |
| `> $30 / day` | `min_price=3000` |

Chips are used instead of a two-handle slider: cheaper to build, more comfortable with a finger, and it avoids having to ask the backend for the most expensive item in the catalog to draw the track.

## 5. Server rules (automatic, not buttons)

- ✅ Always excludes inactive items (`is_active = false` — soft delete)
- ❌ Does **NOT** exclude your own items → they appear in search like any other

## 6. Guest vs. signed in

The catalog is **browsable without login**. A guest can:

- See the listing and search/filter
- See an item's detail
- **See the availability calendar**

What a guest **cannot** do: request a rental (that requires a session).

### The 3 states of the "Request" button

| Situation | What the app shows |
|---|---|
| **Guest** (no session) | *"Sign in to rent"* → goes to login |
| **Signed in, someone else's item** | *"Request rental"* → normal reservation flow |
| **Signed in, own item** (`owner_id == my id`) | Button **disabled** + *"You cannot rent this item because it belongs to you"* |

**How ownership is detected:** the item returns `owner_id`; it is compared with the signed-in user's id. The comparison is client-side (the endpoint is public and personalizes nothing).

**Backend safety net:** if a reservation on one's own item is attempted anyway, `POST /items/{id}/reservations` responds **`403` + code `CANNOT_RENT_OWN_ITEM`**. Disabling a button is UX, not security.

### After login, return to the item

If a guest taps "Sign in to rent" from a drill's detail, after login they **must return to that drill's detail** — not the home screen. Landing on home loses what they cared about and they likely bounce.

---

## 7. Resolved after this draft

The open questions from the original draft were closed with Trucy (2026-07-14) and are now part of the frozen contract:

- **Pagination:** the list response carries `page`, `limit`, and `total`.
- **`category`:** single selection (chips are single-select).
- **`min_price`/`max_price`:** inclusive, and either one can be sent on its own.
- **Item fields:** defined by `ItemResponse` in `packages/contracts/openapi.yaml`.
