# WP38 Stories - Super Admin And Operator Control Plane Foundation

Branch: `codex/wp38-admin-plan`
Lane: Work Package within Build Platform Program Wave 3
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: One deployment-bootstrapped, server-verified super-admin can
use an accessible private operator shell, inspect bounded operational state, and
run only explicit audited commands. Anonymous and customer accounts fail every
admin route/query/mutation. WP32-WP36 can reuse the frozen authorization/audit
seam for the Idea Engine and canonical content publishing without gaining a
generic customer-data bypass. WP31 remains blocked until the independent
security gate passes.

## Frozen Product And Security Contract

- V1 has one role: `super_admin`. Staff roles, teams, impersonation, and delegated
  support access are deferred.
- The owner-designated verified account is supplied through deployment-only
  bootstrap configuration and bound server-side to its Convex Auth user ID.
  Never commit the bootstrap email or authorize by a client-supplied email.
- Every `/admin` route, query, mutation, and action re-verifies the capability
  server-side. UI hiding is not authorization.
- `super_admin` exposes only named operational projections and commands. It is
  not a generic override for WP22 owner checks and does not permit arbitrary
  private-artifact browsing, direct ledger edits, hard deletion, or customer
  impersonation.
- Every privileged mutation requires a bounded input, reason, server-derived
  actor, stable idempotency key, timestamp, outcome, and immutable audit event.
- Dangerous production commands require explicit confirmation and recent strong
  authentication. The exact re-auth mechanism is an implementation decision,
  but no live command activates until its security gate passes.
- WP38 provides the reusable foundation. WP32 owns engine signals/candidates and
  their review UI; WP33-WP36 own compiler-specific draft/review/publish surfaces.
- Canonical content follows branch -> preview -> approval -> deploy/health check
  -> activate -> audit/rollback. No direct-main push or automatic publication.
- Customer subscriptions remain deferred. WP38 v1 may show verified credit-pack
  and purchase state but has no subscription-management UI.

## Stories

- [ ] `WP38-S1` - Bootstrap and enforce the super-admin capability
  - Scope: additive operator-role contract, narrow `requireSuperAdmin()` helper,
    deployment configuration declaration, authz tests, and migration runbook.
  - Acceptance criteria:
    - Bootstrap can bind only an authenticated, verified owner account and is
      idempotent; it cannot be invoked from a public/client mutation.
    - Runtime authorization uses the bound auth user ID, not an email comparison.
    - Anonymous, ordinary customer, forged identity/role, changed-email, and
      self-elevation attempts fail closed with generic errors.
    - No existing owner-scoped helper is weakened or bypassed.
    - Production bootstrap is an irreversible/auth-sensitive action requiring
      restore inventory, dry run, exact owner approval, and post-run evidence.
  - Verification: isolated bootstrap migration tests and anonymous/customer/
    admin/forgery denial matrix; typecheck, lint, secret/PII scan.

- [ ] `WP38-S2` - Build the accessible private operator shell
  - Scope: `app/admin/**`, `components/admin/**`, route metadata/cache guards,
    bounded aggregate operational queries, focused UI tests.
  - Acceptance criteria:
    - `/admin` exposes truthful aggregate user/project/task/site/billing/system
      state only; no invented revenue, status, health, or completion metrics.
    - Admin navigation covers overview, users, projects, billing, engine/content
      placeholders, system, and audit without implementing WP32-WP36 data.
    - Routes are `noindex`, excluded from sitemaps, private/no-store, responsive,
      keyboard operable, and WCAG 2.1 AA.
    - Customer/anonymous requests do not receive admin projections or existence
      information.
  - Verification: route/cache/SEO denial tests, desktop/mobile keyboard journey,
    automated a11y scan, bounded-query tests.

