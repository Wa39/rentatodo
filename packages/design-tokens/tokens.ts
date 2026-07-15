// Mirrors apps/mobile/src/constants/brand.ts and theme.ts's Spacing exactly,
// so apps/web (Tailwind) and apps/mobile (NativeWind, wired separately by
// Zero) stay visually consistent. Update both places together if they change.

export const colors = {
  teal: '#0E7C7B',
  tealSoft: '#E4F1F0',
  ink: '#1F3B57',
  paper: '#F5F6F7',
  card: '#FFFFFF',
  line: '#E2E6E9',
  muted: '#7A8791',
  red: '#B3402E',
  redSoft: '#F7E0DB',
} as const;

export const spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
