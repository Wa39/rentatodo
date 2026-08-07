import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiApproveReservation, apiCloseReservation, apiListMyRequests, apiRejectReservation, ApiError, getErrorMessage } from './api'
import { useAuth } from './AuthContext'
import { useTranslation } from './i18n'
import type { Reservation } from './types'

interface RequestsContextValue {
  requests: Reservation[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
  approveRequest: (id: string) => Promise<void>
  rejectRequest: (id: string) => Promise<void>
  closeRequest: (id: string) => Promise<void>
}

const RequestsContext = createContext<RequestsContextValue | undefined>(undefined)

export function RequestsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const t = useTranslation()
  const [requests, setRequests] = useState<Reservation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks the token that is currently "live". Every refetch()/loadMore()
  // call checks this ref before applying its result, so a response for a
  // token that is no longer current (e.g. the user logged out or logged in
  // as someone else while the request was in flight) is discarded.
  const tokenRef = useRef(token)
  // Tracks the live `page`/`requests`/`total` values so refetch()/loadMore()
  // read current state when they actually run (inside the queue below), not
  // a stale value captured by closure back when they were called. Written
  // synchronously alongside every setPage/setRequests/setTotal call below
  // (see setPageAnd/setRequestsAnd/setTotalAnd) rather than via a useEffect:
  // the queue's continuations run on the microtask clock, which can — and,
  // per a prior version of this fix, did — outrun React's effect-scheduling
  // clock, so a ref synced only by useEffect could still read stale.
  const pageRef = useRef(page)
  const requestsRef = useRef(requests)
  const totalRef = useRef(total)

  function setPageAnd(next: number) {
    pageRef.current = next
    setPage(next)
  }

  function setRequestsAnd(next: Reservation[]) {
    requestsRef.current = next
    setRequests(next)
  }

  function setTotalAnd(next: number) {
    totalRef.current = next
    setTotal(next)
  }

  // refetch() (triggered by approve/reject/close) and loadMore() both read
  // and write requests/total/page. Run them one at a time through this
  // queue instead of letting them race — otherwise whichever resolves last
  // unconditionally overwrites the other's result, silently dropping
  // whatever the loser fetched (e.g. a mutation's refetch finishing after a
  // concurrent loadMore would erase the page it had just appended).
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = queueRef.current.then(operation, operation)
    // Keep the chain alive even if this operation throws, so one failure
    // doesn't permanently wedge every operation queued after it.
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  // Re-fetches every page currently loaded (not just page 1), so that
  // approve/reject/close — which all call this after mutating — don't throw
  // away pages the user brought in via loadMore(). Fetched in parallel and
  // applied atomically: either every page comes back and the list is
  // replaced with the fresh set, or one fails and the previous list is left
  // exactly as it was (plus an error banner) rather than showing a list
  // that's fresh on some pages and stale on others.
  function refetch(currentToken: string) {
    // Set synchronously, outside the queue, so `loading` flips to true the
    // instant this is called rather than after any queued operation ahead
    // of it finishes.
    setLoading(true)
    setError(null)
    return enqueue(async () => {
      try {
        const targetPage = Math.max(pageRef.current, 1)
        const responses = await Promise.all(
          Array.from({ length: targetPage }, (_, i) => apiListMyRequests(currentToken, i + 1)),
        )
        if (tokenRef.current !== currentToken) return
        setRequestsAnd(responses.flatMap((r) => r.reservations))
        setTotalAnd(responses[responses.length - 1].total)
        setPageAnd(targetPage)
      } catch (err) {
        if (tokenRef.current === currentToken) {
          setError(getErrorMessage(err, t.requests.loadError))
        }
        throw err
      } finally {
        if (tokenRef.current === currentToken) setLoading(false)
      }
    })
  }

  useEffect(() => {
    if (!token) {
      setRequestsAnd([])
      setTotalAnd(0)
      setPageAnd(1)
      setLoading(false)
      setLoadingMore(false)
      return
    }
    // Fire-and-forget: the mount effect only cares about updating state
    // (handled inside refetch itself), not about the rejection that
    // refetch() now throws for callers that need to react to failure.
    refetch(token).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const hasMore = requests.length < total

  // Owners with more requests than fit on one page (the API caps `limit` at
  // 50) used to have no way to see anything past the first page. This fetches
  // the next page and appends it instead of hardcoding a single fixed-size GET.
  function loadMore() {
    if (!token || loadingMore || loading || !hasMore) return Promise.resolve()
    const currentToken = token
    // Set synchronously, outside the queue, for the same reason as
    // refetch()'s setLoading(true) above.
    setLoadingMore(true)
    return enqueue(async () => {
      // Re-check now that it's actually our turn, using live refs rather
      // than the `requests`/`total` this closure captured back when
      // loadMore() was called: a refetch() ahead of us in the queue may
      // have changed the page count, or made hasMore false.
      if (requestsRef.current.length >= totalRef.current) {
        setLoadingMore(false)
        return
      }
      const nextPage = pageRef.current + 1
      try {
        const fetched = await apiListMyRequests(currentToken, nextPage)
        if (tokenRef.current !== currentToken) return
        setRequestsAnd([...requestsRef.current, ...fetched.reservations])
        setTotalAnd(fetched.total)
        setPageAnd(nextPage)
      } catch (err) {
        if (tokenRef.current === currentToken) setError(getErrorMessage(err, t.requests.loadError))
        throw err
      } finally {
        if (tokenRef.current === currentToken) setLoadingMore(false)
      }
    })
  }

  async function approveRequest(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiApproveReservation(token, id)
    await refetch(token)
  }

  async function rejectRequest(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiRejectReservation(token, id)
    await refetch(token)
  }

  async function closeRequest(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiCloseReservation(token, id)
    await refetch(token)
  }

  const value: RequestsContextValue = {
    requests,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    approveRequest,
    rejectRequest,
    closeRequest,
  }
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>
}

export function useRequests(): RequestsContextValue {
  const context = useContext(RequestsContext)
  if (!context) {
    throw new Error('useRequests must be used within a RequestsProvider')
  }
  return context
}
