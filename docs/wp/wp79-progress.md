# WP79 Progress — Tenant email engine

Append-only progress log. Claims must cite checks or code evidence.

## 2026-11-06 — Setup

- Branch/worktree: `codex/wp79-tenant-email` / `.worktrees/wp79-tenant-email`, from `origin/main` `d8055b98` after G1 passed.
- Assignment: WP79-S1–S6 per `04-build-plan.md` and owner rulings D5/D6.
- File boundaries: in `wp79-stories.md`; WP79 is the Phase 2 writer of cron/http/env files, WP78 owns lead capture and tenant host paths.
- Required checks: typecheck, lint, test, build, targeted security/exactly-once tests, independent Claude review, `git diff --check`.
- Initial risks: physical tenant Resend project/domain are not set up; WP76 drafts and WP77 C-APPROVAL are not on main; D5 real lead capture is not active. No live sends or production deployment authorized.
- Needs from other lane: WP76 draft sequence contract, WP77 C-APPROVAL contract and approval-state API; Claude reviews sending and founder-facing errors before merge. Needs from WP78: opted-in lead/retention interface and retention cron entry request.

## 2026-11-06 — C-DATA amendment proposed (schema only)

- Existing `sequences`, `sequence_steps`, `enrollments`, and `email_sends` support the outline, but no table stores a per-business From name, Reply-To and postal address; no hashed opt-in/unsubscribe token exists; delivery callback and cap queries lack direct indexes.
- Additive proposal in `convex/schema/growth.ts`: `business_email_settings` and `lead_email_tokens`, each carrying `ownerId` and `projectId`. Only `tokenHash` is persisted; raw opt-in/unsubscribe tokens are never stored. Add optional callback/retry metadata to `email_sends` and indexes for component email ID and owner/project send history. Existing fields and literals remain intact.
- `lead_email_tokens.expiresAt` is optional: opt-in confirmation expires, while an unsubscribe URL remains valid until the lead is purged. Existing `email_sends.status` stays a string for compatibility; WP79 runtime will define and enforce its allowed states.
- WP77-S1 in Claude's committed story file asks for a content fingerprint. Add optional `approvals.subjectVersion: string` in `convex/schema/workspace.ts`, stable across status-only changes and invalidated by step/document content changes. WP79 must consume WP77's merged `assertApproved` API, not infer approval from a prior status patch.
- Needs from Claude orchestrator before merge: add the C-DATA change line to `docs/plans/launch-workspace/contract-changes.md` and obtain consuming-lane acknowledgement per `05-lanes-codex-claude.md` §5. This WP does not edit Claude-owned contract docs.
- No data backfill, runtime sending, provider call, or production deployment is part of this schema slice.
- Checks on schema slice with WP79 S1 files also present but not staged: `npx vitest run convex/wp68Schema.test.ts` (37 pass), `npx vitest run convex/wp79Schema.test.ts` (2 pass), `npm run typecheck` (pass), `git diff --check` (pass). A clean schema-only PR must rerun the required checks on its exact pushed head before merge.
- Exact-head draft PR #195 gate found a test inventory assertion still fixed at 26 Phase 0 tables. Updated the security test to require the two WP79 tables explicitly and 28 total workspace tables. `node --experimental-strip-types --test tests/security/wp68-workspace-boundaries.test.mjs` now passes all 5 cases. Full exact-head gate reruns after this follow-up commit.
- WP77-S1 committed `c402c967` and requested an additive `approvals.by_status_and_createdAt` index for bounded expiry. Added it to this schema-only PR and a focused index assertion. WP77 also requests an hourly cron entry for `internal.workspace.approvals.expireStaleApprovals`; WP79 owns `convex/crons.ts` and will add that entry only after C-APPROVAL merges to main. The schema index needs an exact-head gate rerun.
- WP78's per-contact delete must revoke active enrollments and cancel queued component email in the same transaction as contact erasure. Added `enrollments.by_leadId` and `email_sends.by_enrollmentId` for bounded lookup. Runtime `revokeLeadContact({ leadId })` is internal, called by WP78's owner deletion mutation; WP79 sender also rechecks lead deletion/unsubscribe before every enqueue. The Resend component can cancel waiting/queued mail, but mail already sent to Resend cannot be recalled. Finalized component rows retain recipient details until its cleanup job deletes them; D5 erasure is not complete until that retention behavior and any provider-side retention are documented and gated.
