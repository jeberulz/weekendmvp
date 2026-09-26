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

## 2026-09-25 - WP44-S5 Ideas library and Saved

- `origin/main` had not moved since S4. Nothing to merge
- Read `convex/_generated/ai/guidelines.md` before the Convex work
- Actions taken:
  - Schema (writer #1, additive): two search indexes on `ideas`, `search_title` and `search_description`, both filterable by category
  - `convex/platform/ideas.ts`: new `platform.ideas.library` query. Search reads both search indexes (title matches first). Without search it reads the whole library, newest first, capped at 1,000 rows with a `truncated` flag. Filters (category, any of the picked tools, build-time bucket, revenue goal) combine with search and sort. Facet counts for each filter ignore that filter's own choice. Sorts: best match, newest, highest score, and recommended (score plus a small lift for categories the member saves). New takes its 30-day bound from the client, because queries must not read the clock. `unsavedOnly` serves Home's picks
  - `convex/platform/ideaCards.ts`: one card shape for every list, and `readSavedIntents` (saved or interested, R3) shared by Home, the library and Saved
  - `platform.dashboard.savedList`: the Saved page, newest save first, exact total up to 500
  - Ideas page (`/dashboard/explore`, titled "Ideas"): tabs All, For you, New as links with `aria-current`. Filters as labelled selects with counts, plus a Tools menu of checkboxes that stays open for several picks. Active filters show as removable chips with "Clear all". Sort on the All tab. Grid by default, list toggle kept per browser. "Show more ideas" grows the page by 24 and keeps the old results on screen while the next load
  - One search field: the top bar. On Ideas it keeps the tab and filters when a new search runs. The page has no field of its own
  - Cards: art band (a category-tinted stand-in with the category icon when the cover is not generated yet), category, title, two-line pitch, four score bars, hours, tools, Save. List rows: title, category, hours, score, tools, Save
  - Saved page (`/dashboard/saved`): one list, newest first, with the save date. A removed row stays in place as unsaved until the member leaves, so its announcement is heard and Save undoes it
  - `/dashboard/explore?view=saved` and `view=interested` redirect to `/dashboard/saved`. `view=building` redirects to Ideas. The sidebar Saved link and Home links point at `/dashboard/saved`
  - `SaveIdeaButton` takes an optional known `saved` state, so list cards skip the per-idea subscription. Announcements unchanged
  - Home picks now use `library` with `unsavedOnly`, so they rank the whole library (the S4 finding)
  - `ScoreMeters` shared by the weekly pick and the cards. `components/home/ui.tsx` exports `categoryTintClass` (additive, the homepage is unchanged)
  - Removed: `platform.ideas.explore`, `platform.ideas.setIntent` (no callers left: Save is the one toggle, R3), `ExploreWorkspace`, `ExploreCard`, `convex/platformIdeas.test.ts` and `tests/platform/wp23-explore.test.ts`
  - Tests: `convex/wp44Library.test.ts` (15: vocabulary, sign-in, search past the first page with 60 ideas, combined filters and facets, New bound, three sorts, R3 saved marks and `unsavedOnly`, two-member isolation, limits, card shape, Saved list order and isolation, removal clears both flags, paging past deleted ideas) and `tests/platform/wp44-library.test.ts` (15: URL state, search wiring, removed copy, one search field, redirects, tabs, cards, filters and tokens)
- Different from the written criteria, on purpose:
  - Search also covers descriptions (second search index). Title-only search missed ideas whose titles do not name the problem, for example "Chases every unpaid invoice" under a product name
  - The library is not cursor-paginated. It is a bounded catalog (226 ideas), so one capped read gives exact totals and facet counts over the whole library, which pages cannot. Past 1,000 ideas, browsing shows the newest 1,000 and says so, while search still reaches the rest. Revisit with the aggregate component if the library passes 1,000
  - Filter counts sit inside the selects and the Tools menu. Chips show only active filters. Chips for all 30 options would push the results below the fold
  - The sort menu shows on the All tab only. For you always ranks by recommendation and New always sorts newest
  - Cards no longer show "Building" from site projects (parked, R5). S9 brings it back from weekend plans
  - Saved has no "Compare" hint and no "Plan my weekend" yet. They come with S11 and S9
  - `npm run convex:dev` against a dev deployment was not run: this environment cannot reach Convex. The indexes are additive and `convex-test` exercises both, but the first real deploy is where the backfill gets confirmed. `convex/_generated/api.d.ts` was edited by hand again (two new modules, generator order)
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, unchanged)
  - `npm test` pass (`test:convex` 21 files, `test:platform` 4 files)
  - `npm run build` pass. `/dashboard/saved` is a new partial-prerender route. Same 5 Turbopack warnings
  - Browser, local-only auth bypass in `middleware.ts` (removed before commit, file verified clean) and the fake Convex websocket, now answering `library` and `savedList` from the real manifest:
    - Ideas at 1440px: 24 cards, "Show more ideas" makes 48. Top-bar search for "invoice" gives 7 matches. Category plus Bolt gives 9, the Tools menu stays open while picking, and a new search keeps both filters in the URL. List layout survives a reload. Save on a row announces "Saved …". New shows 53 ideas. `view=interested` lands on Saved
    - Saved at 1440px: 4 rows. Removing one keeps the row, unpressed, announces the removal, and the count drops to 3. Empty state checked
    - 390px: no horizontal scroll on either page
    - axe 4 (wcag2a/aa, wcag21a/aa and best-practice): 0 violations on every screen, including the open Tools menu. A portalled menu first raised `region`, fixed by rendering it inside `main`
