# WP72 Progress - Workspace shell and component kit

## 2026-11-05 - Setup

- Branch/worktree: `claude/wp72-workspace-shell` in `.worktrees/wp72-workspace-shell`, from `main` at `d67dc8e2`.
  G0 closed when #175 merged, and the owner gave the go for Phase 1.
- Assignment: WP72 (`04`), Claude lane, mid.
- File boundaries are listed in `wp72-stories.md`. `creditsSummary` is Codex's (WP73); the meter uses a typed
  mock until then.
- Required checks: typecheck, lint, test, build; a11y-check on every component.
- Open owner item: confirm the ops-function feature-flag exemption WP68 cites. This doesn't block the scaffold,
  which only reads the flag.

## 2026-11-05 - S0 canvas extract

- A Sonnet sub-agent read the Nav, System, Chat, Workstream, Dashboard and TeamHQ boards as data and wrote
  `docs/wp/wp72-canvas-extract.md`. The orchestrator scanned it and found no instruction-like text.
- The 13 open questions are settled in §9 of the extract (orchestrator decisions): cost badge states, 8
  workstream kinds, three status sets, nav limited to pages with boards, and the switcher, meter and Wren
  thread behaviour.
- Checks: docs only (`git diff --check`).

## 2026-11-05 - S1 route scaffold

- Author: an Opus sub-agent.
- `convex/workspace/access.ts`: the read-only query `getWorkspaceAccess`. C-OPS `assertFeatureEnabled(ctx, "workspace")`
  runs first, then C-AUTHZ `requireBusinessAccess(owner)`. Every denial returns `{ allowed: false }`, so callers can't
  tell the reasons apart. It is dormant while `ops_settings.workspaceEnabled` is off.
- `lib/workspace/access.ts`: a server gate cached per request. Any refusal or error becomes `notFound()`.
- `lib/workspace/routes.ts`: the manifest of 15 routes (extract §9.5), with three groups (This weekend, Workspace,
  Account).
- Routes sit in `app/(launch-workspace)/dashboard/b/[projectId]/` so the legacy dashboard layout doesn't wrap them. The
  URLs stay the same and existing dashboard files are untouched. noindex is set explicitly.
- `team/[employee]` accepts the roster role keys except `lead`.
- `convex/_generated/api.d.ts`: two lines added by hand to match codegen. Regenerate the file at the next
  `convex dev`.
- Needs from Codex:
  - a hard 404 status for refused routes, through middleware. **Required, not optional:** `next build` lists every
    `/dashboard/b/[projectId]/*` route as `◐` (Partial Prerender, because of the dynamic param), and Next 16 streams
    page responses with an initial `200`. A refusal therefore streams the not-found page with `noindex` at status 200,
    with no workspace content (the gate runs before any JSX). The legacy `/dashboard/builds/[planId]` behaves the same way;
  - the optional build-time flag `NEXT_PUBLIC_LAUNCH_WORKSPACE` (`02` §15) in `.env.example`, if wanted.
- Checks (orchestrator, with S3 in the tree): typecheck 0, lint 0 (37 existing warnings), `npm test` 0, build 0. The
  build lists every `/dashboard/b/[projectId]/*` route.
- Review follow-ups (after the independent review of `a5e7fc65`, no blockers):
  - `NEXT_PUBLIC_LAUNCH_WORKSPACE` build flag (02 §15) deferred. It needs Codex to add the key to `.env.example`
    first; the env-documentation scanner fails otherwise. The runtime `workspaceEnabled` flag keeps the routes
    dormant meanwhile. Add the check plus tests as a follow-up once the key lands.
  - The session token read moved inside the try, so a token failure is a 404, not a 500. `connection()` stays
    outside, and `unstable_rethrow` is still the first line of the catch.
  - A guard test keeps the 404 hard: no `loading.*` under `app/(launch-workspace)`, no `"use cache"` under the
    route root, and no `<Suspense>` above the gate in the route layout or its ancestors.
  - New Convex tests: the workspace name wins over the title, and an unexpected fault is rethrown.
- Notes:
  - `convex/_generated/api.d.ts` was edited by hand. The next codegen will also add `crew/roles`, which `main` is
    already missing; that gap predates this story.
  - Project ids in workspace URLs reach Impact and GA. Optional follow-up for Codex: `Referrer-Policy: no-referrer`
    on `/dashboard/b/`, and a GA path redaction.

## 2026-11-05 - S3 component kit

- Author: a Sonnet sub-agent. The kit is in `components/workspace/kit/`:
  - StatusPill, with the employee, output and site sets
  - EmployeeCard and SkippedRoleCard
  - ApprovalCard, with the free / credits / not-enough cost badge
  - the Wren thread and its cards, plus the composer
  - WorkstreamPanel, covering 8 kinds, and BuildPackPromptCard
  - CreditMeter
  - the empty, loading and error states
  - fixtures
  All of them are presentational and take typed props.
