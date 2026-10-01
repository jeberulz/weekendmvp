import type { HumanPrincipal, IngestionPrincipal, ReleaseWorkerPrincipal } from "../../contracts/principal";
import { measureContent, sectionWordCount } from "../../domain/counts";
import {
  actorRef,
  createEditorialState,
  createSequentialIds,
  type CoreEnvironment,
  type EditorialClock,
  type EditorialState,
} from "../../core/state";
import { FIXTURE_CHECK_POLICY } from "./checks";

/**
 * The local demo's whole world, in memory: the shared editorial state plus
 * the simulated principals, credentials and failure switches that only the
 * demo has.
 */

export type FixtureClock = EditorialClock;

export type FixtureState = EditorialState & {
  editor: HumanPrincipal;
  ingestionTokens: Map<string, IngestionPrincipal>;
  worker: ReleaseWorkerPrincipal;
  injections: { failNextDeploy: boolean; loseNextActivationAck: boolean };
  /** Revisions whose next save first receives a simulated edit from another session. */
  concurrentEditHooks: Set<string>;
};

export const FIXTURE_POLICY_VERSION = "fixture-policy-2026-09.1";

export const FIXTURE_EDITOR_ID = "fixture-editor";

const FIXTURE_WORKER: ReleaseWorkerPrincipal = { kind: "service", id: "fixture-release-worker", role: "release_worker" };

export const FIXTURE_ENVIRONMENT: CoreEnvironment = {
  mode: "fixture",
  simulated: true,
  checks: FIXTURE_CHECK_POLICY,
  releases: { available: true },
  workerActor: actorRef(FIXTURE_WORKER, { simulated: true }),
  measure: { content: measureContent, sectionWords: sectionWordCount },
};

export function createEmptyState(clock: FixtureClock): FixtureState {
  return {
    ...createEditorialState({
      env: FIXTURE_ENVIRONMENT,
      clock,
      ids: createSequentialIds(),
      policyVersion: FIXTURE_POLICY_VERSION,
    }),
    editor: {
      kind: "human",
      id: FIXTURE_EDITOR_ID,
      displayName: "Local demo editor",
      capability: "editorial_admin",
      strongAuthAt: null,
      session: "fixture",
    },
    ingestionTokens: new Map(),
    worker: FIXTURE_WORKER,
    injections: { failNextDeploy: false, loseNextActivationAck: false },
    concurrentEditHooks: new Set(),
  };
}
