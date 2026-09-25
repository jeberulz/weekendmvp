# WP44 Progress - Ideas-first dashboard (free and paid)

Append-only progress log. Do not rely on chat history for project state.

## 2026-09-24 - Setup

- Branch/worktree: `claude/wizardly-rubin-a6m2th` (no worktree)
- Assignment: deep dive on what `/dashboard` should be after the ideas-first direction (WP42), for free and paid members. Write a PRD and a build plan. No product code in this step
- File boundaries: `docs/wp/wp44-*`, `docs/PROJECT_STRATEGY.md` (registry row)
- Required checks: `git diff --check`
- Initial risks:
  - Paid plan name, price and limits are not ruled. PRD section 12 lists them
  - The IdeaBrowser MCP failed to connect and ideabrowser.com is blocked by this session's network policy, so its logged-in pages could not be captured

## 2026-09-24 - Audit and research

- Actions taken:
  - Read the current dashboard (`app/dashboard/**`, `components/platform/shell/*`, `components/platform/explore/*`, `convex/platform/ideas.ts`), `PRODUCT.md`, `docs/wp/platform-ux-brief.md`, `docs/wp/v1-scope-cut.md`, WP41 and WP42 docs and rulings
  - Recorded 13 audit findings (PRD section 2). Two are defects worth fixing even without the redesign: nested `main` on `/dashboard/billing` (A10) and per-page search in Explore (A7)
  - Reviewed about 60 Mobbin screens and flows (home, library, saved, paywall, upgrade, onboarding, mobile). 25 are cited in PRD section 13
  - IdeaBrowser: public sources only (plan tiers and free-plan limits)
- Decisions made (proposals, not rulings):
  - Research stays free. The paid plan sells workflow: collections, prompt packs, unlimited weekend plans, a hosted site
  - Free limit is one active weekend plan. Saves stay unlimited
  - Merge Interested into Saved in the UI, keep both flags in data
  - Park "Bring your own idea" until v1.1 reports ship
- Checks run: `git diff --check`
- Result: PRD and stories written. Mockup built on a shared design canvas at the owner's request: [Weekend MVP Dashboard](https://claude.ai/artifact/SoKxJm9Urpeyo8p9NntLG5) with five artboards (Home for a new member, a free member mid-build, a Builder member, the 390px phone layout, and the upgrade sheet), plus notes for module order, upgrade rules and open rulings. A first static HTML draft was dropped in favour of the canvas so there is one visual source
- Next: owner answers R1 to R8 (story S1), then Phase A starts with S2

## 2026-09-25 - Owner rulings R1 to R4

- Actions taken:
  - Recorded four rows in `docs/wp/RULINGS.md`: Builder's Hub at $29 a month (R1), free limits (R2), Interested merged into Saved on screen (R3), own-idea intake parked (R4)
  - PRD: status line, sections 6.5 and 6.6, wireframes 7.1 to 7.4, FR-22, FR-24, sections 9.3, 9.4, 11 and 12 updated. Stories: S1 status, Phase C gate, S10 plan id, S11 name. Registry row updated
  - Canvas: plan name and the $29 price on the free, Builder's Hub and upgrade sheet artboards. Canvas notes updated
- Decisions made:
  - The plan id in code is `builders_hub`. The credit pack catalog already uses the id `builder` for its $79 pack, so the subscription cannot share it
- Found:
  - Credit pack display names clash with the new plan and the Starter Kit: "Starter" ($29, 25 credits), "Builder" ($79, 75 credits), "Studio" ($199, 220 credits). Added as R9 with a recommendation to show packs by size
  - R5 matters more now: the 25-credit pack that publishes one page and a month of Builder's Hub both cost $29
- Checks run: `git diff --check`
- Next: owner answers R5 to R9 and sets the annual price. Phase A can start with S2 (shell and navigation), which R3 and R4 unblock

## 2026-09-25 - Owner rulings R5 to R9

- Actions taken:
  - Recorded five rows in `docs/wp/RULINGS.md`: site publishing parked for v1.1 (R5), Starter Kit card on free Home (R6), setup skippable (R7), the dashboard may sell, including promos for future products such as webinars (R8), no credit packs for now (R9)
  - PRD: status, non-goals, offer card rules (6.2), Builds and Plan and billing (6.3), free vs paid table (6.5), upgrade surfaces (6.6), wireframes, FR-18, new FR-29 to FR-32, schema rows, section 9.5 Offers, analytics, risks, section 12
  - Stories: new S12 (offer card), gate renumbered to S13, publish entry points removed in S5, S6, S7 and S9, Builder's Hub monthly only in S10
  - Canvas: hosted site removed from Builder's Hub, promo offer card added to the returning-member boards, dismiss buttons on offer cards, notes updated
