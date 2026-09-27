import type { CheckLocation, QualityCheck } from "../../contracts/checks";
import type { EditorialSource } from "../../contracts/evidence";
import { checkPublicHttpUrl } from "../../contracts/primitives";
import { HOW_IT_WORKS_LABEL, type SectionKey } from "../../contracts/sections";
import { countWords, measureContent } from "../../domain/counts";
import { sourceFreshness } from "../../domain/freshness";
import { sectionsByKey, splitFrontmatter, splitSections } from "../../domain/structure";
import { parseArticleMarkdown, walk } from "../../markdown/parse";

/**
 * SIMULATED checks for the local demo only.
 *
 * These are not WP45 verification. They mirror the published MDX contract
 * (`ideas/SECTIONS.md`) closely enough to exercise every editorial state, and
 * every result is stamped `producer: "fixture_simulated"`. The live adapter
 * (WP46-E5) replaces this module with WP45's quality and safety library.
 */

export const FIXTURE_REQUIRED_CHECK_IDS = [
  "safety-executable-markup",
  "safety-links",
  "structure-how-it-works",
  "structure-sources",
  "evidence-freshness",
  "content-repetition",
  "content-length",
] as const;

const MIN_BODY_WORDS = 800;
const MAX_LOCATIONS = 10;

type RunInput = {
  markdown: string;
  sources: readonly Pick<EditorialSource, "id" | "sourceType" | "retrievedAt">[];
  artifactHash: string;
  policyVersion: string;
  nowMs: number;
};

function location(partial: Partial<CheckLocation>): CheckLocation {
  return {
    section: partial.section ?? null,
    claimId: partial.claimId ?? null,
    sourceId: partial.sourceId ?? null,
    line: partial.line ?? null,
  };
}

/** Remove inline code spans so their contents are not scanned as markup. */
function stripInlineCode(line: string): string {
  let result = "";
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`") {
      result += line[index];
      index += 1;
      continue;
    }
    let run = 0;
    while (line[index + run] === "`") run += 1;
    const fence = "`".repeat(run);
    const close = line.indexOf(fence, index + run);
    if (close === -1) {
      result += line.slice(index);
      break;
    }
    result += " ".repeat(close + run - index);
    index = close + run;
  }
  return result;
}

function precededByOddBackslashes(text: string, position: number): boolean {
  let count = 0;
  for (let cursor = position - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) count += 1;
  return count % 2 === 1;
}

/** Visit each line outside fenced code, with its 1-based document line. */
function forEachProseLine(markdown: string, visit: (line: string, lineNumber: number) => void) {
  const { body, bodyStartLine } = splitFrontmatter(markdown);
  let fence: { char: string; length: number } | null = null;
  body.split("\n").forEach((line, index) => {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      // A closing fence is the same character, at least as long, alone on its line.
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.length &&
        line.trim() === fenceMatch[1]
      ) {
        fence = null;
      }
      return;
    }
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      return;
    }
    visit(line, bodyStartLine + index);
  });
}

/**
 * Find text the public MDX renderer would treat as code: unescaped braces
 * (expressions), tags (`<Component`, `<div`, `<!--`, autolinks) and
 * `import`/`export` lines. `\{` is escaped; `\\{` is an escaped backslash
 * followed by a live brace.
 */
export function findExecutableMarkup(markdown: string): { line: number; reason: string }[] {
  const findings: { line: number; reason: string }[] = [];

  forEachProseLine(markdown, (raw, lineNumber) => {
    if (/^\s{0,3}(?:import|export)\s/.test(raw)) {
      findings.push({ line: lineNumber, reason: "an import/export statement" });
      return;
    }
    const line = stripInlineCode(raw);
    for (let position = 0; position < line.length; position += 1) {
      const char = line[position];
      if ((char === "{" || char === "}") && !precededByOddBackslashes(line, position)) {
        findings.push({ line: lineNumber, reason: `an unescaped “${char}”` });
        return;
      }
      if (char === "<" && !precededByOddBackslashes(line, position) && /[A-Za-z/!?]/.test(line[position + 1] ?? "")) {
        findings.push({ line: lineNumber, reason: "an HTML/JSX tag" });
        return;
      }
    }
  });
  return findings;
}

function sectionRange(markdown: string, key: SectionKey) {
  return sectionsByKey(splitSections(markdown)).get(key) ?? null;
}

function checkBase(input: RunInput) {
  return {
    policyVersion: input.policyVersion,
    evaluatedHash: input.artifactHash,
    evaluatedAt: new Date(input.nowMs).toISOString(),
    producer: "fixture_simulated" as const,
  };
}

