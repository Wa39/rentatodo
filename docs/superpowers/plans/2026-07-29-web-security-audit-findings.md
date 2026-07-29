# apps/web Security Audit — Findings

Audit date: 2026-07-29
Scope: apps/web only (per root CLAUDE.md ownership split). apps/api/apps/mobile findings are logged, not fixed.

---

## Task 1: Dependency vulnerability scan

### Summary
Ran `pnpm audit` on entire workspace (root lockfile; all apps included). Filtered findings to apps/web scope only. Found 1 Critical and 1 High severity advisory requiring review.

### Command run
```bash
pnpm audit
```

### Findings

#### Finding 1.1 — Critical

**Package:** vitest  
**Current version:** 2.1.9 (via package.json constraint `^2.1.4`)  
**Vulnerable versions:** <3.2.6  
**Patched versions:** >=3.2.6  
**Dependency type:** Direct (devDependencies)  
**Severity:** Critical  
**Description:** When Vitest UI server is listening, arbitrary file can be read and executed

**Advisory link:** https://github.com/advisories/GHSA-5xrq-8626-4rwp

**Status:** Flagged — needs product decision  
**Recommended target version:** >=3.2.6 (or higher semver-compatible)

---

#### Finding 1.2 — High

**Package:** vite  
**Current version:** 5.4.21 (transitive via vitest → vite)  
**Vulnerable versions:** <=6.4.2  
**Patched versions:** >=6.4.3  
**Dependency type:** Transitive (vitest > vite; direct vite@^8.1.1 in devDependencies is not vulnerable)  
**Severity:** High  
**Description:** `server.fs.deny` bypass on Windows alternate paths

**Advisory link:** https://github.com/advisories/GHSA-fx2h-pf6j-xcff

**Status:** Flagged — needs product decision  
**Recommended target version:** >=6.4.3 (or upgrade vitest to pull in non-vulnerable vite)

---

### Notes

- The direct vite@^8.1.1 in apps/web devDependencies is not vulnerable; the High finding refers to vite@5.4.21 which is pulled in transitively by vitest's internal dependencies.
- Audit exit code: 1 (expected when vulnerabilities are found).
- Total advisories found across all workspaces: 8 (1 Critical, 1 High, 6 Moderate). Only Critical and High listed per task requirements.

---

## Task 2: Auth token & session handling

### Summary

Reviewed `apps/web/src/lib/AuthContext.tsx`, `apps/web/src/components/RequireAuth.tsx`, and `apps/web/src/lib/api.ts` for where the JWT access token is stored client-side, whether the client proactively manages expiry, and whether `logout()` fully clears the token. All cited line numbers were confirmed against the current source, not copied blindly from the task brief.

`RequireAuth.tsx:5-11` gates routes purely on `isAuthenticated` (`token !== null` in `AuthContext.tsx:92`) — it does not itself validate token format or expiry, which is consistent with the reactive-only expiry handling documented in Finding 2.1.

### Finding 2.1 — Medium

**Title:** Auth — JWT stored in `localStorage`, no proactive expiry handling

- **Severity:** Medium
- **Evidence:**
  - `apps/web/src/lib/AuthContext.tsx:24` — `useState<string | null>(() => localStorage.getItem(TOKEN_KEY))`, the token is read from `localStorage` at mount.
  - `apps/web/src/lib/AuthContext.tsx:69` — `localStorage.setItem(TOKEN_KEY, result.access_token)` in `login()`.
  - `apps/web/src/lib/AuthContext.tsx:84` — `localStorage.setItem(TOKEN_KEY, result.access_token)` in `register()`.
  - `apps/web/src/lib/api.ts:16-20` — `LoginResult.expires_in` is returned by the login endpoint but is never read anywhere in `apps/web/src` outside of type declarations and test fixtures (confirmed via `grep -rn expires_in apps/web/src`); no `setTimeout`/`setInterval` exists anywhere in `apps/web/src` (confirmed via `grep -rn "setTimeout\|setInterval" apps/web/src`, zero matches).
  - `apps/web/src/lib/api.ts:76-79` and `apps/web/src/lib/AuthContext.tsx:36-43` — expiry is discovered only reactively: `request()` dispatches a `rentatodo:token-expired` `CustomEvent` when a response body has `error.code === 'TOKEN_EXPIRED'`, and `AuthContext` listens for that event and calls `logout()`. This only fires after a real API call returns a 401/expired response — nothing checks expiry ahead of time.
