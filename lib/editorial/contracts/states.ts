/**
 * Editorial state machines. Candidate decision, revision review and
 * publication are independent: accepting an idea does not approve its copy,
 * approving copy does not publish it, and "live" only ever follows a verified
 * release — never a button click.
 */

/* ------------------------------------------------------------------ */
/* Candidate decision                                                  */
/* ------------------------------------------------------------------ */

export const CANDIDATE_STATES = ["new", "accepted", "needs_research", "rejected", "legacy"] as const;
export type CandidateState = (typeof CANDIDATE_STATES)[number];

/**
 * `legacy` marks an idea that was live before this workspace existed. It is
 * not a recorded human decision; the importer never manufactures one.
 */
export const CANDIDATE_TRANSITIONS: Record<CandidateState, readonly CandidateState[]> = {
  new: ["accepted", "needs_research", "rejected"],
  accepted: ["needs_research", "rejected"],
  needs_research: ["accepted", "rejected", "new"],
  rejected: ["new", "needs_research"],
  legacy: ["accepted", "needs_research", "rejected"],
};

/** Candidate states under which a revision may be approved. */
export const APPROVABLE_CANDIDATE_STATES: readonly CandidateState[] = ["accepted", "legacy"];

export const REJECT_REASONS = [
  "duplicate",
  "weak_pain",
  "no_wedge",
  "infeasible",
  "insufficient_commercial_case",
  "other",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  duplicate: "Duplicate of an existing idea",
  weak_pain: "Weak or unproven pain",
  no_wedge: "No credible wedge",
  infeasible: "Not buildable in a weekend",
  insufficient_commercial_case: "Insufficient commercial case",
  other: "Other",
};

export const CANDIDATE_LABELS: Record<CandidateState, string> = {
  new: "New candidate",
  accepted: "Accepted",
  needs_research: "Needs research",
  rejected: "Rejected",
  legacy: "Legacy (published before review)",
};

/* ------------------------------------------------------------------ */
/* Revision review                                                     */
/* ------------------------------------------------------------------ */

