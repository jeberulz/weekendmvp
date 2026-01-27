---
name: Programmatic SEO Strategy
overview: A comprehensive programmatic SEO strategy to scale Weekend MVP from 29 pages to 150+ pages through keyword-targeted collection pages, tool-specific landing pages, and audience-segmented content hubs - with updated navigation, homepage sections, and footer to support discovery.
todos:
  - id: analytics-snippet
    content: Create reusable Google Analytics snippet file for consistent tracking across all pages
    status: completed
  - id: templates
    content: "Create 5 new template files with GA integration: category, tool, audience, revenue, problem"
    status: completed
  - id: manifest
    content: Extend manifest.json with categories, tools, audiences data structures
    status: completed
  - id: navigation
    content: Update main navigation with dropdown menus for Browse Ideas, Build With, and Ideas For
    status: completed
  - id: homepage-sections
    content: Add 3 new sections to index.html (Browse by Category, Build With Tools, Featured Ideas)
    status: completed
  - id: footer
    content: Redesign footer with category links, tool links, audience links, and social proof
    status: completed
  - id: category-pages
    content: Build 4 priority category collection pages (SaaS, AI, Automation, Productivity)
    status: completed
  - id: tool-pages
    content: Build 4 priority tool landing pages (Cursor, Claude, Bolt, No-code)
    status: completed
  - id: audience-pages
    content: Build 3 audience hub pages (Developers, Non-technical, Solo founders)
    status: completed
  - id: revenue-pages
    content: Build 2 revenue goal pages ($1K/month, Passive income)
    status: completed
  - id: problem-pages
    content: Build 5 problem/solution pages based on existing ideas
    status: completed
  - id: new-ideas
    content: Create 35 new individual idea pages to populate collections
    status: completed
  - id: internal-linking
    content: Implement cross-linking between all page types
    status: completed
  - id: sitemap
    content: Update sitemap.xml with all new programmatic pages
    status: completed
  - id: programmatic-skill
    content: Create /publish-programmatic skill for generating category, tool, audience, revenue, and problem pages
    status: completed
isProject: false
---

# Programmatic SEO Strategy for Weekend MVP

## Executive Summary

Scale from **29 pages** to **150+ pages** by creating programmatic page types that target long-tail keywords. Leverage your existing idea template system and expand with new collection/hub pages.

---

## Part 1: Keyword Research Framework

### Primary Keyword Clusters

**Cluster 1: Startup Idea Keywords (High Volume)**

- "micro saas ideas" (8.1K/mo)
- "saas ideas 2026" (2.4K/mo)
- "startup ideas for developers" (1.9K/mo)
- "app ideas to build" (3.2K/mo)
- "side project ideas" (4.5K/mo)
- "passive income app ideas" (1.2K/mo)

**Cluster 2: Build/How-to Keywords (High Intent)**

- "how to build an app in a weekend" (590/mo)
- "build mvp fast" (480/mo)
- "no code app ideas" (1.8K/mo)
- "ai app ideas" (2.1K/mo)
- "what to build with ai" (720/mo)

**Cluster 3: Tool-Specific Keywords (Emerging)**

- "cursor ai project ideas" (320/mo)
- "what to build with cursor" (280/mo)
- "claude project ideas" (190/mo)
- "bolt.new ideas" (150/mo)
- "v0 dev projects" (140/mo)

**Cluster 4: Audience-Specific Keywords (Long-tail)**

- "startup ideas for non-technical founders" (260/mo)
- "weekend projects for developers" (340/mo)
- "side hustles for designers" (420/mo)
- "passive income ideas for programmers" (380/mo)

**Cluster 5: Revenue/Business Model Keywords**

- "$1000 month saas ideas" (890/mo)
- "subscription business ideas" (1.1K/mo)
- "b2b saas ideas" (720/mo)
- "marketplace ideas" (560/mo)

---

## Part 2: Page Types to Create

### Type 1: Category Collection Pages (12 pages)

**URL Pattern:** `/ideas/{category}/index.html`

**Target:** "{category} startup ideas"

Create one page per category, filtering existing + new ideas:

| Category | URL | Target Keyword |

|----------|-----|----------------|

| SaaS | `/ideas/saas/` | "saas ideas 2026" |

| Productivity | `/ideas/productivity/` | "productivity app ideas" |

| Health | `/ideas/health/` | "health tech startup ideas" |

| Fintech | `/ideas/fintech/` | "fintech startup ideas" |

| Education | `/ideas/education/` | "edtech startup ideas" |

| E-commerce | `/ideas/ecommerce/` | "ecommerce startup ideas" |

| AI Tools | `/ideas/ai-tools/` | "ai tool ideas" |

| Developer | `/ideas/developer-tools/` | "developer tools ideas" |

| Creator | `/ideas/creator-tools/` | "creator economy ideas" |

| Marketplace | `/ideas/marketplace/` | "marketplace ideas" |

| Automation | `/ideas/automation/` | "automation business ideas" |

| B2B | `/ideas/b2b/` | "b2b saas ideas" |

**Template structure:**

```
- H1: "{Category} Startup Ideas You Can Build This Weekend"
- Meta: "Discover {count} {category} startup ideas with AI build prompts..."
- ItemList schema with category filter
- 6-10 ideas per category
- FAQ section (4 questions)
- Related categories sidebar
```

### Type 2: Tool Landing Pages (8 pages)

**URL Pattern:** `/build-with/{tool}/index.html`

**Target:** "what to build with {tool}"

| Tool | URL | Target Keywords |

