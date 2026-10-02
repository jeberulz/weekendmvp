import { createDemoControls } from "@/lib/editorial/adapters/fixture/demo";
import { createSeedClock } from "@/lib/editorial/adapters/fixture/environment";
import { FixtureEditorialRepository } from "@/lib/editorial/adapters/fixture/repository";
import { createEmptyState } from "@/lib/editorial/adapters/fixture/state";
import { buildFixtureEnvelope } from "@/lib/editorial/fixtures/envelopes";
import type { RepositoryHarness } from "./harness";
import { defineRepositoryContract } from "./repository-contract";

const START = Date.parse("2026-09-20T09:00:00Z");

async function fixtureHarness(): Promise<RepositoryHarness> {
  const clock = createSeedClock();
  clock.set(START);
  const state = createEmptyState(clock);
  const demo = createDemoControls(state);
  const credentials = {
    engine: demo.issueIngestionCredential("engine"),
    "legacy-import": demo.issueIngestionCredential("legacy-import"),
  } as const;
  const repo = (principal: ConstructorParameters<typeof FixtureEditorialRepository>[1]) =>
    new FixtureEditorialRepository(state, principal);
  return {
    name: "fixture",
    editor: () => repo(state.editor),
    editorSecondTab: () => repo(state.editor),
    anonymous: () => repo(null),
    customer: () =>
      repo({
        kind: "human",
        id: "customer-account",
        displayName: "A customer",
        capability: null,
        strongAuthAt: new Date(clock.now()).toISOString(),
        session: "live",
      }),
    releaseWorker: () => repo(state.worker),
    ingestion: (producer) => ({ repository: repo(null), credential: credentials[producer] }),
    envelope: (spec, options) =>
      buildFixtureEnvelope(spec, {
        submissionId: options.submissionId,
        nowMs: clock.now(),
        policyVersion: state.policyVersion,
        producer: options.producer ?? "engine",
        recommendation: options.recommendation,
        proposedSlug: options.proposedSlug,
        firstPublishedAt: options.producer === "legacy-import" ? "2026-01-01" : undefined,
      }),
    confirmStrongAuth: () => demo.confirmStrongAuth(),
    expireStrongAuth: () => demo.expireStrongAuth(),
    setKillSwitch: (engaged) => demo.setKillSwitch(engaged),
    failNextDeploy: () => demo.failNextDeploy(),
    loseNextActivationAck: () => demo.loseNextActivationAck(),
    runWorker: async () => {
      clock.advance(60 * 1000);
      await demo.runWorker();
    },
    advanceTime: (ms) => clock.advance(ms),
  };
}

defineRepositoryContract("fixture adapter", fixtureHarness);
