import { describe, expect, it } from 'vitest'
import { formatCentavos } from './format'

describe('formatCentavos', () => {
  it('formats whole dollars without cents drift', () => {
    expect(formatCentavos(5000)).toBe('$50.00')
  })

  it('formats amounts with cents', () => {
    expect(formatCentavos(1099)).toBe('$10.99')
  })

  it('formats zero', () => {
    expect(formatCentavos(0)).toBe('$0.00')
  })
})
