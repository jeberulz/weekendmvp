# Backup And Restore Record

Wave 0 is documentation/read-only and performs no production mutation. This file defines the mandatory inventory and stop conditions for later auth, billing, workflow, tenant-domain, and offboarding changes. It is not evidence that a backup already exists.

## Restore Marker

- **Git tag:** Not created. Required immediately before the first production activation/backfill; proposed `platform-pre-production-YYYYMMDD-HHMM`.
- **Database snapshot/backup:** Not created. A Convex cloud backup including file storage is required before auth compatibility changes or production platform rows.
- **Created by / at:** Pending.
- **Restore path:** Restore the tagged code, restore/import the approved Convex snapshot into the target deployment, restore environment variables from the owner's secret manager, reconcile scheduled/workflow tasks, restore the prior `publishedSiteConfigId`, and remove/restore wildcard association according to the domain inventory.

Convex backups do not replace code, environment, domain, Stripe, or in-flight workflow recovery. These are separate inventory items and no secret values may be committed here.

## Backup Inventory

| System | Required Coverage | Current State | Gate/Gaps |
|---|---|---|---|
| Git | Merge SHA plus signed/annotated pre-activation tag | Branch baseline `f35ccfd`; no restore tag | Tag before Wave 4 or any irreversible migration |
| Convex data | Full backup including storage; counts and representative shapes for `users`, `saved_ideas`, `stripe_events`, `subscriptions`; duplicate email/token and dangling-reference inventory | Unknown | Owner/credential access required; export path and retention must be recorded without secrets |
| Convex runtime | Deployed code SHA, env key names, scheduled functions, workflow/task reconciliation query | Unknown | Backup alone omits code/env/pending schedules |
| Vercel | Project/deployment IDs, current domains, DNS/nameserver records, env key names, previous working deployment | `www` and apex documented; wildcard project association absent; legacy origin non-working | Capture exact API/console inventory and rehearse rollback before wildcard activation |
| Stripe | Test/live products, prices, webhook endpoint IDs/events, customer/purchase counts, metadata purpose map | Platform objects absent | Create test objects in WP24; live inventory and approval in Wave 4 |
| Ideabrowser | MCP configs, key location name, exact backlog IDs/status, expiry/cancellation time | Configs exist; backlog/expiry time unknown | Required before WP37; never record the key value |
| Content | `ideas/manifest.json`, MDX, OG assets, Convex seed counts | Git-backed plus production seed | Compiler activation must deploy pages before production seed/listing activation |

- **Backup count:** 0 program-specific production snapshots recorded.
- **Date/time range:** Not applicable yet.
- **Retention:** Owner ruling required before production activation.
- **Last restore test:** None recorded.
- **Gaps:** All production inventories above; current legacy hostname cannot serve as rollback.

## Dry-Run Inventory

- **Command/script:** Not yet implemented. WP20 must provide the read-only auth compatibility and environment inventory; WP21 later provides a mutation dry-run if production compatibility work is needed; WP24 provides Stripe/ledger fixtures; WP28 provides domain/tenant inventory; WP37 provides backlog/dependency inventory.
- **Environment:** Isolated Convex/Vercel preview and Stripe test mode first. Production read-only dry run only after reviewer approval.
- **Tables/files/rows affected:** Must be exact in the wave-specific append below.
- **Counts by action:** Required: insert/update/skip/conflict/error, plus before/after totals.
- **Expected no-op rows:** Required.
- **Risks:** Identity mis-linking, dangling saved ideas, duplicate ledger credit, orphaned workflows, tenant host collision, lead PII loss, credential removal before fallback quality.
- **Output path:** Redacted artifact under `docs/wp/evidence/` or a secure external evidence link; never raw PII or secrets.

## Owner Approval

- **Approved by / at:** Not approved.
- **Exact inventory approved:** None.
- **Conditions:** No production data mutation, live Stripe charge/refund, external send, DNS/domain mutation, key rotation/removal, or schema narrowing is authorized by Wave 0.

## Execution

