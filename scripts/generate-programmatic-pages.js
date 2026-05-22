#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const manifestPath = path.join(ROOT, 'ideas/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

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

const AUDIENCE_COLORS = {
  developers: 'emerald',
  designers: 'rose',
  'non-technical': 'amber',
  'solo-founders': 'blue',
  'weekend-builders': 'orange',
  'side-hustlers': 'purple',
};

const BUILD_TIME_PAGES = [
  {
    pathSlug: 'build-in-8-hours',
    manifestSlug: '8-hours',
    filter: ['6', '8'],
    icon: 'lucide:zap',
    color: 'orange',
  },
  {
    pathSlug: 'build-in-weekend',
    manifestSlug: 'weekend',
    filter: ['8', '10'],
    icon: 'lucide:calendar',
    color: 'blue',
  },
  {
    pathSlug: 'build-in-1-week',
    manifestSlug: '1-week',
    filter: ['12'],
    icon: 'lucide:calendar-days',
    color: 'violet',
  },
];

const TARGETS = {
  categories: ['developer-tools'],
  revenue: ['5k-month', '10k-month', 'quick-wins'],
  audiences: ['designers', 'side-hustlers', 'weekend-builders'],
  buildTimes: BUILD_TIME_PAGES.map((p) => p.pathSlug),
};

function filterRevenueIdeas(slug) {
  const direct = manifest.ideas.filter((i) => i.revenueGoal === slug);
  if (direct.length > 0) return direct;

  if (slug === '10k-month') {
    return manifest.ideas.filter(
      (i) =>
        i.revenueGoal === '5k-month' &&
        ['b2b', 'saas', 'fintech'].includes(i.category)
    );
  }

  if (slug === 'quick-wins') {
    return manifest.ideas.filter((i) => ['6', '8'].includes(String(i.buildTime)));
  }

  return direct;
}

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

function categoryLabel(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getCategoryMeta(slug) {
  return manifest.categories.find((c) => c.slug === slug) || {
    slug,
    name: categoryLabel(slug),
    description: `${categoryLabel(slug)} startup ideas you can build this weekend.`,
    icon: 'lucide:layers',
    color: COLOR_MAP[slug] || 'blue',
    faqs: [],
  };
}

function ideaDescription(idea) {
  const text = idea.tagline || idea.description || '';
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function generateIdeasGrid(ideas, hrefPrefix = '../') {
  return ideas
    .map(
      (idea) => {
        const color = COLOR_MAP[idea.category] || 'blue';
        const label = categoryLabel(idea.category);
        return `                <a href="${hrefPrefix}${idea.slug}.html" class="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/[0.07] transition-all">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="px-2 py-1 bg-${color}-500/10 text-${color}-400 text-[10px] font-bold uppercase rounded-full">${escapeHtml(label)}</span>
                        <span class="text-neutral-600 text-xs">~${idea.buildTime || 8} hours</span>
                    </div>
                    <h3 class="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">${escapeHtml(idea.title)}</h3>
                    <p class="text-neutral-500 text-sm line-clamp-2">${escapeHtml(ideaDescription(idea))}</p>
                </a>`;
      }
    )
    .join('\n\n');
}

function generateItemListElements(ideas) {
  return ideas
    .map(
      (idea, index) => `              {
                "@type": "ListItem",
                "position": ${index + 1},
                "name": "${escapeJson(idea.title)}",
                "url": "https://weekendmvp.app/ideas/${idea.slug}.html"
              }`
    )
    .join(',\n');
}

function generateFaqItems(faqs) {
  if (!faqs?.length) {
    return `                <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 class="text-white font-medium mb-3">Can I really build these in a weekend?</h3>
                    <p class="text-neutral-400 text-sm leading-relaxed">Yes. Each idea is scoped for a focused MVP — one core workflow, minimal integrations, and a clear launch path. Ship the smallest version that delivers value, then iterate.</p>
                </div>`;
  }
  return faqs
    .map(
      (faq) => `                <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 class="text-white font-medium mb-3">${escapeHtml(faq.question)}</h3>
                    <p class="text-neutral-400 text-sm leading-relaxed">${escapeHtml(faq.answer)}</p>
                </div>`
    )
    .join('\n\n');
}

function generateFaqSchemaItems(faqs) {
  const items =
    faqs?.length > 0
      ? faqs
      : [
          {
            question: 'Can I really build these in a weekend?',
            answer:
              'Yes. Each idea is scoped for a focused MVP with one core workflow and a clear launch path.',
          },
        ];
  return items
    .map(
      (faq) => `            {
              "@type": "Question",
              "name": "${escapeJson(faq.question)}",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "${escapeJson(faq.answer)}"
              }
            }`
    )
    .join(',\n');
}

function generateRelatedCategories(currentSlug, ideas) {
  const counts = {};
  ideas.forEach((idea) => {
    counts[idea.category] = (counts[idea.category] || 0) + 1;
  });
  return manifest.categories
    .filter((cat) => cat.slug !== currentSlug && counts[cat.slug] > 0)
    .slice(0, 4)
    .map((cat) => {
      const color = cat.color || COLOR_MAP[cat.slug] || 'blue';
      return `                <a href="../${cat.slug}/" class="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all text-center">
                    <div class="w-10 h-10 mx-auto mb-3 bg-${color}-500/10 rounded-lg flex items-center justify-center">
                        <iconify-icon icon="${cat.icon || 'lucide:layers'}" class="text-${color}-400" width="20" aria-hidden="true"></iconify-icon>
                    </div>
                    <span class="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">${escapeHtml(cat.name)}</span>
                </a>`;
    })
    .join('\n');
}

function generateRelatedBuildTimes(currentSlug) {
  return BUILD_TIME_PAGES.filter((p) => p.pathSlug !== currentSlug)
    .map((p) => {
      const bt = manifest.buildTimes.find((b) => b.slug === p.manifestSlug);
      const name = bt?.name || categoryLabel(p.pathSlug.replace('build-in-', ''));
      return `                <a href="../${p.pathSlug}/" class="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all text-center">
                    <div class="w-10 h-10 mx-auto mb-3 bg-${p.color}-500/10 rounded-lg flex items-center justify-center">
                        <iconify-icon icon="${p.icon}" class="text-${p.color}-400" width="20" aria-hidden="true"></iconify-icon>
                    </div>
                    <span class="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">${escapeHtml(name)}</span>
                </a>`;
    })
    .join('\n');
}

function replaceAll(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(value));
  }
  return out.replace(/<meta name="robots" content="noindex,follow">\n\s*/g, '');
}

