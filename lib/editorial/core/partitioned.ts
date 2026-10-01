import {
  activityFilterSchema,
  cursorSchema,
  ideaFilterSchema,
  pageSizeSchema,
  type ActivityFilter,
  type ApprovalInput,
  type CandidateDecisionInput,
  type FlagInput,
  type IdeaFilter,
  type ImportAck,
  type ReleaseFilter,
  type ReviewAck,
  type SaveDraftAck,
  type SaveDraftPatch,
} from "../contracts/commands";
import { fail, ok, type CommandResult, type EditorialError, type EditorialTarget } from "../contracts/errors";
import type { VerificationAuthority } from "../contracts/evidence";
import {
  isEditorialAdmin,
  type EditorialPrincipal,
  type IngestionCredential,
  type IngestionPrincipal,
} from "../contracts/principal";
import type { EditorialRepository } from "../contracts/repository";
import type { ReleaseState } from "../contracts/states";
import { parseEditorialSubmission } from "../contracts/submission";
import type {
  ActivityEntry,
  IdeaDetail,
  IdeaListItem,
  Page,
  QueueBucket,
  QueueSummary,
  ReleaseView,
  RevisionView,
  SettingsView,
  TrashItem,
} from "../contracts/views";
import { collectChanges, isEmptyChange, snapshotState, type StateChanges } from "./changes";
import { principalView } from "./derive";
import { ideaMatchesFilter, pageIdeaItems, queueBucketFor } from "./listing";
import { LiveEditorialCore, type LiveSettingsContext } from "./live";
import { IDEMPOTENCY_SCOPES, idempotencyStoreKey, type IdempotencyScope } from "./repository";
import {
  appendAudit,
  createEditorialState,
  type ActorRef,
  type AuditRecord,
  type CoreEnvironment,
  type EditorialClock,
  type EditorialState,
  type IdSource,
} from "./state";
import { listItemFromSummary, summarizeIdea, type IdeaSummary } from "./summary";
import { workerStep, type WorkerReport } from "./worker";

/**
 * The editorial repository over a store that holds many ideas but loads one
 * idea's records per transaction (the Convex adapter, WP46-E4c).
 *
 * Every command loads the working set of the idea it targets — the idea, its
 * revisions, review records, approvals and releases, plus the request key,
 * slug or submission it needs — runs the shared core, and commits only what
 * changed, together with the idea's list summary. Lists read summaries and
 * small indexes, never revision bodies. Nothing is loaded for a principal
 * the core will refuse.
 */

export type StoredSettings = { policyVersion: string; killSwitchEngaged: boolean };

export type ActivityPage = { entries: AuditRecord[]; nextCursor: string | null; total: number | null };

export interface WorkingSetStore {
  /** Run one repository call as a single transaction (Convex: the function itself). */
  transaction<T>(run: () => Promise<T>): Promise<T>;
  loadSettings(): Promise<StoredSettings>;
  ownerOfRevision(revisionId: string): Promise<string | null>;
  ownerOfRelease(releaseId: string): Promise<string | null>;
  /**
   * Load one idea's records into `state`, plus the header of the idea it
   * duplicates. `headerOnly` loads the idea record alone. False if unknown.
   */
  loadIdea(state: EditorialState, ideaId: string, options?: { headerOnly?: boolean }): Promise<boolean>;
  loadIdempotency(state: EditorialState, storeKey: string): Promise<void>;
  loadSlug(state: EditorialState, slug: string): Promise<void>;
  loadSubmission(state: EditorialState, submissionKey: string): Promise<void>;
  /** Every idea record and every release record, for the releases screen. */
  loadReleaseIndex(state: EditorialState): Promise<void>;
  loadTrashedIdeas(state: EditorialState): Promise<void>;
  listSummaries(): Promise<IdeaSummary[]>;
  /** Newest first. `null` when the cursor is not one the store issued. */
  pageActivity(filter: ActivityFilter, cursor: string | null, pageSize: number): Promise<ActivityPage | null>;
  ideaTitles(ideaIds: readonly string[]): Promise<Map<string, string>>;
  /** Write a transaction's changes and the summaries of the ideas they touched. */
  commit(changes: StateChanges, summaries: ReadonlyMap<string, IdeaSummary>): Promise<void>;
}

export type TransactionContext = {
  env: CoreEnvironment;
  clock: EditorialClock;
  ids: IdSource;
  /** Read at call time: a strong authentication can refresh it between calls. */
  principal: EditorialPrincipal | null;
  settings: LiveSettingsContext;
  /**
   * Resolves ingestion credentials presented to `importSubmission`. Absent in
   * the deployed app, where submissions only arrive through `importTrusted`.
   */
  ingestion?: {
    resolve(credential: IngestionCredential): IngestionPrincipal | null;
    authority: VerificationAuthority;
  };
};

