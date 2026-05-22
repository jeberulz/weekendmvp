#!/usr/bin/env node
/**
 * Site header + hub subnav for starter-kit.html (Phase 5).
 *
 *   node scripts/sync-starter-kit-nav.js --write
 *   STRICT=1 npm run check:starter-kit-nav
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targetPath = path.join(root, 'starter-kit.html');
const partialPath = path.join(root, 'partials/nav-starter-kit.html');
const NAV_START = '<!-- wmvp:starter-kit-nav:start -->';
const NAV_END = '<!-- wmvp:starter-kit-nav:end -->';
const MARKED_NAV_RE = /<!-- wmvp:starter-kit-nav:start -->[\s\S]*?<!-- wmvp:starter-kit-nav:end -->\n?/;

const LEGACY_MOBILE_HEADER_RE =
  /<!-- Mobile Header -->[\s\S]*?<\/div>\n\n\s*<!-- Mobile Sidebar Backdrop -->/;

function renderNav() {
  const template = fs.readFileSync(partialPath, 'utf8').trim();
  return `${NAV_START}\n${template}\n${NAV_END}\n\n`;
}

function replaceNavBlock(content, newNav) {
  if (content.includes(NAV_START)) {
    return content.replace(MARKED_NAV_RE, newNav);
  }
  if (LEGACY_MOBILE_HEADER_RE.test(content)) {
    return content.replace(LEGACY_MOBILE_HEADER_RE, `${newNav.trimEnd()}\n\n        <!-- Mobile Sidebar Backdrop -->`);
  }
  throw new Error('No starter-kit nav block found');
}

function extractNav(content) {
  const marked = content.match(MARKED_NAV_RE);
  if (marked) return marked[0];
  return '';
}

function normalizeNav(html) {
  return html.replace(/\s+/g, ' ').trim();
}

function applyLayoutFixes(content) {
  let updated = content;
  updated = updated.replace(
    /<div class="flex flex-col lg:flex-row gap-12 pt-24 lg:pt-24 pb-32">/,
    '<div class="flex flex-col lg:flex-row gap-12 pt-[7.5rem] lg:pt-28 pb-32">'
  );
  updated = updated.replace(
    /lg:sticky lg:top-12 lg:flex-shrink-0/g,
    'lg:sticky lg:top-[7.5rem] lg:flex-shrink-0'
  );
  updated = updated.replace(/scroll-mt-32 lg:scroll-mt-12/g, 'scroll-mt-[7.5rem] lg:scroll-mt-12');
  updated = updated.replace(
    /<div class="flex items-center justify-between mb-12 lg:mb-12">\s*\n\s*<a href="index\.html">[\s\S]*?<\/button>\s*\n\s*<\/div>/,
    `<div class="flex items-center justify-end mb-8 lg:hidden">
                    <button id="mobile-menu-close" class="text-neutral-400 hover:text-black transition-colors" aria-label="Close menu">
                        <iconify-icon icon="lucide:x" width="24" aria-hidden="true"></iconify-icon>
                    </button>
                </div>`
  );
  updated = updated.replace(
    /<button id="mobile-menu-open" class="text-black p-2 -mr-2">\s*\n\s*<iconify-icon icon="lucide:menu" width="24"><\/iconify-icon>\s*\n\s*<\/button>/,
    ''
  );
  updated = updated.replace(
    /<button id="mobile-menu-close" class="lg:hidden text-neutral-400 hover:text-black transition-colors">\s*\n\s*<iconify-icon icon="lucide:x" width="24"><\/iconify-icon>\s*\n\s*<\/button>/,
    `<button id="mobile-menu-close" class="lg:hidden text-neutral-400 hover:text-black transition-colors" aria-label="Close menu">
                        <iconify-icon icon="lucide:x" width="24" aria-hidden="true"></iconify-icon>
                    </button>`
  );
  return updated;
}

function main() {
  const write = process.argv.includes('--write');
  const strict = process.env.STRICT === '1';
  const expectedNav = renderNav();
  let content = fs.readFileSync(targetPath, 'utf8');

  try {
    if (write) {
      content = replaceNavBlock(content, expectedNav);
      content = applyLayoutFixes(content);
      fs.writeFileSync(targetPath, content);
      console.log('Updated starter-kit.html');
      return;
    }

    const current = extractNav(content);
    if (normalizeNav(current) !== normalizeNav(expectedNav.trim())) {
      console.error('Starter kit nav drift (run: node scripts/sync-starter-kit-nav.js --write)');
      if (strict) process.exit(1);
      return;
    }

    console.log('Starter kit nav check passed.');
  } catch (error) {
    console.error(error.message);
    if (strict) process.exit(1);
  }
}

main();
