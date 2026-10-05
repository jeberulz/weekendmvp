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

## 2026-10-04 - WP46-E7d private legacy baseline import (pre-execution record)

- **Exact action and target:** Apply `node scripts/editorial-import-legacy.mjs --apply` to `first-squirrel-244` (`https://first-squirrel-244.eu-west-1.convex.cloud`) only. This creates private editorial baseline data; it does not publish or change a public pointer. The checkout's default Convex `--prod` target is a different project and is prohibited for this action.
- **Serving code and restore marker:** Canonical `/api/editorial/reader-health` reports protocol 1 and Git commit `d4b53c2367d14ebb7236692a57c79c88b70cf43f`. The Git-backed production Vercel build deployed Convex to `first-squirrel-244` before Next and is Ready; its CI passed. Annotated tag `editorial-pre-e7-import-20261004-1350` points to this commit and was pushed to `origin` before the import.
- **Fresh data backup:** Convex snapshot `1791121510128059076`, including file storage, downloaded to ignored `tmp/wp46-e7/live-before-approved-import-20261004.zip` in the E7 worktree. SHA-256: `37942d208070b2c43637ab3e6b970dbdf569e062fd409d13b1c98f71062eb1a6`. ZIP integrity passed, permissions are `0600`, and the file is excluded by `tmp/` in `.gitignore`. Preserve this file in restricted storage; a Git tag alone does not restore data, auth keys or scheduled jobs.
- **Exact dry-run inventory:** `node scripts/editorial-import-legacy.mjs` reports 226 manifest ideas, 226 importable, zero skipped, digest `909c86ca13b3c1a252df9165ae4efc7585ec282fc77dba556c735012ee7294f2`. Comparison with the fresh snapshot found 225 matching submission artifact hashes and one missing private slug, `prompt-regression-tests-indie-ai-builders`; zero changed hashes. Before action: 230 public `ideas`, 228 private `editorial_ideas`, zero `editorial_engine_records`, zero `editorial_public_pointers`, one active super-admin binding. Three retired `engine-draft-*` private records are outside the current manifest and are not import targets. Expected importer result: one insert, 225 duplicates, zero skips/conflicts; after action: 229 private ideas, 230 public ideas, zero public pointers.
- **Environment and external inventory:** The live Convex environment-name check found `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `JWKS`, `JWT_PRIVATE_KEY`, `PLATFORM_BILLING_BRIDGE_SECRET`, `REVALIDATE_SECRET`, `SITE_URL`, and `SUPER_ADMIN_BOOTSTRAP_EMAIL`. `EDITORIAL_RELEASE_ENABLED`, `EDITORIAL_PUBLIC_SITE_URL`, and `EDITORIAL_READER_COMMIT` are absent. No env value is recorded. The canonical known idea/build routes return 200/no-store; unknown/draft idea routes return 404/no-store; sitemap returns 200. This action touches no Stripe, domain or external-send configuration. Pending scheduled functions are not represented in the ZIP; the importer does not initiate the release worker, and job reconciliation remains an E7 restore gate.
- **Owner approval:** In this Codex conversation, after the exact target/digest/backup and one-row expected change were presented, the owner replied on 2026-10-04: “ok go ahead and implement the order”. This authorizes this bounded private import and subsequent ordered E7 work subject to their own preconditions. It is not evidence that a candidate passed source review or that the editorial release switch should already be enabled.
- **Execution command:** With `EDITORIAL_IMPORT_CONVEX_URL` set to the exact URL and `EDITORIAL_IMPORT_ADMIN_KEY` supplied only through the operator environment, run the importer with `--target=first-squirrel-244`, `--confirm-inventory=909c86ca13b3c1a252df9165ae4efc7585ec282fc77dba556c735012ee7294f2`, and `--backup=tmp/wp46-e7/live-before-approved-import-20261004.zip`. Do not print the key or use `--prod`/`--verbose`. Execution, actual counts and post-run checks are pending below this record.
- **Stop and recovery:** Stop on a changed digest, wrong deployment, mismatch with the approved 225/1 plan, any slug conflict, changed public count/pointer, or a failed route probe. Leave publishing disabled. The importer uses stable submission IDs, so an interrupted run can be inventoried and safely retried with the same approved bytes after investigation. A full snapshot restore is a separate data-destructive recovery action: first compare intervening writes, code tag, environment keys and scheduled jobs; do not blindly replace the live database.

### Execution and reconciliation, 2026-10-04

- **First attempt:** The exact-target import processed the existing submissions as duplicates but stopped on `prompt-regression-tests-indie-ai-builders` with `INVALID_SUBMISSION`. The live parser identified the rejected path as `metadata.highlights.tiers`, even though the merged source and dry-run parser accept it. A read-only count confirmed 228 private ideas, 230 public ideas, zero public pointers and no private row for that slug. The failed transaction added an internal rejection audit event; it did not insert the baseline. No public page or release pointer changed.
- **Post-failure recovery point:** Full export with file storage from `first-squirrel-244`, snapshot `1791122377905568286`, ignored `tmp/wp46-e7/live-after-validation-rejection-20261004.zip`, SHA-256 `b21b3d0bea911ea4042e6a528c27f14fa8e96511755c1c4f754690c383cb9022`; archive integrity passed and file mode is `0600`. This preserves the rejection audit before the backend refresh. Do not replace the live database from either archive without reconciling later writes and jobs.
- **Backend reconciliation:** The merged source still contained bounded `highlights.tiers`. A deployment-scoped `deployment:deploy` key targeted only `first-squirrel-244`. The non-verbose dry run completed schema validation, said no indexes would be deleted and listed additive indexes. The merged backend was deployed to that target; the key was revoked. The canonical reader remained at commit `d4b53c2367d14ebb7236692a57c79c88b70cf43f`, with the release switch absent.
- **Approved retry:** A new scoped internal-query/mutation key reran the same 226-page digest `909c86ca13b3c1a252df9165ae4efc7585ec282fc77dba556c735012ee7294f2` against the same target and verified backup. Actual result: **one inserted, 225 duplicates, zero conflicts/skips**. The key was revoked. Post-run read-only counts: 229 private editorial ideas, 229 private submissions, 230 public `ideas`, zero public pointers, and exactly one private row for `prompt-regression-tests-indie-ai-builders`. The canonical idea URL still returns 200 with `Cache-Control: no-store`; reader-health returns 200. A management key-name inventory found no temporary E7 probe, import or deploy key left active. No full restore was required.
- **Remaining gates:** This private baseline import is not a managed release. Functional snapshot/auth/job rehearsal, a human-approved real engine candidate, managed release/takedown probes, credential rotation and final switch configuration remain separate E7 work.

### Isolated post-import restore and auth rehearsal, 2026-10-04

- **Source and target:** Full live snapshot `1791122649786144687` from `first-squirrel-244`, including file storage, ignored `tmp/wp46-e7/live-after-private-import-20261004.zip`, SHA-256 `b6d86085a1d9afae0e22b4916d6beb29e29e4e8f65812b2b0ed72be1a2912ddf`. ZIP integrity passed and file mode is `0600`. This archive is the post-import recovery point. It was restored with `--replace-all --yes` into the isolated expiring **development** deployment `wonderful-armadillo-159`, never into the live site.
- **Data and jobs:** All 59 application tables match the archive exactly, 2,220 application documents in both. The snapshot also includes 59 system `_tables` rows; neither the archive nor the restored component contains file objects. Critical counts are 230 public ideas, 229 private editorial ideas/submissions, 230 private revisions, one super-admin binding and eight auth sessions. Live and staging `_scheduled_functions` inventories each contain zero pending jobs. The restore produced no public-domain or Vercel change.
- **Functional auth:** The isolated deployment received a newly generated, staging-only RS256 private key/JWKS pair and `SITE_URL=http://localhost:3189`; its prior random dummy billing bridge remained untouched. No live auth, Google, Resend or revalidation secret was copied. A direct verification-code attempt for the restored email placeholder matching the Google-bound owner was refused by the account-collision guard, as designed. A fresh staging-only email then redeemed a one-time code through the public auth action, received access and refresh tokens, authenticated on a read, and remained excluded from the editorial workspace. No external email was sent. A second `--replace-all` import returned staging to two users, eight sessions, 229 private ideas and zero pending jobs; the temporary auth key was revoked. This verifies basic issuance/isolation on restored data, **not** the owner's Google OAuth login or full browser journey.
- **Remaining recovery limit:** The isolated deployment has no Google OAuth/Resend provider configuration. The production owner's fresh Google re-auth, scheduled-job recovery with non-empty jobs, and environment-rebuild procedure have not been demonstrated. Do not call the restore gate fully complete or enable release on this basis alone.

