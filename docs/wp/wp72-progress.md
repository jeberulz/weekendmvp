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

## 2026-11-05 - S4 a11y-check

- Author: a Sonnet sub-agent. Scope: every file in `components/workspace/kit/**`, `components/workspace/shell/**` and the new preview page. The `a11y-check` skill (critical and serious rules) was applied by reading each component; the browser steps are John's (script below).
- Dev-only preview: `app/(launch-workspace)/workspace-kit-preview/page.tsx` (async server page; the `KitPreviewClient` dynamic import and all JSX sit inside the `NODE_ENV === "development"` branch and `notFound()` follows it, so the production build drops the client chunk and fixtures; `generateMetadata` sets the title only in development and is noindex, nofollow, titleless otherwise) and `KitPreviewClient.tsx` (all callbacks are local state). It uses the real `WorkspaceFrame` with mock credits and a mock business. The page itself uses no Convex, auth or network (the root layout still mounts its own providers and scripts). No nav row is active on that path; no `activePathOverride` was added.
- Preview states: all three StatusPill sets; credit meter (normal, low, zero, max 0, max 0 with a balance, over max); empty, loading and error states; every EmployeeCard status plus four SkippedRoleCards (the last employee card has Autopilot available, the rest show the Free gate); ApprovalCard Free, credits, not enough, a 1.5 s pending that ends approved, and one always pending; Wren thread loading, error (Retry loads it), ready with every Wren card and the composer; BuildPackPromptCard; all 8 WorkstreamPanels (brand also holds a changes_requested output; engineering holds the prompt card).

### Findings and fixes

| # | Finding (WCAG) | Where | Resolution |
|---|---|---|---|
| 1 | Billing link accessible name "Billing, N of M credits left" did not contain its visible text ("Credits", plan, "N left"). 2.5.3 | `WorkspaceSidebar.tsx` | Fixed. Name is now `billingLinkLabel`: `Credits Free 48 left, open Billing`. The visible part comes from `creditMeterVisibleLabel` and the new `creditMeterRightText`, which `CreditMeter` itself uses, so the two cannot drift. The full "48 of 50" stays on the inner `role="meter"` valuetext. |
| 2 | Switcher button name "Switch business. Current: X" had the visible name in the middle. 2.5.3 (best practice: visible text first) | `BusinessSwitcher.tsx` | Fixed: `X, switch business`. |
| 3 | The open switcher closed on any blur, including a null `relatedTarget`. With keyboard focus on the button and a mouse press on a list link in Safari or Firefox (links are not focusable by click), the list hid before the click. 2.1.1 / 3.2.2 | `BusinessSwitcher.tsx` | Fixed: the pure `shouldCloseOnBlur(next, root)` closes only when focus moves to a node outside the switcher (null target, inside target, non-node target and missing root all keep it open). Real outside clicks are still handled by the pointer-down listener. |
| 4 | Current business announced twice: `aria-current="true"` plus sr-only "(current)". 1.3.1 (noise) | `BusinessSwitcher.tsx` | Fixed: sr-only text removed, `aria-current` kept. |
| 5 | The "✓ " glyph in "Looks good" was read aloud ("check mark Looks good") while `aria-pressed` already says it. 1.1.1 / 4.1.2 | `ApprovalCard.tsx`, `WrenThread.tsx` (BrandKitCardView) | Fixed: glyph in `<span aria-hidden="true">`. |
| 6 | Output title (programmatic focus target after Approve / Submit) had `outline-none`, so keyboard users lost the focus position. 2.4.7 | `WorkstreamPanel.tsx` | Fixed: `FOCUS` ring (visible under `:focus-visible`). |
| 7 | Composer: Enter sends and Shift+Enter inserts a newline, but nothing said so. 3.3.2 | `WrenThread.tsx` | Fixed: sr-only hint wired with `aria-describedby`. |
| 8 | Reflow at 320 px: prompt-card header, approval-card header and the From row did not wrap; long prompt text, site URL and file names could overflow. 1.4.10 | `BuildPackPromptCard`, `ApprovalCard`, `WrenCards`, `WorkstreamPanel` | Fixed: `flex-wrap`, `break-words` / `break-all`. Verify in the browser (script step 7). |
| 9 | AI badge on avatars was 8 px text. 1.4.4 (legibility; it is the AI disclosure) | `EmployeeAvatar.tsx` | Fixed: 10 px. It is only used on the `lg` avatar. |
| 10 | Autopilot gate reason ("paid plans") was only in the native `title` and an sr-only hint. 3.3.2 / 1.4.13 | `EmployeeCard.tsx` | Fixed in review follow-up: a short visible "Paid" label (`text-home-ink-2` on card, 7.8:1 class of contrast) sits next to the lock. The full reason still arrives on activation: the Team HQ page must show the gate message then (the preview does, in a `role="status"` line). |
| 11 | Card and secondary-button borders use `home-rule` (1.45:1). 1.4.11 | `styles.ts` | Not changed: buttons are identified by their text, cards are not components, and inputs use `home-ink-3` borders (5.76:1 on card). Recorded in case design wants a stronger border later. |
| 12 | `<main id="workspace-main">` uses `focus:outline-none`. | layout (outside S4 scope) | Not changed. The landmark is `tabIndex=-1`, never in the Tab order, and only receives programmatic focus from the skip link and the mobile menu. Mentioned for the reviewer. |
| 13 | The avatar `role="img"` ("Iris, Brand (AI employee)") sits next to the visible name, so a screen reader hears the name twice. | `EmployeeAvatar.tsx` | Not changed: the label carries the AI-employee disclosure that the visual badge gives sighted users. |