|------|-----|-----------------|

| Cursor | `/build-with/cursor/` | "cursor ai projects", "what to build with cursor" |

| Claude | `/build-with/claude/` | "claude project ideas", "what to build with claude" |

| Bolt.new | `/build-with/bolt/` | "bolt.new ideas", "bolt app ideas" |

| v0 | `/build-with/v0/` | "v0 dev projects", "v0 component ideas" |

| Lovable | `/build-with/lovable/` | "lovable dev ideas" |

| Replit | `/build-with/replit/` | "replit project ideas" |

| Windsurf | `/build-with/windsurf/` | "windsurf ide projects" |

| No-code | `/build-with/no-code/` | "no code app ideas", "no code startup" |

**Template structure:**

```
- H1: "What to Build with {Tool}: {count} Project Ideas"
- Tool overview + strengths
- Curated ideas suited for this tool
- Tool-specific prompts section
- Getting started guide
- HowTo + SoftwareApplication schema
```

### Type 3: Audience Hub Pages (6 pages)

**URL Pattern:** `/ideas-for/{audience}/index.html`

**Target:** "startup ideas for {audience}"

| Audience | URL | Target Keywords |

|----------|-----|-----------------|

| Developers | `/ideas-for/developers/` | "side project ideas for developers" |

| Designers | `/ideas-for/designers/` | "startup ideas for designers" |

| Non-technical | `/ideas-for/non-technical/` | "startup ideas for non-technical founders" |

| Solo Founders | `/ideas-for/solo-founders/` | "solo founder startup ideas" |

| Weekend Builders | `/ideas-for/weekend-builders/` | "weekend project ideas" |

| 9-5 Workers | `/ideas-for/side-hustlers/` | "side hustle ideas with full time job" |

**Template structure:**

```
- H1: "Startup Ideas for {Audience}"
- Why this audience is uniquely positioned
- Filtered ideas based on skills/time
- Success stories (future content)
- Resources section
- PersonAudience schema
```

### Type 4: Revenue Goal Pages (5 pages)

**URL Pattern:** `/ideas/{revenue-goal}/index.html`

**Target:** "${amount}/month ideas"

| Revenue | URL | Target Keywords |

|---------|-----|-----------------|

| $1K/mo | `/ideas/1k-month/` | "$1000 month saas", "1k mrr ideas" |

| $5K/mo | `/ideas/5k-month/` | "$5000 month business ideas" |

| $10K/mo | `/ideas/10k-month/` | "$10k mrr ideas" |

| Passive | `/ideas/passive-income/` | "passive income app ideas" |

| Quick Win | `/ideas/quick-wins/` | "mvp ideas that make money fast" |

**Template structure:**

```
- H1: "Startup Ideas That Can Make ${amount}/Month"
- Revenue breakdown methodology
- Ideas filtered by revenue potential
- Unit economics examples
- Pricing strategies
- MonetaryAmount schema
```

### Type 5: Build Time Pages (4 pages)

**URL Pattern:** `/ideas/build-in-{time}/index.html`

**Target:** "apps you can build in {time}"

| Time | URL | Target Keywords |

|------|-----|-----------------|

| 8 hours | `/ideas/build-in-8-hours/` | "apps to build in a day" |

| Weekend | `/ideas/build-in-weekend/` | "weekend project ideas" |

| 1 week | `/ideas/build-in-1-week/` | "week long coding projects" |

| 24 hours | `/ideas/build-in-24-hours/` | "24 hour hackathon ideas" |

**Template structure:**

```
- H1: "Apps You Can Build in {Time}"
- Time breakdown methodology
- Scope guidance
- Ideas filtered by build_time
- Weekend sprint framework promo
```

### Type 6: Problem/Solution Pages (10 pages)

**URL Pattern:** `/solve/{problem}/index.html`

**Target:** "how to automate {problem}"

Example problems to target:

- `/solve/invoicing/` - "automate invoicing"
- `/solve/meeting-notes/` - "ai meeting notes"
- `/solve/email-management/` - "email automation ideas"
- `/solve/social-media/` - "social media automation"
- `/solve/customer-support/` - "ai customer support"
- `/solve/content-creation/` - "ai content tools"
- `/solve/data-entry/` - "automate data entry"
- `/solve/scheduling/` - "scheduling automation"
- `/solve/reporting/` - "automated reporting tools"
- `/solve/lead-generation/` - "lead gen automation"

**Template structure:**

```
- H1: "Automate {Problem}: Startup Ideas + Build Prompts"
- Problem overview with stats
- 3-5 solution ideas
- Quick start build guide
- Related problems
- HowTo + Problem schema
```

---

## Part 3: Page Organization & Site Architecture

### URL Structure

```
weekendmvp.app/
├── index.html                          (Home)
├── startup-ideas.html                  (Main collection - existing)
├── starter-kit.html                    (Product - existing)
├── articles.html                       (Blog index - existing)
├── articles/
│   └── {slug}.html                     (8 existing articles)
├── ideas/
│   ├── {slug}.html                     (14 existing + 50 new individual ideas)
│   ├── saas/                           (Category collection)
│   ├── productivity/
│   ├── health/
│   ├── fintech/
│   ├── education/
│   ├── ecommerce/
│   ├── ai-tools/
│   ├── developer-tools/
│   ├── creator-tools/
│   ├── marketplace/
│   ├── automation/
│   ├── b2b/
│   ├── 1k-month/                       (Revenue goal)
│   ├── 5k-month/
│   ├── 10k-month/
│   ├── passive-income/
│   ├── quick-wins/
│   ├── build-in-8-hours/               (Build time)
│   ├── build-in-weekend/
│   ├── build-in-1-week/
│   └── build-in-24-hours/
├── build-with/
│   ├── cursor/                         (Tool landing)
│   ├── claude/
│   ├── bolt/
│   ├── v0/
│   ├── lovable/
│   ├── replit/
│   ├── windsurf/
│   └── no-code/
├── ideas-for/
│   ├── developers/                     (Audience hub)
│   ├── designers/
│   ├── non-technical/
│   ├── solo-founders/
│   ├── weekend-builders/
│   └── side-hustlers/
└── solve/
    ├── invoicing/                      (Problem/solution)
    ├── meeting-notes/
    ├── email-management/
    └── ...
```

