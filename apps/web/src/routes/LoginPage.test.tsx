import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { LoginPage } from './LoginPage'

function StatusProbe() {
  const { isAuthenticated } = useAuth()
  return <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
}

describe('LoginPage', () => {
  it('renders email/password fields and authenticates on submit', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
          <StatusProbe />
        </MemoryRouter>
      </AuthProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByTestId('status')).toHaveTextContent('in')
  })
})
