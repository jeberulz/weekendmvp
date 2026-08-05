# WP21 Progress - Convex Auth Compatibility Migration

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup

- Branch/worktree: `codex/wp21-convex-auth` in the primary checkout; no worktree.
- Assignment: Integrate Convex Auth compatibly in isolated development, preserve existing user IDs, prove server-derived authorization and route denial, and leave production unchanged.
- Lane: Critical Wave 2 Work Package; high-risk auth worker plus an independent high-risk reviewer/gate runner.
- File boundary: Auth dependencies; `convex/schema.ts` and auth-owned Convex files; generated Convex types; root auth provider; minimal auth/protected placeholder routes; middleware composition; auth/redirect tests; `.env.example` key-name documentation; WP21 progress/evidence.
- Required checks: typecheck, lint, full tests, build, production dependency audit, isolated Convex schema/code generation, auth-flow/redirect matrices, diff check, staged secret scan, and independent auth review.
- Production guardrail: No production deploy, environment mutation, secrets, data mutation, backfill, key rotation, or schema narrowing is authorized.
- Initial inventory inherited from WP20: production `users=0` and `saved_ideas=0`; production Convex has no application environment variables; the configured local backend was not running.
- Owner rulings already applied:
  - Provider family: Convex Auth with magic link and Google.
  - Same email across providers: do not auto-link; require a separately approved verified signed-in linking flow.
- Owner decision still open: magic-link email provider. Resend is the documented example and recommendation, but it is not selected until the owner confirms it.

## 2026-08-05 - Official compatibility and security research

- Convex Auth's current setup page pins `@auth/core@0.41.1` alongside `@convex-dev/auth`, while the earlier local skill reference pins the still older `0.37.0`.
- Official setup requires the initializer `npx @convex-dev/auth`, auth tables, `convex/auth.config.ts`, `convex/auth.ts`, `convex/http.ts`, a Convex Auth React/server provider, and composed Next.js middleware.
- Google development callback is the isolated Convex HTTP Actions URL plus `/api/auth/callback/google`; key names are `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
- Convex Auth's documented magic-link example uses Resend with `AUTH_RESEND_KEY`, but vendor selection remains an owner decision.
- The official magic-link guide documents a session-fixation/phishing risk for instant-click sign-in. WP21 therefore requires a confirmation interstitial and explicit exchange action.
- Next.js server auth uses cookies. WP21 permits queries on authenticated GET paths only; mutations/actions remain POST/PUT and same-origin to avoid CSRF side effects.
- Auth cookies must remain host-only and must not leak to future tenant subdomains. Tenant routing stays with WP28.
- Next: Commit the frozen WP21 contract, then assign the high-risk auth worker. Provider-neutral foundation and Google code may proceed while the magic-link vendor decision is pending.

## 2026-08-05 - Security override of the upstream documentation pin

- Installing `@convex-dev/auth@0.0.94` with the setup page's exact `@auth/core@0.41.1` made `npm audit` fail with one direct critical dependency finding.
- GitHub's reviewed July 2026 advisories identify three affected Auth.js behaviors below/through `0.41.2`: magic-link email normalization can misroute a sign-in link and enable account takeover (`GHSA-7rqj-j65f-68wh`, critical); malformed bearer tokens can throw and cause per-request denial of service (`GHSA-xmf8-cvqr-rfgj`, high); and OAuth state/nonce/PKCE cookies are not provider-bound (`GHSA-x445-f3h2-j279`, moderate).
- All three advisories identify `@auth/core@0.41.3` as patched. `@convex-dev/auth@0.0.94` declares `@auth/core ^0.41.1`, so exact `0.41.3` remains inside the package's supported peer range.
- Orchestrator ruling: security evidence overrides the stale setup-page pin. WP21 must use exact `@auth/core@0.41.3`, re-run both audits, and treat any runtime/type incompatibility as a fresh stop condition.
- No initializer, auth code, environment mutation, or production action occurred before this ruling.

## 2026-08-05 - WP21-S1 through WP21-S5 implementation checkpoint

- Ordering correction: this implementation checkpoint occurred after the security override above.
- Dependency compatibility:
  - Installed exact `@convex-dev/auth@0.0.94`.
  - The official setup page's `@auth/core@0.41.1` pin failed the required audit with a direct critical advisory. After the orchestrator recorded a security ruling, installed exact `@auth/core@0.41.3`, which satisfies Convex Auth's `^0.41.1` peer range and returns zero vulnerabilities in full and production audits.
  - Runtime pair remains `convex@1.43.0` and `next@16.3.0`.
- Isolated initializer and deployment proof:
  - Confirmed `.env.local` selected `local:local-john_iseghohi-weekendmvp_2a6d0` at `127.0.0.1`; no `dev:` or `prod:` target and no `--prod` flag was used.
  - `npx @convex-dev/auth --web-server-url http://localhost:3000` completed. It set local-only `SITE_URL`, `JWT_PRIVATE_KEY`, and `JWKS` and generated `convex/auth.config.ts`, `convex/auth.ts`, and `convex/http.ts`. Key values were hidden and are absent from the diff/log.
  - `npx convex dev --once` completed against that local target. It generated Convex types and pushed the additive auth tables/schema. Convex requires its exact `users.email` index; the now-duplicate unused legacy `users.by_email` index was removed locally while the legacy fields and `users._id`/`saved_ideas.userId` contract stayed intact.
- Compatibility and authorization:
  - The customized `users` table inlines every Convex Auth field/index and keeps `tokenIdentifier`, `displayName`, `stripeCustomerId`, and `createdAt` optional. Tests insert both legacy-shaped and Convex Auth-shaped rows.
  - The custom `createOrUpdateUser` callback normalizes auth-owned emails and denies a new provider account whenever that email is already owned. Tests cover Google-first and email-first collisions, same-account updates, and preservation of legacy fields.
  - `currentUser.requireCurrent` accepts no user identifier, derives the Convex Auth user ID server-side, rejects missing identity and `isAnonymous` documents, and returns only the narrow current-user projection.
