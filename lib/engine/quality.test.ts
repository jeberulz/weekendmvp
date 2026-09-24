/**
 * Anti-slop guarantees for the idea engine: quotes are verified against
 * their cited pages, figures are grounded in the research text, the
 * compiler never breaks links, and revenue math is arithmetic.
 */

import { describe, expect, it } from "vitest";

import {
  collapseDuplicateSentences,
  compileResearchRecord,
  midSentence,
  yearOneLines,
} from "./compile.ts";
import {
  buildSourcePagesSection,
  citationEvidence,
  figureTokens,
  isGroundedFigure,
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
  isBlockedAddress,
  publicOnlyFetch,
  quoteAppearsIn,
  redditJsonUrl,
} from "./providers/sourceText.ts";
import { parseResearchRecord, parseYearOne } from "./research-record.ts";

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
      "https://www.reddit.com/r/sales/": "nothing relevant here",
      "https://news.ycombinator.com/": "nor here",
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

describe("compiler hygiene", () => {
  it("never splits a markdown link when collapsing duplicate sentences", () => {
    const link =
      "[my reviewer was useless until i made it earn the right to comment. what changed](https://www.reddit.com/r/LLMDevs/comments/1v5dveb/x/)";
    const text = [
      `> "quote one"\n>\n> — ${link}`,
      "",
      `See ${link} for the long version of this whole thread today.`,
      "",
      `- ${link}`,
    ].join("\n");
    const out = collapseDuplicateSentences(text);
    expect(out.split(link).length - 1).toBe(3);
  });

  it("still drops a repeated prose sentence", () => {
    const s = "This exact sentence has more than eight words in it.";
    expect(collapseDuplicateSentences(`${s} ${s}`).trim()).toBe(s);
  });

  it("lowercases audience labels mid-sentence but keeps acronyms", () => {
    expect(midSentence("Indie developers and sub-10 teams")).toBe(
      "indie developers and sub-10 teams",
    );
    expect(midSentence("E-commerce marketers")).toBe("e-commerce marketers");
    expect(midSentence("SMB SaaS sales teams")).toBe("SMB SaaS sales teams");
    expect(midSentence("GitHub maintainers")).toBe("GitHub maintainers");
  });

  it("computes ARR and the downside instead of trusting prose", () => {
    const out = yearOneLines({
      funnel: [
        { stage: "prospects", count: 200 },
        { stage: "trials", count: 40 },
      ],
      tier: "Team",
      payingAccounts: 10,
      monthlyRevenuePerAccount: 499,
    });
    expect(out).toContain("10 × $499/mo = $59,880 ARR");
    expect(out).toContain("$29,940 ARR** — downside if the close rate halves (5 accounts)");
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

  it("drops quotes marked unverified from the compiled page", async () => {
    const record = await runResearch({
      brief: BRIEF,
      providers: createProviders({ mode: "fixture" }),
    });
    const tampered = parseResearchRecord({
      ...record,
      community: {
        ...record.community,
        signals: [
          ...record.community.signals,
          {
            quote: "A quote nobody ever wrote on that thread.",
            citation: { url: "https://www.reddit.com/r/sales/", title: "r/sales" },
            verified: false,
          },
        ],
      },
    });
    const { mdx } = compileResearchRecord({ record: tampered });
    expect(mdx).not.toContain("A quote nobody ever wrote");
    expect(mdx).toContain("We burn weekends answering the same SOC2 questionnaire.");
  });
});

describe("engine audit on a compiled fixture", () => {
  it("passes every deep check except the fixture's short word count", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { pathToFileURL, fileURLToPath } = await import("node:url");
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const { auditIdeaFile } = (await import(
      pathToFileURL(path.join(root, "scripts/audit-idea-mdx.mjs")).href
    )) as {
      auditIdeaFile: (
        f: string,
        slug: string,
        o: Record<string, unknown>,
      ) => { errors: string[] };
    };

    const record = await runResearch({
      brief: BRIEF,
      providers: createProviders({ mode: "fixture" }),
    });
    const { mdx } = compileResearchRecord({ record, slug: "zz-engine-fixture" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-audit-"));
    try {
      const file = path.join(dir, "zz-engine-fixture.mdx");
      const recordPath = path.join(dir, "record.json");
      fs.writeFileSync(file, mdx);
      fs.writeFileSync(recordPath, JSON.stringify(record));
      const { errors } = auditIdeaFile(file, "zz-engine-fixture", {
        engine: true,
        recordPath,
        otherBodies: {},
      });
      expect(errors.filter((e) => !/body word count/.test(e))).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails a page whose quotes were never verified", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { pathToFileURL, fileURLToPath } = await import("node:url");
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const { auditIdeaFile } = (await import(
      pathToFileURL(path.join(root, "scripts/audit-idea-mdx.mjs")).href
    )) as {
      auditIdeaFile: (
        f: string,
        slug: string,
        o: Record<string, unknown>,
      ) => { errors: string[] };
    };
    const record = await runResearch({
      brief: BRIEF,
      providers: { ...createProviders({ mode: "fixture" }), sourceText: undefined },
    });
    const { mdx } = compileResearchRecord({ record, slug: "zz-unverified" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-audit-"));
    try {
      const file = path.join(dir, "zz-unverified.mdx");
      const recordPath = path.join(dir, "record.json");
      fs.writeFileSync(file, mdx);
      fs.writeFileSync(recordPath, JSON.stringify(record));
      const { errors } = auditIdeaFile(file, "zz-unverified", {
        engine: true,
        recordPath,
        otherBodies: {},
      });
      expect(errors.join("\n")).toMatch(/quote not verified against its cited page/);
      expect(errors.join("\n")).toMatch(/needs ≥2 verified community quotes \(got 0\)/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("community page reads", () => {
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
      /only 0\/2 cited community pages could be read.*Stopped before keyword and synthesis spend/,
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
    expect(synthesisInput).toContain("### https://www.reddit.com/r/sales/");
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

  it("uses an untagged answer when it cites one source", () => {
    const evidence = citationEvidence([
      {
        text: "Market A was $1.8 billion.",
        citations: [{ url: "https://a.example/one", title: "A" }],
      },
    ]);
    expect(isGroundedFigure("$1.8 billion", evidence.get("https://a.example/one")!)).toBe(true);
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
      "https://www.reddit.com/r/sales/": huge,
      "https://news.ycombinator.com/":
        "Loopio is great if you have a proposal team; we do not. " + "y ".repeat(80_000),
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

  it("shows cents when the monthly price has them", () => {
    const out = yearOneLines({
      funnel: [
        { stage: "leads", count: 100 },
        { stage: "trials", count: 20 },
      ],
      tier: "Team",
      payingAccounts: 10,
      monthlyRevenuePerAccount: 24.99,
    });
    expect(out).toContain("10 × $24.99/mo = $2,999 ARR");
  });
});

describe("source fetch safety", () => {
  it("keeps out-of-range numeric entities as text", () => {
    expect(htmlToText("a &#99999999; b &#x110000; c")).toBe("a &#99999999; b &#x110000; c");
  });

  it("matches quote fragments on whole words only", () => {
    const page = "We concatenate the results before review every single week.";
    expect(quoteAppearsIn("cat the results before review", page)).toBe(false);
    expect(quoteAppearsIn("the results before review", page)).toBe(true);
    // Short fragments must match too, not just the long one.
    expect(quoteAppearsIn("the results before review … monthly", page)).toBe(false);
    expect(quoteAppearsIn("the results before review … week", page)).toBe(true);
  });

  it("flags loopback, private, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.215.14", "151.101.1.140", "2606:4700::6810:84e5"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("refuses a citation that resolves to a private address", async () => {
    let fetched = 0;
    const provider = createSourceTextProvider({
      resolveHost: async () => ["10.0.0.5"],
      fetchImpl: async () => {
        fetched += 1;
        return new Response("secret", { status: 200 });
      },
    });
    await expect(provider.fetchText("https://intranet.example/page")).rejects.toThrow(/non-public/);
    await expect(provider.fetchText("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/non-public/);
    expect(fetched).toBe(0);
  });

  it("refuses a redirect to a private address", async () => {
    const calls: string[] = [];
    const provider = createSourceTextProvider({
      resolveHost: PUBLIC_DNS,
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1:8080/admin" },
        });
      },
    });
    await expect(provider.fetchText("https://example.com/post")).rejects.toThrow(/non-public/);
    expect(calls).toEqual(["https://example.com/post"]);
  });

  it("follows a redirect to another public page", async () => {
    const provider = createSourceTextProvider({
      resolveHost: PUBLIC_DNS,
      fetchImpl: async (url) =>
        url.endsWith("/old")
          ? new Response(null, { status: 301, headers: { location: "/new" } })
          : new Response("<p>moved here</p>", { status: 200 }),
    });
    expect((await provider.fetchText("https://example.com/old")).trim()).toBe("moved here");
  });

  it("checks redirects on the Reddit path too", async () => {
    const calls: string[] = [];
    const provider = createSourceTextProvider({
      redditClientId: "",
      redditClientSecret: "",
      resolveHost: async (host) => (host === "evil.example" ? ["10.0.0.9"] : ["151.101.1.140"]),
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response(null, {
          status: 301,
          headers: { location: "https://evil.example/steal" },
        });
      },
    });
    await expect(
      provider.fetchText("https://www.reddit.com/r/x/comments/abc/y/"),
    ).rejects.toThrow(/non-public/);
    expect(calls).toHaveLength(1);
  });

  it("refuses to connect when the host resolves to a private address", async () => {
    const { createServer } = await import("node:http");
    const server = createServer((_req, res) => res.end("internal"));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    try {
      // "localhost" resolves to loopback at connect time, as a rebinding host would.
      await expect(publicOnlyFetch(`http://localhost:${port}/`)).rejects.toThrow(/non-public/);
    } finally {
      server.close();
    }
  });
});