type Scope =
  | { kind: "idea"; ideaId: string }
  | { kind: "revision"; revisionId: string }
  | { kind: "release"; releaseId: string };

type Plan = { scope: Scope; idempotency?: { scope: IdempotencyScope; key: string }; service?: boolean };

function affectedIdeas(changes: StateChanges): Set<string> {
  const ids = new Set<string>();
  for (const idea of [...changes.ideas.inserted, ...changes.ideas.updated]) ids.add(idea.id);
  const children = [
    changes.revisions,
    changes.attestations,
    changes.flags,
    changes.resolutions,
    changes.notes,
    changes.approvals,
    changes.releases,
  ];
  for (const group of children) {
    for (const record of [...group.inserted, ...group.updated]) ids.add(record.ideaId);
  }
  return ids;
}

function activityEntry(record: AuditRecord, titles: ReadonlyMap<string, string>): ActivityEntry {
  return {
    id: record.id,
    at: record.at,
    actor: principalView(record.actor),
    action: record.action,
    outcome: record.outcome,
    ideaId: record.ideaId,
    ideaTitle: record.ideaId ? (titles.get(record.ideaId) ?? null) : null,
    revisionNumber: record.revisionNumber,
    releaseId: record.releaseId,
    reason: record.reason,
    detail: record.detail,
    code: record.code,
    correlationId: record.correlationId,
  };
}

export class PartitionedEditorialRepository implements EditorialRepository {
  constructor(
    private readonly store: WorkingSetStore,
    private readonly context: TransactionContext,
  ) {}

  get mode(): "fixture" | "live" {
    return this.context.env.mode;
  }

  /* Plumbing --------------------------------------------------------------- */

  private async newState(): Promise<EditorialState> {
    const settings = await this.store.loadSettings();
    return createEditorialState({
      env: this.context.env,
      clock: this.context.clock,
      ids: this.context.ids,
      policyVersion: settings.policyVersion,
      killSwitchEngaged: settings.killSwitchEngaged,
    });
  }

  private core(state: EditorialState, principal: EditorialPrincipal | null = this.context.principal) {
    return new LiveEditorialCore(state, principal, this.context.settings);
  }

  private async resolve(scope: Scope): Promise<string | null> {
    if (scope.kind === "idea") return scope.ideaId;
    if (scope.kind === "revision") return this.store.ownerOfRevision(scope.revisionId);
    return this.store.ownerOfRelease(scope.releaseId);
  }

  /** Load what a plan needs into a fresh state. Unauthorised callers get nothing loaded. */
  private async load(plan: Plan): Promise<EditorialState> {
    const state = await this.newState();
    if (!plan.service && !isEditorialAdmin(this.context.principal)) return state;
    const ideaId = await this.resolve(plan.scope);
    if (ideaId) await this.store.loadIdea(state, ideaId);
    if (plan.idempotency) {
      await this.store.loadIdempotency(
        state,
        idempotencyStoreKey(this.context.principal, plan.idempotency.scope, plan.idempotency.key),
      );
    }
    return state;
  }

  private async commit(state: EditorialState, changes: StateChanges): Promise<void> {
    if (isEmptyChange(changes)) return;
    const summaries = new Map<string, IdeaSummary>();
    for (const ideaId of affectedIdeas(changes)) {
      const idea = state.ideas.get(ideaId);
      if (idea && state.revisions.has(idea.workingRevisionId)) summaries.set(ideaId, await summarizeIdea(state, idea));
    }
    await this.store.commit(changes, summaries);
  }

  /** A command: load, run, write back, all in one store transaction. */
  private command<T>(plan: Plan, run: (core: LiveEditorialCore, state: EditorialState) => Promise<T>): Promise<T> {
    return this.store.transaction(async () => {
      const state = await this.load(plan);
      const snapshot = snapshotState(state);
      const result = await run(this.core(state), state);
      await this.commit(state, collectChanges(state, snapshot));
      return result;
    });
  }

  /** A read over one idea: nothing is written, not even a denial. */
  private read<T>(plan: Plan, run: (core: LiveEditorialCore) => Promise<T>): Promise<T> {
    return this.store.transaction(async () => run(this.core(await this.load(plan))));
  }

  /** The core's own denial (code and message) for a caller without the capability. */
  private async denial(): Promise<{ ok: false; error: EditorialError } | null> {
    if (isEditorialAdmin(this.context.principal)) return null;
    const result = await this.core(await this.newState()).getSettings();
    return result.ok ? null : { ok: false, error: result.error };
  }

