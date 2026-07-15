import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockItems } from '@/lib/mockData'
import { ItemDetailPage } from './ItemDetailPage'

describe('ItemDetailPage', () => {
  it('renders the item name and its unavailable date ranges', () => {
    const item = mockItems[0]
    render(
      <MemoryRouter initialEntries={[`/items/${item.id}`]}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText('2026-07-18 → 2026-07-20')).toBeInTheDocument()
  })
})
