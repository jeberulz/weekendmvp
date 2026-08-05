# WP22 Stories - Platform Schema, State Machines, And Authorization

Branch: `codex/wp22-platform-contracts`
Lane: Work Package within Build Platform Program Wave 2
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Additive Convex tables and shared validators define the platform project, artifact, workflow, site, lead, audit, credit, purchase, and run contracts without changing existing user IDs or public content tables; server-derived owner-only authorization denies anonymous and cross-owner access; lifecycle transitions fail closed; all intended queries have bounded index paths; isolated schema generation/deploy plus the standard gate pass; and the frozen generated/API contract is ready for WP23, WP24, and WP25.

## Frozen Contract

- New table names: `projects`, `briefs`, `submissions`, `idea_intents`, `tasks`, `task_steps`, `documents`, `document_citations`, `site_configs`, `site_versions`, `leads`, `audit_events`, `credit_accounts`, `credit_ledger`, `purchases`, and `workflow_runs`.
- Existing `users`, `ideas`, and `saved_ideas` tables remain compatible and unchanged except for generated type expansion. `saved_ideas` is not migrated or deleted in WP22.
- Every private root record is keyed by server-derived `ownerId`; child access must also verify its owning project. No caller-supplied user identifier grants access.
- Lifecycle families are centralized: project, brief/submission, task/step, site/version, purchase, and workflow run. Consumers may narrow behavior but may not invent incompatible status strings.
- Generated text/JSON bodies are capped at `256 * 1024` UTF-8 bytes by write validators/helpers. Repeating citations and task steps are child rows. Large generated assets are storage references; user uploads are absent.
- V1 deletion is archive/soft-delete only. Ledger and audit rows are append-only. There is no support/admin bypass.

## Stories

- [ ] `WP22-S1` - Freeze reusable platform validators and migration-safe contracts
  - Scope: `convex/platform/validators.ts`, `convex/platform/transitions.ts`, and type-only imports needed by those files.
  - Acceptance criteria:
    - Export one source of truth for every enum/discriminated state used by the WP22 tables, including project source/status, brief/submission status, intent flags, task/step type and status, document kind/format, site/version status, purchase status, ledger reason, and workflow-run status.
    - Export composable Convex validators and strict TypeScript types without `any`, duplicated status lists, or client-trusted ownership fields.
    - Export a byte-accurate 256 KiB generated-document body guard; arrays that can grow without a product bound are represented as child-table contracts.
    - Changes are additive: no existing table/field/index is removed, renamed, narrowed, or backfilled.
  - Verification:
    - `npm run typecheck`
    - `npm run test:convex`
    - `git diff --check`

- [ ] `WP22-S2` - Add the indexed platform schema
  - Scope: `convex/schema.ts`, `convex/platform/validators.ts`, and generated Convex types.
  - Acceptance criteria:
    - Add exactly the frozen tables above with explicit ownership/project relationships, timestamps, soft-delete/archive fields where applicable, and no embedded unbounded collection.
    - Define only query-driven indexes, named with every indexed field per Convex guidance. Required access paths cover owner lists, owner-plus-idempotency uniqueness, project children, project/status queues, user/idea intent, site host/version lookup, Stripe/provider references, ledger ordering, and run/task lookup.
    - Money uses integer minor units and credits use integers; schema fields do not accept client-derived balances or prices as authorization.
    - `credit_ledger` and `audit_events` have no mutable/deletion contract. `leads` is schema-only with synthetic test records; production lead collection remains blocked on WP28 retention/privacy approval.
    - Existing `users._id`, `saved_ideas.userId`, public-content tables, auth tables, and their indexes remain compatible. No migration component or data backfill is introduced because this is an additive empty-table expansion.
  - Verification:
    - `npm run typecheck`
    - `npm run test:convex`
    - `npx convex dev --once` only after confirming the target is the isolated `local:` deployment

- [ ] `WP22-S3` - Establish owner-only authorization helpers
  - Scope: `convex/platform/authz.ts` and focused authorization tests under `convex/platform/`.
  - Acceptance criteria:
    - Reuse the WP21 Convex Auth identity/session contract and derive the application user ID server-side.
    - Provide typed helpers for current-user enforcement, owned-project loading, and child-resource project ownership. Missing, archived/soft-deleted, anonymous, cross-user, cross-project, and forged-parent cases fail with stable generic Convex error codes.
    - No public or internal function accepts a caller-provided `userId`, email, provider subject, or role as proof of ownership.
    - No admin, support, impersonation, shared-project, or team bypass exists.
    - Public idea/content queries remain public and unchanged.
  - Verification:
    - Anonymous/authenticated/two-user/two-project `convex-test` matrix
    - `npm run test:convex`
    - `npm run typecheck`

