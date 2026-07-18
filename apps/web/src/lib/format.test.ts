import { describe, expect, it } from 'vitest'
import { formatCentavos, getInitials } from './format'

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('María Vargas')).toBe('MV')
  })

  it('handles a double space between words', () => {
    expect(getInitials('María  Vargas')).toBe('MV')
  })

  it('handles a leading space', () => {
    expect(getInitials(' María Vargas')).toBe('MV')
  })

  it('handles a single word', () => {
    expect(getInitials('María')).toBe('M')
  })
})

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
