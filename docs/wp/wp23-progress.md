# WP23 Progress - Signed-In Shell, Dashboard, Explore, And Intent

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup and story freeze

- Branch/worktree: `codex/wp23-platform-explore`, `.worktrees/wp23-platform-explore`.
- Assignment: WP23 worker owns S1-S5 and prepares S6 evidence. The orchestrator owns story checkboxes, cross-package rulings, registry/manifest/ledger/gate truth, independent review, and integration.
- Frozen UX: approved dark editorial workspace; canonical public research remains at `/ideas/{slug}`; private Explore adds personal/project state only; Preview links to `/build/{slug}`; responsive rail/sidebar becomes bottom nav/context sheet.
- Frozen recommendation rule: deterministic canonical score/recency with bounded Saved/Interested category affinity; cold start canonical rank; no LLM, hidden profile, duplicate corpus, or writable Building flag.
- Shared-contract boundary: WP22 schema, validators, statuses, indexes, and authorization helpers are immutable in this worktree. Existing `saved_ideas` is not migrated.
- Required gate: typecheck, lint, complete tests, build, production dependency audit, diff/secret scans, focused browser/a11y journeys, and independent high-risk auth/accessibility review.
- Production remains untouched: no deploy, data backfill, environment mutation, or private user-data inspection is authorized.
- Next: implement one story at a time, append evidence and blockers here, and return a cleanly scoped diff.

## 2026-08-05 - WP23-S1 implemented

- Added the authenticated workspace shell while retaining `AuthPlatformProvider`: one labelled workspace `nav`, one shell-owned `main`, a skip link, visible focus treatment, current-page state, dark editorial rail/context sidebar, and a mobile bottom navigation plus Radix focus-trapped sheet.
- Dashboard metadata now denies indexing, following, image indexing, and caching. The placeholder page no longer creates a competing `main` landmark.
- Primary routes are honest links to the frozen dashboard, Explore, intake, and billing contracts. The project-cockpit state is described as unavailable until a brief exists; no fake project or agent interaction was added.
- Focused evidence: `npx vitest run tests/platform/wp23-shell.test.ts` (3 passed), `npm run typecheck` (passed), `npm run lint` (passed), and `git diff --check` (passed).
- Docs: this append-only story evidence is the relevant documentation update; no architecture, schema, env, or production documentation changed.
- Production remains untouched. S1 is implemented but its checkbox and package gate remain owned by the orchestrator.

## 2026-08-05 - WP23-S2 implemented

- Replaced the placeholder with a truthful dashboard home backed by `platform/ideas.dashboardSummary`. The query derives the current user through WP22 auth, uses owner indexes, bounds every traversal, excludes archived projects, hydrates only canonical idea projections, and returns a credit balance only when a real account exists.
- Added explicit skeleton, empty, populated, and route-error states. The next action uses Explore or the frozen `/build/{slug}` preview contract; supported shortcuts are ordinary links and explicitly state that they do not run an autonomous agent.
- The visual treatment uses sparse dividers and one purposeful next-action surface rather than a metric-card grid. No revenue, progress percentage, account activity, or credit value is invented.
- Focused evidence: `npx vitest run convex/platformIdeas.test.ts tests/platform/wp23-dashboard.test.ts tests/platform/wp23-shell.test.ts` (8 passed), `npm run typecheck` (passed), `npm run lint` (passed), and `git diff --check` (passed). Convex coverage includes anonymous denial and two-owner isolation with archived-state exclusion.
- Generated API typing was minimally updated for the new WP23 module; schema, statuses, indexes, legacy `saved_ideas`, and production state remain unchanged.
- S2 is implemented but its checkbox and package gate remain owned by the orchestrator.

## 2026-08-05 - WP23-S3 implemented

- Added owner-aware, canonical Explore discovery with `All`, `For you`, `Saved`, `Interested`, and project-derived `Building` views. Each branch begins from a frozen WP22 index and passes the native pagination options unchanged before bounded per-page filtering/ranking.
- Search, category, and sort state are URL-addressable. The interface explicitly says that search/filter apply as each indexed page loads and offers `Load next page`; it does not imply an unbounded full-table search.
- `For you` uses the frozen deterministic rule: canonical score, recency tie-break, stable slug tie-break, and a category-affinity boost capped at 0.5 from at most 48 of the current owner's recent Saved/Interested records. It explains this in plain language and uses no wall clock, LLM, or hidden profile.
- Explore is a calm, responsive editorial list rather than an identical-card grid. Every item links to canonical `/ideas/{slug}` research and the frozen `/build/{slug}` preview action; no private article route or duplicate body was created.
- Focused evidence: `npx vitest run convex/platformIdeas.test.ts tests/platform/wp23-explore.test.ts tests/platform/wp23-dashboard.test.ts tests/platform/wp23-shell.test.ts` (16 passed), `npm run typecheck` (passed), `npm run lint` (passed), and `git diff --check` (passed). Tests cover anonymous denial, canonical indexed pagination, category/search filtering, deterministic affinity ranking, and Saved owner isolation.
- Schema, indexes, public idea bodies, and production state remain unchanged. S3 is implemented but its checkbox and package gate remain owned by the orchestrator.

