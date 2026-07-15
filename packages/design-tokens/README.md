# @rentatodo/design-tokens

Shared color and spacing values for RentaTodo's owner dashboard (`apps/web`,
Tailwind CSS) and renter app (`apps/mobile`, NativeWind). Keeping both
consumers pointed at this one file is what keeps the two apps visually
consistent.

## Usage from Tailwind (apps/web)

```ts
import { colors, spacing } from '@rentatodo/design-tokens';
```

See `apps/web/tailwind.config.ts` for how the spacing scale is consumed, and
`apps/web/src/index.css` for how the colors are turned into shadcn/ui's CSS
variables.

## Usage from NativeWind (apps/mobile) — not wired yet

`apps/mobile` currently defines its own copy of these values in
`src/constants/brand.ts` and `src/constants/theme.ts`. Wiring NativeWind's
`tailwind.config.js` to import `colors`/`spacing` from this package instead
is a follow-up owned by whoever maintains `apps/mobile` — not part of this
package's initial scope. Until then, keep the two copies in sync by hand if
either changes.
