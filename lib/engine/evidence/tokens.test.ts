import { describe, expect, it } from "vitest";

import { acceptEvidence } from "./accept.ts";
import type { AcceptedEvidence, MarketStatEvidence } from "./contract.ts";
import {
  EvidenceReferenceError,
  evidenceRefs,
  expandEvidenceTokens,
  findUnboundFigures,
  renderEvidenceInline,
  validateEditorialText,
} from "./tokens.ts";

const AT = "2026-09-30T12:00:00.000Z";

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}

const PAGES = {
  report: {
    url: "https://research.example.com/ai-code-review",
    text: "The AI code review market was valued at $1.4 million in 2024. The AI code review market will reach $5.2 billion by 2030.",
  },
  pricing: { url: "https://www.coderabbit.ai/pricing", text: "Essentials\n$24/user/month, billed annually" },
  forum: { url: "https://news.ycombinator.com/item?id=43219455", text: "All these teams need is a sanity check.\nNothing more than that." },
};

const accepted = acceptEvidence({
  candidates: {
    quotes: [{ sourceUrl: PAGES.forum.url, text: "All these teams need is a sanity check." }],
    marketStats: [
      {
        sourceUrl: PAGES.report.url,
        supportingText: "valued at $1.4 million in 2024",
        subject: "AI code review market",
        metric: "market_size",
        amountText: "$1.4 million",
        year: 2024,
        periodKind: "measured",
      },
      {
        sourceUrl: PAGES.report.url,
        supportingText: "will reach $5.2 billion by 2030",
        subject: "AI code review market",
        metric: "market_size",
        amountText: "$5.2 billion",
        year: 2030,
        periodKind: "projected",
      },
    ],
    competitorPrices: [
      {
        vendor: "CodeRabbit",
        plan: "Essentials",
        sourceUrl: PAGES.pricing.url,
        supportingText: "Essentials $24/user/month, billed annually",
        priceText: "$24/user/month, billed annually",
      },
    ],
  },
  citations: Object.values(PAGES).map((p) => ({ url: p.url })),
  sources: new Map(Object.values(PAGES).map((p) => [p.url, { status: "read" as const, text: p.text, retrievedAt: AT }])),
}).accepted;

const byKind = (kind: AcceptedEvidence["kind"], index = 0) => must(accepted.filter((e) => e.kind === kind)[index]);
const quote = byKind("community_quote");
const measured = byKind("market_stat", 0);
const projected = byKind("market_stat", 1);
const price = byKind("competitor_price");
const map = new Map(accepted.map((e) => [e.id, e]));

describe("evidenceRefs", () => {
  it("lists token ids in order, repeats included", () => {
    expect(accepted).toHaveLength(4);
    const text = `Spend is [[ev:${measured.id}]] and [[ev:${price.id}]]; again [[ev:${measured.id}]].`;
    expect(evidenceRefs(text)).toEqual([measured.id, price.id, measured.id]);
    expect(evidenceRefs("no tokens here")).toEqual([]);
  });
});

describe("findUnboundFigures", () => {
  it('flags "47 PRs", "team of 8", "60%", "25%", "$5k" and "sixty percent" in fact-bearing text', () => {
    const text =
      "Last week I reviewed 47 PRs on a team of 8. I spend 60% of my time reviewing and 25% coding. " +
      "Tools cost $5k a year and sixty percent of teams agree.";
    expect(findUnboundFigures(text).map((f) => f.figure)).toEqual(["47", "8", "60%", "25%", "$5k", "sixty percent"]);
  });

  it('allows a bare year such as "2024", but not a year used as an amount', () => {
    expect(findUnboundFigures("In 2024 reviews slowed, and by the 2020s queues doubled.")).toEqual([]);
    expect(findUnboundFigures("A $2024 budget, 2024% growth, 2024 million users").map((f) => f.figure)).toEqual([
      "$2024",
      "2024%",
      "2024 million",
    ]);
  });

  it("flags other figure shapes and spelled quantities", () => {
    const text = "It is 10x faster, 1,000s of teams, #1 on 24/7 support, forty-seven reviewers, two million installs, 1.4 billion.";
    expect(findUnboundFigures(text).map((f) => f.figure)).toEqual([
      "10x",
      "1,000s",
      "1",
      "24/7",
      "forty-seven",
      "two million",
      "1.4 billion",
    ]);
  });

  it("ignores digits inside names and words", () => {
    expect(findUnboundFigures("B2B teams on Web3, S3 and G2 reviews mention GPT-4 and COVID-19.")).toEqual([]);
  });

  it("ignores figures inside evidence tokens", () => {
    expect(findUnboundFigures(`The market was [[ev:${measured.id}]].`)).toEqual([]);
  });
});

