import { describe, expect, it } from "vitest";

import { clusterFindings, scoreCluster } from "../../lib/pain-engine/cluster";
import type { PainFinding } from "../../lib/pain-engine/types";

function finding(overrides: Partial<PainFinding> = {}): PainFinding {
  return {
    source: "reddit",
    url: "https://example.com/1",
    title: "Invoicing by hand takes hours every Friday",
    text: "I spend hours every Friday doing invoices by hand and I hate it. I wish there was a tool that did it.",
    context: "r/smallbusiness",
    date: "2026-11-01",
    agreementCount: 10,
    quote: "I spend hours every Friday doing invoices by hand.",
    ...overrides,
  };
}

describe("clusterFindings", () => {
  it("groups near-duplicate pains and keeps unrelated pains apart", () => {
    const clusters = clusterFindings([
      finding({ url: "https://example.com/1" }),
      finding({
        url: "https://example.com/2",
        source: "hacker-news",
        title: "Invoicing by hand takes hours every week",
        text: "Invoicing by hand takes hours every week. I copy amounts from emails and I hate it.",
        agreementCount: 5,
      }),
      finding({
        url: "https://example.com/3",
        source: "reddit",
        title: "My plants keep dying",
        text: "My plants keep dying and I forget to water them. I wish there was a reminder app for plant care.",
        agreementCount: 3,
      }),
    ]);
    expect(clusters).toHaveLength(2);
    const invoicing = clusters.find((c) => c.findings.length === 2);
    expect(invoicing).toBeDefined();
    expect(invoicing?.sources).toContain("reddit");
    expect(invoicing?.sources).toContain("hacker-news");
  });

  it("scores the strongest cluster first", () => {
    const clusters = clusterFindings([
      finding({ agreementCount: 200 }),
      finding({ url: "https://example.com/9", title: "Unrelated plant care", text: "My plants keep dying.", agreementCount: 1 }),
    ]);
    expect(clusters[0].findings.length).toBeGreaterThan(0);
    expect(clusters[0].score.total).toBeGreaterThanOrEqual(clusters[1].score.total);
  });
});

describe("scoreCluster", () => {
  it("rewards frequency, intensity and workaround spend", () => {
    const score = scoreCluster([
      finding({ agreementCount: 150 }),
      finding({
        url: "https://example.com/2",
        text: "I would pay for a tool that does my invoicing. I hate doing it manually every week.",
        agreementCount: 80,
      }),
    ]);
    expect(score.frequency).toBeGreaterThan(0);
    expect(score.intensity).toBeGreaterThan(0);
    expect(score.workaroundSpend).toBeGreaterThan(0);
    expect(score.total).toBeGreaterThan(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.rationale).toContain("2 findings");
  });
});
