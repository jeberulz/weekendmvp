#!/usr/bin/env node
/**
 * Asserts every entry in ideas/manifest.json AND articles/manifest.json has
 * a corresponding OG PNG on disk.
 *
 * Default: warn-only, exit 0.
 * STRICT=1: exit 1 if any are missing. Used in CI gates.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const strict = process.env.STRICT === '1';

const surfaces = [
  { name: 'idea', manifest: 'ideas/manifest.json', listKey: 'ideas', pngDir: 'image/og/idea' },
  { name: 'article', manifest: 'articles/manifest.json', listKey: 'articles', pngDir: 'image/og/article' },
  { name: 'newsletter', manifest: 'newsletter/manifest.json', listKey: 'newsletters', pngDir: 'image/og/newsletter' }
];

let totalChecked = 0;
let totalMissing = 0;

for (const s of surfaces) {
  const manifestPath = path.join(root, s.manifest);
  if (!fs.existsSync(manifestPath)) {
    console.log(`og-cards: no manifest at ${s.manifest} — skipping ${s.name} surface.`);
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const list = manifest[s.listKey] ?? [];
  totalChecked += list.length;

  const missing = [];
  for (const entry of list) {
    const png = path.join(root, s.pngDir, `${entry.slug}.png`);
    if (!fs.existsSync(png)) missing.push(entry.slug);
  }

  if (missing.length === 0) {
    console.log(`og-cards: all ${list.length} ${s.name} entries have OG cards`);
  } else {
    totalMissing += missing.length;
    console.log(`og-cards: ${missing.length} ${s.name} missing`);
    for (const slug of missing) console.log(`  - ${s.name}/${slug}`);
  }
}

if (totalMissing === 0) {
  console.log(`og-cards: ${totalChecked} total entries OK`);
  process.exit(0);
}

console.log(`og-cards: run \`npm run og:generate\` to fill the gaps`);
process.exit(strict ? 1 : 0);
