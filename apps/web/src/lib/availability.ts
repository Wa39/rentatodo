import { getDateState, toDateOnlyString } from './calendar'
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
