import type { Item, ItemDetail, Reservation } from '@/data/types';

/**
 * App data layer, shaped like the frozen contract (packages/contracts/openapi.yaml):
 * GET /items?sort=popular|recent&q=...&category=...  ·  GET /items/{id}
 * GET /users/me/reservations
 *
 * Today the implementation is a local MOCK. The real implementation
 * (API client) fulfills this same interface and the screens stay untouched.
 */
export interface DataSource {
  listItems(sort: 'popular' | 'recent'): Promise<Item[]>;
  searchItems(q: string, category?: string): Promise<Item[]>;
  getItem(id: string): Promise<ItemDetail | undefined>;
  listReservations(): Promise<Reservation[]>;
}

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

class MockDataSource implements DataSource {
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
}

export const dataSource: DataSource = new MockDataSource();
