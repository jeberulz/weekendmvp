import type {
  ActivityFilter,
  ApprovalInput,
  CandidateDecisionInput,
  FlagInput,
  IdeaFilter,
  ImportAck,
  ReleaseFilter,
  ReviewAck,
  SaveDraftAck,
  SaveDraftPatch,
} from "./commands";
import type { CommandResult, EditorialTarget } from "./errors";
import type { IngestionCredential } from "./principal";
import type { ReleaseState } from "./states";
import type {
  ActivityEntry,
  IdeaDetail,
  IdeaListItem,
  Page,
  QueueSummary,
  ReleaseView,
  RevisionView,
  SettingsView,
  TrashItem,
} from "./views";

/**
 * Editorial repository v1.
 *
 * One instance is bound to one server-established principal (a verified
 * session, an ingestion credential or the release worker). Nothing here takes
 * an actor ID, role, approval status, live pointer or verification flag from
 * the caller: the adapter derives identity and re-checks every precondition.
 * UI gating only explains errors; this boundary enforces them.
 *
 * The fixture adapter implements it in memory for local demos and tests. The
 * live adapter (WP46-E4) must pass the same contract suite in
 * `tests/editorial/contract/repository-contract.ts`.
 */
export interface EditorialRepository {
  readonly mode: "fixture" | "live";

  /* Reads ---------------------------------------------------------- */
  getQueueSummary(): Promise<CommandResult<QueueSummary>>;
  listIdeas(
    filter: IdeaFilter,
    cursor: string | null,
    pageSize: number,
  ): Promise<CommandResult<Page<IdeaListItem>>>;
  getIdea(ideaId: string): Promise<CommandResult<IdeaDetail>>;
  getRevision(ideaId: string, revisionId: string): Promise<CommandResult<RevisionView>>;
  listReleases(
    filter: ReleaseFilter,
    cursor: string | null,
    pageSize: number,
  ): Promise<CommandResult<Page<ReleaseView>>>;
  listTrash(cursor: string | null, pageSize: number): Promise<CommandResult<Page<TrashItem>>>;
  /** `total` is `null` when the store cannot count the log cheaply. */
  listActivity(
    filter: ActivityFilter,
    cursor: string | null,
    pageSize: number,
  ): Promise<CommandResult<Page<ActivityEntry, number | null>>>;
  getSettings(): Promise<CommandResult<SettingsView>>;

  /* Ingestion: quarantined submissions only, never a human decision. */
  importSubmission(envelope: unknown, credential: IngestionCredential): Promise<CommandResult<ImportAck>>;

  /* Revisions ------------------------------------------------------ */
  /** Fork an editable draft from a submitted, approved or live snapshot. */
  createRevision(
    ideaId: string,
    fromRevisionId: string,
    idempotencyKey: string,
  ): Promise<CommandResult<{ revisionId: string; number: number }>>;
  /** Drop a working draft; live content and earlier revisions are untouched. */
  discardRevision(
    ideaId: string,
    revisionId: string,
    expectedVersion: number,
    reason: string,
  ): Promise<CommandResult<{ workingRevisionId: string }>>;
  /** Version-fenced save. A stale base version returns `VERSION_CONFLICT`. */
  saveDraft(
    ideaId: string,
    revisionId: string,
    baseVersion: number,
    patch: SaveDraftPatch,
    idempotencyKey: string,
  ): Promise<CommandResult<SaveDraftAck>>;

  /* Candidate decision --------------------------------------------- */
  setCandidateDecision(
    ideaId: string,
    expectedVersion: number,
    input: CandidateDecisionInput,
  ): Promise<CommandResult<{ version: number; revokedApprovals: number }>>;

  /* Review ---------------------------------------------------------- */
  markReviewed(
    revisionId: string,
    reviewItemId: string,
    dependencyHash: string,
    note: string | null,
  ): Promise<CommandResult<ReviewAck>>;
  retractReview(revisionId: string, reviewItemId: string): Promise<CommandResult<ReviewAck>>;
  flagReviewItem(
    revisionId: string,
    reviewItemId: string,
    dependencyHash: string,
    input: FlagInput,
  ): Promise<CommandResult<ReviewAck>>;
  /** Resolve a warning or discrepancy with a written reason. Blockers refuse. */
  resolveIssue(
    revisionId: string,
    issueId: string,
    dependencyHash: string,
    note: string,
  ): Promise<CommandResult<{ issueId: string }>>;
  addNote(revisionId: string, target: EditorialTarget, note: string): Promise<CommandResult<{ noteId: string }>>;
  requestChanges(revisionId: string, note: string): Promise<CommandResult<ReviewAck>>;
  resumeReview(revisionId: string): Promise<CommandResult<ReviewAck>>;
  runChecks(revisionId: string, expectedArtifactHash: string): Promise<CommandResult<{ checksRunAt: string }>>;
  approveRevision(
    revisionId: string,
    artifactHash: string,
    input: ApprovalInput,
  ): Promise<CommandResult<{ approvalId: string }>>;

  /* Releases and lifecycle ------------------------------------------ */
  /** Stage a protected preview for one approved revision. */
  prepareRelease(
    revisionId: string,
    expectedLiveReleaseId: string | null,
    idempotencyKey: string,
  ): Promise<CommandResult<{ releaseId: string }>>;
  /** Record the exact production release intent (needs recent strong auth). */
  publishRelease(
    releaseId: string,
    expectedState: ReleaseState,
    approvalId: string,
    idempotencyKey: string,
  ): Promise<CommandResult<{ releaseId: string }>>;
  cancelRelease(releaseId: string, expectedState: ReleaseState, reason: string): Promise<CommandResult<{ releaseId: string }>>;
  retryRelease(
    releaseId: string,
    expectedState: ReleaseState,
    idempotencyKey: string,
  ): Promise<CommandResult<{ releaseId: string }>>;
  /** Probe an uncertain activation and record what actually happened. */
  reconcileRelease(releaseId: string): Promise<CommandResult<{ releaseId: string; state: ReleaseState }>>;
  requestRollback(
    ideaId: string,
    targetReleaseId: string,
    expectedLiveReleaseId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<CommandResult<{ releaseId: string }>>;
  unpublishIdea(
    ideaId: string,
    expectedLiveReleaseId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<CommandResult<{ releaseId: string }>>;
  trashIdea(ideaId: string, expectedVersion: number, reason: string): Promise<CommandResult<{ version: number }>>;
  restoreIdea(ideaId: string, expectedVersion: number, reason: string): Promise<CommandResult<{ version: number }>>;
}
