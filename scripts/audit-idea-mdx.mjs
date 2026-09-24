#!/usr/bin/env node
/**
 * Deterministic MDX auditor for content/ideas/{slug}.mdx.
 *
 * Checks the eight-heading contract (seven canonical sections + Sources),
 * How-it-works numbered list under The Solution, source links, word count,
 * slug shape, and MDX JSX traps. Exit 0 on pass, 1 on any failure.
 *
 * Usage:
 *   node scripts/audit-idea-mdx.mjs --slug ai-rfp-response-assistant
 *   node scripts/audit-idea-mdx.mjs --all
 *   node scripts/audit-idea-mdx.mjs --slug <slug> --json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_SECTION_TITLES,
  HOW_IT_WORKS_LABEL,
  MIN_BODY_WORDS,
  MIN_SOURCE_LINKS,
  SLUG_PATTERN,
  SOURCES_TITLE,
} from "./lib/idea-sections.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ideasDir = path.join(root, "content", "ideas");

const MD_LINK_RE = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
const H2_RE = /^##[ \t]+(.+?)\s*$/gm;

/** Strip YAML frontmatter. */
export function splitFrontmatter(raw) {
  if (!raw.startsWith("---")) {
    return { frontmatter: "", body: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: "", body: raw };
  const frontmatter = raw.slice(0, end + 4);
  const body = raw.slice(end + 4).replace(/^\s*\n/, "");
  return { frontmatter, body };
}

/** Remove fenced + inline code so JSX-trap checks ignore them. */
export function stripCode(body) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ");
}

/** Split body into ordered { title, content } sections by ## headings. */
export function splitSections(body) {
  const matches = [...body.matchAll(H2_RE)];
  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const title = m[1].trim();
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    sections.push({ title, content: body.slice(start, end) });
  }
  return sections;
}

export function countWords(text) {
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g);
  return words ? words.length : 0;
}

export function countMarkdownLinks(text) {
  const links = [...text.matchAll(MD_LINK_RE)];
  return links.length;
}

/** Count numbered list steps after the How-it-works label. */
export function countHowToSteps(solutionContent) {
  const idx = solutionContent.indexOf(HOW_IT_WORKS_LABEL);
  if (idx === -1) return 0;
  const after = solutionContent.slice(idx + HOW_IT_WORKS_LABEL.length);
  const steps = after.match(/^\s*\d+\.\s+\S/gm);
  return steps ? steps.length : 0;
}

/**
 * Count competitor bullet rows under Competitive Landscape.
 * Prefer `- **Name**` patterns; fall back to top-level list items.
 */
export function countCompetitorMentions(competitiveContent) {
  const boldNamed = competitiveContent.match(/^\s*[-*]\s+\*\*[^*]+\*\*/gm);
  if (boldNamed && boldNamed.length > 0) return boldNamed.length;
  const items = competitiveContent.match(/^\s*[-*]\s+\S/gm);
  return items ? items.length : 0;
}

/**
 * Audit one MDX file. Returns { ok, slug, errors, warnings, metrics }.
 */
