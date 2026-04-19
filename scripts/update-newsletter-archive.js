#!/usr/bin/env node
/**
 * update-newsletter-archive.js
 *
 * Regenerates the newsletter archive feed at newsletter.html:
 *   1. Card grid between <!-- newsletter-cards-start --> / <!-- newsletter-cards-end --> markers
 *   2. JSON-LD ItemList (numberOfItems + itemListElement)
 *
 * Reads every file in newsletter/*.html, parses its JSON-LD Article schema
 * to extract headline, description, datePublished, and URL path, plus a
 * `data-nl-slot` attribute (am|pm) that dated pages include in their <article>.
 *
 * Idempotent — safe to run before every commit. Marker-driven, doesn't
 * disturb anything outside the card grid.
 *
 * Usage:  node scripts/update-newsletter-archive.js
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const NEWSLETTER_DIR = path.join(ROOT, 'newsletter');
const FEED_PATH = path.join(ROOT, 'newsletter.html');
const SITE_ORIGIN = 'https://weekendmvp.app';
const GRID_START = '<!-- newsletter-cards-start -->';
const GRID_END = '<!-- newsletter-cards-end -->';

function escapeHtmlAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateLabel(iso) {
  // "2026-04-20" → "Apr 20, 2026"
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function parseSend(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html);

  // Extract Article schema
  let article = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (article) return;
    try {
      const data = JSON.parse($(el).html());
      const pick = (obj) => {
        if (!obj) return null;
        if (obj['@type'] === 'Article') return obj;
        if (Array.isArray(obj['@graph'])) {
          for (const node of obj['@graph']) {
            if (node && node['@type'] === 'Article') return node;
          }
        }
        return null;
      };
      article = pick(data);
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  if (!article) {
    throw new Error(`No Article JSON-LD found in ${path.basename(filePath)}`);
  }

  const headline = article.headline || $('h1').first().text().trim();
  const description =
    article.description ||
    $('meta[name="description"]').attr('content') ||
    '';
  const datePublished = article.datePublished;
  if (!datePublished) {
    throw new Error(`Article in ${path.basename(filePath)} missing datePublished`);
  }

  const slot =
    $('article[data-nl-slot]').attr('data-nl-slot') ||
    $('body[data-nl-slot]').attr('data-nl-slot') ||
    (path.basename(filePath).includes('-am.') ? 'am' : 'pm');

  const slug = path.basename(filePath, '.html');

  return {
    slug,
    url: `/newsletter/${slug}.html`,
    absoluteUrl: `${SITE_ORIGIN}/newsletter/${slug}.html`,
    headline,
    description,
    datePublished,
    slot: slot === 'am' ? 'am' : 'pm',
  };
}

function renderCard(send) {
  const slotLabel = send.slot === 'am' ? 'AM · Idea of the Day' : 'PM · Builder Brief';
  const slotClass =
    send.slot === 'am'
      ? 'bg-[#CC5500]/10 border-[#CC5500]/30 text-[#CC5500]'
      : 'bg-white/5 border-white/10 text-neutral-300';
  return `                <a href="${escapeHtmlAttr(send.url)}"
                   data-nl-card
                   data-nl-slot="${escapeHtmlAttr(send.slot)}"
                   data-nl-date="${escapeHtmlAttr(send.datePublished)}"
                   class="nl-card group block p-6 bg-[#0A0A0A] border border-white/[0.06] rounded-2xl hover:border-white/20 transition-all">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <span class="px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${slotClass}">${escapeHtmlText(slotLabel)}</span>
                        <time class="text-[11px] font-mono text-neutral-500" datetime="${escapeHtmlAttr(send.datePublished)}">${escapeHtmlText(formatDateLabel(send.datePublished))}</time>
                    </div>
                    <h3 class="text-lg font-medium text-white mb-2 leading-snug group-hover:text-[#CC5500] transition-colors">${escapeHtmlText(send.headline)}</h3>
                    <p class="text-sm text-neutral-500 leading-relaxed line-clamp-2">${escapeHtmlText(send.description)}</p>
                    <div class="mt-4 flex items-center gap-2 text-xs text-neutral-600 group-hover:text-[#CC5500] transition-colors">
                        <span>Read</span>
                        <iconify-icon icon="lucide:arrow-right" width="14" aria-hidden="true"></iconify-icon>
                    </div>
                </a>`;
}

function buildItemListSchema(sends) {
  return sends.map((send, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Article',
      name: send.headline,
      url: send.absoluteUrl,
      datePublished: send.datePublished,
    },
  }));
}

function main() {
  if (!fs.existsSync(FEED_PATH)) {
    console.error(`❌ ${FEED_PATH} not found. Create newsletter.html first.`);
    process.exit(1);
  }
  if (!fs.existsSync(NEWSLETTER_DIR)) {
    fs.mkdirSync(NEWSLETTER_DIR, { recursive: true });
  }

  const files = fs
    .readdirSync(NEWSLETTER_DIR)
    .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
    .map((f) => path.join(NEWSLETTER_DIR, f));

  const sends = [];
  for (const f of files) {
    try {
      sends.push(parseSend(f));
    } catch (err) {
      console.warn(`⚠️  ${path.basename(f)}: ${err.message} — skipping`);
    }
  }

  // Sort: date DESC, then pm before am (PM is the "evening read", shown higher on same day)
  sends.sort((a, b) => {
    if (a.datePublished !== b.datePublished) {
      return a.datePublished < b.datePublished ? 1 : -1;
    }
    return a.slot === 'pm' ? -1 : 1;
  });

  let feed = fs.readFileSync(FEED_PATH, 'utf8');

  // Regenerate card grid
  const startIdx = feed.indexOf(GRID_START);
  const endIdx = feed.indexOf(GRID_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    console.error(`❌ newsletter.html is missing grid markers (${GRID_START} … ${GRID_END}).`);
    process.exit(1);
  }

  let cardsSection;
  if (sends.length === 0) {
    cardsSection = `${GRID_START}
                <!-- Cards are injected by scripts/update-newsletter-archive.js. Do not hand-edit. -->
                <div data-nl-empty class="md:col-span-2 p-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl text-center text-sm text-neutral-500">
                    No sends yet. The first newsletter goes out soon — subscribe above to get it in your inbox.
                </div>
                ${GRID_END}`;
  } else {
    cardsSection = `${GRID_START}
                <!-- Cards are injected by scripts/update-newsletter-archive.js. Do not hand-edit. -->
${sends.map(renderCard).join('\n')}
                ${GRID_END}`;
  }

  feed =
    feed.slice(0, startIdx) +
    cardsSection +
    feed.slice(endIdx + GRID_END.length);

  // Regenerate ItemList in JSON-LD
  feed = feed.replace(/"numberOfItems":\s*\d+/, `"numberOfItems": ${sends.length}`);
  const listItems = JSON.stringify(buildItemListSchema(sends), null, 14)
    .split('\n')
    .map((line, i) => (i === 0 ? line : '              ' + line))
    .join('\n');
  feed = feed.replace(
    /"itemListElement":\s*\[[\s\S]*?\n\s*\]/,
    `"itemListElement": ${listItems.trim()}`
  );

  fs.writeFileSync(FEED_PATH, feed);

  console.log(`✅ newsletter.html updated`);
  console.log(`   ${sends.length} send(s) in archive`);
  if (sends.length > 0) {
    const latest = sends[0];
    console.log(`   Latest: ${latest.datePublished} ${latest.slot.toUpperCase()} — ${latest.headline}`);
  }
}

main();
