import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests } from '@/lib/mockData'
import { RequestsPage } from './RequestsPage'

describe('RequestsPage', () => {
  it('lists renter name and dates for each request', () => {
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    )
    for (const reservation of mockRequests) {
      expect(screen.getByText(reservation.renter_name)).toBeInTheDocument()
    }
  })

  it('approving a requested reservation updates its status to approved', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    )

    const requested = mockRequests.find((r) => r.status === 'requested')!
    const row = screen.getByText(requested.renter_name).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Approve' }))

    expect(within(row).getByText('approved')).toBeInTheDocument()
  })
})
