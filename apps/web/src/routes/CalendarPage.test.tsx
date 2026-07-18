import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems, mockRequests } from '@/lib/mockData'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { CalendarPage } from './CalendarPage'

function renderPage(initialEntry = '/requests/calendar') {
  render(
    <RequestsProvider>
      <ItemsProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/requests/calendar" element={<CalendarPage />} />
          </Routes>
        </MemoryRouter>
      </ItemsProvider>
    </RequestsProvider>,
  )
}

describe('CalendarPage', () => {
  it('defaults to the first item when no item is preselected', () => {
    renderPage()
    expect(screen.getByRole('combobox')).toHaveValue(mockItems[0].id)
  })

  it('preselects the item from the ?item= query param', () => {
    renderPage(`/requests/calendar?item=${mockItems[1].id}`)
    expect(screen.getByRole('combobox')).toHaveValue(mockItems[1].id)
  })

  it('switches items when a different one is picked from the dropdown', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(screen.getByRole('combobox'), mockItems[1].id)
    expect(screen.getByRole('combobox')).toHaveValue(mockItems[1].id)
  })

  it("lists this item's reservations below the calendar", () => {
    renderPage()
    const reservation = mockRequests.find((r) => r.item_id === mockItems[0].id)!
    expect(screen.getByText(new RegExp(reservation.renter_name))).toBeInTheDocument()
  })

  it('shows a not-found message instead of silently falling back for an invalid ?item=', () => {
    renderPage('/requests/calendar?item=does-not-exist')
    expect(screen.getByText("This item doesn't exist or is no longer yours.")).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders each month at a fixed compact width instead of stretching full-width', () => {
    renderPage()
    const monthHeadings = screen.getAllByText(/2026$/)
    expect(monthHeadings).toHaveLength(2)
    for (const heading of monthHeadings) {
      expect(heading.parentElement?.parentElement).toHaveClass('w-[280px]')
    }
  })
})
