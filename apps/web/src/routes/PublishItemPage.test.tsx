import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PublishItemPage } from './PublishItemPage'

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/items/publish']}>
      <Routes>
        <Route path="/items/publish" element={<PublishItemPage />} />
        <Route path="/items" element={<div>Items page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublishItemPage', () => {
  it('reflects the typed name in the live preview', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    expect(screen.getAllByText('Taladro Bosch Professional')).toHaveLength(1)
  })

  it('navigates to /items on submit', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.type(screen.getByLabelText('Photo'), 'https://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    expect(screen.getByText('Items page')).toBeInTheDocument()
  })

  it('navigates to /items on cancel without submitting', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Items page')).toBeInTheDocument()
  })
})
