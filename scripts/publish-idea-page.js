#!/usr/bin/env node
/**
 * Render a full ideas/<slug>.html page from ideas/_template.html + a structured
 * data module in scripts/idea-data/<slug>.js. This rebuilds the render step of
 * the `publish-idea` skill so Phase 2 ideas match the canonical chrome/schema
 * and pass scripts/audit-ideas.js. All seven required sections are always
 * included; the Mustache section markers are stripped and every {{VAR}} filled.
 *
 *   node scripts/publish-idea-page.js <slug>        # write ideas/<slug>.html
 *   node scripts/publish-idea-page.js <slug> --check # render to stdout, don't write
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'ideas/_template.html');

const TOOL_NAMES = {
  claude: 'Claude', cursor: 'Cursor', bolt: 'Bolt.new', lovable: 'Lovable',
  replit: 'Replit', v0: 'v0', windsurf: 'Windsurf', 'no-code': 'No-Code',
};
const AUDIENCE_NAMES = {
  developers: 'Developers', designers: 'Designers', 'non-technical': 'Non-Technical',
  'solo-founders': 'Solo Founders', 'side-hustlers': 'Side Hustlers', 'weekend-builders': 'Weekend Builders',
};
const CATEGORY_META = {
  saas: { name: 'SaaS', icon: 'lucide:layers' },
  productivity: { name: 'Productivity', icon: 'lucide:zap' },
  'ai-tools': { name: 'AI Tools', icon: 'lucide:sparkles' },
  automation: { name: 'Automation', icon: 'lucide:workflow' },
  'developer-tools': { name: 'Developer Tools', icon: 'lucide:code' },
};
const REVENUE_LABELS = {
  '1k-month': '$1K/month', '5k-month': '$5K/month', '10k-month': '$10K/month',
  'passive-income': 'Passive Income', 'quick-wins': 'Quick Wins',
};

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Join an array of plain-text paragraphs into the body of a section whose
// opening <p> is already supplied by the template (and whose closing </p>
// the template also supplies). Middle paragraphs get their own <p> wrappers.
function paras(arr) {
  return arr
    .map(esc)
    .join('</p>\n                            <p class="text-neutral-600 leading-relaxed mb-4">');
}

// ---- list renderers (markup mirrors ideas/_template.html) --------------------
function renderSteps(steps) {
  return steps.map((s, i) => `<div class="flex-1">
                                    <div class="text-2xl font-medium text-neutral-300 mb-2">${String(i + 1).padStart(2, '0')}</div>
                                    <p class="text-sm text-neutral-600 leading-relaxed">${esc(s)}</p>
                                </div>`).join('\n                                ');
}
function renderMarketPoints(points) {
  return points.map((p) => `<li class="flex gap-3 text-neutral-600">
                                <iconify-icon icon="lucide:check" class="text-green-600 mt-1 flex-shrink-0" width="16" aria-hidden="true"></iconify-icon>
                                <span class="leading-relaxed">${esc(p)}</span>
                            </li>`).join('\n                            ');
}
function renderCompetitors(list) {
  return list.map((c) => `<div class="p-5 bg-neutral-100 rounded-2xl">
                                <div class="flex items-center justify-between mb-2">
                                    <h4 class="font-medium text-neutral-900">${esc(c.name)}</h4>
                                    <span class="text-xs text-neutral-500">${esc(c.pricing)}</span>
                                </div>
                                <p class="text-sm text-neutral-600 leading-relaxed">${esc(c.note)}</p>
                            </div>`).join('\n                            ');
}
function renderPricing(tiers) {
  return tiers.map((t) => `<div class="p-6 bg-neutral-100 rounded-2xl">
                                <p class="text-sm font-semibold text-neutral-900 mb-1">${esc(t.name)}</p>
                                <p class="text-2xl font-medium text-black mb-3">${esc(t.price)}</p>
                                <p class="text-sm text-neutral-600 leading-relaxed">${esc(t.desc)}</p>
                            </div>`).join('\n                            ');
}
function renderUnitEcon(metrics) {
  return metrics.map((m) => `<div>
                                    <p class="text-2xl font-medium text-black">${esc(m.value)}</p>
                                    <p class="text-xs text-neutral-500 mt-1">${esc(m.label)}</p>
                                </div>`).join('\n                                ');
}
function renderTech(items) {
  return items.map((t) => `<div class="p-5 bg-neutral-100 rounded-2xl">
                                <p class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">${esc(t.layer)}</p>
                                <p class="font-medium text-neutral-900 mb-1">${esc(t.choice)}</p>
                                <p class="text-sm text-neutral-600 leading-relaxed">${esc(t.why)}</p>
                            </div>`).join('\n                            ');
}
function renderToolLinks(tools) {
  return tools.map((s) => `<a href="../build-with/${s}/" class="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-full text-xs font-medium text-neutral-600 hover:text-black hover:border-neutral-300 transition-all">${esc(TOOL_NAMES[s] || s)}</a>`).join('\n                                ');
}
function renderAudienceLinks(auds) {
  return auds.map((s) => `<a href="../ideas-for/${s}/" class="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-full text-xs font-medium text-neutral-600 hover:text-black hover:border-neutral-300 transition-all">${esc(AUDIENCE_NAMES[s] || s)}</a>`).join('\n                                ');
}
function renderRelated(related) {
  return related.map((r) => `<a href="${r.slug}.html" class="group p-4 bg-neutral-100 border border-neutral-200 rounded-2xl hover:border-neutral-300 transition-all">
                                <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">${esc(CATEGORY_META[r.category]?.name || r.category)}</span>
                                <h4 class="text-sm font-medium text-neutral-900 group-hover:text-black transition-colors mt-1">${esc(r.title)}</h4>
                            </a>`).join('\n                            ');
}

function render(data) {
  const cat = CATEGORY_META[data.category] || { name: data.category, icon: 'lucide:layers' };
  const vars = {
    IDEA_TITLE: esc(data.title),
    IDEA_DESCRIPTION: esc(data.description),
    IDEA_SLUG: data.slug,
    PUBLISH_DATE: data.publishedAt,
    APPLICATION_CATEGORY: data.applicationCategory,
    SOLUTION_DESCRIPTION: esc(data.solutionShort),
    BUILD_HOURS: data.buildTime,
    BUILD_TIME: data.buildTime,
    STEP_1_DESCRIPTION: esc(data.steps[0]),
    STEP_2_DESCRIPTION: esc(data.steps[1]),
    STEP_3_DESCRIPTION: esc(data.steps[2]),
    CATEGORY: cat.name.toUpperCase(),
    IDEA_TAGLINE: esc(data.tagline),
    IDEA_SHORT_DESCRIPTION: esc(data.shortDescription),
    PROBLEM_DESCRIPTION: paras(data.problem),
    HOW_IT_WORKS_STEPS: renderSteps(data.steps),
    MARKET_OVERVIEW: paras(data.market),
    MARKET_VALIDATION_POINTS: renderMarketPoints(data.marketPoints),
    COMPETITIVE_OVERVIEW: paras(data.competitive),
    COMPETITORS_LIST: renderCompetitors(data.competitors),
    COMPETITIVE_GAPS: esc(data.competitiveGap),
    BUSINESS_MODEL_OVERVIEW: paras(data.business),
    PRICING_TIERS: renderPricing(data.pricing),
    UNIT_ECONOMICS: renderUnitEcon(data.unitEconomics),
    TECH_STACK_OVERVIEW: paras(data.techIntro),
    TECH_STACK_ITEMS: renderTech(data.tech),
    PROMPT_PROJECT_SETUP: esc(data.prompts.setup),
    PROMPT_CORE_FEATURE: esc(data.prompts.core),
    PROMPT_LANDING_PAGE: esc(data.prompts.landing),
    PROMPT_BRANDING_PACKAGE: esc(data.prompts.branding),
    PROMPT_ADDITIONAL_TITLE: esc(data.prompts.extraTitle),
    PROMPT_ADDITIONAL: esc(data.prompts.extra),
    CATEGORY_URL: `../ideas/${data.category}/`,
    CATEGORY_ICON: cat.icon,
    CATEGORY_NAME: cat.name,
    REVENUE_URL: `../ideas/${data.revenueGoal}/`,
    REVENUE_GOAL: REVENUE_LABELS[data.revenueGoal] || data.revenueGoal,
    TOOL_LINKS: renderToolLinks(data.tools),
    AUDIENCE_LINKS: renderAudienceLinks(data.audiences),
    RELATED_IDEAS: renderRelated(data.related),
  };

  let html = fs.readFileSync(TEMPLATE, 'utf8');
  // The page is indexable; drop the template's noindex directive.
  html = html.replace(/\s*<meta name="robots" content="noindex,follow">\n/, '\n');
  // {{SOLUTION_DESCRIPTION}} is reused for the schema (short string) and the body
  // paragraph. Inject the rich body HTML into the body paragraph first, then let
  // the vars loop fill the remaining (schema) token with the short string.
  html = html.replace(
    /(<p class="text-neutral-600 leading-relaxed mb-8">)\s*\{\{SOLUTION_DESCRIPTION\}\}\s*(<\/p>)/,
    `$1${paras(data.solution)}$2`
  );
  // Strip all Mustache section markers (every optional block is included).
  html = html.replace(/^[ \t]*\{\{[#/][A-Z_]+\}\}[ \t]*\n/gm, '');
  // Replace every {{VAR}}.
  for (const [k, v] of Object.entries(vars)) {
    html = html.split(`{{${k}}}`).join(v);
  }
  const leak = html.match(/\{\{\s*[A-Z_]+\s*\}\}/);
  if (leak) throw new Error(`unfilled placeholder: ${leak[0]}`);
  return html;
}

function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error('usage: node scripts/publish-idea-page.js <slug>');
  const data = require(path.join(ROOT, 'scripts/idea-data', `${slug}.js`));
  const html = render(data);
  if (process.argv.includes('--check')) {
    process.stdout.write(html);
    return;
  }
  const out = path.join(ROOT, 'ideas', `${slug}.html`);
  fs.writeFileSync(out, html, 'utf8');
  console.log(`  ✓ wrote ${path.relative(ROOT, out)} (${Buffer.byteLength(html)} bytes)`);
}

main();
