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
  // Tracks the live `page` value the same way tokenRef tracks `token`, so
  // loadMore() can detect that a concurrent refetch() (triggered by an
  // approve/reject/close) already changed the list out from under it and
  // discard its now-stale response instead of appending onto fresh data.
  const pageRef = useRef(page)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  // Re-fetches every page currently loaded (not just page 1), so that
  // approve/reject/close — which all call this after mutating — don't throw
  // away pages the user brought in via loadMore().
  async function refetch(currentToken: string) {
    setLoading(true)
    setError(null)
    try {
      const targetPage = Math.max(page, 1)
      let all: Reservation[] = []
      let fetchedTotal = 0
      let pagesFetched = 0
      for (let p = 1; p <= targetPage; p++) {
        const fetched = await apiListMyRequests(currentToken, p)
        if (tokenRef.current !== currentToken) return
        all = [...all, ...fetched.reservations]
        fetchedTotal = fetched.total
        pagesFetched = p
        if (all.length >= fetchedTotal) break
      }
      setRequests(all)
      setTotal(fetchedTotal)
      setPage(pagesFetched)
    } catch (err) {
      if (tokenRef.current === currentToken) {
        setError(getErrorMessage(err, t.requests.loadError))
      }
      throw err
    } finally {
      if (tokenRef.current === currentToken) setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      setRequests([])
      setTotal(0)
      setPage(1)
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
  async function loadMore() {
    if (!token || loadingMore || loading || !hasMore) return
    const currentToken = token
    const pageAtStart = page
    const nextPage = pageAtStart + 1
    setLoadingMore(true)
    try {
      const fetched = await apiListMyRequests(currentToken, nextPage)
      if (tokenRef.current !== currentToken) return
      // A mutation's refetch() may have changed the page count while this
      // request was in flight — its result already reflects the current
      // list, so appending this now-stale page on top would duplicate or
      // reintroduce invalidated rows.
      if (pageRef.current !== pageAtStart) return
      setRequests((prev) => [...prev, ...fetched.reservations])
      setTotal(fetched.total)
      setPage(nextPage)
    } catch (err) {
      if (tokenRef.current === currentToken) setError(getErrorMessage(err, t.requests.loadError))
      throw err
    } finally {
      if (tokenRef.current === currentToken) setLoadingMore(false)
    }
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
