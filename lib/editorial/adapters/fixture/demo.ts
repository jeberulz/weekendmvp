import type { IngestionCredential } from "../../contracts/principal";
import type { SubmissionProducer } from "../../contracts/submission";
import { assessmentDigest } from "../../domain/artifact";
import { revokeApproval } from "../../core/rules";
import { appendAudit, nowIso, touch, type ActorRef } from "../../core/state";
import type { FixtureState } from "./state";
import { stepFixtureWorker } from "./worker";

const DEMO_ACTOR: ActorRef = { id: "fixture-demo-controls", kind: "system", label: "Local demo controls" };

/**
 * Controls that exist only in fixture mode to exercise states a real system
 * reaches through time or failure. Every use is written to the activity log
 * as a demo action; none of them is reachable from the repository interface.
 */
export type FixtureDemoControls = {
  confirmStrongAuth(): void;
  expireStrongAuth(): void;
  setKillSwitch(engaged: boolean): void;
  failNextDeploy(): void;
  loseNextActivationAck(): void;
  bumpPolicyVersion(): Promise<number>;
  simulateSourceChange(revisionId: string, sourceId: string): Promise<boolean>;
  simulateConcurrentEdit(revisionId: string): void;
  runWorker(): Promise<{ advanced: number }>;
  issueIngestionCredential(producer: SubmissionProducer): IngestionCredential;
};

function log(state: FixtureState, detail: string, ideaId: string | null = null, revisionId: string | null = null) {
  appendAudit(state, {
    actor: DEMO_ACTOR,
    action: "settings.changed",
    outcome: "succeeded",
    ideaId,
    revisionId,
    releaseId: null,
    reason: null,
    detail: `Demo: ${detail}`,
    code: null,
  });
  touch(state);
}

export function createDemoControls(state: FixtureState): FixtureDemoControls {
  let credentialCounter = 0;
  return {
    confirmStrongAuth() {
      state.editor.strongAuthAt = nowIso(state);
      log(state, "strong authentication confirmed (simulated, no credentials involved)");
    },
    expireStrongAuth() {
      state.editor.strongAuthAt = null;
      log(state, "strong authentication expired");
    },
    setKillSwitch(engaged) {
      state.killSwitchEngaged = engaged;
      log(state, engaged ? "publishing kill switch engaged" : "publishing kill switch released");
    },
    failNextDeploy() {
      state.injections.failNextDeploy = true;
      log(state, "the next simulated deployment will fail");
    },
    loseNextActivationAck() {
      state.injections.loseNextActivationAck = true;
      log(state, "the next simulated activation acknowledgement will be lost");
    },
    async bumpPolicyVersion() {
      const match = /^(.*\.)(\d+)$/.exec(state.policyVersion);
      state.policyVersion = match ? `${match[1]}${Number(match[2]) + 1}` : `${state.policyVersion}.1`;
      let revoked = 0;
      for (const approval of state.approvals.values()) {
        if (approval.status !== "active") continue;
        const idea = state.ideas.get(approval.ideaId);
        const liveRevision = idea?.publication.liveReleaseId
          ? state.releases.get(idea.publication.liveReleaseId)?.revisionId
          : null;
        // Approvals already activated stay as history; pending ones go stale.
        if (liveRevision === approval.revisionId) continue;
        revokeApproval(state, approval, `Quality policy changed to ${state.policyVersion}`, DEMO_ACTOR);
        revoked += 1;
      }
      log(state, `quality policy changed to ${state.policyVersion}; ${revoked} pending approval(s) revoked`);
      return revoked;
    },
    async simulateSourceChange(revisionId, sourceId) {
      const revision = state.revisions.get(revisionId);
      const source = revision?.sources.find((candidate) => candidate.id === sourceId);
      if (!revision || !source) return false;
      const before = await assessmentDigest(revision.sources, revision.claims);
      source.verification = {
        status: "changed",
        reason: "The page no longer contains the archived excerpt (simulated recheck)",
        checkedAt: nowIso(state),
      };
      for (const claim of revision.claims) {
        if (claim.kind !== "assumed" && claim.sourceIds.includes(sourceId)) {
          claim.verification = { status: "changed", reason: "A supporting source changed after verification" };
        }
      }
      const after = await assessmentDigest(revision.sources, revision.claims);
      for (const approval of state.approvals.values()) {
        if (approval.revisionId === revisionId && approval.status === "active" && approval.assessmentDigest === before && before !== after) {
          revokeApproval(state, approval, "A supporting source changed after approval", DEMO_ACTOR);
        }
      }
      log(state, `source ${sourceId} changed on recheck`, revision.ideaId, revisionId);
      return true;
    },
    simulateConcurrentEdit(revisionId) {
      state.concurrentEditHooks.add(revisionId);
      log(state, "the next save of this draft will meet an edit from another tab", state.revisions.get(revisionId)?.ideaId ?? null, revisionId);
    },
    runWorker() {
      return stepFixtureWorker(state);
    },
    issueIngestionCredential(producer) {
      credentialCounter += 1;
      const token = `fixture-ingestion-${producer}-${credentialCounter}`;
      state.ingestionTokens.set(token, {
        kind: "service",
        id: `fixture-ingestion-${producer}`,
        role: "ingestion",
        producer,
      });
      return { token };
    },
  };
}
