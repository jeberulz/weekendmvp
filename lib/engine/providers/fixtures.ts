/**
 * Fixture transports for the idea-engine providers (fixture mode only).
 *
 * Every fixture is a `fetch`-shaped function, so the adapter under test is
 * the real adapter: parsing, validation, fail-closed behaviour and cost
 * estimation run exactly as in live mode; only the transport is replaced.
 * Nothing here touches the network or needs a key.
 *
 * The research fixture (brief engine/briefs/rfp-assistant.json) is
 * SYNTHETIC: fictional vendors on reserved `.example` hosts, a synthetic
 * market report and survey, and HN-style and forum threads written for this
 * file. No third-party text is copied, so a fixture record never puts words
 * or prices in a real company's mouth. Runs are explicitly fixture mode.
 *
 * How the fixture stays deterministic without hard-coded evidence ids:
 *   - search packs and source pages are static (FIXTURE_PAGES);
 *   - the extraction reply is static (FIXTURE_EXTRACTION): candidates copied
 *     from those pages, plus two that acceptance must reject;
 *   - the editorial reply is a template (FIXTURE_EDITORIAL_TEMPLATE) whose
 *     placeholders `{{id|tok|vendor:stat|price|quote:N}}` resolve against the
 *     accepted bundle in the request itself (the Nth item of that kind, in
 *     bundle order), so ids follow whatever acceptance produced. An index
 *     that is not in the bundle stays unresolved and the record parse fails.
 * Tests replace any part through the override options below.
 */

import {
  BRIEF_INSTRUCTIONS,
  EDITORIAL_INSTRUCTIONS,
  EXTRACTION_INSTRUCTIONS,
  readEditorialEvidence,
  type EditorialEvidenceItem,
} from "../pipeline.ts";
import type { ExtractionCandidates } from "../evidence/contract.ts";
import type { Fetcher } from "./openai.ts";
import type { SourceTextProvider } from "./sourceText.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestBody(init: RequestInit | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    // A body that is not JSON routes to the generic fixture.
    return {};
  }
}

// ---------------------------------------------------------------------------
// The research fixture: brief, URLs and synthetic pages
// ---------------------------------------------------------------------------

/** The only brief the fixture data describes (engine/briefs/rfp-assistant.json). */
export const FIXTURE_BRIEF_SLUG = "ai-rfp-response-assistant";

export const FIXTURE_URLS = {
  marketReport: "https://research.example.com/rfp-response-software-market-2025",
  workloadSurvey: "https://analyst.example.org/security-questionnaire-workload-survey",
  bidwell: "https://bidwell.example/pricing",
  answerdeck: "https://answerdeck.example/pricing",
  rfpforge: "https://rfpforge.example/pricing",
  hnThread: "https://news.example.com/item?id=4101",
  forumThread: "https://forum.example.net/t/security-questionnaires-every-quarter/88",
  redditThread: "https://www.reddit.com/r/sales/comments/abc123/rfp_weekends/",
  supplementThread: "https://forum.example.net/t/questionnaire-portals/203",
} as const;

/**
 * Synthetic page text per cited URL (written for this fixture). The Reddit
 * thread is deliberately absent: it reads as unreadable, like a 403.
 */