- [ ] `WP38-S3` - Add controlled account, project, task, and billing operations
  - Scope: narrow command modules and admin screens over existing WP24/WP26-WP30
    domain APIs; no new money or workflow path.
  - Acceptance criteria:
    - Supported commands are explicit and reversible where possible: suspend/
      restore account, quarantine/unpublish project, retry/cancel eligible task,
      append a reasoned promotional credit grant, and request supported full
      refund through the existing server-verified flow.
    - Commands validate current state and permissions, use stable idempotency
      keys, and never directly rewrite ledger balances, task history, customer
      documents, or Stripe truth.
    - Unsupported partial refunds, dispute resolution, destructive deletion,
      arbitrary status edits, and cross-owner content access fail before mutation.
  - Verification: state/adversarial/replay/concurrency tests and exact ledger/
    task/project audit assertions.

- [ ] `WP38-S4` - Freeze privileged audit, confirmation, and recovery contracts
  - Scope: append-only privileged audit records, dangerous-action confirmation/
    re-auth seam, admin activity and recovery views/tests.
  - Acceptance criteria:
    - Every privileged attempt records actor, named capability, target, reason,
      idempotency key, request/result timestamps, outcome, and redacted error.
    - Audit rows are immutable, bounded/indexed, and contain no secret, auth token,
      customer brief/report body, payment method, or raw provider payload.
    - Dangerous commands cannot run from stale sessions or GET/navigation side
      effects and require explicit confirmation.
    - Retrying a command cannot duplicate money, publication, or workflow state;
      failed/partial operations expose a reconciliation path.
  - Verification: missing-reason/stale-session/replay/redaction/immutability tests
    and simulated partial-failure recovery.

- [ ] `WP38-S5` - Provide the reusable editorial authorization and release seam
  - Scope: capability names, state contract, placeholder admin surfaces, and
    integration tests for later WP32-WP36 consumers; no engine/compiler build.
  - Acceptance criteria:
    - Capabilities cover engine view/config/review and canonical content draft,
      approve, stage, activate, rollback, and external-send operations.
    - Only `super_admin` may move editorial state. Candidate/draft output can
      never jump directly to published/sent.
    - Release contract requires automated quality evidence, explicit approval,
      branch/preview reference, successful deployment/asset health evidence,
      activation result, and rollback reference.
    - CLI/agent compilers may create staged branches but cannot manufacture an
      approval or production activation record.
  - Verification: anonymous/customer/service/agent/admin matrix and invalid/
    skipped/replayed transition tests.

- [ ] `WP38-S6` - Run the independent admin/security gate
  - Scope: WP38 progress/gate evidence and WP38-owned fixes only.
  - Acceptance criteria:
    - Standard checks, production dependency audit, secret/PII scan, browser/a11y
      journey, authz matrix, idempotency, audit, recovery, SEO/cache, and migration
      dry-run checks pass.
    - Independent high-risk reviewer reports no unresolved Critical, High, or
      Medium issue in bootstrap, elevation, cross-owner access, privileged action,
      money/workflow reuse, editorial control, audit, recovery, or scope.
    - No production bootstrap, live command, customer-data mutation, charge,
      refund, DNS/domain action, content activation, external send, or credential
      rotation occurred during the code gate.
  - Verification: configured full gate plus explicit two-user-plus-admin browser/
    API journey and independent findings-first review.

## File Boundaries

WP38 may add `app/admin/**`, `components/admin/**`, narrow admin/authz/audit
Convex modules and tests, additive schema/index entries during a serialized
one-writer window, and WP38 docs. It may integrate only through existing named
WP24/WP26-WP30 server APIs. It must not implement engine ingestion/generation,
content compilers, customer dashboard redesign, subscription billing, middleware/
tenant routing, or production activation.

## Stop Conditions

- Stop if implementation requires a generic owner-check bypass, impersonation,
  arbitrary private-document access, direct ledger mutation, hard deletion, or
  client/email-based authorization.
- Stop on any shared schema/generated-file/middleware/lockfile collision until
  the orchestrator assigns a serialized merge window.
- Stop before production bootstrap or any live privileged command until the
  backup/dry-run/approval/independent-review gate is recorded.
- Stop if WP32-WP36 engine/compiler functionality is needed; WP38 freezes only
  their reusable security and release contract.
