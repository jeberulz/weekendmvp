#!/usr/bin/env node
/**
 * Canonical mega-menu nav: partials/nav-mega.html → HTML pages.
 *
 * Bootstrap partial from index.html:
 *   node scripts/sync-nav.js --bootstrap
 *
 * Apply nav to all target pages:
 *   node scripts/sync-nav.js --write
 *
 * CI check (exit 1 when STRICT=1 and drift):
 *   npm run check:nav
 */
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const root = path.resolve(__dirname, '..');
const partialPath = path.join(root, 'partials/nav-mega.html');
const NAV_START = '<!-- wmvp:nav:start -->';
const NAV_END = '<!-- wmvp:nav:end -->';

/** @type {{ glob: string; prefix: string }[]} */
const NAV_TARGETS = [
  { glob: 'index.html', prefix: '' },
  { glob: 'startup-ideas.html', prefix: '' },
  { glob: 'articles.html', prefix: '' },
  { glob: 'privacy-policy.html', prefix: '' },
  { glob: 'newsletter.html', prefix: '' },
  { glob: 'newsletter/*.html', prefix: '../' },
  { glob: 'articles/*.html', prefix: '../' },
  { glob: 'build-with/*/index.html', prefix: '../../' },
  { glob: 'solve/*/index.html', prefix: '../../' },
  { glob: 'ideas-for/*/index.html', prefix: '../../' },
  { glob: 'ideas/*/index.html', prefix: '../../' },
  { glob: 'ideas/_template-*.html', prefix: '../../' },
];

const NAV_BOUNDARY =
  '(?=<!-- Main Content -->|<!-- Hero Section -->|<!-- Hero -->|<!-- Hero for|<!-- Email Gate Section|<!-- Article Content -->|<!-- Privacy Policy Content -->|<main class="relative|<article class="relative|<article data-nl-slot)';

const LEGACY_NAV_RE = new RegExp(`<!-- Navigation -->[\\s\\S]*?${NAV_BOUNDARY}`);
const UNCOMMENTED_NAV_RE = new RegExp(
  `<div class="fixed top-6 left-0 right-0 z-50[\\s\\S]*?${NAV_BOUNDARY}`
);

/** @type {Record<string, 'newsletter' | 'articles'>} */
const NAV_ACTIVE_BY_GLOB = {
  'newsletter.html': 'newsletter',
  'newsletter/*.html': 'newsletter',
  'articles.html': 'articles',
  'articles/*.html': 'articles',
};
const MARKED_NAV_RE = /<!-- wmvp:nav:start -->[\s\S]*?<!-- wmvp:nav:end -->\n*/;
const INLINE_MOBILE_MENU_RE =
  /\n\s*\/\/ Mobile Menu(?: Toggle)?\n\s*\(function initMobileMenu\(\) \{[\s\S]*?\}\)\(\);\n/;

function prefixHref(html, prefix) {
  return html.replace(
    /href="(?!https?:|\/\/|#|mailto:|tel:)([^"]*)"/g,
    (_, href) => `href="${prefix}${href}"`
  );
}

function renderNav(prefix, active) {
  const template = fs.readFileSync(partialPath, 'utf8').trim();
  const html = `${NAV_START}\n${prefixHref(template, prefix)}\n${NAV_END}\n\n`;
  return applyNavActive(html, active);
}

function applyNavActive(html, active) {
  if (!active) return html;

  if (active === 'newsletter') {
    html = html.replace(
      /<a href="([^"]*)newsletter\.html" class="hover:text-white transition-colors">Newsletter<\/a>/,
      '<a href="$1newsletter.html" class="text-white" aria-current="page">Newsletter</a>'
    );
    html = html.replace(
      /<a href="([^"]*)newsletter\.html" class="block px-4 py-3 text-neutral-400 hover:text-white hover:bg-white\/5 rounded-lg transition-colors">Newsletter<\/a>/,
      '<a href="$1newsletter.html" class="block px-4 py-3 text-white bg-white/5 rounded-lg transition-colors" aria-current="page">Newsletter</a>'
    );
  }

  if (active === 'articles') {
    html = html.replace(
      /<a href="([^"]*)articles\.html" class="hover:text-white transition-colors">Articles<\/a>/,
      '<a href="$1articles.html" class="text-white" aria-current="page">Articles</a>'
    );
    html = html.replace(
      /<a href="([^"]*)articles\.html" class="block px-4 py-3 text-neutral-400 hover:text-white hover:bg-white\/5 rounded-lg transition-colors">Articles<\/a>/,
      '<a href="$1articles.html" class="block px-4 py-3 text-white bg-white/5 rounded-lg transition-colors" aria-current="page">Articles</a>'
    );
  }

  return html;
}

function extractNavFromIndex() {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = index.match(LEGACY_NAV_RE);
  if (!match) {
    throw new Error('Could not extract nav block from index.html');
  }
  return match[0].trim();
}

