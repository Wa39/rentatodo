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

---

## Task 5: File upload security

### Summary

Traced the full upload path: `apps/web/src/components/PhotoUploadField.tsx` → `apps/web/src/lib/uploadPhoto.ts` → `apiPresignUpload` in `apps/web/src/lib/api.ts` → `POST /uploads/presign` → `apps/api/app/routers/uploads.py` → `apps/api/app/services/uploads.py`'s `generate_presign` (read-only reference, not modified). Confirmed the client never supplies or influences the S3 key/bucket (server-generated from `user_id` + a fresh UUID), and confirmed the presigned-PUT content-length gap still exists in `apps/api` as an open `TODO`, tracked here per the task brief. One documentation inconsistency found between the OpenAPI contract and the actual `apps/api` implementation (informational, `apps/api`-owned).

### Finding 5.1 — Info

**Title:** Client-side file-type/size checks in the upload path are real but explicitly documented as UX-only, not a security boundary — correctly designed

- **Severity:** Info
- **Evidence:**
  - `apps/web/src/components/PhotoUploadField.tsx:65-73` — the `<input type="file">` itself only has `accept="image/jpeg,image/png,image/webp"` (line 69); `grep -n "accept=\|type\.startsWith\|size\|MAX" apps/web/src/components/PhotoUploadField.tsx` confirms no size cap and no MIME-type re-check live in this component — the `accept` attribute is a file-picker UI filter only (trivially bypassed via "All Files" or a renamed extension) and this component doesn't pretend otherwise.
  - The actual client-side checks live one layer down, in `apps/web/src/lib/uploadPhoto.ts`, which `PhotoUploadField.tsx:42` calls: `MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024` (line 3), an allow-list `isUploadContentType` check against `file.type` (lines 17-19, 47-49), a real magic-byte signature check per content type (`SIGNATURE_CHECKS`, lines 7-15, invoked at lines 53-55), and an actual browser decode via `createImageBitmap(file)` (lines 56-60) — stronger than the typical "just check `accept`" pattern.
  - `apps/web/src/lib/uploadPhoto.ts:35-45` — the function's own docstring states this explicitly: *"These client-side checks are a UX safeguard against accidental/casual misuse... they are NOT a security boundary. Anyone can call POST /uploads/presign and PUT directly, bypassing all of this. Real content/malware scanning needs to happen server-side (apps/api or infra), out of scope here."*
- **Description:** The client-side validation is more thorough than a bare `accept=` attribute (magic-byte + decode checks catch a renamed non-image file, not just a mislabeled `Content-Type`), but it's still enforced entirely in JS that an attacker fully controls — anyone can skip `apps/web` and call `POST /uploads/presign` plus the resulting presigned `PUT` directly (e.g., via curl), sending any `content_type` in the enum and any actual bytes. The code already documents this correctly and doesn't claim otherwise.
- **Recommendation:** None for `apps/web` — the checks are correctly scoped as UX-only and the code says so. Real content-type/malware enforcement, if desired, is an `apps/api`/infra decision (out of scope here).
- **Status:** No action needed — verified correctly designed and honestly documented.

### Finding 5.2 — No action needed

**Title:** Presign flow cannot be abused for path traversal or arbitrary bucket/key writes — client only ever sends `filename` (informational, unused) and `content_type`; the S3 key is entirely server-generated

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - `apps/web/src/lib/uploadPhoto.ts:62` — `const presign = await apiPresignUpload(token, file.name, file.type)`.
  - `apps/web/src/lib/api.ts:132-138` — `apiPresignUpload(token, filename, contentType)` POSTs `JSON.stringify({ filename, content_type: contentType })` to `/uploads/presign` with the caller's bearer token; `apps/web/src/lib/api.ts:46,48-52` — `UploadContentType` is a closed union (`'image/jpeg' | 'image/png' | 'image/webp'`) and `PresignResponse` only exposes `upload_url`, `public_url`, `expires_in` back to the client — there is no `key`, `bucket`, or path field the client sends or receives that it could manipulate.
  - `apps/api/app/routers/uploads.py:13-30` — `presign_upload` requires `current_user: User = Depends(get_current_user)` (i.e., a valid JWT — presign cannot be called anonymously) and calls `generate_presign(user_id=current_user.id, content_type=data.content_type.value)`; `current_user.id` comes from the resolved JWT, never from the request body.
  - `apps/api/app/services/uploads.py:25-41` (read-only, confirmed by reading, not from memory) — `generate_presign`'s `key = f"uploads/{user_id}/{uuid.uuid4()}.{extension}"` is built entirely from the server-resolved `user_id` and a freshly generated `uuid.uuid4()`; `extension` comes only from `CONTENT_TYPE_EXTENSIONS[content_type]` (lines 14-18), a fixed server-side map (`{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}`), never from the client-supplied `filename`. The module's own comment at lines 19-22 states this is intentional: *"The extension always comes from here, never from the client-supplied filename — avoids path traversal / unsafe characters entirely."*
  - `apps/api/app/schemas/upload.py:18-26` — `PresignRequest.filename` is accepted (`min_length=1`) but its `Field(...)` description says outright: *"Not used to derive the S3 key in this implementation — the key is built from the authenticated user's id and a generated identifier instead."* `grep -rn "filename" apps/api/app/schemas/upload.py apps/api/app/routers/uploads.py` confirms `filename` is never read anywhere past the schema field itself (the router docstring at `uploads.py:20-21` calls it "informational only").