function writePage(outPath, html) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

function filterAudienceIdeas(audienceSlug) {
  const audience = manifest.audiences.find((a) => a.slug === audienceSlug);
  let ideas = manifest.ideas.filter((i) => i.audiences?.includes(audienceSlug));
  if (ideas.length === 0 && audience?.filters?.categories) {
    ideas = manifest.ideas.filter((i) => audience.filters.categories.includes(i.category));
  }
  return ideas;
}

function generateCategoryPage(slug) {
  const cat = getCategoryMeta(slug);
  const ideas = manifest.ideas.filter((i) => i.category === slug);
  const template = fs.readFileSync(path.join(ROOT, 'ideas/_template-category.html'), 'utf8');
  const html = replaceAll(template, {
    CATEGORY_NAME: cat.name,
    CATEGORY_SLUG: slug,
    CATEGORY_NAME_LOWER: cat.name.toLowerCase(),
    CATEGORY_DESCRIPTION: cat.description,
    CATEGORY_ICON: cat.icon || 'lucide:layers',
    CATEGORY_COLOR: cat.color || COLOR_MAP[slug] || 'blue',
    IDEA_COUNT: ideas.length,
    IDEAS_GRID: generateIdeasGrid(ideas),
    ITEM_LIST_ELEMENTS: generateItemListElements(ideas),
    FAQ_ITEMS: generateFaqItems(cat.faqs),
    FAQ_SCHEMA_ITEMS: generateFaqSchemaItems(cat.faqs),
    RELATED_CATEGORIES: generateRelatedCategories(slug, ideas),
  });
  writePage(path.join(ROOT, `ideas/${slug}/index.html`), html);
  return { url: `https://weekendmvp.app/ideas/${slug}/`, count: ideas.length };
}

function patchMeta(html, { title, description }) {
  let out = html;
  if (title) {
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
    out = out.replace(
      /<meta property="og:title" content="[^"]*">/,
      `<meta property="og:title" content="${escapeHtml(title)}">`
    );
    out = out.replace(
      /<meta property="twitter:title" content="[^"]*">/,
      `<meta property="twitter:title" content="${escapeHtml(title)}">`
    );
  }
  if (description) {
    out = out.replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${escapeHtml(description)}">`
    );
    out = out.replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${escapeHtml(description)}">`
    );
    out = out.replace(
      /<meta property="twitter:description" content="[^"]*">/,
      `<meta property="twitter:description" content="${escapeHtml(description)}">`
    );
  }
  return out;
}

