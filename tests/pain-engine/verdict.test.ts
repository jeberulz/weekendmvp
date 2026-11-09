import { describe, expect, it } from "vitest";

import { clusterFindings, scorecardForCluster } from "../../lib/pain-engine/cluster";
import { writeDraft } from "../../lib/pain-engine/writer";
import type { PainFinding } from "../../lib/pain-engine/types";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function finding(overrides: Partial<PainFinding>): PainFinding {
  return {
    source: "reddit",
    url: "https://example.com/post",
    title: "I hate doing invoices by hand",
    text: "I spend hours every week copying invoice details from emails. I hate it and I would pay for a tool that did it.",
    context: "r/smallbusiness",
    date: daysAgo(3),
    agreementCount: 120,
    quote: "I spend hours every week copying invoice details from emails.",
    ...overrides,
  };
}

describe("scorecard + verdict", () => {
  it("composite is the cluster total / 10, with the four dials mapped from evidence", () => {
    const [cluster] = clusterFindings([finding({}), finding({ source: "hacker-news" }), finding({ source: "github-issues" })]);
    expect(cluster.scorecard.composite).toBeCloseTo(cluster.score.total / 10, 1);
    expect(cluster.scorecard.opportunity).toBe(cluster.score.frequency);
    expect(cluster.scorecard.problem).toBe(cluster.score.intensity);
    expect(cluster.scorecard.feasibility).toBe(cluster.score.buildability);
    for (const dial of [
      cluster.scorecard.opportunity,
      cluster.scorecard.problem,
      cluster.scorecard.feasibility,
      cluster.scorecard.whyNow,
    ]) {
      expect(dial).toBeGreaterThanOrEqual(1);
      expect(dial).toBeLessThanOrEqual(10);
    }
    expect(cluster.scorecard.labels.opportunity).toMatch(/Strong|Good|Weak|Poor/);
    expect(cluster.scorecard.rationale).toContain(cluster.scorecard.verdict);
  });

  it("BUILD for a strong, multi-source, quotable cluster", () => {
    const [cluster] = clusterFindings([
      finding({}),
      finding({ source: "hacker-news", url: "https://example.com/hn" }),
      finding({ source: "github-issues", url: "https://example.com/gh" }),
    ]);
    expect(cluster.scorecard.verdict).toBe("BUILD");
  });

  it("PASS for a weak single report with no quotable quote", () => {
    const [cluster] = clusterFindings([
      finding({
        text: "My plants keep dying and I forget to water them.",
        title: "My plants keep dying",
        quote: "",
        agreementCount: 2,
        date: daysAgo(200),
      }),
    ]);
    expect(cluster.scorecard.verdict).toBe("PASS");
    expect(cluster.scorecard.composite).toBeLessThan(5);
  });

  it("PIVOT for real pain that does not yet support a straight build", () => {
    // A mid-scoring cluster (composite 5.9): real pain, but not BUILD.
    const members = [
      finding({ agreementCount: 40 }),
      finding({ source: "hacker-news", agreementCount: 30 }),
      finding({ source: "github-issues", agreementCount: 20 }),
    ];
    const scorecard = scorecardForCluster(members, {
      frequency: 8,
      intensity: 4,
      workaroundSpend: 5,
      buildability: 5,
      total: 59,
      rationale: "",
    });
    expect(scorecard.composite).toBe(5.9);
    expect(scorecard.verdict).toBe("PIVOT");
  });

  it("whyNow rewards recent reports and workaround spend", () => {
    const recent = scorecardForCluster(
      [finding({ date: daysAgo(2) }), finding({ date: daysAgo(5) })],
      { frequency: 5, intensity: 5, workaroundSpend: 8, buildability: 5, total: 50, rationale: "" },
    );
    const stale = scorecardForCluster(
      [finding({ date: daysAgo(400) }), finding({ date: daysAgo(500) })],
      { frequency: 5, intensity: 5, workaroundSpend: 0, buildability: 5, total: 40, rationale: "" },
    );
    expect(recent.whyNow).toBeGreaterThan(stale.whyNow);
  });
});

describe("writer — ideabrowser-inspired sections", () => {
  const [cluster] = clusterFindings([
    finding({}),
    finding({ source: "hacker-news", url: "https://example.com/hn" }),
    finding({ source: "github-issues", url: "https://example.com/gh" }),
  ]);
  const draft = writeDraft(cluster);

  it("carries the scorecard, verdict and what-is-NOT-proven on every draft", () => {
    expect(draft.mdx).toContain("### Scorecard");
    expect(draft.mdx).toContain(`Verdict: **${draft.scorecard.verdict}**`);
    expect(draft.mdx).toContain("### What is NOT proven");
    expect(draft.mdx).toContain("Paid-pilot evidence");
    expect(draft.mdx).toContain("Keyword volume and growth");
    expect(draft.notProven.length).toBeGreaterThanOrEqual(4);
    expect(draft.scorecard.verdict).toBe("BUILD");
  });

  it("shows community-signal counts by platform in the evidence panel", () => {
    expect(draft.mdx).toContain("### Community signals");
    expect(draft.communitySignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "reddit", reports: 1 }),
        expect.objectContaining({ source: "hacker-news", reports: 1 }),
      ]),
    );
    expect(draft.mdx).toContain("reddit: 1 report");
  });

  it("shows what it demands, the status quo, and the biggest risk", () => {
    expect(draft.mdx).toContain("### What it demands");
    expect(draft.mdx).toContain("Time to first revenue:");
    expect(draft.mdx).toContain("Capital to start:");
    expect(draft.mdx).toContain("Difficulty:");
    expect(draft.mdx).toContain("Biggest risk:");
    expect(draft.demands.difficultyScore).toBeGreaterThanOrEqual(1);
    expect(draft.demands.difficultyScore).toBeLessThanOrEqual(10);
    expect(draft.biggestRisk.length).toBeGreaterThan(0);
  });

  it("builds no value ladder and names no competitor when the evidence has neither", () => {
    expect(draft.prices).toEqual([]);
    expect(draft.statusQuoCompetitor).toBe("");
    expect(draft.mdx).toContain("No real prices were found in the reports");
    expect(draft.mdx).toContain("Manual work — no status-quo tool was named");
    expect(draft.gaps.join(" ")).toContain("value ladder");
  });

  it("uses real prices and a named competitor only when the evidence has them", () => {
    const [priced] = clusterFindings([
      finding({
        text: "I pay $79/mo for a tool that does half of this and I am looking for an alternative to Notion for my invoices.",
        quote: "",
      }),
    ]);
    const pricedDraft = writeDraft(priced);
    expect(pricedDraft.prices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: "$79", cadence: "per month" }),
      ]),
    );
    expect(pricedDraft.statusQuoCompetitor).toBe("Notion");
    expect(pricedDraft.mdx).toContain("$79 per month");
    expect(pricedDraft.mdx).toContain("status quo to beat");
    expect(pricedDraft.mdx).toContain("Notion");
  });

  it("maps manifest timing to the Why Now dial", () => {
    const scores = draft.manifestRow.scores as Record<string, number>;
    expect(scores.timing).toBe(draft.scorecard.whyNow);
    expect(scores.opportunity).toBe(draft.scorecard.opportunity);
  });

  it("still meets the 2,200-word deep target with the new sections", () => {
    const words = draft.mdx.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(2200);
    expect(draft.manifestRow.researchLevel).toBe("deep");
  });
});
