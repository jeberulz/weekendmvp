#!/usr/bin/env node
/**
 * U8 (one-time): Extract newsletter issue bodies from newsletter/{slug}.html
 * into content/newsletter-pages/{slug}.mdx.
 *
 * Why this exists: the author markdown under content/newsletter/2026/** is
 * gitignored by design (frontmatter carries internal fields — beehiiv ids,
 * trend data, checklists), so Vercel builds never see it. The committed,
 * public source of truth for the 11 published issues is the static HTML in
 * newsletter/. This script lifts the body back out of that HTML once;
 * scripts/publish-newsletter.mjs takes over for future issues.
 *
 * Every legacy issue page shares one shape:
 *
 *   <article data-nl-slot="am|pm">
 *     <div class="max-w-2xl mx-auto px-6">
 *       <nav>breadcrumb</nav> <header>badge/date/h1/subtitle</header>
 *       <div class="prose-nl …">…body…</div>              ← extracted
 *       <div class="my-16 … text-center">CTA card</div>   ← → ctaUrl frontmatter
 *       <section>subscribe form</section>                 ← skipped (chrome)
 *       <div class="mt-12 text-center">back link</div>    ← skipped (chrome)
 *     </div>
 *   </article>
 *
 * Newsletter-specific handling on top of the shared walker
 * (scripts/lib/html-to-md.mjs):
 *   - <figure><img> hero images → markdown images (`![alt](src)`)
 *   - <hr> separators → `---` (the walker has no hr rule)
 *   - in-body CTA buttons (div.text-center > a) → <Cta href>…</Cta> JSX
 *   - hrefs sanitized via sanitizeNewsletterUrl (utm/e={{email}} stripped,
 *     weekendmvp.app + relative .html links mapped to Next routes)
 *
 * Frontmatter (sanitized — public fields only): slug, title, description
 * (the header subtitle), publishedAt (JSON-LD datePublished), edition
 * (article[data-nl-slot]), ctaUrl (the bottom CTA card link).
 *
 * Usage:
 *   node scripts/extract-newsletter-to-mdx.mjs              # all 11
 *   node scripts/extract-newsletter-to-mdx.mjs --slug <s>   # one, to stdout
 *
 * Output:
 *   content/newsletter-pages/{slug}.mdx
 *   content/newsletter-pages/_extraction-report.json
 *
 * Each written file is compile-checked with @mdx-js/mdx (remark-gfm), the
 * same pipeline the runtime <Mdx> component uses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { collapse, renderBlocks, setHrefRewriter } from './lib/html-to-md.mjs';
import {
  buildIssueFrontmatter,
  ctaJsx,
  sanitizeNewsletterUrl,
} from './lib/newsletter-shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issuesDir = path.join(root, 'newsletter');
const outDir = path.join(root, 'content', 'newsletter-pages');
const reportPath = path.join(outDir, '_extraction-report.json');

const slugFlagIdx = process.argv.indexOf('--slug');
const onlySlug = slugFlagIdx !== -1 ? process.argv[slugFlagIdx + 1] : null;

/** Pull datePublished from the page's JSON-LD Article block. */
function extractDatePublished($) {
  let date = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (date) return;
    try {
      const data = JSON.parse($(el).text());
      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      for (const node of nodes) {
        if (node && node['@type'] === 'Article' && node.datePublished) {
          date = String(node.datePublished).slice(0, 10);
          return;
        }
      }
    } catch {
      /* malformed JSON-LD — ignore */
    }
  });
  return date;
}

/**
 * Replace walker-invisible nodes (figures, hrs, CTA buttons) with placeholder
 * paragraphs and return the registry used to expand them after rendering.
 */
function preprocess($, prose) {
  const registry = [];
  const placeholder = (kind, payload) => {
    const token = `%%MDX_${kind}_${registry.length}%%`;
    registry.push({ token, kind, ...payload });
    return `<p>${token}</p>`;
  };

  // Hero/illustration figures → markdown images.
  $(prose).find('figure').each((_, fig) => {
    const img = $(fig).find('img').first();
    if (!img.length) { $(fig).remove(); return; }
    $(fig).replaceWith(
      placeholder('IMG', {
        alt: img.attr('alt') || '',
        src: sanitizeNewsletterUrl(img.attr('src') || ''),
      }),
    );
  });

  // Section separators.
  $(prose).find('hr').each((_, hr) => {
    $(hr).replaceWith(placeholder('HR', {}));
  });

  // In-body CTA buttons: <div class="… text-center"><a>label <icon></a></div>
  $(prose).find('div.text-center').each((_, div) => {
    const anchors = $(div).find('a[href]');
    if (anchors.length !== 1) return;
    const a = anchors.first();
    const label = collapse(a.text()).trim();
    if (!label) return;
    $(div).replaceWith(
      placeholder('CTA', {
        href: sanitizeNewsletterUrl(a.attr('href') || ''),
        label,
      }),
    );
  });

  return registry;
}

