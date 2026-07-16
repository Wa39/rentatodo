import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { DashboardLayout } from './DashboardLayout'

describe('DashboardLayout', () => {
  it('renders nav links for every top-level dashboard section', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<div>Home content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(screen.getByRole('link', { name: 'Resumen' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Mis artículos' })).toHaveAttribute('href', '/items')
    expect(screen.getByRole('link', { name: 'Publicar artículo' })).toHaveAttribute('href', '/items/publish')
    expect(screen.getByRole('link', { name: /^Solicitudes/ })).toHaveAttribute('href', '/requests')
    expect(screen.getByRole('link', { name: 'Ganancias' })).toHaveAttribute('href', '/earnings')
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })

  it('shows a pending-request count badge on the Solicitudes link', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<div>Home content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    const requestsLink = screen.getByRole('link', { name: /^Solicitudes/ })
    expect(requestsLink).toHaveTextContent(/\d+/)
  })
})