Checked and passing: icon-only buttons (`Send message`), decorative icons (`aria-hidden`), logo (`role="img"` and label), form labels (composer and change note use a real `<label>`, placeholders are not labels), external link (`Open site` has `rel` and the sr-only hint), no colour-only status (every pill and badge has text), heading order (preview: one h1, sections h2, panels h3, their sections h4, outputs and blockers h5; prompt card heading levels follow `headingLevel`), Escape and focus return (switcher, mobile menu, output form), `aria-expanded` and `aria-controls` targets exist, ids unique, motion respects `prefers-reduced-motion`.

### Contrast (WCAG 1.4.3 / 1.4.11, computed from `app/globals.css` tokens)

| Pair | Ratio |
|---|---|
| `#a84a00` (orange-ink) text on `#fbf3e8` (StatusPill needs-you / ready) | 5.24:1, passes AA |
| orange-ink on card `#fffdf9` / on sunk `#efe8dc` / on paper `#f7f3ec` | 5.67 / 4.73 / 5.21 |
| card text `#fffdf9` on `#3d3570` (social EmployeeAvatar) | 10.65:1, passes |
| card on sky-ink `#2c4a68` | 9.04 |
| ink-3 `#6b6457` on card / paper / sunk | 5.76 / 5.30 / 4.81 |
| ink-2 `#4a453c` on sunk | 7.81 |
| sage-ink on sage / clay-ink on clay / sky-ink on sky | 6.47 / 6.08 / 7.06 |
| `#cfc6b6` and `#f08a3e` on panel `#24211c` (BuildPackCard) | 9.48 / 6.42 |
| `home-rule` `#ddd4c4` on card (borders, decorative) | 1.45 (see finding 11) |

Both remaining hex colours pass, so they can stay as arbitrary values until the tokens exist.

### Tests

- New `tests/platform/wp72-a11y.test.tsx` (27 tests after the review follow-up: non-circular label-in-name read from the rendered meter row and the rendered Billing link, five `shouldCloseOnBlur` cases, a pointer-down add and remove guard, the visible Paid label, preview guards for no static import of the client or fixtures, the dynamic import inside the development branch, and the title set only in development): label-in-name for five credit states, the rendered Billing link, the switcher and copy button; aria-hidden glyph; AI badge size; composer hint; wrap and break classes; source guards (no `outline-none` on the output title, blur null guard, no inline style / `any` / `console.log`); preview page guards (the `NODE_ENV` check and `notFound()` come before any JSX, robots noindex and nofollow, lives outside `/dashboard`, no Convex / auth / network, server page passes no functions) and a full static render of the preview client.
- Updated: `wp72-shell.test.tsx` (Billing label, no "(current)"), `workspace-kit.test.tsx` (aria-hidden tick).
- Still not DOM-tested (no jsdom): focus movement, blur close, Enter vs Shift+Enter, copy. Covered by the browser script below.

### Browser check script (John)

Run `npm run dev` from this worktree, open `http://localhost:3000/workspace-kit-preview` (404 in any other mode). Use the keyboard only unless a step says otherwise. Open DevTools > Rendering > emulate `prefers-reduced-motion` once at the end.

