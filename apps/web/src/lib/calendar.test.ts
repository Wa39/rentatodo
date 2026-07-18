import { describe, expect, it } from 'vitest'
import { getDateState, getMonthGridDays, toDateOnlyString } from './calendar'

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

  it('rolls trailing days from December into January of the next year', () => {
    const december2026 = new Date(2026, 11, 1)
    const days = getMonthGridDays(december2026)
    const trailingDays = days.filter((d) => !d.inCurrentMonth && d.date.getMonth() !== 10)

    expect(trailingDays.length).toBeGreaterThan(0)
    for (const day of trailingDays) {
      expect(day.date.getFullYear()).toBe(2027)
      expect(day.date.getMonth()).toBe(0)
    }
  })

  it('rolls leading days from January into December of the previous year', () => {
    const january2027 = new Date(2027, 0, 1)
    const days = getMonthGridDays(january2027)
    const leadingDays = days.filter((d) => !d.inCurrentMonth && d.date.getMonth() !== 1)

    expect(leadingDays.length).toBeGreaterThan(0)
    for (const day of leadingDays) {
      expect(day.date.getFullYear()).toBe(2026)
      expect(day.date.getMonth()).toBe(11)
    }
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

describe('getDateState', () => {
  const dateRanges = [
    { start_date: '2026-07-18', end_date: '2026-07-20', state: 'reserved' as const },
    { start_date: '2026-07-25', end_date: '2026-07-25', state: 'pending' as const },
  ]

  it('returns reserved for a date inside a reserved range', () => {
    expect(getDateState('2026-07-19', dateRanges)).toBe('reserved')
  })

  it('returns reserved for a range boundary date', () => {
    expect(getDateState('2026-07-18', dateRanges)).toBe('reserved')
    expect(getDateState('2026-07-20', dateRanges)).toBe('reserved')
  })

  it('returns pending for a date inside a pending range', () => {
    expect(getDateState('2026-07-25', dateRanges)).toBe('pending')
  })

  it('returns available for a date outside every range', () => {
    expect(getDateState('2026-07-21', dateRanges)).toBe('available')
  })

  it('prioritizes reserved over pending on an overlapping date', () => {
    const overlapping = [
      { start_date: '2026-08-01', end_date: '2026-08-01', state: 'pending' as const },
      { start_date: '2026-08-01', end_date: '2026-08-01', state: 'reserved' as const },
    ]
    expect(getDateState('2026-08-01', overlapping)).toBe('reserved')
  })
})