- The orchestrator changed the paid-plan label from the canvas draft's "Starter" to the product name "Builder's Hub",
  and the Autopilot gate copy to "paid plans".
- Tests: `tests/platform/workspace-kit.test.tsx`, 40 tests, using `renderToStaticMarkup`. Testing Library and jsdom
  are not installed, so keyboard activation is checked through native `<button>` semantics and pure helpers. Real
  keyboard tests wait for S4's browser check.
- Token gaps: 9 canvas colours have no `home-*` token (ember soft, the borders, disabled fill, low-credit bar, lilac
  ink). They are arbitrary values in a few kit files. Proposed follow-up: add tokens to `app/globals.css`.
- Needs from Codex: `@testing-library/react`, `@testing-library/user-event` and `jsdom` as devDependencies, if real
  DOM tests are wanted.
- Checks (orchestrator): typecheck 0, lint 0, `npm test` 0 after fixing one assertion for the escaped apostrophe,
  build 0.

## 2026-11-05 - S2 workspace shell

- Author: a Sonnet sub-agent. Files:
  - `components/workspace/shell/WorkspaceFrame.tsx`: server-safe frame (skip link, sidebar, credit meter card); synchronous, takes plain props.
  - `components/workspace/shell/WorkspaceSidebar.tsx`: client; the only `usePathname` reader. One `<nav aria-label="Workspace">`, grouped by manifest group, `aria-current="page"`; mobile disclosure button (`aria-expanded`, `aria-controls`), Escape closes and refocuses it, closes on navigation.
  - `components/workspace/shell/BusinessSwitcher.tsx`: client disclosure (`aria-expanded`, `aria-controls`, Escape and outside-click close, focus returns to the button). "Start a second idea" is a disabled row with the Growth gate copy; it links nowhere and creates nothing.
  - `components/workspace/shell/nav-utils.ts`: pure helpers (`isRouteActive`, `visibleNavGroups`, `groupHeadingId`, `businessInitial`).
  - `lib/workspace/credits.ts`, `lib/workspace/businesses.ts`: data seams.
  - Layout mounts the frame after `requireWorkspaceAccess`; the single `<main id="workspace-main" tabIndex={-1}>` stays in the layout. No Suspense, loading file or `"use cache"`.
- Component is named `WorkspaceFrame`, not `WorkspaceShell`, because the S1 guard test forbids `<WorkspaceShell` in the layout (the legacy shell's name).
- Mocks and where WP73 replaces them:
  - `getCreditsSummary(projectId)` returns a fixed `{ balance: 48, max: 50, plan: "free" }`; WP73 swaps its body for `creditsSummary`. The marker comment is in the file.
  - `listBusinesses(current)` returns only the current business. A later WP replaces it with the owner's real list (fetched under `requireWorkspaceAccess`-style authorisation).
- Left out on purpose: search box, "Subscribe" button, nav badges ("4 need you", "5/8", "New"), user row, switcher sub-line ("APP · FREE FOR NOW"). Their data sources are open canvas questions (extract §8). The footer meter is not a link because Billing is already a nav row.
- `weekendActive` is a frame prop defaulting to true; the layout does not pass it yet.
- Tests: `tests/platform/wp72-shell.test.tsx`, 14 tests (static markup; `next/navigation` mocked for the pathname).
- Gaps:
  - Focus behaviour (Escape returns focus, outside click, mobile panel close on navigation, skip link focusing main) is not DOM-tested; no jsdom. Covered by S4's browser check.
  - Sticky sidebar height (`lg:min-h-[calc(100dvh-4.5rem)]`) and the mobile panel layout are unchecked visually.
  - The a11y-check skill has not been run on the shell yet.
- S2 review fixes (same day):
  - The open switcher closes when focus leaves it (`onBlur` with a `relatedTarget instanceof Node` check) or on an outside pointer-down, without moving focus. Escape still returns focus to its button.
  - Billing is the credits-card link inside the nav (`aria-current="page"` on billing, `aria-label` "Billing, N of M credits left"). The `role="meter"` is not interactive, so it is valid inside a link; the aria-label gives the link one clear name. The Account group is no longer rendered; Settings stays in Workspace.
  - "Start a second idea" is plain text in an `li`: no role, no aria-disabled, not focusable.
  - A link followed from the open mobile panel closes it and focuses `#workspace-main` (captured on the panel; desktop untouched).
  - `onNavigate` and `activeRoute` removed; `<aside>` replaced with `<div>` (WP77 owns the chat aside); `server-only` added to `credits.ts` and `businesses.ts` (resolves via node_modules and the vitest stub; not in package.json, no dependency added); the layout uses `project._id` after the gate.
  - Tests are now 24 in `wp72-shell.test.tsx`, including source guards. Still untested in a DOM: blur-close, focus-to-main.