describe("validateEditorialText", () => {
  it("flags unknown ids and kinds not allowed in the field", () => {
    const text = `Spend is [[ev:${measured.id}]], buyers say [[ev:${quote.id}]], and [[ev:s_000000000000]].`;
    expect(
      validateEditorialText({ path: "market.summary", text, factBearing: true, accepted: map, allowedKinds: ["market_stat"] }),
    ).toEqual([
      `market.summary: evidence ${quote.id} is a community_quote; allowed here: market_stat`,
      'market.summary: unknown evidence id "s_000000000000" (not an accepted item)',
    ]);
  });

  it("flags unbound figures only in fact-bearing fields", () => {
    const text = "Teams review 47 PRs a week.";
    expect(validateEditorialText({ path: "whyNow", text, factBearing: true, accepted: map })).toEqual([
      'whyNow: unbound figure "47" at 13; cite accepted evidence with [[ev:<id>]] or remove it',
    ]);
    expect(validateEditorialText({ path: "howItWorks[0]", text, factBearing: false, accepted: map })).toEqual([]);
  });

  it("flags malformed tokens", () => {
    const issues = validateEditorialText({ path: "community.summary", text: "See [[ev:q_123]] and [[ev:Q_ABCDEF012345]].", factBearing: false, accepted: map });
    expect(issues).toEqual([
      'community.summary: malformed evidence token "[[ev:q_123]]"',
      'community.summary: malformed evidence token "[[ev:Q_ABCDEF012345]]"',
    ]);
  });

  it("passes a qualitative paraphrase without figures", () => {
    const text =
      "Small teams describe AI review tools as linters that still need a human to check every flag, " +
      `so they want a quick sanity check rather than another queue [[ev:${quote.id}]].`;
    expect(validateEditorialText({ path: "community.summary", text, factBearing: true, accepted: map })).toEqual([]);
  });
});

describe("renderEvidenceInline and expandEvidenceTokens", () => {
  it("renders canonical text for each kind", () => {
    expect(renderEvidenceInline(measured)).toBe("$1.4 million (2024)");
    expect(renderEvidenceInline(projected)).toBe("$5.2 billion by 2030 (projected)");
    expect(renderEvidenceInline(price)).toBe("$24/user/month, billed annually (Essentials)");
    expect(renderEvidenceInline(quote)).toBe('"All these teams need is a sanity check."');
    const undated: MarketStatEvidence = { ...(measured as MarketStatEvidence), period: { kind: "measured" } };
    expect(renderEvidenceInline(undated)).toBe("$1.4 million");
    const openEnded: MarketStatEvidence = { ...(projected as MarketStatEvidence), period: { kind: "projected" } };
    expect(renderEvidenceInline(openEnded)).toBe("$5.2 billion (projected)");
  });

  it("expands tokens to canonical text", () => {
    const text = `The market was [[ev:${measured.id}]] and may reach [[ev:${projected.id}]]; CodeRabbit charges [[ev:${price.id}]].`;
    expect(expandEvidenceTokens(text, map)).toBe(
      "The market was $1.4 million (2024) and may reach $5.2 billion by 2030 (projected); CodeRabbit charges $24/user/month, billed annually (Essentials).",
    );
    expect(expandEvidenceTokens(`x [[ev:${quote.id}]]`, map, (item) => `<${item.kind}>`)).toBe("x <community_quote>");
  });

  it("throws on an unknown id", () => {
    expect(() => expandEvidenceTokens("Spend is [[ev:s_000000000000]].", map)).toThrow(EvidenceReferenceError);
  });
});