  /* Reads ------------------------------------------------------------------- */

  getQueueSummary(): Promise<CommandResult<QueueSummary>> {
    return this.store.transaction(async () => {
      const denied = await this.denial();
      if (denied) return denied;
      const summaries = await this.store.listSummaries();
      const now = this.context.clock.now();
      const buckets: Record<QueueBucket, number> = {
        new: 0,
        awaiting_review: 0,
        needs_research: 0,
        changes_requested: 0,
        rejected: 0,
      };
      let blockedByEvidence = 0;
      let releasesNeedingAttention = 0;
      for (const summary of summaries) {
        const pending = summary.item.pendingOperation;
        if (pending && (pending.state === "failed" || pending.state === "needs_reconciliation")) {
          releasesNeedingAttention += 1;
        }
        if (summary.item.lifecycle !== "active") continue;
        const item = listItemFromSummary(summary, now);
        const bucket = queueBucketFor(item);
        if (!bucket) continue;
        buckets[bucket] += 1;
        if (item.blockers.evidence > 0) blockedByEvidence += 1;
      }
      return ok({
        needReview: buckets.new + buckets.awaiting_review + buckets.changes_requested,
        blockedByEvidence,
        releasesNeedingAttention,
        buckets,
      });
    });
  }

  listIdeas(filter: IdeaFilter, cursor: string | null, pageSize: number): Promise<CommandResult<Page<IdeaListItem>>> {
    return this.store.transaction(async () => {
      const denied = await this.denial();
      if (denied) return denied;
      const parsed = ideaFilterSchema.safeParse(filter);
      if (!parsed.success || !cursorSchema.safeParse(cursor).success || !pageSizeSchema.safeParse(pageSize).success) {
        return fail<Page<IdeaListItem>>("INVALID_INPUT", "Those filters are not valid.");
      }
      const summaries = await this.store.listSummaries();
      const titles = new Map(summaries.map((summary) => [summary.item.id, summary.item.title]));
      const now = this.context.clock.now();
      const items = summaries
        .map((summary) => listItemFromSummary(summary, now, titles))
        .filter((item) => ideaMatchesFilter(item, parsed.data));
      return pageIdeaItems(items, parsed.data, cursor, pageSize);
    });
  }

  getIdea(ideaId: string): Promise<CommandResult<IdeaDetail>> {
    return this.read({ scope: { kind: "idea", ideaId } }, (core) => core.getIdea(ideaId));
  }

  getRevision(ideaId: string, revisionId: string): Promise<CommandResult<RevisionView>> {
    return this.read({ scope: { kind: "idea", ideaId } }, (core) => core.getRevision(ideaId, revisionId));
  }

  listReleases(filter: ReleaseFilter, cursor: string | null, pageSize: number): Promise<CommandResult<Page<ReleaseView>>> {
    return this.store.transaction(async () => {
      const denied = await this.denial();
      if (denied) return denied;
      const state = await this.newState();
      await this.store.loadReleaseIndex(state);
      return this.core(state).listReleases(filter, cursor, pageSize);
    });
  }

  listTrash(cursor: string | null, pageSize: number): Promise<CommandResult<Page<TrashItem>>> {
    return this.store.transaction(async () => {
      const denied = await this.denial();
      if (denied) return denied;
      const state = await this.newState();
      await this.store.loadTrashedIdeas(state);
      return this.core(state).listTrash(cursor, pageSize);
    });
  }

  listActivity(
    filter: ActivityFilter,
    cursor: string | null,
    pageSize: number,
  ): Promise<CommandResult<Page<ActivityEntry, number | null>>> {
    return this.store.transaction(async () => {
      const denied = await this.denial();
      if (denied) return denied;
      const parsed = activityFilterSchema.safeParse(filter);
      if (!parsed.success || !cursorSchema.safeParse(cursor).success || !pageSizeSchema.safeParse(pageSize).success) {
        return fail<Page<ActivityEntry, number | null>>("INVALID_INPUT", "Those filters are not valid.");
      }
      const page = await this.store.pageActivity(parsed.data, cursor, pageSize);
      if (!page) return fail<Page<ActivityEntry, number | null>>("INVALID_INPUT", "That page link is no longer valid.");
      const ideaIds = [...new Set(page.entries.map((entry) => entry.ideaId).filter((id): id is string => id !== null))];
      const titles = await this.store.ideaTitles(ideaIds);
      return ok({
        items: page.entries.map((entry) => activityEntry(entry, titles)),
        nextCursor: page.nextCursor,
        total: page.total,
      });
    });
  }

