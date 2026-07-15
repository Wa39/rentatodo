import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockEarnings } from '@/lib/mockData'
import { formatCentavos } from '@/lib/format'
import { EarningsPage } from './EarningsPage'

describe('EarningsPage', () => {
  it('shows the total and expands an item to reveal its rental breakdown', async () => {
    const user = userEvent.setup()
    render(<EarningsPage />)

    expect(screen.getByText(formatCentavos(mockEarnings.total_earnings))).toBeInTheDocument()

    const firstItem = mockEarnings.by_item[0]
    await user.click(screen.getByRole('button', { name: firstItem.item_name }))

    const firstRental = firstItem.rentals[0]
    expect(
      screen.getByText(`${firstRental.start_date} - ${firstRental.end_date}: ${formatCentavos(firstRental.amount)}`),
    ).toBeInTheDocument()
  })
})
