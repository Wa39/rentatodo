import { useState } from 'react'
import { mockRequests } from '@/lib/mockData'
import type { Reservation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RequestsPage() {
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <div className="space-y-three">
      <h1 className="text-lg font-semibold text-foreground">Requests received</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Renter</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell>{reservation.renter_name}</TableCell>
              <TableCell>
                {reservation.start_date} → {reservation.end_date}
              </TableCell>
              <TableCell>{reservation.status}</TableCell>
              <TableCell className="space-x-two">
                {reservation.status === 'requested' && (
                  <>
                    <Button size="sm" onClick={() => setStatus(reservation.id, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setStatus(reservation.id, 'rejected')}>
                      Reject
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
