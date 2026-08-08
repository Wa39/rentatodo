import { getDateState, toDateOnlyString } from './calendar'
import type { DateRangeState, Reservation, ReservationStatus } from './types'

// "Active" reservations for the dashboard KPI: still open, i.e. not yet
// closed/rejected/cancelled — includes "returned" because the owner still
// has a deposit to release/close, even though the item itself is already
// back (see BLOCKING_STATUSES below for the calendar's narrower concern).
export const RESERVED_STATUSES: ReservationStatus[] = ['approved', 'delivered', 'returned']

// Statuses that physically block an item's calendar. Deliberately excludes
// "returned": once the renter checks out, the item is back with the owner,
// so those dates must free up immediately for a new booking — mirrors
// apps/api's BLOCKING_STATUSES (app/models/reservation.py), which the same
// distinction was fixed in. Derived from RESERVED_STATUSES (rather than a
// second hand-typed array) so the two can never drift apart on any status
// other than "returned" — the exact class of bug this file was fixed for.
const BLOCKING_STATUSES: ReservationStatus[] = RESERVED_STATUSES.filter((s) => s !== 'returned')

export function getItemDateStates(itemId: string, reservations: Reservation[]): DateRangeState[] {
  return reservations
    .filter((r) => r.item_id === itemId)
    .filter((r) => r.status === 'requested' || BLOCKING_STATUSES.includes(r.status))
    .map((r) => ({
      start_date: r.start_date,
      end_date: r.end_date,
      state: r.status === 'requested' ? 'pending' : 'reserved',
    }))
}

export type AvailabilityDay = 'available' | 'pending' | 'reserved'

export function getAvailabilityStrip(
  dateRanges: DateRangeState[],
  referenceDate: Date = new Date(),
  days = 14,
): AvailabilityDay[] {
  const strip: AvailabilityDay[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + i)
    strip.push(getDateState(toDateOnlyString(date), dateRanges))
  }
  return strip
}
