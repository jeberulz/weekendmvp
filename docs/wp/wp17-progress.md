# WP17 Progress - Sitemap indexing signals

## Status

Complete on `cursor/wp17-sitemap-indexing`.

## Diagnosis (live)

- robots.txt allows `/`; sitemap + Host point at www — not a crawl block
- ~267 sitemap URLs; no sitewide noindex / X-Robots-Tag
- Idea MDX has **0/145** `publishedAt`; manifest has **145/145** → idea lastmods collapsed to request-time “now”
- Apex `/robots.txt` + `/sitemap.xml` returned **200** (matcher skipped `.txt`/`.xml`)
- GSC www-prefix “0 indexed” after same-day submit is expected lag/metric; use URL Inspection + Domain coverage

## S1 — Stable lastmod

- Done: `lib/sitemap-data.ts` loads idea dates from `ideas/manifest.json`
- Done: omit lastmod when unknown (hubs/roots/collections)
- Done: trace `ideas/manifest.json` into `/sitemap.xml` bundle
- Local smoke: 145 idea lastmods across 29 days; hubs have no lastmod

## S2 — Apex robots/sitemap redirect

- Done: middleware matcher explicitly includes `/robots.txt` and `/sitemap.xml`

## S3 — Runbook + inspect script

- Done: `npm run gsc:inspect-indexing`
- Done: runbook section on reading “0 indexed”
- Done: ruling in `docs/wp/RULINGS.md`

## Verification

- `npm run test:sitemap` — pass
- `npm run test:redirects` — pass
- `npm run typecheck` — pass
- `npm run build` — pass
- Local sitemap smoke — pass

## After merge

1. Confirm apex `robots.txt` / `sitemap.xml` 308 → www
2. Confirm prod idea lastmods are calendar dates (not all identical “now”)
3. `npm run gsc:submit-sitemap` then `npm run gsc:inspect-indexing` with SA key
