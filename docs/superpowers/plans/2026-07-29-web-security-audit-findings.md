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
