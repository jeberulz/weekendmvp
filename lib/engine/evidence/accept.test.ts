import { describe, expect, it } from "vitest";

import {
  acceptEvidence,
  checkEvidenceMinimums,
  evidenceClaimKey,
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
    const deepRfp = priceCandidate({ vendor: "DeepRFP", sourceUrl: RFPAI.url, supportingText: "Starter €49/month", priceText: "€49/month" });
    // rfp.ai is RFP.ai's own site, so it is never evidence for a rival (ruling R5).
    const result = run([RFPAI], { competitorPrices: [deepRfp] }, { vendorHints: ["RFP.ai", "AutoRFP.ai"] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
    expect(result.rejected[0]?.detail).toMatch(/RFP\.ai's own site \(rfp\.ai\)/);
    // Without RFP.ai among the known vendors, the clause rule still refuses it.
    expect(reasons(run([RFPAI], { competitorPrices: [deepRfp] }))).toEqual(["vendor_not_in_context"]);
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

  it("keeps two plans priced in one clause as separate items (ruling R1) and still rejects a repeat", () => {
    const page = { url: "https://acme.example.com/pricing", text: "Acme Starter $19/month, Acme Pro $39/month." };
    const starter = priceCandidate({ vendor: "Acme", sourceUrl: page.url, supportingText: page.text, priceText: "$19/month" });
    const pro = priceCandidate({ vendor: "Acme", sourceUrl: page.url, supportingText: page.text, priceText: "$39/month" });
    const result = run([page], { competitorPrices: [starter, pro, { ...pro, supportingText: "Acme Pro $39/month" }] });
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted.map((e) => e.excerpt)).toEqual([page.text, page.text]);
    expect(new Set(result.accepted.map((e) => e.id)).size).toBe(2);
    expect(reasons(result)).toEqual(["duplicate"]);
  });

  it("derives ids from kind, canonical URL, excerpt and the claim key (ruling R1)", () => {
    const id = evidenceId("community_quote", HN.url, "All these teams need is a sanity check.", "");
    expect(id).toMatch(/^q_[0-9a-f]{12}$/);
    expect(id).toBe(`q_${sha256Hex(`community_quote\n${HN.url}\nAll these teams need is a sanity check.\n`).slice(0, 12)}`);
    expect(evidenceId("market_stat", REPORT.url, "x", "k").startsWith("s_")).toBe(true);
    expect(evidenceId("competitor_price", REPORT.url, "x", "k").startsWith("p_")).toBe(true);
    expect(evidenceId("market_stat", REPORT.url, "x", "a")).not.toBe(evidenceId("market_stat", REPORT.url, "x", "b"));
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
    return {
      ...base,
      excerpt,
      excerptSha256: sha256Hex(excerpt),
      id: evidenceId(base.kind, base.sourceUrl, excerpt, evidenceClaimKey(base)),
    };
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
// Rulings R1 and R2 (contract §12)
// ---------------------------------------------------------------------------

const FORECAST = {
  url: "https://research.example.com/ai-code-review-forecast",
  text:
    "The global AI code review market was valued at USD 1.2 billion in 2024 and is projected to reach " +
    "USD 5.4 billion by 2032, growing at a CAGR of 20.4%.",
};

const baseStat = stat({ sourceUrl: FORECAST.url, supportingText: FORECAST.text, amountText: "USD 1.2 billion", year: 2024 });
const targetStat = stat({
  sourceUrl: FORECAST.url,
  supportingText: "projected to reach USD 5.4 billion by 2032",
  amountText: "USD 5.4 billion",
  year: 2032,
  periodKind: "projected",
});
const cagrStat = stat({
  sourceUrl: FORECAST.url,
  supportingText: "growing at a CAGR of 20.4%",
  metric: "growth_rate",
  amountText: "20.4%",
  year: 2032,
  periodKind: "projected",
});

describe("R1: evidence ids include the typed claim", () => {
  it("builds the claim key from the typed claim, excluding subject text", () => {
    expect(evidenceClaimKey({ kind: "community_quote" })).toBe("");
    expect(
      evidenceClaimKey({
        kind: "market_stat",
        metric: "market_size",
        amount: { value: "1.2", magnitude: "billion", unit: "currency", currency: "USD" },
        period: { kind: "measured", year: 2024 },
      }),
    ).toBe("market_size|currency|USD|1.2|billion|measured|2024|");
    expect(
      evidenceClaimKey({
        kind: "market_stat",
        metric: "growth_rate",
        amount: { value: "20.4", magnitude: "none", unit: "percent" },
        period: { kind: "projected", toYear: 2032 },
      }),
    ).toBe("growth_rate|percent||20.4|none|projected||2032");
    expect(
      evidenceClaimKey({
        kind: "competitor_price",
        vendor: "CodeRabbit",
        plan: "Pro",
        price: {
          amount: { value: "24", magnitude: "none", unit: "currency", currency: "USD" },
          period: "month",
          basis: "per_user",
          qualifiers: ["starting_at", "billed_annually"],
        },
      }),
    ).toBe("coderabbit|Pro|currency|USD|24|none|month|per_user|billed_annually,starting_at");
    expect(
      evidenceClaimKey({
        kind: "competitor_price",
        vendor: "RFP.ai",
        price: { amount: { value: "49", magnitude: "none", unit: "currency", currency: "EUR" }, period: "month", basis: "flat", qualifiers: [] },
      }),
    ).toBe("rfp||currency|EUR|49|none|month|flat|");
  });

  it("accepts three distinct stats from one sentence (base, target and CAGR)", () => {
    const result = run([FORECAST], { marketStats: [baseStat, targetStat, cagrStat] });
    expect(result.rejected).toEqual([]);
    expect(result.accepted.map((e) => (e.kind === "market_stat" ? [formatStat(e), e.period] : []))).toEqual([
      ["USD 1.2 billion", { kind: "measured", year: 2024 }],
      ["USD 5.4 billion", { kind: "projected", toYear: 2032 }],
      ["20.4%", { kind: "projected", toYear: 2032 }],
    ]);
    expect(new Set(result.accepted.map((e) => e.id)).size).toBe(3);
    expect(new Set(result.accepted.map((e) => e.excerpt))).toEqual(new Set([FORECAST.text]));
  });

  it("still rejects the same claim twice as a duplicate, including an equal amount written differently", () => {
    const sameTwice = run([FORECAST], { marketStats: [baseStat, { ...baseStat, supportingText: "USD 1.2 billion in 2024" }] });
    expect(sameTwice.accepted).toHaveLength(1);
    expect(reasons(sameTwice)).toEqual(["duplicate"]);
    const rewritten = run([FORECAST], { marketStats: [baseStat, { ...baseStat, amountText: "$1,200,000,000" }] });
    expect(rewritten.accepted).toHaveLength(1);
    expect(reasons(rewritten)).toEqual(["duplicate"]);
  });

  it("revalidation recomputes the id with the claim key", () => {
    const accepted = run([FORECAST], { marketStats: [baseStat, targetStat, cagrStat] }).accepted;
    const sources = acquisitions([FORECAST]);
    for (const item of accepted) expect(revalidateAcceptedEvidence(item, sources)).toEqual({ ok: true, item });
    const target = must(accepted[1]);
    const tampered = revalidateAcceptedEvidence(
      { ...target, amount: { value: "5.4", magnitude: "million", unit: "currency", currency: "USD" } },
      sources,
    );
    const issues = tampered.ok ? "" : tampered.issues.join(" | ");
    expect(issues).toContain("id:");
    expect(issues).toContain("amount_mismatch");
    const reSubjected = revalidateAcceptedEvidence({ ...must(accepted[0]), subject: "RFP software" }, sources);
    const subjectIssues = reSubjected.ok ? "" : reSubjected.issues.join(" | ");
    expect(subjectIssues).not.toContain("id:");
    expect(subjectIssues).toContain("subject_not_in_context");
  });
});

describe("R2: projection cues scope forward", () => {
  it("keeps the base figure measured and rejects measured labels after a cue", () => {
    const result = run([FORECAST], {
      marketStats: [
        { ...targetStat, periodKind: "measured", year: undefined },
        { ...cagrStat, periodKind: "measured", year: undefined },
        { ...baseStat, periodKind: "measured" },
      ],
    });
    expect(reasons(result)).toEqual(["projection_as_measured", "projection_as_measured"]);
    expect(must(result.accepted[0])).toMatchObject({ kind: "market_stat", period: { kind: "measured", year: 2024 } });
  });

  it('marks both figures of "expected to grow from X in 2025 to Y by 2034" projected', () => {
    const page = {
      url: "https://research.example.com/ai-code-review-growth",
      text: "The AI code review market is expected to grow from USD 1.4 billion in 2025 to USD 10.8 billion by 2034.",
    };
    const from = stat({ sourceUrl: page.url, supportingText: page.text, amountText: "USD 1.4 billion", year: 2025 });
    const to = stat({ sourceUrl: page.url, supportingText: page.text, amountText: "USD 10.8 billion", year: 2034 });
    const measured = run([page], { marketStats: [from, { ...to, year: undefined }] });
    expect(reasons(measured)).toEqual(["projection_as_measured", "projection_as_measured"]);
    const projected = run([page], { marketStats: [{ ...from, periodKind: "projected" }, { ...to, periodKind: "projected" }] });
    expect(projected.rejected).toEqual([]);
    expect(projected.accepted.map((e) => (e.kind === "market_stat" ? e.period : null))).toEqual([
      { kind: "projected", toYear: 2025 },
      { kind: "projected", toYear: 2034 },
    ]);
  });

  it("rejects a projected label on a figure with no cue before it and no later year after it", () => {
    const page = { url: "https://research.example.com/ai-code-review-2024", text: "The AI code review market was valued at USD 1.2 billion in 2024." };
    const result = run([page], {
      marketStats: [stat({ sourceUrl: page.url, supportingText: page.text, amountText: "USD 1.2 billion", year: 2024, periodKind: "projected" })],
    });
    expect(reasons(result)).toEqual(["period_mismatch"]);
  });

  it("binds a declared year to the figure's own attached year", () => {
    const result = run([FORECAST], { marketStats: [{ ...targetStat, year: 2024 }] });
    expect(reasons(result)).toEqual(["year_not_in_context"]);
  });

  it("does not lend one figure's year to another figure in the sentence", () => {
    const page = {
      url: "https://research.example.com/ai-code-review-cagr",
      text:
        "The AI code review market size was estimated at USD 1.4 billion in 2025 and is expected to grow " +
        "at a CAGR of 28.5% from 2025 to 2034.",
    };
    const cagr = stat({ sourceUrl: page.url, supportingText: page.text, metric: "growth_rate", amountText: "28.5%", periodKind: "projected" });
    const result = run([page], {
      marketStats: [
        { ...cagr, year: 2025 },
        { ...cagr, year: 2034 },
        stat({ sourceUrl: page.url, supportingText: page.text, amountText: "USD 1.4 billion", year: 2025 }),
      ],
    });
    expect(reasons(result)).toEqual(["year_not_in_context"]);
    expect(result.accepted.map((e) => (e.kind === "market_stat" ? e.period : null))).toEqual([
      { kind: "projected", toYear: 2034 },
      { kind: "measured", year: 2025 },
    ]);
  });

  it("applies the same rule in revalidation", () => {
    const accepted = run([FORECAST], { marketStats: [baseStat] }).accepted;
    const base = must(accepted[0]);
    const relabeled = { ...base, period: { kind: "projected" as const, toYear: 2024 } };
    const withId = { ...relabeled, id: evidenceId(base.kind, base.sourceUrl, base.excerpt, evidenceClaimKey(relabeled)) };
    const result = revalidateAcceptedEvidence(withId, acquisitions([FORECAST]));
    expect(result.ok ? "" : result.issues.join(" | ")).toContain("period_mismatch");
  });
});

// ---------------------------------------------------------------------------
// Ruling R5: a vendor's own site is not evidence for a rival's price
// ---------------------------------------------------------------------------

const LOOPIO_OWN = {
  url: "https://loopio.example/pricing",
  text: "Loopio pricing\nFoundations\n$20,000/year\nTen seats included.\nSwitching from Responsive? Responsive costs $99/mo.",
};
const NEUTRAL_REVIEW = {
  url: "https://reviews.example.com/rfp-tools",
  text: "We compared the leaders. Loopio costs $20,000/year for ten seats. Responsive costs $99/mo for its Team plan.",
};
const loopioOwnPrice = priceCandidate({
  vendor: "Loopio",
  plan: "Foundations",
  sourceUrl: LOOPIO_OWN.url,
  supportingText: "Foundations\n$20,000/year",
  priceText: "$20,000/year",
});
const responsiveOnLoopio = priceCandidate({
  vendor: "Responsive",
  sourceUrl: LOOPIO_OWN.url,
  supportingText: "Responsive costs $99/mo.",
  priceText: "$99/mo",
});

describe("R5: a vendor's own site is not evidence for a rival's price", () => {
  it('yields no Responsive price from Loopio\'s own pricing page claiming "Responsive costs $99/mo"', () => {
    const result = run([LOOPIO_OWN], { competitorPrices: [loopioOwnPrice, responsiveOnLoopio] });
    expect(result.accepted.map((e) => (e.kind === "competitor_price" ? [e.vendor, e.attribution] : null))).toEqual([
      ["Loopio", "first_party"],
    ]);
    expect(result.rejected).toEqual([
      {
        kind: "competitor_price",
        reason: "ambiguous_attribution",
        sourceUrl: LOOPIO_OWN.url,
        candidate: "Responsive: $99/mo",
        detail: "the source is Loopio's own site (loopio.example); a vendor's own site is not evidence for Responsive's price (ruling R5)",
      },
    ]);
    // Loopio named only as a known vendor (hint) is enough: the page is still its own site.
    expect(reasons(run([LOOPIO_OWN], { competitorPrices: [responsiveOnLoopio] }, { vendorHints: ["Loopio"] }))).toEqual([
      "ambiguous_attribution",
    ]);
    // A comparison page on the vendor's own host is its own site too.
    const versus = { url: "https://loopio.example/compare/loopio-vs-responsive", text: "Responsive costs $99/mo. Loopio costs $20,000/year." };
    const onVersus = priceCandidate({ vendor: "Responsive", sourceUrl: versus.url, supportingText: "Responsive costs $99/mo.", priceText: "$99/mo" });
    expect(reasons(run([versus], { competitorPrices: [onVersus] }, { vendorHints: ["Loopio"] }))).toEqual(["ambiguous_attribution"]);
  });

  it("reports R5 even when the claimed terms would not match either", () => {
    const wrongPeriod = { ...responsiveOnLoopio, priceText: "$99/year" };
    expect(reasons(run([LOOPIO_OWN], { competitorPrices: [loopioOwnPrice, wrongPeriod] }))).toEqual(["ambiguous_attribution"]);
  });

  it("still binds each vendor in its own clause on a neutral review page", () => {
    const result = run([NEUTRAL_REVIEW], {
      competitorPrices: [
        priceCandidate({ vendor: "Loopio", sourceUrl: NEUTRAL_REVIEW.url, supportingText: "Loopio costs $20,000/year for ten seats.", priceText: "$20,000/year" }),
        priceCandidate({
          vendor: "Responsive",
          plan: "Team",
          sourceUrl: NEUTRAL_REVIEW.url,
          supportingText: "Responsive costs $99/mo for its Team plan.",
          priceText: "$99/mo",
        }),
      ],
    });
    expect(result.rejected).toEqual([]);
    expect(result.accepted.map((e) => (e.kind === "competitor_price" ? [e.vendor, e.attribution, e.plan ?? null] : null))).toEqual([
      ["Loopio", "secondary", null],
      ["Responsive", "secondary", "Team"],
    ]);
  });

  it("keeps the clause rules on a host that is no known vendor's own site", () => {
    // Without Loopio among the candidates or hints, loopio.example is just a page that names Responsive.
    const result = run([LOOPIO_OWN], { competitorPrices: [responsiveOnLoopio] });
    expect(result.rejected).toEqual([]);
    expect(must(result.accepted[0])).toMatchObject({ vendor: "Responsive", attribution: "secondary" });
  });

  it("revalidation refuses a stored item that violates it, with the same vendor set rule", () => {
    // Accepted while Loopio was not a known vendor, then stored in a record whose vendors include Loopio.
    const stored = must(run([LOOPIO_OWN], { competitorPrices: [responsiveOnLoopio] }).accepted[0]);
    const sources = acquisitions([LOOPIO_OWN]);
    const refused = revalidateAcceptedEvidence(JSON.parse(JSON.stringify(stored)), sources, { vendors: ["Loopio", "Responsive"] });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.issues.join(" | ")).toContain(
      "claim: ambiguous_attribution (the source is Loopio's own site (loopio.example); a vendor's own site is not evidence for Responsive's price (ruling R5))",
    );
    // The same vendor set as at acceptance gives the same answer.
    expect(revalidateAcceptedEvidence(JSON.parse(JSON.stringify(stored)), sources, { vendors: ["Responsive"] })).toEqual({
      ok: true,
      item: stored,
    });
  });
});

function formatStat(e: AcceptedEvidence): string {
  if (e.kind !== "market_stat") return "";
  const sentence = e.excerpt;
  const value = e.amount.unit === "percent" ? `${e.amount.value}%` : `USD ${e.amount.value} ${e.amount.magnitude}`;
  return sentence.includes(value) ? value : `missing ${value}`;
}

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