### Live credential rotation checkpoint, 2026-10-04

- **Authorization and target:** The owner's instruction to implement the E7 order authorized this reversible production credential work. The target remained `first-squirrel-244` in the `weekendmvp` project; canonical reader commit `d4b53c2367d14ebb7236692a57c79c88b70cf43f`; editorial release switch absent. The Vercel project was `john-iseghohis-projects/weekendmvp`. The provider-side Google client ID and callback matched the live Convex deployment. The relevant environment **names** were `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `REVALIDATE_SECRET` and `PLATFORM_BILLING_BRIDGE_SECRET`; values were not recorded. The source production snapshot had no pending scheduled functions.
- **Fresh recovery point:** Immediately before rotation, a full storage-inclusive export produced snapshot `1791123922265844827`, ignored `tmp/wp46-e7/live-before-credential-rotation-20261004.zip`, SHA-256 `b6d86085a1d9afae0e22b4916d6beb29e29e4e8f65812b2b0ed72be1a2912ddf`. ZIP integrity and mode `0600` passed. The export was byte-for-byte identical to the prior post-import recovery snapshot because no data had changed.
- **Executed:** The Google OAuth secret was overlapped, live-target updated, fresh owner sign-in verified, old secret disabled, sign-in verified again, and old secret deleted at the provider. The JWT signing key and public JWKS were updated atomically with a temporary `deployment:env:write` key, exact-readback verified and the key revoked. An old session was invalidated; fresh Google re-auth loaded the same one active super-admin binding. The Convex billing bridge secret was independently rotated and verified; the matching Vercel variable is absent, so production checkout remains disabled. No public content or editorial pointer changed.
- **Revalidation closure:** PR #103 merged at `b40687e20480289a2a5c90596ddacaa28d02020b`. The first new-secret Vercel redeploy rejected the new header, so Convex remained unchanged. A protected production-target diagnostic build passed with the re-applied value. Git-backed redeploy `dpl_3zAUL9BYgD6C2JxfKi1upsjFwAEQ` then served the canonical domains and accepted that value; the exact live Convex target was updated and readback matched. Convex's internal `revalidate:run` made the warmed `/articles` cache HIT → STALE → fresh HIT. Missing credentials are still refused. The temporary local secret and Vercel environment pull were removed. No production restore was needed. The source snapshot had zero pending jobs; non-empty scheduled-job recovery remains unproved.

