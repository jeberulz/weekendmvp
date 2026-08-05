# WP22 Progress - Platform Schema, State Machines, And Authorization

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup and contract freeze

- Branch/worktree: `codex/wp22-platform-contracts`, primary checkout; no worktree because WP22 is the sole shared-schema writer and executes sequentially after WP21.
- Assignment: high-risk data/security worker owns WP22-S1 through WP22-S5 and prepares S6 evidence. The orchestrator owns rulings, story checkboxes, registry/manifest/ledger/gate truth, downstream release, and the final commit.
- File boundaries: `convex/schema.ts`, new `convex/platform/**`, generated Convex type/API files, and this progress log. No app UI, routing, Stripe handlers, workflow execution, public-content mutation, or production operation.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, focused ownership/state tests, isolated `local:` Convex schema push, secret-pattern scan, and independent high-risk review.
- Owner rulings applied: archive/soft-delete only with immutable ledger/audit; no support/admin bypass; no user uploads; generated document bodies capped at 256 KiB with child rows/storage references for growing or large artifacts.
- Migration strategy: additive empty-table expansion only. Existing `users`, `ideas`, `saved_ideas`, public content, and auth schema remain compatible. No backfill, migration component, destructive narrowing, cloud deployment, or production mutation is authorized.
- Initial risks: schema overreach before WP23-WP25; missing ownership index; trusting redundant parent/owner IDs; unbounded arrays or reads; incompatible status strings; money fields that imply unsafe mutation; accidental cloud target; and test-only functions exposed publicly.
- Frozen consumer seam: table names, shared validators/statuses, ownership helpers, index names, and generated types become the contract for WP23, WP24, and WP25 after S6 passes.
- Next: worker implements one story at a time, records checks and any stop condition here, and returns the unstaged diff for independent review.

## 2026-08-05 - WP22-S1 reusable validator contract

- Added `convex/platform/validators.ts` as the single source of truth for project, brief/submission, intent, task/step, document, site/version, purchase/ledger, workflow, and audit enum contracts plus their strict inferred TypeScript types.
- Added the byte-accurate `assertGeneratedDocumentBody` guard at the inclusive 256 KiB boundary; it measures UTF-8 bytes and emits stable `DOCUMENT_BODY_TOO_LARGE` errors.
- Kept the change additive: no existing schema, table, field, index, generated type, or stored row changed and no migration/backfill was introduced.
- Checks: `npm run typecheck` passed; `npm run test:convex` passed (3 files, 41 tests); `git diff --check` passed.

## 2026-08-05 - WP22-S2 additive indexed schema

- Added exactly the 16 frozen platform tables with explicit owner/project relationships, archive fields only on mutable user records, integer (`int64`) money/credit fields, child rows for citations and task steps, and storage references for large generated assets.
- Added query-driven compound indexes for owner lists/idempotency, project/status queues, intent flags, task/run lookup, site host/version lookup, provider references, and ordered ledger access. Existing users, auth, ideas, saved ideas, and public-content tables/indexes were not changed.
- Confirmed `.env.local` resolves `CONVEX_DEPLOYMENT` to the `local:` class without printing its value. An already-running local backend occupied port 3210, so a second `npx convex dev --once` correctly refused to start; the existing local watcher generated `convex/_generated/api.d.ts` and applied the schema. `npx convex data --deployment local --limit 1` then listed every frozen table, proving the isolated local push succeeded. No cloud or production target was contacted.
- Checks: `npm run typecheck` passed; `npm run test:convex` passed (3 files, 41 tests); `git diff --check` passed.

## 2026-08-05 - WP22-S3 owner-only authorization

- Added reusable helpers that derive the Convex Auth user and session server-side, reject anonymous users, load active owner projects, and verify both child `ownerId` and `projectId` against the authenticated project.
- Missing, archived, cross-owner, cross-project, and forged-parent records all fail with the same stable `RESOURCE_NOT_FOUND` code; unauthenticated/session-invalid callers fail with `UNAUTHENTICATED`. No helper accepts email, provider subject, role, or caller user ID as authority and no bypass exists.
- Added a focused anonymous/two-user/two-project matrix without adding public or internal test endpoints. It proves owner access, cross-owner denial, forged-parent denial, and archive hiding.
- Checks: `npm run typecheck` passed; focused `convex/platform/authz.test.ts` passed (5 tests). Full Convex gate is rerun after each remaining story and at closeout.

## 2026-08-05 - WP22-S4 fail-closed lifecycle contracts

- Added pure typed transition maps/helpers for projects, briefs, submissions, tasks, steps, sites, site versions, purchases, and workflow runs. Status values remain sourced from the shared validators.
- Valid forward paths pass while skips, reversals, terminal escapes, double finalization, publish-before-ready, and refund-before-payment fail with deterministic `INVALID_STATE_TRANSITION`. Task-credit refund eligibility is separately restricted to failed tasks for WP24, and archive is an explicit one-time soft-delete assertion.
- These are contracts only: no status mutation, payment mutation, credit mutation, workflow execution, delete, or generic client patch endpoint was added.
- Checks: `npm run typecheck` passed; focused transition suite passed (23 tests); `npm run test:convex` passed (5 files, 69 tests).

## 2026-08-05 - WP22-S5 isolation and completeness proof