  getSettings(): Promise<CommandResult<SettingsView>> {
    return this.store.transaction(async () => this.core(await this.newState()).getSettings());
  }

  /* Ingestion ---------------------------------------------------------------- */

  importSubmission(envelope: unknown, credential: IngestionCredential): Promise<CommandResult<ImportAck>> {
    const ingestion = this.context.ingestion;
    const principal = ingestion && credential && typeof credential.token === "string" ? ingestion.resolve(credential) : null;
    return this.importTrusted(principal, envelope, principal && ingestion ? ingestion.authority : "none");
  }

  /** For trusted backend callers that authenticated the producer and established the authority. */
  importTrusted(
    ingestion: IngestionPrincipal | null,
    envelope: unknown,
    authority: VerificationAuthority,
  ): Promise<CommandResult<ImportAck>> {
    return this.store.transaction(async () => {
      const state = await this.newState();
      const parsed = ingestion ? parseEditorialSubmission(envelope) : null;
      if (parsed?.ok) {
        const submission = parsed.submission;
        const submissionKey = `${submission.producer}:${submission.submissionId}`;
        await this.store.loadSubmission(state, submissionKey);
        await this.store.loadSlug(state, submission.proposedSlug);
        const existing = state.submissions.get(submissionKey);
        if (existing) await this.store.loadIdea(state, existing.ideaId);
        const owner = state.slugs.get(submission.proposedSlug);
        if (owner && owner !== existing?.ideaId) await this.store.loadIdea(state, owner, { headerOnly: true });
      }
      const snapshot = snapshotState(state);
      const result = await this.core(state, null).importTrusted(ingestion, envelope, authority);
      await this.commit(state, collectChanges(state, snapshot));
      return result;
    });
  }

  /* Revisions ----------------------------------------------------------------- */

  createRevision(ideaId: string, fromRevisionId: string, idempotencyKey: string) {
    return this.command(
      { scope: { kind: "idea", ideaId }, idempotency: { scope: IDEMPOTENCY_SCOPES.createRevision, key: idempotencyKey } },
      (core) => core.createRevision(ideaId, fromRevisionId, idempotencyKey),
    );
  }

  discardRevision(ideaId: string, revisionId: string, expectedVersion: number, reason: string) {
    return this.command({ scope: { kind: "idea", ideaId } }, (core) =>
      core.discardRevision(ideaId, revisionId, expectedVersion, reason),
    );
  }

  saveDraft(
    ideaId: string,
    revisionId: string,
    baseVersion: number,
    patch: SaveDraftPatch,
    idempotencyKey: string,
  ): Promise<CommandResult<SaveDraftAck>> {
    return this.command(
      { scope: { kind: "idea", ideaId }, idempotency: { scope: IDEMPOTENCY_SCOPES.saveDraft, key: idempotencyKey } },
      (core) => core.saveDraft(ideaId, revisionId, baseVersion, patch, idempotencyKey),
    );
  }

  /* Candidate decision ----------------------------------------------------------- */

  setCandidateDecision(ideaId: string, expectedVersion: number, input: CandidateDecisionInput) {
    return this.command({ scope: { kind: "idea", ideaId } }, (core) =>
      core.setCandidateDecision(ideaId, expectedVersion, input),
    );
  }

  /* Review --------------------------------------------------------------------- */

