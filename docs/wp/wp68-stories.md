# WP68 Stories - Data contract and ops switches

Branch: `codex/wp68-data-contract`
Lane: Work Package (Phase 0 of the ratified WP67 program)
Registry: `docs/PROJECT_STRATEGY.md`, Launch Workspace Program
Definition of done: Additive schema and WP22 unions; owner-only business authorization; dormant ops switches; connector contract; known dependencies; security coverage; safe dev deployment and standard checks.

## Stories

- [x] `WP68-S7` - Add known dependencies
  - Scope: `package.json`, `package-lock.json`.
  - Acceptance criteria: `@anthropic-ai/sdk`, `@convex-dev/sharded-counter`, and `@convex-dev/resend` install and remain unused until later WPs.
  - Verification: `npm ci`, `npm run typecheck`.
- [x] `WP68-S1` - Add the C-DATA tables
  - Scope: `convex/schema.ts`, `convex/schema/{workspace,ai,growth}.ts`.
  - Acceptance criteria: Every new table and index in architecture §4.2 exists; validators are flat; existing tables and indexes remain.
  - Verification: schema inventory test, `npm run typecheck`, safe dev schema deploy.
- [x] `WP68-S2` - Amend WP22 tables additively
  - Scope: `convex/schema.ts`, `convex/platform/validators.ts`.
  - Acceptance criteria: Every §4.1 optional field and literal is present; prior literals and required fields remain; existing tests stay green.
  - Verification: schema diff review, `npm run typecheck`, targeted platform tests.
- [x] `WP68-S3` - Add owner-only C-AUTHZ
  - Scope: `convex/platform/authz.ts`, focused tests.
  - Acceptance criteria: `requireBusinessAccess(ctx, projectId, "owner")` derives identity server-side and returns `RESOURCE_NOT_FOUND` for missing, archived, and other-owner businesses.
  - Verification: authorization tests.
- [x] `WP68-S4` - Add dormant C-OPS
  - Scope: `convex/ops/settings.ts`, focused tests.
  - Acceptance criteria: `ops_settings` and `workspace_cohort` are super-admin managed; all features default off; absent settings fail closed; cohort allows only permitted owners.
  - Verification: ops tests, authorization tests.
- [x] `WP68-S5` - Add connector contract and CopyConnector
  - Scope: `convex/growth/connectors/types.ts`, focused tests.
  - Acceptance criteria: Social and ads connector interfaces exist; CopyConnector creates a copy-ready result without a network call or external send.
  - Verification: connector tests.
- [x] `WP68-S6` - Add security matrix
  - Scope: new files in `tests/security/`.
  - Acceptance criteria: Every new table has an owner index; every new public function enforces business or super-admin access; provider import restrictions are pinned.
  - Verification: `npm run test:security`, then standard checks.
- [x] `WP68-S8` - Reconcile pre-business wizard authorization with the security scanner
  - Scope: `convex/platform/authz.ts`, `tests/security/wp68-workspace-boundaries.test.mjs`, focused authz tests, this progress log.
  - Acceptance criteria: Export an expiry-aware owner-only wizard-session guard for mutation callers and a clock-free read path. An exact allowlist recognizes only WP74's eight pre-business public functions with their existing current-user or owned-session guards; all still require `assertFeatureEnabled`, and every other public workspace function still needs business or super-admin access. No Claude-owned wizard file changes in this slice.
  - Verification: focused authorization and scanner tests, standard checks, isolated local Convex if a backend check is needed.

## Out of scope

- G0, WP70, WP73, live AI, live sends, production deployment, activation, Stripe, DNS, and SMS or phone fields.

## Notes

- C-DATA is offered for Claude review as soon as S1 and S2 pass. Contracts merge with dormant/fixture behavior first.
- The other lane owns `lib/workspace/contracts/**`; requests go in `wp68-progress.md`.
