import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function Probe() {
  const { isAuthenticated, user, token, login, register, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <span data-testid="user-name">{user?.name ?? ''}</span>
      <span data-testid="token">{token ?? ''}</span>
      <button onClick={() => login('maria@example.com', 'securepass123').catch(() => {})}>login</button>
      <button onClick={() => register('María Vargas', 'maria@example.com', 'securepass123').catch(() => {})}>register</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts unauthenticated when localStorage has no token', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('out')
  })

  it('login() calls /auth/login then /users/me, stores the token, and sets user', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => {
      await screen.getByText('login').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByTestId('user-name')).toHaveTextContent('María Vargas')
    expect(localStorage.getItem('rentatodo_token')).toBe('tok123')
  })

  it('register() calls /auth/register then /auth/login, ending authenticated without an extra profile re-fetch', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => {
      await screen.getByText('register').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByTestId('user-name')).toHaveTextContent('María Vargas')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('logout() clears the token from state and localStorage', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await act(async () => {
      await screen.getByText('login').click()
    })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))

    act(() => screen.getByText('logout').click())

    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(localStorage.getItem('rentatodo_token')).toBeNull()
  })

  it('is authenticated on the very first render when a token already exists in localStorage', async () => {
    localStorage.setItem('rentatodo_token', 'existing-tok')
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    // No act()/await here on purpose — this asserts the FIRST synchronous render.
    expect(screen.getByTestId('status')).toHaveTextContent('in')

    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('María Vargas'))
  })

  it('logs out automatically if the stored token is rejected by /users/me', async () => {
    localStorage.setItem('rentatodo_token', 'stale-tok')
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))
    expect(localStorage.getItem('rentatodo_token')).toBeNull()
  })

  it('keeps the session when the profile check fails for a reason other than an invalid token', async () => {
    localStorage.setItem('rentatodo_token', 'still-valid-tok')
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('in')
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem('rentatodo_token')).toBe('still-valid-tok')
  })

  it('rolls back the token if the profile fetch fails right after a successful login', async () => {
    let rejectGetMe: (err: unknown) => void = () => {}
    const getMePromise = new Promise<Response>((_resolve, reject) => {
      rejectGetMe = reject
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockReturnValueOnce(getMePromise)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    act(() => {
      screen.getByText('login').click()
    })

    // Deterministically proves the success path ran (token set, isAuthenticated
    // true) before triggering the rejection — without this wait, a broken
    // rollback could pass the final assertions by coincidence of timing.
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))

    act(() => {
      rejectGetMe(new TypeError('Failed to fetch'))
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))
    expect(localStorage.getItem('rentatodo_token')).toBeNull()
  })

  it('discards a stale mount-effect profile response if logout() fires before it resolves', async () => {
    localStorage.setItem('rentatodo_token', 'existing-tok')
    let resolveGetMe: (r: Response) => void = () => {}
    const getMePromise = new Promise<Response>((resolve) => {
      resolveGetMe = resolve
    })
    vi.mocked(fetch).mockReturnValueOnce(getMePromise)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    // Authenticated synchronously from the stored token, profile fetch still in flight.
    expect(screen.getByTestId('status')).toHaveTextContent('in')

    // Log out while the mount effect's /users/me call for the old token is still in flight.
    act(() => screen.getByText('logout').click())

    expect(screen.getByTestId('status')).toHaveTextContent('out')

    // Now let the stale, in-flight response resolve — with a DIFFERENT user's profile.
    // It must NOT clobber the post-logout state.
    await act(async () => {
      resolveGetMe(
        jsonResponse({ id: 'u2', name: 'Someone Else', email: 'someone@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(screen.getByTestId('user-name')).toBeEmptyDOMElement()
  })

  it('exposes the current token on the context value', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('token')).toHaveTextContent('')

    await act(async () => {
      await screen.getByText('login').click()
    })

    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('tok123'))
  })
})
