/**
 * Anti-slop guarantees for the idea engine, research-pipeline side
 * (PIPELINE_VERSION 2): quotes match their cited pages as contiguous spans,
 * page text feeds extraction only, and unreadable sources stop the run
 * before extraction spend.
 *
 * Changes from the split of quality.test.ts (WP46-S3 part 2), per test:
 * - Kept unchanged: "rewrites Reddit and HN URLs to their data endpoints",
 *   "widens the primary community prompt beyond Reddit", "names the fix when
 *   Reddit blocks the public endpoint", "falls back to the default user agent
 *   when the env value is empty".
 * - Moved at WP46 integration: "rejects a funnel that grows or pays more
 *   accounts than it has" now runs through readLegacyResearchRecordV1 in
 *   research-record.legacy.test.ts (the v1 parseYearOne helper became
 *   private to the history-only legacy reader; v2 funnel rules are in
 *   finance.test.ts and research-record.v2.test.ts).
 * - Matcher swapped to the contract's contiguous matcher (findContiguousSpan;
 *   quoteAppearsIn is removed), intent unchanged: "matches verbatim text
 *   across punctuation and curly quotes", "rejects a paraphrase", "reads every
 *   comment body from a Reddit listing", "uses Reddit's OAuth API when app
 *   credentials are set", "decodes numeric HTML entities before matching
 *   quotes".
 * - Rule changed by contract §5: "treats an ellipsis as an ordered elision"
 *   is now "rejects an internal ellipsis instead of joining fragments".
 * - Rewritten for the v2 flow, same intent: "leaves quotes unverified when the
 *   page cannot be fetched" (now: rejected as source_unreadable), "marks
 *   fixture quotes verified" (now: selected quotes are accepted spans of
 *   their pages), "fails closed when too few quotes are on their cited pages"
 *   (now at evidence_acceptance), "runs a non-Reddit supplement when the
 *   first pack is unreadable", "stops before keyword and synthesis spend when
 *   sources are unreadable" (now at source_acquisition, before extraction),
 *   "hands the fetched page text to synthesis" (now: to extraction, never to
 *   the writer), "keeps pricing cards and table rows apart in fetched page
 *   text" (now through acceptEvidence), "fits six long community pages into
 *   the synthesis byte budget" (now buildExtractionSources), "runs synthesis
 *   without exceeding its budget when pages are huge" (now the extraction
 *   budget).
 * - Removed, because the helper and its numeric-membership rule are gone
 *   (F5): "extracts numbers without thousands separators", "accepts figures
 *   present in the research text", "rejects a number the research never
 *   mentioned", "checks a figure against the source it cites, not every
 *   result", "ignores an untagged answer that cites several sources",
 *   "grounds a competitor price only on a line naming that competitor",
 *   "uses fetched page text to ground a competitor price", "never treats URL
 *   or marker digits as evidence". Whole-claim acceptance replaces them
 *   (evidence/amount.test.ts, evidence/accept.test.ts, F5 rows through the
 *   pipeline in pipeline.evidence.test.ts).
 * - Removed, because search answer prose no longer travels (dropped at the
 *   search step, F1): "prefers non-Reddit URLs when merging search packs",
 *   "renumbers [n] markers so merged evidence stays with its own source"
 *   (mergeSearchPacks is gone; prose absence is asserted in
 *   pipeline.evidence.test.ts).
 * - Removed, because the behaviour no longer exists: "drops a malformed
 *   year-one plan instead of failing the whole run" — a malformed plan now
 *   fails the v2 record parse and gets one regeneration
 *   (research-record.v2.test.ts, pipeline.evidence.test.ts).
 */

import { describe, expect, it } from "vitest";

import { findContiguousSpan } from "./evidence/quote.ts";
import { acceptEvidence } from "./evidence/accept.ts";
import {
  communitySearchQuery,
  EDITORIAL_INSTRUCTIONS,
  EXTRACTION_INSTRUCTIONS,
  PipelineError,
  runResearch,
  stepInputBudgetBytes,
  type BriefInput,
} from "./pipeline.ts";
import { buildExtractionSources, utf8Bytes, type ExtractionSource } from "./pipeline-sources.ts";
import { stepById } from "./pipeline-steps.ts";
import {
  createFixtureProviders,
  FIXTURE_BRIEF_SLUG,
  FIXTURE_EXTRACTION,
  FIXTURE_PAGES,
  FIXTURE_URLS,
  fixtureSourceText,
  type FixtureProviderOptions,
} from "./providers/fixtures.ts";
import { createSourceTextProvider, hnApiUrl, htmlToText, redditJsonUrl } from "./providers/sourceText.ts";
import type { EngineProviders, SynthesisRequest } from "./providers/types.ts";

