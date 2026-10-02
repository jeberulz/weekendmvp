/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";

import { FIXTURE_CHECK_POLICY } from "../../lib/editorial/adapters/fixture/checks";
import { FIXTURE_POLICY_VERSION } from "../../lib/editorial/adapters/fixture/state";
import type { HumanPrincipal, IngestionPrincipal, ReleaseWorkerPrincipal } from "../../lib/editorial/contracts/principal";
import type { EditorialRepository } from "../../lib/editorial/contracts/repository";
import { liveEnvironment } from "../../lib/editorial/core/live";
import { PartitionedEditorialRepository, type TransactionContext } from "../../lib/editorial/core/partitioned";
import type { ActorRef, ReleaseRecord } from "../../lib/editorial/core/state";
import { isWorkerState, type WorkerReport } from "../../lib/editorial/core/worker";
import { buildFixtureEnvelope } from "../../lib/editorial/fixtures/envelopes";
import type { RepositoryHarness } from "../../tests/editorial/contract/harness";
import { defineRepositoryContract } from "../../tests/editorial/contract/repository-contract";
import schema from "../schema";
import { randomKey } from "./ids";
import { ConvexWorkingSetStore } from "./store";

const modules = import.meta.glob("/convex/**/*.ts");

/*
 * The repository contract against the Convex store (WP46-E4c). Every call
 * runs in its own Convex transaction (convex-test), loads only the records of
 * the idea it targets from the editorial tables, and writes back its change
 * set. The principals, check results, verification receipts and worker
 * outcomes are SIMULATED by this harness: it proves the private storage and
 * the live rules, not authentication (see functions.test.ts) or a deployment.
 * convex-test runs transactions one at a time, so this is not proof of real
 * concurrency either; Convex's own serialisable transactions provide that.
 */

const START = Date.parse("2026-09-20T09:00:00Z");
const OPERATOR: ActorRef = { id: "contract-operator", kind: "system", label: "Contract test operator" };
const WORKER: ReleaseWorkerPrincipal = { kind: "service", id: "release-worker", role: "release_worker" };

function transactional(t: TestConvex<typeof schema>, context: () => TransactionContext) {
  const run = <T>(call: (repo: PartitionedEditorialRepository) => Promise<T>): Promise<T> =>
    t.run(async (ctx) => call(new PartitionedEditorialRepository(new ConvexWorkingSetStore(ctx.db, ctx.db), context())));

  const repository: EditorialRepository = {
    mode: "live",
    getQueueSummary: () => run((repo) => repo.getQueueSummary()),
    listIdeas: (filter, cursor, pageSize) => run((repo) => repo.listIdeas(filter, cursor, pageSize)),
    getIdea: (ideaId) => run((repo) => repo.getIdea(ideaId)),
    getRevision: (ideaId, revisionId) => run((repo) => repo.getRevision(ideaId, revisionId)),
    listReleases: (filter, cursor, pageSize) => run((repo) => repo.listReleases(filter, cursor, pageSize)),
    listTrash: (cursor, pageSize) => run((repo) => repo.listTrash(cursor, pageSize)),
    listActivity: (filter, cursor, pageSize) => run((repo) => repo.listActivity(filter, cursor, pageSize)),
    getSettings: () => run((repo) => repo.getSettings()),
    importSubmission: (envelope, credential) => run((repo) => repo.importSubmission(envelope, credential)),
    createRevision: (ideaId, fromRevisionId, key, carry) => run((repo) => repo.createRevision(ideaId, fromRevisionId, key, carry)),
    discardRevision: (ideaId, revisionId, version, reason) =>
      run((repo) => repo.discardRevision(ideaId, revisionId, version, reason)),
    saveDraft: (ideaId, revisionId, baseVersion, patch, key) =>
      run((repo) => repo.saveDraft(ideaId, revisionId, baseVersion, patch, key)),
    setCandidateDecision: (ideaId, version, input) => run((repo) => repo.setCandidateDecision(ideaId, version, input)),
    markReviewed: (revisionId, itemId, hash, note) => run((repo) => repo.markReviewed(revisionId, itemId, hash, note)),
    retractReview: (revisionId, itemId) => run((repo) => repo.retractReview(revisionId, itemId)),
    flagReviewItem: (revisionId, itemId, hash, input) => run((repo) => repo.flagReviewItem(revisionId, itemId, hash, input)),
    resolveIssue: (revisionId, issueId, hash, note) => run((repo) => repo.resolveIssue(revisionId, issueId, hash, note)),
    addNote: (revisionId, target, note) => run((repo) => repo.addNote(revisionId, target, note)),
    requestChanges: (revisionId, note) => run((repo) => repo.requestChanges(revisionId, note)),
    resumeReview: (revisionId) => run((repo) => repo.resumeReview(revisionId)),
    runChecks: (revisionId, hash) => run((repo) => repo.runChecks(revisionId, hash)),
    approveRevision: (revisionId, hash, input) => run((repo) => repo.approveRevision(revisionId, hash, input)),
    prepareRelease: (revisionId, expected, key) => run((repo) => repo.prepareRelease(revisionId, expected, key)),
    publishRelease: (releaseId, state, approvalId, key) =>
      run((repo) => repo.publishRelease(releaseId, state, approvalId, key)),
    cancelRelease: (releaseId, state, reason) => run((repo) => repo.cancelRelease(releaseId, state, reason)),
    retryRelease: (releaseId, state, key) => run((repo) => repo.retryRelease(releaseId, state, key)),
    reconcileRelease: (releaseId) => run((repo) => repo.reconcileRelease(releaseId)),
    requestRollback: (ideaId, target, expected, reason, key) =>
      run((repo) => repo.requestRollback(ideaId, target, expected, reason, key)),
    unpublishIdea: (ideaId, expected, reason, key) => run((repo) => repo.unpublishIdea(ideaId, expected, reason, key)),
    trashIdea: (ideaId, version, reason) => run((repo) => repo.trashIdea(ideaId, version, reason)),
    restoreIdea: (ideaId, version, reason) => run((repo) => repo.restoreIdea(ideaId, version, reason)),
  };
  return { repository, run };
}

