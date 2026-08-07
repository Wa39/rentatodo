# Status: Dashboard Content Pages — where we left off (2026-07-16)

## What this work is

Silverk sent 6 new mockup screenshots (`myarticles.png`, `publisharticle.png`, `requests.png`,
`calendar.png`, `earnings.png`, `sidepanel.png`) plus a request for a shared white page-header
banner and a bigger sidebar. This is the deferred original-plan Tasks 11-17: building/restyling
My items, Publish item (new page), Requests, a new Calendar page, and Earnings, on top of the
already-shipped i18n + revision-2 palette work.

## Where everything lives

- **Spec addendum** (route changes, shared `PageHeader`/sidebar design, 3-state availability
  model, page-by-page content specs, new i18n keys, new mock data, testing/scope):
  `docs/superpowers/specs/2026-07-15-dashboard-visual-redesign-design.md`, the section titled
  `## Addendum (2026-07-16, revision 3)`.
- **Implementation plan** (19 bite-sized TDD tasks, full code for every step):
  `docs/superpowers/plans/2026-07-16-dashboard-content-pages-plan.md`. This is the source of
  truth for what to build — read it, not this status doc, for actual requirements.
- Both are already committed on `feature/web-scaffold-phase1` (commits `dcb91f4`, `febdf56`,
  `fbddbf7`).

## Execution status: not started

**Chosen approach: Subagent-Driven Development** (`superpowers:subagent-driven-development`) —
confirmed by the human, deferred to a future session. **Zero tasks have been dispatched.** No
worktree exists for this work yet.

## How to resume

1. **Check `feature/web-scaffold-phase1`'s current state first** — a separate PR (#22, opened
   2026-07-16, `feature/web-scaffold-phase1` → `develop`) is out for team review and may have
   merged or gained review feedback since this session. Run `git log --oneline -5` on
   `feature/web-scaffold-phase1` and compare against commit `fbddbf7` (the tip as of this status
   doc) — if it's moved, re-read what changed before branching.
2. **Invoke `superpowers:brainstorming`? No** — the spec and plan are already written and
   committed; skip straight to `superpowers:subagent-driven-development`. That skill's own
   process starts with "read plan, note context and global constraints, create todos" — do that
   fresh (don't assume any todos exist yet, this session's todo list was scoped to
   brainstorming/plan-writing, not task execution).
3. **Set up an isolated worktree** (`superpowers:using-git-worktrees`, required by
   subagent-driven-development) — branch from `feature/web-scaffold-phase1`'s current tip (not
   `develop` — `develop` has none of this web code yet, since PR #22 is unmerged as of this
   writing). Suggested branch name: `feature/dashboard-content-pages`.
   - **Known gotcha from the last worktree session**: the native `EnterWorktree` tool has
     previously defaulted to branching from `origin/main` instead of the intended base, silently
     dropping all prior work, even with `.claude/settings.local.json`'s `worktree.baseRef: "head"`
     set (a settings-watcher caching limitation). **Always verify immediately after creating the
     worktree**: `git merge-base HEAD feature/web-scaffold-phase1` should equal
     `feature/web-scaffold-phase1`'s own tip commit, not some much-older commit. If wrong, discard
     (`ExitWorktree`/`git worktree remove`) and fall back to manual
     `git worktree add <path> -b <branch> feature/web-scaffold-phase1`.
4. **Execute Task 1 through Task 19 of the plan in strict order** — the plan's tasks have real
   sequential dependencies (e.g., Task 6's `getDateState` is consumed by Task 7's
   `getAvailabilityStrip`; Task 9's `PageHeader` is consumed by Tasks 12-17). Do not reorder or
   parallelize task dispatch.
5. Standard subagent-driven-development loop from there: task-brief → implementer subagent → 
   review-package → task-reviewer subagent → fix loop if needed → progress ledger
   (`.superpowers/sdd/progress.md`, git-ignored, worktree-local) → next task. After Task 19: final
   whole-branch review (most capable model), then `superpowers:finishing-a-development-branch`.

## Key decisions made this session (don't re-litigate these)

- **Unified spec/plan**, not split into per-page specs — matches the precedent set by the
  i18n-repalette work.
- **Publish item** becomes its own page (`/items/publish`, create-only) with a live preview
  reusing `ItemCard` in `readOnly` mode. **Edit stays a popup dialog** on `/items` — not moved to
  the new page.
- **`/items/:id` (ItemDetailPage) is deleted entirely** — none of the 6 real mockup screens show
  a separate item-detail view; the new Calendar page covers what it was for. `ItemCard`'s name
  becomes plain text (no longer a link).
- **Calendar is one global page** at `/requests/calendar` with an item-picker dropdown
  (`?item=` query param), **not** per-item routing. **No month-navigation arrows** — deliberately
  simple, current + next month only, per explicit instruction.
- **3-state availability** (available/pending/reserved), derived from `mockRequests` via
  `getItemDateStates` — replaces the old static `unavailable_dates` fixture entirely. Single
  source of truth consumed by both `ItemCard`'s 14-day strip and the Calendar page's grid.
  `ItemDetail`/`UnavailableRange`/`mockItemDetail` are dead code removed in Task 18.
  `mockEarnings.by_month` is the only new mock data shape needed (6 months, sums to
  `total_earnings`).
- **Earnings bar chart**: plain CSS/Tailwind bars, no charting library — no new dependency.
- **Requests tabs**: Pending = `requested`; Active = `approved`/`delivered`/`returned` (a
  `returned` reservation still needs the owner to close it, so it's not history yet); History =
  `closed`/`rejected`/`cancelled`.
- **`ReservationDetailPage` is explicitly out of scope** — no mockup was provided for it; stays
  exactly as-is, still reachable from Requests/Calendar rows.
- **This session's PR**: #22 (`feature/web-scaffold-phase1` → `develop`) bundles everything
  through the i18n-repalette work (Phase 1 scaffold + visual redesign + i18n). It does **not**
  include any of the 19-task plan above — that work hadn't started when the PR was opened, and
  will need its own follow-up PR once done.

## Gotcha worth remembering (carried over from the last worktree session)

See "Known gotcha" under step 3 above — `EnterWorktree` branching from the wrong base has bitten
this project before. Always verify the merge-base before doing any real work in a fresh worktree.
