import { getMonthGridDays, isDateBooked, toDateOnlyString } from '@/lib/calendar'
import type { UnavailableRange } from '@/lib/types'

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function CalendarMonth({
  monthStart,
  unavailableDates,
}: {
  monthStart: Date
  unavailableDates: UnavailableRange[]
}) {
  const days = getMonthGridDays(monthStart)
  const label = `${MONTH_LABELS[monthStart.getMonth()]} ${monthStart.getFullYear()}`

  return (
    <div>
      <div className="mb-two font-display text-base font-bold text-foreground">{label}</div>
      <div className="mb-two grid grid-cols-7 text-xs font-semibold uppercase text-info">
        {WEEKDAY_LABELS.map((weekday, index) => (
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