async function convexHarness(): Promise<RepositoryHarness> {
  let now = START;
  const t = convexTest(schema, modules);
  // The contract runs under the fixture's simulated quality policy.
  await t.run(async (ctx) => {
    await ctx.db.insert("editorial_settings", {
      key: "settings",
      policyVersion: FIXTURE_POLICY_VERSION,
      killSwitchEngaged: false,
      updatedAt: START,
    });
  });
  const ingestionPrincipals = new Map<string, IngestionPrincipal>([
    ["contract-engine", { kind: "service", id: "engine-ingestion", role: "ingestion", producer: "engine" }],
    ["contract-legacy", { kind: "service", id: "legacy-ingestion", role: "ingestion", producer: "legacy-import" }],
  ]);
  const editor: HumanPrincipal = {
    kind: "human",
    id: "user_owner",
    displayName: "Owner",
    capability: "editorial_admin",
    strongAuthAt: null,
    session: "live",
  };
  const context = (principal: HumanPrincipal | ReleaseWorkerPrincipal | null) => (): TransactionContext => ({
    env: liveEnvironment({ checks: FIXTURE_CHECK_POLICY, releases: { available: true } }),
    clock: { now: () => now },
    ids: { next: (prefix) => randomKey(prefix) },
    principal,
    settings: { boundAt: "2026-09-01T00:00:00.000Z" },
    ingestion: {
      resolve: (credential) => ingestionPrincipals.get(credential.token) ?? null,
      authority: "engine_receipt",
    },
  });
  const repo = (principal: HumanPrincipal | ReleaseWorkerPrincipal | null) => transactional(t, context(principal)).repository;
  const service = transactional(t, context(null)).run;
  const injections = { failNextDeploy: false, loseNextActivationAck: false };

  const releaseAndIdea = (releaseId: string) =>
    t.run(async (ctx) => {
      const release = await ctx.db
        .query("editorial_releases")
        .withIndex("by_key", (q) => q.eq("key", releaseId))
        .unique();
      const idea = release
        ? await ctx.db
            .query("editorial_ideas")
            .withIndex("by_key", (q) => q.eq("key", release.ideaId))
            .unique()
        : null;
      const settings = await ctx.db
        .query("editorial_settings")
        .withIndex("by_key", (q) => q.eq("key", "settings"))
        .unique();
      return {
        state: release?.state ?? null,
        operation: release?.operation ?? null,
        generation: release?.generation ?? null,
        ideaGeneration: idea?.generation ?? null,
        killSwitch: settings?.killSwitchEngaged ?? false,
      };
    });

  function simulatedReport(found: Awaited<ReturnType<typeof releaseAndIdea>>): WorkerReport {
    const reachesStage = found.operation !== "unpublish" && found.ideaGeneration === found.generation;
    if (reachesStage && found.state === "deploying" && injections.failNextDeploy) {
      injections.failNextDeploy = false;
      return { kind: "failed", code: "DEPLOY_FAILED", message: "Simulated deployment failed. The live version is unchanged." };
    }
    if (reachesStage && found.state === "activating" && !found.killSwitch && injections.loseNextActivationAck) {
      injections.loseNextActivationAck = false;
      return { kind: "uncertain", observation: { activated: true } };
    }
    return { kind: "completed" };
  }

  return {
    name: "convex",
    editor: () => repo(editor),
    editorSecondTab: () => repo(editor),
    anonymous: () => repo(null),
    customer: () => repo({ ...editor, id: "user_customer", displayName: "A customer", capability: null }),
    releaseWorker: () => repo(WORKER),
    ingestion: (producer) => ({
      repository: repo(null),
      credential: { token: producer === "engine" ? "contract-engine" : "contract-legacy" },
    }),
    envelope: (spec, options) =>
      buildFixtureEnvelope(spec, {
        submissionId: options.submissionId,
        nowMs: now,
        policyVersion: FIXTURE_POLICY_VERSION,
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
    // convex-test runs one transaction at a time, so this lands before any later call.
    setKillSwitch: (engaged) => {
      void service((repository) => repository.setKillSwitch(engaged, OPERATOR, "Contract test"));
    },
    failNextDeploy: () => {
      injections.failNextDeploy = true;
    },
    loseNextActivationAck: () => {
      injections.loseNextActivationAck = true;
    },
    runWorker: async () => {
      now += 60 * 1000;
      const queue = await t.run(async (ctx) => {
        const rows: Pick<ReleaseRecord, "id" | "createdAt">[] = [];
        for (const release of await ctx.db.query("editorial_releases").take(500)) {
          if (isWorkerState(release.state)) rows.push({ id: release.key, createdAt: release.createdAt });
        }
        return rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).map((row) => row.id);
      });
      for (const releaseId of queue) {
        const found = await releaseAndIdea(releaseId);
        if (found.state === null || !isWorkerState(found.state)) continue;
        const report = simulatedReport(found);
        await service((repository) => repository.workerAdvance(releaseId, report));
      }
    },
    advanceTime: (ms) => {
      now += ms;
    },
  };
}

defineRepositoryContract("convex store (live rules)", convexHarness);
