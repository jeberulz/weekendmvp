/**
 * The final gate runs in linear time on hostile text (WP54 round 4,
 * security). A page or record is untrusted input, and no regular expression
 * the auditor applies to it page-wide may backtrack on a long run of spaces,
 * line breaks, digits or brackets.
 *
 * Before (measured on the auditor's own expressions):
 *   - the revenue-total rule took ~0.37 s on "ARR" followed by 1,000
 *     spaces, ~2.6 s on 2,000 and ~23 s on 4,000; 20,000 did not finish in
 *     10 minutes;
 *   - the computation and money patterns took ~1 s on 20,000 digits;
 *   - pageProductName's " for …" cut took ~0.8 s on three 20,000-character
 *     titles, splitViaLabel ~1.2 s on 20,000 spaces around a label;
 *   - the base bar's line-start patterns took ~1.9 s on 20,000 blank
 *     lines, its link count ~0.8 s on 20,000 "[", its heading split ~0.7 s
 *     on a heading with 20,000 spaces, the frontmatter slug and section
 *     split ~1 s on 20,000 spaces.
 * After, only the MDX parser itself (third party) stays above 0.1 s at
 * this size, on runs of underscores, dots or list markers; it is bounded by
 * the 64 KiB input limit (ruling R16, the last block below).
 * Every case audits a 20,000-character run and must finish within
 * BUDGET_MS; one also checks that the rules still fire.
 */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditEngineArtifact, MAX_AUDIT_BYTES } from "./artifact-audit.ts";
import {
  auditCli,
  auditPage,
  cleanupTempDirs,
  compiledPage,
  pageBody,
  REPO_ROOT,
  replaceOnce,
  writePage,
} from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord } from "./__fixtures__/recordV2.ts";
import { pageProductName, parseYearOneLine, splitViaLabel } from "./page-format.ts";

const RUN = 20_000;
const BUDGET_MS = 1_000;
const SPACES = " ".repeat(RUN);
const record = buildFixtureRecord();
const page = compiledPage(record);

function elapsedMs(fn: () => unknown): number {
  const started = performance.now();
  fn();
  return performance.now() - started;
}

async function elapsedMsAsync(fn: () => Promise<unknown>): Promise<number> {
  const started = performance.now();
  await fn();
  return performance.now() - started;
}

/** The page with `text` as its own block right before `## heading`. */
function before(heading: string, text: string): string {
  return replaceOnce(page, `\n## ${heading}`, `\n${text}\n\n## ${heading}`);
}

/** The page with `text` as the first lines of the first build prompt (fence text is audited as written). */
function inPrompt(text: string): string {
  const fence = "```text\n";
  const at = page.indexOf(fence);
  if (at < 0) throw new Error("fixture: the page has no build prompt fence");
  const start = at + fence.length;
  return `${page.slice(0, start)}${text}\n${page.slice(start)}`;
}

async function importScript(relative: string): Promise<Record<string, unknown>> {
  const mod: unknown = await import(pathToFileURL(path.join(REPO_ROOT, relative)).href);
  if (typeof mod !== "object" || mod === null) throw new Error(`${relative} did not load`);
  return Object.fromEntries(Object.entries(mod));
}

beforeAll(async () => {
  // Load and warm the auditor once, so no case pays for module loading.
  await auditPage(page, record);
});

afterAll(() => {
  cleanupTempDirs();
});

