import type { CheckCategory, QualityCheck } from "./checks";
import type { ApprovalBlocker, EditorialTarget } from "./errors";
import type { EditorialClaim, EditorialSource } from "./evidence";
import type { EditorialMetadata } from "./metadata";
import type { PrincipalView } from "./principal";
import type { SectionKey } from "./sections";
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
} from "./states";
import type { EngineRecommendation } from "./submission";
import type { CategorySlug } from "./taxonomy";

export type IdeaOrigin = "engine" | "legacy" | "manual";
export type EvidenceFreshness = "fresh" | "aging" | "stale" | "unknown";

export type CandidateView = {
  state: CandidateState;
  reasonCategory: RejectReason | null;
  note: string | null;
  question: string | null;
  decidedAt: string | null;
  decidedBy: PrincipalView | null;
};

export type RevisionPointer = {
  id: string;
  number: number;
  kind: RevisionKind;
  reviewState: ReviewState;
  updatedAt: string;
};

export type IdeaListItem = {
  id: string;
  slug: string;
  /** The proposed slug collides with another idea and is not reserved. */
  slugConflict: boolean;
  title: string;
  buyer: string;
  job: string;
  wedge: string;
  category: CategorySlug;
  origin: IdeaOrigin;
  engineRunId: string | null;
  candidate: CandidateView;
  /** The engine's recommendation, kept apart from your decision. */
  engineRecommendation: { value: EngineRecommendation; reasons: string[] } | null;
  workingRevision: RevisionPointer | null;
  liveRevision: { id: string; number: number; releasedAt: string } | null;
  publication: PublicationState;
  pendingOperation: { releaseId: string; operation: ReleaseOperation; state: ReleaseState } | null;
  approval: { status: ApprovalStatus; revisionNumber: number } | null;
  blockers: { blocking: number; warnings: number; evidence: number; top: string | null };
  review: {
    sectionsReviewed: number;
    sectionsTotal: number;
    itemsReviewed: number;
    itemsTotal: number;
  };
  evidence: {
    freshness: EvidenceFreshness;
    staleSources: number;
    unavailableSources: number;
    oldestRetrievedAt: string | null;
  };
  lifecycle: LifecycleState;
  duplicateOf: { id: string; title: string } | null;
  labels: string[];
  updatedAt: string;
  /** Idea-level version fence for decisions, trash and restore. */
  version: number;
};

export const QUEUE_BUCKETS = [
  "new",
  "awaiting_review",
  "needs_research",
  "changes_requested",
  "rejected",
] as const;
export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

