import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  apiCreateItem,
  apiDeleteItem,
  apiListMyItems,
  apiUpdateItem,
  getErrorMessage,
  type CreateItemPayload,
  type UpdateItemPayload,
} from './api'
import { useAuth } from './AuthContext'
import { useTranslation } from './i18n'
import type { Item } from './types'

interface ItemsContextValue {
  items: Item[]
  loading: boolean
  error: string | null
  addItem: (data: CreateItemPayload) => Promise<void>
  updateItem: (id: string, data: UpdateItemPayload) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined)

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const t = useTranslation()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refetch(currentToken: string, isCancelled: () => boolean = () => false) {
    setLoading(true)
    setError(null)
    try {
      const fetched = await apiListMyItems(currentToken)
      if (isCancelled()) return
      setItems(fetched)
    } catch (err) {
      if (isCancelled()) return
      setError(getErrorMessage(err, t.items.loadError))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setItems([])
      setLoading(false)
      return
    }
    refetch(token, () => cancelled)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function addItem(data: CreateItemPayload) {
    if (!token) throw new Error('Not authenticated')
    await apiCreateItem(token, data)
    await refetch(token)
  }

  async function updateItem(id: string, data: UpdateItemPayload) {
    if (!token) throw new Error('Not authenticated')
    await apiUpdateItem(token, id, data)
    await refetch(token)
  }

  async function deleteItem(id: string) {
    if (!token) throw new Error('Not authenticated')
    await apiDeleteItem(token, id)
    await refetch(token)
  }

  const value: ItemsContextValue = { items, loading, error, addItem, updateItem, deleteItem }
  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>
}

export function useItems(): ItemsContextValue {
  const context = useContext(ItemsContext)
  if (!context) {
    throw new Error('useItems must be used within an ItemsProvider')
  }
  return context
}
