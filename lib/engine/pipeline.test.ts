/**
 * Pipeline tests (PIPELINE_VERSION 2). Fixture providers only: no network,
 * no keys, no spend.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CAP_MICRO_USD,
  CostCapExceededError,
  worstCaseMicroUsd,
  worstCaseRunMicroUsd,
} from "./cost.ts";
import { EVIDENCE_MINIMUMS } from "./evidence/contract.ts";
import { normalizeBriefInput, PipelineError, runResearch, type BriefInput } from "./pipeline.ts";
import { PIPELINE, PIPELINE_STEP_IDS, PIPELINE_VERSION } from "./pipeline-steps.ts";
import { createProviders } from "./providers.ts";
import {
  createFixtureProviders,
  FIXTURE_BRIEF_SLUG,
  FIXTURE_BRIEFS_DIR,
  FIXTURE_EXTRACTION,
  FIXTURE_PAGES,
  FIXTURE_URLS,
  fixtureSearchFetch,
  SEARCH_MARKET_FIXTURE,
} from "./providers/fixtures.ts";
import type { Fetcher } from "./providers/openai.ts";
import { createSearchProvider } from "./providers/perplexity.ts";
import { ProviderCallError, type EngineProviders, type SynthesisRequest } from "./providers/types.ts";
import { parseResearchRecord } from "./research-record.ts";

const RFP_BRIEF: BriefInput = {
  title: "AI RFP Response Assistant",
  audience: "SMB SaaS sales and solutions engineers",
  revenueModel: "Seat-based SaaS with usage caps",
  seedKeywords: ["rfp response software", "security questionnaire automation", "proposal management software"],
  slug: FIXTURE_BRIEF_SLUG,
  oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

/** Record every synthesis request; returns the captured list. */
function captureSynthesis(providers: EngineProviders): SynthesisRequest[] {
  const seen: SynthesisRequest[] = [];
  const real = providers.synthesis;
  providers.synthesis = {
    ...real,
    complete: (request) => {
      seen.push(request);
      return real.complete(request);
    },
  };
  return seen;
}

async function failureOf(promise: Promise<unknown>): Promise<PipelineError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof PipelineError)) throw new Error(`expected a PipelineError, got ${String(error)}`);
  return error;
}

describe("step table (PIPELINE_VERSION 2)", () => {
  it("accepts evidence before keyword and editorial spend", () => {
    expect(PIPELINE_VERSION).toBe(2);
    expect(PIPELINE_STEP_IDS).toEqual([
      "brief_normalization",
      "market_stats",
      "competitors",
      "community_signals",
      "evidence_extraction",
      "keywords_demand",
      "editorial_synthesis",
      "provenance_parse",
    ]);
    expect(PIPELINE.map((s) => s.id)).toEqual([...PIPELINE_STEP_IDS]);
    expect(PIPELINE.map((s) => s.position)).toEqual(PIPELINE.map((_, i) => i));
  });

  it("bounds the billable attempts of every paid step", () => {
    expect(Object.fromEntries(PIPELINE.map((s) => [s.id, s.maxAttempts]))).toEqual({
      brief_normalization: 2,
      market_stats: 2,
      competitors: 3,
      community_signals: 4,
      evidence_extraction: 2,
      keywords_demand: 2,
      // Ruling R13: the writer gets up to three billable attempts in total.
      editorial_synthesis: 3,
      provenance_parse: 0,
    });
  });

  it("keeps the worst case of every allowed billable attempt under the $4.00 cap ($3.972)", () => {
    const worst = worstCaseRunMicroUsd(PIPELINE);
    expect(worst).toBe(PIPELINE.reduce((sum, s) => sum + s.maxAttempts * worstCaseMicroUsd(s.budget), 0));
    expect(worst).toBeLessThanOrEqual(CAP_MICRO_USD);
    // Pinned so any budget or attempt change is a deliberate, reviewed edit
    // (ruling R13 added the third editorial attempt: $3.262 + $0.660).
    expect(worst).toBe(3_972_000);
  });
});

