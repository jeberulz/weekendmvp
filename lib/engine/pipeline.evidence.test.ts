/**
 * Evidence-first pipeline (WP54-S3; plan §6 F5 and §7 F1): what reaches the
 * writer, what reaches the record, retries and regenerations, the early
 * stop and spend. Every run is the complete fixture pipeline (search →
 * acquisition → extraction → acceptance → keywords → editorial → v2 parse)
 * on hermetic fixture providers; no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CostCapExceededError, worstCaseMicroUsd } from "./cost.ts";
import { acceptEvidence } from "./evidence/accept.ts";
import type { AcceptedEvidence, QuoteCandidate } from "./evidence/contract.ts";
import { findQuotedSpans, findUnboundFigures } from "./evidence/tokens.ts";
import {
  buildEditorialInput,
  editorialIssuesSection,
  EDITORIAL_INSTRUCTIONS,
  EDITORIAL_ISSUES_HEADING,
  EXTRACTION_INSTRUCTIONS,
  EXTRACTION_REASK,
  normalizeBriefInput,
  PipelineError,
  runResearch,
  stepInputBudgetBytes,
  type BriefInput,
  type EditorialEvidenceItem,
  type RunResearchOptions,
} from "./pipeline.ts";
import { buildExtractionSources, EXCERPT_GAP, utf8Bytes, vendorHintsFromCitations, type ExtractionSource } from "./pipeline-sources.ts";
import { stepById } from "./pipeline-steps.ts";
import {
  extractionWith,
  f1ProviderOptions,
  F5_PACKS,
  F5_PAGES,
  F5_ROWS,
  packsWith,
  REJECTED_FRAGMENTS,
} from "./__fixtures__/scenarios.ts";
import {
  createFixtureProviders,
  FIXTURE_EXTRACTION,
  FIXTURE_PAGES,
  FIXTURE_URLS,
  fixtureEditorialReply,
  type FixtureProviderOptions,
} from "./providers/fixtures.ts";
import { ProviderCallError, type EngineProviders, type SynthesisRequest } from "./providers/types.ts";
import { parseResearchRecord, type KeywordRow } from "./research-record.ts";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const BRIEF: BriefInput = JSON.parse(
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../engine/briefs/fixtures/rfp-assistant.json"), "utf8"),
);

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Json {
  const copy: unknown = JSON.parse(JSON.stringify(value));
  if (!isRecord(copy)) throw new Error("expected a JSON object");
  return copy;
}

type Harness = {
  providers: EngineProviders;
  synthesis: SynthesisRequest[];
  searches: string[];
  keywordLookups: number;
};

/** Fixture providers that count every call. */
function harness(options: FixtureProviderOptions = {}): Harness {
  const providers = createFixtureProviders(options);
  const h: Harness = { providers, synthesis: [], searches: [], keywordLookups: 0 };
  const synthesis = providers.synthesis;
  const search = providers.search;
  const keywordData = providers.keywordData;
  providers.synthesis = {
    ...synthesis,
    complete: (request) => {
      h.synthesis.push(request);
      return synthesis.complete(request);
    },
  };
  providers.search = {
    ...search,
    search: (request) => {
      h.searches.push(request.query);
      return search.search(request);
    },
  };
  providers.keywordData = {
    ...keywordData,
    lookup: (request) => {
      h.keywordLookups += 1;
      return keywordData.lookup(request);
    },
  };
  return h;
}

const editorialRequests = (h: Harness) => h.synthesis.filter((r) => r.instructions === EDITORIAL_INSTRUCTIONS);
const extractionRequests = (h: Harness) => h.synthesis.filter((r) => r.instructions === EXTRACTION_INSTRUCTIONS);

function run(h: Harness, extra: Partial<RunResearchOptions> = {}) {
  return runResearch({ brief: BRIEF, providers: h.providers, mode: "fixture", ...extra });
}

async function failureOf(promise: Promise<unknown>): Promise<PipelineError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof PipelineError)) throw new Error(`expected a PipelineError, got ${String(error)}`);
  return error;
}

/** Editorial replies in order (the last one repeats). */
function editorialSequence(...replies: Array<(evidence: EditorialEvidenceItem[]) => unknown>) {
  let call = 0;
  return (evidence: EditorialEvidenceItem[]) => {
    const reply = replies[Math.min(call, replies.length - 1)];
    call += 1;
    return reply ? reply(evidence) : fixtureEditorialReply(evidence);
  };
}

function defaultReply(evidence: EditorialEvidenceItem[]): Json {
  return toRecord(fixtureEditorialReply(evidence));
}

function idsOf(evidence: EditorialEvidenceItem[], kind: EditorialEvidenceItem["kind"]): string[] {
  return evidence.filter((e) => e.kind === kind).map((e) => e.id);
}

function forge(id: string): string {
  return `${id.slice(0, -1)}${id.endsWith("0") ? "1" : "0"}`;
}

