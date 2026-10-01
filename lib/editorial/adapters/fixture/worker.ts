import { approvalValidity, completeActivation, revokeApproval, transitionRelease } from "../../core/rules";
import { appendAudit, nowIso, touch, type ReleaseRecord } from "../../core/state";
import type { FixtureState } from "./state";

/**
 * SIMULATED release worker for the local demo and tests. It advances each
 * in-flight release by one stage per tick and never touches a repository,
 * deployment, cache or public page. Before activation it re-checks the kill
 * switch, the approval and the generation fence, exactly as the real worker
 * (WP46-E6) must.
 */
export async function stepFixtureWorker(state: FixtureState): Promise<{ advanced: number }> {
  const inFlight = [...state.releases.values()]
    .filter((release) =>
      ["preparing", "publish_requested", "deploying", "verifying", "activating"].includes(release.state),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  let advanced = 0;
  for (const release of inFlight) {
    if (await advance(state, release)) advanced += 1;
  }
  return { advanced };
}

function fail(state: FixtureState, release: ReleaseRecord, code: string, message: string) {
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

function note(state: FixtureState, release: ReleaseRecord, detail: string) {
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

async function advance(state: FixtureState, release: ReleaseRecord): Promise<boolean> {
  const idea = state.ideas.get(release.ideaId);
  if (!idea) return false;

  if (release.operation === "unpublish") {
    if (release.state !== "verifying") return false;
    transitionRelease(
      state,
      release,
      "succeeded",
      "Removal verified on the direct route, lists, sitemap and exports (simulated probes)",
    );
    note(state, release, "Unpublish verified (simulated)");
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
      transitionRelease(state, release, "preview_ready", "Protected preview ready (simulated: editorial renderer only)");
      note(state, release, "Preview ready (simulated)");
      return true;

    case "publish_requested": {
      if (state.killSwitchEngaged) {
        fail(state, release, "KILL_SWITCH_ENGAGED", "Blocked by the publishing kill switch before deployment");
        return true;
      }
      if (release.operation !== "rollback") {
        const approval = release.approvalId ? state.approvals.get(release.approvalId) : undefined;
        const validity = approval ? await approvalValidity(state, approval) : { valid: false as const, reason: "Missing approval" };
        if (!validity.valid) {
          if (approval) revokeApproval(state, approval, validity.reason, state.env.workerActor);
          fail(state, release, "APPROVAL_NOT_ACTIVE", `Approval no longer valid: ${validity.reason}`);
          return true;
        }
      }
      transitionRelease(state, release, "deploying", "Deploying the exact reviewed artifacts (simulated)");
      note(state, release, "Deployment started (simulated)");
      return true;
    }

    case "deploying":
      if (state.injections.failNextDeploy) {
        state.injections.failNextDeploy = false;
        fail(state, release, "DEPLOY_FAILED", "Simulated deployment failed: the build step timed out. The live version is unchanged.");
        return true;
      }
      transitionRelease(state, release, "verifying", "Checking deployment identity and artifact fingerprints (simulated)");
      note(state, release, "Deployment verified (simulated)");
      return true;

    case "verifying":
      transitionRelease(state, release, "activating", "Advancing the public pointer (simulated)");
      note(state, release, "Activation started (simulated)");
      return true;

    case "activating": {
      if (state.killSwitchEngaged) {
        fail(state, release, "KILL_SWITCH_ENGAGED", "Blocked by the publishing kill switch before activation");
        return true;
      }
      if (state.injections.loseNextActivationAck) {
        state.injections.loseNextActivationAck = false;
        // The simulated world did activate; only the acknowledgement was lost.
        release.observation = { activated: true, observedAt: nowIso(state) };
        transitionRelease(
          state,
          release,
          "needs_reconciliation",
          "Activation acknowledgement lost. The last confirmed live version is still shown until a probe confirms.",
        );
        note(state, release, "Activation outcome uncertain (simulated)");
        return true;
      }
      completeActivation(state, idea, release, "Live pointer advanced and public surfaces probed (simulated)");
      return true;
    }

    default:
      return false;
  }
}
