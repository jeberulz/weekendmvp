import { deriveRevision } from "./derive";
import { approvalValidity, completeActivation, revokeApproval, transitionRelease } from "./rules";
import { appendAudit, nowIso, simulatedSuffix, touch, type EditorialState, type ReleaseRecord } from "./state";

/**
 * One release-worker step. The worker reports what happened outside (the
 * staged preview, the deployment, the activation); the rules decide what that
 * means. Before deploying and before activating they re-check the kill
 * switch, the approval and the generation fence, so a stale or revoked job
 * can never go live whatever the worker reports.
 */
export type WorkerReport =
  | { kind: "completed" }
  | { kind: "failed"; code: string; message: string }
  /** The activation's outcome is unknown; `observation` is what a probe saw, if anything yet. */
  | { kind: "uncertain"; observation: { activated: boolean } | null };

export const WORKER_STATES = ["preparing", "publish_requested", "deploying", "verifying", "activating", "verifying_public"] as const;

export function isWorkerState(state: ReleaseRecord["state"]): boolean {
  return (WORKER_STATES as readonly string[]).includes(state);
}

/** Releases a worker should advance, oldest first. */
export function workerQueue(state: EditorialState): ReleaseRecord[] {
  return [...state.releases.values()]
    .filter((release) => isWorkerState(release.state))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function failRelease(state: EditorialState, release: ReleaseRecord, code: string, message: string) {
  release.error = { code, message };
  transitionRelease(state, release, "failed", message);
  appendAudit(state, {
    actor: state.env.workerActor,
    action: "release.failed",
    outcome: "failed",
    ideaId: release.ideaId,
    revisionId: release.revisionId,
    releaseId: release.id,
    reason: null,
    detail: message,
    code,
  });
  touch(state);
}

function note(state: EditorialState, release: ReleaseRecord, detail: string) {
  appendAudit(state, {
    actor: state.env.workerActor,
    action: "release.advanced",
    outcome: "succeeded",
    ideaId: release.ideaId,
    revisionId: release.revisionId,
    releaseId: release.id,
    reason: null,
    detail,
    code: null,
  });
  touch(state);
}

/** Apply one worker step to a release. Returns whether the release moved. */
export async function workerStep(state: EditorialState, release: ReleaseRecord, report: WorkerReport): Promise<boolean> {
  const idea = state.ideas.get(release.ideaId);
  if (!idea) return false;
  const sfx = simulatedSuffix(state);

  if (release.operation === "unpublish") {
    if (release.state !== "verifying") return false;
    if (report.kind === "failed") {
      failRelease(state, release, report.code, report.message);
      return true;
    }
    if (report.kind !== "completed") return false;
    transitionRelease(
      state,
      release,
      "succeeded",
      `Removal verified on the direct route, lists, sitemap and exports${state.env.simulated ? " (simulated probes)" : ""}`,
    );
    note(state, release, `Unpublish verified${sfx}`);
    return true;
  }

  if (release.state === "verifying_public") {
    if (report.kind === "failed") {
      const firstFailure = release.error === null;
      release.error = { code: report.code, message: report.message };
      if (firstFailure) note(state, release, "Public page verification failed; the worker will retry");
      return true;
    }
    if (report.kind !== "completed") return false;
    release.error = null;
    transitionRelease(state, release, "succeeded", "Exact released artifact verified on the public site");
    appendAudit(state, {
      actor: state.env.workerActor,
      action: "release.succeeded",
      outcome: "succeeded",
      ideaId: release.ideaId,
      revisionId: release.revisionId,
      releaseId: release.id,
      reason: null,
      detail: "Exact released artifact verified on the public site",
      code: null,
    });
    touch(state);
    return true;
  }

  // A later unpublish, trash or activation fences every older job.
  if (release.state !== "preparing" && idea.generation !== release.generation) {
    transitionRelease(state, release, "cancelled", "Superseded: the idea's release generation moved on");
    note(state, release, "Stale job fenced by generation");
    return true;
  }

  switch (release.state) {
    case "preparing":
      if (report.kind === "failed") {
        failRelease(state, release, report.code, report.message);
        return true;
      }
      transitionRelease(
        state,
        release,
        "preview_ready",
        state.env.simulated ? "Protected preview ready (simulated: editorial renderer only)" : "Protected preview ready",
      );
      note(state, release, `Preview ready${sfx}`);
      return true;

    case "publish_requested": {
      if (state.killSwitchEngaged) {
        failRelease(state, release, "KILL_SWITCH_ENGAGED", "Blocked by the publishing kill switch before deployment");
        return true;
      }
      if (release.operation !== "rollback") {
        const approval = release.approvalId ? state.approvals.get(release.approvalId) : undefined;
        const validity = approval ? await approvalValidity(state, approval) : { valid: false as const, reason: "Missing approval" };
        if (!validity.valid) {
          if (approval) revokeApproval(state, approval, validity.reason, state.env.workerActor);
          failRelease(state, release, "APPROVAL_NOT_ACTIVE", `Approval no longer valid: ${validity.reason}`);
          return true;
        }
      }
      transitionRelease(state, release, "deploying", `Deploying the exact reviewed artifacts${sfx}`);
      note(state, release, `Deployment started${sfx}`);
      return true;
    }

    case "deploying":
      if (report.kind === "failed") {
        failRelease(state, release, report.code, report.message);
        return true;
      }
      transitionRelease(state, release, "verifying", `Checking deployment identity and artifact fingerprints${sfx}`);
      note(state, release, `Deployment verified${sfx}`);
      return true;

    case "verifying":
      if (report.kind === "failed") {
        failRelease(state, release, report.code, report.message);
        return true;
      }
      transitionRelease(state, release, "activating", `Advancing the public pointer${sfx}`);
      note(state, release, `Activation started${sfx}`);
      return true;

    case "activating": {
      if (state.killSwitchEngaged) {
        failRelease(state, release, "KILL_SWITCH_ENGAGED", "Blocked by the publishing kill switch before activation");
        return true;
      }
      if (release.operation === "rollback" && state.env.checks.externalRun) {
        const revision = release.revisionId ? state.revisions.get(release.revisionId) : undefined;
        const checkedAt = Date.parse(revision?.checksRunAt ?? "");
        const derived = revision ? await deriveRevision(state, revision.id) : null;
        if (!revision || !derived || !Number.isFinite(checkedAt) || state.clock.now() - checkedAt > 10 * 60_000 ||
            !derived.checksCurrent || derived.issues.some((issue) => issue.severity === "blocker")) {
          failRelease(state, release, "ROLLBACK_CHECKS_STALE", "Rollback safety checks are no longer current");
          return true;
        }
      } else if (release.operation !== "rollback") {
        const approval = release.approvalId ? state.approvals.get(release.approvalId) : undefined;
        const validity = approval ? await approvalValidity(state, approval) : { valid: false as const, reason: "Missing approval" };
        if (!validity.valid) {
          if (approval) revokeApproval(state, approval, validity.reason, state.env.workerActor);
          failRelease(state, release, "APPROVAL_NOT_ACTIVE", `Approval no longer valid: ${validity.reason}`);
          return true;
        }
      }
      if (report.kind === "failed") {
        failRelease(state, release, report.code, report.message);
        return true;
      }
      if (report.kind === "uncertain") {
        if (report.observation) release.observation = { ...report.observation, observedAt: nowIso(state) };
        transitionRelease(
          state,
          release,
          "needs_reconciliation",
          "Activation acknowledgement lost. The last confirmed live version is still shown until a probe confirms.",
        );
        note(state, release, `Activation outcome uncertain${sfx}`);
        return true;
      }
      completeActivation(state, idea, release, `Live pointer advanced; checking public delivery${sfx}`, !state.env.simulated);
      return true;
    }

    default:
      return false;
  }
}
