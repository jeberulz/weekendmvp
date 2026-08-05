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

- Current official setup pins `@auth/core@0.41.1` alongside `@convex-dev/auth`; the earlier local skill reference to `0.37.0` is stale and will not be followed.
- Official setup requires the initializer `npx @convex-dev/auth`, auth tables, `convex/auth.config.ts`, `convex/auth.ts`, `convex/http.ts`, a Convex Auth React/server provider, and composed Next.js middleware.
- Google development callback is the isolated Convex HTTP Actions URL plus `/api/auth/callback/google`; key names are `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
- Convex Auth's documented magic-link example uses Resend with `AUTH_RESEND_KEY`, but vendor selection remains an owner decision.
- The official magic-link guide documents a session-fixation/phishing risk for instant-click sign-in. WP21 therefore requires a confirmation interstitial and explicit exchange action.
- Next.js server auth uses cookies. WP21 permits queries on authenticated GET paths only; mutations/actions remain POST/PUT and same-origin to avoid CSRF side effects.
- Auth cookies must remain host-only and must not leak to future tenant subdomains. Tenant routing stays with WP28.
- Next: Commit the frozen WP21 contract, then assign the high-risk auth worker. Provider-neutral foundation and Google code may proceed while the magic-link vendor decision is pending.
