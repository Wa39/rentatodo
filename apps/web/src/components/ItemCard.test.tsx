import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { AuthProvider } from '@/lib/AuthContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { ItemCard } from './ItemCard'

describe('ItemCard', () => {
  it('renders the item name, category label, and the 14-day availability strip for an active item', () => {
    const item = mockItems[0]
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
    expect(screen.getByText('Next 14 days')).toBeInTheDocument()
  })

  it('does not render the item name as a link', () => {
    const item = mockItems[0]
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.queryByRole('link', { name: item.name })).not.toBeInTheDocument()
  })

  it('links the Calendar button to the calendar page with the item preselected', () => {
    const item = mockItems[0]
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
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
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={onEdit} onDelete={onDelete} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(item)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(item)
  })

  it('shows only the Reactivate button for an inactive item', () => {
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} onReactivate={vi.fn()} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.getByText('Inactive · not visible in search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('calls onReactivate when the Reactivate button is clicked', async () => {
    const user = userEvent.setup()
    const onReactivate = vi.fn()
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onReactivate={onReactivate} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(onReactivate).toHaveBeenCalledWith(item)
  })

  it('hides all action buttons when readOnly', () => {
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={mockItems[0]} readOnly />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendar' })).not.toBeInTheDocument()
  })

  it('renders the photo_url as the card image when set', () => {
    const item = { ...mockItems[0], photo_url: 'https://example.com/photo.jpg' }
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.getByRole('img', { name: item.name })).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('shows no image when photo_url is empty', () => {
    const item = { ...mockItems[0], photo_url: '' }
    render(
      <AuthProvider>
        <RequestsProvider>
          <MemoryRouter>
            <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
          </MemoryRouter>
        </RequestsProvider>
      </AuthProvider>,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
