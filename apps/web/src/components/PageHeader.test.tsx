import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title and subtitle', () => {
    render(<PageHeader title="My items" subtitle="3 active · 1 inactive" />)
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
    expect(screen.getByText('3 active · 1 inactive')).toBeInTheDocument()
  })

  it('renders the action node when provided', () => {
    render(<PageHeader title="My items" subtitle="x" action={<button>+ Publish item</button>} />)
    expect(screen.getByRole('button', { name: '+ Publish item' })).toBeInTheDocument()
  })

  it('has a full-bleed white background', () => {
    const { container } = render(<PageHeader title="X" subtitle="Y" />)
    expect(container.firstChild).toHaveClass('bg-card')
  })
})
