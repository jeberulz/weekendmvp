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
  SourceRole,
  SourceStatus,
} from "./contract.ts";

const AT = "2026-09-30T12:00:00.000Z";

/** A page; `roles` are the searches that cited it (every role unless a test says otherwise). */
type Page = { url: string; text: string; status?: SourceStatus; roles?: SourceRole[] };

const ALL_ROLES: SourceRole[] = ["market", "competitors", "community"];

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}

function sourcesOf(pages: Page[]): Map<string, SourceInput> {
  return new Map(
    pages.map((p): [string, SourceInput] => [
      p.url,
      p.status && p.status !== "read"
        ? { status: p.status, roles: p.roles ?? ALL_ROLES }
        : { status: "read", text: p.text, retrievedAt: AT, roles: p.roles ?? ALL_ROLES },
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
    roles: p.roles ?? ALL_ROLES,
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

describe("original research published on a blog", () => {
  const page: Page = {
    url: "https://publisher.example/blog/security-questionnaire-survey",
    text: "Our survey found 61% of security teams use security questionnaires.",
    roles: ["market"],
  };
  const candidate = stat({
    sourceUrl: page.url,
    supportingText: page.text,
    subject: "security teams",
    metric: "adoption",
    amountText: "61%",
  });

  it("accepts a bound first-party survey statement and revalidates the stored claim", () => {
    const result = run([page], { marketStats: [candidate] });
    expect(result.rejected).toEqual([]);
    const item = must(result.accepted[0]);
    expect(item.kind).toBe("market_stat");
    expect(revalidateAcceptedEvidence(item, acquisitions([page])).ok).toBe(true);
  });

  it("still refuses a blog statistic without provenance in its own sentence", () => {
    const text = "61% of security teams use security questionnaires.";
    const result = run([{ ...page, text: `Our survey studied security teams. ${text}` }], {
      marketStats: [{ ...candidate, supportingText: text }],
    });
    expect(reasons(result)).toEqual(["unsupported_assertion"]);
  });

  it("revalidation cannot borrow research provenance from another sentence", () => {
    const item = must(run([page], { marketStats: [candidate] }).accepted[0]);
    if (item.kind !== "market_stat") throw new Error("expected a market statistic");
    const excerpt = "Our survey studied security teams. 64% of security teams use security questionnaires.";
    const changed = {
      ...item,
      amount: { ...item.amount, value: "64" },
      excerpt,
      excerptSha256: sha256Hex(excerpt),
    };
    const forged = { ...changed, id: evidenceId(changed.kind, changed.sourceUrl, excerpt, evidenceClaimKey(changed)) };
    const result = revalidateAcceptedEvidence(forged, acquisitions([{ ...page, text: excerpt }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(" ")).toContain("not the original research source");
  });
});

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

  it("rejects a first-party comparison page even when it names the vendor before the price", () => {
    const vs = { url: "https://loopio.com/blog/loopio-vs-qvidian", text: "Our verdict: Qvidian runs $30/month. Loopio costs $20,000/year." };
    const result = run([vs], {
      competitorPrices: [
        priceCandidate({ vendor: "Loopio", sourceUrl: vs.url, supportingText: "Qvidian runs $30/month", priceText: "$30/month" }),
        priceCandidate({ vendor: "Loopio", sourceUrl: vs.url, supportingText: "Loopio costs $20,000/year", priceText: "$20,000/year" }),
      ],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution", "ambiguous_attribution"]);
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
  // Ruling R8 made quotes whole sentences: the candidate below used to start
  // mid-sentence ("and I'm watching …"); it now quotes the whole sentence and
  // still checks that the excerpt keeps the source's own characters.
  it("stores the contiguous span in the source's own characters", () => {
    const source = { url: "https://forum.example.com/t/queue/2001", text: "Our PR queue has basically exploded, and I’m watching\ttalented engineers   drown in review work." };
    const result = run([source], {
      quotes: [quote("\"Our PR queue has basically exploded, and I'm watching talented engineers drown in review work\"", source.url)],
    });
    expect(result.rejected).toEqual([]);
    expect(must(result.accepted[0])).toMatchObject({
      kind: "community_quote",
      attribution: "community",
      excerpt: "Our PR queue has basically exploded, and I’m watching\ttalented engineers   drown in review work.",
      excerptSha256: sha256Hex("Our PR queue has basically exploded, and I’m watching\ttalented engineers   drown in review work."),
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

  // Ruling R8: the old candidate ("…you still have to check all of them...")
  // starts mid-sentence and is now refused (see the R8 block below); the
  // truncation marks around a whole sentence are still stripped.
  it("strips truncation ellipses before matching", () => {
    const result = run([HN], { quotes: [quote("…They flag potential issues, but you still have to check all of them...")] });
    expect(must(result.accepted[0]).excerpt).toBe("They flag potential issues, but you still have to check all of them.");
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
      competitorAvailability: [],
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
      "competitor_availability",
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
    expect(checkEvidenceMinimums([]).shortfalls).toHaveLength(4);
  });
});

describe("first-party pricing availability", () => {
  it("accepts explicit pricing statuses without turning them into numeric prices", () => {
    const pages = [
      { url: "https://loopio.com/pricing", text: "Loopio pricing is available by custom quote." },
      { url: "https://responsive.io/pricing", text: "Contact sales for Responsive pricing." },
      { url: "https://www.coderabbit.ai/pricing", text: "Pro costs $24/user/month." },
    ];
    const result = run(pages, {
      competitorAvailability: [
        { vendor: "Loopio", sourceUrl: pages[0]!.url, supportingText: pages[0]!.text, availability: "contact_sales" },
        { vendor: "Responsive", sourceUrl: pages[1]!.url, supportingText: pages[1]!.text, availability: "contact_sales" },
      ],
      competitorPrices: [{ vendor: "CodeRabbit", sourceUrl: pages[2]!.url, supportingText: pages[2]!.text, priceText: "$24/user/month" }],
    });
    expect(result.rejected).toEqual([]);
    expect(result.accepted.map((item) => item.kind)).toEqual(["competitor_price", "competitor_availability", "competitor_availability"]);
    expect(checkEvidenceMinimums(result.accepted).shortfalls).toEqual(["market stats: 0 accepted, need 2", "community quotes: 0 distinct accepted, need 2"]);
    for (const item of result.accepted) {
      const parsed = revalidateAcceptedEvidence(item, acquisitions(pages), { vendors: ["CodeRabbit", "Loopio", "Responsive"] });
      expect(parsed.ok).toBe(true);
    }
  });

  it("rejects a mismatched status, a rival site, and a generic sales button", () => {
    const own = { url: "https://loopio.com/pricing", text: "Loopio pricing is available by custom quote." };
    const generic = { url: "https://responsive.io/about", text: "Contact sales to arrange a demo." };
    const result = run([own, generic], {
      competitorAvailability: [
        { vendor: "Loopio", sourceUrl: own.url, supportingText: own.text, availability: "usage_based" },
        { vendor: "Responsive", sourceUrl: own.url, supportingText: own.text, availability: "contact_sales" },
        { vendor: "Responsive", sourceUrl: generic.url, supportingText: generic.text, availability: "contact_sales" },
      ],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["unsupported_assertion", "ambiguous_attribution", "unsupported_assertion"]);
  });
});

// ---------------------------------------------------------------------------
// Ruling R8: quotes are whole statements from community sources
// ---------------------------------------------------------------------------

describe("R8: community quotes are whole sentences from community sources", () => {
  // Blocks separated by blank lines: since ruling R14 a heading without terminal punctuation runs into the next line.
  const PRICING_PAGE: Page = {
    url: "https://www.coderabbit.ai/pricing",
    roles: ["competitors"],
    text: "Pricing\n\nCustomer story\n\nWe cut our review time in half after switching to CodeRabbit last spring.\n\nPro\n$24/user/month, billed annually",
  };
  const TESTIMONIAL = "We cut our review time in half after switching to CodeRabbit last spring.";

  it("refuses a testimonial on a vendor pricing page the community search never cited (review probe p1 #9)", () => {
    const result = run([PRICING_PAGE], { quotes: [quote(TESTIMONIAL, PRICING_PAGE.url)] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["unknown_citation"]);
    expect(result.rejected[0]?.detail).toMatch(/community search/);
    // A source input that names no roles is not a community source either.
    const unlabelled = acceptEvidence({
      candidates: { quotes: [quote(TESTIMONIAL, PRICING_PAGE.url)], marketStats: [], competitorPrices: [] },
      citations: [{ url: PRICING_PAGE.url }],
      sources: new Map([[PRICING_PAGE.url, { status: "read", text: PRICING_PAGE.text, retrievedAt: AT }]]),
    });
    expect(reasons(unlabelled)).toEqual(["unknown_citation"]);
    // The same sentence on a page the community search cited is a quote.
    const cited = run([{ ...PRICING_PAGE, roles: ["competitors", "community"] }], { quotes: [quote(TESTIMONIAL, PRICING_PAGE.url)] });
    expect(cited.rejected).toEqual([]);
  });

  it("refuses a span that drops the start of its sentence, with or without a leading ellipsis (review probe p3)", () => {
    // The topic line ends in a blank line: since ruling R14 a line break without terminal punctuation starts no sentence.
    const page: Page = {
      url: "https://forum.example.net/t/questionnaires/1",
      roles: ["community"],
      text: "Topic: questionnaires\n\nHonestly, I would never say that security questionnaires are the bottleneck for our team.\nWe answer them in an afternoon.",
    };
    const result = run([page], {
      quotes: [
        quote("security questionnaires are the bottleneck for our team.", page.url),
        quote("...security questionnaires are the bottleneck for our team.", page.url),
      ],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["span_bounds", "span_bounds"]);
    expect(result.rejected[0]?.detail).toMatch(/sentence start/);
    const whole = run([page], {
      quotes: [quote("Honestly, I would never say that security questionnaires are the bottleneck for our team.", page.url)],
    });
    expect(whole.rejected).toEqual([]);
  });

  it("refuses a span that stops before its sentence ends", () => {
    const page: Page = {
      url: "https://forum.example.net/t/questionnaires/2",
      roles: ["community"],
      text: "We answer every questionnaire by hand and it has never cost us a single deal.",
    };
    const result = run([page], { quotes: [quote("We answer every questionnaire by hand and it has", page.url)] });
    expect(reasons(result)).toEqual(["span_bounds"]);
    expect(result.rejected[0]?.detail).toMatch(/sentence end/);
  });

  it("refuses a span across a line break: two commenters merged into one quote (review probes p1 #10 and p2)", () => {
    const thread: Page = {
      url: "https://news.ycombinator.com/item?id=4101",
      roles: ["community"],
      text: "alice 3 hours ago\nI review pull requests all weekend\nbob 2 hours ago\nand our startup will die because of it",
    };
    const merged = run([thread], {
      quotes: [quote("I review pull requests all weekend bob 2 hours ago and our startup will die because of it", thread.url)],
    });
    expect(reasons(merged)).toEqual(["span_bounds"]);
    expect(merged.rejected[0]?.detail).toMatch(/line break/);
    // sourceText's HN text: one line (or block) per comment.
    const hn: Page = {
      url: "https://news.ycombinator.com/item?id=4102",
      roles: ["community"],
      text: "Ask HN: How do small teams handle security questionnaires?\n We answer every questionnaire by hand.\n\n Honestly it has never cost us a single deal, so we ignore it.\n",
    };
    const joined = run([hn], { quotes: [quote("We answer every questionnaire by hand. Honestly it has never cost us a single deal", hn.url)] });
    expect(reasons(joined)).toEqual(["span_bounds"]);
    const own = run([hn], { quotes: [quote("Honestly it has never cost us a single deal, so we ignore it.", hn.url)] });
    expect(own.rejected).toEqual([]);
    expect(must(own.accepted[0]).excerpt).toBe("Honestly it has never cost us a single deal, so we ignore it.");
  });

  it("accepts whole sentences behind opening quote marks or a bullet, and before closing marks", () => {
    const page: Page = {
      url: "https://forum.example.net/t/questionnaires/3",
      roles: ["community"],
      text: "- “We retype the same approved answers into every buyer portal.” Then we wait.\n* (Nobody can tell which answer legal signed off on.)",
    };
    const result = run([page], {
      quotes: [
        quote("We retype the same approved answers into every buyer portal.", page.url),
        quote("Nobody can tell which answer legal signed off on.", page.url),
      ],
    });
    expect(result.rejected).toEqual([]);
    expect(result.accepted.map((e) => e.excerpt)).toEqual([
      "We retype the same approved answers into every buyer portal.",
      "Nobody can tell which answer legal signed off on.",
    ]);
  });

  it("applies the line-break and community-source rules in revalidation", () => {
    const page: Page = { url: "https://forum.example.net/t/questionnaires/4", roles: ["community"], text: "We answer every questionnaire by hand, every single quarter." };
    const item = must(run([page], { quotes: [quote(page.text, page.url)] }).accepted[0]);
    expect(revalidateAcceptedEvidence(item, acquisitions([page]))).toEqual({ ok: true, item });
    const notCommunity = revalidateAcceptedEvidence(item, acquisitions([{ ...page, roles: ["competitors"] }]));
    expect(notCommunity.ok ? "" : notCommunity.issues.join(" | ")).toContain("not cited by the community search");
    const excerpt = "We answer every questionnaire by hand,\nevery single quarter.";
    const broken = {
      ...item,
      excerpt,
      excerptSha256: sha256Hex(excerpt),
      id: evidenceId(item.kind, item.sourceUrl, excerpt, evidenceClaimKey(item)),
    };
    const crossed = revalidateAcceptedEvidence(broken, acquisitions([page]));
    expect(crossed.ok ? "" : crossed.issues.join(" | ")).toContain("line break");
  });
});

describe("R8: distinct quotes are quotes neither of which contains the other", () => {
  it("counts a quote and a longer quote that contains it once", () => {
    const short: Page = { url: "https://forum.example.net/t/a", roles: ["community"], text: "We burn weekends answering security questionnaires." };
    const long: Page = {
      url: "https://forum.example.net/t/b",
      roles: ["community"],
      text: "Honestly, we burn weekends answering security questionnaires for every deal.",
    };
    const contained: Page = {
      url: "https://forum.example.net/t/c",
      roles: ["community"],
      text: "Every week we burn weekends answering security questionnaires.",
    };
    const quotes = run([short, long, contained], {
      quotes: [quote(short.text, short.url), quote(long.text, long.url), quote(contained.text, contained.url)],
    }).accepted;
    expect(quotes).toHaveLength(3);
    // "we burn weekends answering security questionnaires" sits inside the other two.
    const [first, second, third] = quotes;
    expect(checkEvidenceMinimums([must(first), must(third)]).shortfalls).toContain("community quotes: 1 distinct accepted, need 2");
    expect(checkEvidenceMinimums([must(second), must(third)]).shortfalls).not.toContain("community quotes: 1 distinct accepted, need 2");
  });
});

// ---------------------------------------------------------------------------
// Ruling R9: binding is per claim
// ---------------------------------------------------------------------------

describe("R9: a price clause that compares vendors binds no price", () => {
  const blog = (text: string): Page => ({ url: "https://blog.example.com/rfp-tools", roles: ["competitors"], text });

  it.each([
    ["unlike", "review probe p1 #1", "Unlike Loopio, Qvidian costs $30/month for small teams."],
    ["than", "review probe p1 #2", "Loopio is cheaper than the $30/month alternatives most teams try first."],
    ["instead", "review probe p1 #3", "Teams that outgrow Loopio usually pay $30/month for Qvidian instead."],
    ["alternative", "an alternatives line", "Loopio at $30/month is the alternative most small teams pick."],
    ["switched from", "a switch", "Many teams switched from Loopio and now pay $30/month."],
    ["versus", "a versus clause", "Loopio costs $30/month versus the suites most teams outgrow."],
  ])("rejects Loopio's price from a clause that says %s (%s)", (cue, _label, text) => {
    const page = blog(text);
    const result = run([page], { competitorPrices: [priceCandidate({ vendor: "Loopio", sourceUrl: page.url, supportingText: text, priceText: "$30/month" })] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
    expect(result.rejected[0]?.detail).toContain(`compares vendors ("${cue}")`);
  });

  it("rejects a rival's price on a vendor's own page when a comparison cue binds it (review probe p9)", () => {
    const page: Page = {
      url: "https://loopio.com/pricing",
      roles: ["competitors"],
      text: "Loopio pricing\nUnlike Responsive at $30/user/month, Loopio Essentials keeps every seat on one plan.\nEssentials\nContact sales",
    };
    const result = run([page], {
      competitorPrices: [
        priceCandidate({
          vendor: "Loopio",
          sourceUrl: page.url,
          supportingText: "Unlike Responsive at $30/user/month, Loopio Essentials keeps every seat on one plan.",
          priceText: "$30/user/month",
        }),
      ],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
  });

  it("still accepts a plain price clause, and applies the cue rule in revalidation", () => {
    const page = blog("Loopio costs $30/month for small teams.");
    const accepted = must(
      run([page], { competitorPrices: [priceCandidate({ vendor: "Loopio", sourceUrl: page.url, supportingText: page.text, priceText: "$30/month" })] })
        .accepted[0],
    );
    expect(revalidateAcceptedEvidence(accepted, acquisitions([page]))).toEqual({ ok: true, item: accepted });
    const excerpt = "Unlike Loopio, Qvidian costs $30/month for small teams.";
    const swapped = {
      ...accepted,
      excerpt,
      excerptSha256: sha256Hex(excerpt),
      id: evidenceId(accepted.kind, accepted.sourceUrl, excerpt, evidenceClaimKey(accepted)),
    };
    const result = revalidateAcceptedEvidence(swapped, acquisitions([page]));
    expect(result.ok ? "" : result.issues.join(" | ")).toContain("ambiguous_attribution");
  });
});

describe("R9: a plan name binds only on the price's own line or the line above", () => {
  const page: Page = {
    url: "https://www.coderabbit.ai/pricing",
    roles: ["competitors"],
    text: "Plans\nStarter\n$12/user/month, billed annually\nPro\nEverything in Starter, plus SSO and audit logs. $24/user/month, billed annually.",
  };
  const pro = (plan: string, supportingText = "Pro\nEverything in Starter, plus SSO and audit logs. $24/user/month, billed annually.") =>
    priceCandidate({ vendor: "CodeRabbit", sourceUrl: page.url, supportingText, plan, priceText: "$24/user/month, billed annually" });

  it('drops a plan named after "Everything in" on the price line (review probe p1 #6) and keeps the line above', () => {
    const starter = must(run([page], { competitorPrices: [pro("Starter")] }).accepted[0]);
    expect(starter).not.toHaveProperty("plan");
    const own = must(run([page], { competitorPrices: [pro("Pro")] }).accepted[0]);
    expect(own).toMatchObject({ plan: "Pro" });
  });

  it("drops a plan named two lines above the price", () => {
    const twoAbove: Page = { ...page, text: "Pro\nUnlimited reviews\n$24/user/month, billed annually" };
    const item = must(
      run([twoAbove], {
        competitorPrices: [
          priceCandidate({
            vendor: "CodeRabbit",
            sourceUrl: page.url,
            supportingText: twoAbove.text,
            plan: "Pro",
            priceText: "$24/user/month, billed annually",
          }),
        ],
      }).accepted[0],
    );
    expect(item).not.toHaveProperty("plan");
  });

  it("refuses a stored plan that does not bind in revalidation", () => {
    const own = must(run([page], { competitorPrices: [pro("Pro")] }).accepted[0]);
    const relabeled = { ...own, plan: "Starter" };
    const withId = { ...relabeled, id: evidenceId(own.kind, own.sourceUrl, own.excerpt, evidenceClaimKey(relabeled)) };
    const result = revalidateAcceptedEvidence(withId, acquisitions([page]));
    expect(result.ok ? "" : result.issues.join(" | ")).toContain("plan: not named on the price's own line or the line above it");
  });
});

describe("R9: a price block that shows both monthly and annual billing needs the clause to say which", () => {
  const pricing = (text: string): Page => ({ url: "https://www.coderabbit.ai/pricing", roles: ["competitors"], text });
  const candidate = (priceText: string, supportingText = "Pro\n$24/user/month") =>
    priceCandidate({ vendor: "CodeRabbit", sourceUrl: "https://www.coderabbit.ai/pricing", supportingText, plan: "Pro", priceText });

  it.each([
    ["an annual-billing line above the plan (review probe p1 #4)", "Pricing\nAll plans are billed annually.\nPro\n$24/user/month\nUnlimited reviews."],
    ["a 'Billed annually' header (review probe p1 #4b)", "Billed annually\nPro\n$24/user/month\nUnlimited reviews."],
    ["a monthly/annual toggle", "Monthly\nAnnual (save 20%)\nPro\n$24/user/month"],
  ])("rejects the per-user monthly price under %s as qualifier_dropped", (_label, text) => {
    const result = run([pricing(text)], { competitorPrices: [candidate("$24/user/month")] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["qualifier_dropped"]);
    expect(result.rejected[0]?.detail).toMatch(/ambiguous billing/);
  });

  it("accepts the price when its own clause states the billing, or when only one billing is shown", () => {
    const stated = run([pricing("Monthly\nAnnual (save 20%)\nPro\n$24/user/month, billed annually")], {
      competitorPrices: [candidate("$24/user/month, billed annually", "Pro\n$24/user/month, billed annually")],
    });
    expect(stated.rejected).toEqual([]);
    const monthlyOnly = run([pricing("Pricing\nPro\n$24/user/month\nUnlimited reviews.")], { competitorPrices: [candidate("$24/user/month")] });
    expect(monthlyOnly.rejected).toEqual([]);
    // Ruling R14 made toggles and annual-billing lines page-scoped (a "Billed annually" line four lines above
    // now counts; see the R14 tests), while a feature line that mentions "annual" never counts.
    const featureAbove = run([pricing("Annual security reviews included\nPlans\nFor teams\nPro\nUnlimited reviews\n$24/user/month")], {
      competitorPrices: [candidate("$24/user/month", "$24/user/month")],
    });
    expect(featureAbove.rejected).toEqual([]);
  });
});

describe("R9: a stat binds only its own subject and metric", () => {
  const report = (text: string): Page => ({ url: "https://research.example.com/devtools", roles: ["market"], text });

  it("refuses a subject whose words are not all in the sentence (review probe p1 #7)", () => {
    const page = report("The global developer tools market reached $1.4 billion in 2024.");
    const result = run([page], {
      marketStats: [stat({ sourceUrl: page.url, supportingText: page.text, subject: "AI code review tools", amountText: "$1.4 billion", year: 2024 })],
    });
    expect(reasons(result)).toEqual(["subject_not_in_context"]);
    expect(result.rejected[0]?.detail).toMatch(/"code"/);
  });

  it.each([
    ["a figure", "RFP response software market, where 92% of buyers switch vendors every year", "review probe p10"],
    ["a link and a figure", "RFP response software market, already a $9 billion buyer opportunity per https://example.invalid/report", "security probe-subject"],
    ["an email", "RFP response software market (ask sales@example.invalid)", "contact text"],
    ["markup", "RFP response software **market**", "Markdown"],
    ["a spelled number", "RFP response software market with twelve vendors", "number word"],
  ])("refuses a subject that carries %s (%s, %s)", (_label, subject) => {
    const page = report("The RFP response software market was valued at $1.9 billion in 2024.");
    const result = run([page], { marketStats: [stat({ sourceUrl: page.url, supportingText: page.text, subject, amountText: "$1.9 billion", year: 2024 })] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["invalid_candidate"]);
    expect(result.rejected[0]?.detail).toMatch(/subject must be plain words/);
  });

  it("refuses a metric the sentence does not state (review probe p1 #8) and accepts the one it does", () => {
    const page = report("The AI code review market grew 12% in 2024.");
    const adoption = run([page], {
      marketStats: [stat({ sourceUrl: page.url, supportingText: page.text, subject: "AI code review market", metric: "adoption", amountText: "12%", year: 2024 })],
    });
    expect(reasons(adoption)).toEqual(["metric_unit_mismatch"]);
    expect(adoption.rejected[0]?.detail).toMatch(/does not state adoption/);
    const growth = run([page], {
      marketStats: [stat({ sourceUrl: page.url, supportingText: page.text, subject: "AI code review market", metric: "growth_rate", amountText: "12%", year: 2024 })],
    });
    expect(growth.rejected).toEqual([]);
  });

  it("applies the subject and metric rules in revalidation", () => {
    const page = report("The AI code review market grew 12% in 2024.");
    const item = must(
      run([page], {
        marketStats: [stat({ sourceUrl: page.url, supportingText: page.text, subject: "AI code review market", metric: "growth_rate", amountText: "12%", year: 2024 })],
      }).accepted[0],
    );
    const sources = acquisitions([page]);
    const renamed = revalidateAcceptedEvidence({ ...item, subject: "AI code review tools" }, sources);
    expect(renamed.ok ? "" : renamed.issues.join(" | ")).toContain("subject_not_in_context");
    const linked = revalidateAcceptedEvidence({ ...item, subject: "AI code review market https://example.invalid" }, sources);
    expect(linked.ok ? "" : linked.issues.join(" | ")).toContain("subject must be plain words");
    const relabeled = { ...item, metric: "adoption" as const };
    const withId = { ...relabeled, id: evidenceId(item.kind, item.sourceUrl, item.excerpt, evidenceClaimKey(relabeled)) };
    const metric = revalidateAcceptedEvidence(withId, sources);
    expect(metric.ok ? "" : metric.issues.join(" | ")).toContain("metric_unit_mismatch");
  });
});

// ---------------------------------------------------------------------------
// P3-6: signed and credential URLs are never cited or stored
// ---------------------------------------------------------------------------

describe("P3-6: credential-bearing URLs", () => {
  it("refuses a candidate citing a signed URL and stores no query in its rejection", () => {
    const signed = "https://bucket.s3.amazonaws.com/report.pdf?X-Amz-Signature=deadbeef&X-Amz-Expires=300";
    const page: Page = { url: signed, roles: ["market"], text: "The AI code review market was valued at $1.4 billion in 2025." };
    const result = run([page], {
      marketStats: [stat({ sourceUrl: signed, supportingText: page.text, amountText: "$1.4 billion", year: 2025 })],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["unknown_citation"]);
    expect(result.rejected[0]?.sourceUrl).toBe("https://bucket.s3.amazonaws.com/report.pdf");
    expect(JSON.stringify(result)).not.toContain("deadbeef");
  });

  it("stores no userinfo from a rejected candidate's URL", () => {
    const result = run([], { quotes: [quote("We answer every questionnaire by hand.", "https://user:hunter2@forum.example.net/t/1")] });
    expect(reasons(result)).toEqual(["unknown_citation"]);
    expect(JSON.stringify(result)).not.toContain("hunter2");
  });
});

// ---------------------------------------------------------------------------
// Ruling R14: binding follows the page's structure
// ---------------------------------------------------------------------------

describe("R14: a line break starts a sentence only after terminal punctuation or at a blank line", () => {
  const forum = (text: string, n = 1): Page => ({ url: `https://forum.example.net/t/questionnaires/${100 + n}`, roles: ["community"], text });

  it("refuses the line after a <br> inside a sentence, which drops its negation (review probe p17 2a)", () => {
    const page = forum("    Honestly, I would never say that\nsecurity questionnaires are the bottleneck for our team.\n We answer them in an afternoon.\n\n  ");
    const result = run([page], { quotes: [quote("security questionnaires are the bottleneck for our team.", page.url)] });
    expect(reasons(result)).toEqual(["span_bounds"]);
    expect(result.rejected[0]?.detail).toMatch(/sentence start/);
  });

  it("refuses the second line of a soft-wrapped sentence (review probe p17 3a)", () => {
    const page = forum("Title: questionnaires\nI would never claim that security questionnaires are\nthe main reason we lose enterprise deals.", 2);
    const result = run([page], { quotes: [quote("the main reason we lose enterprise deals.", page.url)] });
    expect(reasons(result)).toEqual(["span_bounds"]);
  });

  it("refuses the first line of a sentence that continues on the next line", () => {
    const page = forum("We answer every questionnaire by hand\nbut we would never do it again for a small deal.", 3);
    const result = run([page], { quotes: [quote("We answer every questionnaire by hand", page.url)] });
    expect(reasons(result)).toEqual(["span_bounds"]);
    expect(result.rejected[0]?.detail).toMatch(/sentence end/);
  });

  it("treats a title line without terminal punctuation as part of the next line unless a blank line follows it", () => {
    const sentence = "Honestly, I would never say that security questionnaires are the bottleneck for our team.";
    const joined = forum(`Topic: questionnaires\n${sentence}`, 4);
    expect(reasons(run([joined], { quotes: [quote(sentence, joined.url)] }))).toEqual(["span_bounds"]);
    for (const [n, text] of [
      [5, `Topic: questionnaires\n\n${sentence}`],
      [6, `Topic: questionnaires\r\n \t\r\n${sentence}`],
      [7, `Topic: questionnaires\n\n\n${sentence}`],
    ] as const) {
      const page = forum(text, n);
      const result = run([page], { quotes: [quote(sentence, page.url)] });
      expect(result.rejected, JSON.stringify(text)).toEqual([]);
      expect(must(result.accepted[0]).excerpt).toBe(sentence);
    }
  });

  it("accepts each paragraph of comments joined by blank lines, as sourceText reads HN and Reddit (review probe p17 1a)", () => {
    const page: Page = {
      url: "https://news.ycombinator.com/item?id=4103",
      roles: ["community"],
      text:
        "Ask HN: How do small teams handle security questionnaires?\n\nWe tried three tools last year. None of them could tell us which answer legal had approved, so we went back to spreadsheets.\n\nI would never say that questionnaires are the bottleneck\nfor our team, honestly.",
    };
    const result = run([page], {
      quotes: [
        quote("None of them could tell us which answer legal had approved, so we went back to spreadsheets.", page.url),
        quote("questionnaires are the bottleneck for our team, honestly.", page.url),
      ],
    });
    expect(result.accepted.map((e) => e.excerpt)).toEqual(["None of them could tell us which answer legal had approved, so we went back to spreadsheets."]);
    expect(reasons(result)).toEqual(["span_bounds"]);
  });
});

describe("R14: the claimed vendor is the nearest brand-like name before its price", () => {
  const blog = (text: string): Page => ({ url: "https://blog.example.com/rfp-pricing-notes", roles: ["competitors"], text });
  const loopioAt = (page: Page, supportingText = page.text, priceText = "$30/month") =>
    priceCandidate({ vendor: "Loopio", sourceUrl: page.url, supportingText, priceText });

  it.each([
    ["a rival named between the vendor and the price (review probe p4 v6b)", "Loopio customers often pick Qvidian at $30/month."],
    ["a move to a rival (review probe p1 3b)", "Loopio customers often move to Qvidian at $30/month."],
    ["a rival after the vendor (review probe p1 3c)", "After Loopio, we tried Qvidian at $30/month."],
    ["a rival named right after the price", "Loopio customers pay $30/month for Qvidian."],
  ])("refuses Loopio's price with %s", (_label, text) => {
    const page = blog(text);
    const result = run([page], { competitorPrices: [loopioAt(page)] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
  });

  it("names the nearer brand in the rejection", () => {
    const page = blog("Loopio customers often pick Qvidian at $30/month.");
    const result = run([page], { competitorPrices: [loopioAt(page)] });
    expect(result.rejected[0]?.detail).toContain('"Qvidian"');
  });

  it("refuses a rival's price on the vendor's own page without any cue (review probes p21, p1 p9b)", () => {
    const page: Page = {
      url: "https://loopio.example/pricing",
      roles: ["competitors"],
      text: "Loopio pricing\nResponsive charges $30/user/month. Loopio Essentials keeps every seat on one plan.\nEssentials\nContact sales",
    };
    const result = run([page], { competitorPrices: [loopioAt(page, "Responsive charges $30/user/month.", "$30/user/month")] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
    expect(result.rejected[0]?.detail).toContain('"Responsive"');
  });

  it("looks at a soft-wrapped line above the price on a vendor's own page", () => {
    const page: Page = { url: "https://loopio.example/pricing", roles: ["competitors"], text: "Loopio pricing\nResponsive is the cheaper pick at,\n$30/user/month for small teams." };
    const result = run([page], { competitorPrices: [loopioAt(page, "$30/user/month for small teams.", "$30/user/month")] });
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
  });

  it.each([
    ["migrated to", "Most teams migrated to Loopio and pay $30/month."],
    ["moved to", "Teams moved to Loopio at $30/month."],
    ["replaced by", "Spreadsheets were replaced by Loopio at $30/month."],
    ["over a rival", "We chose Loopio over Qvidian at $30/month."],
  ])("treats %s as a comparison cue", (cue, text) => {
    const page = blog(text);
    const result = run([page], { competitorPrices: [loopioAt(page)] });
    expect(reasons(result)).toEqual(["ambiguous_attribution"]);
    expect(result.rejected[0]?.detail).toContain(cue.split(" ")[0] ?? cue);
  });

  it("accepts the vendor, its plan, plan and pricing words, and after/over before ordinary words", () => {
    for (const text of [
      "Loopio costs $30/month for small teams.",
      "Loopio's Essentials plan costs $30/month.",
      "Loopio costs $30/month for its Team plan.",
      "Loopio costs $30/month after the free trial.",
      "Loopio costs $30/month for over ten seats.",
      "With Loopio, every seat costs $30/month.",
    ]) {
      const page = blog(text);
      const result = run([page], { competitorPrices: [loopioAt(page)] });
      expect(result.rejected, text).toEqual([]);
    }
    for (const [text, priceText] of [
      ["Loopio pricing\nPlans start at $29/month.", "from $29/month"],
      ["Loopio pricing\nPro: $24/user/month, billed annually", "$24/user/month, billed annually"],
      ["Loopio pricing\nStarter €49/month", "€49/month"],
      ["Loopio pricing\nSSO and API access for $99/month", "$99/month"],
    ] as const) {
      const page: Page = { url: "https://loopio.example/pricing", roles: ["competitors"], text };
      const supporting = text.split("\n")[1] ?? text;
      const result = run([page], { competitorPrices: [loopioAt(page, supporting, priceText)] });
      expect(result.rejected, text).toEqual([]);
    }
  });

  it("applies the nearest-name rule in revalidation", () => {
    const page = blog("Loopio costs $30/month for small teams.");
    const accepted = must(run([page], { competitorPrices: [loopioAt(page)] }).accepted[0]);
    const excerpt = "Loopio customers often pick Qvidian at $30/month.";
    const swapped = {
      ...accepted,
      excerpt,
      excerptSha256: sha256Hex(excerpt),
      id: evidenceId(accepted.kind, accepted.sourceUrl, excerpt, evidenceClaimKey(accepted)),
    };
    const result = revalidateAcceptedEvidence(swapped, acquisitions([page]));
    expect(result.ok ? "" : result.issues.join(" | ")).toContain("ambiguous_attribution");
  });
});

describe("R14: billing toggles and annual-billing lines are page-scoped", () => {
  const pricing = (text: string): Page => ({ url: "https://acme.example/pricing", roles: ["competitors"], text });
  const acme = (plan: string, priceText: string, supportingText: string) =>
    priceCandidate({ vendor: "Acme", sourceUrl: "https://acme.example/pricing", supportingText, plan, priceText });

  it("refuses every per-month price under one Monthly/Yearly toggle (review probe p24)", () => {
    const page = pricing(
      [
        "Pricing", "Simple, transparent pricing", "Monthly", "Yearly (save 20%)",
        "Starter", "$12", "per user / month", "For small teams getting started",
        "Pro", "$24", "per user / month", "Everything in Starter, plus:", "Unlimited projects", "Audit logs",
        "Business", "$48", "per user / month", "Everything in Pro, plus:", "SSO",
      ].join("\n"),
    );
    const result = run([page], {
      competitorPrices: [
        acme("Starter", "$12/user/month", "$12\nper user / month"),
        acme("Pro", "$24/user/month", "$24\nper user / month"),
        acme("Business", "$48/user/month", "$48\nper user / month"),
      ],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["qualifier_dropped", "qualifier_dropped", "qualifier_dropped"]);
  });

  it.each([
    ["a toggle five lines above (review probe p1 4c)", "Pricing\nMonthly Annually (save 20%)\nPro\nFor growing teams\nEverything you need to review code\nUnlimited private repositories\n$24/user/month\nStart trial"],
    ["an annual-billing line far above", "All plans are billed annually.\nPlans\nFor teams\nPro\nUnlimited reviews\n$24/user/month"],
    ["a save-with-annual-billing line far above", "Save 20% with annual billing\nPlans\nFor teams\nPro\nUnlimited reviews\n$24/user/month"],
    ["a pay-yearly toggle", "Pay monthly | Pay yearly -20%\nPro\nUnlimited reviews\nPriority support\n$24/user/month"],
  ])("refuses a per-month price under %s", (_label, text) => {
    const result = run([pricing(text)], { competitorPrices: [acme("Pro", "$24/user/month", "$24/user/month")] });
    expect(reasons(result)).toEqual(["qualifier_dropped"]);
    expect(result.rejected[0]?.detail).toMatch(/ambiguous billing/);
  });

  it("counts another plan's billed-annually qualifier only in the price's own block", () => {
    const page: Page = {
      url: "https://blog.example.com/review-pricing",
      roles: ["competitors"],
      text: "Lite\n$12/user/month, billed annually\nPull request summaries.\nPro\n$24/user/month, billed annually\nUnlimited reviews.\nEnterprise\nCustom pricing\nGraphite charges $40/user/month for its Team plan.",
    };
    const far = run([page], {
      competitorPrices: [
        priceCandidate({ vendor: "Graphite", sourceUrl: page.url, supportingText: "Graphite charges $40/user/month for its Team plan.", priceText: "$40/user/month" }),
      ],
    });
    expect(far.rejected).toEqual([]);
    const near: Page = { ...page, text: "Lite\n$12/user/month, billed annually\nGraphite charges $40/user/month for its Team plan." };
    const result = run([near], {
      competitorPrices: [
        priceCandidate({ vendor: "Graphite", sourceUrl: near.url, supportingText: "Graphite charges $40/user/month for its Team plan.", priceText: "$40/user/month" }),
      ],
    });
    expect(reasons(result)).toEqual(["qualifier_dropped"]);
  });

  it("does not count feature lines that mention annual, negated cues, toggles below the price or a stated billing", () => {
    for (const [text, priceText] of [
      ["Pro\nIncludes an annual security review\n$24/user/month\nStart trial", "$24/user/month"],
      ["No annual contract required.\nPro\n$24/user/month", "$24/user/month"],
      ["Annual reports and yearly audits included.\nPro\n$24/user/month", "$24/user/month"],
      ["Pro\n$24/user/month\nMonthly | Yearly", "$24/user/month"],
      ["Monthly\nYearly (save 20%)\nPro\n$24/user/month, billed annually", "$24/user/month, billed annually"],
      ["Monthly\nYearly (save 20%)\nPro\n$240/user/year", "$240/user/year"],
    ] as const) {
      const supporting = text.split("\n").find((line) => line.startsWith("$")) ?? text;
      const result = run([pricing(text)], { competitorPrices: [acme("Pro", priceText, supporting)] });
      expect(result.rejected, text).toEqual([]);
    }
  });
});

describe("R14: a plan named after from, upgrade from or than never binds", () => {
  const page: Page = {
    url: "https://www.coderabbit.ai/pricing",
    roles: ["competitors"],
    text: "Pro\nUpgrade from Starter: $24/user/month, billed annually.\nTeam\nMore seats than Starter. $48/user/month, billed annually.",
  };
  const candidate = (plan: string, supportingText: string, priceText: string) =>
    priceCandidate({ vendor: "CodeRabbit", sourceUrl: page.url, supportingText, plan, priceText });

  it("drops the plan after upgrade from (review probe p1 6b) and after than, and keeps the plan on the line above", () => {
    const upgrade = must(
      run([page], { competitorPrices: [candidate("Starter", "Upgrade from Starter: $24/user/month, billed annually.", "$24/user/month, billed annually")] })
        .accepted[0],
    );
    expect(upgrade).not.toHaveProperty("plan");
    const than = must(
      run([page], { competitorPrices: [candidate("Starter", "More seats than Starter. $48/user/month, billed annually.", "$48/user/month, billed annually")] })
        .accepted[0],
    );
    expect(than).not.toHaveProperty("plan");
    const own = must(
      run([page], { competitorPrices: [candidate("Pro", "Pro\nUpgrade from Starter: $24/user/month, billed annually.", "$24/user/month, billed annually")] })
        .accepted[0],
    );
    expect(own).toMatchObject({ plan: "Pro" });
  });
});

describe("R14: every subject word is in the stat's sentence", () => {
  const report = (text: string): Page => ({ url: "https://research.example.com/rfp-market", roles: ["market"], text });
  const SENTENCE = "The RFP response software market was valued at $1.9 billion in 2024.";

  it.each([
    ["US RFP response software market", "us"],
    ["EU RFP response software market", "eu"],
    ["no RFP response software market", "no"],
    ["projected RFP response software market", "projected"],
    ["only the RFP response software market", "only"],
    ["global RFP response software market", "global"],
  ])("refuses the subject %s (security probe-subject-qualifiers)", (subject, missing) => {
    const page = report(SENTENCE);
    const result = run([page], { marketStats: [stat({ sourceUrl: page.url, supportingText: SENTENCE, subject, amountText: "$1.9 billion", year: 2024 })] });
    expect(reasons(result)).toEqual(["subject_not_in_context"]);
    expect(result.rejected[0]?.detail).toContain(`"${missing}"`);
  });

  it("lets only a, an, the, of, for, and, in, on and to be absent, and matches word forms of longer words", () => {
    const accepted = (supportingText: string, subject: string, amountText: string, metric: MarketStatCandidate["metric"], year: number) => {
      const page = report(supportingText);
      return run([page], { marketStats: [stat({ sourceUrl: page.url, supportingText, subject, amountText, metric, year })] });
    };
    expect(accepted(SENTENCE, "the market for RFP response software", "$1.9 billion", "market_size", 2024).rejected).toEqual([]);
    expect(accepted(SENTENCE, "RFP response software markets", "$1.9 billion", "market_size", 2024).rejected).toEqual([]);
    const survey = "In 2025, 62% of developers used AI code review assistants at work.";
    expect(accepted(survey, "developers using AI code review assistants", "62%", "adoption", 2025).rejected).toEqual([]);
    const fixtureSurvey = "In 2025, 64% of B2B SaaS sales teams used spreadsheets to answer security questionnaires.";
    expect(accepted(fixtureSurvey, "B2B SaaS sales teams using spreadsheets for security questionnaires", "64%", "adoption", 2025).rejected).toEqual(
      [],
    );
    // A short word must appear as itself: "used" is no "US".
    expect(reasons(accepted(survey, "US developers using AI code review assistants", "62%", "adoption", 2025))).toEqual(["subject_not_in_context"]);
  });
});

describe("PR96 review: evidence assertions retain their meaning", () => {
  it("requires the original research page for market figures repeated in a roundup", () => {
    const text = "The landing page builder market reached $725 million in 2025.";
    const roundup = { url: "https://www.aidesigner.ai/blog/best-ai-landing-page-builders", text };
    const original = { url: "https://www.researchnester.com/reports/landing-page-builder-market/4347", text };
    const candidate = (sourceUrl: string) => stat({ sourceUrl, supportingText: text, subject: "landing page builder market", amountText: "$725 million", year: 2025 });
    const secondhand = run([roundup], { marketStats: [candidate(roundup.url)] });
    expect(secondhand.accepted).toEqual([]);
    expect(reasons(secondhand)).toEqual(["unsupported_assertion"]);
    const primary = run([original], { marketStats: [candidate(original.url)] });
    expect(primary.accepted).toHaveLength(1);
    const mutated = { ...primary.accepted[0], sourceUrl: roundup.url };
    const checked = revalidateAcceptedEvidence(mutated, acquisitions([roundup]));
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues.join(" ")).toContain("not the original research source");
  });

  it("rejects a market forecast copied into a general marketing guide", () => {
    const text = "The AI code review market is projected to reach $25.7 billion by 2030.";
    const guide = { url: "https://www.digitalapplied.com/blog/ai-code-review-automation-guide-2025", text };
    const report = { url: "https://dataintelo.com/report/ai-generated-code-review-tools-market", text };
    const candidate = (sourceUrl: string) => stat({ sourceUrl, supportingText: text, subject: "AI code review market", amountText: "$25.7 billion", year: 2030, periodKind: "projected" });
    const secondary = run([guide], { marketStats: [candidate(guide.url)] });
    expect(secondary.accepted).toEqual([]);
    expect(reasons(secondary)).toEqual(["unsupported_assertion"]);
    const primary = run([report], { marketStats: [candidate(report.url)] });
    expect(primary.accepted).toHaveLength(1);
    const checked = revalidateAcceptedEvidence({ ...primary.accepted[0], sourceUrl: guide.url }, acquisitions([guide]));
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues.join(" ")).toContain("not the original research source");
  });

  it("requires the original publication for a statistic explicitly credited to it", () => {
    const text = "47% of professional developers used AI-assisted code review in the past year, up from 22% in 2024 (Stack Overflow 2025).";
    const vendor = { url: "https://www.qodo.ai/research/ai-code-review", text };
    const original = { url: "https://survey.stackoverflow.co/2025/ai", text };
    const candidate = (sourceUrl: string) => stat({ sourceUrl, supportingText: text, subject: "professional developers", metric: "adoption", amountText: "47%", periodKind: "measured" });
    const secondhand = run([vendor], { marketStats: [candidate(vendor.url)] });
    expect(secondhand.accepted).toEqual([]);
    expect(reasons(secondhand)).toEqual(["unsupported_assertion"]);
    const primary = run([original], { marketStats: [candidate(original.url)] });
    expect(primary.accepted).toHaveLength(1);
    expect(revalidateAcceptedEvidence(primary.accepted[0], acquisitions([original])).ok).toBe(true);
    const mutated = { ...primary.accepted[0], sourceUrl: vendor.url };
    const checked = revalidateAcceptedEvidence(mutated, acquisitions([vendor]));
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues.join(" ")).toContain("another publication");
  });

  it("accepts an exact app-listing price as labelled marketplace evidence", () => {
    const page = { url: "https://apps.shopify.com/instant", text: "Instant Landing Page Builder\nPricing\nStarter\n$39/month" };
    const result = run([page], {
      competitorPrices: [priceCandidate({ vendor: "Instant", sourceUrl: page.url, supportingText: "$39/month", priceText: "$39/month" })],
    });
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({ vendor: "Instant", attribution: "secondary" });
    expect(revalidateAcceptedEvidence(result.accepted[0], acquisitions([page])).ok).toBe(true);
    const rival = run([page], {
      competitorPrices: [priceCandidate({ vendor: "Replo", sourceUrl: page.url, supportingText: "$39/month", priceText: "$39/month" })],
    });
    expect(rival.accepted).toEqual([]);
  });

  it("binds an app listing's distinctive brand slug to its longer product name", () => {
    const page = { url: "https://apps.shopify.com/instant-builder", text: "Instant AI Page Builder\nPricing\nStarter\n$39/month" };
    const result = run([page], {
      competitorPrices: [priceCandidate({ vendor: "Instant AI Page Builder", sourceUrl: page.url, supportingText: "$39/month", priceText: "$39/month" })],
    });
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({ vendor: "Instant AI Page Builder", attribution: "secondary" });
    expect(revalidateAcceptedEvidence(result.accepted[0], acquisitions([page])).ok).toBe(true);
    const rival = run([page], {
      competitorPrices: [priceCandidate({ vendor: "Replo AI Page Builder", sourceUrl: page.url, supportingText: "$39/month", priceText: "$39/month" })],
    });
    expect(rival.accepted).toEqual([]);
  });

  it("refuses first-party pricing claims from a comparison blog even when the sentence is literal", () => {
    const url = "https://responsive.io/blog/responsive-pricing-compared-other-rfp-software";
    const page = { url, text: "Responsive pricing\nResponsive costs $49/month.\nResponsive uses custom pricing for larger teams." };
    const result = run([page], {
      competitorPrices: [priceCandidate({ vendor: "Responsive", sourceUrl: url, supportingText: "Responsive costs $49/month.", priceText: "$49/month" })],
      competitorAvailability: [{ vendor: "Responsive", sourceUrl: url, supportingText: "Responsive uses custom pricing for larger teams.", availability: "contact_sales" }],
    });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["ambiguous_attribution", "ambiguous_attribution"]);
  });

  it.each([
    "The AI code review market was worth $1.4 million in 2024, while the unrelated gaming market was worth $9.4 billion in 2025.",
    "The AI code review market was worth $1.4 million in 2024, and the gaming market was worth $9.4 billion in 2025.",
  ])("rejects a statistic taken from another market in one sentence", (text) => {
    const page = { url: REPORT.url, text };
    const wrong = run([page], {
      marketStats: [stat({ supportingText: text, amountText: "$9.4 billion", year: 2025 })],
    });
    expect(wrong.accepted).toEqual([]);
    expect(reasons(wrong)).toEqual(["subject_not_in_context"]);
    const right = run([page], {
      marketStats: [stat({ supportingText: text, amountText: "$1.4 million", year: 2024 })],
    });
    expect(right.accepted).toHaveLength(1);
  });

  it.each([
    "CodeRabbit does not cost $30/user/month.",
    "CodeRabbit used to cost $30/user/month.",
    "CodeRabbit might cost $30/user/month if its plans change.",
    "CodeRabbit costs approximately $30/user/month.",
  ])("rejects a price that is not a current exact assertion: %s", (text) => {
    const page = { url: CODERABBIT.url, text };
    const result = run([page], { competitorPrices: [priceCandidate({ vendor: "CodeRabbit", sourceUrl: page.url, supportingText: text, priceText: "$30/user/month" })] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["unsupported_assertion"]);
  });

  it("keeps an affirmative current exact price", () => {
    const text = "CodeRabbit costs $30/user/month.";
    const page = { url: CODERABBIT.url, text };
    const result = run([page], { competitorPrices: [priceCandidate({ vendor: "CodeRabbit", sourceUrl: page.url, supportingText: text, priceText: "$30/user/month" })] });
    expect(result.accepted).toHaveLength(1);
    expect(revalidateAcceptedEvidence(result.accepted[0], acquisitions([page])).ok).toBe(true);
  });

  it("binds an annual qualifier to the second offer rather than the first", () => {
    const text = "CodeRabbit costs $30 per developer per month, or $24 per developer per month when billed annually.";
    const page = { url: CODERABBIT.url, text };
    const candidate = (priceText: string) => priceCandidate({ vendor: "CodeRabbit", sourceUrl: page.url, supportingText: text, priceText });
    const wrong = run([page], { competitorPrices: [candidate("$30/user/month, billed annually")] });
    expect(wrong.accepted).toEqual([]);
    const right = run([page], { competitorPrices: [candidate("$30/user/month"), candidate("$24/user/month, billed annually")] });
    expect(right.accepted).toHaveLength(2);
    for (const item of right.accepted) expect(revalidateAcceptedEvidence(item, acquisitions([page])).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ruling R15: untrusted text and URLs
// ---------------------------------------------------------------------------

describe("R15: citation titles are short, plain and figure-free, or the host stands in", () => {
  const page: Page = { url: "https://research.example.com/rfp-market", roles: ["market"], text: "The RFP response software market was valued at $1.9 billion in 2024." };
  const titled = (title: string) =>
    acceptEvidence({
      candidates: {
        quotes: [],
        marketStats: [stat({ sourceUrl: page.url, supportingText: page.text, subject: "RFP response software market", amountText: "$1.9 billion", year: 2024 })],
        competitorPrices: [],
      },
      citations: [{ url: page.url, title }],
      sources: sourcesOf([page]),
    });

  it.each([
    ["a figure (security probe-title)", "Survey: 87% of SaaS teams lost a $2 million deal to slow RFPs"],
    ["a short figure (security probe-title-short)", "87% of teams lose deals"],
    ["a spelled number", "Twelve vendors compared for proposal teams"],
    ["a link", "RFP market report, see https://evil.example/report"],
    ["an email", "RFP market report (sales@evil.example)"],
    ["a bidi control", "RFP market report \u202Eedis\u202C"],
    ["a zero-width space", "RFP market\u200B report"],
    ["more than 120 characters", `RFP response software market report ${"with a very long subtitle ".repeat(5)}`],
  ])("uses the host label for a title with %s", (_label, title) => {
    expect(must(titled(title).accepted[0]).sourceTitle).toBe("research.example.com");
  });

  it("keeps a plain title, bare years and standard names included", () => {
    for (const title of ["RFP response software market report 2025", "SOC 2 readiness for proposal teams", "Ask HN: Is AI code review worth it?"]) {
      expect(must(titled(title).accepted[0]).sourceTitle).toBe(title);
    }
  });

  it("refuses a stored title that breaks the rule in revalidation, and accepts the host label", () => {
    const item = must(titled("RFP response software market report").accepted[0]);
    const sources = acquisitions([page]);
    const figure = revalidateAcceptedEvidence({ ...item, sourceTitle: "87% of teams lose deals" }, sources);
    expect(figure.ok ? "" : figure.issues.join(" | ")).toMatch(/sourceTitle: .*ruling R15/);
    const control = revalidateAcceptedEvidence({ ...item, sourceTitle: "RFP market\u2066 report" }, sources);
    expect(control.ok).toBe(false);
    expect(revalidateAcceptedEvidence({ ...item, sourceTitle: "research.example.com" }, sources).ok).toBe(true);
  });
});

describe("R15: invisible and bidirectional format controls never reach accepted evidence", () => {
  const HOSTILE = "Honestly the fix cost us \u202E005$\u202C a month and it saved our whole quarter.";

  it("refuses a quote whose sentence holds a bidi override (security probe-bidi-quote)", () => {
    const page: Page = { url: "https://forum.example.net/t/costs/1", roles: ["community"], text: `Topic\n\n${HOSTILE}` };
    const result = run([page], { quotes: [quote(HOSTILE, page.url)] });
    expect(result.accepted).toEqual([]);
    expect(reasons(result)).toEqual(["invalid_candidate"]);
    expect(result.rejected[0]?.detail).toMatch(/U\+202E/);
  });

  it.each([
    ["U+061C", "\u061C"],
    ["U+200B", "\u200B"],
    ["U+200F", "\u200F"],
    ["U+202A", "\u202A"],
    ["U+2060", "\u2060"],
    ["U+2064", "\u2064"],
    ["U+2066", "\u2066"],
    ["U+2069", "\u2069"],
    ["U+FEFF", "\uFEFF"],
  ])("refuses %s in a quote, a stat subject, a vendor or a plan", (code, ch) => {
    const sentence = `We answer every security questionnaire by${ch} hand each quarter.`;
    const forum: Page = { url: "https://forum.example.net/t/controls/2", roles: ["community"], text: sentence };
    const quoted = run([forum], { quotes: [quote(sentence, forum.url)] });
    expect(reasons(quoted), code).toEqual(["invalid_candidate"]);
    const report: Page = { url: "https://research.example.com/rfp", roles: ["market"], text: "The RFP response software market was valued at $1.9 billion in 2024." };
    const subject = run([report], {
      marketStats: [stat({ sourceUrl: report.url, supportingText: report.text, subject: `RFP response${ch} software market`, amountText: "$1.9 billion", year: 2024 })],
    });
    expect(reasons(subject), code).toEqual(["invalid_candidate"]);
    const pricing: Page = { url: "https://blog.example.com/prices", roles: ["competitors"], text: "Loopio costs $30/month for small teams." };
    const vendor = run([pricing], {
      competitorPrices: [priceCandidate({ vendor: `Loo${ch}pio`, sourceUrl: pricing.url, supportingText: pricing.text, priceText: "$30/month" })],
    });
    expect(reasons(vendor), code).toEqual(["invalid_candidate"]);
    const plan = run([pricing], {
      // Inside the name: trimming already drops a trailing U+FEFF.
      competitorPrices: [priceCandidate({ vendor: "Loopio", plan: `Te${ch}am`, sourceUrl: pricing.url, supportingText: pricing.text, priceText: "$30/month" })],
    });
    expect(reasons(plan), code).toEqual(["invalid_candidate"]);
  });

  it("stores no control character in an operator-only rejection record", () => {
    const page: Page = { url: "https://forum.example.net/t/costs/3", roles: ["community"], text: HOSTILE };
    const result = run([page], { quotes: [quote(`${HOSTILE} \u2066extra\u2069`, page.url)] });
    const record = JSON.stringify(result.rejected);
    expect(record).not.toMatch(/[\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u);
  });

  it("refuses a stored excerpt or subject with a control in revalidation", () => {
    const page: Page = { url: "https://forum.example.net/t/plain/4", roles: ["community"], text: "We answer every questionnaire by hand, every single quarter." };
    const item = must(run([page], { quotes: [quote(page.text, page.url)] }).accepted[0]);
    const excerpt = "We answer every questionnaire by hand,\u202E every single quarter.";
    const tampered = {
      ...item,
      excerpt,
      excerptSha256: sha256Hex(excerpt),
      id: evidenceId(item.kind, item.sourceUrl, excerpt, evidenceClaimKey(item)),
    };
    const result = revalidateAcceptedEvidence(tampered, acquisitions([page]));
    expect(result.ok ? "" : result.issues.join(" | ")).toMatch(/U\+202E/);
  });
});

describe("R14: billing cues are read once per page", () => {
  it("accepts forty candidates against a page of sixty thousand lines in well under two seconds", () => {
    const url = "https://acme.example/pricing";
    const lines: string[] = [];
    for (let i = 0; i < 60_000; i += 1) {
      lines.push(i % 3 === 0 ? "Pro" : i % 3 === 1 ? `$${(i % 90) + 10}/user/month` : "Unlimited reviews for teams, billed per seat.");
    }
    lines.push("Acme Max", "$999/user/month");
    const page: Page = { url, roles: ["competitors"], text: lines.join("\n") };
    const candidates = Array.from({ length: 40 }, () =>
      priceCandidate({ vendor: "Acme", sourceUrl: url, supportingText: "$999/user/month", priceText: "$999/user/month" }),
    );
    const started = performance.now();
    const result = run([page], { competitorPrices: candidates });
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(result.accepted).toHaveLength(1);
    expect(reasons(result).every((r) => r === "duplicate")).toBe(true);
  });
});
