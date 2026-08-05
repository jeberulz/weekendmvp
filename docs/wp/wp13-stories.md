# WP13 Stories - Collapse redirect chains to one hop

Branch: `fix/wp13-redirect-one-hop`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Dirty legacy URLs (apex host, trailing slash, `.html`) resolve to `https://www.weekendmvp.app` + clean path in a **single** HTTP 308; Vercel domain-level apex redirect is cleared so middleware owns host+path canonicalization.

## Stories

- [x] `WP13-S1` - Shared path cleaner + Edge middleware
  - Scope: `lib/canonical-path.ts`, `middleware.ts`, `tests/redirects/canonical-path.test.mjs`
  - Acceptance criteria:
    - Strips trailing slash (except `/`) and `.html` / `.htm` in one pass.
    - Production apex (`weekendmvp.app`) always 308s to `https://www.weekendmvp.app` + cleaned path + query.
    - Production www only redirects when the path is dirty.
    - Preview / localhost hosts still clean dirty paths without forcing www.
    - Static assets and `/_next/*` are excluded via matcher.
  - Verification:
    - `node --test tests/redirects/canonical-path.test.mjs`
    - `npm run typecheck`

- [x] `WP13-S2` - Remove redundant next.config `.html` redirect
  - Scope: `next.config.ts`
  - Acceptance criteria:
    - The `/:path*.html` redirect is removed; middleware is the single path-cleaner.
    - `/api/ideas-today` redirect remains unchanged.
  - Verification:
    - Config review + typecheck.

- [x] `WP13-S3` - Clear Vercel apex domain redirect after middleware is live
  - Scope: Vercel project domain `weekendmvp.app` (`redirect` → `null`)
  - Acceptance criteria:
    - Middleware is deployed to production first.
    - Apex domain `redirect` and `redirectStatusCode` are null.
    - Live curls show **one** 308 from dirty apex URLs to the final www clean URL.
  - Verification:
    - Hop-by-hop curl for apex `.html`, apex trailing-slash, clean apex, and www `.html`.

## Out Of Scope

- Content rewrites, title/meta CTR work, `/build-with/claude-code` split.
- GSC URL-prefix property / sitemap API access.
- Changing the canonical host (still www — see `docs/wp/RULINGS.md` WP10).

## Notes

- WP10 set apex→www via Vercel Domains API. That host-only redirect preserves dirty paths, which creates a second hop when Next strips `.html` / trailing slash. WP13 moves both concerns into middleware so Google sees a single permanent redirect.
- Clearing the domain redirect before middleware ships would briefly serve apex without redirect — deploy order is mandatory.
