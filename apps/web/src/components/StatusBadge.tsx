import { useTranslation } from '@/lib/i18n'
import type { ReservationStatus } from '@/lib/types'

const STATUS_STYLES: Record<ReservationStatus, { bg: string; text: string; dot: string }> = {
  requested: { bg: 'bg-warning-tint', text: 'text-warning-foreground', dot: 'bg-warning' },
  approved: { bg: 'bg-secondary', text: 'text-secondary-foreground', dot: 'bg-primary' },
  delivered: { bg: 'bg-info-tint', text: 'text-info', dot: 'bg-info' },
  returned: { bg: 'bg-info-tint', text: 'text-info', dot: 'bg-info' },
  closed: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  rejected: { bg: 'bg-destructive-tint', text: 'text-destructive', dot: 'bg-destructive' },
  cancelled: { bg: 'bg-destructive-tint', text: 'text-destructive', dot: 'bg-destructive' },
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const t = useTranslation()
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-two py-half text-xs font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {t.statusBadge[status]}
    </span>
  )
}
