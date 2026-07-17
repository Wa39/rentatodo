import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '@/components/RequireAuth'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'
import { DashboardPage } from './DashboardPage'
import { ItemsPage } from './ItemsPage'
import { PublishItemPage } from './PublishItemPage'
import { RequestsPage } from './RequestsPage'
import { CalendarPage } from './CalendarPage'
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
      { path: '/items/publish', element: <PublishItemPage /> },
      { path: '/requests', element: <RequestsPage /> },
      { path: '/requests/calendar', element: <CalendarPage /> },
      { path: '/reservations/:id', element: <ReservationDetailPage /> },
      { path: '/earnings', element: <EarningsPage /> },
    ],
  },
])
