# Mobile testIDs

Stable selectors for the Maestro flows. Prefer these over visible copy:
Spanish wording can change without breaking a test, a `testID` cannot.

Usage in a flow:

```yaml
- tapOn:
    id: "login-submit"
- inputText:
    text: "renter@rentatodo.dev"
```

## Tab bar

| testID | Element |
|---|---|
| `tab-home` | "Inicio" tab button |
| `tab-rentals` | "Mis rentas" tab button |
| `tab-profile` | "Perfil" tab button |

## Login (`/login`)

| testID | Element |
|---|---|
| `login-email` | Email field |
| `login-password` | Password field |
| `login-submit` | Submit button |
| `login-error` | Inline error message (only rendered on failure) |
| `login-to-register` | Link to the register screen |

## Register (`/register`)

| testID | Element |
|---|---|
| `register-name` | Name field |
| `register-email` | Email field |
| `register-password` | Password field |
| `register-submit` | Submit button |
| `register-error` | Inline error message |
| `register-to-login` | Link back to login |

## Home (`/`)

| testID | Element |
|---|---|
| `home-search` | Search field |
| `home-sort-popular` | "Populares" toggle |
| `home-sort-recent` | "Publicados recientemente" toggle |
| `item-card-<itemId>` | Item card in the catalog rail |

## Item detail (`/item/[id]`)

| testID | Element |
|---|---|
| `item-request-submit` | "Solicitar alquiler" (enabled once a date range is picked) |

## My rentals (`/rentals`)

| testID | Element |
|---|---|
| `rentals-tab-active` | "Activas" tab |
| `rentals-tab-past` | "Pasadas" tab |
| `reservation-row-<reservationId>` | Reservation row (also used on Home) |

## Reservation detail (`/reservation/[id]`)

Buttons are state-dependent — only the ones the contract allows are rendered:

| testID | Element | Visible when |
|---|---|---|
| `reservation-detail-title` | "Reserva" screen heading | always |
| `reservation-item-link` | "Ver artículo" link row | always |
| `reservation-checkin` | "Recibí el artículo" | status `approved` |
| `reservation-checkout` | "Devolver el artículo" | status `delivered` |
| `reservation-report` | "Reportar problema" | status `delivered`/`returned`, deposit not frozen |
| `reservation-cancel` | "Cancelar reserva" | status `requested`/`approved` |
| `reservation-cancel-dialog` | Inline confirmation box | after tapping cancel |
| `reservation-cancel-dismiss` | "Volver" button in confirmation | after tapping cancel |
| `reservation-cancel-confirm` | "Sí, cancelar" in the confirmation | after tapping cancel |

## Check-in / check-out (`/check/[id]`)

| testID | Element |
|---|---|
| `check-title` | Screen heading ("Check-in · Recibir artículo" or "Check-out · Devolver artículo") |
| `check-photo-hint` | "Una sola foto como evidencia" placeholder text |
| `check-notes-label` | "Notas sobre el estado (opcional)" label |
| `check-pick-camera` | "Tomar foto" (native only — hidden on web) |
| `check-pick-library` | "Elegir de galería" / "Elegir archivo" |
| `check-submit` | Confirm button (enabled once a photo is picked) |

## Profile (`/profile`)

| testID | Element |
|---|---|
| `profile-payment-method` | "Método de pago" menu row |
| `profile-settings` | "Configuración" menu row |
| `profile-logout` | "Cerrar sesión" pressable row |

## Report a problem (`/report/[id]`)

| testID | Element |
|---|---|
| `report-reason` | Reason field |
| `report-pick-camera` | "Tomar foto" (native only) |
| `report-pick-library` | "Elegir de galería" / "Elegir archivo" |
| `report-submit` | "Enviar reporte" (enabled once reason + photo are set) |

## Notes

- Tab bar buttons use `tabBarButton` in `_layout.tsx` to inject `testID` via a
  `Pressable` wrapper — use `tab-home`, `tab-rentals`, `tab-profile` in flows.
- Rows and cards carry the entity id, so a flow can target a specific seeded
  reservation/item instead of relying on list order.
- Status badge text (Aprobada, Solicitada, Entregada, etc.) and seeded content
  (item names, user names) remain as visible-text assertions — they verify data
  correctness, not just element presence.
