import { describe, expect, it } from "vitest";
import {
  parseResearchRecord,
  ResearchRecordParseError,
  RESEARCH_RECORD_CONTRACT_VERSION,
  type ResearchRecord,
} from "./research-record";

function goldFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const base: ResearchRecord = {
    contractVersion: RESEARCH_RECORD_CONTRACT_VERSION,
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

describe("parseResearchRecord", () => {
  it("accepts a valid gold record", () => {
    const record = parseResearchRecord(goldFixture());
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
    expect(() => parseResearchRecord(thin)).toThrow(ResearchRecordParseError);
    try {
      parseResearchRecord(thin);
    } catch (e) {
      const err = e as ResearchRecordParseError;
      expect(err.issues.some((i) => i.includes("market.stats"))).toBe(true);
    }
  });

  it("rejects competitors without pricing or URL", () => {
    const thin = goldFixture({
      competitors: [
        { name: "Loopio", pricing: "$20k/yr", url: "https://loopio.com/pricing/" },
        { name: "Responsive", pricing: "", url: "https://www.responsive.io/pricing/" },
        { name: "DIY", pricing: "$20/mo", url: "ftp://bad.example" },
      ],
    });
    expect(() => parseResearchRecord(thin)).toThrow(ResearchRecordParseError);
    try {
      parseResearchRecord(thin);
    } catch (e) {
      const err = e as ResearchRecordParseError;
      expect(err.issues.some((i) => i.includes("competitors"))).toBe(true);
    }
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
    expect(() => parseResearchRecord(guessed)).toThrow(ResearchRecordParseError);
    try {
      parseResearchRecord(guessed);
    } catch (e) {
      const err = e as ResearchRecordParseError;
      expect(err.issues.some((i) => i.includes("provider-sourced"))).toBe(true);
    }
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
    expect(() => parseResearchRecord(bad)).toThrow(ResearchRecordParseError);
  });

  it("rejects unknown contractVersion", () => {
    expect(() =>
      parseResearchRecord(goldFixture({ contractVersion: 99 })),
    ).toThrow(/contractVersion/);
    expect(() =>
      parseResearchRecord(goldFixture({ contractVersion: "1" })),
    ).toThrow(/contractVersion/);
  });
});
