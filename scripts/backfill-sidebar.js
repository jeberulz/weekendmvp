#!/usr/bin/env node
/**
 * Backfills the section-navigation sidebar onto legacy idea pages.
 *
 * The sidebar was added to ideas/_template.html in commit 72fd889 (2026-04-21).
 * Pages published before that date don't have it. This script injects the
 * sidebar markup, CSS, and behavior into any page with >= 3 `id="section-*"`
 * anchors so the anchor links are real navigation targets.
 *
 * Pages with < 3 anchors are skipped — their sidebar would be half-broken
 * and they need a content backfill first (see scripts/audit-ideas.js).
 *
 * Usage:
 *   node scripts/backfill-sidebar.js                 # dry run, prints plan
 *   node scripts/backfill-sidebar.js --apply         # writes changes
 *   node scripts/backfill-sidebar.js --file <slug>   # single file
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ideasDir = path.join(root, 'ideas');

const apply = process.argv.includes('--apply');
const fileFlagIdx = process.argv.indexOf('--file');
const singleSlug = fileFlagIdx !== -1 ? process.argv[fileFlagIdx + 1] : null;

const SECTIONS = [
  { id: 'section-problem',     label: 'The Problem',           group: 'overview' },
  { id: 'section-solution',    label: 'The Solution',          group: 'overview' },
  { id: 'section-market',      label: 'Market Research',       group: 'overview' },
  { id: 'section-competitive', label: 'Competitive Landscape', group: 'overview' },
  { id: 'section-business',    label: 'Business Model',        group: 'build'    },
  { id: 'section-tech',        label: 'Tech Stack',            group: 'build'    },
  { id: 'section-prompts',     label: 'AI Build Prompts',      group: 'build'    },
  { id: 'section-sources',     label: 'Sources',               group: 'build'    },
];

function buildSidebar(presentIds) {
  const present = SECTIONS.filter(s => presentIds.has(s.id));
  const overview = present.filter(s => s.group === 'overview');
  const build = present.filter(s => s.group === 'build');
  const link = s => `                        <a href="#${s.id}" class="sidebar-link block px-3 py-2 text-sm text-neutral-500 hover:text-black transition-colors">${s.label}</a>`;
  const lines = [];
  lines.push('                <!-- Sidebar -->');
  lines.push('                <aside id="sidebar" class="fixed inset-y-0 left-0 z-[60] w-72 bg-[#fcfaf7] px-8 py-12 transform -translate-x-full transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:w-56 lg:p-0 lg:z-auto lg:h-fit lg:sticky lg:top-24 lg:flex-shrink-0">');
  lines.push('                    <div class="flex items-center justify-between mb-8 lg:mb-6">');
  lines.push('                        <a href="../startup-ideas.html" class="inline-flex items-center gap-2 text-neutral-500 text-sm hover:text-black transition-colors">');
  lines.push('                            <iconify-icon icon="lucide:arrow-left" width="16" aria-hidden="true"></iconify-icon>');
  lines.push('                            All Ideas');
  lines.push('                        </a>');
  lines.push('                        <button id="mobile-menu-close" class="lg:hidden text-neutral-400 hover:text-black transition-colors" aria-label="Close menu">');
  lines.push('                            <iconify-icon icon="lucide:x" width="24" aria-hidden="true"></iconify-icon>');
  lines.push('                        </button>');
  lines.push('                    </div>');
  lines.push('');
  lines.push('                    <nav id="sidebar-nav" class="space-y-1">');
  if (overview.length) {
    lines.push('                        <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-3">Overview</p>');
    overview.forEach(s => lines.push(link(s)));
  }
  if (build.length) {
    lines.push('');
    lines.push('                        <p class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-8 mb-4 ml-3">Build Details</p>');
    build.forEach(s => lines.push(link(s)));
  }
  lines.push('                    </nav>');
  lines.push('                </aside>');
  return lines.join('\n');
}

const SIDEBAR_CSS = `        .sidebar-link.active { color: #000; font-weight: 600; }
        #sidebar { -ms-overflow-style: none; scrollbar-width: none; overflow-y: auto; }
        #sidebar::-webkit-scrollbar { display: none; }
`;

const SIDEBAR_JS = `    <script>
      (function() {
        const sidebar = document.getElementById('sidebar');
        const openBtn = document.getElementById('mobile-menu-open');
        const closeBtn = document.getElementById('mobile-menu-close');
        const backdrop = document.getElementById('mobile-menu-backdrop');
        function openMenu() {
          if (!sidebar) return;
          sidebar.classList.remove('-translate-x-full');
          if (backdrop) backdrop.classList.remove('opacity-0', 'pointer-events-none');
        }
        function closeMenu() {
          if (!sidebar) return;
          sidebar.classList.add('-translate-x-full');
          if (backdrop) backdrop.classList.add('opacity-0', 'pointer-events-none');
        }
        if (openBtn) openBtn.addEventListener('click', openMenu);
        if (closeBtn) closeBtn.addEventListener('click', closeMenu);
        if (backdrop) backdrop.addEventListener('click', closeMenu);
        document.querySelectorAll('#sidebar-nav a').forEach(a => a.addEventListener('click', closeMenu));
        const links = document.querySelectorAll('.sidebar-link');
        const items = Array.from(links).map(a => {
          const id = a.getAttribute('href').slice(1);
          return { link: a, el: document.getElementById(id) };
        }).filter(it => it.el);
        if ('IntersectionObserver' in window && items.length) {
          const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                links.forEach(l => l.classList.remove('active'));
                const match = items.find(it => it.el === entry.target);
                if (match) match.link.classList.add('active');
              }
            });
          }, { rootMargin: '-20% 0px -60% 0px' });
          items.forEach(it => observer.observe(it.el));
        }
      })();
    </script>
`;

const NAV_LOGO_RE = /<a href="\.\.\/index\.html">\s*<div class="logo h-4 w-32 text-black" role="img" aria-label="Weekend MVP"><\/div>\s*<\/a>/;
const NAV_LOGO_REPLACEMENT = `<div class="flex items-center gap-4">
            <button id="mobile-menu-open" class="lg:hidden text-black p-1 -ml-1" aria-label="Open menu">
                <iconify-icon icon="lucide:menu" width="24" aria-hidden="true"></iconify-icon>
            </button>
            <a href="../index.html"><div class="logo h-4 w-32 text-black" role="img" aria-label="Weekend MVP"></div></a>
        </div>`;

const CONTENT_OPEN_RE = /<section id="idea-content">\s*<div class="pt-24 pb-16 px-6">\s*<div class="max-w-2xl mx-auto">/;
const CONTENT_CLOSE_RE = /(\n?\s*)<\/div>\s*<\/div>\s*(<!--[^-]*-->\s*)?<footer/;
const STYLE_CLOSE_RE = /<\/style>/;
const GATE_SCRIPT_RE = /<script src="\/ideas\/gate\.js" defer><\/script>/;
const NAV_CONTAINER_RE = /(<div class="fixed top-0[^>]*>)/;

function transform(html) {
  const ids = new Set([...html.matchAll(/id="(section-[a-z]+)"/g)].map(m => m[1]));
  if (ids.size < 3) return { skipped: 'insufficient-anchors', anchors: ids.size };
  if (html.includes('id="sidebar"')) return { skipped: 'already-has-sidebar' };

  const required = [
    { re: NAV_LOGO_RE,      name: 'nav-logo-pattern' },
    { re: CONTENT_OPEN_RE,  name: 'content-wrapper-pattern' },
    { re: CONTENT_CLOSE_RE, name: 'content-close-pattern' },
    { re: STYLE_CLOSE_RE,   name: 'style-close-pattern' },
    { re: GATE_SCRIPT_RE,   name: 'gate-script-pattern' },
    { re: NAV_CONTAINER_RE, name: 'nav-container-pattern' },
  ];
  for (const r of required) {
    if (!r.re.test(html)) return { skipped: `missing-${r.name}` };
  }

  let out = html;

  out = out.replace(STYLE_CLOSE_RE, `${SIDEBAR_CSS}    </style>`);

  out = out.replace(NAV_LOGO_RE, NAV_LOGO_REPLACEMENT);

  out = out.replace(
    NAV_CONTAINER_RE,
    `<!-- Mobile Sidebar Backdrop -->\n    <div id="mobile-menu-backdrop" class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300 lg:hidden"></div>\n\n    $1`
  );

  out = out.replace(
    CONTENT_OPEN_RE,
    `<section id="idea-content">
        <div class="max-w-6xl mx-auto px-6 lg:px-8">
            <div class="flex flex-col lg:flex-row gap-8 lg:gap-12 pt-24 pb-16">

${buildSidebar(ids)}

                <!-- Main Content -->
                <main class="flex-1 max-w-2xl">`
  );

  out = out.replace(
    CONTENT_CLOSE_RE,
    `\n                </main>\n            </div>\n        </div>\n\n        <footer`
  );

  out = out.replace(
    GATE_SCRIPT_RE,
    `<script src="/ideas/gate.js" defer></script>\n${SIDEBAR_JS}`
  );

  return { transformed: true, anchors: ids.size, out };
}

function listTargets() {
  const all = fs.readdirSync(ideasDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('_template'));
  if (singleSlug) {
    const want = singleSlug.endsWith('.html') ? singleSlug : `${singleSlug}.html`;
    return all.filter(f => f === want);
  }
  return all;
}

const files = listTargets();
const results = { transformed: [], skipped: {} };

for (const file of files) {
  const full = path.join(ideasDir, file);
  const html = fs.readFileSync(full, 'utf8');
  const result = transform(html);
  if (result.transformed) {
    results.transformed.push({ file, anchors: result.anchors });
    if (apply) fs.writeFileSync(full, result.out);
  } else {
    const key = result.skipped;
    results.skipped[key] = (results.skipped[key] || 0) + 1;
  }
}

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
console.log(`Scanned: ${files.length} files`);
console.log(`Transformed: ${results.transformed.length}`);
for (const t of results.transformed) console.log(`  ${t.file} (${t.anchors} anchors)`);
console.log('Skipped:');
for (const [k, v] of Object.entries(results.skipped)) console.log(`  ${k}: ${v}`);
if (!apply && results.transformed.length) {
  console.log('\nRe-run with --apply to write changes.');
}
