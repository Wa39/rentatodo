# Register Confirm-Password Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Confirm password" field to `apps/web/src/routes/RegisterPage.tsx` with live mismatch validation, mirroring the existing password-strength field's pattern exactly.

**Architecture:** One new sibling validation function (`getConfirmPasswordError`, next to the existing `getPasswordError`), one new piece of local state, one new gated derived error, one new submit guard, one new JSX field — each a direct mirror of how the existing `password` field already works in this same file. Two new i18n strings. `autoComplete="new-password"` added to both password inputs.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library (existing patterns in `apps/web`).

## Global Constraints

- No backend or contract change — `RegisterRequest` already only takes one `password`; confirmation is a client-side-only check.
- The mismatch error only appears once BOTH fields have content (`confirmPassword.length > 0` gates it, exactly like `passwordError` is gated by `password.length > 0`) — no premature error while the confirm field is still empty.
- No show/hide password toggle, no password-strength meter — out of scope per the design spec.
- Branch: `feature/web-register-confirm-password` (already cut from `develop`; the design spec commit is already on it).

---

### Task 1: Confirm-password field, validation, and tests

**Files:**
- Modify: `apps/web/src/routes/RegisterPage.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts` (two new keys in the `register` block, lines 27-38)
- Test: `apps/web/src/routes/RegisterPage.test.tsx` (update 5 existing tests, add 3 new ones)

**Interfaces:**
- Consumes: `t.register.confirmPassword`, `t.register.passwordMismatch` (new i18n keys this task also adds).
- Produces: no new exports — this is a self-contained page-level change.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/routes/RegisterPage.test.tsx`, five existing tests type into `'Password'` and then submit or expect a specific outcome that depends on reaching `handleSubmit`. Adding a `required` confirm-password field means these must also fill it with a matching value, or the browser's native constraint validation blocks the submit event before `handleSubmit` ever runs. Update each as follows (each is a one-line insertion right after the existing `Password` line):

Replace the `'registers, auto-logs-in, and navigates straight to /dashboard'` test (lines 45-61) with:

```tsx
  it('registers, auto-logs-in, and navigates straight to /dashboard', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.type(screen.getByLabelText('Confirm password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })
```

Replace the `'shows the API error message and stays on the page when the email is already registered'` test (lines 63-77) with:

```tsx
  it('shows the API error message and stays on the page when the email is already registered', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'email: already registered' } }, 422),
    )
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.type(screen.getByLabelText('Confirm password'), 'securepass123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByText('email: already registered')).toBeInTheDocument())
    expect(screen.getByTestId('status')).toHaveTextContent('out')
  })
```

Replace the `'shows an inline error and blocks submission for a password under 8 characters'` test (lines 79-90) with:

```tsx
  it('shows an inline error and blocks submission for a password under 8 characters', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'short1')
    await user.type(screen.getByLabelText('Confirm password'), 'short1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
```

Replace the `'shows an inline error and blocks submission for 5+ consecutive digits'` test (lines 92-103) with:

```tsx
  it('shows an inline error and blocks submission for 5+ consecutive digits', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'abc12345')
    await user.type(screen.getByLabelText('Confirm password'), 'abc12345')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Password cannot contain 5 or more digits in a row.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
```

Replace the `'allows a password with up to 4 consecutive digits'` test (lines 105-120) with:

```tsx
  it('allows a password with up to 4 consecutive digits', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }, 200))
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcd1234')
    await user.type(screen.getByLabelText('Confirm password'), 'abcd1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in'))
  })
```

Then add these three new tests directly after the (now-updated) `'allows a password with up to 4 consecutive digits'` test, before `'links to /login for users who already have an account'` (line 122):

```tsx
  it('shows no mismatch error while the confirm field is still empty', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Password'), 'securepass123')

    expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
  })

  it('shows a mismatch error and blocks submission when the two passwords differ', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'María Vargas')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.type(screen.getByLabelText('Confirm password'), 'securepass124')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('clears the mismatch error once the confirm field is corrected to match', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Password'), 'securepass123')
    await user.type(screen.getByLabelText('Confirm password'), 'securepass124')
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'securepass123')
    expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/RegisterPage.test.tsx`
Expected: FAIL — `screen.getByLabelText('Confirm password')` throws (no element with that accessible name exists yet), and the three new mismatch tests fail for the same reason.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/i18n/en.ts`, in the `register` block (currently lines 27-38), add `confirmPassword` right after `password` (line 31) and `passwordMismatch` right after `passwordConsecutiveDigits` (line 35):

