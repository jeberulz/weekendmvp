# Editorial DTO v1 and repository contract

Frozen in WP46-E0 (2026-09-27). Code: `lib/editorial/contracts/**`. Tests: `tests/editorial/contracts/**` and the adapter-independent suite in `tests/editorial/contract/repository-contract.ts`.

This is the presentation/command boundary between the Editorial workspace and its producers. It is not WP45's ResearchRecord v2: the E5 adapter maps WP45's final records onto it. Changing anything below is a contract change — bump `EDITORIAL_CONTRACT_VERSION` and update both adapters and this document together.

## Incoming envelope (`EditorialSubmission`)

`contractVersion: 1`, `submissionId`, `producer` (`engine` | `legacy-import` | `manual`), `mode` (`live` | `fixture` | `legacy`), `engineRunId`, `engineContractVersion`, `artifactHash`, `title`, `proposedSlug`, `buyer`, `job`, `wedge`, `recommendation` (`accept` | `needs_research` | `reject` | `unknown`), `recommendationReasons`, `markdown`, `metadata`, `sources`, `claims`, `checks`, `legacy`.

`legacy` (`firstPublishedAt`, `bodyOrigin`) is an addition to the plan's minimum envelope: legacy imports must preserve the original publication date and the MDX/Convex body origin, and it is required exactly when the producer is the legacy importer.

Validation rules (`contracts/submission.ts`, `evidence.ts`, `checks.ts`, `metadata.ts`, `primitives.ts`):

- Strict objects at every level: unknown keys fail. There is no free-form metadata bag; metadata is the closed set of existing manifest fields (description, category, build time, revenue goal, tools, audiences, highlights, OG inputs) with the `validate-idea-tags` allowlists and highlight limits. `tests/editorial/contracts/taxonomy-drift.test.ts` pins the copies to the publishing gate.
- Every string, array and body is bounded (`contracts/limits.ts`; body 200,000 characters).
- Timestamps are ISO 8601 UTC with `Z`; dates are `YYYY-MM-DD`; impossible calendar dates fail.
- Single-line fields refuse control characters, line separators and bidirectional overrides. Bodies refuse raw control characters.
- Source URLs are http(s) to a named public host: no credentials, IP literals, `localhost`, `.local`, `.internal` or `.lan`.
- Unknown stays unknown: a source's `publishedAt`/`retrievedAt`/`excerpt` may be `null`, but a `verified` source must have its excerpt, retrieval time and check time, and a search summary can never be `verified`. Assumptions are `not_applicable`; only assumptions may be. A verified claim needs a supporting source. Claims and checks may only reference evidence in the same envelope.
- Validation issues carry a path and message only (at most 25, messages truncated). They never echo submitted values.

## What the receiver establishes (never the envelope)

- **Principal.** An ingestion credential maps to one producer. `producer` must match it (`PRODUCER_MISMATCH`).
- **Mode.** The receiver accepts only its own mode: the fixture adapter takes `fixture` (and `legacy` from the legacy importer); the live adapter must refuse `fixture` (`MODE_REJECTED`).
- **Artifact hash.** Recomputed from the content; a mismatch is refused (`ARTIFACT_HASH_MISMATCH`).
- **Idempotency.** `producer + submissionId`: the same content returns the existing record; different content is refused (`SUBMISSION_ID_REUSED`).
- **Slug.** A slug held by another idea is not overwritten: the new idea is flagged `slugConflict` with `duplicateOf`, and approval is blocked.
- **Verification authority** (`engine_receipt` | `fixture_simulated` | `none`). Only a validated WP45 receipt (E5) may yield `engine_receipt`. Legacy imports are forced to `unverified` / `none`, and their checks are dropped: an old `auditPassed` flag is never approval.
- **Quarantine.** Legacy markup that the public MDX renderer would execute is quarantined: displayed as text, never rendered, and approval is blocked until a corrected revision exists.
- **No human authority.** An import creates a `new` candidate (or `legacy` for live pages) with the engine recommendation stored separately. It never creates a decision, review attestation or approval.

## Repository interface

`contracts/repository.ts`. One instance is bound to one server-established principal. No method accepts an actor ID, role, approval status, live pointer or verification flag. Every read and command re-checks the principal; UI gating only explains. Denied attempts are written to the activity log in a path that survives the denial.

Reads: `getQueueSummary`, `listIdeas(filter, cursor, pageSize)`, `getIdea`, `getRevision`, `listReleases`, `listTrash`, `listActivity`, `getSettings`.