function generateBuildTimePage(pageConfig) {
  const bt = manifest.buildTimes.find((b) => b.slug === pageConfig.manifestSlug);
  const ideas = manifest.ideas.filter((i) => pageConfig.filter.includes(String(i.buildTime)));
  const displayName = bt?.displayName || `Apps You Can Build in ${pageConfig.manifestSlug}`;
  const shortName = bt?.name || categoryLabel(pageConfig.manifestSlug);
  const description =
    bt?.description ||
    `Startup ideas scoped for ${shortName.toLowerCase()} builds. Each includes AI prompts and step-by-step guides.`;
  const metaDescription = `Discover ${ideas.length} startup ideas you can build in ${shortName.toLowerCase()}. Each includes AI build prompts, market research, and step-by-step guides.`;
  const pageTitle = `${displayName} | Weekend MVP`;

  let template = fs.readFileSync(path.join(ROOT, 'ideas/_template-category.html'), 'utf8');
  template = template.replace(/{{CATEGORY_NAME}} Startup Ideas/g, displayName);
  template = template.replace(/Related Categories/g, 'Other Build Times');
  template = template.replace(/related-categories-heading/g, 'related-build-times-heading');
  template = template.replace(/Frequently Asked Questions/g, 'Build Time FAQ');
  template = template.replace(
    /Ready to build your {{CATEGORY_NAME_LOWER}} startup\?/g,
    `Ready to ship something in ${shortName.toLowerCase()}?`
  );

  const faqs = [
    {
      question: `What can I realistically ship in ${shortName.toLowerCase()}?`,
      answer: `Focus on one core workflow, skip nice-to-have integrations, and launch with manual onboarding if needed. These ${ideas.length} ideas are scoped for that constraint.`,
    },
    {
      question: 'Do I need a team to build these?',
      answer: 'No. Every idea here is designed for solo builders using AI-assisted coding tools like Cursor or Claude.',
    },
  ];

  let html = replaceAll(template, {
    CATEGORY_NAME: shortName,
    CATEGORY_SLUG: pageConfig.pathSlug,
    CATEGORY_NAME_LOWER: shortName.toLowerCase(),
    CATEGORY_DESCRIPTION: description,
    CATEGORY_ICON: pageConfig.icon,
    CATEGORY_COLOR: pageConfig.color,
    IDEA_COUNT: ideas.length,
    IDEAS_GRID: generateIdeasGrid(ideas),
    ITEM_LIST_ELEMENTS: generateItemListElements(ideas),
    FAQ_ITEMS: generateFaqItems(faqs),
    FAQ_SCHEMA_ITEMS: generateFaqSchemaItems(faqs),
    RELATED_CATEGORIES: generateRelatedBuildTimes(pageConfig.pathSlug),
  });

  html = patchMeta(html, { title: pageTitle, description: metaDescription });

  writePage(path.join(ROOT, `ideas/${pageConfig.pathSlug}/index.html`), html);
  return { url: `https://weekendmvp.app/ideas/${pageConfig.pathSlug}/`, count: ideas.length };
}

