import { beforeAll, describe, expect, test, vi } from "vitest";

import { assertFixtureModeAllowed, createFixtureEnvironment, type FixtureEnvironment } from "@/lib/editorial/adapters/fixture/environment";
import { defaultIdeaFilter } from "@/lib/editorial/contracts/commands";
import { parseEditorialSubmission } from "@/lib/editorial/contracts/submission";
import { sectionsByKey, splitSections, containsNormalized } from "@/lib/editorial/domain/structure";
import * as catalog from "@/lib/editorial/fixtures/articles/catalog";
import { invoiceFollowUp } from "@/lib/editorial/fixtures/articles/invoice-follow-up";
import { legacyFillers, listingCaptionWriter, menuCostCalculator, podcastShowNotes } from "@/lib/editorial/fixtures/articles/legacy";
import { buildFixtureEnvelope } from "@/lib/editorial/fixtures/envelopes";
import { FIXTURE_SCENARIOS } from "@/lib/editorial/fixtures/seed";
import { buildArticleMarkdown, type ArticleSpec } from "@/lib/editorial/fixtures/spec";

const NOW = Date.parse("2026-09-27T12:00:00Z");
const ALL_SPECS: ArticleSpec[] = [
  invoiceFollowUp,
  ...Object.values(catalog),
  menuCostCalculator,
  podcastShowNotes,
  listingCaptionWriter,
  ...legacyFillers,
];

describe("fixture content integrity", () => {
  test("every claim anchor appears verbatim in its section", () => {
    for (const spec of ALL_SPECS) {
      const sections = sectionsByKey(splitSections(buildArticleMarkdown(spec)));
      for (const claim of spec.claims) {
        const block = sections.get(claim.section);
        expect(block, `${spec.slug} ${claim.id}`).toBeDefined();
        expect(containsNormalized(block?.body ?? "", claim.anchor), `${spec.slug} ${claim.id}`).toBe(true);
      }
    }
  });

  test("every fixture source points at the reserved .example domain", () => {
    for (const spec of ALL_SPECS) {
      for (const source of spec.sources) expect(new URL(source.url).hostname.endsWith(".example"), source.url).toBe(true);
    }
  });

  test("every fixture envelope passes the Editorial DTO v1 validators", async () => {
    for (const spec of ALL_SPECS) {
      const legacy = spec.claims.length === 0 && spec.sources.every((source) => source.verification === "unverified");
      const envelope = await buildFixtureEnvelope(spec, {
        submissionId: "integrity-check",
        nowMs: NOW,
        policyVersion: "test",
        producer: legacy ? "legacy-import" : "engine",
        firstPublishedAt: legacy ? "2026-01-01" : undefined,
      });
      const parsed = parseEditorialSubmission(envelope);
      expect(parsed.ok, `${spec.slug}: ${parsed.ok ? "" : JSON.stringify(parsed.issues)}`).toBe(true);
    }
  });
});

describe("fixture mode is local-only", () => {
  test("the fixture environment refuses to start in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => assertFixtureModeAllowed()).toThrow(/unavailable in production/);
    } finally {
      vi.unstubAllEnvs();
    }
    expect(() => assertFixtureModeAllowed()).not.toThrow();
  });
});