function expandPlaceholders(blocks, registry) {
  const byToken = new Map(registry.map((r) => [r.token, r]));
  return blocks.map((block) => {
    const entry = byToken.get(block.trim());
    if (!entry) return block;
    if (entry.kind === 'HR') return '---';
    if (entry.kind === 'IMG') return `![${entry.alt}](${entry.src})`;
    return ctaJsx(entry.href, entry.label);
  });
}

function extractIssue(slug) {
  const filePath = path.join(issuesDir, `${slug}.html`);
  const $ = cheerio.load(fs.readFileSync(filePath, 'utf8'));

  const article = $('article[data-nl-slot]').first();
  if (!article.length) return { slug, status: 'failed-no-article' };

  const edition =
    article.attr('data-nl-slot') || (slug.endsWith('-am') ? 'am' : 'pm');
  const title = collapse(article.find('header h1').first().text()).trim();
  const description =
    collapse(article.find('header p').first().text()).trim() ||
    ($('meta[name="description"]').attr('content') || '').trim();
  const publishedAt = extractDatePublished($);

  // Bottom "Want more ideas like this?" card → ctaUrl frontmatter.
  const ctaAnchor = article.find('div.my-16 a[href]').first();
  const ctaUrl = ctaAnchor.length
    ? sanitizeNewsletterUrl(ctaAnchor.attr('href'))
    : null;

  const prose = article.find('div.prose-nl').first();
  if (!prose.length) return { slug, status: 'failed-no-prose-container' };

  const registry = preprocess($, prose[0]);
  const blocks = expandPlaceholders(
    renderBlocks($, prose[0], []).filter((b) => b.trim()),
    registry,
  );

  const fm = buildIssueFrontmatter({
    slug,
    title,
    description,
    publishedAt,
    edition,
    ctaUrl,
  });
  const doc = `${fm}\n\n${blocks.join('\n\n')}\n`;

  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${slug}.mdx`);
  fs.writeFileSync(out, doc);
  return {
    slug,
    status: 'ok',
    out: path.relative(root, out),
    edition,
    publishedAt,
    ctaUrl,
    blocks: blocks.length,
    headings: blocks.filter((b) => /^#{2,3} /.test(b)).length,
    images: blocks.filter((b) => b.startsWith('![')).length,
    ctas: blocks.filter((b) => b.startsWith('<Cta ')).length,
    hrs: blocks.filter((b) => b === '---').length,
    doc,
  };
}

async function compileCheck(results) {
  const failures = [];
  for (const res of results) {
    if (res.status !== 'ok') continue;
    const { content } = matter(res.doc);
    try {
      await compile(content, { remarkPlugins: [remarkGfm], format: 'mdx' });
    } catch (err) {
      failures.push({ slug: res.slug, error: String(err?.message ?? err) });
    }
  }
  return failures;
}

async function main() {
  setHrefRewriter(sanitizeNewsletterUrl);

  const slugs = fs
    .readdirSync(issuesDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.slice(0, -'.html'.length))
    .sort();
  const targets = onlySlug ? slugs.filter((s) => s === onlySlug) : slugs;
  if (onlySlug && !targets.length) {
    console.error(`slug not found in newsletter/: ${onlySlug}`);
    process.exit(1);
  }

  const results = targets.map(extractIssue);
  const failures = await compileCheck(results);

  if (onlySlug) {
    console.log(results[0]?.doc ?? '');
  } else {
    const report = {
      generatedAt: new Date().toISOString(),
      ok: results
        .filter((r) => r.status === 'ok')
        .map(({ doc: _doc, ...r }) => r),
      failed: results.filter((r) => r.status !== 'ok'),
      compileFailures: failures,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  const ok = results.filter((r) => r.status === 'ok');
  console.log(`extract-newsletter-to-mdx: ${targets.length} issues`);
  console.log(`  ok:      ${ok.length} → content/newsletter-pages/*.mdx`);
  console.log(`  missing date: ${ok.filter((r) => !r.publishedAt).length}`);
  console.log(`  failed:  ${results.length - ok.length}`);
  for (const r of results.filter((x) => x.status !== 'ok')) {
    console.log(`    - ${r.slug}: ${r.status}`);
  }
  if (failures.length) {
    console.error(`  MDX COMPILE FAILURES: ${failures.length}`);
    for (const f of failures) console.error(`    - ${f.slug}: ${f.error}`);
    process.exit(1);
  }
  console.log('  mdx compile: all passed');
}

await main();
