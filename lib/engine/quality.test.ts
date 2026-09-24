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
  quoteAppearsIn,
  redditJsonUrl,
} from "./providers/sourceText.ts";
import { parseResearchRecord, parseYearOne } from "./research-record.ts";

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
