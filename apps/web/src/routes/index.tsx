import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '@/components/RequireAuth'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'
import { DashboardPage } from './DashboardPage'
import { ItemsPage } from './ItemsPage'
import { RequestsPage } from './RequestsPage'
import { ReservationDetailPage } from './ReservationDetailPage'
import { EarningsPage } from './EarningsPage'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/items', element: <ItemsPage /> },
      { path: '/requests', element: <RequestsPage /> },
      { path: '/reservations/:id', element: <ReservationDetailPage /> },
      { path: '/earnings', element: <EarningsPage /> },
    ],
  },
])
