#!/usr/bin/env node
/**
 * Lists HTML files that do not reference styles.css (by path substring).
 * Run: node scripts/report-missing-stylesheets.js
 */
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const root = path.join(__dirname, '..');

async function main() {
  const files = await glob('**/*.html', {
    cwd: root,
    ignore: ['node_modules/**'],
    nodir: true,
  });

  const missing = [];
  for (const rel of files.sort()) {
    const full = path.join(root, rel);
    const html = fs.readFileSync(full, 'utf8');
    if (!html.includes('styles.css')) {
      missing.push(rel);
    }
  }

  if (missing.length === 0) {
    console.log('OK: all HTML files reference styles.css');
    process.exit(0);
  }

  console.warn(`Missing styles.css link (${missing.length} files):`);
  for (const f of missing) console.warn(`  ${f}`);
  if (process.env.STRICT === '1') {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
