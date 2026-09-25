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

import type { SourceTextProvider } from "./sourceText.ts";

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
      "Proposal automation demand is rising as mid-market SaaS vendors face enterprise security reviews without dedicated proposal ops. Spreadsheet workflows do not scale; enterprise suites price out the SMB wedge. The addressable category is RFP/security-questionnaire software for teams under ~50 sellers — not the global SaaS TAM.",
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
      "Sales engineers complain about spreadsheet DDQs and ChatGPT hallucinations on security questionnaires. They want citations from their own win library, not a blank chat box.",
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
      "Ingest — Upload past RFPs, security questionnaires, and the win library",
      "Retrieve — Paste or import a new RFP and match evidence from approved sources",
      "Review — Edit cited draft answers; low-confidence rows flagged for a human",
      "Export — Ship Word/PDF with a compliance checklist",
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
    editorial: {
      productName: "CiteDraft",
      dontBuildYet:
        "Do not build a full enterprise content library, SSO portal farm, or multi-product CRM sync before ten paying teams finish one questionnaire end-to-end.",
      problemNarrative:
        "A five-person SaaS sales team gets a 90-question security packet on Friday. The SE copies answers from three Google Docs, Slack threads, and last year's SOC2 exhibit. ChatGPT invents controls that do not exist. Legal rejects the draft on Monday. Loopio wants a five-figure ACV and a proposal ops hire they do not have. Responsive and Qvidian assume a content team. The leftover work is not typing — it is retrieving approved language with citations under a deadline, with a human still signing the final send. Weekend builders keep shipping chat UIs. Buyers keep paying for weekends of copy-paste. The wedge is a seat-priced assistant that only answers from the win library the team already trusts, flags low-confidence rows, and exports a review trail. If that job is not worth $79–$399/mo to the SE who owns the questionnaire, do not invent a broader platform. SMB SaaS sellers feel this every quarter when a late-stage deal stalls on a security review. The pain is not writing prose; it is proving each claim against approved exhibits without inventing controls. Founders who tried generic copilots burned a weekend and still owed legal a redline. CiteDraft exists because that loop is broken for teams that cannot staff proposal ops.",
      solutionNarrative:
        "CiteDraft is a seat-priced assistant that drafts from the team's own win library with inline citations. Upload once, answer repeatedly, export with a review trail. It is not a chatbot and not an enterprise response platform. The product name stays on the page: CiteDraft, not an AI tool. Ship ingest → retrieve → review → export. Defer SSO sprawl and CRM sync until ten teams finish one questionnaire without opening a side spreadsheet. Every draft row points at a source paragraph the buyer already approved. Low-confidence answers stay blocked until a human confirms. Pricing mirrors Starter, Team, and Scale so the Stripe catalog and the marketing page never disagree. The wedge stays narrow: security questionnaires and RFP sections that already live in the win library, not a new CMS for the whole company.",
      competitiveNarrative:
        "Loopio and Responsive win large proposal-ops budgets; CiteDraft wins SMB SaaS teams that need cited drafts without a five-figure ACV. Qvidian assumes a content team CiteDraft customers do not have. Generic chat tools invent answers; CiteDraft refuses to send without a source. The opportunity is the seat-priced middle: cheaper than enterprise suites, stricter than ChatGPT, scoped to the questionnaire job.",
      pricingTiers: [
        {
          name: "Starter",
          price: "$79/mo",
          includes: "3 seats, 1 workspace library, cited drafts",
        },
        {
          name: "Team",
          price: "$199/mo",
          includes: "10 seats, review workflow, export packs",
        },
        {
          name: "Scale",
          price: "$399/mo",
          includes: "Unlimited seats under fair-use, SSO later",
        },
      ],
      unitEconomics: [
        { label: "CiteDraft LLM cost per questionnaire", value: "$0.40–1.20" },
        { label: "CiteDraft target gross margin Team", value: "~75%" },
        { label: "CiteDraft CAC payback", value: "under 2 months at $199" },
      ],
      audienceShort: "SMB SaaS sales teams",
      brandBrief:
        "CiteDraft should read like a careful sales engineer: calm, exact, and a little dry. The mark signals a footnote or a checked source, never a sparkle or chat bubble. Use one ink-blue accent on paper white. Copy names the questionnaire, the deadline, and the approved exhibit; it never promises that AI writes the answer for you.",
      yearOne: {
        funnel: [
          { stage: "SE leads sourced from RevOps communities and LinkedIn", count: 400 },
          { stage: "teams upload a real questionnaire in the trial", count: 60 },
          { stage: "teams pay after their first export", count: 15 },
        ],
        tier: "Team",
        payingAccounts: 15,
        monthlyRevenuePerAccount: 199,
        assumptions:
          "Assumes a 15% trial rate from warm community outreach and a 25% trial-to-paid rate once a team exports one cited questionnaire.",
      },
      dataModel: [
        {
          table: "library_documents",
          columns: "id, workspace_id fk, title text, body text, approved_by uuid, approved_at timestamptz",
        },
        {
          table: "questionnaires",
          columns: "id, workspace_id fk, buyer text, due_at timestamptz, status text check status in ('draft','review','exported')",
        },
        {
          table: "answers",
          columns: "id, questionnaire_id fk, question text, draft text, confidence numeric, reviewer_id uuid null",
        },
        {
          table: "answer_citations",
          columns: "id, answer_id fk, library_document_id fk, span text",
        },
      ],
      stackNotes:
        "CiteDraft runs Next.js + Postgres + embeddings over the win library. Stripe seats for Starter/Team/Scale. No custom deploy plane. Meter tokens per workspace from week one so Team margins stay visible.",
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
          "RFP software market shows high-teens CAGR through the mid-2030s [1]. AI-augmented response automation is sized in the low single-digit billions USD for 2024 with double-digit growth [2].",
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
          "Loopio Foundations from ~$20,000/year [1]. Responsive is quote-based enterprise [2]. Qvidian (Upland) runs 5-figure annual contracts [3].",
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
          "Sales engineers report burning weekends on SOC2 questionnaires [1]. Teams say Loopio only works if you already have a proposal ops hire [2].",
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

/**
 * Fixture page text for quote verification: the community snippets stand in
 * for the cited threads, so fixture quotes verify with no network.
 */
export function fixtureSourceText(
  pages: Record<string, string> = Object.fromEntries(
    SEARCH_COMMUNITY_FIXTURE.search_results.map((r) => [r.url, r.snippet]),
  ),
): SourceTextProvider {
  return {
    async fetchText(url: string): Promise<string> {
      const text = pages[url];
      if (text === undefined) throw new Error(`fixture: no page for ${url}`);
      return text;
    },
  };
}