- Found:
  - The three newest ideas (24 Sep) have `og.status: "pending"`, so they have no cover art anywhere yet. `npm run og:generate` should fill them. Not run here: it is a content step outside this story
- Next: S6 (Save from the public idea page)

## 2026-09-25 - WP44-S6 Save from the public idea page

- Merged `origin/main` (#80, homepage structured-data tests) first. No conflicts
- Actions taken:
  - `components/ideas/SaveIdeaButton.tsx`: client island on `/ideas/{slug}`. Its server snapshot is null, so the server HTML and the first paint carry no Save control. After hydration, readers with the `wmvp_signed_in` hint get the Save toggle (`aria-pressed`, polite announcement, "See your saved ideas" once saved). Everyone else gets "Save idea", a link to sign-up
  - `app/api/platform/saved/route.ts` (new): GET returns this member's saved state for one slug, POST sets it. The route reads the httpOnly session with `convexAuthNextjsToken()` and calls `platform.dashboard.savedState` and `setSaved`, so the idea page never reads cookies and stays prerendered. POST refuses any request without a same-origin `Origin` (and a cross-site `Sec-Fetch-Site`) before it reads the body or the session. Slugs are validated. Responses are `private, no-store`. A stale hint (no real session) reads as signed out and falls back to the sign-up link
  - `lib/pending-save.ts` (new): an anonymous click stores `{ slug, title, at }` in this browser, then goes to `/signup?returnTo=/dashboard/saved`. Nothing goes in the URL, so a crafted link cannot save an idea for someone. Entries expire after 2 hours and are read once
  - `components/platform/shell/PendingSaveRunner.tsx` (new), mounted in the shell behind `WhenConvexReady`: completes the pending save once, then shows "Saved “…”. Back to the idea" in a polite live region with a dismiss button
  - `app/ideas/[slug]/page.tsx`: `PreviewIdeaCta` no longer renders (R5). The component and `/build/{slug}` stay for v1.1. The island sits in a reserved `min-h-10` slot under the scores
  - Tests: `tests/platform/wp44-idea-save.test.ts` (14: stash round trip, expiry, future and malformed entries, blocked storage, return path inside the auth allowlist, slug rules, same-origin checks, body parsing, check order in the route, static page, reserved slot, canonical and JSON-LD, island server snapshot, runner gating). `tests/security/wp25-routes.test.mjs` now asserts the preview CTA is not rendered and the component still exists
- Different from the written criteria, on purpose:
  - Sign-up returns to `/dashboard/saved`, not `/ideas/{slug}`. Returning to the idea page means widening three post-auth redirect allowlists that are deliberately locked to `/dashboard`: `safePlatformReturn` in `lib/auth-return.ts`, `safeAuthRedirect` in `convex/auth.ts` (a Convex deploy), and `safeDashboardReturn` in `convex/resendMagicLink.ts`. Auth code stays untouched. The save still completes after sign-up, and the notice links straight back to the idea. PRD FR-10 and FR-11 updated to match
  - The written criteria said the island shows only with the hint cookie, and also that anonymous readers can click Save. Both hold: signed-in readers get the toggle, anonymous readers get the sign-up link, and neither is in the server HTML
  - The save state comes from a small API route rather than a Convex client on the page. A client-only Convex Auth provider cannot see a session that started on the server (sign-in redirects straight to the return path, so no token reaches the browser), and mounting the server provider would make every idea page dynamic
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, unchanged)
  - `npm test` pass, including the canonical and SEO suites (`tests/redirects`, `tests/links`, `tests/home/seo.test.ts`)
  - `npm run build` pass. The `/ideas/[slug]` rows are identical to S5's build (◐ route, ○ prerendered paths, 1d/1w). `/api/platform/saved` is a dynamic route. The prerendered `ideas/abandoned-cart-recovery.html` has the canonical tag, 2 JSON-LD blocks, the empty reserved slot, and no Save control or preview link
  - Browser (dev server; local-only auth bypass in `middleware.ts`, removed before commit, file verified clean):
    - Real route guards with no session: GET gives `{"signedIn":false}` with `private, no-store`, a bad slug gives 400, POST without an Origin or from another origin gives 403, and a same-origin POST without a session gives 401
    - Signed out: "Save idea" links to `/signup?returnTo=%2Fdashboard%2Fsaved` and stores the pending save. Layout shift 0 at 1280px and at 390px, no horizontal scroll
    - Signed in (route responses faked in the browser): the toggle posts `{ slug, saved: true }`, turns pressed, announces "Saved …" and shows "See your saved ideas". A stale hint falls back to the sign-up link
    - Dashboard with a pending save and a fake Convex websocket: `setSaved` runs once, the notice reads "Saved “…”. Back to the idea", the stash is cleared, and a reload does not save again
    - axe 4 (wcag2a/aa, wcag21a/aa): 0 violations in the idea page Save slot, signed out and signed in. On the dashboard the only finding is the cookie banner's "Learn more in our Privacy Policy" line (`text-neutral-500` on near-black), which shows until consent is chosen. Pre-existing and site-wide. Queued as its own task