- **Description:** There is no client-controllable input anywhere in this flow that reaches the S3 key, bucket, or path. The client sends `filename` (accepted by the schema but provably discarded) and `content_type` (validated against a closed enum before use); the server derives the entire key from server-side state (`user_id` from the JWT, a fresh UUID, and a fixed extension lookup). A malicious `filename` like `../../../other-user/secret.jpg` or a path-traversal payload has no effect — it's never read. This fully prevents path traversal, overwriting another user's object, or writing outside the `uploads/{user_id}/` prefix.
- **Recommendation:** None. This is a well-designed, defense-in-depth key-generation scheme (ignoring client input entirely rather than trying to sanitize it) and should be kept as the pattern for any future presigned-upload endpoints.
- **Status:** No action needed — verified complete.

### Finding 5.3 — Info

**Title:** OpenAPI contract's description of `PresignRequest.filename` contradicts the actual (safer) `apps/api` implementation — documentation-only inconsistency, `apps/api`-owned

- **Severity:** Info
- **Evidence:**
  - `packages/contracts/openapi.yaml:392-396` — `PresignRequest.filename` is documented as: `description: "Original filename. Used to derive the S3 key."`
  - `apps/api/app/services/uploads.py:19-22` and `apps/api/app/schemas/upload.py:21-25` (both read-only, confirmed above in Finding 5.2) — the actual implementation explicitly does **not** use `filename` to derive the key; the extension comes from a fixed `content_type` → extension map, and the key is `uploads/{user_id}/{uuid4()}.{extension}`.