/** Stub resolver: every host is public (keeps tests off the network). */
const PUBLIC_DNS = async () => ["93.184.215.14"];

const BRIEF: BriefInput = {
  title: "AI RFP Response Assistant",
  audience: "SMB SaaS sales and solutions engineers",
  revenueModel: "Seat-based SaaS with usage caps",
  seedKeywords: [
    "rfp response software",
    "security questionnaire automation",
    "proposal management software",
  ],
  slug: FIXTURE_BRIEF_SLUG,
  oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
};

const matches = (quote: string, text: string) => findContiguousSpan(quote, text).ok;

type Counted = { providers: EngineProviders; synthesis: SynthesisRequest[]; keywordLookups: () => number };

function counted(options: FixtureProviderOptions = {}): Counted {
  const providers = createFixtureProviders(options);
  const synthesis: SynthesisRequest[] = [];
  let lookups = 0;
  const realSynthesis = providers.synthesis;
  const realKeywords = providers.keywordData;
  providers.synthesis = {
    ...realSynthesis,
    complete: (request) => {
      synthesis.push(request);
      return realSynthesis.complete(request);
    },
  };
  providers.keywordData = {
    ...realKeywords,
    lookup: (request) => {
      lookups += 1;
      return realKeywords.lookup(request);
    },
  };
  return { providers, synthesis, keywordLookups: () => lookups };
}

async function failureOf(promise: Promise<unknown>): Promise<PipelineError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof PipelineError)) throw new Error(`expected a PipelineError, got ${String(error)}`);
  return error;
}

describe("quote matching", () => {
  const page =
    "OP: It’s pretty common to get 2 business days or less to answer upwards of 300 essay questions. Anyway...";

  it("matches verbatim text across punctuation and curly quotes", () => {
    expect(
      matches("it's pretty common to get 2 business days or less to answer upwards of 300 essay questions", page),
    ).toBe(true);
  });

  it("rejects a paraphrase", () => {
    expect(matches("Teams often get two business days to answer 300 essay questions", page)).toBe(false);
  });

  it("rejects an internal ellipsis instead of joining fragments", () => {
    expect(findContiguousSpan("pretty common to get … upwards of 300 essay questions", page)).toEqual({
      ok: false,
      reason: "internal_ellipsis",
    });
    expect(findContiguousSpan("upwards of 300 essay questions … pretty common to get", page)).toEqual({
      ok: false,
      reason: "internal_ellipsis",
    });
  });

  it("rewrites Reddit and HN URLs to their data endpoints", () => {
    expect(
      redditJsonUrl("https://www.reddit.com/r/salesengineers/comments/suy7ae/rfp_responses/"),
    ).toBe(
      "https://www.reddit.com/r/salesengineers/comments/suy7ae/rfp_responses.json?limit=500&raw_json=1",
    );
    expect(redditJsonUrl("https://www.reddit.com/r/sales/")).toBeNull();
    expect(hnApiUrl("https://news.ycombinator.com/item?id=27515468")).toBe(
      "https://hn.algolia.com/api/v1/items/27515468",
    );
  });

  it("reads every comment body from a Reddit listing", async () => {
    const listing = [
      { data: { children: [{ data: { title: "RFPs", selftext: "post body" } }] } },
      {
        data: {
          children: [
            { data: { body: "It's the most tedious part of my job.", replies: "" } },
          ],
        },
      },
    ];
    const provider = createSourceTextProvider({
      resolveHost: PUBLIC_DNS,
      fetchImpl: async () => new Response(JSON.stringify(listing), { status: 200 }),
    });
    const text = await provider.fetchText(
      "https://www.reddit.com/r/salesengineers/comments/17617vr/how_much/",
    );
    expect(matches("It's the most tedious part of my job.", text)).toBe(true);
  });

  it("rejects quotes whose page cannot be read", async () => {
    const { record } = await runResearch({ brief: BRIEF, providers: createFixtureProviders(), mode: "fixture" });
    const reddit = record.evidence.rejected.find((r) => r.sourceUrl?.includes("reddit.com"));
    expect(reddit?.reason).toBe("source_unreadable");
    expect(record.evidence.accepted.some((e) => e.sourceUrl.includes("reddit.com"))).toBe(false);
  });
});

