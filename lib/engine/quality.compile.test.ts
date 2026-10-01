/**
 * Anti-slop guarantees for the idea engine, compiler side: the compiler
 * never breaks links, drops unverified quotes and computes the revenue math.
 * Split mechanically from quality.test.ts (WP46-S3): test bodies and
 * assertions are unchanged.
 */

import { describe, expect, it } from "vitest";

import {
  collapseDuplicateSentences,
  compileResearchRecord,
  midSentence,
  yearOneLines,
} from "./compile.ts";
import { runResearch, type BriefInput } from "./pipeline.ts";
import { createProviders } from "./providers.ts";
import { parseResearchRecord } from "./research-record.ts";

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

describe("record validation (compile)", () => {
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

describe("CodeRabbit regressions (compile)", () => {
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
