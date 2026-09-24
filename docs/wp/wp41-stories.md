# WP41 Stories - Free-user login & signup

Branch: `cursor/free-auth-login-signup-6bce`
Lane: Work Package
Registry: Product ask (Chief / John) — free auth UX
Definition of done: Dedicated `/login` + `/signup` pages (IB-inspired layout, Weekend MVP branding), Google + email magic-link, MegaNav/MobileNav Login + Sign Up, post-auth `/dashboard` for free users, draft PR with env checklist. No paid/Stripe scope.

## Stories

- [ ] `WP41-S1` - Shared auth card + `/login` + `/signup` (+ `/signin` alias)
  - Scope: `components/auth/*`, `app/login/*`, `app/signup/*`, `app/signin/*`, `lib/auth-return.ts`
  - Acceptance criteria:
    - Login: “Welcome back!” + Continue with Google + Or + email “Send One-Time Code”
    - Signup: welcoming headline + same methods + cross-link to Login
    - `/signin` redirects to `/login` preserving `returnTo` / `claimPreview`
    - Preview claim stash still works on login/signup
    - No password inventing; no Stripe/paywall
  - Verification:
    - `npm run test:auth`
    - `npm run typecheck`

- [ ] `WP41-S2` - Nav Login / Sign Up CTAs
  - Scope: `components/layout/MegaNav.tsx`, `components/layout/MobileNav.tsx`, `components/layout/NavAuthLinks.tsx`
  - Acceptance criteria:
    - Anonymous: Sign Up primary, Login secondary; keep Get the Kit when space allows
    - Session cookie present: show Dashboard path instead of Login/Sign Up
    - Beehiiv `SignupModal` untouched
  - Verification:
    - Source/contract tests for nav links
    - Manual screenshot of desktop + mobile nav

## Out Of Scope

- Paid features, Stripe, claim-pay
- PR #71 / idea-engine / Reddit quote-gate / phases 8–9 / mcp.json / PLATFORM_PREVIEW_BRIDGE_SECRET
- Full account menu redesign
- Google credential-backed E2E (still blocked until owner provisions AUTH_GOOGLE_*)

## Notes

- Prefer existing Convex Auth (Google + Resend magic link) already on main.
- Document prod env checklist for John in the PR body.
