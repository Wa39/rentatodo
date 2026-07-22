import { Link } from 'react-router-dom'
import type { Item } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { getAvailabilityStrip, getItemDateStates } from '@/lib/availability'
import { useTranslation } from '@/lib/i18n'
import { useRequests } from '@/lib/RequestsContext'
import { Button } from '@/components/ui/button'

interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  readOnly?: boolean
}

export function ItemCard({ item, onEdit, onDelete, readOnly = false }: ItemCardProps) {
  const t = useTranslation()
  const { requests } = useRequests()
  const dateRanges = getItemDateStates(item.id, requests)
  const strip = getAvailabilityStrip(dateRanges)

  return (
    <div data-testid={`item-card-${item.id}`} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-secondary to-card">
        <span className="absolute left-two top-two rounded-full bg-foreground/75 px-two py-half text-xs font-semibold capitalize text-card">
          {t.categories[item.category]}
        </span>
      </div>
      <div className="space-y-two p-three">
        <div className="flex items-start justify-between gap-two">
          <span className="font-semibold text-foreground">{item.name}</span>
          <span className="whitespace-nowrap font-mono text-sm font-semibold text-secondary-foreground">
            {formatCentavos(item.price_per_day)}
            <span className="text-xs font-normal text-muted-foreground">{t.itemCard.perDay}</span>
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        {item.is_active ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.itemCard.next14Days}</p>
            <div className="mt-one flex gap-half">
              {strip.map((day, index) => (
                <div
                  key={index}
                  className={`h-4 flex-1 rounded-sm ${
                    day === 'reserved' ? 'bg-destructive/65' : day === 'pending' ? 'bg-warning/65' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">{t.itemCard.inactive}</p>
        )}
        {!readOnly && item.is_active && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              {t.itemCard.edit}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <Link to={`/requests/calendar?item=${item.id}`}>{t.itemCard.calendar}</Link>
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => onDelete?.(item)}>
              {t.itemCard.delete}
            </Button>
          </div>
        )}
        {!readOnly && !item.is_active && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              {t.itemCard.edit}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
