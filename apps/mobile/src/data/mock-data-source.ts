import { ApiRequestError } from '@/data/api/http';
import type { DataSource } from '@/data/data-source';
import type { Item, ItemDetail, Report, Reservation } from '@/data/types';
import { countDaysInclusive, expandRanges, rangeHasUnavailable } from '@/utils/dates';

/**
 * Local mock shaped exactly like the frozen contract. Keeps the app fully
 * usable in demo mode (EXPO_PUBLIC_API_URL not set): screens, navigation
 * and states work without a backend.
 */

/** The signed-in demo renter (owner of no items, per the mock catalog). */
const MOCK_RENTER_ID = 'u1';

const base = { is_active: true, created_at: '2026-07-01T12:00:00Z' };

const ITEMS: ItemDetail[] = [
  {
    ...base, id: 'a1', name: 'Taladro inalámbrico', description: 'Taladro 18V con maletín y brocas',
    category: 'tools', price_per_day: 1200, photo_url: '', owner_id: 'u2', owner_name: 'María V.',
    unavailable_dates: [{ start_date: '2026-07-04', end_date: '2026-07-05' }, { start_date: '2026-07-20', end_date: '2026-07-21' }],
  },
  {
    ...base, id: 'a2', name: 'Cámara réflex + lente 50 mm', description: 'Réflex con lente fijo, ideal retratos',
    category: 'photography', price_per_day: 3500, photo_url: '', owner_id: 'u3', owner_name: 'Carlos M.',
    unavailable_dates: [{ start_date: '2026-07-10', end_date: '2026-07-11' }, { start_date: '2026-07-22', end_date: '2026-07-22' }],
  },
  {
    ...base, id: 'a3', name: 'Carpa camping 4 personas', description: 'Carpa impermeable con bolso de transporte',
    category: 'camping', price_per_day: 1800, photo_url: '', owner_id: 'u2', owner_name: 'María V.',
    unavailable_dates: [{ start_date: '2026-07-08', end_date: '2026-07-10' }],
  },
  {
    ...base, id: 'a4', name: 'Parlante Bluetooth', description: 'Parlante portátil resistente al agua',
    category: 'electronics', price_per_day: 800, photo_url: '', owner_id: 'u4', owner_name: 'Ana S.',
    unavailable_dates: [{ start_date: '2026-07-18', end_date: '2026-07-18' }],
  },
  {
    ...base, id: 'a5', name: 'Bicicleta urbana', description: 'Bicicleta aro 28 con canasta y luces',
    category: 'sports', price_per_day: 1500, photo_url: '', owner_id: 'u3', owner_name: 'Carlos M.',
    unavailable_dates: [{ start_date: '2026-07-25', end_date: '2026-07-26' }],
  },
  {
    ...base, id: 'a6', name: 'Proyector portátil', description: 'Proyector HD con HDMI y bolso',
    category: 'electronics', price_per_day: 2500, photo_url: '', owner_id: 'u4', owner_name: 'Ana S.',
    unavailable_dates: [],
  },
];

