# WP41 Stories - Free-user login & signup

Branch: `cursor/free-auth-login-signup-6bce`
Lane: Work Package
Registry: Product ask (Chief / John) — free auth UX
Definition of done: Dedicated `/login` + `/signup` pages (IB-inspired layout, Weekend MVP branding), Google + email magic-link, MegaNav/MobileNav Login + Sign Up, post-auth `/dashboard` for free users, draft PR with env checklist. No paid/Stripe scope.

## Stories

- [x] `WP41-S1` - Shared auth card + `/login` + `/signup` (+ `/signin` alias)
  - Scope: `components/auth/*`, `app/login/*`, `app/signup/*`, `app/signin/*`, `lib/auth-return.ts`, `middleware.ts`
  - Acceptance criteria:
    - Login: “Welcome back!” + Continue with Google + Or + email “Send One-Time Code”
    - Signup: welcoming headline + same methods + cross-link to Login
    - `/signin` hard-redirects (308) to `/login` preserving `returnTo` / `claimPreview`
    - Preview claim stash still works on login/signup
    - No password inventing; no Stripe/paywall
  - Verification:
    - `npm run test:auth`
    - `npm run typecheck`

- [x] `WP41-S2` - Nav Login / Sign Up CTAs
  - Scope: `components/layout/MegaNav.tsx`, `components/layout/MobileNav.tsx`, `components/layout/NavAuthLinks.tsx`
  - Acceptance criteria:
    - Anonymous: Sign Up primary, Login secondary; keep Get the Kit when space allows
    - Session cookie present: show Dashboard path instead of Login/Sign Up
    - Beehiiv `SignupModal` untouched
  - Verification:
    - Source/contract tests for nav links
    - Manual screenshot of desktop + mobile nav

- [x] `WP41-S3` - Google sign-in lands on `/dashboard` (follow-up, branch `claude/nice-carson-s0g4cy`)
  - Problem: after Google consent, prod bounced to `/login?returnTo=%2Fdashboard%3Fcode%3D…`. Convex prod still ran the pre-#75 `safeAuthRedirect`, so Google's code landed on `/dashboard`, where middleware never exchanged it. #75 fixed `convex/auth.ts`, but Convex functions ship only on `npx convex deploy`, not on a Vercel build.
  - Scope: `lib/auth-return.ts`, `middleware.ts`, `tests/auth/*`
  - Acceptance criteria:
    - Middleware exchanges the code on `/auth/callback` (as before) and on `/dashboard/*` while a Google sign-in is in flight (OAuth verifier cookie present)
    - A stray `?code=` on `/dashboard` with no sign-in in flight is left alone
    - Public pages never exchange a code
    - Works with Convex prod before or after the #75 deploy
  - Verification:
    - `tests/auth/oauth-code-handoff.test.ts` runs the real middleware on `/dashboard?code=…` (fails on the old middleware, passes now)
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`

## Out Of Scope

- Paid features, Stripe, claim-pay
- PR #71 / idea-engine / Reddit quote-gate / phases 8–9 / mcp.json / PLATFORM_PREVIEW_BRIDGE_SECRET
- Full account menu redesign
- Google credential-backed E2E (still blocked until owner provisions AUTH_GOOGLE_*)

## Notes

- Prefer existing Convex Auth (Google + Resend magic link) already on main.
- Document prod env checklist for John in the PR body.