export const REVIEW_STATES = ["draft", "in_review", "changes_requested", "approved"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_TRANSITIONS: Record<ReviewState, readonly ReviewState[]> = {
  draft: ["in_review", "changes_requested"],
  in_review: ["changes_requested", "approved"],
  changes_requested: ["in_review"],
  // An approved revision is frozen. Edits fork a new draft revision.
  approved: [],
};

export const REVIEW_LABELS: Record<ReviewState, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

/** Approval records outlive edits; only an `active` one authorises a release. */
export const APPROVAL_STATUSES = ["active", "revoked", "superseded"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Immutable kinds cannot be saved into; editing them forks a draft. */
export const REVISION_KINDS = ["submitted", "draft", "approved_snapshot", "legacy_snapshot"] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

export const REVISION_KIND_LABELS: Record<RevisionKind, string> = {
  submitted: "Submitted snapshot",
  draft: "Working draft",
  approved_snapshot: "Approved snapshot",
  legacy_snapshot: "Live snapshot (legacy)",
};

/* ------------------------------------------------------------------ */
/* Publication and releases                                            */
/* ------------------------------------------------------------------ */

export const PUBLICATION_STATES = ["never_published", "live", "unpublished"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const PUBLICATION_LABELS: Record<PublicationState, string> = {
  never_published: "Never published",
  live: "Live",
  unpublished: "Unpublished",
};

export const RELEASE_OPERATIONS = [
  "publish",
  "republish",
  "rollback",
  "unpublish",
  "legacy_baseline",
] as const;
export type ReleaseOperation = (typeof RELEASE_OPERATIONS)[number];

export const RELEASE_OPERATION_LABELS: Record<ReleaseOperation, string> = {
  publish: "First publication",
  republish: "Republication",
  rollback: "Rollback",
  unpublish: "Unpublish",
  legacy_baseline: "Legacy baseline",
};

export const RELEASE_STATES = [
  "preparing",
  "preview_ready",
  "publish_requested",
  "deploying",
  "verifying",
  "activating",
  "verifying_public",
  "succeeded",
  "failed",
  "cancelled",
  "needs_reconciliation",
] as const;
export type ReleaseState = (typeof RELEASE_STATES)[number];

/**
 * Publish, republish and rollback share one pipeline. A failed attempt that
 * never reached activation may be retried; an uncertain activation is
 * reconciled from probes, never blindly retried.
 */
export const RELEASE_TRANSITIONS: Record<ReleaseState, readonly ReleaseState[]> = {
  preparing: ["preview_ready", "failed", "cancelled"],
  preview_ready: ["publish_requested", "failed", "cancelled"],
  publish_requested: ["deploying", "failed", "cancelled"],
  deploying: ["verifying", "failed", "needs_reconciliation", "cancelled"],
  verifying: ["activating", "failed", "cancelled"],
  activating: ["verifying_public", "succeeded", "failed", "needs_reconciliation"],
  verifying_public: ["succeeded", "needs_reconciliation"],
  needs_reconciliation: ["succeeded", "failed"],
  // Retry the same intent, or abandon it.
  failed: ["publish_requested", "cancelled"],
  succeeded: [],
  cancelled: [],
};

/**
 * Unpublish revokes the public pointer and advances the generation fence
 * first (`activating`), then waits for removal probes (`verifying`). The idea
 * reads "Unpublished — removal pending" until the release succeeds.
 */
export const UNPUBLISH_TRANSITIONS: Record<ReleaseState, readonly ReleaseState[]> = {
  preparing: [],
  preview_ready: [],
  publish_requested: ["activating", "failed"],
  deploying: [],
  activating: ["verifying", "failed", "needs_reconciliation"],
  verifying_public: [],
  verifying: ["succeeded", "failed", "needs_reconciliation"],
  needs_reconciliation: ["succeeded", "failed"],
  failed: ["verifying"],
  succeeded: [],
  cancelled: [],
};

export const TERMINAL_RELEASE_STATES: readonly ReleaseState[] = ["succeeded", "failed", "cancelled"];

export function isReleaseInFlight(state: ReleaseState): boolean {
  return !TERMINAL_RELEASE_STATES.includes(state);
}

export function releaseTransitions(operation: ReleaseOperation) {
  return operation === "unpublish" ? UNPUBLISH_TRANSITIONS : RELEASE_TRANSITIONS;
}

export function canTransitionRelease(
  operation: ReleaseOperation,
  from: ReleaseState,
  to: ReleaseState,
): boolean {
  if (operation === "legacy_baseline") return false;
  return releaseTransitions(operation)[from].includes(to);
}

export const RELEASE_STATE_LABELS: Record<ReleaseState, string> = {
  preparing: "Preparing preview",
  preview_ready: "Preview ready",
  publish_requested: "Requested",
  deploying: "Deploying",
  verifying: "Verifying",
  activating: "Activating",
  verifying_public: "Checking public page",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
  needs_reconciliation: "Needs reconciliation",
};

export const UNPUBLISH_STATE_LABELS: Partial<Record<ReleaseState, string>> = {
  publish_requested: "Removal requested",
  activating: "Revoking public release",
  verifying: "Verifying removal",
  succeeded: "Removed",
};

export function releaseStateLabel(operation: ReleaseOperation, state: ReleaseState): string {
  if (operation === "unpublish") return UNPUBLISH_STATE_LABELS[state] ?? RELEASE_STATE_LABELS[state];
  return RELEASE_STATE_LABELS[state];
}

/* ------------------------------------------------------------------ */
/* Trash lifecycle                                                     */
/* ------------------------------------------------------------------ */

export const LIFECYCLE_STATES = ["active", "trashed"] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

export function canTransitionCandidate(from: CandidateState, to: CandidateState): boolean {
  return CANDIDATE_TRANSITIONS[from].includes(to);
}

export function canTransitionReview(from: ReviewState, to: ReviewState): boolean {
  return REVIEW_TRANSITIONS[from].includes(to);
}

/**
 * Trash is allowed only when nothing is live and nothing in flight could
 * make it live again.
 */
export function canTrash(publication: PublicationState, inFlightRelease: boolean): boolean {
  return publication !== "live" && !inFlightRelease;
}
