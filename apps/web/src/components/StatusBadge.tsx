import type { ReservationStatus } from '@/lib/types'

const STATUS_LABELS: Record<ReservationStatus, string> = {
  requested: 'Solicitada',
  approved: 'Aprobada',
  delivered: 'Entregada',
  returned: 'Devuelta',
  closed: 'Cerrada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
}

const STATUS_CLASSES: Record<ReservationStatus, string> = {
  requested: 'bg-warning-tint text-warning-foreground',
  approved: 'bg-secondary text-secondary-foreground',
  delivered: 'bg-info-tint text-info',
  returned: 'bg-info-tint text-info',
  closed: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive-tint text-destructive',
  cancelled: 'bg-destructive-tint text-destructive',
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-two py-half text-xs font-bold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