- Added a frozen inventory test for all 16 new tables and every required index, plus explicit append-only table names for future audit/ledger consumers.
- Added an adversarial two-users/two-projects graph covering every project-child table. Each owner can load its own graph; every same-table ID swap is denied. Separate owner-only account/intent swaps are also denied, and S3 already covers anonymous, archived, missing, cross-project, and forged-parent paths.
- Proved the 256 KiB boundary for ASCII and multibyte UTF-8, independent `saved`/`interested` flags, project-derived `building`, exact compound `.unique()` seams, duplicate detection, and bounded `.take(2)` project lookup. Scoped source scan found no `.collect()` path.
- Checks: `npm run test:convex` passed (6 files, 75 tests); `npm run typecheck` passed; `npm run lint` passed with 0 errors and 35 pre-existing out-of-scope warnings; `git diff --check` passed; scoped unbounded-collect scan passed.

## 2026-08-05 - WP22-S6 worker gate evidence

- Full standard gate passed: `npm run typecheck`; `npm run lint` (0 errors, 35 inherited warnings); `npm test` (OG 91, links 6, redirects 32, auth 29, security 4, sitemap 4, Convex 75); and `npm run build` (303 static/partial pages generated successfully, with inherited middleware/dynamic-filesystem warnings).
- Production dependency audit passed: `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities. `git diff --check`, the scoped no-`.collect()` scan, and the no-registered-platform-endpoint scan passed.
- Value-suppressing secret/private-key scan covered every assigned changed/new file and reported 0 matched files. No secret value, raw user data, session identifier, provider credential, Stripe secret, or lead PII was printed or committed.
- Isolated schema evidence remains valid after the final contract adjustment: deployment class is `local`, and explicit `npx convex data --deployment local --limit 1` inventory matched all 16 frozen tables. The running local watcher regenerated the API types and accepted the schema; no cloud/prod deployment, environment mutation, backfill, hard delete, row mutation outside synthetic tests, or narrowing occurred.
- Worker conclusion: WP22-S1 through WP22-S5 are implementation-complete and ready for the required independent high-risk review. The orchestrator owns S6 completion, story checkboxes, consumer freeze, wave gate, registry, and final commit.

## 2026-08-05 - Independent-review HIGH remediation

- Correction to the S5/S6 wording above: the first authorization matrix proved direct `ownerId`/`projectId` isolation, but it did **not** prove the integrity of every nested foreign key or provide an account-level path for projectless audit/ledger rows. The independent reviewer correctly reported both gaps as HIGH; the earlier completion statement was therefore incomplete until this remediation.
- Added table-aware nested-chain validation for brief→document, task step→task, document→task, citation→document, site config→current version, site version→config/document, lead→config, ledger→account/purchase/task/project, and workflow run→task. Every present parent must resolve, share the authenticated owner/project, and remain active where archive applies. Site config/current-version checking is shallow in the version direction to avoid cyclic recursion while still validating the version's config/project relationship.
- Added `requireOwnedAccountRecord` for append-only `audit_events` and `credit_ledger`. Projectless account rows remain valid for their owner; project-linked rows still resolve the active owner project. Ledger access additionally verifies credit-account ownership and requires all optional purchase/task/project references to agree on one active owner project.
- Added same-owner/two-project adversarial fixtures for every requested nested relationship, a deleted-parent case, projectless audit/ledger owner success, cross-owner denial, cross-project linked-ledger denial, and forged credit-account denial. All failures retain the generic `RESOURCE_NOT_FOUND` response and no endpoint or mutation was added.
- Remediation checks: focused authorization/contract suites passed (3 files, 13 tests); `npm run test:convex` passed (7 files, 77 tests); `npm run typecheck` passed; `npm run lint` passed with 0 errors and the same 35 inherited warnings; full `npm test` passed; `npm run build` passed with 303 pages and the same inherited warnings; `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities; diff, secret (10 files/0 matches), no-endpoint, and no-`.collect()` scans passed.
- Scope remained inside `convex/platform/**` and this progress file for remediation. No schema/product-contract change, cloud/prod action, backfill, delete, billing mutation, environment mutation, UI, routing, or orchestrator-owned doc edit occurred.

## 2026-08-05 - Orchestrator gate closeout

- Independent gate result: initial fail on two HIGH authorization findings—nested foreign-key parent integrity and the missing owner-only path for projectless audit/ledger records. No other critical/high/medium finding was reported.
- Remediation re-review: pass with no findings. The reviewer verified every frozen nested relationship, generic denial behavior, safe site-config/version cycle handling, projectless owner access, project-linked account/task/purchase consistency, and the adversarial tests.
- Final checks: typecheck passed; lint passed with 0 errors and 35 inherited warnings; full configured tests passed with 77 Convex tests; build passed with 303 pages and inherited warnings; production dependency audit reported 0 vulnerabilities; diff, secret, no-endpoint, and no-`.collect()` scans passed.
- Contract freeze: the 16 table names, validators/statuses, index names, owner/project authorization helpers, transition helpers, and generated API are now the shared seam for WP23, WP24, and WP25. Incompatible changes require orchestrator serialization and a fresh contract gate.
- Status: WP22 complete. WP23-WP25 may start in isolated development. No production/cloud deployment, environment or row mutation, backfill, hard delete, schema narrowing, or live billing/publishing action was authorized or performed.
