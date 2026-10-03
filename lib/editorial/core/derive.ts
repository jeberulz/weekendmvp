import type { ApprovalBlocker } from "../contracts/errors";
import type {
  EditorialClaim,
  EditorialSource,
  SourceType,
  SourceVerificationStatus,
} from "../contracts/evidence";
import { displayDomain } from "../contracts/primitives";
import { SECTION_DEFINITIONS, type SectionKey } from "../contracts/sections";
import { isReleaseInFlight, releaseStateLabel } from "../contracts/states";
import type {
  ApprovalView,
  CheckView,
  ClaimView,
  EvidenceLabel,
  IdeaListItem,
  ReleaseAction,
  ReleaseView,
  ReviewItemView,
  ReviewStatusView,
  RevisionSummary,
  RevisionView,
  SectionView,
  SourceView,
} from "../contracts/views";
import { assessmentDigest, computeRevisionHashes, type RevisionHashes } from "../domain/artifact";
import {
  computeApprovalBlockers,
  deriveIssues,
  toIssueViews,
  type DerivedIssue,
  type IssueResolution,
} from "../domain/eligibility";
import { sourceFreshness, worstFreshness } from "../domain/freshness";
import { deriveReviewItems } from "../domain/review-items";
import { containsNormalized, sectionsByKey, splitSections } from "../domain/structure";
import type {
  ActorRef,
  ApprovalRecord,
  EditorialState,
  IdeaRecord,
  ReleaseRecord,
  RevisionRecord,
} from "./state";

export type DerivedRevision = {
  view: RevisionView;
  issues: DerivedIssue[];
  blockers: ApprovalBlocker[];
  hashes: RevisionHashes;
  assessment: string;
  checksCurrent: boolean;
};

const memo = new WeakMap<EditorialState, Map<string, { epoch: number; value: DerivedRevision }>>();

export function principalView(actor: ActorRef) {
  return { kind: actor.kind, label: actor.label };
}

export function approvalView(approval: ApprovalRecord): ApprovalView {
  return {
    id: approval.id,
    revisionId: approval.revisionId,
    revisionNumber: approval.revisionNumber,
    artifactHash: approval.artifactHash,
    policyVersion: approval.policyVersion,
    status: approval.status,
    approvedAt: approval.approvedAt,
    approvedBy: principalView(approval.approvedBy),
    statement: approval.statement,
    note: approval.note,
    revokedAt: approval.revokedAt,
    revokedReason: approval.revokedReason,
  };
}

export function latestApprovalFor(state: EditorialState, revisionId: string): ApprovalRecord | null {
  let latest: ApprovalRecord | null = null;
  for (const approval of state.approvals.values()) {
    if (approval.revisionId !== revisionId) continue;
    if (!latest || approval.approvedAt >= latest.approvedAt) latest = approval;
  }
  return latest;
}

export function activeApprovalForIdea(state: EditorialState, ideaId: string): ApprovalRecord | null {
  for (const approval of state.approvals.values()) {
    if (approval.ideaId === ideaId && approval.status === "active") return approval;
  }
  return null;
}

export function liveRevisionId(state: EditorialState, idea: IdeaRecord): string | null {
  if (!idea.publication.liveReleaseId) return null;
  return state.releases.get(idea.publication.liveReleaseId)?.revisionId ?? null;
}

function reviewStatusFor(
  state: EditorialState,
  ideaId: string,
  itemId: string,
  dependencyHash: string,
): { status: ReviewStatusView; flag: ReviewItemView["flag"] } {
  let latest: EditorialState["attestations"][number] | null = null;
  for (const attestation of state.attestations) {
    if (attestation.ideaId !== ideaId || attestation.itemId !== itemId || attestation.retracted) continue;
    if (!latest || attestation.at >= latest.at) latest = attestation;
  }
  let openFlag: EditorialState["flags"][number] | null = null;
  let lastFlag: EditorialState["flags"][number] | null = null;
  for (const flag of state.flags) {
    if (flag.ideaId !== ideaId || flag.itemId !== itemId) continue;
    if (!lastFlag || flag.at >= lastFlag.at) lastFlag = flag;
    if (flag.resolution === null && (!openFlag || flag.at >= openFlag.at)) openFlag = flag;
  }
  const flagView: ReviewItemView["flag"] = lastFlag
    ? {
        severity: lastFlag.severity,
        note: lastFlag.note,
        resolved: lastFlag.resolution !== null,
        resolutionNote: lastFlag.resolution?.note ?? null,
      }
    : null;

  if (openFlag) {
    return {
      status: { status: "flagged", attestedAt: openFlag.at, note: openFlag.note },
      flag: flagView,
    };
  }
  if (!latest) return { status: { status: "unreviewed", attestedAt: null, note: null }, flag: flagView };
  return {
    status: {
      status: latest.dependencyHash === dependencyHash ? "reviewed" : "stale",
      attestedAt: latest.at,
      note: latest.note,
    },
    flag: flagView,
  };
}

