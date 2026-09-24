/**
 * Fixture transports for provider adapters (Mode A2 / idea-engine phase 4).
 *
 * Lifted from codex/wp26-v1.1-engine @ c99351b. Every later test runs against
 * these so no test needs a key and no test spends money. Each fixture is a
 * `fetch`-shaped function, so the adapter under test is the *real* adapter —
 * parsing, validation, fail-closed behaviour and cost estimation all execute
 * exactly as in production. Only the transport is substituted.
 *
 * Payloads are authored from each provider's documented response shape, not
 * captured from live traffic.
 */

import type { Fetcher } from "./openai.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------

export const SYNTHESIS_FIXTURE = {
  output_text:
    "Collectors lose thousands to counterfeit sales because authentication is slow and scarce.",
  usage: {
    input_tokens: 1_200,
    output_tokens: 640,
    input_tokens_details: { cached_tokens: 400 },
  },
};

/** Brief-normalization JSON returned when instructions mention Normalize. */
export const SYNTHESIS_BRIEF_FIXTURE = {
  output_text: JSON.stringify({
    title: "AI RFP Response Assistant",
    audience: "SMB SaaS sales and solutions engineers",
    model: "Seat-based SaaS with usage caps",
    seedKeywords: [
      "rfp response software",
      "security questionnaire automation",
      "proposal management software",
    ],
  }),
  usage: {
    input_tokens: 800,
    output_tokens: 200,
    input_tokens_details: { cached_tokens: 0 },
  },
};

/**
 * Synthesis/scoring JSON shaped for ResearchRecord assembly.
 * Keyword volume/CPC are NEVER included — those come only from keywordData.
 */
export const SYNTHESIS_SCORE_FIXTURE = {
  output_text: JSON.stringify({
    marketSummary:
      "Proposal automation demand is rising as mid-market SaaS vendors face enterprise security reviews without dedicated proposal ops. Spreadsheet workflows do not scale; enterprise suites price out the SMB wedge.",
    stats: [
      {
        claim: "RFP software market CAGR",
        value: "high-teens through mid-2030s",
        citationUrl:
          "https://www.industryresearch.biz/market-reports/request-for-proposal-rfp-software-market-109348",
        citationTitle: "Industry Research Biz — RFP software market",
      },
      {
        claim: "AI RFP response automation market size (directional)",
        value: "low single-digit billions USD (2024 window)",
        citationUrl: "https://dataintelo.com/report/rfp-response-automation-ai-market",
        citationTitle: "DataIntelo — RFP response automation AI",
      },
    ],
    competitors: [
      {
        name: "Loopio",
        pricing: "Foundations from ~$20,000/year (10 seats)",
        url: "https://loopio.com/pricing/",
        notes: "Mature content library aimed at proposal teams",
      },
      {
        name: "Responsive",
        pricing: "Quote-based enterprise",
        url: "https://www.responsive.io/pricing/",
        notes: "Full response-management platform with deep integrations",
      },
      {
        name: "Qvidian",
        pricing: "Enterprise contracts, typically 5-figure annual minimums",
        url: "https://uplandsoftware.com/qvidian/",
        notes: "Long-standing player for large proposal shops",
      },
    ],
    communitySummary:
      "Sales engineers complain about spreadsheet DDQs and ChatGPT hallucinations on security questionnaires.",
    signals: [
      {
        quote: "We burn weekends answering the same SOC2 questionnaire.",
        citationUrl: "https://www.reddit.com/r/sales/",
        citationTitle: "r/sales thread",
      },
      {
        quote: "Loopio is great if you have a proposal team; we do not.",
        citationUrl: "https://news.ycombinator.com/",
        citationTitle: "Hacker News discussion",
      },
    ],
    goToMarket: {
      positioning:
        "Credible first drafts with citations for SaaS teams that outgrew DIY but will never buy Loopio.",
      channels: [
        "Founder-led outreach to SaaS sales engineers on LinkedIn",
        "SEO pages targeting security questionnaire automation searches",
        "Templates shared in RevOps and sales-engineering communities",
      ],
      pricingNotes:
        "Seat-based SaaS: Team $79/mo, Growth $199/mo, Scale $399/mo — undercut enterprise floors by 10x.",
    },
    howItWorks: [
      "Upload past RFPs, security questionnaires, and the win library",
      "Paste or import a new RFP and let the assistant retrieve matching evidence",
      "Review cited draft answers, with low-confidence answers flagged for a human",
      "Export the finished response to Word with a compliance checklist",
    ],
    whyNow:
      "Enterprise security reviews are formalizing across mid-market SaaS while ChatGPT-only answers get blocked by legal. Retrieval-grounded assistants are newly practical on weekend stacks.",
    oneLiner:
      "Grounded RFP drafts with citations for SMB sales teams that cannot afford Loopio.",
    scores: {
      opportunity: 8,
      pain: 9,
      timing: 8,
      builderConfidence: 8,
      execution: 7,
    },
  }),
  usage: {
    input_tokens: 12_000,
    output_tokens: 2_400,
    input_tokens_details: { cached_tokens: 0 },
  },
};

