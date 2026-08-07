# Register — Confirm Password Field — Design

**Goal:** Add a "Confirm password" field to `apps/web/src/routes/RegisterPage.tsx`, so a user retyping their password gets live mismatch feedback and can't submit until the two match. UX-focused — no backend or contract change (`RegisterRequest` already only takes one `password`; confirmation is a client-side-only check).

## Architecture

Mirror the existing `password` field's validation pattern exactly, rather than introducing a new one:

- `getPasswordError(password, t)` (`RegisterPage.tsx:12-16`) is a pure function; add a sibling `getConfirmPasswordError(password, confirmPassword, t)` next to it, same shape.
- `passwordError` (`RegisterPage.tsx:28`) only evaluates once `password.length > 0`, so nothing shows before the user has typed anything. `confirmPasswordError` follows the same gate: only evaluates once `confirmPassword.length > 0` (per user decision — no premature "doesn't match" flash while the second field is still empty).
- `handleSubmit` (`RegisterPage.tsx:30-48`) already early-returns on `passwordError` with a comment explaining why it doesn't also set the banner `error`. Add the same guard for `confirmPasswordError`, same comment pattern.
- New JSX block for the confirm field goes directly after the existing password field (`RegisterPage.tsx:64-68`), same `space-y-half` / `Label` / `Input` / inline-error structure.
- Both password inputs get `autoComplete="new-password"` — enables browser password-manager generate/fill for a *new* password (distinct from `autoComplete="current-password"` used on login), consistent across both fields so the manager fills them together. Pure UX addition, no logic.

## Data flow

`confirmPassword` is local `useState`, compared against `password` on every render — the same reactive-derivation model `passwordError` already uses, so it self-updates correctly if the user edits the first field after already filling the second (no extra effect or memo needed).

## Error handling

No new error class. `getConfirmPasswordError` returns `t.register.passwordMismatch` or `null`, same contract as `getPasswordError`. No server round-trip involved — this is purely a client-side gate before `register(...)` is ever called.

## i18n

Two new keys in `apps/web/src/lib/i18n/en.ts`'s `register` block (after `password`, before `submit`):
- `confirmPassword: 'Confirm password'`
- `passwordMismatch: 'Passwords do not match.'`

## Testing

Extend `apps/web/src/routes/RegisterPage.test.tsx` (mirrors the file's existing password-validation test style):
1. Shows no mismatch error while the confirm field is empty, even if password is filled.
2. Shows the mismatch error once both fields have content and they differ; blocks submission (`register` never called).
3. Error clears once the confirm field is edited to match.
4. Matching passwords submit normally (existing happy-path test extended to fill the new field, or a new one — whichever keeps the existing happy-path test's diff smallest).

## Scope

Explicitly out of scope (YAGNI, not requested): a show/hide password toggle, password-strength meter, or any change to `apps/api`/`packages/contracts/openapi.yaml`.
