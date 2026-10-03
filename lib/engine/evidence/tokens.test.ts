import { describe, expect, it } from "vitest";

import { acceptEvidence } from "./accept.ts";
import type { AcceptedEvidence, CompetitorPriceEvidence, MarketStatEvidence } from "./contract.ts";
import {
  EvidenceReferenceError,
  evidenceRefs,
  expandEvidenceTokens,
  findComputations,
  findQuotedSpans,
  findRevenueTotals,
  findUnboundFigures,
  renderEvidenceInline,
  STANDARD_AND_VERSION_NAMES,
  validateEditorialText,
  VERSIONED_SOFTWARE_NAMES,
  WRITER_NUMBER_NAME_RULE,
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
    // Ruling R13 made "24/7" a standard name; "9/10" keeps the slash-separated figure shape covered.
    const text = "It is 10x faster, 1,000s of teams, #1 on 9/10 support queues, forty-seven reviewers, two million installs, 1.4 billion.";
    expect(findUnboundFigures(text).map((f) => f.figure)).toEqual([
      "10x",
      "1,000s",
      "1",
      "9/10",
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

  it("R6: flags a quoted span of three or more words in writer text, and only there", () => {
    const text = "As one commenter put it, “our team answers every questionnaire by hand.”";
    expect(validateEditorialText({ path: "editorial.problemNarrative", text, factBearing: true, accepted: map })).toEqual([
      "editorial.problemNarrative: quoted span “our team answers every questionnaire by hand.” (7 words); quotations reach the page only as quote evidence ([[ev:<id>]]), so write no quotation marks",
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

// ---------------------------------------------------------------------------
// Ruling R13: realistic writer text, one rule set
// ---------------------------------------------------------------------------

describe("R13: standard and version names are not figures", () => {
  it.each([
    "Buyers ask for SOC 2 reports and ISO 27001 certificates before any security review.",
    "Use Next.js 15, React 19, Postgres 16 and Node 22 with OAuth 2.0 sign-in through Microsoft 365.",
    "Support stays available 24/7 for the paying teams.",
    "Freelancers file a Form 1099 and keep a W-9 on record; contractors get a 1099-NEC.",
    "It drafts answers with Claude 3.5 Sonnet or GPT-4o and Gemini 2.5 Pro, and stores embeddings in pgvector.",
    "Pages meet WCAG 2.2 AA, cards follow PCI DSS 4.0, links use TLS 1.3 over HTTP/2, on IPv6.",
    "It runs on Python 3.12, Ruby 3.3 with Rails 8, Django 5, Vue 3, Angular 18, Svelte 5 and Tailwind v4.",
    "Office 365, ISO/IEC 27001:2022, SOC 1 and SOC 3 reports, Ubuntu 24.04, Windows 11, macOS 15 and iOS 18 are fine.",
    "TypeScript 5.6, Swift 6, Kotlin 2.0, Java 21, PHP 8.3, Android 15, MySQL 8, PostgreSQL 17, Llama 3.1 and Mistral 7 too.",
  ])("allows %s", (text) => {
    expect(figures(text)).toEqual([]);
  });

  it("exports one allowlist of patterns, and keeps every other figure", () => {
    expect(STANDARD_AND_VERSION_NAMES.length).toBeGreaterThan(5);
    expect(figures("SOC 4 audits, ISO 27001% compliance and Node 22 million installs.")).toEqual(["4", "27001%", "22 million"]);
    expect(figures("Two-person sales teams ship in two weekends; Seven Bridges sells too.")).toEqual(["Two", "two", "Seven"]);
    expect(figures("Five9 sells to call centers.")).toEqual([]);
  });

  it.each([
    ["Python 4000 developers use it.", ["4000"]],
    ["Claude 47 teams pay for it.", ["47"]],
    ["React 300 times faster.", ["300"]],
    ["Node 22 active users joined.", ["22"]],
    ["React 19 developers pick it.", ["19"]],
    ["TLS 1300 servers and OAuth 4000 apps.", ["1300", "4000"]],
  ])("counts a number after a versioned name unless it looks like a version (review P3-3): %s", (text, expected) => {
    expect(figures(text)).toEqual(expected);
  });

  it("keeps versions with decimals, model names and fixed-number standards as names (review P3-3 passing set)", () => {
    for (const text of [
      "SOC 2, ISO 27001, Next.js 15, React 19, Postgres 16, Node 22, OAuth 2.0, Microsoft 365, 24/7, Form 1099, W-9, Claude 3.5 and Five9.",
      "Python 3.12, Ubuntu 24.04, Node 22.11.0, Tailwind v4, GPT-4o, Claude 3.5 Sonnet, Gemini 2.5 Pro and the Claude 3 models.",
      "OAuth 2.0 apps, ISO 27001 teams and Microsoft 365 users stay names; so do TLS 1.3, WCAG 2.2 and PCI DSS 4.0.",
    ]) {
      expect(figures(text), text).toEqual([]);
    }
  });

  it("accepts SAML and SCIM versions and two-factor, the stable standard terms pages need (review P3-4)", () => {
    for (const text of ["SSO through SAML 2.0 and provisioning through SCIM 2.0.", "Two-factor sign-in, two-factor authentication and 2FA codes."]) {
      expect(figures(text), text).toEqual([]);
    }
    // Still figures: a count of factors, and SAML with a number that is no version.
    expect(figures("Two factors explain it, and SAML 3000 users signed in.")).toEqual(["Two", "3000"]);
  });

  it("states exactly what it accepts for the writer (review P3-4)", () => {
    // Every listed software name takes a short version, and nothing else does.
    for (const name of VERSIONED_SOFTWARE_NAMES) {
      expect(figures(`It runs on ${name} 15 and ${name} 3.5.`), name).toEqual([]);
      expect(figures(`It runs on ${name} 300.`), name).toEqual(["300"]);
      expect(WRITER_NUMBER_NAME_RULE).toContain(name);
    }
    for (const text of [
      "SOC 1, SOC 2, SOC 3, ISO 27001, ISO/IEC 27001, OAuth 2.0, SAML 2.0, SCIM 2.0, PCI DSS 4.0, WCAG 2.2, TLS 1.3, SSL 3.0, HTTP/2, IPv4, IPv6",
      "24/7, Microsoft 365, Office 365, Form 1099, 1099-NEC, W-2, W-9, two-factor, B2B, Web3, GPT-4o, 2FA, 2026, Next.js 15, Claude 3.5",
    ]) {
      expect(figures(text), text).toEqual([]);
    }
    expect(figures("10x, 5k and 3rd")).toEqual(["10x", "5k", "3rd"]);
    // The names the rule says to write without their number are figures, so the instruction is exact.
    for (const [text, figure] of [
      ["Claude Sonnet 4.5", "4.5"],
      ["Redis 7", "7"],
      ["Prisma 5", "5"],
      ["MongoDB 7", "7"],
      ["Expo SDK 52", "52"],
      ["Xcode 16", "16"],
      ["Fortune 500", "500"],
    ] as const) {
      expect(figures(text), text).toEqual([figure]);
    }
    expect(WRITER_NUMBER_NAME_RULE).toMatch(/Any other number in a name is a figure \(Claude Sonnet 4\.5, Redis 7, Fortune 500\): drop the number\./);
  });

  it("treats digits inside snake_case identifiers as names (review probe p20)", () => {
    expect(figures("Tables library_documents, tier_1_questionnaires and answers_v2.")).toEqual([]);
    expect(figures("A tier 1 plan for tier_1 buyers.")).toEqual(["1"]);
  });
});

describe("R13: currency symbols and quantity hyphen forms are figures", () => {
  it("flags any currency symbol outside a token, with or without digits (security N6)", () => {
    expect(figures("Most $lOk deals stall, and € pricing confuses buyers.")).toEqual(["$lOk", "€"]);
  });

  it("flags sub-, top-, under-, over-, up-to- and about-N forms (review probe p25)", () => {
    expect(figures("Indie developers and sub-10 engineering teams pick from the top-5 vendors.")).toEqual(["10", "5"]);
    expect(figures("Teams under-30 people, over-50 seats, up-to-10 users, about-15% churn, grew by-40% last year.")).toEqual([
      "30",
      "50",
      "10",
      "15%",
      "40%",
    ]);
    expect(figures("GPT-4o, COVID-19 and W-2 stay names; Top-5 does not.")).toEqual(["5"]);
  });
});

describe("R13: quoted spans in every quotation style", () => {
  it.each([
    ["typographic double", "One buyer said “we would pay for this tomorrow” at the demo."],
    ["typographic double with joiners", "One buyer said “\u2060we would pay for this tomorrow\u2060” at the demo."],
    ["typographic single", "One buyer said ‘we would pay for this tomorrow’ at the demo."],
    ["straight single", "One buyer said 'we would pay for this tomorrow' at the demo."],
    ["corner brackets", "One buyer said 「we would pay for this tomorrow」 at the demo."],
    ["white corner brackets", "One buyer said 『we would pay for this tomorrow』 at the demo."],
    ["single guillemets", "One buyer said ‹we would pay for this tomorrow› at the demo."],
  ])("finds a %s quotation (security probe-quoted-spans)", (_label, text) => {
    expect(findQuotedSpans(text)).toHaveLength(1);
    expect(findQuotedSpans(text)[0]?.inner.replace(/\u2060/g, "")).toBe("we would pay for this tomorrow");
  });

  it("finds the review's single-quote and corner-bracket fabrications (review probes p19, p5 Q2s/Q2a/Q2c)", () => {
    for (const text of [
      "One engineer on the thread summed it up: ‘legal rejects every single draft the chat tool writes for us, and the deal waits.’",
      "As one engineer on the thread put it, 'legal rejects every single draft that the chat tool writes for us.' — [thread](https://news.example.com/item?id=1)",
      "One engineer: 「Legal rejects every single draft that the chat tool writes for us.」",
    ]) {
      expect(findQuotedSpans(text), text).toHaveLength(1);
    }
  });

  it("does not read apostrophes as quotation marks", () => {
    for (const text of [
      "Sales engineers don't trust the teams' old answers, and it's the buyer's call.",
      "In the '90s teams used rock 'n' roll playlists, and the team’s library didn’t help.",
      "The owners’ approvals and the reviewers’ notes stay with each answer.",
    ]) {
      expect(findQuotedSpans(text), text).toEqual([]);
    }
  });

  it("does not run an unclosed single quote to the end of the text", () => {
    expect(findQuotedSpans("The '90s were different for proposal teams and their tools.")).toEqual([]);
  });
});

describe("R13: revenue totals and computations (the auditor's rules, shared)", () => {
  it("finds a money amount beside revenue wording, either way round (review probe p16)", () => {
    expect(findRevenueTotals("Shared library and review workflow for teams closing up to $250k in annual sales.").map((m) => m.text)).toEqual([
      "$250k in annual sales",
    ]);
    expect(findRevenueTotals("$100 MRR per account").map((m) => m.text)).toEqual(["$100 MRR"]);
    expect(findRevenueTotals("One seat; pays for itself at $39 MRR once a single deal closes.").map((m) => m.text)).toEqual(["$39 MRR"]);
    expect(findRevenueTotals("Target ARR: 5,400,000 USD and an annual run-rate of $250k.").map((m) => m.text)).toEqual([
      "ARR: 5,400,000 USD",
      "annual run-rate of $250k",
    ]);
  });

  it("does not read a price or a tier that mentions ARR after its price as a revenue total", () => {
    for (const text of ["$100 per month", "$39/month", "$12/month) — ARR dashboards", "$25/seat/month, billed annually"]) {
      expect(findRevenueTotals(text), text).toEqual([]);
    }
  });

  it("finds a Year-One-style computation", () => {
    expect(findComputations("Fifteen teams, so 15 × $100/month = $1,500 a month.").map((m) => m.text)).toEqual(["15 × $100/month = $1"]);
    expect(findComputations("$100 per month for each team")).toEqual([]);
  });
});

describe("R13: the shared revenue and computation detectors run in linear time and agree with the audit", () => {
  // The final audit's rules as of c97f6d0 (lib/engine/artifact-audit.ts), the reference for parity.
  const MONEY = String.raw`(?:(?:US|CA|AU|C|A)?[$€£]\s?\d[\d,]*(?:\.\d+)?|(?:USD|EUR|GBP|CAD|AUD)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|CAD|AUD)\b)(?:\s?(?:k|m|mn|bn|b|thousand|million|billion|trillion)\b)?`;
  const NOUN = String.raw`(?:ARR|MRR|revenue|run[- ]?rate|sales|income)`;
  const MOD = String.raw`(?:annual|annualized|yearly|monthly|recurring|new|total|gross|net|projected|expected)`;
  const AUDIT_REVENUE_RE = new RegExp(
    String.raw`${MONEY}(?:\s*\/\s*(?:mo|month|yr|year))?(?:\s+(?:a|per)\s+(?:year|month))?(?:\s+(?:in|of))?(?:\s+${MOD})*\s+${NOUN}\b` +
      String.raw`|\b(?:${MOD}\s+)*${NOUN}\s*(?:[:=]|of|at|is|was|reaches|reaching|hits|hitting|to|totals?|totaling|near|around|about|over|above)?\s*(?:of\s+)?~?\s*${MONEY}`,
    "i",
  );
  const AUDIT_COMPUTATION_RE = /\d[\d,]*\s*[×xX*]\s*(?:US)?[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*[A-Za-z]+)*\s*=\s*(?:US)?[$€£]?\s?\d/;

  const PIECES = [
    "ARR", "MRR", "annual", "net", "run-rate", "sales", "revenue", "of", "in", "a", "per", "month", "year", "at", "is", "to",
    "totals", "~", ":", "=", "$", "US$", "€", "USD", "eur", "1", "15", "1,000", ",", ".", "5", "k", "m", "bn", "million",
    "×", "x", "*", "/", "/mo", "seat", "biannual", "planet", "Revenue", "arr",
    "$250k", "$1,500", "15 USD", "€1.5 million", "$100/month", "15 × $100/month = $1,500",
  ];
  const SEPARATORS = [" ", " ", " ", "", "  ", ":", ", ", "\n"];
  function randomText(seed: number): string {
    let state = seed;
    const next = (): number => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    const pick = (list: readonly string[]): string => list[Math.floor(next() * list.length)] ?? "";
    const length = 1 + Math.floor(next() * 10);
    let text = "";
    for (let i = 0; i < length; i += 1) text += `${pick(PIECES)}${pick(SEPARATORS)}`;
    return text;
  }
  const first = (re: RegExp, text: string): { text: string; index: number } | null => {
    const m = re.exec(text);
    return m ? { text: m[0], index: m.index } : null;
  };

  it("finds the audit's first match on every one of thousands of generated texts", () => {
    let revenueHits = 0;
    let computationHits = 0;
    for (let seed = 1; seed <= 20_000; seed += 1) {
      const text = randomText(seed);
      const revenue = first(AUDIT_REVENUE_RE, text);
      expect(findRevenueTotals(text)[0] ?? null, JSON.stringify(text)).toEqual(revenue);
      const computation = first(AUDIT_COMPUTATION_RE, text);
      expect(findComputations(text)[0] ?? null, JSON.stringify(text)).toEqual(computation);
      if (revenue) revenueHits += 1;
      if (computation) computationHits += 1;
    }
    // The generator reaches both rules often enough to mean something.
    expect(revenueHits).toBeGreaterThan(200);
    expect(computationHits).toBeGreaterThan(20);
  });

  it.each([
    ["revenue wording before a long run of spaces", "ARR" + " ".repeat(20_000) + "x"],
    ["a long run of digit groups", "1,".repeat(10_000)],
    ["revenue wording before a long run of digit groups", "ARR " + "1,".repeat(10_000)],
    ["a long chain of revenue modifiers", "annual ".repeat(2_800) + "ARR x"],
    ["a money amount before a long run of spaces", "$1" + " ".repeat(20_000) + "x"],
  ])("stays linear on %s (a 20,000-character field)", (_label, text) => {
    const started = performance.now();
    findRevenueTotals(text);
    findComputations(text);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it.each([
    ["standard names", "SOC 2 and Next.js 15 ".repeat(1_000)],
    ["one long snake_case identifier", `t${"_1".repeat(10_000)}`],
    ["single quotes and apostrophes", "'a b' don't teams' ".repeat(1_000)],
    ["unclosed corner brackets", "「a b c ".repeat(2_500)],
  ])("findUnboundFigures and findQuotedSpans stay linear on %s", (_label, text) => {
    const started = performance.now();
    findUnboundFigures(text);
    findQuotedSpans(text);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