describe("seeded scenarios", () => {
  let env: FixtureEnvironment;

  beforeAll(async () => {
    env = await createFixtureEnvironment({ nowMs: NOW });
  });

  async function idea(name: (typeof FIXTURE_SCENARIOS)[number]) {
    const result = await env.editor().getIdea(env.scenarios[name]);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }

  async function working(name: (typeof FIXTURE_SCENARIOS)[number]) {
    const detail = await idea(name);
    const result = await env.editor().getRevision(detail.idea.id, detail.idea.workingRevision?.id ?? "");
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }

  test("the queue summary is derived from the seeded data", async () => {
    const summary = await env.editor().getQueueSummary();
    expect(summary.ok && summary.value).toEqual({
      needReview: 7,
      // Flagship re-worded claim, unreadable grant sources, warranty source change, cold-chain source change.
      blockedByEvidence: 4,
      releasesNeedingAttention: 2,
      buckets: { new: 1, awaiting_review: 5, needs_research: 1, changes_requested: 1, rejected: 1 },
    });
  });

  test("flagship: live v2 with an edited v3 draft, 6 of 8 sections reviewed and one unresolved claim", async () => {
    const detail = await idea("flagshipLiveWithDraft");
    expect(detail.idea.publication).toBe("live");
    expect(detail.idea.liveRevision?.number).toBe(2);
    expect(detail.idea.workingRevision?.number).toBe(3);
    expect(detail.idea.review.sectionsReviewed).toBe(6);
    const view = await working("flagshipLiveWithDraft");
    expect(view.issues.filter((issue) => issue.severity === "blocker").map((issue) => issue.id)).toEqual([
      "claim:clm-market-size:wording",
    ]);
  });

  test("new candidate: engine recommendation kept apart; executable markup blocks it", async () => {
    const detail = await idea("newCandidate");
    expect(detail.idea.candidate.state).toBe("new");
    expect(detail.idea.engineRecommendation?.value).toBe("accept");
    const view = await working("newCandidate");
    expect(view.issues.some((issue) => issue.id === "check:safety-executable-markup" && issue.severity === "blocker")).toBe(true);
  });

  test("duplicate: slug collision recorded and rejected as a duplicate", async () => {
    const detail = await idea("duplicateRejected");
    expect(detail.idea.slugConflict).toBe(true);
    expect(detail.idea.duplicateOf?.id).toBe(env.scenarios.flagshipLiveWithDraft);
    expect(detail.idea.candidate).toMatchObject({ state: "rejected", reasonCategory: "duplicate" });
  });

  test("evidence unavailable: sources unreadable and claims unsupported", async () => {
    const detail = await idea("evidenceUnavailable");
    expect(detail.idea.candidate.state).toBe("needs_research");
    expect(detail.idea.evidence.unavailableSources).toBe(2);
    const view = await working("evidenceUnavailable");
    expect(view.claims.every((claim) => claim.labels.includes("unavailable"))).toBe(true);
  });

  test("changed source: the claim and source reviews are stale and approval is blocked", async () => {
    const view = await working("changedSource");
    const claim = view.claims.find((candidate) => candidate.id === "clm-homeledger-price");
    expect(claim?.labels).toContain("changed_since_review");
    expect(claim?.review.status).toBe("stale");
    expect(view.eligibility.blockers.map((blocker) => blocker.code)).toContain("UNSUPPORTED_CLAIM");
  });

  test("legacy: live, unverified and never downgraded; old markup quarantined", async () => {
    const plain = await idea("legacyNoRecord");
    expect(plain.idea.publication).toBe("live");
    expect(plain.idea.blockers.blocking).toBe(0);
    expect(plain.legacy?.bodyOrigin).toBe("mdx");
    const quarantined = await working("legacyQuarantined");
    expect(quarantined.quarantine?.reasons[0]).toMatch(/HTML\/JSX tag/);
  });

  test("conflicting autosave: the first save meets another tab's edit", async () => {
    const view = await working("conflictingAutosave");
    const result = await env
      .editor()
      .saveDraft(view.ideaId, view.id, view.version, { markdown: `${view.markdown}\nMine.` }, "scenario-conflict-1");
    expect(result.ok ? "OK" : result.error.code).toBe("VERSION_CONFLICT");
  });

  test("stale approval: revoked when a supporting source changed after approval", async () => {
    const view = await working("staleApproval");
    expect(view.approval?.status).toBe("revoked");
    expect(view.approval?.revokedReason).toMatch(/source changed after approval/);
    expect(view.eligibility.blockers.map((blocker) => blocker.code)).toContain("UNSUPPORTED_CLAIM");
  });

  test("the seeded history is chronological", async () => {
    const activity = await env.editor().listActivity({ ideaId: null, outcome: null }, null, 100);
    if (!activity.ok) throw new Error(activity.error.message);
    const times = activity.value.items.map((entry) => entry.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  test("failed deployment: v1 stays live and the failure needs attention", async () => {
    const detail = await idea("failedDeployment");
    expect(detail.idea.liveRevision?.number).toBe(1);
    expect(detail.idea.pendingOperation?.state).toBe("failed");
    expect(detail.releases[0].error?.code).toBe("DEPLOY_FAILED");
  });

  test("uncertain activation: last confirmed state shown until reconciled", async () => {
    const detail = await idea("uncertainActivation");
    expect(detail.idea.publication).toBe("never_published");
    expect(detail.idea.pendingOperation?.state).toBe("needs_reconciliation");
  });

  test("unpublished, trashed, preview-ready and changes-requested states", async () => {
    expect((await idea("unpublished")).idea.publication).toBe("unpublished");
    expect((await idea("trashed")).idea.lifecycle).toBe("trashed");
    expect((await idea("previewReady")).idea.pendingOperation?.state).toBe("preview_ready");
    expect((await working("changesRequested")).reviewState).toBe("changes_requested");
  });

  test("the library paginates by cursor without repeats", async () => {
    const repo = env.editor();
    const first = await repo.listIdeas(defaultIdeaFilter("library"), null, 20);
    if (!first.ok) throw new Error(first.error.message);
    const second = await repo.listIdeas(defaultIdeaFilter("library"), first.value.nextCursor, 20);
    if (!second.ok) throw new Error(second.error.message);
    const ids = [...first.value.items, ...second.value.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(first.value.total);
    expect(second.value.nextCursor).toBeNull();
    expect(await repo.listIdeas(defaultIdeaFilter("library"), "not-a-cursor", 20)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });
});
