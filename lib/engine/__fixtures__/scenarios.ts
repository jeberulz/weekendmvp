/**
 * Adversarial research scenarios shared by the pipeline tests
 * (pipeline.evidence.test.ts) and the deterministic replay gate
 * (replay.test.ts): the review's F1 mixed evidence and the remediation
 * plan's F5 rows 1–4, as fixture-provider options. Pages are synthetic and on
 * reserved hosts; nothing here touches the network or a paid provider.
 */

import type {
  AcceptedEvidence,
  CompetitorPriceCandidate,
  MarketStatCandidate,
  QuoteCandidate,
} from "../evidence/contract.ts";
import {
  FIXTURE_EXTRACTION,
  FIXTURE_PAGES,
  FIXTURE_URLS,
  SEARCH_COMMUNITY_FIXTURE,
  SEARCH_COMPETITORS_FIXTURE,
  SEARCH_MARKET_FIXTURE,
  type FixtureProviderOptions,
} from "../providers/fixtures.ts";

type ExtraCitation = { url: string; title: string };

/** Search packs with extra citations appended to the fixture's (and optional community answer prose). */
export function packsWith(
  extra: { market?: ExtraCitation[]; competitors?: ExtraCitation[]; community?: ExtraCitation[] },
  communityProse?: string,
) {
  return {
    market: { ...SEARCH_MARKET_FIXTURE, search_results: [...SEARCH_MARKET_FIXTURE.search_results, ...(extra.market ?? [])] },
    competitors: {
      ...SEARCH_COMPETITORS_FIXTURE,
      search_results: [...SEARCH_COMPETITORS_FIXTURE.search_results, ...(extra.competitors ?? [])],
    },
    community: {
      ...SEARCH_COMMUNITY_FIXTURE,
      ...(communityProse ? { choices: [{ message: { content: communityProse } }] } : {}),
      search_results: [...SEARCH_COMMUNITY_FIXTURE.search_results, ...(extra.community ?? [])],
    },
  };
}

/** The saved extraction reply plus extra candidates (appended after the fixture's own). */
export function extractionWith(extra: { quotes?: unknown[]; marketStats?: unknown[]; competitorPrices?: unknown[] }) {
  return () => ({
    quotes: [...FIXTURE_EXTRACTION.quotes, ...(extra.quotes ?? [])],
    marketStats: [...FIXTURE_EXTRACTION.marketStats, ...(extra.marketStats ?? [])],
    competitorPrices: [...FIXTURE_EXTRACTION.competitorPrices, ...(extra.competitorPrices ?? [])],
  });
}

// ---------------------------------------------------------------------------
// F1: rejected "47 PRs / team of 8" and "60% / 25%" claims next to valid quotes
// ---------------------------------------------------------------------------

export const REVIEW_LOAD_PAGE = "https://forum.example.net/t/review-load/91";

/** Community search answer prose carrying the rejected claims (prose is never evidence). */
export const F1_PROSE =
  "One commenter reviews 47 PRs a week on a team of 8 [1] and spends 60% of the time reviewing versus 25% coding [2].";

export const F1_QUOTES: QuoteCandidate[] = [
  // Not on its page (the page says something else).
  { sourceUrl: FIXTURE_URLS.hnThread, text: "We review 47 PRs a week on a team of 8 and it eats our evenings." },
  { sourceUrl: FIXTURE_URLS.forumThread, text: "Review takes 60% of our time versus 25% coding for the whole team." },
  // On a page that cannot be read.
  { sourceUrl: FIXTURE_URLS.redditThread, text: "We review 47 PRs a week on a team of 8 and nobody codes anymore." },
  // The page states the numbers, but not as this contiguous quote.
  { sourceUrl: REVIEW_LOAD_PAGE, text: "We review 47 PRs a week on a team of 8." },
];

export const F1_STATS: MarketStatCandidate[] = [
  // On its page, but a percentage cannot be a market size.
  {
    sourceUrl: REVIEW_LOAD_PAGE,
    supportingText: "Our team of 8 reviews 47 PRs a week, and reviews take 60% of our time versus 25% coding.",
    subject: "engineering teams reviewing pull requests",
    metric: "market_size",
    amountText: "60%",
    periodKind: "measured",
  },
  // Not on its page.
  {
    sourceUrl: FIXTURE_URLS.workloadSurvey,
    supportingText: "Reviewers spend 60% of their time reviewing versus 25% coding.",
    subject: "code reviewers",
    metric: "adoption",
    amountText: "60%",
    periodKind: "measured",
  },
];

/** Text of the rejected F1 claims; none may reach the writer, the record's writer fields or a page. */
export const REJECTED_FRAGMENTS = ["47 PRs", "team of 8", "60% of", "25% coding", "eats our evenings", "nobody codes"];

/** Source pages of the F1 scenario: the fixture's, plus a page that states the numbers in another sentence. */
export const F1_PAGES: Readonly<Record<string, string>> = {
  ...FIXTURE_PAGES,
  [REVIEW_LOAD_PAGE]: "Topic: review load\nOur team of 8 reviews 47 PRs a week, and reviews take 60% of our time versus 25% coding.",
};

