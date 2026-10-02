import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

import * as demoActions from "@/app/admin/editorial/_actions/demo";
import { runChecksAction, saveDraftAction } from "@/app/admin/editorial/_actions/draft";
import * as releaseActions from "@/app/admin/editorial/_actions/release";
import * as reviewActions from "@/app/admin/editorial/_actions/review";
import { resetFixtureEnvironment } from "@/lib/editorial/adapters/fixture/singleton";
import type { FixtureEnvironment } from "@/lib/editorial/adapters/fixture/environment";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import type { RevisionView } from "@/lib/editorial/contracts/views";
import { FIXTURE_MODE_VALUE } from "@/lib/editorial/runtime/workspace";

/*
 * The E3 human workflow driven through the server actions the UI calls.
 * FIXTURE-SERIALISED: commands run one after another in one process. These
 * tests prove the rules and the action wiring, not real concurrency,
 * authentication or deployment (WP46-E4 to E7).
 */

function unwrap<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function code(result: CommandResult<unknown>): string | null {
  return result.ok ? null : result.error.code;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production: every review, release and demo action is unavailable", () => {
  test("even with the fixture opt-in set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);
    const modules = { ...reviewActions, ...releaseActions, ...demoActions };
    const names = Object.keys(modules);
    expect(names.length).toBe(26);
    for (const [name, action] of Object.entries(modules)) {
      const result = await (action as (input: unknown) => Promise<CommandResult<unknown>>)({});
      expect(code(result), name).toBe("WORKSPACE_UNAVAILABLE");
    }
  });
});