- **Description:** The contract text is stale/inaccurate relative to what `apps/api` actually built (and the actual behavior is the more secure of the two — it's the contract's wording that's wrong, not the code). This has no security impact on `apps/web` today since `apps/web` doesn't rely on the contract's claim for anything, but it's worth flagging so a future contributor reading only the contract doesn't assume `filename` is meaningful/trusted server input.
- **Recommendation:** Update `packages/contracts/openapi.yaml:395`'s description to match the real behavior (e.g., "Original filename, informational only — not used to derive the S3 key"). This is a `packages/contracts/openapi.yaml` change and, per root `CLAUDE.md`, requires an approved PR reviewed by all consumers (apps/api, apps/web, apps/mobile) — not something to change unilaterally in this `apps/web`-scoped audit.
- **Status:** Flagged — documentation fix needed in `packages/contracts/openapi.yaml` (out of scope to apply here; apps/api-owned code confirms the safer actual behavior).

### Finding 5.4 — Medium

**Title:** Presigned S3 `PUT` has no server-side content-length enforcement — confirmed still open in `apps/api`'s own `TODO`; `apps/web`'s 5 MB client check is trivially bypassable since anyone can call the presign endpoint directly

- **Severity:** Medium
- **Evidence:**
  - `apps/api/app/services/uploads.py:43-48` (read-only, confirmed by reading the current file, not from memory of a prior session):
    ```python
    # TODO: presigned PUT does not support a ContentLengthRange condition —
    # S3 will accept an upload of any size. To enforce a size cap (e.g. 10 MB)
    # switch to generate_presigned_post() (presigned POST supports a
    # content-length-range policy condition). That change requires updating
    # the PresignResponse schema and the /uploads/presign contract in
    # packages/contracts/openapi.yaml.
    ```
    This TODO is still present and unresolved as of 2026-07-29; `generate_presigned_url("put_object", ...)` (lines 49-57) is called with no size constraint of any kind.
  - `apps/web/src/lib/uploadPhoto.ts:3,50-52` — `apps/web`'s only size guard is `MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024` checked client-side before calling `apiPresignUpload`. Per Finding 5.1/5.2, this check (and the whole `apps/web` app) is entirely bypassable: any authenticated user (presign requires a valid JWT per `apps/api/app/routers/uploads.py:16`, confirmed in Finding 5.2) can call `POST /uploads/presign` directly and then `PUT` a file of any size to the returned `upload_url` — S3 will accept it since the signed policy carries no `ContentLengthRange`.
  - `grep -rln "rate.?limit\|RateLimit\|slowapi\|limiter" apps/api` — zero matches; there is no rate limiting anywhere in `apps/api` that would otherwise throttle repeated presign/upload calls and cap the blast radius of this gap.
- **Description:** A malicious authenticated user can presign and upload arbitrarily large objects (e.g., multi-GB files) to the app's S3 bucket, repeatedly, with no server-side size cap and no rate limit to slow them down. This is a storage-cost / resource-exhaustion (DoS-by-cost) risk, not a data-confidentiality issue — it doesn't let anyone read another user's data or escape the `uploads/{user_id}/` prefix (Finding 5.2 already confirms that boundary holds). Severity is Medium rather than High because it requires authentication (not open to anonymous callers) and doesn't compromise other users' data, but it's a real, unauthenticated-by-size resource abuse vector with no mitigating control anywhere in the stack today.
  This is entirely `apps/api` code (`generate_presign` in `apps/api/app/services/uploads.py`) — `apps/web` has no ability to fix it from its side beyond the client-side 5 MB check it already has, which is correctly UX-only per Finding 5.1 and cannot be the real enforcement point.
- **Recommendation:** `apps/api`-owned fix, already scoped in its own TODO: switch to `generate_presigned_post()` with a `content-length-range` policy condition (e.g., cap at 5-10 MB to match `apps/web`'s existing UX expectation), which requires updating `PresignResponse`'s schema and the `/uploads/presign` contract in `packages/contracts/openapi.yaml` (per root `CLAUDE.md`, needs an approved cross-consumer PR). Until then, consider this an accepted/tracked risk. Not fixable within this `apps/web`-scoped audit.
- **Status:** Flagged — needs `apps/api` fix (tracked here per task brief; pre-existing gap, not introduced or fixable by `apps/web`).

---

## Task 6: Secrets & environment hygiene

### Summary

Scanned `apps/web/src` for hardcoded credentials (keys, tokens, passwords, secrets) using regex grep with a minimum 8-character threshold to filter out test fixtures. Verified `.env` is gitignored and `.env.example` contains only placeholders. Confirmed Vite's `VITE_` prefix convention is used correctly for the single required environment variable, exposing no sensitive data to the client bundle. No credentials found.

### Findings

#### Finding 6.1 — No action needed

**Title:** Environment variables and secrets handling — no hardcoded credentials found; .env properly gitignored; VITE_ prefix correctly applied

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - **Hardcoded secrets grep:** `grep -rniE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{8,}" apps/web/src --include="*.ts" --include="*.tsx" | grep -v ".test.ts"` returned only two matches in `apps/web/src/lib/i18n/en.ts:21` and `:31`, both being UI labels (`password: 'Password'` in i18n translation objects), not credentials. No real API keys, tokens, passwords, or secrets found in production code.
  - **No hardcoded URLs:** `grep -rn "localhost:8000\|localhost:3000\|localhost:5000" apps/web/src --include="*.ts" --include="*.tsx"` returned zero matches in production code; `localhost:8000` appears only in test files (`apps/web/src/lib/api.test.ts` and `apps/web/src/uploadPhoto.test.ts`), which is expected and correct.
  - **No process.env usage:** `grep -rn "process.env" apps/web/src --include="*.ts" --include="*.tsx"` returned zero matches; the app uses only `import.meta.env.VITE_API_URL`, the correct Vite pattern for client-exposed env vars.
  - **VITE_ prefix scope:** `grep -rn "VITE_" apps/web` confirms only one env var is defined: `VITE_API_URL` in `apps/web/.env.example` (value: `http://localhost:8000`, a safe local dev default, not a secret). The TypeScript env interface at `apps/web/src/vite-env.d.ts:4` declares only this one var, preventing accidental exposure of other env vars. Confirmed in `apps/web/src/lib/api.ts:69` that `import.meta.env.VITE_API_URL` is read and used as `baseUrl` for all API calls.
  - **`.env` gitignored:** `git check-ignore apps/web/.env` returns `apps/web/.env`, confirming the file is ignored. Root `.gitignore:14` explicitly lists `.env` (with comment: "Environment — .env.example is intentionally NOT ignored"), and app-level `.env.example` exists and is committed.
  - **`.env.example` contains only placeholders:** `apps/web/.env.example` contains a single line of configuration: `VITE_API_URL=http://localhost:8000`, which is a local development default, not a real secret or production credential.
  - **Token handling:** JWT access tokens are stored in `localStorage` (covered in Task 2, Finding 2.1) and transmitted via `Authorization: Bearer {token}` headers (confirmed in `apps/web/src/lib/api.ts:93-152`), never hardcoded or in env vars.
- **Description:** All secrets-hygiene requirements are met: no hardcoded credentials in source code, environment files properly git-ignored, and the single public env var (`VITE_API_URL`) is safely scoped via Vite's `VITE_` prefix and exposed only to the client bundle intentionally. The app has no server-side secrets of its own (it's a pure SPA that authenticates to `apps/api` via JWT in the Authorization header, not an API key), so this is correctly implemented.
- **Recommendation:** None — current implementation is secure and correct. Continue the pattern for any future env vars: use the `VITE_` prefix for public values only, never expose sensitive data, and commit `.env.example` with placeholders while keeping `.env` gitignored.
- **Status:** No action needed — verified complete.

---

## Task 7: Route & authorization guards

### Summary

Read `apps/web/src/routes/index.tsx` in full and listed every route's guard status. Read `apps/web/src/components/RequireAuth.tsx` to confirm what it actually checks. Then traced the "owner-only UI" pattern in `ItemsPage.tsx`/`ItemCard.tsx` and `ReservationDetailPage.tsx` back to its data source (`ItemsContext.tsx`, `RequestsContext.tsx`) and forward into `apps/api` (`apps/api/app/routers/items.py`, `apps/api/app/services/items.py`, `apps/api/app/services/reservations.py`, `apps/api/app/services/reports.py`) to confirm — by reading the actual enforcement code, not just the contract — that ownership/participant checks are real server-side controls. Finally ran the brief's role/permission grep. No Medium+ findings; one clarifying correction to the brief's framing and one Low informational item below.

### Finding 7.1 — No action needed

**Title:** Every dashboard route is wrapped by `RequireAuth`; only `/login` and `/register` are reachable without a token

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - Full route list from `apps/web/src/routes/index.tsx:14-34`:

    | Path | Guarded by `RequireAuth`? |
    |---|---|
    | `/` | N/A — `<Navigate to="/dashboard" replace />`, immediately redirects into the guarded branch below |
    | `/login` | No (intentionally public) |
    | `/register` | No (intentionally public) |
    | `/dashboard` | Yes |
    | `/items` | Yes |
    | `/items/publish` | Yes |
    | `/requests` | Yes |
    | `/requests/calendar` | Yes |
    | `/reservations/:id` | Yes |
    | `/earnings` | Yes |

    All seven authenticated routes are declared as `children` of a single parent route object (`index.tsx:18-33`) whose `element` is `<RequireAuth><DashboardLayout /></RequireAuth>` — there is no per-page opt-out; a new route added under that `children` array inherits the guard automatically, and a route accidentally added as a sibling at the top level (like `/login`/`/register`) would NOT be guarded, so this is a "wrap in the right array" convention, not a per-route decorator, and is exactly the design already in place for all 7 dashboard routes.
  - `apps/web/src/components/RequireAuth.tsx:5-11` — `RequireAuth` renders `<Navigate to="/login" replace />` when `!isAuthenticated`, otherwise renders its `children`. Per Task 2's Finding 2.1, `isAuthenticated` is `token !== null` — presence-only, no expiry/format validation — which is a session-handling nuance already logged in Task 2, not a routing gap; the routing layer itself correctly gates on the auth state it's given.
  - No other route table exists: `grep -rn "createBrowserRouter\|<Route\b" apps/web/src` (checked manually while reading the file) shows `index.tsx` is the single source of the route tree; `DashboardLayout` (rendered only inside the guard) is what renders the nav and the `<Outlet />` the child routes mount into, so there's no secondary/unguarded router instance mounted elsewhere.
  - No catch-all (`path: '*'`) route is defined. This isn't a security gap — an unmatched path just hits `react-router`'s default not-found behavior, it doesn't expose any protected content — but noting it since the brief asked for every route to be listed; worth a product/UX decision on adding a proper 404 page, not a security finding.
- **Description:** The route guard is structurally sound: one `RequireAuth` wrapper protects one parent route, all seven dashboard pages nest under it, and the only two unauthenticated-reachable routes (`/login`, `/register`) are exactly the two the brief expects. There's no route that's unintentionally public.
- **Recommendation:** None for security. Optional UX polish: add a `path: '*'` route with a proper 404 page.
- **Status:** No action needed — verified complete.

### Finding 7.2 — No action needed (with a correction to the brief's framing)

**Title:** Owner-only Edit/Delete/Report UI is backed by real server-side ownership/participant checks — confirmed by reading `apps/api`'s enforcement code directly, not just the contract; and the "hide via client-side ownership comparison" pattern the brief describes doesn't actually exist in the current code — the lists themselves are already server-scoped

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - **Items — no client-side ownership comparison exists at all, because the list is already server-scoped.** `apps/web/src/lib/ItemsContext.tsx:48` calls `apiListMyItems(currentToken)`, which is `apiListMyItems` → `GET /users/me/items` (`apps/web/src/lib/api.ts:104-106`). Server-side, `apps/api/app/routers/items.py:162-177`'s `list_my_items_endpoint` calls `list_my_items(db, owner_id=current_user.id)` → `apps/api/app/services/items.py:295-310`, `.where(Item.owner_id == owner_id)`. So every `Item` that ever reaches `ItemsPage.tsx`/`ItemCard.tsx` already belongs to the logged-in user — there is no "compare `item.owner_id` to my id, then hide the button" logic anywhere in `apps/web/src` (confirmed: no such comparison exists in `ItemCard.tsx` or `ItemsPage.tsx`, read in full). `ItemCard.tsx:65,78`'s Edit/Delete buttons are instead gated only on a `readOnly` prop, which is passed `true` in exactly one place — `apps/web/src/routes/PublishItemPage.tsx:140`, `<ItemCard item={previewItem} readOnly />` — the live preview of a not-yet-created item while filling out the publish form, unrelated to ownership.
  - **Backend enforces ownership independently and correctly regardless.** `apps/api/app/routers/items.py:120-159` — `update_item_endpoint`/`delete_item_endpoint` both resolve `current_user` via `Depends(get_current_user)` (JWT-derived, never from the request body) and pass `owner_id=current_user.id` into `apps/api/app/services/items.py:225-249` (`update_item`) and `:266-292` (`delete_item`). Both read the real row first (`db.scalar(select(Item).where(Item.id == item_id))`) then explicitly check `if item.owner_id != owner_id: raise AppError(403, "FORBIDDEN", "You do not own this item")` (`items.py:248-249`, `287-288`) — a real, unconditional 403 for any authenticated user attempting to edit/delete another owner's item, whether or not the frontend's UI ever would have shown them the button (it wouldn't, since the item wouldn't be in their `/users/me/items` list to begin with — this is defense-in-depth, not the only barrier).
  - **Reservations — same server-scoping pattern, plus a genuine participant check on the two reservation-detail actions.** `apps/web/src/lib/RequestsContext.tsx:38` calls `apiListMyRequests` → `GET /users/me/requests` (`apps/web/src/lib/api.ts:120-122`), scoped server-side the same way. `ReservationDetailPage.tsx:18` does `requests.find((r) => r.id === id)`; if the URL's `:id` isn't in the caller's own list, `reservation` is `undefined` and the component renders `"Reservation not found."` (`ReservationDetailPage.tsx:42-44`) instead of the deposit-history/report UI. However, the `useEffect` that fetches deposit history (`ReservationDetailPage.tsx:27-40`, calling `apiGetTransactions(token, id)`) runs unconditionally off the raw URL param — before the `if (!reservation)` early return, since hooks always execute in declaration order — so it fires even for a reservation id that isn't the caller's own. This is safe: `GET /reservations/{id}/transactions` (`apps/api/app/routers/reservations.py:259-277`) calls `get_transactions(db, reservation_id=..., user_id=current_user.id)` → `apps/api/app/services/reservations.py:457-477`, which calls `_assert_participant(reservation, user_id)` (`reservations.py:152-...`) — a real check that the caller is either the reservation's renter or the rented item's owner, 403 otherwise. Same pattern for `POST /reservations/{id}/report` → `apps/api/app/services/reports.py:18-41`, `_assert_participant(reservation, reporter_id)` before any write. A non-participant hitting either endpoint via a crafted `:id` in the URL (or a raw `fetch`, bypassing the UI entirely) gets a 403, not data or a report accepted on someone else's reservation. The only client-visible effect of firing the transactions fetch for a not-found reservation is a discarded `transactionsError` state that's never rendered (the component already returned early) — no information disclosure, just a wasted network call.
  - **No path where `PATCH`/`DELETE /items/{id}` or the reservation endpoints are reachable without a valid JWT:** all of `update_item_endpoint`, `delete_item_endpoint`, `get_transactions_endpoint`, and the report endpoint require `current_user: User = Depends(get_current_user)` — confirmed by reading the router signatures directly, not assumed.
- **Description:** The brief's premise — "the UI hides owner-only buttons based on client state, confirm the backend is the real boundary" — holds in spirit (the backend absolutely is the real, independently-enforced boundary in every case checked), but the specific mechanism described (comparing `item.owner_id`/participant status client-side to decide what to render) doesn't exist in the current codebase for items: the `/items` and `/requests` lists are pre-filtered server-side to the caller's own resources, so there's no other-owner's-item ever reaching `ItemCard`'s editable render path to begin with, and `readOnly` is an unrelated preview-mode flag. The one place a raw URL id could plausibly point at someone else's resource (`/reservations/:id`) does have a real backend participant check on both actions available there (view transactions, submit a report), confirmed by reading `apps/api`'s service code directly rather than only trusting the OpenAPI contract's documented `403`s.
- **Recommendation:** None — this is correctly designed (server-side scoping + defense-in-depth ownership checks on the mutation endpoints). No action needed in `apps/web`.
- **Status:** No action needed — verified complete; brief's framing corrected above for future reference.

### Finding 7.3 — No action needed

**Title:** No client-only role/permission flag exists anywhere in `apps/web/src`

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:** `grep -rn "role\|isAdmin\|isOwner" apps/web/src --include="*.tsx" --include="*.ts" | grep -v ".test."` returns exactly two matches, both in `apps/web/src/components/ui/table.tsx:76,91` — CSS selectors targeting the HTML/ARIA accessibility attribute `[role=checkbox]` on table components (unrelated to authorization; standard shadcn/ui table styling). There is no `role`, `isAdmin`, `isOwner`, or similar permission/entitlement flag anywhere else in the app — no such field exists on the `User` type (`apps/web/src/lib/types.ts`, checked), nothing is derived from JWT claims client-side beyond `token`/basic user profile fields, and nothing in `AuthContext.tsx` exposes a role.
- **Description:** Consistent with the app currently having a single user type (owner) end-to-end, there is no role/permission gate implemented client-side that a server-side check doesn't also enforce independently — because there is no client-side role/permission gate at all. Nothing to re-validate server-side that isn't already the case (auth presence + resource ownership, both covered in Findings 7.1/7.2).
- **Recommendation:** None. If a second role (e.g., renter, admin) is ever introduced, apply the same principle already used correctly elsewhere in this app: any role-based UI hiding must be backed by an independent server-side check, not trusted as the boundary.
- **Status:** No action needed — verified complete.

---

## Task 8: Error handling & information disclosure

### Summary

Traced `apps/web/src/lib/api.ts`'s `request()` function end to end, then followed every one of the 14 `catch` blocks across the app's routes/contexts/components that consume its errors, to confirm none of them surface anything beyond the API's `error.message` or a generic translated fallback. Also ran a case-insensitive `console.*` grep across the entirety of `apps/web` (production and test code, not just `apps/web/src`) to check for logged sensitive data. Bottom line: no raw stack traces, response bodies, or exception text ever reach the DOM, the network-error fallback is correctly generic, and there is zero `console.*` usage anywhere in `apps/web` — nothing to find on the logging check.

### Finding 8.1 — No action needed

**Title:** `request()` only ever surfaces the API's `error.message`; JSON parse failures are swallowed to `null`, never raw response text

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - `apps/web/src/lib/api.ts:68-82`:
    ```ts
    async function request<T>(path: string, options: RequestInit): Promise<T> {
      const baseUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        if (body?.error?.code === 'TOKEN_EXPIRED') {
          window.dispatchEvent(new CustomEvent('rentatodo:token-expired'))
        }
        throw new ApiError(body?.error?.code ?? 'UNKNOWN_ERROR', body?.error?.message ?? 'Something went wrong. Please try again.')
      }
      return body as T
    }
    ```
    Line 74's `.catch(() => null)` means a non-JSON or unparseable response body (e.g. an HTML 502 page from a proxy, or a truncated body) becomes `null`, not a raw string — so `body?.error?.message` on line 79 falls through to the hardcoded generic fallback `'Something went wrong. Please try again.'` rather than exposing whatever the raw body actually contained. There is no code path in `request()` that reads `response.statusText`, a raw `.text()` body, or any part of the `Response` object other than the parsed `error.code`/`error.message` fields.
  - `apps/web/src/lib/api.ts:3-14` — `ApiError` only ever carries `code` and `message` (both plain strings from the parsed JSON envelope); it doesn't wrap or expose the underlying `Response` or any stack trace. `getErrorMessage(err, fallback)` (lines 12-14) returns `err.message` only when `err instanceof ApiError` — for any other thrown value (a raw `TypeError` from a failed `fetch`, a `SyntaxError`, etc.) it unconditionally returns the caller-supplied `fallback` string, never the original exception's `.message`.
  - Confirmed every call site that consumes API errors follows this same `getErrorMessage(err, fallback)` pattern, with 14 total `catch` blocks checked (`grep -n "catch (" apps/web/src --include=*.ts*` across `.ts`/`.tsx`): `AuthContext.tsx:73` (rethrows unmodified, no message extraction), `ItemsContext.tsx:51`, `RequestsContext.tsx:41`, `LoginPage.tsx:28`, `RegisterPage.tsx:43`, `PublishItemPage.tsx:59`, `ItemsPage.tsx:73,85`, `DashboardPage.tsx:32,43`, `RequestsPage.tsx:52,63`, `ReservationDetailPage.tsx:58,68`, and `PhotoUploadField.tsx:44` (maps `ApiError.code` to a translated string via a `knownMessages` lookup first, falling back to `getErrorMessage(err, t.errors.network)` only for unrecognized codes). None of these read `err` directly into a template string, `String(err)`, or `err.stack` — all go through `getErrorMessage` (or, for `PhotoUploadField`, an equivalent code-to-translation map).
  - The one unrelated `.message` hit found by a broader grep, `apps/web/src/components/ui/form.tsx:148` (`String(error?.message ?? "")`), is dead scaffold code from shadcn/ui's generic `<Form>`/`useFormField` component (react-hook-form field validation, not API errors) — confirmed via `grep -rn "from '@/components/ui/form'"` across `apps/web/src` returning zero matches, i.e. no route or component in the app actually imports/uses it. Not a live sink.
- **Description:** The error-surfacing pipeline is a single, consistently-applied choke point (`request()` → `ApiError` → `getErrorMessage()`) that structurally cannot leak a raw stack trace, unparsed response body, or internal exception text to the UI: `request()` never keeps a reference to the raw body once JSON-parsing fails, `ApiError` only stores the two string fields the backend explicitly returned for user display, and `getErrorMessage()` refuses to unwrap anything that isn't an `ApiError`. Every one of the 14 catch sites in the app was individually checked and follows this pattern (or a stricter variant, in `PhotoUploadField`'s case).
- **Recommendation:** None — keep this pattern for any new API-consuming code: always throw/catch through `ApiError` and read messages only via `getErrorMessage()`, never interpolate a caught error directly.
- **Status:** No action needed — verified complete.

