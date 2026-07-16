import { describe, expect, it } from 'vitest'
import { getMonthGridDays, isDateBooked, toDateOnlyString } from './calendar'

describe('getMonthGridDays', () => {
  it('returns a grid padded to complete weeks, with July 2026 starting on Wednesday (3 leading June days)', () => {
    const july2026 = new Date(2026, 6, 1)
    const days = getMonthGridDays(july2026)

    expect(days.length % 7).toBe(0)
    expect(days[0].date.getMonth()).toBe(5) // June
    expect(days[0].date.getDate()).toBe(28)
    expect(days[0].inCurrentMonth).toBe(false)
    expect(days[3].date.getMonth()).toBe(6) // July
    expect(days[3].date.getDate()).toBe(1)
    expect(days[3].inCurrentMonth).toBe(true)
  })

  it('marks the matching date as today', () => {
    const july2026 = new Date(2026, 6, 1)
    const today = new Date(2026, 6, 14)
    const days = getMonthGridDays(july2026, today)
    const day14 = days.find((d) => d.inCurrentMonth && d.date.getDate() === 14)
    expect(day14?.isToday).toBe(true)
  })
})

describe('toDateOnlyString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateOnlyString(new Date(2026, 6, 5))).toBe('2026-07-05')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toDateOnlyString(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('isDateBooked', () => {
  const ranges = [
    { start_date: '2026-07-18', end_date: '2026-07-20' },
    { start_date: '2026-07-25', end_date: '2026-07-27' },
  ]

  it('returns true for a date inside a range', () => {
    expect(isDateBooked('2026-07-19', ranges)).toBe(true)
  })

  it('returns true for a range boundary date', () => {
    expect(isDateBooked('2026-07-18', ranges)).toBe(true)
    expect(isDateBooked('2026-07-27', ranges)).toBe(true)
  })

  it('returns false for a date outside every range', () => {
    expect(isDateBooked('2026-07-21', ranges)).toBe(false)
  })
})