function claimLabels(claim: EditorialClaim, review: ReviewStatusView): EvidenceLabel[] {
  const labels: EvidenceLabel[] = [];
  if (claim.kind === "assumed") labels.push("assumption");
  else {
    const status = claim.verification.status;
    if (status === "verified") labels.push("machine_verified");
    if (status === "provisional") labels.push("provisional");
    if (status === "unavailable") labels.push("unavailable");
    if (status === "changed") labels.push("changed_since_review");
    if (status === "unverified") labels.push("unverified");
  }
  if (review.status === "reviewed") labels.push("reviewed_by_you");
  if (review.status === "stale" && !labels.includes("changed_since_review")) labels.push("changed_since_review");
  return labels;
}

function sourceLabels(source: EditorialSource, review: ReviewStatusView): EvidenceLabel[] {
  const labels: EvidenceLabel[] = [];
  const status = source.verification.status;
  if (status === "verified") labels.push("machine_verified");
  if (status === "provisional") labels.push("provisional");
  if (status === "unavailable") labels.push("unavailable");
  if (status === "changed") labels.push("changed_since_review");
  if (status === "unverified") labels.push("unverified");
  if (review.status === "reviewed") labels.push("reviewed_by_you");
  if (review.status === "stale" && !labels.includes("changed_since_review")) labels.push("changed_since_review");
  return labels;
}

function readOnlyReason(state: EditorialState, idea: IdeaRecord, revision: RevisionRecord): string | null {
  if (idea.lifecycle === "trashed") return "This idea is in Trash. Restore it to edit.";
  if (revision.discarded) return "This revision was discarded.";
  if (idea.workingRevisionId !== revision.id) return "This is an earlier revision. Only the working revision is editable.";
  if (revision.kind === "approved_snapshot") return "Approved revisions are frozen. Create a revision to make changes.";
  if (revision.kind === "submitted") return "Submitted snapshots are read-only. Create a revision to edit.";
  if (revision.kind === "legacy_snapshot") {
    return state.releases.get(idea.publication.liveReleaseId ?? "")?.revisionId === revision.id
      ? "This is the live snapshot. Edit creates a private revision; the live page stays unchanged."
      : "Legacy snapshots are read-only. Create a revision to edit.";
  }
  return null;
}

