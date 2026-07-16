import { getMonthGridDays, isDateBooked, toDateOnlyString } from '@/lib/calendar'
import { useTranslation } from '@/lib/i18n'
import type { UnavailableRange } from '@/lib/types'

export function CalendarMonth({
  monthStart,
  unavailableDates,
}: {
  monthStart: Date
  unavailableDates: UnavailableRange[]
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
          const booked = day.inCurrentMonth && isDateBooked(dateStr, unavailableDates)
          return (
            <div
              key={dateStr}
              className={`flex aspect-square items-center justify-center rounded-md text-sm font-medium ${
                !day.inCurrentMonth
                  ? 'text-muted-foreground opacity-30'
                  : booked
                    ? 'bg-destructive font-bold text-destructive-foreground'
                    : 'bg-muted text-info'
              } ${day.isToday ? 'ring-2 ring-inset ring-primary' : ''}`}
            >
              {day.date.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
