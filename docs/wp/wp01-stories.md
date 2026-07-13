# WP01 Stories - Social Video Link Hub

Branch: `feat/wp01-links-hub`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: `/links` is a production-ready, mobile-first link hub driven by the active Reel campaign calendar. It exposes only the entry scheduled for the current Europe/London date, advances without a new deployment, routes directly to the canonical full idea or article, preserves the existing email gate, and passes configured checks.

## Stories

- [x] `WP01-S1` - Build the campaign link data layer
  - Scope: `app/links/_data.ts`, `content/social/reels/campaigns/2026-07-audience-growth/calendar.csv` (read-only source)
  - Acceptance criteria:
    - Campaign CSV rows are parsed and grouped by week.
    - Each item receives a local idea/article image when present and a safe fallback otherwise.
    - Missing or malformed campaign data produces an empty result instead of crashing the route.
  - Verification:
    - `npm run typecheck`

- [x] `WP01-S2` - Ship the mobile-first `/links` experience
  - Scope: `app/links/page.tsx`, `app/links/loading.tsx`, `app/layout.tsx`
  - Acceptance criteria:
    - The route has Weekend MVP branding, clear context, and accessible week-grouped daily links.
    - Links point directly to canonical idea/article destinations and preserve the existing idea email-gate workflow.
    - The page includes responsive, loading, and empty states with reduced-motion support.
    - Static metadata, canonical URL, and social preview metadata are defined.
    - The existing site favicon is declared globally so the `/links` to idea-page handoff has a clean browser console.
  - Verification:
    - `npm run typecheck`
    - Browser verification at mobile and desktop widths

- [x] `WP01-S3` - Make the route discoverable and gate the change
  - Scope: `app/sitemap.ts`, `docs/wp/wp01-progress.md`, `docs/PROJECT_STRATEGY.md`
  - Acceptance criteria:
    - `/links` is included in the sitemap.
    - Required checks and browser verification results are recorded.
    - The WP registry status reflects the final outcome.
  - Verification:
    - `npm run typecheck`
    - `npm run lint` when available
    - `npm test` when available
    - `npm run build`

- [x] `WP01-S4` - Reveal only today's scheduled campaign idea
  - Scope: `app/links/_data.ts`, `app/links/page.tsx`, `app/links/loading.tsx`, `docs/PROJECT_STRATEGY.md`, `docs/wp/wp01-stories.md`, `docs/wp/wp01-progress.md`
  - Acceptance criteria:
    - `/links` renders at most one campaign destination: the row matching the current Europe/London date.
    - Future and past campaign entries are not exposed on the link hub.
    - The selected row changes at the next Europe/London calendar day without a deployment.
    - The focused single-idea, loading, and no-scheduled-idea states remain responsive and accessible.
  - Verification:
    - `npm run typecheck`
    - `npm run build`
    - Browser verification of the current scheduled idea

## Out Of Scope

- Changing the existing idea email gate, subscription API, or Convex schema.
- Hosting or embedding the social videos themselves.
- Publishing, scheduling, or changing campaign content.
- Adding a content-management interface for campaign links.

## Notes

- `content/social/reels/campaigns/2026-07-audience-growth/calendar.csv` remains the campaign source of truth.
- The campaign calendar date is interpreted in `Europe/London`, matching the site owner's operating timezone.