describe("pipeline quote verification", () => {
  it("selects only quotes accepted as spans of their cited pages", async () => {
    const { record } = await runResearch({ brief: BRIEF, providers: createFixtureProviders(), mode: "fixture" });
    expect(record.community.quoteIds.length).toBeGreaterThanOrEqual(2);
    for (const id of record.community.quoteIds) {
      const item = record.evidence.accepted.find((e) => e.id === id);
      expect(item?.kind).toBe("community_quote");
      expect(FIXTURE_PAGES[item?.sourceUrl ?? ""]).toContain(item?.excerpt ?? "\u0000");
    }
  });

  it("fails closed when too few quotes are on their cited pages", async () => {
    const pages = {
      ...FIXTURE_PAGES,
      [FIXTURE_URLS.hnThread]: "nothing relevant here",
      [FIXTURE_URLS.forumThread]: "nor here",
    };
    const error = await failureOf(
      runResearch({ brief: BRIEF, providers: createFixtureProviders({ pages }), mode: "fixture" }),
    );
    expect(error.stepId).toBe("evidence_acceptance");
    expect(error.message).toMatch(/community quotes: 0 distinct accepted, need 2/);
  });
});

describe("community page reads", () => {
  it("widens the primary community prompt beyond Reddit", () => {
    const q = communitySearchQuery("Brief: test", "primary");
    expect(q).toMatch(/Hacker News/);
    expect(q).toMatch(/Discourse|forum/i);
    expect(q).toMatch(/verbatim/i);
    expect(q).toMatch(/Avoid YouTube/);
    const s = communitySearchQuery("Brief: test", "supplement");
    expect(s).toMatch(/Do NOT cite Reddit/);
    expect(s).toMatch(/Hacker News/);
  });

  it("runs a non-Reddit supplement when the first pack is unreadable", async () => {
    const hn = "https://news.ycombinator.com/item?id=27515468";
    const ih = "https://www.indiehackers.com/post/how-we-handle-security-questionnaires";
    const providers = createFixtureProviders({
      synthesis: {
        extraction: () => ({
          ...FIXTURE_EXTRACTION,
          quotes: [
            { sourceUrl: hn, text: "Loopio is great if you have a proposal team; we do not." },
            { sourceUrl: ih, text: "We burn weekends answering the same SOC2 questionnaire." },
          ],
        }),
      },
    });
    const queries: string[] = [];
    let communityCalls = 0;
    const realSearch = providers.search;
    const searchCost = {
      role: "search" as const,
      provider: "perplexity",
      billedAs: "sonar-pro",
      usd: 0.01,
      estimated: true,
      units: { requests: 1 },
    };
    providers.search = {
      ...realSearch,
      search: async (req) => {
        queries.push(req.query);
        if (/pain evidence/i.test(req.query)) {
          communityCalls += 1;
          if (communityCalls === 1) {
            // First pack: Reddit only → unreadable without OAuth.
            return {
              value: {
                text: "Reddit-only pain [1].",
                citations: [{ url: "https://www.reddit.com/r/sales/comments/abc/thread/", title: "r/sales" }],
                inputTokens: 10,
                outputTokens: 10,
                requests: 1,
              },
              cost: searchCost,
            };
          }
          // Supplement: fetchable HN + Indie Hackers.
          return {
            value: {
              text: "HN and IH pain [1][2].",
              citations: [
                { url: hn, title: "HN" },
                { url: ih, title: "IH" },
              ],
              inputTokens: 10,
              outputTokens: 10,
              requests: 1,
            },
            cost: searchCost,
          };
        }
        return realSearch.search(req);
      },
    };
    const fixturePages = fixtureSourceText();
    providers.sourceText = {
      async fetchText(url: string) {
        if (url.includes("reddit.com")) throw new Error("HTTP 403 (Reddit blocks this network)");
        if (url.includes("ycombinator.com")) return "Loopio is great if you have a proposal team; we do not.";
        if (url.includes("indiehackers.com")) return "We burn weekends answering the same SOC2 questionnaire.";
        return fixturePages.fetchText(url);
      },
    };
    const { record } = await runResearch({ brief: BRIEF, providers, mode: "fixture" });
    expect(communityCalls).toBe(2);
    expect(queries.some((q) => /Do NOT cite Reddit/.test(q))).toBe(true);
    expect(record.community.quoteIds).toHaveLength(2);
    const sources = record.community.quoteIds.map((id) => record.evidence.accepted.find((e) => e.id === id)?.sourceUrl);
    expect(sources.sort()).toEqual([ih, hn].sort());
  });

  it("uses Reddit's OAuth API when app credentials are set", async () => {
    const calls: string[] = [];
    const listing = [
      { data: { children: [{ data: { title: "RFPs", selftext: "" } }] } },
      { data: { children: [{ data: { body: "It's the most tedious part of my job." } }] } },
    ];
    const provider = createSourceTextProvider({
      redditClientId: "id",
      redditClientSecret: "secret",
      resolveHost: PUBLIC_DNS,
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.endsWith("/api/v1/access_token")) {
          return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        }
        return new Response(JSON.stringify(listing), { status: 200 });
      },
    });
    const text = await provider.fetchText(
      "https://www.reddit.com/r/salesengineers/comments/17617vr/how_much/",
    );
    expect(matches("It's the most tedious part of my job.", text)).toBe(true);
    expect(calls).toEqual([
      "https://www.reddit.com/api/v1/access_token",
      "https://oauth.reddit.com/r/salesengineers/comments/17617vr/how_much?limit=500&raw_json=1",
    ]);
  });

  it("names the fix when Reddit blocks the public endpoint", async () => {
    const provider = createSourceTextProvider({
      redditClientId: "",
      redditClientSecret: "",
      resolveHost: PUBLIC_DNS,
      fetchImpl: async () => new Response("blocked", { status: 403 }),
    });
    await expect(
      provider.fetchText("https://www.reddit.com/r/x/comments/abc/y/"),
    ).rejects.toThrow(/REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET/);
  });

  it("stops before extraction, keyword and editorial spend when no source can be read", async () => {
    const run = counted({ pages: {} });
    const error = await failureOf(runResearch({ brief: BRIEF, providers: run.providers, mode: "fixture" }));
    expect(error.stepId).toBe("source_acquisition");
    expect(error.message).toMatch(/none of the \d+ cited pages could be read.*stopped before evidence extraction spend/);
    expect(run.keywordLookups()).toBe(0);
    // Only the brief-normalization call ran; extraction and the writer never did.
    expect(run.synthesis).toHaveLength(1);
  });

  it("hands fetched page text to extraction, never to the writer", async () => {
    const run = counted();
    await runResearch({ brief: BRIEF, providers: run.providers, mode: "fixture" });
    const extraction = run.synthesis.find((r) => r.instructions === EXTRACTION_INSTRUCTIONS)?.input ?? "";
    const editorial = run.synthesis.find((r) => r.instructions === EDITORIAL_INSTRUCTIONS)?.input ?? "";
    expect(extraction).toContain("## Sources");
    expect(extraction).toContain(`URL: ${FIXTURE_URLS.hnThread}`);
    // A page line no candidate used: on its way to extraction only.
    const unused = "The big proposal tools assume you have a proposal team, and we are three sales engineers.";
    expect(extraction).toContain(unused);
    expect(editorial).not.toContain(unused);
    expect(editorial).not.toContain("## Sources");
  });
});

