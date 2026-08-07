import { getDateState, getMonthGridDays, toDateOnlyString } from '@/lib/calendar'
import { useTranslation } from '@/lib/i18n'
import type { DateRangeState } from '@/lib/types'

export function CalendarMonth({
  monthStart,
  dateRanges,
}: {
  monthStart: Date
  dateRanges: DateRangeState[]
}) {
  const t = useTranslation()
  const days = getMonthGridDays(monthStart)
  const label = `${t.calendar.months[monthStart.getMonth()]} ${monthStart.getFullYear()}`

  return (
    <div>
      <div className="mb-two font-display text-base font-bold text-foreground">{label}</div>
      <div className="mb-two grid grid-cols-7 text-xs font-semibold uppercase text-info">
        {t.calendar.weekdays.map((weekday, index) => (
          <div key={index} className="p-half text-center">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = toDateOnlyString(day.date)
          const state = day.inCurrentMonth ? getDateState(dateStr, dateRanges) : 'available'
          return (
            <div
              key={dateStr}
              className={`relative flex aspect-square items-center justify-center rounded-md text-sm font-medium ${
                !day.inCurrentMonth
                  ? 'text-muted-foreground opacity-30'
                  : state === 'reserved'
                    ? 'bg-destructive font-bold text-destructive-foreground'
                    : state === 'pending'
                      ? 'bg-warning font-bold text-warning-ink'
                      : 'bg-muted text-info'
              }`}
            >
              {day.date.getDate()}
              {day.isToday && (
                <span
                  data-testid="today-dot"
                  aria-hidden="true"
                  className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
