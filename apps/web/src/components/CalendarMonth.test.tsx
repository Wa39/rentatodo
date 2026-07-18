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

  it('renders the month label and marks reserved and pending dates', () => {
    render(
      <CalendarMonth
        monthStart={new Date(2026, 6, 1)}
        dateRanges={[
          { start_date: '2026-07-18', end_date: '2026-07-20', state: 'reserved' },
          { start_date: '2026-07-22', end_date: '2026-07-22', state: 'pending' },
        ]}
      />,
    )

    expect(screen.getByText('July 2026')).toBeInTheDocument()
    expect(screen.getByText('18')).toHaveClass('bg-destructive')
    expect(screen.getByText('17')).not.toHaveClass('bg-destructive')
    expect(screen.getByText('22')).toHaveClass('bg-warning')
    expect(screen.getByText('14')).toHaveClass('ring-primary')
    expect(screen.getByText('13')).not.toHaveClass('ring-primary')
  })
})