describe("the final artifact audit is linear on hostile runs (deep bar)", () => {
  const cases: Array<[string, string]> = [
    ['"ARR" + 20,000 spaces in prose', before("The Solution", `Plans ARR${SPACES}end.`)],
    ['"ARR" + 20,000 spaces in a build prompt', inPrompt(`ARR${SPACES}`)],
    ['"ARR" + 20,000 tabs and line breaks in a build prompt', inPrompt(`ARR${"\t\n".repeat(RUN / 2)}`)],
    ['"revenue of" + 20,000 spaces + "~" in a build prompt', inPrompt(`revenue of${SPACES}~`)],
    ['"$1" + 20,000 spaces + "in annual" in a build prompt', inPrompt(`$1${SPACES}in annual`)],
    ['"annual " x 2,857 + "ARR $" in a build prompt', inPrompt(`${"annual ".repeat(Math.floor(RUN / 7))}ARR $`)],
    ["20,000 digits in a build prompt", inPrompt("1".repeat(RUN))],
    ["20,000 digits in prose", before("The Solution", `${"1".repeat(RUN)}.`)],
    ['"1," x 10,000 in a build prompt', inPrompt("1,".repeat(RUN / 2))],
    ['"$1," x 10,000 in a build prompt', inPrompt(`$${"1,".repeat(RUN / 2)}`)],
    ['"1 × $1" + 20,000 spaces in a build prompt', inPrompt(`1 × $1${SPACES}`)],
    ['"1 × $1" + "/a" x 10,000 in a build prompt', inPrompt(`1 × $1${"/a".repeat(RUN / 2)}`)],
    ["20,000 quotation marks in a build prompt", inPrompt('"'.repeat(RUN))],
    ['"[[" + 20,000 spaces in a build prompt', inPrompt(`[[${SPACES}ev`)],
    ["a competitor name 1,818 times in prose", before("The Solution", `${"CodeRabbit ".repeat(Math.floor(RUN / 11))}.`)],
    ["10,000 one-line paragraphs", before("The Solution", "word\n\n".repeat(RUN / 6))],
  ];
  it.each(cases)("%s", (_label, mdx) => {
    const body = pageBody(mdx);
    expect(elapsedMs(() => auditEngineArtifact(body, record, {}))).toBeLessThan(BUDGET_MS);
  });

  it("still flags a revenue total and a computation after 20,000 spaces", () => {
    const body = pageBody(before("The Solution", `Plans ARR${SPACES}$54,000 a year, or 45${SPACES}× $100/mo = $54,000.`));
    let errors: string[] = [];
    expect(elapsedMs(() => (errors = auditEngineArtifact(body, record, {}).errors))).toBeLessThan(BUDGET_MS);
    expect(errors.some((e) => e.includes("states another revenue total"))).toBe(true);
    expect(errors.some((e) => e.includes("a Year-One-style computation"))).toBe(true);
  });

  it("is linear without a usable record too (Business Model revenue check)", () => {
    for (const text of [`${"1".repeat(RUN)} ARR`, `ARR ${"1,".repeat(RUN / 2)}`]) {
      const body = pageBody(before("Recommended Tech Stack", text));
      expect(elapsedMs(() => auditEngineArtifact(body, null, {}))).toBeLessThan(BUDGET_MS);
    }
  });
});

describe("page-format helpers are linear on hostile runs", () => {
  it("pageProductName on a title with 20,000 spaces", () => {
    // brief.title holds at most 20,000 characters.
    const spaces = " ".repeat(RUN - 20);
    for (const title of [`a${spaces}b`, `a for${spaces}b\nc`, `a${spaces}for b`]) {
      const titled = buildFixtureRecord((r) => {
        r.brief.title = title;
        // Without editorial.productName the name comes from the title.
        if (r.editorial) delete r.editorial.productName;
      });
      expect(elapsedMs(() => pageProductName(titled))).toBeLessThan(BUDGET_MS);
    }
  });

  it("splitViaLabel and parseYearOneLine on 20,000 spaces", () => {
    expect(elapsedMs(() => splitViaLabel(`a${SPACES}b`))).toBeLessThan(BUDGET_MS);
    expect(elapsedMs(() => splitViaLabel(`$12/user/month${SPACES}(via x.example)${SPACES}y`))).toBeLessThan(BUDGET_MS);
    expect(elapsedMs(() => parseYearOneLine(`45 × $100/mo = $54,000 ARR — ${"a ".repeat(RUN / 2)}x`))).toBeLessThan(BUDGET_MS);
  });
});

describe("the base bar and the whole auditor are linear on hostile runs", () => {
  const cases: Array<[string, string]> = [
    ['"ARR" + 20,000 spaces in a build prompt', inPrompt(`ARR${SPACES}`)],
    ["20,000 blank lines in The Solution", before("Market Research", `${"\n".repeat(RUN)}x`)],
    ["20,000 blank lines in Competitive Landscape", before("Business Model", `${"\n".repeat(RUN)}x`)],
    ["20,000 blank lines in Business Model", before("Recommended Tech Stack", `${"\n".repeat(RUN)}x`)],
    ["20,000 blank lines in the build prompts", before("Sources", `${"\n".repeat(RUN)}x`)],
    ['20,000 "[" in Sources', `${page}\n${"[".repeat(RUN)}\n`],
    ['20,000 "[" in prose', before("The Solution", `${"[".repeat(RUN)}.`)],
    ["a heading with 20,000 spaces", before("The Solution", `## x${SPACES}y`)],
  ];
  it.each(cases)("%s", async (_label, mdx) => {
    expect(await elapsedMsAsync(() => auditPage(mdx, record))).toBeLessThan(BUDGET_MS);
  });

  it("the frontmatter slug and the section split on 20,000 spaces", async () => {
    const audit = await importScript("scripts/audit-idea-mdx.mjs");
    const { frontmatterSlug, splitSections } = audit;
    if (typeof frontmatterSlug !== "function" || typeof splitSections !== "function") throw new Error("audit-idea-mdx exports missing");
    expect(elapsedMs(() => frontmatterSlug(`---\nslug: a${SPACES}b\n---\n`))).toBeLessThan(BUDGET_MS);
    expect(elapsedMs(() => splitSections(`## x${SPACES}y\n`))).toBeLessThan(BUDGET_MS);
  });
});

