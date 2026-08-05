# WP07 Stories - About + Author Pages (SEO/AEO)

Branch: `feat/about-author-pages`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: `/about` and `/john-iseghohi` live with Person schema pointing at first-party author URL; footer + sitemap wired; typecheck passes.

## Stories

- [x] `WP07-S1` - Centralize Person/Org schema
  - Scope: `lib/seo.ts`, `app/(marketing)/shipable/shipable-data.tsx`, `dare-data.tsx`, hub pages with websiteSchema
  - Acceptance criteria:
    - `personSchema()` `@id` + `url` = `${SITE}/john-iseghohi`
    - Cal.com only in `sameAs` + UI CTAs
    - Shipable/dare use shared builders (no duplicate Person/Org blocks)
  - Verification:
    - `npm run typecheck` ✅
    - Schema spot-check: PERSON_ID → `/john-iseghohi` ✅

- [x] `WP07-S2` - About page
  - Scope: `app/(marketing)/about/page.tsx`
  - Acceptance criteria:
    - Canonical `/about`, AboutPage + Org + Person JSON-LD
    - Product narrative + link to author page + soft CTAs
  - Verification:
    - Route + schema ✅

- [x] `WP07-S3` - Author page
  - Scope: `app/(marketing)/john-iseghohi/page.tsx`
  - Acceptance criteria:
    - Canonical `/john-iseghohi`, ProfilePage + Person JSON-LD
    - Portrait, bio, recent articles works list, Cal CTA, link to `/about`
  - Verification:
    - Route + schema ✅

- [x] `WP07-S4` - Internal links + sitemap
  - Scope: `SiteFooter`, `IdeaFooter`, `app/sitemap.ts`, article byline, CLAUDE.md
  - Acceptance criteria:
    - Footer “Created by” → `/john-iseghohi`; About + Author in Resources
    - Sitemap includes both URLs
  - Verification:
    - Sitemap entries present ✅; typecheck ✅

## Out Of Scope

- Personal domain / Knowledge Panel claiming
- Multi-author system
- New OG image pipeline
- MegaNav primary-link redesign

## Notes

- sameAs locked to X `@weekendmvp` + Cal; no placeholder profiles.
- a11y-check skill not present in repo; manual heading/alt/focus-ring review done on both pages.