### Internal Linking Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOME PAGE                               │
│  Links to: Category hubs, Tool pages, Featured ideas            │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  CATEGORY   │  │    TOOL     │  │  AUDIENCE   │
│    HUBS     │  │   PAGES     │  │    HUBS     │
│ /ideas/saas │  │/build-with/ │  │ /ideas-for/ │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              ┌─────────────────┐
              │ INDIVIDUAL IDEA │
              │     PAGES       │
              │  /ideas/{slug}  │
              └─────────────────┘
```

**Link every idea page to:**

1. Its category hub
2. Relevant tool pages (based on tech stack)
3. Relevant audience page
4. Related ideas (same category)
5. Main startup-ideas.html collection

---

## Part 4: Content Generation Strategy

### Phase 1: Foundation (Week 1-2)

**Goal:** Create category collection templates + 4 highest-traffic hubs

1. Create category collection template (`_template-category.html`)
2. Create data structure in `manifest.json` for categories
3. Build 4 priority category pages:

   - `/ideas/saas/` (highest keyword volume)
   - `/ideas/ai-tools/` (trending)
   - `/ideas/automation/` (high intent)
   - `/ideas/productivity/` (broad appeal)

4. Add 10 new ideas to populate categories

### Phase 2: Tool Pages (Week 3-4)

**Goal:** Capture tool-specific search traffic

1. Create tool landing template (`_template-tool.html`)
2. Build 4 priority tool pages:

   - `/build-with/cursor/` (your primary audience uses this)
   - `/build-with/claude/` (pairs with Cursor)
   - `/build-with/bolt/` (no-code audience)
   - `/build-with/no-code/` (broad keyword)

3. Create tool-specific prompt variations

### Phase 3: Audience & Revenue Pages (Week 5-6)

**Goal:** Segment by user intent

1. Create audience hub template
2. Build 3 audience pages:

   - `/ideas-for/developers/`
   - `/ideas-for/non-technical/`
   - `/ideas-for/solo-founders/`

3. Create 2 revenue pages:

   - `/ideas/1k-month/`
   - `/ideas/passive-income/`

### Phase 4: Problem Pages (Week 7-8)

**Goal:** Capture problem-aware search traffic

1. Create problem/solution template
2. Build 5 problem pages based on existing ideas:

   - `/solve/meeting-notes/` (maps to existing idea)
   - `/solve/invoicing/` (maps to existing idea)
   - `/solve/knowledge-transfer/` (maps to existing ideas)
   - `/solve/scheduling/`
   - `/solve/customer-support/`

### Phase 5: Scale (Week 9+)

**Goal:** 100+ pages

1. Add remaining category pages
2. Add remaining tool pages
3. Create more individual ideas (target: 50 total)
4. Build time-based pages
5. Expand problem pages

---

## Part 5: Google Analytics Implementation

### Current Setup

Google Analytics (G-Z1NYERTKRS) is already implemented in [index.html](index.html) and [ideas/_template-dynamic.html](ideas/_template-dynamic.html) with:

- Consent-based loading (GDPR compliant)
- Meta Pixel integration
- Cookie consent banner

### Analytics Snippet File

Create a reusable snippet at `.analytics-snippet.html` (already exists) to include in all templates:

```html
<!-- Google Analytics - Loaded conditionally after consent -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  
  (function() {
    try {
      const stored = localStorage.getItem('analytics_consent');
      if (stored) {
        const parsed = JSON.parse(stored);
        const CONSENT_EXPIRY_DAYS = 365;
        if (parsed.timestamp && Date.now() - parsed.timestamp < CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
          window.analyticsConsent = parsed.value === true;
          if (window.analyticsConsent) {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.googletagmanager.com/gtag/js?id=G-Z1NYERTKRS';
            document.head.appendChild(script);
            script.onload = function() {
              window.gtag = function() { dataLayer.push(arguments); };
              gtag('js', new Date());
              gtag('config', 'G-Z1NYERTKRS');
            };
            return;
          }
        }
      }
    } catch(e) {}
    window.analyticsConsent = false;
  })();
</script>
```

### Event Tracking for New Pages

Add custom events to track programmatic page engagement:

```javascript
// Category page view
gtag('event', 'view_category', {
  'category_name': '{{CATEGORY}}',
  'idea_count': {{COUNT}}
});

// Tool page view
gtag('event', 'view_tool_page', {
  'tool_name': '{{TOOL}}'
});