- **Description:** The access token lives in `localStorage`, readable by any JS running on the page — a stored/reflected XSS anywhere on this origin (including in a dependency) would let an attacker exfiltrate the token and impersonate the user until it expires (24h per `apps/api`'s `create_access_token`, confirmed separately in Task 9). The client never schedules its own expiry check against `expires_in`; an expired or invalid token is only discovered reactively, via a `TOKEN_EXPIRED`-coded error on the next API call, not proactively. In the interim (e.g., between an old token expiring and the user's next API call), `RequireAuth` will still treat the user as authenticated and render protected routes, since it only checks token presence.
- **Recommendation:** Longer-term, move to an httpOnly, Secure, SameSite=Strict cookie set by `apps/api` on login (removes JS readability entirely) — this needs a coordinated `apps/api` change (login/refresh endpoints, CORS `credentials` mode) and is out of scope for `apps/web` alone. Shorter-term and in-scope: nothing to fix here without weakening UX; document the accepted risk.
- **Status:** Flagged — needs `apps/api` change (and a product decision on session UX)

### Finding 2.2 — No action needed

**Title:** Auth — `logout()` fully clears token from both React state and `localStorage`

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - `apps/web/src/lib/AuthContext.tsx:45-49`:
    ```ts
    function logout() {
      setToken(null)
      setUser(null)
      localStorage.removeItem(TOKEN_KEY)
    }
    ```
  - `grep -n "rentatodo_token\|localStorage" apps/web/src/lib/AuthContext.tsx` confirms `TOKEN_KEY` (`'rentatodo_token'`) is the only storage key ever written by production code, and `grep -rn "localStorage" apps/web/src --include=*.tsx --include=*.ts` (excluding `*.test.*` files) confirms `AuthContext.tsx` is the only production source file that touches `localStorage` — no other module holds a second copy of the token.
- **Description:** `logout()` clears the in-memory `token` state, the in-memory `user` state, and the `rentatodo_token` `localStorage` key in a single synchronous call — there is no code path where one is cleared without the other. The same function is invoked both from the explicit logout button (`apps/web/src/layouts/DashboardLayout.tsx:108`) and reactively from the `rentatodo:token-expired` listener (`AuthContext.tsx:36-43`) and from failed profile/login fetches (`AuthContext.tsx:61,74`), so all logout/expiry paths converge on the same complete cleanup. No other storage key or cache in `apps/web/src` production code retains the token after logout.
- **Recommendation:** None.
- **Status:** No action needed — verified complete.

---

## Task 3: XSS surface

### Summary

Grepped `apps/web/src` for the classic unsafe-render sinks (`dangerouslySetInnerHTML`, `.innerHTML =`, `document.write`, `eval(`, `new Function(`) — zero matches. Then traced every `<img src>`/`href` binding to a user-controlled value to find where `item.photo_url` (owner-set) actually gets rendered, and confirmed the web app has no free-text URL input anywhere — `photo_url` can only be set through the file-upload flow, which returns a server-generated `public_url`.

### XSS — no unsafe DOM sinks found

- **Severity:** Info
- **Evidence:** `grep -rn "dangerouslySetInnerHTML\|\.innerHTML\s*=\|document\.write\|eval(\|new Function(" apps/web/src` — zero matches as of 2026-07-29 (ran it myself, not just trusting the brief).
- **Description:** React's default JSX text/attribute interpolation escapes content, and this codebase doesn't opt out of that anywhere. No component bypasses React's rendering to inject raw HTML or strings.
- **Recommendation:** Keep it this way — flag any future PR introducing `dangerouslySetInnerHTML` (or similar) for review.
- **Status:** No action needed

### `photo_url` rendered as `<img src>` with no client-side scheme validation; relies entirely on backend `format: uri` enforcement