export async function deriveRevision(state: EditorialState, revisionId: string): Promise<DerivedRevision> {
  let cache = memo.get(state);
  if (!cache) {
    cache = new Map();
    memo.set(state, cache);
  }
  const cached = cache.get(revisionId);
  if (cached && cached.epoch === state.epoch) return cached.value;

  const revision = state.revisions.get(revisionId);
  if (!revision) throw new Error(`Unknown revision ${revisionId}`);
  const idea = state.ideas.get(revision.ideaId);
  if (!idea) throw new Error(`Unknown idea ${revision.ideaId}`);
  const nowMs = state.clock.now();

  const hashes = await computeRevisionHashes(revision);
  const assessment = await assessmentDigest(revision.sources, revision.claims);
  const sections = sectionsByKey(splitSections(revision.markdown));
  const claimsWithAnchors = revision.claims.map((claim) => {
    const block = sections.get(claim.section);
    return { ...claim, anchorPresent: block ? containsNormalized(block.body, claim.anchorText) : false };
  });

  const definitions = await deriveReviewItems({
    sections,
    claims: claimsWithAnchors,
    sources: revision.sources,
    metadataHash: hashes.metadata,
    artifactHash: hashes.artifact,
  });
  const itemViews: ReviewItemView[] = definitions.map((definition) => {
    const { status, flag } = reviewStatusFor(state, idea.id, definition.id, definition.dependencyHash);
    return {
      ...definition,
      status: status.status,
      attestedAt: status.attestedAt,
      note: status.note,
      flag,
    };
  });
  const itemById = new Map(itemViews.map((item) => [item.id, item]));
  const statusView = (itemId: string): ReviewStatusView => {
    const item = itemById.get(itemId);
    return item
      ? { status: item.status, attestedAt: item.attestedAt, note: item.note }
      : { status: "unreviewed", attestedAt: null, note: null };
  };

  const resolutions = new Map<string, IssueResolution>();
  for (const resolution of state.resolutions) {
    if (resolution.ideaId !== idea.id) continue;
    const existing = resolutions.get(resolution.issueId);
    if (!existing || resolution.at >= existing.at) {
      resolutions.set(resolution.issueId, {
        dependencyHash: resolution.dependencyHash,
        note: resolution.note,
        at: resolution.at,
      });
    }
  }

  const checkViews: CheckView[] = revision.checks.map((check) => {
    const resolution = resolutions.get(`check:${check.id}`);
    return {
      ...check,
      current: check.evaluatedHash === hashes.artifact && check.policyVersion === state.policyVersion,
      resolution:
        resolution && resolution.dependencyHash === check.evaluatedHash
          ? { note: resolution.note, at: resolution.at }
          : null,
    };
  });
  const checksCurrent = checkViews.length > 0 && checkViews.every((check) => check.current);

  const claimViews: ClaimView[] = claimsWithAnchors.map((claim) => {
    const review = statusView(claim.kind === "assumed" ? "assumptions" : `claim:${claim.id}`);
    return { ...claim, review, labels: claimLabels(claim, review) };
  });

  const sourceViews: SourceView[] = revision.sources.map((source) => {
    const review = statusView(`source:${source.id}`);
    const freshness = sourceFreshness(source.sourceType, source.retrievedAt, nowMs);
    return {
      ...source,
      domain: displayDomain(source.url),
      freshness: freshness.freshness,
      freshnessWindowDays: freshness.windowDays,
      claimIds: revision.claims
        .filter((claim) => claim.sourceIds.includes(source.id) || claim.contradictingSourceIds.includes(source.id))
        .map((claim) => claim.id),
      review,
      labels: sourceLabels(source, review),
    };
  });

  const missingSections = SECTION_DEFINITIONS.filter((section) => !sections.has(section.key)).map(
    (section) => section.key,
  );
  const issues = deriveIssues({
    checks: checkViews,
    requiredCheckIds: state.env.checks.requiredCheckIds,
    checksCurrent,
    missingSections,
    claims: claimViews,
    reviewItems: itemViews,
    resolutions,
  });

  const isWorking = idea.workingRevisionId === revision.id;
  const latestApproval = latestApprovalFor(state, revision.id);
  const blockers = computeApprovalBlockers({
    candidateState: idea.candidate.state,
    lifecycle: idea.lifecycle,
    isWorkingRevision: isWorking && !revision.discarded,
    hasActiveApproval: latestApproval?.status === "active",
    reviewState: revision.reviewState,
    quarantined: revision.quarantine !== null,
    slugConflict: idea.slugConflict,
    issues,
    reviewItems: itemViews,
  });
  // An external runner is valid only when its results are committed by the
  // trusted backend path; a missing runner still blocks every approval.
  if (state.env.checks.run === null && !state.env.checks.externalRun) {
    blockers.unshift({
      code: "CHECKS_NOT_RUN",
      message: state.env.checks.unavailableReason,
      target: { kind: "artifact", id: "checks" },
    });
  }

  const sectionViews: SectionView[] = SECTION_DEFINITIONS.map((definition, order) => {
    const block = sections.get(definition.key);
    const item = itemById.get(`section:${definition.key}`);
    return {
      key: definition.key,
      title: definition.title,
      order: order + 1,
      present: Boolean(block),
      hash: item?.dependencyHash ?? null,
      words: block && state.env.measure ? state.env.measure.sectionWords(block.body) : 0,
      startLine: block?.headingLine ?? null,
      review: statusView(`section:${definition.key}`),
      issueCount: issues.filter(
        (issue) => issue.target?.kind === "section" && issue.target.id === (definition.key as SectionKey),
      ).length,
    };
  });

  const liveId = liveRevisionId(state, idea);
  const checksRunAt = revision.checksRunAt;
  const view: RevisionView = {
    ...revisionSummary(state, idea, revision, hashes.artifact, liveId),
    title: revision.title,
    markdown: revision.markdown,
    metadata: revision.metadata,
    sources: sourceViews,
    claims: claimViews,
    checks: checkViews,
    hashes,
    sections: sectionViews,
    counts: state.env.measure ? state.env.measure.content(revision.markdown) : structuralCounts(sections),
    reviewItems: itemViews,
    issues: toIssueViews(issues),
    eligibility: { canApprove: blockers.length === 0, blockers },
    readOnly: readOnlyReason(state, idea, revision) !== null,
    readOnlyReason: readOnlyReason(state, idea, revision),
    quarantine: revision.quarantine,
    policy: { version: state.policyVersion, checksCurrent, checksRunAt },
    notes: state.notes
      .filter((note) => note.ideaId === idea.id)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .map((note) => ({
        id: note.id,
        target: note.target,
        note: note.note,
        at: note.at,
        author: principalView(note.actor),
      })),
    changesRequestedNote: revision.changesRequestedNote,
  };

  const value: DerivedRevision = { view, issues, blockers, hashes, assessment, checksCurrent };
  cache.set(revisionId, { epoch: state.epoch, value });
  return value;
}

