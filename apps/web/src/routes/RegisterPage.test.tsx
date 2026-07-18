import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { RegisterPage } from './RegisterPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function StatusProbe() {
  const { isAuthenticated } = useAuth()
  return <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
}

function renderPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']}>
        <StatusProbe />
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers, auto-logs-in, and navigates straight to /dashboard', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })

  it('shows the API error message and stays on the page when the email is already registered', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'email: already registered' } }, 422),
    )
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByText('email: already registered')).toBeInTheDocument())
    expect(screen.getByTestId('status')).toHaveTextContent('out')
  })

  it('shows an inline error and blocks submission for a password under 8 characters', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'short1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows an inline error and blocks submission for 5+ consecutive digits', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'abc12345')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Password cannot contain 5 or more digits in a row.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows a password with up to 4 consecutive digits', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 200),
      )
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
  })

  it('links to /login for users who already have an account', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })
})