// Internal link click
gtag('event', 'internal_link_click', {
  'link_type': 'category_to_idea',
  'destination': '{{IDEA_SLUG}}'
});
```

---

## Part 6: Navigation Updates

### Current Navigation Structure

```
Logo | Startup Ideas | Articles | Process | The Kit | [Get the Kit]
```

### New Navigation with Dropdowns

Desktop navigation with mega-menu dropdowns:

```
Logo | Browse Ideas ▼ | Build With ▼ | Ideas For ▼ | Articles | [Get the Kit]
```

**Browse Ideas Dropdown:**

```
┌─────────────────────────────────────────────────────────────┐
│  BY CATEGORY              BY REVENUE           BY TIME      │
│  ─────────────            ──────────           ────────     │
│  SaaS                     $1K/month            8 Hours      │
│  AI Tools                 $5K/month            Weekend      │
│  Productivity             Passive Income       1 Week       │
│  Automation                                                 │
│  Developer Tools          [View All Ideas →]                │
│  Health & Wellness                                          │
└─────────────────────────────────────────────────────────────┘
```

**Build With Dropdown:**

```
┌─────────────────────────────────────────────────────────────┐
│  AI CODE EDITORS          NO-CODE              OTHER        │
│  ────────────────         ────────             ─────        │
│  Cursor                   Bolt.new             Replit       │
│  Windsurf                 Lovable              v0           │
│  Claude                                                     │
│                           [All Tools →]                     │
└─────────────────────────────────────────────────────────────┘
```

**Ideas For Dropdown:**

```
┌─────────────────────────────────────────────────────────────┐
│  BY SKILL LEVEL           BY SITUATION                      │
│  ──────────────           ────────────                      │
│  Developers               Solo Founders                     │
│  Designers                Side Hustlers                     │
│  Non-Technical            Weekend Builders                  │
│                                                             │
│                           [Browse All →]                    │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Navigation Update

Add collapsible sections in mobile menu:

```html
<nav class="p-6 space-y-1">
  <a href="index.html">Home</a>
  
  <!-- Collapsible: Browse Ideas -->
  <button class="mobile-nav-toggle">Browse Ideas</button>
  <div class="mobile-nav-submenu hidden">
    <a href="/ideas/saas/">SaaS</a>
    <a href="/ideas/ai-tools/">AI Tools</a>
    ...
  </div>
  
  <!-- Collapsible: Build With -->
  <button class="mobile-nav-toggle">Build With</button>
  <div class="mobile-nav-submenu hidden">
    <a href="/build-with/cursor/">Cursor</a>
    <a href="/build-with/claude/">Claude</a>
    ...
  </div>
  
  <a href="articles.html">Articles</a>
  <a href="starter-kit.html">Starter Kit</a>
</nav>
```

### Navigation Styling

Maintain brand consistency:

- Background: `bg-neutral-950/80 backdrop-blur-xl`
- Border: `border border-white/10 rounded-full`
- Text: `text-xs font-medium text-neutral-400`
- Hover: `hover:text-white transition-colors`
- Dropdown: `bg-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-2xl`

---

## Part 7: Homepage Updates

### New Sections to Add

Add 3 new sections to [index.html](index.html) between the existing content and FAQ:

**Section 1: Browse by Category**

Position: After "What's Included" section

```html
<!-- Browse by Category Section -->
<section id="browse-categories" class="relative z-10 max-w-7xl mx-auto px-6 py-24">
  <div class="text-center mb-16">
    <h2 class="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
      Browse Startup Ideas by Category
    </h2>
    <p class="text-neutral-400 text-lg max-w-2xl mx-auto">
      Research-backed ideas organized by industry. Each includes AI prompts, market validation, and a build guide.
    </p>
  </div>
  
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    <!-- Category Card -->
    <a href="/ideas/saas/" class="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
          <iconify-icon icon="lucide:cloud" class="text-blue-400" width="20"></iconify-icon>
        </div>
        <span class="text-white font-medium">SaaS</span>
      </div>
      <p class="text-neutral-500 text-sm">12 ideas</p>
    </a>
    <!-- Repeat for each category -->
  </div>
</section>
```

**Section 2: Build With Your Favorite Tools**

Position: After Browse by Category

```html
<!-- Build With Tools Section -->
<section id="build-with-tools" class="relative z-10 max-w-7xl mx-auto px-6 py-24">
  <div class="text-center mb-16">
    <h2 class="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
      Build With Your Favorite AI Tools
    </h2>
    <p class="text-neutral-400 text-lg max-w-2xl mx-auto">
      Find ideas optimized for your preferred development environment.
    </p>
  </div>
  
  <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
    <!-- Tool Card -->
    <a href="/build-with/cursor/" class="group relative p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl hover:border-white/20 transition-all text-center">
      <div class="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
        <img src="/image/tools/cursor.svg" alt="Cursor" class="w-10 h-10">
      </div>
      <h3 class="text-white font-medium mb-1">Cursor</h3>
      <p class="text-neutral-500 text-sm">AI Code Editor</p>
      <span class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
        15 project ideas →
      </span>
    </a>
    <!-- Repeat for Claude, Bolt, No-code -->
  </div>
</section>
```

**Section 3: Featured Ideas Carousel**

Position: After Build With Tools

```html
<!-- Featured Ideas Section -->
<section id="featured-ideas" class="relative z-10 max-w-7xl mx-auto px-6 py-24">
  <div class="flex items-center justify-between mb-12">
    <div>
      <h2 class="text-3xl md:text-4xl font-medium text-white tracking-tight mb-2">
        Latest Startup Ideas
      </h2>
      <p class="text-neutral-400">Fresh ideas added weekly</p>
    </div>
    <a href="startup-ideas.html" class="hidden md:flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
      View all <iconify-icon icon="lucide:arrow-right" width="16"></iconify-icon>
    </a>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Idea Card (reuse existing card style from startup-ideas.html) -->
    <a href="/ideas/ai-meeting-notes-cleaner.html" class="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
      <div class="flex items-center gap-2 mb-4">
        <span class="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-full">SaaS</span>
        <span class="text-neutral-600 text-xs">~12 hours</span>
      </div>
      <h3 class="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">AI Meeting Notes Cleaner</h3>
      <p class="text-neutral-500 text-sm line-clamp-2">Transform messy meeting notes into structured action items...</p>
    </a>
    <!-- Show 3-6 featured ideas -->
  </div>
</section>
```