const RESERVATIONS: Reservation[] = [
  {
    id: 'r1', item_id: 'a1', item_name: 'Taladro inalámbrico', item_photo_url: '',
    renter_id: 'u1', renter_name: 'Zero', start_date: '2026-07-12', end_date: '2026-07-14',
    status: 'requested', deposit_amount: 3600, deposit_status: 'none',
    created_at: '2026-07-11T09:14:00Z', updated_at: '2026-07-11T09:14:00Z',
  },
  {
    id: 'r2', item_id: 'a2', item_name: 'Cámara réflex + lente 50 mm', item_photo_url: '',
    renter_id: 'u1', renter_name: 'Zero', start_date: '2026-07-15', end_date: '2026-07-17',
    status: 'approved', deposit_amount: 10500, deposit_status: 'held',
    created_at: '2026-07-10T15:02:00Z', updated_at: '2026-07-11T10:00:00Z',
  },
  {
    id: 'r3', item_id: 'a3', item_name: 'Carpa camping 4 personas', item_photo_url: '',
    renter_id: 'u1', renter_name: 'Zero', start_date: '2026-07-08', end_date: '2026-07-10',
    status: 'delivered', deposit_amount: 5400, deposit_status: 'held',
    created_at: '2026-07-07T09:00:00Z', updated_at: '2026-07-08T10:30:00Z',
  },
  {
    id: 'r4', item_id: 'a4', item_name: 'Parlante Bluetooth', item_photo_url: '',
    renter_id: 'u1', renter_name: 'Zero', start_date: '2026-07-05', end_date: '2026-07-06',
    status: 'returned', deposit_amount: 1600, deposit_status: 'held',
    created_at: '2026-07-04T09:00:00Z', updated_at: '2026-07-06T18:00:00Z',
  },
  {
    id: 'r5', item_id: 'a5', item_name: 'Bicicleta urbana', item_photo_url: '',
    renter_id: 'u1', renter_name: 'Zero', start_date: '2026-06-28', end_date: '2026-06-30',
    status: 'closed', deposit_amount: 4500, deposit_status: 'released',
    created_at: '2026-06-27T09:00:00Z', updated_at: '2026-07-01T09:00:00Z',
  },
  {
    id: 'r6', item_id: 'a6', item_name: 'Proyector portátil', item_photo_url: '',
    renter_id: 'u1', renter_name: 'Zero', start_date: '2026-06-25', end_date: '2026-06-25',
    status: 'rejected', deposit_amount: 2500, deposit_status: 'none',
    created_at: '2026-06-24T09:00:00Z', updated_at: '2026-06-24T15:00:00Z',
  },
];

