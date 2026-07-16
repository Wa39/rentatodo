import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarMonth } from './CalendarMonth'

describe('CalendarMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 14))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the Spanish month label and marks a booked date', () => {
    render(
      <CalendarMonth
        monthStart={new Date(2026, 6, 1)}
        unavailableDates={[{ start_date: '2026-07-18', end_date: '2026-07-20' }]}
      />,
    )

    expect(screen.getByText('July 2026')).toBeInTheDocument()
    expect(screen.getByText('18')).toHaveClass('bg-destructive')
    expect(screen.getByText('17')).not.toHaveClass('bg-destructive')
    expect(screen.getByText('14')).toHaveClass('ring-primary')
    expect(screen.getByText('13')).not.toHaveClass('ring-primary')
  })
})