- Decisions made (proposals inside the rulings):
  - "First session" means the first 24 hours after signup, taken from `users._creationTime`
  - Promos live in a typed config file (`lib/dashboard/offers.ts`), not an admin screen
  - Dismissals persist in `user_preferences.dismissed`, so no new table
- Found:
  - With publishing, hosting and reports parked, Builder's Hub at $29 a month sells collections, prompt packs, unlimited weekend plans and compare. Logged as a risk in PRD section 11
  - WP29 to WP31 exist to ship site publishing, so R5 may pause them too. Asked the owner. `docs/wp/v1-scope-cut.md` is unchanged until they answer
- Checks run: `git diff --check`
- Next: owner answers the WP29 to WP31 question. Phase A starts with S2

## 2026-09-25 - Renumbered from WP43 to WP44

- PR #77 merged homepage motion to `main` as WP43 (`docs/wp/wp43-*.md`) while this package was still on its branch. This package is now WP44: files renamed to `docs/wp/wp44-*`, story ids are `WP44-S*`, and the nine 2026-09-25 rows in `docs/wp/RULINGS.md` carry `WP44 /` scopes
- Those rows were relabelled before they ever reached `main`, so no merged ruling row was edited

## 2026-09-25 - WP29 to WP31 paused

- Owner ruled that R5 also pauses WP29, WP30 and WP31. Ruling row added. Registry rows marked paused. Pause banners added to `docs/wp/v1-scope-cut.md` and `docs/wp/AGENT_HANDOFF.md`
- Merged `origin/main` (#77) into this branch. The only conflict was `docs/wp/RULINGS.md`, where both sides appended rows. Kept main's 2026-09-24 WP43 row before this package's 2026-09-25 rows

## 2026-09-25 - WP44-S2 Light workspace shell and navigation

- Branch: `claude/wizardly-rubin-a6m2th` (this session is pinned to it, so S2 lands here, not on a `codex/` branch)
- Actions taken:
  - `WorkspaceShell` rewritten on research-desk tokens: one sidebar (248px, collapses to a 72px rail, choice kept per browser), brand wordmark with a compact W mark when collapsed and on phones, Home, Ideas and Saved, Resources (Starter Kit), account menu in the footer (Plan and billing, Sign out)
  - New: `AccountMenu` (Radix menu, non-modal), `WorkspaceSearch` (top bar, `role="search"`, submits to Explore, `/` focuses it and never steals a typed slash), `sidebar-state` (localStorage guarded by try/catch), `LegacyDarkSurface`
  - `workspace-current.ts` now holds the nav model and the pure checks for current item and the search shortcut. Saved is current for both the saved and interested views (R3). "New idea" and "Interested" are gone (R3, R4). `/dashboard/new` still renders by URL
  - Phones: bottom tabs Home, Ideas, Saved, Account. Account opens a bottom sheet (focus trapped by Radix) with Plan and billing, Starter Kit and Sign out
  - `useSignOut` tolerates a missing auth provider, so the shell no longer crashes when the Convex URL is missing
  - `AuthPlatformProvider` takes an optional `fallbackClassName` (default stays `bg-black` for auth pages). The dashboard passes paper. The dashboard layout loads the research-desk serif
  - Tests: `tests/platform/wp44-shell.test.ts` replaces `wp23-shell.test.ts`. `npm test` now runs `tests/platform` through a new `test:platform` script (these suites existed but never ran in `npm test`). One auth source test updated for the fallback prop
- Different from the written criteria, on purpose:
  - Builds (S9) and Settings (S8) are not in the nav yet, so no link leads to a 404. They join with their pages
  - "Build with AI" is left out: there is no `/build-with` index page. It returns after S8, pointing at the member's own tool
  - No counts on Saved or Builds: no count query exists until S3
  - Search reads "Search ideas" without the library total until S3 passes the count
  - Page content still uses dark styles, so it sits on `LegacyDarkSurface` until S4, S5 and S7 restyle it. Do not ship S2 to production on its own
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, as before)
  - `npm test` pass, including 24 platform tests
  - `npm run build` pass. `/dashboard/**` and `/ideas/[slug]` keep their route types (partial prerender)
  - Browser pass on `next dev` with a local-only auth bypass in `middleware.ts` (removed before commit, file verified clean): 1440px open and collapsed, account menu, Saved view, 390px with the Account sheet. No horizontal scroll at 390px. `/` focuses search. Tab order: skip link, home link, collapse, Home, Ideas, Saved, Starter Kit, Account, search
  - axe 4 (wcag2a/aa, wcag21a/aa): shell and Account sheet 0 violations. A modal account menu first raised `aria-hidden-focus`, fixed by making it non-modal. One remaining finding sits in the old page content: `aria-prohibited-attr` on the dashboard skeleton (`aria-label` on a plain div), owned by S4 and S7