export function fixtureSynthesisFetch(
  overrides: { payload?: unknown; status?: number } = {},
): Fetcher {
  return (async (_input, init) => {
    if (overrides.payload !== undefined || overrides.status !== undefined) {
      return jsonResponse(
        overrides.payload ?? SYNTHESIS_FIXTURE,
        overrides.status ?? 200,
      );
    }
    let instructions = "";
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      instructions =
        typeof body.instructions === "string" ? body.instructions : "";
    } catch {
      instructions = "";
    }
    if (/normalize/i.test(instructions)) {
      return jsonResponse(SYNTHESIS_BRIEF_FIXTURE);
    }
    if (/score|synthesis|research/i.test(instructions)) {
      return jsonResponse(SYNTHESIS_SCORE_FIXTURE);
    }
    return jsonResponse(SYNTHESIS_FIXTURE);
  }) as Fetcher;
}

// ---------------------------------------------------------------------------

export const SEARCH_FIXTURE = {
  choices: [
    {
      message: {
        content:
          "Independent authentication services report multi-week turnaround times.",
      },
    },
  ],
  search_results: [
    {
      url: "https://example.com/collectibles-fraud-report-2026",
      title: "Collectibles fraud report 2026",
      snippet: "Counterfeit losses reached an estimated $1.2B in 2025.",
    },
    {
      url: "https://example.org/authentication-turnaround",
      title: "Authentication turnaround benchmarks",
    },
  ],
  citations: ["https://example.net/market-size"],
  usage: { prompt_tokens: 900, completion_tokens: 380 },
};

export const SEARCH_MARKET_FIXTURE = {
  choices: [
    {
      message: {
        content:
          "RFP software market shows high-teens CAGR through the mid-2030s. AI-augmented response automation is sized in the low single-digit billions USD for 2024 with double-digit growth.",
      },
    },
  ],
  search_results: [
    {
      url: "https://www.industryresearch.biz/market-reports/request-for-proposal-rfp-software-market-109348",
      title: "Industry Research Biz — RFP software market",
      snippet: "High-teens CAGR for RFP / proposal-automation software.",
    },
    {
      url: "https://dataintelo.com/report/rfp-response-automation-ai-market",
      title: "DataIntelo — RFP response automation AI",
      snippet: "Low single-digit billions USD market size in the 2024 window.",
    },
  ],
  usage: { prompt_tokens: 1_100, completion_tokens: 420 },
};

