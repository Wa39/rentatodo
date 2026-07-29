import { describe, expect, it } from 'vitest'
import { deriveByMonth } from './earningsDerived'
import type { EarningsByItem } from './types'

const NOW = new Date(2026, 6, 27) // July 27, 2026 — JS months are 0-indexed, so 6 = July

describe('deriveByMonth', () => {
  it('returns 6 buckets labeled Feb..Jul, oldest first, when given no rentals', () => {
    const result = deriveByMonth([], 6, NOW)
    expect(result.map((b) => b.month)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'])
    expect(result.every((b) => b.total === 0)).toBe(true)
  })

  it('sums a rental amount into the bucket matching its end_date month', () => {
    const byItem: EarningsByItem[] = [
      {
        item_id: 'i1',
        item_name: 'Taladro',
        total: 3000,
        rentals: [{ start_date: '2026-07-01', end_date: '2026-07-03', amount: 3000 }],
      },
      {
        item_id: 'i2',
        item_name: 'Carpa',
        total: 4000,
        rentals: [{ start_date: '2026-06-10', end_date: '2026-06-12', amount: 4000 }],
      },
    ]
    const result = deriveByMonth(byItem, 6, NOW)
    expect(result.find((b) => b.month === 'Jul')!.total).toBe(3000)
    expect(result.find((b) => b.month === 'Jun')!.total).toBe(4000)
  })

  it('drops rentals older than the trailing window', () => {
    const byItem: EarningsByItem[] = [
      {
        item_id: 'i1',
        item_name: 'Taladro',
        total: 1000,
        rentals: [{ start_date: '2025-01-01', end_date: '2025-01-03', amount: 1000 }],
      },
    ]
    const result = deriveByMonth(byItem, 6, NOW)
    expect(result.reduce((sum, b) => sum + b.total, 0)).toBe(0)
  })

  it('sums multiple rentals in the same month into one bucket', () => {
    const byItem: EarningsByItem[] = [
      {
        item_id: 'i1',
        item_name: 'Taladro',
        total: 5000,
        rentals: [
          { start_date: '2026-07-01', end_date: '2026-07-03', amount: 3000 },
          { start_date: '2026-07-10', end_date: '2026-07-12', amount: 2000 },
        ],
      },
    ]
    const result = deriveByMonth(byItem, 6, NOW)
    expect(result.find((b) => b.month === 'Jul')!.total).toBe(5000)
  })
})
