import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { isAuthenticated, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <button onClick={login}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  it('starts unauthenticated, then flips on login()/logout()', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('out')

    act(() => screen.getByText('login').click())
    expect(screen.getByTestId('status')).toHaveTextContent('in')

    act(() => screen.getByText('logout').click())
    expect(screen.getByTestId('status')).toHaveTextContent('out')
  })
})
