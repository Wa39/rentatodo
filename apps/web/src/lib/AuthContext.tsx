import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiGetMe, apiLogin, apiRegister, ApiError } from './api'

const TOKEN_KEY = 'rentatodo_token'

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

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
  }

  useEffect(() => {
    if (!token) return
    const mountToken = token
    apiGetMe(mountToken)
      .then((profile) => {
        if (tokenRef.current !== mountToken) return
        setUser({ id: profile.id, name: profile.name, email: profile.email })
      })
      .catch((err) => {
        if (tokenRef.current !== mountToken) return
        if (err instanceof ApiError) logout()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password)
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
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
    const result = await apiLogin(email, password)
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    setUser({ id: profile.id, name: profile.name, email: profile.email })
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