## 2026-08-05 - WP23-S4 implemented

- Added one `setIntent` mutation with only canonical `ideaId`, frozen `saved|interested` flag, and boolean value arguments. It derives the user through WP22 auth, validates the idea, upserts on the owner+idea index, preserves the other flag, and returns the authoritative state.
- Explore controls use `aria-pressed`, disable overlapping changes, await the Convex mutation, then update and announce only the returned server-confirmed state. Failure copy is non-destructive and does not claim success.
- Building has no mutation path or intent field. Explore derives it only from a current owner's non-archived project with the canonical `sourceIdeaId`; archived and cross-owner projects do not surface.
- Focused evidence: `npx vitest run convex/platformIdeas.test.ts tests/platform/wp23-explore.test.ts tests/platform/wp23-dashboard.test.ts tests/platform/wp23-shell.test.ts` (21 passed), `npm run typecheck` (passed), `npm run lint` (passed), and `git diff --check` (passed). Coverage includes anonymous denial, independent flags, repeated updates, two-owner rows, missing canonical idea denial, and project-derived Building removal after archive.
- Legacy `saved_ideas` was not read, written, migrated, or backfilled. Schema, indexes, and production state remain unchanged. S4 is implemented but its checkbox and package gate remain owned by the orchestrator.

## 2026-08-05 - WP23-S5 implemented

- Completed URL-addressable Explore tabs, native labelled search/category/sort controls, keyboard-visible focus, 44-48 px primary touch targets, constrained horizontal tab scrolling, long-title wrapping, explicit async/empty/error states, and restrained polite announcements.
- Mobile navigation now keeps every label visible, exposes sign-out in the focus-trapped Radix sheet, and retains the desktop rail/context model without adding a second `nav`. Skeleton and skip-link motion disable under `prefers-reduced-motion`.
- Raised small-text contrast from zinc-500/600 to zinc-400 and changed white-on-orange primary actions to orange-800/700. The Impeccable detector returned `[]` across all WP23 dashboard/Explore surfaces after the pass.
- Local Playwright browser evidence verified signed-out `/dashboard/explore?view=for_you` is protected and returns to `/signin?returnTo=%2Fdashboard%2Fexplore%3Fview%3Dfor_you`; no auth/session state was fabricated. The isolated browser had no credential-backed user session, so the authenticated visual/keyboard journey remains explicit S6 independent-gate work rather than being overstated here.
- Focused evidence: six Vitest files including auth return contracts (53 passed), the ESLint accessibility severity/probe suite (2 passed), `npm run typecheck` (passed), `npm run lint` (passed), and `git diff --check` (passed). Source-focused tests assert labels, pressed state, live regions, touch sizing, reduced-motion classes, private metadata, canonical links, and absent writable Building.
- No schema/index, production, environment, public idea, billing, or intake change occurred. S5 is implemented; the orchestrator still owns checkboxes and S6 gate truth.

## 2026-08-05 - WP23-S6 evidence prepared (gate not complete)

