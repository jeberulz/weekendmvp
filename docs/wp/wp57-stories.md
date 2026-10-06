# WP57 Stories — Verified-account ideas access and Beehiiv onboarding

Branch: `codex/wp57-ideas-account-gate`
Lane: Work Package (auth, public content, external email integration)
Registry: `docs/PROJECT_STRATEGY.md`
Product decisions: `docs/wp/RULINGS.md` (2026-10-06 WP57 rows)
Plan: `docs/plans/2026-10-06-ideas-account-access-plan.md`

Definition of done: anonymous requests to `/startup-ideas`, `/ideas/{slug}`, their RSC variants and public data APIs receive only approved teasers; verified members receive the full library and canonical research; the embedded signup/login flow returns after email or Google verification to the intended safe URL; new verified accounts enter a durable Beehiiv sync with double opt-in and no automatic resubscription after unsubscribe. Focused security/redirect/SEO/Beehiiv tests, browser journeys, typecheck, lint, full tests and production build pass. No production activation is part of this package.

## Stories

- [x] `WP57-S1` — Inventory data and freeze access contract
  - Scope: these stories/progress, `docs/PROJECT_STRATEGY.md`, `docs/wp/RULINGS.md`, `docs/wp/platform-ux-brief.md`, source inventory.
  - Acceptance criteria:
    - Map the full-content paths in page HTML/RSC, Convex public queries, Next API routes, homepage/hubs, sitemap and feeds. Name what stays public and what requires a verified member.
    - Record the owner-approved SEO change and automatic Beehiiv sync with double opt-in.
    - Account for unknown/removed/retired idea behavior and current newsletter deep links.
  - Verification: source inventory and `git diff --check`.

- [x] `WP57-S2` — Protect full idea bodies at the data boundary
  - Scope: `convex/ideas.ts`, `convex/editorial/public.ts`, authenticated idea/body lookup, `lib/canonical-idea-body.ts`, callers, focused Convex/security tests.
  - Acceptance criteria:
    - Public Convex list/lookup responses expose metadata for approved preview cards but no complete MDX/Convex/editorial body; direct anonymous query callers cannot obtain full research.
    - Member body lookup derives identity from Convex Auth and checks the current session, including revocation. Unknown/removed/draft ideas remain unavailable.
    - Homepage/hubs use only approved preview content; member prompts/exports still resolve the live canonical body after their existing membership/entitlement checks.
  - Verification: anonymous/member/revoked-session Convex tests plus homepage/SEO regressions.

- [ ] `WP57-S3` — Render public teasers and protected pages on the canonical URLs
  - Scope: `app/startup-ideas/**`, `app/ideas/[slug]/**`, related page components, request-time auth helper, focused route tests.
  - Acceptance criteria:
    - Anonymous raw HTML and RSC never contain the complete library grid or research body; they show title, description and the embedded account surface.
    - Verified members see full content without a flash of the anonymous gate. Member response is never shared across sessions or cached publicly.
    - Canonical metadata, indexable teaser, real 404/removed behavior, noindex private routes and safe public hubs remain correct.
  - Verification: local production-build raw HTML/RSC probes, two-session browser check, SEO/404 tests.

- [ ] `WP57-S4` — Embed signup/login and preserve destination through verification
  - Scope: `components/auth/**`, `app/AuthPlatformProvider.tsx`, `lib/auth-return.ts`, `lib/private-paths.ts`, `convex/auth.ts`, `convex/resendMagicLink.ts`, `app/login/**`, `app/signup/**`, `app/email-signin/**`, relevant middleware seam and tests.
  - Acceptance criteria:
    - Both gates offer create account/login, email magic link and Google in place; there is no Beehiiv-only unlock or first-name requirement for authentication.
    - `/startup-ideas` and exact published `/ideas/{slug}` destinations survive mode switches, email confirmation, Google callback and already-signed-in entry. Direct dashboard sign-in still works.
    - All redirect validators agree on same-origin allowlisted paths and reject external, malformed, encoded, auth-loop, email-bearing and token-bearing targets.
    - Mobile, keyboard, reduced-motion, error/retry and expired-link states are usable. Account copy discloses Beehiiv sync and its separate confirmation.
  - Verification: auth redirect/security tests and credential-backed local email/Google journeys where credentials are available.

- [x] `WP57-S5` — Sync each new verified account to Beehiiv safely
  - Scope: `convex/authUser.ts`, a narrowly scoped internal sync action/mutations, `convex/schema.ts` (one additive idempotency table if needed), `lib/beehiiv.ts` or a server-only equivalent, environment docs and focused tests.
  - Acceptance criteria:
    - New verified email and Google accounts enqueue exactly one sync; email issuance placeholders and returning sign-ins do not.
    - A durable idempotency state records success/failure and bounded retries. A Beehiiv outage never blocks sign-in or account creation, and no API key reaches the client/logs.
    - New subscribers are created with `double_opt_override: "on"`, `reactivate_existing: false`, and a configured Add by API onboarding automation. Existing active Beehiiv subscribers can enter that automation once; unsubscribed subscribers are not reactivated or enrolled.
    - The account UI explains the separate Beehiiv confirmation; no actual external send is made by tests.
  - Verification: mocked Beehiiv API and Convex lifecycle tests for new, existing, unsubscribed, retry and replay cases.

- [ ] `WP57-S6` — Retire old unlock paths and run the package gate
  - Scope: `components/ideas/gate-access.ts`, `/api/ideas-subscribe`, `/api/ideas-verify`, `?e=`/newsletter links, analytics copy, docs and release notes; focused tests.
  - Acceptance criteria:
    - Local storage email, Beehiiv UTM, `?e=`, readable cookie and localhost never grant protected access. Legacy links land on the teaser/account journey without exposing email in analytics/referrers.
    - Existing separate Starter Kit/newsletter forms still work. Account creation is tracked without email PII or duplicate registration counts.
    - Configured checks pass: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`; production-build browser/raw-response journeys cover anonymous, member, revoked, expired-link and direct-deep-link flows.
    - Progress records exact evidence and any external-provider or production activation gaps.
  - Verification: configured commands and isolated end-to-end probes; no serving Convex deployment or live Beehiiv account is modified by the gate.

## Boundaries

- No Builder's Hub activation, site publishing, production data mutation, live Beehiiv test send or credential change.
- Preserve canonical idea URLs and public teaser metadata; do not create a second dashboard research corpus.
- Keep existing newsletter and Starter Kit signups independent from account access. Previously unsubscribed Beehiiv contacts stay unsubscribed.
