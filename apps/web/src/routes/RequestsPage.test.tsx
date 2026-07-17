import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { RequestsProvider } from '@/lib/RequestsContext'
import { RequestsPage } from './RequestsPage'

function renderPage() {
  render(
    <RequestsProvider>
      <MemoryRouter initialEntries={['/requests']}>
        <Routes>
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/reservations/:id" element={<div>Reservation detail</div>} />
        </Routes>
      </MemoryRouter>
    </RequestsProvider>,
  )
}

describe('RequestsPage', () => {
  it('shows the Pending tab by default with only requested reservations', () => {
    renderPage()
    const pending = mockRequests.filter((r) => r.status === 'requested')
    for (const r of pending) {
      expect(screen.getByText(new RegExp(r.renter_name))).toBeInTheDocument()
    }
    const active = mockRequests.find((r) => r.status === 'delivered')!
    expect(screen.queryByText(new RegExp(active.renter_name))).not.toBeInTheDocument()
  })

  it('switches tabs and shows the right reservations for each bucket', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /History/ }))
    const closed = mockRequests.find((r) => r.status === 'closed')!
    expect(screen.getByText(new RegExp(closed.renter_name))).toBeInTheDocument()
  })

  it('filters the visible tab by renter name', async () => {
    const user = userEvent.setup()
    renderPage()
    const pending = mockRequests.find((r) => r.status === 'requested')!
    await user.type(screen.getByRole('textbox'), pending.renter_name)
    expect(screen.getByText(new RegExp(pending.renter_name))).toBeInTheDocument()
  })

  it('approves a pending request, removing it from the Pending tab', async () => {
    const user = userEvent.setup()
    renderPage()
    const pending = mockRequests.find((r) => r.status === 'requested')!
    const row = screen.getByText(new RegExp(pending.renter_name)).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))
    expect(screen.queryByText(new RegExp(pending.renter_name))).not.toBeInTheDocument()
  })

  it('links each row to its reservation detail page', () => {
    renderPage()
    const pending = mockRequests.find((r) => r.status === 'requested')!
    expect(screen.getByRole('link', { name: new RegExp(pending.renter_name) })).toHaveAttribute(
      'href',
      `/reservations/${pending.id}`,
    )
  })
})
