#!/usr/bin/env node
/**
 * Deterministic MDX auditor for content/ideas/{slug}.mdx.
 *
 * Checks the eight-heading contract (seven canonical sections + Sources),
 * How-it-works numbered list under The Solution, source links, word count,
 * slug shape, and MDX JSX traps. Exit 0 on pass, 1 on any failure (2 on a
 * usage error).
 *
 * Engine pages (frontmatter `engine: true`, manifest source engine:*,
 * engine-draft-* drafts in engine/drafts/, or any page audited with
 * --record) also get the deep bar, which audits the final artifact against
 * its contract v2 research record (lib/engine/artifact-audit.ts) — see the
 * --help text. Imports TypeScript
 * modules, so run it with `node --experimental-strip-types` (npm run audit:idea).
 *
 * Usage:
 *   npm run audit:idea -- --slug ai-rfp-response-assistant
 *   npm run audit:idea -- --all
 *   npm run audit:idea -- --file /tmp/page.mdx --record /tmp/record.json [--siblings dir] [--manifest m.json] [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditEngineArtifact, loadEngineRecord } from "../lib/engine/artifact-audit.ts";
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
  countPhrase,
  findBrokenLinkLines,
  GENERIC_SETUP_TABLES,
  promptBlocks,
  setupTableNames,
  findCrossIdeaSentenceDupes,
  findDuplicateSentencesInPage,
  findFillerHits,
  findHygieneIssues,
  findMegaTamHits,
  findNearDuplicateParagraphs,
  findTierMismatches,
  isCompetitorRoundupUrl,
  isEngineDraftSlug,
  MIN_DEEP_BODY_WORDS,
  MIN_DEEP_BODY_WORDS_HARD,
  proseParagraphs,
} from "./lib/idea-quality.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ideasDir = path.join(root, "content", "ideas");
const draftsDir = path.join(root, "engine", "drafts");
const recordsDir = path.join(root, "engine", "records");
const manifestPaths = [
  path.join(root, "ideas", "manifest.json"),
  path.join(draftsDir, "manifest.json"),
];

/** Minimum words per engine build prompt (inside the ```text fence). */
const MIN_PROMPT_WORDS = {
  "project setup": 60,
  "core feature": 70,
  "landing page": 40,
  "branding package": 70,
};
/** The full brief audience may appear this many times; use audienceShort after. */
const MAX_FULL_AUDIENCE_MENTIONS = 2;
/** Fewer first-party pricing URLs than this is a warning, not an error. */
const PREFERRED_FIRST_PARTY_URLS = 3;

let manifestRowsCache = null;
function manifestRows() {
  if (manifestRowsCache) return manifestRowsCache;
  manifestRowsCache = new Map();
  for (const p of manifestPaths) {
    if (!fs.existsSync(p)) continue;
    try {
      for (const row of JSON.parse(fs.readFileSync(p, "utf8")).ideas || []) {
        if (row && typeof row.slug === "string") manifestRowsCache.set(row.slug, row);
      }
    } catch {
      // A broken manifest is validate-idea-tags' job to report.
    }
  }
  return manifestRowsCache;
}

/**
 * The manifest row for a slug: from `manifestPath` when given (--manifest),
 * else from ideas/manifest.json and engine/drafts/manifest.json. Returns
 * { row } (undefined when absent) or { error } for an unreadable --manifest.
 */
function manifestRowFor(slug, manifestPath) {
  if (!manifestPath) return { row: manifestRows().get(slug) };
  try {
    const ideas = JSON.parse(fs.readFileSync(manifestPath, "utf8")).ideas;
    if (!Array.isArray(ideas)) return { error: `manifest ${path.basename(manifestPath)} has no ideas[] array` };
    return { row: ideas.find((row) => row && row.slug === slug) };
  } catch (err) {
    return { error: `could not read manifest ${path.basename(manifestPath)} (${err instanceof Error ? err.message : err})` };
  }
}

/**
 * Engine pages get the full deep bar: engine-draft-* spot checks and every
 * published page whose manifest source is `engine:*`. Legacy hand-written
 * and Ideabrowser pages keep the base contract. auditIdeaFile also applies
 * the deep bar to a page whose frontmatter carries the engine marker
 * (hasEngineMarker), whatever its slug and manifest row say.
 */
