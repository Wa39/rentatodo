// Mirrors the RentaTodo dashboard visual redesign mockup, revision 2
// ("RentaTodo Dashboard.html") — see docs/superpowers/specs/2026-07-15-dashboard-visual-redesign-design.md's
// "Addendum (2026-07-15, revision 2)" section for the full palette derivation.
// NOT apps/mobile's current colors — see README.md for why these two are
// intentionally out of sync.

export const colors = {
  sidebar: '#141F19',
  sidebarHover: '#1E2E26',
  sidebarBorder: '#263A30',
  sidebarForeground: '#AEBBB3',
  bg: '#EFEDE6',
  card: '#FFFFFF',
  border: '#E4E2D8',
  ink: '#17201B',
  inkSoft: '#5B655E',
  inkFaint: '#9AA39C',
  forest: '#1E7A4F',
  forestDark: '#155C3B',
  forestTint: '#E2F0E7',
  amber: '#D9862A',
  amberInk: '#241505',
  amberTint: '#F9ECD6',
  amberForeground: '#8F550F',
  red: '#C24A32',
  redTint: '#F7E1DA',
  blue: '#33608F',
  blueTint: '#E3EAF3',
  onDarkAccent: '#6FB88E',
} as const

export const spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const

export type Colors = typeof colors
export type Spacing = typeof spacing
