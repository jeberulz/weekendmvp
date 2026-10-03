import {
  activityFilterSchema,
  approvalInputSchema,
  candidateDecisionSchema,
  commandIdSchemas,
  cursorSchema,
  draftCarrySchema,
  flagInputSchema,
  ideaFilterSchema,
  noteSchema,
  noteTargetSchema,
  pageSizeSchema,
  reasonSchema,
  releaseFilterSchema,
  saveDraftPatchSchema,
  type ActivityFilter,
  type ApprovalInput,
  type CandidateDecisionInput,
  type DraftCarry,
  type FlagInput,
  type IdeaFilter,
  type ImportAck,
  type ReleaseFilter,
  type ReviewAck,
  type SaveDraftAck,
  type SaveDraftPatch,
} from "../contracts/commands";
import { fail, ok, type CommandResult, type EditorialTarget } from "../contracts/errors";
import { qualityCheckInputSchema, type QualityCheck } from "../contracts/checks";
import type { EditorialClaim, EditorialSource, VerificationAuthority } from "../contracts/evidence";
import {
  hasFreshStrongAuth,
  isEditorialAdmin,
  type EditorialPrincipal,
  type HumanPrincipal,
  type IngestionCredential,
  type IngestionPrincipal,
} from "../contracts/principal";
import { EDITORIAL_LIMITS } from "../contracts/limits";
import { editorialIdSchema } from "../contracts/primitives";
import type { EditorialRepository } from "../contracts/repository";
import {
  APPROVABLE_CANDIDATE_STATES,
  CANDIDATE_LABELS,
  REJECT_REASON_LABELS,
  canTransitionCandidate,
  canTrash,
  type ReleaseState,
} from "../contracts/states";
import { parseEditorialSubmission } from "../contracts/submission";
import type {
  ActivityAction,
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
import { computeRevisionHashes } from "../domain/artifact";
import { findExecutableMarkup } from "../domain/executable-markup";
import { hashCanonical, sha256Hex, type Canonicalizable } from "../domain/hash";
import {
  activeApprovalForIdea,
  approvalView,
  deriveListItem,
  deriveRevision,
  latestApprovalFor,
  pendingReleaseFor,
  principalView,
  releaseView,
} from "./derive";
import {
  compareStrings,
  ideaMatchesFilter,
  pageIdeaItems,
  paginate,
  queueBucketFor,
  releaseGroupOf,
} from "./listing";
import {
  approvalValidity,
  completeActivation,
  inFlightReleaseFor,
  revokeApproval,
  revokeIdeaApprovals,
  transitionRelease,
} from "./rules";
import {
  actorRef,
  appendAudit,
  nextId,
  nowIso,
  simulatedSuffix,
  touch,
  type ActorRef,
  type EditorialState,
  type IdeaRecord,
  type ReleaseRecord,
  type RevisionRecord,
} from "./state";

type Denied = { ok: false; error: { code: "UNAUTHENTICATED" | "FORBIDDEN" | "SERVICE_NOT_PERMITTED"; message: string } };

const GENERIC_DENIAL = "You do not have access to the editorial workspace.";

/**
 * One idea's revisions are loaded together in one transaction, so their stored
 * size is capped well below a transaction's read limit. New revisions are
 * refused past it; the working draft may still grow by one document.
 */
const REVISION_BYTES_PER_IDEA = 8 * 1024 * 1024;
const byteEncoder = new TextEncoder();

function storedBytes(record: RevisionRecord): number {
  return byteEncoder.encode(JSON.stringify(record)).length;
}

/** A caller-supplied id worth keeping on a refusal record: well-formed and bounded, or nothing. */
function recordableId(value: string | null | undefined): string | null {
  return typeof value === "string" && editorialIdSchema.safeParse(value).success ? value : null;
}

/** Request-key scopes. A key is unique per principal and scope. */
export const IDEMPOTENCY_SCOPES = {
  createRevision: "create-revision",
  saveDraft: "save",
  prepareRelease: "prepare",
  publishRelease: "publish",
  retryRelease: "retry",
  requestRollback: "rollback",
  unpublishIdea: "unpublish",
} as const;

export type IdempotencyScope = (typeof IDEMPOTENCY_SCOPES)[keyof typeof IDEMPOTENCY_SCOPES];

/** Where a request key's first result is kept. */
export function idempotencyStoreKey(
  principal: EditorialPrincipal | null,
  scope: IdempotencyScope,
  key: string,
): string {
  return `${principal?.id ?? "anonymous"}:${scope}:${key}`;
}

/* ------------------------------------------------------------------ */
/* Repository                                                          */
/* ------------------------------------------------------------------ */

/**
 * The editorial rules, shared by every adapter. A subclass supplies the
 * principal's ingestion credential check, the settings description and any
 * environment hooks; the state it passes in decides the environment (clock,
 * ids, check policy, release capability).
 */
export abstract class EditorialCore implements EditorialRepository {
  constructor(
    protected readonly state: EditorialState,
    protected readonly principal: EditorialPrincipal | null,
  ) {}

  get mode(): "fixture" | "live" {
    return this.state.env.mode;
  }

  /** Map an ingestion credential to its producer (`null`: unknown credential). */
  protected abstract resolveIngestion(credential: IngestionCredential): IngestionPrincipal | null;

  /** Verification authority this environment grants a non-legacy submission. */
  protected abstract submissionAuthority(ingestion: IngestionPrincipal): VerificationAuthority;

  /** What Settings shows for this environment. */
  protected abstract describeSettings(editor: HumanPrincipal): SettingsView;

  /** Runs just before a draft save is checked (the local demo's two-tab simulation). */
  protected beforeSave(idea: IdeaRecord, revision: RevisionRecord): void {
    void idea;
    void revision;
  }

  /* Guards ------------------------------------------------------------ */

  protected actor(): ActorRef {
    return actorRef(this.principal, this.state.env);
  }

  /** Release intents need a worker to carry them out; refuse when none exists. */
  private releasesUnavailable(): CommandResult<never> | null {
    const capability = this.state.env.releases;
    return capability.available ? null : fail("PRECONDITION_FAILED", capability.reason);
  }

  private deny(action: ActivityAction, target: { ideaId?: string | null; revisionId?: string | null } = {}): Denied {
    const code =
      this.principal === null
        ? "UNAUTHENTICATED"
        : this.principal.kind === "service"
          ? "SERVICE_NOT_PERMITTED"
          : "FORBIDDEN";
    appendAudit(this.state, {
      actor: this.actor(),
      action: "access.denied",
      outcome: "denied",
      // Refusals are recorded before any input is validated, so caller-supplied
      // ids are kept only when well-formed (an outsider cannot store large strings).
      ideaId: recordableId(target.ideaId),
      revisionId: recordableId(target.revisionId),
      releaseId: null,
      reason: null,
      detail: `Attempted ${action}`,
      code,
    });
    touch(this.state);
    return {
      ok: false,
      error: {
        code,
        message:
          code === "SERVICE_NOT_PERMITTED"
            ? "Service credentials cannot make editorial decisions."
            : GENERIC_DENIAL,
      },
    };
  }

  /** Every read and human command starts here. */
  private editor(
    action: ActivityAction,
    target: { ideaId?: string | null; revisionId?: string | null } = {},
  ): { ok: true; editor: HumanPrincipal } | Denied {
    if (isEditorialAdmin(this.principal)) return { ok: true, editor: this.principal };
    return this.deny(action, target);
  }

  private record(
    action: ActivityAction,
    outcome: "succeeded" | "denied" | "failed",
    fields: {
      ideaId?: string | null;
      revisionId?: string | null;
      releaseId?: string | null;
      reason?: string | null;
      detail?: string | null;
      code?: string | null;
    },
  ): void {
    appendAudit(this.state, {
      actor: this.actor(),
      action,
      outcome,
      ideaId: fields.ideaId ?? null,
      revisionId: fields.revisionId ?? null,
      releaseId: fields.releaseId ?? null,
      reason: fields.reason ?? null,
      detail: fields.detail ?? null,
      code: fields.code ?? null,
    });
    touch(this.state);
  }

  /** Refuse, and keep a record of the refusal that survives the refusal. */
  private refuse<T>(
    action: ActivityAction,
    result: CommandResult<T>,
    fields: { ideaId?: string | null; revisionId?: string | null; releaseId?: string | null } = {},
  ): CommandResult<T> {
    if (!result.ok) this.record(action, "failed", { ...fields, code: result.error.code, detail: result.error.message });
    return result;
  }

  protected async idempotent<T>(
    scope: IdempotencyScope,
    key: string,
    request: Canonicalizable,
    run: () => Promise<CommandResult<T>>,
  ): Promise<CommandResult<T>> {
    const storeKey = idempotencyStoreKey(this.principal, scope, key);
    const requestHash = await hashCanonical(request);
    const existing = this.state.idempotency.get(storeKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return fail("IDEMPOTENCY_KEY_REUSED", "That request key was already used for a different change.");
      }
      return existing.result as CommandResult<T>;
    }
    const result = await run();
    if (result.ok) this.state.idempotency.set(storeKey, { requestHash, result });
    return result;
  }

  private idea(ideaId: string): IdeaRecord | null {
    if (!commandIdSchemas.id.safeParse(ideaId).success) return null;
    return this.state.ideas.get(ideaId) ?? null;
  }

  private revision(revisionId: string): RevisionRecord | null {
    if (!commandIdSchemas.id.safeParse(revisionId).success) return null;
    return this.state.revisions.get(revisionId) ?? null;
  }

  protected needsStrongAuth(editor: HumanPrincipal): CommandResult<never> | null {
    if (hasFreshStrongAuth(editor, this.state.clock.now())) return null;
    return fail("REAUTH_REQUIRED", "Confirm it's you before this action. Recent strong authentication is required.");
  }

  private stamp(idea: IdeaRecord): void {
    idea.updatedAt = nowIso(this.state);
    touch(this.state);
  }

  /* Reads ------------------------------------------------------------- */

  async getQueueSummary(): Promise<CommandResult<QueueSummary>> {
    const guard = this.editor("access.denied");
    if (!guard.ok) return guard;
    const buckets: Record<QueueBucket, number> = {
      new: 0,
      awaiting_review: 0,
      needs_research: 0,
      changes_requested: 0,
      rejected: 0,
    };
    let blockedByEvidence = 0;
    for (const idea of this.state.ideas.values()) {
      if (idea.lifecycle !== "active") continue;
      const item = await deriveListItem(this.state, idea);
      const bucket = queueBucketFor(item);
      if (!bucket) continue;
      buckets[bucket] += 1;
      // Counts exactly what the queue lists under the "Evidence blockers" filter.
      if (item.blockers.evidence > 0) blockedByEvidence += 1;
    }
    let releasesNeedingAttention = 0;
    for (const idea of this.state.ideas.values()) {
      const pending = pendingReleaseFor(this.state, idea.id);
      if (pending && (pending.state === "failed" || pending.state === "needs_reconciliation")) {
        releasesNeedingAttention += 1;
      }
    }
    return ok({
      needReview: buckets.new + buckets.awaiting_review + buckets.changes_requested,
      blockedByEvidence,
      releasesNeedingAttention,
      buckets,
    });
  }

  async listIdeas(filter: IdeaFilter, cursor: string | null, pageSize: number): Promise<CommandResult<Page<IdeaListItem>>> {
    const guard = this.editor("access.denied");
    if (!guard.ok) return guard;
    const parsed = ideaFilterSchema.safeParse(filter);
    if (!parsed.success || !cursorSchema.safeParse(cursor).success || !pageSizeSchema.safeParse(pageSize).success) {
      return fail("INVALID_INPUT", "Those filters are not valid.");
    }
    const items: IdeaListItem[] = [];
    for (const idea of this.state.ideas.values()) {
      if (idea.lifecycle !== "active") continue;
      const item = await deriveListItem(this.state, idea);
      if (ideaMatchesFilter(item, parsed.data)) items.push(item);
    }
    return pageIdeaItems(items, parsed.data, cursor, pageSize);
  }

  async getIdea(ideaId: string): Promise<CommandResult<IdeaDetail>> {
    const guard = this.editor("access.denied", { ideaId });
    if (!guard.ok) return guard;
    const idea = this.idea(ideaId);
    if (!idea) return fail("NOT_FOUND", "That idea does not exist.");
    const item = await deriveListItem(this.state, idea);
    const liveId = item.liveRevision?.id ?? null;
    const revisions = [...this.state.revisions.values()]
      .filter((revision) => revision.ideaId === idea.id)
      .sort((a, b) => b.number - a.number);
    const summaries = [];
    for (const revision of revisions) {
      const hashes = await computeRevisionHashes(revision);
      const approval = latestApprovalFor(this.state, revision.id);
      summaries.push({
        id: revision.id,
        ideaId: revision.ideaId,
        number: revision.number,
        kind: revision.kind,
        reviewState: revision.reviewState,
        origin: revision.origin,
        parentRevisionId: revision.parentRevisionId,
        createdAt: revision.createdAt,
        createdBy: principalView(revision.createdBy),
        updatedAt: revision.updatedAt,
        version: revision.version,
        artifactHash: hashes.artifact,
        isLive: liveId === revision.id,
        isWorking: idea.workingRevisionId === revision.id,
        discarded: revision.discarded,
        approval: approval ? approvalView(approval) : null,
      });
    }
    const releases = [...this.state.releases.values()]
      .filter((release) => release.ideaId === idea.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((release) => releaseView(this.state, release));
    const active = activeApprovalForIdea(this.state, idea.id);
    return ok({
      idea: item,
      revisions: summaries,
      releases,
      activeApproval: active ? approvalView(active) : null,
      generation: idea.generation,
      legacy: idea.legacy,
      trash: idea.trash
        ? { trashedAt: idea.trash.trashedAt, reason: idea.trash.reason, trashedBy: principalView(idea.trash.trashedBy) }
        : null,
      unpublish:
        idea.publication.unpublishedAt && idea.publication.unpublishReason
          ? { at: idea.publication.unpublishedAt, reason: idea.publication.unpublishReason }
          : null,
    });
  }

  async getRevision(ideaId: string, revisionId: string): Promise<CommandResult<RevisionView>> {
    const guard = this.editor("access.denied", { ideaId, revisionId });
    if (!guard.ok) return guard;
    const idea = this.idea(ideaId);
    const revision = this.revision(revisionId);
    if (!idea || !revision || revision.ideaId !== idea.id) return fail("NOT_FOUND", "That revision does not exist.");
    return ok((await deriveRevision(this.state, revision.id)).view);
  }

  async listReleases(filter: ReleaseFilter, cursor: string | null, pageSize: number): Promise<CommandResult<Page<ReleaseView>>> {
    const guard = this.editor("access.denied");
    if (!guard.ok) return guard;
    const parsed = releaseFilterSchema.safeParse(filter);
    if (!parsed.success || !cursorSchema.safeParse(cursor).success || !pageSizeSchema.safeParse(pageSize).success) {
      return fail("INVALID_INPUT", "Those filters are not valid.");
    }
    const releases = [...this.state.releases.values()]
      .filter((release) => {
        if (parsed.data.ideaId && release.ideaId !== parsed.data.ideaId) return false;
        if (parsed.data.group === "all") return true;
        if (release.operation === "legacy_baseline") return parsed.data.group === "completed";
        if (parsed.data.group === "attention") {
          // A failed attempt only needs attention while it is the latest one.
          return pendingReleaseFor(this.state, release.ideaId)?.id === release.id && releaseGroupOf(release.state) === "attention";
        }
        return releaseGroupOf(release.state) === parsed.data.group;
      })
      .map((release) => releaseView(this.state, release));
    const keyOf = (release: ReleaseView) => [release.updatedAt, release.id];
    const compare = (a: string[], b: string[]) => -compareStrings(a[0], b[0]) || compareStrings(a[1], b[1]);
    releases.sort((a, b) => compare(keyOf(a), keyOf(b)));
    return paginate(releases, keyOf, compare, cursor, pageSize);
  }

  async listTrash(cursor: string | null, pageSize: number): Promise<CommandResult<Page<TrashItem>>> {
    const guard = this.editor("access.denied");
    if (!guard.ok) return guard;
    if (!cursorSchema.safeParse(cursor).success || !pageSizeSchema.safeParse(pageSize).success) {
      return fail("INVALID_INPUT", "That page link is not valid.");
    }
    const items: TrashItem[] = [];
    for (const idea of this.state.ideas.values()) {
      if (idea.lifecycle !== "trashed" || !idea.trash) continue;
      items.push({
        ideaId: idea.id,
        title: idea.title,
        slug: idea.slug,
        trashedAt: idea.trash.trashedAt,
        trashedBy: principalView(idea.trash.trashedBy),
        reason: idea.trash.reason,
        previousPublication: idea.trash.previousPublication,
        previousCandidate: idea.trash.previousCandidate,
        version: idea.version,
      });
    }
    const keyOf = (item: TrashItem) => [item.trashedAt, item.ideaId];
    const compare = (a: string[], b: string[]) => -compareStrings(a[0], b[0]) || compareStrings(a[1], b[1]);
    items.sort((a, b) => compare(keyOf(a), keyOf(b)));
    return paginate(items, keyOf, compare, cursor, pageSize);
  }

  async listActivity(
    filter: ActivityFilter,
    cursor: string | null,
    pageSize: number,
  ): Promise<CommandResult<Page<ActivityEntry, number | null>>> {
    const guard = this.editor("access.denied");
    if (!guard.ok) return guard;
    const parsed = activityFilterSchema.safeParse(filter);
    if (!parsed.success || !cursorSchema.safeParse(cursor).success || !pageSizeSchema.safeParse(pageSize).success) {
      return fail("INVALID_INPUT", "Those filters are not valid.");
    }
    const entries: ActivityEntry[] = this.state.audit
      .filter((entry) => (parsed.data.ideaId ? entry.ideaId === parsed.data.ideaId : true))
      .filter((entry) => (parsed.data.outcome ? entry.outcome === parsed.data.outcome : true))
      .map((entry) => {
        const idea = entry.ideaId ? this.state.ideas.get(entry.ideaId) : undefined;
        return {
          id: entry.id,
          at: entry.at,
          actor: principalView(entry.actor),
          action: entry.action,
          outcome: entry.outcome,
          ideaId: entry.ideaId,
          ideaTitle: idea?.title ?? null,
          revisionNumber: entry.revisionNumber,
          releaseId: entry.releaseId,
          reason: entry.reason,
          detail: entry.detail,
          code: entry.code,
          correlationId: entry.correlationId,
        };
      });
    // Audit ids are monotonic, so they order entries even within one millisecond.
    const keyOf = (entry: ActivityEntry) => [entry.id];
    const compare = (a: string[], b: string[]) => -compareStrings(a[0], b[0]);
    entries.sort((a, b) => compare(keyOf(a), keyOf(b)));
    return paginate(entries, keyOf, compare, cursor, pageSize);
  }

  async getSettings(): Promise<CommandResult<SettingsView>> {
    const guard = this.editor("access.denied");
    if (!guard.ok) return guard;
    return ok(this.describeSettings(guard.editor));
  }

  /* Ingestion --------------------------------------------------------- */

  async importSubmission(envelope: unknown, credential: IngestionCredential): Promise<CommandResult<ImportAck>> {
    const ingestion = credential && typeof credential.token === "string" ? this.resolveIngestion(credential) : null;
    return this.importAs(ingestion, envelope, ingestion ? this.submissionAuthority(ingestion) : "none");
  }

  /**
   * The receiver. Producer, mode, artifact hash, idempotency, slug ownership
   * and verification authority are all established here; an import never
   * creates a decision, review or approval. `authority` is what the trusted
   * caller established for a non-legacy submission (a validated receipt in
   * live mode); legacy imports are always unverified.
   */
  protected async importAs(
    ingestion: IngestionPrincipal | null,
    envelope: unknown,
    authority: VerificationAuthority,
  ): Promise<CommandResult<ImportAck>> {
    const serviceActor = actorRef(ingestion, this.state.env);
    const reject = (result: CommandResult<ImportAck>): CommandResult<ImportAck> => {
      if (!result.ok) {
        appendAudit(this.state, {
          actor: serviceActor,
          action: "submission.rejected",
          outcome: "denied",
          ideaId: null,
          revisionId: null,
          releaseId: null,
          reason: null,
          detail: result.error.message,
          code: result.error.code,
        });
        touch(this.state);
      }
      return result;
    };

    if (!ingestion) return reject(fail("UNAUTHENTICATED", "Unknown ingestion credential."));
    const parsed = parseEditorialSubmission(envelope);
    if (!parsed.ok) {
      return reject(fail("INVALID_SUBMISSION", "The submission failed validation.", { issues: parsed.issues }));
    }
    const submission = parsed.submission;
    if (submission.producer !== ingestion.producer) {
      return reject(fail("PRODUCER_MISMATCH", "The submission's producer does not match its credential."));
    }
    const expectedMode = submission.producer === "legacy-import" ? "legacy" : this.state.env.mode;
    if (submission.mode !== expectedMode) {
      return reject(
        fail(
          "MODE_REJECTED",
          this.state.env.mode === "fixture"
            ? "This workspace only accepts fixture submissions in local demo mode."
            : "This workspace does not accept fixture or demo submissions.",
        ),
      );
    }

    const hashes = await computeRevisionHashes({
      title: submission.title,
      markdown: submission.markdown,
      metadata: submission.metadata,
      sources: submission.sources,
      claims: submission.claims,
    });
    if (hashes.artifact !== submission.artifactHash) {
      return reject(fail("ARTIFACT_HASH_MISMATCH", "The artifact hash does not match the submitted content."));
    }

    const submissionKey = `${submission.producer}:${submission.submissionId}`;
    const existing = this.state.submissions.get(submissionKey);
    if (existing) {
      if (existing.artifactHash !== hashes.artifact) {
        return reject(fail("SUBMISSION_ID_REUSED", "That submission id was already used for different content."));
      }
      return ok({
        ideaId: existing.ideaId,
        revisionId: existing.revisionId,
        duplicate: true,
        quarantined: this.state.revisions.get(existing.revisionId)?.quarantine !== null,
        slugConflict: this.state.ideas.get(existing.ideaId)?.slugConflict ?? false,
      });
    }

    const legacy = submission.producer === "legacy-import";
    const now = nowIso(this.state);
    const ideaId = nextId(this.state, "idea");
    const revisionId = nextId(this.state, "rev");
    const owner = this.state.slugs.get(submission.proposedSlug) ?? null;
    const slugConflict = owner !== null;
    if (!slugConflict) this.state.slugs.set(submission.proposedSlug, ideaId);

    // Verification authority is established here, never read from the envelope.
    // Without an authority the envelope's verification results are not trusted.
    const established: VerificationAuthority = legacy ? "none" : authority;
    const untrusted = established === "none";
    const unverifiedReason = legacy ? "Legacy evidence not reverified" : "Verification not established by a trusted receipt";
    const sources: EditorialSource[] = [];
    for (const source of submission.sources) {
      sources.push({
        ...source,
        verification: untrusted ? { status: "unverified", reason: unverifiedReason, checkedAt: null } : source.verification,
        excerptHash: source.excerpt === null ? null : await sha256Hex(source.excerpt),
        verificationAuthority: established,
      });
    }
    const claims: EditorialClaim[] = submission.claims.map((claim) => ({
      ...claim,
      verification:
        untrusted && claim.kind !== "assumed" ? { status: "unverified", reason: unverifiedReason } : claim.verification,
      verificationAuthority: established,
    }));
    // Checks travel with their authority: none means they are dropped, never trusted.
    const submittedChecks = untrusted
      ? []
      : submission.checks.filter((check) => check.policyVersion === this.state.policyVersion).map((check) => ({
          ...check,
          producer: established === "engine_receipt" ? ("engine" as const) : ("fixture_simulated" as const),
        }));
    const unsafe = legacy ? findExecutableMarkup(submission.markdown) : [];

    const revision: RevisionRecord = {
      id: revisionId,
      ideaId,
      number: 1,
      kind: legacy ? "legacy_snapshot" : "submitted",
      origin: legacy ? "legacy" : submission.producer === "engine" ? "engine" : "manual",
      parentRevisionId: null,
      createdAt: now,
      createdBy: serviceActor,
      updatedAt: now,
      updatedBy: serviceActor,
      version: 1,
      title: submission.title,
      markdown: submission.markdown,
      metadata: submission.metadata,
      sources,
      claims,
      // Legacy pages carry no checks: old audit flags are never approval.
      checks: submittedChecks,
      checksRunAt: submittedChecks.length === 0 ? null : now,
      reviewState: "draft",
      changesRequestedNote: null,
      quarantine:
        unsafe.length > 0
          ? { reasons: unsafe.slice(0, 5).map((finding) => `Line ${finding.line}: ${finding.reason}`) }
          : null,
      discarded: false,
      submissionKey,
    };

    const idea: IdeaRecord = {
      id: ideaId,
      slug: submission.proposedSlug,
      slugConflict,
      duplicateOfIdeaId: owner,
      title: submission.title,
      buyer: submission.buyer,
      job: submission.job,
      wedge: submission.wedge,
      origin: revision.origin === "editor" ? "manual" : revision.origin,
      engineRunId: submission.engineRunId,
      engineRecommendation:
        submission.producer === "engine"
          ? { value: submission.recommendation, reasons: [...submission.recommendationReasons] }
          : null,
      candidate: {
        state: legacy ? "legacy" : "new",
        reasonCategory: null,
        note: null,
        question: null,
        decidedAt: null,
        decidedBy: null,
      },
      lifecycle: "active",
      trash: null,
      publication: {
        state: legacy ? "live" : "never_published",
        liveReleaseId: null,
        lastLiveReleaseId: null,
        firstPublishedAt: null,
        lastReleasedAt: null,
        unpublishedAt: null,
        unpublishReason: null,
      },
      workingRevisionId: revisionId,
      generation: 1,
      version: 1,
      labels: [],
      legacy: legacy && submission.legacy
        ? {
            importedAt: now,
            bodyOrigin: submission.legacy.bodyOrigin,
            firstPublishedAt: submission.legacy.firstPublishedAt,
          }
        : null,
      createdAt: now,
      updatedAt: now,
    };

    if (legacy) {
      // The verified baseline mapping for content that was already live.
      const baseline: ReleaseRecord = {
        id: nextId(this.state, "rel"),
        ideaId,
        operation: "legacy_baseline",
        state: "succeeded",
        revisionId,
        revisionNumber: 1,
        approvalId: null,
        expectedLiveReleaseId: null,
        rollbackTargetReleaseId: null,
        generation: 1,
        attempt: 1,
        reason: "Imported as live — legacy evidence not reverified",
        idempotencyKey: null,
        createdAt: now,
        updatedAt: now,
        requestedBy: serviceActor,
        steps: [
          {
            state: "succeeded",
            at: now,
            detail: `Baseline mapped from the deployed page${this.state.env.simulated ? " (demo data)" : ""}`,
          },
        ],
        error: null,
        observation: null,
      };
      this.state.releases.set(baseline.id, baseline);
      idea.publication.liveReleaseId = baseline.id;
      idea.publication.lastLiveReleaseId = baseline.id;
      idea.publication.firstPublishedAt = submission.legacy?.firstPublishedAt ?? null;
      idea.publication.lastReleasedAt = now;
    }

    this.state.ideas.set(ideaId, idea);
    this.state.revisions.set(revisionId, revision);
    this.state.submissions.set(submissionKey, { artifactHash: hashes.artifact, ideaId, revisionId });
    appendAudit(this.state, {
      actor: serviceActor,
      action: "submission.imported",
      outcome: "succeeded",
      ideaId,
      revisionId,
      releaseId: null,
      reason: null,
      detail: `${legacy ? "Legacy live idea" : "Candidate"} imported as v1${slugConflict ? " (slug already in use)" : ""}`,
      code: null,
    });
    touch(this.state);
    return ok({ ideaId, revisionId, duplicate: false, quarantined: revision.quarantine !== null, slugConflict });
  }

  /* Revisions ----------------------------------------------------------- */

  async createRevision(ideaId: string, fromRevisionId: string | null, idempotencyKey: string, carry: DraftCarry | null = null) {
    const guard = this.editor("revision.created", { ideaId });
    if (!guard.ok) return guard;
    if (!commandIdSchemas.idempotencyKey.safeParse(idempotencyKey).success) {
      return fail<{ revisionId: string; number: number }>("INVALID_INPUT", "Invalid request key.");
    }
    const carried = carry === null ? null : draftCarrySchema.safeParse(carry);
    if (carried && !carried.success) {
      return fail<{ revisionId: string; number: number }>("INVALID_INPUT", carried.error.issues[0]?.message ?? "Invalid draft.");
    }
    const text = carried ? carried.data : null;
    const request = { ideaId, fromRevisionId, carry: text } as Canonicalizable;
    return this.idempotent(IDEMPOTENCY_SCOPES.createRevision, idempotencyKey, request, async () => {
      const idea = this.idea(ideaId);
      // No base given: the idea's working revision, resolved here so a retry repeats the same request.
      const working = idea ? this.state.revisions.get(idea.workingRevisionId) : undefined;
      if (fromRevisionId === null && working && working.kind === "draft" && !working.discarded) {
        return fail<{ revisionId: string; number: number }>("PRECONDITION_FAILED", `A working draft already exists (v${working.number}).`);
      }
      const from = fromRevisionId === null ? (working ?? null) : this.revision(fromRevisionId);
      if (!idea || !from || from.ideaId !== idea.id) {
        return fail<{ revisionId: string; number: number }>("NOT_FOUND", "That revision does not exist.");
      }
      if (idea.lifecycle === "trashed") {
        return this.refuse("revision.created", fail("IDEA_TRASHED", "Restore the idea before editing."), { ideaId });
      }
      if (from.kind === "draft") {
        return fail("INVALID_TRANSITION", "That revision is already an editable draft.");
      }
      if (working && working.kind === "draft" && !working.discarded) {
        return fail("PRECONDITION_FAILED", `A working draft already exists (v${working.number}).`);
      }
      const existing = [...this.state.revisions.values()].filter((r) => r.ideaId === idea.id);
      if (existing.length >= EDITORIAL_LIMITS.revisionsPerIdea) {
        return this.refuse(
          "revision.created",
          fail<{ revisionId: string; number: number }>(
            "PRECONDITION_FAILED",
            `This idea already has ${EDITORIAL_LIMITS.revisionsPerIdea} revisions, the most one idea can hold.`,
          ),
          { ideaId },
        );
      }
      const storedSoFar = existing.reduce((total, record) => total + storedBytes(record), 0);
      const copied = text ? { ...from, title: text.title, markdown: text.markdown, metadata: text.metadata } : from;
      if (storedSoFar + storedBytes(copied) > REVISION_BYTES_PER_IDEA) {
        return this.refuse(
          "revision.created",
          fail<{ revisionId: string; number: number }>(
            "PRECONDITION_FAILED",
            "This idea's revisions have reached the storage one idea can hold, so no new revision can be created.",
          ),
          { ideaId },
        );
      }
      const number = Math.max(...existing.map((r) => r.number)) + 1;
      const now = nowIso(this.state);
      const actor = this.actor();
      const revision: RevisionRecord = {
        ...from,
        id: nextId(this.state, "rev"),
        number,
        kind: "draft",
        origin: "editor",
        parentRevisionId: from.id,
        createdAt: now,
        createdBy: actor,
        updatedAt: now,
        updatedBy: actor,
        version: 1,
        sources: from.sources.map((source) => ({ ...source, verification: { ...source.verification } })),
        claims: from.claims.map((claim) => ({ ...claim, verification: { ...claim.verification } })),
        // Identical bytes keep the parent's checks current until the first edit.
        checks: from.checks.map((check) => ({ ...check })),
        reviewState: "draft",
        changesRequestedNote: null,
        discarded: false,
        submissionKey: null,
      };
      if (text) {
        // The editor's unsaved text, in the same command: nothing in between can fail.
        revision.title = text.title;
        revision.markdown = text.markdown;
        revision.metadata = text.metadata;
        idea.title = text.title;
      }
      this.state.revisions.set(revision.id, revision);
      idea.workingRevisionId = revision.id;
      idea.version += 1;
      this.stamp(idea);
      this.record("revision.created", "succeeded", {
        ideaId,
        revisionId: revision.id,
        detail: `v${revision.number} created from v${from.number}${text ? " with unsaved editor text" : ""}`,
      });
      return ok({ revisionId: revision.id, number });
    });
  }

  async discardRevision(ideaId: string, revisionId: string, expectedVersion: number, reason: string) {
    const guard = this.editor("revision.discarded", { ideaId, revisionId });
    if (!guard.ok) return guard;
    const reasonCheck = reasonSchema.safeParse(reason);
    if (!reasonCheck.success) return fail<{ workingRevisionId: string }>("INVALID_INPUT", "Give a reason for discarding.");
    const idea = this.idea(ideaId);
    const revision = this.revision(revisionId);
    if (!idea || !revision || revision.ideaId !== idea.id) return fail<{ workingRevisionId: string }>("NOT_FOUND", "That revision does not exist.");
    if (revision.kind !== "draft" || revision.discarded || idea.workingRevisionId !== revision.id) {
      return this.refuse("revision.discarded", fail<{ workingRevisionId: string }>("INVALID_TRANSITION", "Only the working draft can be discarded."), { ideaId, revisionId });
    }
    if (revision.version !== expectedVersion) {
      return fail<{ workingRevisionId: string }>("VERSION_CONFLICT", "The draft changed since you opened it. Reload before discarding.");
    }
    if (!revision.parentRevisionId) {
      return fail<{ workingRevisionId: string }>("INVALID_TRANSITION", "This draft has no earlier revision to return to.");
    }
    revision.discarded = true;
    idea.workingRevisionId = revision.parentRevisionId;
    idea.version += 1;
    this.stamp(idea);
    this.record("revision.discarded", "succeeded", {
      ideaId,
      revisionId,
      reason: reasonCheck.data,
      detail: `v${revision.number} discarded; live content unchanged`,
    });
    return ok({ workingRevisionId: revision.parentRevisionId });
  }

  async saveDraft(
    ideaId: string,
    revisionId: string,
    baseVersion: number,
    patch: SaveDraftPatch,
    idempotencyKey: string,
  ): Promise<CommandResult<SaveDraftAck>> {
    const guard = this.editor("revision.saved", { ideaId, revisionId });
    if (!guard.ok) return guard;
    const parsedPatch = saveDraftPatchSchema.safeParse(patch);
    if (
      !parsedPatch.success ||
      !Number.isInteger(baseVersion) ||
      !commandIdSchemas.idempotencyKey.safeParse(idempotencyKey).success
    ) {
      return fail("INVALID_INPUT", parsedPatch.success ? "Invalid save request." : parsedPatch.error.issues[0]?.message ?? "Invalid draft.");
    }
    const cleanPatch = parsedPatch.data;
    return this.idempotent(
      IDEMPOTENCY_SCOPES.saveDraft,
      idempotencyKey,
      { ideaId, revisionId, baseVersion, patch: { ...cleanPatch } as Canonicalizable },
      async () => {
        const idea = this.idea(ideaId);
        const revision = this.revision(revisionId);
        if (!idea || !revision || revision.ideaId !== idea.id) return fail<SaveDraftAck>("NOT_FOUND", "That revision does not exist.");
        if (idea.lifecycle === "trashed") return fail<SaveDraftAck>("IDEA_TRASHED", "Restore the idea before editing.");

        this.beforeSave(idea, revision);

        if (revision.kind !== "draft" || revision.discarded || idea.workingRevisionId !== revision.id) {
          return fail<SaveDraftAck>("REVISION_READ_ONLY", "This revision can no longer be edited.", {
            conflict: {
              revisionId: revision.id,
              latestVersion: revision.version,
              savedAt: revision.updatedAt,
              savedBy: revision.updatedBy.label,
              title: revision.title,
              markdown: revision.markdown,
              frozen: revision.kind === "approved_snapshot",
            },
          });
        }
        if (revision.version !== baseVersion) {
          return fail<SaveDraftAck>("VERSION_CONFLICT", "A newer version of this draft was saved elsewhere.", {
            conflict: {
              revisionId: revision.id,
              latestVersion: revision.version,
              savedAt: revision.updatedAt,
              savedBy: revision.updatedBy.label,
              title: revision.title,
              markdown: revision.markdown,
              frozen: false,
            },
          });
        }

        const before = await deriveRevision(this.state, revision.id);
        const reviewedBefore = new Set(
          before.view.reviewItems.filter((item) => item.status === "reviewed").map((item) => item.id),
        );
        if (cleanPatch.title !== undefined) revision.title = cleanPatch.title;
        if (cleanPatch.markdown !== undefined) revision.markdown = cleanPatch.markdown;
        if (cleanPatch.metadata !== undefined) revision.metadata = cleanPatch.metadata;
        revision.version += 1;
        revision.updatedAt = nowIso(this.state);
        revision.updatedBy = this.actor();
        if (cleanPatch.title !== undefined) idea.title = cleanPatch.title;
        this.stamp(idea);

        const after = await deriveRevision(this.state, revision.id);
        const invalidated = after.view.reviewItems.filter(
          (item) => reviewedBefore.has(item.id) && item.status !== "reviewed",
        ).length;
        this.record("revision.saved", "succeeded", {
          ideaId,
          revisionId,
          detail: `v${revision.number} saved (version ${revision.version})${invalidated ? ` · ${invalidated} review${invalidated === 1 ? "" : "s"} invalidated` : ""}`,
        });
        return ok({
          revisionId: revision.id,
          version: revision.version,
          savedAt: revision.updatedAt,
          artifactHash: after.hashes.artifact,
          invalidatedReviews: invalidated,
        });
      },
    );
  }

  /* Candidate decision ------------------------------------------------------ */

  async setCandidateDecision(ideaId: string, expectedVersion: number, input: CandidateDecisionInput) {
    const guard = this.editor("candidate.decided", { ideaId });
    if (!guard.ok) return guard;
    type Result = { version: number; revokedApprovals: number };
    const parsed = candidateDecisionSchema.safeParse(input);
    if (!parsed.success) return fail<Result>("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid decision.");
    const idea = this.idea(ideaId);
    if (!idea) return fail<Result>("NOT_FOUND", "That idea does not exist.");
    if (idea.lifecycle === "trashed") return fail<Result>("IDEA_TRASHED", "Restore the idea first.");
    if (idea.version !== expectedVersion) {
      return fail<Result>("VERSION_CONFLICT", "This idea changed since you opened it. Reload and decide again.");
    }
    const decision = parsed.data;
    if (!canTransitionCandidate(idea.candidate.state, decision.decision)) {
      return this.refuse(
        "candidate.decided",
        fail<Result>(
          "INVALID_TRANSITION",
          `Cannot move from ${CANDIDATE_LABELS[idea.candidate.state]} to ${CANDIDATE_LABELS[decision.decision]}.`,
        ),
        { ideaId },
      );
    }
    const now = nowIso(this.state);
    const actor = this.actor();
    idea.candidate = {
      state: decision.decision,
      reasonCategory: decision.decision === "rejected" ? decision.reasonCategory : null,
      note:
        decision.decision === "accepted"
          ? decision.rationale
          : decision.decision === "rejected"
            ? decision.note
            : decision.decision === "new"
              ? decision.reason
              : null,
      question: decision.decision === "needs_research" ? decision.question : null,
      decidedAt: now,
      decidedBy: actor,
    };
    let revoked = 0;
    if (!APPROVABLE_CANDIDATE_STATES.includes(decision.decision)) {
      revoked = revokeIdeaApprovals(
        this.state,
        idea.id,
        `Candidate decision changed to ${CANDIDATE_LABELS[decision.decision]}`,
        actor,
      );
    }
    idea.version += 1;
    this.stamp(idea);
    const reason =
      decision.decision === "accepted"
        ? decision.rationale
        : decision.decision === "needs_research"
          ? decision.question
          : decision.decision === "rejected"
            ? `${REJECT_REASON_LABELS[decision.reasonCategory]}${decision.note ? ` — ${decision.note}` : ""}`
            : decision.reason;
    this.record("candidate.decided", "succeeded", {
      ideaId,
      reason,
      detail: `${CANDIDATE_LABELS[decision.decision]}${revoked ? ` · ${revoked} approval${revoked === 1 ? "" : "s"} revoked` : ""}`,
    });
    return ok({ version: idea.version, revokedApprovals: revoked });
  }

  /* Review ---------------------------------------------------------------- */

  protected async reviewTarget(
    action: ActivityAction,
    revisionId: string,
    reviewItemId: string,
  ): Promise<
    | { ok: true; idea: IdeaRecord; revision: RevisionRecord; item: RevisionView["reviewItems"][number] }
    | { ok: false; result: CommandResult<never> }
  > {
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return { ok: false, result: fail("NOT_FOUND", "That revision does not exist.") };
    if (idea.lifecycle === "trashed") return { ok: false, result: fail("IDEA_TRASHED", "Restore the idea first.") };
    if (idea.workingRevisionId !== revision.id || revision.discarded) {
      return {
        ok: false,
        result: this.refuse(action, fail("PRECONDITION_FAILED", "Only the working revision can be reviewed."), {
          ideaId: idea.id,
          revisionId,
        }),
      };
    }
    const derived = await deriveRevision(this.state, revision.id);
    const item = derived.view.reviewItems.find((candidate) => candidate.id === reviewItemId);
    if (!item) {
      return {
        ok: false,
        result: this.refuse(action, fail("NOT_FOUND", "That review item does not exist on this revision."), {
          ideaId: idea.id,
          revisionId,
        }),
      };
    }
    return { ok: true, idea, revision, item };
  }

  async markReviewed(revisionId: string, reviewItemId: string, dependencyHash: string, note: string | null) {
    const guard = this.editor("review.attested", { revisionId });
    if (!guard.ok) return guard;
    if (note !== null && !noteSchema.safeParse(note).success) return fail<ReviewAck>("INVALID_INPUT", "That note is not valid.");
    const target = await this.reviewTarget("review.attested", revisionId, reviewItemId);
    if (!target.ok) return target.result;
    const { idea, revision, item } = target;
    if (latestApprovalFor(this.state, revision.id)?.status === "active") {
      return fail<ReviewAck>("INVALID_TRANSITION", "This revision is already approved.");
    }
    if (dependencyHash !== item.dependencyHash) {
      return this.refuse(
        "review.attested",
        fail<ReviewAck>("STALE_REVIEW_TARGET", "This item changed since you opened it. Review the current version."),
        { ideaId: idea.id, revisionId },
      );
    }
    this.state.attestations.push({
      id: nextId(this.state, "att"),
      ideaId: idea.id,
      revisionId,
      itemId: item.id,
      dependencyHash,
      note: note === null ? null : note.trim(),
      at: nowIso(this.state),
      actor: this.actor(),
      retracted: false,
    });
    if (revision.reviewState === "draft") revision.reviewState = "in_review";
    this.stamp(idea);
    this.record("review.attested", "succeeded", { ideaId: idea.id, revisionId, detail: `Reviewed: ${item.label}` });
    return ok<ReviewAck>({ itemId: item.id, revisionId, reviewState: revision.reviewState });
  }

  async retractReview(revisionId: string, reviewItemId: string) {
    const guard = this.editor("review.retracted", { revisionId });
    if (!guard.ok) return guard;
    const target = await this.reviewTarget("review.retracted", revisionId, reviewItemId);
    if (!target.ok) return target.result;
    const { idea, revision, item } = target;
    let retracted = 0;
    for (const attestation of this.state.attestations) {
      if (attestation.ideaId === idea.id && attestation.itemId === item.id && !attestation.retracted) {
        attestation.retracted = true;
        retracted += 1;
      }
    }
    if (retracted === 0) return fail<ReviewAck>("INVALID_TRANSITION", "That item is not marked reviewed.");
    this.stamp(idea);
    this.record("review.retracted", "succeeded", { ideaId: idea.id, revisionId, detail: `Review withdrawn: ${item.label}` });
    return ok<ReviewAck>({ itemId: item.id, revisionId, reviewState: revision.reviewState });
  }

  async flagReviewItem(revisionId: string, reviewItemId: string, dependencyHash: string, input: FlagInput) {
    const guard = this.editor("review.flagged", { revisionId });
    if (!guard.ok) return guard;
    const parsed = flagInputSchema.safeParse(input);
    if (!parsed.success) return fail<ReviewAck>("INVALID_INPUT", "Describe the discrepancy.");
    const target = await this.reviewTarget("review.flagged", revisionId, reviewItemId);
    if (!target.ok) return target.result;
    const { idea, revision, item } = target;
    if (dependencyHash !== item.dependencyHash) {
      return fail<ReviewAck>("STALE_REVIEW_TARGET", "This item changed since you opened it.");
    }
    this.state.flags.push({
      id: nextId(this.state, "flg"),
      ideaId: idea.id,
      revisionId,
      itemId: item.id,
      dependencyHash,
      severity: parsed.data.severity,
      note: parsed.data.note,
      at: nowIso(this.state),
      actor: this.actor(),
      resolution: null,
    });
    if (revision.reviewState === "draft") revision.reviewState = "in_review";
    this.stamp(idea);
    this.record("review.flagged", "succeeded", {
      ideaId: idea.id,
      revisionId,
      reason: parsed.data.note,
      detail: `${parsed.data.severity === "high" ? "High" : "Low"}-severity discrepancy on ${item.label}`,
    });
    return ok<ReviewAck>({ itemId: item.id, revisionId, reviewState: revision.reviewState });
  }

  async resolveIssue(revisionId: string, issueId: string, dependencyHash: string, note: string) {
    const guard = this.editor("review.resolved", { revisionId });
    if (!guard.ok) return guard;
    const parsedNote = noteSchema.safeParse(note);
    if (!parsedNote.success || typeof issueId !== "string" || issueId.length > 200) {
      return fail<{ issueId: string }>("INVALID_INPUT", "Write down why this is resolved.");
    }
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return fail<{ issueId: string }>("NOT_FOUND", "That revision does not exist.");
    if (idea.workingRevisionId !== revision.id) {
      return fail<{ issueId: string }>("PRECONDITION_FAILED", "Only issues on the working revision can be resolved.");
    }
    const derived = await deriveRevision(this.state, revision.id);
    const issue = derived.issues.find((candidate) => candidate.id === issueId);
    if (!issue) return fail<{ issueId: string }>("NOT_FOUND", "That issue is no longer open.");
    if (!issue.resolvable) {
      return this.refuse(
        "review.resolved",
        fail<{ issueId: string }>(
          "INVALID_TRANSITION",
          "Blocking issues cannot be waived with a note. Change the content or evidence.",
        ),
        { ideaId: idea.id, revisionId },
      );
    }
    if (dependencyHash !== issue.dependencyHash) {
      return fail<{ issueId: string }>("STALE_REVIEW_TARGET", "This issue changed since you opened it.");
    }
    const now = nowIso(this.state);
    if (issueId.startsWith("flag:")) {
      const itemId = issueId.slice("flag:".length);
      for (const flag of this.state.flags) {
        if (flag.ideaId === idea.id && flag.itemId === itemId && flag.resolution === null) {
          flag.resolution = { note: parsedNote.data, at: now, actor: this.actor() };
        }
      }
    } else {
      this.state.resolutions.push({
        id: nextId(this.state, "res"),
        ideaId: idea.id,
        issueId,
        dependencyHash,
        note: parsedNote.data,
        at: now,
        actor: this.actor(),
      });
    }
    this.stamp(idea);
    this.record("review.resolved", "succeeded", {
      ideaId: idea.id,
      revisionId,
      reason: parsedNote.data,
      detail: `Resolved: ${issue.message.slice(0, 120)}`,
    });
    return ok({ issueId });
  }

  async addNote(revisionId: string, target: EditorialTarget, note: string) {
    const guard = this.editor("note.added", { revisionId });
    if (!guard.ok) return guard;
    const parsedTarget = noteTargetSchema.safeParse(target);
    const parsedNote = noteSchema.safeParse(note);
    if (!parsedTarget.success || !parsedNote.success) return fail<{ noteId: string }>("INVALID_INPUT", "That note is not valid.");
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return fail<{ noteId: string }>("NOT_FOUND", "That revision does not exist.");
    const id = nextId(this.state, "note");
    this.state.notes.push({
      id,
      ideaId: idea.id,
      revisionId,
      target: parsedTarget.data,
      note: parsedNote.data,
      at: nowIso(this.state),
      actor: this.actor(),
    });
    this.stamp(idea);
    this.record("note.added", "succeeded", { ideaId: idea.id, revisionId, detail: `Note on ${parsedTarget.data.kind}` });
    return ok({ noteId: id });
  }

  async requestChanges(revisionId: string, note: string) {
    const guard = this.editor("review.changes_requested", { revisionId });
    if (!guard.ok) return guard;
    const parsedNote = noteSchema.safeParse(note);
    if (!parsedNote.success) return fail<ReviewAck>("INVALID_INPUT", "Say what needs to change.");
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return fail<ReviewAck>("NOT_FOUND", "That revision does not exist.");
    if (idea.workingRevisionId !== revision.id || revision.reviewState === "approved" || revision.reviewState === "changes_requested") {
      return this.refuse(
        "review.changes_requested",
        fail<ReviewAck>("INVALID_TRANSITION", "Changes can only be requested on a revision under review."),
        { ideaId: idea.id, revisionId },
      );
    }
    revision.reviewState = "changes_requested";
    revision.changesRequestedNote = parsedNote.data;
    this.stamp(idea);
    this.record("review.changes_requested", "succeeded", { ideaId: idea.id, revisionId, reason: parsedNote.data });
    return ok<ReviewAck>({ itemId: "revision", revisionId, reviewState: revision.reviewState });
  }

  async resumeReview(revisionId: string) {
    const guard = this.editor("review.resumed", { revisionId });
    if (!guard.ok) return guard;
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return fail<ReviewAck>("NOT_FOUND", "That revision does not exist.");
    if (revision.reviewState !== "changes_requested") {
      return fail<ReviewAck>("INVALID_TRANSITION", "This revision is not waiting on changes.");
    }
    revision.reviewState = "in_review";
    revision.changesRequestedNote = null;
    this.stamp(idea);
    this.record("review.resumed", "succeeded", { ideaId: idea.id, revisionId });
    return ok<ReviewAck>({ itemId: "revision", revisionId, reviewState: revision.reviewState });
  }

  async runChecks(revisionId: string, expectedArtifactHash: string) {
    const guard = this.editor("checks.run", { revisionId });
    if (!guard.ok) return guard;
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return fail<{ checksRunAt: string }>("NOT_FOUND", "That revision does not exist.");
    const runChecks = this.state.env.checks.run;
    if (!runChecks) return fail<{ checksRunAt: string }>("PRECONDITION_FAILED", this.state.env.checks.unavailableReason);
    const hashes = await computeRevisionHashes(revision);
    if (hashes.artifact !== expectedArtifactHash) {
      return fail<{ checksRunAt: string }>("STALE_REVIEW_TARGET", "The revision changed. Save and run checks on the latest version.");
    }
    revision.checks = runChecks({
      markdown: revision.markdown,
      sources: revision.sources,
      artifactHash: hashes.artifact,
      policyVersion: this.state.policyVersion,
      nowMs: this.state.clock.now(),
    });
    revision.checksRunAt = nowIso(this.state);
    this.stamp(idea);
    const failing = revision.checks.filter((check) => check.outcome === "fail" || check.outcome === "error").length;
    const warnings = revision.checks.filter((check) => check.outcome === "warning").length;
    this.record("checks.run", "succeeded", {
      ideaId: idea.id,
      revisionId,
      detail: `${this.state.env.simulated ? "Simulated checks" : "Checks"}: ${failing} failing, ${warnings} warning${warnings === 1 ? "" : "s"}`,
    });
    return ok({ checksRunAt: revision.checksRunAt });
  }

  /**
   * Only a private backend mutation calls this after the Node deep audit.
   * Re-checking the actor, current policy and exact saved artifact inside the
   * write transaction prevents an edit or policy change racing the audit.
   */
  async applyTrustedChecks(
    revisionId: string,
    expectedArtifactHash: string,
    expectedPolicyVersion: string,
    checks: readonly QualityCheck[],
  ): Promise<CommandResult<{ checksRunAt: string }>> {
    const guard = this.editor("checks.run", { revisionId });
    if (!guard.ok) return guard;
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return fail("NOT_FOUND", "That revision does not exist.");
    if (!this.state.env.checks.externalRun || this.state.policyVersion !== expectedPolicyVersion) {
      return fail("PRECONDITION_FAILED", "The editorial check policy changed. Run checks again.");
    }
    const hashes = await computeRevisionHashes(revision);
    if (hashes.artifact !== expectedArtifactHash) {
      return fail("STALE_REVIEW_TARGET", "The revision changed. Save and run checks on the latest version.");
    }
    const ids = new Set<string>();
    if (checks.length === 0 || checks.length > EDITORIAL_LIMITS.checks) {
      return fail("INVALID_INPUT", "The engine check result set is empty or oversized.");
    }
    for (const check of checks) {
      const { producer, ...input } = check;
      if (
        producer !== "engine" ||
        check.policyVersion !== expectedPolicyVersion ||
        check.evaluatedHash !== expectedArtifactHash ||
        ids.has(check.id) ||
        !qualityCheckInputSchema.safeParse(input).success
      ) {
        return fail("INVALID_INPUT", "The engine check results do not match this revision and policy.");
      }
      ids.add(check.id);
    }
    if (this.state.env.checks.requiredCheckIds.some((id) => !ids.has(id))) {
      return fail("INVALID_INPUT", "A required engine check is missing.");
    }
    revision.checks = checks.map((check) => ({ ...check }));
    revision.checksRunAt = nowIso(this.state);
    this.stamp(idea);
    const failing = checks.filter((check) => check.outcome === "fail" || check.outcome === "error").length;
    const warnings = checks.filter((check) => check.outcome === "warning").length;
    this.record("checks.run", "succeeded", {
      ideaId: idea.id,
      revisionId,
      detail: `Engine audit: ${failing} failing, ${warnings} warning${warnings === 1 ? "" : "s"}`,
    });
    return ok({ checksRunAt: revision.checksRunAt });
  }

  async approveRevision(revisionId: string, artifactHash: string, input: ApprovalInput) {
    const guard = this.editor("approval.granted", { revisionId });
    if (!guard.ok) return guard;
    type Result = { approvalId: string };
    const parsed = approvalInputSchema.safeParse(input);
    if (!parsed.success) return fail<Result>("INVALID_INPUT", "Approval needs your explicit attestation.");
    const revision = this.revision(revisionId);
    const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
    if (!revision || !idea) return fail<Result>("NOT_FOUND", "That revision does not exist.");
    const derived = await deriveRevision(this.state, revision.id);
    if (derived.hashes.artifact !== artifactHash) {
      return this.refuse(
        "approval.granted",
        fail<Result>("PRECONDITION_FAILED", "The revision changed after you reviewed it. Review the current version."),
        { ideaId: idea.id, revisionId },
      );
    }
    if (derived.blockers.length > 0) {
      return this.refuse(
        "approval.granted",
        fail<Result>("APPROVAL_BLOCKED", "This revision cannot be approved yet.", { blockers: derived.blockers }),
        { ideaId: idea.id, revisionId },
      );
    }
    const actor = this.actor();
    for (const approval of this.state.approvals.values()) {
      if (approval.ideaId === idea.id && approval.status === "active") {
        approval.status = "superseded";
        approval.revokedAt = nowIso(this.state);
        approval.revokedReason = `Superseded by approval of v${revision.number}`;
      }
    }
    if (revision.kind === "draft") revision.kind = "approved_snapshot";
    revision.reviewState = "approved";
    const approvalId = nextId(this.state, "apr");
    this.state.approvals.set(approvalId, {
      id: approvalId,
      ideaId: idea.id,
      revisionId: revision.id,
      revisionNumber: revision.number,
      artifactHash: derived.hashes.artifact,
      policyVersion: this.state.policyVersion,
      assessmentDigest: derived.assessment,
      statement: `I reviewed the content and evidence of revision v${revision.number} (artifact ${derived.hashes.artifact.slice(0, 12)}).`,
      note: parsed.data.note,
      approvedAt: nowIso(this.state),
      approvedBy: actor,
      status: "active",
      revokedAt: null,
      revokedReason: null,
    });
    this.stamp(idea);
    this.record("approval.granted", "succeeded", {
      ideaId: idea.id,
      revisionId,
      reason: parsed.data.note,
      detail: `v${revision.number} approved; the revision is now frozen`,
    });
    return ok({ approvalId });
  }

  /* Releases and lifecycle ---------------------------------------------------- */

  async prepareRelease(revisionId: string, expectedLiveReleaseId: string | null, idempotencyKey: string) {
    const guard = this.editor("release.prepared", { revisionId });
    if (!guard.ok) return guard;
    type Result = { releaseId: string };
    if (!commandIdSchemas.idempotencyKey.safeParse(idempotencyKey).success) return fail<Result>("INVALID_INPUT", "Invalid request key.");
    const unavailable = this.releasesUnavailable();
    if (unavailable) return unavailable;
    return this.idempotent(IDEMPOTENCY_SCOPES.prepareRelease, idempotencyKey, { revisionId, expectedLiveReleaseId }, async () => {
      const revision = this.revision(revisionId);
      const idea = revision ? this.state.ideas.get(revision.ideaId) ?? null : null;
      if (!revision || !idea) return fail<Result>("NOT_FOUND", "That revision does not exist.");
      const approval = latestApprovalFor(this.state, revision.id);
      const validity = approval ? await approvalValidity(this.state, approval) : { valid: false as const, reason: "Not approved" };
      if (!approval || !validity.valid) {
        return this.refuse(
          "release.prepared",
          fail<Result>("APPROVAL_NOT_ACTIVE", `A current approval is required. ${validity.valid ? "" : validity.reason}.`),
          { ideaId: idea.id, revisionId },
        );
      }
      if (idea.publication.liveReleaseId !== expectedLiveReleaseId) {
        return fail<Result>("PRECONDITION_FAILED", "The live version changed. Reload and check the comparison again.");
      }
      if (inFlightReleaseFor(this.state, idea.id)) {
        return fail<Result>("RELEASE_IN_FLIGHT", "Another release for this idea is still running.");
      }
      const now = nowIso(this.state);
      const release: ReleaseRecord = {
        id: nextId(this.state, "rel"),
        ideaId: idea.id,
        operation: idea.publication.state === "never_published" ? "publish" : "republish",
        state: "preparing",
        revisionId: revision.id,
        revisionNumber: revision.number,
        approvalId: approval.id,
        expectedLiveReleaseId,
        rollbackTargetReleaseId: null,
        generation: idea.generation,
        attempt: 1,
        reason: null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
        requestedBy: this.actor(),
        steps: [{ state: "preparing", at: now, detail: `Staging a protected preview${simulatedSuffix(this.state)}` }],
        error: null,
        observation: null,
      };
      this.state.releases.set(release.id, release);
      this.stamp(idea);
      this.record("release.prepared", "succeeded", {
        ideaId: idea.id,
        revisionId: revision.id,
        releaseId: release.id,
        detail: `Preview staging for v${revision.number}${simulatedSuffix(this.state)}`,
      });
      return ok({ releaseId: release.id });
    });
  }

  async publishRelease(releaseId: string, expectedState: ReleaseState, approvalId: string, idempotencyKey: string) {
    const guard = this.editor("release.requested");
    if (!guard.ok) return guard;
    type Result = { releaseId: string };
    if (
      !commandIdSchemas.idempotencyKey.safeParse(idempotencyKey).success ||
      !commandIdSchemas.releaseState.safeParse(expectedState).success
    ) {
      return fail<Result>("INVALID_INPUT", "Invalid publish request.");
    }
    const unavailable = this.releasesUnavailable();
    if (unavailable) return unavailable;
    return this.idempotent(IDEMPOTENCY_SCOPES.publishRelease, idempotencyKey, { releaseId, expectedState, approvalId }, async () => {
      const release = this.state.releases.get(releaseId);
      const idea = release ? this.state.ideas.get(release.ideaId) ?? null : null;
      if (!release || !idea) return fail<Result>("NOT_FOUND", "That release does not exist.");
      const reauth = this.needsStrongAuth(guard.editor);
      if (reauth) return this.refuse("release.requested", reauth, { ideaId: idea.id, releaseId });
      if (this.state.killSwitchEngaged) {
        return this.refuse(
          "release.requested",
          fail<Result>("KILL_SWITCH_ENGAGED", "Publishing is paused by the kill switch. Unpublish and recovery still work."),
          { ideaId: idea.id, releaseId },
        );
      }
      if (release.state !== expectedState || expectedState !== "preview_ready") {
        return fail<Result>("PRECONDITION_FAILED", "This release is no longer waiting for your publish decision.");
      }
      const approval = this.state.approvals.get(approvalId);
      if (!approval || release.approvalId !== approvalId) {
        return fail<Result>("APPROVAL_NOT_ACTIVE", "That approval does not belong to this release.");
      }
      const validity = await approvalValidity(this.state, approval);
      if (!validity.valid) {
        revokeApproval(this.state, approval, validity.reason, this.actor());
        return this.refuse(
          "release.requested",
          fail<Result>("APPROVAL_NOT_ACTIVE", `The approval is no longer valid: ${validity.reason}.`),
          { ideaId: idea.id, releaseId },
        );
      }
      if (idea.publication.liveReleaseId !== release.expectedLiveReleaseId) {
        return fail<Result>("PRECONDITION_FAILED", "The live version changed after this preview was prepared.");
      }
      if (idea.generation !== release.generation) {
        return fail<Result>("GENERATION_FENCED", "A later unpublish or release superseded this one.");
      }
      transitionRelease(this.state, release, "publish_requested", `Publish confirmed; release intent recorded${simulatedSuffix(this.state)}`);
      this.stamp(idea);
      this.record("release.requested", "succeeded", {
        ideaId: idea.id,
        revisionId: release.revisionId,
        releaseId,
        detail: `Exact release intent recorded${simulatedSuffix(this.state)}`,
      });
      return ok({ releaseId });
    });
  }

  async cancelRelease(releaseId: string, expectedState: ReleaseState, reason: string) {
    const guard = this.editor("release.cancelled");
    if (!guard.ok) return guard;
    type Result = { releaseId: string };
    const parsedReason = reasonSchema.safeParse(reason);
    if (!parsedReason.success) return fail<Result>("INVALID_INPUT", "Give a reason for cancelling.");
    const release = this.state.releases.get(releaseId);
    const idea = release ? this.state.ideas.get(release.ideaId) ?? null : null;
    if (!release || !idea) return fail<Result>("NOT_FOUND", "That release does not exist.");
    if (release.state !== expectedState) return fail<Result>("PRECONDITION_FAILED", "This release changed state. Reload.");
    if (release.operation === "unpublish" || release.operation === "legacy_baseline" || !["preparing", "preview_ready", "publish_requested", "deploying", "verifying", "failed"].includes(release.state)) {
      return this.refuse("release.cancelled", fail<Result>("INVALID_TRANSITION", "This release can no longer be cancelled."), {
        ideaId: idea.id,
        releaseId,
      });
    }
    transitionRelease(this.state, release, "cancelled", `Cancelled: ${parsedReason.data}`);
    release.reason = parsedReason.data;
    this.stamp(idea);
    this.record("release.cancelled", "succeeded", { ideaId: idea.id, releaseId, reason: parsedReason.data });
    return ok({ releaseId });
  }

  async retryRelease(releaseId: string, expectedState: ReleaseState, idempotencyKey: string) {
    const guard = this.editor("release.retried");
    if (!guard.ok) return guard;
    type Result = { releaseId: string };
    if (!commandIdSchemas.idempotencyKey.safeParse(idempotencyKey).success) return fail<Result>("INVALID_INPUT", "Invalid request key.");
    const unavailable = this.releasesUnavailable();
    if (unavailable) return unavailable;
    return this.idempotent(IDEMPOTENCY_SCOPES.retryRelease, idempotencyKey, { releaseId, expectedState }, async () => {
      const release = this.state.releases.get(releaseId);
      const idea = release ? this.state.ideas.get(release.ideaId) ?? null : null;
      if (!release || !idea) return fail<Result>("NOT_FOUND", "That release does not exist.");
      const reauth = this.needsStrongAuth(guard.editor);
      if (reauth) return this.refuse("release.retried", reauth, { ideaId: idea.id, releaseId });
      if (release.state !== "failed" || expectedState !== "failed") {
        return fail<Result>("PRECONDITION_FAILED", "Only a failed release can be retried.");
      }
      if (release.operation === "unpublish" &&
          (idea.publication.state !== "unpublished" || idea.generation !== release.generation)) {
        return fail<Result>("GENERATION_FENCED", "A later public change superseded this removal probe.");
      }
      if (release.operation !== "unpublish") {
        if (this.state.killSwitchEngaged) {
          return fail<Result>("KILL_SWITCH_ENGAGED", "Publishing is paused by the kill switch.");
        }
        const approval = release.approvalId ? this.state.approvals.get(release.approvalId) : undefined;
        if (release.operation !== "rollback") {
          const validity = approval ? await approvalValidity(this.state, approval) : { valid: false as const, reason: "Missing approval" };
          if (!validity.valid) {
            return fail<Result>("APPROVAL_NOT_ACTIVE", `The approval is no longer valid: ${validity.reason}.`);
          }
        }
        if (idea.publication.liveReleaseId !== release.expectedLiveReleaseId) {
          return fail<Result>("PRECONDITION_FAILED", "The live version changed since this attempt. Prepare a new release.");
        }
        if (inFlightReleaseFor(this.state, idea.id)) {
          return fail<Result>("RELEASE_IN_FLIGHT", "Another release for this idea is still running.");
        }
      }
      release.attempt += 1;
      release.error = null;
      release.generation = idea.generation;
      transitionRelease(this.state, release, release.operation === "unpublish" ? "verifying" : "publish_requested", `Retry attempt ${release.attempt}`);
      this.stamp(idea);
      this.record("release.retried", "succeeded", { ideaId: idea.id, releaseId, detail: `Attempt ${release.attempt}` });
      return ok({ releaseId });
    });
  }

  async reconcileRelease(releaseId: string) {
    const guard = this.editor("release.reconciled");
    if (!guard.ok) return guard;
    type Result = { releaseId: string; state: ReleaseState };
    const release = this.state.releases.get(releaseId);
    const idea = release ? this.state.ideas.get(release.ideaId) ?? null : null;
    if (!release || !idea) return fail<Result>("NOT_FOUND", "That release does not exist.");
    const reauth = this.needsStrongAuth(guard.editor);
    if (reauth) return this.refuse("release.reconciled", reauth, { ideaId: idea.id, releaseId });
    if (release.state !== "needs_reconciliation") {
      return fail<Result>("INVALID_TRANSITION", "This release does not need reconciliation.");
    }
    const unavailable = this.releasesUnavailable();
    if (unavailable) return unavailable;
    // Apply what a probe observed; never retry the activation blindly.
    if (!release.observation) {
      return fail<Result>("PRECONDITION_FAILED", "No probe result yet. Reconcile after the worker has checked the public site.");
    }
    const activated = release.observation.activated;
    const sfx = simulatedSuffix(this.state);
    if (activated) {
      if (idea.generation !== release.generation || idea.publication.liveReleaseId !== release.expectedLiveReleaseId) {
        return fail<Result>("GENERATION_FENCED", "A later public change superseded this uncertain release.");
      }
      completeActivation(this.state, idea, release, `Probe found the release live${sfx}; recorded as succeeded`);
    } else {
      release.error = { code: "NOT_ACTIVATED", message: `Probe found the previous version still live${sfx}.` };
      transitionRelease(this.state, release, "failed", `Probe found the previous version still live${sfx}`);
    }
    this.stamp(idea);
    this.record("release.reconciled", "succeeded", {
      ideaId: idea.id,
      releaseId,
      detail: activated ? "Activation confirmed by probe" : "Activation had not happened; marked failed",
    });
    return ok({ releaseId, state: release.state });
  }

  async requestRollback(
    ideaId: string,
    targetReleaseId: string,
    expectedLiveReleaseId: string,
    reason: string,
    idempotencyKey: string,
  ) {
    const guard = this.editor("rollback.requested", { ideaId });
    if (!guard.ok) return guard;
    type Result = { releaseId: string };
    const parsedReason = reasonSchema.safeParse(reason);
    if (!parsedReason.success || !commandIdSchemas.idempotencyKey.safeParse(idempotencyKey).success) {
      return fail<Result>("INVALID_INPUT", "Give a reason for the rollback.");
    }
    const unavailable = this.releasesUnavailable();
    if (unavailable) return unavailable;
    return this.idempotent(IDEMPOTENCY_SCOPES.requestRollback, idempotencyKey, { ideaId, targetReleaseId, expectedLiveReleaseId }, async () => {
      const idea = this.idea(ideaId);
      const target = this.state.releases.get(targetReleaseId);
      if (!idea || !target || target.ideaId !== idea.id) return fail<Result>("NOT_FOUND", "That release does not exist.");
      const reauth = this.needsStrongAuth(guard.editor);
      if (reauth) return this.refuse("rollback.requested", reauth, { ideaId });
      if (this.state.killSwitchEngaged) {
        return fail<Result>("KILL_SWITCH_ENGAGED", "Publishing is paused by the kill switch. Unpublish still works.");
      }
      if (idea.publication.state !== "live" || idea.publication.liveReleaseId !== expectedLiveReleaseId) {
        return fail<Result>("PRECONDITION_FAILED", "The live version changed. Reload before rolling back.");
      }
      if (target.state !== "succeeded" || target.operation === "unpublish" || target.id === expectedLiveReleaseId || !target.revisionId) {
        return fail<Result>("INVALID_TRANSITION", "Choose an earlier successful release of this idea.");
      }
      if (inFlightReleaseFor(this.state, idea.id)) {
        return fail<Result>("RELEASE_IN_FLIGHT", "Another release for this idea is still running.");
      }
      // Renewed safety checks on the exact target artifact.
      const targetRevision = this.state.revisions.get(target.revisionId);
      if (!targetRevision) return fail<Result>("NOT_FOUND", "The target revision no longer exists.");
      const runChecks = this.state.env.checks.run;
      const hashes = await computeRevisionHashes(targetRevision);
      let renewed: readonly QualityCheck[];
      if (runChecks) {
        renewed = runChecks({
          markdown: targetRevision.markdown,
          sources: targetRevision.sources,
          artifactHash: hashes.artifact,
          policyVersion: this.state.policyVersion,
          nowMs: this.state.clock.now(),
        });
      } else if (this.state.env.checks.externalRun) {
        // The live Node audit was committed through its trusted mutation.
        // A fresh run is required for every rollback; old success alone is
        // never enough to reinstate content after sources may have changed.
        const checkedAt = Date.parse(targetRevision.checksRunAt ?? "");
        const derived = await deriveRevision(this.state, targetRevision.id);
        if (!Number.isFinite(checkedAt) || this.state.clock.now() - checkedAt > 10 * 60_000 ||
            !derived.checksCurrent || derived.hashes.artifact !== hashes.artifact ||
            derived.issues.some((issue) => issue.severity === "blocker")) {
          return fail<Result>("PRECONDITION_FAILED", "Run the current engine audit on the target revision before rollback.");
        }
        renewed = targetRevision.checks;
      } else {
        return fail<Result>("PRECONDITION_FAILED", this.state.env.checks.unavailableReason);
      }
      const failedRequired = this.state.env.checks.externalRun
        ? this.state.env.checks.requiredCheckIds.find((id) =>
          !renewed.some((check) => check.id === id && check.outcome === "pass"),
        )
        : undefined;
      if (failedRequired) {
        return fail<Result>("PRECONDITION_FAILED", `The target revision did not pass ${failedRequired}.`);
      }
      const failingSafety = renewed.filter(
        (check) => check.category === "safety" && (check.outcome === "fail" || check.outcome === "error"),
      );
      if (failingSafety.length > 0) {
        return this.refuse(
          "rollback.requested",
          fail<Result>("PRECONDITION_FAILED", `The earlier version fails current safety checks: ${failingSafety[0].label}.`),
          { ideaId },
        );
      }
      const now = nowIso(this.state);
      const release: ReleaseRecord = {
        id: nextId(this.state, "rel"),
        ideaId: idea.id,
        operation: "rollback",
        state: "publish_requested",
        revisionId: target.revisionId,
        revisionNumber: targetRevision.number,
        approvalId: target.approvalId,
        expectedLiveReleaseId,
        rollbackTargetReleaseId: target.id,
        generation: idea.generation,
        attempt: 1,
        reason: parsedReason.data,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
        requestedBy: this.actor(),
        steps: [
          {
            state: "publish_requested",
            at: now,
            detail: `Rollback to v${targetRevision.number} confirmed${simulatedSuffix(this.state)}`,
          },
        ],
        error: null,
        observation: null,
      };
      this.state.releases.set(release.id, release);
      this.stamp(idea);
      this.record("rollback.requested", "succeeded", {
        ideaId: idea.id,
        revisionId: target.revisionId,
        releaseId: release.id,
        reason: parsedReason.data,
        detail: `Rollback to v${targetRevision.number} requested`,
      });
      return ok({ releaseId: release.id });
    });
  }

  async unpublishIdea(ideaId: string, expectedLiveReleaseId: string, reason: string, idempotencyKey: string) {
    const guard = this.editor("unpublish.requested", { ideaId });
    if (!guard.ok) return guard;
    type Result = { releaseId: string };
    const parsedReason = reasonSchema.safeParse(reason);
    if (!parsedReason.success || !commandIdSchemas.idempotencyKey.safeParse(idempotencyKey).success) {
      return fail<Result>("INVALID_INPUT", "Give a reason for unpublishing.");
    }
    const unavailable = this.releasesUnavailable();
    if (unavailable) return unavailable;
    return this.idempotent(IDEMPOTENCY_SCOPES.unpublishIdea, idempotencyKey, { ideaId, expectedLiveReleaseId }, async () => {
      const idea = this.idea(ideaId);
      if (!idea) return fail<Result>("NOT_FOUND", "That idea does not exist.");
      // Emergency removal: no kill-switch or check gate, but strong auth still applies.
      const reauth = this.needsStrongAuth(guard.editor);
      if (reauth) return this.refuse("unpublish.requested", reauth, { ideaId });
      if (idea.publication.state !== "live" || idea.publication.liveReleaseId !== expectedLiveReleaseId) {
        return fail<Result>("PRECONDITION_FAILED", "This idea is not live with that release. Reload.");
      }
      const liveRelease = this.state.releases.get(expectedLiveReleaseId);
      const now = nowIso(this.state);
      // Revoke the pointer and advance the fence before acknowledging.
      idea.generation += 1;
      idea.publication.state = "unpublished";
      idea.publication.liveReleaseId = null;
      idea.publication.unpublishedAt = now;
      idea.publication.unpublishReason = parsedReason.data;
      const release: ReleaseRecord = {
        id: nextId(this.state, "rel"),
        ideaId: idea.id,
        operation: "unpublish",
        state: "verifying",
        revisionId: liveRelease?.revisionId ?? null,
        revisionNumber: liveRelease?.revisionNumber ?? null,
        approvalId: null,
        expectedLiveReleaseId,
        rollbackTargetReleaseId: null,
        generation: idea.generation,
        attempt: 1,
        reason: parsedReason.data,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
        requestedBy: this.actor(),
        steps: [
          { state: "publish_requested", at: now, detail: "Removal requested" },
          { state: "activating", at: now, detail: `Public pointer revoked; generation advanced to ${idea.generation}` },
          { state: "verifying", at: now, detail: `Waiting for removal probes${simulatedSuffix(this.state)}` },
        ],
        error: null,
        observation: null,
      };
      this.state.releases.set(release.id, release);
      this.stamp(idea);
      this.record("unpublish.requested", "succeeded", {
        ideaId: idea.id,
        releaseId: release.id,
        reason: parsedReason.data,
        detail: `Unpublished; removal pending verification${simulatedSuffix(this.state)}`,
      });
      return ok({ releaseId: release.id });
    });
  }

  async trashIdea(ideaId: string, expectedVersion: number, reason: string) {
    const guard = this.editor("idea.trashed", { ideaId });
    if (!guard.ok) return guard;
    type Result = { version: number };
    const parsedReason = reasonSchema.safeParse(reason);
    if (!parsedReason.success) return fail<Result>("INVALID_INPUT", "Give a reason for moving this to Trash.");
    const idea = this.idea(ideaId);
    if (!idea) return fail<Result>("NOT_FOUND", "That idea does not exist.");
    const reauth = this.needsStrongAuth(guard.editor);
    if (reauth) return this.refuse("idea.trashed", reauth, { ideaId });
    if (idea.lifecycle === "trashed") return fail<Result>("INVALID_TRANSITION", "This idea is already in Trash.");
    if (idea.version !== expectedVersion) return fail<Result>("VERSION_CONFLICT", "This idea changed since you opened it.");
    const inFlight = inFlightReleaseFor(this.state, idea.id);
    if (!canTrash(idea.publication.state, inFlight !== null)) {
      return this.refuse(
        "idea.trashed",
        idea.publication.state === "live"
          ? fail<Result>("IDEA_LIVE", "This idea is live. Unpublish it first.")
          : fail<Result>("RELEASE_IN_FLIGHT", "Wait for the running release to finish."),
        { ideaId },
      );
    }
    const actor = this.actor();
    revokeIdeaApprovals(this.state, idea.id, "Moved to Trash", actor);
    idea.trash = {
      trashedAt: nowIso(this.state),
      trashedBy: actor,
      reason: parsedReason.data,
      previousCandidate: idea.candidate.state,
      previousPublication: idea.publication.state,
    };
    idea.lifecycle = "trashed";
    idea.generation += 1;
    idea.version += 1;
    this.stamp(idea);
    this.record("idea.trashed", "succeeded", { ideaId, reason: parsedReason.data });
    return ok({ version: idea.version });
  }

  async restoreIdea(ideaId: string, expectedVersion: number, reason: string) {
    const guard = this.editor("idea.restored", { ideaId });
    if (!guard.ok) return guard;
    type Result = { version: number };
    const parsedReason = reasonSchema.safeParse(reason);
    if (!parsedReason.success) return fail<Result>("INVALID_INPUT", "Give a reason for restoring.");
    const idea = this.idea(ideaId);
    if (!idea) return fail<Result>("NOT_FOUND", "That idea does not exist.");
    if (idea.lifecycle !== "trashed") return fail<Result>("INVALID_TRANSITION", "This idea is not in Trash.");
    if (idea.version !== expectedVersion) return fail<Result>("VERSION_CONFLICT", "This idea changed since you opened it.");
    idea.lifecycle = "active";
    idea.trash = null;
    // Restored ideas are unpublished and waiting for review; approvals stay revoked.
    idea.candidate = {
      state: "new",
      reasonCategory: null,
      note: `Restored from Trash: ${parsedReason.data}`,
      question: null,
      decidedAt: nowIso(this.state),
      decidedBy: this.actor(),
    };
    idea.version += 1;
    this.stamp(idea);
    this.record("idea.restored", "succeeded", { ideaId, reason: parsedReason.data, detail: "Restored unpublished, awaiting review" });
    return ok({ version: idea.version });
  }
}