### Finding 8.2 — No action needed

**Title:** Network-error fallback (fetch throwing, e.g. offline) shows a generic translated string, never the raw `TypeError`/exception message

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - `apps/web/src/lib/api.ts:70` — the `fetch()` call inside `request()` has no surrounding `try/catch`; if `fetch` itself rejects (e.g. `TypeError: Failed to fetch` when offline or on a CORS/DNS failure), that rejection propagates unmodified out of `request()` and out of every `api*` wrapper function (`apiLogin`, `apiCreateItem`, etc. — none of them add their own `try/catch` either, confirmed by reading all of `api.ts`).
  - At every call site, that raw `TypeError` is caught by the page/component's own `catch (err)` block and passed to `getErrorMessage(err, t.errors.network)` (or an equivalent fallback string). Since a `TypeError` is not `instanceof ApiError`, `getErrorMessage` (line 13) unconditionally returns the second argument — the generic fallback — and never touches `err.message`.
  - `apps/web/src/lib/i18n/en.ts:155` — `network: "Couldn't reach the server. Check your connection and try again."`, confirming the fallback shown to the user is a static, pre-translated string, not anything derived from the exception.
  - `apps/web/src/lib/uploadPhoto.ts:64-73` independently confirms the same pattern for the separate S3 `PUT` call (outside `request()`): the raw `fetch` to `presign.upload_url` is wrapped in its own `try { ... } catch { throw new ApiError('UPLOAD_FAILED', 'Upload failed.') }` — the caught exception is discarded entirely (no `catch (err)` binding used) and replaced with a fixed, generic `ApiError`.
  - `apps/web/src/routes/LoginPage.tsx:28-29`, `ItemsPage.tsx:73-74`, `PublishItemPage.tsx:59-60`, `RegisterPage.tsx:43-44`, `DashboardPage.tsx:32-33,43-44`, `RequestsPage.tsx:52-53,63-64` all pass `t.errors.network` as the fallback; `ReservationDetailPage.tsx:58-59,68-69` use page-specific hardcoded English fallback strings (`'Something went wrong. Please try again.'`, `"Couldn't refresh the deposit history. Try refreshing the page."`) instead of the shared `t.errors.network` i18n key — a minor i18n-consistency gap (not localized for non-English locales), not a security issue, since the string is still a fixed generic message either way, never the raw exception.