  markReviewed(revisionId: string, reviewItemId: string, dependencyHash: string, note: string | null): Promise<CommandResult<ReviewAck>> {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) =>
      core.markReviewed(revisionId, reviewItemId, dependencyHash, note),
    );
  }

  retractReview(revisionId: string, reviewItemId: string): Promise<CommandResult<ReviewAck>> {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) => core.retractReview(revisionId, reviewItemId));
  }

  flagReviewItem(revisionId: string, reviewItemId: string, dependencyHash: string, input: FlagInput): Promise<CommandResult<ReviewAck>> {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) =>
      core.flagReviewItem(revisionId, reviewItemId, dependencyHash, input),
    );
  }

  resolveIssue(revisionId: string, issueId: string, dependencyHash: string, note: string) {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) =>
      core.resolveIssue(revisionId, issueId, dependencyHash, note),
    );
  }

  addNote(revisionId: string, target: EditorialTarget, note: string) {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) => core.addNote(revisionId, target, note));
  }

  requestChanges(revisionId: string, note: string): Promise<CommandResult<ReviewAck>> {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) => core.requestChanges(revisionId, note));
  }

  resumeReview(revisionId: string): Promise<CommandResult<ReviewAck>> {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) => core.resumeReview(revisionId));
  }

  runChecks(revisionId: string, expectedArtifactHash: string) {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) => core.runChecks(revisionId, expectedArtifactHash));
  }

  approveRevision(revisionId: string, artifactHash: string, input: ApprovalInput) {
    return this.command({ scope: { kind: "revision", revisionId } }, (core) =>
      core.approveRevision(revisionId, artifactHash, input),
    );
  }

  /* Releases and lifecycle -------------------------------------------------------- */

  prepareRelease(revisionId: string, expectedLiveReleaseId: string | null, idempotencyKey: string) {
    return this.command(
      { scope: { kind: "revision", revisionId }, idempotency: { scope: IDEMPOTENCY_SCOPES.prepareRelease, key: idempotencyKey } },
      (core) => core.prepareRelease(revisionId, expectedLiveReleaseId, idempotencyKey),
    );
  }

  publishRelease(releaseId: string, expectedState: ReleaseState, approvalId: string, idempotencyKey: string) {
    return this.command(
      { scope: { kind: "release", releaseId }, idempotency: { scope: IDEMPOTENCY_SCOPES.publishRelease, key: idempotencyKey } },
      (core) => core.publishRelease(releaseId, expectedState, approvalId, idempotencyKey),
    );
  }

  cancelRelease(releaseId: string, expectedState: ReleaseState, reason: string) {
    return this.command({ scope: { kind: "release", releaseId } }, (core) => core.cancelRelease(releaseId, expectedState, reason));
  }

  retryRelease(releaseId: string, expectedState: ReleaseState, idempotencyKey: string) {
    return this.command(
      { scope: { kind: "release", releaseId }, idempotency: { scope: IDEMPOTENCY_SCOPES.retryRelease, key: idempotencyKey } },
      (core) => core.retryRelease(releaseId, expectedState, idempotencyKey),
    );
  }

  reconcileRelease(releaseId: string) {
    return this.command({ scope: { kind: "release", releaseId } }, (core) => core.reconcileRelease(releaseId));
  }

  requestRollback(ideaId: string, targetReleaseId: string, expectedLiveReleaseId: string, reason: string, idempotencyKey: string) {
    return this.command(
      { scope: { kind: "idea", ideaId }, idempotency: { scope: IDEMPOTENCY_SCOPES.requestRollback, key: idempotencyKey } },
      (core) => core.requestRollback(ideaId, targetReleaseId, expectedLiveReleaseId, reason, idempotencyKey),
    );
  }

  unpublishIdea(ideaId: string, expectedLiveReleaseId: string, reason: string, idempotencyKey: string) {
    return this.command(
      { scope: { kind: "idea", ideaId }, idempotency: { scope: IDEMPOTENCY_SCOPES.unpublishIdea, key: idempotencyKey } },
      (core) => core.unpublishIdea(ideaId, expectedLiveReleaseId, reason, idempotencyKey),
    );
  }

  trashIdea(ideaId: string, expectedVersion: number, reason: string) {
    return this.command({ scope: { kind: "idea", ideaId } }, (core) => core.trashIdea(ideaId, expectedVersion, reason));
  }

  restoreIdea(ideaId: string, expectedVersion: number, reason: string) {
    return this.command({ scope: { kind: "idea", ideaId } }, (core) => core.restoreIdea(ideaId, expectedVersion, reason));
  }

  /* Service seams (trusted backend callers only) ------------------------------------ */

  /** One release-worker step for one release, with the outcome the worker observed. */
  workerAdvance(releaseId: string, report: WorkerReport): Promise<{ moved: boolean }> {
    return this.command({ scope: { kind: "release", releaseId }, service: true }, async (_core, state) => {
      const release = state.releases.get(releaseId);
      return { moved: release ? await workerStep(state, release, report) : false };
    });
  }

  /** Operator kill switch: blocks new activations; unpublish and recovery still work. */
  setKillSwitch(engaged: boolean, actor: ActorRef, reason: string): Promise<{ engaged: boolean }> {
    return this.store.transaction(async () => {
      const state = await this.newState();
      const snapshot = snapshotState(state);
      if (state.killSwitchEngaged !== engaged) {
        state.killSwitchEngaged = engaged;
        appendAudit(state, {
          actor,
          action: "settings.changed",
          outcome: "succeeded",
          ideaId: null,
          revisionId: null,
          releaseId: null,
          reason,
          detail: engaged ? "Publishing kill switch engaged" : "Publishing kill switch released",
          code: null,
        });
      }
      await this.commit(state, collectChanges(state, snapshot));
      return { engaged };
    });
  }
}