- **Command/script / executed by / at:** None.
- **Actual counts:** None.
- **Deviations:** None.

## Post-Run Verification

- **Counts verified:** Not applicable.
- **Checks run:** Wave 0 baseline only; see `wave-gate-report.md`.
- **Critical flows:** Not applicable.
- **Rollback needed:** No.
- **Evidence:** This record and the Wave 0 gate report.

## Required Append Format For A Production Action

Before execution, append a dated section containing the exact target environment, restore tag, snapshot identifier/time, env/domain/Stripe inventory references, dry-run command and counts, owner approval, execution command, actual counts, reconciliation output, critical-flow results, and rollback decision.

## 2026-08-05 - WP20 Read-Only Auth Preflight

- **Action:** Read-only production Convex aggregate inventory and environment-key-name inventory; no export, mutation, deploy, key read, or key change.
- **Evidence:** `docs/wp/evidence/wp20-auth-environment-inventory.md`.
- **Production counts:** `users=0`, `saved_ideas=0`, `stripe_events=0`, `subscriptions=0`, `ideas=160`; all inspected tables were below the 10,000-row read ceiling.
- **Integrity summary:** No duplicate user email/token, Stripe event ID, saved-idea pair, or dangling saved-idea reference can exist in the four empty platform/legacy tables at this point in time.
- **Environment summary:** Convex production has no application environment variables. Vercel Preview/Production and local/operator key names were inventoried without values. Current Convex Auth manual setup requires `SITE_URL`, a paired `JWT_PRIVATE_KEY`/`JWKS`, and the official `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` names for the approved Google path; none are provisioned. The magic-link provider/key remains an explicit WP21 owner decision.
- **Restore state:** No backup or restore tag was created because WP20 performed no mutation. A fresh inventory, full Convex backup, restore marker, exact migration dry run, and owner approval remain mandatory before any production auth/schema action.
- **Authorization:** This section authorizes nothing beyond the completed read-only inspection.

## 2026-08-05 - WP21 Isolated Auth Foundation

- **Action:** Convex Auth initializer, additive compatibility schema/code generation, and local application verification against the anonymous/local Convex backend only.
- **Local mutations:** The initializer created local-only `SITE_URL`, `JWT_PRIVATE_KEY`, and `JWKS`; `npx convex dev --once` pushed auth functions/tables and the customized compatibility schema to that isolated backend. Values are not recorded.
- **Production mutations:** None. No `--prod`, cloud development deploy, production environment, row, index, schema, key, domain, or cookie action occurred.
- **Restore state:** No production backup/tag was required for this isolated local action. The existing production backup, restore-marker, fresh inventory, exact dry-run, and owner-approval requirements remain unchanged.
- **Evidence:** `docs/wp/evidence/wp21-auth-gate.md` and `docs/wp/wp21-progress.md`.
- **Authorization:** This record does not authorize provider account creation, production deployment, key provisioning/rotation, data migration, or WP22 start.

## 2026-08-05 - WP21 Isolated Resend Checkpoint

- **Action:** Added the owner-selected Resend adapter, confirmation UI, server-side canonicalization seam, sensitive-route privacy headers, and deterministic auth lifecycle tests. A local-only `npx convex dev --once` regenerated types and pushed code without executing delivery.
- **External effects:** None. Resend HTTP calls were mocked in tests; no real email, provider account/domain/key creation, cloud development deployment, or production action occurred.
- **Secret state:** `AUTH_RESEND_KEY` and `AUTH_RESEND_FROM` remain absent locally. `AUTH_LOG_LEVEL=ERROR` is the required deployed setting because the pinned Convex Auth dependency can expose issuance arguments only when explicitly placed in DEBUG mode.
- **Restore state:** No production backup/tag was required because production was untouched. Fresh inventory, full Convex backup, restore marker, exact dry run, credential provisioning, and owner approval remain mandatory before production activation.
- **Authorization:** This checkpoint authorizes no live send, provider credential entry, production deployment, migration, or WP22 start.