describe("runResearch (fixture)", () => {
  it("uses one bounded competitor supplement when the first search cites too few vendor sites", async () => {
    const providers = createProviders({ mode: "fixture" });
    const search = providers.search;
    const queries: string[] = [];
    providers.search = {
      ...search,
      search: async (request) => {
        queries.push(request.query);
        const result = await search.search(request);
        if (request.query.includes("Identify at least three direct competitors")) {
          return { ...result, value: { ...result.value, citations: result.value.citations.slice(0, 1) } };
        }
        if (request.query.includes("first competitor search cited too few")) {
          return { ...result, value: { ...result.value, citations: [
            ...result.value.citations,
            { url: "https://extra.example/pricing", title: "Extra pricing" },
          ] } };
        }
        return result;
      },
    };
    const { record, report } = await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(report.attempts.competitors).toBe(2);
    expect(queries.some((query) => query.includes("first competitor search cited too few"))).toBe(true);
    expect(record.competitors).toHaveLength(3);
    expect(report.costUsd).toBeLessThan(4);
  });

  it("uses the last budgeted search for new vendor domains when two searches still cite only two", async () => {
    const providers = createProviders({ mode: "fixture" });
    const search = providers.search;
    const queries: string[] = [];
    providers.search = {
      ...search,
      search: async (request) => {
        queries.push(request.query);
        const result = await search.search(request);
        if (request.query.includes("Identify at least three direct competitors")) {
          return { ...result, value: { ...result.value, citations: result.value.citations.slice(0, 1) } };
        }
        if (request.query.includes("first competitor search cited too few")) {
          return { ...result, value: { ...result.value, citations: [
            ...result.value.citations.slice(0, 2),
            { url: "https://rfpforge.example/blog/rfp-comparisons", title: "RFPForge RFP comparisons" },
          ] } };
        }
        return result;
      },
    };
    const { record, report } = await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(report.attempts.competitors).toBe(3);
    const third = queries.find((query) => query.includes("Previously cited vendors still missing an official pricing page"));
    expect(third).toContain("RFPForge");
    expect(third).toContain("bidwell, answerdeck");
    expect(record.competitors).toHaveLength(EVIDENCE_MINIMUMS.competitors);
    expect(report.costUsd).toBeLessThan(4);
  });

  it("keeps three already cited pricing pages when the optional spare search is rate limited", async () => {
    const providers = createProviders({ mode: "fixture" });
    const search = providers.search;
    providers.search = {
      ...search,
      search: async (request) => {
        if (request.query.includes("Previously cited vendors still missing an official pricing page")) {
          throw new ProviderCallError("search", "provider returned 429", { retryable: true, status: 429 });
        }
        const result = await search.search(request);
        return request.query.includes("Identify at least three direct competitors")
          ? { ...result, value: { ...result.value, citations: result.value.citations.slice(0, 1) } }
          : result;
      },
    };
    const { record, report } = await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(report.attempts.competitors).toBe(3);
    expect(record.competitors).toHaveLength(EVIDENCE_MINIMUMS.competitors);
  });

  it("does not count a third vendor's comparison blog as an official pricing source", async () => {
    const providers = createProviders({ mode: "fixture" });
    const search = providers.search;
    const queries: string[] = [];
    providers.search = {
      ...search,
      search: async (request) => {
        queries.push(request.query);
        const result = await search.search(request);
        if (!request.query.includes("Identify at least three direct competitors")) return result;
        return {
          ...result,
          value: {
            ...result.value,
            citations: [
              ...result.value.citations.slice(0, 2),
              { url: "https://inventive.example/blog/alternatives", title: "Inventive alternatives" },
            ],
          },
        };
      },
    };
    const { record, report } = await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(report.attempts.competitors).toBe(3);
    expect(queries.some((query) => query.includes("first competitor search cited too few"))).toBe(true);
    expect(record.competitors).toHaveLength(EVIDENCE_MINIMUMS.competitors);
  });

  it("produces a v2 record and a run report from accepted evidence", async () => {
    const { record, report } = await runResearch({
      brief: RFP_BRIEF,
      providers: createProviders({ mode: "fixture" }),
      mode: "fixture",
      ranAt: "2026-10-01T00:00:00.000Z",
    });
    // Round trip through the fail-closed v2 parser.
    const again = parseResearchRecord(JSON.parse(JSON.stringify(record)));
    expect(again).toEqual(record);
    expect(record.mode).toBe("fixture");
    expect(record.brief.slug).toBe(FIXTURE_BRIEF_SLUG);
    expect(record.market.statIds.length).toBeGreaterThanOrEqual(EVIDENCE_MINIMUMS.marketStats);
    expect(record.competitors.length).toBeGreaterThanOrEqual(EVIDENCE_MINIMUMS.competitors);
    expect(record.community.quoteIds.length).toBeGreaterThanOrEqual(EVIDENCE_MINIMUMS.distinctQuotes);
    expect(record.keywords.every((k) => k.source === "provider")).toBe(true);
    expect(record.provenance.ranAt).toBe("2026-10-01T00:00:00.000Z");
    expect(record.provenance.costUsd).toBeGreaterThan(0);
    expect(record.provenance.models).toEqual({
      synthesis: "gpt-5.6-sol",
      search: "perplexity:sonar-pro",
      keywordData: "dataforseo",
    });
    expect(record.provenance.attempts).toEqual({
      brief_normalization: 1,
      market_stats: 1,
      competitors: 1,
      community_signals: 1,
      evidence_extraction: 1,
      keywords_demand: 1,
      editorial_synthesis: 1,
    });
    expect(record.provenance.providerCalls.map((c) => c.operation.split("/")[0])).toEqual([
      "brief_normalization",
      "market_stats",
      "competitors",
      "community_signals",
      "evidence_extraction",
      "keywords_demand",
      "editorial_synthesis",
    ]);

    expect(report.ok).toBe(true);
    expect(report.mode).toBe("fixture");
    expect(report.pipelineVersion).toBe(2);
    expect(report.recordContractVersion).toBe(2);
    expect(report.briefSlug).toBe(FIXTURE_BRIEF_SLUG);
    expect(report.briefSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.failedStep).toBeUndefined();
    expect(report.costUsd).toBe(record.provenance.costUsd);
    expect(report.evidence.accepted).toEqual({ community_quote: 3, market_stat: 3, competitor_price: 3, competitor_availability: 0 });
    expect(report.evidence.rejected.map((r) => r.reason).sort()).toEqual(["source_unreadable", "span_not_found"]);
    expect(report.sources.map((s) => s.status)).toEqual(record.evidence.sources.map((s) => s.status));
  });

  it("records one source per distinct URL with the roles of the searches that cited it", async () => {
    const { record } = await runResearch({ brief: RFP_BRIEF, providers: createProviders({ mode: "fixture" }), mode: "fixture" });
    const byUrl = new Map(record.evidence.sources.map((s) => [s.url, s]));
    expect(byUrl.get(FIXTURE_URLS.marketReport)?.roles).toEqual(["market"]);
    expect(byUrl.get("https://bidwell.example/pricing")?.roles).toEqual(["competitors"]);
    expect(byUrl.get(FIXTURE_URLS.hnThread)?.roles).toEqual(["community"]);
    const reddit = byUrl.get("https://www.reddit.com/r/sales/comments/abc123/rfp_weekends");
    expect(reddit?.status).toBe("unreadable");
    expect(reddit?.retrievedAt).toBeUndefined();
    expect(new Set(record.evidence.sources.map((s) => s.url)).size).toBe(record.evidence.sources.length);
  });

  it("fails closed when the keyword provider fails: no record, no editorial call", async () => {
    const providers = createFixtureProviders({
      keywordPayload: { status_code: 20000, tasks: [{ status_code: 20000, result: [] }] },
    });
    const requests = captureSynthesis(providers);
    const error = await failureOf(runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" }));
    expect(error.stepId).toBe("keywords_demand");
    expect(error.report?.ok).toBe(false);
    expect(error.report?.failedStep).toBe("keywords_demand");
    expect(String(error)).not.toMatch(/guess|invent|estimate/i);
    expect(requests.filter((r) => /editorial research record/.test(r.instructions))).toHaveLength(0);
  });

  it("stops before any provider call when the cap refuses the first reservation", async () => {
    const providers = createProviders({ mode: "fixture" });
    const requests = captureSynthesis(providers);
    const error = await failureOf(
      runResearch({
        brief: RFP_BRIEF,
        providers,
        mode: "fixture",
        assertCap: () => {
          throw new CostCapExceededError(3_900_000, 200_000);
        },
      }),
    );
    expect(error.causeError).toBeInstanceOf(CostCapExceededError);
    expect(error.stepId).toBe("brief_normalization");
    expect(error.report?.providerCalls).toEqual([]);
    expect(error.report?.error).toMatch(/cost cap/);
    expect(requests).toHaveLength(0);
  });

  it("rejects a slug that could escape content/ideas before any paid call", async () => {
    const providers = createProviders({ mode: "fixture" });
    const requests = captureSynthesis(providers);
    const error = await failureOf(
      runResearch({ brief: { ...RFP_BRIEF, slug: "../../etc/evil" }, providers, mode: "fixture" }),
    );
    expect(error.stepId).toBe("brief_normalization");
    expect(error.message).toMatch(/must match/);
    expect(requests).toHaveLength(0);
  });

  it("refuses an input larger than the step budget before calling", async () => {
    const providers = createProviders({ mode: "fixture" });
    const requests = captureSynthesis(providers);
    const error = await failureOf(
      runResearch({ brief: { ...RFP_BRIEF, audience: "x".repeat(5_000) }, providers, mode: "fixture" }),
    );
    expect(error.stepId).toBe("brief_normalization");
    expect(error.message).toMatch(/exceeds the .*-token budget/);
    expect(requests).toHaveLength(0);
  });

  it("sends each search step's output-token cap", async () => {
    const providers = createProviders({ mode: "fixture" });
    const seen: number[] = [];
    const fallback = fixtureSearchFetch();
    const fetchImpl = (async (input, init) => {
      const body: unknown = JSON.parse(String(init?.body ?? "{}"));
      if (typeof body === "object" && body !== null && "max_tokens" in body && typeof body.max_tokens === "number") {
        seen.push(body.max_tokens);
      }
      return fallback(input, init);
    }) as Fetcher;
    providers.search = createSearchProvider({ fetchImpl, apiKey: "fixture-mode" });
    await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(seen).toEqual([2_000, 2_000, 2_000]);
  });

  it("reserves before the retry and counts the billed failed attempt", async () => {
    const providers = createProviders({ mode: "fixture" });
    let marketCalls = 0;
    const fallback = fixtureSearchFetch();
    const fetchImpl = (async (input, init) => {
      const query = String(init?.body ?? "");
      if (/market statistics/i.test(query) && marketCalls++ === 0) {
        // Billed 200 with no usable citations.
        return jsonResponse({ ...SEARCH_MARKET_FIXTURE, search_results: [], citations: [] });
      }
      return fallback(input, init);
    }) as Fetcher;
    providers.search = createSearchProvider({ fetchImpl, apiKey: "fixture-mode" });

    const reservations: number[] = [];
    const { record } = await runResearch({
      brief: RFP_BRIEF,
      providers,
      mode: "fixture",
      assertCap: ({ spentMicroUsd }) => {
        reservations.push(spentMicroUsd);
      },
    });

    // brief, market ×2, competitors, community, extraction, keywords, editorial
    expect(reservations).toHaveLength(8);
    expect(record.provenance.attempts.market_stats).toBe(2);
    const failed = record.provenance.providerCalls.filter((c) => c.operation.endsWith(":failed"));
    expect(failed.map((c) => c.operation)).toEqual(["market_stats/search:sonar-pro:failed"]);
    expect(failed[0]?.costUsd).toBeGreaterThan(0);
    // The failed attempt's cost is in the spend the retry reservation sees.
    expect(reservations[2]).toBeGreaterThan(reservations[1] ?? Infinity);
    const total = record.provenance.providerCalls.reduce((sum, c) => sum + c.costUsd, 0);
    expect(record.provenance.costUsd).toBeCloseTo(total, 5);
  });

  it("runs the non-Reddit supplement when fewer than two community pages can be read", async () => {
    const pages = { ...FIXTURE_PAGES };
    delete pages[FIXTURE_URLS.hnThread];
    delete pages[FIXTURE_URLS.forumThread];
    const extraction = {
      ...FIXTURE_EXTRACTION,
      quotes: [
        {
          sourceUrl: FIXTURE_URLS.supplementThread,
          text: "Every buyer uses a different portal, so we retype the same approved answers again and again.",
        },
        {
          sourceUrl: FIXTURE_URLS.supplementThread,
          text: "The answers exist, but finding the version legal signed off on takes longer than writing them.",
        },
      ],
    };
    const providers = createFixtureProviders({ pages, synthesis: { extraction: () => extraction } });
    const queries: string[] = [];
    const realSearch = providers.search;
    providers.search = {
      ...realSearch,
      search: (request) => {
        queries.push(request.query);
        return realSearch.search(request);
      },
    };
    const { record } = await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(queries.filter((q) => /Earlier community citations were mostly unreadable/.test(q))).toHaveLength(1);
    expect(queries.some((q) => /Do NOT cite Reddit/.test(q))).toBe(true);
    expect(record.provenance.attempts.community_signals).toBe(2);
    const supplement = record.evidence.sources.find((s) => s.url === FIXTURE_URLS.supplementThread);
    expect(supplement).toMatchObject({ status: "read", roles: ["community"] });
    const quoteSources = record.community.quoteIds.map(
      (id) => record.evidence.accepted.find((e) => e.id === id)?.sourceUrl,
    );
    expect(quoteSources).toEqual([FIXTURE_URLS.supplementThread, FIXTURE_URLS.supplementThread]);
  });
});

// ---------------------------------------------------------------------------
// Review P3-10: the operator's brief owns title, slug and one-liner
// ---------------------------------------------------------------------------

describe("brief normalization (review P3-10)", () => {
  it("keeps the operator's title, slug, one-liner and audience when the model renames the idea", async () => {
    const providers = createFixtureProviders({
      synthesis: {
        brief: () => ({
          title: "Totally Different Idea",
          slug: "totally-different-idea",
          oneLiner: "Something else entirely.",
          audience: "everyone",
          model: "Usage-based API pricing for proposal teams",
          seedKeywords: [
            "RFP response software",
            "rfp response software",
            "https://evil.example/keyword",
            "see www.example.com",
            "x".repeat(81),
            "security questionnaire tool",
          ],
        }),
      },
    });
    const lookups: string[][] = [];
    const real = providers.keywordData;
    providers.keywordData = {
      ...real,
      lookup: (request) => {
        lookups.push([...request.keywords]);
        return real.lookup(request);
      },
    };
    const { record } = await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(record.brief).toEqual({
      title: RFP_BRIEF.title,
      slug: FIXTURE_BRIEF_SLUG,
      oneLiner: RFP_BRIEF.oneLiner,
      targetCustomer: RFP_BRIEF.audience,
    });
    // Keywords: deduplicated case-insensitively, no links, at most 80 characters.
    expect(lookups).toEqual([["RFP response software", "security questionnaire tool"]]);
  });

  it("keeps the operator's business model and keywords when the reply is out of bounds", async () => {
    const providers = createFixtureProviders({
      synthesis: { brief: () => ({ model: "See https://example.invalid/pricing", seedKeywords: ["https://a.example"] }) },
    });
    const lookups: string[][] = [];
    const real = providers.keywordData;
    providers.keywordData = {
      ...real,
      lookup: (request) => {
        lookups.push([...request.keywords]);
        return real.lookup(request);
      },
    };
    await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(lookups).toEqual([RFP_BRIEF.seedKeywords]);
  });

  it("refuses an operator title or audience with a figure before any paid call, naming the field (rulings R6, R13)", async () => {
    for (const [field, value, figure] of [
      // The v1 code-reviewer audience: the writer echoed it into five fields, and R13 counts "sub-10".
      ["audience", "Indie developers and sub-10 engineering teams maintaining GitHub repos", "10"],
      ["audience", "Sales teams of 8 answering security questionnaires", "8"],
      ["title", "Top 10 RFP Response Assistant", "10"],
      ["title", "RFP Assistant for two-person sales teams", "two"],
    ] as const) {
      const providers = createProviders({ mode: "fixture" });
      const requests = captureSynthesis(providers);
      const error = await failureOf(runResearch({ brief: { ...RFP_BRIEF, [field]: value }, providers, mode: "fixture" }));
      expect(error.stepId, value).toBe("brief_normalization");
      expect(error.message, value).toContain(`brief.${field}: figure "${figure}"`);
      expect(error.message, value).toMatch(/The writer reads the title and audience/);
      expect(requests, value).toHaveLength(0);
    }
  });

  it("passes every committed live brief (engine/briefs/*.json, not fixtures/) through the live-brief check", () => {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../engine/briefs");
    const files = readdirSync(dir).filter((file) => file.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) {
      const brief: unknown = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
      expect(() => normalizeBriefInput(brief as BriefInput), file).not.toThrow();
    }
  });

  it("refuses an operator one-liner with a figure or a quotation before any paid call (ruling R6)", async () => {
    for (const oneLiner of ["Cut RFP time by 60% for SMB sales teams.", "Drafts that sales teams call “the answer we always wanted” every week."]) {
      const providers = createProviders({ mode: "fixture" });
      const requests = captureSynthesis(providers);
      const error = await failureOf(runResearch({ brief: { ...RFP_BRIEF, oneLiner }, providers, mode: "fixture" }));
      expect(error.stepId).toBe("brief_normalization");
      expect(error.message).toMatch(/brief\.oneLiner: (?:figure|quotation)/);
      expect(requests).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Ruling R12: the code revision in the report and the record
// ---------------------------------------------------------------------------

describe("code revision (ruling R12)", () => {
  it("copies the caller's revision into the report and the record, and reports nulls when it is unknown", async () => {
    const codeRevision = { sha: "0123456789abcdef0123456789abcdef01234567", dirty: false };
    const { record, report } = await runResearch({ brief: RFP_BRIEF, providers: createProviders({ mode: "fixture" }), mode: "fixture", codeRevision });
    expect(report.codeRevision).toEqual(codeRevision);
    expect(record.provenance.codeRevision).toEqual(codeRevision);
    const unknown = await runResearch({ brief: RFP_BRIEF, providers: createProviders({ mode: "fixture" }), mode: "fixture" });
    expect(unknown.report.codeRevision).toEqual({ sha: null, dirty: null });
  });

  it("names the revision in a failure report too", async () => {
    const codeRevision = { sha: "a".repeat(40), dirty: true };
    const error = await failureOf(
      runResearch({ brief: RFP_BRIEF, providers: createFixtureProviders({ scenario: "thin-evidence" }), mode: "fixture", codeRevision }),
    );
    expect(error.report?.codeRevision).toEqual(codeRevision);
  });
});

// ---------------------------------------------------------------------------
// Ruling R11: fixture output stays out of publishing
// ---------------------------------------------------------------------------

describe("fixture slug (ruling R11)", () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

  it("matches no published idea: manifest, content, generated slugs or engine records", () => {
    const manifest: unknown = JSON.parse(readFileSync(path.join(repo, "ideas", "manifest.json"), "utf8"));
    const ideas = typeof manifest === "object" && manifest !== null && "ideas" in manifest && Array.isArray(manifest.ideas) ? manifest.ideas : [];
    const slugs = ideas.flatMap((idea: unknown) =>
      typeof idea === "object" && idea !== null && "slug" in idea && typeof idea.slug === "string" ? [idea.slug] : [],
    );
    expect(slugs.length).toBeGreaterThan(100);
    expect(slugs).not.toContain(FIXTURE_BRIEF_SLUG);
    expect(existsSync(path.join(repo, "content", "ideas", `${FIXTURE_BRIEF_SLUG}.mdx`))).toBe(false);
    expect(readFileSync(path.join(repo, "lib", "idea-slugs.generated.ts"), "utf8")).not.toContain(FIXTURE_BRIEF_SLUG);
    expect(existsSync(path.join(repo, "engine", "records", `${FIXTURE_BRIEF_SLUG}.json`))).toBe(false);
  });

  it("is the slug of every fixture brief, and of no live brief", () => {
    const fixtureDir = path.join(repo, FIXTURE_BRIEFS_DIR);
    const fixtureBriefs = readdirSync(fixtureDir).filter((f) => f.endsWith(".json"));
    expect(fixtureBriefs.sort()).toEqual(["rfp-assistant-thin-evidence.json", "rfp-assistant.json"]);
    for (const file of fixtureBriefs) {
      expect(JSON.parse(readFileSync(path.join(fixtureDir, file), "utf8")).slug, file).toBe(FIXTURE_BRIEF_SLUG);
    }
    const liveDir = path.join(repo, "engine", "briefs");
    for (const file of readdirSync(liveDir).filter((f) => f.endsWith(".json"))) {
      const brief: unknown = JSON.parse(readFileSync(path.join(liveDir, file), "utf8"));
      expect(brief, file).not.toHaveProperty("fixtureScenario");
      expect(typeof brief === "object" && brief !== null && "slug" in brief ? brief.slug : null, file).not.toBe(FIXTURE_BRIEF_SLUG);
    }
  });
});