export function runFixtureChecks(input: RunInput): QualityCheck[] {
  const base = checkBase(input);
  const checks: QualityCheck[] = [];

  /* Executable markup ------------------------------------------------ */
  const executable = findExecutableMarkup(input.markdown);
  checks.push({
    ...base,
    id: "safety-executable-markup",
    label: "No executable MDX",
    category: "safety",
    severity: "blocker",
    outcome: executable.length === 0 ? "pass" : "fail",
    message:
      executable.length === 0
        ? "No expressions, tags or import/export lines outside code."
        : `Line ${executable[0].line}: ${executable[0].reason} would run as code on the public page. Escape it (\\{, \\<) or move it into code.${executable.length > 1 ? ` ${executable.length - 1} more.` : ""}`,
    locations: executable.slice(0, MAX_LOCATIONS).map((finding) => location({ line: finding.line })),
  });

  /* Links ------------------------------------------------------------ */
  const { tree, bodyStartLine } = parseArticleMarkdown(input.markdown);
  const badLinks: { line: number | null; url: string }[] = [];
  walk(tree, (node) => {
    if (node.type !== "link" && node.type !== "image" && node.type !== "definition") return;
    if (checkPublicHttpUrl(node.url) === null) return;
    badLinks.push({
      line: node.position ? bodyStartLine + node.position.start.line - 1 : null,
      url: node.url,
    });
  });
  checks.push({
    ...base,
    id: "safety-links",
    label: "Safe public links",
    category: "safety",
    severity: "blocker",
    outcome: badLinks.length === 0 ? "pass" : "fail",
    message:
      badLinks.length === 0
        ? "Every link is http(s) to a public host without credentials."
        : `${badLinks.length} link${badLinks.length === 1 ? " is" : "s are"} not a safe public http(s) URL${badLinks[0].line ? ` (first on line ${badLinks[0].line})` : ""}.`,
    locations: badLinks.slice(0, MAX_LOCATIONS).map((link) => location({ line: link.line })),
  });

  /* How it works ------------------------------------------------------- */
  const solution = sectionRange(input.markdown, "solution");
  let howItWorksSteps = 0;
  if (solution) {
    const lines = solution.body.split("\n");
    const labelIndex = lines.findIndex((line) => line.trim() === HOW_IT_WORKS_LABEL);
    if (labelIndex !== -1) {
      for (const line of lines.slice(labelIndex + 1)) {
        if (/^\s*\d+[.)]\s+\S/.test(line)) howItWorksSteps += 1;
        else if (line.trim() !== "" && howItWorksSteps > 0) break;
      }
    }
  }
  checks.push({
    ...base,
    id: "structure-how-it-works",
    label: "“How it works” steps",
    category: "structure",
    severity: "blocker",
    outcome: howItWorksSteps >= 2 ? "pass" : "fail",
    message:
      howItWorksSteps >= 2
        ? `${howItWorksSteps} numbered steps feed the page's HowTo data.`
        : "The Solution needs “**How it works:**” followed by at least two numbered steps.",
    locations: [location({ section: "solution", line: solution?.headingLine ?? null })],
  });

  /* Sources section ----------------------------------------------------- */
  const sourcesSection = sectionRange(input.markdown, "sources");
  let sourceLinks = 0;
  if (sourcesSection) {
    const parsed = parseArticleMarkdown(sourcesSection.body).tree;
    walk(parsed, (node) => {
      if (node.type === "link" && checkPublicHttpUrl(node.url) === null) sourceLinks += 1;
    });
  }
  checks.push({
    ...base,
    id: "structure-sources",
    label: "Sources section links",
    category: "structure",
    severity: "blocker",
    outcome: sourceLinks >= 2 ? "pass" : "fail",
    message:
      sourceLinks >= 2
        ? `${sourceLinks} public source links.`
        : "The Sources section needs at least two public links.",
    locations: [location({ section: "sources", line: sourcesSection?.headingLine ?? null })],
  });

  /* Freshness ------------------------------------------------------------- */
  const stale = input.sources.filter(
    (source) => sourceFreshness(source.sourceType, source.retrievedAt, input.nowMs).freshness === "stale",
  );
  checks.push({
    ...base,
    id: "evidence-freshness",
    label: "Evidence freshness",
    category: "evidence",
    severity: "warning",
    outcome: stale.length === 0 ? "pass" : "warning",
    message:
      stale.length === 0
        ? "Every source was retrieved within its freshness window."
        : `${stale.length} source${stale.length === 1 ? " is" : "s are"} older than the freshness window for its type.`,
    locations: stale.slice(0, MAX_LOCATIONS).map((source) => location({ sourceId: source.id })),
  });

  /* Repetition -------------------------------------------------------------- */
  const seen = new Set<string>();
  const repeatedLines: number[] = [];
  forEachProseLine(input.markdown, (line, lineNumber) => {
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const normalized = sentence
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
      if (countWords(normalized) < 8) continue;
      if (seen.has(normalized)) repeatedLines.push(lineNumber);
      else seen.add(normalized);
    }
  });
  checks.push({
    ...base,
    id: "content-repetition",
    label: "Repetition",
    category: "content",
    severity: "warning",
    outcome: repeatedLines.length === 0 ? "pass" : "warning",
    message:
      repeatedLines.length === 0
        ? "No repeated sentences."
        : `${repeatedLines.length} sentence${repeatedLines.length === 1 ? " repeats" : "s repeat"} earlier text.`,
    locations: repeatedLines.slice(0, MAX_LOCATIONS).map((line) => location({ line })),
  });

  /* Length (measured, not a quality score) ------------------------------------ */
  const counts = measureContent(input.markdown);
  checks.push({
    ...base,
    id: "content-length",
    label: "Length (measured)",
    category: "content",
    severity: "warning",
    outcome: counts.proseWords >= MIN_BODY_WORDS ? "pass" : "warning",
    message:
      counts.proseWords >= MIN_BODY_WORDS
        ? `${counts.proseWords} prose words measured. Length is not a quality score.`
        : `${counts.proseWords} prose words measured, below the ${MIN_BODY_WORDS}-word audit floor. Length is not a quality score.`,
    locations: [],
  });

  /* Public rendering ------------------------------------------------------------ */
  checks.push({
    ...base,
    id: "render-public",
    label: "Public rendering",
    category: "render",
    severity: "info",
    outcome: "not_run",
    message: "Not verified: the public-render adapter (WP46-E6) is not connected.",
    locations: [],
  });

  return checks;
}
