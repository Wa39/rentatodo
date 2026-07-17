import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mockRequests } from '@/lib/mockData'
import type { Reservation, ReservationStatus } from '@/lib/types'
import { formatCentavos, getInitials } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Tab = 'pending' | 'active' | 'history'

const TAB_STATUSES: Record<Tab, ReservationStatus[]> = {
  pending: ['requested'],
  active: ['approved', 'delivered', 'returned'],
  history: ['closed', 'rejected', 'cancelled'],
}

export function RequestsPage() {
  const t = useTranslation()
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)
  const [tab, setTab] = useState<Tab>('pending')
  const [query, setQuery] = useState('')

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const counts: Record<Tab, number> = {
    pending: requests.filter((r) => TAB_STATUSES.pending.includes(r.status)).length,
    active: requests.filter((r) => TAB_STATUSES.active.includes(r.status)).length,
    history: requests.filter((r) => TAB_STATUSES.history.includes(r.status)).length,
  }

  const visibleRequests = useMemo(() => {
    const q = query.trim().toLowerCase()
    return requests
      .filter((r) => TAB_STATUSES[tab].includes(r.status))
      .filter((r) => !q || r.renter_name.toLowerCase().includes(q) || r.item_name.toLowerCase().includes(q))
  }, [requests, tab, query])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: t.requests.tabPending },
    { key: 'active', label: t.requests.tabActive },
    { key: 'history', label: t.requests.tabHistory },
  ]

  return (
    <div>
      <PageHeader title={t.requests.title} subtitle={t.requests.subtitle} />
      <div className="space-y-three p-four">
        <div className="flex items-center justify-between gap-three">
          <div className="flex gap-two">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-three py-one text-sm font-semibold ${
                  tab === key ? 'bg-foreground text-card' : 'bg-card text-muted-foreground'
                }`}
              >
                {label} · {counts[key]}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.requests.searchPlaceholder}
            aria-label={t.requests.searchPlaceholder}
            className="max-w-xs"
          />
        </div>

        <ul className="space-y-two">
          {visibleRequests.map((reservation) => (
            <li key={reservation.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
              <Link to={`/reservations/${reservation.id}`} className="flex items-center gap-two hover:text-primary">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                  {getInitials(reservation.renter_name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {reservation.renter_name} · {reservation.item_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reservation.start_date} — {reservation.end_date} · {formatCentavos(reservation.deposit_amount)} total
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-two">
                <StatusBadge status={reservation.status} />
                {reservation.status === 'requested' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setStatus(reservation.id, 'rejected')}>
                      {t.requests.reject}
                    </Button>
                    <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
                      {t.requests.approve}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
