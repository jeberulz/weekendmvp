---
name: Add Search Filters Load More and Research Badges
overview: Add search, category filters, load more functionality, and research level badges (quick/deep) to startup-ideas.html. Generate all idea cards dynamically from manifest.json with client-side filtering.
todos:
  - id: "1"
    content: Add researchLevel field to all ideas in manifest.json (deep for manually published, quick for programmatic)
    status: completed
  - id: "2"
    content: Update scripts/update-startup-ideas.js to generate all idea cards with data attributes (category, research-level, title, description)
    status: pending
  - id: "3"
    content: Add search input and category filter buttons UI to startup-ideas.html before ideas-grid
    status: pending
  - id: "4"
    content: Update idea card template in update-startup-ideas.js to include research level badges
    status: pending
  - id: "5"
    content: Add client-side filtering JavaScript (search, category filter, load more) to startup-ideas.html
    status: pending
  - id: "6"
    content: Add Load More button after ideas-grid in startup-ideas.html
    status: pending
  - id: "7"
    content: Generate category filter buttons dynamically from manifest.json categories
    status: pending
  - id: "8"
    content: Test filtering, search, and load more functionality
    status: pending
isProject: false
---

# Add Search, Filters, Load More, and Research Badges to startup-ideas.html

## Overview

Transform `startup-ideas.html` from a static list to a dynamic, filterable interface that:

- Shows all ideas from `manifest.json` (currently ~50+ ideas)
- Adds search functionality
- Adds category filter buttons
- Implements "Load More" pagination (shows 12 at a time)
- Adds research level badges ("Deep Research" vs "Quick Idea")
- Maintains SEO (all content in HTML, client-side filtering)

## Implementation Steps

### 1. Update manifest.json Structure

Add `researchLevel` field to each idea in `ideas/manifest.json`:

- **"deep"** - Ideas published via `/publish-idea` skill (comprehensive research)
- **"quick"** - Ideas published programmatically (less research)

Default logic:

- Ideas published before 2026-01-27 → `"deep"` (manually published)
- Ideas published on/after 2026-01-27 → `"quick"` (programmatic batch)

Update all ideas in manifest.json to include:

```json
{
  "slug": "...",
  "title": "...",
  "researchLevel": "deep", // or "quick"
  ...
}
```

### 2. Generate All Idea Cards Dynamically

Modify `startup-ideas.html` to generate idea cards from `manifest.json`:

**Option A: Server-side generation (recommended)**

- Update `scripts/update-startup-ideas.js` to generate all cards
- Include `data-*` attributes for filtering:
  - `data-category="productivity"`
  - `data-research-level="deep"`
  - `data-title="AI Meeting Notes Cleaner"`
  - `data-description="..."`

**Option B: Client-side generation**

- Load `manifest.json` via fetch
- Generate cards in JavaScript
- Less SEO-friendly (content not in initial HTML)

**Recommendation:** Use Option A (server-side) for SEO, add data attributes for client-side filtering.

### 3. Add Search and Filter UI

Insert before `<div id="ideas-grid">` in `startup-ideas.html`:

```html
<!-- Search and Filters -->
<div class="mb-8 space-y-4">
    <!-- Search Input -->
    <div class="relative">
        <iconify-icon icon="lucide:search" width="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true"></iconify-icon>
        <input 
            type="text" 
            id="idea-search" 
            placeholder="Search ideas..." 
            class="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
            aria-label="Search startup ideas"
        >
    </div>
    
    <!-- Category Filters -->
    <div class="flex flex-wrap gap-2" id="category-filters" role="group" aria-label="Filter by category">
        <button class="filter-btn active px-4 py-2 bg-white text-black rounded-full text-sm font-medium transition-all" data-category="all" aria-pressed="true">
            All Ideas
        </button>
        <!-- Generate filter buttons from manifest categories -->
    </div>
</div>
```

### 4. Update Idea Card Template

Modify card generation in `scripts/update-startup-ideas.js` to include:

```javascript
const ideaCards = manifest.ideas.map(idea => {
    const categoryLabel = idea.category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const researchLevel = idea.researchLevel || 'quick';
    const researchBadge = researchLevel === 'deep' 
      ? '<span class="px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">Deep Research</span>'
      : '<span class="px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-neutral-500/20 text-neutral-400 border border-neutral-500/30">Quick Idea</span>';
    
    return `                    <!-- Idea Card: ${idea.title} -->
                    <a href="ideas/${idea.slug}.html" 
                       class="idea-card group block p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl hover:border-white/10 transition-all"
                       data-category="${idea.category}"
                       data-research-level="${researchLevel}"
                       data-title="${idea.title.toLowerCase()}"
                       data-description="${(idea.tagline || idea.description || '').toLowerCase()}">
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
```

### 5. Add Client-Side Filtering JavaScript

Add to `startup-ideas.html` before closing `</body>`:

```javascript
<script>
(function() {
    const IDEAS_PER_PAGE = 12;
    let currentPage = 1;
    let activeCategory = 'all';
    let searchQuery = '';
    
    const ideaCards = Array.from(document.querySelectorAll('.idea-card'));
    const searchInput = document.getElementById('idea-search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const loadMoreBtn = document.getElementById('load-more');
    
    // Filter function
    function filterIdeas() {
        const filtered = ideaCards.filter(card => {
            const matchesCategory = activeCategory === 'all' || 
                card.dataset.category === activeCategory;
            const matchesSearch = !searchQuery || 
                card.dataset.title.includes(searchQuery.toLowerCase()) ||
                card.dataset.description.includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
        
        // Hide all, show filtered up to current page
        ideaCards.forEach(card => {
            card.style.display = 'none';
        });
        
        const toShow = filtered.slice(0, currentPage * IDEAS_PER_PAGE);
        toShow.forEach(card => {
            card.style.display = 'block';
        });
        
        // Show/hide load more button
        if (filtered.length > currentPage * IDEAS_PER_PAGE) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
        
        // Show "no results" message if needed
        const noResults = document.getElementById('no-results');
        if (filtered.length === 0) {
            if (!noResults) {
                const grid = document.getElementById('ideas-grid');
                const msg = document.createElement('div');
                msg.id = 'no-results';
                msg.className = 'col-span-full text-center py-12';
                msg.innerHTML = '<p class="text-neutral-500">No ideas found. Try a different search or filter.</p>';
                grid.appendChild(msg);
            }
        } else if (noResults) {
            noResults.remove();
        }
    }
    
    // Search handler
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1; // Reset to first page
        filterIdeas();
    });
    
    // Category filter handler
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            activeCategory = btn.dataset.category;
            currentPage = 1; // Reset to first page
            
            // Update active state
            filterButtons.forEach(b => {
                b.classList.remove('active', 'bg-white', 'text-black');
                b.classList.add('bg-white/5', 'border', 'border-white/10', 'text-neutral-400');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active', 'bg-white', 'text-black');
            btn.classList.remove('bg-white/5', 'border', 'border-white/10', 'text-neutral-400');
            btn.setAttribute('aria-pressed', 'true');
            
            filterIdeas();
        });
    });
    
    // Load more handler
    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        filterIdeas();
        // Scroll to load more button
        loadMoreBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    // Initial filter
    filterIdeas();
})();
</script>
```

### 6. Add Load More Button

Add after `</div>` closing `ideas-grid`:

```html
<!-- Load More Button -->
<button id="load-more" class="mt-8 mx-auto px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40">
    Load More Ideas
</button>
```

### 7. Generate Category Filter Buttons

Update `scripts/update-startup-ideas.js` to generate filter buttons from manifest categories:

```javascript
const categoryFilters = manifest.categories.map(cat => {
    const count = manifest.ideas.filter(i => i.category === cat.slug).length;
    return `        <button class="filter-btn px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/40" data-category="${cat.slug}" aria-pressed="false">
            ${cat.name} (${count})
        </button>`;
}).join('\n');
```

Then inject into HTML where `<!-- Generate filter buttons from manifest categories -->` placeholder is.

### 8. Update Script to Handle All Ideas

Modify `scripts/update-startup-ideas.js`:

- Remove placeholder "More ideas coming soon" card
- Generate all idea cards with data attributes
- Generate category filter buttons
- Ensure all ideas are in HTML (for SEO)

### 9. Set Research Levels in Manifest

Add `researchLevel` to all ideas:

- Ideas with `publishedAt` before "2026-01-27" → `"deep"`
- Ideas with `publishedAt` on/after "2026-01-27" → `"quick"`

Or manually mark:

- First 14 ideas (currently on page) → `"deep"`
- Rest → `"quick"`

## Files to Modify

1. **`ideas/manifest.json`** - Add `researchLevel` field to all ideas
2. **`scripts/update-startup-ideas.js`** - Update to generate all cards with data attributes and filter buttons
3. **`startup-ideas.html`** - Add search/filter UI and JavaScript

## Testing Checklist

- [ ] All ideas from manifest appear in HTML (SEO check)
- [ ] Search filters ideas by title/description
- [ ] Category filters work correctly
- [ ] Load More shows 12 at a time
- [ ] Research badges display correctly
- [ ] No results message shows when appropriate
- [ ] Filter buttons update active state
- [ ] Works without JavaScript (progressive enhancement)
- [ ] Accessibility: keyboard navigation, ARIA labels

## SEO Considerations

- All idea cards remain in HTML (crawlers see everything)
- Client-side filtering doesn't affect SEO
- Data attributes don't hurt SEO
- Load More is progressive enhancement (all content visible to bots)