/** Normalizes for search: lowercase, no accents (contract behavior). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export class MockDataSource implements DataSource {
  async listItems(sort: 'popular' | 'recent'): Promise<Item[]> {
    // The contract defines ?sort=popular|recent (default recent): ordering is API-side.
    return sort === 'popular' ? [...ITEMS] : [...ITEMS].reverse();
  }

  async searchItems(q: string, category?: string): Promise<Item[]> {
    // The contract searches name AND description, combining filters with AND.
    const t = normalize(q.trim());
    return ITEMS.filter(
      (a) =>
        (t === '' || normalize(a.name).includes(t) || normalize(a.description).includes(t)) &&
        (!category || a.category === category),
    );
  }

  async getItem(id: string): Promise<ItemDetail | undefined> {
    return ITEMS.find((a) => a.id === id);
  }

  async listReservations(): Promise<Reservation[]> {
    return [...RESERVATIONS];
  }

  /**
   * Mirrors the contract's POST /items/{item_id}/reservations, including
   * its error codes, so the whole flow is demonstrable without a backend.
   */
  async createReservation(itemId: string, startDate: string, endDate: string): Promise<Reservation> {
    const item = ITEMS.find((a) => a.id === itemId);
    if (!item) {
      throw new ApiRequestError(404, 'NOT_FOUND', 'Item not found or inactive');
    }
    if (item.owner_id === MOCK_RENTER_ID) {
      throw new ApiRequestError(403, 'CANNOT_RENT_OWN_ITEM', 'You cannot rent your own item');
    }
    const duplicate = RESERVATIONS.some(
      (r) =>
        r.item_id === itemId &&
        r.start_date === startDate &&
        r.end_date === endDate &&
        r.status === 'requested',
    );
    if (duplicate) {
      throw new ApiRequestError(409, 'DUPLICATE_RESERVATION', 'Identical reservation already requested');
    }
    if (rangeHasUnavailable(startDate, endDate, expandRanges(item.unavailable_dates))) {
      throw new ApiRequestError(409, 'DATES_UNAVAILABLE', 'Dates overlap an active reservation');
    }

    const now = new Date().toISOString();
    const reservation: Reservation = {
      id: `r-${Date.now()}`,
      item_id: item.id,
      item_name: item.name,
      item_photo_url: item.photo_url,
      renter_id: MOCK_RENTER_ID,
      renter_name: 'Zero',
      start_date: startDate,
      end_date: endDate,
      status: 'requested',
      // Contract: deposit_amount = price_per_day × number of days (backend-calculated).
      deposit_amount: item.price_per_day * countDaysInclusive(startDate, endDate),
      deposit_status: 'none',
      created_at: now,
      updated_at: now,
    };
    RESERVATIONS.unshift(reservation);
    // Requested reservations already block the dates (contract behavior).
    item.unavailable_dates.push({ start_date: startDate, end_date: endDate });
    return { ...reservation };
  }

  /**
   * Mirrors PATCH /reservations/{id}/cancel: renter only, transitions
   * requested|approved → cancelled, releases the deposit if it was held.
   */
  async cancelReservation(reservationId: string): Promise<Reservation> {
    const reservation = RESERVATIONS.find((r) => r.id === reservationId);
    if (!reservation) {
      throw new ApiRequestError(404, 'NOT_FOUND', 'Reservation not found');
    }
    if (reservation.status !== 'requested' && reservation.status !== 'approved') {
      throw new ApiRequestError(
        409,
        'INVALID_TRANSITION',
        `Cannot cancel a reservation in status ${reservation.status}`,
      );
    }
    reservation.status = 'cancelled';
    if (reservation.deposit_status === 'held') reservation.deposit_status = 'released';
    reservation.updated_at = new Date().toISOString();
    // Cancelled reservations no longer block the item's dates.
    const item = ITEMS.find((a) => a.id === reservation.item_id);
    if (item) {
      item.unavailable_dates = item.unavailable_dates.filter(
        (r) => !(r.start_date === reservation.start_date && r.end_date === reservation.end_date),
      );
    }
    return { ...reservation };
  }

  // One report per reservation (contract rule), tracked for REPORT_EXISTS.
  private reportedReservations = new Set<string>();

  /**
   * Mirrors POST /reservations/{id}/report: only from delivered|returned,
   * one per reservation, freezes the deposit, status unchanged.
   */
  async reportProblem(reservationId: string, reason: string, photoUrl: string): Promise<Report> {
    const reservation = RESERVATIONS.find((r) => r.id === reservationId);
    if (!reservation) {
      throw new ApiRequestError(404, 'NOT_FOUND', 'Reservation not found');
    }
    if (reservation.status !== 'delivered' && reservation.status !== 'returned') {
      throw new ApiRequestError(
        409,
        'INVALID_TRANSITION',
        'Reports are only allowed from delivered or returned',
      );
    }
    if (this.reportedReservations.has(reservationId)) {
      throw new ApiRequestError(409, 'REPORT_EXISTS', 'This reservation already has a report');
    }
    this.reportedReservations.add(reservationId);
    reservation.deposit_status = 'frozen';
    reservation.updated_at = new Date().toISOString();
    return {
      id: `rep-${Date.now()}`,
      reservation_id: reservationId,
      reported_by: MOCK_RENTER_ID,
      reason,
      photo_url: photoUrl,
      created_at: new Date().toISOString(),
    };
  }

  /** Mirrors POST /reservations/{id}/checkin: approved → delivered. */
  async checkInReservation(reservationId: string): Promise<Reservation> {
    return this.transition(reservationId, 'approved', 'delivered');
  }

  /** Mirrors POST /reservations/{id}/checkout: delivered → returned. */
  async checkOutReservation(reservationId: string): Promise<Reservation> {
    return this.transition(reservationId, 'delivered', 'returned');
  }

  private transition(
    reservationId: string,
    from: Reservation['status'],
    to: Reservation['status'],
  ): Reservation {
    const reservation = RESERVATIONS.find((r) => r.id === reservationId);
    if (!reservation) {
      throw new ApiRequestError(404, 'NOT_FOUND', 'Reservation not found');
    }
    if (reservation.status !== from) {
      throw new ApiRequestError(
        409,
        'INVALID_TRANSITION',
        `Requires status ${from}, current is ${reservation.status}`,
      );
    }
    reservation.status = to;
    reservation.updated_at = new Date().toISOString();
    return { ...reservation };
  }
}
