import { useParams } from 'react-router-dom'
import { mockItemDetail } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const item = id ? mockItemDetail(id) : undefined

  if (!item) {
    return <p className="text-muted-foreground">Item not found.</p>
  }

  return (
    <div className="space-y-three">
      <h1 className="text-lg font-semibold text-foreground">{item.name}</h1>
      <p className="text-foreground">{item.description}</p>
      <p className="text-muted-foreground">
        {item.category} · {formatCentavos(item.price_per_day)}/day
      </p>

      <div>
        <h2 className="font-medium text-foreground">Unavailable dates</h2>
        <ul className="space-y-half">
          {item.unavailable_dates.map((range) => (
            <li
              key={`${range.start_date}-${range.end_date}`}
              className="w-fit rounded-md bg-destructive px-two py-half text-sm text-destructive-foreground"
            >
              {range.start_date} → {range.end_date}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
