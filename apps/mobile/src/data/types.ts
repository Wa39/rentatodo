/**
 * Tipos alineados al BORRADOR del contrato: packages/contracts/openapi.yaml
 * (rama feature/openapi-spec, PR #2 — aún NO aprobado por los consumidores).
 * Si el contrato cambia en revisión, este archivo se ajusta.
 * Cuando el contrato quede congelado, lo ideal es generar estos tipos desde el spec.
 */

export type Category =
  | 'tools'
  | 'photography'
  | 'camping'
  | 'sports'
  | 'electronics'
  | 'home';

export type Item = {
  id: string;
  name: string;
  description: string;
  category: Category;
  /** USD en centavos: 5000 = $50.00. El frontend divide entre 100. */
  price_per_day: number;
  photo_url: string;
  is_active: boolean;
  owner_id: string;
  owner_name: string;
  created_at: string;
};

/** Rango de fechas ya reservadas (formato del contrato: rangos, no fechas sueltas). */
export type UnavailableRange = {
  start_date: string; // date yyyy-mm-dd
  end_date: string;
};

export type ItemDetail = Item & {
  unavailable_dates: UnavailableRange[];
};

export type ReservationStatus =
  | 'requested'
  | 'approved'
  | 'delivered'
  | 'returned'
  | 'closed'
  | 'rejected'
  | 'cancelled';

export type DepositStatus = 'none' | 'held' | 'released' | 'frozen';

export type Reservation = {
  id: string;
  item_id: string;
  item_name: string;
  item_photo_url: string;
  renter_id: string;
  renter_name: string;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  /** USD en centavos. Calculado por el backend: price_per_day × días. */
  deposit_amount: number;
  deposit_status: DepositStatus;
  created_at: string;
  updated_at: string;
};

/** Formatea centavos USD como "$50.00". */
export function formatoUSD(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)}`;
}

/**
 * Códigos de error estables — acordados con Trucy el 14-jul-2026
 * (pendientes de verse reflejados en el spec; ella los pushea al PR #2).
 * La app decide por el `code`, nunca por el texto del mensaje.
 *
 * HTTP → codes: 401 UNAUTHORIZED|TOKEN_EXPIRED · 403 FORBIDDEN|CANNOT_RENT_OWN_ITEM
 * 404 NOT_FOUND · 409 DATES_UNAVAILABLE|INVALID_TRANSITION|DUPLICATE_RESERVATION|
 * FREEZE_ACTIVE|REPORT_EXISTS · 422 VALIDATION_ERROR
 */
export type ApiErrorCode =
  | 'CANNOT_RENT_OWN_ITEM'
  | 'DATES_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_RESERVATION'
  | 'REPORT_EXISTS'
  | 'FREEZE_ACTIVE'
  | 'VALIDATION_ERROR';

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

/**
 * Otras decisiones cerradas con Trucy (14-jul-2026):
 * - Token: 24 h sin refresh (expires_in: 86400).
 * - Doble solicitud: mismo renter+item+fechas en `requested` → 409 DUPLICATE_RESERVATION (sin header extra).
 * - `category`: selección ÚNICA. `min_price`/`max_price`: inclusivos, se puede mandar solo uno.
 * - Polling: cada 15 s con la pantalla abierta.
 */