/** Counts that need no parser; the rest are measured where the parser can run. */
function structuralCounts(sections: ReturnType<typeof sectionsByKey>): RevisionView["counts"] {
  return {
    proseWords: 0,
    readingMinutes: 0,
    sectionsPresent: SECTION_DEFINITIONS.filter((section) => sections.has(section.key)).length,
    sectionsExpected: SECTION_DEFINITIONS.length,
    prompts: 0,
    codeBlocks: 0,
  };
}

export function revisionSummary(
  state: EditorialState,
  idea: IdeaRecord,
  revision: RevisionRecord,
  artifactHash: string,
  liveId: string | null,
): RevisionSummary {
  const approval = latestApprovalFor(state, revision.id);
  return {
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
    artifactHash,
    isLive: liveId === revision.id,
    isWorking: idea.workingRevisionId === revision.id,
    discarded: revision.discarded,
    approval: approval ? approvalView(approval) : null,
  };
}

function releaseActions(release: ReleaseRecord): ReleaseAction[] {
  if (release.operation === "legacy_baseline") return [];
  switch (release.state) {
    case "preview_ready":
      return ["publish", "cancel"];
    case "preparing":
    case "publish_requested":
    case "deploying":
    case "verifying":
      return release.operation === "unpublish" ? [] : ["cancel"];
    case "failed":
      return release.operation === "unpublish" ? ["retry"] : ["retry", "cancel"];
    case "needs_reconciliation":
      return ["reconcile"];
    default:
      return [];
  }
}

export function releaseView(state: EditorialState, release: ReleaseRecord): ReleaseView {
  const idea = state.ideas.get(release.ideaId);
  const previewAvailable =
    release.operation !== "unpublish" &&
    release.operation !== "legacy_baseline" &&
    release.state !== "preparing" &&
    release.revisionId !== null;
  return {
    id: release.id,
    ideaId: release.ideaId,
    ideaTitle: idea?.title ?? "Unknown idea",
    ideaSlug: idea?.slug ?? "",
    operation: release.operation,
    state: release.state,
    revisionId: release.revisionId,
    revisionNumber: release.revisionNumber,
    approvalId: release.approvalId,
    attempt: release.attempt,
    generation: release.generation,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    requestedBy: principalView(release.requestedBy),
    reason: release.reason,
    steps: release.steps.map((step) => ({
      state: step.state,
      label: releaseStateLabel(release.operation, step.state),
      at: step.at,
      detail: step.detail,
    })),
    error: release.error,
    preview: previewAvailable
      ? {
          label: state.env.simulated
            ? "Simulated preview (editorial renderer, nothing was built)"
            : "Editorial preview (public rendering not yet verified)",
          href: `/admin/editorial/ideas/${release.ideaId}?revision=${release.revisionId}&tab=preview`,
        }
      : null,
    publicPath: `/ideas/${idea?.slug ?? ""}`,
    previousLiveReleaseId: release.expectedLiveReleaseId,
    rollbackTargetReleaseId: release.rollbackTargetReleaseId,
    simulated: state.env.simulated,
    availableActions: releaseActions(release),
  };
}

/** The release that still needs a human: in flight, failed or uncertain. */
export function pendingReleaseFor(state: EditorialState, ideaId: string): ReleaseRecord | null {
  let latest: ReleaseRecord | null = null;
  for (const release of state.releases.values()) {
    if (release.ideaId !== ideaId || release.operation === "legacy_baseline") continue;
    if (!latest || release.createdAt >= latest.createdAt) latest = release;
  }
  if (!latest) return null;
  return isReleaseInFlight(latest.state) || latest.state === "failed" ? latest : null;
}

