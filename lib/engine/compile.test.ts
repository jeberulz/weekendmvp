/**
 * Compiler tests (WP54-S4, evidence contract §9, rulings R10 and R11):
 * contract v2 records only.
 *
 * Records come from lib/engine/__fixtures__/recordV2.ts (synthetic sources →
 * acceptEvidence → parseResearchRecord); no test calls runResearch, hits
 * the network or writes outside a temp dir. Evidence renderings are computed
 * with renderEvidenceInline and the page-format helpers, never typed.
 *
 * The fixture record is mode "fixture", so since ruling R11 a test that
 * compiles it names an engine-draft-* slug, or passes allowFixture when it
 * tests write mechanics under another slug.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildFixtureRecord,
  EV,
  FIXTURE_PAGES,
  FIXTURE_PAGE_SLUG,
  FIXTURE_RETRIEVED_AT,
  REJECTED_QUOTE,
  tok,
  withEditorial,
} from "./__fixtures__/recordV2.ts";
import { CompileError, compileResearchRecord, GENERIC_SETUP_TABLE_NAMES, quoteBlock } from "./compile.ts";
import { writeCompiledIdea } from "./compile-write.ts";
import { acceptEvidence, sha256Hex } from "./evidence/accept.ts";
import { canonicalSourceUrl, sourceHostLabel } from "./evidence/citation.ts";
import { WRITER_FIELD_TOKEN_KINDS, type AcceptedEvidence, type CompetitorPriceEvidence, type EditorialFieldsV2, type ResearchRecordV2, type WriterTextField } from "./evidence/contract.ts";
import { escapeMdxText } from "./evidence/quote.ts";
import { findUnboundFigures, renderEvidenceInline } from "./evidence/tokens.ts";
import {
  HOW_IT_WORKS_LABEL,
  marketSignalRow,
  mdLink,
  promptHeadingText,
  proposalLabels,
  SECTION_TITLES,
  usedEvidenceIds,
  viaLabel,
} from "./page-format.ts";
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

function compileIssues(record: ResearchRecordV2, slug = FIXTURE_PAGE_SLUG): string[] {
  try {
    compileResearchRecord({ record, slug });
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

  it("marks the page as engine output in its frontmatter, which the site's loader ignores (P3-8)", async () => {
    const { mdx } = compileFixture();
    expect(mdx.split("\n").slice(0, 5)).toEqual(["---", `slug: "${FIXTURE_PAGE_SLUG}"`, 'title: "AI Code Reviewer for Small Teams"', "engine: true", "---"]);
    // lib/mdx.tsx reads pages with gray-matter and uses only `title` and the content.
    const matter = (await import("gray-matter")).default;
    const parsed = matter(mdx);
    expect(parsed.data).toEqual({ slug: FIXTURE_PAGE_SLUG, title: "AI Code Reviewer for Small Teams", engine: true });
    expect(parsed.content.trimStart().startsWith("## The Problem")).toBe(true);
  });

  it("renders each selected quote as one blockquote line with its attribution (a quote is one line of its source, R8)", () => {
    const { mdx } = compileFixture();
    for (const quote of [EV.quoteHn, EV.quoteForum, EV.quoteLobsters]) {
      expect(quote.excerpt).not.toMatch(/\n/);
      const block = quoteBlock(quote);
      expect(block).toBe(`> "${escapeMdxText(quote.excerpt)}"\n>\n> — ${mdLink(quote.sourceTitle, quote.sourceUrl)}`);
      expect(mdx).toContain(block);
    }
    expect(quoteBlock(EV.quoteLobsters)).toContain("\\*three\\* bot reviews per change and each one says the C\\# code looks fine");
  });

  it("never gets a quote that spans a line break of its source: acceptance refuses it, so no record can hold it (R8)", () => {
    const text = "Our bot leaves forty comments per PR\nand nobody reads any of them anymore.";
    const url = FIXTURE_PAGES.forum.url;
    const result = acceptEvidence({
      candidates: {
        quotes: [{ sourceUrl: url, text: "Our bot leaves forty comments per PR and nobody reads any of them anymore." }],
        marketStats: [],
        competitorPrices: [],
      },
      citations: [{ url, title: FIXTURE_PAGES.forum.title }],
      sources: new Map([[url, { status: "read", text, retrievedAt: FIXTURE_RETRIEVED_AT, textSha256: sha256Hex(text), roles: ["community"] }]]),
    });
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([expect.objectContaining({ kind: "community_quote", reason: "span_bounds" })]);
    // Every quote the fixture page renders is a single source line.
    for (const quote of [EV.quoteHn, EV.quoteForum, EV.quoteLobsters]) expect(compileFixture().mdx).toContain(`> "${escapeMdxText(quote.excerpt)}"\n>`);
  });

  it("renders market signal rows from the accepted stats and their sources, with no label of their own", () => {
    const { mdx } = compileFixture();
    for (const stat of [EV.statMeasured, EV.statProjected, EV.statAdoption]) {
      const row = `- ${escapeMdxText(renderEvidenceInline(stat))} (${mdLink(stat.sourceTitle, stat.sourceUrl)}).`;
      expect(marketSignalRow(stat)).toBe(row);
      expect(mdx).toContain(`\n${row}\n`);
      // The rendering already names the subject (ruling R7), so the row repeats nothing in a label.
      expect(renderEvidenceInline(stat)).toContain(stat.subject);
    }
    const signals = mdx.slice(mdx.indexOf("**Market signals**"), mdx.indexOf("**Search demand**"));
    expect(signals).not.toMatch(/^- \*\*/m);
  });

  it("renders competitor rows with formatPriceTerms, plans, a (via host) label for secondary prices and evidence links", () => {
    const { mdx } = compileFixture();
    const price = (item: CompetitorPriceEvidence) => {
      const via = item.attribution === "secondary" ? ` ${viaLabel(sourceHostLabel(item.sourceUrl))}` : "";
      return `${escapeMdxText(renderEvidenceInline(item))}${via} ${mdLink(item.sourceTitle, item.sourceUrl)}`;
    };
    expect(mdx).toContain(
      `- **CodeRabbit** — Broad per-seat review across every repository, with summaries on the cheaper plan and unlimited reviews on Pro. Published pricing: ${price(EV.priceLite)}; ${price(EV.pricePro)}.`,
    );
    expect(mdx).toContain(`- **Qodo** — Published pricing: ${price(EV.priceQodo)}.`);
    expect(mdx).toContain(`Published pricing: ${price(EV.priceSourcery)}.`);
    expect(mdx).toContain(`Published pricing: ${price(EV.priceCodacy)}.`);
    expect(price(EV.priceSourcery)).toContain("(via reviews.example.com) [Best AI code review tools]");
  });

  it("expands evidence tokens into linked canonical renderings", () => {
    const { mdx } = compileFixture();
    const link = (item: AcceptedEvidence) => mdLink(renderEvidenceInline(item), item.sourceUrl);
    expect(mdx).toContain(`sizes it at ${link(EV.statMeasured)} and expects ${link(EV.statProjected)}`);
    expect(mdx).toContain(`summed up the daily load as ${link(EV.quoteHn)}`);
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
    const plain = (item: CompetitorPriceEvidence) =>
      item.attribution === "secondary" ? `${renderEvidenceInline(item)} ${viaLabel(sourceHostLabel(item.sourceUrl))}` : renderEvidenceInline(item);
    expect(mdx).toContain(
      `competitor strip (CodeRabbit: ${plain(EV.priceLite)}, ${plain(EV.pricePro)}; Graphite: ${plain(EV.priceGraphite)}; Qodo: ${plain(EV.priceQodo)}; Sourcery: ${plain(EV.priceSourcery)}; Codacy: ${plain(EV.priceCodacy)})`,
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

  it("labels How it works, what not to build, channels and the stack as proposals, keeping the HowTo list format", () => {
    const { mdx } = compileFixture();
    const labels = proposalLabels("SignalPass");
    expect(mdx).toContain(`${escapeMdxText(labels.howItWorks)}\n\n${HOW_IT_WORKS_LABEL}\n\n1. **Connect** — `);
    expect(mdx).toContain(`${escapeMdxText(labels.dontBuildYet)}\n\nDo not build IDE plugins`);
    expect(mdx).toContain(`**Channels**\n\n${escapeMdxText(labels.channels)}\n\n- GitHub Marketplace listing`);
    expect(mdx).toContain(`## Recommended Tech Stack\n\n${escapeMdxText(labels.stack)}\n\nBuild SignalPass as a GitHub App`);
    // Every label of eight or more words names the product, so it never repeats on another engine page.
    for (const label of Object.values(labels)) {
      if ((label.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? []).length >= 8) expect(label).toContain("SignalPass");
    }
  });

  it("writes no figure, number word or quotation of its own into the build prompts", () => {
    const record = buildFixtureRecord();
    const { mdx } = compileFixture(record);
    for (let i = 0; i < 4; i += 1) expect(mdx).toContain(`**${promptHeadingText(i)}**\n\n\`\`\`text`);
    const fences = [...mdx.matchAll(/\`\`\`text\n([\s\S]*?)\`\`\`/g)].map((m) => m[1] ?? "");
    expect(fences).toHaveLength(4);
    const [setup = "", coreFeature = "", landing = "", branding = ""] = fences;
    // No step ordinals or step count: each line is a record step.
    expect(coreFeature).not.toMatch(/^\s*\d+[.)]/m);
    expect(coreFeature).toContain("Build SignalPass's core workflow as one screen per step, in this order:");
    // The hero is the one-liner as written, not a quotation.
    expect(landing).toContain(`Hero line: ${record.brief.oneLiner}`);
    // The deliverables carry no counts in words and no quoted phrase.
    expect(branding).not.toMatch(/["“”«»]|\b(?:two|three|four|five)\b/i);
    // Outside record values (tier prices, data-model columns, evidence renderings) the prompts hold no figure.
    let rest = fences.join("\n");
    const values = [
      ...(record.editorial?.pricingTiers ?? []).flatMap((t) => [t.price, t.includes]),
      ...(record.editorial?.dataModel ?? []).map((t) => t.columns),
      ...record.evidence.accepted.map(renderEvidenceInline),
    ];
    for (const value of values.sort((a, b) => b.length - a.length)) rest = rest.split(value).join(" ");
    expect(findUnboundFigures(rest)).toEqual([]);
    expect(setup).toContain("Stripe catalog must match the pricing tiers exactly");
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
    const record = buildFixtureRecord(withEditorial({ brandBrief: "Calm and precise. ```js\nalert()\n``` No mascots at all." }));
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
    expect(() => compileResearchRecord({ record: legacy as ResearchRecordV2 })).toThrow(
      /Re-research into a new file: `npm run engine:research -- .* --out engine\/records\/engine-draft-old-idea\.json`/,
    );
  });
});

describe("compile write safety", () => {
  it("refuses to overwrite without force", () => {
    const record = buildFixtureRecord();
    const dir = tempDir();
    writeCompiledIdea({ record, slug: "overwrite-me", ideasDir: dir, writeManifest: false, allowFixture: true });
    expect(() => writeCompiledIdea({ record, slug: "overwrite-me", ideasDir: dir, writeManifest: false, allowFixture: true })).toThrow(
      /refusing to overwrite/,
    );
  });

  it("leaves no MDX behind when the manifest check refuses", () => {
    const record = buildFixtureRecord();
    const dir = tempDir();
    const manifestPath = path.join(dir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({ ideas: [{ slug: "already-listed" }] }));
    expect(() =>
      writeCompiledIdea({ record, slug: "already-listed", ideasDir: path.join(dir, "ideas"), manifestPath, allowFixture: true }),
    ).toThrow(/manifest entry/);
    expect(fs.existsSync(path.join(dir, "ideas", "already-listed.mdx"))).toBe(false);
  });

  it("writes nothing for a record that cannot compile", () => {
    const record = buildFixtureRecord(withEditorial({ stackNotes: undefined }));
    const dir = tempDir();
    expect(() => writeCompiledIdea({ record, slug: "incomplete", ideasDir: dir, writeManifest: false, allowFixture: true })).toThrow(
      /editorial\.stackNotes is missing/,
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
    const written = writeCompiledIdea({ record, slug: "engine-escape-test", ideasDir: dir, writeManifest: false, allowFixture: true });
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
    // Earlier engine output (frontmatter marker), so force may replace it.
    const original = '---\nslug: "keep-me"\nengine: true\n---\n\nORIGINAL\n';
    fs.writeFileSync(mdxPath, original);
    // Parent of the manifest path is a file, so the manifest write throws.
    const blocker = path.join(dir, "not-a-dir");
    fs.writeFileSync(blocker, "");
    expect(() =>
      writeCompiledIdea({ record, slug: "keep-me", ideasDir, manifestPath: path.join(blocker, "manifest.json"), force: true, allowFixture: true }),
    ).toThrow(/EEXIST|ENOTDIR|not a directory/);
    expect(fs.readFileSync(mdxPath, "utf8")).toBe(original);
  });
});

describe("compile never replaces a handwritten idea by accident (overwrite hazard)", () => {
  const SLUG = "ai-code-reviewer";
  const HANDWRITTEN_MDX = `---\nslug: "${SLUG}"\ntitle: "AI Code Reviewer"\n---\n\n## The Problem\n\nWritten by hand.\n`;
  const HANDWRITTEN_ROW = { slug: SLUG, title: "AI Code Reviewer", source: "mode-b:backfill", category: "dev-tools", tools: ["cursor"], audiences: ["indie-hackers"] };

  /** A temp ideas dir and manifest holding a handwritten page and/or its row. */
  function handwritten(parts: { page: boolean; row: boolean }) {
    const dir = tempDir();
    const ideasDir = path.join(dir, "ideas");
    fs.mkdirSync(ideasDir);
    const mdxPath = path.join(ideasDir, `${SLUG}.mdx`);
    if (parts.page) fs.writeFileSync(mdxPath, HANDWRITTEN_MDX);
    const manifestPath = path.join(dir, "manifest.json");
    const manifest = `${JSON.stringify({ ideas: parts.row ? [{ slug: "other-idea", source: "mode-b:backfill" }, HANDWRITTEN_ROW] : [] }, null, 2)}\n`;
    fs.writeFileSync(manifestPath, manifest);
    return { ideasDir, mdxPath, manifestPath, manifest };
  }

  it("refuses a handwritten page or manifest row even with force, and leaves both untouched", () => {
    const record = buildFixtureRecord();
    for (const parts of [{ page: true, row: true }, { page: true, row: false }, { page: false, row: true }]) {
      const at = handwritten(parts);
      expect(() =>
        writeCompiledIdea({ record, slug: SLUG, ideasDir: at.ideasDir, manifestPath: at.manifestPath, force: true, allowFixture: true }),
      ).toThrow(
        /^refusing to replace the handwritten idea ai-code-reviewer: .*--slug engine-draft-ai-code-reviewer.*--replace-handwritten/,
      );
      expect(fs.existsSync(at.mdxPath) ? fs.readFileSync(at.mdxPath, "utf8") : null, JSON.stringify(parts)).toBe(parts.page ? HANDWRITTEN_MDX : null);
      expect(fs.readFileSync(at.manifestPath, "utf8"), JSON.stringify(parts)).toBe(at.manifest);
    }
  });

  it("reads the page's manifest row when it writes no manifest (--no-manifest)", () => {
    const record = buildFixtureRecord();
    const at = handwritten({ page: false, row: true });
    expect(() =>
      writeCompiledIdea({ record, slug: SLUG, ideasDir: at.ideasDir, writeManifest: false, ownershipManifestPath: at.manifestPath, force: true, allowFixture: true }),
    ).toThrow(/^refusing to replace the handwritten idea ai-code-reviewer/);
    expect(fs.existsSync(at.mdxPath)).toBe(false);
  });

  it("replaces a handwritten idea only when asked to explicitly", () => {
    const record = buildFixtureRecord();
    const at = handwritten({ page: true, row: true });
    const written = writeCompiledIdea({
      record,
      slug: SLUG,
      ideasDir: at.ideasDir,
      manifestPath: at.manifestPath,
      force: true,
      replaceHandwritten: true,
      allowFixture: true,
    });
    expect(fs.readFileSync(at.mdxPath, "utf8")).toBe(written.mdx);
    const rows: unknown = JSON.parse(fs.readFileSync(at.manifestPath, "utf8")).ideas;
    expect(rows).toEqual([{ slug: "other-idea", source: "mode-b:backfill" }, written.manifestEntry]);
  });

  it("lets force replace the compiler's own earlier output (marker or engine:* row)", () => {
    const record = buildFixtureRecord();
    for (const earlier of ["marker", "row"] as const) {
      const at = handwritten({ page: false, row: false });
      const marked = earlier === "marker" ? HANDWRITTEN_MDX.replace("---\n\n", "engine: true\n---\n\n") : HANDWRITTEN_MDX;
      fs.writeFileSync(at.mdxPath, marked);
      if (earlier === "row") fs.writeFileSync(at.manifestPath, JSON.stringify({ ideas: [{ slug: SLUG, source: `engine:${SLUG}` }] }));
      const written = writeCompiledIdea({ record, slug: SLUG, ideasDir: at.ideasDir, manifestPath: at.manifestPath, force: true, allowFixture: true });
      expect(fs.readFileSync(at.mdxPath, "utf8"), earlier).toBe(written.mdx);
    }
  });
});

describe("compile manifest stub", () => {
  it("publishes timing from the timing score, never from execution", () => {
    const record = buildFixtureRecord((r) => {
      r.scores = { opportunity: 8, pain: 7, timing: 6, builderConfidence: 5, execution: 2 };
    });
    expect(compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG }).manifestEntry.scores).toEqual({
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
    expect(compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG }).manifestEntry.scores).toBeUndefined();
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
      sources: new Map([
        [url, { status: "read", text, retrievedAt: "2026-09-30T12:00:00.000Z", roles: ["market", "competitors", "community"] }],
      ]),
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
      if (r.editorial) r.editorial.competitiveNarrative = "Several per-seat products compete for the same small teams.";
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

describe("fixture records compile only to draft or temp slugs (R11, P2-8)", () => {
  it("refuses a fixture-mode record for a public slug and names the rule", () => {
    const record = buildFixtureRecord();
    expect(record.mode).toBe("fixture");
    for (const slug of [undefined, "signalpass", "ai-code-reviewer"]) {
      const issues = compileIssues(record, slug ?? record.brief.slug);
      expect(issues.join("\n"), slug).toContain(
        `record mode is "fixture" (synthetic research): compile it only to an engine-draft-* or _temp slug, not '${slug ?? record.brief.slug}' (ruling R11; tests may pass --allow-fixture)`,
      );
    }
  });

  it("compiles it to engine-draft-* and _temp slugs, or anywhere with the test-only allowFixture option", () => {
    const record = buildFixtureRecord();
    for (const slug of [FIXTURE_PAGE_SLUG, "_engine-fixture-temp"]) {
      expect(compileResearchRecord({ record, slug }).slug).toBe(slug);
    }
    expect(compileResearchRecord({ record, slug: "signalpass", allowFixture: true }).slug).toBe("signalpass");
  });

  it("compiles a live-mode record to a public slug and records the mode in the manifest stub", () => {
    const record = buildFixtureRecord((r) => {
      r.mode = "live";
    });
    const { manifestEntry } = compileResearchRecord({ record, slug: "signalpass" });
    expect(manifestEntry.provenance.researchMode).toBe("live");
    expect(compileFixture().manifestEntry.provenance.researchMode).toBe("fixture");
  });
});

describe("evidence tokens only where the compiler expands them", () => {
  it("never compiles a token in a field that takes none (WRITER_FIELD_TOKEN_KINDS): the record parser refuses it", () => {
    const base = buildFixtureRecord();
    const statToken = tok(EV.statMeasured);
    const cases: Array<[WriterTextField, string, (r: ResearchRecordV2) => void]> = [
      ["editorial.productName", "editorial.productName", (r) => { if (r.editorial) r.editorial.productName = `SignalPass ${statToken}`; }],
      ["editorial.pricingTiers[].name", "editorial.pricingTiers[0].name", (r) => { const t = r.editorial?.pricingTiers?.[0]; if (t) t.name = `Open ${statToken}`; }],
      ["howItWorks[]", "howItWorks[0]", (r) => { r.howItWorks[0] = `Connect ${statToken} — Install the GitHub App on one repository.`; }],
      ["editorial.yearOne.funnel[].stage", "editorial.yearOne.funnel[0].stage", (r) => { const f = r.editorial?.yearOne?.funnel[0]; if (f) f.stage = `Visitors ${statToken}`; }],
      ["goToMarket.channels[]", "goToMarket.channels[0]", (r) => { r.goToMarket.channels[0] = `Outreach ${statToken}`; }],
    ];
    for (const [field, path, edit] of cases) {
      expect(WRITER_FIELD_TOKEN_KINDS[field], field).toEqual([]);
      const record = structuredClone(base);
      edit(record);
      expect(() => compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG }), path).toThrow(ResearchRecordParseError);
      expect(() => compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG }), path).toThrow(
        `${path}: evidence ${EV.statMeasured.id} cannot be cited here (this field takes no evidence tokens)`,
      );
    }
  });

  it("lists in ## Sources exactly the sources of usedEvidenceIds, the set the auditor checks", () => {
    const record = buildFixtureRecord();
    const used = usedEvidenceIds(record);
    const urls = new Set(record.evidence.accepted.filter((e) => used.has(e.id)).map((e) => e.sourceUrl));
    const { mdx } = compileFixture(record);
    const sources = mdx.slice(mdx.indexOf("## Sources"));
    const listed = [...sources.matchAll(/^- \[[^\]]*\]\(([^)]+)\)$/gm)].map((m) => m[1]);
    expect(new Set(listed)).toEqual(urls);
    expect(listed).toHaveLength(urls.size);
    expect(urls.has(FIXTURE_PAGES.reddit.url)).toBe(false);
  });
});