- **Severity:** Low
- **Evidence:**
  - `apps/web/src/components/ItemCard.tsx:25-33` — `<img src={item.photo_url} ... />`, rendered unconditionally whenever `item.photo_url` is truthy, with no scheme check.
  - `apps/web/src/components/PhotoUploadField.tsx:62-63` — `<img src={preview} .../>`, where `preview` is either the existing `value` prop (an already-stored `item.photo_url`, on edit) or a `data:` URL produced locally by `FileReader.readAsDataURL(file)` (`PhotoUploadField.tsx:17-24,41`) from a file the same user just picked — never remote/attacker-supplied.
  - `grep -rn "href=" apps/web/src --include=*.tsx` (excluding tests) — zero matches in production code; the app uses React Router `<Link to="...">` exclusively (all internal, static/computed-from-ID paths, e.g. `ItemCard.tsx:71`), never a raw `<a href={...}>` bound to user data. So there is no `href`-based sink to worry about, only the two `<img src>` sinks above.
  - Confirmed the web app itself never accepts `photo_url` as free text: `apps/web/src/routes/PublishItemPage.tsx` and `apps/web/src/routes/ItemsPage.tsx` both only ever set `photoUrl`/`form.photoUrl` via `PhotoUploadField`'s `onChange`, which is called with `publicUrl` returned from `uploadPhoto()` (`apps/web/src/lib/uploadPhoto.ts:46-78`) — i.e., `presign.public_url` from `POST /uploads/presign`, an S3-generated URL, not user-typed text. `grep -rn "photo_url\|href={" apps/web/src/components apps/web/src/routes` turned up no `<Input>` or text field bound to a photo URL.
  - `packages/contracts/openapi.yaml` — `photo_url` is declared `type: string, format: uri` on `CreateItemRequest`, `UpdateItemRequest`, `Item`, `Reservation.item_photo_url`, `CheckInOutRequest`, `CreateReportRequest`, and `Report` (confirmed via `grep -n "photo_url" -A2 packages/contracts/openapi.yaml`).
