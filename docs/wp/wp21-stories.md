# WP21 Stories - Convex Auth Compatibility Migration

Branch: `codex/wp21-convex-auth`
Lane: Work Package within Build Platform Program Wave 2
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: The existing `users` IDs remain valid under a compatibility-first Convex Auth schema; credential-backed Resend sign-in, confirmation, session, safe return, and dashboard behavior pass in isolated development; Google configuration and auth lifecycle security contracts pass deterministically; anonymous denial, expiry/replay, same-email non-linking, logout routing, and canonical public-site behavior remain green; and credential-backed Google E2E plus production activation stay deferred to the separately gated go-live record.

## Stories

- [x] `WP21-S1` - Prove the current Convex Auth and Next.js 16 integration path
  - Scope: `package.json`, `package-lock.json`, official upstream evidence, initializer-generated auth foundation, and `docs/wp/wp21-progress.md`.
  - Acceptance criteria:
    - Use `@convex-dev/auth@0.0.94` plus exact `@auth/core@0.41.3`. Convex's setup page still names `0.41.1`, but GitHub's reviewed July 2026 advisories mark all versions through `0.41.2` vulnerable and `0.41.3` patched; `0.41.3` satisfies Convex Auth's `^0.41.1` peer range. Do not substitute Better Auth or a fallback provider without an owner ruling.
    - Run `npx @convex-dev/auth` against an isolated local/development deployment when credentials permit, or record the exact blocked interactive step and use the documented manual equivalent without targeting production.
    - Record package/runtime compatibility, generated files, environment key names, and any beta limitation without exposing values.
    - No `--prod`, production deploy, production environment change, key rotation, or production data mutation occurs.
  - Verification:
    - `npm ls @convex-dev/auth @auth/core convex next`
    - `npx convex dev --once` against the isolated target when available
    - `git diff --check`

- [x] `WP21-S2` - Migrate the auth schema without replacing user identities
  - Scope: `convex/schema.ts`, auth-owned schema definitions, generated Convex types, and compatibility tests.
  - Acceptance criteria:
    - Convex Auth's required tables and indexes are present.
    - The existing `users` table is customized in place: Convex Auth fields and indexes are supported while legacy `tokenIdentifier`, `displayName`, `stripeCustomerId`, and `createdAt` remain optional compatibility fields.
    - Existing `_id` values and `saved_ideas.userId` references are preserved; no table drop/recreate, destructive narrowing, or production backfill occurs.
    - Any newly introduced index follows current naming/staging guidance and the zero-row production inventory is not treated as authorization to deploy.
  - Verification:
    - Convex schema/type generation against the isolated target
    - Compatibility tests for a legacy-shaped user and a Convex Auth-shaped user
    - `npm run typecheck`
    - `npm run test:convex`

- [x] `WP21-S3` - Configure Google and phishing-resistant magic-link authentication
  - Scope: `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`, provider-specific auth UI/actions, and auth-flow tests.
  - Acceptance criteria:
    - Google uses the official `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` contract and callback path.
    - Magic link uses the owner-selected email provider; no guessed vendor or secret name is committed.
    - The link opens a confirmation interstitial showing the target email and requires an explicit user action before exchanging the code, reducing session-fixation/phishing risk.
    - Magic-link tokens expire and are single-use according to the configured/provider contract; tests cover expired/replayed links without logging token values.
    - Google and magic-link identities with the same email do not auto-link. A collision is denied with a safe recovery message; a verified signed-in linking flow is deferred unless separately scoped and approved.
    - Auth errors are generic, secrets stay server-side, and callback/redirect targets are allowlisted to same-origin platform paths.
  - Verification:
    - Provider contract/unit tests for Google, magic-link issue/confirm/expiry/replay, callback validation, and same-email collision
    - Credential-backed Resend issue/confirmation/session/dashboard flow in isolated development
    - Deterministic Google redirect/callback/session/logout contracts; credential-backed Google E2E is deferred to go-live by the 2026-08-05 owner ruling
    - Staged secret/private-key pattern scan

