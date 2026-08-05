# WP17 Stories - Sitemap indexing signals

Branch: `cursor/wp17-sitemap-indexing`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Idea URLs in `sitemap.xml` emit stable real `lastmod` (not request-time “now”); hubs/roots omit fake lastmod; apex `/robots.txt` + `/sitemap.xml` 308 to www; runbook + inspect script document how to read GSC 0/N vs real index status.

## Stories

- [x] `WP17-S1` - Stable sitemap lastmod for ideas
  - Scope: `app/sitemap.ts`, `next.config.ts` tracing, `ideas/manifest.json` dates
  - Acceptance criteria:
    - Idea `<lastmod>` comes from manifest `publishedAt` (not `new Date()`)
    - Entries without a known date omit `lastmod` instead of faking now
  - Verification: local/prod sitemap shows diverse idea lastmods; hubs lack identical “now” stamps

- [x] `WP17-S2` - Apex robots/sitemap one-hop to www
  - Scope: `middleware.ts` matcher
  - Acceptance criteria:
    - `https://weekendmvp.app/robots.txt` and `/sitemap.xml` 308 → www equivalents
    - Other static `.xml`/`.txt` assets remain matcher-excluded
  - Verification: curl `-sI` apex paths show single 308 to www

- [x] `WP17-S3` - GSC indexing runbook + inspect script
  - Scope: `scripts/gsc-inspect-indexing.mjs`, `docs/runbooks/gsc-www-prefix.md`, WP docs
  - Acceptance criteria:
    - Script lists sitemap status and URL Inspection for a sample of money URLs
    - Runbook explains www-prefix “0 indexed” vs Domain coverage / lag
  - Verification: script runs when SA key present; docs review

## Out Of Scope

- Guaranteeing Google indexes N URLs by a date (Google selection)
- Mass Indexing API calls (not allowed for general web pages)
- Instagram / `/links` funnel

## Notes

- Live checks (2026-08-05): robots allow crawl; sitemap ~267 www locs; no sitewide noindex. Primary code smell: ~200 identical request-time lastmods because idea MDX has no `publishedAt` while manifest does.
