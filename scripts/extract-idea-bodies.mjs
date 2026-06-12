#!/usr/bin/env node
/**
 * U9: Extract idea-page bodies from ideas/{slug}.html into content/ideas/{slug}.mdx.
 *
 * For every idea in ideas/manifest.json (and ideas/manifest.draft.json), this
 * cheerio-parses the published HTML page, locates the seven contract sections
 * (same regexes as scripts/audit-ideas.js), converts each section to clean
 * markdown via a hand-rolled walker, and writes an MDX file with frontmatter
 * (slug + title). Pages that fail the section contract are written to
 * content/ideas/_quarantine/{slug}.md instead — those ideas are seeded with
 * bodyMode: 'convex' and a `body` field by scripts/seed-convex.mjs.
 *
 * Usage:
 *   node scripts/extract-idea-bodies.mjs              # extract everything
 *   node scripts/extract-idea-bodies.mjs --slug <s>   # one idea, prints MDX to stdout too
 *
 * Output:
 *   content/ideas/{slug}.mdx                 # passing pages
 *   content/ideas/_quarantine/{slug}.md      # pages missing required sections
 *   content/ideas/_extraction-report.json    # machine-readable run report
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import {
  collapse,
  escapeMdx,
  isSkipped,
  renderBlocks,
} from './lib/html-to-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ideasDir = path.join(root, 'ideas');
const outDir = path.join(root, 'content', 'ideas');
const quarantineDir = path.join(outDir, '_quarantine');
const reportPath = path.join(outDir, '_extraction-report.json');

const slugFlagIdx = process.argv.indexOf('--slug');
const onlySlug = slugFlagIdx !== -1 ? process.argv[slugFlagIdx + 1] : null;

// Mirrors REQUIRED_SECTIONS in scripts/audit-ideas.js (same keys + regexes).
const REQUIRED_SECTIONS = [
  { key: 'problem',     match: /\bproblem\b/i },
  { key: 'solution',    match: /\bsolution\b/i },
  { key: 'market',      match: /market\s*(research|insight|size|opportunity)/i },
  { key: 'competitive', match: /competit(or|ive|ors)/i },
  { key: 'business',    match: /(business\s*model|monetization|pricing|revenue)/i },
  { key: 'stack',       match: /(tech\s*stack|recommended\s*stack|technology\s*stack)/i },
  { key: 'prompts',     match: /(ai\s*prompts|prompts\s*to\s*build)/i },
];

// Optional extra section worth keeping (citation list on researched pages).
const OPTIONAL_SECTIONS = [{ key: 'sources', match: /^\s*sources\s*$/i }];

/**
 * Find the wrapper element + heading text for each contract section.
 * Every template generation wraps each section h2 in its own parent div, but
 * we fall back to sibling-slicing when h2s share a parent.
 */
function findSections($) {
  const h2s = $('h2').toArray().filter((el) => $(el).parents('nav,footer,header').length === 0);
  const matched = new Map(); // key -> { h2, heading }
  for (const spec of [...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS]) {
    for (const el of h2s) {
      const text = collapse($(el).text()).trim();
      if (spec.match.test(text) && !matched.has(spec.key)) {
        matched.set(spec.key, { el, heading: text });
        break;
      }
    }
  }
  const sections = [];
  for (const spec of [...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS]) {
    const hit = matched.get(spec.key);
    if (!hit) { sections.push({ key: spec.key, missing: !OPTIONAL_SECTIONS.includes(spec) }); continue; }
    const parent = hit.el.parent;
    const siblingsH2 = parent.children.filter((c) => c.type === 'tag' && c.tagName === 'h2');
    let blocks;
    if (siblingsH2.length <= 1) {
      // Dedicated wrapper div — render everything except the h2 itself.
      const clone = { ...parent, children: parent.children.filter((c) => c !== hit.el) };
      blocks = renderBlocks($, clone, []);
    } else {
      // Shared container: take siblings between this h2 and the next h2.
      const idx = parent.children.indexOf(hit.el);
      const slice = [];
      for (let i = idx + 1; i < parent.children.length; i++) {
        const sib = parent.children[i];
        if (sib.type === 'tag' && sib.tagName === 'h2') break;
        slice.push(sib);
      }
      blocks = renderBlocks($, { children: slice }, []);
    }
    sections.push({ key: spec.key, heading: hit.heading, blocks });
  }
  return sections;
}

