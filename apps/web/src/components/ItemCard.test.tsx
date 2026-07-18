import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ItemCard } from './ItemCard'

describe('ItemCard', () => {
  it('renders the item name, category label, and the 14-day availability strip for an active item', () => {
    const item = mockItems[0]
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
    expect(screen.getByText('Next 14 days')).toBeInTheDocument()
  })

  it('does not render the item name as a link', () => {
    const item = mockItems[0]
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.queryByRole('link', { name: item.name })).not.toBeInTheDocument()
  })

  it('links the Calendar button to the calendar page with the item preselected', () => {
    const item = mockItems[0]
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute(
      'href',
      `/requests/calendar?item=${item.id}`,
    )
  })

  it('calls onEdit and onDelete when their buttons are clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const item = mockItems[0]
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={onEdit} onDelete={onDelete} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(item)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(item)
  })

  it('shows Reactivate and Edit only for an inactive item', async () => {
    const user = userEvent.setup()
    const onReactivate = vi.fn()
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} onReactivate={onReactivate} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.getByText('Inactive · not visible in search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(onReactivate).toHaveBeenCalledWith(item)
  })

  it('hides all action buttons when readOnly', () => {
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={mockItems[0]} readOnly />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
  })
})
