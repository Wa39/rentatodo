import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export function RequireAuth({ children }: { children: ReactElement }): ReactElement {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}
