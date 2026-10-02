/**
 * Contract v1 (legacy) research records — history only (WP54 integration).
 *
 * parseResearchRecord, the one parser on the publish path, refuses every v1
 * record with LegacyResearchRecordError (re-research instruction). The v1
 * shape stays readable through readLegacyResearchRecordV1 for history, so
 * the original v1 parser tests now exercise that reader: a thin or guessed
 * v1 record is still rejected by it, and nothing it returns can be compiled
 * or audited. The v1 year-one funnel test moved here from
 * quality.pipeline.test.ts when its helper became private to the reader.
 */

import { describe, expect, it } from "vitest";

import {
  LEGACY_RESEARCH_RECORD_CONTRACT_VERSION,
  LegacyResearchRecordError,
  parseResearchRecord,
  readLegacyResearchRecordV1,
  ResearchRecordParseError,
  type LegacyResearchRecordV1,
} from "./research-record.ts";

function goldFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: LegacyResearchRecordV1 = {
    contractVersion: LEGACY_RESEARCH_RECORD_CONTRACT_VERSION,
    brief: {
      title: "AI RFP Response Assistant",
      slug: "ai-rfp-response-assistant",
      oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
      targetCustomer: "SMB SaaS sales / solutions engineers",
    },
    market: {
      summary: "Proposal automation is growing; SMB wedge is underserved.",
      stats: [
        {
          claim: "RFP software market CAGR",
          value: "high-teens through mid-2030s",
          citation: {
            url: "https://www.industryresearch.biz/market-reports/request-for-proposal-rfp-software-market-109348",
            title: "Industry Research Biz — RFP software market",
          },
        },
        {
          claim: "AI RFP response automation market size (directional)",
          value: "low single-digit billions USD (2024 window)",
          citation: {
            url: "https://dataintelo.com/report/rfp-response-automation-ai-market",
            title: "DataIntelo — RFP response automation AI",
          },
        },
      ],
    },
    competitors: [
      {
        name: "Loopio",
        pricing: "Foundations from ~$20,000/year (10 seats)",
        url: "https://loopio.com/pricing/",
      },
      {
        name: "Responsive",
        pricing: "Quote-based enterprise",
        url: "https://www.responsive.io/pricing/",
      },
      {
        name: "Qvidian",
        pricing: "Enterprise contracts, typically 5-figure annual minimums",
        url: "https://uplandsoftware.com/qvidian/",
      },
    ],
    community: {
      summary: "Sales engineers complain about spreadsheet DDQs and ChatGPT hallucinations.",
      signals: [
        {
          quote: "We burn weekends answering the same SOC2 questionnaire.",
          citation: {
            url: "https://www.reddit.com/r/sales/",
            title: "r/sales thread",
          },
        },
      ],
    },
    keywords: [
      {
        term: "rfp response software",
        volume: 2400,
        competition: 0.42,
        cpc: 18.5,
        source: "provider",
      },
      {
        term: "security questionnaire automation",
        volume: 880,
        competition: 0.31,
        cpc: 12.1,
        source: "provider",
      },
    ],
    goToMarket: {
      positioning: "Credible first drafts with receipts for mid-market SaaS.",
      channels: ["LinkedIn outbound", "Product Hunt", "SEO"],
      pricingNotes: "Team $79 / Growth $199 / Scale $399",
    },
    whyNow: "Enterprise security reviews are formalizing while SMB tools lag.",
    scores: {
      opportunity: 8.2,
      pain: 8.5,
      builderConfidence: 7.1,
      execution: 7.4,
    },
    provenance: {
      costUsd: 0.52,
      ranAt: "2026-09-24T00:00:00.000Z",
      providerCalls: [
        {
          provider: "dataforseo",
          operation: "keywords",
          costUsd: 0.12,
        },
        {
          provider: "perplexity",
          operation: "market",
          costUsd: 0.2,
        },
      ],
    },
  };

  return { ...structuredClone(base), ...overrides };
}

/** The issues of the ResearchRecordParseError `read` throws. */
function issuesOf(read: () => unknown): string[] {
  try {
    read();
  } catch (error) {
    if (error instanceof ResearchRecordParseError) return error.issues;
    throw error;
  }
  throw new Error("expected a ResearchRecordParseError");
}

