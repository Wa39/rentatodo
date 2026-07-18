import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockRequests } from './mockData'
import type { Reservation } from './types'

interface RequestsContextValue {
  requests: Reservation[]
  setStatus: (id: string, status: Reservation['status']) => void
}

const RequestsContext = createContext<RequestsContextValue | undefined>(undefined)

export function RequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Reservation[]>(mockRequests)

  function setStatus(id: string, status: Reservation['status']) {
    setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const value: RequestsContextValue = { requests, setStatus }
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>
}

export function useRequests(): RequestsContextValue {
  const context = useContext(RequestsContext)
  if (!context) {
    throw new Error('useRequests must be used within a RequestsProvider')
  }
  return context
}
