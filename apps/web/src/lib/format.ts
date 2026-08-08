export function formatCentavos(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// "Aug 8, 2026, 6:13 PM" — the deposit ledger can carry more than one entry
// on the same calendar day (e.g. hold then freeze minutes apart), so the
// time is included to keep entries distinguishable, unlike the plain
// YYYY-MM-DD reservation dates shown elsewhere.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Expands scientific notation ('1.005e2') into plain decimal notation
// ('100.5') using only string/integer manipulation — no float arithmetic —
// so exponential input gets exactly as precise a result as plain-decimal
// input. Returns null if `input` isn't in exponential notation at all.
function expandExponential(input: string): string | null {
  const match = /^(-)?(\d*)(?:\.(\d*))?e([+-]?\d+)$/i.exec(input)
  if (!match) return null
  const [, sign, wholeDigits = '', fractionDigits = '', expStr] = match
  if (wholeDigits === '' && fractionDigits === '') return null
  const exp = Number(expStr)
  // A price field has no legitimate use for a value requiring more than a
  // few hundred digits once expanded. Bail out to null (parsed as invalid,
  // same as any other unparseable input) rather than building a huge string
  // — an unbounded exponent like '1e999999999' would otherwise reach the
  // '0'.repeat(...) calls below with a count large enough to throw a
  // RangeError, and this function is called unguarded from render bodies
  // (e.g. PublishItemPage's live price preview) on every keystroke.
  if (!Number.isFinite(exp) || Math.abs(exp) > 1000) return null
  const digits = wholeDigits + fractionDigits
  // Where the decimal point lands within `digits`, counted from the left.
  const pointIndex = wholeDigits.length + exp
  let plain: string
  if (pointIndex <= 0) {
    plain = `0.${'0'.repeat(-pointIndex)}${digits}`
  } else if (pointIndex >= digits.length) {
    plain = `${digits}${'0'.repeat(pointIndex - digits.length)}`
  } else {
    plain = `${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`
  }
  return sign ? `-${plain}` : plain
}

// Parses a dollar-amount string (as typed into a form field) into an integer
// count of centavos, entirely with string/integer arithmetic. Number(x) * 100
// is float-unsafe — e.g. Number('1.005') * 100 === 100.49999999999999, which
// Math.round() rounds down to 100 instead of 101 — so this never routes the
// value through a floating-point multiplication, including for exponential
// notation (e.g. '1.005e0'), which a native <input type="number"> field
// accepts and which expandExponential() converts to plain decimal first.
export function dollarsToCentavos(input: string): number {
  const trimmed = input.trim()
  const plain = expandExponential(trimmed) ?? trimmed
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(plain)
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
