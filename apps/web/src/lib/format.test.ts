import { describe, expect, it } from 'vitest'
import { dollarsToCentavos, formatCentavos, getInitials } from './format'

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

describe('dollarsToCentavos', () => {
  it('converts a whole dollar amount', () => {
    expect(dollarsToCentavos('5')).toBe(500)
  })

  it('converts an amount with cents', () => {
    expect(dollarsToCentavos('10.15')).toBe(1015)
  })

  it('rounds a third decimal digit up to the nearest cent (float-unsafe under Number(x) * 100)', () => {
    // Number('1.005') * 100 === 100.49999999999999, so Math.round(...) used to give 100 instead of 101.
    expect(dollarsToCentavos('1.005')).toBe(101)
  })

  it('rounds a third decimal digit down when below the midpoint', () => {
    expect(dollarsToCentavos('1.004')).toBe(100)
  })

  it('carries a round-up over into the dollar amount', () => {
    expect(dollarsToCentavos('1.999')).toBe(200)
  })

  it('treats a trailing decimal point as no cents', () => {
    expect(dollarsToCentavos('5.')).toBe(500)
  })

  it('returns NaN for an empty string', () => {
    expect(dollarsToCentavos('')).toBeNaN()
  })

  it('returns NaN for non-numeric input', () => {
    expect(dollarsToCentavos('abc')).toBeNaN()
  })

  it('expands exponential notation to plain decimal, which <input type="number"> accepts', () => {
    expect(dollarsToCentavos('5e2')).toBe(50000)
  })

  it('rounds exponential notation with float-unsafe precision correctly, not via Number(x) * 100', () => {
    // 1.005e0 === 1.005; Number('1.005e0') * 100 === 100.49999999999999,
    // which Math.round() would floor to 100 instead of the correct 101.
    expect(dollarsToCentavos('1.005e0')).toBe(101)
  })

  it('expands negative exponential notation', () => {
    expect(dollarsToCentavos('-1.005e0')).toBe(-101)
  })

  it('expands a negative-exponent value into a small fraction', () => {
    // 5e-1 === 0.5
    expect(dollarsToCentavos('5e-1')).toBe(50)
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
