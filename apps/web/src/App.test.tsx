import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders with the spacing-four token class applied', () => {
    render(<App />)
    const root = screen.getByTestId('app-root')
    expect(root).toHaveClass('p-four')
  })
})