function generateRevenuePaths(revenue) {
  if (revenue.slug === 'quick-wins') {
    const paths = [
      {
        icon: 'lucide:zap',
        color: 'orange',
        title: 'Weekend Ship',
        math: 'Build in 6–8 hours',
        note: 'Best for: Focused utilities with one killer workflow',
      },
      {
        icon: 'lucide:rocket',
        color: 'green',
        title: 'Pre-sell First',
        math: 'First sale in 2–4 weeks',
        note: 'Best for: Urgent B2B pain with budget already allocated',
      },
      {
        icon: 'lucide:target',
        color: 'blue',
        title: 'Impulse Pricing',
        math: '$19–49/mo or one-time $49–99',
        note: 'Best for: Individual pros who can buy without approval',
      },
    ];
    return paths
      .map(
        (p) => `                    <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-10 h-10 bg-${p.color}-500/10 rounded-xl flex items-center justify-center">
                                <iconify-icon icon="${p.icon}" class="text-${p.color}-400" width="20" aria-hidden="true"></iconify-icon>
                            </div>
                            <span class="text-white font-medium">${p.title}</span>
                        </div>
                        <p class="text-neutral-400 text-sm mb-3">${p.math}</p>
                        <p class="text-neutral-500 text-xs">${p.note}</p>
                    </div>`
      )
      .join('\n\n');
  }

  const amount = revenue.amount || 5000;
  const paths = [
    {
      icon: 'lucide:users',
      color: 'green',
      title: 'Volume Play',
      math: `${Math.round(amount / 20)} customers × $20/mo`,
      note: 'Best for: Tools with broad appeal and low price points',
    },
    {
      icon: 'lucide:target',
      color: 'blue',
      title: 'Balanced Approach',
      math: `${Math.round(amount / 50)} customers × $50/mo`,
      note: 'Best for: Niche SaaS and professional utilities',
    },
    {
      icon: 'lucide:gem',
      color: 'purple',
      title: 'Premium Niche',
      math: `${Math.round(amount / 100)} customers × $100/mo`,
      note: 'Best for: B2B tools and high-value workflows',
    },
  ];
  return paths
    .map(
      (p) => `                    <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-10 h-10 bg-${p.color}-500/10 rounded-xl flex items-center justify-center">
                                <iconify-icon icon="${p.icon}" class="text-${p.color}-400" width="20" aria-hidden="true"></iconify-icon>
                            </div>
                            <span class="text-white font-medium">${p.title}</span>
                        </div>
                        <p class="text-neutral-400 text-sm mb-3">${p.math}</p>
                        <p class="text-neutral-500 text-xs">${p.note}</p>
                    </div>`
    )
    .join('\n\n');
}

function generateUnitEconomics(revenue) {
  const ue = revenue.unitEconomics || {};

  if (revenue.slug === 'quick-wins') {
    return `                <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 class="text-white font-medium mb-4">Time to First Sale</h3>
                    <p class="text-3xl font-medium text-green-400 mb-2">${escapeHtml(ue.timeToFirstSale || '< 4 weeks')}</p>
                    <p class="text-neutral-500 text-sm">From idea to first paying customer</p>
                </div>
                <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 class="text-white font-medium mb-4">Build Time</h3>
                    <p class="text-3xl font-medium text-green-400 mb-2">${escapeHtml(ue.buildTime || '1-2 weekends')}</p>
                    <p class="text-neutral-500 text-sm">Typical scope for ideas in this collection</p>
                </div>`;
  }

  return `                <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 class="text-white font-medium mb-4">Customers Needed</h3>
                    <p class="text-3xl font-medium text-green-400 mb-2">${escapeHtml(ue.customersNeeded || '50-250')}</p>
                    <p class="text-neutral-500 text-sm">Paying customers to hit ${escapeHtml(revenue.name)}</p>
                </div>
                <div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h3 class="text-white font-medium mb-4">Price Range</h3>
                    <p class="text-3xl font-medium text-green-400 mb-2">${escapeHtml(ue.priceRange || '$20-100/month')}</p>
                    <p class="text-neutral-500 text-sm">Sweet spot for sustainable MRR at this tier</p>
                </div>`;
}

function generatePricingStrategies() {
  const strategies = [
    { title: 'Tiered SaaS', desc: 'Free tier for discovery, Pro at $29-49/mo, Team at $99+/mo' },
    { title: 'Usage-Based', desc: 'Charge per seat, API call, or workflow run as value scales' },
    { title: 'Annual Discount', desc: 'Offer 2 months free on annual plans to improve cash flow and reduce churn' },
  ];
  return strategies
    .map(
      (s) => `                    <div class="p-4 bg-white/5 rounded-xl">
                        <h3 class="text-white font-medium mb-2">${s.title}</h3>
                        <p class="text-neutral-500 text-sm">${s.desc}</p>
                    </div>`
    )
    .join('\n\n');
}

function generateOtherRevenueGoals(currentSlug) {
  return manifest.revenueGoals
    .filter((r) => r.slug !== currentSlug)
    .slice(0, 4)
    .map(
      (r) => `                <a href="../${r.slug}/" class="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all text-center">
                    <div class="w-10 h-10 mx-auto mb-3 bg-green-500/10 rounded-lg flex items-center justify-center">
                        <iconify-icon icon="lucide:dollar-sign" class="text-green-400" width="20" aria-hidden="true"></iconify-icon>
                    </div>
                    <span class="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">${escapeHtml(r.name)}</span>
                </a>`
    )
    .join('\n');
}