- Found:
  - `/dashboard` never renders on the server today: `PreviewClaimRunner` calls `useMutation` during SSR with no Convex client, so React falls back to client rendering. Pre-existing on `main`. Added to S3, because server-rendered Home depends on it
- Next: S3 (dashboard data layer and events)

## 2026-09-25 - WP44-S3 Dashboard data layer and events

- Merged `origin/main` (#79, SEO crawl-budget cleanup) first. No conflicts
- Read `convex/_generated/ai/guidelines.md` before the Convex work
- Actions taken:
  - `convex/platform/dashboard.ts`: `platform.dashboard.home` returns first name, saved count, whether it is capped, the 5 latest saved ideas, and the defaults later stories fill (`setupDone: false`, `activePlan: null`, `plan: "free"`). Identity comes from `requireCurrentPlatformUser`. Saved is the union of the `saved` and `interested` flags (R3), read newest first from their two indexes, 100 rows each at most
  - `components/platform/client-gates.tsx`: `WhenConvexReady` (browser only, valid Convex URL only) and `QuietErrorBoundary`
  - Fixed the S2 finding: `PreviewClaimRunner` sits inside `WhenConvexReady`, so `/dashboard` renders on the server again
  - Shell: Saved shows its count in the sidebar ("99+" past 99, nothing at zero), gated and error-bounded. Search reads "Search N ideas" with the live library total
  - `lib/dashboard/editorial.ts` wraps the homepage's hourly `getHomeData()` cache: library total, week, weekly pick (the homepage's section 03 idea) and the 5 newest ideas. Returns null instead of throwing. The dashboard layout reads it for the total
  - `next.config.ts` traces the idea MDX and manifest into `/dashboard` and `/dashboard/**`
  - `lib/track.ts`: typed `trackDashboardEvent` for every PRD section 10 event. Each event forwards only its allowlisted keys
  - Tests: `convex/wp44Dashboard.test.ts` (7: sign-in required, R3 union and order, defaults, display-name greeting, two-member isolation, 99 cap, deleted ideas skipped) and `tests/platform/wp44-data.test.ts` (8: editorial mapping, layout wiring, tracing, server-render gates, event allowlist)
- Different from the written criteria, on purpose:
  - The page does not pass the weekly pick and newest ideas yet: nothing renders them until S4. S3 ships and tests the loader, and the layout already uses it. S4 wires the page
  - `convex/_generated/api.d.ts` was edited by hand (two lines, generator order and format) because `npx convex codegen` needs network access to Convex, which this environment blocks. The next real codegen should reproduce it exactly
  - The saved count is a bounded read capped at 99, not a denormalized counter. Rows per member are bounded by the library (one intent per idea) and the badge never shows more than "99+", so a counter would add a schema change and a write on every save for no visible gain. Revisit if intents ever stop being one per idea
  - `platform.ideas.dashboardSummary` stays until S4 removes the old Home that uses it
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, unchanged)
  - `npm test` pass
  - `npm run build` pass. Dashboard routes now revalidate hourly (1h/1d) instead of daily, because the layout reads the hourly homepage cache. The 5 Turbopack tracing warnings are the same ones WP42 recorded (`lib/mdx.tsx`, `lib/sitemap-data.ts`)
  - Browser, local-only auth bypass (removed before commit, file verified clean): the dev log shows no "Could not find Convex client" error, and the server HTML carries the shell and "Search 226 ideas". axe: shell and Account sheet 0 violations. The old Home skeleton still has `aria-prohibited-attr` (S4)
- Found:
  - A save whose idea row was deleted still counts in the badge but is left out of the latest list. Ideas are retired in the manifest rather than deleted, so this is rare. Noted, not fixed
- Next: S4 (Home modules)

## 2026-09-25 - WP44-S4 Home modules