describe("the review, approval and release journey (fixture-serialised)", { timeout: 60_000 }, () => {
  let env: FixtureEnvironment;
  let ideaId: string;

  beforeAll(async () => {
    vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);
    env = await resetFixtureEnvironment();
    ideaId = env.scenarios.flagshipLiveWithDraft;
  });

  const withOptIn = () => vi.stubEnv("EDITORIAL_FIXTURE_MODE", FIXTURE_MODE_VALUE);

  async function working(): Promise<RevisionView> {
    const detail = unwrap(await env.editor().getIdea(ideaId));
    return unwrap(await env.editor().getRevision(ideaId, detail.idea.workingRevision?.id ?? ""));
  }

  async function runWorkerUntil(predicate: () => Promise<boolean>) {
    for (let tick = 0; tick < 12 && !(await predicate()); tick += 1) unwrap(await demoActions.demoRunWorkerAction({}));
    expect(await predicate()).toBe(true);
  }

  test("attestation is per item, bound to its hash, and approval unlocks only when nothing remains", async () => {
    withOptIn();
    let draft = await working();
    // Restore the verified wording the v3 draft had edited (the only content blocker).
    const verified = "The fictional Harbor Research report sizes the freelance invoicing software market at $1.8 billion in 2025";
    const edited = "The fictional Harbor Research report puts spending on freelance invoicing tools near $2 billion";
    expect(draft.markdown).toContain(edited);
    unwrap(
      await saveDraftAction({
        ideaId,
        revisionId: draft.id,
        baseVersion: draft.version,
        patch: { markdown: draft.markdown.replace(edited, verified) },
        idempotencyKey: "journey-save-0001",
      }),
    );
    draft = unwrap(await runChecksAction({ ideaId, revisionId: draft.id, expectedArtifactHash: (await working()).hashes.artifact }));

    const remaining = draft.reviewItems.filter((item) => item.status !== "reviewed");
    expect(remaining.length).toBeGreaterThan(0);
    const early = await reviewActions.approveRevisionAction({
      ideaId,
      revisionId: draft.id,
      artifactHash: draft.hashes.artifact,
      input: { attest: true, note: null },
    });
    expect(code(early)).toBe("APPROVAL_BLOCKED");

    // A forged hash is refused; the real one is accepted.
    const forged = await reviewActions.markReviewedAction({
      ideaId,
      revisionId: draft.id,
      itemId: remaining[0].id,
      dependencyHash: "forged-hash",
      note: null,
    });
    expect(code(forged)).toBe("STALE_REVIEW_TARGET");
    for (const item of remaining) {
      const marked = unwrap(
        await reviewActions.markReviewedAction({ ideaId, revisionId: draft.id, itemId: item.id, dependencyHash: item.dependencyHash, note: null }),
      );
      draft = marked.view;
    }
    expect(draft.reviewItems.every((item) => item.status === "reviewed")).toBe(true);
    expect(draft.eligibility.canApprove).toBe(true);

    // The approval statement is explicit: `attest` must be literally true.
    const unattested = await reviewActions.approveRevisionAction({
      ideaId,
      revisionId: draft.id,
      artifactHash: draft.hashes.artifact,
      input: { attest: false as true, note: null },
    });
    expect(code(unattested)).toBe("INVALID_INPUT");
    const approved = unwrap(
      await reviewActions.approveRevisionAction({ ideaId, revisionId: draft.id, artifactHash: draft.hashes.artifact, input: { attest: true, note: null } }),
    );
    expect(approved.view.kind).toBe("approved_snapshot");
    expect(approved.view.readOnly).toBe(true);
  });

  test("publishing is staged, needs recent strong authentication, and goes live only after activation", async () => {
    withOptIn();
    const detail = unwrap(await env.editor().getIdea(ideaId));
    const approval = detail.activeApproval;
    expect(approval?.status).toBe("active");
    const live = detail.releases.find((release) => release.state === "succeeded" && release.revisionId === detail.idea.liveRevision?.id);
    const prepared = unwrap(
      await releaseActions.prepareReleaseAction({
        revisionId: approval?.revisionId ?? "",
        expectedLiveReleaseId: live?.id ?? null,
        idempotencyKey: "journey-prepare-0001",
      }),
    );
    const release = async () => unwrap(await env.editor().getIdea(ideaId)).releases.find((item) => item.id === prepared.releaseId);
    await runWorkerUntil(async () => (await release())?.state === "preview_ready");

    unwrap(await demoActions.demoExpireStrongAuthAction({}));
    const refused = await releaseActions.publishReleaseAction({
      releaseId: prepared.releaseId,
      expectedState: "preview_ready",
      approvalId: approval?.id ?? "",
      idempotencyKey: "journey-publish-0001",
    });
    expect(code(refused)).toBe("REAUTH_REQUIRED");
    unwrap(await demoActions.demoConfirmStrongAuthAction({}));
    unwrap(
      await releaseActions.publishReleaseAction({
        releaseId: prepared.releaseId,
        expectedState: "preview_ready",
        approvalId: approval?.id ?? "",
        idempotencyKey: "journey-publish-0002",
      }),
    );
    // Still the old version until the simulated activation is verified.
    expect(unwrap(await env.editor().getIdea(ideaId)).idea.liveRevision?.number).toBe(2);
    await runWorkerUntil(async () => (await release())?.state === "succeeded");
    expect(unwrap(await env.editor().getIdea(ideaId)).idea.liveRevision?.number).toBe(3);
  });

  test("a live idea cannot be trashed; unpublish is staged and verified; restore returns it unpublished", async () => {
    withOptIn();
    let detail = unwrap(await env.editor().getIdea(ideaId));
    const refusedTrash = await releaseActions.trashIdeaAction({ ideaId, expectedVersion: detail.idea.version, reason: "Tidy up" });
    expect(code(refusedTrash)).toBe("IDEA_LIVE");

    const live = detail.releases.find((release) => release.state === "succeeded" && release.revisionId === detail.idea.liveRevision?.id);
    unwrap(await demoActions.demoConfirmStrongAuthAction({}));
    const unpublish = unwrap(
      await releaseActions.unpublishIdeaAction({ ideaId, expectedLiveReleaseId: live?.id ?? "", reason: "Re-check pricing", idempotencyKey: "journey-unpublish-0001" }),
    );
    detail = unwrap(await env.editor().getIdea(ideaId));
    expect(detail.idea.pendingOperation?.operation).toBe("unpublish");
    await runWorkerUntil(async () => unwrap(await env.editor().getIdea(ideaId)).releases.find((item) => item.id === unpublish.releaseId)?.state === "succeeded");
    detail = unwrap(await env.editor().getIdea(ideaId));
    expect(detail.idea.publication).toBe("unpublished");

    unwrap(await releaseActions.trashIdeaAction({ ideaId, expectedVersion: detail.idea.version, reason: "Parked" }));
    detail = unwrap(await env.editor().getIdea(ideaId));
    expect(detail.idea.lifecycle).toBe("trashed");
    const restored = unwrap(await releaseActions.restoreIdeaAction({ ideaId, expectedVersion: detail.idea.version, reason: "Back to review" }));
    expect(restored.version).toBeGreaterThan(detail.idea.version);
    detail = unwrap(await env.editor().getIdea(ideaId));
    expect(detail.idea.lifecycle).not.toBe("trashed");
    expect(detail.idea.publication).toBe("unpublished");
    expect(detail.activeApproval).toBeNull();
  });

  test("decisions: reasons are required, the engine recommendation stays separate, and reopening works", async () => {
    withOptIn();
    const candidate = env.scenarios.newCandidate;
    let detail = unwrap(await env.editor().getIdea(candidate));
    const revisionId = detail.idea.workingRevision?.id ?? "";
    const recommendation = detail.idea.engineRecommendation;
    const noReason = await reviewActions.decideCandidateAction({
      ideaId: candidate,
      revisionId,
      expectedVersion: detail.idea.version,
      input: { decision: "rejected", reasonCategory: "other", note: null },
    });
    expect(code(noReason)).toBe("INVALID_INPUT");
    unwrap(
      await reviewActions.decideCandidateAction({
        ideaId: candidate,
        revisionId,
        expectedVersion: detail.idea.version,
        input: { decision: "rejected", reasonCategory: "weak_pain", note: null },
      }),
    );
    detail = unwrap(await env.editor().getIdea(candidate));
    expect(detail.idea.candidate.state).toBe("rejected");
    expect(detail.idea.engineRecommendation).toEqual(recommendation);
    unwrap(
      await reviewActions.decideCandidateAction({
        ideaId: candidate,
        revisionId,
        expectedVersion: detail.idea.version,
        input: { decision: "new", reason: "Fresh evidence arrived" },
      }),
    );
    expect(unwrap(await env.editor().getIdea(candidate)).idea.candidate.state).toBe("new");
    // A stale idea version is refused rather than overwriting a newer decision.
    const stale = await reviewActions.decideCandidateAction({
      ideaId: candidate,
      revisionId,
      expectedVersion: detail.idea.version,
      input: { decision: "accepted", rationale: "Late click from an old tab" },
    });
    expect(code(stale)).toBe("VERSION_CONFLICT");
  });
});