export function auditIdeaFile(filePath, slugHint) {
  const errors = [];
  const warnings = [];
  const slug =
    slugHint || path.basename(filePath, path.extname(filePath));

  if (!SLUG_PATTERN.test(slug)) {
    errors.push(`slug '${slug}' must match ${SLUG_PATTERN}`);
  }

  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      slug,
      errors: [`file not found: ${filePath}`],
      warnings,
      metrics: null,
    };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const { body } = splitFrontmatter(raw);
  const sections = splitSections(body);
  const titles = sections.map((s) => s.title);

  const expected = [...CANONICAL_SECTION_TITLES, SOURCES_TITLE];
  for (let i = 0; i < expected.length; i++) {
    if (titles[i] !== expected[i]) {
      errors.push(
        `heading[${i}] expected '## ${expected[i]}', got ${
          titles[i] ? `'## ${titles[i]}'` : "(missing)"
        }`,
      );
    }
  }
  if (titles.length > expected.length) {
    errors.push(
      `extra headings after Sources: ${titles
        .slice(expected.length)
        .map((t) => `## ${t}`)
        .join(", ")}`,
    );
  }

  const solution = sections.find((s) => s.title === "The Solution");
  let howToStepCount = 0;
  if (solution) {
    if (!solution.content.includes(HOW_IT_WORKS_LABEL)) {
      errors.push(
        `## The Solution must contain ${HOW_IT_WORKS_LABEL} followed by a numbered list`,
      );
    } else {
      howToStepCount = countHowToSteps(solution.content);
      if (howToStepCount < 2) {
        errors.push(
          `## The Solution ${HOW_IT_WORKS_LABEL} needs a numbered list (≥2 steps, got ${howToStepCount})`,
        );
      }
    }
  }

  const sources = sections.find((s) => s.title === SOURCES_TITLE);
  let sourceLinkCount = 0;
  if (sources) {
    sourceLinkCount = countMarkdownLinks(sources.content);
    if (sourceLinkCount < MIN_SOURCE_LINKS) {
      errors.push(
        `## Sources needs ≥${MIN_SOURCE_LINKS} markdown links (got ${sourceLinkCount})`,
      );
    }
  }

  const competitive = sections.find(
    (s) => s.title === "Competitive Landscape",
  );
  const competitorMentions = competitive
    ? countCompetitorMentions(competitive.content)
    : 0;

  if (body.includes("{{")) {
    errors.push("body contains '{{' placeholder");
  }

  const prose = stripCode(body);
  if (/<[A-Za-z\/!]/.test(prose)) {
    errors.push(
      "body has bare '<' that MDX would parse as JSX (escape as \\< outside code fences)",
    );
  }
  if (/(?<!\\)\{/.test(prose)) {
    errors.push(
      "body has bare '{' that MDX would parse as JSX (escape as \\{ outside code fences)",
    );
  }

  const wordCount = countWords(body);
  if (wordCount < MIN_BODY_WORDS) {
    errors.push(`body word count ${wordCount} < ${MIN_BODY_WORDS}`);
  }

  const metrics = {
    slug,
    wordCount,
    competitorMentions,
    sourceLinkCount,
    howToStepCount,
  };

  return {
    ok: errors.length === 0,
    slug,
    errors,
    warnings,
    metrics,
  };
}

export function listIdeaSlugs() {
  return fs
    .readdirSync(ideasDir)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .map((f) => f.replace(/\.mdx$/, ""))
    .sort();
}

function printResult(result, { json }) {
  if (json) {
    console.log(JSON.stringify(result));
    return;
  }
  const mark = result.ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${result.slug}`);
  for (const e of result.errors) console.log(`  - ${e}`);
  for (const w of result.warnings) console.log(`  ! ${w}`);
  if (result.metrics) {
    const m = result.metrics;
    console.log(
      `  metrics: words=${m.wordCount} competitors=${m.competitorMentions} sources=${m.sourceLinkCount} howTo=${m.howToStepCount}`,
    );
  }
}

function parseArgs(argv) {
  const args = { slug: null, all: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") args.slug = argv[++i];
    else if (a === "--all") args.all = true;
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.slug && !args.all)) {
    console.log(`Usage:
  node scripts/audit-idea-mdx.mjs --slug <slug>
  node scripts/audit-idea-mdx.mjs --all
  node scripts/audit-idea-mdx.mjs --slug <slug> --json`);
    process.exit(args.help ? 0 : 2);
  }

  const slugs = args.all ? listIdeaSlugs() : [args.slug];
  let failed = 0;
  for (const slug of slugs) {
    const filePath = path.join(ideasDir, `${slug}.mdx`);
    const result = auditIdeaFile(filePath, slug);
    printResult(result, { json: args.json });
    if (!result.ok) failed += 1;
  }

  if (!args.json && args.all) {
    console.log(
      `\naudit-idea-mdx: ${slugs.length - failed}/${slugs.length} passed`,
    );
  }
  process.exit(failed > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
