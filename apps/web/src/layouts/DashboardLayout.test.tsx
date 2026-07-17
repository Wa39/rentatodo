import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { DashboardLayout } from './DashboardLayout'

function renderLayout() {
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
}

describe('DashboardLayout', () => {
  it('renders nav links for every top-level dashboard section, including Calendar', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'My items' })).toHaveAttribute('href', '/items')
    expect(screen.getByRole('link', { name: 'Publish item' })).toHaveAttribute('href', '/items/publish')
    expect(screen.getByRole('link', { name: /^Requests/ })).toHaveAttribute('href', '/requests')
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('href', '/requests/calendar')
    expect(screen.getByRole('link', { name: 'Earnings' })).toHaveAttribute('href', '/earnings')
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })

  it('shows a centered pending-request count badge on the Requests link', () => {
    renderLayout()
    const requestsLink = screen.getByRole('link', { name: /^Requests/ })
    expect(requestsLink).toHaveTextContent(/\d+/)
    const badge = requestsLink.querySelector('span')!
    expect(badge).toHaveClass('h-6', 'w-6', 'flex', 'items-center', 'justify-center')
  })

  it('shows the earned-this-month widget above the user footer', () => {
    renderLayout()
    const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1]
    expect(screen.getByText(formatCentavos(currentMonth.total))).toBeInTheDocument()
  })

  it('shows a down arrow when this month earned less than last month', async () => {
    vi.resetModules()
    vi.doMock('@/lib/mockData', async () => {
      const actual = await vi.importActual<typeof import('@/lib/mockData')>('@/lib/mockData')
      return {
        ...actual,
        mockEarnings: { ...actual.mockEarnings, by_month: [{ month: 'Jun', total: 2000 }, { month: 'Jul', total: 1000 }] },
      }
    })
    const authModule = await import('@/lib/AuthContext')
    const { DashboardLayout: PatchedLayout } = await import('./DashboardLayout')
    render(
      <authModule.AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<PatchedLayout />}>
              <Route path="/dashboard" element={<div>Home content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </authModule.AuthProvider>,
    )
    expect(screen.getByText(/↓ 50%/)).toBeInTheDocument()
    vi.doUnmock('@/lib/mockData')
  })
})
