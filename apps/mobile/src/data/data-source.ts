import { ApiDataSource } from '@/data/api/api-data-source';
import { getApiUrl } from '@/data/api/http';
import { MockDataSource } from '@/data/mock-data-source';
import type { Item, ItemDetail, Reservation } from '@/data/types';

/**
 * App data layer, shaped like the frozen contract (packages/contracts/openapi.yaml):
 * GET /items?sort=popular|recent&q=...&category=...  ·  GET /items/{id}
 * GET /users/me/reservations
 *
 * Two implementations, same interface, so the screens never change:
 * - ApiDataSource when EXPO_PUBLIC_API_URL is set (real backend).
 * - MockDataSource otherwise (demo mode, local data).
 */
export interface DataSource {
  listItems(sort: 'popular' | 'recent'): Promise<Item[]>;
  searchItems(q: string, category?: string): Promise<Item[]>;
  getItem(id: string): Promise<ItemDetail | undefined>;
  listReservations(): Promise<Reservation[]>;
  /** POST /items/{item_id}/reservations — dates inclusive, today or future. */
  createReservation(itemId: string, startDate: string, endDate: string): Promise<Reservation>;
  /** PATCH /reservations/{id}/cancel — renter only; requested|approved → cancelled. */
  cancelReservation(reservationId: string): Promise<Reservation>;
  /** POST /reservations/{id}/checkin — renter only; approved → delivered. Photo required. */
  checkInReservation(reservationId: string, photoUrl: string, notes?: string): Promise<Reservation>;
  /** POST /reservations/{id}/checkout — renter only; delivered → returned. Photo required. */
  checkOutReservation(reservationId: string, photoUrl: string, notes?: string): Promise<Reservation>;
}

export const dataSource: DataSource = getApiUrl() ? new ApiDataSource() : new MockDataSource();
