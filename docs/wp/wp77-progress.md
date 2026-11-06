# WP77 Progress - Wren chat and the approvals loop

## 2026-11-06 - Started (Phase 2)

- G1 passed (`d8055b98`); the owner said "Merged, go Phase 2".
- Branch and worktree: `claude/wp77-wren-approvals` at `.worktrees/wp77-wren-approvals`, from `d8055b98`.
- Order: S1 first, because Codex's WP78 publisher and WP79 sender call `assertApproved`.
- Needs from Codex: none yet.

## 2026-11-06 - S1

What: C-APPROVAL. Generators and Codex's flows raise cards with the internal `createApproval`. The founder lists
pending cards and approves, asks for changes (optional note) or cancels them. Stale pending cards expire, and
`assertApproved` gates every send, post, publish, ad launch and spend.

Files:
- `convex/workspace/approvals.ts`: `createApproval` (internal) + `createApprovalRecord` helper,
  `listPendingApprovals` (public query), `decideApproval` (public mutation), `expireStaleApprovals` (internal,
  cron target), `assertApproved(ctx, approvalId, subject)` helper + `checkApproved` (internal query for actions),
  exported validators and `ApprovalSubjectRef`.
- `lib/workspace/contracts/approvals.ts`: kinds, statuses, decisions, the closed kind → subject-table map,
  version policy, TTL and limits, error codes (types and pure helpers only).
- `convex/workspace/approvals.test.ts`: 16 convex-test cases.
- `convex/_generated/api.d.ts`: registered the new module (the same two lines codegen writes; no deployment touched).

Decisions:
- Subject shape `{ projectId, kind, subjectTable, subjectId, ownerId? }`. Each kind can name only certain tables:
  publish → `site_versions`; send → `sequences` | `sequence_steps` | `outbound_messages`; post → `social_posts`;
  ad_launch → `ad_campaigns`; artifact_review → `documents` | `site_versions`; spend → `documents` | `tasks`;
  upgrade → `projects`.
- Version: `approvals` has no version column. The strongest check the schema allows is that the subject row and
  the content it carries were written no later than the approval's `createdAt`. That content is the site
  version's document, a sequence's steps and their documents, a post or message's document, and an outbound
  message's list. A `site_versions` row is immutable (WP28 inserts new rows), so its id is the version. `projects`
  (upgrade) is checked by identity only. If a subject row links to a different `approvalId`, the check refuses.
  Gap: a status-only patch on a mutable workflow row also counts as a change, so the check fails closed. Callers
  must call `assertApproved` before they patch the subject. They must also write the subject's `approvalId` link
  in the same mutation as `createApproval`.
- Exactly once: repeating the same decision is a no-op (`changed: false`). Any other decision on a decided card
  throws `APPROVAL_ALREADY_DECIDED`. An approve whose subject changed throws `APPROVAL_SUBJECT_CHANGED` and leaves
  the card pending. Raising the card again cancels the stale one. A card past its 7-day TTL becomes `expired` on
  decision.
- `assertApproved` also refuses when the kind's kill switch is on: publish → `publish`, send → `email`,
  post → `social`, ad_launch → `ads`. It never consumes the approval. Exactly-once delivery is the caller's
  idempotency key.
- Expiry runs while the workspace is off, because closing stale cards only removes permission (the same reasoning
  as the C-METER shutdown-cleanup ruling). Each transaction handles one bounded page (default 50, max 100). It is
  idempotent. (Superseded by the review fix below: the action loops pages; nothing self-schedules.)
- Decisions on send/post/publish/spend/ad_launch/upgrade write an `audit_events` row (`02` §4.1).

Tests (`npx vitest run convex/workspace/approvals.test.ts`, 16 passed): create → list → approve →
assertApproved (query and mutation contexts); dedupe and supersede on creation; creation refusals; double decide
is exactly once with one audit row; request-changes note trimmed and length-capped; approve refuses a changed
subject; TTL expiry on decide; pending, cancelled and changes_requested give NOT_APPROVED; wrong kind, project,
owner, forged owner, other subject, wrong table, missing approval and archived business all fail closed; changed
version for document, site-version document, added sequence step and ad budget; deleted subject; a link to
another approval; non-owner, other business and signed-out callers cannot list or decide; workspace off refuses
list, decide, create and assert; the kind's kill switch; expiry is bounded, finishes the table, is idempotent and
runs while off. A mutation test (disabling the version check and the same-decision no-op) turned 2 cases red, and
both were restored.

