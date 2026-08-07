import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiGetMe, apiLogin, apiRegister, ApiError } from './api'

const TOKEN_KEY = 'rentatodo_token'
const TOKEN_EXPIRY_KEY = 'rentatodo_token_expiry'

interface AuthUser {
  id: string
  name: string
  email: string
}

interface AuthContextValue {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)
  // Tracks the token that is currently "live". The mount effect's profile
  // fetch checks this ref before applying its result, so a response for a
  // token that is no longer current (e.g. logout() or a fresh login()/
  // register() happened while the request was in flight) is discarded.
  const tokenRef = useRef(token)
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    function handleTokenExpired() {
      logout()
    }
    window.addEventListener('rentatodo:token-expired', handleTokenExpired)
    return () => window.removeEventListener('rentatodo:token-expired', handleTokenExpired)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function logout() {
    if (expiryTimerRef.current !== null) {
      clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  }

  // Schedules an automatic logout at `expiresAtMs`. If the deadline is already
  // past, it logs out immediately (handles stale tokens restored from storage).
  function scheduleExpiry(expiresAtMs: number) {
    if (expiryTimerRef.current !== null) clearTimeout(expiryTimerRef.current)
    const delay = expiresAtMs - Date.now()
    if (delay <= 0) {
      logout()
      return
    }
    expiryTimerRef.current = setTimeout(logout, delay)
  }

  useEffect(() => {
    if (!token) return
    const stored = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (stored !== null) {
      const expiresAt = Number(stored)
      if (Date.now() >= expiresAt) {
        logout()
        return
      }
      scheduleExpiry(expiresAt)
    }
    const mountToken = token
    apiGetMe(mountToken)
      .then((profile) => {
        if (tokenRef.current !== mountToken) return
        setUser({ id: profile.id, name: profile.name, email: profile.email })
      })
      .catch((err) => {
        if (tokenRef.current !== mountToken) return
        if (err instanceof ApiError) {
          logout()
        } else {
          // Not an API-level rejection (e.g. a network error or a JSON parse
          // failure) — the token may still be valid, so the session is kept
          // intact rather than logging out. Still surface it: silently
          // swallowing it would leave `user === null` with a token set and
          // no trace of why.
          console.error('[AuthContext] unexpected error loading profile:', err)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password)
    const expiresAt = Date.now() + result.expires_in * 1000
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt))
    scheduleExpiry(expiresAt)
    try {
      const profile = await apiGetMe(result.access_token)
      setUser({ id: profile.id, name: profile.name, email: profile.email })
    } catch (err) {
      logout()
      throw err
    }
  }

  async function register(name: string, email: string, password: string) {
    const profile = await apiRegister(name, email, password)
    try {
      const result = await apiLogin(email, password)
      const expiresAt = Date.now() + result.expires_in * 1000
      setToken(result.access_token)
      localStorage.setItem(TOKEN_KEY, result.access_token)
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt))
      scheduleExpiry(expiresAt)
      setUser({ id: profile.id, name: profile.name, email: profile.email })
    } catch {
      throw new ApiError('LOGIN_AFTER_REGISTER_FAILED', 'Account created. Please sign in.')
    }
  }

  const value: AuthContextValue = {
    isAuthenticated: token !== null,
    user,
    token,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
