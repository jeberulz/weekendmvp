#!/usr/bin/env node
/**
 * U8 (ongoing): Publish a newsletter issue to the Next.js site.
 *
 * Replaces the legacy scripts/publish-newsletter-pages.js (markdown → static
 * HTML). The authoring contract (R12) is unchanged: the `/newsletter` skill
 * still writes content/newsletter/2026/{MM}/week-{NN}/{date}-{slot}.md with
 * frontmatter (date, slot, title, subtitle, cta_url, sections, …internal
 * fields) and the web body under "## BODY (paste into Beehiiv editor)".
 *
 * Those author files are gitignored (they carry internal fields), so this
 * script extracts the BODY markdown, sanitizes it, and writes the committed
 * public artifact content/newsletter-pages/{date}-{slot}.mdx with PUBLIC
 * frontmatter only (slug, title, description, publishedAt, edition, ctaUrl).
 * app/newsletter/[slug]/page.tsx renders that file.
 *
 * Body transformations (mirror the one-time HTML extraction so old and new
 * issues render identically — see scripts/extract-newsletter-to-mdx.mjs):
 *   - headings demoted one level (author "# X" rendered as <h2> on the web)
 *   - weekendmvp.app / relative link+image URLs mapped to Next routes,
 *     utm_* and e={{email}} Beehiiv params stripped (external URLs untouched)
 *   - standalone "[label →](url)" button lines → <Cta href>label</Cta> JSX
 *
 * Usage:
 *   node scripts/publish-newsletter.mjs <author-md-path> [...]
 *     --dry-run   print the MDX instead of writing it
 *     --seed      also upsert newsletter_issues metadata via
 *                 `npx convex run seed:seedNewsletters` (add --prod for prod)
 *
 * Without --seed it prints the exact seed command to run, since /newsletter
 * archive cards + sitemap read Convex.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import {
  buildIssueFrontmatter,
  ctaJsx,
  issueSlug,
  sanitizeNewsletterUrl,
} from './lib/newsletter-shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'content', 'newsletter-pages');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const seed = argv.includes('--seed');
const prod = argv.includes('--prod');
const files = argv.filter((a) => !a.startsWith('--'));

const BODY_START = '## BODY (paste into Beehiiv editor)';
const BODY_END = '## BEEHIIV CHECKLIST';

function extractBody(md) {
  const start = md.indexOf(BODY_START);
  if (start === -1) throw new Error(`BODY section not found ("${BODY_START}")`);
  const after = md.indexOf('\n', start) + 1;
  const end = md.indexOf(BODY_END, after);
  return (end === -1 ? md.slice(after) : md.slice(after, end)).trim();
}

/** YAML may parse `date: 2026-05-22` as a Date — normalize to YYYY-MM-DD. */
function isoDate(value, file) {
  const s =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`invalid/missing "date" frontmatter in ${file}`);
  }
  return s;
}

/** Sanitize every markdown link/image destination on a line. */
function sanitizeLineUrls(line) {
  return line.replace(
    /\]\(([^()\s]+)\)/g,
    (_, url) => `](${sanitizeNewsletterUrl(url)})`,
  );
}

/**
 * Transform the author BODY markdown into the public MDX body
 * (heading demotion, URL sanitization, CTA lines → <Cta> JSX).
 * Fenced code blocks pass through untouched.
 */
function transformBody(body) {
  const out = [];
  let inFence = false;
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Standalone CTA button line: [label →](url)
    const btn = line.match(/^\[([^\]]*→[^\]]*)\]\(([^()\s]+)\)\s*$/);
    if (btn) {
      const label = btn[1].replace(/\s*→\s*$/, '').trim();
      out.push(ctaJsx(sanitizeNewsletterUrl(btn[2]), label));
      continue;
    }
    // Demote headings one level (author "# X" renders as <h2> on the web,
    // matching the legacy publish pipeline; the page h1 is the title).
    const h = line.match(/^(#{1,5})(\s+.*)$/);
    if (h) {
      out.push(`#${h[1]}${sanitizeLineUrls(h[2])}`);
      continue;
    }
    out.push(sanitizeLineUrls(line));
  }
  // Collapse 3+ blank lines left by removed sections.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function compileCheck(doc, file) {
  const { content } = matter(doc);
  try {
    await compile(content, { remarkPlugins: [remarkGfm], format: 'mdx' });
  } catch (err) {
    throw new Error(`MDX compile failed for ${file}: ${err?.message ?? err}`);
  }
}

function seedPayload(meta) {
  return {
    items: [
      {
        slug: meta.slug,
        title: meta.title,
        description: meta.description,
        publishedAt: Date.parse(`${meta.publishedAt}T00:00:00Z`),
        edition: meta.edition,
      },
    ],
  };
}

function runSeed(meta) {
  const json = JSON.stringify(seedPayload(meta));
  const cmd = ['convex', 'run', 'seed:seedNewsletters', json, ...(prod ? ['--prod'] : [])];
  console.log(`  seeding Convex (${prod ? 'prod' : 'dev'})…`);
  const res = spawnSync('npx', cmd, { cwd: root, encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(res.stdout || '');
    console.error(res.stderr || '');
    throw new Error(`npx convex run seed:seedNewsletters failed (exit ${res.status})`);
  }
  console.log(`  seed:seedNewsletters → ${(res.stdout || '').trim()}`);
}

async function publish(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const { data: fm, content } = matter(raw);
  for (const key of ['slot', 'title', 'subtitle']) {
    if (!fm[key]) throw new Error(`missing "${key}" frontmatter in ${file}`);
  }
  if (fm.slot !== 'am' && fm.slot !== 'pm') {
    throw new Error(`"slot" must be am|pm in ${file} (got "${fm.slot}")`);
  }

  const date = isoDate(fm.date, file);
  const slug = issueSlug(date, fm.slot);
  const meta = {
    slug,
    title: String(fm.title),
    description: String(fm.subtitle),
    publishedAt: date,
    edition: fm.slot,
    ctaUrl: fm.cta_url ? sanitizeNewsletterUrl(String(fm.cta_url)) : undefined,
  };

  const body = transformBody(extractBody(content));
  const doc = `${buildIssueFrontmatter(meta)}\n\n${body}\n`;
  await compileCheck(doc, file);

  if (dryRun) {
    console.log(doc);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${slug}.mdx`);
  fs.writeFileSync(out, doc);
  console.log(`✓ Wrote ${path.relative(root, out)}`);

  if (seed) {
    runSeed(meta);
  } else {
    console.log(
      `  Reminder — upsert archive/sitemap metadata in Convex:\n` +
        `    npx convex run seed:seedNewsletters '${JSON.stringify(seedPayload(meta))}'${prod ? ' --prod' : ''}\n` +
        `  (or re-run: node scripts/publish-newsletter.mjs ${path.relative(root, file)} --seed${prod ? ' --prod' : ''})`,
    );
  }
}

if (!files.length) {
  console.error(
    'Usage: node scripts/publish-newsletter.mjs <author-md-path> [...] [--dry-run] [--seed] [--prod]',
  );
  process.exit(1);
}
for (const f of files) await publish(path.resolve(f));
