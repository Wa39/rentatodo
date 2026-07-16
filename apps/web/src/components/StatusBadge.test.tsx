// apps/web/src/components/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReservationStatus } from '@/lib/types'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the English label and warning colors for a requested reservation', () => {
    render(<StatusBadge status="requested" />)
    const badge = screen.getByText('Pending').closest('span')!
    expect(badge).toHaveClass('bg-warning-tint')
    expect(badge).toHaveClass('text-warning-foreground')
  })

  it('renders the English label and destructive-tint colors for a rejected reservation', () => {
    render(<StatusBadge status="rejected" />)
    const badge = screen.getByText('Rejected').closest('span')!
    expect(badge).toHaveClass('bg-destructive-tint')
    expect(badge).toHaveClass('text-destructive')
  })

  it('renders the correct English label for every status, merging delivered/returned into "Active" and rejected/cancelled into "Rejected"', () => {
    const expected: Record<ReservationStatus, string> = {
      requested: 'Pending',
      approved: 'Approved',
      delivered: 'Active',
      returned: 'Active',
      closed: 'Closed',
      rejected: 'Rejected',
      cancelled: 'Rejected',
    }
    for (const status of Object.keys(expected) as ReservationStatus[]) {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(screen.getByText(expected[status])).toBeInTheDocument()
      unmount()
    }
  })

  it('renders a colored dot indicator before the label', () => {
    const { container } = render(<StatusBadge status="approved" />)
    const dot = container.querySelector('span > span')
    expect(dot).toHaveClass('bg-primary')
  })
})