- [x] `WP21-S4` - Integrate authenticated Next.js state without taking tenant routing
  - Scope: `app/ConvexClientProvider.tsx`, `app/layout.tsx`, minimal auth routes/components, `middleware.ts`, and redirect tests.
  - Acceptance criteria:
    - The route-scoped platform auth provider sends Convex Auth tokens and supports server-side auth state without constructing a client during static prerender or making canonical public content dynamic.
    - `/dashboard` is the only new protected placeholder seam for WP23; anonymous requests are redirected to `/signin` with a validated same-origin return target.
    - Signed-in users visiting `/signin` return to `/dashboard`; logout clears auth state and returns safely.
    - Existing apex/www, dirty-path, preview, public idea, sitemap, robots, and static-asset behavior remains unchanged.
    - WP21 does not implement tenant-host routing, wildcard logic, the platform dashboard shell, or private GET side effects.
    - Auth cookies remain host-only/same-origin and are not broadened to future tenant subdomains.
  - Verification:
    - `npm run test:redirects`
    - Auth middleware route matrix
    - `npm run build`

- [x] `WP21-S5` - Establish the server-derived identity and denial contract
  - Scope: a narrow current-user/auth guard module under `convex/`, its tests, and no platform-domain schema from WP22.
  - Acceptance criteria:
    - Private functions derive identity server-side; no caller-supplied user ID is accepted for authorization.
    - Anonymous callers receive a deterministic denial and cannot read a private probe record.
    - Authenticated callers resolve the Convex Auth user ID, preserving the application `users` ID contract for later ownership tables.
    - Public content queries remain public and unchanged.
  - Verification:
    - `convex-test` anonymous/authenticated cases
    - `npm run test:convex`
    - `npm run typecheck`

- [x] `WP21-S6` - Run the WP21 security gate and close or explicitly block activation
  - Scope: `docs/wp/wp21-progress.md`, `docs/wp/session-ledger.md`, `docs/wp/wave-gate-report.md`, `docs/PROJECT_STRATEGY.md`, and WP21 evidence/restore append.
  - Acceptance criteria:
    - All configured checks, the production dependency audit, auth-flow tests, canonical regression, and staged secret scan pass.
    - An independent high-risk reviewer reports no unresolved critical/high auth, identity, cookie, callback, migration, or routing finding.
    - The record distinguishes code-complete isolated behavior from provider flows that could not be exercised without owner credentials.
    - Production activation remains blocked until a fresh read-only inventory, full Convex backup, restore tag, exact dry run, provider secrets, and owner approval are recorded.
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`
    - `npm audit --omit=dev --audit-level=high`
    - `git diff --check`

## File Boundaries

The WP21 worker may edit:

- `package.json`, `package-lock.json`
- `convex/schema.ts`, auth-owned files under `convex/`, and generated Convex types
- `app/ConvexClientProvider.tsx`, `app/layout.tsx`
- minimal `/signin`, magic-link confirmation, callback/error, logout, and `/dashboard` placeholder routes/components
- `middleware.ts` only to compose Convex Auth with the frozen canonical behavior
- auth and redirect tests under `convex/` and `tests/`
- `vitest.config.ts` only for the minimum module-resolution/test-runtime accommodation needed to exercise the installed Convex Auth adapter
- `.env.example` for key names/comments only
- `docs/wp/wp21-progress.md` and WP21-specific evidence/backup append sections

The orchestrator alone owns the registry, session ledger, wave gate report, manifest changes, rulings, story checkboxes, and final integration commit.

## Out Of Scope

- Production deployment, environment mutation, key generation/rotation, data backfill, schema narrowing, or table replacement.
- Automatic same-email account linking or an unapproved linking flow.
- The WP23 dashboard shell/Explore UX, WP22 platform tables/authorization matrix, tenant routing, billing, projects, or public CTA work.
- Broad cookie domains, authenticated side effects on GET, public auth mutations outside the library contract, or exposing provider errors/secrets.
- Switching to Better Auth, Clerk, Auth0, passwords, OTP, or another fallback without an owner ruling.

## Stop Conditions

- Stop before selecting a magic-link vendor until the owner rules.
- Stop before any command resolves to a production Convex deployment or requests `--prod`.
- Stop on a need to replace/drop the existing `users` table, change existing user IDs, broaden cookies to subdomains, or take the tenant-routing seam.
- Stop if the current Convex Auth/Next.js versions fail the isolated security gate; report the evidence and request the manifest's fallback-provider ruling.
- Never print or commit secret values, private keys, raw email addresses, session cookies, tokens, or OAuth credentials.
