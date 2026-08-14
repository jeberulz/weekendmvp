# WP23 Stories - Signed-In Shell, Dashboard, Explore, And Intent

Branch: `codex/wp23-platform-explore`
Lane: Work Package within Build Platform Program Wave 2
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Authenticated users can navigate an accessible, responsive Hilos-inspired workspace; the dashboard reports only real owner-scoped state; Explore presents the canonical idea records with bounded pagination, transparent recommendations, search/filter/sort, and persisted Saved/Interested state; Building is derived only from active projects; private pages are noindex; and the standard gate plus independent auth/accessibility review pass without changing WP22 contracts.

## Frozen Product Contract

- Retain the existing authenticated `app/dashboard/**` route tree and `AuthPlatformProvider` boundary.
- Public `/ideas/{slug}` remains the sole canonical research page. Explore links to it and never creates a second research corpus.
- `For you` is deterministic canonical score/recency rank plus a bounded category-affinity boost derived only from this user's Saved/Interested state. Cold start is canonical rank. No LLM or hidden profile.
- Saved and Interested are independent owner-scoped flags. Building is read-only and derived from an active project with the matching `sourceIdeaId`.
- Visual direction is the approved dark editorial workspace: narrow product rail, contextual sidebar, calm artifact/status cards, and a bounded-action composer whose suggestions link only to explicit routes/workflows.
- Desktop uses rail plus contextual sidebar; mobile uses bottom navigation and an accessible contextual sheet. WCAG 2.1 AA is the floor.

## Stories

- [x] `WP23-S1` - Build the authenticated responsive workspace shell
  - Scope: `app/dashboard/layout.tsx`, `components/platform/shell/**`, shell-focused tests.
  - Acceptance criteria:
    - Preserve request-time auth protection and render one semantic `nav` and one `main` with skip link, visible focus, current-page state, keyboard operation, and private-page noindex metadata.
    - Desktop has a narrow product rail and contextual sidebar; mobile has bottom navigation and a focus-trapped, Escape-closeable contextual sheet with focus restoration.
    - Primary routes are Dashboard, Explore, New idea, Projects, and Billing; unavailable deeper actions are honest links/disabled states rather than fake interactions.
    - Use existing Geist/type and dark token system, shadcn primitives, and Lucide icons. No gradients, glassmorphism, decorative card grids, oversized headings, or custom icon drawings.
  - Verification: focused component/route tests, `npm run typecheck`, `npm run lint`, `git diff --check`.

- [x] `WP23-S2` - Replace the placeholder dashboard with truthful owner state
  - Scope: `app/dashboard/page.tsx`, `convex/platform/ideas.ts` or a narrowly named dashboard query in the same WP23 module, dashboard components/tests.
  - Acceptance criteria:
    - Show a clear next action, active/recent owner projects, recent Saved/Interested ideas, and available account/project state only when backed by server data.
    - Empty/loading/error states are explicit and useful; no invented activity, revenue, progress percentage, credit balance, or AI-generated status.
    - All private reads derive the user server-side, use WP22 authorization helpers/indexes, exclude archived records, and return bounded projections.
    - The bounded-action composer maps suggestions to supported links/actions only and makes no free-agent promise.
  - Verification: anonymous/two-user tests, empty/populated UI tests, `npm run test:convex`, `npm run typecheck`.

- [x] `WP23-S3` - Implement bounded canonical Explore discovery
  - Scope: `convex/platform/ideas.ts`, `components/platform/explore/**`, `app/dashboard/explore/**`, focused tests.
  - Acceptance criteria:
    - `All`, `For you`, `Saved`, `Interested`, and `Building` views reuse `ideas` rows and return pagination metadata plus minimal card projections and current-user state.
    - Search, category/filter, and sort operate on server-returned canonical metadata. Existing indexed pagination remains the source traversal; per-page filtering is honest and bounded, with Load more/next-page behavior rather than an unbounded scan or schema change.
    - `For you` implements the frozen deterministic ranking and exposes a short plain-language explanation. Ranking has stable tie-breakers and deterministic tests.
    - Each card opens `/ideas/{slug}` for research and offers `Preview this idea` via `/build/{slug}`; no private duplicate article route is added.
  - Verification: pagination/filter/ranking tests, empty/loading/error UI states, `npm run test:convex`, `npm run typecheck`.

- [x] `WP23-S4` - Persist owner-scoped Saved and Interested intent
  - Scope: `convex/platform/ideas.ts`, Explore intent controls/tests.
  - Acceptance criteria:
    - Mutations upsert by server-derived owner plus canonical idea, preserve the other independent flag, validate the idea exists, and never accept a caller user ID.
    - Anonymous and cross-owner access fail closed with the WP22 error contract; rapid/repeated toggles settle to server-confirmed state and do not report success before confirmation.
    - Building is never written to `idea_intents`; it is derived from a non-archived project in an active lifecycle state.
    - Legacy `saved_ideas` remains untouched; no migration/backfill or dual-write is introduced.
  - Verification: anonymous/two-user/independent-flag/repeated-toggle/project-derived tests and `npm run test:convex`.

- [x] `WP23-S5` - Complete Explore interaction, responsive, and accessibility states
  - Scope: WP23-owned app/components/tests only.
  - Acceptance criteria:
    - Filters and tabs are URL-addressable where practical, keyboard operable, announced correctly, and usable at 320 px without horizontal page overflow.
    - Controls have accessible names, status changes use restrained live-region announcements, touch targets are usable, motion respects reduced-motion, and color is not the only state cue.
    - Cards retain calm information hierarchy across desktop/tablet/mobile; long titles and empty metadata do not break layout.
    - Signed-out access returns through the established sign-in flow, and private routes remain noindex/noarchive.
  - Verification: focused browser journey at desktop/mobile, keyboard-only pass, automated a11y scan, route/auth tests.

- [x] `WP23-S6` - Run the WP23 UI/auth gate
  - Scope: `docs/wp/wp23-progress.md` plus WP23-owned fixes only.
  - Acceptance criteria:
    - Standard checks and focused Convex/UI/browser/a11y tests pass with no new errors or unwaived high dependency finding.
    - Independent review reports no unresolved high finding in owner isolation, private caching/indexing, navigation, accessibility, canonical-content separation, or misleading UI state.
    - No schema/status/index change, production deploy/data mutation, billing/intake implementation, or marketing/global-nav rewrite occurred.
  - Verification: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, secret-pattern scan.

## File Boundaries

The WP23 worker may edit `app/dashboard/page.tsx`, `app/dashboard/layout.tsx`, new `app/dashboard/explore/**`, new `components/platform/shell/**` and `components/platform/explore/**`, `convex/platform/ideas.ts`, focused tests, generated Convex API types when required, and `docs/wp/wp23-progress.md`. It must not edit `app/dashboard/new/**`, `app/dashboard/billing/**`, public idea bodies/metadata, Stripe/legacy payment code, or `convex/schema.ts`.

## Stop Conditions

- Stop if a table, field, validator, lifecycle status, or index must change; WP22 is frozen and shared schema changes require orchestrator serialization.
- Stop if the design needs a product rule beyond the frozen UX/recommendation contract, or if a feature would duplicate canonical research.
- Stop before any cloud/production deployment, data mutation outside tests/local development, or secret/environment change.
