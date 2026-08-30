#!/usr/bin/env node
/**
 * Structural gate for idea pages under content/ideas/*.mdx.
 *
 * Replaces the removed HTML auditor (scripts/audit-ideas.js) and the manual
 * grep checklist in the publish-idea skill with one command a reviewer re-runs.
 * Structure only — it does not judge whether the prose is any good.
 *
 * Usage:
 *   npm run audit:idea -- --slug <slug>   # one page
 *   npm run audit:idea -- --all           # every page, against the debt baseline
 *   npm run audit:idea -- --all --strict  # every page, baseline ignored
 *   npm run audit:idea -- --slug <slug> --json
 *   npm run audit:idea -- --all --write-baseline   # re-record known debt
 *
 * Exit 0 when every audited page passes (baseline-exempt failures excluded
 * unless --strict). Exit 1 on any failure, a missing slug, or bad flags.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_SECTIONS,
  OPTIONAL_SECTIONS,
  countWords,
  findSection,
  parseSections,
  splitFrontmatter,
  stripCode,
} from './lib/idea-sections.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ideasDir = path.join(root, 'content', 'ideas');
const baselinePath = path.join(root, 'ideas', 'audit-baseline.json');

const MIN_WORDS = 800;
const MIN_SOURCE_URLS = 2;
const MIN_HOWTO_STEPS = 3;
const MIN_COMPETITORS = 3;
const SLUG_RE = /^[a-z0-9-]+$/;
const PLACEHOLDER_RE = /\{\{|\bIDEA_(?:TITLE|SLUG|DESCRIPTION)\b/;
const SOURCES_SPEC = OPTIONAL_SECTIONS.find((s) => s.key === 'sources');

/**
 * Count distinct citation URLs in a section slice. Sources are written both as
 * markdown links and as bare trailing URLs across the corpus; both are real
 * citations, so both count.
 */
function countCitationUrls(text) {
  const urls = text.match(/https?:\/\/[^\s)<>\]]+/g) ?? [];
  return new Set(urls.map((u) => u.replace(/[.,;]+$/, ''))).size;
}

/**
 * Unescaped `<Tag` or `{` in prose compiles as JSX and 500s the route.
 * `\<` and `\{` are the correct MDX escapes and are fine, as is anything
 * inside code. Returns the offending 1-indexed lines.
 */
function jsxTrapLines(body, lineOffset) {
  const scan = stripCode(body).replace(/\\./g, '  ');
  const lines = [];
  scan.split('\n').forEach((line, i) => {
    if (/<[A-Za-z/]|\{/.test(line)) lines.push(i + 1 + lineOffset);
  });
  return lines;
}

/**
 * Run every structural check over one MDX file.
 * Returns { slug, checks: [{ id, ok, detail }], metrics }.
 */
export function auditIdeaMdx(slug, raw) {
  const { frontmatter, body } = splitFrontmatter(raw);
  // Report line numbers against the file, not the post-frontmatter body.
  const lineOffset = raw.slice(0, raw.length - body.length).split('\n').length - 1;
  const sections = parseSections(body);
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok, detail });

  add('slug-format', SLUG_RE.test(slug), `slug must match ${SLUG_RE}`);

  const fmSlug = /^slug:\s*"?([^"\n]+)"?\s*$/m.exec(frontmatter)?.[1]?.trim();
  const fmTitle = /^title:\s*"?(.+?)"?\s*$/m.exec(frontmatter)?.[1]?.trim();
  add('frontmatter', Boolean(fmSlug && fmTitle && fmSlug === slug),
    !fmSlug || !fmTitle ? 'frontmatter needs both slug and title'
      : fmSlug !== slug ? `frontmatter slug "${fmSlug}" does not match filename "${slug}"` : '');

  // Seven canonical sections, present and in contract order.
  const found = REQUIRED_SECTIONS.map((spec) => ({ spec, hit: findSection(sections, spec) }));
  const missing = found.filter((f) => !f.hit).map((f) => f.spec.title);
  add('sections-present', missing.length === 0, `missing: ${missing.join(', ')}`);

  const positions = found.filter((f) => f.hit).map((f) => f.hit.index);
  const ordered = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  add('sections-order', ordered,
    `expected order: ${REQUIRED_SECTIONS.map((s) => s.title).join(' → ')}`);

  // Sources — the eighth heading. Required on MDX pages.
  const sourcesSection = findSection(sections, SOURCES_SPEC);
  add('sources-section', Boolean(sourcesSection), 'no "## Sources" heading');
  const sourceLinkCount = sourcesSection ? countCitationUrls(sourcesSection.body) : 0;
  add('sources-links', sourceLinkCount >= MIN_SOURCE_URLS,
    `${sourceLinkCount} citation URL(s) under Sources, need ${MIN_SOURCE_URLS}`);

  // HowTo schema is parsed off this list by app/ideas/[slug]/page.tsx.
  const solution = found.find((f) => f.spec.key === 'solution')?.hit;
  const howToBlock = solution ? /\*\*How it works:\*\*([\s\S]*)/.exec(solution.body)?.[1] : null;
  add('howto-marker', Boolean(howToBlock), 'The Solution needs a "**How it works:**" line');
  const howToStepCount = howToBlock ? (howToBlock.match(/^ *\d+\.\s+\S/gm) ?? []).length : 0;
  add('howto-list', howToStepCount >= MIN_HOWTO_STEPS,
    `${howToStepCount} numbered step(s), need ${MIN_HOWTO_STEPS}`);

  const competitive = found.find((f) => f.spec.key === 'competitive')?.hit;
  const competitorMentions = competitive
    ? (stripCode(competitive.body).match(/^ *[-*] +\*\*/gm) ?? []).length
    : 0;
  add('competitors', competitorMentions >= MIN_COMPETITORS,
    `${competitorMentions} named competitor(s), need ${MIN_COMPETITORS}`);

  const wordCount = countWords(body);
  add('word-count', wordCount >= MIN_WORDS, `${wordCount} words, need ${MIN_WORDS}`);

  // Prose only: `{{merge_tags}}` inside an AI-prompt code block are content.
  add('placeholders', !PLACEHOLDER_RE.test(stripCode(body)), 'unreplaced placeholder in prose');

  const trapLines = jsxTrapLines(body, lineOffset);
  add('jsx-safety', trapLines.length === 0,
    `unescaped < or { on line(s) ${trapLines.join(', ')} — escape as \\< and \\{`);

  return {
    slug,
    checks,
    metrics: { wordCount, competitorMentions, sourceLinkCount, howToStepCount },
  };
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return {};
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8')).legacy ?? {};
}

