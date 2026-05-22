#!/usr/bin/env node
/**
 * Lightweight reading nav for newsletter issue pages (Phase 5).
 *
 *   node scripts/sync-reading-nav.js --write
 *   STRICT=1 npm run check:reading-nav
 */
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const root = path.resolve(__dirname, '..');
const partialPath = path.join(root, 'partials/nav-reading.html');
const NAV_START = '<!-- wmvp:reading-nav:start -->';
const NAV_END = '<!-- wmvp:reading-nav:end -->';
const MARKED_NAV_RE = /<!-- wmvp:reading-nav:start -->[\s\S]*?<!-- wmvp:reading-nav:end -->\n?/;
const LEGACY_MEGA_NAV_RE = /<!-- wmvp:nav:start -->[\s\S]*?<!-- wmvp:nav:end -->\n?/;

function renderNav() {
  let html = fs.readFileSync(partialPath, 'utf8').trim();
  html = html.replace(
    /<a href="\.\.\/newsletter\.html" class="([^"]*)">Newsletter<\/a>/,
    '<a href="../newsletter.html" class="text-white whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-white/40 rounded px-1" aria-current="page">Newsletter</a>'
  );
  return `${NAV_START}\n${html}\n${NAV_END}\n\n`;
}

function replaceNavBlock(content, newNav) {
  if (content.includes(NAV_START)) {
    return content.replace(MARKED_NAV_RE, newNav);
  }
  if (LEGACY_MEGA_NAV_RE.test(content)) {
    return content.replace(LEGACY_MEGA_NAV_RE, newNav);
  }
  throw new Error('No reading nav block found');
}

function extractNav(content) {
  const marked = content.match(MARKED_NAV_RE);
  if (marked) return marked[0];
  const legacy = content.match(LEGACY_MEGA_NAV_RE);
  if (legacy) return legacy[0];
  return '';
}

function normalizeNav(html) {
  return html.replace(/\s+/g, ' ').trim();
}

function adjustArticleOffset(content) {
  return content.replace(
    /(<article data-nl-slot="[^"]*" class="relative z-10 )pt-32( pb-24">)/,
    '$1pt-20$2'
  );
}

async function main() {
  const write = process.argv.includes('--write');
  const strict = process.env.STRICT === '1';
  const issues = [];
  const expectedNav = renderNav();
  const files = await glob('newsletter/*.html', {
    cwd: root,
    nodir: true,
    ignore: ['**/node_modules/**'],
  });

  for (const rel of files.sort()) {
    const filePath = path.join(root, rel);
    let content = fs.readFileSync(filePath, 'utf8');

    try {
      if (write) {
        content = replaceNavBlock(content, expectedNav);
        content = adjustArticleOffset(content);
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${rel}`);
        continue;
      }

      const current = extractNav(content);
      if (normalizeNav(current) !== normalizeNav(expectedNav.trim())) {
        issues.push({ file: rel, reason: 'reading nav drift (run: node scripts/sync-reading-nav.js --write)' });
      }

      if (!content.includes('pt-20 pb-24')) {
        issues.push({ file: rel, reason: 'article offset not adjusted for reading nav' });
      }
    } catch (error) {
      issues.push({ file: rel, reason: error.message });
    }
  }

  if (issues.length) {
    console.error(`Reading nav check: ${issues.length} issue(s)`);
    for (const issue of issues) {
      console.error(`  ${issue.file}: ${issue.reason}`);
    }
    if (strict) process.exit(1);
    return;
  }

  console.log(
    write
      ? `Reading nav sync complete (${files.length} files).`
      : `Reading nav check passed (${files.length} files).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
