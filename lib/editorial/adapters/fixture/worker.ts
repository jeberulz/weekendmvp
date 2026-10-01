import type { ReleaseRecord } from "../../core/state";
import { workerQueue, workerStep, type WorkerReport } from "../../core/worker";
import type { FixtureState } from "./state";

/**
 * SIMULATED release worker for the local demo and tests. It advances each
 * in-flight release by one stage per tick and never touches a repository,
 * deployment, cache or public page. It only decides what the outside world
 * "did" (from the demo's failure switches); the shared worker rules apply the
 * kill switch, approval and generation fences exactly as for the real worker
 * (WP46-E6).
 */
export async function stepFixtureWorker(state: FixtureState): Promise<{ advanced: number }> {
  let advanced = 0;
  for (const release of workerQueue(state)) {
    if (await workerStep(state, release, simulatedReport(state, release))) advanced += 1;
  }
  return { advanced };
}

function simulatedReport(state: FixtureState, release: ReleaseRecord): WorkerReport {
  const idea = state.ideas.get(release.ideaId);
  // Fenced or unpublish jobs never reach a stage that consumes a failure switch.
  const reachesStage = idea !== undefined && release.operation !== "unpublish" && idea.generation === release.generation;
  if (reachesStage && release.state === "deploying" && state.injections.failNextDeploy) {
    state.injections.failNextDeploy = false;
    return {
      kind: "failed",
      code: "DEPLOY_FAILED",
      message: "Simulated deployment failed: the build step timed out. The live version is unchanged.",
    };
  }
  if (reachesStage && release.state === "activating" && !state.killSwitchEngaged && state.injections.loseNextActivationAck) {
    state.injections.loseNextActivationAck = false;
    // The simulated world did activate; only the acknowledgement was lost.
    return { kind: "uncertain", observation: { activated: true } };
  }
  return { kind: "completed" };
}
