#!/usr/bin/env node
/**
 * U9: Seed Convex from the legacy manifests + the U9 extraction output.
 *
 * Reads:
 *   ideas/manifest.json          → ideas table + categories/revenue_goals/
 *                                  audiences/build_times/tools reference tables
 *   ideas/manifest.draft.json    → only with --include-drafts (quarantined ideas)
 *   articles/manifest.json       → articles table
 *   newsletter/manifest.json     → newsletter_issues table
 *   solve/{slug}/index.html      → problems table (title + meta description)
 *   content/ideas/{slug}.mdx     → presence sets bodyMode: 'mdx'
 *   content/ideas/_quarantine/{slug}.md → bodyMode: 'convex' + body field
 *
 * Calls the batched internal mutations in convex/seed.ts via
 * `npx convex run seed:<fn> '<json>'` (≤25 items per call). Idempotent:
 * every mutation upserts by slug, so re-running is safe.
 *
 * Usage:
 *   node scripts/seed-convex.mjs --dry-run            # print counts, no writes
 *   node scripts/seed-convex.mjs                      # seed the dev deployment
 *   node scripts/seed-convex.mjs --prod               # seed production
 *   node scripts/seed-convex.mjs --include-drafts     # also seed manifest.draft.json ideas
 *   node scripts/seed-convex.mjs --only ideas         # ideas|articles|newsletters|refs
 *
 * NOTE: convex/seed.ts must be deployed (`npx convex dev` watcher or
 * `npx convex deploy`) before the seed functions can be run.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentIdeasDir = path.join(root, 'content', 'ideas');
const quarantineDir = path.join(contentIdeasDir, '_quarantine');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const prod = argv.includes('--prod');
const includeDrafts = argv.includes('--include-drafts');
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx !== -1 ? argv[onlyIdx + 1] : null;

const MAX_BATCH = 25; // keep in sync with convex/seed.ts
const MAX_JSON_BYTES = 200_000; // stay far below argv + Convex arg limits

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

/** Drop undefined/null values so Convex validators see clean objects. */
function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, val]) => val !== undefined && val !== null),
  );
}

const pick = (obj, keys) =>
  compact(Object.fromEntries(keys.map((k) => [k, obj[k]])));

const humanize = (slug) =>
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

function parsePublishedAt(value, label) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`unparseable publishedAt "${value}" on ${label}`);
  return ms;
}

/** Strip frontmatter from a quarantined markdown file → body string. */
function quarantineBody(slug) {
  const p = path.join(quarantineDir, `${slug}.md`);
  if (!fs.existsSync(p)) return undefined;
  const raw = fs.readFileSync(p, 'utf8');
  const m = raw.match(/^---\n[\s\S]*?\n---\n*/);
  return (m ? raw.slice(m[0].length) : raw).trim();
}

// ---------------------------------------------------------------------------
// Build payloads
// ---------------------------------------------------------------------------

const IDEA_KEYS = [
  'slug', 'title', 'description', 'summary', 'category', 'buildTime',
  'revenueGoal', 'applicationCategory', 'tools', 'audiences', 'source',
  'scores', 'og', 'provenance', 'researchLevel',
];

function buildIdea(raw, { draft }) {
  const idea = pick(raw, IDEA_KEYS);
  idea.publishedAt = parsePublishedAt(raw.publishedAt, raw.slug);
  if (idea.og) idea.og = pick(idea.og, ['subject', 'accent', 'status']);
  const hasMdx = fs.existsSync(path.join(contentIdeasDir, `${raw.slug}.mdx`));
  if (hasMdx) {
    idea.bodyMode = 'mdx';
  } else {
    idea.bodyMode = 'convex';
    const body = quarantineBody(raw.slug);
    if (body) idea.body = body;
  }
  const dropped = Object.keys(raw).filter(
    (k) => !IDEA_KEYS.includes(k) && k !== 'publishedAt',
  );
  if (dropped.length) {
    console.warn(`  note: ${raw.slug}${draft ? ' [draft]' : ''} dropping non-schema keys: ${dropped.join(', ')}`);
  }
  return idea;
}

function buildIdeas() {
  const manifest = readJson('ideas/manifest.json');
  const items = manifest.ideas.map((i) => buildIdea(i, { draft: false }));
  if (includeDrafts) {
    const draftPath = path.join(root, 'ideas/manifest.draft.json');
    if (fs.existsSync(draftPath)) {
      const drafts = JSON.parse(fs.readFileSync(draftPath, 'utf8')).ideas.filter(
        (d) => !manifest.ideas.some((i) => i.slug === d.slug),
      );
      items.push(...drafts.map((d) => buildIdea(d, { draft: true })));
    }
  }
  return items;
}

function buildArticles() {
  const manifest = readJson('articles/manifest.json');
  return manifest.articles.map((a) => {
    const doc = pick(a, ['slug', 'title', 'description', 'wordCount', 'readMinutes', 'og']);
    if (a.publishedAt) doc.publishedAt = parsePublishedAt(a.publishedAt, a.slug);
    return doc;
  });
}

function buildNewsletters() {
  const manifest = readJson('newsletter/manifest.json');
  return manifest.newsletters.map((n) => ({
    ...pick(n, ['slug', 'title', 'edition', 'description', 'og']),
    publishedAt: parsePublishedAt(n.publishedAt, n.slug),
  }));
}

const SOLVE_PROBLEMS = ['customer-support', 'invoicing', 'knowledge-transfer', 'meeting-notes', 'scheduling'];