export const SEARCH_COMPETITORS_FIXTURE = {
  choices: [
    {
      message: {
        content:
          "Loopio Foundations from ~$20,000/year. Responsive is quote-based enterprise. Qvidian (Upland) runs 5-figure annual contracts.",
      },
    },
  ],
  search_results: [
    {
      url: "https://loopio.com/pricing/",
      title: "Loopio pricing",
      snippet: "Foundations from ~$20,000/year (10 seats).",
    },
    {
      url: "https://www.responsive.io/pricing/",
      title: "Responsive pricing",
      snippet: "Quote-based enterprise response management.",
    },
    {
      url: "https://uplandsoftware.com/qvidian/",
      title: "Qvidian by Upland",
      snippet: "Enterprise proposal contracts, typically 5-figure minimums.",
    },
  ],
  usage: { prompt_tokens: 1_000, completion_tokens: 400 },
};

export const SEARCH_COMMUNITY_FIXTURE = {
  choices: [
    {
      message: {
        content:
          "Sales engineers report burning weekends on SOC2 questionnaires. Teams say Loopio only works if you already have a proposal ops hire.",
      },
    },
  ],
  search_results: [
    {
      url: "https://www.reddit.com/r/sales/",
      title: "r/sales thread",
      snippet: "We burn weekends answering the same SOC2 questionnaire.",
    },
    {
      url: "https://news.ycombinator.com/",
      title: "Hacker News discussion",
      snippet: "Loopio is great if you have a proposal team; we do not.",
    },
  ],
  usage: { prompt_tokens: 950, completion_tokens: 360 },
};

export function fixtureSearchFetch(
  overrides: { payload?: unknown; status?: number } = {},
): Fetcher {
  return (async (_input, init) => {
    if (overrides.payload !== undefined || overrides.status !== undefined) {
      return jsonResponse(
        overrides.payload ?? SEARCH_FIXTURE,
        overrides.status ?? 200,
      );
    }
    let query = "";
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const content = body.messages?.[0]?.content;
      query = typeof content === "string" ? content : "";
    } catch {
      query = "";
    }
    if (/competitor/i.test(query)) return jsonResponse(SEARCH_COMPETITORS_FIXTURE);
    if (/pain|reddit|community|quote/i.test(query)) {
      return jsonResponse(SEARCH_COMMUNITY_FIXTURE);
    }
    if (/market|CAGR|statistic/i.test(query)) {
      return jsonResponse(SEARCH_MARKET_FIXTURE);
    }
    return jsonResponse(SEARCH_FIXTURE);
  }) as Fetcher;
}

// ---------------------------------------------------------------------------

/** Adapter unit-test fixture (generic shape). */
export const KEYWORD_FIXTURE = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      status_code: 20000,
      result: [
        {
          keyword: "collectible authentication",
          search_volume: 2400,
          competition_index: 34,
          cpc: 1.82,
        },
        {
          keyword: "verify trading card",
          search_volume: 880,
          competition_index: 21,
          cpc: 0.94,
        },
      ],
    },
  ],
};

/** Richer keyword set for the rfp-assistant research fixture pack. */
export const KEYWORD_RFP_FIXTURE = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      status_code: 20000,
      result: [
        {
          keyword: "rfp response software",
          search_volume: 2400,
          competition_index: 42,
          cpc: 18.5,
        },
        {
          keyword: "security questionnaire automation",
          search_volume: 880,
          competition_index: 35,
          cpc: 12.4,
        },
        {
          keyword: "proposal management software",
          search_volume: 1900,
          competition_index: 48,
          cpc: 15.2,
        },
      ],
    },
  ],
};

export function fixtureKeywordFetch(
  overrides: { payload?: unknown; status?: number } = {},
): Fetcher {
  return (async () =>
    jsonResponse(
      overrides.payload ?? KEYWORD_FIXTURE,
      overrides.status ?? 200,
    )) as Fetcher;
}

/** A transport that always throws, for the network-failure paths. */
export function unreachableFetch(): Fetcher {
  return (async () => {
    throw new Error("ECONNREFUSED");
  }) as Fetcher;
}
