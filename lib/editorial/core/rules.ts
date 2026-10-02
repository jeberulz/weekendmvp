import { APPROVABLE_CANDIDATE_STATES, canTransitionRelease, type ReleaseState } from "../contracts/states";
import { deriveRevision } from "./derive";
import {
  appendAudit,
  nowIso,
  touch,
  type ActorRef,
  type ApprovalRecord,
  type EditorialState,
  type IdeaRecord,
  type ReleaseRecord,
} from "./state";

export type Validity = { valid: true } | { valid: false; reason: string };

/**
 * An approval authorises exactly one artifact under one policy and one
 * evidence assessment. Any drift — edited bytes, a new quality policy, a
 * source that changed, failing or stale checks, a changed candidate
 * decision — makes it invalid. Checked at staging, at the publish click and
 * again by the worker before activation.
 */
export async function approvalValidity(state: EditorialState, approval: ApprovalRecord): Promise<Validity> {
  if (approval.status !== "active") return { valid: false, reason: `Approval is ${approval.status}` };
  const idea = state.ideas.get(approval.ideaId);
  const revision = state.revisions.get(approval.revisionId);
  if (!idea || !revision) return { valid: false, reason: "Approved revision no longer exists" };
  if (idea.lifecycle === "trashed") return { valid: false, reason: "Idea is in Trash" };
  if (!APPROVABLE_CANDIDATE_STATES.includes(idea.candidate.state)) {
    return { valid: false, reason: "Candidate decision is no longer Accepted" };
  }
  if (approval.policyVersion !== state.policyVersion) {
    return { valid: false, reason: "Quality policy changed after approval" };
  }
  const derived = await deriveRevision(state, revision.id);
  if (derived.hashes.artifact !== approval.artifactHash) {
    return { valid: false, reason: "Revision content differs from the approved artifact" };
  }
  if (derived.assessment !== approval.assessmentDigest) {
    return { valid: false, reason: "Evidence verification changed after approval" };
  }
  if (!derived.checksCurrent) return { valid: false, reason: "Checks are not current" };
  if (derived.issues.some((issue) => issue.severity === "blocker")) {
    return { valid: false, reason: "A blocking issue appeared after approval" };
  }
  return { valid: true };
}

export function revokeApproval(
  state: EditorialState,
  approval: ApprovalRecord,
  reason: string,
  actor: ActorRef,
): void {
  if (approval.status !== "active") return;
  approval.status = "revoked";
  approval.revokedAt = nowIso(state);
  approval.revokedReason = reason;
  const revision = state.revisions.get(approval.revisionId);
  appendAudit(state, {
    actor,
    action: "approval.revoked",
    outcome: "succeeded",
    ideaId: approval.ideaId,
    revisionId: approval.revisionId,
    releaseId: null,
    reason,
    detail: revision ? `Approval of v${revision.number} revoked` : null,
    code: null,
  });
  touch(state);
}

/** Revoke every active approval of an idea (decision change, trash, policy). */
export function revokeIdeaApprovals(state: EditorialState, ideaId: string, reason: string, actor: ActorRef): number {
  let count = 0;
  for (const approval of state.approvals.values()) {
    if (approval.ideaId === ideaId && approval.status === "active") {
      revokeApproval(state, approval, reason, actor);
      count += 1;
    }
  }
  return count;
}

export function transitionRelease(
  state: EditorialState,
  release: ReleaseRecord,
  to: ReleaseState,
  detail: string | null,
): void {
  if (!canTransitionRelease(release.operation, release.state, to)) {
    throw new Error(`Illegal release transition ${release.operation}: ${release.state} → ${to}`);
  }
  release.state = to;
  release.updatedAt = nowIso(state);
  release.steps.push({ state: to, at: release.updatedAt, detail });
  touch(state);
}

export function inFlightReleaseFor(state: EditorialState, ideaId: string): ReleaseRecord | null {
  for (const release of state.releases.values()) {
    if (release.ideaId !== ideaId || release.operation === "legacy_baseline") continue;
    if (!["succeeded", "failed", "cancelled"].includes(release.state)) return release;
  }
  return null;
}

/** Move the public pointer to a verified release (worker or reconciliation). */
export function completeActivation(
  state: EditorialState,
  idea: IdeaRecord,
  release: ReleaseRecord,
  detail: string,
): void {
  const now = nowIso(state);
  idea.publication.state = "live";
  idea.publication.liveReleaseId = release.id;
  idea.publication.lastLiveReleaseId = release.id;
  idea.publication.lastReleasedAt = now;
  idea.publication.firstPublishedAt ??= now.slice(0, 10);
  idea.publication.unpublishedAt = null;
  idea.publication.unpublishReason = null;
  idea.generation += 1;
  transitionRelease(state, release, "succeeded", detail);
  appendAudit(state, {
    actor: state.env.workerActor,
    action: "release.succeeded",
    outcome: "succeeded",
    ideaId: idea.id,
    revisionId: release.revisionId,
    releaseId: release.id,
    reason: null,
    detail,
    code: null,
  });
  touch(state);
}