export const QUEUE_BUCKET_LABELS: Record<QueueBucket, string> = {
  new: "New candidates",
  awaiting_review: "Awaiting copy review",
  needs_research: "Needs research",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

export type QueueSummary = {
  needReview: number;
  blockedByEvidence: number;
  releasesNeedingAttention: number;
  buckets: Record<QueueBucket, number>;
};

/**
 * One page of a cursor-paginated list. `total` counts every match; a list the
 * store cannot count cheaply (the live activity log) uses `number | null`.
 */
export type Page<T, Total extends number | null = number> = { items: T[]; nextCursor: string | null; total: Total };

export type ApprovalView = {
  id: string;
  revisionId: string;
  revisionNumber: number;
  artifactHash: string;
  policyVersion: string;
  status: ApprovalStatus;
  approvedAt: string;
  approvedBy: PrincipalView;
  statement: string;
  note: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
};

export type RevisionSummary = {
  id: string;
  ideaId: string;
  number: number;
  kind: RevisionKind;
  reviewState: ReviewState;
  origin: IdeaOrigin | "editor";
  parentRevisionId: string | null;
  createdAt: string;
  createdBy: PrincipalView;
  updatedAt: string;
  version: number;
  artifactHash: string;
  isLive: boolean;
  isWorking: boolean;
  discarded: boolean;
  approval: ApprovalView | null;
};

export type ReviewStatus = "unreviewed" | "reviewed" | "stale" | "flagged";

export type ReviewStatusView = {
  status: ReviewStatus;
  attestedAt: string | null;
  note: string | null;
};

export type EvidenceLabel =
  | "machine_verified"
  | "reviewed_by_you"
  | "unavailable"
  | "changed_since_review"
  | "provisional"
  | "assumption"
  | "unverified";

export type SourceView = EditorialSource & {
  domain: string;
  freshness: EvidenceFreshness;
  freshnessWindowDays: number | null;
  claimIds: string[];
  review: ReviewStatusView;
  labels: EvidenceLabel[];
};

export type ClaimView = EditorialClaim & {
  /** False when the verified wording no longer appears in its section. */
  anchorPresent: boolean;
  review: ReviewStatusView;
  labels: EvidenceLabel[];
};

export type CheckView = QualityCheck & {
  /** Evaluated against this revision's artifact hash and current policy. */
  current: boolean;
  resolution: { note: string; at: string } | null;
};

export type SectionView = {
  key: SectionKey;
  title: string;
  order: number;
  present: boolean;
  hash: string | null;
  words: number;
  startLine: number | null;
  review: ReviewStatusView;
  issueCount: number;
};

export type ReviewItemKind = "section" | "claim" | "source" | "assumptions" | "metadata" | "preview";

export type ReviewItemView = {
  id: string;
  kind: ReviewItemKind;
  label: string;
  target: EditorialTarget | null;
  dependencyHash: string;
  status: ReviewStatus;
  attestedAt: string | null;
  note: string | null;
  flag: { severity: "high" | "low"; note: string; resolved: boolean; resolutionNote: string | null } | null;
};

export type IssueView = {
  id: string;
  severity: "blocker" | "warning";
  category: CheckCategory;
  message: string;
  target: EditorialTarget | null;
  /** Warnings may be resolved with a reason; blockers never can. */
  resolvable: boolean;
  resolution: { note: string; at: string } | null;
  dependencyHash: string;
};

export type EditorialNoteView = {
  id: string;
  target: EditorialTarget;
  note: string;
  at: string;
  author: PrincipalView;
};

export type ContentCounts = {
  proseWords: number;
  readingMinutes: number;
  sectionsPresent: number;
  sectionsExpected: number;
  prompts: number;
  codeBlocks: number;
};

export type RevisionView = RevisionSummary & {
  title: string;
  markdown: string;
  metadata: EditorialMetadata;
  sources: SourceView[];
  claims: ClaimView[];
  checks: CheckView[];
  hashes: { content: string; metadata: string; evidence: string; artifact: string };
  sections: SectionView[];
  counts: ContentCounts;
  reviewItems: ReviewItemView[];
  issues: IssueView[];
  eligibility: { canApprove: boolean; blockers: ApprovalBlocker[] };
  readOnly: boolean;
  readOnlyReason: string | null;
  quarantine: { reasons: string[] } | null;
  policy: { version: string; checksCurrent: boolean; checksRunAt: string | null };
  notes: EditorialNoteView[];
  changesRequestedNote: string | null;
};

export type ReleaseStepView = {
  state: ReleaseState;
  label: string;
  at: string;
  detail: string | null;
};

export type ReleaseAction = "publish" | "cancel" | "retry" | "reconcile";

export type ReleaseView = {
  id: string;
  ideaId: string;
  ideaTitle: string;
  ideaSlug: string;
  operation: ReleaseOperation;
  state: ReleaseState;
  revisionId: string | null;
  revisionNumber: number | null;
  approvalId: string | null;
  attempt: number;
  generation: number;
  createdAt: string;
  updatedAt: string;
  requestedBy: PrincipalView;
  reason: string | null;
  steps: ReleaseStepView[];
  error: { code: string; message: string } | null;
  preview: { label: string; href: string | null } | null;
  publicPath: string;
  previousLiveReleaseId: string | null;
  rollbackTargetReleaseId: string | null;
  /** Fixture releases never touch a deployment. */
  simulated: boolean;
  availableActions: ReleaseAction[];
};

export type IdeaDetail = {
  idea: IdeaListItem;
  revisions: RevisionSummary[];
  releases: ReleaseView[];
  activeApproval: ApprovalView | null;
  generation: number;
  legacy: { importedAt: string; bodyOrigin: "mdx" | "convex"; firstPublishedAt: string | null } | null;
  trash: { trashedAt: string; reason: string; trashedBy: PrincipalView } | null;
  unpublish: { at: string; reason: string } | null;
};

export type TrashItem = {
  ideaId: string;
  title: string;
  slug: string;
  trashedAt: string;
  trashedBy: PrincipalView;
  reason: string;
  previousPublication: PublicationState;
  previousCandidate: CandidateState;
  version: number;
};

export const ACTIVITY_ACTIONS = [
  "submission.imported",
  "submission.rejected",
  "revision.created",
  "revision.saved",
  "revision.discarded",
  "candidate.decided",
  "review.attested",
  "review.retracted",
  "review.flagged",
  "review.resolved",
  "review.changes_requested",
  "review.resumed",
  "note.added",
  "checks.run",
  "approval.granted",
  "approval.revoked",
  "release.prepared",
  "release.requested",
  "release.advanced",
  "release.failed",
  "release.cancelled",
  "release.retried",
  "release.reconciled",
  "release.succeeded",
  "rollback.requested",
  "unpublish.requested",
  "idea.trashed",
  "idea.restored",
  "settings.changed",
  "access.denied",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityEntry = {
  id: string;
  at: string;
  actor: PrincipalView;
  action: ActivityAction;
  outcome: "succeeded" | "denied" | "failed";
  ideaId: string | null;
  ideaTitle: string | null;
  revisionNumber: number | null;
  releaseId: string | null;
  reason: string | null;
  /** Redacted detail: never bodies, tokens or provider payloads. */
  detail: string | null;
  code: string | null;
  correlationId: string;
};

export type IntegrationStatus = {
  id: "auth" | "engine" | "legacy_import" | "release_worker" | "public_site";
  label: string;
  configured: boolean;
  verified: boolean;
  available: boolean;
  detail: string;
};

export type SettingsView = {
  mode: "fixture" | "live";
  principal: PrincipalView;
  capability: { configured: boolean; verified: boolean; detail: string };
  strongAuth: { at: string | null; fresh: boolean; mechanism: string };
  integrations: IntegrationStatus[];
  policy: { version: string; label: string; requiredChecks: string[] };
  publishing: {
    readiness: "unavailable" | "simulated" | "ready";
    killSwitchEngaged: boolean;
    detail: string;
  };
};
