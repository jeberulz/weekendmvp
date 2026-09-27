import type { QualityCheck } from "../../contracts/checks";
import type { CommandResult } from "../../contracts/errors";
import type { EditorialClaim, EditorialSource } from "../../contracts/evidence";
import type { EditorialMetadata } from "../../contracts/metadata";
import type {
  HumanPrincipal,
  IngestionPrincipal,
  PrincipalView,
  ReleaseWorkerPrincipal,
} from "../../contracts/principal";
import type {
  ApprovalStatus,
  CandidateState,
  LifecycleState,
  PublicationState,
  RejectReason,
  ReleaseOperation,
  ReleaseState,
  ReviewState,
  RevisionKind,
} from "../../contracts/states";
import type { EngineRecommendation, SubmissionProducer } from "../../contracts/submission";
import type { ActivityAction, IdeaOrigin } from "../../contracts/views";

/**
 * In-memory records for the local demo and tests. The shapes follow the
 * planned private tables (editorialIdeas, editorialRevisions, …) so the live
 * adapter (WP46-E4) can reuse the same derivation code over Convex documents.
 */

export type ActorRef = PrincipalView & { id: string };

export type IdeaRecord = {
  id: string;
  slug: string;
  slugConflict: boolean;
  duplicateOfIdeaId: string | null;
  title: string;
  buyer: string;
  job: string;
  wedge: string;
  origin: IdeaOrigin;
  engineRunId: string | null;
  engineRecommendation: { value: EngineRecommendation; reasons: string[] } | null;
  candidate: {
    state: CandidateState;
    reasonCategory: RejectReason | null;
    note: string | null;
    question: string | null;
    decidedAt: string | null;
    decidedBy: ActorRef | null;
  };
  lifecycle: LifecycleState;
  trash: {
    trashedAt: string;
    trashedBy: ActorRef;
    reason: string;
    previousCandidate: CandidateState;
    previousPublication: PublicationState;
  } | null;
  publication: {
    state: PublicationState;
    liveReleaseId: string | null;
    lastLiveReleaseId: string | null;
    firstPublishedAt: string | null;
    lastReleasedAt: string | null;
    unpublishedAt: string | null;
    unpublishReason: string | null;
  };
  workingRevisionId: string;
  /** Monotonic fence. Unpublish, trash and every activation advance it. */
  generation: number;
  /** Version fence for decisions, trash and restore. */
  version: number;
  labels: string[];
  legacy: { importedAt: string; bodyOrigin: "mdx" | "convex"; firstPublishedAt: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type RevisionRecord = {
  id: string;
  ideaId: string;
  number: number;
  kind: RevisionKind;
  origin: IdeaOrigin | "editor";
  parentRevisionId: string | null;
  createdAt: string;
  createdBy: ActorRef;
  updatedAt: string;
  updatedBy: ActorRef;
  /** Save fence for drafts; fixed for snapshots. */
  version: number;
  title: string;
  markdown: string;
  metadata: EditorialMetadata;
  sources: EditorialSource[];
  claims: EditorialClaim[];
  checks: QualityCheck[];
  checksRunAt: string | null;
  reviewState: ReviewState;
  changesRequestedNote: string | null;
  quarantine: { reasons: string[] } | null;
  discarded: boolean;
  submissionKey: string | null;
};

/** Attestations are idea-scoped and keyed by item + dependency hash. */
export type AttestationRecord = {
  id: string;
  ideaId: string;
  revisionId: string;
  itemId: string;
  dependencyHash: string;
  note: string | null;
  at: string;
  actor: ActorRef;
  retracted: boolean;
};

export type FlagRecord = {
  id: string;
  ideaId: string;
  revisionId: string;
  itemId: string;
  dependencyHash: string;
  severity: "high" | "low";
  note: string;
  at: string;
  actor: ActorRef;
  resolution: { note: string; at: string; actor: ActorRef } | null;
};

export type ResolutionRecord = {
  id: string;
  ideaId: string;
  issueId: string;
  dependencyHash: string;
  note: string;
  at: string;
  actor: ActorRef;
};

export type NoteRecord = {
  id: string;
  ideaId: string;
  revisionId: string;
  target: { kind: "section" | "claim" | "source" | "metadata"; id: string };
  note: string;
  at: string;
  actor: ActorRef;
};

export type ApprovalRecord = {
  id: string;
  ideaId: string;
  revisionId: string;
  revisionNumber: number;
  artifactHash: string;
  policyVersion: string;
  assessmentDigest: string;
  statement: string;
  note: string | null;
  approvedAt: string;
  approvedBy: ActorRef;
  status: ApprovalStatus;
  revokedAt: string | null;
  revokedReason: string | null;
};

export type ReleaseRecord = {
  id: string;
  ideaId: string;
  operation: ReleaseOperation;
  state: ReleaseState;
  revisionId: string | null;
  approvalId: string | null;
  expectedLiveReleaseId: string | null;
  rollbackTargetReleaseId: string | null;
  generation: number;
  attempt: number;
  reason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy: ActorRef;
  steps: { state: ReleaseState; at: string; detail: string | null }[];
  error: { code: string; message: string } | null;
  /** What the simulated world really did; revealed only by reconciliation. */
  simulatedWorld: { activated: boolean } | null;
};

export type AuditRecord = {
  id: string;
  at: string;
  actor: ActorRef;
  action: ActivityAction;
  outcome: "succeeded" | "denied" | "failed";
  ideaId: string | null;
  revisionId: string | null;
  releaseId: string | null;
  reason: string | null;
  detail: string | null;
  code: string | null;
  correlationId: string;
};

export type FixtureClock = { now(): number };

export type FixtureState = {
  clock: FixtureClock;
  sequence: number;
  /** Bumped on every mutation; derived views are memoised per epoch. */
  epoch: number;
  ideas: Map<string, IdeaRecord>;
  revisions: Map<string, RevisionRecord>;
  attestations: AttestationRecord[];
  flags: FlagRecord[];
  resolutions: ResolutionRecord[];
  notes: NoteRecord[];
  approvals: Map<string, ApprovalRecord>;
  releases: Map<string, ReleaseRecord>;
  audit: AuditRecord[];
  idempotency: Map<string, { requestHash: string; result: CommandResult<unknown> }>;
  submissions: Map<string, { artifactHash: string; ideaId: string; revisionId: string }>;
  slugs: Map<string, string>;
  policyVersion: string;
  killSwitchEngaged: boolean;
  editor: HumanPrincipal;
  ingestionTokens: Map<string, IngestionPrincipal>;
  worker: ReleaseWorkerPrincipal;
  injections: { failNextDeploy: boolean; loseNextActivationAck: boolean };
  /** Revisions whose next save first receives a simulated edit from another session. */
  concurrentEditHooks: Set<string>;
};

export const FIXTURE_POLICY_VERSION = "fixture-policy-2026-09.1";

export const FIXTURE_EDITOR_ID = "fixture-editor";

export function createEmptyState(clock: FixtureClock): FixtureState {
  return {
    clock,
    sequence: 0,
    epoch: 0,
    ideas: new Map(),
    revisions: new Map(),
    attestations: [],
    flags: [],
    resolutions: [],
    notes: [],
    approvals: new Map(),
    releases: new Map(),
    audit: [],
    idempotency: new Map(),
    submissions: new Map(),
    slugs: new Map(),
    policyVersion: FIXTURE_POLICY_VERSION,
    killSwitchEngaged: false,
    editor: {
      kind: "human",
      id: FIXTURE_EDITOR_ID,
      displayName: "Local demo editor",
      capability: "editorial_admin",
      strongAuthAt: null,
      session: "fixture",
    },
    ingestionTokens: new Map(),
    worker: { kind: "service", id: "fixture-release-worker", role: "release_worker" },
    injections: { failNextDeploy: false, loseNextActivationAck: false },
    concurrentEditHooks: new Set(),
  };
}

export function nowIso(state: FixtureState): string {
  return new Date(state.clock.now()).toISOString();
}

export function nextId(state: FixtureState, prefix: string): string {
  state.sequence += 1;
  return `${prefix}_${String(state.sequence).padStart(4, "0")}`;
}

export function touch(state: FixtureState): void {
  state.epoch += 1;
}

export function actorRef(
  principal: HumanPrincipal | IngestionPrincipal | ReleaseWorkerPrincipal | null,
): ActorRef {
  if (principal === null) return { id: "anonymous", kind: "system", label: "Anonymous request" };
  if (principal.kind === "human") {
    return {
      id: principal.id,
      kind: "human",
      label: principal.capability === "editorial_admin" ? principal.displayName : "Account without editorial access",
    };
  }
  if (principal.role === "ingestion") {
    return { id: principal.id, kind: "service", label: `Ingestion (${principal.producer})` };
  }
  return { id: principal.id, kind: "service", label: "Release worker (simulated)" };
}

export function appendAudit(
  state: FixtureState,
  entry: Omit<AuditRecord, "id" | "at" | "correlationId"> & { correlationId?: string },
): AuditRecord {
  const record: AuditRecord = {
    ...entry,
    id: nextId(state, "act"),
    at: nowIso(state),
    correlationId: entry.correlationId ?? nextId(state, "cor"),
  };
  state.audit.push(record);
  return record;
}

export function producerLabel(producer: SubmissionProducer): string {
  return producer === "engine" ? "Engine" : producer === "legacy-import" ? "Legacy importer" : "Manual";
}