/**
 * The base bar's linear patterns find what the backtracking ones they
 * replaced found (so no rule moved), checked on generated markdown-like text
 * small enough for the old patterns to finish quickly.
 */
describe("the base bar's linear patterns match their predecessors", () => {
  const LS = String.fromCharCode(0x2028);
  const PIECES = [
    "\n", "\n\n", " ", "  ", "\t", "\r\n", LS, "\u00a0", "## ", "##", "# ", "- ", "* ", "1. ", "12. ", "**", "x", "Title", "step 2",
    "[", "]", "(", ")", "[a](https://a.example)", "](https://b.example)", "![", "```text\n", "```", " — ", "—", "(Pro)",
    "**How it works:**", "**1. Project Setup**", "users(", "- users (", "slug:", "\"s\"", "'s'",
    "- **Team** ($20/month)", "  * **Solo** (x)\n", "\n1. **Name** — does x", "2. **Step 2** - y\n", "**2. Build** ```text\nbody```",
    "\n- **Acme**: $5", "\n  1. x",
  ];
  /** Deterministic pseudo-random concatenations of PIECES (mulberry32). */
  function generated(count: number, maxPieces: number, seed: number): string[] {
    let state = seed >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const length = Math.floor(next() * (maxPieces + 1));
      let text = "";
      for (let j = 0; j < length; j += 1) text += PIECES[Math.floor(next() * PIECES.length)] ?? "";
      out.push(text);
    }
    return out;
  }
  const texts = generated(8_000, 14, 2026);

  type Fn = (...args: unknown[]) => unknown;
  function fn(mod: Record<string, unknown>, name: string): Fn {
    const value = mod[name];
    if (typeof value !== "function") throw new Error(`${name} export missing`);
    return (...args: unknown[]) => Reflect.apply(value, undefined, args);
  }
  const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
  const groups = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m.slice(1));

  it("audit-idea-mdx: sections, links, slug, How-it-works steps, competitor rows, unit-economics bullets", async () => {
    const audit = await importScript("scripts/audit-idea-mdx.mjs");
    const splitSections = fn(audit, "splitSections");
    const countMarkdownLinks = fn(audit, "countMarkdownLinks");
    const frontmatterSlug = fn(audit, "frontmatterSlug");
    const countHowToSteps = fn(audit, "countHowToSteps");
    const countCompetitorMentions = fn(audit, "countCompetitorMentions");
    const oldSections = (body: string) => {
      const matches = [...body.matchAll(/^##[ \t]+(.+?)\s*$/gm)];
      return matches.map((m, i) => ({
        title: (m[1] ?? "").trim(),
        content: body.slice((m.index ?? 0) + m[0].length, matches[i + 1]?.index ?? body.length),
      }));
    };
    const oldSlug = (frontmatter: string) => /^slug:[ \t]*(.+?)[ \t]*$/m.exec(frontmatter)?.[1] ?? null;
    const newSlug = (frontmatter: string) => frontmatterSlug(`---\n${frontmatter}\n---\n`);
    const oldSlugValue = (frontmatter: string) => {
      const value = oldSlug(`---\n${frontmatter}\n---`);
      if (value === null) return null;
      if (value.startsWith('"')) {
        try {
          const parsed: unknown = JSON.parse(value);
          return typeof parsed === "string" ? parsed : null;
        } catch {
          return null;
        }
      }
      return value.replace(/^'|'$/g, "");
    };
    const oldSteps = (content: string) => {
      const at = content.indexOf("**How it works:**");
      return at === -1 ? 0 : count(content.slice(at + "**How it works:**".length), /^\s*\d+\.\s+\S/gm);
    };
    const oldMentions = (content: string) => count(content, /^\s*[-*]\s+\*\*[^*]+\*\*/gm) || count(content, /^\s*[-*]\s+\S/gm);
    for (const text of texts) {
      expect(splitSections(text), JSON.stringify(text)).toEqual(oldSections(text));
      expect(countMarkdownLinks(text), JSON.stringify(text)).toBe(count(text, /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g));
      expect(newSlug(text), JSON.stringify(text)).toBe(oldSlugValue(text));
      expect(countHowToSteps(text), JSON.stringify(text)).toBe(oldSteps(text));
      expect(countCompetitorMentions(text), JSON.stringify(text)).toBe(oldMentions(text));
      // The unit-economics bullets (inline in auditIdeaFile).
      expect(groups(text, /^[^\S\n\r\u2028\u2029]*[-*]\s+\*\*([^*]+)\*\*/gm), JSON.stringify(text)).toEqual(
        groups(text, /^\s*[-*]\s+\*\*([^*]+)\*\*/gm),
      );
    }
  });

  it("idea-quality: sentence prose, How-it-works naming, tier names, setup tables, prompt blocks", async () => {
    const quality = await importScript("scripts/lib/idea-quality.mjs");
    const proseForSentences = fn(quality, "proseForSentences");
    const auditHowItWorksNaming = fn(quality, "auditHowItWorksNaming");
    const findTierMismatches = fn(quality, "findTierMismatches");
    const setupTableNames = fn(quality, "setupTableNames");
    const promptBlocks = fn(quality, "promptBlocks");
    const words = (text: unknown) => String(text).split(/\s+/).filter(Boolean).length;
    /** proseForSentences up to its link step: code, headings and quote marks removed. */
    const beforeLinks = (body: string) =>
      body
        .replace(/```[\s\S]*?```/g, "\n")
        .replace(/`[^`]*`/g, " ")
        .replace(/^#+\s.+$/gm, " ")
        .replace(/^>\s?/gm, "");
    const oldProse = (body: string) =>
      beforeLinks(body)
        .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, " ")
        .replace(/^\s*[-*]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/\*\*/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const oldNaming = (content: string) => {
      const steps = [...content.matchAll(/^\s*(\d+)\.\s+\*\*([^*]+)\*\*\s+[—-]\s+(.+)$/gm)];
      if (steps.length === 0) return count(content, /^\s*\d+\.\s+\S/gm) > 0 ? ["bare"] : [];
      return steps.map((m) => (m[2] ?? "").trim()).filter((title) => /^step\s*\d+$/i.test(title));
    };
    const newNaming = (content: string) => {
      const errors = auditHowItWorksNaming(content);
      if (!Array.isArray(errors)) throw new Error("auditHowItWorksNaming result");
      return errors.map((e) => (String(e).startsWith("How-it-works steps must use named titles") ? "bare" : (/'(.*)'/.exec(String(e))?.[1] ?? "")));
    };
    const oldTierNames = (content: string) => groups(content, /^\s*[-*]\s+\*\*([^*]+)\*\*\s+\(([^)]+)\)/gm).map((g) => (g[0] ?? "").trim());
    const oldTables = (text: string) => groups(text, /^\s*-\s*([a-z][a-z0-9_]*)\s*\(/gm).map((g) => g[0]);
    const oldBlocks = (content: string) =>
      [...content.matchAll(/\*\*\d+\.\s+([^*]+)\*\*\s*```text\n([\s\S]*?)```/g)].map((m) => ({ title: (m[1] ?? "").trim(), text: m[2] }));
    for (const text of texts) {
      const label = JSON.stringify(text);
      // Link text with a second "[" before its "]" now ends at that bracket: the
      // text before it stays in the prose (more prose checked, never less).
      if (!/\[[^\]]*\[/.test(beforeLinks(text))) expect(proseForSentences(text), label).toBe(oldProse(text));
      expect(newNaming(text), label).toEqual(oldNaming(text));
      expect(findTierMismatches(text, text), label).toEqual(findTierMismatchesWith(oldTierNames(text), text));
      expect(setupTableNames(text), label).toEqual(oldTables(text));
      // A title made only of spaces is no title: the old pattern let \s+ hand
      // spaces back to it; such a block is no longer counted (stricter).
      const expected = oldBlocks(text).filter((b) => b.title !== "");
      const blocks = promptBlocks(text, words);
      if (!Array.isArray(blocks)) throw new Error("promptBlocks result");
      expect(blocks.map((b: { title: string; text: string }) => ({ title: b.title, text: b.text })), label).toEqual(expected);
    }

    /** findTierMismatches with the tier names given (the rest of its logic unchanged). */
    function findTierMismatchesWith(tierNames: string[], promptsContent: string): unknown {
      return findTierMismatches(tierNames.map((name) => `- **${name}** (x)`).join("\n"), promptsContent);
    }
  });
});

/**
 * Ruling R16: the third-party MDX parser is quadratic on some character runs
 * (65,536 underscores take it seconds), so the auditor refuses a page larger
 * than 64 KiB before parsing it. Published idea pages are under 25 KB and
 * compiled pages about 20 KB.
 */
describe("the auditor refuses a page over 64 KiB before parsing it (R16)", () => {
  const LIMIT_ERROR = /^page is 65,537 bytes, over the 65,536-byte \(64 KiB\) audit limit \(ruling R16\); refused before parsing$/;

  /** The compiled page grown to exactly `bytes` bytes with trailing blank lines (harmless to every check). */
  function paddedTo(bytes: number): string {
    const size = Buffer.byteLength(page, "utf8");
    if (size > bytes) throw new Error(`fixture: the compiled page is already ${size} bytes`);
    return page + "\n".repeat(bytes - size);
  }

  /** The compiled page grown to exactly `bytes` bytes with an underscore run the parser needs seconds for. */
  function slowToParse(bytes: number): string {
    const head = `${page}\n`;
    const run = bytes - Buffer.byteLength(head, "utf8") - 2;
    return `${head}${"_".repeat(run)}x\n`;
  }

  it("is 64 KiB", () => {
    expect(MAX_AUDIT_BYTES).toBe(65_536);
  });

  it("refuses a page of 64 KiB + 1 byte at once, without parsing it", async () => {
    for (const mdx of [paddedTo(MAX_AUDIT_BYTES + 1), slowToParse(MAX_AUDIT_BYTES + 1)]) {
      expect(Buffer.byteLength(mdx, "utf8")).toBe(MAX_AUDIT_BYTES + 1);
      let result: { ok: boolean; errors: string[]; metrics: unknown } = { ok: true, errors: [], metrics: null };
      const ms = await elapsedMsAsync(async () => {
        result = await auditPage(mdx, record);
      });
      expect(ms).toBeLessThan(BUDGET_MS);
      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(LIMIT_ERROR);
      expect(result.metrics).toBeNull();
    }
  });

  it("audits a page of exactly 64 KiB as usual", async () => {
    const mdx = paddedTo(MAX_AUDIT_BYTES);
    expect(Buffer.byteLength(mdx, "utf8")).toBe(MAX_AUDIT_BYTES);
    const result = await auditPage(mdx, record);
    expect(result.errors).toEqual([]);
    expect(result.metrics?.deep).toBe(true);
  });

  it("refuses an oversized body in the deep audit itself, before parsing", () => {
    const body = pageBody(slowToParse(MAX_AUDIT_BYTES + 200));
    let errors: string[] = [];
    expect(elapsedMs(() => (errors = auditEngineArtifact(body, record, {}).errors))).toBeLessThan(BUDGET_MS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^page is [\d,]+ bytes, over the 65,536-byte \(64 KiB\) audit limit \(ruling R16\); refused before parsing$/);
    expect(auditEngineArtifact(pageBody(paddedTo(MAX_AUDIT_BYTES)), record, {}).errors).toEqual([]);
  });

  it("refuses an oversized file through the CLI (--file), exit 1", async () => {
    const run = await auditCli(writePage(slowToParse(MAX_AUDIT_BYTES + 1), record));
    expect(run.code).toBe(1);
    expect(run.result.errors).toHaveLength(1);
    expect(run.result.errors[0]).toMatch(LIMIT_ERROR);
  }, 30_000);

  it("changes no verdict of the published corpus: every idea page and engine draft is under the limit", () => {
    const pages = [
      ...fs.readdirSync(path.join(REPO_ROOT, "content", "ideas")).filter((f) => f.endsWith(".mdx") && !f.startsWith("_")).map((f) => path.join(REPO_ROOT, "content", "ideas", f)),
      ...fs.readdirSync(path.join(REPO_ROOT, "engine", "drafts")).filter((f) => f.endsWith(".mdx")).map((f) => path.join(REPO_ROOT, "engine", "drafts", f)),
    ];
    expect(pages.length).toBeGreaterThan(200);
    const over = pages.filter((file) => fs.statSync(file).size > MAX_AUDIT_BYTES).map((file) => path.relative(REPO_ROOT, file));
    expect(over).toEqual([]);
  });
});
