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
| `reservation-checkin` | "Recibí el artículo" | status `approved` |
| `reservation-checkout` | "Devolver el artículo" | status `delivered` |
| `reservation-report` | "Reportar problema" | status `delivered`/`returned`, deposit not frozen |
| `reservation-cancel` | "Cancelar reserva" | status `requested`/`approved` |
| `reservation-cancel-confirm` | "Sí, cancelar" in the confirmation | after tapping cancel |

## Check-in / check-out (`/check/[id]`)

| testID | Element |
|---|---|
| `check-pick-camera` | "Tomar foto" (native only — hidden on web) |
| `check-pick-library` | "Elegir de galería" / "Elegir archivo" |
| `check-submit` | Confirm button (enabled once a photo is picked) |

## Report a problem (`/report/[id]`)

| testID | Element |
|---|---|
| `report-reason` | Reason field |
| `report-pick-camera` | "Tomar foto" (native only) |
| `report-pick-library` | "Elegir de galería" / "Elegir archivo" |
| `report-submit` | "Enviar reporte" (enabled once reason + photo are set) |

## Notes

- Tab bar labels ("Inicio", "Mis rentas", "Perfil") have no `testID`: they come
  from expo-router's `Tabs` and are stable enough as visible text.
- Rows and cards carry the entity id, so a flow can target a specific seeded
  reservation/item instead of relying on list order.
