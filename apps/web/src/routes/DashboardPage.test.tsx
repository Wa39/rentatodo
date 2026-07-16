// apps/web/src/routes/DashboardPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { DashboardPage } from './DashboardPage'

describe('DashboardPage', () => {
  it('renders KPI cards derived from mock data', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    const activeItems = mockItems.filter((i) => i.is_active).length
    const pending = mockRequests.filter((r) => r.status === 'requested').length

    const activeItemsCard = screen.getByText('Artículos activos').closest('div')!
    expect(within(activeItemsCard).getByText(String(activeItems))).toBeInTheDocument()

    const pendingCard = screen.getByText('Solicitudes pendientes').closest('div')!
    expect(within(pendingCard).getByText(String(pending))).toBeInTheDocument()
  })

  it('shows at most 2 pending requests and lets you approve one', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const row = screen.getByText(new RegExp(firstPending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Aprobar' }))
    expect(screen.queryByText(new RegExp(firstPending.renter_name))).not.toBeInTheDocument()
  })
})
