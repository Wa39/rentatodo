import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  apiCreateItem,
  apiDeleteItem,
  apiListMyItems,
  apiUpdateItem,
  ApiError,
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
  // Tracks the token that is currently "live". Every refetch() call checks
  // this ref before applying its result, so a response for a token that is
  // no longer current (e.g. the user logged out or logged in as someone
  // else while the request was in flight) is discarded — regardless of
  // whether refetch() was triggered by the mount effect or by a mutation.
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  async function refetch(currentToken: string) {
    setLoading(true)
    setError(null)
    try {
      const fetched = await apiListMyItems(currentToken)
      if (tokenRef.current !== currentToken) return
      setItems(fetched)
    } catch (err) {
      if (tokenRef.current === currentToken) {
        setError(getErrorMessage(err, t.items.loadError))
      }
      throw err
    } finally {
      if (tokenRef.current === currentToken) setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      setItems([])
      setLoading(false)
      return
    }
    // Fire-and-forget: the mount effect only cares about updating state
    // (handled inside refetch itself), not about the rejection that
    // refetch() now throws for callers that need to react to failure.
    refetch(token).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function addItem(data: CreateItemPayload) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiCreateItem(token, data)
    await refetch(token)
  }

  async function updateItem(id: string, data: UpdateItemPayload) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
    await apiUpdateItem(token, id, data)
    await refetch(token)
  }

  async function deleteItem(id: string) {
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Not authenticated')
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