export function isEnginePage(slug, row = manifestRows().get(slug)) {
  if (isEngineDraftSlug(slug)) return true;
  return typeof row?.source === "string" && row.source.startsWith("engine:");
}

const ENGINE_MARKER_RE = /^engine[ \t]*:[ \t]*(["']?)true\1[ \t]*(?:#.*)?$/im;

/**
 * True when the page's own frontmatter marks it as compiler output
 * (`engine: true`, which engine:compile writes). A page renamed out of the
 * engine-draft- namespace or published without an `engine:` manifest source
 * still carries it, so it keeps the deep bar (P3-8).
 */
export function hasEngineMarker(raw) {
  return ENGINE_MARKER_RE.test(splitFrontmatter(raw).frontmatter);
}

/** content/ideas/{slug}.mdx, else engine/drafts/{slug}.mdx. */
export function resolveIdeaFile(slug) {
  const published = path.join(ideasDir, `${slug}.mdx`);
  if (fs.existsSync(published)) return published;
  const draft = path.join(draftsDir, `${slug}.mdx`);
  if (fs.existsSync(draft)) return draft;
  return published;
}

/** Other engine page bodies (drafts + published engine pages) for cross-idea checks. */
function otherEngineBodies(slug) {
  const slugs = new Set();
  if (fs.existsSync(draftsDir)) {
    for (const f of fs.readdirSync(draftsDir)) {
      if (f.endsWith(".mdx")) slugs.add(f.replace(/\.mdx$/, ""));
    }
  }
  for (const [s, row] of manifestRows()) {
    if (typeof row.source === "string" && row.source.startsWith("engine:")) slugs.add(s);
  }
  slugs.delete(slug);
  const bodies = {};
  for (const s of slugs) {
    const file = resolveIdeaFile(s);
    if (!fs.existsSync(file)) continue;
    bodies[s] = splitFrontmatter(fs.readFileSync(file, "utf8")).body;
  }
  return bodies;
}

/**
 * Bodies of the *.mdx files in `dir` (keyed by file name without .mdx),
 * except `slug` itself: the --siblings set for the cross-idea check.
 */
export function siblingBodies(dir, slug) {
  const bodies = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".mdx")) continue;
    const s = f.replace(/\.mdx$/, "");
    if (s === slug) continue;
    bodies[s] = splitFrontmatter(fs.readFileSync(path.join(dir, f), "utf8")).body;
  }
  return bodies;
}

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

/** The frontmatter `slug:` value (bare or JSON-quoted), or null. */
export function frontmatterSlug(raw) {
  const { frontmatter } = splitFrontmatter(raw);
  const m = /^slug:[ \t]*(.+?)[ \t]*$/m.exec(frontmatter);
  if (!m) return null;
  const value = m[1];
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      // Not a JSON string: report no slug and let the caller fall back.
      return null;
    }
  }
  return value.replace(/^'|'$/g, "");
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
 * Resolve the research record behind an engine page: explicit --record, else
 * engine/records/{slug}.json, else engine/records/{gold}.json for
 * engine-draft-{gold}.
 */
