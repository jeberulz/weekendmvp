# WP10 Stories - Host canonicalization for Google indexing

Branch: `fix/wp10-host-canonicalization`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: One host (`https://www.weekendmvp.app`) is used for redirects, canonicals, og:url, sitemap, and robots; apex permanently 308s to www; sample hub URLs no longer emit mixed-host signals.

## Stories

- [x] `WP10-S1` - Single SITE constant (www)
  - Scope: `lib/seo.ts`, `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`, pages/components that hardcode site origin
  - Acceptance criteria:
    - Exported `SITE` resolves `NEXT_PUBLIC_BASE_URL` with empty-string fallback to `https://www.weekendmvp.app`
    - Prod env `NEXT_PUBLIC_BASE_URL` set to `https://www.weekendmvp.app` (was `""`)
    - No page emits apex canonical + www og:url (or the reverse)
  - Verification:
    - `npm run typecheck` ✅
    - Live curl: `/build-with/lovable` canonical + og:url both www ✅

- [x] `WP10-S2` - Apex → www 308
  - Scope: Vercel project domain `weekendmvp.app`
  - Acceptance criteria:
    - `https://weekendmvp.app/*` → `https://www.weekendmvp.app/*` with **308** (not 307)
    - www serves 200
  - Verification:
    - `curl -sI https://weekendmvp.app/` → 308 to www ✅
    - `curl -sI https://weekendmvp.app/build-with/lovable` → 308 to www ✅

- [x] `WP10-S3` - Non-page apex emitters
  - Scope: `convex/revalidate.ts`, `ideas/manifest.json` (audience resources), `content/ideas/*.mdx` internal links, `docs/runbooks/2026-cutover.md`
  - Acceptance criteria:
    - Convex revalidate `SITE_URL` fallback is www (prod env already www)
    - `weekend-builders` audience resource link is www, not apex
    - No idea MDX links to an apex `.html` legacy URL
    - Cutover runbook no longer instructs www→apex
  - Verification:
    - `npm run build` then `grep -rlE 'https://weekendmvp\.app' .next/server/app` → zero matches ✅
    - `npm run typecheck` ✅

## Out Of Scope

- Google Search Console API re-inspection (manual after deploy)
- Content quality / "Crawled - currently not indexed" soft demotions beyond host signals
- Changing GA measurement IDs
- Archived outbound copy in `content/social/**`, `content/newsletter/**`, `content/video/**` — already-published UTM links; apex 308s cleanly

## Notes

- No Google Analytics MCP in this workspace; GA cannot force indexing. Root cause: empty `NEXT_PUBLIC_BASE_URL`, apex→www **307**, and mixed apex/www URL emitters.
- `NEXT_PUBLIC_*` is inlined at build time — setting the Vercel env var required a fresh build (commit `c8a6853`).
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
