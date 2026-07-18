import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
  }

  useEffect(() => {
    if (!token) return
    apiGetMe(token)
      .then((profile) => setUser({ id: profile.id, name: profile.name, email: profile.email }))
      .catch((err) => {
        if (err instanceof ApiError) logout()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password)
    setToken(result.access_token)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    const profile = await apiGetMe(result.access_token)
    setUser({ id: profile.id, name: profile.name, email: profile.email })
  }

  async function register(name: string, email: string, password: string) {
    await apiRegister(name, email, password)
    await login(email, password)
  }

  const value: AuthContextValue = {
    isAuthenticated: token !== null,
    user,
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