describe("pricing cards and table rows", () => {
  it("keeps each vendor's price with that vendor in fetched page text", () => {
    const pages = {
      cards: htmlToText('<div class="card">Loopio $388/mo</div><div class="card">Responsive $99/mo</div>'),
      table: htmlToText(
        "<table><tr><td>Loopio</td><td>$388/mo</td></tr><tr><td>Responsive</td><td>$99/mo</td></tr></table>",
      ),
    };
    for (const [name, text] of Object.entries(pages)) {
      const url = `https://${name}.example.com/rfp-tools-compared`;
      const [loopioLine = "", responsiveLine = ""] = text.split("\n").map((line) => line.trim()).filter(Boolean);
      const result = acceptEvidence({
        candidates: {
          quotes: [],
          marketStats: [],
          competitorPrices: [
            { vendor: "Loopio", sourceUrl: url, supportingText: loopioLine, priceText: "$388/mo" },
            { vendor: "Loopio", sourceUrl: url, supportingText: responsiveLine, priceText: "$99/mo" },
            { vendor: "Responsive", sourceUrl: url, supportingText: responsiveLine, priceText: "$99/mo" },
          ],
        },
        citations: [{ url, title: name }],
        sources: new Map([[url, { status: "read", text, retrievedAt: "2026-10-01T00:00:00.000Z" }]]),
      });
      const accepted = result.accepted.map((e) => (e.kind === "competitor_price" ? `${e.vendor} ${e.price.amount.value}` : ""));
      expect(accepted, name).toEqual(["Loopio 388", "Responsive 99"]);
      // Another vendor's price is never credited to Loopio.
      expect(result.rejected.map((r) => r.reason), name).toEqual(["ambiguous_attribution"]);
    }
    // A quote across a line break still matches.
    expect(matches("same SOC2 questionnaire every week", htmlToText("same SOC2<br>questionnaire every week"))).toBe(true);
  });
});

