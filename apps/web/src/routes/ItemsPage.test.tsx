import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemsPage } from './ItemsPage'

describe('ItemsPage', () => {
  it('lists every mock item, marking inactive ones', () => {
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    for (const item of mockItems) {
      expect(screen.getByText(item.name)).toBeInTheDocument()
    }
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('opens the publish dialog and adds a new item to the list', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Description'), 'Rodado 29, frenos de disco')
    await user.type(screen.getByLabelText('Price per day (USD)'), '12')
    await user.type(screen.getByLabelText('Photo URL'), 'https://storage.example.com/photos/bici.jpg')
    await user.click(screen.getByRole('button', { name: 'Save item' }))

    expect(screen.getByText('Bicicleta de montaña')).toBeInTheDocument()
  })

  it('edits an existing item through the pre-filled dialog', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const target = mockItems[0]

    const row = screen.getByText(target.name).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Edit' }))

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Taladro Bosch Professional (renovado)')
    await user.click(screen.getByRole('button', { name: 'Save item' }))

    expect(screen.getByText('Taladro Bosch Professional (renovado)')).toBeInTheDocument()
  })

  it('soft-deletes an item after confirming, without removing it from the list', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>,
    )
    const target = mockItems.find((item) => item.is_active)!

    const row = screen.getByText(target.name).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    expect(screen.getByText(target.name)).toBeInTheDocument()
    expect(within(screen.getByText(target.name).closest('li')!).getByText('Inactive')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
