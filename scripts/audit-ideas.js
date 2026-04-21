#!/usr/bin/env node
/**
 * Audits every HTML page in ideas/ against the section contract and splits the
 * manifest into passing ideas (manifest.json) and quarantined ideas (manifest.draft.json).
 *
 * Usage:
 *   node scripts/audit-ideas.js                  # report only, writes ideas/_audit.json
 *   node scripts/audit-ideas.js --apply          # also rewrites manifest.json + manifest.draft.json + sitemap.xml
 *   node scripts/audit-ideas.js --strict         # exit non-zero if any idea in manifest.json fails the PASS bar
 *   node scripts/audit-ideas.js --file <slug>    # audit one page; pairs with --strict for pre-publish gating
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const root = path.resolve(__dirname, '..');
const ideasDir = path.join(root, 'ideas');
const manifestPath = path.join(ideasDir, 'manifest.json');
const draftManifestPath = path.join(ideasDir, 'manifest.draft.json');
const auditPath = path.join(ideasDir, '_audit.json');
const sitemapPath = path.join(root, 'sitemap.xml');

const apply = process.argv.includes('--apply');
const strict = process.argv.includes('--strict');
const fileFlagIdx = process.argv.indexOf('--file');
const singleSlug = fileFlagIdx !== -1 ? process.argv[fileFlagIdx + 1] : null;

const REQUIRED_SECTIONS = [
  { key: 'problem',     match: /\bproblem\b/i },
  { key: 'solution',    match: /\bsolution\b/i },
  { key: 'market',      match: /market\s*(research|insight|size|opportunity)/i },
  { key: 'competitive', match: /competit(or|ive|ors)/i },
  { key: 'business',    match: /(business\s*model|monetization|pricing|revenue)/i },
  { key: 'stack',       match: /(tech\s*stack|recommended\s*stack|technology\s*stack)/i },
  { key: 'prompts',     match: /(ai\s*prompts|prompts\s*to\s*build)/i },
];

// A page is considered PASS when it has all required sections AND is at least this big.
const MIN_PASS_BYTES = 15_000;
const MIN_PASS_WORDS = 800;

// Phase 1 policy: only STUB pages are quarantined out of the live manifest.
// THIN pages stay visible but are flagged in ideas/_audit.json for Phase 4 backfill.
// Tighten this to ['STUB', 'THIN'] once the THIN tier is backfilled.
const QUARANTINE_STATUSES = new Set(['STUB']);

function auditFile(slug) {
  const filePath = path.join(ideasDir, `${slug}.html`);
  if (!fs.existsSync(filePath)) {
    return { slug, status: 'MISSING', reasons: [`file not found: ideas/${slug}.html`] };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const bytes = Buffer.byteLength(raw, 'utf8');
  const $ = cheerio.load(raw);

  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();
  const ogDescription = ($('meta[property="og:description"]').attr('content') || '').trim();
  const description = metaDescription || ogDescription || '';

  const h2Texts = $('h2').map((_, el) => $(el).text().trim()).get();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').length : 0;

  const sections = {};
  const missing = [];
  for (const sec of REQUIRED_SECTIONS) {
    const present = h2Texts.some(t => sec.match.test(t));
    sections[sec.key] = present;
    if (!present) missing.push(sec.key);
  }

  const hasPlaceholderLeak = /\{\{\s*[A-Z_]+\s*\}\}/.test(raw) || /\bIDEA_(TITLE|SLUG|DESCRIPTION)\b/.test(raw);

  const reasons = [];
  if (bytes < MIN_PASS_BYTES) reasons.push(`size ${bytes}B < ${MIN_PASS_BYTES}B`);
  if (wordCount < MIN_PASS_WORDS) reasons.push(`wordCount ${wordCount} < ${MIN_PASS_WORDS}`);
  if (missing.length) reasons.push(`missing sections: ${missing.join(', ')}`);
  if (hasPlaceholderLeak) reasons.push('unreplaced placeholders present');

  let status;
  if (bytes < 5_000 || h2Texts.length === 0) status = 'STUB';
  else if (reasons.length === 0) status = 'PASS';
  else status = 'THIN';

  return {
    slug,
    status,
    bytes,
    wordCount,
    h2Count: h2Texts.length,
    description,
    sections,
    missingSections: missing,
    hasPlaceholderLeak,
    reasons,
  };
}

function rewriteSitemap(passingSlugs) {
  if (!fs.existsSync(sitemapPath)) return { removed: 0 };
  let xml = fs.readFileSync(sitemapPath, 'utf8');
  const passing = new Set(passingSlugs);
  // Match each <url>...</url> block that references ideas/{slug}.html.
  const urlBlockRe = /\s*<url>[\s\S]*?<\/url>/g;
  let removed = 0;
  xml = xml.replace(urlBlockRe, (block) => {
    const m = block.match(/ideas\/([^/"<]+)\.html<\/loc>/);
    if (!m) return block;
    const slug = m[1];
    if (passing.has(slug)) return block;
    removed += 1;
    return '';
  });
  fs.writeFileSync(sitemapPath, xml);
  return { removed };
}

function main() {
  if (singleSlug) {
    const audit = auditFile(singleSlug);
    console.log(JSON.stringify(audit, null, 2));
    if (strict && audit.status !== 'PASS') process.exit(1);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const existingDrafts = fs.existsSync(draftManifestPath)
    ? JSON.parse(fs.readFileSync(draftManifestPath, 'utf8'))
    : { ideas: [] };

  const report = { generatedAt: new Date().toISOString(), totals: {}, ideas: [] };
  const passing = [];
  const failing = [];

  for (const idea of manifest.ideas) {
    const audit = auditFile(idea.slug);
    report.ideas.push(audit);
    if (QUARANTINE_STATUSES.has(audit.status)) {
      failing.push({ ...idea, _auditStatus: audit.status, _auditReasons: audit.reasons });
    } else {
      const enriched = { ...idea };
      if (!enriched.description && audit.description) enriched.description = audit.description;
      if (audit.status === 'THIN') enriched._needsBackfill = true;
      passing.push(enriched);
    }
  }

  const totals = report.ideas.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});
  report.totals = totals;
  report.totals.total = report.ideas.length;
  report.totals.passing = passing.length;
  report.totals.failing = failing.length;

  fs.writeFileSync(auditPath, JSON.stringify(report, null, 2));
  console.log(`Audit written: ${path.relative(root, auditPath)}`);
  console.log(`  total: ${report.totals.total}  pass: ${passing.length}  thin: ${totals.THIN || 0}  stub: ${totals.STUB || 0}`);

  if (strict) {
    const failures = report.ideas.filter(i => i.status !== 'PASS');
    if (failures.length) {
      console.error(`\nSTRICT: ${failures.length} linked idea(s) fail the PASS bar:`);
      for (const f of failures) console.error(`  ${f.slug} [${f.status}] ${f.reasons.join('; ')}`);
      process.exit(1);
    }
    console.log('STRICT: all linked ideas PASS the bar.');
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to rewrite manifest.json, manifest.draft.json, and sitemap.xml.');
    return;
  }

  const draftManifest = {
    generatedAt: new Date().toISOString(),
    note: 'Quarantined ideas that did not pass ideas/_audit.json. Promote via scripts/audit-ideas.js --apply after repopulating content.',
    ideas: mergeDrafts(existingDrafts.ideas, failing),
  };
  fs.writeFileSync(draftManifestPath, JSON.stringify(draftManifest, null, 2));
  console.log(`Quarantined ${failing.length} ideas → ${path.relative(root, draftManifestPath)}`);

  const newManifest = { ...manifest, ideas: passing };
  fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2));
  console.log(`Manifest trimmed to ${passing.length} passing ideas → ${path.relative(root, manifestPath)}`);

  const { removed } = rewriteSitemap(passing.map(i => i.slug));
  console.log(`Sitemap cleaned: removed ${removed} quarantined idea URLs`);
}

function mergeDrafts(existing, incoming) {
  const bySlug = new Map();
  for (const d of existing) bySlug.set(d.slug, d);
  for (const d of incoming) bySlug.set(d.slug, d);
  return Array.from(bySlug.values());
}

try {
  main();
} catch (err) {
  console.error('audit-ideas.js failed:', err);
  process.exit(1);
}