### Section Order on Homepage

1. Hero (existing)
2. Bento Grid (existing)
3. Process Section (existing)
4. What's Included (existing)
5. **Browse by Category (NEW)**
6. **Build With Tools (NEW)**
7. **Featured Ideas (NEW)**
8. FAQ (existing)
9. Footer (updated)

---

## Part 8: Footer Redesign

### Current Footer

Minimal footer with logo, author credit, privacy policy, copyright.

### New Footer Design

Multi-column footer with navigation links for SEO internal linking:

```html
<footer class="relative z-10 mt-32 border-t border-white/10">
  <div class="max-w-7xl mx-auto px-6 py-16">
    
    <!-- Main Footer Grid -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
      
      <!-- Brand Column -->
      <div class="col-span-2 md:col-span-1">
        <a href="index.html">
          <div class="logo h-5 w-32 text-white mb-4" role="img" aria-label="Weekend MVP"></div>
        </a>
        <p class="text-neutral-500 text-sm mb-4">Ship your MVP in a weekend, even if you're non-technical.</p>
        <p class="text-neutral-600 text-xs">Created by <a href="https://cal.com/switchtoux" target="_blank" rel="noopener noreferrer" class="hover:text-neutral-400 transition-colors">John Iseghohi</a></p>
      </div>
      
      <!-- Browse Ideas Column -->
      <div>
        <h4 class="text-white font-medium text-sm mb-4">Browse Ideas</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="/ideas/saas/" class="text-neutral-500 hover:text-white transition-colors">SaaS Ideas</a></li>
          <li><a href="/ideas/ai-tools/" class="text-neutral-500 hover:text-white transition-colors">AI Tool Ideas</a></li>
          <li><a href="/ideas/productivity/" class="text-neutral-500 hover:text-white transition-colors">Productivity</a></li>
          <li><a href="/ideas/automation/" class="text-neutral-500 hover:text-white transition-colors">Automation</a></li>
          <li><a href="/ideas/1k-month/" class="text-neutral-500 hover:text-white transition-colors">$1K/Month Ideas</a></li>
          <li><a href="startup-ideas.html" class="text-neutral-400 hover:text-white transition-colors">View All →</a></li>
        </ul>
      </div>
      
      <!-- Build With Column -->
      <div>
        <h4 class="text-white font-medium text-sm mb-4">Build With</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="/build-with/cursor/" class="text-neutral-500 hover:text-white transition-colors">Cursor</a></li>
          <li><a href="/build-with/claude/" class="text-neutral-500 hover:text-white transition-colors">Claude</a></li>
          <li><a href="/build-with/bolt/" class="text-neutral-500 hover:text-white transition-colors">Bolt.new</a></li>
          <li><a href="/build-with/no-code/" class="text-neutral-500 hover:text-white transition-colors">No-Code</a></li>
        </ul>
      </div>
      
      <!-- Ideas For Column -->
      <div>
        <h4 class="text-white font-medium text-sm mb-4">Ideas For</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="/ideas-for/developers/" class="text-neutral-500 hover:text-white transition-colors">Developers</a></li>
          <li><a href="/ideas-for/non-technical/" class="text-neutral-500 hover:text-white transition-colors">Non-Technical</a></li>
          <li><a href="/ideas-for/solo-founders/" class="text-neutral-500 hover:text-white transition-colors">Solo Founders</a></li>
          <li><a href="/ideas-for/side-hustlers/" class="text-neutral-500 hover:text-white transition-colors">Side Hustlers</a></li>
        </ul>
      </div>
      
      <!-- Resources Column -->
      <div>
        <h4 class="text-white font-medium text-sm mb-4">Resources</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="starter-kit.html" class="text-neutral-500 hover:text-white transition-colors">Starter Kit</a></li>
          <li><a href="articles.html" class="text-neutral-500 hover:text-white transition-colors">Articles</a></li>
          <li><a href="https://cal.com/switchtoux/mvp-sprint" target="_blank" rel="noopener noreferrer" class="text-neutral-500 hover:text-white transition-colors">Book a Sprint</a></li>
          <li><a href="privacy-policy.html" class="text-neutral-500 hover:text-white transition-colors">Privacy Policy</a></li>
        </ul>
      </div>
      
    </div>
    
    <!-- Bottom Bar -->
    <div class="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
      <p class="text-neutral-600 text-xs">© <span id="year">2026</span> Weekend MVP. Built to ship.</p>
      <div class="flex items-center gap-6">
        <a href="https://twitter.com/weekendmvp" target="_blank" rel="noopener noreferrer" class="text-neutral-600 hover:text-white transition-colors" aria-label="Twitter">
          <iconify-icon icon="lucide:twitter" width="18" aria-hidden="true"></iconify-icon>
        </a>
        <!-- Add other social links if available -->
      </div>
    </div>
    
  </div>
</footer>
```

### Footer Styling

Maintain brand consistency:

