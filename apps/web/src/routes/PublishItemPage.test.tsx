import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { PublishItemPage } from './PublishItemPage'
import { ItemsPage } from './ItemsPage'

function renderPage() {
  render(
    <RequestsProvider>
      <ItemsProvider>
        <MemoryRouter initialEntries={['/items/publish']}>
          <Routes>
            <Route path="/items/publish" element={<PublishItemPage />} />
            <Route path="/items" element={<ItemsPage />} />
          </Routes>
        </MemoryRouter>
      </ItemsProvider>
    </RequestsProvider>,
  )
}

describe('PublishItemPage', () => {
  it('reflects the typed name in the live preview', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    expect(screen.getAllByText('Taladro Bosch Professional')).toHaveLength(1)
  })

  it('adds the new item to the Items list on submit', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.type(screen.getByLabelText('Photo'), 'https://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
    expect(screen.getByText('Bicicleta de montaña')).toBeInTheDocument()
  })

  it('navigates to /items on cancel without submitting', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
  })
})