- Not done here: a real signed-in check against a live Convex deployment. This environment cannot reach Convex, so the session path through `convexAuthNextjsToken()` is exercised by the anonymous route checks only
- Next: S7 (restyle billing, projects, intake, error and loading; subscription-only Plan and billing)

## 2026-09-25 - WP44-S7 Restyle the remaining dashboard routes

- `origin/main` had not moved since S6. Nothing to merge
- Actions taken:
  - `app/globals.css`: a `.theme-desk` scope maps the shadcn tokens (Button, Badge, Label, Input) onto the research-desk palette. The workspace shell sets it, so every control under `/dashboard/**` reads light. `--input` is ink-3, which keeps field borders at 3:1 against the card
  - `LegacyDarkSurface` deleted. The shell keeps only the phone tab-bar padding
  - Plan and billing (`/dashboard/billing`): titled "Plan and billing", no `main` of its own (fixes the nested landmark). Shows the Free plan as the current plan with what it includes today, and "Nothing to pay on the Free plan". Builder's Hub ($29 a month, billed monthly) shows only when `NEXT_PUBLIC_BUILDERS_HUB=on`, with "Not open yet" and no upgrade button
  - `convex/platform/plans.ts` (new, pure): the one plan constant (ids `free` and `builders_hub`, names, price, what each includes) and the `buildersHubUiEnabled` flag check. S10's entitlements resolver goes beside it. `.env.example` documents the flag
  - Credit packs hidden, not deleted (R9): the page no longer renders `BillingWorkspace`. The component, checkout route and ledger stay as they are
  - Projects (`/dashboard/projects/**`) and intake (`/dashboard/new`) restyled. They still render by URL. The "Add your idea" buttons are gone (R4), so nothing links to intake. The project cockpit hides its publish form and credit balance behind `SITE_PUBLISHING_PARKED` (R5, R9). The publish and credit code is untouched, and the balance query is skipped while parked
  - Page titles on these routes use the serif heading. Outer spacing matches Home, Ideas and Saved. Skeletons announce through `role="status"`. Route errors use the light `PlatformRouteError`
  - Tests: `tests/platform/wp44-restyle.test.ts` (9: no dark classes in any route or platform component, apart from the parked `BillingWorkspace`; the dark surface is gone; the token scope; skeleton roles; Plan and billing title, landmark and flag; credits hidden but kept; the plan constant; no links to projects or intake; the cockpit hides publish and credits). S4 and S5 tests updated for the deleted surface
- Different from the written criteria, on purpose:
  - Builder's Hub shows on Plan and billing only behind its flag. S10 requires all Builder's Hub UI hidden in production until the owner turns it on, and there is nothing to buy yet. The flag and the plan constant are created here so S10 builds on them
  - The Free plan lists only what ships today. "1 active weekend plan" joins the list with S9
  - Project cards stay on `/dashboard/projects`. That page is only reachable by URL now, and the criteria keep it rendering. No other surface links to it
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, unchanged)
  - `npm test` pass. Billing, intake and WP29 cockpit suites unchanged and green. The env documentation test caught the new flag first, and `.env.example` now lists it
  - `npm run build` pass. Every `/dashboard/**` route keeps its route type. Same 5 Turbopack warnings
  - Browser (local-only auth bypass in `middleware.ts`, removed before commit, file verified clean; fake Convex websocket with project and intake data): Home, Ideas, Saved, Plan and billing, Projects, a project, a missing project (route error) and intake, each at 1440px and 390px. Every page has exactly one `main`, the right `h1`, and no horizontal scroll. axe 4 (wcag2a/aa, wcag21a/aa and best-practice): 0 violations on all 16 views. Plan and billing also checked with the Builder's Hub flag on: 0 violations
