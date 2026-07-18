export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface LoginResult {
  access_token: string
  token_type: string
  expires_in: number
}

interface UserProfile {
  id: string
  name: string
  email: string
  created_at: string
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'UNKNOWN_ERROR', body?.error?.message ?? 'Something went wrong. Please try again.')
  }
  return body as T
}

export function apiLogin(email: string, password: string): Promise<LoginResult> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function apiRegister(name: string, email: string, password: string): Promise<UserProfile> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
}

export function apiGetMe(token: string): Promise<UserProfile> {
  return request('/users/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}
