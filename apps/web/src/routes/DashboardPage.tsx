import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mockEarnings, mockItems, mockRequests, mockUser } from '@/lib/mockData'
import type { Reservation } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'

export function DashboardPage() {
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)
  const activeItems = mockItems.filter((item) => item.is_active).length
  const pendingRequests = requests.filter((r) => r.status === 'requested')
  const activeReservations = requests.filter((r) => ['approved', 'delivered'].includes(r.status)).length
  const recentPending = pendingRequests.slice(0, 2)

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <div className="space-y-four">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">Resumen</h1>
          <p className="text-sm text-muted-foreground">Bienvenida de vuelta, {mockUser.name.split(' ')[0]}</p>
        </div>
        <Button asChild>
          <Link to="/items/publish">+ Publicar artículo</Link>
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-three">
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Artículos activos</p>
          <p className="font-display text-2xl font-semibold text-foreground">{activeItems}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Solicitudes pendientes</p>
          <p className="font-display text-2xl font-semibold text-foreground">{pendingRequests.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Reservas activas</p>
          <p className="font-display text-2xl font-semibold text-foreground">{activeReservations}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-three">
          <p className="text-xs font-medium text-muted-foreground">Ganado este mes</p>
          <p className="font-display text-2xl font-semibold text-foreground">{formatCentavos(mockEarnings.total_earnings)}</p>
        </div>
      </div>

      <div>
        <div className="mb-two flex items-center justify-between">
          <div>
            <h2 className="font-medium text-foreground">Solicitudes recientes</h2>
            <p className="text-sm text-muted-foreground">Lo último que necesita tu atención</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/requests">Ver todas</Link>
          </Button>
        </div>
        <ul className="space-y-two">
          {recentPending.map((reservation) => (
            <li key={reservation.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {reservation.renter_name} solicitó {reservation.item_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reservation.start_date} — {reservation.end_date} · {formatCentavos(reservation.deposit_amount)} total
                </p>
              </div>
              <div className="flex gap-two">
                <Button size="sm" variant="outline" onClick={() => setStatus(reservation.id, 'rejected')}>
                  Rechazar
                </Button>
                <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
                  Aprobar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