describe("parseResearchRecord refuses contract v1 records (publish path)", () => {
  it("throws LegacyResearchRecordError with the re-research instruction for a valid v1 record", () => {
    const read = () => parseResearchRecord(goldFixture());
    expect(read).toThrow(LegacyResearchRecordError);
    expect(read).toThrow(/Research record "ai-rfp-response-assistant" is a contract v1 \(legacy\) record/);
    expect(read).toThrow(
      /Re-research into a new file: `npm run engine:research -- --brief <brief\.json> --live --out engine\/records\/engine-draft-ai-rfp-response-assistant\.json`/,
    );
  });
});

describe("readLegacyResearchRecordV1 (history only)", () => {
  it("reads a valid v1 gold record", () => {
    const record = readLegacyResearchRecordV1(goldFixture());
    expect(record.contractVersion).toBe(1);
    expect(record.market.stats).toHaveLength(2);
    expect(record.competitors).toHaveLength(3);
    expect(record.keywords.every((k) => k.source === "provider")).toBe(true);
    expect(record.brief.slug).toBe("ai-rfp-response-assistant");
  });

  it("rejects missing market citations (Mode A STOP)", () => {
    const thin = goldFixture({
      market: {
        summary: "Thin market.",
        stats: [
          {
            claim: "Uncited claim",
            value: "big",
            citation: { url: "not-a-url", title: "x" },
          },
        ],
      },
    });
    expect(issuesOf(() => readLegacyResearchRecordV1(thin)).some((i) => i.includes("market.stats"))).toBe(true);
  });

  it("rejects competitors without pricing or URL", () => {
    const thin = goldFixture({
      competitors: [
        { name: "Loopio", pricing: "$20k/yr", url: "https://loopio.com/pricing/" },
        { name: "Responsive", pricing: "", url: "https://www.responsive.io/pricing/" },
        { name: "DIY", pricing: "$20/mo", url: "ftp://bad.example" },
      ],
    });
    expect(issuesOf(() => readLegacyResearchRecordV1(thin)).some((i) => i.includes("competitors"))).toBe(true);
  });

  it("rejects guessed / model-invented keyword metrics", () => {
    const guessed = goldFixture({
      keywords: [
        {
          term: "rfp software",
          volume: 9999,
          competition: 0.5,
          cpc: 9.9,
          source: "model",
        },
      ],
    });
    expect(issuesOf(() => readLegacyResearchRecordV1(guessed)).some((i) => i.includes("provider-sourced"))).toBe(true);
  });

  it("rejects keyword rows missing numeric volume/cpc", () => {
    const bad = goldFixture({
      keywords: [
        {
          term: "rfp software",
          volume: "lots",
          competition: 0.5,
          cpc: null,
          source: "provider",
        },
      ],
    });
    expect(() => readLegacyResearchRecordV1(bad)).toThrow(ResearchRecordParseError);
  });

  it("rejects unknown contractVersion", () => {
    expect(() =>
      readLegacyResearchRecordV1(goldFixture({ contractVersion: 99 })),
    ).toThrow(/contractVersion/);
    expect(() =>
      readLegacyResearchRecordV1(goldFixture({ contractVersion: "1" })),
    ).toThrow(/contractVersion/);
    // A v2 record is not history: the legacy reader refuses it too.
    expect(() => readLegacyResearchRecordV1(goldFixture({ contractVersion: 2 }))).toThrow(/contractVersion/);
  });

  it("rejects a v1 funnel that grows or pays more accounts than it has", () => {
    const issues = issuesOf(() =>
      readLegacyResearchRecordV1(
        goldFixture({
          editorial: {
            yearOne: {
              funnel: [
                { stage: "a", count: 10 },
                { stage: "b", count: 20 },
              ],
              tier: "Team",
              payingAccounts: 50,
              monthlyRevenuePerAccount: 10,
            },
          },
        }),
      ),
    );
    expect(issues.join(" ")).toMatch(/must not grow/);
    expect(issues.join(" ")).toMatch(/exceeds the last funnel stage/);
  });
});