export function resolveRecordPath(slug, recordPath) {
  if (recordPath) return recordPath;
  const own = path.join(recordsDir, `${slug}.json`);
  if (fs.existsSync(own)) return own;
  if (isEngineDraftSlug(slug)) {
    const gold = slug.replace(/^engine-draft-/, "");
    const candidate = path.join(recordsDir, `${gold}.json`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * The contract v2 record behind an engine page, or null with the reason in
 * `errors` (missing file, unreadable JSON, legacy v1 record, invalid record).
 */
function loadRecord(slug, recordPath, errors) {
  const resolved = resolveRecordPath(slug, recordPath);
  if (!resolved || !fs.existsSync(resolved)) {
    errors.push(`no research record for ${slug} (expected engine/records/${slug}.json or --record path)`);
    return null;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (err) {
    errors.push(`could not read research record ${resolved} (${err instanceof Error ? err.message : err})`);
    return null;
  }
  const loaded = loadEngineRecord(raw, resolved);
  if (!loaded.ok) {
    errors.push(loaded.error);
    return null;
  }
  return loaded.record;
}

/** Prose without blockquote lines (verbatim source quotes are checked against evidence instead). */
function withoutQuoteLines(prose) {
  return prose
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");
}

/**
 * Audit one MDX file. Returns { ok, slug, errors, warnings, metrics }.
 * @param {string} filePath
 * @param {string} [slugHint]
 * @param {{ recordPath?: string, engine?: boolean, otherBodies?: Record<string, string>, manifestPath?: string }} [options]
 *   recordPath: the page's research record (else engine/records/…);
 *   engine: true forces the deep bar (--record); without it the page gets the
 *   deep bar when its frontmatter marker, its manifest source or an
 *   engine-draft- slug says engine, and nothing skips it then; otherBodies:
 *   sibling bodies for the cross-idea
 *   check (defaults to every other engine page on disk); manifestPath: read
 *   the page's manifest row from this manifest instead of the repository's
 *   (its highlights and research mode are checked against the record).
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
  const frontmatterLines = raw.slice(0, raw.length - body.length).split("\n").length - 1;
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
  // A backslash-escaped "\<" or "\{" renders literally; only a bare one is a trap.
  if (/(?<!\\)<[A-Za-z/!]/.test(prose)) {
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
  const manifest = manifestRowFor(slug, options.manifestPath);
  if (manifest.error) errors.push(manifest.error);
  const deep = options.engine === true || hasEngineMarker(raw) || isEnginePage(slug, manifest.row);
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
  // On engine pages every blockquote must equal an accepted source quote
  // (checked below), so verbatim source text is not held to our prose rules.
  const ownProse = deep ? withoutQuoteLines(prose) : prose;
  const fillerHits = findFillerHits(ownProse.toLowerCase());
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

  // Cross-idea sentence dedupe against every other engine page (drafts and
  // published engine:* pages), so compiler templates cannot creep back in.
  let crossIdeaHits = [];
  if (deep) {
    const otherBodies = options.otherBodies ?? otherEngineBodies(slug);
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

  for (const issue of findHygieneIssues(ownProse)) {
    errors.push(issue);
  }

  for (const hit of findBrokenLinkLines(body).slice(0, 8)) {
    errors.push(`broken markdown link near line ${hit.line}: "${hit.text.slice(0, 90)}"`);
  }

  // Deep pages: niche sizing, prompts, schema, unit economics, and the final
  // artifact audit against the contract v2 research record.
  let artifactMetrics = null;
  if (deep) {
    const megaHits = findMegaTamHits(prose);
    for (const hit of megaHits) {
      errors.push(`mega-TAM claim (niche sizing only): "${hit}"`);
    }

    // Four AI prompts (incl. branding), each with real content.
    const prompts = sections.find((s) => s.title === "AI Prompts to Build This");
    const business = sections.find((s) => s.title === "Business Model");
    if (prompts) {
      const blocks = promptBlocks(prompts.content, countWords);
      if (blocks.length < 4) {
        errors.push(
          `AI Prompts needs ≥4 prompts including Branding (got ${blocks.length})`,
        );
      } else if (!blocks.some((b) => /brand/i.test(b.title))) {
        errors.push("AI Prompts must include a Branding Package prompt");
      }
      for (const b of blocks) {
        const min = MIN_PROMPT_WORDS[b.title.toLowerCase()];
        if (min && b.words < min) {
          errors.push(`${b.title} prompt too thin (${b.words} words; need ≥${min})`);
        }
      }
      const setup = blocks.find((b) => /project setup/i.test(b.title));
      if (setup) {
        const ideaTables = setupTableNames(setup.text).filter(
          (t) => !GENERIC_SETUP_TABLES.has(t),
        );
        if (ideaTables.length < 3) {
          errors.push(
            `Project Setup schema is generic (${ideaTables.length} idea-specific table(s); need ≥3 from the research dataModel)`,
          );
        }
      }
      if (business) {
        for (const e of findTierMismatches(business.content, prompts.content)) {
          errors.push(e);
        }
      }
    }

    if (business) {
      // Unit economics bullets lead with the number: `- **$2.40/dev/mo** — label`.
      const unit = business.content.match(
        /\*\*Unit Economics\*\*\s*\n([\s\S]*?)(?:\n\*\*[^*\n]+\*\*\s*\n|$)/,
      );
      if (!unit) {
        errors.push("Business Model needs a **Unit Economics** list");
      } else {
        for (const m of unit[1].matchAll(/^\s*[-*]\s+\*\*([^*]+)\*\*/gm)) {
          const lead = m[1].trim();
          if (!/\d/.test(lead) || countWords(lead) > 10) {
            errors.push(
              `Unit Economics bullet must lead with a short figure, not a sentence: "${lead.slice(0, 70)}"`,
            );
          }
        }
      }
    }

    // Every engine page is compiled from a contract v2 research record; the
    // final artifact must match it (quotes, rows, figures, Year-One Math).
    const record = loadRecord(slug, options.recordPath, errors);
    const artifact = auditEngineArtifact(body, record, {
      lineOffset: frontmatterLines,
      slug,
      ...(manifest.row !== undefined ? { manifestRow: manifest.row } : {}),
    });
    errors.push(...artifact.errors);
    warnings.push(...artifact.warnings);
    artifactMetrics = artifact.metrics;

    // Pricing links: first-party prices need a pricing page, not a roundup;
    // a secondary price may cite a roundup because it is labelled "via host".
    const reported = new Set();
    const firstPartyUrls = new Set();
    for (const link of artifact.competitorLinks) {
      if (link.attribution === "first_party") firstPartyUrls.add(link.url);
      if (link.attribution !== "secondary" && !reported.has(link.url) && isCompetitorRoundupUrl(link.url)) {
        reported.add(link.url);
        errors.push(`competitor link looks like a roundup, not pricing page: ${link.url}`);
      }
    }
    if (record && firstPartyUrls.size < PREFERRED_FIRST_PARTY_URLS) {
      warnings.push(
        `competitive landscape has ${firstPartyUrls.size} first-party pricing URL(s); prefer ≥${PREFERRED_FIRST_PARTY_URLS}`,
      );
    }

    if (record) {
      const fullAudience = record.brief.targetCustomer;
      const mentions = countPhrase(prose, fullAudience);
      if (mentions > MAX_FULL_AUDIENCE_MENTIONS) {
        errors.push(
          `full audience label "${fullAudience}" appears ${mentions}× (max ${MAX_FULL_AUDIENCE_MENTIONS}; use editorial.audienceShort)`,
        );
      }
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
    ...(artifactMetrics ? { artifact: artifactMetrics } : {}),
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

function usageError(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    slug: null,
    file: null,
    all: false,
    json: false,
    help: false,
    recordPath: null,
    siblings: null,
    manifestPath: null,
  };
  const value = (i, flag) => {
    const v = argv[i];
    if (v === undefined || v.startsWith("--")) usageError(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") args.slug = value(++i, a);
    else if (a === "--file") args.file = value(++i, a);
    else if (a === "--all") args.all = true;
    else if (a === "--json") args.json = true;
    else if (a === "--record") args.recordPath = value(++i, a);
    else if (a === "--siblings") args.siblings = value(++i, a);
    else if (a === "--manifest") args.manifestPath = value(++i, a);
    else if (a === "--help" || a === "-h") args.help = true;
    else usageError(`unknown arg: ${a}`);
  }
  return args;
}

const HELP = `Usage:
  npm run audit:idea -- --slug <slug> [--record path.json] [--manifest path.json] [--json]
  npm run audit:idea -- --all
  npm run audit:idea -- --file <page.mdx> --record <record.json> [--siblings <dir>] [--manifest <m.json>] [--json]

  --slug      audit content/ideas/<slug>.mdx (else engine/drafts/<slug>.mdx)
  --file      audit an MDX file anywhere (the slug comes from its frontmatter,
              else the file name; --slug overrides)
  --record    the page's contract v2 research record; implies the engine bar
  --siblings  compare cross-idea sentences with the *.mdx files in this
              directory instead of the repository's engine pages
  --manifest  read the page's manifest row from this file instead of
              ideas/manifest.json and engine/drafts/manifest.json
  --json      one JSON result per audited page on stdout
  Exit codes: 0 every page passed, 1 any page failed, 2 usage error.

Engine pages (frontmatter engine: true, manifest source engine:*,
engine-draft-* drafts in engine/drafts/, or --record) get the deep bar:
≥${MIN_DEEP_BODY_WORDS_HARD} words, no stock filler, no duplicate ≥8-word sentences (in-page or
across engine pages), named How-it-works steps, niche sizing, four prompts
with real content and an idea-specific schema, number-first unit economics,
and the final artifact audit against the contract v2 record
(engine/records/{slug}.json or --record; a legacy v1 record fails with a
re-research message). The page holds only audited facts (ruling R10):
  - structure: no JSX, HTML, images, footnotes, link definitions or raw
    evidence tokens; fenced code only in the build prompts; nothing before
    ## The Problem or after ## Sources; the proposal and assumption labels
    stay on the page;
  - links: every link targets an evidence source the record uses, with that
    source's title or an evidence rendering as its text; ## Sources lists
    exactly those sources;
  - quotes: every blockquote equals a selected accepted quote, with
    "— [title](url)" naming and linking that quote's own source; every
    selected quote appears; ≥2 distinct quotes (a repeated quote counts
    once); any other double-quoted text of three or more words must be an
    accepted quote the record uses;
  - rows: market signal rows are their evidence renderings (which name
    the stat's subject, metric and period) with their sources; competitor
    rows show their evidence renderings and sources ("(via host)" on
    secondary prices); a first-party pricing URL backs one competitor only;
    competitor notes cite only their own prices; keyword, pricing tier and
    unit-economics rows print the record exactly; a used stat's subject is
    figure-free;
  - figures (digits in any script, number words, percent) in every section
    must be linked evidence renderings, evidence rows or record values (in
    the build prompts: tier prices and includes, unit-economics values,
    data-model columns, renderings); a guard, not proof;
  - Year-One Math is recomputed from the record (accounts, per-account
    price, ARR, tier, seats, downside, funnel) with exactly one base and one
    downside line; no section states another revenue total or a
    Year-One-style computation;
  - a mode "fixture" record backs only an engine-draft-* page (ruling R11);
    a manifest row's highlights must equal what the record generates and its
    provenance.researchMode the record's mode.`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }
  if ([args.file, args.slug && !args.file, args.all].filter(Boolean).length !== 1) {
    console.error(HELP);
    process.exit(2);
  }
  if (args.siblings && !fs.existsSync(args.siblings)) usageError(`--siblings directory not found: ${args.siblings}`);
  if (args.manifestPath && !fs.existsSync(args.manifestPath)) usageError(`--manifest file not found: ${args.manifestPath}`);

  const targets = [];
  if (args.file) {
    const filePath = path.resolve(args.file);
    const fromFrontmatter = fs.existsSync(filePath) ? frontmatterSlug(fs.readFileSync(filePath, "utf8")) : null;
    targets.push({
      filePath,
      slug: args.slug || fromFrontmatter || path.basename(filePath, path.extname(filePath)),
    });
  } else {
    for (const slug of args.all ? listIdeaSlugs() : [args.slug]) {
      targets.push({ filePath: resolveIdeaFile(slug), slug });
    }
  }

  let failed = 0;
  for (const { filePath, slug } of targets) {
    const result = auditIdeaFile(filePath, slug, {
      recordPath: args.recordPath || undefined,
      ...(args.recordPath ? { engine: true } : {}),
      ...(args.siblings ? { otherBodies: siblingBodies(args.siblings, slug) } : {}),
      ...(args.manifestPath ? { manifestPath: path.resolve(args.manifestPath) } : {}),
    });
    printResult(result, { json: args.json });
    if (!result.ok) failed += 1;
  }

  if (!args.json && args.all) {
    console.log(
      `\naudit-idea-mdx: ${targets.length - failed}/${targets.length} passed`,
    );
  }
  process.exit(failed > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