- **Description:** The only remote-URL-controlled sink in `apps/web` is `<img src={item.photo_url}>` in `ItemCard.tsx`. Through the web UI itself, this value can never be attacker-chosen free text — it's always a `public_url` minted by `apps/api`'s presign flow after a real image upload. The residual exposure is items whose `photo_url` was set by some *other* client of the same API (mobile app, direct API call, a future integration) that doesn't go through this web app's upload flow: `apps/web` applies no client-side check on the URL's scheme before handing it to `<img src>`, so it fully trusts whatever `apps/api` returns for that field. `format: uri` in the OpenAPI contract only requires URI *syntax* — it does not by itself guarantee an `http(s)` scheme (`javascript:alert(1)` is syntactically a valid URI), so whether a `javascript:`-scheme value could ever reach this field depends on `apps/api`'s actual validator, which is out of scope here (apps/web-only) and is `apps/api` code, not something this task inspects. Practically, this is low severity regardless: modern browsers do not execute `javascript:` URIs used as an `<img src>` (unlike `<a href>`, which this app doesn't use with dynamic values anywhere), so even a maliciously-crafted `photo_url` reaching this sink would fail to load as an image rather than execute script. There's no `<a href>` sink in the app at all to make a `javascript:` URL clickable.
- **Recommendation:** No fix required given the current sink (`<img src>`) doesn't execute `javascript:` URIs and the web app's own upload flow can't produce one. As defense-in-depth, if `apps/web` ever adds a scenario where `photo_url`-like values are rendered in an `<a href>` or where the app accepts free-text URLs (e.g., a "paste an image URL" fallback), validate the scheme is `http`/`https` client-side before rendering, rather than relying solely on the backend's `format: uri` check. Confirm with `apps/api`'s owner (cross-referenced separately in Task 9) that its `photo_url` validation actually restricts the scheme, not just URI syntax.
- **Status:** No action needed in `apps/web` — informational; recommend confirming `apps/api`'s scheme validation as part of Task 9's cross-boundary review.

---

## Task 4: Form input validation

### Summary

Traced every client-side constraint on `PublishItemPage.tsx`, `ItemsPage.tsx`'s edit dialog, `RegisterPage.tsx`, and `LoginPage.tsx`, then cross-checked each against the backend's actual enforcement: `packages/contracts/openapi.yaml`'s `CreateItemRequest`/`UpdateItemRequest`/`RegisterRequest` schemas, and — since the calibration note requires confirming rather than guessing whether a gap is client-only — the real Pydantic schemas and business logic in `apps/api/app/schemas/item.py`, `apps/api/app/schemas/auth.py`, `apps/api/app/models/item.py`, `apps/api/app/services/items.py`, and the validation-error handler in `apps/api/app/main.py`.

Bottom line: every field the web UI can submit is also independently validated by the backend (Pydantic field constraints, a DB `CheckConstraint`, or both), and 422 `VALIDATION_ERROR` responses are not swallowed anywhere — they propagate from `request()` in `apps/web/src/lib/api.ts` through `ItemsContext.tsx`'s `addItem`/`updateItem` (no try/catch there) to the calling page's `catch` block, which calls `setError`/`setDialogError` and renders the message via `AuthErrorBanner`. No Medium+ findings; three Low/Info items below, all UX-only.

### Finding 4.1 — Low

**Title:** Item price field's only client-side guard is native `<input type="number">` browser validation; the specific NaN scenario in the task brief is not actually reachable

**Severity:** Low
**Evidence:**
- `apps/web/src/routes/PublishItemPage.tsx:100-108` and `apps/web/src/routes/ItemsPage.tsx:147-155` — the price `<Input>` is `type="number" min={0.01} step={0.01} required`, with no custom `onBlur`/inline JS validation and no `noValidate` on either `<form>` (confirmed via `grep -n "noValidate" apps/web/src/routes/PublishItemPage.tsx apps/web/src/routes/ItemsPage.tsx` — zero matches). This means invalid values (empty, negative, non-multiple-of-step) are rejected by the browser's native constraint validation *before* the `submit` event fires, so `handleSubmit` never runs for those cases through normal keyboard/mouse interaction — but that's a browser UI behavior, not a JS check the app owns, and it's trivially bypassed by anyone submitting the request directly (curl/Postman/devtools), which is expected and fine since the backend re-validates (see below).
- `apps/web/src/routes/PublishItemPage.tsx:37,55` and `apps/web/src/routes/ItemsPage.tsx:62` — the price is computed client-side as `Math.round(Number(priceDollars || '0') * 100)` (Publish) / `Math.round(Number(form.priceDollars) * 100)` (edit dialog), sent verbatim as `price_per_day` in the request body.
- I verified the brief's specific "non-numeric string typed into the field" scenario directly: for a native `<input type="number">`, the DOM only ever exposes a value through `.value` that is either a syntactically valid floating-point number or the empty string — invalid keystrokes are rejected by the browser itself (or leave `.value` at `""` with `validity.badInput = true`), so `e.target.value` (what `setPriceDollars`/`setForm` ever receives, per the `onChange` handlers at `PublishItemPage.tsx:106` and `ItemsPage.tsx:153`) can never itself be a non-numeric garbage string. `Number('')` evaluates to `0`, not `NaN`. So `Math.round(Number(priceDollars) * 100)` cannot actually produce `NaN` through this input under normal or malicious *browser UI* use — the realistic bad values reaching state are `0` (empty field, blocked by `required` unless bypassed) and negative numbers (typable — a leading `-` is not rejected while typing — but blocked on submit by `min={0.01}` unless bypassed).
- `apps/api/app/schemas/item.py:32` — `CreateItemRequest.price_per_day: int = Field(..., gt=0, ...)`; `apps/api/app/schemas/item.py:45-47` — `UpdateItemRequest.price_per_day: int | None = Field(None, gt=0, ...)`. Both reject `0`, negative integers, and (since the field type is `int`, not `float`) any non-integer/`null` payload with a 422.
- `apps/api/app/models/item.py:48` and `apps/api/alembic/versions/edb3d65c0dce_create_items_table.py:44` — `CheckConstraint("price_per_day > 0", ...)` at the DB layer too, so even a hypothetical future write path that skips the Pydantic schema is still blocked.
- `packages/contracts/openapi.yaml:134-137` (`CreateItemRequest.price_per_day`) and `:155-157` (`UpdateItemRequest.price_per_day`) both declare `type: integer, minimum: 1`, consistent with the Pydantic `gt=0`.
- One real (if narrow) edge case on the PATCH path specifically: `apps/api/app/services/items.py:257-258` — `if data.price_per_day is not None: item.price_per_day = data.price_per_day`. Per `UpdateItemRequest`'s own docstring (`apps/api/app/schemas/item.py:37-39`), an explicit JSON `null` for `price_per_day` is defined to mean "leave unchanged", not "invalid". `JSON.stringify` turns a JS `NaN` into `null`. So *if* `form.priceDollars` could ever become a JS value that stringifies as `NaN` (which, per the point above, it practically cannot through this `<input type="number">`), the edit-dialog's `PATCH /items/{id}` would silently keep the old price and return 200, not a 422 — the one scenario in this task where a bad client value would *not* surface an error, because the backend's own contract treats `null` as "no-op" rather than "reject". This is real but unreachable via the current UI (no free-text/non-numeric price entry point exists), so it doesn't rise above Low.
- **User feedback:** `apps/api/app/main.py:48-74` — `RequestValidationError` is translated into `{"error": {"code": "VALIDATION_ERROR", "message": "price_per_day: Input should be greater than 0"}}` (per-field, not generic), which reaches the UI via `apps/web/src/lib/api.ts:75-80` (`ApiError` thrown with `body.error.message`) → `ItemsPage.tsx:73-74` / `PublishItemPage.tsx:59-60` (`catch (err) { setDialogError(getErrorMessage(err, ...)) }` / `setError(...)`) → `AuthErrorBanner` renders it (`apps/web/src/components/AuthErrorBanner.tsx:1-4`). Confirmed no swallowed rejection anywhere in this chain — `ItemsContext.tsx:74-84`'s `addItem`/`updateItem` have no `try/catch`, so a thrown `ApiError` propagates straight to the page's own `catch`.
- **Description:** The price field has no custom client-side validation beyond native HTML attributes, and relies entirely on the backend (Pydantic `gt=0` + DB `CheckConstraint`) as the actual security boundary — which is correct and is confirmed working: a bypassed negative/zero/invalid price is rejected with a specific 422 message that reaches the user, not a silent failure. The brief's hypothesized NaN case is not reachable through this specific `<input type="number">` implementation under normal or malicious browser use, so no separate finding is needed for it beyond documenting the one PATCH-only theoretical gap (null-means-unchanged) above, which requires a value that cannot currently be produced by this UI.
- **Recommendation:** No fix required — the backend is the real enforcement point and it works correctly. Optional, non-security polish: add an inline client-side message (e.g., "Price must be greater than $0") for a nicer UX than the generic 422 banner text, and/or `noValidate` + custom validation for a consistent cross-browser error style. Not urgent.
- **Status:** No action needed — verified backend enforcement is complete and errors surface correctly.

### Finding 4.2 — No action needed

**Title:** API validation errors (422) surface to the user on both the publish and edit-item forms — confirmed, not silent

**Severity:** N/A (verified correct, no action needed)
**Evidence:**
- `apps/web/src/lib/api.ts:68-82` — `request()` always throws an `ApiError` (with the backend's `error.code`/`error.message`) for any non-`ok` response; there is no swallowed-error path.
- `apps/web/src/lib/ItemsContext.tsx:74-84` — `addItem`/`updateItem`/`deleteItem` `await` the API call directly with no `try/catch`, so a rejection propagates unmodified to the caller.
- `apps/web/src/routes/PublishItemPage.tsx:45,59-60` — `handleSubmit`'s `catch (err) { setError(getErrorMessage(err, t.errors.network)) }`, rendered via `<AuthErrorBanner message={error} />` at line 75.
- `apps/web/src/routes/ItemsPage.tsx:56,73-74` — same pattern for the edit dialog: `catch (err) { setDialogError(getErrorMessage(err, t.errors.network)) }`, rendered via `<AuthErrorBanner message={dialogError} />` at line 116.
- `apps/web/src/routes/RegisterPage.tsx:30,43-44` and `LoginPage.tsx:21,28-29` follow the identical pattern for auth 422s (e.g., "Email is already registered" from `apps/api/app/services/auth.py:102,110`).
- **Description:** Every form traced in this task (publish item, edit item, register, login) follows the same error-propagation chain: `request()` throws → context/hook re-throws unmodified → page's `catch` sets local error state → `AuthErrorBanner` renders it. There is no form where a 422 is caught and discarded, and no form where the submit button silently re-enables with no feedback. This holds for both a genuinely invalid payload (e.g., duplicate email) and the price-validation case in Finding 4.1.
- **Recommendation:** None — keep this pattern for any new forms.
- **Status:** No action needed — verified complete.

### Finding 4.3 — Low

**Title:** Register password's "no 5+ consecutive digits" rule is enforced only client-side; not present in the backend schema (harmless mismatch, not a vulnerability)

**Severity:** Low
**Evidence:**
- `apps/web/src/routes/RegisterPage.tsx:12-16` — `getPasswordError` rejects passwords shorter than 8 chars (`password.length < 8`) and passwords containing 5+ consecutive digits (`/\d{5,}/.test(password)`), blocking submission client-side at line 33-38 without even calling the API.
- `apps/api/app/schemas/auth.py:16-24` — `RegisterRequest.password: str = Field(..., min_length=8, max_length=72, ...)`. No regex/pattern constraint exists anywhere in the backend schema — confirmed via `grep -n "password" apps/api/app/schemas/auth.py` and reading the full file, only `min_length`/`max_length` are present.
- `packages/contracts/openapi.yaml:60-65` (`RegisterRequest.password`) likewise only documents `minLength: 8`, `maxLength: 72` — no complexity pattern in the contract either.
- **Description:** The consecutive-digits rule is a client-added restriction with no backend counterpart. Because it makes the client *stricter* than the server, not weaker, there's no security gap: a password that passes the client check would also pass the server (the server has no rule to fail), and there's no code path where the client's extra rule is relied upon as a security control that the server skips. The only practical effect is that a user hitting this app's UI is blocked from using an otherwise-valid (by contract) password containing 5+ consecutive digits, while the same password would be accepted by `apps/mobile` or a direct API call — a product/UX consistency question, not a security one.
- **Recommendation:** No action needed for security. If the consecutive-digits rule is an intentional password-strength policy, it should be added to `RegisterRequest` in `packages/contracts/openapi.yaml` and enforced server-side too (per-`apps/api`-owner decision, requires a contract PR per root `CLAUDE.md`); if it isn't intentional, consider removing it from the client to avoid confusing users. Either way this is a product decision, not a fix to apply in this audit.
- **Status:** No action needed in `apps/web` — informational; flag for a product decision on whether this rule should be codified in the contract.

### Finding 4.4 — Info

**Title:** Password max length (72 chars, bcrypt limit) and item name/description whitespace-only values are enforced server-side but have no client-side hint

**Severity:** Info
**Evidence:**
- `apps/web/src/routes/RegisterPage.tsx:66` — the password `<Input>` has no `maxLength={72}` attribute and `getPasswordError` (lines 12-16) doesn't check an upper bound. A password longer than 72 characters is submitted as-is.
- `apps/api/app/schemas/auth.py:16-24` — `max_length=72` is enforced server-side (this is the same bcrypt-truncation limit noted as already fixed in the presign schema per the task brief's own note); a >72-char password gets a 422, which — per Finding 4.2 — surfaces correctly via `AuthErrorBanner`.
- `apps/web/src/routes/PublishItemPage.tsx:78,119` and `apps/web/src/routes/ItemsPage.tsx:119,127` — `name`/`description` `<Input>`s only have `required`, no `minLength`/whitespace-trim check. HTML5 `required` treats a single space `" "` as non-empty, so it passes native validation.
- `apps/api/app/schemas/item.py:29-30,42-43` — backend `min_length=1` also only counts raw string length, so `" "` (one space) satisfies it too — the backend doesn't trim/reject whitespace-only values either.
- **Description:** Two minor gaps, both non-security: (1) no client-side password length ceiling, but the backend enforces one and the error surfaces correctly, so this is pure UX robustness, not a bypass; (2) whitespace-only item names/descriptions pass both client and backend checks identically (both only check raw length ≥ 1), so this isn't a client-vs-backend mismatch at all — it's a shared minor data-quality gap in the contract itself, out of scope for an `apps/web`-only fix.
- **Recommendation:** Optional UX polish: add `maxLength={72}` to the password `<Input>` with an inline counter/hint. The whitespace-only-name gap, if worth fixing at all, belongs in the shared contract/backend validation (e.g., a `pattern` or backend `.strip()` check), not in `apps/web` alone.
- **Status:** No action needed in `apps/web` — informational.
