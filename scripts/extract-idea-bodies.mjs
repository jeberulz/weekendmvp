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

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'button', 'iconify-icon', 'svg',
  'img', 'picture', 'source', 'iframe', 'form', 'input', 'select', 'textarea',
  'nav', 'footer', 'header', 'aside',
]);
const INLINE_TAGS = new Set([
  'a', 'span', 'strong', 'b', 'em', 'i', 'code', 'br', 'small', 'sup', 'sub',
  'u', 'abbr', 'time', 'mark', 'label',
]);

const cls = (el) => (el.attribs?.class || '');
const hasClass = (el, name) => cls(el).split(/\s+/).includes(name);

/** Escape characters that would break MDX compilation in plain prose. */
function escapeMdx(text) {
  // `<` starts JSX, `{` starts an expression. Backslash-escapes are valid MDX.
  return text.replace(/</g, '\\<').replace(/\{/g, '\\{');
}

const collapse = (s) => s.replace(/\s+/g, ' ');

/** True for nodes that should be entirely ignored (buttons, icons, sr-only). */
function isSkipped(node) {
  if (node.type !== 'tag') return false;
  if (SKIP_TAGS.has(node.tagName)) return true;
  if (hasClass(node, 'sr-only')) return true;
  return false;
}

/** Render inline content (text, links, emphasis) of a node to markdown. */
function inline($, node) {
  if (node.type === 'text') return escapeMdx(collapse(node.data || ''));
  if (node.type !== 'tag') return '';
  if (isSkipped(node)) return '';
  const tag = node.tagName;
  const children = () => node.children.map((c) => inline($, c)).join('');
  switch (tag) {
    case 'br':
      return ' ';
    case 'a': {
      const text = collapse(children()).trim();
      let href = node.attribs?.href || '';
      if (!text) return '';
      if (!href || href.startsWith('#')) return text;
      // Rewrite legacy relative idea links to the Next.js route shape.
      const rel = href.match(/^(?:\.\/)?([a-z0-9-]+)\.html$/i);
      if (rel) href = `/ideas/${rel[1]}`;
      else href = href.replace(/^\/ideas\/([a-z0-9-]+)\.html$/i, '/ideas/$1');
      return `[${text}](${href})`;
    }
    case 'strong':
    case 'b': {
      const t = collapse(children()).trim();
      return t ? `**${t}**` : '';
    }
    case 'em':
    case 'i': {
      const t = collapse(children()).trim();
      return t ? `*${t}*` : '';
    }
    case 'code': {
      const t = collapse($(node).text()).trim();
      return t ? `\`${t}\`` : '';
    }
    default:
      return children();
  }
}

/** All inline text of an element (recursing through divs too), markdown inline. */
function inlineAll($, el) {
  return collapse(
    el.children.map((c) => {
      if (c.type === 'text') return inline($, c);
      if (c.type !== 'tag') return '';
      if (isSkipped(c)) return '';
      if (INLINE_TAGS.has(c.tagName)) return inline($, c);
      return ` ${inlineAll($, c)} `;
    }).join(''),
  ).trim();
}

/** Raw text preserving author newlines — for prompt blocks / <pre>. */
function rawText($, node, out = []) {
  if (node.type === 'text') { out.push(node.data || ''); return out; }
  if (node.type !== 'tag') return out;
  if (isSkipped(node)) return out;
  if (node.tagName === 'br') { out.push('\n'); return out; }
  for (const c of node.children) rawText($, c, out);
  return out;
}

/** Dedent + trim a preserved-newline text block. */
function cleanBlockText($, el) {
  const raw = rawText($, el).join('');
  let lines = raw.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  lines = lines.map((l) => (l.trim() ? l.slice(min) : ''));
  // Collapse runs of blank lines.
  const result = [];
  for (const l of lines) {
    if (!l.trim() && result.length && !result[result.length - 1].trim()) continue;
    result.push(l);
  }
  return result.join('\n');
}

/** Fence a code block safely (longer fence if the body contains ```). */
function fence(text) {
  let marker = '```';
  while (text.includes(marker)) marker += '`';
  return `${marker}text\n${text}\n${marker}`;
}

/** A `.prompt-box` div → bold label + fenced prompt text. */
function renderPromptBox($, el) {
  const blocks = [];
  const label = $(el).find('h4').first();
  if (label.length) {
    const t = collapse(label.text()).trim();
    if (t) blocks.push(`**${escapeMdx(t)}**`);
  }
  const bodyParts = [];
  for (const child of el.children) {
    if (child.type !== 'tag' || isSkipped(child)) continue;
    if (child.tagName === 'h4') continue;
    const text = cleanBlockText($, child);
    if (text.trim()) bodyParts.push(text);
  }
  if (bodyParts.length) blocks.push(fence(bodyParts.join('\n\n')));
  return blocks;
}

const isLabelEl = (el) =>
  /\buppercase\b/.test(cls(el)) && /tracking-(wide|widest)/.test(cls(el));
const isTitleEl = (el) =>
  el.tagName === 'h4' ||
  /font-(semibold|bold|medium)\b/.test(cls(el)) ||
  /text-2xl/.test(cls(el));

/**
 * A "card" div inside a grid (competitor, pricing tier, tech-stack layer,
 * stat) → one compact markdown line: `**Title** (Label) — description`.
 */
function renderCardItem($, el) {
  const titles = [];
  const labels = [];
  const descs = [];
  const walk = (node) => {
    if (node.type !== 'tag' || isSkipped(node)) return;
    const tag = node.tagName;
    if (tag === 'div' || tag === 'section') {
      // Header rows pair an h4/p title with a small span (e.g. price).
      for (const c of node.children) walk(c);
      return;
    }
    if (tag === 'span') {
      const t = inlineAll($, node);
      if (t) labels.push(t);
      return;
    }
    if (/^h[1-6]$/.test(tag) || tag === 'p') {
      const t = inlineAll($, node);
      if (!t) return;
      if (isLabelEl(node)) labels.push(t);
      else if (isTitleEl(node) && !titles.length) titles.push(t);
      else if (isTitleEl(node)) labels.push(t); // e.g. price under a tier name
      else descs.push(t);
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      $(node).children('li').each((_, li) => {
        const t = inlineAll($, $(li)[0]);
        if (t) descs.push(t);
      });
      return;
    }
    const t = inlineAll($, node);
    if (t) descs.push(t);
  };
  for (const c of el.children) walk(c);
  // Drop purely numeric badges (step-number circles like "1" / "01").
  const realLabels = labels.filter((l) => !/^\d{1,2}$/.test(l));
  labels.length = 0;
  labels.push(...realLabels);
  if (!titles.length && !descs.length && !labels.length) return '';
  if (!titles.length) return [labels.join(', '), descs.join(' ')].filter(Boolean).join(' — ');
  let line = `**${titles.join(' ')}**`;
  if (labels.length) line += ` (${labels.join(', ')})`;
  if (descs.length) line += ` — ${descs.join(' ')}`;
  return line;
}

/** ul/ol → markdown list. */
function renderList($, el, ordered) {
  const items = [];
  $(el).children('li').each((i, li) => {
    const t = inlineAll($, li);
    if (t) items.push(ordered ? `${i + 1}. ${t}` : `- ${t}`);
  });
  return items.length ? [items.join('\n')] : [];
}

function renderTable($, el) {
  const rows = [];
  $(el).find('tr').each((_, tr) => {
    const cells = [];
    $(tr).children('th,td').each((__, td) => cells.push(inlineAll($, td) || ' '));
    rows.push(cells);
  });
  if (!rows.length) return [];
  const lines = [`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`];
  for (const r of rows.slice(1)) lines.push(`| ${r.join(' | ')} |`);
  return [lines.join('\n')];
}

/** Convert the block-level children of `container` into markdown blocks. */
function renderBlocks($, container, blocks = []) {
  let buf = '';
  const flush = () => {
    const t = collapse(buf).trim();
    if (t) blocks.push(t);
    buf = '';
  };
  for (const node of container.children) {
    if (node.type === 'text') { buf += inline($, node); continue; }
    if (node.type !== 'tag') continue;
    if (isSkipped(node)) continue;
    const tag = node.tagName;
    if (INLINE_TAGS.has(tag)) { buf += inline($, node); continue; }
    flush();
    if (/^h[1-6]$/.test(tag)) {
      const t = collapse($(node).text()).trim();
      if (!t) continue;
      if (tag === 'h2') blocks.push(`## ${escapeMdx(t)}`);
      else if (tag === 'h3') blocks.push(`### ${escapeMdx(t)}`);
      else blocks.push(`**${escapeMdx(t)}**`);
      continue;
    }
    if (tag === 'p') {
      // Prompt body paragraphs are handled by renderPromptBox; a bare
      // font-mono paragraph outside a prompt-box still becomes a fence.
      if (/\bfont-mono\b/.test(cls(node))) {
        const text = cleanBlockText($, node);
        if (text.trim()) blocks.push(fence(text));
      } else {
        const t = inlineAll($, node);
        if (t) blocks.push(t);
      }
      continue;
    }
    if (tag === 'ul' || tag === 'ol') { blocks.push(...renderList($, node, tag === 'ol')); continue; }
    if (tag === 'pre') {
      const text = cleanBlockText($, node);
      if (text.trim()) blocks.push(fence(text));
      continue;
    }
    if (tag === 'blockquote') {
      const inner = renderBlocks($, node, []);
      if (inner.length) blocks.push(inner.join('\n\n').split('\n').map((l) => `> ${l}`).join('\n'));
      continue;
    }
    if (tag === 'table') { blocks.push(...renderTable($, node)); continue; }
    if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
      if (hasClass(node, 'prompt-box')) { blocks.push(...renderPromptBox($, node)); continue; }
      const elChildren = node.children.filter((c) => c.type === 'tag' && !isSkipped(c));
      // "How it works" step rows: a flex container of ≥2 div.flex-1 columns.
      const isStepRow =
        /\bflex\b/.test(cls(node)) &&
        elChildren.length >= 2 &&
        elChildren.every((c) => hasClass(c, 'flex-1'));
      if (/\bgrid\b/.test(cls(node)) || isStepRow) {
        const items = [];
        for (const child of elChildren) {
          const item = renderCardItem($, child);
          if (item) items.push(isStepRow ? `${items.length + 1}. ${item}` : `- ${item}`);
        }
        if (items.length) blocks.push(items.join('\n'));
        continue;
      }
      renderBlocks($, node, blocks);
      continue;
    }
    // Unknown block-level tag: keep its text so content is never lost.
    const t = inlineAll($, node);
    if (t) blocks.push(t);
  }
  flush();
  return blocks;
}

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
