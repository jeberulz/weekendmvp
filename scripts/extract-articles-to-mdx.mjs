#!/usr/bin/env node
/**
 * U7: Extract article bodies from articles/{slug}.html into
 * content/articles/{slug}.mdx.
 *
 * Every legacy article page shares one shape:
 *
 *   <article class="relative z-10 pt-32 pb-24">
 *     <div class="max-w-2xl mx-auto px-6">
 *       <nav>breadcrumb</nav> <header>title/meta</header> <figure>hero</figure>
 *       <section>…content…</section>
 *       <div class="my-16 … text-center">CTA</div>      ← skipped (chrome)
 *       <section class="text-center py-12">CTA</section> ← skipped (chrome)
 *     </div>
 *   </article>
 *
 * The body is the ordered list of <section> children that are NOT text-center
 * CTAs. Sections are converted to markdown with the shared walker
 * (scripts/lib/html-to-md.mjs — same renderer as the idea extraction), after
 * a few article-specific DOM rewrites:
 *   - div.font-mono prompt/command boxes → <pre> so they become code fences
 *   - numbered circle badges ("01") next to h2s → dropped
 *   - time badges ("7:00 PM") next to h3s → merged into the heading text
 *   - decorative arrow-glyph spans (➔) → dropped
 *
 * Frontmatter: slug, title, description, wordCount, readMinutes (from
 * articles/manifest.json), category (header badge), publishedAt (JSON-LD
 * datePublished), heroAlt (hero <img> alt, reused by the Next.js page).
 *
 * Usage:
 *   node scripts/extract-articles-to-mdx.mjs              # extract all 19
 *   node scripts/extract-articles-to-mdx.mjs --slug <s>   # one, print to stdout
 *
 * Output:
 *   content/articles/{slug}.mdx
 *   content/articles/_extraction-report.json
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
import {
  cls,
  collapse,
  renderBlocks,
  setHrefRewriter,
} from './lib/html-to-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const articlesDir = path.join(root, 'articles');
const outDir = path.join(root, 'content', 'articles');
const reportPath = path.join(outDir, '_extraction-report.json');

const slugFlagIdx = process.argv.indexOf('--slug');
const onlySlug = slugFlagIdx !== -1 ? process.argv[slugFlagIdx + 1] : null;

/** Map legacy hrefs (relative to /articles/) onto Next.js routes. */
function articleHrefRewriter(href) {
  if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:')) return href;
  // Sibling article: "vibe-coding-101.html" → /articles/vibe-coding-101
  const sibling = href.match(/^(?:\.\/)?([a-z0-9-]+)\.html$/i);
  if (sibling) return `/articles/${sibling[1]}`;
  // Parent-relative: "../startup-ideas.html", "../ideas/saas/", "../index.html"
  let out = href.replace(/^\.\.\//, '/');
  out = out.replace(/\.html$/i, '');
  if (out !== '/') out = out.replace(/\/$/, '');
  if (out === '/index') out = '/';
  return out;
}

/** Decorative single-glyph spans (arrow bullets like ➔) carry no content. */
const GLYPH_ONLY = /^[\u2012-\u2015\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF•·]$/;

const isBadgeSpan = (el) =>
  /\bfont-mono\b/.test(cls(el)) || /\buppercase\b/.test(cls(el));

/**
 * Article-specific DOM rewrites so the generic walker produces clean
 * markdown (see file header).
 */
function preprocess($, body) {
  // Prompt/command boxes are div.font-mono on article pages → fence as <pre>.
  $(body).find('div.font-mono').each((_, el) => {
    el.tagName = 'pre';
  });

  // Decorative arrow-glyph spans; emphasized spans → <strong>.
  $(body).find('span').each((_, el) => {
    const text = collapse($(el).text()).trim();
    if (GLYPH_ONLY.test(text)) { $(el).remove(); return; }
    // Legacy inline emphasis: <span class="text-white font-medium">…</span>
    if (/\bfont-(medium|semibold|bold)\b/.test(cls(el)) && !/\bfont-mono\b/.test(cls(el))) {
      el.tagName = 'strong';
    }
  });

  // Heading rows: <div class="flex …"><span>BADGE</span><h2|h3>Title</h2|h3></div>
  $(body).find('div').each((_, el) => {
    const kids = el.children.filter((c) => c.type === 'tag');
    if (kids.length !== 2) return;
    const [first, second] = kids;
    if (first.tagName !== 'span' || !/^h[2-4]$/.test(second.tagName)) return;
    const badge = collapse($(first).text()).trim();
    if (!badge) { $(first).remove(); return; }
    if (/^\d{1,2}$/.test(badge)) {
      // Step-number circle ("01") — drop it.
      $(first).remove();
      return;
    }
    if (isBadgeSpan(first)) {
      // Time/label badge ("7:00 PM") — fold into the heading.
      const title = collapse($(second).text()).trim();
      $(second).text(`${badge} — ${title}`);
      $(first).remove();
    }
  });

  // Flat "card" boxes (pricing rows, weekend-flow steps): bordered rounded
  // divs with only spans/paragraphs inside. The walker renders grid children
  // via renderCardItem (`**Title** (Label) — description`), so mark
  // containers of cards as grids and wrap standalone cards in one.
  const isCardBox = (el) =>
    el.type === 'tag' &&
    el.tagName === 'div' &&
    /\brounded-(xl|2xl)\b/.test(cls(el)) &&
    /\bborder\b/.test(cls(el)) &&
    $(el).find('h1,h2,h3,h4,h5,h6,ul,ol,table,pre,blockquote').length === 0 &&
    collapse($(el).text()).trim() !== '';

  // Pass 1: containers whose element children are all card boxes → grid.
  $(body).find('div').each((_, el) => {
    if (/\bgrid\b/.test(cls(el))) return;
    const kids = el.children.filter((c) => c.type === 'tag');
    if (kids.length >= 2 && kids.every(isCardBox)) {
      el.attribs.class = `${cls(el)} grid`.trim();
    }
  });

  // Pass 2: standalone card boxes → wrap in a synthetic grid.
  $(body).find('div').each((_, el) => {
    if (!isCardBox(el)) return;
    const parent = el.parent;
    if (parent && parent.type === 'tag' && /\bgrid\b/.test(cls(parent))) return;
    $(el).wrap('<div class="grid"></div>');
  });
}

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

function fmString(key, value) {
  return value === undefined || value === null
    ? null
    : `${key}: ${JSON.stringify(value)}`;
}

function buildDocument(meta, sectionsMarkdown) {
  const fm = [
    '---',
    fmString('slug', meta.slug),
    fmString('title', meta.title),
    fmString('description', meta.description),
    meta.category ? fmString('category', meta.category) : null,
    meta.publishedAt ? fmString('publishedAt', meta.publishedAt) : null,
    meta.wordCount !== undefined ? `wordCount: ${meta.wordCount}` : null,
    meta.readMinutes !== undefined ? `readMinutes: ${meta.readMinutes}` : null,
    meta.heroAlt ? fmString('heroAlt', meta.heroAlt) : null,
    '---',
  ].filter(Boolean).join('\n');
  return `${fm}\n\n${sectionsMarkdown}\n`;
}

function extractArticle(article) {
  const filePath = path.join(articlesDir, `${article.slug}.html`);
  if (!fs.existsSync(filePath)) {
    return { slug: article.slug, status: 'skipped-no-html' };
  }
  const $ = cheerio.load(fs.readFileSync(filePath, 'utf8'));

  const publishedAt = extractDatePublished($);
  const category =
    collapse(
      $('article header span').filter((_, el) => /\buppercase\b/.test(cls(el))).first().text(),
    ).trim() || null;
  const heroAlt = $('article figure img').first().attr('alt') || null;

  const wrapper = $('article').first().children('div').first();
  if (!wrapper.length) return { slug: article.slug, status: 'failed-no-container' };

  preprocess($, wrapper[0]);

  const blocks = [];
  let skippedCtas = 0;
  for (const child of wrapper[0].children) {
    if (child.type !== 'tag' || child.tagName !== 'section') continue;
    if (/\btext-center\b/.test(cls(child))) { skippedCtas += 1; continue; } // CTA chrome
    renderBlocks($, child, blocks);
  }

  // Defensive: drop stray numeric-badge blocks the heading merge missed.
  const clean = blocks.filter((b) => b.trim() && !/^\*{0,2}\d{1,2}\*{0,2}$/.test(b.trim()));

  const doc = buildDocument(
    {
      slug: article.slug,
      title: article.title,
      description: article.description,
      category,
      publishedAt,
      wordCount: article.wordCount,
      readMinutes: article.readMinutes,
      heroAlt,
    },
    clean.join('\n\n'),
  );

  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${article.slug}.mdx`);
  fs.writeFileSync(out, doc);
  return {
    slug: article.slug,
    status: 'ok',
    out: path.relative(root, out),
    blocks: clean.length,
    headings: clean.filter((b) => /^##/.test(b)).length,
    fences: clean.filter((b) => b.startsWith('```')).length,
    publishedAt,
    category,
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
  setHrefRewriter(articleHrefRewriter);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(articlesDir, 'manifest.json'), 'utf8'),
  );
  const targets = onlySlug
    ? manifest.articles.filter((a) => a.slug === onlySlug)
    : manifest.articles;
  if (onlySlug && !targets.length) {
    console.error(`slug not found in articles/manifest.json: ${onlySlug}`);
    process.exit(1);
  }

  const results = targets.map(extractArticle);
  const failures = await compileCheck(results);

  if (onlySlug) {
    console.log(results[0]?.doc ?? '');
  } else {
    const report = {
      generatedAt: new Date().toISOString(),
      ok: results
        .filter((r) => r.status === 'ok')
        .map(({ doc: _doc, ...r }) => r),
      skipped: results.filter((r) => r.status !== 'ok'),
      compileFailures: failures,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  const ok = results.filter((r) => r.status === 'ok');
  console.log(`extract-articles-to-mdx: ${targets.length} articles`);
  console.log(`  ok:      ${ok.length} → content/articles/*.mdx`);
  console.log(`  missing date: ${ok.filter((r) => !r.publishedAt).length}`);
  console.log(`  skipped: ${results.length - ok.length}`);
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