describe("CodeRabbit regressions", () => {
  it("fits six long community pages into the extraction byte budget", () => {
    const pages: ExtractionSource[] = Array.from({ length: 6 }, (_, i) => ({
      url: `https://www.reddit.com/r/x/comments/${i}/thread`,
      title: `thread ${i}`,
      roles: ["community"],
      text: "é".repeat(50_000),
    }));
    const available = 30_000;
    const section = buildExtractionSources(pages, available);
    expect(utf8Bytes(section.text)).toBeLessThanOrEqual(available);
    expect(section.text.match(/^### Source /gm)?.length).toBe(6);
    // No room at all → no section, never an oversized one.
    expect(buildExtractionSources(pages, 500)).toEqual({ text: "", included: 0 });
  });

  it("runs extraction within its budget when pages are huge", async () => {
    const pages = {
      ...FIXTURE_PAGES,
      [FIXTURE_URLS.hnThread]: `${FIXTURE_PAGES[FIXTURE_URLS.hnThread] ?? ""}\n${"y ".repeat(80_000)}`,
      [FIXTURE_URLS.forumThread]: `${FIXTURE_PAGES[FIXTURE_URLS.forumThread] ?? ""}\n${"x ".repeat(80_000)}`,
    };
    const run = counted({ pages });
    const { record } = await runResearch({ brief: BRIEF, providers: run.providers, mode: "fixture" });
    expect(record.community.quoteIds.length).toBeGreaterThanOrEqual(2);
    const extraction = run.synthesis.find((r) => r.instructions === EXTRACTION_INSTRUCTIONS);
    expect(utf8Bytes(EXTRACTION_INSTRUCTIONS) + utf8Bytes(extraction?.input ?? "")).toBeLessThanOrEqual(
      stepInputBudgetBytes(stepById("evidence_extraction")),
    );
  });

  it("decodes numeric HTML entities before matching quotes", () => {
    const text = htmlToText("<p>Our CI&#x2F;CD pipeline doesn&#39;t catch it &amp; we ship</p>");
    expect(matches("Our CI/CD pipeline doesn't catch it & we ship", text)).toBe(true);
    expect(htmlToText("&amp;lt;")).toBe("&lt;");
  });

  it("falls back to the default user agent when the env value is empty", async () => {
    const seen: string[] = [];
    const provider = createSourceTextProvider({
      userAgent: "   ",
      resolveHost: PUBLIC_DNS,
      fetchImpl: async (_url, init) => {
        seen.push(new Headers(init?.headers).get("user-agent") ?? "");
        return new Response("<p>hi</p>", { status: 200 });
      },
    });
    await provider.fetchText("https://example.com/page");
    expect(seen[0]).toMatch(/^weekendmvp-idea-engine\//);
  });
});
