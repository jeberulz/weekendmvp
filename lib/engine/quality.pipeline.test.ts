/**
 * Anti-slop guarantees for the idea engine, research-pipeline side: quotes
 * are verified against their cited pages and figures are grounded in the
 * research text. Split mechanically from quality.test.ts (WP46-S3): test
 * bodies and assertions are unchanged.
 */

import { describe, expect, it } from "vitest";

import {
  buildSourcePagesSection,
  citationEvidence,
  communitySearchQuery,
  figureTokens,
  isGroundedFigure,
  isGroundedForCompetitor,
  isRedditUrl,
  mergeSearchPacks,
  MIN_VERIFIED_SIGNALS,
  PipelineError,
  runResearch,
  verifySignals,
  type BriefInput,
} from "./pipeline.ts";
import { createProviders } from "./providers.ts";
import { fixtureSourceText } from "./providers/fixtures.ts";
import {
  createSourceTextProvider,
  hnApiUrl,
  htmlToText,
  quoteAppearsIn,
  redditJsonUrl,
} from "./providers/sourceText.ts";
import { parseYearOne } from "./research-record.ts";

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
  slug: "ai-rfp-response-assistant",
  oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
};

describe("quote matching", () => {
  const page =
    "OP: It’s pretty common to get 2 business days or less to answer upwards of 300 essay questions. Anyway...";

  it("matches verbatim text across punctuation and curly quotes", () => {
    expect(
      quoteAppearsIn(
        "it's pretty common to get 2 business days or less to answer upwards of 300 essay questions",
        page,
      ),
    ).toBe(true);
  });

  it("rejects a paraphrase", () => {
    expect(
      quoteAppearsIn(
        "Teams often get two business days to answer 300 essay questions",
        page,
      ),
    ).toBe(false);
  });

  it("treats an ellipsis as an ordered elision", () => {
    expect(
      quoteAppearsIn("pretty common to get … upwards of 300 essay questions", page),
    ).toBe(true);
    expect(
      quoteAppearsIn("upwards of 300 essay questions … pretty common to get", page),
    ).toBe(false);
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
    expect(quoteAppearsIn("It's the most tedious part of my job.", text)).toBe(true);
  });

  it("leaves quotes unverified when the page cannot be fetched", async () => {
    const out = await verifySignals(
      [
        {
          quote: "We burn weekends answering the same SOC2 questionnaire.",
          citation: { url: "https://blocked.example/", title: "x" },
        },
      ],
      fixtureSourceText({}),
    );
    expect(out[0]!.verified).toBe(false);
  });
});

describe("pipeline quote verification", () => {
  it("marks fixture quotes verified", async () => {
    const record = await runResearch({
      brief: BRIEF,
      providers: createProviders({ mode: "fixture" }),
    });
    expect(record.community.signals.every((s) => s.verified === true)).toBe(true);
  });

  it("fails closed when too few quotes are on their cited pages", async () => {
    const providers = createProviders({ mode: "fixture" });
    providers.sourceText = fixtureSourceText({
      "https://news.ycombinator.com/item?id=27515468": "nothing relevant here",
      "https://www.indiehackers.com/post/how-we-handle-security-questionnaires": "nor here",
      "https://www.reddit.com/r/sales/": "still nothing",
    });
    const error = await runResearch({ brief: BRIEF, providers }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PipelineError);
    expect((error as PipelineError).message).toMatch(
      new RegExp(`quote verification: 0/2 .*need ≥${MIN_VERIFIED_SIGNALS}`),
    );
  });
});

describe("figure grounding", () => {
  const hay = "The market was $1.8 billion in 2025, reaching $9.4 billion by 2034 (20.2% CAGR). Plans from $1,300.";

  it("extracts numbers without thousands separators", () => {
    expect(figureTokens("$1,300/mo and 20.2%")).toEqual(["1300", "20.2"]);
  });

  it("accepts figures present in the research text", () => {
    expect(isGroundedFigure("$1.8B in 2025; $9.4B by 2034", hay)).toBe(true);
    expect(isGroundedFigure("from $1,300 per year", hay)).toBe(true);
    expect(isGroundedFigure("Custom quote", hay)).toBe(true);
  });

  it("rejects a number the research never mentioned", () => {
    expect(isGroundedFigure("$1.22 billion in 2025", hay)).toBe(false);
    // 1.8 must not match inside 21.8 or 1.85
    expect(isGroundedFigure("$21.8B", hay)).toBe(false);
  });
});

