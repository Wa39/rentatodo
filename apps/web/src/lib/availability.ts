import { isDateBooked, toDateOnlyString } from './calendar'
import type { UnavailableRange } from './types'

export type AvailabilityDay = 'available' | 'booked'

export function getAvailabilityStrip(
  unavailableDates: UnavailableRange[],
  referenceDate: Date = new Date(),
  days = 14,
): AvailabilityDay[] {
  const strip: AvailabilityDay[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + i)
    strip.push(isDateBooked(toDateOnlyString(date), unavailableDates) ? 'booked' : 'available')
  }
  return strip
}
