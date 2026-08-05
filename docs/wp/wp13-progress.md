# WP13 Progress - Collapse redirect chains to one hop

## Status

S1+S2 done on `fix/wp13-redirect-one-hop`. S3 waits for production deploy.

## S1 — Shared path cleaner + Edge middleware

- `lib/canonical-path.ts` — pure `cleanPath` / host helpers
- `middleware.ts` — single 308 for apex and dirty www paths
- `tests/redirects/canonical-path.test.mjs` — 7 passing
- `npm run test:redirects` wired into `npm test`
- `npm run typecheck` ✅

## S2 — Remove redundant next.config `.html` redirect

- Removed `/:path*.html` from `next.config.ts`; `/api/ideas-today` kept
- Cutover runbook + `RULINGS.md` updated for middleware ownership

## S3 — Clear Vercel apex domain redirect

- Blocked on production deploy of middleware
- Current live state: `weekendmvp.app` → `www.weekendmvp.app` 308 via Domains API (path-preserving)
- After middleware is live: `PATCH .../domains/weekendmvp.app` with `{ "redirect": null }`

## Verification

- `npm run test:redirects` ✅
- `npm run typecheck` ✅
- Live one-hop curls — pending S3
