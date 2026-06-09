#!/usr/bin/env node
/**
 * Manifest-driven idea grids for the build-with/* tool pages.
 *
 * Each build-with page keeps its bespoke copy (strengths, prompts, guides) by
 * hand, but its "Project Ideas" grid and the JSON-LD ItemList are generated
 * from ideas/manifest.json — filtered by the page's tool tag, ranked by score,
 * capped at LIMIT. New ideas tagged for a tool appear automatically; the page
 * can never drift from the manifest again.
 *
 *   node scripts/sync-build-with.js          # report drift (exit 0)
 *   STRICT=1 node scripts/sync-build-with.js # CI check (exit 1 on drift)
 *   node scripts/sync-build-with.js --write  # regenerate grids in place
 *
 * Markers are installed on first --write run, anchored to the
 * aria-labelledby="ideas-heading" section:
 *   <!-- wmvp:ideas-grid:start --> ... <!-- wmvp:ideas-grid:end -->
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'ideas/manifest.json'), 'utf8'));

const LIMIT = 30;

const TOOL_PAGES = [
  { file: 'build-with/claude/index.html', tool: 'claude' },
  { file: 'build-with/cursor/index.html', tool: 'cursor' },
  { file: 'build-with/bolt/index.html', tool: 'bolt' },
  { file: 'build-with/lovable/index.html', tool: 'lovable' },
  { file: 'build-with/replit/index.html', tool: 'replit' },
  { file: 'build-with/v0/index.html', tool: 'v0' },
  { file: 'build-with/windsurf/index.html', tool: 'windsurf' },
  { file: 'build-with/no-code/index.html', tool: 'no-code' },
];

const COLOR_MAP = {
  saas: 'blue',
  productivity: 'yellow',
  health: 'green',
  marketplace: 'purple',
  'ai-tools': 'violet',
  automation: 'orange',
  education: 'teal',
  b2b: 'slate',
  'developer-tools': 'emerald',
  ecommerce: 'pink',
  'creator-tools': 'rose',
  fintech: 'cyan',
};

const CATEGORY_LABELS = {
  saas: 'SaaS',
  productivity: 'Productivity',
  health: 'Health',
  marketplace: 'Marketplace',
  'ai-tools': 'AI Tools',
  automation: 'Automation',
  education: 'Education',
  b2b: 'B2B',
  'developer-tools': 'Developer Tools',
  ecommerce: 'E-Commerce',
  'creator-tools': 'Creator Tools',
  fintech: 'Fintech',
};

const GRID_START = '<!-- wmvp:ideas-grid:start -->';
const GRID_END = '<!-- wmvp:ideas-grid:end -->';
const GRID_DIV_RE = /<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">/;
const MARKED_GRID_RE = /<!-- wmvp:ideas-grid:start -->[\s\S]*?<!-- wmvp:ideas-grid:end -->/;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJson(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function scoreOf(idea) {
  const s = idea.scores || {};
  return (
    (s.opportunity || 0) + (s.pain || 0) + (s.timing || 0) + (s.builder_confidence || 0)
  );
}

function rankIdeas(a, b) {
  const sd = scoreOf(b) - scoreOf(a);
  if (sd !== 0) return sd;
  const da = a.publishedAt || '';
  const db = b.publishedAt || '';
  if (da !== db) return db.localeCompare(da);
  return (a.title || '').localeCompare(b.title || '');
}

function categoryLabel(slug) {
  if (CATEGORY_LABELS[slug]) return CATEGORY_LABELS[slug];
  return String(slug || '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ideaDescription(idea) {
  const text = idea.tagline || idea.description || '';
  return text.length > 110 ? `${text.slice(0, 107)}…` : text;
}

function selectIdeas(tool) {
  return manifest.ideas
    .filter((i) => Array.isArray(i.tools) && i.tools.includes(tool))
    .filter((i) => fs.existsSync(path.join(ROOT, `ideas/${i.slug}.html`)))
    .sort(rankIdeas)
    .slice(0, LIMIT);
}

function renderCards(ideas) {
  return ideas
    .map((idea) => {
      const color = COLOR_MAP[idea.category] || 'blue';
      const label = categoryLabel(idea.category);
      return `                <a href="../../ideas/${idea.slug}.html" class="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/[0.07] transition-all">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="px-2 py-1 bg-${color}-500/10 text-${color}-400 text-[10px] font-bold uppercase rounded-full">${escapeHtml(label)}</span>
                        <span class="text-neutral-600 text-xs">~${idea.buildTime || 8} hours</span>
                    </div>
                    <h3 class="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">${escapeHtml(idea.title)}</h3>
                    <p class="text-neutral-500 text-sm line-clamp-2">${escapeHtml(ideaDescription(idea))}</p>
                </a>`;
    })
    .join('\n\n');
}

function renderItemListElements(ideas) {
  return ideas
    .map(
      (idea, i) =>
        `            { "@type": "ListItem", "position": ${i + 1}, "name": "${escapeJson(idea.title)}", "url": "https://weekendmvp.app/ideas/${idea.slug}.html" }`
    )
    .join(',\n');
}

/** Find the index of the `</div>` that closes the <div> opening at openIdx. */
function matchingDivEnd(html, openIdx) {
  const tagRe = /<div\b|<\/div>/g;
  tagRe.lastIndex = openIdx;
  let depth = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    if (m[0] === '</div>') {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  return -1;
}

/** Install grid markers around the ideas-section grid contents (idempotent). */
function ensureGridMarkers(html) {
  if (html.includes(GRID_START)) return html;

  const anchor = html.indexOf('aria-labelledby="ideas-heading"');
  if (anchor === -1) throw new Error('no ideas-heading section found');

  GRID_DIV_RE.lastIndex = 0;
  const divMatch = GRID_DIV_RE.exec(html.slice(anchor));
  if (!divMatch) throw new Error('no ideas grid div found');
  const divOpenIdx = anchor + divMatch.index;
  const innerStart = html.indexOf('>', divOpenIdx) + 1;
  const closeIdx = matchingDivEnd(html, divOpenIdx);
  if (closeIdx === -1) throw new Error('unbalanced ideas grid div');

  const wrapped = `\n                ${GRID_START}\n                ${GRID_END}\n            `;
  return html.slice(0, innerStart) + wrapped + html.slice(closeIdx);
}

/** Replace the ItemList numberOfItems + itemListElement array in the JSON-LD. */
function replaceItemList(html, ideas) {
  const listIdx = html.indexOf('"@type": "ItemList"');
  if (listIdx === -1) return html; // some pages may not carry the schema

  // numberOfItems
  const numRe = /("numberOfItems":\s*)\d+/;
  const numMatch = numRe.exec(html.slice(listIdx));
  let out = html;
  if (numMatch) {
    const at = listIdx + numMatch.index;
    out = out.slice(0, at) + `${numMatch[1]}${ideas.length}` + out.slice(at + numMatch[0].length);
  }

  // itemListElement [ ... ]
  const listIdx2 = out.indexOf('"@type": "ItemList"');
  const elKey = out.indexOf('"itemListElement"', listIdx2);
  if (elKey === -1) return out;
  const openBracket = out.indexOf('[', elKey);
  if (openBracket === -1) return out;

  // bracket-match the array
  let depth = 0;
  let closeBracket = -1;
  for (let i = openBracket; i < out.length; i += 1) {
    if (out[i] === '[') depth += 1;
    else if (out[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        closeBracket = i;
        break;
      }
    }
  }
  if (closeBracket === -1) return out;

  const replacement = `[\n${renderItemListElements(ideas)}\n          ]`;
  return out.slice(0, openBracket) + replacement + out.slice(closeBracket + 1);
}

// Keep human-readable counts in sync wherever the pages phrase them as
// "N Project Ideas" or "N Things to Build" (title, og/twitter, H1, badge,
// intro copy). The phrasings are specific enough not to touch other numbers,
// and the original casing of the phrase is preserved.
function replaceCounts(html, count) {
  return html.replace(
    /\b\d+ (project ideas|things to build)\b/gi,
    (_, phrase) => `${count} ${phrase}`
  );
}

function buildExpected(html, ideas) {
  let out = ensureGridMarkers(html);
  const cards = renderCards(ideas);
  out = out.replace(MARKED_GRID_RE, `${GRID_START}\n${cards}\n                ${GRID_END}`);
  out = replaceItemList(out, ideas);
  out = replaceCounts(out, ideas.length);
  return out;
}

function main() {
  const write = process.argv.includes('--write');
  const strict = process.env.STRICT === '1';
  const issues = [];

  for (const { file, tool } of TOOL_PAGES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      issues.push({ file, reason: 'page not found' });
      continue;
    }
    const ideas = selectIdeas(tool);
    if (ideas.length === 0) {
      issues.push({ file, reason: `no ideas tagged for tool "${tool}"` });
      continue;
    }

    const current = fs.readFileSync(filePath, 'utf8');
    let expected;
    try {
      expected = buildExpected(current, ideas);
    } catch (error) {
      issues.push({ file, reason: error.message });
      continue;
    }

    if (write) {
      if (expected !== current) {
        fs.writeFileSync(filePath, expected, 'utf8');
        console.log(`  ✓ ${file} — ${ideas.length} ideas (${tool})`);
      } else {
        console.log(`  · ${file} — already current (${ideas.length} ideas)`);
      }
    } else if (expected !== current) {
      issues.push({ file, reason: `idea grid drift (run: npm run sync:build-with) — expected ${ideas.length} ideas` });
    }
  }

  if (issues.length) {
    console.error(`build-with check: ${issues.length} issue(s)`);
    for (const issue of issues) console.error(`  ${issue.file}: ${issue.reason}`);
    if (strict && !write) process.exit(1);
    if (!write) return;
  }

  console.log(write ? 'build-with sync complete.' : 'build-with check passed.');
}

main();
