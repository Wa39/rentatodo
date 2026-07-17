import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsPage } from './ItemsPage'

describe('ItemsPage', () => {
  it('renders a card for every mock item with an active/inactive count in the header', () => {
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    for (const item of mockItems) {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    }
    const activeCount = mockItems.filter((i) => i.is_active).length
    const inactiveCount = mockItems.length - activeCount
    expect(screen.getByText(`${activeCount} active · ${inactiveCount} inactive`)).toBeInTheDocument()
  })

  it('filters items by name as the user types in the search box', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const searchTerm = mockItems[0].name.split(' ')[0]
    await user.type(screen.getByRole('textbox'), searchTerm)
    expect(screen.getByText(mockItems[0].name)).toBeInTheDocument()
    for (const other of mockItems.slice(1)) {
      if (!other.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        expect(screen.queryByText(other.name)).not.toBeInTheDocument()
      }
    }
  })

  it('reactivates an inactive item when its Reactivate button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('edits an existing item through the pre-filled dialog', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const item = mockItems[0]
    const card = screen.getByTestId(`item-card-${item.id}`)
    await user.click(within(card).getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe(item.name)
    await user.clear(nameInput)
    await user.type(nameInput, `${item.name} (renovated)`)
    await user.click(screen.getByRole('button', { name: 'Save item' }))
    expect(screen.getByText(`${item.name} (renovated)`)).toBeInTheDocument()
  })
})
