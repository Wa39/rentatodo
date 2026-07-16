// Mirrors the RentaTodo dashboard visual redesign mockup (dashboard.html,
// via RentaTodo_Dashboard_Preview.pdf), NOT apps/mobile's current colors —
// see README.md for why these two are now intentionally out of sync.

export const colors = {
  sidebar: '#16231d',
  sidebarHover: '#1f3129',
  sidebarBorder: '#263a30',
  sidebarForeground: '#cfd9d2',
  bg: '#f4f6f4',
  card: '#ffffff',
  border: '#e2e7e3',
  ink: '#16221d',
  inkSoft: '#5c6b64',
  inkFaint: '#94a39c',
  forest: '#2f6f4e',
  forestDark: '#234f39',
  forestTint: '#e7f1ea',
  amber: '#d98c2b',
  amberInk: '#241505',
  amberTint: '#fbeed9',
  amberForeground: '#9c6114',
  red: '#c0442e',
  redTint: '#f8e4df',
  blue: '#3563a8',
  blueTint: '#e4ebf6',
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