function bootstrapPartial() {
  fs.mkdirSync(path.dirname(partialPath), { recursive: true });
  fs.writeFileSync(partialPath, `${extractNavFromIndex()}\n`);
  console.log(`Wrote ${path.relative(root, partialPath)}`);
}

function scriptsTag(prefix) {
  return `<script src="${prefix}scripts.js"></script>`;
}

function stripInlineMobileMenu(content) {
  return content.replace(INLINE_MOBILE_MENU_RE, '\n');
}

function ensureScriptsJs(content, prefix) {
  let updated = stripInlineMobileMenu(content);
  if (updated.includes('scripts.js')) {
    return updated;
  }

  const tag = scriptsTag(prefix);
  if (!updated.includes('</body>')) {
    throw new Error('Missing </body>');
  }
  return updated.replace('</body>', `    ${tag}\n</body>`);
}

function replaceNavBlock(content, newNav) {
  if (content.includes(NAV_START)) {
    return content.replace(MARKED_NAV_RE, newNav);
  }
  if (LEGACY_NAV_RE.test(content)) {
    return content.replace(LEGACY_NAV_RE, newNav);
  }
  if (UNCOMMENTED_NAV_RE.test(content)) {
    return content.replace(UNCOMMENTED_NAV_RE, newNav);
  }
  throw new Error('No nav block found');
}

function extractCurrentNav(content) {
  const marked = content.match(MARKED_NAV_RE);
  if (marked) return marked[0];
  const legacy = content.match(LEGACY_NAV_RE);
  if (legacy) return legacy[0];
  const uncommented = content.match(UNCOMMENTED_NAV_RE);
  if (uncommented) return uncommented[0];
  return '';
}

function normalizeNav(html) {
  return html.replace(/\s+/g, ' ').trim();
}

function hasMegaNav(content) {
  return content.includes('nav-dropdown relative');
}

async function collectTargetFiles() {
  const seen = new Set();
  const files = [];

  for (const { glob: pattern } of NAV_TARGETS) {
    const matches = await glob(pattern, {
      cwd: root,
      nodir: true,
      ignore: ['**/node_modules/**'],
    });
    for (const rel of matches) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      const content = fs.readFileSync(path.join(root, rel), 'utf8');
      if (!isNavTarget(content)) {
        continue;
      }
      files.push(rel);
    }
  }

  return files;
}

async function resolvePrefix(rel) {
  for (const target of NAV_TARGETS) {
    const matches = await glob(target.glob, { cwd: root, nodir: true });
    if (matches.includes(rel)) {
      return target.prefix;
    }
  }
  const depth = rel.split('/').length - 1;
  if (depth === 0) return '';
  if (depth === 1) return '../';
  return '../../';
}

async function resolveNavActive(rel) {
  for (const [pattern, active] of Object.entries(NAV_ACTIVE_BY_GLOB)) {
    const matches = await glob(pattern, { cwd: root, nodir: true });
    if (matches.includes(rel)) {
      return active;
    }
  }
  return null;
}

function isNavTarget(content) {
  return (
    hasMegaNav(content) ||
    LEGACY_NAV_RE.test(content) ||
    UNCOMMENTED_NAV_RE.test(content) ||
    content.includes(NAV_START)
  );
}

async function main() {
  if (process.argv.includes('--bootstrap')) {
    bootstrapPartial();
    return;
  }

  if (!fs.existsSync(partialPath)) {
    bootstrapPartial();
  }

  const write = process.argv.includes('--write');
  const strict = process.env.STRICT === '1';
  const issues = [];
  const files = await collectTargetFiles();

  for (const rel of files) {
    const filePath = path.join(root, rel);
    const prefix = await resolvePrefix(rel);
    const active = await resolveNavActive(rel);
    const expectedNav = renderNav(prefix, active);
    let content = fs.readFileSync(filePath, 'utf8');

    try {
      if (write) {
        content = replaceNavBlock(content, expectedNav);
        if (hasMegaNav(content) || content.includes(NAV_START)) {
          content = ensureScriptsJs(content, prefix);
        }
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${rel}`);
        continue;
      }

      const current = extractCurrentNav(content);

      if (normalizeNav(current) !== normalizeNav(expectedNav.trim())) {
        issues.push({ file: rel, reason: 'nav drift (run: node scripts/sync-nav.js --write)' });
      }

      if (content.includes('nav-dropdown') && !content.includes('scripts.js')) {
        issues.push({ file: rel, reason: 'missing scripts.js' });
      }
    } catch (error) {
      issues.push({ file: rel, reason: error.message });
    }
  }

  if (issues.length) {
    console.error(`Nav check: ${issues.length} issue(s)`);
    for (const issue of issues) {
      console.error(`  ${issue.file}: ${issue.reason}`);
    }
    if (strict) process.exit(1);
    return;
  }

  console.log(write ? `Nav sync complete (${files.length} files).` : `Nav check passed (${files.length} files).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
