import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiGetEarnings, getErrorMessage } from './api'
import { deriveByMonth } from './earningsDerived'
import { useAuth } from './AuthContext'
import { useTranslation } from './i18n'
import type { Earnings } from './types'

const EMPTY_EARNINGS: Earnings = { total_earnings: 0, by_item: [], by_month: deriveByMonth([]) }

interface EarningsContextValue {
  earnings: Earnings
  loading: boolean
  error: string | null
}

const EarningsContext = createContext<EarningsContextValue | undefined>(undefined)

export function EarningsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const t = useTranslation()
  const [earnings, setEarnings] = useState<Earnings>(EMPTY_EARNINGS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks the token that is currently "live" so a response for a token that
  // is no longer current (e.g. the user logged out while the request was in
  // flight) is discarded.
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    if (!token) {
      setEarnings(EMPTY_EARNINGS)
      setLoading(false)
      return
    }
    const currentToken = token
    setLoading(true)
    setError(null)
    apiGetEarnings(currentToken)
      .then((fetched) => {
        if (tokenRef.current !== currentToken) return
        setEarnings({ ...fetched, by_month: deriveByMonth(fetched.by_item) })
      })
      .catch((err) => {
        if (tokenRef.current === currentToken) setError(getErrorMessage(err, t.earnings.loadError))
      })
      .finally(() => {
        if (tokenRef.current === currentToken) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const value: EarningsContextValue = { earnings, loading, error }
  return <EarningsContext.Provider value={value}>{children}</EarningsContext.Provider>
}

export function useEarnings(): EarningsContextValue {
  const context = useContext(EarningsContext)
  if (!context) {
    throw new Error('useEarnings must be used within an EarningsProvider')
  }
  return context
}
