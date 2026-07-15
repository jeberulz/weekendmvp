# WP02 Stories - Released Ideas Archive

Branch: `feat/wp02-links-archive`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
PRD: `tasks/prd-link-in-bio-released-ideas-archive.md`
Definition of done: `/links` features the current Europe/London release, retains all earlier campaign releases newest first, hides future rows before serialization, supports audience-category and video-format filtering plus title search, and reveals previous releases in URL-backed batches of eight.

## Planned Stories

- [x] `WP02-S1` - Aggregate released entries across campaign calendars
  - Scope: `app/links/_data.ts`, tests for link archive data behavior
  - Covers: PRD US-001 and date/deduplication portions of US-006

- [x] `WP02-S2` - Define and populate the audience category taxonomy
  - Scope: shared archive taxonomy, `content/social/reels/campaigns/*/calendar.csv`, content-data validation
  - Covers: PRD US-002

- [x] `WP02-S3` - Build the featured-today and cumulative archive layout
  - Scope: `app/links/page.tsx`, `app/links/loading.tsx`, focused archive components if needed
  - Covers: PRD US-003 and layout portions of US-006

- [x] `WP02-S4` - Add URL-backed search and filters
  - Scope: `/links` query parsing, search controls, category controls, secondary format filter, empty state
  - Covers: PRD US-004

- [x] `WP02-S5` - Add eight-item load-more pagination
  - Scope: `/links` pagination query handling and accessible load-more control
  - Covers: PRD US-005

- [ ] `WP02-S6` - Gate the complete archive flow
  - Scope: metadata, browser verification, future-data guardrail, WP progress and registry
  - Covers: PRD US-006
  - Pending: final mobile and desktop visual verification. The in-app Browser rejected localhost access under its URL policy; automated HTML, test, typecheck, and production-build gates pass.

## Required Checks

- `npm run typecheck`
- `npm run build`
- Relevant deterministic data tests
- Browser verification at mobile and desktop widths
- Production-like verification that future titles and URLs are absent
- Email-gate handoff verification with UTM parameters

## Out of Scope

- Convex, authentication, email-gate, or database changes
- Infinite scroll or numbered pagination
- Favorites, accounts, embedded videos, or body-content search
- A campaign CMS or manual visibility workflow
