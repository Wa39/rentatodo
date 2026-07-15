import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { mockRequests, mockTransactions } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const reservation = mockRequests.find((r) => r.id === id)
  const transactions = mockTransactions.filter((tx) => tx.reservation_id === id)
  const [reason, setReason] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)

  if (!reservation) {
    return <p className="text-muted-foreground">Reservation not found.</p>
  }

  function handleClose() {
    // Phase 1: no real PATCH /reservations/{id}/close call yet.
    window.alert('Reservation closed (placeholder — no API call yet).')
  }

  function handleReportSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /reservations/{id}/report call yet.
    setReportSubmitted(true)
  }

  return (
    <div className="space-y-four">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{reservation.item_name}</h1>
        <p className="text-muted-foreground">
          {reservation.start_date} → {reservation.end_date} · {reservation.status}
        </p>
        <Button className="mt-two" onClick={handleClose} disabled={reservation.status !== 'returned'}>
          Close reservation
        </Button>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Deposit history</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{tx.type}</TableCell>
                <TableCell>{formatCentavos(tx.amount)}</TableCell>
                <TableCell>{tx.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="font-medium text-foreground">Report a problem</h2>
        {reportSubmitted ? (
          <p className="text-foreground">Report submitted.</p>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-two">
            <div className="space-y-half">
              <Label htmlFor="report-reason">What went wrong?</Label>
              <Input id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <div className="space-y-half">
              <Label htmlFor="report-photo">Photo URL</Label>
              <Input id="report-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
            </div>
            <Button type="submit">Submit report</Button>
          </form>
        )}
      </div>
    </div>
  )
}
