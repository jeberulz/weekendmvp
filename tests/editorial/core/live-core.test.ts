import { describe, expect, test } from "vitest";

import { defaultIdeaFilter } from "@/lib/editorial/contracts/commands";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import type { HumanPrincipal, IngestionPrincipal } from "@/lib/editorial/contracts/principal";
import { collectChanges, isEmptyChange, snapshotState } from "@/lib/editorial/core/changes";
import { deriveListItem } from "@/lib/editorial/core/derive";
import { LIVE_POLICY_VERSION_UNSET, LiveEditorialCore, liveEnvironment } from "@/lib/editorial/core/live";
import { createEditorialState, createSequentialIds } from "@/lib/editorial/core/state";
import { listItemFromSummary, summarizeIdea } from "@/lib/editorial/core/summary";
import { receiptSplitter, warrantyTracker } from "@/lib/editorial/fixtures/articles/catalog";
import { menuCostCalculator } from "@/lib/editorial/fixtures/articles/legacy";
import { buildFixtureEnvelope } from "@/lib/editorial/fixtures/envelopes";

/*
 * The live rules (WP46-E4) on an in-memory state: no Convex here. They prove
 * the live environment's refusals, the trusted receiver, the change set a
 * transaction writes back and the stored list summary.
 */

const START = Date.parse("2026-10-01T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function value<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function code(result: CommandResult<unknown>): string {
  return result.ok ? "OK" : result.error.code;
}