### E7m pre-227-baseline checkpoint, 2026-10-04

- **Restore-marker gap:** No Git restore tag was created before the E7m public seed or private import. The existing `editorial-pre-e7-import-20261004-1350` tag identifies the earlier E7d code at `d4b53c2`, not the E7m execution code. PR #106 and PR #107 merge SHAs identify the deployed code checkpoints below, and the full snapshots identify the data checkpoints; a tag created after these writes would not satisfy the pre-action restore-marker requirement. Treat this as an unmet procedural gate in the E7 final review, not as a completed restore rehearsal.
- **Target and reader:** The public site at `https://www.weekendmvp.app` reads `first-squirrel-244`; after PR #105 its `/api/editorial/reader-health` returned commit `752dc3ac1bc9a23293e140b3c40963427b9210fe`. The new DMARC idea/build pages returned 200/no-store and unknown slugs 404/no-store. `EDITORIAL_RELEASE_ENABLED`, `EDITORIAL_PUBLIC_SITE_URL` and `EDITORIAL_READER_COMMIT` are absent. This is a preflight, not release activation.
- **Fresh full backup:** Exported `first-squirrel-244` with file storage at snapshot `1791127887420095183` to ignored `tmp/wp46-e7/live-before-227-import-20261004.zip`, SHA-256 `e3ff1c7b51c706e9013c2b70ef07fb49ee667d9b680f89deb04dc953895b7657`. ZIP integrity passed and file mode is `0600`; no secret value is in this record. The archive contains 59 application tables, 2,154 application documents and zero storage objects. The reduction from the earlier 2,220-document archive is in expired auth refresh tokens (126 → 59); auth sessions increased 8 → 9 after the owner's fresh sign-in. Other table counts did not change.
- **Read-only inventory:** 230 public `ideas` rows, 229 private editorial ideas and submissions, zero public pointers and versions, zero pending scheduled jobs. The DMARC slug is absent from both the public Convex catalogue and private editorial table. The refreshed importer dry run is 227/227, zero skips, digest `f10ef96c917d0c4256c18517d31968de0d7c1c8363d9b87b08101a53c94b00e5`. The full public seed dry run would upsert 227 rows, so E7m instead prepares a single-slug seed for the missing DMARC row. Neither production write has run at this checkpoint.
- **Exact delta after PR #106:** The canonical reader returned merge SHA `c9c7c333127cc3cc23cd43256d5874fe520daec2`; its Vercel build completed backend-first. Comparing every inventory artifact hash with the archive's private submissions gives 226 matches, the one missing DMARC slug, zero changed hashes and three retired engine-draft slugs outside the manifest. A single-slug public seed and a `--slug=...` private importer dry run each select exactly one DMARC record. The importer still binds `--confirm-inventory` to the complete 227-page digest and requires the exact target and backup before applying. No seed or import has run.
- **Public catalogue execution:** Against `first-squirrel-244`, after a one-slug dry run and canonical reader check, `seed:seedIdeas` inserted the DMARC row and updated zero others. Read-only reconciliation found 231 public ideas, one DMARC row, 229 private ideas/submissions and zero managed pointers. Direct public idea/build pages still returned 200/no-store. A new storage-inclusive recovery point was exported before the private import: snapshot `1791129131734138989`, ignored `tmp/wp46-e7/live-after-dmarc-seed-before-private-import-20261004.zip`, SHA-256 `71d89140d5723b2d516bf4e6efef8e202b319b7ff32c5f790aa233394ccc3e1a`; ZIP integrity and mode `0600` passed. The archive contains 231 public ideas, 229 private ideas/submissions and zero managed pointers/versions.
- **Private baseline execution:** PR #107 passed CI and merged at `b85302cce22e053ebb38129d392c328923cb31e6`; canonical reader health returned that SHA before applying. The full inventory remained 227/227, zero skips, digest `f10ef96c917d0c4256c18517d31968de0d7c1c8363d9b87b08101a53c94b00e5`, with exactly one selected slug. A one-hour key scoped to `first-squirrel-244` and `deployment:functions:runInternalMutations` invoked only the DMARC import, which inserted one and duplicated zero; the key was revoked immediately afterward. Live read-only counts: 231 public ideas, 230 private editorial ideas and submissions, exactly one DMARC row in both, zero managed public versions/pointers. The private submission artifact hash matches the checked-in MDX/metadata inventory. Canonical idea/build pages remained 200/no-store; an unknown idea returned 404/no-store; the sitemap contains DMARC. The three editorial release environment keys remain absent. No production restore was needed; this is not a managed publish or E7 GO.
