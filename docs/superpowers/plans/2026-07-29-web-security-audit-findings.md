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
