export function formatCentavos(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
