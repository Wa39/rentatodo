import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockItems } from './mockData'
import { ItemsProvider, useItems } from './ItemsContext'

function Probe() {
  const { items, addItem, updateItem, setItemActive } = useItems()
  return (
    <div>
      <span data-testid="count">{items.length}</span>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name} · {item.is_active ? 'active' : 'inactive'}
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          addItem({
            name: 'New Item',
            description: 'desc',
            category: 'tools',
            price_per_day: 500,
            photo_url: 'https://example.com/p.jpg',
            owner_id: mockItems[0].owner_id,
            owner_name: mockItems[0].owner_name,
          })
        }
      >
        add
      </button>
      <button onClick={() => updateItem(mockItems[0].id, { name: 'Renamed' })}>update</button>
      <button onClick={() => setItemActive(mockItems[0].id, false)}>deactivate</button>
    </div>
  )
}

describe('ItemsContext', () => {
  it('starts seeded with mockItems', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockItems.length))
  })

  it('addItem appends a new active item with a generated id', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    act(() => screen.getByText('add').click())
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockItems.length + 1))
    expect(screen.getByText('New Item · active')).toBeInTheDocument()
  })

  it('updateItem patches an existing item by id', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    act(() => screen.getByText('update').click())
    expect(screen.getByText(new RegExp('Renamed'))).toBeInTheDocument()
  })

  it('setItemActive flips is_active without removing the item', () => {
    render(
      <ItemsProvider>
        <Probe />
      </ItemsProvider>,
    )
    act(() => screen.getByText('deactivate').click())
    expect(screen.getByTestId('count')).toHaveTextContent(String(mockItems.length))
    expect(screen.getByText(`${mockItems[0].name} · inactive`)).toBeInTheDocument()
  })

  it('throws when useItems is called outside a provider', () => {
    function Bare() {
      useItems()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useItems must be used within an ItemsProvider')
  })
})
