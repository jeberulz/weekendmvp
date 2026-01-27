#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

try {
  console.log('📝 Generating ItemList for startup-ideas.html...\n');

  // Read manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../ideas/manifest.json'), 'utf8'));

  // Category to applicationCategory mapping
  const categoryMap = {
    'saas': 'BusinessApplication',
    'productivity': 'ProductivityApplication',
    'health': 'HealthApplication',
    'fintech': 'FinanceApplication',
    'education': 'EducationalApplication',
    'developer-tools': 'DeveloperApplication',
    'creator-tools': 'MultimediaApplication',
    'ecommerce': 'ShoppingApplication',
    'automation': 'BusinessApplication',
    'b2b': 'BusinessApplication',
    'marketplace': 'BusinessApplication',
    'ai-tools': 'BusinessApplication'
  };

  // Generate ItemList
  const itemListItems = manifest.ideas.map((idea, index) => {
    const appCategory = categoryMap[idea.category] || 'BusinessApplication';
    return {
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "SoftwareApplication",
        "name": idea.title,
        "applicationCategory": appCategory,
        "description": idea.description || idea.tagline || '',
        "url": `https://weekendmvp.app/ideas/${idea.slug}.html`
      }
    };
  });

  // Generate visible cards (idea-card HTML)
  const ideaCards = manifest.ideas.map(idea => {
    const categoryLabel = idea.category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return `                    <!-- Idea Card: ${idea.title} -->
                    <a href="ideas/${idea.slug}.html" class="idea-card group block p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                        <div class="flex items-center gap-2 mb-4">
                            <span class="idea-badge px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider">${categoryLabel}</span>
                        </div>
                        <h3 class="idea-title text-lg font-medium text-white mb-2 transition-colors">${idea.title}</h3>
                        <p class="text-sm text-neutral-500 leading-relaxed mb-4">${idea.tagline || idea.description || ''}</p>
                        <div class="flex items-center gap-2 text-xs text-neutral-600">
                            <iconify-icon icon="lucide:clock" width="14" aria-hidden="true"></iconify-icon>
                            <span>~${idea.buildTime || 8} hours to build</span>
                        </div>
                    </a>`;
  }).join('\n');

  // Read startup-ideas.html
  let html = fs.readFileSync(path.join(__dirname, '../startup-ideas.html'), 'utf8');

  // Replace numberOfItems
  html = html.replace(
    /"numberOfItems":\s*\d+/,
    `"numberOfItems": ${manifest.ideas.length}`
  );

  // Replace ItemList section
  const itemListJson = JSON.stringify(itemListItems, null, 14).replace(/^/gm, '              ');
  const oldItemList = /"itemListElement":\s*\[[\s\S]*?\n\s*\]/;
  html = html.replace(
    oldItemList,
    `"itemListElement": ${itemListJson.trim()}`
  );

  // Replace idea cards section
  const oldCardsSection = /<!-- Idea Card:[\s\S]*?<\/a>\n\s*$/m;
  const startIdx = html.indexOf('<!-- Ideas Grid -->');
  const endIdx = html.indexOf('</div>\n        </div>\n\n                <!-- Pagination');

  if (startIdx !== -1 && endIdx !== -1) {
    const before = html.substring(0, html.indexOf('<div id="ideas-grid"') + '<div id="ideas-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">'.length);
    const after = html.substring(html.lastIndexOf('\n\n                </div>', endIdx) + 1);

    html = before + '\n\n' + ideaCards + '\n' + after;
  }

  // Write back
  fs.writeFileSync(path.join(__dirname, '../startup-ideas.html'), html);

  console.log(`✅ Updated startup-ideas.html`);
  console.log(`   - Updated numberOfItems to ${manifest.ideas.length}`);
  console.log(`   - Generated ItemList with ${itemListItems.length} ideas`);
  console.log(`   - Generated ${ideaCards.split('<!-- Idea Card:').length - 1} visible idea cards\n`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
