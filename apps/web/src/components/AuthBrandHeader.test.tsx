import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthBrandHeader } from './AuthBrandHeader'

describe('AuthBrandHeader', () => {
  it('renders the RentaTodo brand name', () => {
    render(<AuthBrandHeader />)
    expect(screen.getByText('RentaTodo')).toBeInTheDocument()
  })
})
