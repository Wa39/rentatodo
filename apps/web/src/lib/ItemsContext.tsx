import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockItems } from './mockData'
import type { Item } from './types'

interface ItemsContextValue {
  items: Item[]
  addItem: (item: Omit<Item, 'id' | 'created_at' | 'is_active'>) => void
  updateItem: (id: string, updates: Partial<Omit<Item, 'id'>>) => void
  setItemActive: (id: string, isActive: boolean) => void
}

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined)

export function ItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>(mockItems)

  function addItem(item: Omit<Item, 'id' | 'created_at' | 'is_active'>) {
    const newItem: Item = {
      ...item,
      id: crypto.randomUUID(),
      is_active: true,
      created_at: new Date().toISOString(),
    }
    setItems((current) => [newItem, ...current])
  }

  function updateItem(id: string, updates: Partial<Omit<Item, 'id'>>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  function setItemActive(id: string, isActive: boolean) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, is_active: isActive } : item)))
  }

  const value: ItemsContextValue = { items, addItem, updateItem, setItemActive }
  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>
}

export function useItems(): ItemsContextValue {
  const context = useContext(ItemsContext)
  if (!context) {
    throw new Error('useItems must be used within an ItemsProvider')
  }
  return context
}