function buildDocument(idea, sections) {
  const fm = [
    '---',
    `slug: ${JSON.stringify(idea.slug)}`,
    `title: ${JSON.stringify(idea.title)}`,
    '---',
  ].join('\n');
  const body = sections
    .filter((s) => !s.missing && s.blocks && s.blocks.length)
    .map((s) => [`## ${escapeMdx(s.heading)}`, ...s.blocks].join('\n\n'))
    .join('\n\n');
  return `${fm}\n\n${body}\n`;
}

function extractIdea(idea) {
  const filePath = path.join(ideasDir, `${idea.slug}.html`);
  if (!fs.existsSync(filePath)) return { slug: idea.slug, status: 'skipped-no-html' };
  const $ = cheerio.load(fs.readFileSync(filePath, 'utf8'));
  const sections = findSections($);
  const missing = sections.filter((s) => s.missing).map((s) => s.key);
  const doc = buildDocument(idea, sections);
  if (missing.length) {
    fs.mkdirSync(quarantineDir, { recursive: true });
    const out = path.join(quarantineDir, `${idea.slug}.md`);
    fs.writeFileSync(out, doc);
    return { slug: idea.slug, status: 'quarantined', missing, out: path.relative(root, out), doc };
  }
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${idea.slug}.mdx`);
  fs.writeFileSync(out, doc);
  return { slug: idea.slug, status: 'ok', out: path.relative(root, out), doc };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ideasDir, 'manifest.json'), 'utf8'));
  const draftPath = path.join(ideasDir, 'manifest.draft.json');
  const drafts = fs.existsSync(draftPath)
    ? JSON.parse(fs.readFileSync(draftPath, 'utf8')).ideas
    : [];

  const all = [
    ...manifest.ideas.map((i) => ({ ...i, _source: 'manifest' })),
    ...drafts
      .filter((d) => !manifest.ideas.some((i) => i.slug === d.slug))
      .map((i) => ({ ...i, _source: 'draft' })),
  ];

  const targets = onlySlug ? all.filter((i) => i.slug === onlySlug) : all;
  if (onlySlug && !targets.length) {
    console.error(`slug not found in manifests: ${onlySlug}`);
    process.exit(1);
  }

  const report = { generatedAt: new Date().toISOString(), ok: [], quarantined: [], skipped: [] };
  for (const idea of targets) {
    const res = extractIdea(idea);
    if (res.status === 'ok') report.ok.push({ slug: res.slug, source: idea._source, file: res.out });
    else if (res.status === 'quarantined') report.quarantined.push({ slug: res.slug, source: idea._source, missing: res.missing, file: res.out });
    else report.skipped.push({ slug: res.slug, source: idea._source, reason: 'no html page' });
    if (onlySlug) console.log(res.doc ?? '');
  }

  if (!onlySlug) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  console.log(`extract-idea-bodies: ${targets.length} ideas`);
  console.log(`  ok:          ${report.ok.length} → content/ideas/*.mdx`);
  console.log(`  quarantined: ${report.quarantined.length} → content/ideas/_quarantine/*.md`);
  for (const q of report.quarantined) console.log(`    - ${q.slug} [${q.source}] missing: ${q.missing.join(', ')}`);
  console.log(`  skipped:     ${report.skipped.length} (no HTML)`);
  for (const s of report.skipped) console.log(`    - ${s.slug}`);
}

main();
