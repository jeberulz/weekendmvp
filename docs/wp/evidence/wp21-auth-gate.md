# WP21 Auth Gate Evidence

Date: 2026-08-05
Branch: `codex/wp21-convex-auth`
Environment: Isolated anonymous/local Convex backend plus local Next.js

## Passed Foundation

- `@convex-dev/auth@0.0.94` with exact patched `@auth/core@0.41.3`; both npm audits report zero vulnerabilities.
- Convex Auth initializer and `npx convex dev --once` completed against the confirmed `local:` target only.
- Compatibility schema preserves the application `users` document IDs, optional legacy fields, and `saved_ideas.userId` references while adding the required Convex Auth tables/indexes.
- Custom user creation denies implicit same-email linking in Google-first and email-first order.
- Private identity derives user and session IDs server-side and denies missing, deleted, cross-user, and anonymous sessions.
- Google configuration names, callback seam, bounded redirects, host-only cookies, canonical ordering, protected dashboard matcher, and provider-neutral magic confirmation UI have executable unit/static coverage.
- The owner-selected Resend delivery path uses a custom Convex `Email` provider with an explicit confirmation interstitial, one-hour single-use tokens, a verified-sender configuration requirement, server-bound canonical email identities, and generic no-log delivery errors.
- Token-bearing email/OAuth callback routes suppress analytics and emit `Referrer-Policy: no-referrer` plus `Cache-Control: no-store`.
- Canonical public content remains prerendered; the production build emits 303 pages.

## Checks

- `npm run typecheck`: pass.
- `npm run lint`: pass, 0 errors and 35 inherited warnings.
- `npm run test:auth`: 26/26 pass.
- `npm run test:convex`: 41/41 pass.
- `npm run test:redirects`: 32/32 pass (7 Node plus 25 middleware checks).
- `npm test`: pass across OG 91, links 6, redirects 32, auth 26, security 4, sitemap 4, and Convex 41 checks.
- `npm run build`: pass, 303 pages.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities.
- `git diff --check`: pass.
- Secret/private-key scan: final staged implementation/documentation set, zero secret-pattern hits.
- Independent Resend review initially blocked on token/PII leakage, pre-verification identity reservation, provider enumeration, and shared-origin validation. All were remediated; re-review passed with no remaining critical, high, or medium finding.

## Live Provider Evidence and Deferred Go-Live Gate

- The owner completed the credential-backed Resend inbox issue, explicit confirmation, cookie session, safe dashboard return, and dashboard client-lifecycle flow against the isolated local deployment.
- Google provider code is configured and its security/lifecycle contracts pass deterministically, but no OAuth client credentials are present. Real redirect, callback, session, and logout E2E remain unexercised.
- By owner ruling, Google credential-backed E2E is deferred to go-live and does not block WP22. It remains an activation requirement and is not represented as passed evidence.

## Production Guardrail

Production was not touched. Production auth activation still requires a fresh aggregate inventory, full Convex backup, Git restore tag, exact dry run, provider secrets entered through the approved secret channel, independent gate, and explicit owner approval.
