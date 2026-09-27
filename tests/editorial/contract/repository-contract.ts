import { describe, expect, test } from "vitest";

import { defaultIdeaFilter } from "@/lib/editorial/contracts/commands";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import type { EditorialRepository } from "@/lib/editorial/contracts/repository";
import type { ReleaseState } from "@/lib/editorial/contracts/states";
import { receiptSplitter, shiftSwapBoard, warrantyTracker } from "@/lib/editorial/fixtures/articles/catalog";
import { menuCostCalculator } from "@/lib/editorial/fixtures/articles/legacy";
import type { HarnessFactory, RepositoryHarness } from "./harness";

/**
 * WP46 repository contract. Every adapter — the fixture adapter now, the
 * live Convex adapter in E4 — must pass these cases unchanged. The fixture
 * run serialises commands in one process: it proves the rules, not real
 * concurrency or deployment behaviour.
 */

function value<T>(result: CommandResult<T>, step = "command"): T {
  if (!result.ok) throw new Error(`${step} failed: ${result.error.code} ${result.error.message}`);
  return result.value;
}

function code<T>(result: CommandResult<T>): string {
  return result.ok ? "OK" : result.error.code;
}

let keyCounter = 0;
function key(label: string) {
  keyCounter += 1;
  return `${label}-key-${keyCounter}`;
}

async function importCandidate(
  h: RepositoryHarness,
  submissionId = "contract-sub-1",
  spec = receiptSplitter,
  options: { recommendation?: "accept" | "needs_research" | "reject"; proposedSlug?: string } = {},
) {
  const { repository, credential } = h.ingestion("engine");
  const envelope = await h.envelope(spec, { submissionId, ...options });
  return value(await repository.importSubmission(envelope, credential), "import");
}

async function importLegacy(h: RepositoryHarness, submissionId = "contract-legacy-1") {
  const { repository, credential } = h.ingestion("legacy-import");
  const envelope = await h.envelope(menuCostCalculator, { submissionId, producer: "legacy-import" });
  return value(await repository.importSubmission(envelope, credential), "legacy import");
}

async function ideaVersion(repo: EditorialRepository, ideaId: string) {
  return value(await repo.getIdea(ideaId), "getIdea").idea.version;
}

async function accept(h: RepositoryHarness, ideaId: string) {
  const repo = h.editor();
  value(
    await repo.setCandidateDecision(ideaId, await ideaVersion(repo, ideaId), {
      decision: "accepted",
      rationale: "Contract test rationale",
    }),
    "accept",
  );
}

async function working(repo: EditorialRepository, ideaId: string) {
  const detail = value(await repo.getIdea(ideaId), "getIdea");
  const pointer = detail.idea.workingRevision;
  if (!pointer) throw new Error("no working revision");
  return value(await repo.getRevision(ideaId, pointer.id), "getRevision");
}

async function reviewAll(h: RepositoryHarness, ideaId: string) {
  const repo = h.editor();
  let view = await working(repo, ideaId);
  if (!view.policy.checksCurrent) {
    value(await repo.runChecks(view.id, view.hashes.artifact), "runChecks");
    view = await working(repo, ideaId);
  }
  for (const item of view.reviewItems) {
    if (item.status !== "reviewed") value(await repo.markReviewed(view.id, item.id, item.dependencyHash, null), `review ${item.id}`);
  }
  view = await working(repo, ideaId);
  for (const issue of view.issues) {
    if (issue.severity === "warning" && issue.resolvable && !issue.resolution) {
      value(await repo.resolveIssue(view.id, issue.id, issue.dependencyHash, "Acceptable for this test."), "resolve");
    }
  }
  return working(repo, ideaId);
}

async function approveWorking(h: RepositoryHarness, ideaId: string) {
  const view = await reviewAll(h, ideaId);
  const approvalId = value(
    await h.editor().approveRevision(view.id, view.hashes.artifact, { attest: true, note: null }),
    "approve",
  ).approvalId;
  return { approvalId, revisionId: view.id };
}

async function drive(h: RepositoryHarness, releaseId: string, target: ReleaseState[]) {
  for (let tick = 0; tick < 12; tick += 1) {
    const releases = value(await h.editor().listReleases({ group: "all", ideaId: null }, null, 100), "listReleases");
    const release = releases.items.find((candidate) => candidate.id === releaseId);
    if (release && target.includes(release.state)) return release;
    await h.runWorker();
  }
  throw new Error(`release never reached ${target.join("/")}`);
}

