import { describe, expect, it } from "vitest";

import {
  acceptEvidence,
  checkEvidenceMinimums,
  evidenceId,
  parseExtractionCandidates,
  revalidateAcceptedEvidence,
  sha256Hex,
  type SourceInput,
} from "./accept.ts";
import { canonicalSourceUrl } from "./citation.ts";
import type {
  AcceptedEvidence,
  CompetitorPriceCandidate,
  ExtractionCandidates,
  MarketStatCandidate,
  QuoteCandidate,
  SourceAcquisition,
  SourceStatus,
} from "./contract.ts";

const AT = "2026-09-30T12:00:00.000Z";

type Page = { url: string; text: string; status?: SourceStatus };

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}

function sourcesOf(pages: Page[]): Map<string, SourceInput> {
  return new Map(
    pages.map((p): [string, SourceInput] => [
      p.url,
      p.status && p.status !== "read" ? { status: p.status } : { status: "read", text: p.text, retrievedAt: AT },
    ]),
  );
}

function run(
  pages: Page[],
  candidates: Partial<ExtractionCandidates>,
  options: { citations?: string[]; vendorHints?: string[] } = {},
) {
  return acceptEvidence({
    candidates: { quotes: [], marketStats: [], competitorPrices: [], ...candidates },
    citations: (options.citations ?? pages.map((p) => p.url)).map((url) => ({ url, title: "Cited page" })),
    sources: sourcesOf(pages),
    ...(options.vendorHints ? { vendorHints: options.vendorHints } : {}),
  });
}

function acquisitions(pages: Page[]): SourceAcquisition[] {
  return pages.map((p) => ({
    url: must(canonicalSourceUrl(p.url)),
    roles: ["market", "competitors", "community"],
    status: p.status ?? "read",
    ...(p.status && p.status !== "read" ? {} : { retrievedAt: AT }),
  }));
}

const reasons = (result: ReturnType<typeof run>) => result.rejected.map((r) => r.reason);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REPORT = { url: "https://research.example.com/ai-code-review-market", text: "" };
const BLOG = {
  url: "https://blog.example.com/rfp-tools-compared",
  text: "We priced the leaders. Loopio costs $20,000/year while Qvidian costs $30/month. Both offer trials.",
};
const CODERABBIT = {
  url: "https://www.coderabbit.ai/pricing",
  text: "Pricing\nPro\n$24/user/month, billed annually\nUnlimited reviews for private repositories.\nEnterprise\nCustom pricing",
};
const RFPAI = {
  url: "https://rfp.ai/",
  text: "RFP.ai plans\nStarter €49/month\nProfessional €129/month\nCompare RFP.ai with DeepRFP and AutoRFP.",
};

function stat(overrides: Partial<MarketStatCandidate> & { supportingText: string }): MarketStatCandidate {
  return {
    sourceUrl: REPORT.url,
    subject: "AI code review market",
    metric: "market_size",
    amountText: "$1.4 million",
    periodKind: "measured",
    ...overrides,
  };
}

function priceCandidate(overrides: Partial<CompetitorPriceCandidate> & { vendor: string; priceText: string }): CompetitorPriceCandidate {
  return { sourceUrl: BLOG.url, supportingText: BLOG.text, ...overrides };
}

// ---------------------------------------------------------------------------
// F5 test matrix (plan §6) at the acceptance level
// ---------------------------------------------------------------------------

