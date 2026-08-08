import { useState } from 'react'
import { formatCentavos } from '@/lib/format'
import { useTranslation } from '@/lib/i18n'
import { useEarnings } from '@/lib/EarningsContext'
import { useRequests } from '@/lib/RequestsContext'
import { PageHeader } from '@/components/PageHeader'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'

export function EarningsPage() {
  const t = useTranslation()
  const { earnings, loading, error } = useEarnings()
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined)
  const selected = earnings.by_item.find((i) => i.item_id === selectedItemId) ?? earnings.by_item[0]
  const { requests } = useRequests()
  const closedCount = requests.filter((r) => r.status === 'closed').length
  const currentMonth = earnings.by_month[earnings.by_month.length - 1] ?? { month: '', total: 0 }
  const maxMonth = Math.max(1, ...earnings.by_month.map((m) => m.total))
  const maxItem = Math.max(1, ...earnings.by_item.map((i) => i.total))

  if (loading) {
    return (
      <div>
        <PageHeader title={t.earnings.title} subtitle={t.earnings.subtitle} />
        <div className="p-four text-sm text-muted-foreground">{t.earnings.loading}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title={t.earnings.title} subtitle={t.earnings.subtitle} />
        <div className="p-four">
          <AuthErrorBanner message={error} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t.earnings.title} subtitle={t.earnings.subtitle} />
      <div className="space-y-four p-four">
        <div className="grid grid-cols-1 gap-three sm:grid-cols-3">
          <div className="rounded-lg border border-sidebar-border bg-sidebar p-three">
            <p className="text-xs font-medium text-sidebar-foreground/70">{t.earnings.kpiTotal}</p>
            <p className="font-display text-2xl font-semibold text-on-dark-accent">{formatCentavos(earnings.total_earnings)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-three">
            <p className="text-xs font-medium text-muted-foreground">{t.earnings.kpiThisMonth}</p>
            <p className="font-display text-2xl font-semibold text-foreground">{formatCentavos(currentMonth.total)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-three">
            <p className="text-xs font-medium text-muted-foreground">{t.earnings.kpiClosedCount}</p>
            <p className="font-display text-2xl font-semibold text-foreground">{closedCount}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-four">
          <h2 className="font-medium text-foreground">{t.earnings.chartTitle}</h2>
          <p className="mb-three text-sm text-muted-foreground">{t.earnings.chartSubtitle}</p>
          <div className="flex items-end gap-three" style={{ height: '160px' }}>
            {earnings.by_month.map((entry, index) => {
              const isCurrent = index === earnings.by_month.length - 1
              const heightPct = (entry.total / maxMonth) * 100
              return (
                <div key={`${entry.month}-${index}`} data-testid="earnings-month-bar" className="flex flex-1 flex-col items-center gap-half">
                  <div className={`w-full rounded-t-md ${isCurrent ? 'bg-primary' : 'bg-secondary'}`} style={{ height: `${heightPct}%` }} />
                  <span className="text-xs text-muted-foreground">{entry.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-four lg:grid-cols-2">
          <div>
            <h2 className="font-medium text-foreground">{t.earnings.byItemHeading}</h2>
            <p className="mb-two text-sm text-muted-foreground">{t.earnings.byItemSubtitle}</p>
            <ul className="space-y-two">
              {earnings.by_item.map((byItem) => (
                <li key={byItem.item_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(byItem.item_id)}
                    aria-pressed={selected?.item_id === byItem.item_id}
                    className={`w-full rounded-lg border p-three text-left ${
                      selected?.item_id === byItem.item_id ? 'border-primary' : 'border-border'
                    } bg-card`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{byItem.item_name}</span>
                      <span className="font-mono text-sm font-semibold text-foreground">{formatCentavos(byItem.total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.earnings.reservationCount(byItem.rentals.length)}</p>
                    <div className="mt-one h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(byItem.total / maxItem) * 100}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected && (
            <div className="rounded-lg border border-border bg-card p-four">
              <h2 className="font-medium text-foreground">{selected.item_name}</h2>
              <p className="mb-two text-sm text-muted-foreground">{t.earnings.breakdownSubtitle}</p>
              <ul className="space-y-half text-sm text-muted-foreground">
                {selected.rentals.map((rental) => (
                  <li key={`${rental.start_date}-${rental.end_date}`} className="flex items-center justify-between">
                    <span>
                      {rental.start_date} - {rental.end_date}
                    </span>
                    <span className="font-mono">{formatCentavos(rental.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-three rounded-md bg-secondary p-two text-xs text-secondary-foreground">{t.earnings.privacyNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