- **Description:** The offline/network-failure path is correctly generic end-to-end: nothing in the chain from `fetch()` throwing to the message rendered in `AuthErrorBanner`/`window.alert` ever reads the raw `TypeError`'s `.message` (which could otherwise vary by browser and occasionally include internal detail like a resolved URL). The two `ReservationDetailPage.tsx` call sites use inline hardcoded strings rather than the shared `t.errors.network` key, which is a translation-completeness nit worth flagging but doesn't change the security conclusion — both are still fixed, non-sensitive strings.
- **Recommendation:** None for security. Optional polish: have `ReservationDetailPage.tsx:59,69` use `t.errors.network` (or dedicated i18n keys) instead of hardcoded English literals, for translation consistency with the rest of the app.
- **Status:** No action needed — verified complete.

### Finding 8.3 — No action needed

**Title:** Zero `console.log`/`console.error`/`console.warn` (or any `console.*`) calls exist anywhere in `apps/web` — nothing to check for sensitive-data logging

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - `grep -rn "console\.(log|error|warn)" apps/web/src --include="*.tsx" --include="*.ts" | grep -v ".test."` (the brief's exact command) — zero matches.
  - Widened to any `console\.(log|error|warn|info|debug|trace)` across all of `apps/web/src` (including test files this time) — zero matches.
  - Widened further to the bare substring `console` (no method restriction, would catch `console['error']`, a wrapped/aliased console call, etc.) across the entire `apps/web` directory (not just `src` — includes config files, `e2e`-adjacent web fixtures if any, everything) — zero matches. Ran this last check myself rather than trusting the brief's narrower command, per the "trace fully, don't assume" instruction.
- **Description:** There is no console logging of any kind in `apps/web`, so there's no possibility of a `console.*` call logging a full request/response object, an `Authorization` header, a token, or a password field — the entire category of risk the brief asks about doesn't exist in this codebase today. This is a clean, verified negative result, not an assumption from a partial grep.
- **Recommendation:** None. If logging is added in the future (e.g. for debugging), keep the same discipline already used in `getErrorMessage`/`ApiError` — log only sanitized, user-facing messages or error codes, never the full request options object (which would include the `Authorization: Bearer ${token}` header set in most `api*` functions in `apps/web/src/lib/api.ts`, e.g. lines 93, 100-101, 112-113, 117, 121, 125, 129, 136-137, 141, 145, 152-153) or raw form values (e.g. `password` state in `LoginPage.tsx`/`RegisterPage.tsx`).
- **Status:** No action needed — verified complete.

---

## Task 9: Cross-boundary (apps/api) findings affecting apps/web

### Summary

Read (never modified) `apps/api/app/services/auth.py`, `apps/api/app/config.py`, `apps/api/app/main.py`, `apps/api/.env.example`, and `apps/api/app/schemas/item.py` to verify the JWT/CORS configuration that `apps/web` depends on, and to resolve two items Tasks 2 and 3 explicitly deferred to this task. Also cross-checked `apps/web/vite.config.ts`'s actual dev-server port against `apps/api`'s CORS allow-list, since a mismatch there would silently break every real request `apps/web` makes (not something either task's own scope would have caught in isolation). Bottom line: JWT signing, secret sourcing, and CORS are all configured correctly and match what `apps/web` needs; both deferred items are now resolved with confirmed answers below.

### Finding 9.1 — No action needed

**Title:** JWT signing uses HS256 with the secret sourced from the `JWT_SECRET` env var (never hardcoded); `.env.example`'s value is an obvious non-production placeholder

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - `apps/api/app/services/auth.py:66` — `jwt.encode(payload, settings.jwt_secret, algorithm="HS256")`; `apps/api/app/services/auth.py:83` — `jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])`. Same algorithm used symmetrically for signing and verification, both read from `settings.jwt_secret` — no algorithm string appears anywhere else in the file, and there's no `"none"`/asymmetric-algorithm fallback path.
  - `apps/api/app/config.py:34,37` — `Settings` is a `pydantic_settings.BaseSettings` with `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`, and `jwt_secret: str` has **no default value** — it's a required field, meaning the app fails to start rather than silently falling back to a baked-in secret if `JWT_SECRET` is unset in the environment/`.env`. Confirmed by reading the full `Settings` class: no hardcoded secret string exists anywhere in `apps/api/app/config.py` or `auth.py`.
  - `apps/api/.env.example:15-17`:
    ```
    # JWT signing (app/config.py). Generate a real random value for production;
    # any long string is fine for local dev.
    JWT_SECRET=change-me-in-production-use-random-64-chars
    ```
    The placeholder value literally spells out "change-me-in-production" — unambiguous that it's not meant to be used as-is, and the accompanying comment reinforces it.
- **Description:** JWT signing/verification is symmetric HS256 with the secret exclusively sourced from the environment (required, no fallback), and the example file's placeholder value is self-documenting as a non-production stand-in, not something that could be mistaken for (or accidentally deployed as) a real secret.
- **Recommendation:** None — this is correctly designed. Keep `jwt_secret` a required field with no default so a missing `JWT_SECRET` fails loudly (app won't start) rather than silently signing tokens with an empty/predictable value.
- **Status:** No action needed — verified complete.

### Finding 9.2 — No action needed

**Title:** `CORS_ORIGINS` is an explicit, non-wildcard origin list; `allow_credentials` is not set (defaults to `False`), consistent with `apps/web`'s header-based (not cookie-based) auth

- **Severity:** N/A (verified correct, no action needed)
- **Evidence:**
  - `apps/api/.env.example:21` — `CORS_ORIGINS=http://localhost:8081` (a single concrete origin, not `*`).
  - `apps/api/app/config.py:39,46-49`:
    ```python
    cors_origins: str = "http://localhost:8081"
    ...
    @property
    def cors_origins_list(self) -> list[str]:
        """``cors_origins`` split into individual origin strings."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    ```
    Kept as a comma-separated string (a deliberate design choice, per `apps/api/ROADMAP.md:148`: *"Simpler for teammates to edit `.env` by hand than JSON-escaping a list"*) and split into a real Python list before use — there is no code path where an unsplit `"*"` string or a raw wildcard could reach `CORSMiddleware` short of someone explicitly setting `CORS_ORIGINS=*` in their own `.env` (which would produce `["*"]` — the code doesn't special-case or block that value, but the shipped default and `.env.example` both use a concrete origin, not `*`).
  - `apps/api/app/main.py:14-19`:
    ```python
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    ```
    `allow_credentials` is not passed at all, so Starlette's `CORSMiddleware` uses its default, `False`. This matters for the wildcard-plus-credentials concern the brief raises: even in the hypothetical case above where someone sets `CORS_ORIGINS=*`, `allow_credentials=False` means the browser wouldn't attach cookies/credentials to the cross-origin request anyway — and separately, `apps/web` doesn't rely on cookies at all (per Finding 2.1/6.1, the JWT is sent manually via an `Authorization: Bearer` header, which isn't gated by `allow_credentials`), so there's no credentialed-CORS attack surface here regardless of the `CORS_ORIGINS` value.
  - Cross-checked against `apps/web`'s actual dev server: `apps/web/vite.config.ts:13-16` — `server: { port: 8081, strictPort: true }`. This deliberately overrides Vite's usual default port (5173) to `8081` (matching Expo web's conventional dev port) and `strictPort: true` means Vite refuses to silently fall back to a different port if 8081 is taken — so `apps/web`'s dev server origin (`http://localhost:8081`) always matches `CORS_ORIGINS`'s default exactly. No mismatch exists between the two configs today.
- **Description:** `CORS_ORIGINS` is built from an explicit origin string (not a wildcard) in both its shipped default and `.env.example`, `allow_credentials` is never enabled, and `apps/web`'s dev server is deliberately pinned to the same port `apps/api` expects — so the browser-enforced same-origin/CORS boundary and the actual dev configuration line up correctly today, and there's no code-level reliance on browser wildcard-blocking behavior as the only defense (there's no wildcard configured to begin with).
- **Recommendation:** None for current config. If `CORS_ORIGINS` is ever changed to include a wildcard for convenience, do not simultaneously enable `allow_credentials=True` — but this isn't a live risk in the current setup.
- **Status:** No action needed — verified complete.

### Finding 9.3 — Deferred item resolved (Task 2, Finding 2.1): JWT lifetime is exactly 24 hours, confirmed from real code, not memory

- **Severity:** N/A (verification only)
- **Evidence:**
  - `apps/api/app/services/auth.py:60-66`:
    ```python
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_expiration_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    ```
  - `apps/api/app/config.py:38` — `jwt_expiration_hours: int = 24` (default).
  - `apps/api/.env.example:16` — `JWT_EXPIRATION_HOURS=24`, explicitly set to match the default (not left unset/relying on the fallback).
- **Description:** Task 2's Finding 2.1 cited "24h token lifetime... confirmed separately in Task 9" — this is now confirmed exactly: the `exp` claim is `iat + settings.jwt_expiration_hours` hours, and that setting is `24` both as the code default and as the explicit value in `.env.example`. Nothing in `apps/web` overrides or is even aware of this value beyond the unused `expires_in` field already noted in Finding 2.1.
- **Recommendation:** None (informational confirmation only).
- **Status:** Deferred item resolved — no discrepancy found.

### Finding 9.4 — Deferred item resolved (Task 3): `apps/api`'s `photo_url` validation is syntax-only — it does NOT block `javascript:`/other non-http(s) schemes

- **Severity:** Low (matches the severity already assigned in Task 3's finding; this is confirmation of the previously-unverified half of it, not a new/separate issue)
- **Evidence:**
  - `apps/api/app/schemas/item.py:33` — `CreateItemRequest.photo_url: AnyUrl = Field(..., description="URL to the item's photo.")`; `apps/api/app/schemas/item.py:48` — `UpdateItemRequest.photo_url: AnyUrl | None = Field(None, ...)`. Both use Pydantic v2's `AnyUrl` type (via `pydantic-settings>=2.4,<3.0`'s pydantic 2.x dependency, per `apps/api/requirements.txt:6`), with no custom `field_validator`/scheme allow-list anywhere in the file — confirmed via `grep -n "validator\|field_validator\|scheme" apps/api/app/schemas/item.py apps/api/app/services/items.py`, zero matches.
  - I verified empirically what `AnyUrl` actually accepts, rather than assuming from the type's name: installed `pydantic>=2,<3` (matching the project's actual dependency range) into an isolated scratch directory (outside the repo, nothing under `apps/api/` touched) and ran `TypeAdapter(AnyUrl).validate_python(...)` against several payloads:
    ```
    'javascript:alert(1)'                  -> OK  -> javascript:alert(1)
    'javascript://alert(1)'                -> OK  -> javascript://alert(1)
    'data:image/png;base64,AAAA'           -> OK  -> data:image/png;base64,AAAA
    'http://example.com/a.png'             -> OK  -> http://example.com/a.png
    'ftp://x/y'                             -> OK  -> ftp://x/y
    'file:///etc/passwd'                    -> OK  -> file:///etc/passwd
    ```
    Every one of these validates successfully — `AnyUrl` (true to its name) enforces general URI *structure* only ("scheme:" plus whatever that scheme's grammar allows), not an `http`/`https` allow-list. `javascript:alert(1)` in particular passes with no error.
  - `apps/api/app/models/item.py:69` — `photo_url: Mapped[str] = mapped_column(String, nullable=False)` at the DB layer: no `CheckConstraint` on `photo_url`'s value (unlike `price_per_day`'s constraint noted in Task 4) — confirmed via reading the full model and the corresponding Alembic migration; the column is a plain unconstrained string.
- **Description:** This resolves Task 3's explicitly deferred question: `apps/api`'s `photo_url` field, wherever it's typed `AnyUrl` (create/update item requests), performs URI-syntax validation only and does not restrict the scheme to `http`/`https`. A `javascript:` (or `data:`, `file:`, `ftp:`, etc.) value would be **accepted** by `apps/api`'s schema if a client sent one directly (bypassing `apps/web`'s upload flow, which per Task 3 can never itself produce such a value). This confirms the residual risk Task 3 already flagged as Low severity is real, not hypothetical — but the severity conclusion there still holds: `apps/web`'s only sink for this field is `<img src={item.photo_url}>` (`ItemCard.tsx`), and browsers do not execute `javascript:` URIs assigned to `<img src>` (unlike `<a href>`, which `apps/web` doesn't use dynamically anywhere per Task 3). So a malicious non-`http(s)` `photo_url` reaching `apps/web` today would fail to render as an image, not execute script — Low, not Medium/High.
- **Recommendation:** `apps/api`-owned, optional defense-in-depth: add a `field_validator` on `photo_url` restricting `AnyUrl.scheme` to `{"http", "https"}` (or switch to Pydantic's stricter `HttpUrl` type, which does enforce this). This closes the gap at the source for every client (`apps/web`, `apps/mobile`, direct API callers), rather than relying on each frontend's rendering sink to happen to be safe. Not an `apps/web` change and not urgent given the current sink is inert against this payload class, but worth a ticket since a future `apps/web` change (e.g., rendering `photo_url` in a link, or a new sink elsewhere) would inherit this gap silently.
- **Status:** Deferred item resolved — confirms Task 3's suspicion; flagged as optional `apps/api` hardening, not blocking.

---