- Background: Inherits page background (dark gradient)
- Border: `border-t border-white/10`
- Headings: `text-white font-medium text-sm`
- Links: `text-neutral-500 hover:text-white transition-colors`
- Fine print: `text-neutral-600 text-xs`

---

## Part 9: Brand Consistency Guidelines

### Design System

All new pages must maintain the Weekend MVP brand language:

**Colors:**

- Background: `#0A0A0A` (neutral-950) or gradient `bg-gradient-to-b from-black via-neutral-950 to-neutral-900`
- Primary text: `text-white`
- Secondary text: `text-neutral-400`
- Muted text: `text-neutral-500`, `text-neutral-600`
- Borders: `border-white/10`, `border-white/5`
- Cards: `bg-white/5`, `bg-[#0A0A0A]`
- Accents: `bg-green-500` (status), category-specific colors for badges

**Typography:**

- Font family: `'Geist', 'Inter', sans-serif`
- Headings: `font-medium tracking-tight` (not bold)
- H1: `text-4xl md:text-5xl` on collection pages, `text-5xl md:text-7xl` on landing
- H2: `text-2xl md:text-3xl`
- Body: `text-base` or `text-sm`, `font-light` for descriptions
- Mono/labels: `text-[10px] font-bold uppercase tracking-widest`

**Spacing:**

- Page padding: `px-6` mobile, `px-8` desktop
- Section spacing: `py-24` or `py-32`
- Card padding: `p-6` or `p-8`
- Grid gap: `gap-4` or `gap-6`

**Components:**

- Cards: `rounded-2xl` or `rounded-3xl`, `border border-white/10`
- Buttons: `rounded-full` for primary, `rounded-xl` for secondary
- Badges: `rounded-full`, `text-[10px] font-bold uppercase`
- Icons: Iconify with `lucide:` prefix

**Animations:**

- Hover transitions: `transition-colors`, `transition-all`
- Card hover: `hover:border-white/20`, `hover:bg-white/10`
- Button hover: `hover:bg-neutral-200` (light), `hover:bg-white/10` (dark)

### Page Layout Template

Every programmatic page should follow this structure:

```html
<!DOCTYPE html>
<html lang="en" class="antialiased dark">
<head>
  <!-- Meta tags (title, description, OG, Twitter) -->
  <!-- Google Analytics snippet -->
  <!-- Favicon, fonts, Tailwind, Iconify -->
  <!-- JSON-LD Schema -->
</head>
<body class="relative min-h-screen overflow-x-hidden selection:bg-white/20 selection:text-white">
  <!-- Navigation (consistent across all pages) -->
  <!-- Mobile Menu -->
  
  <main class="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-16">
    <!-- Breadcrumb -->
    <!-- Page Header (H1, description) -->
    <!-- Main Content -->
  </main>
  
  <!-- Footer (consistent across all pages) -->
  <!-- Cookie Consent Banner -->
  <!-- Scripts -->
</body>
</html>
```

---

## Part 10: Technical Implementation

### Template Files Needed

```
ideas/
├── _template-dynamic.html          (existing - individual idea)
├── _template-category.html         (NEW - category collection)
├── _template-tool.html             (NEW - tool landing)
├── _template-audience.html         (NEW - audience hub)
├── _template-revenue.html          (NEW - revenue goal)
├── _template-problem.html          (NEW - problem/solution)
└── manifest.json                   (extend with categories, tools)
```

### Manifest.json Extension

```json
{
  "ideas": [...],
  "categories": [
    {
      "slug": "saas",
      "name": "SaaS",
      "description": "Software-as-a-service startup ideas",
      "keywords": ["saas ideas", "saas startup ideas 2026"],
      "ideaSlugs": ["ai-meeting-notes-cleaner", "invoice-reminder-bot"]
    }
  ],
  "tools": [
    {
      "slug": "cursor",
      "name": "Cursor",
      "description": "AI-powered code editor",
      "strengths": ["Full-stack apps", "Complex logic", "Refactoring"],
      "ideaSlugs": ["ai-meeting-notes-cleaner"]
    }
  ],
  "audiences": [
    {
      "slug": "developers",
      "name": "Developers",
      "description": "Side project ideas for developers",
      "filters": { "techLevel": "advanced" }
    }
  ]
}
```

### Schema Markup for New Page Types

**Category Collection:**

```json
{
  "@type": "CollectionPage",
  "name": "{Category} Startup Ideas",
  "description": "...",
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": X,
    "itemListElement": [...]
  }
}
```

**Tool Landing:**

```json
{
  "@type": "SoftwareApplication",
  "name": "{Tool}",
  "applicationCategory": "DeveloperApplication",
  "description": "...",
  "offers": {...}
}
```

---

## Part 11: SEO Optimizations

### Title Tag Patterns

| Page Type | Pattern | Example |

|-----------|---------|---------|

| Category | "{Category} Startup Ideas (2026) | Weekend MVP" | "SaaS Startup Ideas (2026) | Weekend MVP" |

| Tool | "What to Build with {Tool}: {count} Ideas | Weekend MVP" | "What to Build with Cursor: 12 Project Ideas | Weekend MVP" |

| Audience | "Startup Ideas for {Audience} | Weekend MVP" | "Startup Ideas for Developers | Weekend MVP" |

| Revenue | "${amount}/Month Business Ideas | Weekend MVP" | "$1K/Month Business Ideas | Weekend MVP" |

| Problem | "How to Automate {Problem} | Weekend MVP" | "How to Automate Invoicing | Weekend MVP" |

### Meta Description Patterns

| Page Type | Pattern |

|-----------|---------|

