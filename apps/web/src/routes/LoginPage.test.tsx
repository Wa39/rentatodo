import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { LoginPage } from './LoginPage'

function StatusProbe() {
  const { isAuthenticated } = useAuth()
  return <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
}

describe('LoginPage', () => {
  it('renders email/password fields, authenticates, and navigates to /dashboard on submit', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <StatusProbe />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByTestId('status')).toHaveTextContent('in')
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })
})