- [ ] `WP22-S4` - Enforce fail-closed lifecycle state machines
  - Scope: `convex/platform/transitions.ts` and focused transition tests under `convex/platform/`.
  - Acceptance criteria:
    - Central transition helpers cover project, brief/submission, task/step, site/version, purchase, and workflow-run lifecycles.
    - Valid forward transitions pass; skipped, reversed, terminal-state escape, double-finalization, publish-before-ready, and refund-from-nonfailed cases fail deterministically.
    - Archive/soft-delete is explicit and never physically deletes a row. Money/credit transitions are contracts only; WP24 owns verified Stripe events, balance mutation, idempotency, disputes, and refunds.
    - Transition checks are pure/deterministic and reusable by later mutations; clients cannot write status directly through a generic patch function.
  - Verification:
    - Table-driven valid/invalid transition tests
    - `npm run test:convex`
    - `npm run typecheck`

- [ ] `WP22-S5` - Prove isolation, bounded access paths, and contract completeness
  - Scope: tests under `convex/platform/`, `convex/schema.ts`, and generated types only where test-driven corrections are required.
  - Acceptance criteria:
    - A two-users/two-projects fixture proves each user can access only their project and every tested child kind; swapping project, child, task, document, site, purchase, or run IDs is denied.
    - Anonymous callers cannot read or mutate private platform records, and archived/soft-deleted projects disappear from ordinary access.
    - Tests exercise every state family, document-size boundary, ledger/audit append-only contract, compound uniqueness/idempotency seam, and the `idea_intents` independence of `saved` and `interested`; `building` remains derived from active project existence.
    - Query helpers/tests use exact indexes with bounded `.take(...)`, `.unique()`, or pagination. No new unbounded `.collect()` path is introduced.
    - A contract inventory test fails if a frozen table or required index disappears before WP23-WP25 consume it.
  - Verification:
    - `npm run test:convex`
    - `npm run typecheck`
    - `npm run lint`

- [ ] `WP22-S6` - Run the WP22 data/security gate and freeze consumers
  - Scope: `docs/wp/wp22-progress.md`, WP22-specific append sections in `docs/wp/session-ledger.md`, `docs/wp/wave-gate-report.md`, `docs/PROJECT_STRATEGY.md`, and generated Convex types.
  - Acceptance criteria:
    - The isolated `local:` schema push/type generation passes without targeting a cloud development or production deployment.
    - Standard checks, production dependency audit, diff check, and secret/private-key scan pass.
    - An independent high-risk reviewer reports no unresolved critical/high ownership, transition, schema, indexing, money-contract, or migration finding.
    - The final record freezes table names, validators, statuses, ownership helpers, and generated API for WP23-WP25; later incompatible changes return to the orchestrator for serialization.
    - Production remains unchanged: no deploy, backfill, row mutation, environment mutation, hard delete, or schema narrowing occurs.
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`
    - `npm audit --omit=dev --audit-level=high`
    - `git diff --check`

## File Boundaries

The WP22 worker may edit:

- `convex/schema.ts`
- new files under `convex/platform/`
- generated Convex type/API files produced by the isolated local schema run
- `docs/wp/wp22-progress.md`

The orchestrator alone owns the registry, manifest, rulings, session ledger, wave gate report, story checkboxes, downstream consumer authorization, and final integration commit.

## Out Of Scope

- Product queries/mutations for the dashboard, Explore, intake, projects, billing, tasks, previews, publishing, tenant routing, leads, or workflows.
- Stripe Checkout/webhooks, credit balance mutation, refunds/disputes, workflow execution, AI calls, renderer behavior, or UI.
- Migration/backfill from `saved_ideas` to `idea_intents`; removing or narrowing any existing table, field, or index.
- Production/cloud deployment or environment mutation, hard deletion, retention cleanup, user uploads, support/admin roles, impersonation, teams, or cross-owner sharing.
- Changing the dead `legacy.weekendmvp.app` fallback; WP28 owns that routing seam.

## Stop Conditions

- Stop before any command resolves to a cloud development or production Convex deployment, requests `--prod`, or mutates non-isolated data.
- Stop if an existing field/index must be narrowed, renamed, deleted, or backfilled; return with a widen-migrate-narrow plan and exact inventory.
- Stop if a downstream feature requires a new table/status, a support/admin bypass, user uploads, hard deletion, or a product rule not frozen above.
- Never print or commit secret values, raw customer data, session identifiers, OAuth credentials, Stripe secrets, or lead PII.
