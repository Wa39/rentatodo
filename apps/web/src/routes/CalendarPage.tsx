import { useMemo, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { CalendarMonth } from '@/components/CalendarMonth'
import { StatusBadge } from '@/components/StatusBadge'
import { getItemDateStates } from '@/lib/availability'
import { useItems } from '@/lib/ItemsContext'
import { useRequests } from '@/lib/RequestsContext'
import { useTranslation } from '@/lib/i18n'

export function CalendarPage() {
  const t = useTranslation()
  const { items } = useItems()
  const { requests } = useRequests()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('item')
  const selectedItem = requestedId ? items.find((i) => i.id === requestedId) : items[0]

  const dateRanges = useMemo(
    () => (selectedItem ? getItemDateStates(selectedItem.id, requests) : []),
    [selectedItem, requests],
  )
  const itemReservations = useMemo(
    () => (selectedItem ? requests.filter((r) => r.item_id === selectedItem.id) : []),
    [selectedItem, requests],
  )

  const now = new Date()
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const secondMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    setSearchParams({ item: event.target.value })
  }

  if (requestedId && !selectedItem) {
    return (
      <div>
        <PageHeader title={t.calendar.title} subtitle={t.calendar.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.calendar.itemNotFound}</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t.calendar.title}
        subtitle={t.calendar.subtitle}
        action={
          <select
            value={selectedItem!.id}
            onChange={handleSelect}
            aria-label={t.calendar.title}
            className="rounded-md border border-input bg-card px-two py-half text-foreground"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        }
      />
      <div className="space-y-four p-four">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-foreground">{selectedItem!.name}</h2>
          <div className="flex gap-three text-xs text-muted-foreground">
            <span className="flex items-center gap-half">
              <span className="h-2 w-2 rounded-sm bg-muted" />
              {t.calendar.legend.available}
            </span>
            <span className="flex items-center gap-half">
              <span className="h-2 w-2 rounded-sm bg-warning" />
              {t.calendar.legend.pending}
            </span>
            <span className="flex items-center gap-half">
              <span className="h-2 w-2 rounded-sm bg-destructive" />
              {t.calendar.legend.reserved}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-four rounded-lg border border-border bg-card p-four">
          <CalendarMonth monthStart={firstMonth} dateRanges={dateRanges} />
          <CalendarMonth monthStart={secondMonth} dateRanges={dateRanges} />
        </div>

        <div>
          <h2 className="mb-two font-medium text-foreground">{t.calendar.reservationsHeading}</h2>
          <ul className="space-y-two">
            {itemReservations.map((reservation) => (
              <li key={reservation.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
                <Link to={`/reservations/${reservation.id}`} className="hover:text-primary">
                  {reservation.renter_name} · {reservation.start_date} — {reservation.end_date}
                </Link>
                <StatusBadge status={reservation.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
