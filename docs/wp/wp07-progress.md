# WP07 Progress - About + Author Pages (SEO/AEO)

Append-only progress log. Do not rely on chat history for project state.

## 2026-07-25 - Setup

- Branch/worktree: `feat/about-author-pages` (no worktree)
- Assignment: WP07 About + Author pages per plan
- File boundaries: `lib/seo.ts`, marketing pages, SiteFooter, IdeaFooter, sitemap, shipable/dare-data, hub schema graphs, CLAUDE.md
- Required checks: `npm run typecheck`, sitemap entries, JSON-LD spot-check, a11y
- Initial risks: breaking existing `#person` / `#org` @id refs in shipable Event schema — migrated to PERSON_ID / ORG_ID

## 2026-07-25 - WP07-S1

- Actions taken: Rewrote `personSchema`/`organizationSchema`/`websiteSchema`/`articleSchema`/`eventSchema` in `lib/seo.ts`; exported `PERSON_ID`, `PERSON_PATH`, `ORG_ID`; migrated shipable + dare off hand-built Person/Org; added `organizationSchema()` to graphs that reference website publisher
- Decisions made: Canonical jobTitle = "Founder, Weekend MVP"; ORG_ID = `${SITE}/#organization`; publisher refs point at org not person
- Checks run: typecheck; tsx schema dump
- Result: Person url/id = `https://www.weekendmvp.app/john-iseghohi`; Cal only in sameAs
- Next: S2–S3 pages

## 2026-07-25 - WP07-S2 / S3

- Actions taken: Built `/about` and `/john-iseghohi` under marketing layout with Aura chrome, JSON-LD, CTAs; author page pulls recent articles via MDX list
- Checks run: typecheck, lint diagnostics
- Result: both routes implemented
- Next: footer + sitemap

## 2026-07-25 - WP07-S4 + verify

- Actions taken: Footer Created-by → author page; Resources links; IdeaFooter parity; article byline Link; sitemap priorities; CLAUDE.md Person canonical note
- Checks run: `npm run typecheck` ✅; sitemap entries present; schema spot-check ✅; manual a11y (single h1, aria-labelledby sections, portrait alt, focus-visible on CTAs). a11y-check skill missing from repo — skipped tool run
- Result: WP07 complete pending merge
- Next: PR when requested
