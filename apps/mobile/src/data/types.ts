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
