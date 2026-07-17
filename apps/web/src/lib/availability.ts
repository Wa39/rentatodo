import type { DateRangeState, Reservation } from './types'

const RESERVED_STATUSES = ['approved', 'delivered', 'returned']

export function getItemDateStates(itemId: string, reservations: Reservation[]): DateRangeState[] {
  return reservations
    .filter((r) => r.item_id === itemId)
    .filter((r) => r.status === 'requested' || RESERVED_STATUSES.includes(r.status))
    .map((r) => ({
      start_date: r.start_date,
      end_date: r.end_date,
      state: r.status === 'requested' ? 'pending' : 'reserved',
    }))
}