```ts
  register: {
    title: 'Create account',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    submit: 'Create account',
    submitting: 'Creating account…',
    passwordTooShort: 'Password must be at least 8 characters.',
    passwordConsecutiveDigits: 'Password cannot contain 5 or more digits in a row.',
    passwordMismatch: 'Passwords do not match.',
    hasAccountPrompt: 'Already have an account?',
    loginLink: 'Sign in',
  },
```

In `apps/web/src/routes/RegisterPage.tsx`, add a sibling validation function directly after `getPasswordError` (after line 16):

```tsx
function getConfirmPasswordError(password: string, confirmPassword: string, t: ReturnType<typeof useTranslation>): string | null {
  if (password !== confirmPassword) return t.register.passwordMismatch
  return null
}
```

Add new state directly after `const [password, setPassword] = useState('')` (after line 24):

```tsx
  const [confirmPassword, setConfirmPassword] = useState('')
```

Add the derived error directly after `const passwordError = ...` (after line 28):

```tsx
  const confirmPasswordError = confirmPassword.length > 0 ? getConfirmPasswordError(password, confirmPassword, t) : null
```

In `handleSubmit`, add a second guard directly after the existing `passwordError` guard (after line 38, before `setSubmitting(true)`):

```tsx
    if (confirmPasswordError) {
      // Same reasoning as the passwordError guard above: the inline
      // message under the confirm field already shows this, no need
      // to duplicate it in the banner.
      return
    }
```

Update the existing password `Input` (line 66) to add `autoComplete="new-password"`:

```tsx
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
```

Add the new field directly after the password field's closing `</div>` (after line 68), before the submit `Button` (line 69):

```tsx
        <div className="space-y-half">
          <Label htmlFor="confirmPassword">{t.register.confirmPassword}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {confirmPasswordError && <p className="text-xs text-destructive">{confirmPasswordError}</p>}
        </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/RegisterPage.test.tsx`
Expected: all tests in the file pass (8 existing + 3 new = 11 total).

- [ ] **Step 5: Run the full web test suite and typecheck to check for regressions**

Run: `cd apps/web && npx vitest run && npx tsc -b`
Expected: all tests pass, no type errors. (`RegisterPage` is not imported by any other test file's mocks, so this change should be fully isolated — confirm that assumption holds.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/RegisterPage.tsx apps/web/src/lib/i18n/en.ts apps/web/src/routes/RegisterPage.test.tsx
git commit -m "feat(web): add confirm-password field to register form"
```

---

### Task 2: Manual verification, push, open PR

**Files:** None (verification + git/PR operations only).

- [ ] **Step 1: Manually verify in the browser**

With the web dev server running (`cd apps/web && npm run dev`):

1. Open `/register`. Type a password. Confirm no error shows yet with the confirm field still empty.
2. Type a different value into "Confirm password". Confirm the red "Passwords do not match." message appears under that field, and clicking "Create account" does not submit (no navigation, no network call needed to observe this — the button click should just leave you on the page).
3. Correct the confirm field to match. Confirm the error disappears without needing to click anything else.
4. Submit with matching passwords and confirm registration proceeds normally (existing register flow, unchanged).

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feature/web-register-confirm-password
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base develop --title "feat(web): add confirm-password field to register form" --body "$(cat <<'EOF'
## Summary
- Adds a "Confirm password" field to the register form, mirroring the existing password-strength field's validation pattern exactly (sibling `getConfirmPasswordError`, same gating-once-non-empty logic, same submit-guard shape).
- Mismatch error only appears once both fields have content — no premature validation noise while the user is still typing.
- Both password inputs now carry `autoComplete="new-password"`, enabling browser password-manager generate/fill.
- Client-side only — no backend or contract change (`RegisterRequest` still takes a single `password`).

## Test plan
- 5 existing `RegisterPage.test.tsx` tests updated to fill the new required field; 3 new tests cover the mismatch/no-premature-error/clears-on-correction behavior.
- Full `apps/web` suite green, `tsc -b` clean.
- Manually verified in the browser: no premature error, mismatch blocks submit, error clears on correction, matching passwords submit normally.
EOF
)"
```