function listSlugs() {
  return fs.readdirSync(ideasDir)
    .filter((f) => f.endsWith('.mdx') && !f.startsWith('_'))
    .map((f) => f.replace(/\.mdx$/, ''))
    .sort();
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const value = (name) => {
    const i = argv.indexOf(name);
    const next = i !== -1 ? argv[i + 1] : null;
    return next && !next.startsWith('--') ? next : null;
  };

  const only = value('--slug');
  const all = flag('--all');
  const writeBaseline = flag('--write-baseline');
  const strict = flag('--strict');
  const asJson = flag('--json');

  if (!only && !all) {
    console.error('usage: audit-idea-mdx.mjs (--slug <slug> | --all) [--strict] [--json]');
    process.exit(1);
  }

  const slugs = only ? [only] : listSlugs();
  const baseline = strict || writeBaseline ? {} : readBaseline();
  const results = [];

  for (const slug of slugs) {
    const file = path.join(ideasDir, `${slug}.mdx`);
    if (!fs.existsSync(file)) {
      console.error(`no such idea page: content/ideas/${slug}.mdx`);
      process.exit(1);
    }
    const result = auditIdeaMdx(slug, fs.readFileSync(file, 'utf8'));
    const exempt = new Set(baseline[slug] ?? []);
    result.failures = result.checks.filter((c) => !c.ok && !exempt.has(c.id));
    result.waived = result.checks.filter((c) => !c.ok && exempt.has(c.id));
    results.push(result);
  }

  if (writeBaseline) {
    if (!all) {
      console.error('--write-baseline requires --all');
      process.exitCode = 1;
      return;
    }
    const legacy = {};
    for (const r of results.filter((x) => x.failures.length)) {
      legacy[r.slug] = r.failures.map((c) => c.id);
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      note: 'Structural debt on idea pages published before this auditor existed. '
        + 'Generated by `npm run audit:idea -- --all --write-baseline`, never hand-edited. '
        + 'A slug listed here is exempt from exactly the checks named, so `--all` stays a '
        + 'live gate for new pages. Fix a page and re-record to shrink the list; new pages '
        + 'must never be added.',
      legacy: Object.fromEntries(Object.entries(legacy).sort(([a], [b]) => a.localeCompare(b))),
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`wrote ${path.relative(root, baselinePath)}: ` +
      `${Object.keys(legacy).length} page(s) with recorded debt`);
    process.exitCode = 0;
    return;
  }

  if (asJson) {
    console.log(JSON.stringify({ strict, results }, null, 2));
  } else {
    for (const r of results) {
      const status = r.failures.length ? 'FAIL' : r.waived.length ? 'PASS (known debt)' : 'PASS';
      console.log(`${status}  ${r.slug}  ${r.metrics.wordCount}w  ` +
        `${r.metrics.competitorMentions} competitors  ${r.metrics.sourceLinkCount} sources  ` +
        `${r.metrics.howToStepCount} steps`);
      for (const c of r.failures) console.log(`   ✗ ${c.id}: ${c.detail}`);
      for (const c of r.waived) console.log(`   • ${c.id} (baseline debt): ${c.detail}`);
    }
    const failed = results.filter((r) => r.failures.length);
    const debt = results.filter((r) => r.waived.length);
    console.log(`\naudit:idea — ${results.length} page(s), ${failed.length} failing` +
      (strict ? ' (strict)' : `, ${debt.length} carrying baseline debt`));
  }

  // Set exitCode rather than calling process.exit(): stdout to a pipe flushes
  // asynchronously, and exiting here truncates --json for large runs.
  process.exitCode = results.some((r) => r.failures.length) ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
