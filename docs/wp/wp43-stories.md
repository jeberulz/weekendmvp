# WP43 Stories - Ideas-first dashboard (free and paid)

Branch: `claude/wizardly-rubin-a6m2th` (PRD and plan). Build phases branch from `main` per phase (see Sequencing).
Lane: Work Package (UI flow, shared logic, additive schema). The subscription billing it depends on is a separate high-risk Work Package.
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: `/dashboard` is the light, ideas-first home described in `docs/wp/wp43-dashboard-prd.md`. Free members get Home, Ideas, Saved and one weekend plan. Builder UI and server-side entitlements exist behind a flag. Every `/dashboard/**` route passes `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and a WCAG 2.1 AA review at 390px and 1440px, and `/ideas/{slug}` stays static and canonical.

Product source: `docs/wp/wp43-dashboard-prd.md`. Visual source: the design canvas [Weekend MVP Dashboard](https://claude.ai/artifact/SoKxJm9Urpeyo8p9NntLG5) (private until shared). S1 exports approved artboards to `docs/wp/evidence/`.

## Sequencing

```text
S1 rulings
 |
 +-- Phase A (no schema change until S5)
 |     S2 shell + nav ──> S3 data + events ──> S4 Home modules
 |                                   └──────> S5 Ideas + Saved (schema writer #1: search index)
 |     S6 save from idea page (after S5)
 |     S7 restyle remaining routes (parallel with S4 to S6, separate files)
 |
 +-- Phase B (after S5 merges)
 |     S8 setup + preferences (schema writer #2)
 |     S9 weekend plans (schema writer #3, after S8 merges)
 |
 +-- Phase C (after rulings R1, R2, R5, R8)
 |     S10 entitlements + upgrade surfaces (flagged)
 |     S11 Builder features (flagged)
 |
 S12 package gate
```

- One `convex/schema.ts` writer per merge window: S5, then S8, then S9.
- S7 owns only files no other story touches (billing, projects, intake, error and loading files).
- Phase A ships value on its own. Phase C does not block A or B.

## Stories

- [ ] `WP43-S1` - Record rulings and freeze scope
  - Scope: `docs/wp/RULINGS.md`, `docs/wp/wp43-dashboard-prd.md`, `docs/wp/wp43-progress.md`
  - Acceptance criteria:
    - Owner answers R1 to R8 from PRD section 12. Each answer is one new row in `docs/wp/RULINGS.md`
    - PRD status changes from Draft to Approved, with any changes the rulings make
    - Fresh IdeaBrowser logged-in screenshots saved to `docs/wp/evidence/` (the session that wrote the PRD could not reach the site)
    - Approved canvas artboards exported as PNGs to `docs/wp/evidence/wp43-*.png`
  - Verification:
    - `git diff --check`
  - Model tier: low

- [ ] `WP43-S2` - Light workspace shell and navigation
  - Scope: `components/platform/shell/*`, `app/dashboard/layout.tsx`, `app/dashboard/SignOutButton.tsx`, `tests/**/workspace-current*`
  - Acceptance criteria:
    - One collapsible sidebar (248px to 72px rail) replaces today's rail plus second sidebar
    - Nav: Home, Ideas, Saved (count), Builds (count), Resources (Starter Kit, Build with AI), account menu in the footer (Plan and billing, Settings, Sign out)
    - "New idea" and "Interested" are gone from nav (rulings R3, R4). `/dashboard/new` still works by URL
    - Top bar holds search only ("Search N ideas", `/` focuses it)
    - Mobile below 1024px: bottom tabs Home, Ideas, Saved, Builds, Account. Account opens a focus-trapped sheet
    - Research-desk tokens only (`home-*`), no `#050505` left in the shell
    - Skip link and a single labelled `nav` remain. The shell renders the only `main`
  - Verification:
    - `npm run typecheck`
    - `npm test`
    - Screenshots at 390px and 1440px, keyboard pass through nav and sheet
  - Model tier: mid

- [ ] `WP43-S3` - Dashboard data layer and events
  - Scope: `convex/platform/dashboard.ts` (new), `convex/platform/ideas.ts` (deprecate `dashboardSummary` once unused), `app/dashboard/page.tsx`, `next.config.ts` (file tracing for `/dashboard` only), `lib/track.ts` event names, tests under `convex/` and `tests/`
  - Acceptance criteria:
    - `platform.dashboard.home` returns first name, saved count (union of `saved` and `interested`), 5 latest saved ideas, and fields for setup, active plan and plan tier set to empty defaults until S8, S9 and S10
    - It derives identity with `requireCurrentPlatformUser` and reads with bounded indexed queries
    - Two-user test: user B never sees user A's saves
    - `app/dashboard/page.tsx` is a server component that calls `getHomeData()` and passes the weekly pick and newest rows down. Those slugs equal the ones on `/` for the same hour (test)
    - Idea files are traced into the `/dashboard` function, as WP42 did for `/`
    - Events from PRD section 10 exist in `lib/track.ts` and send no PII
  - Verification:
    - `npm run typecheck`
    - `npm test`
    - `npm run build` shows `/dashboard` builds and `/` is unchanged
  - Model tier: high (Convex data and auth boundary)

- [ ] `WP43-S4` - Home modules
  - Scope: `components/platform/home/*` (new), `components/platform/shell/DashboardHome.tsx` (replaced), reuse from `components/home/*` without editing it
  - Acceptance criteria:
    - Date line, serif greeting (time of day and first name, no comma when no name), status line
    - Module 1 next step card with the New, New set up and Choosing states from PRD 6.2. Building and Finished render once S9 lands
    - Module 2 Idea of the week with art band, 4 labelled score meters, hours, tools, Read the research, Save
    - Module 3 Picked for you: 3 unsaved ideas from the `for_you` view. Reason line shows only when S8 supplies one
    - Module 4 New this week: 5 Index-style rows with Save and "View all"
    - Right rail at 1280px+: 5 latest saved and the Starter Kit card (ruling R6)
    - Editorial modules render on the server. Personal modules show layout-sized skeletons. A failed personal query shows a module-level error, never a blank page
    - All copy from PRD 6.8 applied. None of the removed system copy remains
    - `PreviewClaimRunner` still runs on `/dashboard`
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - Screenshots of each module state at 390px and 1440px compared with the canvas artboards
  - Model tier: mid

- [ ] `WP43-S5` - Ideas library and Saved
  - Scope: `convex/schema.ts` (additive `searchIndex` on `ideas` only), `convex/platform/ideas.ts`, `components/platform/explore/*`, `app/dashboard/explore/*`, `app/dashboard/saved/*` (new), tests
  - Acceptance criteria:
    - Search runs over the full library through the new search index. The "applies to each indexed page" limitation and its copy are gone
    - Filters: category, tools, build time, revenue goal. They combine with search and sort and live in the URL
    - Tabs: All, For you, New. Card grid by default with a list toggle. Cards show art, pitch, 4 score meters, hours, tools, Save
    - Saved page lists ideas where `saved` or `interested` is true. Unsave clears both flags
    - Save and unsave keep the existing live-region announcements
  - Verification:
    - `npm run typecheck`
    - `npm test` including a two-user test for Saved and a search test across more than one page of results
    - `npm run test:convex` passes, and `npm run convex:dev` accepts the additive index on a dev deployment
  - Model tier: high (schema writer #1)

- [ ] `WP43-S6` - Save from the public idea page
  - Scope: `components/ideas/SaveIdeaButton.tsx` (new client island), `app/ideas/[slug]/page.tsx` (mount point only), `lib/auth-return.ts` if a pending-save param is needed
  - Acceptance criteria:
    - The island renders nothing on the server and on first paint. After hydration it shows Save only when the `wmvp_signed_in` hint cookie exists
    - Anonymous click goes to `/signup?returnTo=/ideas/{slug}` and the save completes after signup
    - `/ideas/{slug}` keeps its route type in the build output, its canonical tag, and its JSON-LD
  - Verification:
    - `npm run build` route table unchanged for `/ideas/[slug]`
    - The canonical idea SEO tests pass
    - Manual check signed in and signed out
  - Model tier: mid (touches a public SEO page)

- [ ] `WP43-S7` - Restyle the remaining dashboard routes
  - Scope: `app/dashboard/billing/*`, `components/platform/billing/*`, `app/dashboard/projects/**`, `components/platform/projects/*`, `app/dashboard/new/*`, `components/platform/intake/*`, `app/dashboard/**/error.tsx`, `app/dashboard/**/loading.tsx`
  - Acceptance criteria:
    - Every `/dashboard/**` route uses the research-desk theme
    - Billing is titled "Plan and billing" and no longer renders its own `main` (fixes the nested landmark)
    - Error and loading states match the new layout and use the plain copy from PRD 6.8
    - No behaviour change to checkout, projects or intake
  - Verification:
    - `npm run typecheck`
    - `npm test` (billing and intake suites unchanged and green)
    - axe at 390px and 1440px on each route
  - Model tier: mid

- [ ] `WP43-S8` - Setup questions and personal ranking
  - Scope: `convex/schema.ts` (additive `user_preferences`), `convex/platform/preferences.ts` (new), `convex/platform/ideas.ts` (`for_you` ranking and `reason`), Home module 1 and 3, Settings page `app/dashboard/settings/*` (new)
  - Acceptance criteria:
    - Three questions inline on Home (tools, weekend hours, goal) as checkbox and radio groups inside fieldsets. Skippable (ruling R7)
    - Answers stored owner-scoped. Editable in Settings
    - `for_you` uses tools, hours and goal plus saved categories. Each result carries a `reason` that maps to one input, or none
    - `setup_completed` and `setup_skipped` events fire
  - Verification:
    - `npm run typecheck`
    - `npm test` including two-user and ranking-reason tests
  - Model tier: high (schema writer #2, ranking logic)

- [ ] `WP43-S9` - Weekend plans and Builds
  - Scope: `convex/schema.ts` (additive `weekend_plans`), `convex/platform/plans.ts` (new), `app/dashboard/builds/**` (new), Home module 1 Building and Finished states, Building badge in Ideas and Saved
  - Acceptance criteria:
    - Start a plan from Home, Ideas, Saved or an idea page. Four stages from `WEEKEND_PLAN`
    - Steps check and uncheck, persist, and announce changes politely
    - Each stage shows the idea's matching prompts with copy and a "Prompt copied" announcement
    - Sunday links to `/build/{slug}` and shows the live URL once a linked project is published
    - Builds lists the active plan, finished plans, and existing projects (claimed previews, published sites)
    - Free members hold 1 active plan. Until S10 the limit is enforced in the mutation with a plain error message
  - Verification:
    - `npm run typecheck`
    - `npm test` including ownership, one-active-plan, and archive tests
    - Screenshots of the plan detail at 390px and 1440px
  - Model tier: high (schema writer #3, state machine)

- [ ] `WP43-S10` - Entitlements and upgrade surfaces (flagged)
  - Scope: `convex/platform/entitlements.ts` (new), gated mutations from S9 and S11, `components/platform/plan/*` (new: Plan card, upgrade sheet, comparison table), Plan and billing page
  - Acceptance criteria:
    - `getEntitlements(ctx, ownerId)` returns `{ plan, limits }` and returns Free until the subscription WP ships
    - Gated mutations throw `ConvexError({ code: "UPGRADE_REQUIRED", feature })`. The UI opens the upgrade sheet for that feature
    - Plan card, sheet, tags and Plan and billing page follow PRD 6.6. Every sheet has a free way forward
    - A feature flag hides all Builder UI in production until the owner turns it on
    - Builder state shows no upgrade prompt anywhere (test with a stubbed Builder resolver)
    - `upgrade_prompt_viewed` and `upgrade_clicked` fire
  - Verification:
    - `npm run typecheck`
    - `npm test` including "client cannot bypass the limit" tests
  - Model tier: high (access control)

- [ ] `WP43-S11` - Builder features (flagged)
  - Scope: collections and notes (additive tables, schema writer #4, after S9), prompt pack export (`lib/prompt-pack/*`, deterministic, no AI calls), compare view (`app/dashboard/compare/*`)
  - Acceptance criteria:
    - Collections: create, rename, delete, add and remove ideas. Notes are private and owner-scoped
    - Prompt pack: download a zip or single file per tool built from the idea's prompts and stack (for example `CLAUDE.md`, `.cursor/rules/*.mdc`, a Lovable brief)
    - Compare: up to 4 ideas side by side on scores, hours, tools, revenue goal, and pricing
    - Each feature checks entitlements server-side
  - Verification:
    - `npm run typecheck`
    - `npm test` including ownership and entitlement tests
  - Model tier: mid (high for the schema part)

- [ ] `WP43-S12` - Package gate
  - Scope: verification only
  - Acceptance criteria:
    - Standard checks green
    - axe (wcag2a/aa, wcag21a/aa) 0 violations on every `/dashboard/**` route at 390px and 1440px
    - Keyboard and screen reader pass on nav, save, setup, plan steps and the upgrade sheet
    - `/ideas/{slug}` route type, canonical and JSON-LD unchanged
    - Private routes noindex and absent from the sitemap
    - Evidence recorded in `docs/wp/wp43-progress.md` and `docs/wp/wave-gate-report.md`
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`
  - Model tier: high (final review)

## Out Of Scope

- Stripe subscription checkout, webhooks and the subscription record (proposed as its own high-risk WP after rulings R1 and R5)
- Own-idea Validation Reports (WP26 S2 to S6, v1.1)
- Any paywall, blur or delay on `/ideas/{slug}` or `/startup-ideas`
- AI chat or agents on Home
- Dark mode for the workspace
- Teams, sharing and public profiles
- Changes to the homepage (`/`) or `components/home/*`

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- `.agentic-workflow.yml` prefers `codex/` branches. This session is pinned to `claude/wizardly-rubin-a6m2th`, so the PRD and plan live here. Build phases should branch from `main` (for example `codex/wp43-dashboard-a`).
- Read `convex/_generated/ai/guidelines.md` before S3, S5, S8, S9, S10 and S11.
- WP29-min (project cockpit) should hang off Builds (S9), not off Home.