- Merged `origin/main` (#78, homepage AEO fixes) first. No conflicts
- Read `convex/_generated/ai/guidelines.md` before the Convex work
- Actions taken:
  - New Home in `components/platform/home/*`, on research-desk tokens, off `LegacyDarkSurface` (`WorkspaceSurface` skips it for `/dashboard` only)
  - Greeting: date line with ISO week, serif greeting by local time of day and first name (no comma without a name), status line ("4 saved ideas. Your weekend starts Friday.")
  - Module 1, next step card: New shows "Start here" with "Save this week’s pick" and "Browse N ideas". Choosing (1+ saves) shows the 3 latest saved ideas as a comparison table (hours, score, tools) with "See all saved"
  - Module 2, idea of the week: art band, category, title, pitch, four labelled score bars, hours, goal, cited sources, tools, "Read the research", Save. Server-rendered from the homepage cache
  - Module 3, picked for you: 3 unsaved ideas from the `for_you` view, skipping ideas Home already shows. The three are pinned on first load, so saving one does not swap the card away
  - Module 4, newest ideas: 5 Index rows (N°, title, category, hours, Save) and "View all" (Explore, newest first). Server-rendered
  - Rail (1280px+, stacks under module 4 below that): 5 latest saved, then the Starter Kit card for free members, dismissible, with `offer_viewed`, `offer_clicked` and `offer_dismissed`. Dismiss moves focus to the Saved heading
  - Save toggle (`SaveIdeaButton`): `aria-pressed`, filled icon when saved, polite live announcement, optimistic update, `explore_state_changed` with source `home`. New Convex `platform.dashboard.savedState({ slug })` and `platform.dashboard.setSaved({ slug, saved })`. Removing clears both flags (R3). Keyed by slug because editorial cards come from the manifest
  - `platform.dashboard.home` latest rows now carry goal, tools and the mean score for the shortlist
  - Every Convex consumer sits behind `WhenConvexReady` plus an error boundary. `WhenConvexReady` gained an `unavailable` slot for a missing Convex URL. Skeletons use `role="status"`. A failed module shows "We can’t load your ideas right now. Try again in a minute." with a retry, and the editorial modules stay
  - `app/dashboard/loading.tsx` and `error.tsx` restyled light. The preview-claim notice restyled light
  - `dashboard_viewed` fires once with state and plan
  - Removed: the old `components/platform/shell/DashboardHome.tsx`, `platform.ideas.dashboardSummary` and its WP23 tests, `tests/platform/wp23-dashboard.test.ts` (its Convex URL checks moved to the new test)
  - `lib/home`: `SpotlightIdea` gained `tools` (additive, the homepage ignores it)
  - Tests: `tests/platform/wp44-home.test.ts` (21: copy helpers, module order, server rendering, gates, removed copy, a11y contracts) and 8 more in `convex/wp44Dashboard.test.ts` (sign-in, unseeded idea, save and remove, R3 clearing, Interested reads as saved, keeps Interested on save, no-op remove, two-member isolation)
- Different from the written criteria, on purpose:
  - Module 4 is labelled "Newest ideas", not "New this week". The five newest span 10 to 24 September, so "this week" would be false
  - The "New, set up" state and the setup questions arrive with S8. Until then New shows the "Start here" card
  - Choosing's primary action is "See all saved", not "Plan my weekend". Weekend plans arrive with S9
  - No "Past picks" link: there is no page for it
  - The Starter Kit dismissal is per browser (localStorage) until S12 stores it on the member. The card does not yet hide for members who claimed the kit (S12 checks that on the server)
  - Module 1's New card and module 2 both offer the weekly pick. Module 1 shows only a Save button for it, not a second card
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, unchanged)
  - `npm test` pass (platform 49, Convex WP44 23 with the WP23 explore and intent tests)
  - `npm run build` pass. Same 5 Turbopack warnings as before
  - Browser, local-only auth bypass in `middleware.ts` (removed before commit, file verified clean) and a fake Convex websocket in Playwright that answers `home`, `savedState`, `explore` and `setSaved` from the real manifest:
    - 1440px and 390px for New, Choosing and module errors. 1280px shows the rail beside the modules. No horizontal scroll at 390px
    - Clicking "Save this week’s pick" turns module 1 into the shortlist and the status line into "1 saved idea"
    - Dismissing the kit card stores it and moves focus to "Saved"
    - axe 4 (wcag2a/aa, wcag21a/aa and best-practice): 0 violations in every state, including loading. The S2/S3 `aria-prohibited-attr` finding is gone
- Found:
  - `for_you` ranks one page of ideas (newest first), so picks come from the 24 newest ideas only. S8 owns ranking and should rank the whole library
- Next: S5 (Ideas library and Saved)