Checks: `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing warnings,
none in new files); `npm run test:security` 0 (the WP68 guard scanner accepts the new public functions);
`npm test` 1 on the first run (editorial fixture `beforeAll` hook timeouts under load; `npm run test:editorial`
alone passed 295/295), then 0 on a full rerun.

Docs: progress and stories updated; contract file documents the API. No plan or ruling changes.

Review fixes (independent security review, should-fix items, after `c402c967`):
- P2-1 `site_versions` content fields could be re-pointed without a timestamp the check reads. Added the static scan
  `tests/security/wp77-site-versions-insert-only.test.mjs`. It fails if any Convex code replaces a site version or
  patches anything beyond `status`/`publishedAt`/`retiredAt`. It also checks untyped `db.patch(id, ...)` calls for
  content keys or non-literal values; four legacy content upserts are allowlisted and every allowlist entry must
  still match. Its fixture test proves six rewrite shapes are caught and status transitions pass. `publish` now
  also refuses a site version that is not `ready`/`published`, or whose site has `takedownAt`, at creation,
  approval and check (`APPROVAL_SUBJECT_NOT_PUBLISHABLE`). The overstated test is renamed to what it covers. The
  timestamp check stays as defence in depth. The contract states that `subjectVersion` is the real fix and must
  fail closed when missing.
- P2-2 approved cards lived forever. A new card for the same (business, kind, subject) now also cancels older
  approved cards and writes an `approval.superseded` audit row. The founder can revoke an approved card with
  `cancel` (approved → cancelled, exactly once, owner only, `approval.revoked` audit row). The contract header
  states that single-use kinds (publish, send activation, ad_launch, spend, upgrade) must be consumed by the
  side-effect mutation. Until `consumedAt` exists, the caller's idempotency is the only consumption.
- P2-3 `spend` cards were not bound to a price. `costCredits` is now required (positive) for `spend` and refused on
  every other kind (`APPROVAL_INVALID_INPUT`). The subject gains `expectedCostCredits` and `expectedChangeRound`,
  required for `spend` and checked whenever given; a missing or different value refuses with
  `APPROVAL_TERMS_MISMATCH`.
- P3 The supersede scan now reads the subject's whole history through the exact `by_subjectId` index; the old scan
  stopped at 50. A test pads the history with 60 rows. A comment marks the founder's note as data for S2. Expiry no
  longer schedules itself: `expireStaleApprovalsBatch` (one bounded page) is driven by the `expireStaleApprovals`
  action, at most 200 batches per run, inside one cron run. Runs cannot overlap. Past 20,000 rows a run stops
  before the oldest history until the index lands (pages run newest first since the re-review).
- Tests: 20 passed in `convex/workspace/approvals.test.ts` (4 new: publishable/takedown, supersede approved past 50
  rows, revoke, spend terms; expiry tests rewritten for batch + action). 2 passed in the new security scan.
- Checks: `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing
  warnings, none in changed files); `npm run test:security` 0 (204 node + 121 vitest); approvals tests 20/20; `npm test` 0 on the first run (no rerun needed).

Re-review fixes (after `5a492c0c`):
- P2 scan gap: the site-versions scan now also matches a bare `db`, any name typed `DatabaseWriter`,
  `GenericDatabaseWriter` or `MutationCtx["db"]`, a renamed destructure (`const { db: tx } = ctx`) and an alias of
  `<expr>.db`. Computed keys count as non-literal. New fixtures cover the helper, destructured, renamed, aliased
  and computed-key forms, plus two negatives (a status-only helper patch and a non-writer `map.patch`). Current code
  shows no false positives.
- P3 expiry pages newest first (`.order("desc")`), so each run reaches the recent cards, where pending ones live.
  New test: a one-row batch expires the newest stale card first.
- P3 approving a card whose cost does not fit its kind now refuses with `APPROVAL_TERMS_MISMATCH`, the same as
  `assertApproved`. Tested with a forged unpriced `spend` card.
- P3 revoke keeps the original `decidedAt` (the approve time) and moves only `status` and `updatedAt`. The
  `approval.revoked` audit row carries the revoke time. Tested.
- Tests: approvals 21/21; scan 2/2 (14 fixture offenders, 2 negatives).
- Checks: typecheck 0; `tsc -p convex` 0; lint 0 (0 errors); approvals 0; scan 0; `test:security` 0; `npm test` 0
  (first run); `npm run build` 0.

Open question for the orchestrator (WP30 publishing): nothing writes `site_configs.takedownAt` today, and `unpublish`
retires only the current version. So a never-published `ready` version on an unpublished site stays approvable for
`publish`. Is that intended, or should `publish` also require the site not to have been unpublished (or should
unpublish retire every `ready` version)?

Needs from Codex (complete set):
1. `approvals.subjectVersion: v.optional(v.string())`: a content fingerprint written at creation. It covers every
   content field: `site_versions` content (`documentId`, `landingSpec`, `storageId`) plus the document's
   `contentSha256`; a sequence's ordered step ids, `delayHours`, subjects and documents; the outbound list
   attestation; the social post's account and document; the campaign's budget, objective and platform. Once it
   lands, `assertApproved` compares fingerprints and fails closed on an approval without one.
2. `approvals.consumedAt: v.optional(v.number())`, so single-use kinds are consumed in the side-effect mutation.
3. Index `by_status_and_createdAt` (`["status", "createdAt"]`) on `approvals`, so expiry reads only pending rows.
4. A non-overlapping hourly expiry cron in `convex/crons.ts`: `crons.interval("expire stale approvals",
   { hours: 1 }, internal.workspace.approvals.expireStaleApprovals, {})`. The target is an action that loops
   batches itself and schedules nothing.
5. An index that bounds the supersede history read, e.g. `by_subjectId_and_kind` (or one that adds `projectId`).
   `upgrade` cards use the project id as their subject, so that history grows with the business. Until then the
   read covers the whole history and fails closed (the transaction errors) if it ever exceeds Convex limits.
6. WP78/WP79/WP83 call `assertApproved` in the side-effect mutation, before patching the subject, with the subject
   shape (plus `expectedCostCredits`/`expectedChangeRound` for `spend`). From actions they use
   `internal.workspace.approvals.checkApproved` and re-check in the recording mutation.
