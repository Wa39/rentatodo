export function formatCentavos(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Parses a dollar-amount string (as typed into a form field) into an integer
// count of centavos, entirely with string/integer arithmetic. Number(x) * 100
// is float-unsafe — e.g. Number('1.005') * 100 === 100.49999999999999, which
// Math.round() rounds down to 100 instead of 101 — so this never routes the
// value through a floating-point multiplication.
export function dollarsToCentavos(input: string): number {
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(input.trim())
  if (!match || (match[2] === '' && !match[3])) return NaN
  const [, sign, wholeDigits, fractionDigits = ''] = match
  const whole = wholeDigits === '' ? 0 : Number(wholeDigits)
  // Cents plus one extra digit to round on; anything past that is discarded.
  const digits = `${fractionDigits}000`.slice(0, 3)
  const cents = Number(digits.slice(0, 2))
  const roundUp = Number(digits[2]) >= 5
  const centavos = whole * 100 + cents + (roundUp ? 1 : 0)
  return sign ? -centavos : centavos
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
