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

  // Helper function to escape HTML attributes
  const escapeHtmlAttr = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  // Generate category filter buttons
  const categoryFilters = manifest.categories.map(cat => {
    const count = manifest.ideas.filter(i => i.category === cat.slug).length;
    return `                        <button class="filter-btn px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/40" data-category="${escapeHtmlAttr(cat.slug)}" aria-pressed="false">
                            ${escapeHtmlAttr(cat.name)} (${count})
                        </button>`;
  }).join('\n');

  // Generate visible cards (idea-card HTML)
  const ideaCards = manifest.ideas.map(idea => {
    const categoryLabel = idea.category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const researchLevel = idea.researchLevel || 'quick';
    const researchBadge = researchLevel === 'deep'
      ? '<span class="px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-sky-500/10 text-sky-300/70 border border-sky-500/20">Deep Research</span>'
      : '<span class="px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-white/5 text-neutral-500 border border-white/10">Quick Idea</span>';
    
    const description = (idea.tagline || idea.description || '').toLowerCase();
    const titleLower = idea.title.toLowerCase();

    return `                    <!-- Idea Card: ${idea.title} -->
                    <a href="ideas/${idea.slug}.html" 
                       class="idea-card group block p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl hover:border-white/10 transition-all"
                       data-category="${escapeHtmlAttr(idea.category)}"
                       data-research-level="${escapeHtmlAttr(researchLevel)}"
                       data-title="${escapeHtmlAttr(titleLower)}"
                       data-description="${escapeHtmlAttr(description)}">
                        <div class="flex items-center gap-2 mb-4 flex-wrap">
                            <span class="idea-badge px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider">${categoryLabel}</span>
                            ${researchBadge}
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

  // Replace category filter buttons placeholder
  html = html.replace(
    /<!-- Generate filter buttons from manifest categories -->/,
    categoryFilters
  );

  // Replace idea cards section - find everything between opening and closing div tags of ideas-grid
  const gridStartMarker = '<div id="ideas-grid"';
  const gridStartIdx = html.indexOf(gridStartMarker);
  
  if (gridStartIdx !== -1) {
    // Find the end of the opening tag
    const gridOpeningEnd = html.indexOf('>', gridStartIdx) + 1;
    
    // Find the closing </div> for ideas-grid
    // Look for pattern: </div> (closes ideas-grid) followed by </div> (closes parent) then comment/script/section
    const afterOpening = html.substring(gridOpeningEnd);
    const closingPattern = /<\/div>\s*<\/div>\s*(?:<!-- (?:CTA|Pagination|Load More|Search)|<\/section|<script)/;
    const closingMatch = afterOpening.match(closingPattern);
    
    if (closingMatch) {
      const gridClosingIdx = gridOpeningEnd + closingMatch.index;
      const before = html.substring(0, gridOpeningEnd);
      const after = html.substring(gridClosingIdx);
      html = before + '\n\n' + ideaCards + '\n                ' + after;
    } else {
      // Fallback: look for any </div></div> pattern after ideas-grid
      const simpleClosing = afterOpening.match(/<\/div>\s*<\/div>/);
      if (simpleClosing) {
        const gridClosingIdx = gridOpeningEnd + simpleClosing.index;
        const before = html.substring(0, gridOpeningEnd);
        const after = html.substring(gridClosingIdx);
        html = before + '\n\n' + ideaCards + '\n                ' + after;
      } else {
        console.warn('⚠️  Warning: Could not find closing div for ideas-grid');
      }
    }
  } else {
    console.warn('⚠️  Warning: Could not find ideas-grid div in HTML');
  }

  // Write back
  fs.writeFileSync(path.join(__dirname, '../startup-ideas.html'), html);

  console.log(`✅ Updated startup-ideas.html`);
  console.log(`   - Updated numberOfItems to ${manifest.ideas.length}`);
  console.log(`   - Generated ItemList with ${itemListItems.length} ideas`);
  console.log(`   - Generated ${categoryFilters.split('filter-btn').length - 1} category filter buttons`);
  console.log(`   - Generated ${ideaCards.split('<!-- Idea Card:').length - 1} visible idea cards\n`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
