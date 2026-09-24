# WP41 Progress - Free-user login & signup

Branch: `cursor/free-auth-login-signup-6bce`
Status: checks green; draft PR open

## Story status

| Story | Status | Notes |
|-------|--------|-------|
| WP41-S1 | done | Shared AuthCard, `/login`, `/signup`, middleware `/signin`→`/login` 308 |
| WP41-S2 | done | MegaNav + MobileNav auth CTAs; session cookie → Dashboard |
| WP41-S3 | done | Google code exchanged on `/dashboard` while sign-in is in flight |

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

## WP41-S3 - Google sign-in bounced to `/login`

Evidence: Vercel prod logs for the #75 deploy show `GET /dashboard 307` at
15:39 UTC on 2026-09-24 and no `/auth/callback` hit. So Convex prod still
rewrote the Google redirect to `/dashboard`: #75's `convex/auth.ts` change was
not deployed to Convex. Middleware only exchanged codes on `/auth/callback`,
so the code sat unused and the visitor bounced to `/login`.

Fix: `shouldExchangeAuthCode` also accepts `/dashboard/*` while the Convex
Auth OAuth verifier cookie is present. The verifier is set when Google
sign-in starts and cleared on exchange, so a stray `?code=` is untouched.

Owner action: run `npx convex deploy` so #75 goes live. Google then lands on
`/auth/callback` again and deep-link `returnTo` values survive sign-in.

Checks: `npm run typecheck`, `npm run lint` (0 errors), `npm test`,
`npm run build` pass. New `tests/auth/oauth-code-handoff.test.ts` fails on
the old middleware and passes with the fix.

## Docs

- Stories/progress for WP41. Env checklist in PR body (from `.env.example`).
- WP41-S3 recorded above. No UI change, so no a11y pass needed.
