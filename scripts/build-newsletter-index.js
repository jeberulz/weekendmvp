#!/usr/bin/env node
/**
 * build-newsletter-index.js
 *
 * Backfills ideas/manifest.json with a `summary` field per idea by extracting
 * the first paragraph under "The Problem" from each idea's HTML page.
 *
 * Run once (and after publishing new ideas) so the /newsletter skill can pick
 * an AM "Idea of the Day" without re-parsing HTML at draft time.
 *
 * Usage:  node scripts/build-newsletter-index.js
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'ideas', 'manifest.json');
const IDEAS_DIR = path.join(ROOT, 'ideas');
const MAX_SUMMARY_CHARS = 240;

function extractSummary(html) {
  const $ = cheerio.load(html);

  // Primary: heading that says "The Problem", followed by a <p>.
  let summary = null;
  $('h1, h2, h3').each((_, el) => {
    if (summary) return;
    const label = $(el).text().trim().toLowerCase();
    if (label === 'the problem' || label === 'problem') {
      const para = $(el).nextAll('p').first().text().trim();
      if (para) summary = para;
    }
  });

  // Fallbacks: meta description, then first <p>.
  if (!summary) {
    summary = $('meta[name="description"]').attr('content')?.trim() || null;
  }
  if (!summary) {
    summary = $('main p, article p').first().text().trim() || null;
  }

  if (!summary) return null;

  summary = summary.replace(/\s+/g, ' ').trim();
  if (summary.length > MAX_SUMMARY_CHARS) {
    const cut = summary.slice(0, MAX_SUMMARY_CHARS);
    const lastPeriod = cut.lastIndexOf('.');
    summary = (lastPeriod > 120 ? cut.slice(0, lastPeriod + 1) : cut.trim() + '…');
  }
  return summary;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const ideas = manifest.ideas || [];

  let updated = 0;
  let missing = 0;
  const missingSlugs = [];

  for (const idea of ideas) {
    const htmlPath = path.join(IDEAS_DIR, `${idea.slug}.html`);
    if (!fs.existsSync(htmlPath)) {
      missing++;
      missingSlugs.push(idea.slug);
      continue;
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const summary = extractSummary(html);
    if (!summary) {
      missing++;
      missingSlugs.push(idea.slug);
      continue;
    }
    if (idea.summary !== summary) {
      idea.summary = summary;
      updated++;
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`ideas: ${ideas.length}`);
  console.log(`summaries updated: ${updated}`);
  console.log(`summaries unchanged: ${ideas.length - updated - missing}`);
  if (missing > 0) {
    console.log(`\nno summary extracted for ${missing} idea(s):`);
    for (const slug of missingSlugs) console.log(`  - ${slug}`);
    console.log('\ninvestigate by reading the HTML — the "The Problem" heading may be missing or labeled differently.');
  }
}

main();
