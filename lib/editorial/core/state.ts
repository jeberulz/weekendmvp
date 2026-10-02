import type { QualityCheck } from "../contracts/checks";
import type { CommandResult } from "../contracts/errors";
import type { EditorialClaim, EditorialSource } from "../contracts/evidence";
import type { EditorialMetadata } from "../contracts/metadata";
import type {
  HumanPrincipal,
  IngestionPrincipal,
  PrincipalView,
  ReleaseWorkerPrincipal,
} from "../contracts/principal";
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
} from "../contracts/states";
import type { EngineRecommendation, SubmissionProducer } from "../contracts/submission";
import type { ActivityAction, ContentCounts, IdeaOrigin } from "../contracts/views";

/**
 * Store-neutral editorial records and the state the core rules run over.
 *
 * The fixture adapter keeps one state for the whole demo in memory. The live
 * adapter loads one idea's records from Convex into the same shape for a
 * single transaction, runs the same rules, and writes back what changed, so
 * both adapters share every rule.
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
  /** Copied from the revision when the release is created (lists never load bodies). */
  revisionNumber: number | null;
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
  /**
   * What a probe of the public site observed after an uncertain activation.
   * Recorded by the release worker (simulated in the local demo); a human
   * reconciliation applies it and never retries the activation blindly.
   */
  observation: { activated: boolean; observedAt: string } | null;
};

export type AuditRecord = {
  id: string;
  at: string;
  actor: ActorRef;
  action: ActivityAction;
  outcome: "succeeded" | "denied" | "failed";
  ideaId: string | null;
  revisionId: string | null;
  /** Copied from the revision when the entry is written. */
  revisionNumber: number | null;
  releaseId: string | null;
  reason: string | null;
  detail: string | null;
  code: string | null;
  correlationId: string;
};

export type IdempotencyRecord = { requestHash: string; result: CommandResult<unknown> };
export type SubmissionRecord = { artifactHash: string; ideaId: string; revisionId: string };

/* Environment seams ------------------------------------------------------ */

export type EditorialClock = { now(): number };
export type IdSource = { next(prefix: string): string };

export type CheckRunInput = {
  markdown: string;
  sources: readonly Pick<EditorialSource, "id" | "sourceType" | "retrievedAt">[];
  artifactHash: string;
  policyVersion: string;
  nowMs: number;
};

/**
 * The quality policy in force. `run: null` means no check library is
 * connected in this environment: checks cannot run, so nothing can be
 * approved (the live adapter until WP45 lands in WP46-E5).
 */
export type CheckPolicy = {
  label: string;
  requiredCheckIds: readonly string[];
  run: ((input: CheckRunInput) => QualityCheck[]) | null;
  unavailableReason: string;
};

/** Whether a release worker exists to carry out release intents. */
export type ReleaseCapability = { available: true } | { available: false; reason: string };

/**
 * Display-only measurements (prose words, reading time, prompts, code
 * blocks). They need the Markdown parser, which the Convex runtime cannot
 * load, so the live backend leaves them to the Next.js adapter (`null`).
 */
export type ContentMeasure = {
  content(markdown: string): ContentCounts;
  sectionWords(body: string): number;
};

export type CoreEnvironment = {
  mode: "fixture" | "live";
  /** The local demo narrates releases and previews as simulated. */
  simulated: boolean;
  checks: CheckPolicy;
  releases: ReleaseCapability;
  /** Recorded as the actor of worker steps and confirmed activations. */
  workerActor: ActorRef;
  measure: ContentMeasure | null;
};

export type EditorialState = {
  env: CoreEnvironment;
  clock: EditorialClock;
  ids: IdSource;
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
  idempotency: Map<string, IdempotencyRecord>;
  submissions: Map<string, SubmissionRecord>;
  slugs: Map<string, string>;
  policyVersion: string;
  killSwitchEngaged: boolean;
};

export type EditorialStateInit = Pick<EditorialState, "env" | "clock" | "ids" | "policyVersion"> &
  Partial<Pick<EditorialState, "killSwitchEngaged">>;

export function createEditorialState(init: EditorialStateInit): EditorialState {
  return {
    env: init.env,
    clock: init.clock,
    ids: init.ids,
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
    policyVersion: init.policyVersion,
    killSwitchEngaged: init.killSwitchEngaged ?? false,
  };
}

/** Sequential ids (`idea_0001`): deterministic for the local demo and its tests. */
export function createSequentialIds(): IdSource {
  let sequence = 0;
  return {
    next(prefix) {
      sequence += 1;
      return `${prefix}_${String(sequence).padStart(4, "0")}`;
    },
  };
}

export function nowIso(state: EditorialState): string {
  return new Date(state.clock.now()).toISOString();
}

export function nextId(state: EditorialState, prefix: string): string {
  return state.ids.next(prefix);
}

export function touch(state: EditorialState): void {
  state.epoch += 1;
}

export function actorRef(
  principal: HumanPrincipal | IngestionPrincipal | ReleaseWorkerPrincipal | null,
  env: Pick<CoreEnvironment, "simulated">,
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
  return { id: principal.id, kind: "service", label: env.simulated ? "Release worker (simulated)" : "Release worker" };
}

export function appendAudit(
  state: EditorialState,
  entry: Omit<AuditRecord, "id" | "at" | "correlationId" | "revisionNumber"> & { correlationId?: string },
): AuditRecord {
  const record: AuditRecord = {
    ...entry,
    id: nextId(state, "act"),
    at: nowIso(state),
    revisionNumber: entry.revisionId ? (state.revisions.get(entry.revisionId)?.number ?? null) : null,
    correlationId: entry.correlationId ?? nextId(state, "cor"),
  };
  state.audit.push(record);
  return record;
}

export function producerLabel(producer: SubmissionProducer): string {
  return producer === "engine" ? "Engine" : producer === "legacy-import" ? "Legacy importer" : "Manual";
}

/** " (simulated)" in the local demo, nothing in live mode. */
export function simulatedSuffix(state: EditorialState): string {
  return state.env.simulated ? " (simulated)" : "";
}