Commands: `importSubmission`, `createRevision`, `discardRevision`, `saveDraft(ideaId, revisionId, baseVersion, patch, idempotencyKey)`, `setCandidateDecision(ideaId, expectedVersion, input)`, `markReviewed(revisionId, itemId, dependencyHash, note)`, `retractReview`, `flagReviewItem`, `resolveIssue`, `addNote`, `requestChanges`, `resumeReview`, `runChecks(revisionId, expectedArtifactHash)`, `approveRevision(revisionId, artifactHash, { attest: true, note })`, `prepareRelease`, `publishRelease`, `cancelRelease`, `retryRelease`, `reconcileRelease`, `requestRollback`, `unpublishIdea`, `trashIdea`, `restoreIdea`.

There is deliberately no bulk review, approval, publish or delete command (a contract test fails if one appears).

Error codes: `contracts/errors.ts`. Principal failures: `UNAUTHENTICATED` (anonymous or unknown credential), `FORBIDDEN` (signed in without the capability), `SERVICE_NOT_PERMITTED` (a service principal attempting a human action), `REAUTH_REQUIRED`.

## State machines (`contracts/states.ts`)

Three independent machines, plus a trash lifecycle:

| Machine | States | Notes |
|---|---|---|
| Candidate decision | `new`, `accepted`, `needs_research`, `rejected`, `legacy` | `legacy` = live before the workspace; not a recorded decision. Leaving `accepted`/`legacy` revokes pending approvals. Reject never unpublishes. |
| Revision review | `draft`, `in_review`, `changes_requested`, `approved` | First attestation moves `draft → in_review`. `approved` is frozen: edits fork a new draft. Approval records are `active`, `revoked` or `superseded`. |
| Publication | `never_published`, `live`, `unpublished` | Changes only on a verified activation (or unpublish revocation), never on a click. |
| Release | `preparing → preview_ready → publish_requested → deploying → verifying → activating → succeeded`; `failed`, `cancelled`, `needs_reconciliation` | Unpublish: `publish_requested → activating (pointer revoked, generation advanced) → verifying (removal probes) → succeeded`. An uncertain activation is reconciled from a probe, never blindly retried. A failed attempt may be retried or abandoned. |
| Trash | `active`, `trashed` | Only when not live and nothing in flight. Restore returns the idea unpublished, `new`, without approval. |

## Review items and dependency hashes

`domain/review-items.ts`. A reviewer attests to each item for one dependency hash:

- each present section (heading + body),
- each material observed/derived claim (content, verification, anchor presence, and its sources' content and verification),
- all assumptions together,
- each source (content + verification),
- metadata (title, description, tags, highlights, OG inputs),
- the final preview (the whole artifact hash).

Attestations are idea-scoped and keyed by item and hash, so a fork with an unchanged section keeps that section's review, and an edit invalidates only the items whose hash changed. A forged item ID is `NOT_FOUND`; a forged or stale hash is `STALE_REVIEW_TARGET`. There is no "mark everything" action.

## Artifact versus assessment

The **artifact hash** covers the exact reviewed bytes: body, title, metadata and the archived content of sources and claims. Verification results change over time without rewriting the artifact, so they form a separate **assessment digest**. A verification change invalidates the dependent claim/source reviews and revokes an approval, but never mutates a frozen snapshot.

## Approval validity

An approval (`approveRevision`) records the artifact hash, policy version, assessment digest, the server-generated attestation statement and the approver. It is valid only while all of these hold (checked at staging, at the publish click and by the worker before activation):

- status `active`; candidate `accepted` or `legacy`; idea not trashed;
- the revision's artifact hash equals the approved hash;
- the quality policy version is unchanged;
- the assessment digest is unchanged;
- checks are current (evaluated for this artifact and policy) and nothing is blocking.

Approval itself requires: every review item reviewed at its current hash; no blocker (executable markup, unsafe links, missing sections, unsupported or re-worded claims, stale or missing checks, quarantine, slug conflict, open high-severity discrepancy); every warning resolved with a written reason. Blockers cannot be resolved with a note.

## Evidence labels

Shown with text, never colour alone: **Machine verified**, **Reviewed by you**, **Unavailable**, **Changed since review**, **Provisional search summary**, **Assumption** (plus **Unverified** for legacy evidence). A human review never manufactures machine verification.

## Releases and lifecycle rules

- Publish, retry, rollback, unpublish and trash need recent strong authentication (10 minutes) established by the session, not the client.
- The kill switch blocks new publications, retries and rollbacks, and the worker re-checks it before deploying and activating. Unpublish and reconciliation always work.
- A monotonic generation fence per idea advances on unpublish, trash and every activation; the worker cancels any job whose generation is stale.
- Rollback targets an earlier successful release of the same idea, requires a reason, and re-runs safety checks on the target.
- Unpublish needs no passing checks (emergency removal).

## Server actions (the UI's only write path)

Editorial commands reach the repository only through server actions in `app/admin/editorial/_actions/**` (a private folder, never a route). Server actions are public POST endpoints, so each one:

1. calls `withWorkspace(schema, input, run)` (`lib/editorial/runtime/action-support.ts`), which re-resolves the workspace on every call. Production is always `WORKSPACE_UNAVAILABLE` until the live adapter lands, and the input is not parsed at all when the workspace is unavailable;
2. validates its untrusted input with a strict Zod schema built from the DTO v1 primitives (`INVALID_INPUT`, first issue only, no echoed values);
3. leaves identity, state and version fences to the repository, which re-checks them.

Actions return `CommandResult`s and never refresh or redirect: navigation is the client's job, so a background refresh can never replace text the editor has not saved. A structure test fails if an exported action skips `withWorkspace`; the production probe calls every action directly and requires `WORKSPACE_UNAVAILABLE` with no fixture data.

The live adapter (E4) plugs in behind `withWorkspace`: resolve the super-admin principal, deny with a generic error, audit the attempt, and require recent strong authentication for publish-class commands. The action signatures and schemas do not change.

Draft actions (E2): `saveDraftAction` (returns the acknowledgement and the fresh revision view), `createRevisionAction` (fork a snapshot, optionally carrying unsaved editor text into the new draft), `discardRevisionAction` (needs the current version and a reason), `runChecksAction` (bound to the saved artifact hash; a stale hash is `STALE_REVIEW_TARGET`) and `getRevisionAction` ("use theirs" after a conflict).

Review actions (E3, `review.ts`): `decideCandidateAction` (idea version fence), `markReviewedAction` / `retractReviewAction` / `flagReviewItemAction` (one item, bound to its dependency hash), `resolveIssueAction` (warnings and flags only, with a note), `addNoteAction`, `requestChangesAction`, `resumeReviewAction` and `approveRevisionAction` (`attest: true`, bound to the artifact hash). Each returns the fresh revision view. There is no bulk review, approve or publish action.

Release and lifecycle actions (E3, `release.ts`): prepare, publish, cancel, retry, reconcile, rollback, unpublish, trash and restore. Each names the state it expects (release state, live release or idea version). Publish, retry, rollback, unpublish and trash need recent strong authentication.

Local demo controls (E3, `demo.ts`): confirm or expire the simulated sign-in, kill switch, fail the next deployment, lose the next activation acknowledgement, bump the policy version, one simulated worker tick, and reset. They only exist on the fixture workspace.

For E4: `components/admin/editorial/common/StrongAuthStep.tsx` calls the demo sign-in confirmation. The live adapter must replace that call with the real step-up flow (and the demo actions must not be reachable in live mode); the dialogs that show the step do not change.

## Shared core (WP46-E4b)

Every rule above lives once, in `lib/editorial/core/**`: `EditorialCore` (the repository), `derive.ts` (views, issues, blockers), `rules.ts` (approval validity, release transitions, activation) and `listing.ts` (queue buckets, filters, cursors). It runs over a store-neutral `EditorialState` and an environment:

- `clock` and `ids` (sequential in the demo, random keys in Convex);
- `checks`: the quality policy in force. `run: null` means no check library is connected, so checks cannot run and nothing can be approved;
- `releases`: whether a release worker exists. Without one, prepare, publish, retry, reconcile, rollback and unpublish refuse with the reason instead of recording an intent nobody carries out;
- `mode` (the receiver accepts only its own submission mode) and `simulated` (demo narration).

The receiver takes the verification authority from its trusted caller: legacy imports are always `none`; with `none`, submitted verification results are downgraded to unverified and submitted checks are dropped. A release keeps the probe `observation` recorded by the worker; reconciliation applies it and refuses when there is none yet. Release and activity records carry the revision number, so lists never load revision bodies.

The fixture adapter is the core plus simulated seams (credentials, checks, worker, the two-tab edit). The live adapter (E4c) is the core over one idea's records loaded from Convex.

## Fixture boundary

`lib/editorial/adapters/fixture/**` and `lib/editorial/fixtures/**` are demo-only: fictional content on `.example` domains, simulated checks (`producer: "fixture_simulated"`), a simulated worker and simulated re-authentication. `assertFixtureModeAllowed()` throws in production builds, and the runtime selector only reaches this code behind a `NODE_ENV !== "production"` branch. Fixture tests serialise commands in one process: they prove the rules, not real concurrency or deployment.

## Shared-file ownership during the parallel slice

This branch owns only `app/admin/editorial/**`, `components/admin/editorial/**`, `lib/editorial/**`, `tests/editorial/**` and `docs/plans/editorial-admin/**`. Changes to `convex/**` (schema, `_generated`), auth helpers, `middleware.ts`, root layout/styles, `next.config.ts`, `package.json`/lockfile, CI, public routes, `ideas/manifest.json`, `content/**`, `lib/engine/**` and `docs/PROJECT_STRATEGY.md` belong to the serialized integration windows listed in [wp46-progress.md](wp46-progress.md).