export const FIXTURE_PAGES: Readonly<Record<string, string>> = {
  [FIXTURE_URLS.marketReport]: [
    "RFP response software market report",
    "Published in 2025 by a synthetic research desk for engine fixtures.",
    "The RFP response software market was valued at $1.9 billion in 2024.",
    "The RFP response software market is projected to reach $5.6 billion by 2032.",
    "Mid-market vendors account for most new deployments.",
  ].join("\n"),
  [FIXTURE_URLS.workloadSurvey]: [
    "Survey of B2B SaaS sales teams",
    "In 2025, 64% of B2B SaaS sales teams answered at least one security questionnaire per month.",
    "Respondents named spreadsheets as their main tool for reusing answers.",
  ].join("\n"),
  [FIXTURE_URLS.bidwell]: [
    "Bidwell pricing",
    "Starter",
    "$49/user/month, billed annually",
    "Up to 3 active RFPs.",
    "Business",
    "$99/user/month, billed annually",
    "Unlimited RFPs and SSO.",
    "Enterprise",
    "Contact sales",
  ].join("\n"),
  [FIXTURE_URLS.answerdeck]: [
    "AnswerDeck plans",
    "Team",
    "$399/month",
    "Unlimited users, 10 projects.",
    "Scale",
    "$899/month",
    "Unlimited projects and an answer library API.",
  ].join("\n"),
  [FIXTURE_URLS.rfpforge]: [
    "RFPForge pricing",
    "Solo",
    "$29/month",
    "One seat and one library.",
    "Team",
    "$25/user/month",
    "Shared library and review workflow.",
  ].join("\n"),
  [FIXTURE_URLS.hnThread]: [
    "Ask: how do small sales teams handle RFPs and security questionnaires?",
    "reply: We burn weekends answering the same security questionnaire for every enterprise deal.",
    "reply: Our answers live in five spreadsheets and nobody knows which version legal approved.",
    "reply: The big proposal tools assume you have a proposal team, and we are three sales engineers.",
  ].join("\n"),
  [FIXTURE_URLS.forumThread]: [
    "Topic: Security questionnaires every quarter",
    "I paste the same SOC 2 answers into a new portal every quarter and still miss a question.",
    "Generic chat tools invent controls we do not have, so legal rejects the draft.",
  ].join("\n"),
  [FIXTURE_URLS.supplementThread]: [
    "Topic: Questionnaire portals",
    "Every buyer uses a different portal, so we retype the same approved answers again and again.",
    "The answers exist, but finding the version legal signed off on takes longer than writing them.",
  ].join("\n"),
};

/** Named source-page sets for fixture briefs (engine/briefs/*.json `fixtureScenario`). */
export type FixtureScenario = "default" | "thin-evidence";

export const FIXTURE_SCENARIOS: readonly FixtureScenario[] = ["default", "thin-evidence"];

/**
 * Pages for a scenario. "thin-evidence" makes every community page
 * unreadable, so acceptance finds no quote and the run stops before keyword
 * and editorial spend (a deliberate failure, with a run report).
 */
export function fixtureScenarioPages(scenario: FixtureScenario): Record<string, string> {
  const pages = { ...FIXTURE_PAGES };
  if (scenario === "thin-evidence") {
    delete pages[FIXTURE_URLS.hnThread];
    delete pages[FIXTURE_URLS.forumThread];
    delete pages[FIXTURE_URLS.supplementThread];
  }
  return pages;
}

