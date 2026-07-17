import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { EarningsPage } from './EarningsPage'

describe('EarningsPage', () => {
  it('renders the 3 KPI cards derived from mock data', () => {
    render(<EarningsPage />)
    expect(screen.getByText(formatCentavos(mockEarnings.total_earnings))).toBeInTheDocument()
    const currentMonth = mockEarnings.by_month[mockEarnings.by_month.length - 1]
    expect(screen.getByText(formatCentavos(currentMonth.total))).toBeInTheDocument()
  })

  it('renders one bar per month in the chart', () => {
    render(<EarningsPage />)
    for (const entry of mockEarnings.by_month) {
      expect(screen.getByText(entry.month)).toBeInTheDocument()
    }
  })

  it('selects the first item by default and updates the breakdown when another item is clicked', async () => {
    const user = userEvent.setup()
    render(<EarningsPage />)
    const first = mockEarnings.by_item[0]
    const second = mockEarnings.by_item[1]

    const firstPanel = screen.getByText(first.item_name, { selector: 'h2' }).closest('div')!
    expect(within(firstPanel).getByText(`${first.rentals[0].start_date} - ${first.rentals[0].end_date}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(second.item_name) }))
    expect(screen.getByText(second.item_name, { selector: 'h2' })).toBeInTheDocument()
  })
})
