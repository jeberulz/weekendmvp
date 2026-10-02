#!/usr/bin/env node
/**
 * Deterministic MDX auditor for content/ideas/{slug}.mdx.
 *
 * Checks the eight-heading contract (seven canonical sections + Sources),
 * How-it-works numbered list under The Solution, source links, word count,
 * slug shape, and MDX JSX traps. Exit 0 on pass, 1 on any failure.
 *
 * Engine pages (manifest source engine:* or engine-draft-* in engine/drafts/)
 * also get the deep writing bar — see the --help text.
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
  countPhrase,
  extractBlockquotes,
  findBrokenLinkLines,
  GENERIC_SETUP_TABLES,
  promptBlocks,
  setupTableNames,
  extractCompetitorLinks,
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
  normalizeQuote,
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
/** Engine pages must quote at least this many verified community voices. */
const MIN_VERIFIED_QUOTES = 2;
/** The full brief audience may appear this many times; use audienceShort after. */
const MAX_FULL_AUDIENCE_MENTIONS = 2;

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
 * Engine pages get the full deep bar: engine-draft-* spot checks and every
 * published page whose manifest source is `engine:*`. Legacy hand-written
 * and Ideabrowser pages keep the base contract.
 */
export function isEnginePage(slug) {
  if (isEngineDraftSlug(slug)) return true;
  const row = manifestRows().get(slug);
  return typeof row?.source === "string" && row.source.startsWith("engine:");
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
 * Resolve the ResearchRecord behind an engine page: explicit --record, else
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
 * Audit one MDX file. Returns { ok, slug, errors, warnings, metrics }.
 * @param {string} filePath
 * @param {string} [slugHint]
 * @param {{ recordPath?: string, engine?: boolean, otherBodies?: Record<string, string> }} [options]
 *   engine: force (true) or skip (false) the deep bar instead of looking the
 *   slug up in the manifests; otherBodies: sibling bodies for the cross-idea
 *   check (defaults to every other engine page on disk).
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
  const deep = options.engine ?? isEnginePage(slug);
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

  for (const issue of findHygieneIssues(prose)) {
    errors.push(issue);
  }

  for (const hit of findBrokenLinkLines(body).slice(0, 8)) {
    errors.push(`broken markdown link near line ${hit.line}: "${hit.text.slice(0, 90)}"`);
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
      const tierNames = [
        ...business.content.matchAll(/^\s*[-*]\s+\*\*([^*]+)\*\*\s+\(/gm),
      ].map((m) => m[1].trim());

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

      // Year-one math with a computed ARR line on a real tier.
      if (!business.content.includes("**Year-One Math**")) {
        errors.push("Business Model needs **Year-One Math** (funnel → paying accounts → ARR, plus downside)");
      } else {
        const arr = business.content.match(
          /\*\*[\d,]+ × \$[\d,.]+\/mo = \$[\d,]+ ARR\*\* — (.+?) accounts paying/,
        );
        if (!arr) {
          errors.push("Year-One Math is missing its computed ARR line");
        } else if (tierNames.length > 0 && !tierNames.includes(arr[1].trim())) {
          errors.push(
            `Year-One Math lands on tier "${arr[1].trim()}", which is not a pricing tier (${tierNames.join(", ")})`,
          );
        }
        if (!/downside if the close rate halves/.test(business.content)) {
          errors.push("Year-One Math is missing its downside case");
        }
      }
    }

    // Every engine page is compiled from a research record; audit against it.
    const recordPath = resolveRecordPath(slug, options.recordPath);
    if (!recordPath || !fs.existsSync(recordPath)) {
      errors.push(
        `no research record for ${slug} (expected engine/records/${slug}.json or --record path)`,
      );
    } else {
      let record = null;
      try {
        record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
      } catch (err) {
        errors.push(
          `could not read research record ${recordPath} (${err instanceof Error ? err.message : err})`,
        );
      }
      if (record) {
        const signals = record?.community?.signals || [];
        const mdxQuotes = extractBlockquotes(body);
        let verifiedOnPage = 0;
        for (const quote of mdxQuotes) {
          const q = normalizeQuote(quote);
          const match = signals.find((sig) => {
            const rq = normalizeQuote(sig.quote || "");
            return rq && (rq.includes(q) || q.includes(rq));
          });
          if (!match) {
            errors.push(`quote not in the research record: "${quote.slice(0, 80)}"`);
          } else if (match.verified !== true) {
            errors.push(
              `quote not verified against its cited page (re-run engine:research): "${quote.slice(0, 80)}"`,
            );
          } else {
            verifiedOnPage += 1;
          }
        }
        if (verifiedOnPage < MIN_VERIFIED_QUOTES) {
          errors.push(
            `needs ≥${MIN_VERIFIED_QUOTES} verified community quotes (got ${verifiedOnPage})`,
          );
        }
        // Verified quotes the compiler dropped would mean a lossy compile.
        for (const sig of signals) {
          if (sig.verified !== true) continue;
          const q = normalizeQuote(sig.quote || "");
          if (q && !mdxQuotes.some((mq) => normalizeQuote(mq).includes(q) || q.includes(normalizeQuote(mq)))) {
            errors.push(
              `quote fidelity: verified research quote missing or rewritten in MDX: "${(sig.quote || "").slice(0, 80)}"`,
            );
          }
        }

        const fullAudience = record?.brief?.targetCustomer;
        const mentions = countPhrase(prose, fullAudience);
        if (mentions > MAX_FULL_AUDIENCE_MENTIONS) {
          errors.push(
            `full audience label "${fullAudience}" appears ${mentions}× (max ${MAX_FULL_AUDIENCE_MENTIONS}; use editorial.audienceShort)`,
          );
        }
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

Engine pages (manifest source engine:* and engine-draft-* drafts in
engine/drafts/) get the deep bar: ≥${MIN_DEEP_BODY_WORDS_HARD} words, no stock filler,
no duplicate ≥8-word sentences (in-page or across engine pages), named
How-it-works steps, niche sizing, first-party competitor URLs, four prompts
with real content and an idea-specific schema, number-first unit economics,
Year-One Math with computed ARR and downside, the full audience label at most
twice, and ≥2 community quotes verified on their cited pages
(engine/records/{slug}.json or --record).`);
    process.exit(args.help ? 0 : 2);
  }

  const slugs = args.all ? listIdeaSlugs() : [args.slug];
  let failed = 0;
  for (const slug of slugs) {
    const filePath = resolveIdeaFile(slug);
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