export async function deriveListItem(state: EditorialState, idea: IdeaRecord): Promise<IdeaListItem> {
  const working = state.revisions.get(idea.workingRevisionId);
  if (!working) throw new Error(`Idea ${idea.id} has no working revision`);
  const derived = await deriveRevision(state, working.id);
  const view = derived.view;
  const liveId = liveRevisionId(state, idea);
  const liveRevision = liveId ? state.revisions.get(liveId) : undefined;
  const liveRelease = idea.publication.liveReleaseId ? state.releases.get(idea.publication.liveReleaseId) : undefined;
  const pending = pendingReleaseFor(state, idea.id);

  let latestApproval: ApprovalRecord | null = null;
  for (const approval of state.approvals.values()) {
    if (approval.ideaId !== idea.id) continue;
    if (!latestApproval || approval.approvedAt >= latestApproval.approvedAt) latestApproval = approval;
  }

  // A legacy snapshot is not under review: never downgrade a live page for
  // predating the checks. Only quarantined markup is surfaced as blocking.
  const legacySnapshot = working.kind === "legacy_snapshot";
  const blocking = legacySnapshot
    ? working.quarantine
      ? [{ message: "Unsafe legacy markup is quarantined", category: "safety" }]
      : []
    : derived.issues.filter((issue) => issue.severity === "blocker");
  const warnings = legacySnapshot
    ? []
    : derived.issues.filter((issue) => issue.severity === "warning" && !issue.resolution);
  const sectionItems = view.reviewItems.filter((item) => item.kind === "section");
  const duplicate = idea.duplicateOfIdeaId ? state.ideas.get(idea.duplicateOfIdeaId) : undefined;

  return {
    id: idea.id,
    slug: idea.slug,
    slugConflict: idea.slugConflict,
    title: idea.title,
    buyer: idea.buyer,
    job: idea.job,
    wedge: idea.wedge,
    category: working.metadata.category,
    origin: idea.origin,
    engineRunId: idea.engineRunId,
    candidate: {
      state: idea.candidate.state,
      reasonCategory: idea.candidate.reasonCategory,
      note: idea.candidate.note,
      question: idea.candidate.question,
      decidedAt: idea.candidate.decidedAt,
      decidedBy: idea.candidate.decidedBy ? principalView(idea.candidate.decidedBy) : null,
    },
    engineRecommendation: idea.engineRecommendation,
    workingRevision: {
      id: working.id,
      number: working.number,
      kind: working.kind,
      reviewState: working.reviewState,
      updatedAt: working.updatedAt,
    },
    liveRevision:
      liveRevision && liveRelease
        ? { id: liveRevision.id, number: liveRevision.number, releasedAt: liveRelease.updatedAt }
        : null,
    publication: idea.publication.state,
    pendingOperation: pending ? { releaseId: pending.id, operation: pending.operation, state: pending.state } : null,
    approval: latestApproval
      ? { status: latestApproval.status, revisionNumber: latestApproval.revisionNumber }
      : null,
    blockers: {
      blocking: blocking.length,
      warnings: warnings.length,
      evidence: blocking.filter((issue) => issue.category === "evidence").length,
      top: blocking[0]?.message ?? warnings[0]?.message ?? null,
    },
    review: {
      sectionsReviewed: sectionItems.filter((item) => item.status === "reviewed").length,
      sectionsTotal: sectionItems.length,
      itemsReviewed: view.reviewItems.filter((item) => item.status === "reviewed").length,
      itemsTotal: view.reviewItems.length,
    },
    evidence: summarizeEvidence(evidenceInputsOf(working), state.clock.now()),
    lifecycle: idea.lifecycle,
    duplicateOf: duplicate ? { id: duplicate.id, title: duplicate.title } : null,
    labels: [...idea.labels],
    updatedAt: idea.updatedAt,
    version: idea.version,
  };
}

/** The per-source facts a list item's evidence summary is computed from. */
export type EvidenceInput = {
  sourceType: SourceType;
  retrievedAt: string | null;
  verificationStatus: SourceVerificationStatus;
};

export function evidenceInputsOf(revision: RevisionRecord): EvidenceInput[] {
  return revision.sources.map((source) => ({
    sourceType: source.sourceType,
    retrievedAt: source.retrievedAt,
    verificationStatus: source.verification.status,
  }));
}

/**
 * Freshness depends on the current time, so stored list summaries keep these
 * inputs and recompute the summary when they are read.
 */
export function summarizeEvidence(inputs: readonly EvidenceInput[], nowMs: number): IdeaListItem["evidence"] {
  const freshness = inputs.map((input) => sourceFreshness(input.sourceType, input.retrievedAt, nowMs).freshness);
  const retrieved = inputs
    .map((input) => input.retrievedAt)
    .filter((value): value is string => value !== null)
    .sort();
  return {
    freshness: worstFreshness(freshness),
    staleSources: freshness.filter((value) => value === "stale").length,
    unavailableSources: inputs.filter((input) => input.verificationStatus === "unavailable").length,
    oldestRetrievedAt: retrieved[0] ?? null,
  };
}
