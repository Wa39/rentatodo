import type { UnavailableRange } from '@/data/types';

/**
 * Date helpers for the reservation flow. All dates are ISO yyyy-mm-dd
 * strings (the contract's `format: date`), which also compare correctly
 * as plain strings.
 */

/** Today as ISO yyyy-mm-dd in the device's local time. */
export function todayIso(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Every ISO date from start to end, both inclusive. */
export function eachDayInclusive(start: string, end: string): string[] {
  const days: string[] = [];
  const last = new Date(end + 'T00:00:00');
  for (let d = new Date(start + 'T00:00:00'); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }
  return days;
}

/** Number of days from start to end, both inclusive (contract counting). */
export function countDaysInclusive(start: string, end: string): number {
  const ms = new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Expands the contract's unavailable_dates ranges into a Set of ISO dates,
 * which is what the calendar paints day by day.
 */
export function expandRanges(ranges: UnavailableRange[]): Set<string> {
  const dates = new Set<string>();
  for (const r of ranges) {
    for (const day of eachDayInclusive(r.start_date, r.end_date)) dates.add(day);
  }
  return dates;
}

/** True if any day of [start, end] is in the unavailable set. */
export function rangeHasUnavailable(start: string, end: string, unavailable: Set<string>): boolean {
  return eachDayInclusive(start, end).some((day) => unavailable.has(day));
}
