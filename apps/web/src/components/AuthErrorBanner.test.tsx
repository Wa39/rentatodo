import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthErrorBanner } from './AuthErrorBanner'

describe('AuthErrorBanner', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<AuthErrorBanner message={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the message when set', () => {
    render(<AuthErrorBanner message="Invalid email or password" />)
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
  })
})
