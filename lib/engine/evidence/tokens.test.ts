import { describe, expect, it } from "vitest";

import { acceptEvidence } from "./accept.ts";
import type { AcceptedEvidence, CompetitorPriceEvidence, MarketStatEvidence } from "./contract.ts";
import {
  EvidenceReferenceError,
  evidenceRefs,
  expandEvidenceTokens,
  findQuotedSpans,
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
  sources: new Map(
    Object.values(PAGES).map((p) => [p.url, { status: "read" as const, text: p.text, retrievedAt: AT, roles: ["market", "competitors", "community"] as const }]),
  ),
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

// ---------------------------------------------------------------------------
// Ruling R6: no free figures in writer text (final review P1-1)
// ---------------------------------------------------------------------------

const figures = (text: string) => findUnboundFigures(text).map((f) => f.figure);

describe("R6: findUnboundFigures catches every figure shape", () => {
  it("flags fullwidth, mathematical and other-script digits after NFKC (review probe p4 v4)", () => {
    expect(figures("Sales teams of ８ answer ４７ questionnaires a quarter and spend ６０％ of their week on them.")).toEqual([
      "８",
      "４７",
      "６０％",
    ]);
    expect(figures("The niche already spends $𝟏𝟐 million a year on manual answering.")).toEqual(["$𝟏𝟐 million"]);
    expect(figures("Arabic-Indic ٤٧ and Devanagari ४७ digits count too.")).toEqual(["٤٧", "४७"]);
  });

  it("reports indices into the original text, so callers can show the context", () => {
    const text = "We spend ６０％ of our week; 𝟏𝟐 teams agree.";
    for (const hit of findUnboundFigures(text)) expect(text.slice(hit.index, hit.index + hit.figure.length)).toBe(hit.figure);
  });

  it("flags spelled numbers: two to nineteen, the tens with compounds, hundred to trillion and dozens", () => {
    expect(figures("Our team of eight answers forty seven questionnaires and loses a dozen deals a year.")).toEqual([
      "eight",
      "forty seven",
      "dozen",
    ]);
    expect(figures("Twenty-five reviewers, two hundred teams, hundreds of buyers, thousands of seats and dozens of tools.")).toEqual([
      "Twenty-five",
      "two hundred",
      "hundreds",
      "thousands",
      "dozens",
    ]);
    expect(figures("It took ten weeks, three vendors and nineteen calls.")).toEqual(["ten", "three", "nineteen"]);
  });

  it("flags percent and per cent with or without a number", () => {
    expect(figures("Most of the budget, in percent terms, and a large per cent of buyers.")).toEqual(["percent", "per cent"]);
    expect(figures("Sixty per cent of teams and half the budget.")).toEqual(["Sixty per cent"]);
  });

  it("flags quantities glued to a unit, a magnitude, a plural or an ordinal", () => {
    expect(figures("Loads 5GB in 200ms, answers in 24h, 3rd place, 1000s of users, 4K exports.")).toEqual([
      "5GB",
      "200ms",
      "24h",
      "3rd",
      "1000s",
      "4K",
    ]);
  });

  it("keeps letter-adjacent names, bare years and the qualitative words it does not list", () => {
    expect(figures("B2B teams on Web3 and 3D tools with 2FA, GPT-4o, H1 plans, Q3 goals and x86 builds.")).toEqual([]);
    expect(figures("In 2024 one team, the first buyer, a single seat, half the work and both plans; zero downtime.")).toEqual([]);
    expect(figures("Since the 2020s, from 1990 to 2039.")).toEqual([]);
    expect(figures("In 2040 or 1989.")).toEqual(["2040", "1989"]);
  });

  it("does not read number words inside other words", () => {
    expect(figures("Often, attention, network, sevenfold-free toners and tenants.")).toEqual([]);
  });
});

describe("R6: findQuotedSpans", () => {
  it("finds double-quoted spans of three or more words in straight, typographic and guillemet quotes", () => {
    const text =
      'As one commenter put it, “our team answers every questionnaire by hand.” Another said "we hate it" and «nobody reads them» too.';
    expect(findQuotedSpans(text).map((s) => s.span)).toEqual([
      "“our team answers every questionnaire by hand.”",
      '"we hate it"',
      "«nobody reads them»",
    ]);
  });

  it('ignores short labels and tokens: a "bold" word, a two-word "term of art", an evidence token', () => {
    expect(findQuotedSpans(`A "bold" claim, a "term art" and "[[ev:${quote.id}]]".`)).toEqual([]);
  });

  it("treats an unclosed quotation as running to the end of the text", () => {
    expect(findQuotedSpans("He wrote “we burn every weekend on these").map((s) => s.words)).toEqual([6]);
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

  it("R6: flags a double-quoted span of three or more words in writer text, and only there", () => {
    const text = "As one commenter put it, “our team answers every questionnaire by hand.”";
    expect(validateEditorialText({ path: "editorial.problemNarrative", text, factBearing: true, accepted: map })).toEqual([
      'editorial.problemNarrative: double-quoted span "“our team answers every questionnaire by hand.”" (7 words); quotations reach the page only as quote evidence ([[ev:<id>]])',
    ]);
    expect(validateEditorialText({ path: "editorial.dataModel[0].columns", text, factBearing: false, accepted: map })).toEqual([]);
  });

  it("R7: refuses every token in a field that allows no kinds, and ids outside an allowed set", () => {
    const text = `Ship it [[ev:${price.id}]].`;
    expect(validateEditorialText({ path: "howItWorks[0]", text, factBearing: true, accepted: map, allowedKinds: [] })).toEqual([
      `howItWorks[0]: evidence ${price.id} cannot be cited here (this field takes no evidence tokens)`,
    ]);
    expect(
      validateEditorialText({
        path: "competitors[1].notes",
        text,
        factBearing: true,
        accepted: map,
        allowedKinds: ["competitor_price"],
        allowedIds: new Set(["p_000000000000"]),
      }),
    ).toEqual([`competitors[1].notes: evidence ${price.id} is not one of the items this field may cite`]);
  });
});

describe("renderEvidenceInline and expandEvidenceTokens", () => {
  it("R7: renders the claim, not only the figure: subject, metric and period for a stat; vendor and plan for a price", () => {
    expect(renderEvidenceInline(measured)).toBe("$1.4 million (AI code review market, market size, 2024)");
    expect(renderEvidenceInline(projected)).toBe("$5.2 billion by 2030 (AI code review market, market size, projected)");
    expect(renderEvidenceInline(price)).toBe("$24/user/month, billed annually (CodeRabbit Essentials plan)");
    expect(renderEvidenceInline(quote)).toBe('"All these teams need is a sanity check."');
    const undated: MarketStatEvidence = { ...(measured as MarketStatEvidence), period: { kind: "measured" } };
    expect(renderEvidenceInline(undated)).toBe("$1.4 million (AI code review market, market size)");
    const openEnded: MarketStatEvidence = { ...(projected as MarketStatEvidence), period: { kind: "projected" } };
    expect(renderEvidenceInline(openEnded)).toBe("$5.2 billion (AI code review market, market size, projected)");
    const other: MarketStatEvidence = { ...(measured as MarketStatEvidence), metric: "other" };
    expect(renderEvidenceInline(other)).toBe("$1.4 million (AI code review market, 2024)");
    const growth: MarketStatEvidence = {
      ...(measured as MarketStatEvidence),
      metric: "growth_rate",
      amount: { value: "28.5", magnitude: "none", unit: "percent" },
    };
    expect(renderEvidenceInline(growth)).toBe("28.5% (AI code review market, growth rate, 2024)");
  });

  it("R7: names the vendor alone without a plan, and does not repeat a vendor or a plan word", () => {
    const base = price.kind === "competitor_price" ? price : null;
    if (!base) throw new Error("expected a price");
    const noPlan: CompetitorPriceEvidence = { ...base };
    delete noPlan.plan;
    expect(renderEvidenceInline(noPlan)).toBe("$24/user/month, billed annually (CodeRabbit)");
    expect(renderEvidenceInline({ ...base, plan: "CodeRabbit Pro" })).toBe("$24/user/month, billed annually (CodeRabbit Pro plan)");
    expect(renderEvidenceInline({ ...base, plan: "Team Plan" })).toBe("$24/user/month, billed annually (CodeRabbit Team Plan)");
  });

  it("R7: a re-attached token still shows its own claim (review probe p4 v5)", () => {
    const text = `Bidwell customers report churn of [[ev:${measured.id}]] in their first year.`;
    expect(expandEvidenceTokens(text, map)).toBe(
      "Bidwell customers report churn of $1.4 million (AI code review market, market size, 2024) in their first year.",
    );
  });

  it("expands tokens to canonical text", () => {
    const text = `The market was [[ev:${measured.id}]] and may reach [[ev:${projected.id}]]; CodeRabbit charges [[ev:${price.id}]].`;
    expect(expandEvidenceTokens(text, map)).toBe(
      "The market was $1.4 million (AI code review market, market size, 2024) and may reach $5.2 billion by 2030 (AI code review market, market size, projected); CodeRabbit charges $24/user/month, billed annually (CodeRabbit Essentials plan).",
    );
    expect(expandEvidenceTokens(`x [[ev:${quote.id}]]`, map, (item) => `<${item.kind}>`)).toBe("x <community_quote>");
  });

  it("throws on an unknown id", () => {
    expect(() => expandEvidenceTokens("Spend is [[ev:s_000000000000]].", map)).toThrow(EvidenceReferenceError);
  });
});
