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
 *   - the computation and money patterns took ~1 s on 20,000 digits.
 * Every case audits a 20,000-character run and must finish within
 * BUDGET_MS; one also checks that the rules still fire.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditEngineArtifact } from "./artifact-audit.ts";
import { auditPage, cleanupTempDirs, compiledPage, pageBody, replaceOnce } from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord } from "./__fixtures__/recordV2.ts";

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
