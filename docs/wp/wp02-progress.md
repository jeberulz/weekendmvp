# WP02 Progress - Released Ideas Archive

Append-only progress log. Do not rely on chat history for project state.

## 2026-07-14 - Planning

- Lane: Work Package.
- Branch: `feat/wp02-links-archive` in the primary checkout; no worktree needed for planning.
- Owner decisions: feature today's release; show all earlier releases newest first; use search plus audience category with video format secondary; reveal eight archive cards per load-more batch; release at midnight Europe/London; combine all campaign calendars.
- Visibility ruling: schedule date controls release visibility. Operational `status` values such as `scripted`, `recorded`, and `published` do not gate `/links`.
- UX model: today's card is pinned and unaffected by archive filters. Search, category, format, result count, and pagination belong to `Previously released`.
- Data model: discover all campaign calendars, filter future rows before serialization, deduplicate by canonical destination path, and require a controlled audience-facing category.
- URL model: validated `q`, `category`, `format`, and `page` parameters; filter changes reset `page` to 1.
- Workspace note: the owner had existing uncommitted campaign status changes and unrelated untracked content before this planning session. They are preserved and excluded from the planning scope.
- Planning artifact: `tasks/prd-link-in-bio-released-ideas-archive.md`.
- Result: implementation-ready plan complete; no production code changed.
- Next: owner review, then implement `WP02-S1` on this branch.

## 2026-07-14 - Implementation Started

- Owner approved implementation of the complete PRD.
- Execution order: released-data aggregation and guardrails, category data, cumulative UI, URL-backed discovery, pagination, then full gate.
- Next.js decision: read request-time date and async `searchParams` outside cached functions, then pass serializable values into the cached archive query so Cache Components generates correct keys.
- Progressive-enhancement decision: use server-rendered GET forms and links for filters and pagination; no client-side data-fetching layer is needed.
- Existing campaign status edits remain owner changes and must be preserved while the category column is added.

## 2026-07-14 - Implementation Complete; Visual Gate Pending

- `WP02-S1`: complete. `/links` discovers all campaign calendars, filters out future schedules before page serialization, ignores operational production status, sorts newest first, and deduplicates canonical destinations.
- `WP02-S2`: complete. Added a controlled eight-category audience taxonomy and populated every row in the active campaign calendar without overwriting the owner's existing status edits.
- `WP02-S3`: complete. Today's release remains featured and pinned; all prior releases appear in a compact cumulative archive.
- `WP02-S4`: complete. Added URL-backed title search, audience-category chips, a secondary video-format filter, removable active-filter pills, result counts, and clear empty states.
- `WP02-S5`: complete. Added accessible cumulative pagination in eight-item batches with validated and clamped page parameters.
- Data tests: `npm test` passed 97 tests (91 existing OG tests and 6 focused link-archive tests).
- Static checks: `npm run typecheck` passed; `git diff --check` passed.
- Production build: `npm run build` passed on Next.js 16.2.9 after permitting the existing Google Font download. `/links` compiled as a Partial Prerender route. The build reports a pre-existing tracing warning from `lib/mdx.tsx` through `/startup-ideas`, outside WP02.
- Production-like HTTP checks: base, search, category, format, empty-result, and invalid-parameter URLs returned 200. The July 14 release and July 13 release were present; the July 15 future release title and URL were absent. Tracked idea destinations retained the existing email-gate handoff and link-in-bio UTM parameters.
- Browser gate: pending. The in-app Browser rejected localhost navigation under its URL policy, so mobile and desktop visual verification could not be completed in-tool. No alternate browser surface was used.
- Registry status: `Gate pending` until visual verification is completed; implementation stories `WP02-S1` through `WP02-S5` are complete.
