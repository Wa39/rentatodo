import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockRequests, mockTransactions } from '@/lib/mockData'
import { ReservationDetailPage } from './ReservationDetailPage'

describe('ReservationDetailPage', () => {
  it('renders the transaction history and a report-problem form', async () => {
    const user = userEvent.setup()
    const reservation = mockRequests[1]
    render(
      <MemoryRouter initialEntries={[`/reservations/${reservation.id}`]}>
        <Routes>
          <Route path="/reservations/:id" element={<ReservationDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(mockTransactions[0].type)).toBeInTheDocument()

    await user.type(screen.getByLabelText('What went wrong?'), 'The drill bit was broken')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/broken.jpg')
    await user.click(screen.getByRole('button', { name: 'Submit report' }))

    expect(screen.getByText('Report submitted.')).toBeInTheDocument()
  })
})
