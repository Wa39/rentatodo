import type { DateRangeState } from './types'

export interface CalendarDay {
  date: Date
  inCurrentMonth: boolean
  isToday: boolean
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function getMonthGridDays(monthStart: Date, today: Date = new Date()): CalendarDay[] {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: CalendarDay[] = []

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i)
    cells.push({ date, inCurrentMonth: false, isToday: isSameDay(date, today) })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({ date, inCurrentMonth: true, isToday: isSameDay(date, today) })
  }

  const remainder = cells.length % 7
  const trailingCount = remainder === 0 ? 0 : 7 - remainder
  for (let d = 1; d <= trailingCount; d++) {
    const date = new Date(year, month + 1, d)
    cells.push({ date, inCurrentMonth: false, isToday: isSameDay(date, today) })
  }

  return cells
}

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDateState(dateStr: string, dateRanges: DateRangeState[]): 'available' | 'pending' | 'reserved' {
  const reserved = dateRanges.some((r) => r.state === 'reserved' && dateStr >= r.start_date && dateStr <= r.end_date)
  if (reserved) return 'reserved'
  const pending = dateRanges.some((r) => r.state === 'pending' && dateStr >= r.start_date && dateStr <= r.end_date)
  if (pending) return 'pending'
  return 'available'
}