/** Reads fixture pages by exact cited URL; an absent page throws (unreadable). */
export function fixtureSourceText(pages: Readonly<Record<string, string>> = FIXTURE_PAGES): SourceTextProvider {
  return {
    async fetchText(url: string): Promise<string> {
      const text = pages[url];
      if (text === undefined) throw new Error(`fixture: no page for ${url}`);
      return text;
    },
  };
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

/** Generic synthesis reply (adapter tests). */
export const SYNTHESIS_FIXTURE = {
  output_text: "Collectors lose money to counterfeit sales because authentication is slow and scarce.",
  usage: {
    input_tokens: 1_200,
    output_tokens: 640,
    input_tokens_details: { cached_tokens: 400 },
  },
};

/** Brief normalization reply for the RFP assistant brief. */
export const SYNTHESIS_BRIEF_FIXTURE = {
  output_text: JSON.stringify({
    title: "AI RFP Response Assistant",
    audience: "SMB SaaS sales and solutions engineers",
    model: "Seat-based SaaS with usage caps",
    seedKeywords: ["rfp response software", "security questionnaire automation", "proposal management software"],
  }),
  usage: {
    input_tokens: 800,
    output_tokens: 200,
    input_tokens_details: { cached_tokens: 0 },
  },
};

const EXTRACTION_USAGE = { input_tokens: 9_000, output_tokens: 1_800, input_tokens_details: { cached_tokens: 0 } };
const EDITORIAL_USAGE = { input_tokens: 12_000, output_tokens: 4_000, input_tokens_details: { cached_tokens: 0 } };

/**
 * The saved extraction reply: spans copied from FIXTURE_PAGES, plus two
 * candidates acceptance must reject (a paraphrase that is not on its page,
 * and a quote from the unreadable Reddit thread).
 */
export const FIXTURE_EXTRACTION: ExtractionCandidates = {
  quotes: [
    {
      sourceUrl: FIXTURE_URLS.hnThread,
      text: "We burn weekends answering the same security questionnaire for every enterprise deal.",
    },
    {
      sourceUrl: FIXTURE_URLS.hnThread,
      text: "Our answers live in five spreadsheets and nobody knows which version legal approved.",
    },
    {
      sourceUrl: FIXTURE_URLS.forumThread,
      text: "Generic chat tools invent controls we do not have, so legal rejects the draft.",
    },
    {
      sourceUrl: FIXTURE_URLS.forumThread,
      text: "Security reviews take weeks and quietly kill our enterprise deals.",
    },
    {
      sourceUrl: FIXTURE_URLS.redditThread,
      text: "Every RFP season I lose a full week to copy and paste.",
    },
  ],
  marketStats: [
    {
      sourceUrl: FIXTURE_URLS.marketReport,
      supportingText: "The RFP response software market was valued at $1.9 billion in 2024.",
      subject: "RFP response software market",
      metric: "market_size",
      amountText: "$1.9 billion",
      year: 2024,
      periodKind: "measured",
    },
    {
      sourceUrl: FIXTURE_URLS.marketReport,
      supportingText: "The RFP response software market is projected to reach $5.6 billion by 2032.",
      subject: "RFP response software market",
      metric: "market_size",
      amountText: "$5.6 billion",
      year: 2032,
      periodKind: "projected",
    },
    {
      sourceUrl: FIXTURE_URLS.workloadSurvey,
      supportingText: "In 2025, 64% of B2B SaaS sales teams answered at least one security questionnaire per month.",
      subject: "B2B SaaS sales teams answering security questionnaires",
      metric: "adoption",
      amountText: "64%",
      year: 2025,
      periodKind: "measured",
    },
  ],
  competitorPrices: [
    {
      vendor: "Bidwell",
      sourceUrl: FIXTURE_URLS.bidwell,
      supportingText: "Starter\n$49/user/month, billed annually",
      plan: "Starter",
      priceText: "$49/user/month, billed annually",
    },
    {
      vendor: "AnswerDeck",
      sourceUrl: FIXTURE_URLS.answerdeck,
      supportingText: "Team\n$399/month",
      plan: "Team",
      priceText: "$399/month",
    },
    {
      vendor: "RFPForge",
      sourceUrl: FIXTURE_URLS.rfpforge,
      supportingText: "Team\n$25/user/month",
      plan: "Team",
      priceText: "$25/user/month",
    },
  ],
};

/**
 * The saved editorial reply. Fact-bearing fields carry figures only through
 * resolved `{{tok:…}}` tokens; proposal fields (tiers, yearOne, unit
 * economics) hold the product's own assumptions.
 */
export const FIXTURE_EDITORIAL_TEMPLATE = {
  oneLiner: "Cited first drafts of RFPs and security questionnaires for SaaS sales teams without a proposal team.",
  marketSummary:
    "Response software for RFPs and security questionnaires is a measurable niche rather than a slice of the whole SaaS market. The category was valued at {{tok:stat:0}}, and analysts project it to reach {{tok:stat:1}}. The workload is broad as well: {{tok:stat:2}} of B2B SaaS sales teams answer at least one security questionnaire a month. The opening is the small team that answers the same questions every quarter without a proposal manager, a buyer the enterprise suites price out.",
  marketStatIds: ["{{id:stat:0}}", "{{id:stat:1}}", "{{id:stat:2}}"],
  competitors: [
    {
      name: "{{vendor:price:0}}",
      priceIds: ["{{id:price:0}}"],
      notes:
        "Per-seat pricing at {{tok:price:0}} suits companies that already run a formal proposal process with several contributors and a curated library.",
    },
    {
      name: "{{vendor:price:1}}",
      priceIds: ["{{id:price:1}}"],
      notes:
        "A flat team price of {{tok:price:1}} with unlimited users favors larger response teams over a single sales engineer answering questionnaires between calls.",
    },
    {
      name: "{{vendor:price:2}}",
      priceIds: ["{{id:price:2}}"],
      notes:
        "Its team seat at {{tok:price:2}} is the cheapest entry point, but the library is a shared document store rather than cited, approved answers.",
    },
  ],
  communitySummary:
    "Sales engineers describe the same loop: answers live in scattered spreadsheets, legal cannot tell which version was approved, and generic chat tools invent controls. One put the time cost plainly: {{tok:quote:0}} Another described the version problem: {{tok:quote:1}} A third explained why generic assistants fail legal review: {{tok:quote:2}}",
  quoteIds: ["{{id:quote:0}}", "{{id:quote:1}}", "{{id:quote:2}}"],
  goToMarket: {
    positioning:
      "Cited first drafts for SaaS sales teams that outgrew spreadsheets but will never staff a proposal team, sold on trust and setup time rather than feature breadth.",
    channels: [
      "Founder-led outreach to sales engineers on LinkedIn",
      "Search pages for security questionnaire automation",
      "Answer templates shared in RevOps communities",
    ],
    pricingNotes:
      "Price below the per-seat incumbents, such as {{tok:price:0}}, and offer a flat solo plan so a single sales engineer can start without procurement or a proposal manager.",
  },
  whyNow:
    "Enterprise buyers now send security questionnaires earlier in the sales cycle, and legal teams increasingly reject answers that cannot be traced to an approved source. Retrieval with citations is newly practical on a weekend-sized stack.",
  howItWorks: [
    "Ingest — Upload past RFPs, questionnaires and approved policy documents into one answer library.",
    "Retrieve — Import a new questionnaire and match each question to approved answers with their sources.",
    "Review — Edit the cited drafts; answers without a source stay blocked until a reviewer approves them.",
    "Export — Send the completed questionnaire as a document with a review trail for legal.",
  ],
  scores: { opportunity: 8, pain: 9, timing: 8, builderConfidence: 7, execution: 7 },
  editorial: {
    productName: "CiteDraft",
    dontBuildYet:
      "Do not build a full content library, an SSO portal or CRM sync before ten paying teams finish one questionnaire end to end.",
    problemNarrative:
      "Sales engineers at small SaaS companies are the people who answer RFPs and security questionnaires, usually on top of their quota. Every enterprise deal brings a new portal, a new spreadsheet and the same questions about access control, encryption and incident response. The answers already exist, but they are scattered across old questionnaires, policy documents and chat threads, and nobody can tell which version legal approved. Generic chat assistants make the problem worse because they invent controls the company does not have, so legal rejects the draft and the deadline slips. The enterprise response suites solve this for companies with a proposal team, but their pricing and setup assume a dedicated owner the small team does not have. The work that hurts is not typing; it is finding approved language, proving where it came from and getting it past legal before the deal stalls.",
    solutionNarrative:
      "CiteDraft is a cited drafting assistant for RFPs and security questionnaires. A team uploads its past answers and approved policy documents once; for every new questionnaire, CiteDraft matches each question to approved language and drafts an answer that links to its source paragraph. Answers without a source stay blocked until a reviewer approves them, so nothing invented reaches the buyer. The first version is deliberately narrow: one answer library per workspace, cited drafts, a review queue and a clean export with a review trail for legal.",
    competitiveNarrative:
      "Bidwell, AnswerDeck and RFPForge sell broad response platforms priced per seat or per team, built around a proposal manager who curates a large library. CiteDraft competes for the team that has no such role: it starts from documents the team already trusts, cites every answer and refuses to send anything it cannot source. The wedge is trust and setup time rather than breadth.",
    pricingTiers: [
      { name: "Solo", price: "$39/month", includes: "One seat, one answer library and cited drafts." },
      { name: "Team", price: "$25/seat/month", includes: "Shared library, review workflow and export packs for up to 10 seats." },
    ],
    unitEconomics: [
      { label: "Model cost per questionnaire", value: "$0.60 per 100 questions" },
      { label: "Target gross margin on Team", value: "about 80%" },
      { label: "Payback on founder-led sales", value: "under 3 months" },
    ],
    stackNotes:
      "Next.js App Router with Postgres and pgvector for the answer library, a background queue for document parsing, and Stripe seats for the Team plan. Keep every draft answer linked to its source paragraph id so the review trail and the export come from the same data.",
    audienceShort: "SaaS sales teams",
    brandBrief:
      "CiteDraft should read like a careful sales engineer: calm, exact and a little dry. The mark signals a footnote or a checked source, never a sparkle or a chat bubble. Use one ink-blue accent on paper white, and let copy name the questionnaire, the deadline and the approved document rather than promising that AI writes the answer.",
    yearOne: {
      funnel: [
        { stage: "Sales engineers reached through RevOps communities and LinkedIn", count: 400 },
        { stage: "Teams that upload a real questionnaire during a trial", count: 60 },
        { stage: "Team accounts paying after their first export", count: 15 },
      ],
      tier: "Team",
      payingAccounts: 15,
      seatsPerAccount: 4,
      assumptions:
        "Assumes a 15% trial rate from warm outreach and a 25% trial-to-paid rate once a team exports one cited questionnaire.",
    },
    dataModel: [
      { table: "library_documents", columns: "id, workspace_id fk, title text, body text, approved_by uuid, approved_at timestamptz" },
      { table: "questionnaires", columns: "id, workspace_id fk, buyer text, due_at timestamptz, status text check (status in ('draft','review','exported'))" },
      { table: "answers", columns: "id, questionnaire_id fk, question text, draft text, reviewer_id uuid null" },
      { table: "answer_citations", columns: "id, answer_id fk, library_document_id fk, span text" },
    ],
  },
};

const PLACEHOLDER_RE = /\{\{(id|tok|vendor):(stat|price|quote):(\d+)\}\}/g;
const PLACEHOLDER_KIND = { stat: "market_stat", price: "competitor_price", quote: "community_quote" } as const;

function resolveString(text: string, evidence: ReadonlyArray<EditorialEvidenceItem>): string {
  return text.replace(PLACEHOLDER_RE, (placeholder: string, what: string, kind: string, index: string) => {
    const wanted = kind === "stat" || kind === "price" || kind === "quote" ? PLACEHOLDER_KIND[kind] : null;
    const item = evidence.filter((e) => e.kind === wanted)[Number(index)];
    if (!item) return placeholder;
    if (what === "id") return item.id;
    if (what === "tok") return `[[ev:${item.id}]]`;
    return item.vendor ?? placeholder;
  });
}

/** Resolve a template's placeholders against an accepted bundle (deep copy). */
export function resolveEditorialTemplate(template: unknown, evidence: ReadonlyArray<EditorialEvidenceItem>): unknown {
  if (typeof template === "string") return resolveString(template, evidence);
  if (Array.isArray(template)) return template.map((value) => resolveEditorialTemplate(value, evidence));
  if (isPlainObject(template)) {
    return Object.fromEntries(Object.entries(template).map(([key, value]) => [key, resolveEditorialTemplate(value, evidence)]));
  }
  return template;
}

/** The default editorial reply for a bundle. */
export function fixtureEditorialReply(evidence: ReadonlyArray<EditorialEvidenceItem>): unknown {
  return resolveEditorialTemplate(FIXTURE_EDITORIAL_TEMPLATE, evidence);
}

/** A reply body: an object is sent as JSON text; a string is sent as is (to test non-JSON replies). */
export type FixtureReply = unknown;

export type FixtureSynthesisOptions = {
  /** Fixed payload for every request (adapter tests). */
  payload?: unknown;
  status?: number;
  /** Extraction reply from the request input (default FIXTURE_EXTRACTION). */
  extraction?: (input: string) => FixtureReply;
  /** Editorial reply from the accepted bundle in the request. */
  editorial?: (evidence: EditorialEvidenceItem[], input: string) => FixtureReply;
};

function replyText(reply: FixtureReply): string {
  return typeof reply === "string" ? reply : JSON.stringify(reply);
}

export function fixtureSynthesisFetch(overrides: FixtureSynthesisOptions = {}): Fetcher {
  return (async (_input, init) => {
    if (overrides.payload !== undefined || overrides.status !== undefined) {
      return jsonResponse(overrides.payload ?? SYNTHESIS_FIXTURE, overrides.status ?? 200);
    }
    const body = requestBody(init);
    const instructions = typeof body.instructions === "string" ? body.instructions : "";
    const input = typeof body.input === "string" ? body.input : "";
    if (instructions === BRIEF_INSTRUCTIONS || /normalize/i.test(instructions)) {
      return jsonResponse(SYNTHESIS_BRIEF_FIXTURE);
    }
    if (instructions === EXTRACTION_INSTRUCTIONS) {
      const reply = overrides.extraction ? overrides.extraction(input) : FIXTURE_EXTRACTION;
      return jsonResponse({ output_text: replyText(reply), usage: EXTRACTION_USAGE });
    }
    if (instructions === EDITORIAL_INSTRUCTIONS) {
      const evidence = readEditorialEvidence(input) ?? [];
      const reply = (overrides.editorial ?? fixtureEditorialReply)(evidence, input);
      return jsonResponse({ output_text: replyText(reply), usage: EDITORIAL_USAGE });
    }
    return jsonResponse(SYNTHESIS_FIXTURE);
  }) as Fetcher;
}

// ---------------------------------------------------------------------------
// Search (Perplexity response shape)
// ---------------------------------------------------------------------------

/** Generic search reply (adapter tests). */
export const SEARCH_FIXTURE = {
  choices: [{ message: { content: "Independent authentication services report multi-week turnaround times." } }],
  search_results: [
    {
      url: "https://example.com/collectibles-fraud-report-2026",
      title: "Collectibles fraud report 2026",
      snippet: "Counterfeit losses reached an estimated $1.2B in 2025.",
    },
    { url: "https://example.org/authentication-turnaround", title: "Authentication turnaround benchmarks" },
  ],
  citations: ["https://example.net/market-size"],
  usage: { prompt_tokens: 900, completion_tokens: 380 },
};

/**
 * Search answers carry claims no page supports (prose is never evidence):
 * the pipeline must drop them, which the F1 tests check.
 */
export const SEARCH_MARKET_FIXTURE = {
  choices: [
    {
      message: {
        content:
          "Analysts say proposal teams spend 40 hours per RFP [1]. The response software category grows at a high-teens CAGR [2].",
      },
    },
  ],
  search_results: [
    { url: FIXTURE_URLS.marketReport, title: "RFP response software market report 2025", snippet: "Synthetic market report." },
    { url: FIXTURE_URLS.workloadSurvey, title: "Security questionnaire workload survey", snippet: "Synthetic survey." },
  ],
  usage: { prompt_tokens: 1_100, completion_tokens: 420 },
};

export const SEARCH_COMPETITORS_FIXTURE = {
  choices: [
    {
      message: {
        content: "Bidwell starts at $19/user/month [1]. AnswerDeck is quote-based [2]. RFPForge is free for solo users [3].",
      },
    },
  ],
  search_results: [
    { url: FIXTURE_URLS.bidwell, title: "Bidwell pricing", snippet: "Plans for proposal teams." },
    { url: FIXTURE_URLS.answerdeck, title: "AnswerDeck plans", snippet: "Team and Scale plans." },
    { url: FIXTURE_URLS.rfpforge, title: "RFPForge pricing", snippet: "Solo and Team plans." },
  ],
  usage: { prompt_tokens: 1_000, completion_tokens: 400 },
};

export const SEARCH_COMMUNITY_FIXTURE = {
  choices: [
    {
      message: {
        content:
          "Sales engineers say questionnaires eat 30% of their week [1]. One team reports losing 12 deals a year to slow security reviews [2].",
      },
    },
  ],
  search_results: [
    { url: FIXTURE_URLS.hnThread, title: "Ask: how do small teams handle RFPs?", snippet: "Thread about RFP workload." },
    { url: FIXTURE_URLS.forumThread, title: "Security questionnaires every quarter", snippet: "Forum thread." },
    { url: FIXTURE_URLS.redditThread, title: "r/sales: RFP weekends", snippet: "Reddit thread." },
  ],
  usage: { prompt_tokens: 950, completion_tokens: 360 },
};

/** The non-Reddit supplement search. */
export const SEARCH_SUPPLEMENT_FIXTURE = {
  choices: [{ message: { content: "Teams describe retyping answers into buyer portals [1]." } }],
  search_results: [
    { url: FIXTURE_URLS.supplementThread, title: "Questionnaire portals", snippet: "Forum thread about portals." },
  ],
  usage: { prompt_tokens: 950, completion_tokens: 300 },
};

export type FixtureSearchPacks = Partial<Record<"market" | "competitors" | "community" | "supplement", unknown>>;

export function fixtureSearchFetch(
  overrides: { payload?: unknown; status?: number; packs?: FixtureSearchPacks } = {},
): Fetcher {
  return (async (_input, init) => {
    if (overrides.payload !== undefined || overrides.status !== undefined) {
      return jsonResponse(overrides.payload ?? SEARCH_FIXTURE, overrides.status ?? 200);
    }
    const body = requestBody(init);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const first: unknown = messages[0];
    const query = isPlainObject(first) && typeof first.content === "string" ? first.content : "";
    const packs = overrides.packs ?? {};
    if (/Earlier community citations were mostly unreadable/i.test(query)) {
      return jsonResponse(packs.supplement ?? SEARCH_SUPPLEMENT_FIXTURE);
    }
    if (/competitor/i.test(query)) return jsonResponse(packs.competitors ?? SEARCH_COMPETITORS_FIXTURE);
    if (/pain|reddit|community|quote/i.test(query)) return jsonResponse(packs.community ?? SEARCH_COMMUNITY_FIXTURE);
    if (/market|CAGR|statistic/i.test(query)) return jsonResponse(packs.market ?? SEARCH_MARKET_FIXTURE);
    return jsonResponse(SEARCH_FIXTURE);
  }) as Fetcher;
}

// ---------------------------------------------------------------------------
// Keyword data (DataForSEO response shape)
// ---------------------------------------------------------------------------

/** Adapter unit-test fixture (generic shape). */
export const KEYWORD_FIXTURE = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      status_code: 20000,
      result: [
        { keyword: "collectible authentication", search_volume: 2400, competition_index: 34, cpc: 1.82 },
        { keyword: "verify trading card", search_volume: 880, competition_index: 21, cpc: 0.94 },
      ],
    },
  ],
};

/** Keyword set for the RFP-assistant research fixture. */
export const KEYWORD_RFP_FIXTURE = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      status_code: 20000,
      result: [
        { keyword: "rfp response software", search_volume: 2400, competition_index: 42, cpc: 18.5 },
        { keyword: "security questionnaire automation", search_volume: 880, competition_index: 35, cpc: 12.4 },
        { keyword: "proposal management software", search_volume: 1900, competition_index: 48, cpc: 15.2 },
      ],
    },
  ],
};

export function fixtureKeywordFetch(overrides: { payload?: unknown; status?: number } = {}): Fetcher {
  return (async () => jsonResponse(overrides.payload ?? KEYWORD_FIXTURE, overrides.status ?? 200)) as Fetcher;
}

/** A transport that always throws, for the network-failure paths. */
export function unreachableFetch(): Fetcher {
  return (async () => {
    throw new Error("ECONNREFUSED");
  }) as Fetcher;
}
