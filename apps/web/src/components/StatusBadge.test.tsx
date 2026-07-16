// apps/web/src/components/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the Spanish label and warning colors for a requested reservation', () => {
    render(<StatusBadge status="requested" />)
    const badge = screen.getByText('Solicitada')
    expect(badge).toHaveClass('bg-warning-tint')
    expect(badge).toHaveClass('text-warning-foreground')
  })

  it('renders the Spanish label and destructive-tint colors for a rejected reservation', () => {
    render(<StatusBadge status="rejected" />)
    const badge = screen.getByText('Rechazada')
    expect(badge).toHaveClass('bg-destructive-tint')
    expect(badge).toHaveClass('text-destructive')
  })

  it('renders a distinct, non-empty Spanish label for every reservation status', () => {
    const statuses = ['requested', 'approved', 'delivered', 'returned', 'closed', 'rejected', 'cancelled'] as const
    const labels = new Set<string>()
    for (const status of statuses) {
      const { unmount, container } = render(<StatusBadge status={status} />)
      const text = container.textContent ?? ''
      expect(text.length).toBeGreaterThan(0)
      labels.add(text)
      unmount()
    }
    expect(labels.size).toBe(statuses.length)
  })
})
