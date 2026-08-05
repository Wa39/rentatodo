import type { EarningsByItem, EarningsByMonth } from './types'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function yearMonthIndex(dateStr: string): number {
  const [year, month] = dateStr.split('-').map(Number)
  return year * 12 + (month - 1)
}

export function deriveByMonth(byItem: EarningsByItem[], monthsBack = 6, now: Date = new Date()): EarningsByMonth[] {
  const currentIndex = now.getFullYear() * 12 + now.getMonth()
  const oldestIndex = currentIndex - (monthsBack - 1)
  const buckets: EarningsByMonth[] = []
  for (let index = oldestIndex; index <= currentIndex; index++) {
    buckets.push({ month: MONTH_LABELS[((index % 12) + 12) % 12], total: 0 })
  }

  for (const item of byItem) {
    for (const rental of item.rentals) {
      const rentalIndex = yearMonthIndex(rental.end_date)
      const offset = rentalIndex - oldestIndex
      if (offset < 0 || offset >= monthsBack) continue
      buckets[offset].total += rental.amount
    }
  }

  return buckets
}
