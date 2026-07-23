import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiApproveReservation, apiListMyRequests, apiRejectReservation, ApiError, getErrorMessage } from './api'
import { useAuth } from './AuthContext'
import { useTranslation } from './i18n'
import type { Reservation } from './types'

interface RequestsContextValue {
  requests: Reservation[]
  loading: boolean
  error: string | null
  approveRequest: (id: string) => Promise<void>
  rejectRequest: (id: string) => Promise<void>
}

const RequestsContext = createContext<RequestsContextValue | undefined>(undefined)

export function RequestsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const t = useTranslation()
  const [requests, setRequests] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks the token that is currently "live". Every refetch() call checks
  // this ref before applying its result, so a response for a token that is
  // no longer current (e.g. the user logged out or logged in as someone
  // else while the request was in flight) is discarded — regardless of
  // whether refetch() was triggered by the mount effect or by a mutation.
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  async function refetch(currentToken: string) {
    setLoading(true)
    setError(null)
    try {
      const fetched = await apiListMyRequests(currentToken)
      if (tokenRef.current !== currentToken) return
      setRequests(fetched.reservations)
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
      setLoading(false)
      return
    }
    // Fire-and-forget: the mount effect only cares about updating state
    // (handled inside refetch itself), not about the rejection that
    // refetch() now throws for callers that need to react to failure.
    refetch(token).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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

  const value: RequestsContextValue = { requests, loading, error, approveRequest, rejectRequest }
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>
}

export function useRequests(): RequestsContextValue {
  const context = useContext(RequestsContext)
  if (!context) {
    throw new Error('useRequests must be used within a RequestsProvider')
  }
  return context
}