function generateRevenuePage(slug) {
  const revenue = manifest.revenueGoals.find((r) => r.slug === slug);
  if (!revenue) throw new Error(`Revenue goal not found: ${slug}`);
  const ideas = filterRevenueIdeas(slug);
  const template = fs.readFileSync(path.join(ROOT, 'ideas/_template-revenue.html'), 'utf8');
  let html = replaceAll(template, {
    REVENUE_GOAL: revenue.name,
    REVENUE_SLUG: slug,
    REVENUE_DESCRIPTION: revenue.description,
    IDEA_COUNT: ideas.length,
    METHODOLOGY_DESCRIPTION: revenue.methodology,
    REVENUE_PATHS: generateRevenuePaths(revenue),
    IDEAS_GRID: generateIdeasGrid(ideas),
    UNIT_ECONOMICS_EXAMPLES: generateUnitEconomics(revenue),
    PRICING_STRATEGIES: generatePricingStrategies(),
    OTHER_REVENUE_GOALS: generateOtherRevenueGoals(slug),
    ITEM_LIST_ELEMENTS: generateItemListElements(ideas),
  });

  if (revenue.displayName) {
    const metaDescription = `Discover ${ideas.length} ${revenue.displayName.toLowerCase()}. Each includes unit economics, pricing strategies, and build guides.`;
    html = patchMeta(html, {
      title: `${revenue.displayName} | Weekend MVP`,
      description: metaDescription,
    });
  }

  writePage(path.join(ROOT, `ideas/${slug}/index.html`), html);
  return { url: `https://weekendmvp.app/ideas/${slug}/`, count: ideas.length };
}

function generateAudienceAdvantages(traits) {
  const icons = ['lucide:sparkles', 'lucide:target', 'lucide:trending-up'];
  return (traits || []).slice(0, 3).map((trait, i) => {
    const icon = icons[i] || 'lucide:check';
    const title = trait.split(' ').slice(0, 4).join(' ');
    return `                    <div class="p-4 bg-white/5 rounded-2xl">
                        <div class="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mb-3">
                            <iconify-icon icon="${icon}" class="text-white/70" width="20" aria-hidden="true"></iconify-icon>
                        </div>
                        <h3 class="text-white font-medium mb-1">${escapeHtml(title)}</h3>
                        <p class="text-neutral-500 text-sm">${escapeHtml(trait)}</p>
                    </div>`;
  }).join('\n');
}

function generateResources(resources) {
  return (resources || [])
    .map(
      (r) => `                <a href="${r.url}" target="_blank" rel="noopener noreferrer" class="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
                    <h3 class="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">${escapeHtml(r.title)}<span class="sr-only"> (opens in new tab)</span></h3>
                    <p class="text-neutral-500 text-sm">${escapeHtml(r.description)}</p>
                </a>`
    )
    .join('\n\n');
}

function generateOtherAudiences(currentSlug) {
  return manifest.audiences
    .filter((a) => a.slug !== currentSlug)
    .slice(0, 6)
    .map((a) => {
      const color = AUDIENCE_COLORS[a.slug] || 'blue';
      return `                <a href="../${a.slug}/" class="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all text-center">
                    <div class="w-10 h-10 mx-auto mb-3 bg-${color}-500/10 rounded-lg flex items-center justify-center">
                        <iconify-icon icon="${a.icon || 'lucide:users'}" class="text-${color}-400" width="20" aria-hidden="true"></iconify-icon>
                    </div>
                    <span class="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">${escapeHtml(a.name)}</span>
                </a>`;
    })
    .join('\n');
}

function audiencePositioning(audience) {
  const defaults = {
    designers:
      'Designers win when UX is the product. These ideas let you ship polished interfaces fast, sell to creative professionals, or build tools other designers pay for daily.',
    'side-hustlers':
      'Side hustlers need low-maintenance products that earn while you keep your day job. These ideas prioritize automation, async delivery, and clear ROI for busy buyers.',
    'weekend-builders':
      'Weekend builders trade perfection for momentum. These ideas have tight scope, obvious value props, and a realistic path from Friday night to Sunday launch.',
  };
  return defaults[audience.slug] || audience.description;
}