- Google and redirect/cookie policy:
  - Google is configured with the official `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` contract and `allowDangerousEmailAccountLinking: false`; the custom callback remains the authoritative reverse-order collision guard.
  - OAuth codes are handled only on `/auth/callback`. Server and middleware redirects allow only `/dashboard` paths; external, protocol-relative, backslash, and sibling-path targets collapse to `/dashboard`.
  - Convex Auth uses session cookies with its host-only `__Host-` production names and no Domain override. Canonical redirects execute before the auth proxy, and WP21 adds no tenant-host or wildcard routing.
- Next.js integration:
  - Cookie-backed `ConvexAuthNextjsServerProvider` is scoped to `/signin`, `/auth`, `/email-signin`, and `/dashboard`. Mounting it at the root made canonical public idea pages dynamic during the first build attempt, so the route-scoped design preserves all public content prerendering while private/auth routes are explicitly dynamic with `instant = false`.
  - `/dashboard` is a noindex placeholder only; WP23 still owns the real workspace UI. Anonymous requests redirect to `/signin` with a bounded return path; signed-in sign-in/callback requests return to the bounded dashboard path; logout clears auth state through Convex Auth and returns to `/signin`.
  - `/email-signin` is a provider-neutral, noindex confirmation interstitial. It displays the target email and exchanges `token` + matching `email` only after an explicit click. The delivery provider remains deliberately unwired.
- Verification completed:
  - `npm run typecheck`: pass.
  - `npm run lint`: pass with zero errors and the unchanged 35-warning WP20 baseline.
  - `npm test`: pass across the full configured suite.
  - `npm run test:auth`: 18/18 pass.
  - `npm run test:convex`: 17/17 pass across 2 files.
  - `npm run test:redirects`: 26/26 pass (7 Node canonical tests plus 19 middleware tests).
  - `npm run test:security`: 4/4 pass after documenting the built-in `CONVEX_SITE_URL` key name.
  - `npm run test:sitemap`: 4/4 pass.
  - `npm run build`: pass, 303 pages generated; canonical public ideas remain prerendered. Existing five Turbopack filesystem-trace warnings and the known Next.js middleware deprecation remain.
  - `npm audit --audit-level=high`: zero vulnerabilities.
  - `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
  - `git diff --check`: pass.
  - Local HTTP smoke: anonymous `/dashboard` returned 307 to `/signin?returnTo=%2Fdashboard`; `/signin` and `/ideas/ecommerce` returned 200.
  - Secret/private-key scan: staged set contained 0 files; worktree diff plus untracked set contained 31 implementation/progress files. All 31 were scanned with zero private-key, JWT, OAuth-secret, Stripe-secret, Google-key, or Ideabrowser-key patterns found.
- Open activation blocks:
  - Magic-link delivery vendor is still awaiting the owner ruling, so no vendor import, API-key name, sender domain, or send implementation has been added. Expiry/single-use behavior is supplied by Convex Auth but cannot be exercised end-to-end until that provider is wired.
  - Local Google OAuth credentials are not present. The provider contract and tests are complete, but a real Google redirect/callback/logout cycle has not been exercised.
  - Production remains unchanged. No production environment variable, key, schema, deployment, row, index, cookie, domain, or data mutation occurred.

## 2026-08-05 - Independent S6 medium-finding remediation

- Evidence wording correction: WP21 has unit/static contract coverage for provider configuration, callback target validation, collision denial, and the provider-neutral confirmation UI. It does not yet have exercised Google redirect/callback/logout E2E or magic-link issue/expiry/replay E2E. Those flows remain activation blockers until credentials and an owner-selected delivery vendor/sender are available.
- Middleware matcher hardening: `/dashboard/:path*` is now an explicit first matcher, so protected paths such as `/dashboard/report.js` cannot bypass auth by resembling a static asset. Executable matcher and auth-route tests cover that path while ordinary public/internal static assets remain excluded.
- Live-session authorization: `currentUser.requireCurrent` now derives both user and session IDs, requires the referenced `authSessions` row to exist and belong to that user, and continues to avoid caller IDs and wall-clock reads. Tests cover a valid session, deleted session, wrong-owner session, missing identity, and anonymous user denial.
- Boundary resolution: orchestrator commit `5efc0e5` formally authorized `vitest.config.ts` for the minimum Convex Auth adapter test-runtime accommodation; the earlier boundary concern is resolved without expanding runtime scope.
- Activation remains blocked pending the provider E2E evidence above and the separately required production backup/dry-run/approval record.
- Remediation verification:
  - `npm run typecheck`: pass.
  - `npm run lint`: pass with zero errors and the unchanged 35-warning baseline.
  - `npm run test:auth`: 19/19 pass.
  - `npm run test:convex`: 19/19 pass across 2 files.
  - `npm run test:redirects`: 27/27 pass (7 Node canonical tests plus 20 middleware matcher tests).
  - `npm test`: pass across OG 91, links 6, redirects 27, auth 19, security 4, sitemap 4, and Convex 19 checks.
  - `npm run build`: pass with 303 pages; the five inherited Turbopack filesystem-trace warnings and Next.js middleware deprecation warning remain.
  - `npm audit --audit-level=high` and `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
  - `git diff --check`: pass.
  - Final secret scan scope: 0 staged files, 9 tracked worktree diffs, and 22 untracked files; 31 unique implementation/progress files scanned with zero private-key, JWT, OAuth-secret, Stripe-secret, Google-key, or Ideabrowser-key pattern hits.
