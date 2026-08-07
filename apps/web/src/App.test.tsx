// apps/web/src/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('redirects an unauthenticated visitor from / to the login page', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
