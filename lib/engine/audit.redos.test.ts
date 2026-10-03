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
 * this size, on runs of underscores, dots or list markers; R16 bounds it
 * (the last two blocks below).
 *
 * The full gate runs this file alongside everything else, so no assertion is
 * a tight wall-clock budget. Each case is timed at a run of n and of 4n
 * characters (inside the R16 limits, so it reaches the rule it targets),
 * three times each, interleaved; the fastest of each counts, so a load spike
 * in one run does not. No single run may take CATASTROPHE_MS (catastrophic
 * backtracking took minutes; the smaller size runs first, so it fails there
 * instead of hanging), and the fastest time may grow at most GROWTH× from n
 * to 4n: linear code grows at most 4× (less with its fixed costs), a
 * quadratic rule up to 16×. Load slows both sizes alike, so the ratio holds.
 */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditComplexityError,
  auditEngineArtifact,
  MAX_AUDIT_BYTES,
  MAX_BLOCK_BRACKETS,
  MAX_BLOCK_BYTES,
  MAX_BLOCK_DELIMITERS,
  MAX_TABLE_LINES,
} from "./artifact-audit.ts";
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

/** The longest run a case uses (its 4n), kept inside the R16 block limits so every case reaches the rule it targets. */
const RUN = 12_000;
/** No single timed run may take this long; catastrophic backtracking took minutes. */
const CATASTROPHE_MS = 5_000;
/** The fastest time may grow at most this much from n to 4n (linear at most 4×, quadratic up to 16×). */
const GROWTH = 6;
/** Timer noise allowed on top of GROWTH, for runs of a few milliseconds. */
const SLACK_MS = 50;
const BACKSLASH = String.fromCharCode(92);
const SPACES = " ".repeat(RUN);
const record = buildFixtureRecord();
const page = compiledPage(record);

/** "12,000". */
function k(n: number): string {
  return n.toLocaleString("en-US");
}

type Run = () => unknown;

async function elapsedMs(run: Run): Promise<number> {
  const started = performance.now();
  await run();
  return performance.now() - started;
}

/** The fastest of `rounds` interleaved timings of `small` (a run of n) and `large` (4n); no run may reach CATASTROPHE_MS. */
async function fastestPair(small: Run, large: Run, n: number, rounds: number): Promise<[number, number]> {
  let fastSmall = Number.POSITIVE_INFINITY;
  let fastLarge = Number.POSITIVE_INFINITY;
  for (let round = 0; round < rounds; round += 1) {
    const smallMs = await elapsedMs(small);
    expect(smallMs, `a run of ${k(n)} took ${Math.round(smallMs)} ms`).toBeLessThan(CATASTROPHE_MS);
    fastSmall = Math.min(fastSmall, smallMs);
    const largeMs = await elapsedMs(large);
    expect(largeMs, `a run of ${k(4 * n)} took ${Math.round(largeMs)} ms`).toBeLessThan(CATASTROPHE_MS);
    fastLarge = Math.min(fastLarge, largeMs);
  }
  return [fastSmall, fastLarge];
}

/**
 * Times `at(n)` and `at(4 * n)` (each builds its input first and returns the
 * run to time) and checks the fastest timings: no run reaches
 * CATASTROPHE_MS, and the time grows at most GROWTH× (plus SLACK_MS) from n
 * to 4n. A growth past that is measured once more before it counts: a load
 * burst can slow every run of one size, a real regression shows again.
 */
