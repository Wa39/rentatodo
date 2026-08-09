import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { apiGetTransactions, apiGetReport, apiReportProblem, getErrorMessage, type ReportResponse } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useRequests } from '@/lib/RequestsContext'
import { formatCentavos, formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { PhotoUploadField } from '@/components/PhotoUploadField'
import type { Transaction } from '@/lib/types'

function PhotoThumbnail({
  label,
  url,
  placeholder = '',
  onEnlarge,
}: {
  label: string
  url: string | null
  placeholder?: string
  onEnlarge: (url: string) => void
}) {
  return (
    <div className="flex-1 space-y-half">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {url ? (
        <button
          type="button"
          aria-label={`View ${label.toLowerCase()} photo`}
          onClick={() => onEnlarge(url)}
          className="block h-24 w-full overflow-hidden rounded-md border border-border"
        >
          <img src={url} alt={`${label} evidence`} className="h-full w-full object-cover" />
        </button>
      ) : (
        <p className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
          {placeholder}
        </p>
      )}
    </div>
  )
}

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
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)
  const [report, setReport] = useState<ReportResponse | undefined>(undefined)
  const [reportLoadError, setReportLoadError] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

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

  const reservationStatus = reservation?.status

  useEffect(() => {
    if (!token || !id || (reservationStatus !== 'delivered' && reservationStatus !== 'returned')) return
    let cancelled = false
    setReportLoading(true)
    setReportLoadError(null)
    setReport(undefined)
    apiGetReport(token, id)
      .then((fetched) => {
        if (!cancelled) setReport(fetched)
      })
      .catch((err) => {
        if (!cancelled) setReportLoadError(getErrorMessage(err, "Couldn't load the report. Try refreshing the page."))
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, id, reservationStatus])

  const blockedByReport = reportLoading || reportLoadError !== null || report !== undefined || reportSubmitted

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
    // Mirrors the submit button's own disabled expression exactly (see the
    // Button below) — the old <input required> enforced !photoUrl at the
    // DOM level regardless of call path; PhotoUploadField doesn't, so the
    // handler has to assert it itself now.
    if (!token || !id || !photoUrl || photoUploading || submitting) return
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
        <Button
          className="mt-two"
          onClick={handleClose}
          disabled={reservation.status !== 'returned' || closing || blockedByReport}
        >
          Close reservation
        </Button>
        {reservation.status === 'returned' && blockedByReport && (
          <p className="mt-one text-sm text-muted-foreground">
            {reportLoading
              ? 'Checking for an open problem report…'
              : reportLoadError
                ? "Couldn't confirm report status. Refresh to try again."
                : 'Deposit frozen — resolve the problem report before closing.'}
          </p>
        )}
        <AuthErrorBanner message={closeError} />
      </div>

      <div>
        <h2 className="font-medium text-foreground">Check-in / Check-out</h2>
        <div className="mt-two flex gap-three">
          <PhotoThumbnail
            label="Check-in"
            url={reservation.checkin_photo_url}
            placeholder="Not checked in yet"
            onEnlarge={setEnlargedPhoto}
          />
          <PhotoThumbnail
            label="Check-out"
            url={reservation.checkout_photo_url}
            placeholder="Not checked out yet"
            onEnlarge={setEnlargedPhoto}
          />
        </div>
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
        <AuthErrorBanner message={reportLoadError} />
        {reportLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : report ? (
          <div className="space-y-two">
            <p className="text-foreground">{report.reason}</p>
            <div className="w-24">
              <PhotoThumbnail label="Report" url={report.photo_url} onEnlarge={setEnlargedPhoto} />
            </div>
            <p className="text-sm text-muted-foreground">{report.created_at}</p>
          </div>
        ) : reportSubmitted ? (
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

      <Dialog open={enlargedPhoto !== null} onOpenChange={(next) => !next && setEnlargedPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">Enlarged photo</DialogTitle>
          {enlargedPhoto && <img src={enlargedPhoto} alt="Enlarged photo" className="max-h-[80vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
