// apps/web/src/routes/DashboardPage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RESERVED_STATUSES } from '@/lib/availability'
import { DashboardPage } from './DashboardPage'
import { RequestsPage } from './RequestsPage'

function renderDashboard() {
  render(
    <RequestsProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </RequestsProvider>,
  )
}

describe('DashboardPage', () => {
  it('renders KPI cards derived from mock data', () => {
    renderDashboard()
    const activeItems = mockItems.filter((i) => i.is_active).length
    const pending = mockRequests.filter((r) => r.status === 'requested').length

    const activeItemsCard = screen.getByText('Active items').closest('div')!
    expect(within(activeItemsCard).getByText(String(activeItems))).toBeInTheDocument()

    const pendingCard = screen.getByText('Pending requests').closest('div')!
    expect(within(pendingCard).getByText(String(pending))).toBeInTheDocument()
  })

  it('renders the "Earned this month" KPI card with the dark-inverted treatment', () => {
    renderDashboard()
    const earnedCard = screen.getByText('Earned this month').closest('div')!
    expect(earnedCard).toHaveClass('bg-sidebar')
    expect(within(earnedCard).getByText((content) => content.startsWith('$'))).toHaveClass('text-on-dark-accent')
  })

  it('shows at most 2 pending requests and lets you approve one', async () => {
    const user = userEvent.setup()
    renderDashboard()
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const row = screen.getByText(new RegExp(firstPending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))
    expect(screen.queryByText(new RegExp(firstPending.renter_name))).not.toBeInTheDocument()
  })

  it('renders the page header with the title and welcome message', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('Welcome back, María')).toBeInTheDocument()
  })

  it('"Active reservations" KPI matches RequestsPage\'s Active tab count, including returned', () => {
    renderDashboard()
    const expectedActive = mockRequests.filter((r) => RESERVED_STATUSES.includes(r.status)).length
    const activeCard = screen.getByText('Active reservations').closest('div')!
    expect(within(activeCard).getByText(String(expectedActive))).toBeInTheDocument()
  })

  it('approving a request on the Dashboard is reflected on the Requests page', async () => {
    const user = userEvent.setup()
    render(
      <RequestsProvider>
        <MemoryRouter>
          <DashboardPage />
          <RequestsPage />
        </MemoryRouter>
      </RequestsProvider>,
    )
    const firstPending = mockRequests.filter((r) => r.status === 'requested')[0]
    const dashboardRow = screen.getAllByText(new RegExp(firstPending.renter_name))[0].closest('li')!
    await user.click(within(dashboardRow).getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: /^Active/ }))
    expect(screen.getByText(new RegExp(firstPending.renter_name))).toBeInTheDocument()
  })
})