function generateAudiencePage(slug) {
  const audience = manifest.audiences.find((a) => a.slug === slug);
  if (!audience) throw new Error(`Audience not found: ${slug}`);
  const ideas = filterAudienceIdeas(slug);
  const color = AUDIENCE_COLORS[slug] || 'blue';
  const techLevel = audience.filters?.techLevel || 'mixed';
  const buildFilter = audience.filters?.buildTime;
  const timeCommitment = buildFilter
    ? `${buildFilter[0]}-${buildFilter[buildFilter.length - 1]} hours build time`
    : 'Flexible build time';

  const template = fs.readFileSync(path.join(ROOT, 'ideas/_template-audience.html'), 'utf8');
  const html = replaceAll(template, {
    AUDIENCE_NAME: audience.name,
    AUDIENCE_SLUG: slug,
    AUDIENCE_NAME_LOWER: audience.name.toLowerCase(),
    AUDIENCE_DESCRIPTION: audience.description,
    AUDIENCE_ICON: audience.icon || 'lucide:users',
    AUDIENCE_COLOR: color,
    IDEA_COUNT: ideas.length,
    SKILL_LEVEL: techLevel.charAt(0).toUpperCase() + techLevel.slice(1),
    TIME_COMMITMENT: timeCommitment,
    AUDIENCE_POSITIONING: audiencePositioning(audience),
    AUDIENCE_ADVANTAGES: generateAudienceAdvantages(audience.traits),
    IDEAS_GRID: generateIdeasGrid(ideas, '../../ideas/'),
    RESOURCES: generateResources(audience.resources),
    OTHER_AUDIENCES: generateOtherAudiences(slug),
    ITEM_LIST_ELEMENTS: generateItemListElements(ideas),
  });
  writePage(path.join(ROOT, `ideas-for/${slug}/index.html`), html);
  return { url: `https://weekendmvp.app/ideas-for/${slug}/`, count: ideas.length };
}

function updateSitemap(urls) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;

  for (const url of urls) {
    if (sitemap.includes(`<loc>${url}</loc>`)) continue;
    const block = `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

    if (url.includes('/ideas-for/')) {
      sitemap = sitemap.replace(
        '  <!-- Tool Landing Pages -->',
        `${block}\n\n  <!-- Tool Landing Pages -->`
      );
    } else if (url.includes('build-in-') || url.includes('-month') || url.includes('quick-wins')) {
      sitemap = sitemap.replace(
        '  <!-- Tool Landing Pages -->',
        `${block}\n\n  <!-- Tool Landing Pages -->`
      );
    } else {
      sitemap = sitemap.replace(
        '  <!-- Revenue Goal Collections -->',
        `${block}\n\n  <!-- Revenue Goal Collections -->`
      );
    }
    added += 1;
  }

  if (added > 0) {
    fs.writeFileSync(sitemapPath, sitemap, 'utf8');
    console.log(`\n  ✓ sitemap.xml (+${added} URLs)`);
  }
}

function tagDesignersInManifest() {
  const designerSlugs = new Set([
    'meeting-scheduler',
    'habit-tracker',
    'email-to-todo',
    'focus-session-timer',
    'waitlist-manager',
    'social-media-scheduler',
    'daily-standup-bot',
  ]);
  let changed = 0;
  for (const idea of manifest.ideas) {
    if (!designerSlugs.has(idea.slug)) continue;
    if (!idea.audiences) idea.audiences = [];
    if (!idea.audiences.includes('designers')) {
      idea.audiences.push('designers');
      changed += 1;
    }
  }
  if (changed > 0) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`\n  ✓ manifest.json (tagged designers on ${changed} ideas)`);
  }
}

function runSyncNav() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'sync-all-nav.js'), '--write'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  console.log('Generating missing programmatic landing pages...\n');
  tagDesignersInManifest();

  const results = [];

  for (const slug of TARGETS.categories) {
    console.log(`Category: ${slug}`);
    results.push(generateCategoryPage(slug));
  }

  for (const slug of TARGETS.revenue) {
    console.log(`Revenue: ${slug}`);
    results.push(generateRevenuePage(slug));
  }

  for (const slug of TARGETS.audiences) {
    console.log(`Audience: ${slug}`);
    results.push(generateAudiencePage(slug));
  }

  for (const pageConfig of BUILD_TIME_PAGES) {
    console.log(`Build time: ${pageConfig.pathSlug}`);
    results.push(generateBuildTimePage(pageConfig));
  }

  updateSitemap(results.map((r) => r.url));

  runSyncNav();

  console.log('\nSummary:');
  for (const r of results) {
    console.log(`  ${r.url} — ${r.count} ideas`);
  }
}

main();