/** Fixture providers for the F1 mixed scenario; `options` may replace any part (synthesis is merged). */
export function f1ProviderOptions(options: FixtureProviderOptions = {}): FixtureProviderOptions {
  return {
    pages: F1_PAGES,
    packs: packsWith({ community: [{ url: REVIEW_LOAD_PAGE, title: "Review load" }] }, F1_PROSE),
    ...options,
    synthesis: { extraction: extractionWith({ quotes: F1_QUOTES, marketStats: F1_STATS }), ...options.synthesis },
  };
}

// ---------------------------------------------------------------------------
// F5 rows 1–4 (plan §6 test matrix)
// ---------------------------------------------------------------------------

export const LOOPIO_PRICING = "https://loopio.example/pricing";
export const CODE_REVIEW_REPORT = "https://research.example.com/ai-code-review-market";
export const CATEGORY_NOTES = "https://research.example.com/rfp-category-notes";
export const ROUNDUP = "https://blog.example.com/rfp-tools-compared";

export const F5_PAGES: Record<string, string> = {
  [LOOPIO_PRICING]: "Loopio pricing\nFoundations\n$20,000/year\nTen seats included.",
  [CODE_REVIEW_REPORT]: "The AI code review market was worth $1.4 million in 2024.",
  [CATEGORY_NOTES]: "Published in 2024. The RFP software category keeps growing.",
  [ROUNDUP]: "We priced the leaders. Loopio costs $20,000/year while Qvidian costs $30/month. Both offer trials.",
};

export const F5_PACKS = packsWith({
  market: [
    { url: CODE_REVIEW_REPORT, title: "AI code review market" },
    { url: CATEGORY_NOTES, title: "RFP category notes" },
  ],
  competitors: [
    { url: LOOPIO_PRICING, title: "Loopio pricing" },
    { url: ROUNDUP, title: "RFP tools compared" },
  ],
});

export type F5Row = {
  label: string;
  stats?: MarketStatCandidate[];
  prices?: CompetitorPriceCandidate[];
  /** Rejection reasons acceptable for this row's candidates. */
  reasons: string[];
  /** True for an accepted item that would mean the wrong claim got through. */
  leaked: (item: AcceptedEvidence) => boolean;
};

export const F5_ROWS: F5Row[] = [
  {
    label: "$20,000/month claimed from a $20,000/year page",
    prices: [
      { vendor: "Loopio", sourceUrl: LOOPIO_PRICING, supportingText: "Foundations\n$20,000/year", plan: "Foundations", priceText: "$20,000/month" },
    ],
    reasons: ["period_mismatch"],
    leaked: (item) => item.kind === "competitor_price" && item.vendor === "Loopio" && item.price.period === "month",
  },
  {
    label: "$1.4 billion claimed from a $1.4 million page",
    stats: [
      {
        sourceUrl: CODE_REVIEW_REPORT,
        supportingText: "The AI code review market was worth $1.4 million in 2024.",
        subject: "AI code review market",
        metric: "market_size",
        amountText: "$1.4 billion",
        year: 2024,
        periodKind: "measured",
      },
    ],
    reasons: ["amount_mismatch"],
    leaked: (item) => item.kind === "market_stat" && item.amount.magnitude === "billion" && item.amount.value === "1.4",
  },
  {
    label: '"$2024 billion" grounded only on "Published in 2024"',
    stats: [
      {
        sourceUrl: CATEGORY_NOTES,
        supportingText: "Published in 2024.",
        subject: "RFP software category",
        metric: "market_size",
        amountText: "$2024 billion",
        year: 2024,
        periodKind: "measured",
      },
    ],
    reasons: ["amount_mismatch"],
    leaked: (item) => item.kind === "market_stat" && item.amount.value === "2024",
  },
  {
    label: "Loopio at $30/month from the Loopio/Qvidian sentence",
    prices: [
      {
        vendor: "Loopio",
        sourceUrl: ROUNDUP,
        supportingText: "Loopio costs $20,000/year while Qvidian costs $30/month.",
        priceText: "$30/month",
      },
    ],
    reasons: ["vendor_not_in_context", "ambiguous_attribution"],
    leaked: (item) => item.kind === "competitor_price" && item.vendor === "Loopio" && item.price.amount.value === "30",
  },
];

/** Fixture providers with the F5 pages and packs and the given rows' candidates added to the saved extraction. */
export function f5ProviderOptions(rows: ReadonlyArray<F5Row>, options: FixtureProviderOptions = {}): FixtureProviderOptions {
  return {
    pages: { ...FIXTURE_PAGES, ...F5_PAGES },
    packs: F5_PACKS,
    ...options,
    synthesis: {
      extraction: extractionWith({
        marketStats: rows.flatMap((row) => row.stats ?? []),
        competitorPrices: rows.flatMap((row) => row.prices ?? []),
      }),
      ...options.synthesis,
    },
  };
}
