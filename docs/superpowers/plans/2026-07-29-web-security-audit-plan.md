# apps/web Security Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a severity-ranked, evidence-backed security findings report for `apps/web` (the owner dashboard), covering auth/session handling, XSS surface, input validation, file uploads, secrets hygiene, route authorization, and error-disclosure — as a gate before the next round of UX polishing work.

**Architecture:** Each task is a self-contained investigation of one risk area: run a concrete command or grep, read the exact file(s) it points at, and append a findings entry to a single running report file using a fixed template. No task fixes anything by default — findings against `apps/web` that are trivial, low-risk, and self-contained may be fixed inline (own sub-step, own commit, own test); everything else — and anything touching `apps/api`, `apps/mobile`, or `packages/contracts/openapi.yaml` — is logged only and handed off. The final task rolls everything into a prioritized remediation backlog that becomes the input for the "polishing" work that follows this audit.

**Tech Stack:** Vite + React 19 + TypeScript, Vitest + Testing Library, `npm audit`, ripgrep-style `grep` for pattern scans.

## Global Constraints

- Scope is `apps/web` only. Read-only investigation of `apps/api` is allowed when a web-side risk depends on backend behavior (e.g. CORS, token validation); do not modify anything under `apps/api/` or `apps/mobile/`.
- Never modify `packages/contracts/openapi.yaml`.
- Any inline fix must keep `npx vitest run` and `npx tsc -b` clean (run both before committing).
- No new dependencies without explicit justification written into the commit message and PR description (per root `CLAUDE.md`).
- Every finding — fixed or not — gets an entry in the report file with Severity, Evidence (file:line), and Recommendation. Nothing gets silently skipped.
- Never commit real secrets, tokens, or `.env` contents into the report file — redact example values.
- Commit after every task (report update, or report update + fix).

---

## Findings Report Template

Every task appends one or more entries to `docs/superpowers/plans/2026-07-29-web-security-audit-findings.md` using exactly this shape:

```markdown
### [Area] — [short finding title]

- **Severity:** Critical | High | Medium | Low | Info
- **Evidence:** `path/to/file.ts:LINE`
- **Description:** what the risk is, in 1-3 sentences.
- **Recommendation:** the concrete fix, even if out of scope to apply now.
- **Status:** Fixed inline (commit `<sha>`) | Flagged — needs `apps/api` change | Flagged — needs product decision | No action needed (false positive, explain why)
```

If a task area has zero findings, still add one entry with `Status: No action needed` summarizing what was checked — this proves the area was actually covered, not skipped.

---

### Task 1: Report scaffold + dependency vulnerability scan

**Files:**
- Create: `docs/superpowers/plans/2026-07-29-web-security-audit-findings.md`
- Read: `apps/web/package.json`, `apps/web/package-lock.json`

**Interfaces:**
- Produces: the findings report file every later task appends to, seeded with a header and a Task 1 section.

- [ ] **Step 1: Create the findings report with a header**

```markdown
# apps/web Security Audit — Findings

Audit date: 2026-07-29
Scope: apps/web only (per root CLAUDE.md ownership split). apps/api/apps/mobile findings are logged, not fixed.

---

## Task 1: Dependency vulnerability scan
```

- [ ] **Step 2: Run npm audit from apps/web**

