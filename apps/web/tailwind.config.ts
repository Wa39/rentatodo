import type { Config } from 'tailwindcss'
import { spacing } from '@rentatodo/design-tokens'

const pxSpacing = Object.fromEntries(
  Object.entries(spacing).map(([key, value]) => [key, `${value}px`]),
)

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: pxSpacing,
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config
