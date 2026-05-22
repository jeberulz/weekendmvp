#!/usr/bin/env node
/**
 * Slim sticky subnav for idea detail pages (Phase 4A).
 *
 *   node scripts/sync-idea-nav.js --write
 *   STRICT=1 npm run check:idea-nav
 */
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const root = path.resolve(__dirname, '..');
const NAV_START = '<!-- wmvp:idea-nav:start -->';
const NAV_END = '<!-- wmvp:idea-nav:end -->';
const partialFull = path.join(root, 'partials/nav-idea.html');
const partialSimple = path.join(root, 'partials/nav-idea-simple.html');

const MARKED_NAV_RE = /<!-- wmvp:idea-nav:start -->[\s\S]*?<!-- wmvp:idea-nav:end -->\n?/;

const LEGACY_NAV_OPEN =
  '<div class="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 bg-[#fcfaf7]/80 backdrop-blur-md border-b border-neutral-200">';

function findLegacyNavBlock(content) {
  const commentIdx = content.indexOf('<!-- Navigation -->');
  const searchFrom = commentIdx === -1 ? 0 : commentIdx;
  const start = content.indexOf(LEGACY_NAV_OPEN, searchFrom);
  if (start === -1) return null;

  let depth = 0;
  let i = start;
  while (i < content.length) {
    if (content.startsWith('<div', i)) {
      depth += 1;
      i += 4;
      continue;
    }
    if (content.startsWith('</div>', i)) {
      depth -= 1;
      i += 6;
      if (depth === 0) {
        while (i < content.length && (content[i] === ' ' || content[i] === '\t' || content[i] === '\n' || content[i] === '\r')) {
          i += 1;
        }
        return content.slice(start, i);
      }
      continue;
    }
    i += 1;
  }
  return null;
}

function renderNav(useSidebar) {
  const file = useSidebar ? partialFull : partialSimple;
  const template = fs.readFileSync(file, 'utf8').trim();
  return `${NAV_START}\n${template}\n${NAV_END}\n\n`;
}

function replaceIdeaNav(content, newNav) {
  if (content.includes(NAV_START)) {
    return content.replace(MARKED_NAV_RE, newNav);
  }
  const legacy = findLegacyNavBlock(content);
  if (legacy) {
    return content.replace(legacy, newNav.trimEnd() + '\n\n');
  }
  throw new Error('No idea nav block found');
}

function extractIdeaNav(content) {
  const marked = content.match(MARKED_NAV_RE);
  if (marked) return marked[0];
  return findLegacyNavBlock(content) || '';
}

function normalizeNav(html) {
  return html.replace(/\s+/g, ' ').trim();
}

function hasSidebar(content) {
  return /<aside\b[^>]*\bid="sidebar"/.test(content);
}

function applyLayoutOffsets(content) {
  let updated = content;
  updated = updated.replace(
    /(id="email-gate"[^>]*class="[^"]*)\bpt-24\b/g,
    '$1pt-[7.5rem]'
  );
  updated = updated.replace(
    /(flex flex-col lg:flex-row gap-8 lg:gap-12 )\bpt-24\b/g,
    '$1pt-[7.5rem]'
  );
  updated = updated.replace(
    /(<div class=")\bpt-24 pb-16 px-6">/g,
    '$1pt-[7.5rem] pb-16 px-6">'
  );
  updated = updated.replace(/\blg:top-24\b/g, 'lg:top-[7.5rem]');
  updated = updated.replace(/\bscroll-mt-24\b/g, 'scroll-mt-[7.5rem]');
  return updated;
}

function isIdeaDetailPage(rel) {
  if (!rel.startsWith('ideas/')) return false;
  if (rel.includes('/index.html')) return false;
  if (path.basename(rel).startsWith('_template')) return false;
  return rel.endsWith('.html');
}

async function collectIdeaPages() {
  const matches = await glob('ideas/*.html', {
    cwd: root,
    nodir: true,
    ignore: ['**/node_modules/**'],
  });
  return matches.filter(isIdeaDetailPage);
}

async function main() {
  const write = process.argv.includes('--write');
  const strict = process.env.STRICT === '1';
  const issues = [];
  const files = await collectIdeaPages();

  for (const rel of files) {
    const filePath = path.join(root, rel);
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('bg-[#fcfaf7]') && !content.includes('fixed top-0')) {
      issues.push({ file: rel, reason: 'not a cream-header idea page' });
      continue;
    }

    const useSidebar = hasSidebar(content);
    const expectedNav = renderNav(useSidebar);

    try {
      if (write) {
        content = replaceIdeaNav(content, expectedNav);
        content = applyLayoutOffsets(content);
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${rel}`);
        continue;
      }

      const current = extractIdeaNav(content);
      if (normalizeNav(current) !== normalizeNav(expectedNav.trim())) {
        issues.push({ file: rel, reason: 'idea nav drift (run: node scripts/sync-idea-nav.js --write)' });
      }

      if (!content.includes('id="idea-site-header"')) {
        issues.push({ file: rel, reason: 'missing idea-site-header' });
      }
    } catch (error) {
      issues.push({ file: rel, reason: error.message });
    }
  }

  if (issues.length) {
    console.error(`Idea nav check: ${issues.length} issue(s)`);
    for (const issue of issues) {
      console.error(`  ${issue.file}: ${issue.reason}`);
    }
    if (strict) process.exit(1);
    return;
  }

  console.log(
    write
      ? `Idea nav sync complete (${files.length} files).`
      : `Idea nav check passed (${files.length} files).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