Run: `cd apps/web && npm audit --json > /tmp/npm-audit-web.json && npm audit`
Expected: command completes (even if it reports vulnerabilities — a non-zero exit code from `npm audit` here is expected and fine, don't treat it as a step failure).

- [ ] **Step 3: For every advisory at High or Critical severity, add a finding entry**

For each one, capture: package name, current vs. patched version range, and whether a fix is available via `npm audit fix` without a major version bump (check the advisory's `fixAvailable` field in the JSON). Use the template above. Set `Status` to `Flagged — needs product decision` for anything requiring a major bump (major bumps need the "clear justification in the PR description" the root CLAUDE.md requires), or fix inline only if `npm audit fix` (no `--force`) resolves it with a patch/minor bump.

- [ ] **Step 4: If Step 3 found patch/minor-only fixes, apply them**

Run: `cd apps/web && npm audit fix`
Then: `npx vitest run` and `npx tsc -b` — both must stay clean. If either breaks, revert (`git checkout -- package.json package-lock.json`) and downgrade that finding's `Status` to `Flagged — needs manual fix`, noting what broke.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): security audit task 1 - dependency scan"
```

---

### Task 2: Auth token & session handling

**Files:**
- Read: `apps/web/src/lib/AuthContext.tsx` (token stored via `localStorage.getItem('rentatodo_token')` at line 24, `setItem` at lines 69/84, `removeItem` at line 48 — confirm these line numbers still match before citing them)
- Read: `apps/web/src/components/RequireAuth.tsx`
- Read: `apps/web/src/lib/api.ts` (look at how `expires_in` from `LoginResult` is used — confirm whether the client ever checks token expiry itself, or only finds out via a 401 from the server)

**Interfaces:**
- Consumes: the findings report file from Task 1.
- Produces: a `## Task 2: Auth token & session handling` section appended to the same report.

- [ ] **Step 1: Confirm where the JWT lives client-side**

Run: `grep -n "rentatodo_token\|localStorage" apps/web/src/lib/AuthContext.tsx`
Read the surrounding code. Confirm: the access token is stored in `localStorage` (not an httpOnly cookie), meaning any successful XSS on this origin can read it and impersonate the user for up to `expires_in` seconds (24h per `apps/api`'s `create_access_token`, confirmed separately in Task 9).

- [ ] **Step 2: Check whether the client ever verifies/refreshes the token proactively**

Read `apps/web/src/lib/AuthContext.tsx` in full. Confirm whether there's any `setTimeout`/`setInterval` tied to `expires_in`, or whether expiry is only discovered reactively via a `401` on the next API call. Note which behavior is actually implemented.

- [ ] **Step 3: Add the finding**

```markdown
### Auth — JWT stored in localStorage, no proactive expiry handling

- **Severity:** Medium
- **Evidence:** `apps/web/src/lib/AuthContext.tsx:24,69,84`
- **Description:** The access token lives in `localStorage`, readable by any JS running on the page — a stored/reflected XSS anywhere on this origin (including in a dependency) would let an attacker exfiltrate the token and impersonate the user until it expires (24h). The client only discovers an expired/invalid token reactively, via a 401 on the next request, not proactively.
- **Recommendation:** Longer-term, move to an httpOnly, Secure, SameSite=Strict cookie set by `apps/api` on login (removes JS readability entirely) — this needs a coordinated `apps/api` change (login/refresh endpoints, CORS `credentials` mode) and is out of scope for `apps/web` alone. Shorter-term and in-scope: nothing to fix here without weakening UX; document the accepted risk.
- **Status:** Flagged — needs `apps/api` change (and a product decision on session UX)
```

- [ ] **Step 4: Check logout completeness**

Run: `grep -n "logout" apps/web/src/lib/AuthContext.tsx`
Confirm `logout()` clears both the `token` state and `localStorage` (not just one), and that nothing else (e.g. a cached fetch response, another storage key) retains the token after logout. Add a finding only if it's incomplete; otherwise add a `No action needed` entry citing the exact lines that prove both are cleared.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 2 - auth/session handling"
```

---

### Task 3: XSS / unsafe DOM rendering surface

**Files:**
- Read: all matches from the greps below

**Interfaces:**
- Consumes: report file from Task 2.
- Produces: `## Task 3: XSS surface` section.

- [ ] **Step 1: Grep for the classic unsafe-render sinks across the whole app**

Run: `grep -rn "dangerouslySetInnerHTML\|\.innerHTML\s*=\|document\.write\|eval(\|new Function(" apps/web/src`
Expected (as of 2026-07-29): no matches. If this now returns matches, read every one — each is a candidate XSS sink and needs its own finding with the actual severity based on whether the interpolated value is user-controlled (item name/description, renter name, error messages) or a trusted constant.

- [ ] **Step 2: Check for user-controlled values rendered as raw URLs (`href`/`src`) without validation**

Run: `grep -rn "photo_url\|href={" apps/web/src/components apps/web/src/routes`
For each `<img src={...}>` or `<a href={...}>` bound to a value that ultimately comes from user input (e.g. `item.photo_url`, which an owner sets via the publish/edit form), confirm the value is constrained server-side to `format: uri` (per `UpdateItemRequest`/`CreateItemRequest` in `packages/contracts/openapi.yaml`) — a `javascript:` URL is rejected by that format check, but confirm the frontend doesn't additionally accept unvalidated free text anywhere (e.g. the presign flow's `public_url` vs. a user-pasted URL field).

- [ ] **Step 3: Add findings**

If Steps 1-2 found nothing exploitable, add:

```markdown
### XSS — no unsafe DOM sinks found

- **Severity:** Info
- **Evidence:** grep across `apps/web/src` for `dangerouslySetInnerHTML`, `.innerHTML =`, `document.write`, `eval(`, `new Function(` — zero matches as of 2026-07-29.
- **Description:** React's default JSX text/attribute interpolation escapes content, and this codebase doesn't opt out of that anywhere. `photo_url` is constrained by the contract's `format: uri` on the backend.
- **Recommendation:** Keep it this way — flag any future PR introducing `dangerouslySetInnerHTML` for review.
- **Status:** No action needed
```

Otherwise, write one finding per sink found, using the template, with `Severity: High` for anything rendering unescaped user input.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 3 - XSS surface"
```

---

### Task 4: Input validation on forms

**Files:**
- Read: `apps/web/src/routes/PublishItemPage.tsx`
- Read: `apps/web/src/routes/ItemsPage.tsx` (edit-item dialog, `handleSubmit`)
- Read: `apps/web/src/routes/RegisterPage.tsx`, `apps/web/src/routes/LoginPage.tsx`
- Read: `packages/contracts/openapi.yaml` — `CreateItemRequest`, `UpdateItemRequest`, `RegisterRequest` schemas (for the constraints the backend actually enforces, e.g. `minLength`, `maxLength: 72` on passwords per the earlier presign-schema fix)

**Interfaces:**
- Consumes: report file from Task 3.
- Produces: `## Task 4: Form input validation` section.

- [ ] **Step 1: List every client-side constraint on each form field**

For `PublishItemPage.tsx` and `ItemsPage.tsx`'s edit dialog: for each field (`name`, `description`, `category`, `price_per_day`, `photo_url`), note whether the `<Input>` has `required`, `min`/`max`, `type`, or any inline validation before the API call — grep for `Number(form.priceDollars)` and confirm what happens if the user types a non-numeric string or a negative number (does `Math.round(Number(...) * 100)` produce `NaN` or a negative value, and does that get sent to the API as-is?).

- [ ] **Step 2: Confirm the backend is the actual enforcement point, not a fallback**

The client-side checks are a UX nicety, not a security boundary — the real question is whether the UI *trusts* a client-side-only check anywhere instead of also handling the corresponding API validation error. Check: if `POST /items` or `PATCH /items/{id}` returns `422 VALIDATION_ERROR` (e.g. because `price_per_day` came through as `0` or negative from a bad client-side computation), does the dialog surface that error to the user via `dialogError`/`AuthErrorBanner`, or does it fail silently? Trace `handleSubmit` in `ItemsPage.tsx` and the publish-item equivalent to confirm.

- [ ] **Step 3: Add findings**

Use the template. For the `Number(form.priceDollars)` → `NaN`/negative case specifically: if a malformed price does get sent and the only feedback is the generic 422 message (not a specific "price must be positive" client-side hint), that's a `Low` severity UX/robustness finding, not a security one — categorize it correctly rather than inflating severity. Only mark something `Medium`+ if a bad client-side value could reach the backend *without* the backend's own validation catching it (which would be a backend bug, logged as `Flagged — needs apps/api change`, not fixed here).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 4 - form input validation"
```

---

### Task 5: File upload flow (`PhotoUploadField` + presign)

**Files:**
- Read: `apps/web/src/components/PhotoUploadField.tsx`
- Read: `apps/web/src/lib/api.ts` — `apiPresignUpload`
- Read: `apps/api/app/services/uploads.py` (read-only — already reviewed earlier this session, re-confirm line numbers)

**Interfaces:**
- Consumes: report file from Task 4.
- Produces: `## Task 5: File upload security` section.

- [ ] **Step 1: Check client-side file-type and size constraints**

Run: `grep -n "accept=\|type\.startsWith\|size\|MAX" apps/web/src/components/PhotoUploadField.tsx`
Confirm whether the file `<input>` restricts to image MIME types (`accept="image/*"` or similar) and whether there's any client-side size cap before calling `apiPresignUpload`.

- [ ] **Step 2: Confirm the presigned URL can't be abused to upload to an arbitrary bucket/key**

Read `apiPresignUpload` in `apps/web/src/lib/api.ts` and confirm the client sends only `content_type` (per the contract) and receives `upload_url`/`public_url`/`expires_in` back — the client never supplies its own `key` or bucket name. Cross-check against `apps/api/app/services/uploads.py`'s `generate_presign` (read-only) to confirm the key is server-generated (`uploads/{user_id}/{uuid}.{ext}` or similar), not client-supplied — this is what prevents path traversal / overwriting another user's object.

- [ ] **Step 3: Check the presigned PUT has no content-length enforcement (known gap)**

This was already flagged in `apps/api/app/services/uploads.py`'s own docstring/TODO (seen earlier this session: "presigned PUT does not support a ContentLengthRange condition"). Confirm that TODO still exists, and add it as a finding here (it's an `apps/api` gap, not something to fix in this task) so it's tracked alongside the rest of the audit instead of only living in a code comment.

- [ ] **Step 4: Add findings using the template, then commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 5 - file upload flow"
```

---

### Task 6: Secrets & environment hygiene

**Files:**
- Read: `apps/web/.env.example`, `apps/web/vite.config.ts`
- Read: `.gitignore` (repo root and `apps/web/.gitignore` if present)

**Interfaces:**
- Consumes: report file from Task 5.
- Produces: `## Task 6: Secrets hygiene` section.

- [ ] **Step 1: Grep the whole apps/web source tree for hardcoded URLs, keys, or tokens**

Run: `grep -rniE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{8,}" apps/web/src --include="*.ts" --include="*.tsx" | grep -v ".test.ts"`
Every match needs manual review — test fixtures using obviously-fake values like `'tok123'` or `'securepass123'` are fine (already seeded throughout the test suite); anything that looks like a real credential is a Critical finding requiring immediate rotation (flag to the user directly, don't wait for the report to be read).

- [ ] **Step 2: Confirm `.env` is gitignored and `.env.example` has no real values**

Run: `git check-ignore apps/web/.env` (expect it to print the path, confirming it's ignored) and read `apps/web/.env.example` to confirm every value is a placeholder (e.g. `VITE_API_URL=http://localhost:8000` is fine — it's a local dev default, not a secret).

- [ ] **Step 3: Confirm build output doesn't accidentally bundle server-only env vars**

Vite only exposes env vars prefixed `VITE_` to client code by design — confirm `apps/web/.env.example` doesn't define anything sensitive under that prefix (nothing should be, since the web app has no server-side secrets of its own; it only talks to `apps/api` over HTTP with a URL, not a key).

- [ ] **Step 4: Add findings (expect mostly `No action needed` entries unless Step 1 surfaces something), then commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 6 - secrets hygiene"
```

---

### Task 7: Route & authorization guards

**Files:**
- Read: `apps/web/src/components/RequireAuth.tsx`
- Read: `apps/web/src/routes/index.tsx`
- Read: `apps/web/src/routes/ItemsPage.tsx`, `apps/web/src/routes/ReservationDetailPage.tsx` (as examples of pages that show owner-only actions conditionally)

**Interfaces:**
- Consumes: report file from Task 6.
- Produces: `## Task 7: Route & authorization guards` section.

- [ ] **Step 1: Confirm every dashboard route is wrapped by `RequireAuth`**

Read `apps/web/src/routes/index.tsx` in full. List every route path and whether it's nested under the `RequireAuth`-guarded layout or not. `/login` and `/register` should be the only routes reachable without a token; everything else (`/dashboard`, `/items`, `/items/publish`, `/requests`, `/requests/calendar`, `/reservations/:id`, `/earnings`) should require it. Flag any route that isn't guarded.

- [ ] **Step 2: Confirm client-side "ownership" checks are UX only, not the real boundary**

`ReservationDetailPage.tsx` and `ItemsPage.tsx` hide owner-only buttons (Edit/Delete/Report) based on client state. Confirm this is understood as a UX convenience, not a security control, by checking that the corresponding API calls (`PATCH /items/{id}`, `DELETE /items/{id}`) rely on the backend's own `403 Not the owner` check (confirmed in Task 5/earlier sessions' review of `apps/api`) rather than the frontend being the only thing standing between a user and another owner's item. This is inherently true given the architecture (any authenticated user can craft a raw `fetch` bypassing the UI) — the finding here is just confirming the backend really does enforce it, which was already verified via the contract's documented `403` responses on `PATCH`/`DELETE /items/{item_id}`.

- [ ] **Step 3: Check for any client-side-only "admin" or role logic**

Run: `grep -rn "role\|isAdmin\|isOwner" apps/web/src --include="*.tsx" --include="*.ts" | grep -v ".test."`
Confirm there's no role/permission flag trusted client-side that isn't also re-validated server-side (there shouldn't be any at all yet, since this app only has one user role — owner — but confirm rather than assume).

- [ ] **Step 4: Add findings, then commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 7 - route and authorization guards"
```

---

### Task 8: Error handling & information disclosure

**Files:**
- Read: `apps/web/src/lib/api.ts` — `ApiError`, `getErrorMessage`, the `request()` helper's error-branch
- Read: `apps/web/src/routes/LoginPage.tsx`, `apps/web/src/routes/ItemsPage.tsx` (as examples of where `getErrorMessage` output reaches the DOM)

**Interfaces:**
- Consumes: report file from Task 7.
- Produces: `## Task 8: Error handling & information disclosure` section.

- [ ] **Step 1: Trace exactly what text can reach the UI from a failed API call**

Read the `request()` function in `apps/web/src/lib/api.ts` end to end. Confirm it only ever surfaces `error.message` from the API's `{"error": {"code", "message"}}` envelope (per the contract), never a raw stack trace, raw `Response` body, or raw `fetch` exception text. Confirm the network-error fallback path (when `fetch` itself throws, e.g. offline) shows a generic translated string (`t.errors.network`) rather than the raw `TypeError` message.

- [ ] **Step 2: Confirm no console logging of full error objects that could include sensitive request data**

Run: `grep -rn "console\.\(log\|error\|warn\)" apps/web/src --include="*.tsx" --include="*.ts" | grep -v ".test."`
For each match outside test files, confirm it isn't logging a full request/response object that could contain the auth token (e.g. logging the `Authorization` header) or a password field. Browser devtools console output isn't sent anywhere by default, so this is a `Low` severity finding at most (local-machine-only exposure), but still worth documenting if found.

- [ ] **Step 3: Add findings, then commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 8 - error handling and info disclosure"
```

---

### Task 9: Cross-boundary findings (read-only: `apps/api` CORS/JWT config as it affects `apps/web`)

**Files:**
- Read only: `apps/api/.env.example`, `apps/api/app/config.py` (or wherever `CORS_ORIGINS`/`JWT_SECRET` are loaded — locate via grep), `apps/api/app/services/auth.py` (`create_access_token`)

**Interfaces:**
- Consumes: report file from Task 8.
- Produces: `## Task 9: Cross-boundary (apps/api) findings affecting apps/web` section. No files under `apps/api/` are modified by this task — read-only per `CLAUDE.md`'s ownership split.

- [ ] **Step 1: Confirm the JWT signing algorithm and secret source**

Run: `grep -n "algorithm\|JWT_SECRET\|jwt.encode\|jwt.decode" apps/api/app/services/auth.py`
Confirm it's an HMAC algorithm (e.g. `HS256`) with the secret sourced from an env var (`JWT_SECRET`), never hardcoded. Confirm `apps/api/.env.example`'s `JWT_SECRET` value is an obvious placeholder (e.g. `dev-secret`), not something that looks like it was meant to be used in a real deployment.

- [ ] **Step 2: Confirm CORS_ORIGINS doesn't include a wildcard**

Run: `grep -n "CORS_ORIGINS\|allow_origins\|CORSMiddleware" apps/api/.env.example apps/api/app/main.py 2>/dev/null`
Confirm `allow_origins` is built from the explicit `CORS_ORIGINS` list (already known: `http://localhost:8081,http://localhost:5173` in dev), not `["*"]` — a wildcard combined with `allow_credentials=True` would be a real vulnerability (browsers block credentialed wildcard CORS, but it's worth confirming the code doesn't rely on that browser behavior as its only defense).

- [ ] **Step 3: Add findings with `Status: Flagged — needs apps/api change` for anything that needs fixing, or `No action needed` if config is already correct, then commit**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "chore(web): security audit task 9 - cross-boundary apps/api findings"
```

---

### Task 10: Remediation backlog + PR

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-web-security-audit-findings.md` (append final summary section)

**Interfaces:**
- Consumes: the complete findings report from Tasks 1-9.
- Produces: a `## Summary & Remediation Backlog` section at the top of the report (not the bottom — this is what gets read first) ranking every non-"No action needed" finding by severity, and a PR against `develop` presenting the audit.

- [ ] **Step 1: Re-read every finding in the report and build the summary table**

At the very top of the report (after the header, before Task 1's section), insert:

```markdown
## Summary & Remediation Backlog

| # | Area | Severity | Status | Owner |
|---|------|----------|--------|-------|
| 1 | ... | ... | ... | apps/web / apps/api |

(One row per finding that isn't "No action needed", ordered Critical → High → Medium → Low.)
```

Fill in the real rows from Tasks 1-9's actual findings — don't invent placeholder rows.

- [ ] **Step 2: Run the full web test suite and type-check one more time to confirm the audit branch is clean**

Run: `cd apps/web && npx vitest run && npx tsc -b`
Expected: all green. If any inline fix from an earlier task broke something, fix it now before moving on.

- [ ] **Step 3: Commit the summary**

```bash
git add docs/superpowers/plans/2026-07-29-web-security-audit-findings.md
git commit -m "docs(web): summarize security audit findings and remediation backlog"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin <branch-name>
gh pr create --base develop --title "docs(web): apps/web security audit findings" --body "Security audit of apps/web per team request, ahead of the next round of UX polishing. See docs/superpowers/plans/2026-07-29-web-security-audit-findings.md for the full report — summary table at the top. No behavioral changes beyond any patch-level npm audit fix and whatever trivial in-scope fixes were applied inline (see report for exactly which, and their commit SHAs)."
```

Do not merge — per this repo's PR ownership convention, open it and let the team review.

---

## Self-Review Checklist (already applied while writing this plan)

- **Spec coverage:** auth/session (Task 2), XSS (Task 3), input validation (Task 4), file upload (Task 5), secrets (Task 6), authz/routing (Task 7), error disclosure (Task 8), dependency vulns (Task 1), cross-boundary CORS/JWT config (Task 9), rollup (Task 10) — the areas requested ("security audit... before doing more changes") are all covered.
- **Placeholder scan:** every step names an exact file, exact command, or exact grep pattern; the findings template has concrete field names, not "TBD".
- **Type/name consistency:** the findings report filename (`2026-07-29-web-security-audit-findings.md`) is identical across every task's Files/commit steps.