| Category | "Discover {count} {category} startup ideas you can build this weekend. Each comes with AI build prompts, market research, and step-by-step guides." |

| Tool | "Find the best projects to build with {Tool}. {count} ideas with ready-to-use prompts, from MVPs to full products." |

| Audience | "Curated startup ideas perfect for {audience}. Filter by build time, revenue potential, and tech stack." |

### Sitemap Updates

Add new sections to sitemap.xml:

```xml
<!-- Category Collections -->
<url>
  <loc>https://weekendmvp.app/ideas/saas/</loc>
  <lastmod>2026-01-27</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>

<!-- Tool Pages -->
<url>
  <loc>https://weekendmvp.app/build-with/cursor/</loc>
  <lastmod>2026-01-27</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

---

## Part 12: Content Calendar

### Week 1 Focus (Foundation)

- Create analytics snippet file for consistent GA tracking
- Update navigation with dropdown menus (Browse Ideas, Build With, Ideas For)
- Add 3 new sections to homepage (Categories, Tools, Featured Ideas)
- Redesign footer with link columns for internal linking
- Create 5 new template files with GA integration

### Month 1 Focus

- 4 category pages (SaaS, AI, Automation, Productivity)
- 4 tool pages (Cursor, Claude, Bolt, No-code)
- 10 new individual ideas
- Total new pages: **18**

### Month 2 Focus

- 4 more category pages
- 3 audience pages
- 2 revenue pages
- 5 problem pages
- 10 new individual ideas
- Total new pages: **24**

### Month 3 Focus

- Remaining category pages (4)
- Remaining tool pages (4)
- Build time pages (4)
- 15 new individual ideas
- Total new pages: **27**

### Projected Page Count

| Timeframe | Current | New | Total |

|-----------|---------|-----|-------|

| Now | 29 | 0 | 29 |

| Month 1 | 29 | 18 | 47 |

| Month 2 | 47 | 24 | 71 |

| Month 3 | 71 | 27 | 98 |

| Month 6 | 98 | 52 | 150+ |

---

## Part 13: Measurement & KPIs

### Traffic Metrics

- Organic sessions per page type
- Keyword rankings for target terms
- Click-through rates from SERPs

### Engagement Metrics

- Email capture rate per page type
- Time on page
- Pages per session

### Conversion Metrics

- Starter kit downloads
- Consultation bookings
- Ideas viewed per session

### Tools

- Google Search Console (rankings, impressions)
- Google Analytics (traffic, engagement)
- Ahrefs/Semrush (keyword tracking)

---

## Part 14: Programmatic SEO Skill (`/publish-programmatic`)

### Overview

Create a reusable skill at `.claude/skills/publish-programmatic/SKILL.md` that packages all research, templates, and processes for generating programmatic SEO pages without starting from scratch each time.

### Usage

```
/publish-programmatic {page-type} {slug}
```

**Page Types:**

- `category` - Category collection page (e.g., `/ideas/saas/`)
- `tool` - Tool landing page (e.g., `/build-with/cursor/`)
- `audience` - Audience hub page (e.g., `/ideas-for/developers/`)
- `revenue` - Revenue goal page (e.g., `/ideas/1k-month/`)
- `problem` - Problem/solution page (e.g., `/solve/invoicing/`)

**Examples:**

- `/publish-programmatic category saas` - Create SaaS category page
- `/publish-programmatic tool cursor` - Create Cursor tool page
- `/publish-programmatic audience developers` - Create developers audience page
- `/publish-programmatic revenue 1k-month` - Create $1K/month page
- `/publish-programmatic problem invoicing` - Create invoicing automation page

### Skill Data Files

Store pre-researched data in the skill folder:

```
.claude/skills/publish-programmatic/
├── SKILL.md                    <- Main skill instructions
├── data/
│   ├── categories.json         <- Category definitions + keywords
│   ├── tools.json              <- Tool definitions + strengths
│   ├── audiences.json          <- Audience definitions + filters
│   ├── revenue-goals.json      <- Revenue tier definitions
│   └── problems.json           <- Problem definitions + solution mappings
├── templates/
│   ├── _category.html          <- Category page template
│   ├── _tool.html              <- Tool page template
│   ├── _audience.html          <- Audience page template
│   ├── _revenue.html           <- Revenue page template
│   └── _problem.html           <- Problem page template
└── keywords/
    └── research.md             <- Keyword research data
