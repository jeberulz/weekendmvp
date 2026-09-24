# WP41 Progress - Free-user login & signup

Branch: `cursor/free-auth-login-signup-6bce`
Status: checks green; draft PR open

## Story status

| Story | Status | Notes |
|-------|--------|-------|
| WP41-S1 | done | Shared AuthCard, `/login`, `/signup`, middleware `/signin`→`/login` 308 |
| WP41-S2 | done | MegaNav + MobileNav auth CTAs; session cookie → Dashboard |

## Checks

- `npm run typecheck` — pass
- `npm run test:auth` — 65/65 pass
- `npx vitest run tests/redirects/middleware.test.ts` — pass
- `wp27-preview-claim` / `wp27-preview-route` security tests — pass
- Local smoke: `/login` 200, `/signup` 200, `/dashboard` 307→`/login?returnTo=…`, `/signin` 308→`/login`

## Docs

- Stories/progress for WP41. Env checklist in PR body (from `.env.example`).
