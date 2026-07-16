import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemCard } from './ItemCard'

describe('ItemCard', () => {
  it('renders the item name, category label, and the 14-day availability strip for an active item', () => {
    const item = mockItems[0]
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('Herramientas')).toBeInTheDocument()
    expect(screen.getByText('Próximos 14 días')).toBeInTheDocument()
  })

  it('shows the inactive message instead of the strip for an inactive item', () => {
    const item = mockItems.find((i) => !i.is_active)!
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Inactivo · no visible en búsquedas')).toBeInTheDocument()
  })

  it('calls onEdit and onDelete when their buttons are clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const item = mockItems[0]
    render(
      <MemoryRouter>
        <ItemCard item={item} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onEdit).toHaveBeenCalledWith(item)
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onDelete).toHaveBeenCalledWith(item)
  })

  it('hides all action buttons when readOnly', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItems[0]} readOnly />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendario' })).not.toBeInTheDocument()
  })
})
