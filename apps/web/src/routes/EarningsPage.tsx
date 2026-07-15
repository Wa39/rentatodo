import { useState } from 'react'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'

export function EarningsPage() {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  return (
    <div className="space-y-three">
      <h1 className="text-lg font-semibold text-foreground">Earnings</h1>
      <p className="text-2xl font-semibold text-foreground">{formatCentavos(mockEarnings.total_earnings)}</p>

      <ul className="space-y-two">
        {mockEarnings.by_item.map((byItem) => (
          <li key={byItem.item_id} className="rounded-lg border border-border bg-card p-three">
            <Button
              variant="ghost"
              className="w-full justify-between"
              aria-label={byItem.item_name}
              onClick={() => setExpandedItemId((current) => (current === byItem.item_id ? null : byItem.item_id))}
            >
              <span>{byItem.item_name}</span>
              <span>{formatCentavos(byItem.total)}</span>
            </Button>
            {expandedItemId === byItem.item_id && (
              <ul className="mt-two space-y-half pl-three text-sm text-muted-foreground">
                {byItem.rentals.map((rental) => (
                  <li key={`${rental.start_date}-${rental.end_date}`}>
                    {rental.start_date} - {rental.end_date}: {formatCentavos(rental.amount)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