function buildReferenceTables() {
  const manifest = readJson('ideas/manifest.json');

  const categories = manifest.categories.map((c) =>
    pick(c, ['slug', 'name', 'displayName', 'description', 'icon', 'color', 'keywords', 'faqs']),
  );
  const revenueGoals = manifest.revenueGoals.map((r) =>
    pick(r, ['slug', 'name', 'displayName', 'description', 'amount', 'methodology', 'unitEconomics', 'keywords']),
  );
  const audiences = manifest.audiences.map((a) =>
    pick(a, ['slug', 'name', 'displayName', 'description', 'icon', 'filters', 'keywords', 'traits', 'resources']),
  );
  const buildTimes = manifest.buildTimes.map((b) =>
    pick(b, ['slug', 'name', 'displayName', 'description', 'hours', 'keywords']),
  );

  // manifest.tools is the rich source; ideas[].tools may reference extra slugs.
  const tools = manifest.tools.map((t) =>
    pick(t, ['slug', 'name', 'tagline', 'description', 'logo', 'url', 'strengths', 'bestFor', 'gettingStarted', 'keywords']),
  );
  const known = new Set(tools.map((t) => t.slug));
  for (const idea of manifest.ideas) {
    for (const slug of idea.tools || []) {
      if (!known.has(slug)) {
        known.add(slug);
        tools.push({ slug, displayName: humanize(slug) });
      }
    }
  }

  const problems = SOLVE_PROBLEMS.map((slug) => {
    const page = path.join(root, 'solve', slug, 'index.html');
    if (!fs.existsSync(page)) {
      console.warn(`  note: solve/${slug}/index.html missing — humanized fallback`);
      return { slug, displayName: humanize(slug) };
    }
    const $ = cheerio.load(fs.readFileSync(page, 'utf8'));
    const title = ($('title').text() || '').replace(/\s*\|\s*Weekend MVP\s*$/i, '').trim();
    const description = ($('meta[name="description"]').attr('content') || '').trim();
    return compact({
      slug,
      displayName: title || humanize(slug),
      description: description || undefined,
    });
  });

  return { categories, revenueGoals, audiences, buildTimes, tools, problems };
}

// ---------------------------------------------------------------------------
// Convex invocation
// ---------------------------------------------------------------------------

function convexRun(fn, args) {
  const json = JSON.stringify(args);
  if (dryRun) {
    console.log(`  [dry-run] npx convex run ${fn}${prod ? ' --prod' : ''}  (${Buffer.byteLength(json)} bytes)`);
    return null;
  }
  const cmd = ['convex', 'run', fn, json, ...(prod ? ['--prod'] : [])];
  const res = spawnSync('npx', cmd, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (res.status !== 0) {
    console.error(res.stdout || '');
    console.error(res.stderr || '');
    throw new Error(`npx convex run ${fn} failed (exit ${res.status})`);
  }
  const out = (res.stdout || '').trim();
  console.log(`  ${fn} → ${out.replace(/\s+/g, ' ').slice(0, 200)}`);
  return out;
}

/** Chunk by item count AND serialized size (argv + Convex arg safety). */
function chunk(items) {
  const batches = [];
  let current = [];
  let size = 2;
  for (const item of items) {
    const itemSize = Buffer.byteLength(JSON.stringify(item)) + 1;
    if (current.length && (current.length >= MAX_BATCH || size + itemSize > MAX_JSON_BYTES)) {
      batches.push(current);
      current = [];
      size = 2;
    }
    current.push(item);
    size += itemSize;
  }
  if (current.length) batches.push(current);
  return batches;
}

function seedBatched(label, fn, items) {
  const batches = chunk(items);
  console.log(`${label}: ${items.length} docs in ${batches.length} batch(es)`);
  for (const batch of batches) convexRun(fn, { items: batch });
}

function main() {
  const want = (k) => !only || only === k;

  if (want('refs')) {
    const refs = buildReferenceTables();
    const counts = Object.entries(refs).map(([k, list]) => `${k}=${list.length}`).join(' ');
    console.log(`reference tables: ${counts}`);
    // Each table is tiny (≤ a couple dozen rows) — one call per table keeps
    // payloads small and failures isolated.
    for (const [key, list] of Object.entries(refs)) {
      for (const batch of chunk(list)) convexRun('seed:seedReferenceTables', { [key]: batch });
    }
  }

  if (want('ideas')) {
    const ideas = buildIdeas();
    const mdx = ideas.filter((i) => i.bodyMode === 'mdx').length;
    const convexBody = ideas.filter((i) => i.bodyMode === 'convex' && i.body).length;
    const noBody = ideas.filter((i) => i.bodyMode === 'convex' && !i.body).length;
    console.log(`ideas: ${ideas.length} total — bodyMode mdx=${mdx}, convex(with body)=${convexBody}, convex(no body yet)=${noBody}`);
    if (noBody) {
      for (const i of ideas.filter((x) => x.bodyMode === 'convex' && !x.body)) {
        console.log(`  no body source: ${i.slug}`);
      }
    }
    seedBatched('ideas', 'seed:seedIdeas', ideas);
  }

  if (want('articles')) {
    seedBatched('articles', 'seed:seedArticles', buildArticles());
  }

  if (want('newsletters')) {
    seedBatched('newsletters', 'seed:seedNewsletters', buildNewsletters());
  }

  console.log(dryRun ? 'dry run complete — nothing written.' : 'seed complete.');
}

main();
