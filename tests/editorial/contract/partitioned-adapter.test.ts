import type { HumanPrincipal, IngestionPrincipal, ReleaseWorkerPrincipal } from "@/lib/editorial/contracts/principal";
import { FIXTURE_CHECK_POLICY } from "@/lib/editorial/adapters/fixture/checks";
import { FIXTURE_POLICY_VERSION } from "@/lib/editorial/adapters/fixture/state";
import { liveEnvironment } from "@/lib/editorial/core/live";
import { PartitionedEditorialRepository } from "@/lib/editorial/core/partitioned";
import type { ActorRef, IdSource, ReleaseRecord } from "@/lib/editorial/core/state";
import { isWorkerState, type WorkerReport } from "@/lib/editorial/core/worker";
import { buildFixtureEnvelope } from "@/lib/editorial/fixtures/envelopes";
import type { RepositoryHarness } from "./harness";
import { MemoryWorkingSetStore } from "./memory-store";
import { defineRepositoryContract } from "./repository-contract";

/*
 * The repository contract through the per-idea transaction layer the Convex
 * adapter uses (WP46-E4c), with the live rules. Each call loads only the
 * records of the idea it targets from a store that holds them all, and
 * writes back only its change set. Check results, verification receipts and
 * release-worker outcomes are SIMULATED here by the test harness: this
 * proves the partitioning and the live rules, not a deployment.
 */

const START = Date.parse("2026-09-20T09:00:00Z");
const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function randomIds(): IdSource {
  return {
    next(prefix) {
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      let suffix = "";
      for (const byte of bytes) suffix += ALPHABET[byte & 31];
      return `${prefix}_${suffix}`;
    },
  };
}

const OPERATOR: ActorRef = { id: "contract-operator", kind: "system", label: "Contract test operator" };
const WORKER: ReleaseWorkerPrincipal = { kind: "service", id: "release-worker", role: "release_worker" };

async function partitionedHarness(): Promise<RepositoryHarness> {
  let now = START;
  const clock = { now: () => now };
  const store = new MemoryWorkingSetStore({ policyVersion: FIXTURE_POLICY_VERSION, killSwitchEngaged: false });
  const ingestionPrincipals = new Map<string, IngestionPrincipal>([
    ["memory-engine", { kind: "service", id: "engine-ingestion", role: "ingestion", producer: "engine" }],
    ["memory-legacy", { kind: "service", id: "legacy-ingestion", role: "ingestion", producer: "legacy-import" }],
  ]);
  const editor: HumanPrincipal = {
    kind: "human",
    id: "user_owner",
    displayName: "Owner",
    capability: "editorial_admin",
    strongAuthAt: null,
    session: "live",
  };
  const base = {
    env: liveEnvironment({ checks: FIXTURE_CHECK_POLICY, releases: { available: true } }),
    clock,
    ids: randomIds(),
    settings: { boundAt: "2026-09-01T00:00:00.000Z" },
    ingestion: {
      resolve: (credential: { token: string }) => ingestionPrincipals.get(credential.token) ?? null,
      authority: "engine_receipt" as const,
    },
  };
  const repo = (principal: HumanPrincipal | ReleaseWorkerPrincipal | null) =>
    new PartitionedEditorialRepository(store, { ...base, principal });
  const operator = repo(null);
  const injections = { failNextDeploy: false, loseNextActivationAck: false };

  function simulatedReport(release: ReleaseRecord): WorkerReport {
    const idea = store.ideas.get(release.ideaId);
    const reachesStage = idea !== undefined && release.operation !== "unpublish" && idea.generation === release.generation;
    if (reachesStage && release.state === "deploying" && injections.failNextDeploy) {
      injections.failNextDeploy = false;
      return { kind: "failed", code: "DEPLOY_FAILED", message: "Simulated deployment failed. The live version is unchanged." };
    }
    if (reachesStage && release.state === "activating" && !store.settings.killSwitchEngaged && injections.loseNextActivationAck) {
      injections.loseNextActivationAck = false;
      return { kind: "uncertain", observation: { activated: true } };
    }
    return { kind: "completed" };
  }

  return {
    name: "partitioned",
    editor: () => repo(editor),
    editorSecondTab: () => repo(editor),
    anonymous: () => repo(null),
    customer: () => repo({ ...editor, id: "user_customer", displayName: "A customer", capability: null }),
    releaseWorker: () => repo(WORKER),
    ingestion: (producer) => ({
      repository: repo(null),
      credential: { token: producer === "engine" ? "memory-engine" : "memory-legacy" },
    }),
    envelope: (spec, options) =>
      buildFixtureEnvelope(spec, {
        submissionId: options.submissionId,
        nowMs: now,
        policyVersion: store.settings.policyVersion,
        producer: options.producer ?? "engine",
        recommendation: options.recommendation,
        proposedSlug: options.proposedSlug,
        firstPublishedAt: options.producer === "legacy-import" ? "2026-01-01" : undefined,
        mode: "live",
      }),
    confirmStrongAuth: () => {
      editor.strongAuthAt = new Date(now).toISOString();
    },
    expireStrongAuth: () => {
      editor.strongAuthAt = null;
    },
    // Queued on the store, so it lands before any later call.
    setKillSwitch: (engaged) => {
      void operator.setKillSwitch(engaged, OPERATOR, "Contract test");
    },
    failNextDeploy: () => {
      injections.failNextDeploy = true;
    },
    loseNextActivationAck: () => {
      injections.loseNextActivationAck = true;
    },
    runWorker: async () => {
      now += 60 * 1000;
      const queue = [...store.releases.values()]
        .filter((release) => isWorkerState(release.state))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .map((release) => release.id);
      for (const releaseId of queue) {
        const release = store.releases.get(releaseId);
        if (!release || !isWorkerState(release.state)) continue;
        await operator.workerAdvance(releaseId, simulatedReport(release));
      }
    },
    advanceTime: (ms) => {
      now += ms;
    },
  };
}

defineRepositoryContract("partitioned working sets (live rules)", partitionedHarness);