describe("record validation", () => {
  it("rejects a funnel that grows or pays more accounts than it has", () => {
    const issues: string[] = [];
    parseYearOne(
      {
        funnel: [
          { stage: "a", count: 10 },
          { stage: "b", count: 20 },
        ],
        tier: "Team",
        payingAccounts: 50,
        monthlyRevenuePerAccount: 10,
      },
      issues,
    );
    expect(issues.join(" ")).toMatch(/must not grow/);
    expect(issues.join(" ")).toMatch(/exceeds the last funnel stage/);
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

  it("prefers non-Reddit URLs when merging search packs", () => {
    expect(isRedditUrl("https://www.reddit.com/r/x/comments/a/b/")).toBe(true);
    expect(isRedditUrl("https://news.ycombinator.com/item?id=1")).toBe(false);
    const merged = mergeSearchPacks(
      {
        text: "a",
        citations: [
          { url: "https://www.reddit.com/r/sales/", title: "reddit" },
          { url: "https://news.ycombinator.com/item?id=1", title: "hn" },
        ],
      },
      {
        text: "b",
        citations: [
          {
            url: "https://www.indiehackers.com/post/x",
            title: "ih",
          },
        ],
      },
    );
    expect(merged.citations.map((c) => c.url)).toEqual([
      "https://news.ycombinator.com/item?id=1",
      "https://www.indiehackers.com/post/x",
      "https://www.reddit.com/r/sales/",
    ]);
  });

  it("renumbers [n] markers so merged evidence stays with its own source", () => {
    const reddit = "https://www.reddit.com/r/sales/";
    const hn = "https://news.ycombinator.com/item?id=1";
    const ih = "https://www.indiehackers.com/post/x";
    const merged = mergeSearchPacks(
      {
        text: "Teams spend 40 hours a quarter on this [1]. HN says $99/mo [2].",
        citations: [
          { url: reddit, title: "reddit" },
          { url: hn, title: "hn" },
        ],
      },
      { text: "Indie Hackers reports 12 customers [1].", citations: [{ url: ih, title: "ih" }] },
    );
    expect(merged.citations.map((c) => c.url)).toEqual([hn, ih, reddit]);
    const evidence = citationEvidence([merged]);
    expect(evidence.get(hn)).toContain("$99/mo");
    expect(evidence.get(hn)).not.toContain("40 hours");
    expect(evidence.get(ih)).toContain("12 customers");
    expect(evidence.get(reddit)).toContain("40 hours");
  });

  it("runs a non-Reddit supplement when the first pack is unreadable", async () => {
    const providers = createProviders({ mode: "fixture" });
    const queries: string[] = [];
    const realSearch = providers.search;
    let communityCalls = 0;
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
        if (/pain|verbatim|community|quote|Hacker News/i.test(req.query)) {
          communityCalls += 1;
          if (communityCalls === 1) {
            // First pack: Reddit only → unreadable without OAuth.
            return {
              value: {
                text: "Reddit-only pain [1].",
                citations: [
                  {
                    url: "https://www.reddit.com/r/sales/comments/abc/thread/",
                    title: "r/sales",
                  },
                ],
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
                {
                  url: "https://news.ycombinator.com/item?id=27515468",
                  title: "HN",
                },
                {
                  url: "https://www.indiehackers.com/post/how-we-handle-security-questionnaires",
                  title: "IH",
                },
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
    providers.sourceText = {
      async fetchText(url: string) {
        if (url.includes("reddit.com")) {
          throw new Error("HTTP 403 (Reddit blocks this network)");
        }
        if (url.includes("ycombinator.com")) {
          return "Loopio is great if you have a proposal team; we do not.";
        }
        if (url.includes("indiehackers.com")) {
          return "We burn weekends answering the same SOC2 questionnaire.";
        }
        throw new Error(`unexpected ${url}`);
      },
    };
    const record = await runResearch({ brief: BRIEF, providers });
    expect(communityCalls).toBe(2);
    expect(queries.some((q) => /Do NOT cite Reddit/.test(q))).toBe(true);
    expect(
      record.community.signals.filter((s) => s.verified).length,
    ).toBeGreaterThanOrEqual(2);
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
    expect(quoteAppearsIn("It's the most tedious part of my job.", text)).toBe(true);
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

  it("stops before keyword and synthesis spend when sources are unreadable", async () => {
    const providers = createProviders({ mode: "fixture" });
    providers.sourceText = fixtureSourceText({});
    let keywordLookups = 0;
    const realKeywords = providers.keywordData;
    providers.keywordData = {
      ...realKeywords,
      lookup: (req) => {
        keywordLookups += 1;
        return realKeywords.lookup(req);
      },
    };
    const realSynthesis = providers.synthesis;
    let synthesisCalls = 0;
    providers.synthesis = {
      ...realSynthesis,
      complete: (req) => {
        synthesisCalls += 1;
        return realSynthesis.complete(req);
      },
    };
    const error = await runResearch({ brief: BRIEF, providers }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PipelineError);
    expect((error as PipelineError).stepId).toBe("community_signals");
    expect((error as PipelineError).message).toMatch(
      /only 0\/\d+ cited community pages could be read.*Stopped before keyword and synthesis spend/,
    );
    expect(keywordLookups).toBe(0);
    // Only the brief-normalization call ran; the paid synthesis never did.
    expect(synthesisCalls).toBe(1);
  });

  it("hands the fetched page text to synthesis", async () => {
    const providers = createProviders({ mode: "fixture" });
    const inputs: string[] = [];
    const realSynthesis = providers.synthesis;
    providers.synthesis = {
      ...realSynthesis,
      complete: (req) => {
        inputs.push(req.input);
        return realSynthesis.complete(req);
      },
    };
    await runResearch({ brief: BRIEF, providers });
    const synthesisInput = inputs[inputs.length - 1]!;
    expect(synthesisInput).toContain("## Community source pages");
    expect(synthesisInput).toContain(
      "### https://news.ycombinator.com/item?id=27515468",
    );
  });
});

describe("figure grounding per citation", () => {
  const pack = {
    text: "The AI code review market was $1.8 billion in 2025 [1]. Secure code review hit $1.22 billion [2].",
    citations: [
      { url: "https://a.example/report-2031", title: "A", snippet: "AI code review tools" },
      { url: "https://b.example/secure", title: "B" },
    ],
  };

  it("checks a figure against the source it cites, not every result", () => {
    const evidence = citationEvidence([pack]);
    expect(isGroundedFigure("$1.8 billion in 2025", evidence.get("https://a.example/report-2031")!)).toBe(true);
    // $1.22B appears only in source B's sentence, so citing A fails.
    expect(isGroundedFigure("$1.22 billion", evidence.get("https://a.example/report-2031")!)).toBe(false);
    expect(isGroundedFigure("$1.22 billion", evidence.get("https://b.example/secure")!)).toBe(true);
  });

  it("ignores an untagged answer that cites several sources", () => {
    const evidence = citationEvidence([
      {
        text: "Market A was $1.8 billion; market B was $1.22 billion.",
        citations: [
          { url: "https://a.example/one", title: "A", snippet: "AI code review tools" },
          { url: "https://b.example/two", title: "B" },
        ],
      },
    ]);
    expect(isGroundedFigure("$1.22 billion", evidence.get("https://a.example/one")!)).toBe(false);
    expect(isGroundedFigure("$1.8 billion", evidence.get("https://b.example/two")!)).toBe(false);
  });

  it("grounds a competitor price only on a line naming that competitor", () => {
    const text =
      "Loopio starts at $388/mo [1]. Responsive costs $99/mo [2].\n| Inventive.ai | $49/mo |";
    expect(isGroundedForCompetitor("$388/mo", "Loopio", text)).toBe(true);
    expect(isGroundedForCompetitor("$99/mo", "Responsive", text)).toBe(true);
    expect(isGroundedForCompetitor("$49/mo", "Inventive.ai", text)).toBe(true);
    // The whole-pack check this replaces matched any vendor's price.
    expect(isGroundedFigure("$388/mo", text)).toBe(true);
    // Another vendor's price is not credited to this one.
    expect(isGroundedForCompetitor("$388/mo", "Responsive", text)).toBe(false);
    expect(isGroundedForCompetitor("$99/mo", "Loopio", text)).toBe(false);
  });

  it("keeps pricing cards and table rows apart in fetched page text", () => {
    const cards = htmlToText(
      '<div class="card">Loopio $388/mo</div><div class="card">Responsive $99/mo</div>',
    );
    expect(isGroundedForCompetitor("$388/mo", "Loopio", cards)).toBe(true);
    expect(isGroundedForCompetitor("$99/mo", "Loopio", cards)).toBe(false);
    const table = htmlToText(
      "<table><tr><td>Loopio</td><td>$388/mo</td></tr><tr><td>Responsive</td><td>$99/mo</td></tr></table>",
    );
    expect(isGroundedForCompetitor("$99/mo", "Responsive", table)).toBe(true);
    expect(isGroundedForCompetitor("$388/mo", "Responsive", table)).toBe(false);
    // A quote across a line break still matches.
    expect(quoteAppearsIn("same SOC2 questionnaire every week", htmlToText("same SOC2<br>questionnaire every week"))).toBe(true);
  });

  it("uses fetched page text to ground a competitor price", () => {
    const evidence = citationEvidence(
      [
        {
          text: "Loopio is an enterprise player [1].",
          citations: [
            {
              url: "https://loopio.com/pricing/",
              title: "Loopio",
              snippet: "enterprise proposal software",
            },
          ],
        },
      ],
      new Map([
        [
          "https://loopio.com/pricing/",
          "Team plan starts at $388 per month billed annually.",
        ],
      ]),
    );
    expect(
      isGroundedFigure("$388/mo", evidence.get("https://loopio.com/pricing/")!),
    ).toBe(true);
    // Without page text, the snippet alone has no price.
    const snippetsOnly = citationEvidence([
      {
        text: "Loopio is an enterprise player [1].",
        citations: [
          {
            url: "https://loopio.com/pricing/",
            title: "Loopio",
            snippet: "enterprise proposal software",
          },
        ],
      },
    ]);
    expect(
      isGroundedFigure(
        "$388/mo",
        snippetsOnly.get("https://loopio.com/pricing/")!,
      ),
    ).toBe(false);
  });

  it("never treats URL or marker digits as evidence", () => {
    const evidence = citationEvidence([pack]);
    expect(isGroundedFigure("by 2031", evidence.get("https://a.example/report-2031")!)).toBe(false);
  });

  it("drops a malformed year-one plan instead of failing the whole run", () => {
    const issues: string[] = [];
    const plan = parseYearOne(
      {
        funnel: [
          { stage: "leads", count: 10 },
          { stage: "trials", count: 20 },
        ],
        tier: "Team",
        payingAccounts: 5,
        monthlyRevenuePerAccount: 99,
      },
      issues,
    );
    expect(plan).toBeUndefined();
    expect(issues.join(" ")).toMatch(/must not grow/);
  });
});

describe("CodeRabbit regressions", () => {
  it("fits six long community pages into the synthesis byte budget", () => {
    const pages = new Map(
      Array.from({ length: 6 }, (_, i) => [
        `https://www.reddit.com/r/x/comments/${i}/thread/`,
        { text: "é".repeat(50_000) },
      ]),
    );
    const available = 30_000;
    const section = buildSourcePagesSection(pages, available);
    const bytes = new TextEncoder().encode(`\n\n${section}`).length;
    expect(bytes).toBeLessThanOrEqual(available);
    expect(section.match(/^### /gm)?.length).toBe(6);
    // No room at all → no section, never an oversized one.
    expect(buildSourcePagesSection(pages, 500)).toBe("");
  });

  it("runs synthesis without exceeding its budget when pages are huge", async () => {
    const providers = createProviders({ mode: "fixture" });
    const huge = "We burn weekends answering the same SOC2 questionnaire. " + "x ".repeat(80_000);
    providers.sourceText = fixtureSourceText({
      "https://news.ycombinator.com/item?id=27515468":
        "Loopio is great if you have a proposal team; we do not. " + "y ".repeat(80_000),
      "https://www.indiehackers.com/post/how-we-handle-security-questionnaires": huge,
      "https://www.reddit.com/r/sales/": huge,
    });
    const record = await runResearch({ brief: BRIEF, providers });
    expect(record.community.signals.filter((s) => s.verified).length).toBeGreaterThanOrEqual(2);
  });

  it("decodes numeric HTML entities before matching quotes", () => {
    const text = htmlToText("<p>Our CI&#x2F;CD pipeline doesn&#39;t catch it &amp; we ship</p>");
    expect(quoteAppearsIn("Our CI/CD pipeline doesn't catch it & we ship", text)).toBe(true);
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