```

### Categories Data (`categories.json`)

```json
{
  "categories": [
    {
      "slug": "saas",
      "name": "SaaS",
      "displayName": "SaaS Startup Ideas",
      "description": "Software-as-a-service ideas you can build and launch this weekend",
      "icon": "lucide:cloud",
      "color": "blue",
      "keywords": {
        "primary": "saas ideas 2026",
        "secondary": ["micro saas ideas", "saas startup ideas", "b2b saas ideas"],
        "volume": "8.1K/mo"
      },
      "ideaSlugs": ["ai-meeting-notes-cleaner", "invoice-reminder-bot"],
      "faqs": [
        {
          "question": "What is a SaaS startup?",
          "answer": "SaaS (Software as a Service) is a software distribution model..."
        }
      ]
    }
  ]
}
```

### Tools Data (`tools.json`)

```json
{
  "tools": [
    {
      "slug": "cursor",
      "name": "Cursor",
      "tagline": "AI-powered code editor",
      "description": "Build full-stack applications with AI pair programming",
      "logo": "/image/tools/cursor.svg",
      "strengths": [
        "Full-stack applications",
        "Complex business logic",
        "Code refactoring",
        "Database integration"
      ],
      "bestFor": ["SaaS", "Developer tools", "Productivity apps"],
      "keywords": {
        "primary": "what to build with cursor",
        "secondary": ["cursor ai projects", "cursor ide ideas"],
        "volume": "280/mo"
      },
      "ideaSlugs": ["ai-meeting-notes-cleaner", "invoice-reminder-bot"],
      "gettingStarted": [
        "Download Cursor from cursor.sh",
        "Open your project folder",
        "Press Cmd+K to start AI chat"
      ]
    }
  ]
}
```

### What the Skill Does

1. **Reads config data** from the appropriate JSON file based on page type
2. **Validates slug** exists in the config (or offers to create new entry)
3. **Filters relevant ideas** from `manifest.json` based on category/tool/audience
4. **Generates HTML** using the appropriate template
5. **Creates directory** if needed (e.g., `ideas/saas/`)
6. **Saves `index.html`** in the directory
7. **Updates sitemap.xml** with new URL
8. **Updates navigation** if this is a new section (first page of type)
9. **Updates footer** links if applicable
10. **Reports** what was created

### Page Type Specifications

#### Category Pages (`/ideas/{category}/`)

**Template variables:**

- `{{CATEGORY_NAME}}` - Display name
- `{{CATEGORY_SLUG}}` - URL slug
- `{{CATEGORY_DESCRIPTION}}` - SEO description
- `{{CATEGORY_ICON}}` - Iconify icon
- `{{IDEA_COUNT}}` - Number of ideas
- `{{IDEAS_GRID}}` - Filtered idea cards
- `{{FAQ_SECTION}}` - Category-specific FAQs
- `{{RELATED_CATEGORIES}}` - Links to similar categories

**Schema:** CollectionPage + ItemList + BreadcrumbList + FAQPage

#### Tool Pages (`/build-with/{tool}/`)

**Template variables:**

- `{{TOOL_NAME}}` - Display name
- `{{TOOL_SLUG}}` - URL slug
- `{{TOOL_TAGLINE}}` - One-liner
- `{{TOOL_LOGO}}` - Logo image path
- `{{TOOL_STRENGTHS}}` - Strengths list
- `{{TOOL_BEST_FOR}}` - Best use cases
- `{{IDEAS_GRID}}` - Filtered idea cards
- `{{GETTING_STARTED}}` - Quick start guide

**Schema:** SoftwareApplication + HowTo + ItemList + BreadcrumbList

#### Audience Pages (`/ideas-for/{audience}/`)

**Template variables:**

- `{{AUDIENCE_NAME}}` - Display name
- `{{AUDIENCE_SLUG}}` - URL slug
- `{{AUDIENCE_DESCRIPTION}}` - Why this audience
- `{{SKILL_LEVEL}}` - Technical level
- `{{TIME_COMMITMENT}}` - Expected time
- `{{IDEAS_GRID}}` - Filtered idea cards
- `{{RESOURCES}}` - Audience-specific resources

**Schema:** CollectionPage + ItemList + BreadcrumbList

#### Revenue Pages (`/ideas/{revenue-goal}/`)

**Template variables:**

- `{{REVENUE_GOAL}}` - Display amount
- `{{REVENUE_SLUG}}` - URL slug
- `{{REVENUE_DESCRIPTION}}` - How to achieve
- `{{METHODOLOGY}}` - Revenue breakdown
- `{{IDEAS_GRID}}` - Filtered idea cards
- `{{UNIT_ECONOMICS}}` - Example calculations

**Schema:** CollectionPage + ItemList + BreadcrumbList

#### Problem Pages (`/solve/{problem}/`)

**Template variables:**

- `{{PROBLEM_NAME}}` - Display name
- `{{PROBLEM_SLUG}}` - URL slug
- `{{PROBLEM_DESCRIPTION}}` - Problem overview
- `{{PROBLEM_STATS}}` - Market stats
- `{{SOLUTIONS}}` - Solution ideas
- `{{QUICK_START}}` - How to start building
- `{{RELATED_PROBLEMS}}` - Similar problems

**Schema:** HowTo + ItemList + BreadcrumbList

### Output Report

```
## Published: {PAGE_TYPE} - {NAME}

**Files created/modified:**
- {path}/index.html (new)
- sitemap.xml (updated)
- Navigation (if first of type)

**Page details:**
- URL: https://weekendmvp.app/{path}/
- Ideas included: {count}
- Target keywords: {primary}, {secondary}

**SEO:**
- Schema: {schema_types}
- Meta description: {description}
- Canonical URL set

**Next steps:**
- Add more ideas to this {page_type}: {how}
- Create related {page_type}s: {suggestions}
```

### Adding New Entries

If the slug doesn't exist in the config:

```
/publish-programmatic category fintech
```

The skill will:

1. Detect "fintech" doesn't exist in categories.json
2. Prompt: "Category 'fintech' not found. Create it?"
3. If yes: Ask for required fields (name, description, keywords)
4. Add to categories.json
5. Proceed with page generation

### Batch Generation

For generating multiple pages at once:

```
/publish-programmatic batch categories
```

Generates all category pages defined in categories.json that don't have an index.html yet.

### Skill Benefits

- **No research from scratch**: Keywords, descriptions, FAQs pre-defined
- **Consistent quality**: Templates ensure brand consistency
- **Fast iteration**: Generate a new page in under 30 seconds
- **Automatic updates**: Sitemap, navigation, footer all handled
- **Easy expansion**: Just add entries to JSON config files