- Standard checks on the final implementation: `npm run typecheck` passed; `npm run lint` passed; `npm test` passed all configured groups (91 OG, 6 links, 32 redirects/middleware, 29 auth, 4 security/a11y, 4 sitemap, 87 Convex); `npm run build` passed and generated 304 routes/pages including partial-prerendered `/dashboard` and `/dashboard/explore`.
- Additional checks: focused WP23/auth Vitest (53 passed before the final hardening pass; final WP23 subset 24 passed), accessibility probe (2 passed), `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities, `git diff --check` passed, scoped secret-pattern scan returned no matches, and the Impeccable detector returned `[]`.
- Build warnings are the existing five dynamic-filesystem tracing warnings in `lib/mdx.tsx` and `lib/sitemap-data.ts`, plus the existing middleware deprecation notice; WP23 does not own those files and introduced no new build warning.
- Required independent owner-isolation/accessibility review and an authenticated desktop/mobile keyboard browser journey remain open S6 gate items. The worker does not mark the package gate complete.
- `next dev` auto-generated a 10-line `nextjs-agent-rules` block in root `AGENTS.md`. This shared-file tooling diff is outside WP23 ownership, was not edited further, and is reported separately for orchestrator serialization.
- Production/cloud state remains untouched: no deployment, data mutation, key/env change, email, payment, or external write was performed.

## 2026-08-05 - Independent-review corrections implemented

- Remediated all five Medium findings from the independent WP23 review. The orchestrator authorized one serialized WP22 contract amendment: `projects.by_ownerId_and_sourceIdeaId_and_archivedAt` over `[ownerId, sourceIdeaId, archivedAt]`. This is the only schema/index change in the correction window; statuses, validators, tables, and all other indexes remain frozen.
- The additive index is required because WP25 idempotency does not guarantee one project per owner/source idea. Building now performs an exact indexed lookup for `ownerId + sourceIdeaId + archivedAt === undefined` and uses bounded `.first()` existence, eliminating the arbitrary first-20 false negative without an unbounded scan. The frozen contract inventory now names and exercises the index. A regression places one active project behind 25 archived rows for the same owner/idea, verifies Building remains true, then verifies it disappears when the active row is archived.
- Radix Sheet reduced-motion overrides now apply to the actual portal overlay and content animations. The shared Sheet primitive gained only an opt-in `overlayClassName` passthrough; global defaults are unchanged. The focused test slices the WP23 `SheetContent` declaration and asserts both overlay and content overrides rather than passing on the unrelated skip-link class.
- Explore search is now a controlled form keyed by the canonical URL query. Clear-link navigation and browser history changes remount it from the URL, while native GET submission preserves the current view/category/sort. Saved and Interested sidebar state now derives from both pathname and `view` search params, and the base Explore link yields current state to those specific views.
- Missing or malformed `NEXT_PUBLIC_CONVEX_URL` is validated before constructing the authenticated browser client. Dashboard and Explore render explicit non-destructive configuration alerts after hydration instead of an endless skeleton or invalid client construction; the URL validator has focused hosted/local/missing/malformed coverage.
- Correction evidence: focused six-file Vitest suite passed 36 tests; `npm run typecheck` passed; `npm run lint` passed with 0 errors and the existing 35 unrelated warnings; `npm test` passed all 254 configured tests (91 OG, 6 links, 32 redirects/middleware, 30 auth, 4 security/a11y, 4 sitemap, 87 Convex); `npm run build` passed all 304 routes/pages; and `git diff --check` passed. Build output retained only the existing middleware deprecation and five dynamic-filesystem tracing warnings outside WP23.
- No Convex cloud command, migration, deployment, data mutation, environment change, stage, commit, push, billing/intake/public-content expansion, or WP24/WP25 edit was performed. The independent authenticated visual/keyboard S6 gate remains owned by the orchestrator.

## 2026-08-05 - Convex deployment URL guard aligned

- The final Medium review found that the first configuration guard was broader in some places and weaker in another than the installed client. `convex@1.43.0` keeps `validateDeploymentUrl` internal (`node_modules/convex/src/common/index.ts`) and does not expose it through the package export map; `ConvexReactClient` reaches it from `src/browser/simple_client.ts` before opening a connection.
- The local guard now narrowly mirrors the installed checks: require the raw `http:` or `https:` prefix, require `new URL(value)` to succeed, and reject `.convex.site` HTTP-action addresses. It also rejects leading or trailing whitespace before those checks so environment copy/paste mistakes cannot be normalized into a client address. The authenticated client provider already calls this guard before `new ConvexReactClient(url)`, allowing Dashboard/Explore to render their explicit configuration alert instead of throwing during client construction.
- Focused regressions cover `.convex.site`, whitespace-prefixed and whitespace-suffixed valid cloud URLs, a valid `.convex.cloud` deployment, and valid `localhost` plus `127.0.0.1` local deployments. No schema, Convex function, environment, dependency, product behavior, deployment, data, stage, commit, or push change was made.
- Final evidence: `npx vitest run tests/platform/wp23-dashboard.test.ts tests/auth/auth-platform-provider.test.ts` passed 8 tests across 2 files; `npm run typecheck` passed; `npm run lint` passed with 0 errors and the existing 35 unrelated warnings; and `git diff --check` passed.

## 2026-08-05 - Independent code and contract re-review passed; browser gate pending

- Final independent review found no remaining code issue. It verified exact indexed Building derivation, the minimal additive WP22 index amendment, real Sheet reduced-motion behavior, URL-synchronized search, query-aware navigation, explicit configuration errors, and Convex-client-compatible URL validation.
- Independent focused evidence passed, including the direct installed-Convex validation matrix, typecheck, lint/diff checks, and the prior full 254-test/304-route worker gate. The additive project index is exact, migration-safe for the newly introduced table, and caused no deployment or data mutation.
- WP23-S1 through S5 are complete. S6 remains pending—not failed—until an authenticated desktop/mobile visual, keyboard, focus, responsive, and automated accessibility journey is run against a safe authenticated session.
