import { describe, expect, it } from 'vitest'
import { getAvailabilityStrip } from './availability'

describe('getAvailabilityStrip', () => {
  it('returns 14 entries by default', () => {
    const strip = getAvailabilityStrip([], new Date(2026, 6, 1))
    expect(strip).toHaveLength(14)
  })

  it('marks days inside an unavailable range as booked', () => {
    const strip = getAvailabilityStrip(
      [{ start_date: '2026-07-03', end_date: '2026-07-04' }],
      new Date(2026, 6, 1),
    )
    expect(strip[0]).toBe('available') // Jul 1
    expect(strip[2]).toBe('booked') // Jul 3
    expect(strip[3]).toBe('booked') // Jul 4
    expect(strip[4]).toBe('available') // Jul 5
  })
})
