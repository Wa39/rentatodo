# @rentatodo/design-tokens

Shared color and spacing values for RentaTodo's owner dashboard (`apps/web`,
Tailwind CSS) and renter app (`apps/mobile`, NativeWind).

## Usage from Tailwind (apps/web)

```ts
import { colors, spacing } from '@rentatodo/design-tokens';
```

See `apps/web/tailwind.config.ts` for how the spacing scale is consumed, and
`apps/web/src/index.css` for how the colors are turned into shadcn/ui's CSS
variables.

## apps/mobile is currently OUT OF SYNC with these colors

As of the 2026-07-15 dashboard visual redesign, this package's `colors` were
updated to match a new mockup (forest green / dark sidebar palette),
replacing the original teal/ink palette that was sourced from
`apps/mobile/src/constants/brand.ts`. **`apps/mobile` was not updated** —
it still uses the old teal palette. The two apps' visual identities are
intentionally diverged for now. Whoever next touches `apps/mobile`'s theming
should either update `apps/mobile/src/constants/brand.ts` to match this
package's current colors, or treat the divergence as a deliberate product
decision and leave it alone — but should not assume the two are in sync.