describe("F5 matrix: whole claims, not numbers", () => {
  it("rejects a $20,000/month claim against a $20,000/year source", () => {
    const page = { url: "https://g2.example.com/loopio", text: "Loopio costs $20,000/year for a ten-seat team." };
    const result = run([page], {
      competitorPrices: [priceCandidate({ vendor: "Loopio", sourceUrl: page.url, supportingText: page.text, priceText: "$20,000/month" })],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["period_mismatch"]);
  });

  it("rejects a $1.4 billion claim against a $1.4 million source", () => {
    const page = { ...REPORT, text: "The AI code review market was worth $1.4 million in 2024." };
    const result = run([page], {
      marketStats: [stat({ supportingText: page.text, amountText: "$1.4 billion", year: 2024 })],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["amount_mismatch"]);
  });

  it('rejects a "$2024 billion" claim grounded only on "Published in 2024"', () => {
    const page = { ...REPORT, text: "Published in 2024. The AI code review market is growing quickly." };
    const result = run([page], {
      marketStats: [stat({ supportingText: "Published in 2024. The AI code review market is growing quickly.", amountText: "$2024 billion", year: 2024 })],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["amount_mismatch"]);
  });

  it("rejects Loopio at Qvidian's $30/month and accepts Loopio's own $20,000/year as secondary, from one sentence", () => {
    const wrong = run([BLOG], { competitorPrices: [priceCandidate({ vendor: "Loopio", priceText: "$30/month" })] }, { vendorHints: ["Qvidian"] });
    expect(wrong.accepted).toEqual([]);
    expect(reasons(wrong)).toEqual(["ambiguous_attribution"]);

    const unhinted = run([BLOG], { competitorPrices: [priceCandidate({ vendor: "Loopio", priceText: "$30/month" })] });
    expect(reasons(unhinted)).toEqual(["vendor_not_in_context"]);

    const right = run([BLOG], { competitorPrices: [priceCandidate({ vendor: "Loopio", priceText: "$20,000/year" })] }, { vendorHints: ["Qvidian"] });
    expect(right.rejected).toEqual([]);
    const item = must(right.accepted[0]);
    expect(item).toMatchObject({
      kind: "competitor_price",
      vendor: "Loopio",
      attribution: "secondary",
      // From the start of the copied span's sentence to the end of the price's clause.
      excerpt: "We priced the leaders. Loopio costs $20,000/year",
      price: { amount: { value: "20000", magnitude: "none", unit: "currency", currency: "USD" }, period: "year", basis: "flat", qualifiers: [] },
    });
  });

  it("rejects Loopio at Qvidian's price from a flattened pricing table", () => {
    const table = { url: "https://compare.example.com/rfp", text: "Vendor Price\nLoopio $20,000/year\nQvidian $30/month" };
    const result = run(
      [table],
      { competitorPrices: [priceCandidate({ vendor: "Loopio", sourceUrl: table.url, supportingText: table.text, priceText: "$30/month" })] },
      { vendorHints: ["Qvidian"] },
    );
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
  });

  it("rejects USD 30/account/month against EUR 30/user/month", () => {
    const page = { url: "https://acme.example.com/pricing", text: "Acme Team costs EUR 30/user/month." };
    const result = run([page], {
      competitorPrices: [priceCandidate({ vendor: "Acme", sourceUrl: page.url, supportingText: page.text, priceText: "USD 30/account/month" })],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["currency_mismatch"]);
  });

  it("rejects $24/month when the source says $24/user/month, billed annually", () => {
    const result = run([CODERABBIT], {
      competitorPrices: [
        priceCandidate({ vendor: "CodeRabbit", sourceUrl: CODERABBIT.url, supportingText: "Pro $24/user/month, billed annually", priceText: "$24/month" }),
        priceCandidate({ vendor: "CodeRabbit", sourceUrl: CODERABBIT.url, supportingText: "Pro $24/user/month, billed annually", priceText: "$24/user/month" }),
      ],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["basis_mismatch", "qualifier_dropped"]);
  });

  it("accepts $1.4 million against an explicit $1,400,000 for the same metric and year", () => {
    const page = { ...REPORT, text: "In 2024 the AI code review market generated $1,400,000 in revenue." };
    const result = run([page], {
      marketStats: [stat({ supportingText: "the AI code review market generated $1,400,000", amountText: "$1.4 million", year: 2024 })],
    });
    expect(result.rejected).toEqual([]);
    expect(must(result.accepted[0])).toMatchObject({
      kind: "market_stat",
      excerpt: "In 2024 the AI code review market generated $1,400,000 in revenue.",
      amount: { value: "1.4", magnitude: "million", unit: "currency", currency: "USD" },
      period: { kind: "measured", year: 2024 },
      attribution: "secondary",
    });
  });

  it("accepts an unchanged coherent first-party price with its plan qualifiers", () => {
    const result = run([CODERABBIT], {
      competitorPrices: [
        priceCandidate({
          vendor: "CodeRabbit",
          plan: "Pro",
          sourceUrl: CODERABBIT.url,
          supportingText: "Pro $24/user/month, billed annually",
          priceText: "$24/user/month, billed annually",
        }),
      ],
    });
    expect(result.rejected).toEqual([]);
    const item = must(result.accepted[0]);
    expect(item).toMatchObject({
      kind: "competitor_price",
      vendor: "CodeRabbit",
      plan: "Pro",
      attribution: "first_party",
      excerpt: "Pro\n$24/user/month, billed annually",
      price: { period: "month", basis: "per_user", qualifiers: ["billed_annually"] },
    });
  });

  it("rejects an ambiguous comparative sentence even when the model marks it verified", () => {
    const page = { url: "https://blog.example.com/cheap-rfp", text: "Loopio and Qvidian both cost $30/month for small teams." };
    const { candidates } = parseExtractionCandidates({
      competitorPrices: [{ vendor: "Loopio", sourceUrl: page.url, supportingText: page.text, priceText: "$30/month", verified: true }],
      quotes: [],
      marketStats: [],
    });
    const result = acceptEvidence({
      candidates,
      citations: [{ url: page.url }],
      sources: sourcesOf([page]),
      vendorHints: ["Qvidian"],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
  });

  it("rejects an unparseable unit even when the model marks it verified", () => {
    const page = { url: "https://acme.example.com/pricing", text: "Acme charges $0.012 per credit, about 18 reviews a month." };
    const { candidates } = parseExtractionCandidates({
      competitorPrices: [{ vendor: "Acme", sourceUrl: page.url, supportingText: page.text, priceText: "$0.012 per credit", verified: true }],
      quotes: [],
      marketStats: [],
    });
    const result = acceptEvidence({ candidates, citations: [{ url: page.url }], sources: sourcesOf([page]) });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["unparseable_amount"]);
  });
});

describe("source, citation and context rules", () => {
  const page = { ...REPORT, text: "The AI code review market was valued at $1.4 billion in 2025." };
  const candidate = stat({ supportingText: page.text, amountText: "$1.4 billion", year: 2025 });

  it("rejects candidates whose source is unreadable, oversized, timed out, empty or missing", () => {
    const cases: Array<[SourceStatus, string]> = [
      ["unreadable", "source_unreadable"],
      ["blocked", "source_unreadable"],
      ["http_error", "source_unreadable"],
      ["redirect_rejected", "source_unreadable"],
      ["unsupported_encoding", "source_unreadable"],
      ["oversized", "source_oversized"],
      ["timeout", "source_timeout"],
      ["no_content", "source_no_content"],
    ];
    for (const [status, reason] of cases) {
      const result = run([{ ...page, status }], { marketStats: [candidate] });
      expect(reasons(result), status).toEqual([reason]);
    }
    const missing = acceptEvidence({
      candidates: { quotes: [], marketStats: [candidate], competitorPrices: [] },
      citations: [{ url: page.url }],
      sources: new Map(),
    });
    expect(reasons(missing)).toEqual(["source_unreadable"]);
    const empty = acceptEvidence({
      candidates: { quotes: [], marketStats: [candidate], competitorPrices: [] },
      citations: [{ url: page.url }],
      sources: new Map([[page.url, { status: "read", text: "   ", retrievedAt: AT }]]),
    });
    expect(reasons(empty)).toEqual(["source_no_content"]);
    const tampered = acceptEvidence({
      candidates: { quotes: [], marketStats: [candidate], competitorPrices: [] },
      citations: [{ url: page.url }],
      sources: new Map([[page.url, { status: "read", text: page.text, retrievedAt: AT, textSha256: sha256Hex("other text") }]]),
    });
    expect(reasons(tampered)).toEqual(["source_unreadable"]);
  });

  it("rejects a URL that is not among the search citations as unknown_citation", () => {
    const result = run([page], { marketStats: [candidate] }, { citations: ["https://research.example.com/other-report"] });
    expect(reasons(result)).toEqual(["unknown_citation"]);
    const credentials = run([page], { marketStats: [{ ...candidate, sourceUrl: "https://user:pw@research.example.com/x" }] });
    expect(reasons(credentials)).toEqual(["unknown_citation"]);
  });

  it("matches citations canonically (tracking parameters, fragment, trailing slash)", () => {
    const result = run([page], { marketStats: [{ ...candidate, sourceUrl: `${page.url}/?utm_source=x#top` }] });
    expect(result.rejected).toEqual([]);
    expect(must(result.accepted[0]).sourceUrl).toBe(page.url);
  });

  it("rejects a projection sentence claimed as measured, and accepts it labeled projected", () => {
    const forecast = { ...REPORT, text: "The AI code review market is expected to reach $10.8 billion by 2034." };
    const measured = run([forecast], {
      marketStats: [stat({ supportingText: "expected to reach $10.8 billion by 2034", amountText: "$10.8 billion" })],
    });
    expect(reasons(measured)).toEqual(["projection_as_measured"]);
    const future = run([forecast], {
      marketStats: [stat({ supportingText: "reach $10.8 billion by 2034", amountText: "$10.8 billion", year: 2034 })],
    });
    expect(reasons(future)).toEqual(["projection_as_measured"]);
    const projected = run([forecast], {
      marketStats: [stat({ supportingText: "reach $10.8 billion by 2034", amountText: "$10.8 billion", year: 2034, periodKind: "projected" })],
    });
    expect(projected.rejected).toEqual([]);
    expect(must(projected.accepted[0])).toMatchObject({ period: { kind: "projected", toYear: 2034 } });
  });

  it("rejects a declared year that does not appear in the supporting sentence", () => {
    const noYear = { ...REPORT, text: "Last year was busy. The AI code review market was valued at $1.4 billion." };
    const result = run([noYear], {
      marketStats: [stat({ supportingText: "The AI code review market was valued at $1.4 billion.", amountText: "$1.4 billion", year: 2025 })],
    });
    expect(reasons(result)).toEqual(["year_not_in_context"]);
    const baseYear = { ...REPORT, text: "The AI code review market will grow 28.5% a year from 2025 to 2034." };
    const projectedBase = run([baseYear], {
      marketStats: [stat({ supportingText: baseYear.text, metric: "growth_rate", amountText: "28.5%", year: 2025, periodKind: "projected" })],
    });
    expect(reasons(projectedBase)).toEqual(["year_not_in_context"]);
  });

  it("requires the metric's unit and a specific subject word in the sentence", () => {
    const result = run([page], {
      marketStats: [
        stat({ supportingText: page.text, amountText: "$1.4 billion", metric: "growth_rate" }),
        stat({ supportingText: page.text, amountText: "$1.4 billion", subject: "Global market size" }),
        stat({ supportingText: page.text, amountText: "$1.4 billion", subject: "RFP software" }),
      ],
    });
    expect(reasons(result)).toEqual(["metric_unit_mismatch", "subject_not_in_context", "subject_not_in_context"]);
  });

  it("rejects a DeepRFP price taken from rfp.ai's own page", () => {
    const result = run(
      [RFPAI],
      { competitorPrices: [priceCandidate({ vendor: "DeepRFP", sourceUrl: RFPAI.url, supportingText: "Starter €49/month", priceText: "€49/month" })] },
      { vendorHints: ["RFP.ai", "AutoRFP.ai"] },
    );
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["vendor_not_in_context"]);
    const own = run(
      [RFPAI],
      { competitorPrices: [priceCandidate({ vendor: "RFP.ai", plan: "Starter", sourceUrl: RFPAI.url, supportingText: "Starter €49/month", priceText: "€49/month" })] },
      { vendorHints: ["DeepRFP"] },
    );
    expect(must(own.accepted[0])).toMatchObject({ vendor: "RFP.ai", plan: "Starter", attribution: "first_party" });
  });

  it("requires a first-party comparison page to name the vendor before the price", () => {
    const vs = { url: "https://loopio.com/blog/loopio-vs-qvidian", text: "Our verdict: Qvidian runs $30/month. Loopio costs $20,000/year." };
    const result = run([vs], {
      competitorPrices: [
        priceCandidate({ vendor: "Loopio", sourceUrl: vs.url, supportingText: "Qvidian runs $30/month", priceText: "$30/month" }),
        priceCandidate({ vendor: "Loopio", sourceUrl: vs.url, supportingText: "Loopio costs $20,000/year", priceText: "$20,000/year" }),
      ],
    });
    expect(reasons(result)).toEqual(["vendor_not_in_context"]);
    expect(must(result.accepted[0])).toMatchObject({ vendor: "Loopio", attribution: "first_party" });
  });

  it("drops a plan name the excerpt does not contain", () => {
    const result = run([CODERABBIT], {
      competitorPrices: [
        priceCandidate({
          vendor: "CodeRabbit",
          plan: "Enterprise Plus",
          sourceUrl: CODERABBIT.url,
          supportingText: "$24/user/month, billed annually",
          priceText: "$24/user/month, billed annually",
        }),
      ],
    });
    expect(must(result.accepted[0])).not.toHaveProperty("plan");
  });

  it("rejects a range or bound in the source rather than reading one end", () => {
    const ranged = { url: "https://acme.example.com/pricing", text: "Acme costs $20-$30/month. Acme Plus costs up to $90/month." };
    const result = run([ranged], {
      competitorPrices: [
        priceCandidate({ vendor: "Acme", sourceUrl: ranged.url, supportingText: "Acme costs $20-$30/month.", priceText: "$30/month" }),
        priceCandidate({ vendor: "Acme", sourceUrl: ranged.url, supportingText: "Acme Plus costs up to $90/month.", priceText: "$90/month" }),
      ],
    });
    expect(reasons(result)).toEqual(["unparseable_amount", "unparseable_amount"]);
  });
});

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

const HN = {
  url: "https://news.ycombinator.com/item?id=43219455",
  text:
    "These code review tools are basically analogous in function to a linter. They flag potential issues, but you still have to check all of them.\n" +
    "All these teams need is a sanity check. Short one. " +
    "They also generally do not have a strong code review process, even without the AI code reviewers.",
};

function quote(text: string, sourceUrl = HN.url): QuoteCandidate {
  return { sourceUrl, text };
}

describe("community quotes", () => {
  it("stores the contiguous span in the source's own characters", () => {
    const source = { url: "https://forum.example.com/t/queue/2001", text: "Our PR queue has basically exploded, and I’m watching\ttalented engineers   drown in review work." };
    const result = run([source], { quotes: [quote("\"and I'm watching talented engineers drown in review work\"", source.url)] });
    expect(result.rejected).toEqual([]);
    expect(must(result.accepted[0])).toMatchObject({
      kind: "community_quote",
      attribution: "community",
      excerpt: "and I’m watching\ttalented engineers   drown in review work.",
      excerptSha256: sha256Hex("and I’m watching\ttalented engineers   drown in review work."),
    });
  });

  it("rejects internal ellipses, fabricated text, and quotes outside 6–80 words", () => {
    const result = run([HN], {
      quotes: [
        quote("These code review tools ... check all of them"),
        quote("These code review tools are basically analogous in function to a linter that costs millions"),
        quote("Short one."),
        quote(`${"word ".repeat(81)}`),
      ],
    });
    expect(reasons(result)).toEqual(["internal_ellipsis", "span_not_found", "span_bounds", "span_not_found"]);
  });

  it("strips truncation ellipses before matching", () => {
    const result = run([HN], { quotes: [quote("…you still have to check all of them...")] });
    expect(must(result.accepted[0]).excerpt).toBe("you still have to check all of them.");
  });

  it("treats the same quote from the same page as a duplicate", () => {
    const result = run([HN], { quotes: [quote("All these teams need is a sanity check."), quote("all these teams need is a sanity check")] });
    expect(result.accepted).toHaveLength(1);
    expect(reasons(result)).toEqual(["duplicate"]);
  });
});

// ---------------------------------------------------------------------------
// Shapes, ordering, caps, ids
// ---------------------------------------------------------------------------

describe("parseExtractionCandidates", () => {
  it("keeps typed fields, ignores unknown keys, prose and verified flags", () => {
    const { candidates, rejected } = parseExtractionCandidates({
      summary: "The market is huge and growing fast.",
      quotes: [{ sourceUrl: HN.url, text: "  All these teams need is a sanity check.  ", verified: true, confidence: 0.99 }],
      marketStats: [
        {
          sourceUrl: REPORT.url,
          supportingText: "x",
          subject: "AI code review",
          metric: "market_size",
          amountText: "$1.4 billion",
          year: 2025,
          periodKind: "measured",
          verified: true,
        },
      ],
      competitorPrices: [{ vendor: "Loopio", sourceUrl: BLOG.url, supportingText: "y", plan: "", priceText: "$20,000/year" }],
    });
    expect(rejected).toEqual([]);
    expect(candidates).toEqual({
      quotes: [{ sourceUrl: HN.url, text: "All these teams need is a sanity check." }],
      marketStats: [
        {
          sourceUrl: REPORT.url,
          supportingText: "x",
          subject: "AI code review",
          metric: "market_size",
          amountText: "$1.4 billion",
          year: 2025,
          periodKind: "measured",
        },
      ],
      competitorPrices: [{ vendor: "Loopio", sourceUrl: BLOG.url, supportingText: "y", priceText: "$20,000/year" }],
    });
  });

  it("rejects malformed items with an operator detail and bounds every list", () => {
    const { candidates, rejected } = parseExtractionCandidates({
      quotes: [{ sourceUrl: HN.url }, "not an object", ...Array.from({ length: 45 }, (_, i) => ({ sourceUrl: HN.url, text: `quote ${i}` }))],
      marketStats: [{ sourceUrl: REPORT.url, supportingText: "x", subject: "s", metric: "vibes", amountText: "$1", periodKind: "measured" }],
      competitorPrices: "none",
    });
    expect(candidates.quotes).toHaveLength(38);
    expect(rejected.map((r) => [r.kind, r.reason, r.detail])).toEqual([
      ["community_quote", "invalid_candidate", "quotes[0]: text: expected a string"],
      ["community_quote", "invalid_candidate", "quotes[1]: expected an object"],
      ["community_quote", "invalid_candidate", "quotes: 7 candidates beyond the 40-item limit were ignored"],
      ["market_stat", "invalid_candidate", "marketStats[0]: metric: expected one of market_size, growth_rate, spend, user_count, adoption, other"],
      ["competitor_price", "invalid_candidate", "competitorPrices: expected an array"],
    ]);
    expect(parseExtractionCandidates("prose").rejected.map((r) => r.kind)).toEqual([
      "community_quote",
      "market_stat",
      "competitor_price",
    ]);
  });
});

describe("acceptEvidence ordering, caps and rejection records", () => {
  it("accepts in deterministic kind order and caps each kind", () => {
    const sentences = Array.from({ length: 9 }, (_, i) => `Reviewer number ${i + 1} says the queue keeps growing every week.`);
    const forum = { url: "https://forum.example.com/t/reviews", text: sentences.join(" ") };
    const page = { ...REPORT, text: "The AI code review market was valued at $1.4 billion in 2025." };
    const result = run([forum, page, BLOG], {
      competitorPrices: [priceCandidate({ vendor: "Loopio", priceText: "$20,000/year" })],
      marketStats: [stat({ supportingText: page.text, amountText: "$1.4 billion", year: 2025 })],
      quotes: sentences.map((s) => quote(s, forum.url)),
    });
    expect(result.accepted.map((e) => e.kind)).toEqual([
      ...Array<string>(8).fill("community_quote"),
      "market_stat",
      "competitor_price",
    ]);
    expect(reasons(result)).toEqual(["over_cap"]);
    const again = run([forum, page, BLOG], {
      competitorPrices: [priceCandidate({ vendor: "Loopio", priceText: "$20,000/year" })],
      marketStats: [stat({ supportingText: page.text, amountText: "$1.4 billion", year: 2025 })],
      quotes: sentences.map((s) => quote(s, forum.url)),
    });
    expect(again).toEqual(result);
  });

  it("records kind, reason, canonical sourceUrl, a bounded candidate and a short detail", () => {
    const long = `${"Loopio is great value ".repeat(9)}$30/month or $40/month`;
    const result = run([BLOG], {
      competitorPrices: [priceCandidate({ vendor: "Loopio", sourceUrl: `${BLOG.url}?utm_source=x`, priceText: long })],
    });
    const rejected = must(result.rejected[0]);
    expect(rejected.kind).toBe("competitor_price");
    expect(rejected.reason).toBe("unparseable_amount");
    expect(rejected.sourceUrl).toBe(BLOG.url);
    expect(must(rejected.candidate).length).toBeLessThanOrEqual(120);
    expect(must(rejected.detail).length).toBeLessThanOrEqual(200);
  });

  it("gives two claims that share an excerpt one id: the second is a duplicate", () => {
    const page = { url: "https://acme.example.com/pricing", text: "Acme Starter $19/month, Acme Pro $39/month." };
    const result = run([page], {
      competitorPrices: [
        priceCandidate({ vendor: "Acme", sourceUrl: page.url, supportingText: page.text, priceText: "$19/month" }),
        priceCandidate({ vendor: "Acme", sourceUrl: page.url, supportingText: page.text, priceText: "$39/month" }),
      ],
    });
    expect(result.accepted).toHaveLength(1);
    expect(reasons(result)).toEqual(["duplicate"]);
  });

  it("derives ids from kind, canonical URL and excerpt", () => {
    const id = evidenceId("community_quote", HN.url, "All these teams need is a sanity check.");
    expect(id).toMatch(/^q_[0-9a-f]{12}$/);
    expect(id).toBe(`q_${sha256Hex(`community_quote\n${HN.url}\nAll these teams need is a sanity check.`).slice(0, 12)}`);
    expect(evidenceId("market_stat", REPORT.url, "x").startsWith("s_")).toBe(true);
    expect(evidenceId("competitor_price", REPORT.url, "x").startsWith("p_")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Offline re-validation
// ---------------------------------------------------------------------------

describe("revalidateAcceptedEvidence", () => {
  const statPage = { ...REPORT, text: "In 2024 the AI code review market generated $1,400,000 in revenue." };
  const pages = [statPage, CODERABBIT, BLOG, HN];
  const accepted = run(
    pages,
    {
      quotes: [quote("All these teams need is a sanity check.")],
      marketStats: [stat({ supportingText: statPage.text, amountText: "$1.4 million", year: 2024 })],
      competitorPrices: [
        priceCandidate({
          vendor: "CodeRabbit",
          plan: "Pro",
          sourceUrl: CODERABBIT.url,
          supportingText: "Pro $24/user/month, billed annually",
          priceText: "$24/user/month, billed annually",
        }),
        priceCandidate({ vendor: "Loopio", priceText: "$20,000/year" }),
      ],
    },
    { vendorHints: ["Qvidian"] },
  ).accepted;
  const sources = acquisitions(pages);
  const [quoteItem, statItem, firstPartyPrice, secondaryPrice] = accepted;
  const tamper = (item: AcceptedEvidence | undefined, change: Record<string, unknown>) => ({ ...must(item), ...change });
  const recomputed = (item: AcceptedEvidence | undefined, excerpt: string) => {
    const base = must(item);
    return { ...base, excerpt, excerptSha256: sha256Hex(excerpt), id: evidenceId(base.kind, base.sourceUrl, excerpt) };
  };
  const failsWith = (value: unknown, fragment: string) => {
    const result = revalidateAcceptedEvidence(value, sources, { vendors: ["Qvidian", "Loopio", "CodeRabbit"] });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues.join(" | ")).toContain(fragment);
  };

  it("passes every valid accepted item and returns an equal fresh item", () => {
    expect(accepted).toHaveLength(4);
    for (const item of accepted) {
      const result = revalidateAcceptedEvidence(JSON.parse(JSON.stringify(item)), sources, { vendors: ["Qvidian"] });
      expect(result).toEqual({ ok: true, item });
    }
  });

  it("fails a tampered id", () => {
    failsWith(tamper(quoteItem, { id: "q_000000000000" }), "id:");
    failsWith(tamper(statItem, { id: must(firstPartyPrice).id }), "id:");
  });

  it("fails a tampered excerpt, with or without recomputed digests", () => {
    failsWith(tamper(statItem, { excerpt: "In 2024 the AI code review market generated $1,500,000 in revenue." }), "excerptSha256");
    failsWith(recomputed(statItem, "In 2024 the AI code review market generated $1,500,000 in revenue."), "amount_mismatch");
    failsWith(recomputed(firstPartyPrice, "Pro\n$24/user/month"), "qualifier_dropped");
    failsWith(recomputed(quoteItem, "Short."), "words");
  });

  it("fails a tampered amount", () => {
    failsWith(tamper(statItem, { amount: { value: "1.4", magnitude: "billion", unit: "currency", currency: "USD" } }), "amount_mismatch");
    failsWith(tamper(statItem, { amount: { value: "1.4", magnitude: "million", unit: "currency", currency: "EUR" } }), "amount_mismatch");
  });

  it("fails a tampered qualifier", () => {
    const item = must(firstPartyPrice);
    const price = item.kind === "competitor_price" ? item.price : null;
    failsWith(tamper(item, { price: { ...must(price), qualifiers: [] } }), "qualifier_dropped");
    failsWith(tamper(item, { price: { ...must(price), qualifiers: ["billed_annually", "starting_at"] } }), "qualifier_dropped");
  });

  it("fails a tampered basis", () => {
    const item = must(firstPartyPrice);
    const price = item.kind === "competitor_price" ? item.price : null;
    failsWith(tamper(item, { price: { ...must(price), basis: "flat" } }), "basis_mismatch");
  });

  it("fails a tampered attribution or vendor", () => {
    failsWith(tamper(secondaryPrice, { attribution: "first_party" }), "attribution");
    failsWith(tamper(firstPartyPrice, { attribution: "secondary" }), "attribution");
    failsWith(tamper(secondaryPrice, { vendor: "Qvidian" }), "ambiguous_attribution");
    const unhinted = revalidateAcceptedEvidence(tamper(secondaryPrice, { vendor: "Qvidian" }), sources);
    expect(unhinted.ok ? "" : unhinted.issues.join(" | ")).toContain("vendor_not_in_context");
    failsWith(tamper(quoteItem, { attribution: "secondary" }), "attribution");
    failsWith(tamper(firstPartyPrice, { plan: "Enterprise" }), "plan");
  });

  it("fails a tampered period", () => {
    failsWith(tamper(statItem, { period: { kind: "measured", year: 2023 } }), "year_not_in_context");
    failsWith(tamper(statItem, { period: { kind: "projected", year: 2024 } }), "period.year");
  });

  it("fails when its source is not listed as read with the same retrievedAt", () => {
    const item = must(statItem);
    const unread = sources.map((s) => (s.url === item.sourceUrl ? { url: s.url, roles: s.roles, status: "unreadable" as const } : s));
    const missing = sources.filter((s) => s.url !== item.sourceUrl);
    const later = sources.map((s) => (s.url === item.sourceUrl ? { ...s, retrievedAt: "2026-10-01T00:00:00.000Z" } : s));
    for (const [list, fragment] of [
      [unread, "not read"],
      [missing, "not listed"],
      [later, "retrievedAt differs"],
    ] as const) {
      const result = revalidateAcceptedEvidence(item, list);
      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.issues.join(" | ")).toContain(fragment);
    }
  });

  it("reports unknown fields such as a verified flag instead of keeping them", () => {
    failsWith(tamper(quoteItem, { verified: true }), "unexpected field verified");
    failsWith("not an object", "expected an object");
    failsWith(tamper(statItem, { kind: "opinion" }), "kind:");
  });
});

// ---------------------------------------------------------------------------
// Minimums
// ---------------------------------------------------------------------------

describe("checkEvidenceMinimums", () => {
  it("counts accepted stats, distinct priced vendors and distinct quotes", () => {
    const statPage = { ...REPORT, text: "The AI code review market was valued at $1.4 billion in 2025. The AI code review market will reach $10.8 billion by 2034." };
    const forum = { url: "https://forum.example.com/t/a", text: "All these teams need is a sanity check." };
    const result = run(
      [statPage, CODERABBIT, BLOG, HN, forum],
      {
        quotes: [quote("All these teams need is a sanity check."), quote("All these teams need is a sanity check.", forum.url)],
        marketStats: [
          stat({ supportingText: "valued at $1.4 billion in 2025", amountText: "$1.4 billion", year: 2025 }),
          stat({ supportingText: "will reach $10.8 billion by 2034", amountText: "$10.8 billion", year: 2034, periodKind: "projected" }),
        ],
        competitorPrices: [
          priceCandidate({ vendor: "Loopio", priceText: "$20,000/year" }),
          priceCandidate({ vendor: "Qvidian", priceText: "$30/month" }),
          priceCandidate({
            vendor: "CodeRabbit",
            sourceUrl: CODERABBIT.url,
            supportingText: "Pro $24/user/month, billed annually",
            priceText: "$24/user/month, billed annually",
          }),
        ],
      },
    );
    expect(result.rejected).toEqual([]);
    expect(checkEvidenceMinimums(result.accepted)).toEqual({
      ok: false,
      shortfalls: ["community quotes: 1 distinct accepted, need 2"],
    });
    const withQuote = run([HN], { quotes: [quote("They flag potential issues, but you still have to check all of them.")] });
    expect(checkEvidenceMinimums([...result.accepted, ...withQuote.accepted])).toEqual({ ok: true, shortfalls: [] });
    expect(checkEvidenceMinimums([]).shortfalls).toHaveLength(3);
  });
});