1. **Skip link.** Reload, press Tab once. "Skip to main content" appears top-left with a visible ring. Press Enter: focus is on main (no ring on main is expected), and the next Tab lands on the first control inside the page, not in the sidebar.
2. **Switcher.** Shift+Tab or click back to the sidebar. Tab to "HydroTrail, switch business". Enter opens the list (button reads expanded). Tab moves into the "HydroTrail" link, still open. Tab again: list closes and focus is on the next nav link (Dashboard). Re-open, press Escape: list closes and focus is on the switcher button. Re-open with the keyboard, then click a link with the mouse: it must navigate (finding 3). Open it, click empty page space: closes.
3. **Mobile menu (resize to 375 px, reload).** The sidebar collapses to the logo and a "Menu" button. Enter opens the panel (switcher, nav, Billing card). Escape closes it and focus is back on Menu. Open it again, choose "Team HQ" (or any link) with Enter: the panel closes and focus is on main (the next Tab goes into page content). Repeat with a mouse tap.
4. **OutputCard (brand panel, "Brand kit 3x3 board", status Ready for your OK).** Enter on "Ask for changes": the form opens and the textarea is focused. Press Enter on "Send to Iris" with the field empty: focus stays in the textarea and the error "Write what Iris should change in Brand kit 3x3 board first." is announced (VoiceOver: read as an alert; the textarea is described by it). Type a note and Send: the form closes and focus is on the output title (visible ring), status becomes "Changes requested" with your note. On another Ready output, open the form and press Cancel: focus returns to "Ask for changes". Also press "Looks good": focus goes to the title and the status text announces approval.
5. **ApprovalCard.** Approve "Slow decision": the card is busy for 1.5 s, the buttons stay focusable (Tab onto them, Enter does nothing), the status line says "Sending your decision…" then "Approved. Wren will route this." and the button shows "✓ Looks good" (VoiceOver should not read "check mark"). The "Decision in flight" card stays pending: its buttons are focusable and inert. Check the three cost badges read "Free", "2 credits", "4 credits · not enough" (not colour-only).
6. **Composer (Wren thread, ready).** Type, press Enter: the message is added as "You: ..." and the field clears. Type, press Shift+Enter: a new line, nothing sent. Press Enter on an empty or whitespace-only field: nothing sent. With VoiceOver, focusing the field reads the hint "Press Enter to send...". If you can, test an IME (Japanese) composition: Enter that commits the composition must not send.
7. **BuildPackPromptCard.** Tab to "Copy prompt" (name "Copy prompt 2: Data model + carry formula"). Enter: the visible line below reads "Copied Prompt 2 for Claude Code." and is announced once; the icon swaps to a tick for 2 s. Paste elsewhere to confirm the text. Tab to the prompt text block: it is focusable with a ring and scrolls with the arrow keys. Spam Enter: no stuck state.
8. **Other keyboard checks.** Autopilot switches: Space and Enter toggle the last card (the last employee card, Ada, has Autopilot available); on the others the gate line above the list updates. Hire on a skipped role changes to "Hire requested" and stays focusable. Error state and thread error: "Retry loading messages" loads the thread.
9. **Zoom and reflow.** Browser zoom 200% at a 1280 px window (about 640 css px), then a 320 px wide viewport: no horizontal page scroll, no clipped text or overlapping rows (check the prompt header, approval header, "From" row, file names, site URL, credit meter, the sidebar panel). Prompt text may scroll inside its own box only.
10. **Reduced motion.** Spinners stop (`LoadingState`), switch and button transitions are off.
11. **Screen reader spot check (VoiceOver, Safari or Chrome).** Landmarks: one navigation "Workspace", one main. The Billing link reads "Credits Free 48 left, open Billing". Meter reads "48 of 50 credits left". Employee card switches read "Autopilot for Iris, Brand (paid plans), switch, off". The thread is a log named "Messages".
12. Optional: run axe DevTools on the page and expect no serious or critical issues; record any in this file.

### Browser check results (orchestrator, 2026-11-05)

Run against this worktree's own dev server (`npx next dev --port 3072` started from
`.worktrees/wp72-workspace-shell`, not the main checkout) at `/workspace-kit-preview`. The keys were real key
presses in the in-app browser, and each result was read back from the DOM.

| Check | Result |
|---|---|
| Skip link is the first page focusable; Enter moves focus to `#workspace-main` | Pass |
| Desktop: Tab from the skip link goes to the switcher (the hidden Menu toggle is skipped) | Pass |
| Switcher: Enter opens it (`aria-expanded="true"`); Tab reaches the current business; Tab out to Team HQ closes it | Pass |
| Switcher: Escape inside the list closes it and returns focus to the button | Pass |
| OutputCard: Ask for changes opens the always-mounted form and focuses the textarea | Pass |
| OutputCard: an empty submit keeps focus on the textarea, with `aria-invalid="true"` and `aria-describedby` pointing to the `role="alert"` message | Pass |
| OutputCard: Cancel hides the form and returns focus to the Ask button | Pass |
| OutputCard: Submit moves the status to "Changes requested" and unmounts the Ask button; focus lands on the output title (h5, `tabIndex=-1`, 2px ring, `:focus-visible`) | Pass |
| Mobile 375px: Menu opens the panel; keyboard focus reaches Team HQ; choosing it closes the panel and focuses `#workspace-main` | Pass |
| No horizontal overflow at 375px or at 320px; no element in main runs past the viewport | Pass |
| Composer: Shift+Enter inserts a newline; Enter sends to the log, clears the box and keeps focus; the hint is wired through `aria-describedby` | Pass |
| ApprovalCard pending: stays focusable (`aria-disabled`), dashed sunk style with a `not-allowed` cursor, and Enter changes nothing | Pass |
| Console errors on a fresh load of the preview | None |

Not covered here, and still to do once there is a DOM test library or a manual pass:
- a VoiceOver listen-through;
- IME composition with a real input method;
- reduced motion;
- 200% browser zoom (only the 320px reflow was measured);
- the BuildPackPromptCard clipboard, which needs a clipboard permission.

Notes:
- The Next dev overlay (`nextjs-portal`) takes the first Tab in development only.
- `next dev` rewrites one heading level in `AGENTS.md` on start. The rewrite was reverted and is never committed.
- A console error about `NEXT_PUBLIC_CONVEX_URL` appeared only on `/login`, after a nav link left the preview. The worktree has no `.env.local`, so this is not a WP72 defect.

- Review follow-up: the preview's 1.5 s pending timer is cleared on unmount (`KitPreviewClient.tsx`).
