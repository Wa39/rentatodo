import { Link } from 'react-router-dom'
import type { Item } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { getAvailabilityStrip } from '@/lib/availability'
import { CATEGORY_LABELS } from '@/lib/categoryLabels'
import { mockItemDetail } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

interface ItemCardProps {
  item: Item
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  readOnly?: boolean
}

export function ItemCard({ item, onEdit, onDelete, readOnly = false }: ItemCardProps) {
  const detail = mockItemDetail(item.id)
  const strip = getAvailabilityStrip(detail?.unavailable_dates ?? [])

  return (
    <div data-testid={`item-card-${item.id}`} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-secondary to-card">
        <span className="absolute left-two top-two rounded-full bg-foreground/75 px-two py-half text-xs font-semibold capitalize text-card">
          {CATEGORY_LABELS[item.category]}
        </span>
      </div>
      <div className="space-y-two p-three">
        <div className="flex items-start justify-between gap-two">
          <Link to={`/items/${item.id}`} className="font-semibold text-foreground hover:text-primary">
            {item.name}
          </Link>
          <span className="whitespace-nowrap font-mono text-sm font-semibold text-secondary-foreground">
            {formatCentavos(item.price_per_day)}
            <span className="text-xs font-normal text-muted-foreground">/día</span>
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        {item.is_active ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos 14 días</p>
            <div className="mt-one flex gap-half">
              {strip.map((day, index) => (
                <div key={index} className={`h-4 flex-1 rounded-sm ${day === 'booked' ? 'bg-destructive/65' : 'bg-muted'}`} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">Inactivo · no visible en búsquedas</p>
        )}
        {!readOnly && (
          <div className="flex gap-two pt-one">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit?.(item)}>
              Editar
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <Link to={`/items/${item.id}`}>Calendario</Link>
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => onDelete?.(item)}>
              Eliminar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
