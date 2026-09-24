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

## Review fixes (three blockers)

- Nav "Dashboard" never showed: Convex Auth sets `__convexAuthJWT` httpOnly,
  so `document.cookie` cannot see it. Middleware now mirrors its presence
  into a readable `wmvp_signed_in` hint (`syncSessionHintCookie`), written
  only when out of date. Signed-in desktop pill now also `hidden md:flex`.
- `?claimPreview=` referrer leak: `/login` and `/signup` send
  `Referrer-Policy: no-referrer` (middleware header + page metadata).
- Signed-in "Keep this site" lost the claim: `authRouteDecision` lets a
  signed-in visitor with a well-formed `claimPreview` through, and
  `PreviewClaimStash` stashes, then continues to the dashboard.

Checks: `npm run typecheck`, `npm run lint` (0 errors), `npm test`, and
`npm run build` pass. `next start` smoke: `/signup` sends `no-referrer`;
hint set for a live session, cleared when stale, absent for anonymous.

## Follow-up: mobile "Get the Kit"

PR #72 hid the MegaNav CTA below `lg`, so phones lost it even though the
auth pills only show from `md`. Now `inline-flex md:hidden lg:inline-flex`:
visible on phones and from `lg`, hidden only at md–lg. Playwright check on
`/newsletter` at 320–1280px: CTA visible <768 and ≥1024, no overflow past
the pill, no horizontal scroll. Checks: typecheck, lint (0 errors), `npm test`.

## Docs

- Stories/progress for WP41. Env checklist in PR body (from `.env.example`).