async function liveReleaseId(repo: EditorialRepository, ideaId: string) {
  const detail = value(await repo.getIdea(ideaId), "getIdea");
  const live = detail.releases.find((release) => release.state === "succeeded" && detail.idea.liveRevision?.id === release.revisionId && release.operation !== "unpublish");
  return detail.idea.publication === "live" ? live?.id ?? null : null;
}

async function publishToLive(h: RepositoryHarness, ideaId: string) {
  const { approvalId, revisionId } = await approveWorking(h, ideaId);
  const repo = h.editor();
  const expected = await liveReleaseId(repo, ideaId);
  const { releaseId } = value(await repo.prepareRelease(revisionId, expected, key("prepare")), "prepare");
  await drive(h, releaseId, ["preview_ready"]);
  h.confirmStrongAuth();
  value(await repo.publishRelease(releaseId, "preview_ready", approvalId, key("publish")), "publish");
  await drive(h, releaseId, ["succeeded"]);
  return { releaseId, revisionId, approvalId };
}

export function defineRepositoryContract(name: string, factory: HarnessFactory) {
  describe(`${name}: authority boundary`, () => {
    test("anonymous, customer, ingestion and worker principals are denied every read", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      const outsiders: Array<[string, EditorialRepository, string]> = [
        ["anonymous", h.anonymous(), "UNAUTHENTICATED"],
        ["customer", h.customer(), "FORBIDDEN"],
        ["ingestion", h.ingestion("engine").repository, "UNAUTHENTICATED"],
        ["worker", h.releaseWorker(), "SERVICE_NOT_PERMITTED"],
      ];
      for (const [label, repo, expected] of outsiders) {
        const reads: CommandResult<unknown>[] = [
          await repo.getQueueSummary(),
          await repo.listIdeas(defaultIdeaFilter("queue"), null, 10),
          await repo.getIdea(ideaId),
          await repo.listReleases({ group: "all", ideaId: null }, null, 10),
          await repo.listTrash(null, 10),
          await repo.listActivity({ ideaId: null, outcome: null }, null, 10),
          await repo.getSettings(),
        ];
        for (const result of reads) expect(code(result), label).toBe(expected);
      }
    });

    test("no service or outside principal can decide, review, approve, stage, publish or change lifecycle", async () => {
      const h = await factory();
      const { ideaId, revisionId } = await importCandidate(h);
      const view = await working(h.editor(), ideaId);
      const item = view.reviewItems[0];
      const outsiders = [h.anonymous(), h.customer(), h.releaseWorker(), h.ingestion("engine").repository];
      for (const repo of outsiders) {
        const attempts: CommandResult<unknown>[] = [
          await repo.setCandidateDecision(ideaId, 1, { decision: "accepted", rationale: "Forged" }),
          await repo.markReviewed(revisionId, item.id, item.dependencyHash, null),
          await repo.approveRevision(revisionId, view.hashes.artifact, { attest: true, note: null }),
          await repo.prepareRelease(revisionId, null, key("forged")),
          await repo.saveDraft(ideaId, revisionId, 1, { title: "Forged" }, key("forged")),
          await repo.trashIdea(ideaId, 1, "Forged"),
          await repo.restoreIdea(ideaId, 1, "Forged"),
          await repo.unpublishIdea(ideaId, "rel_0001", "Forged", key("forged")),
        ];
        for (const attempt of attempts) {
          expect(attempt.ok).toBe(false);
          expect(["UNAUTHENTICATED", "FORBIDDEN", "SERVICE_NOT_PERMITTED"]).toContain(code(attempt));
        }
      }
      const after = await working(h.editor(), ideaId);
      expect(after.reviewItems.every((reviewItem) => reviewItem.status === "unreviewed")).toBe(true);
      expect(after.approval).toBeNull();
      const detail = value(await h.editor().getIdea(ideaId));
      expect(detail.idea.candidate.state).toBe("new");
    });

    test("denied attempts are recorded in activity", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await h.customer().setCandidateDecision(ideaId, 1, { decision: "accepted", rationale: "Forged" });
      const activity = value(await h.editor().listActivity({ ideaId: null, outcome: "denied" }, null, 50));
      expect(activity.items.some((entry) => entry.action === "access.denied" && entry.code === "FORBIDDEN")).toBe(true);
    });
  });

  describe(`${name}: ingestion boundary`, () => {
    test("an engine recommendation never becomes a decision, review or approval", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h, "contract-rec-accept", receiptSplitter, { recommendation: "accept" });
      const detail = value(await h.editor().getIdea(ideaId));
      expect(detail.idea.candidate.state).toBe("new");
      expect(detail.idea.engineRecommendation?.value).toBe("accept");
      expect(detail.activeApproval).toBeNull();
      const view = await working(h.editor(), ideaId);
      expect(view.reviewItems.every((item) => item.status === "unreviewed")).toBe(true);
      expect(view.eligibility.canApprove).toBe(false);
      expect(view.eligibility.blockers.map((blocker) => blocker.code)).toContain("CANDIDATE_NOT_ACCEPTED");
    });

    test("envelopes cannot smuggle approval or verification authority", async () => {
      const h = await factory();
      const { repository, credential } = h.ingestion("engine");
      const envelope = await h.envelope(receiptSplitter, { submissionId: "contract-smuggle" });
      for (const extra of [{ approvedBy: "owner" }, { humanApproval: true }, { candidateDecision: "accepted" }]) {
        const result = await repository.importSubmission({ ...envelope, ...extra }, credential);
        expect(code(result)).toBe("INVALID_SUBMISSION");
      }
      const forgedSource = {
        ...envelope,
        sources: envelope.sources.map((source, index) =>
          index === 0 ? { ...source, verificationAuthority: "engine_receipt" } : source,
        ),
      };
      expect(code(await repository.importSubmission(forgedSource, credential))).toBe("INVALID_SUBMISSION");
    });

    test("producer, mode, hash and credential are checked by the receiver", async () => {
      const h = await factory();
      const engine = h.ingestion("engine");
      const envelope = await h.envelope(receiptSplitter, { submissionId: "contract-checks" });
      // Internally consistent, but the credential belongs to the engine.
      const claimsManual = { ...envelope, producer: "manual", engineRunId: null, engineContractVersion: null };
      expect(code(await engine.repository.importSubmission(claimsManual, engine.credential))).toBe("PRODUCER_MISMATCH");
      // An inconsistent envelope never gets as far as the credential check.
      expect(code(await engine.repository.importSubmission({ ...envelope, producer: "manual" }, engine.credential))).toBe(
        "INVALID_SUBMISSION",
      );
      const wrongMode = envelope.mode === "fixture" ? "live" : "fixture";
      expect(code(await engine.repository.importSubmission({ ...envelope, mode: wrongMode }, engine.credential))).toBe(
        "MODE_REJECTED",
      );
      expect(
        code(await engine.repository.importSubmission({ ...envelope, title: `${envelope.title} (edited)` }, engine.credential)),
      ).toBe("ARTIFACT_HASH_MISMATCH");
      expect(code(await engine.repository.importSubmission(envelope, { token: "not-a-real-credential" }))).toBe(
        "UNAUTHENTICATED",
      );
    });

    test("imports are idempotent by submission id and refuse a reused id with other content", async () => {
      const h = await factory();
      const engine = h.ingestion("engine");
      const envelope = await h.envelope(receiptSplitter, { submissionId: "contract-dedupe" });
      const first = value(await engine.repository.importSubmission(envelope, engine.credential));
      const again = value(await engine.repository.importSubmission(envelope, engine.credential));
      expect(again.ideaId).toBe(first.ideaId);
      expect(again.duplicate).toBe(true);
      const other = await h.envelope(warrantyTracker, { submissionId: "contract-dedupe" });
      expect(code(await engine.repository.importSubmission(other, engine.credential))).toBe("SUBMISSION_ID_REUSED");
    });

    test("a slug already reserved by another idea is flagged, not overwritten", async () => {
      const h = await factory();
      const first = await importCandidate(h, "contract-slug-1");
      const second = await importCandidate(h, "contract-slug-2", warrantyTracker, { proposedSlug: receiptSplitter.slug });
      expect(second.slugConflict).toBe(true);
      const detail = value(await h.editor().getIdea(second.ideaId));
      expect(detail.idea.duplicateOf?.id).toBe(first.ideaId);
      const original = value(await h.editor().getIdea(first.ideaId));
      expect(original.idea.slugConflict).toBe(false);
    });

    test("legacy imports stay live, unverified and without any approval", async () => {
      const h = await factory();
      const { ideaId } = await importLegacy(h);
      const detail = value(await h.editor().getIdea(ideaId));
      expect(detail.idea.publication).toBe("live");
      expect(detail.idea.candidate.state).toBe("legacy");
      expect(detail.activeApproval).toBeNull();
      const view = await working(h.editor(), ideaId);
      expect(view.kind).toBe("legacy_snapshot");
      expect(view.sources.every((source) => source.verification.status === "unverified")).toBe(true);
      expect(view.sources.every((source) => source.verificationAuthority === "none")).toBe(true);
      expect(view.checks).toHaveLength(0);
    });
  });

  describe(`${name}: drafts and saving`, () => {
    test("snapshots are read-only; editing forks a draft and leaves the live snapshot untouched", async () => {
      const h = await factory();
      const { ideaId, revisionId } = await importLegacy(h);
      const repo = h.editor();
      const before = await working(repo, ideaId);
      expect(code(await repo.saveDraft(ideaId, revisionId, before.version, { title: "Changed" }, key("save")))).toBe(
        "REVISION_READ_ONLY",
      );
      const { revisionId: draftId, number } = value(await repo.createRevision(ideaId, revisionId, key("fork")));
      expect(number).toBe(2);
      const draft = value(await repo.getRevision(ideaId, draftId));
      value(
        await repo.saveDraft(ideaId, draftId, draft.version, { markdown: `${draft.markdown}\nEdited.` }, key("save")),
      );
      const live = value(await repo.getRevision(ideaId, revisionId));
      expect(live.markdown).toBe(before.markdown);
      expect(live.hashes.artifact).toBe(before.hashes.artifact);
      const detail = value(await repo.getIdea(ideaId));
      expect(detail.idea.publication).toBe("live");
      expect(detail.idea.liveRevision?.id).toBe(revisionId);
    });

    test("a stale base version conflicts instead of overwriting (two tabs)", async () => {
      const h = await factory();
      const { ideaId, revisionId } = await importCandidate(h);
      await accept(h, ideaId);
      const { revisionId: draftId } = value(await h.editor().createRevision(ideaId, revisionId, key("fork")));
      const tabA = h.editor();
      const tabB = h.editorSecondTab();
      const base = value(await tabA.getRevision(ideaId, draftId));
      value(await tabA.saveDraft(ideaId, draftId, base.version, { markdown: `${base.markdown}\nTab A.` }, key("a")));
      const conflict = await tabB.saveDraft(ideaId, draftId, base.version, { markdown: `${base.markdown}\nTab B.` }, key("b"));
      expect(code(conflict)).toBe("VERSION_CONFLICT");
      if (!conflict.ok) {
        expect(conflict.error.conflict?.latestVersion).toBe(base.version + 1);
        expect(conflict.error.conflict?.markdown).toContain("Tab A.");
      }
      const latest = value(await tabA.getRevision(ideaId, draftId));
      expect(latest.markdown).toContain("Tab A.");
      expect(latest.markdown).not.toContain("Tab B.");
    });

    test("retrying a save with the same key is exactly-once; reusing a key for other text is refused", async () => {
      const h = await factory();
      const { ideaId, revisionId } = await importCandidate(h);
      await accept(h, ideaId);
      const repo = h.editor();
      const { revisionId: draftId } = value(await repo.createRevision(ideaId, revisionId, key("fork")));
      const base = value(await repo.getRevision(ideaId, draftId));
      const saveKey = key("retry");
      const patch = { markdown: `${base.markdown}\nOnce.` };
      const first = value(await repo.saveDraft(ideaId, draftId, base.version, patch, saveKey));
      const retry = value(await repo.saveDraft(ideaId, draftId, base.version, patch, saveKey));
      expect(retry).toEqual(first);
      expect(value(await repo.getRevision(ideaId, draftId)).version).toBe(base.version + 1);
      expect(
        code(await repo.saveDraft(ideaId, draftId, base.version, { markdown: `${base.markdown}\nOther.` }, saveKey)),
      ).toBe("IDEMPOTENCY_KEY_REUSED");
    });

    test("editing one section invalidates only that section's review (and the preview)", async () => {
      const h = await factory();
      const { ideaId, revisionId } = await importCandidate(h);
      await accept(h, ideaId);
      const repo = h.editor();
      const { revisionId: draftId } = value(await repo.createRevision(ideaId, revisionId, key("fork")));
      const reviewed = await reviewAll(h, ideaId);
      expect(reviewed.reviewItems.every((item) => item.status === "reviewed")).toBe(true);
      const edited = reviewed.markdown.replace("## Recommended Tech Stack\n", "## Recommended Tech Stack\n\n- A queue for retries\n");
      const ack = value(await repo.saveDraft(ideaId, draftId, reviewed.version, { markdown: edited }, key("save")));
      expect(ack.invalidatedReviews).toBe(2);
      const after = value(await repo.getRevision(ideaId, draftId));
      const stale = after.reviewItems.filter((item) => item.status !== "reviewed").map((item) => item.id);
      expect(stale.sort()).toEqual(["preview", "section:tech-stack"]);
    });
  });

  describe(`${name}: review attestation`, () => {
    test("forged review item ids and hashes are refused", async () => {
      const h = await factory();
      const { ideaId, revisionId } = await importCandidate(h);
      await accept(h, ideaId);
      const view = await working(h.editor(), ideaId);
      const item = view.reviewItems[0];
      expect(code(await h.editor().markReviewed(revisionId, "section:not-a-section", item.dependencyHash, null))).toBe(
        "NOT_FOUND",
      );
      expect(code(await h.editor().markReviewed(revisionId, item.id, "0".repeat(64), null))).toBe("STALE_REVIEW_TARGET");
      const unchanged = await working(h.editor(), ideaId);
      expect(unchanged.reviewItems.find((candidate) => candidate.id === item.id)?.status).toBe("unreviewed");
    });

    test("there is no bulk review, approve or publish command", async () => {
      const h = await factory();
      const commands = Object.getOwnPropertyNames(Object.getPrototypeOf(h.editor())).concat(Object.keys(h.editor()));
      expect(commands.filter((command) => /bulk|all|batch|many/i.test(command))).toEqual([]);
    });

    test("blocking issues cannot be waived with a note", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h, "contract-blocker", shiftSwapBoard);
      await accept(h, ideaId);
      const view = await working(h.editor(), ideaId);
      const blocker = view.issues.find((issue) => issue.severity === "blocker");
      expect(blocker).toBeDefined();
      if (!blocker) return;
      expect(code(await h.editor().resolveIssue(view.id, blocker.id, blocker.dependencyHash, "Please ignore"))).toBe(
        "INVALID_TRANSITION",
      );
    });
  });

  describe(`${name}: approval`, () => {
    test("approval is blocked until every item is reviewed, and names what remains", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const view = await working(h.editor(), ideaId);
      const result = await h.editor().approveRevision(view.id, view.hashes.artifact, { attest: true, note: null });
      expect(code(result)).toBe("APPROVAL_BLOCKED");
      if (!result.ok) {
        const unreviewed = result.error.blockers?.filter((blocker) => blocker.code === "ITEM_UNREVIEWED") ?? [];
        expect(unreviewed.length).toBe(view.reviewItems.length);
      }
    });

    test("approval binds the exact artifact; a changed hash is refused", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const view = await reviewAll(h, ideaId);
      expect(code(await h.editor().approveRevision(view.id, "f".repeat(64), { attest: true, note: null }))).toBe(
        "PRECONDITION_FAILED",
      );
      value(await h.editor().approveRevision(view.id, view.hashes.artifact, { attest: true, note: null }));
      const approved = await working(h.editor(), ideaId);
      expect(approved.reviewState).toBe("approved");
      expect(approved.approval?.artifactHash).toBe(view.hashes.artifact);
    });

    test("approval and a concurrent edit have a deterministic winner", async () => {
      // Edit first: the approval against the old hash fails.
      const h = await factory();
      const { ideaId, revisionId } = await importCandidate(h);
      await accept(h, ideaId);
      const { revisionId: draftId } = value(await h.editor().createRevision(ideaId, revisionId, key("fork")));
      const reviewed = await reviewAll(h, ideaId);
      value(
        await h.editorSecondTab().saveDraft(ideaId, draftId, reviewed.version, { markdown: `${reviewed.markdown}\nLate edit.` }, key("late")),
      );
      expect(code(await h.editor().approveRevision(draftId, reviewed.hashes.artifact, { attest: true, note: null }))).toBe(
        "PRECONDITION_FAILED",
      );

      // Approve first: the late save is refused because the revision froze.
      const h2 = await factory();
      const second = await importCandidate(h2);
      await accept(h2, second.ideaId);
      const { revisionId: draft2 } = value(await h2.editor().createRevision(second.ideaId, second.revisionId, key("fork")));
      const reviewed2 = await reviewAll(h2, second.ideaId);
      value(await h2.editor().approveRevision(draft2, reviewed2.hashes.artifact, { attest: true, note: null }));
      const late = await h2.editorSecondTab().saveDraft(second.ideaId, draft2, reviewed2.version, { markdown: "late" }, key("late"));
      expect(code(late)).toBe("REVISION_READ_ONLY");
      if (!late.ok) expect(late.error.conflict?.frozen).toBe(true);
    });

    test("an approval of v1 cannot release edited v2 content", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const { revisionId: v1 } = await approveWorking(h, ideaId);
      const repo = h.editor();
      const { revisionId: v2 } = value(await repo.createRevision(ideaId, v1, key("fork")));
      const draft = value(await repo.getRevision(ideaId, v2));
      value(await repo.saveDraft(ideaId, v2, draft.version, { markdown: `${draft.markdown}\nOne more line.` }, key("save")));
      expect(code(await repo.prepareRelease(v2, null, key("prepare")))).toBe("APPROVAL_NOT_ACTIVE");
    });

    test("changing the candidate decision revokes pending approvals", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      await approveWorking(h, ideaId);
      const repo = h.editor();
      const result = value(
        await repo.setCandidateDecision(ideaId, await ideaVersion(repo, ideaId), {
          decision: "needs_research",
          question: "Is the pain real outside group trips?",
        }),
      );
      expect(result.revokedApprovals).toBe(1);
      const detail = value(await repo.getIdea(ideaId));
      expect(detail.activeApproval).toBeNull();
    });
  });

  describe(`${name}: releases`, () => {
    test("publishing needs recent strong authentication", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const { approvalId, revisionId } = await approveWorking(h, ideaId);
      const { releaseId } = value(await h.editor().prepareRelease(revisionId, null, key("prepare")));
      await drive(h, releaseId, ["preview_ready"]);
      h.expireStrongAuth();
      expect(code(await h.editor().publishRelease(releaseId, "preview_ready", approvalId, key("publish")))).toBe(
        "REAUTH_REQUIRED",
      );
      h.confirmStrongAuth();
      h.advanceTime(11 * 60 * 1000);
      expect(code(await h.editor().publishRelease(releaseId, "preview_ready", approvalId, key("publish")))).toBe(
        "REAUTH_REQUIRED",
      );
    });

    test("a confirmed release goes live only after verified activation; a repeated click is harmless", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const { approvalId, revisionId } = await approveWorking(h, ideaId);
      const repo = h.editor();
      const { releaseId } = value(await repo.prepareRelease(revisionId, null, key("prepare")));
      await drive(h, releaseId, ["preview_ready"]);
      h.confirmStrongAuth();
      const publishKey = key("publish");
      value(await repo.publishRelease(releaseId, "preview_ready", approvalId, publishKey));
      expect(value(await repo.publishRelease(releaseId, "preview_ready", approvalId, publishKey)).releaseId).toBe(releaseId);
      expect(code(await repo.publishRelease(releaseId, "preview_ready", approvalId, key("other")))).toBe(
        "PRECONDITION_FAILED",
      );
      expect(value(await repo.getIdea(ideaId)).idea.publication).toBe("never_published");
      await drive(h, releaseId, ["succeeded"]);
      const detail = value(await repo.getIdea(ideaId));
      expect(detail.idea.publication).toBe("live");
      expect(detail.idea.liveRevision?.id).toBe(revisionId);
    });

    test("the kill switch blocks publishing but never unpublishing", async () => {
      const h = await factory();
      const { ideaId } = await importLegacy(h);
      const repo = h.editor();
      const live = await liveReleaseId(repo, ideaId);
      h.setKillSwitch(true);
      h.confirmStrongAuth();
      const { releaseId } = value(await repo.unpublishIdea(ideaId, live ?? "", "Emergency removal", key("unpublish")));
      await drive(h, releaseId, ["succeeded"]);
      expect(value(await repo.getIdea(ideaId)).idea.publication).toBe("unpublished");

      const h2 = await factory();
      const { ideaId: candidate } = await importCandidate(h2);
      await accept(h2, candidate);
      const { approvalId, revisionId } = await approveWorking(h2, candidate);
      const { releaseId: release2 } = value(await h2.editor().prepareRelease(revisionId, null, key("prepare")));
      await drive(h2, release2, ["preview_ready"]);
      h2.setKillSwitch(true);
      h2.confirmStrongAuth();
      expect(code(await h2.editor().publishRelease(release2, "preview_ready", approvalId, key("publish")))).toBe(
        "KILL_SWITCH_ENGAGED",
      );
    });

    test("unpublish fences a delayed release so it cannot activate afterwards", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const first = await publishToLive(h, ideaId);
      const repo = h.editor();
      const { revisionId: v2 } = value(await repo.createRevision(ideaId, first.revisionId, key("fork")));
      const draft = value(await repo.getRevision(ideaId, v2));
      value(await repo.saveDraft(ideaId, v2, draft.version, { markdown: draft.markdown.replace("## Business Model\n", "## Business Model\n\nUpdated pricing note.\n") }, key("save")));
      const { approvalId } = await approveWorking(h, ideaId);
      const { releaseId } = value(await repo.prepareRelease(v2, first.releaseId, key("prepare")));
      await drive(h, releaseId, ["preview_ready"]);
      h.confirmStrongAuth();
      value(await repo.publishRelease(releaseId, "preview_ready", approvalId, key("publish")));
      value(await repo.unpublishIdea(ideaId, first.releaseId, "Takedown during release", key("unpublish")));
      const fenced = await drive(h, releaseId, ["cancelled", "failed"]);
      expect(fenced.state).toBe("cancelled");
      const detail = value(await repo.getIdea(ideaId));
      expect(detail.idea.publication).toBe("unpublished");
      expect(detail.idea.liveRevision).toBeNull();
    });

    test("a failed deployment keeps the previous version live and can be retried", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const first = await publishToLive(h, ideaId);
      const repo = h.editor();
      const { revisionId: v2 } = value(await repo.createRevision(ideaId, first.revisionId, key("fork")));
      const draft = value(await repo.getRevision(ideaId, v2));
      value(await repo.saveDraft(ideaId, v2, draft.version, { markdown: `${draft.markdown}\nSmall fix.` }, key("save")));
      const { approvalId } = await approveWorking(h, ideaId);
      const { releaseId } = value(await repo.prepareRelease(v2, first.releaseId, key("prepare")));
      await drive(h, releaseId, ["preview_ready"]);
      h.confirmStrongAuth();
      h.failNextDeploy();
      value(await repo.publishRelease(releaseId, "preview_ready", approvalId, key("publish")));
      await drive(h, releaseId, ["failed"]);
      expect(value(await repo.getIdea(ideaId)).idea.liveRevision?.id).toBe(first.revisionId);
      value(await repo.retryRelease(releaseId, "failed", key("retry")));
      await drive(h, releaseId, ["succeeded"]);
      expect(value(await repo.getIdea(ideaId)).idea.liveRevision?.id).toBe(v2);
    });

    test("a lost activation acknowledgement is reconciled from a probe, not retried", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const { approvalId, revisionId } = await approveWorking(h, ideaId);
      const repo = h.editor();
      const { releaseId } = value(await repo.prepareRelease(revisionId, null, key("prepare")));
      await drive(h, releaseId, ["preview_ready"]);
      h.confirmStrongAuth();
      h.loseNextActivationAck();
      value(await repo.publishRelease(releaseId, "preview_ready", approvalId, key("publish")));
      await drive(h, releaseId, ["needs_reconciliation"]);
      expect(value(await repo.getIdea(ideaId)).idea.publication).toBe("never_published");
      expect(code(await repo.retryRelease(releaseId, "needs_reconciliation", key("retry")))).toBe("PRECONDITION_FAILED");
      const reconciled = value(await repo.reconcileRelease(releaseId));
      expect(reconciled.state).toBe("succeeded");
      expect(value(await repo.getIdea(ideaId)).idea.publication).toBe("live");
    });

    test("rollback reactivates an earlier successful release after confirmation", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      const first = await publishToLive(h, ideaId);
      const repo = h.editor();
      const { revisionId: v2 } = value(await repo.createRevision(ideaId, first.revisionId, key("fork")));
      const draft = value(await repo.getRevision(ideaId, v2));
      value(await repo.saveDraft(ideaId, v2, draft.version, { markdown: `${draft.markdown}\nSecond version.` }, key("save")));
      const second = await publishToLive(h, ideaId);
      expect(code(await repo.requestRollback(ideaId, second.releaseId, second.releaseId, "Not allowed", key("rb")))).toBe(
        "INVALID_TRANSITION",
      );
      h.confirmStrongAuth();
      const { releaseId } = value(await repo.requestRollback(ideaId, first.releaseId, second.releaseId, "Second version had an error", key("rb")));
      await drive(h, releaseId, ["succeeded"]);
      expect(value(await repo.getIdea(ideaId)).idea.liveRevision?.id).toBe(first.revisionId);
    });
  });

  describe(`${name}: lifecycle`, () => {
    test("a live idea cannot be trashed; unpublish first", async () => {
      const h = await factory();
      const { ideaId } = await importLegacy(h);
      h.confirmStrongAuth();
      const repo = h.editor();
      expect(code(await repo.trashIdea(ideaId, await ideaVersion(repo, ideaId), "Clean up"))).toBe("IDEA_LIVE");
    });

    test("rejecting a live idea never unpublishes it", async () => {
      const h = await factory();
      const { ideaId } = await importLegacy(h);
      const repo = h.editor();
      value(
        await repo.setCandidateDecision(ideaId, await ideaVersion(repo, ideaId), {
          decision: "rejected",
          reasonCategory: "weak_pain",
          note: null,
        }),
      );
      const detail = value(await repo.getIdea(ideaId));
      expect(detail.idea.candidate.state).toBe("rejected");
      expect(detail.idea.publication).toBe("live");
    });

    test("trash and restore: restore returns unpublished, awaiting review, without approval", async () => {
      const h = await factory();
      const { ideaId } = await importCandidate(h);
      await accept(h, ideaId);
      await approveWorking(h, ideaId);
      const repo = h.editor();
      h.confirmStrongAuth();
      value(await repo.trashIdea(ideaId, await ideaVersion(repo, ideaId), "Parking this idea"));
      const trash = value(await repo.listTrash(null, 10));
      expect(trash.items.map((item) => item.ideaId)).toContain(ideaId);
      const queue = value(await repo.listIdeas(defaultIdeaFilter("library"), null, 100));
      expect(queue.items.map((item) => item.id)).not.toContain(ideaId);
      value(await repo.restoreIdea(ideaId, await ideaVersion(repo, ideaId), "Worth another look"));
      const detail = value(await repo.getIdea(ideaId));
      expect(detail.idea.lifecycle).toBe("active");
      expect(detail.idea.publication).toBe("never_published");
      expect(detail.idea.candidate.state).toBe("new");
      expect(detail.activeApproval).toBeNull();
    });

    test("trash and unpublish require recent strong authentication", async () => {
      const h = await factory();
      const { ideaId } = await importLegacy(h);
      const repo = h.editor();
      h.expireStrongAuth();
      const live = await liveReleaseId(repo, ideaId);
      expect(code(await repo.unpublishIdea(ideaId, live ?? "", "Takedown", key("unpublish")))).toBe("REAUTH_REQUIRED");
      const { ideaId: other } = await importCandidate(h);
      expect(code(await repo.trashIdea(other, await ideaVersion(repo, other), "Clean up"))).toBe("REAUTH_REQUIRED");
    });
  });
}