async function expectNearLinear(at: (n: number) => Run, n: number): Promise<void> {
  const small = at(n);
  const large = at(4 * n);
  let [fastSmall, fastLarge] = await fastestPair(small, large, n, 3);
  if (fastLarge > GROWTH * fastSmall + SLACK_MS) {
    const [againSmall, againLarge] = await fastestPair(small, large, n, 5);
    fastSmall = Math.min(fastSmall, againSmall);
    fastLarge = Math.min(fastLarge, againLarge);
  }
  expect(fastLarge, `fastest run: ${Math.round(fastSmall)} ms at ${k(n)}, ${Math.round(fastLarge)} ms at ${k(4 * n)}`).toBeLessThanOrEqual(
    GROWTH * fastSmall + SLACK_MS,
  );
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

/** The deep audit of `mdx` as a run, after checking R16 lets it through to the rules. */
function deepRun(mdx: string, withRecord = true): Run {
  const body = pageBody(mdx);
  expect(auditComplexityError(body)).toBeNull();
  return () => auditEngineArtifact(body, withRecord ? record : null, {});
}

/** The whole auditor on `mdx` as a run, after checking R16 lets it through to the rules. */
function fullRun(mdx: string): Run {
  expect(auditComplexityError(mdx)).toBeNull();
  return () => auditPage(mdx, record);
}

beforeAll(async () => {
  // Load and warm the auditor once, so no case pays for module loading.
  await auditPage(page, record);
});

afterAll(() => {
  cleanupTempDirs();
});

const TIMEOUT = 60_000;

describe(`the final artifact audit is linear on hostile runs (deep bar; runs of ${k(RUN / 4)} and ${k(RUN)})`, () => {
  const cases: Array<[string, (n: number) => string]> = [
    ['"ARR" + spaces in prose', (n) => before("The Solution", `Plans ARR${" ".repeat(n)}end.`)],
    ['"ARR" + spaces in a build prompt', (n) => inPrompt(`ARR${" ".repeat(n)}`)],
    ['"ARR" + tabs and line breaks in a build prompt', (n) => inPrompt(`ARR${"\t\n".repeat(n / 2)}`)],
    ['"revenue of" + spaces + "~" in a build prompt', (n) => inPrompt(`revenue of${" ".repeat(n)}~`)],
    ['"$1" + spaces + "in annual" in a build prompt', (n) => inPrompt(`$1${" ".repeat(n)}in annual`)],
    ['"annual " repeated + "ARR $" in a build prompt', (n) => inPrompt(`${"annual ".repeat(Math.floor(n / 7))}ARR $`)],
    ["digits in a build prompt", (n) => inPrompt("1".repeat(n))],
    ["digits in prose", (n) => before("The Solution", `${"1".repeat(n)}.`)],
    ['"1," repeated in a build prompt', (n) => inPrompt("1,".repeat(n / 2))],
    ['"$1," repeated in a build prompt', (n) => inPrompt(`$${"1,".repeat(n / 2)}`)],
    ['"1 × $1" + spaces in a build prompt', (n) => inPrompt(`1 × $1${" ".repeat(n)}`)],
    ['"1 × $1" + "/a" repeated in a build prompt', (n) => inPrompt(`1 × $1${"/a".repeat(n / 2)}`)],
    ["quotation marks in a build prompt", (n) => inPrompt('"'.repeat(n))],
    ['"[[" + spaces in a build prompt', (n) => inPrompt(`[[${" ".repeat(n)}ev`)],
    ["a competitor name repeated in prose", (n) => before("The Solution", `${"CodeRabbit ".repeat(Math.floor(n / 11))}.`)],
    ["one-line paragraphs", (n) => before("The Solution", "word\n\n".repeat(n / 6))],
  ];
  it.each(cases)(
    "%s",
    async (_label, build) => {
      await expectNearLinear((n) => deepRun(build(n)), RUN / 4);
    },
    TIMEOUT,
  );

  it(`still flags a revenue total and a computation after ${k(RUN)} spaces`, async () => {
    const body = pageBody(before("The Solution", `Plans ARR${SPACES}$54,000 a year.\n\nOr 45${SPACES}× $100/mo = $54,000.`));
    expect(auditComplexityError(body)).toBeNull();
    let errors: string[] = [];
    expect(await elapsedMs(() => (errors = auditEngineArtifact(body, record, {}).errors))).toBeLessThan(CATASTROPHE_MS);
    expect(errors.some((e) => e.includes("states another revenue total"))).toBe(true);
    expect(errors.some((e) => e.includes("a Year-One-style computation"))).toBe(true);
  });

  it.each([
    ["digits + ARR", (n: number) => `${"1".repeat(n)} ARR`],
    ['"ARR " + "1," repeated', (n: number) => `ARR ${"1,".repeat(n / 2)}`],
  ])(
    "is linear without a usable record too (Business Model revenue check): %s",
    async (_label, text) => {
      await expectNearLinear((n) => deepRun(before("Recommended Tech Stack", text(n)), false), RUN / 4);
    },
    TIMEOUT,
  );
});

describe("page-format helpers are linear on hostile runs", () => {
  it(
    "pageProductName on titles with long runs of spaces",
    async () => {
      // brief.title holds at most 20,000 characters: runs of 4,000 and 16,000.
      await expectNearLinear((n) => {
        const spaces = " ".repeat(n);
        const titled = [`a${spaces}b`, `a for${spaces}b\nc`, `a${spaces}for b`].map((title) =>
          buildFixtureRecord((r) => {
            r.brief.title = title;
            // Without editorial.productName the name comes from the title.
            if (r.editorial) delete r.editorial.productName;
          }),
        );
        return () => titled.map((r) => pageProductName(r));
      }, 4_000);
    },
    TIMEOUT,
  );

  it(
    "splitViaLabel and parseYearOneLine on long runs of spaces",
    async () => {
      await expectNearLinear((n) => {
        const spaces = " ".repeat(n);
        return () => [
          splitViaLabel(`a${spaces}b`),
          splitViaLabel(`$12/user/month${spaces}(via x.example)${spaces}y`),
          parseYearOneLine(`45 × $100/mo = $54,000 ARR — ${"a ".repeat(n / 2)}x`),
        ];
      }, 5_000);
    },
    TIMEOUT,
  );
});

describe(`the base bar and the whole auditor are linear on hostile runs`, () => {
  const cases: Array<[string, (n: number) => string, number]> = [
    ['"ARR" + spaces in a build prompt', (n) => inPrompt(`ARR${" ".repeat(n)}`), RUN / 4],
    ["blank lines in The Solution", (n) => before("Market Research", `${"\n".repeat(n)}x`), 5_000],
    ["blank lines in Competitive Landscape", (n) => before("Business Model", `${"\n".repeat(n)}x`), 5_000],
    ["blank lines in Business Model", (n) => before("Recommended Tech Stack", `${"\n".repeat(n)}x`), 5_000],
    ["blank lines in the build prompts", (n) => before("Sources", `${"\n".repeat(n)}x`), 5_000],
    // One "[" per block: within the block limits, and the link patterns' text classes cross lines.
    // Smaller runs: every "[" is a paragraph for the MDX parser.
    ['"[" in Sources', (n) => `${page}\n${"[\n\n".repeat(n)}`, RUN / 8],
    ['"[" in prose', (n) => before("The Solution", "[\n\n".repeat(n)), RUN / 8],
    ["a heading with a long run of spaces", (n) => before("The Solution", `## x${" ".repeat(n)}y`), RUN / 4],
  ];
  it.each(cases)(
    "%s",
    async (_label, build, n) => {
      await expectNearLinear((size) => fullRun(build(size)), n);
    },
    TIMEOUT,
  );

  it(
    "the frontmatter slug and the section split on long runs of spaces",
    async () => {
      const audit = await importScript("scripts/audit-idea-mdx.mjs");
      const { frontmatterSlug, splitSections } = audit;
      if (typeof frontmatterSlug !== "function" || typeof splitSections !== "function") throw new Error("audit-idea-mdx exports missing");
      await expectNearLinear((n) => {
        const spaces = " ".repeat(n);
        return () => [frontmatterSlug(`---\nslug: a${spaces}b\n---\n`), splitSections(`## x${spaces}y\n`)];
      }, 5_000);
    },
    TIMEOUT,
  );
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
      const ms = await elapsedMs(async () => {
        result = await auditPage(mdx, record);
      });
      expect(ms).toBeLessThan(CATASTROPHE_MS);
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

  it("refuses an oversized body in the deep audit itself, before parsing", async () => {
    const body = pageBody(slowToParse(MAX_AUDIT_BYTES + 200));
    let errors: string[] = [];
    expect(await elapsedMs(() => (errors = auditEngineArtifact(body, record, {}).errors))).toBeLessThan(CATASTROPHE_MS);
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

/**
 * Ruling R16, second half: the MDX parser is quadratic within one block of
 * text (a paragraph, list or table: lines with no blank line between them)
 * and, for GFM tables, across the page. Just under 64 KiB, alternating
 * emphasis delimiters ("*_", "_a*") took it 15-41 s, strikethrough pairs
 * ("~_") as long, a run of "]" about 40 s, and 256 small tables 25 s. So
 * before parsing, the auditor refuses a block with more than 1,024 emphasis
 * or strikethrough delimiters, more than 1,024 brackets or more than 16 KiB,
 * and a page with more than 1,024 lines holding a "|". On the published pages
 * the largest block is about 3.2 KB, with at most 124 delimiters and 52
 * brackets, and no page has more than 20 lines with a "|".
 */
describe("the auditor refuses a page the MDX parser cannot handle quickly (R16)", () => {
  const BLOCK_ERROR =
    /^(the text block at line \d+ (has [\d,]+ emphasis delimiters \(\*, _ or ~\), over the limit of 1,024|has [\d,]+ brackets \(\[ or \]\), over the limit of 1,024|is [\d,]+ bytes, over the limit of 16,384) per block|page has [\d,]+ lines with a table pipe \(\|\), over the limit of 1,024 per page) \(ruling R16\); refused before parsing$/;
  const NBSP = String.fromCharCode(0xa0);

  it("bounds a block at 1,024 delimiters, 1,024 brackets and 16 KiB, and a page at 1,024 table lines", () => {
    expect([MAX_BLOCK_DELIMITERS, MAX_BLOCK_BRACKETS, MAX_BLOCK_BYTES, MAX_TABLE_LINES]).toEqual([1_024, 1_024, 16_384, 1_024]);
  });

  const probes: Array<[string, string]> = [
    ['"*_" alternating (the reviewer\'s probe)', "*_".repeat(20_000)],
    ['"_a*", delimiters apart', "_a*".repeat(13_000)],
    ['"~_", strikethrough pairs', "~_".repeat(20_000)],
    ['a run of "]"', "]".repeat(40_000)],
    ['a run of "..." (block size)', "...".repeat(13_000)],
    ["256 small tables (table lines)", Array.from({ length: 256 }, () => `a|b\n-|-\n${"a|b\n".repeat(30)}`).join("\n")],
  ];
  it.each(probes)("refuses %s at once, before parsing", async (_label, block) => {
    const mdx = `${page}\n${block}\n`;
    expect(Buffer.byteLength(mdx, "utf8")).toBeLessThanOrEqual(MAX_AUDIT_BYTES);
    let result: { ok: boolean; errors: string[]; metrics: unknown } = { ok: true, errors: [], metrics: null };
    const ms = await elapsedMs(async () => {
      result = await auditPage(mdx, record);
    });
    expect(ms).toBeLessThan(CATASTROPHE_MS);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(BLOCK_ERROR);
    expect(result.metrics).toBeNull();
    let errors: string[] = [];
    expect(await elapsedMs(() => (errors = auditEngineArtifact(pageBody(mdx), record, {}).errors))).toBeLessThan(CATASTROPHE_MS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(BLOCK_ERROR);
  });

  it("counts per block, at the limits", () => {
    expect(auditComplexityError("*a".repeat(1_024))).toBeNull();
    expect(auditComplexityError("*a".repeat(1_025))).toMatch(/^the text block at line 1 has 1,025 emphasis delimiters/);
    expect(auditComplexityError("~a_".repeat(512))).toBeNull();
    expect(auditComplexityError("[a".repeat(1_024))).toBeNull();
    expect(auditComplexityError("a]".repeat(1_025))).toMatch(/^the text block at line 1 has 1,025 brackets/);
    expect(auditComplexityError("a".repeat(16_384))).toBeNull();
    expect(auditComplexityError("a".repeat(16_385))).toMatch(/^the text block at line 1 is 16,385 bytes/);
    // A blank line (nothing, spaces or tabs) ends a block; a line of non-breaking spaces does not.
    expect(auditComplexityError(`${"*a".repeat(1_000)}\n\n${"*a".repeat(1_000)}`)).toBeNull();
    expect(auditComplexityError(`${"*a".repeat(1_000)}\n \t\r\n${"*a".repeat(1_000)}`)).toBeNull();
    expect(auditComplexityError(`${"*a".repeat(1_000)}\n${NBSP}\n${"*a".repeat(1_000)}`)).toMatch(/has 2,000 emphasis delimiters/);
    // Escaped delimiters and brackets are text; an escaped backslash escapes nothing after it.
    expect(auditComplexityError(`${BACKSLASH}*a`.repeat(2_000))).toBeNull();
    expect(auditComplexityError(`${BACKSLASH}[${BACKSLASH}]`.repeat(1_000))).toBeNull();
    expect(auditComplexityError(`${BACKSLASH}${BACKSLASH}*`.repeat(1_100))).toMatch(/has 1,100 emphasis delimiters/);
    // The block's first line is reported.
    expect(auditComplexityError(`a\n\nb\n${"]".repeat(1_100)}`)).toMatch(/^the text block at line 3 has 1,100 brackets/);
    // Table lines count across the page, blank lines or not; an escaped pipe is text.
    expect(auditComplexityError("a|b\n\n".repeat(1_024))).toBeNull();
    expect(auditComplexityError("a|b\n\n".repeat(1_025))).toMatch(/^page has 1,025 lines with a table pipe/);
    expect(auditComplexityError(`a${BACKSLASH}|b\n\n`.repeat(2_000))).toBeNull();
  });

  it("changes no verdict of the published corpus: every block of every MDX page is within the limits", () => {
    const dirs = ["content/ideas", "engine/drafts", "content/articles", "content/newsletter-pages"];
    const pages = dirs.flatMap((dir) =>
      fs.existsSync(path.join(REPO_ROOT, dir))
        ? fs.readdirSync(path.join(REPO_ROOT, dir)).filter((f) => f.endsWith(".mdx")).map((f) => path.join(REPO_ROOT, dir, f))
        : [],
    );
    expect(pages.length).toBeGreaterThan(300);
    const refused = pages
      .map((file) => [path.relative(REPO_ROOT, file), auditComplexityError(fs.readFileSync(file, "utf8"))] as const)
      .filter(([, error]) => error !== null);
    expect(refused).toEqual([]);
  });
});