- Phase A (S2 to S7) is complete
- Next: S8 (setup questions and personal ranking, schema writer #2)

## 2026-09-25 - WP44-S8 Setup questions and personal ranking

- `origin/main` had not moved since S7. Nothing to merge
- Read `convex/_generated/ai/guidelines.md` before the Convex work
- Actions taken:
  - Schema (writer #2, additive): `user_preferences` with `ownerId`, `tools[]`, optional `weeklyHours` and `goal`, `onboardedAt?`, `skippedAt?`, `dismissed[]?` (for S12) and `updatedAt`, indexed `by_ownerId`
  - `convex/platform/setupOptions.ts` (pure) and `setupValidators.ts`: the tool, hours and goal lists, labels, the goal-to-revenue map, `fitsWeekend`, and the reason shapes and their sentences
  - `convex/platform/preferences.ts`: `get`, `saveSetup` and `skipSetup`, owner-scoped through the session. Tools must come from the allowlist (at most 8, deduped). A left-out answer is cleared. Skipping keeps any answers
  - `convex/platform/forYou.ts` (pure): For you rank = research score plus bounded nudges: saved-category lift (0.1 per save, up to 0.5), weekend fit (+0.4, or -0.6 when the build is longer than the member's weekend), goal match (+0.3), tool match (+0.3). Each idea gets at most one reason. A saved idea in the same category wins ("Like SlackToDoc, which you saved"). Otherwise the rarest input that applies wins, and any input matching more than 80% of ideas is never used, so a reason always says something
  - `platform.ideas.library` ranks For you with it and returns `reason` on For you cards only. `platform.dashboard.home` reports `setupDone` and `setupSkipped`
  - Home module 1: the three questions as checkbox and radio groups in fieldsets, with the native control visible in each chip. "Show my ideas" saves, "Skip for now" skips (R7). Either way the card becomes "Start here", focus moves to its heading, and a polite message says what happened. Module 3 shows the reason line and re-picks when the answers change, with a hint to answer (or a link to Settings after a skip)
  - Ideas For you tab: reason lines on cards and rows, and an explainer with "Edit your answers"
  - Settings (`/dashboard/settings`, new): the same form, prefilled, "Save answers". Linked from the account menu and the phone sheet
  - Events: `setup_completed` (tool count, hours bucket, goal, "none" for an unanswered question) and `setup_skipped`
  - Tests: `convex/wp44Preferences.test.ts` (15: vocabulary, weekend fit, reason sentences, sign-in, save and clear, allowlist, skip, two-member isolation, ranking moves with answers, "like" reason, reasons only in For you, two members see different orders, rarest input wins, near-universal tool never shows, no inputs means score order) and `tests/platform/wp44-setup.test.ts` (8)
- Different from the written criteria, on purpose:
  - Learning and portfolio goals have no revenue target, so they never move the ranking or appear as a reason. Side income maps to $1K and $5K goals, replacing a job to $10K
  - Audiences are not used yet. `solo-founders` is on 192 of 226 ideas, so it would not separate anything
  - A reason names the rarest input that applies, not the heaviest one. Side income matches about 69% of the library, so it would otherwise label most cards
  - `convex/_generated/api.d.ts` was edited by hand again (five new modules, generator order). `npm run convex:dev` was not run: no network to Convex
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, unchanged)
  - `npm test` pass (Convex WP44 suites 45 tests, platform 89)
  - `npm run build` pass. `/dashboard/settings` is a new partial-prerender route. Same 5 Turbopack warnings
  - Browser (local-only auth bypass in `middleware.ts`, removed before commit, file verified clean; fake Convex websocket keeping preference state): Home shows the three legends. Picking Bolt, Lovable, 8 hrs and Side income sends one `saveSetup`, focus lands on "Save the ideas you could build this weekend.", the message reads "Saved your answers. Picked for you now uses them.", and the picks show reason lines. "Skip for now" sends `skipSetup` and shows the Settings hint. Settings loads the saved answers checked, and a change saves with a confirmation. For you shows reason lines. 390px has no horizontal scroll. axe 4 (wcag2a/aa, wcag21a/aa and best-practice): 0 violations on Home with the questions, Home after setup, phone, Settings and For you
- Next: S9 (weekend plans and Builds, schema writer #3)

## 2026-09-25 - WP44-S9 Weekend plans and Builds

- `origin/main` had not moved since S8. Nothing to merge
- Read `convex/_generated/ai/guidelines.md` before the Convex work
- Actions taken:
  - Schema (writer #3, additive): `weekend_plans` with `ownerId`, `ideaId`, `status` (active, done, archived), `steps[]` (`key`, `doneAt`), `coreFeature?`, `liveUrl?`, `startedAt`, `updatedAt`, `completedAt?`, `archivedAt?`, indexed `by_ownerId_and_status_and_updatedAt` and `by_ownerId_and_ideaId`
  - `convex/platform/weekendSteps.ts` (pure): 4 stages and 8 steps in the homepage `WEEKEND_PLAN` order, progress, the current stage, the next step, and live link rules (http or https, no credentials, a real host, 300 characters at most)
  - `convex/platform/weekendPlans.ts`: `start`, `toggleStep`, `setCoreFeature`, `setLiveUrl`, `finish`, `archive`, `get`, `list` and `startPreview`. Identity comes from the session. A missing plan and another member's plan both read as not found, and ids from the URL go through `normalizeId`. Only an active plan can change. Free members hold 1 active plan (R2): a second start throws `ACTIVE_PLAN_LIMIT`, and `replaceActive` archives the current plan first. Saving a core feature checks "Write down the one core feature", and saving a live link checks "Put it live and save the link"
  - `platform.dashboard.home` returns `activePlan` and `lastFinished`. Library and Saved cards carry `building` for the idea with the active plan (FR-20)
  - Prompts: `/api/ideas/prompts?slug=` (new) returns an idea's build prompts from its MDX, cached with the idea content. Members only (401 without a session), because the public page keeps them behind its email gate. `private, max-age=300`. Traced into the function in `next.config.ts`. Saturday gets setup and build prompts, Sunday gets landing, branding and launch prompts. All 228 ideas have a Saturday prompt. 100 have a Sunday one, and the rest show a short fallback
  - Start page (`/dashboard/builds/new?idea=…&from=…`, new): every "Plan my weekend" link lands here. It shows the four stages and starts the plan on click. With another plan running it says so and offers "Keep my current plan" or "Archive it and start this idea". Fires `weekend_plan_started` with its source
  - Plan detail (`/dashboard/builds/{planId}`, new): one card per stage with day, hours and a text status (Done, Now, Up next). Native checkboxes, saved with an optimistic update, with progress announced politely ("3 of 8 steps done. Saturday done."). Friday has the core feature field. Saturday and Sunday list the prompts with Copy (announces "Prompt copied") and a disclosure for the full text. Sunday has the live link field with an inline error. Monday has "Finish this weekend" behind an inline confirm. Finishing shows "You shipped." and moves focus to it. Archive also asks first. A closed plan is read only, with plain done and not-done marks. No link to preview, publish or credits (R5)
  - Builds (`/dashboard/builds`, new): the active plan with progress, next step and Continue, then finished plans with their live links, or an empty state that points to Saved
  - Home module 1: Building (day progress, next step, today's prompt with Copy, Open plan) and Finished for a week after a plan ends ("You shipped.", the live link, "Pick the next idea"). The shortlist gets a plan link per row. `dashboard_viewed` reports `building` and `finished`
  - Cards and rows in Ideas and Saved: a "Building" badge and a plan link beside Save ("Open your plan" for the idea being built)
  - Idea page island: signed-in readers also get "Plan my weekend" (source `idea_page`). Signed-out readers still see only the sign-up link
  - Nav: Builds joins the sidebar with a count and the phone tab bar (5 tabs). The Free plan list on Plan and billing now includes "1 active weekend plan"
  - Tests: `convex/wp44WeekendPlans.test.ts` (11: step model, progress, live link rules, sign-in, start and steps and Home, one active plan with the archive way forward and the start preview, finish to Builds with the live link, archive, two-member isolation and bad ids, invalid steps and long features, Building on cards) and `tests/platform/wp44-builds.test.ts` (14). Shell and Home tests updated for Builds and the new states
- Different from the written criteria, on purpose:
  - Functions live in `convex/platform/weekendPlans.ts`, not `plans.ts`, which holds the S7 plan constant
  - Starting goes through one start page rather than a button on each card. The limit and the archive option then live in one place, and nothing starts from a prefetch or a stray tap
  - Until S10, the limit shows as a card on the start page, not the upgrade sheet
  - `weekend_step_completed` fires once when a stage's last step is checked, since the event takes a day, not a step
  - `convex/_generated/api.d.ts` was edited by hand again (two new modules, generator order). `npm run convex:dev` was not run: no network to Convex
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, all in `scripts/`, unchanged)
  - `npm test` pass (Convex WP44 suites 56 tests, platform 104)
  - `npm run build` pass. `/dashboard/builds`, `/dashboard/builds/new` and `/dashboard/builds/[planId]` are partial-prerender routes, `/api/ideas/prompts` is dynamic. Same 5 Turbopack warnings
  - Browser (local-only auth bypass in `middleware.ts`, removed before commit, file verified clean; fake Convex websocket keeping plan state; prompts route faked in the browser with the idea's real prompts). The real prompts route answers 401 without a session and 400 for a bad slug. A bad slug on the start page redirects to Builds:
    - Plan detail: checking a step sends `toggleStep` and announces the count. Finishing Saturday announces "Saturday done." Copy puts the prompt on the clipboard and announces "Prompt copied". A bad link sets `aria-invalid` with an error. A good link saves and shows "Open …". Finish asks, focuses "Yes, finish", then focuses "You shipped." with every step read only
    - A wrong plan id shows "We can’t find that plan." Builds lists the active and finished plans, and the nav count reads 2
    - Start page with a plan running shows the limit card. "Archive it and start this idea" sends `start` with `replaceActive` and opens the new plan. With nothing running, "Start my weekend plan" starts and opens it
    - Home shows Building with the day's prompt (copy announces), Finished with the live link, and plan links on the shortlist. Saved and Ideas show one Building badge
    - 390px: no horizontal scroll, 5 tabs. axe 4 (wcag2a/aa, wcag21a/aa and best-practice): 0 violations on all 14 views
  - Screenshots: `docs/wp/evidence/wp44-s9-plan-1440.png` and `docs/wp/evidence/wp44-s9-plan-390.png`
- Not done here: a real signed-in check against a live Convex deployment, and the schema push. This environment cannot reach Convex
- Next: S10 (entitlements and upgrade surfaces, flagged)

## 2026-09-26 - WP44-S10 Entitlements and upgrade surfaces (flagged)

- `origin/main` had not moved since S9. Nothing to merge
- Read `convex/_generated/ai/guidelines.md` before the Convex work. No schema change
- Actions taken:
  - `convex/platform/plans.ts` (the one plan constant): limits per plan (Free: 1 active weekend plan, no collections, no prompt pack, no compare; Builder's Hub: no limits, compare up to 4), the four gated features, the sheet's comparison rows, Plan and billing's rows, the upgrade label built from the name and price, and two pure rules: `upsellVisible` (flag on, Free, past the first day) and `upgradeSheetAllowed` (flag on, Free)
  - `convex/platform/planResolver.ts` (new): `resolvePlan` returns Free for everyone (FR-22). The subscription WP changes only this. It is its own module so tests can stand in a Builder's Hub member
  - `convex/platform/entitlements.ts` (new): `getEntitlements(ctx, ownerId)` returns `{ plan, limits }`. `upgradeRequired(feature)` builds `ConvexError({ code: "UPGRADE_REQUIRED", feature })`. `requireFeature` refuses the on/off features for S11. `mine` gives the UI the plan, limits, active plan count and join time
  - Weekend plans now take their limit from entitlements. A second plan on Free throws `UPGRADE_REQUIRED` for `weekend_plan`, naming the plan to archive. `replaceActive` archives rather than raising the limit. `startPreview` reports `atLimit`. `list` returns every active plan, and the Building badge marks every idea with one, so Builder's Hub can run several. `dashboard.home` reads `plan` from entitlements
  - Flag: `components/platform/plan/flag.ts` reads `NEXT_PUBLIC_BUILDERS_HUB`. With it off, nothing below renders and the entitlements query is skipped
  - Plan card (sidebar footer): "Free plan", "1 of 1 weekend plan in use" with a meter, one line on Builder's Hub, "See Builder's Hub". The one dark element. Free members only, not in the first day, not in the collapsed rail. The account chip shows the plan name
  - Upgrade sheet: a Radix dialog (focus trap, Escape, focus back to the button that asked). Title and line per feature, the Free against Builder's Hub table with the feature's row marked, "Upgrade to Builder's Hub · $29/mo", a free way forward and "Not now". It opens when the server refuses, not before
  - Start page, flag on: at the limit it shows a note and the "Builder's Hub" tag on "Start my weekend plan". Clicking still calls the server; `UPGRADE_REQUIRED` opens the sheet with "Archive your current plan and start this one". Flag off: the S9 limit card, unchanged
  - Plan and billing, flag on: the Free against Builder's Hub table with "Current plan" on the member's column, then "Not open yet" for Free members, and no upsell for Builder's Hub members. Wraps on phones instead of scrolling sideways
  - Events: `upgrade_prompt_viewed` (sidebar, sheet, billing) and `upgrade_clicked` (sidebar, sheet)
  - Tests: `convex/wp44Entitlements.test.ts` (10: the real resolver says Free, the plan constant, upsell rules, sign-in, `mine`, the error and its data, the client cannot bypass the limit (extra arguments refused, archiving keeps the count at 1, closed plans stay closed), on/off features refused on Free, a stubbed Builder's Hub member runs three plans with no refusal and every Building badge, and the plan is per member) and `tests/platform/wp44-upgrade.test.ts` (9). S7 and S9 tests updated for the new error code and the table
- Different from the written criteria, on purpose:
  - The upgrade button goes to Plan and billing, which says "Not open yet". There is nothing to buy until the subscription WP, which points `UPGRADE_HREF` at checkout
  - Tags sit only on "Start my weekend plan" at the limit. Collections, prompt packs and compare get theirs with S11, when those actions exist
  - Plan and billing shows the table in the first day too, since the member opened it. The Plan card and tags wait a day
  - The free way forward reads "Archive your current plan and start this one". Long idea titles made a two-line button, and the sheet's description already names the plan
  - The stubbed resolver is a `vi.mock` of `planResolver.ts` in the test file, not a runtime switch, so nothing in production can turn a member into Builder's Hub
  - `convex/_generated/api.d.ts` was edited by hand again (two new modules, generator order). `npm run convex:dev` was not run: no network to Convex
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, unchanged)
  - `npm test` pass (Convex WP44 suites 66 tests, platform 113)
  - `npm run build` pass (flag off, as in production). Same 5 Turbopack warnings
  - Browser (local-only auth bypass in `middleware.ts`, removed before commit, file verified clean; fake Convex websocket):
    - Flag off: the S9 harness passes unchanged (14 views, axe 0). No Plan card, no entitlements subscription, no table on Plan and billing, the S9 limit card, no tags
    - Flag on, Free member a month in: the Plan card reads "1 of 1 weekend plan in use", and hides in the collapsed rail. Day one: no Plan card and no tag, but the sheet still opens on request
    - Start page at the limit: "Start my weekend plan, Builder's Hub". The click sends `start`, the server refuses, the sheet opens with focus inside, Tab stays inside, Escape closes it and focus returns to the button. "Archive your current plan and start this one" sends `start` with `replaceActive` and opens the new plan. Same at 390px, where the sheet rises from the bottom
    - Builder's Hub member (stubbed): no Plan card, the chip reads "Builder's Hub", no note or tag, a second plan starts with no sheet, and Plan and billing marks Builder's Hub as current with no upsell
    - axe 4 (wcag2a/aa, wcag21a/aa and best-practice): 0 violations on Home with the Plan card, the start page, the sheet (both widths) and Plan and billing (Free, Builder's Hub, phone)
  - Screenshots: `docs/wp/evidence/wp44-s10-sheet-1440.png`, `wp44-s10-sheet-390.png`, `wp44-s10-billing-1440.png`, `wp44-s10-billing-390.png`
- Not done here: a real check against a live Convex deployment. This environment cannot reach Convex
- Next: S11 (Builder's Hub features, flagged)

## 2026-09-26 - WP44-S11 Builder's Hub features (flagged)

- `origin/main` had not moved since S10. Nothing to merge
- Read `convex/_generated/ai/guidelines.md` before the Convex work
- Actions taken:
  - Schema (writer #4, additive): `collections` (`ownerId`, `name`, `itemCount`, `updatedAt`), `collection_items` (`ownerId`, `collectionId`, `ideaId`, `addedAt`) and `idea_notes` (`ownerId`, `ideaId`, `body`, `updatedAt`). Items live in their own table. The item count sits on the collection, kept by the mutations, so lists never count rows
  - `convex/platform/collections.ts`: `list`, `create`, `rename`, `remove`, `addIdea`, `removeIdea`, `forIdea`, `items`. `convex/platform/notes.ts`: `get` and `save`. Owner-scoped, with missing and unowned ids answering the same. Bounds in `convex/platform/hubLimits.ts` (pure, shared with the forms): names 60 characters, 50 collections, 200 ideas each, notes 2,000 characters
  - Gates: creating, renaming, adding ideas and writing notes need the `collections` entitlement. Reading, taking ideas out, deleting a collection and clearing a note never do, so a member who leaves Builder's Hub keeps their data and can tidy it
  - `convex/platform/compare.ts`: `ideas({ slugs })` gated on `compare`, 2 to `compareMax` ideas in the order asked. `convex/platform/promptPack.ts`: `source({ slug })` gated on `prompt_pack`. `entitlements.check({ feature })` lets the UI ask before it opens a form
  - Prompt pack (`lib/prompt-pack/*`): deterministic, no AI call, clock or random value. One brief (what, problem, how it works, stack, weekend scope, every prompt in order) shaped per tool: `CLAUDE.md`, a Cursor `.mdc` rule, a Windsurf rule, and Lovable, Bolt, v0 and Replit briefs. "All tools" is a zip with a README. The zip writer is ours (stored entries, fixed timestamp), so the same idea always gives the same bytes and there is no new dependency
  - `/api/ideas/prompt-pack?slug=&format=` (new): checks the plan in Convex with the member's session before building, then returns the file with `private, no-store`. 401 without a session, 403 `UPGRADE_REQUIRED` on Free, 400 for a bad slug or format. MDX traced into the function
  - Saved (flag on): a toolbar with the Collections nav, "New collection" and "Compare". Builder's Hub rows get a collections menu, a private note (shown under the row) and, in compare mode, a Compare checkbox with a sticky "Compare N ideas" bar. `/dashboard/saved?collection=…` shows one collection with rename, delete (with a confirm) and "Remove from …" per row
  - Compare (`/dashboard/compare?ideas=…`, new): scores, build time, tools, revenue goal, pricing tiers and "Plan my weekend", side by side. The table scrolls sideways on phones inside a focusable, named region
  - "Export prompt pack" on the plan page and on Home's Building card. The format picker is a radio group
  - Sidebar: a Collections group for members who have collections
  - Free members (flag on) see "New collection", "Compare" and "Export prompt pack" with the Builder's Hub tag. The click asks the server, which refuses, and the sheet opens with "Not now". A refused download also opens the sheet. Opening the compare URL directly shows "Compare is part of Builder's Hub" with a way to Saved
  - Tests: `convex/wp44BuildersHub.test.ts` (8: every gate refuses Free on the server, anonymous callers refused, the full collections and notes flow, bounds, owner privacy across two members, keeping data after leaving Builder's Hub, compare size and order, the prompt pack source) and `tests/platform/wp44-hub.test.ts` (13: the zip parses with Node's CRC and matches byte for byte, each tool's file, fence escaping, a real idea, no clock or AI in the builder, the route's check order, flags, gates, tags, landmarks and URL validation)
- Different from the written criteria, on purpose:
  - Notes sit under the `collections` entitlement ("Collections and notes" on every plan table), not a feature of their own
  - Free members get no per-row collection or note tools, since they cannot have collections. The toolbar buttons are their point of intent
  - Reads and deletes stay open after a downgrade (see Gates above). Only writes need the plan
  - Pricing on the compare page comes from each idea's public MDX; the rest of the table comes from the gated query
  - `convex/_generated/api.d.ts` was edited by hand again (five new modules, generator order). `npm run convex:dev` was not run: no network to Convex
- Found and fixed during the browser check: the compare table's screen-reader text escaped its scroll box (the region was not `position: relative`), which widened the phone page to 506px. Now 390px
- Checks run:
  - `npm run typecheck` pass
  - `npm run lint` 0 errors (35 warnings, unchanged)
  - `npm test` pass (Convex WP44 suites 74 tests, platform 126)
  - `npm run build` pass (flag off). `/dashboard/compare` and `/dashboard/saved` are partial-prerender routes, `/api/ideas/prompt-pack` is dynamic. Same 5 Turbopack warnings
  - Browser (local-only auth bypass in `middleware.ts`, removed before commit, file verified clean; fake Convex websocket; the download route faked in the browser). The real route answers 401 without a session and 400 for a bad format:
    - Flag on, Free: "New collection" and "Compare" carry the tag. Each click opens the sheet with no mutation sent, and Escape returns focus. The compare URL shows the locked card. "Export prompt pack" opens the prompt pack sheet
    - Flag on, Builder's Hub (stubbed): the Collections nav and sidebar group, a note under its row, the collections menu adds an idea and announces it, a new note focuses its field, saves, and returns focus. Compare picks 2 ideas and opens the table. "New collection" creates one and opens it. Rename saves and returns focus to the heading. A wrong collection id shows "We can’t find that collection." Export opens 8 formats, downloads `adspark-prompt-pack.zip`, and a refused download opens the sheet
    - 390px: Saved and compare have no page scroll. The compare table scrolls inside its region
    - Flag off: no toolbar, row tools, sidebar group, export or collection view, compare says "not available yet", and no S11 query is subscribed. S9 (13 views) and S10 harnesses pass unchanged
    - axe 4 (wcag2a/aa, wcag21a/aa and best-practice): 0 violations on all 12 S11 views, including the open collections menu, the note form and the export panel
  - Screenshots: `docs/wp/evidence/wp44-s11-saved-1440.png`, `wp44-s11-saved-390.png`, `wp44-s11-compare-1440.png`, `wp44-s11-export-1440.png`
- Not done here: a real check against a live Convex deployment and the schema push. This environment cannot reach Convex
- Next: S12 (offer card: Starter Kit and promos)