// ---------------------------------------------------------------------------
// F1: rejected evidence never reaches the writer or the record
// ---------------------------------------------------------------------------

function f1Harness(options: FixtureProviderOptions = {}): Harness {
  return harness(f1ProviderOptions(options));
}

function legacyNarratives(): string[] {
  const legacy = JSON.parse(
    readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../engine/records/ai-rfp-response-assistant.json"),
      "utf8",
    ),
  );
  if (!isRecord(legacy) || !isRecord(legacy.editorial) || !isRecord(legacy.market) || !isRecord(legacy.community)) {
    throw new Error("unexpected legacy record shape");
  }
  return [legacy.editorial.problemNarrative, legacy.market.summary, legacy.community.summary, legacy.whyNow].map((text) =>
    String(text).slice(0, 80),
  );
}

describe("F1: the writer sees accepted evidence only", () => {
  it("keeps rejected claims, search prose, unaccepted page text and old narratives out of the editorial input", async () => {
    const h = f1Harness();
    const { record } = await run(h);
    const requests = editorialRequests(h);
    expect(requests).toHaveLength(1);
    const input = requests[0]?.input ?? "";

    // Rejected candidates (not on the page, unreadable page, failed acceptance).
    for (const fragment of REJECTED_FRAGMENTS) expect(input).not.toContain(fragment);
    // The default fixture's own rejected candidates.
    expect(input).not.toContain("quietly kill our enterprise deals");
    expect(input).not.toContain("Every RFP season");
    // Search answer prose from every pack.
    expect(input).not.toContain("40 hours per RFP");
    expect(input).not.toContain("$19/user/month");
    expect(input).not.toContain("questionnaires eat 30%");
    expect(input).not.toContain("One commenter reviews");
    // Page text that no accepted excerpt holds, and the extraction output.
    for (const fragment of ["Mid-market vendors account", "Unlimited RFPs and SSO", "Respondents named spreadsheets", "Topic: review load"]) {
      expect(input).not.toContain(fragment);
    }
    for (const key of ["supportingText", "priceText", "amountText", "## Sources"]) expect(input).not.toContain(key);
    // Old (v1) narratives.
    for (const opening of legacyNarratives()) expect(input).not.toContain(opening);

    // It does carry the accepted bundle and the provider keyword rows.
    for (const item of record.evidence.accepted) expect(input).toContain(`"id":"${item.id}"`);
    expect(input).toContain("We burn weekends answering the same security questionnaire for every enterprise deal.");
    expect(input).toContain('"term":"rfp response software"');
  });

  it("shows the writer each item's whole claim, so a re-attached token still reads as its own claim (ruling R7, probe p4 v5)", async () => {
    const h = harness();
    await run(h);
    const input = editorialRequests(h)[0]?.input ?? "";
    expect(input).toContain('"text":"64% (B2B SaaS sales teams using spreadsheets for security questionnaires, adoption, 2025)"');
    expect(input).toContain('"text":"$1.9 billion (RFP response software market, market size, 2024)"');
    expect(input).toContain('"text":"$49/user/month, billed annually (Bidwell Starter plan)"');
  });

  it("yields a v2 record whose writer fields and accepted evidence hold none of the rejected claims", async () => {
    const { record } = await run(f1Harness());
    const reparsed = parseResearchRecord(JSON.parse(JSON.stringify(record)));
    const writerText = JSON.stringify({
      oneLiner: reparsed.brief.oneLiner,
      market: reparsed.market.summary,
      competitors: reparsed.competitors,
      community: reparsed.community.summary,
      goToMarket: reparsed.goToMarket,
      whyNow: reparsed.whyNow,
      howItWorks: reparsed.howItWorks,
      editorial: reparsed.editorial,
    });
    for (const fragment of REJECTED_FRAGMENTS) {
      expect(writerText).not.toContain(fragment);
      expect(JSON.stringify(reparsed.evidence.accepted)).not.toContain(fragment);
    }
    // They survive only in the operator-only rejection list.
    const reasons = new Set(reparsed.evidence.rejected.map((r) => r.reason));
    for (const reason of ["span_not_found", "source_unreadable", "metric_unit_mismatch"] as const) {
      expect(reasons.has(reason)).toBe(true);
    }
    expect(reparsed.evidence.rejected.some((r) => r.candidate?.includes("47 PRs"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F1: the writer's output is validated, regenerated once, then refused
// ---------------------------------------------------------------------------

/** The id a rejected candidate would have had if its page had said it. */
function wouldBeId(candidate: QuoteCandidate): string {
  const result = acceptEvidence({
    candidates: { quotes: [candidate], marketStats: [], competitorPrices: [] },
    citations: [{ url: candidate.sourceUrl, title: "x" }],
    sources: new Map([
      [candidate.sourceUrl, { status: "read", text: candidate.text, retrievedAt: "2026-10-01T00:00:00.000Z", roles: ["community"] }],
    ]),
  });
  const item = result.accepted[0];
  if (!item) throw new Error("oracle did not accept");
  return item.id;
}

const BAD_WRITERS: Array<[string, (evidence: EditorialEvidenceItem[]) => unknown, RegExp]> = [
  [
    "references an unknown evidence id",
    (evidence) => {
      const reply = defaultReply(evidence);
      const quotes = idsOf(evidence, "community_quote");
      reply.quoteIds = [forge(quotes[0] ?? ""), quotes[1]];
      return reply;
    },
    /^- quoteIds\[0\]: "q_[0-9a-f]{12}" is not an accepted community_quote/m,
  ],
  [
    "references a rejected candidate's id",
    (evidence) => {
      const reply = defaultReply(evidence);
      const quotes = idsOf(evidence, "community_quote");
      reply.quoteIds = [quotes[0], wouldBeId({ sourceUrl: FIXTURE_URLS.forumThread, text: "Security reviews take weeks and quietly kill our enterprise deals." })];
      return reply;
    },
    /^- quoteIds\[1\]: "q_[0-9a-f]{12}" is not an accepted community_quote/m,
  ],
  [
    "invents a metric in a fact-bearing field",
    (evidence) => {
      const reply = defaultReply(evidence);
      const editorial = isRecord(reply.editorial) ? reply.editorial : {};
      editorial.problemNarrative = `${String(editorial.problemNarrative)} Teams review 47 PRs a week on a team of 8.`;
      reply.editorial = editorial;
      return reply;
    },
    /^- editorial\.problemNarrative: unbound figure "47"/m,
  ],
  ["replies with prose instead of JSON", () => "Here is the record you asked for.", /^- reply: not one JSON object/m],
  // The final review's probe p4 writers (rulings R6 and R7), through the complete pipeline.
  [
    "puts invented figures in proposal text (review probe p4 v1)",
    (evidence) => {
      const reply = defaultReply(evidence);
      const steps = Array.isArray(reply.howItWorks) ? reply.howItWorks : [];
      reply.howItWorks = [`${String(steps[0])} Sales teams of 8 answer 47 questionnaires a quarter.`, ...steps.slice(1)];
      const goToMarket = isRecord(reply.goToMarket) ? reply.goToMarket : {};
      const channels = Array.isArray(goToMarket.channels) ? goToMarket.channels : [];
      goToMarket.channels = ["Founder-led outreach to the 30% of sales engineers who answer questionnaires weekly", ...channels.slice(1)];
      reply.goToMarket = goToMarket;
      const editorial = isRecord(reply.editorial) ? reply.editorial : {};
      editorial.dontBuildYet = "Do not build CRM sync yet: 12 deals a year are lost to slow security reviews.";
      editorial.stackNotes = `${String(editorial.stackNotes)} Proposal teams spend 40 hours per RFP today.`;
      reply.editorial = editorial;
      return reply;
    },
    /^- howItWorks\[0\]: unbound figure "8"/m,
  ],
  [
    "competitor notes cite another vendor's price (review probe p4 v2)",
    (evidence) => {
      const reply = defaultReply(evidence);
      const prices = evidence.filter((e) => e.kind === "competitor_price");
      const competitors = Array.isArray(reply.competitors) ? reply.competitors.filter(isRecord) : [];
      const second = competitors[1];
      if (second) second.notes = `This per-seat plan costs [[ev:${prices[0]?.id ?? ""}]] for every proposal writer on a small sales team.`;
      return reply;
    },
    /^- competitors\[1\]\.notes: evidence p_[0-9a-f]{12} is not one of the items this field may cite/m,
  ],
  [
    "invents a quotation with spelled figures (review probe p4 v3)",
    (evidence) => {
      const reply = defaultReply(evidence);
      const editorial = isRecord(reply.editorial) ? reply.editorial : {};
      editorial.problemNarrative = `${String(editorial.problemNarrative)}\n\nAs one commenter put it, “our team of eight answers forty seven questionnaires a quarter.”`;
      reply.editorial = editorial;
      return reply;
    },
    /^- editorial\.problemNarrative: unbound figure "eight"/m,
  ],
  [
    "writes fullwidth digits (review probe p4 v4)",
    (evidence) => {
      const reply = defaultReply(evidence);
      const editorial = isRecord(reply.editorial) ? reply.editorial : {};
      editorial.problemNarrative = `${String(editorial.problemNarrative)} Sales teams of ８ answer ４７ questionnaires a quarter.`;
      reply.editorial = editorial;
      return reply;
    },
    /^- editorial\.problemNarrative: unbound figure "８"/m,
  ],
];

describe("F1: writer output is validated before a record exists", () => {
  it.each(BAD_WRITERS)("refuses a writer that %s: two regenerations with the issues, then failure", async (_label, writer, issue) => {
    const h = harness({ synthesis: { editorial: editorialSequence(writer) } });
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("editorial_synthesis");
    expect(error.message).toMatch(/writer output failed validation after 3 attempts/);
    expect(error.report?.ok).toBe(false);
    expect(error.report?.attempts.editorial_synthesis).toBe(3);
    expect(error.report?.providerCalls.filter((c) => c.operation.startsWith("editorial_synthesis/"))).toHaveLength(3);

    const [first, ...regenerations] = editorialRequests(h);
    expect(regenerations).toHaveLength(2);
    const firstInput = first?.input ?? "";
    for (const again of regenerations) {
      // Never more permissive (ruling R13): the same instructions, the same input plus the issue list, each time.
      expect(again.instructions).toBe(first?.instructions);
      expect(again.input.startsWith(`${firstInput}\n\n${EDITORIAL_ISSUES_HEADING}\n`)).toBe(true);
      const note = again.input.slice(firstInput.length);
      expect(note).toMatch(issue);
      // Issues only: no rejected evidence text rides along.
      expect(note).not.toContain("quietly kill our enterprise deals");
      expect(note).not.toContain("Every RFP season");
    }
  });

  it("accepts a writer that paraphrases accepted evidence qualitatively", async () => {
    const h = harness({
      synthesis: {
        editorial: editorialSequence((evidence) => {
          const reply = defaultReply(evidence);
          const editorial = isRecord(reply.editorial) ? reply.editorial : {};
          editorial.problemNarrative =
            "Sales engineers say they lose weekends to the same security questionnaire, cannot tell which answer legal approved, and see generic chat tools invent controls their company does not have.";
          reply.editorial = editorial;
          return reply;
        }),
      },
    });
    const { record } = await run(h);
    expect(record.editorial?.problemNarrative).toMatch(/^Sales engineers say they lose weekends/);
    expect(record.provenance.attempts.editorial_synthesis).toBe(1);
  });

  it("keeps a regenerated reply that fixes the issues, with both attempts in provenance", async () => {
    const h = harness({
      synthesis: {
        editorial: editorialSequence((evidence) => {
          const reply = defaultReply(evidence);
          // A partial score set: the site publishes all four scores or none.
          reply.scores = { opportunity: 8, pain: 9 };
          return reply;
        }, defaultReply),
      },
    });
    const { record } = await run(h);
    expect(record.scores).toEqual({ opportunity: 8, pain: 9, timing: 8, builderConfidence: 7, execution: 7 });
    expect(record.provenance.attempts.editorial_synthesis).toBe(2);
    expect(record.provenance.providerCalls.filter((c) => c.operation.startsWith("editorial_synthesis/"))).toHaveLength(2);
    expect(editorialRequests(h)[1]?.input).toMatch(/^- scores\.timing: required when scores are present/m);
  });

  it("drops unknown writer fields such as a verified flag instead of keeping them", async () => {
    const { record } = await run(
      harness({
        synthesis: {
          editorial: editorialSequence((evidence) => {
            const reply = defaultReply(evidence);
            reply.verified = true;
            const competitors = Array.isArray(reply.competitors) ? reply.competitors : [];
            reply.competitors = competitors.map((c) => (isRecord(c) ? { ...c, pricing: "$1/month", verified: true } : c));
            return reply;
          }),
        },
      }),
    );
    expect(JSON.stringify(record)).not.toMatch(/"verified"|"pricing"/);
  });
});

// ---------------------------------------------------------------------------
// F5: whole claims through the complete fixture pipeline
// ---------------------------------------------------------------------------

describe("F5: a wrong claim never enters the returned record", () => {
  it.each(F5_ROWS.map((row) => [row.label, row] as const))("%s", async (_label, row) => {
    const h = harness({
      pages: { ...FIXTURE_PAGES, ...F5_PAGES },
      packs: F5_PACKS,
      synthesis: { extraction: extractionWith({ marketStats: row.stats, competitorPrices: row.prices }) },
    });
    const { record } = await run(h);
    expect(record.evidence.accepted.some(row.leaked)).toBe(false);
    const rejectedHere = record.evidence.rejected.filter((r) =>
      [...(row.stats ?? []), ...(row.prices ?? [])].some((c) => r.sourceUrl === c.sourceUrl.replace(/\/$/, "")),
    );
    expect(rejectedHere.length).toBeGreaterThan(0);
    for (const r of rejectedHere) expect(row.reasons).toContain(r.reason);
    // And nothing the writer selected can point at it.
    expect(() => parseResearchRecord(JSON.parse(JSON.stringify(record)))).not.toThrow();
  });

  it("fails closed when the wrong claims were the only prices, before keyword or editorial spend", async () => {
    const prices = F5_ROWS.flatMap((row) => row.prices ?? []);
    const h = harness({
      pages: { ...FIXTURE_PAGES, ...F5_PAGES },
      packs: F5_PACKS,
      synthesis: { extraction: () => ({ ...FIXTURE_EXTRACTION, competitorPrices: prices }) },
    });
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("evidence_acceptance");
    expect(error.message).toMatch(/priced competitors: 0 vendors with an accepted price, need 3/);
    expect(h.keywordLookups).toBe(0);
    expect(editorialRequests(h)).toHaveLength(0);
    const reasons = error.report?.evidence.rejected.map((r) => r.reason) ?? [];
    expect(reasons).toContain("period_mismatch");
  });

  it("rejects a candidate whose page could not be read and one citing a URL no search returned", async () => {
    const h = harness({
      synthesis: {
        extraction: extractionWith({
          quotes: [{ sourceUrl: "https://invented.example/thread/1", text: "We burn weekends answering the same security questionnaire for every enterprise deal." }],
        }),
      },
    });
    const { record } = await run(h);
    const reasons = record.evidence.rejected.map((r) => r.reason);
    expect(reasons).toContain("source_unreadable");
    expect(reasons).toContain("unknown_citation");
    expect(record.evidence.accepted.some((e) => e.sourceUrl.includes("invented.example"))).toBe(false);
    expect(record.evidence.accepted.some((e) => e.sourceUrl.includes("reddit.com"))).toBe(false);
  });

  it("drops a rejected candidate's over-long source URL instead of failing the record", async () => {
    // 1,028 characters as written (a valid candidate), over 6,000 once percent-encoded.
    const longUrl = `https://forum.example.net/t/${"é".repeat(1_000)}`;
    const h = harness({
      synthesis: { extraction: extractionWith({ quotes: [{ sourceUrl: longUrl, text: "A quote from a page no search returned at all." }] }) },
    });
    const { record } = await run(h);
    const rejected = record.evidence.rejected.find((r) => r.candidate === "A quote from a page no search returned at all.");
    expect(rejected?.reason).toBe("unknown_citation");
    expect(rejected?.sourceUrl).toBeUndefined();
    expect(record.evidence.rejected.every((r) => (r.sourceUrl?.length ?? 0) <= 2_048)).toBe(true);
  });

  it("ignores a model-supplied evidence id and verified flag; acceptance assigns ids", async () => {
    const forged = "p_000000000000";
    const tampered = { ...FIXTURE_EXTRACTION.competitorPrices[0], id: forged, verified: true };
    const h = harness({
      synthesis: { extraction: () => ({ ...FIXTURE_EXTRACTION, competitorPrices: [tampered, ...FIXTURE_EXTRACTION.competitorPrices.slice(1)] }) },
    });
    const { record } = await run(h);
    expect(record.evidence.accepted.some((e) => e.id === forged)).toBe(false);
    expect(record.evidence.accepted.filter((e) => e.kind === "competitor_price")).toHaveLength(3);
    expect(JSON.stringify(record)).not.toContain('"verified"');
  });
});

// ---------------------------------------------------------------------------
// Early stop, attempts and spend
// ---------------------------------------------------------------------------

describe("too little accepted evidence stops before keyword and editorial spend", () => {
  it("names the shortfalls and the top rejection reasons; no keyword or editorial call happens", async () => {
    const h = harness({ synthesis: { extraction: () => ({ ...FIXTURE_EXTRACTION, quotes: FIXTURE_EXTRACTION.quotes.slice(3) }) } });
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("evidence_acceptance");
    expect(error.message).toMatch(/community quotes: 0 distinct accepted, need 2/);
    expect(error.message).toMatch(/Top rejection reasons: (?:source_unreadable|span_not_found) ×1/);
    expect(error.message).toMatch(/Stopped before keyword and editorial spend/);
    expect(h.keywordLookups).toBe(0);
    expect(editorialRequests(h)).toHaveLength(0);
    expect(h.synthesis).toHaveLength(2); // brief normalization + extraction
    expect(error.report?.attempts).toEqual({
      brief_normalization: 1,
      market_stats: 1,
      competitors: 1,
      community_signals: 1,
      evidence_extraction: 1,
    });
    expect(error.report?.evidence.accepted).toEqual({ community_quote: 0, market_stat: 3, competitor_price: 3 });
  });

  it("stops at acquisition, before extraction spend, when no cited page can be read", async () => {
    const h = harness({ pages: {} });
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("source_acquisition");
    expect(error.message).toMatch(/none of the \d+ cited pages could be read.*stopped before evidence extraction spend/);
    expect(extractionRequests(h)).toHaveLength(0);
    expect(h.keywordLookups).toBe(0);
    // The supplement search still ran first.
    expect(error.report?.attempts.community_signals).toBe(2);
  });
});

describe("extraction attempts", () => {
  it("re-asks once after a reply that is not JSON, under the same rules", async () => {
    let calls = 0;
    const h = harness({
      synthesis: { extraction: () => (calls++ === 0 ? "Sure! Here are the candidates you asked for." : FIXTURE_EXTRACTION) },
    });
    const reservations: number[] = [];
    const extractionWorst = worstCaseMicroUsd(stepById("evidence_extraction").budget);
    const { record } = await run(h, {
      assertCap: ({ worstCaseMicroUsd: worst }) => {
        reservations.push(worst);
      },
    });
    const [first, second] = extractionRequests(h);
    expect(second?.instructions).toBe(first?.instructions);
    expect(second?.input).toBe(`${first?.input ?? ""}\n\n${EXTRACTION_REASK}`);
    expect(record.provenance.attempts.evidence_extraction).toBe(2);
    expect(record.provenance.providerCalls.filter((c) => c.operation.startsWith("evidence_extraction/"))).toHaveLength(2);
    // Each attempt reserved the step's worst case before calling.
    expect(reservations.filter((w) => w === extractionWorst)).toHaveLength(2);
  });

  it("retries a billed failed extraction call and records its cost", async () => {
    let calls = 0;
    const h = harness({ synthesis: { extraction: () => (calls++ === 0 ? "" : FIXTURE_EXTRACTION) } });
    const { record } = await run(h);
    const failed = record.provenance.providerCalls.filter((c) => c.operation.endsWith(":failed"));
    expect(failed.map((c) => c.operation)).toEqual(["evidence_extraction/synthesis:gpt-5.6-sol:failed"]);
    expect(failed[0]?.costUsd).toBeGreaterThan(0);
    expect(record.provenance.attempts.evidence_extraction).toBe(2);
  });

  it("fails after two unusable extraction replies, before keyword and editorial spend", async () => {
    const h = harness({ synthesis: { extraction: () => "not json" } });
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("evidence_extraction");
    expect(error.message).toMatch(/not a JSON object \(2 attempts\)/);
    expect(extractionRequests(h)).toHaveLength(2);
    expect(h.keywordLookups).toBe(0);
    expect(editorialRequests(h)).toHaveLength(0);
  });
});

describe("provider retries and regenerations share a step's attempts", () => {
  /** The first request with these instructions fails with a retryable, unbilled 503. */
  function failFirst(h: Harness, instructions: string): void {
    const real = h.providers.synthesis;
    let failed = false;
    h.providers.synthesis = {
      ...real,
      complete: (request) => {
        if (request.instructions === instructions && !failed) {
          failed = true;
          h.synthesis.push(request);
          return Promise.reject(new ProviderCallError("synthesis", "provider returned 503", { retryable: true, status: 503 }));
        }
        return real.complete(request);
      },
    };
  }

  it("editorial: a provider retry uses up one of the three attempts", async () => {
    const h = harness({ synthesis: { editorial: editorialSequence(() => "prose, not JSON") } });
    failFirst(h, EDITORIAL_INSTRUCTIONS);
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("editorial_synthesis");
    expect(error.message).toMatch(/writer output failed validation after 3 attempts/);
    expect(error.report?.attempts.editorial_synthesis).toBe(3);
    expect(editorialRequests(h)).toHaveLength(3);
  });

  it("extraction: a provider retry uses up the re-ask", async () => {
    const h = harness({ synthesis: { extraction: () => "prose, not JSON" } });
    failFirst(h, EXTRACTION_INSTRUCTIONS);
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("evidence_extraction");
    expect(error.message).toMatch(/not a JSON object \(2 attempts\)/);
    expect(error.report?.attempts.evidence_extraction).toBe(2);
    expect(extractionRequests(h)).toHaveLength(2);
    expect(h.keywordLookups).toBe(0);
  });
});

describe("spend is reserved before every attempt", () => {
  it("throws the cap error before a regeneration call when the budget is too low for it", async () => {
    const editorialWorst = worstCaseMicroUsd(stepById("editorial_synthesis").budget);
    let editorialReservations = 0;
    const h = harness({
      synthesis: {
        editorial: editorialSequence((evidence) => {
          const reply = defaultReply(evidence);
          reply.whyNow = "Questionnaires now arrive 3x earlier in the cycle.";
          return reply;
        }, defaultReply),
      },
    });
    const error = await failureOf(
      run(h, {
        assertCap: ({ spentMicroUsd, worstCaseMicroUsd: worst }) => {
          if (worst === editorialWorst && ++editorialReservations === 2) {
            throw new CostCapExceededError(spentMicroUsd, worst);
          }
        },
      }),
    );
    expect(error.stepId).toBe("editorial_synthesis");
    expect(error.causeError).toBeInstanceOf(CostCapExceededError);
    expect(editorialRequests(h)).toHaveLength(1);
    expect(error.report?.attempts.editorial_synthesis).toBe(1);
    expect(error.report?.error).toMatch(/cost cap/);
  });
});

// ---------------------------------------------------------------------------
// Source reader, mode and report
// ---------------------------------------------------------------------------

describe("fail closed without a source reader", () => {
  it("refuses to run before any paid call when no sourceText provider is configured", async () => {
    const h = harness();
    h.providers.sourceText = undefined;
    const error = await failureOf(run(h));
    expect(error.stepId).toBe("source_acquisition");
    expect(error.message).toMatch(/no source reader is configured/);
    expect(error.report?.ok).toBe(false);
    expect(error.report?.failedStep).toBe("source_acquisition");
    expect(error.report?.providerCalls).toEqual([]);
    expect(h.synthesis).toHaveLength(0);
    expect(h.searches).toHaveLength(0);
  });
});

describe("mode is explicit", () => {
  it("copies the caller's mode into the record and the report", async () => {
    for (const mode of ["fixture", "live"] as const) {
      const { record, report } = await run(harness(), { mode });
      expect(record.mode).toBe(mode);
      expect(report.mode).toBe(mode);
    }
  });

  it("refuses a run without a valid mode before anything happens", async () => {
    const h = harness();
    // Simulates a JavaScript caller (the CLI) passing no mode.
    const options = { brief: BRIEF, providers: h.providers } as unknown as RunResearchOptions;
    await expect(runResearch(options)).rejects.toThrow(TypeError);
    expect(h.synthesis).toHaveLength(0);
  });
});

describe("run report on failure", () => {
  it("names the failed step and carries calls, cost, attempts, sources and rejections, without page text or paths", async () => {
    const h = harness({ scenario: "thin-evidence" });
    const error = await failureOf(run(h));
    const report = error.report;
    expect(report).toBeDefined();
    expect(report?.ok).toBe(false);
    expect(report?.failedStep).toBe("evidence_acceptance");
    expect(report?.mode).toBe("fixture");
    expect(report?.costUsd).toBeGreaterThan(0);
    expect(report?.providerCalls.length).toBe(Object.values(report?.attempts ?? {}).reduce((a, b) => a + b, 0));
    expect(report?.sources.filter((s) => s.roles.includes("community")).every((s) => s.status === "unreadable")).toBe(true);
    expect(report?.evidence.rejected.length).toBeGreaterThan(0);
    const json = JSON.stringify(report);
    expect(json).not.toContain("Mid-market vendors account");
    expect(json).not.toMatch(/\/Users\/|\/home\/|\/private\//);
    expect(json).not.toMatch(/"candidate"/);
  });
});

// ---------------------------------------------------------------------------
// Budgets: both synthesis inputs have a true worst case
// ---------------------------------------------------------------------------

describe("input budgets", () => {
  it("fits a maximal accepted bundle, long keywords and the longest issue list into the editorial budget", () => {
    const at = "2026-10-01T00:00:00.000Z";
    const wide = (n: number) => "測".repeat(n);
    const items: AcceptedEvidence[] = [];
    for (let i = 0; i < 8; i += 1) {
      items.push({
        id: `q_${String(i).padStart(12, "0")}`,
        kind: "community_quote",
        sourceUrl: `https://news.example.com/item?id=${i}&${"p".repeat(1_900)}`,
        sourceTitle: wide(300),
        excerpt: wide(480),
        excerptSha256: "0".repeat(64),
        retrievedAt: at,
        attribution: "community",
      });
      items.push({
        id: `s_${String(i).padStart(12, "0")}`,
        kind: "market_stat",
        sourceUrl: `https://research.example.com/${"r".repeat(1_900)}`,
        sourceTitle: wide(300),
        excerpt: wide(600),
        excerptSha256: "0".repeat(64),
        retrievedAt: at,
        attribution: "secondary",
        subject: wide(240),
        metric: "market_size",
        amount: { value: "123456789012345678901234567890", magnitude: "trillion", unit: "currency", currency: "USD" },
        period: { kind: "projected", toYear: 2039 },
      });
    }
    for (let i = 0; i < 12; i += 1) {
      items.push({
        id: `p_${String(i).padStart(12, "0")}`,
        kind: "competitor_price",
        sourceUrl: `https://vendor${i}.example/${"v".repeat(1_900)}`,
        sourceTitle: wide(300),
        excerpt: wide(600),
        excerptSha256: "0".repeat(64),
        retrievedAt: at,
        attribution: "first_party",
        vendor: wide(120),
        plan: wide(120),
        price: {
          amount: { value: "999999999999.99", magnitude: "none", unit: "currency", currency: "USD" },
          period: "month",
          basis: "per_user",
          qualifiers: ["billed_annually", "introductory", "plus_usage", "starting_at"],
        },
      });
    }
    const keywords: KeywordRow[] = Array.from({ length: 50 }, (_, i) => ({
      term: wide(80),
      volume: 1_000_000 + i,
      competition: 100,
      cpc: 999.99,
      source: "provider" as const,
    }));
    const brief = normalizeBriefInput({ ...BRIEF, title: wide(300), audience: wide(400), revenueModel: wide(300), oneLiner: wide(300) });
    const input = buildEditorialInput(brief, items, keywords);
    const issues = editorialIssuesSection(Array.from({ length: 80 }, () => wide(400)));
    const step = stepById("editorial_synthesis");
    expect(utf8Bytes(EDITORIAL_INSTRUCTIONS) + utf8Bytes(`${input}\n\n${issues}`)).toBeLessThanOrEqual(stepInputBudgetBytes(step));
    // Every item is still in the bundle (clips shrink, items are not dropped).
    for (const item of items) expect(input).toContain(`"id":"${item.id}"`);
  });

  it("fits many large pages into the extraction budget, quoting only the pages' own text", () => {
    const sources: ExtractionSource[] = Array.from({ length: 32 }, (_, i) => {
      const roles = i % 3 === 0 ? (["market"] as const) : i % 3 === 1 ? (["competitors"] as const) : (["community"] as const);
      const filler = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(3_000);
      return {
        url: `https://source${i}.example/page`,
        title: `Source ${i}`,
        roles: [...roles],
        text: `${filler}\nPro plan\n$${20 + i}/user/month, billed annually\n${filler}`,
      };
    });
    const step = stepById("evidence_extraction");
    const available = stepInputBudgetBytes(step) - utf8Bytes(EXTRACTION_INSTRUCTIONS) - 2_000;
    const block = buildExtractionSources(sources, available);
    expect(block.included).toBe(32);
    expect(utf8Bytes(block.text)).toBeLessThanOrEqual(available);
    // Figure pages keep their price line.
    expect(block.text).toContain("$20/user/month, billed annually");
    // Every passage between labels and gap markers is a substring of its own page.
    for (const [i, source] of sources.entries()) {
      const start = block.text.indexOf(`### Source ${i + 1}\nURL: ${source.url}\n`);
      expect(start).toBeGreaterThanOrEqual(0);
      const textStart = block.text.indexOf("Text:\n", start) + "Text:\n".length;
      const next = block.text.indexOf("\n\n### Source ", textStart);
      const excerpt = block.text.slice(textStart, next < 0 ? undefined : next);
      for (const passage of excerpt.split(EXCERPT_GAP)) {
        expect(source.text.includes(passage)).toBe(true);
      }
    }
  });
});

describe("writer instructions (ruling R13)", () => {
  it("tell the writer how to stay figure- and quotation-free, and which names are fine", () => {
    expect(EDITORIAL_INSTRUCTIONS).toMatch(/no currency signs/);
    expect(EDITORIAL_INSTRUCTIONS).toMatch(/write "a few", "several" or "a couple of"/);
    expect(EDITORIAL_INSTRUCTIONS).toMatch(/standard or version names \(SOC 2, ISO 27001, Next\.js 15, OAuth 2\.0\) are fine/);
    expect(EDITORIAL_INSTRUCTIONS).toMatch(/No quotation marks of any kind/);
    expect(EDITORIAL_INSTRUCTIONS).toMatch(/no ARR, MRR or revenue total/);
  });

  it("names only examples the guards accept as names", () => {
    expect(findUnboundFigures("SOC 2, ISO 27001, Next.js 15, OAuth 2.0, B2B, GPT-4o, don't, teams'")).toEqual([]);
    expect(findQuotedSpans("Apostrophes in words such as don't and the teams' answers are fine.")).toEqual([]);
  });
});

describe("R14: vendor hints from the competitor citations", () => {
  it("names the brand a competitor citation's title shares with its own host, and nothing from listing sites", () => {
    const competitors = (url: string, title: string) => ({ url, title, roles: ["competitors" as const] });
    expect(
      vendorHintsFromCitations([
        competitors("https://www.coderabbit.ai/pricing", "CodeRabbit pricing"),
        competitors("https://responsive.example/pricing", "Pricing | Responsive"),
        competitors("https://answerdeck.example/pricing", "Answer Deck plans"),
        competitors("https://blog.example.com/rfp-tools", "Best RFP tools this year"),
        competitors("https://www.g2.com/products/loopio/reviews", "Loopio Reviews 2026 | G2"),
        competitors("https://apps.shopify.com/rfp-helper", "RFP Helper - Shopify App Store"),
        { url: "https://loopio.example/blog", title: "Loopio blog", roles: ["market" as const] },
      ]),
    ).toEqual(["CodeRabbit", "Responsive", "Answer Deck"]);
  });

  it("refuses a price claimed for one vendor from another cited vendor's own pricing page (ruling R5 with hints)", async () => {
    const responsive = "https://responsive.example/pricing";
    const h = harness({
      pages: { ...FIXTURE_PAGES, [responsive]: "Responsive pricing\nPlans\nBidwell costs $49/user/month, billed annually." },
      packs: packsWith({ competitors: [{ url: responsive, title: "Responsive pricing" }] }),
      synthesis: {
        extraction: extractionWith({
          competitorPrices: [
            {
              vendor: "Bidwell",
              sourceUrl: responsive,
              supportingText: "Bidwell costs $49/user/month, billed annually.",
              priceText: "$49/user/month, billed annually",
            },
          ],
        }),
      },
    });
    const { record } = await run(h);
    expect(record.evidence.accepted.some((e) => e.sourceUrl === responsive)).toBe(false);
    expect(record.evidence.rejected).toContainEqual(
      expect.objectContaining({ kind: "competitor_price", reason: "ambiguous_attribution", sourceUrl: responsive }),
    );
  });
});
