# WP10 Progress - Host canonicalization for Google indexing

## Status

Infra live and verified; code hardening on `fix/wp10-host-canonicalization` pending merge.

## S1 — Single SITE constant (www)

- Done in code on `fix/wp10-host-canonicalization`
- Prod `NEXT_PUBLIC_BASE_URL` set to `https://www.weekendmvp.app` (was empty string)
- Exported `SITE` from `lib/seo.ts` with `||` + `.trim()` so empty env cannot poison URLs
- Pages/components import `SITE` instead of hardcoding www/apex (24 files)
- Rebuilt prod (`c8a6853`) to re-inline the env var — live output is now www everywhere

## S2 — Apex → www 308

- Done live via Vercel Domains API
- `weekendmvp.app` → `www.weekendmvp.app` with `redirectStatusCode: 308`
- Verified: `curl -sI https://weekendmvp.app/` → HTTP/2 308

## S3 — Non-page apex emitters

- `convex/revalidate.ts` — `SITE_URL` fallback apex → www (prod Convex env already www)
- `ideas/manifest.json` — `weekend-builders` audience resource apex → www (was rendering an
  apex outbound link on `/ideas-for/weekend-builders`; reaches the page via Convex seed)
- `content/ideas/brake-safety-education-platform.mdx` — legacy apex `.html` internal link →
  site-relative `/ideas/brakes-maintenance-tracker-app`
- `docs/runbooks/2026-cutover.md` — corrected to www-primary + 308 apex redirect

## Verification

- `npm run typecheck` ✅
- `npm run build` ✅ (clean `.next` rebuild after dev Convex reseed)
- `grep -rlE 'https://weekendmvp\.app' .next/server/app` → **zero matches** ✅
- Live (already deployed via env + rebuild):
  - `curl -sI https://weekendmvp.app/build-with/lovable` → 308 → www ✅
  - `/build-with/lovable` canonical + og:url both www ✅
  - `sitemap.xml` locs www ✅
  - `robots.txt` `Host:` + `Sitemap:` www ✅

## Remaining (owner actions)

1. Commit + push branch, open PR, merge to `main`
2. `npm run seed:convex -- --prod` — pushes the manifest audience-resource fix to prod Convex
3. GSC: request indexing / wait for recrawl on sample hub URLs
