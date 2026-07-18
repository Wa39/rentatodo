import { ApiRequestError, apiFetch } from '@/data/api/http';
import type { DataSource } from '@/data/data-source';
import type { Item, ItemDetail, Reservation } from '@/data/types';

/** Contract ItemListResponse. */
type ItemListResponse = {
  items: Item[];
  page: number;
  limit: number;
  total: number;
};

/** Contract ReservationListResponse. */
type ReservationListResponse = {
  reservations: Reservation[];
  page: number;
  limit: number;
  total: number;
};

/**
 * Real DataSource against the frozen contract:
 * GET /items (public) · GET /items/{id} (public) · GET /users/me/reservations (auth).
 * The screens only consume the arrays for now; pagination metadata is
 * available in the responses when infinite scroll gets built.
 */
export class ApiDataSource implements DataSource {
  async listItems(sort: 'popular' | 'recent'): Promise<Item[]> {
    const data = await apiFetch<ItemListResponse>(`/items?sort=${sort}`);
    return data.items;
  }

  async searchItems(q: string, category?: string): Promise<Item[]> {
    const params = new URLSearchParams();
    const term = q.trim();
    if (term !== '') params.set('q', term);
    if (category) params.set('category', category);
    const query = params.toString();
    const data = await apiFetch<ItemListResponse>(query ? `/items?${query}` : '/items');
    return data.items;
  }

  async getItem(id: string): Promise<ItemDetail | undefined> {
    try {
      return await apiFetch<ItemDetail>(`/items/${id}`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'NOT_FOUND') return undefined;
      throw e;
    }
  }

  async listReservations(): Promise<Reservation[]> {
    const data = await apiFetch<ReservationListResponse>('/users/me/reservations');
    return data.reservations;
  }

  createReservation(itemId: string, startDate: string, endDate: string): Promise<Reservation> {
    return apiFetch<Reservation>(`/items/${itemId}/reservations`, {
      method: 'POST',
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    });
  }

  cancelReservation(reservationId: string): Promise<Reservation> {
    return apiFetch<Reservation>(`/reservations/${reservationId}/cancel`, { method: 'PATCH' });
  }

  checkInReservation(reservationId: string, photoUrl: string, notes?: string): Promise<Reservation> {
    return apiFetch<Reservation>(`/reservations/${reservationId}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ photo_url: photoUrl, ...(notes ? { notes } : {}) }),
    });
  }

  checkOutReservation(reservationId: string, photoUrl: string, notes?: string): Promise<Reservation> {
    return apiFetch<Reservation>(`/reservations/${reservationId}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ photo_url: photoUrl, ...(notes ? { notes } : {}) }),
    });
  }
}
