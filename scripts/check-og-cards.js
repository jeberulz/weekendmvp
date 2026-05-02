#!/usr/bin/env node
/**
 * Asserts every idea in ideas/manifest.json has a corresponding OG PNG on
 * disk at image/og/idea/{slug}.png.
 *
 * Default: warn-only, exit 0.
 * STRICT=1: exit 1 if any are missing. Used in CI gates.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const manifestPath = path.join(root, 'ideas/manifest.json');
const ogDir = path.join(root, 'image/og/idea');
const strict = process.env.STRICT === '1';

if (!fs.existsSync(manifestPath)) {
  console.log(`No manifest at ${manifestPath} — nothing to check.`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const missing = [];

for (const idea of manifest.ideas ?? []) {
  const png = path.join(ogDir, `${idea.slug}.png`);
  if (!fs.existsSync(png)) missing.push(idea.slug);
}

if (missing.length === 0) {
  console.log(`og-cards: all ${manifest.ideas.length} ideas have OG cards`);
  process.exit(0);
}

console.log(`og-cards: ${missing.length} missing`);
for (const s of missing) console.log(`  - ${s}`);
console.log(`run: npm run og:generate`);

process.exit(strict ? 1 : 0);
