/**
 * Compiler tests (WP46-S4, evidence contract §9): contract v2 records only.
 *
 * Records come from lib/engine/__fixtures__/recordV2.ts (synthetic sources →
 * acceptEvidence → parseResearchRecord); no test calls runResearch, hits
 * the network or writes outside a temp dir.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildFixtureRecord, EV, FIXTURE_PAGE_SLUG, REJECTED_QUOTE, withEditorial } from "./__fixtures__/recordV2.ts";
import { CompileError, compileResearchRecord, GENERIC_SETUP_TABLE_NAMES, quoteBlock } from "./compile.ts";
import { writeCompiledIdea } from "./compile-write.ts";
import { acceptEvidence } from "./evidence/accept.ts";
import { canonicalSourceUrl } from "./evidence/citation.ts";
import type { EditorialFieldsV2, ResearchRecordV2 } from "./evidence/contract.ts";
import { escapeMdxText } from "./evidence/quote.ts";
import { SECTION_TITLES } from "./page-format.ts";
import { LegacyResearchRecordError, ResearchRecordParseError } from "./research-record.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-compile-"));
  tempDirs.push(dir);
  return dir;
}

function compileFixture(record: ResearchRecordV2 = buildFixtureRecord()) {
  return compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG, publishedAt: "2026-10-01" });
}

function compileIssues(record: ResearchRecordV2): string[] {
  try {
    compileResearchRecord({ record });
  } catch (error) {
    if (error instanceof CompileError) return error.issues;
    throw error;
  }
  return [];
}

describe("compileResearchRecord (contract v2)", () => {
  it("emits an engine: source, the eight headings in order, How it works and Sources", () => {
    const { mdx, manifestEntry, slug } = compileFixture();
    expect(slug).toBe(FIXTURE_PAGE_SLUG);
    expect(manifestEntry.source).toBe(`engine:${FIXTURE_PAGE_SLUG}`);
    expect(manifestEntry.source).not.toMatch(/ideabrowser/);
    const headings = [...mdx.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual([...SECTION_TITLES, "Sources"]);
    expect(mdx).toContain("**How it works:**\n\n1. **Connect** — Install the GitHub App");
    expect(manifestEntry.provenance.citations).toBe(9);
    expect(manifestEntry.provenance.wordCount).toBeGreaterThanOrEqual(2200);
    expect(manifestEntry.description).toBe("A quiet, repository-aware sanity check for every pull request on small GitHub teams.");
  });

  it("renders each selected quote as one blockquote with its attribution, multiline excerpts line by line", () => {
    const { mdx } = compileFixture();
    expect(mdx).toContain(
      [
        '> "Our bot leaves forty comments per PR',
        '> and nobody reads any of them anymore."',
        ">",
        "> — [AI review noise](https://forum.example.com/t/ai-review-noise)",
      ].join("\n"),
    );
    expect(mdx).toContain(
      '> "Our CI posts \\*three\\* bot reviews per change and each one says the C\\# code looks fine, which helps nobody."\n>\n> — [Review noise](https://lobste.rs/s/abc123/review_noise)',
    );
    expect(quoteBlock(EV.quoteHn)).toBe(
      '> "We review 12 pull requests a day and the bot comments on every single one of them."\n>\n> — [Ask HN: Is AI code review worth it?](https://news.ycombinator.com/item?id=27515468)',
    );
  });

  it("renders market signal rows from the accepted stats and their sources", () => {
    const { mdx } = compileFixture();
    expect(mdx).toContain(
      "- **AI code review market (market size)**: $1.4 billion (2025) ([AI code review market report](https://research.example.com/ai-code-review-market)).",
    );
    expect(mdx).toContain(
      "- **AI code review market (market size)**: $10.8 billion by 2034 (projected) ([AI code review market report](https://research.example.com/ai-code-review-market)).",
    );
    expect(mdx).toContain(
      "- **Developers using AI code review assistants (adoption)**: 62% (2025) ([Developer tools survey 2025](https://survey.example.org/developer-tools-2025)).",
    );
  });

  it("renders competitor rows with formatPriceTerms, plans, a (via host) label for secondary prices and evidence links", () => {
    const { mdx } = compileFixture();
    expect(mdx).toContain(
      "- **CodeRabbit** — Broad per-seat review across every repository, with summaries on the cheaper plan and unlimited reviews on Pro. Published pricing: $12/user/month, billed annually (Lite) [CodeRabbit pricing](https://www.coderabbit.ai/pricing); $24/user/month, billed annually (Pro) [CodeRabbit pricing](https://www.coderabbit.ai/pricing).",
    );
    expect(mdx).toContain("- **Qodo** — Published pricing: $30/user/month, billed annually (Teams) [Qodo pricing](https://www.qodo.ai/pricing).");
    expect(mdx).toContain(
      "Published pricing: $12/user/month (Pro) (via reviews.example.com) [Best AI code review tools](https://reviews.example.com/best-ai-code-review-tools).",
    );
    expect(mdx).toContain(
      "Published pricing: $15/user/month (Team) (via reviews.example.com) [Best AI code review tools](https://reviews.example.com/best-ai-code-review-tools).",
    );
  });

  it("expands evidence tokens into linked canonical renderings", () => {
    const { mdx } = compileFixture();
    expect(mdx).toContain(
      "sizes it at [$1.4 billion (2025)](https://research.example.com/ai-code-review-market) and expects [$10.8 billion by 2034 (projected)](https://research.example.com/ai-code-review-market)",
    );
    expect(mdx).toContain(
      'summed up the daily load as ["We review 12 pull requests a day and the bot comments on every single one of them."](https://news.ycombinator.com/item?id=27515468)',
    );
    expect(mdx).not.toMatch(/\[\[ev:/);
  });

  it("escapes editorial prose and evidence text exactly once", () => {
    const record = buildFixtureRecord(
      withEditorial({
        problemNarrative:
          "Teams paste <details> blocks, {curly} templates, *stars* and snake_case names into review threads.\n- not a list\n# not a heading",
      }),
    );
    const { mdx } = compileFixture(record);
    expect(mdx).toContain(
      "Teams paste \\<details\\> blocks, \\{curly\\} templates, \\*stars\\* and snake\\_case names into review threads.\n\\- not a list\n\\# not a heading",
    );
    expect(mdx).not.toMatch(/\\\\[<{*_]/);
    expect(mdx).toContain(escapeMdxText(EV.quoteLobsters.excerpt));
  });

  it("puts plain renderings in the build prompts, including the landing-page competitor strip", () => {
    const { mdx } = compileFixture();
    expect(mdx).toContain(
      "competitor strip (CodeRabbit: $12/user/month, billed annually (Lite), $24/user/month, billed annually (Pro); Graphite: $40/user/month (Team); Qodo: $30/user/month, billed annually (Teams); Sourcery: $12/user/month (Pro) (via reviews.example.com); Codacy: $15/user/month (Team) (via reviews.example.com))",
    );
    expect(mdx).toContain("Stripe catalog must match the pricing tiers exactly: Open Source at Free; Solo at $12/month; Crew at $20/developer/month.");
    const fences = [...mdx.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");
    expect(fences).toHaveLength(4);
    for (const fence of fences) expect(fence).not.toMatch(/\\[*_#<{]|\]\(http/);
  });

  it("never renders rejected evidence or quotes the record does not select", () => {
    const record = buildFixtureRecord();
    expect(record.evidence.rejected.some((r) => r.candidate?.includes("47 PRs"))).toBe(true);
    const { mdx } = compileFixture(record);
    expect(mdx).not.toContain("47");
    expect(mdx).not.toContain(REJECTED_QUOTE.slice(0, 30));
    expect(mdx).not.toContain(EV.quoteUnselected.excerpt);
    expect(mdx).not.toMatch(/reddit\.com/);
  });

  it("labels pricing tiers, unit economics and year-one figures as proposals and planning assumptions", () => {
    const { mdx } = compileFixture();
    expect(mdx).toContain("Proposed SignalPass pricing to test with early buyers (an assumption, not observed market data):");
    expect(mdx).toContain("**Unit Economics**\n\nPlanning estimates to verify, not measured results:");
    expect(mdx).toContain(
      "**Year-One Math**\n\nSignalPass's funnel, seat count and close rate below are planning assumptions, not measured results; the totals are plain arithmetic on them.",
    );
  });

  it("renders Year-One Math from finance.ts with the seats stated and a floor(base/2) downside", () => {
    const { mdx } = compileFixture();
    expect(mdx).toContain(
      [
        "- **1,200** — GitHub Marketplace and outreach visitors",
        "- **120** — Private-repository trials",
        "- **45** — Paying Crew accounts",
        "- **45 × $100/mo = $54,000 ARR** — Crew accounts paying by month 12 (5 seats × $20/developer/month)",
        "- **22 × $100/mo = $26,400 ARR** — downside if the close rate halves (half of 45 accounts, rounded down)",
      ].join("\n"),
    );
  });

  it("refuses a record without the editorial fields the deep audit needs instead of padding it", () => {
    const record = buildFixtureRecord((r) => {
      delete r.editorial;
    });
    const issues = compileIssues(record);
    for (const field of [
      "problemNarrative",
      "solutionNarrative",
      "competitiveNarrative",
      "dontBuildYet",
      "stackNotes",
      "brandBrief",
      "pricingTiers",
      "unitEconomics",
      "dataModel",
      "yearOne",
    ]) {
      expect(issues.join("\n")).toContain(`editorial.${field}`);
    }
    expect(issues.join("\n")).toMatch(/re-run engine:research/);
  });

  it("refuses a single missing field and never emits the old placeholder fallbacks", () => {
    const cases: Array<[Partial<EditorialFieldsV2>, string]> = [
      [{ pricingTiers: undefined, yearOne: undefined }, "pricingTiers"],
      [{ unitEconomics: [{ label: "Model cost", value: "$0.04 per review" }] }, "unitEconomics"],
      [{ problemNarrative: undefined }, "problemNarrative"],
    ];
    for (const [patch, field] of cases) {
      const record = buildFixtureRecord(withEditorial(patch));
      expect(compileIssues(record).join("\n")).toContain(`editorial.${field}`);
    }
    const { mdx } = compileFixture();
    for (const placeholder of [
      "priced under the enterprise floor in research",
      "mid tier from research",
      "top published tier from research",
      "COGS per active workspace",
      "LLM + storage — meter from day one",
      "of SignalPass seat revenue at target CAC",
      "is not another undifferentiated AI tool",
      "wins by staying narrower than the platforms below",
      "competes with SignalPass for",
      "documents(id, workspace_id fk, title, body, source)",
    ]) {
      expect(mdx).not.toContain(placeholder);
    }
  });

  it("requires an idea-specific data model instead of generic setup tables", () => {
    const record = buildFixtureRecord(
      withEditorial({
        dataModel: [
          { table: "documents", columns: "id, workspace_id, title" },
          { table: "jobs", columns: "id, workspace_id, status" },
          { table: "repositories", columns: "id, workspace_id, name" },
        ],
      }),
    );
    expect(compileIssues(record).join("\n")).toMatch(/editorial\.dataModel needs ≥3 idea-specific tables .* \(got 1\)/);
    expect(GENERIC_SETUP_TABLE_NAMES).toEqual(["workspaces", "members", "usage_events", "documents", "jobs"]);
  });

  it("refuses record text that would break a build-prompt code fence", () => {
    const record = buildFixtureRecord(withEditorial({ brandBrief: "Calm and precise. ```js\nalert(1)\n``` No mascots at all." }));
    expect(compileIssues(record).join("\n")).toMatch(/would break its code fence/);
  });

  it("re-validates the record before compiling: a tampered accepted excerpt is refused", () => {
    const record = buildFixtureRecord();
    const quote = record.evidence.accepted.find((e) => e.id === EV.quoteHn.id);
    if (!quote) throw new Error("fixture: HN quote missing");
    quote.excerpt = `${quote.excerpt} This product increased our engineering revenue by nine million dollars overnight.`;
    expect(() => compileResearchRecord({ record })).toThrow(ResearchRecordParseError);
  });

  it("refuses a legacy contract v1 record with the re-research message", () => {
    // An untyped caller (JSON from disk) is exactly what the re-validation guards against.
    const legacy: unknown = JSON.parse(
      JSON.stringify({ contractVersion: 1, brief: { title: "Old", slug: "old-idea", oneLiner: "x", targetCustomer: "y" } }),
    );
    expect(() => compileResearchRecord({ record: legacy as ResearchRecordV2 })).toThrow(LegacyResearchRecordError);
    expect(() => compileResearchRecord({ record: legacy as ResearchRecordV2 })).toThrow(/Re-run `npm run engine:research/);
  });
});

describe("compile write safety", () => {
  it("refuses to overwrite without force", () => {
    const record = buildFixtureRecord();
    const dir = tempDir();
    writeCompiledIdea({ record, slug: "overwrite-me", ideasDir: dir, writeManifest: false });
    expect(() => writeCompiledIdea({ record, slug: "overwrite-me", ideasDir: dir, writeManifest: false })).toThrow(
      /refusing to overwrite/,
    );
  });

  it("leaves no MDX behind when the manifest check refuses", () => {
    const record = buildFixtureRecord();
    const dir = tempDir();
    const manifestPath = path.join(dir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ ideas: [{ slug: "already-listed" }] }));
    expect(() =>
      writeCompiledIdea({ record, slug: "already-listed", ideasDir: path.join(dir, "ideas"), manifestPath }),
    ).toThrow(/manifest entry/);
    expect(fs.existsSync(path.join(dir, "ideas", "already-listed.mdx"))).toBe(false);
  });

  it("writes nothing for a record that cannot compile", () => {
    const record = buildFixtureRecord(withEditorial({ stackNotes: undefined }));
    const dir = tempDir();
    expect(() => writeCompiledIdea({ record, slug: "incomplete", ideasDir: dir, writeManifest: false })).toThrow(
      CompileError,
    );
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("rejects slugs that would write outside the ideas dir", () => {
    const record = buildFixtureRecord();
    for (const slug of ["../escape", "a/b", "..", "UPPER case"]) {
      expect(() => writeCompiledIdea({ record, slug, ideasDir: tempDir(), writeManifest: false })).toThrow(/must match/);
    }
  });

  it("escapes MDX traps in Sources, links and frontmatter, and encodes link URLs", () => {
    const record = buildFixtureRecord(
      (r) => {
        r.brief.title = 'Tricky "quoted" <Title> {x}\nnext: line';
      },
      {
        pages: {
          survey: {
            url: "https://www.industryresearch.biz/report_(v2)?q={x}",
            title: "Report <2026> {draft] edition",
          },
        },
      },
    );
    const dir = tempDir();
    const written = writeCompiledIdea({ record, slug: "engine-escape-test", ideasDir: dir, writeManifest: false });
    const frontTitle = written.mdx.split("\n")[2] ?? "";
    expect(JSON.parse(frontTitle.replace(/^title: /, ""))).toBe(record.brief.title);
    expect(written.mdx).toContain("[Report \\<2026\\> \\{draft\\] edition](https://www.industryresearch.biz/report_%28v2%29?q=%7Bx%7D)");
    expect(canonicalSourceUrl("https://www.industryresearch.biz/report_(v2)?q={x}")).toBe(
      "https://www.industryresearch.biz/report_(v2)?q={x}",
    );
  });

  it("restores the previous MDX when a forced manifest write fails", () => {
    const record = buildFixtureRecord();
    const dir = tempDir();
    const ideasDir = path.join(dir, "ideas");
    fs.mkdirSync(ideasDir);
    const mdxPath = path.join(ideasDir, "keep-me.mdx");
    fs.writeFileSync(mdxPath, "ORIGINAL");
    // Parent of the manifest path is a file, so the manifest write throws.
    const blocker = path.join(dir, "not-a-dir");
    fs.writeFileSync(blocker, "");
    expect(() =>
      writeCompiledIdea({ record, slug: "keep-me", ideasDir, manifestPath: path.join(blocker, "manifest.json"), force: true }),
    ).toThrow();
    expect(fs.readFileSync(mdxPath, "utf8")).toBe("ORIGINAL");
  });
});

describe("compile manifest stub", () => {
  it("publishes timing from the timing score, never from execution", () => {
    const record = buildFixtureRecord((r) => {
      r.scores = { opportunity: 8, pain: 7, timing: 6, builderConfidence: 5, execution: 2 };
    });
    expect(compileResearchRecord({ record }).manifestEntry.scores).toEqual({
      opportunity: 8,
      pain: 7,
      timing: 6,
      builder_confidence: 5,
    });
  });

  it("omits manifest scores when the record has none", () => {
    const record = buildFixtureRecord((r) => {
      delete r.scores;
    });
    expect(compileResearchRecord({ record }).manifestEntry.scores).toBeUndefined();
  });

  it("refuses a record whose evidence cites fewer than two distinct sources", () => {
    const url = "https://allinone.example.com/ai-code-review";
    const text = [
      "The AI code review market was valued at $1.4 billion in 2025.",
      "In 2025, 62% of developers used AI code review assistants at work.",
      "Alphareview costs $10/user/month for its Team plan.",
      "Betareview costs $20/user/month for its Team plan.",
      "Gammareview costs $30/user/month for its Team plan.",
      "We review 12 pull requests a day and the bot comments on every single one of them.",
      "Our bot leaves forty comments per PR and nobody reads any of them anymore.",
    ].join(" ");
    const title = "AI code review overview";
    const vendors = ["Alphareview", "Betareview", "Gammareview"];
    const accepted = acceptEvidence({
      candidates: {
        quotes: [
          { sourceUrl: url, text: "We review 12 pull requests a day and the bot comments on every single one of them." },
          { sourceUrl: url, text: "Our bot leaves forty comments per PR and nobody reads any of them anymore." },
        ],
        marketStats: [
          {
            sourceUrl: url,
            supportingText: "The AI code review market was valued at $1.4 billion in 2025.",
            subject: "AI code review market",
            metric: "market_size",
            amountText: "$1.4 billion",
            year: 2025,
            periodKind: "measured",
          },
          {
            sourceUrl: url,
            supportingText: "In 2025, 62% of developers used AI code review assistants at work.",
            subject: "developers using AI code review assistants",
            metric: "adoption",
            amountText: "62%",
            year: 2025,
            periodKind: "measured",
          },
        ],
        competitorPrices: vendors.map((vendor, i) => ({
          vendor,
          sourceUrl: url,
          supportingText: `${vendor} costs $${(i + 1) * 10}/user/month for its Team plan.`,
          plan: "Team",
          priceText: `$${(i + 1) * 10}/user/month`,
        })),
      },
      citations: [{ url, title }],
      sources: new Map([[url, { status: "read", text, retrievedAt: "2026-09-30T12:00:00.000Z" }]]),
      vendorHints: vendors,
    }).accepted;
    expect(accepted).toHaveLength(7);
    const byKind = (kind: string) => accepted.filter((e) => e.kind === kind).map((e) => e.id);
    const record = buildFixtureRecord((r) => {
      r.evidence.accepted = accepted;
      r.evidence.rejected = [];
      r.evidence.sources = [
        {
          url,
          roles: ["market", "competitors", "community"],
          status: "read",
          retrievedAt: "2026-09-30T12:00:00.000Z",
          textSha256: "0".repeat(64),
        },
      ];
      r.market = { summary: "A single overview page backs every figure here.", statIds: byKind("market_stat") };
      r.competitors = vendors.map((name, i) => ({ name, priceIds: [byKind("competitor_price")[i] ?? ""] }));
      r.community = { summary: "Reviewers describe noise.", quoteIds: byKind("community_quote") };
      r.goToMarket.pricingNotes = "Price below the per-seat incumbents.";
      if (r.editorial) r.editorial.competitiveNarrative = "Three per-seat products compete for the same small teams.";
    });
    expect(compileIssues(record).join("\n")).toMatch(/record cites 1 distinct source\(s\); the auditor needs ≥2/);
  });
});

describe("parse errors surface at the compile boundary", () => {
  it("throws ResearchRecordParseError for an invalid v2 record", () => {
    const record = buildFixtureRecord();
    const broken: unknown = JSON.parse(JSON.stringify({ ...record, market: { ...record.market, statIds: [] } }));
    expect(() => compileResearchRecord({ record: broken as ResearchRecordV2 })).toThrow(ResearchRecordParseError);
  });
});
