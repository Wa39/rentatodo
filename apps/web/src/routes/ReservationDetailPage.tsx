import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { apiGetTransactions, apiReportProblem, getErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useRequests } from '@/lib/RequestsContext'
import { formatCentavos, formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { PhotoUploadField } from '@/components/PhotoUploadField'
import type { Transaction } from '@/lib/types'

export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const { requests, closeRequest } = useRequests()
  const reservation = requests.find((r) => r.id === id)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !id) return
    let cancelled = false
    apiGetTransactions(token, id)
      .then((fetched) => {
        if (!cancelled) setTransactions(fetched)
      })
      .catch((err) => {
        if (!cancelled) setTransactionsError(getErrorMessage(err, "Couldn't load the deposit history. Try refreshing the page."))
      })
    return () => {
      cancelled = true
    }
  }, [token, id])

  if (!reservation) {
    return <p className="text-muted-foreground">Reservation not found.</p>
  }

  async function handleClose() {
    if (!token || !id) return
    setClosing(true)
    setCloseError(null)
    try {
      await closeRequest(id)
    } catch (err) {
      setCloseError(getErrorMessage(err, 'Something went wrong. Please try again.'))
      setClosing(false)
      return
    }
    try {
      const refreshed = await apiGetTransactions(token, id)
      setTransactions(refreshed)
      setTransactionsError(null)
    } catch (err) {
      setTransactionsError(getErrorMessage(err, "Couldn't refresh the deposit history. Try refreshing the page."))
    } finally {
      setClosing(false)
    }
  }

  async function handleReportSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !id || photoUploading) return
    setSubmitting(true)
    setReportError(null)
    try {
      await apiReportProblem(token, id, { reason, photo_url: photoUrl })
    } catch (err) {
      setReportError(getErrorMessage(err, 'Something went wrong. Please try again.'))
      setSubmitting(false)
      return
    }
    setReportSubmitted(true)
    try {
      const refreshed = await apiGetTransactions(token, id)
      setTransactions(refreshed)
      setTransactionsError(null)
    } catch (err) {
      setTransactionsError(getErrorMessage(err, "Couldn't refresh the deposit history. Try refreshing the page."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-four">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{reservation.item_name}</h1>
        <p className="text-muted-foreground">
          {reservation.start_date} → {reservation.end_date} · {reservation.status}
        </p>
        <Button className="mt-two" onClick={handleClose} disabled={reservation.status !== 'returned' || closing}>
          Close reservation
        </Button>
        <AuthErrorBanner message={closeError} />
      </div>

      <div>
        <h2 className="font-medium text-foreground">Deposit history</h2>
        <AuthErrorBanner message={transactionsError} />
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
                <TableCell>{formatDateTime(tx.created_at)}</TableCell>
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
            <AuthErrorBanner message={reportError} />
            <div className="space-y-half">
              <Label htmlFor="report-reason">What went wrong?</Label>
              <Input id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <PhotoUploadField
              id="report-photo"
              label="Photo"
              value={photoUrl}
              onChange={setPhotoUrl}
              onUploadingChange={setPhotoUploading}
              token={token ?? ''}
            />
            <Button type="submit" disabled={submitting || !photoUrl || photoUploading}>
              Submit report
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
