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
import {
  auditHowItWorksNaming,
  extractBlockquotes,
  extractCompetitorLinks,
  findCrossIdeaSentenceDupes,
  findDuplicateSentencesInPage,
  findFillerHits,
  findHygieneIssues,
  findMegaTamHits,
  findNearDuplicateParagraphs,
  findTierMismatches,
  isCompetitorRoundupUrl,
  isDeepDraftSlug,
  MIN_DEEP_BODY_WORDS,
  MIN_DEEP_BODY_WORDS_HARD,
  normalizeQuote,
  proseParagraphs,
} from "./lib/idea-quality.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ideasDir = path.join(root, "content", "ideas");
const recordsDir = path.join(root, "engine", "records");

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
 * Resolve a ResearchRecord JSON for quote-fidelity checks.
 * Prefer explicit recordPath; else engine/records/{goldSlug}.json when
 * auditing engine-draft-{goldSlug}.
 */
export function resolveRecordPath(slug, recordPath) {
  if (recordPath) return recordPath;
  if (isDeepDraftSlug(slug)) {
    const gold = slug.replace(/^engine-draft-/, "");
    const candidate = path.join(recordsDir, `${gold}.json`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Audit one MDX file. Returns { ok, slug, errors, warnings, metrics }.
 * @param {string} filePath
 * @param {string} [slugHint]
 * @param {{ recordPath?: string }} [options]
 */
export function auditIdeaFile(filePath, slugHint, options = {}) {
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
  // Optional extras (## Explore More, CTA blocks) may follow Sources and are
  // not scored — see ideas/SECTIONS.md.

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
  const deep = isDeepDraftSlug(slug);
  if (deep) {
    if (wordCount < MIN_DEEP_BODY_WORDS_HARD) {
      errors.push(
        `body word count ${wordCount} < ${MIN_DEEP_BODY_WORDS_HARD} (deep draft hard floor; unique non-padded content)`,
      );
    }
  } else if (wordCount < MIN_BODY_WORDS) {
    errors.push(`body word count ${wordCount} < ${MIN_BODY_WORDS}`);
  }

  // --- writing quality (fail-closed) ---
  const fillerHits = findFillerHits(prose.toLowerCase());
  for (const hit of fillerHits) {
    errors.push(`stock filler phrase: "${hit}"`);
  }

  const paragraphs = proseParagraphs(body);
  const dups = findNearDuplicateParagraphs(paragraphs);
  if (dups.length > 0) {
    errors.push(
      `near-duplicate paragraphs (${dups.length} pair(s); e.g. #${dups[0].i}+#${dups[0].j} sim=${dups[0].similarity})`,
    );
  }

  // Round 3: sentence-level in-page dedupe (8+ words)
  const sentenceDups = findDuplicateSentencesInPage(body);
  for (const d of sentenceDups.slice(0, 8)) {
    errors.push(
      `duplicate sentence (≥8 words) on this page: "${d.sentence.slice(0, 100)}${d.sentence.length > 100 ? "…" : ""}"`,
    );
  }

  // Round 3: cross-idea sentence dedupe among sibling engine-draft-* in same dir
  let crossIdeaHits = [];
  if (deep) {
    const dir = path.dirname(filePath);
    const otherBodies = {};
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.startsWith("engine-draft-") || !f.endsWith(".mdx")) continue;
        const otherSlug = f.replace(/\.mdx$/, "");
        if (otherSlug === slug) continue;
        const rawOther = fs.readFileSync(path.join(dir, f), "utf8");
        otherBodies[otherSlug] = splitFrontmatter(rawOther).body;
      }
    } catch {
      // temp dirs / missing siblings — skip
    }
    crossIdeaHits = findCrossIdeaSentenceDupes(slug, body, otherBodies);
    for (const h of crossIdeaHits.slice(0, 8)) {
      errors.push(
        `cross-idea duplicate sentence (≥8 words) also in ${h.otherSlug}: "${h.sentence.slice(0, 100)}${h.sentence.length > 100 ? "…" : ""}"`,
      );
    }
  }

  if (solution) {
    for (const e of auditHowItWorksNaming(solution.content)) {
      errors.push(e);
    }
  }

  for (const issue of findHygieneIssues(prose)) {
    errors.push(issue);
  }

  // Deep drafts: niche sizing, first-party competitor URLs, quote fidelity.
  if (deep) {
    const megaHits = findMegaTamHits(prose);
    for (const hit of megaHits) {
      errors.push(`mega-TAM claim (niche sizing only): "${hit}"`);
    }

    if (competitive) {
      const links = extractCompetitorLinks(competitive.content);
      const seen = new Map();
      for (const url of links) {
        if (isCompetitorRoundupUrl(url)) {
          errors.push(`competitor link looks like a roundup, not pricing page: ${url}`);
        }
        seen.set(url, (seen.get(url) || 0) + 1);
      }
      for (const [url, n] of seen) {
        if (n > 1) {
          errors.push(
            `competitor link reused ${n}× (each competitor needs its own pricing URL): ${url}`,
          );
        }
      }
      if (links.length < 3) {
        warnings.push(
          `competitive landscape has ${links.length} competitor link(s); prefer ≥3 first-party pricing URLs`,
        );
      }
    }

    // Four AI prompts (incl. branding) + tier consistency vs Business Model
    const prompts = sections.find((s) => s.title === "AI Prompts to Build This");
    const business = sections.find((s) => s.title === "Business Model");
    if (prompts) {
      const promptHeads = [
        ...prompts.content.matchAll(/\*\*\d+\.\s+([^*]+)\*\*/g),
      ].map((m) => m[1].trim().toLowerCase());
      if (promptHeads.length < 4) {
        errors.push(
          `AI Prompts needs ≥4 prompts including Branding (got ${promptHeads.length})`,
        );
      } else if (!promptHeads.some((h) => /brand/i.test(h))) {
        errors.push("AI Prompts must include a Branding Package prompt");
      }
      // Project Setup must not be a stub
      const setupBlock = prompts.content.match(
        /\*\*1\.\s*Project Setup\*\*[\s\S]*?```text\n([\s\S]*?)```/,
      );
      if (setupBlock) {
        const setupWords = countWords(setupBlock[1]);
        if (setupWords < 60) {
          errors.push(
            `Project Setup prompt too thin (${setupWords} words; need schema/pricing/env ≥60)`,
          );
        }
      }
      if (business) {
        for (const e of findTierMismatches(business.content, prompts.content)) {
          errors.push(e);
        }
      }
    }

    const recordPath = resolveRecordPath(slug, options.recordPath);
    if (recordPath && fs.existsSync(recordPath)) {
      try {
        const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
        const signals = record?.community?.signals || [];
        const mdxQuotes = extractBlockquotes(body).map(normalizeQuote);
        for (const signal of signals) {
          const q = normalizeQuote(signal.quote || "");
          if (!q) continue;
          const found = mdxQuotes.some(
            (mq) => mq.includes(q) || q.includes(mq),
          );
          if (!found) {
            errors.push(
              `quote fidelity: research quote missing or rewritten in MDX: "${(signal.quote || "").slice(0, 80)}"`,
            );
          }
        }
      } catch (err) {
        warnings.push(
          `could not load record for quote check: ${recordPath} (${err instanceof Error ? err.message : err})`,
        );
      }
    } else if (deep) {
      warnings.push(
        "no research record found for quote-fidelity check (pass --record path)",
      );
    }
  }

  const metrics = {
    slug,
    wordCount,
    competitorMentions,
    sourceLinkCount,
    howToStepCount,
    deep,
    wordFloor: deep ? MIN_DEEP_BODY_WORDS : MIN_BODY_WORDS,
    wordHardFloor: deep ? MIN_DEEP_BODY_WORDS_HARD : MIN_BODY_WORDS,
    fillerHits: fillerHits.length,
    nearDuplicatePairs: dups.length,
    duplicateSentences: sentenceDups.length,
    crossIdeaSentenceDupes: crossIdeaHits.length,
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
  const args = {
    slug: null,
    all: false,
    json: false,
    help: false,
    recordPath: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") args.slug = argv[++i];
    else if (a === "--all") args.all = true;
    else if (a === "--json") args.json = true;
    else if (a === "--record") args.recordPath = argv[++i];
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
  node scripts/audit-idea-mdx.mjs --slug <slug> [--record path.json]
  node scripts/audit-idea-mdx.mjs --all
  node scripts/audit-idea-mdx.mjs --slug <slug> --json

Deep drafts (engine-draft-*) enforce ≥${MIN_DEEP_BODY_WORDS_HARD} unique words,
no stock filler / Round-3 padding templates, no duplicate ≥8-word sentences
(in-page or across engine-draft-* siblings), named How-it-works steps, niche
sizing, first-party competitor URLs, matching Business Model ↔ Setup tiers,
four AI prompts incl. Branding, and quote fidelity vs engine/records/.`);
    process.exit(args.help ? 0 : 2);
  }

  const slugs = args.all ? listIdeaSlugs() : [args.slug];
  let failed = 0;
  for (const slug of slugs) {
    const filePath = path.join(ideasDir, `${slug}.mdx`);
    const result = auditIdeaFile(filePath, slug, {
      recordPath: args.recordPath || undefined,
    });
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