function world() {
  let now = START;
  const state = createEditorialState({
    env: liveEnvironment(),
    clock: { now: () => now },
    ids: createSequentialIds(),
    policyVersion: LIVE_POLICY_VERSION_UNSET,
  });
  const admin: HumanPrincipal = {
    kind: "human",
    id: "user_owner",
    displayName: "Owner",
    capability: "editorial_admin",
    strongAuthAt: new Date(START).toISOString(),
    session: "live",
  };
  const customer: HumanPrincipal = { ...admin, id: "user_customer", capability: null, strongAuthAt: null };
  const engine: IngestionPrincipal = { kind: "service", id: "engine-ingestion", role: "ingestion", producer: "engine" };
  const legacy: IngestionPrincipal = { kind: "service", id: "legacy-ingestion", role: "ingestion", producer: "legacy-import" };
  const context = { boundAt: new Date(START - DAY).toISOString() };
  return {
    state,
    as: (principal: HumanPrincipal | null) => new LiveEditorialCore(state, principal, context),
    service: () => new LiveEditorialCore(state, null, context),
    admin,
    customer,
    engine,
    legacy,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

async function liveEnvelope(spec = receiptSplitter, submissionId = "live-sub-1", mode: "fixture" | "live" = "live") {
  return buildFixtureEnvelope(spec, {
    submissionId,
    nowMs: START,
    policyVersion: "wp45-policy-test",
    producer: "engine",
    mode,
  });
}

describe("live receiver", () => {
  test("accepts only live submissions; fixture envelopes are refused", async () => {
    const w = world();
    const refused = await w.service().importTrusted(w.engine, await liveEnvelope(receiptSplitter, "s-1", "fixture"), "none");
    expect(code(refused)).toBe("MODE_REJECTED");
    const accepted = await w.service().importTrusted(w.engine, await liveEnvelope(receiptSplitter, "s-2", "live"), "none");
    expect(code(accepted)).toBe("OK");
  });

  test("without a trusted receipt, verification is downgraded and submitted checks are dropped", async () => {
    const w = world();
    const envelope = await liveEnvelope();
    expect(envelope.sources.some((source) => source.verification.status === "verified")).toBe(true);
    const { ideaId, revisionId } = value(await w.service().importTrusted(w.engine, envelope, "none"));
    const view = value(await w.as(w.admin).getRevision(ideaId, revisionId));
    expect(view.sources.every((source) => source.verification.status === "unverified")).toBe(true);
    expect(view.sources.every((source) => source.verificationAuthority === "none")).toBe(true);
    expect(view.claims.filter((claim) => claim.kind !== "assumed").every((claim) => claim.verification.status === "unverified")).toBe(true);
    expect(view.checks).toHaveLength(0);
  });

  test("a receipt-backed import keeps verification and records engine checks", async () => {
    const w = world();
    const { ideaId, revisionId } = value(await w.service().importTrusted(w.engine, await liveEnvelope(), "engine_receipt"));
    const view = value(await w.as(w.admin).getRevision(ideaId, revisionId));
    expect(view.sources.every((source) => source.verificationAuthority === "engine_receipt")).toBe(true);
    expect(view.sources.some((source) => source.verification.status === "verified")).toBe(true);
    expect(view.checks.length).toBeGreaterThan(0);
    expect(view.checks.every((check) => check.producer === "engine")).toBe(true);
  });

  test("legacy imports stay unverified whatever authority the caller passes", async () => {
    const w = world();
    const envelope = await buildFixtureEnvelope(menuCostCalculator, {
      submissionId: "legacy-1",
      nowMs: START,
      policyVersion: "wp45-policy-test",
      producer: "legacy-import",
      firstPublishedAt: "2026-01-01",
    });
    const { ideaId, revisionId } = value(await w.service().importTrusted(w.legacy, envelope, "engine_receipt"));
    const view = value(await w.as(w.admin).getRevision(ideaId, revisionId));
    expect(view.sources.every((source) => source.verificationAuthority === "none")).toBe(true);
    expect(view.checks).toHaveLength(0);
    const baseline = value(await w.as(w.admin).getIdea(ideaId)).releases[0];
    expect(baseline.steps[0].detail).not.toMatch(/demo|simulated/i);
    expect(baseline.simulated).toBe(false);
  });
});

describe("live environment refusals", () => {
  test("checks are not connected, so approval stays blocked and says why", async () => {
    const w = world();
    const { ideaId, revisionId } = value(await w.service().importTrusted(w.engine, await liveEnvelope(), "none"));
    const editor = w.as(w.admin);
    value(await editor.setCandidateDecision(ideaId, 1, { decision: "accepted", rationale: "Worth editing" }));
    const view = value(await editor.getRevision(ideaId, revisionId));
    const run = await editor.runChecks(revisionId, view.hashes.artifact);
    expect(code(run)).toBe("PRECONDITION_FAILED");
    expect(run.ok ? "" : run.error.message).toMatch(/not connected/);
    expect(view.eligibility.canApprove).toBe(false);
    expect(view.issues.some((issue) => issue.id === "checks:stale")).toBe(true);
  });

  test("receipt-backed checks cannot make a revision approvable while no check runner is connected", async () => {
    const w = world();
    const envelope = await buildFixtureEnvelope(receiptSplitter, {
      submissionId: "live-sub-placeholder",
      nowMs: START,
      // Checks stamped with the placeholder policy version look current to the derivation.
      policyVersion: LIVE_POLICY_VERSION_UNSET,
      producer: "engine",
      mode: "live",
    });
    const { ideaId, revisionId } = value(await w.service().importTrusted(w.engine, envelope, "engine_receipt"));
    const editor = w.as(w.admin);
    value(await editor.setCandidateDecision(ideaId, 1, { decision: "accepted", rationale: "Worth editing" }));
    let view = value(await editor.getRevision(ideaId, revisionId));
    for (const item of view.reviewItems) {
      if (item.status !== "reviewed") value(await editor.markReviewed(revisionId, item.id, item.dependencyHash, null));
    }
    view = value(await editor.getRevision(ideaId, revisionId));
    for (const issue of view.issues) {
      if (issue.severity === "warning" && issue.resolvable && !issue.resolution) {
        value(await editor.resolveIssue(revisionId, issue.id, issue.dependencyHash, "Acceptable for this test."));
      }
    }
    view = value(await editor.getRevision(ideaId, revisionId));
    // Everything a reviewer can do is done; only the missing check runner blocks.
    expect(view.eligibility.blockers.map((blocker) => blocker.code)).toEqual(["CHECKS_NOT_RUN"]);
    expect(view.eligibility.blockers[0].message).toMatch(/not connected/);
    const approval = await editor.approveRevision(revisionId, view.hashes.artifact, { attest: true, note: null });
    expect(code(approval)).toBe("APPROVAL_BLOCKED");
  });

  test("past the per-idea storage budget no new revision is created", async () => {
    const w = world();
    const { ideaId, revisionId } = value(await w.service().importTrusted(w.engine, await liveEnvelope(), "none"));
    const first = w.state.revisions.get(revisionId);
    if (!first) throw new Error("imported revision missing");
    // History that already fills the budget, written directly: one save caps a body far lower.
    for (let number = 2; number <= 9; number += 1) {
      const id = `rev_bulk_${number}`;
      w.state.revisions.set(id, { ...first, id, number, kind: "approved_snapshot", markdown: "x".repeat(1_100_000) });
    }
    const refused = await w.as(w.admin).createRevision(ideaId, revisionId, "budget-key-0001");
    expect(code(refused)).toBe("PRECONDITION_FAILED");
    expect(refused.ok ? "" : refused.error.message).toMatch(/storage one idea can hold/);
    expect(w.state.revisions.size).toBe(9);
  });

  test("release intents are refused before anything is recorded", async () => {
    const w = world();
    const envelope = await buildFixtureEnvelope(menuCostCalculator, {
      submissionId: "legacy-2",
      nowMs: START,
      policyVersion: "wp45-policy-test",
      producer: "legacy-import",
      firstPublishedAt: "2026-01-01",
    });
    const { ideaId, revisionId } = value(await w.service().importTrusted(w.legacy, envelope, "none"));
    const editor = w.as(w.admin);
    const detail = value(await editor.getIdea(ideaId));
    const liveRelease = detail.releases[0].id;
    const before = w.state.releases.size;
    const attempts = [
      await editor.prepareRelease(revisionId, liveRelease, "live-prepare-0001"),
      await editor.unpublishIdea(ideaId, liveRelease, "Take it down", "live-unpublish-0001"),
      await editor.requestRollback(ideaId, liveRelease, liveRelease, "Roll back", "live-rollback-0001"),
    ];
    for (const attempt of attempts) {
      expect(code(attempt)).toBe("PRECONDITION_FAILED");
      expect(attempt.ok ? "" : attempt.error.message).toMatch(/Publishing is not connected/);
    }
    expect(w.state.releases.size).toBe(before);
    expect(value(await editor.getIdea(ideaId)).idea.publication).toBe("live");
  });

  test("settings report the live capability and the missing integrations truthfully", async () => {
    const w = world();
    const settings = value(await w.as(w.admin).getSettings());
    expect(settings.mode).toBe("live");
    expect(settings.capability.verified).toBe(true);
    expect(settings.publishing.readiness).toBe("unavailable");
    expect(settings.integrations.find((item) => item.id === "release_worker")?.available).toBe(false);
    expect(settings.integrations.find((item) => item.id === "engine")?.available).toBe(false);
    expect(JSON.stringify(settings)).not.toMatch(/simulated/i);
  });

  test("an account without the capability is denied and the denial is recorded", async () => {
    const w = world();
    const { ideaId } = value(await w.service().importTrusted(w.engine, await liveEnvelope(), "none"));
    expect(code(await w.as(w.customer).getIdea(ideaId))).toBe("FORBIDDEN");
    expect(code(await w.as(null).getIdea(ideaId))).toBe("UNAUTHENTICATED");
    const denied = w.state.audit.filter((entry) => entry.action === "access.denied");
    expect(denied.map((entry) => entry.code)).toEqual(["FORBIDDEN", "UNAUTHENTICATED"]);
    expect(denied[0].actor.label).toBe("Account without editorial access");
  });
});

describe("unit of work", () => {
  async function seeded() {
    const w = world();
    const imported = value(await w.service().importTrusted(w.engine, await liveEnvelope(), "none"));
    w.state.audit.length = 0;
    return { w, ...imported };
  }

  test("a save writes back the draft, the idea, one audit entry and its request key — nothing else", async () => {
    const { w, ideaId, revisionId } = await seeded();
    const editor = w.as(w.admin);
    value(await editor.setCandidateDecision(ideaId, 1, { decision: "accepted", rationale: "Go" }));
    const fork = value(await editor.createRevision(ideaId, revisionId, "fork-key-0001"));
    w.state.audit.length = 0;
    const draft = value(await editor.getRevision(ideaId, fork.revisionId));
    const snapshot = snapshotState(w.state);
    value(
      await editor.saveDraft(ideaId, fork.revisionId, draft.version, { title: "Receipt splitter, edited" }, "save-key-0001"),
    );
    const changes = collectChanges(w.state, snapshot);
    expect(changes.revisions.updated.map((revision) => revision.id)).toEqual([fork.revisionId]);
    expect(changes.revisions.inserted).toHaveLength(0);
    expect(changes.ideas.updated.map((idea) => idea.id)).toEqual([ideaId]);
    expect(changes.audit.map((entry) => entry.action)).toEqual(["revision.saved"]);
    expect(changes.idempotency.inserted).toHaveLength(1);
    expect(changes.attestations.inserted.length + changes.approvals.inserted.length + changes.releases.inserted.length).toBe(0);
    expect(changes.settings).toBeNull();
  });

  test("a denied command changes nothing but its audit entry", async () => {
    const { w, ideaId } = await seeded();
    const snapshot = snapshotState(w.state);
    await w.as(w.customer).setCandidateDecision(ideaId, 1, { decision: "accepted", rationale: "Forged" });
    const changes = collectChanges(w.state, snapshot);
    expect(changes.audit.map((entry) => entry.code)).toEqual(["FORBIDDEN"]);
    expect(isEmptyChange({ ...changes, audit: [] })).toBe(true);
  });

  test("an import inserts the idea, its revision, the slug and the submission key", async () => {
    const w = world();
    const snapshot = snapshotState(w.state);
    value(await w.service().importTrusted(w.engine, await liveEnvelope(warrantyTracker, "s-uow"), "none"));
    const changes = collectChanges(w.state, snapshot);
    expect(changes.ideas.inserted).toHaveLength(1);
    expect(changes.revisions.inserted).toHaveLength(1);
    expect(changes.slugs.inserted.map((entry) => entry.slug)).toEqual([warrantyTracker.slug]);
    expect(changes.submissions.inserted).toHaveLength(1);
    expect(changes.audit.map((entry) => entry.action)).toEqual(["submission.imported"]);
  });

  test("snapshots refuse a state that already carries audit entries", async () => {
    const { w, ideaId } = await seeded();
    await w.as(null).getIdea(ideaId);
    expect(() => snapshotState(w.state)).toThrow(/freshly loaded/);
  });
});

describe("stored list summary", () => {
  test("matches the derived list item, and evidence freshness is recomputed when read", async () => {
    const w = world();
    const { ideaId } = value(await w.service().importTrusted(w.engine, await liveEnvelope(), "none"));
    const idea = w.state.ideas.get(ideaId);
    if (!idea) throw new Error("missing idea");
    const summary = await summarizeIdea(w.state, idea);
    expect(listItemFromSummary(summary, w.now())).toEqual(await deriveListItem(w.state, idea));
    const later = listItemFromSummary(summary, w.now() + 400 * DAY);
    expect(later.evidence.staleSources).toBeGreaterThan(0);
    expect(later.evidence.freshness).toBe("stale");
  });

  test("summaries round-trip through JSON and keep the queue filters working", async () => {
    const w = world();
    const { ideaId } = value(await w.service().importTrusted(w.engine, await liveEnvelope(), "none"));
    const idea = w.state.ideas.get(ideaId);
    if (!idea) throw new Error("missing idea");
    const stored = JSON.parse(JSON.stringify(await summarizeIdea(w.state, idea)));
    const item = listItemFromSummary(stored, w.now());
    const queue = value(await w.as(w.admin).listIdeas(defaultIdeaFilter("queue"), null, 10));
    expect(queue.items[0]).toEqual(item);
  });
});
