---
name: publish-idea
description: "Publish a startup idea from raw research dumps. Reads unstructured content from ideas/drafts/{name}/, performs deep web research, generates a polished idea page with original expanded content, and updates the manifest. Usage: /publish-idea {folder-name}"
---

# Publish Idea Skill

Transform raw research dumps into polished, research-backed startup idea pages.

---

## Usage

```
/publish-idea {folder-name}
```

Example: `/publish-idea nutrition-planner`

---

## What This Skill Does

1. **Reads** all markdown files from `ideas/drafts/{folder-name}/`
2. **Extracts** the idea title (ONLY the title is used verbatim from raw.md)
3. **Performs deep web research** using WebSearch to gather:
   - Market size and growth statistics
   - Competitor analysis and pricing
   - Industry trends and validation signals
   - Target audience insights
   - Technology landscape
4. **Writes original expanded content** based on research findings (NOT copying raw.md)
5. **Generates** HTML using the dynamic template (with SEO schema markup and GA tracking)
6. **Auto-injects Google Analytics** if not already present (via template or script)
7. **Updates** `ideas/manifest.json` with the new idea
7. **Adds** a card to `startup-ideas.html`
8. **Updates** `sitemap.xml` for search engine discovery (SEO)
9. **Updates** ItemList schema in `startup-ideas.html` for AI answer engines (AEO)
10. **Reports** what was created with research sources

---

## CRITICAL: Content Guidelines

**THE RAW.MD FILE IS A STARTING POINT, NOT A SOURCE TO COPY.**

### What to Use from raw.md:
- **Title**: Use the idea title EXACTLY as written (this is the only verbatim content)
- **Concept**: Understand the core concept to guide research
- **Keywords**: Extract keywords for research queries

### What NOT to Do:
- ❌ Do NOT copy problem descriptions word-for-word
- ❌ Do NOT copy solution descriptions word-for-word
- ❌ Do NOT use market stats from raw.md without verification
- ❌ Do NOT copy competitor information without research
- ❌ Do NOT use any prose from raw.md directly

### What to Do Instead:
- ✅ Research the problem space independently using WebSearch
- ✅ Find current market statistics and cite sources
- ✅ Research actual competitors and their current pricing
- ✅ Write original, expanded content based on research findings
- ✅ Create fresh perspectives informed by real data

---

## Source Structure

The skill expects this folder structure:

```
ideas/drafts/{folder-name}/
  raw.md              <- idea seed/concept (REQUIRED) - used for title + research direction
  competitors.md      <- optional: competitor names to research
  notes.md            <- optional: additional context
  assets/             <- optional: screenshots, images
```

At minimum, `raw.md` must exist with the idea title and core concept.

---

## Section Analysis (Research-Driven)

The skill dynamically includes sections based on **research findings** (not raw.md content):

| Section | Included When | Research Required |
|---------|---------------|-------------------|
| The Problem | Always | Search for pain points, user complaints, industry challenges |
| The Solution | Always | Research current solutions and gaps to inform value prop |
| How It Works | Always | Design user flow based on competitor analysis |
| Market Research | Market data found | **Must find 3+ stats** from web research |
| Competitive Landscape | Competitors researched | **Must research 3+ competitors** with current pricing |
| Business Model | Competitor pricing found | Base tiers on competitor pricing research |
| Tech Stack | Tech research done | Research best tools for this type of app |
| AI Prompts | Always | Generate based on researched tech stack |

**Sidebar sections are determined by research success:**
- If market research finds good data → include Market Research section
- If competitor research is thorough → include Competitive Landscape section
- If pricing data is available → include Business Model section
- If tech recommendations are researched → include Tech Stack section

---

## Step-by-Step Process

### Step 1: Read Source Files

Read all `.md` files from `ideas/drafts/{folder-name}/`:

```
- raw.md (required)
- competitors.md (optional)
- notes.md (optional)
- Any other .md files present
```

**Extract from raw.md:**
- The idea **title** (use verbatim)
- Core concept keywords for research
- Target audience hints
- Competitor names mentioned (for research)

### Step 2: Deep Web Research (REQUIRED)

**You MUST perform web research before writing any content.** Use the WebSearch tool to research:

#### 2a. Market Research Queries
Run searches like:
- `"{industry} market size 2024 2025"`
- `"{target audience} pain points {problem area}"`
- `"{problem area} industry trends statistics"`
- `"{target audience} software spending habits"`

**Goal:** Find 3-5 market statistics with sources for the Market Research section.

#### 2b. Competitor Research Queries
For each competitor mentioned in raw.md (or discovered):
- `"{competitor name} pricing plans 2024"`
- `"{competitor name} reviews features"`
- `"{competitor name} vs alternatives"`
- `"{industry} software tools comparison"`

**Goal:** Document 3-5 competitors with current pricing and feature gaps.

#### 2c. Solution Validation Queries
- `"{problem} solutions software"`
- `"how {target audience} currently solve {problem}"`
- `"{industry} workflow automation tools"`

**Goal:** Understand current solutions and identify gaps for the "Your Opportunity" section.

#### 2d. Tech Stack Research (if needed)
- `"best tech stack for {type of app} 2024"`
- `"{specific feature} API integration options"`

**Goal:** Recommend modern, appropriate technologies.

### Step 3: Write Original Content

Based on research findings, write ORIGINAL content for each section. **Do NOT copy from raw.md.**

**Required fields (always generate):**
- `title`: The idea name (ONLY this comes from raw.md verbatim)
- `slug`: URL-safe version (e.g., "ai-nutrition-planner-trainers")
- `category`: One of: SaaS, Productivity, Creator, E-commerce, Fintech, Health, Education, Developer
- `tagline`: One-liner value proposition (write fresh based on research)
- `short_description`: 1-2 sentence summary for cards (write fresh)
- `description`: Full meta description for SEO (write fresh)
- `build_time`: Estimated hours (usually 6-12)
- `problem`: Pain points and frustrations (write based on research, cite stats)
- `solution`: How the product solves it (write original description)
- `how_it_works`: 3-5 step user flow (design based on research)

**Conditional fields (include based on research findings):**
- `market_research`: Stats, trends, validation data (from Step 2a research)
- `competitors`: Names, pricing, features, gaps (from Step 2b research)
- `business_model`: Pricing strategy, tiers, unit economics (informed by competitor pricing)
- `tech_stack`: Recommended technologies (from Step 2d research)

### Step 4: Generate AI Build Prompts

Always generate these 4 prompts tailored to the specific idea:

**1. Project Setup Prompt:**
```
Create a new {STACK} project for {IDEA_NAME}. Set up:
- Project structure with {FRAMEWORK}
- Database schema for {CORE_ENTITIES}
- Authentication with {AUTH_METHOD}
- Basic API routes for {CORE_FEATURES}
Include TypeScript, proper error handling, and environment variables.
```

**2. Core Feature Prompt:**
```
Build the main feature for {IDEA_NAME}: {CORE_FEATURE_DESCRIPTION}.

Requirements:
- {REQUIREMENT_1}
- {REQUIREMENT_2}
- {REQUIREMENT_3}

The user flow should be: {USER_FLOW_STEPS}
```

**3. Landing Page Prompt:**
```
Create a landing page for {IDEA_NAME} using {STACK}. Include:
- Hero section with headline: "{TAGLINE}"
- Problem/solution sections
- Feature highlights with icons
- Email capture form
- Social proof section (placeholder)
- Clean, modern design with {COLOR_SCHEME}
```

**4. Branding Package Prompt:**
```
Create a branding package for {IDEA_NAME}, a {ONE_LINER}:
- Logo: Simple, modern mark that works at small sizes
- Color palette: Primary, secondary, accent colors
- Typography: Heading and body font pairing
- Provide hex codes, font names, and usage guidelines
```

### Step 5: Generate HTML

Use the template at `ideas/_template-dynamic.html`:

1. Replace all `{{PLACEHOLDER}}` values with extracted content
2. For conditional sections (wrapped in `{{#SECTION_NAME}}...{{/SECTION_NAME}}`):
   - Include the section if data is present
   - Remove the entire block (including markers) if no data
3. Generate proper HTML for lists and grids

**Note:** The template already includes Google Analytics code. If you're generating HTML manually or the template doesn't have GA, run:
```bash
node scripts/inject-analytics.js ideas/{slug}.html
```

This automatically adds GA tracking code after the canonical link. The script is idempotent (safe to run multiple times).

**How It Works Steps Format:**
```html
<div class="flex-1 p-4 bg-white rounded-xl border border-neutral-200">
    <span class="text-xs font-bold text-neutral-400">1</span>
    <p class="text-sm font-medium mt-1">{STEP_TITLE}</p>
    <p class="text-xs text-neutral-500 mt-1">{STEP_DESCRIPTION}</p>
</div>
```

**Market Validation Points Format:**
```html
<li class="flex items-start gap-3 text-sm">
    <div class="w-1.5 h-1.5 rounded-full bg-black mt-2"></div>
    <span>{VALIDATION_POINT}</span>
</li>
```

**Competitor Card Format:**
```html
<div class="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
    <h4 class="font-medium text-sm mb-1">{COMPETITOR_NAME}</h4>
    <p class="text-xs text-neutral-500 mb-2">{COMPETITOR_DESCRIPTION}</p>
    <p class="text-xs text-neutral-400">{PRICING_INFO}</p>
</div>
```

**Tech Stack Item Format:**
```html
<div class="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
    <div class="flex items-center gap-2 mb-2">
        <iconify-icon icon="{TECH_ICON}" width="20" class="text-neutral-600"></iconify-icon>
        <h4 class="font-medium text-sm">{TECH_NAME}</h4>
    </div>
    <p class="text-xs text-neutral-500">{TECH_REASON}</p>
</div>
```

**Pricing Tier Format:**
```html
<div class="p-4 bg-neutral-50 rounded-xl border border-neutral-100 text-center">
    <h4 class="font-medium text-sm mb-1">{TIER_NAME}</h4>
    <p class="text-2xl font-bold mb-2">{PRICE}</p>
    <p class="text-xs text-neutral-500">{TIER_FEATURES}</p>
</div>
```

### Step 6: Save HTML File

Save the generated HTML to:
```
ideas/{slug}.html
```

### Step 7: Update Manifest

Add entry to `ideas/manifest.json`:

```json
{
  "slug": "{slug}",
  "title": "{title}",
  "publishedAt": "{YYYY-MM-DD}"
}
```

Use today's date for `publishedAt`.

### Step 8: Add Card to startup-ideas.html

Find the `<div id="ideas-grid">` section and add a new card BEFORE the placeholder card:

```html
<!-- Idea Card: {TITLE} -->
<a href="ideas/{slug}.html" class="group block p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl hover:border-white/10 transition-all">
    <div class="flex items-center gap-2 mb-4">
        <span class="px-2 py-1 bg-white/5 rounded-md text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{CATEGORY}</span>
    </div>
    <h3 class="text-lg font-medium text-white mb-2 group-hover:text-neutral-200 transition-colors">{TITLE}</h3>
    <p class="text-sm text-neutral-500 leading-relaxed mb-4">{SHORT_DESCRIPTION}</p>
    <div class="flex items-center gap-2 text-xs text-neutral-600">
        <iconify-icon icon="lucide:clock" width="14"></iconify-icon>
        <span>~{BUILD_TIME} hours to build</span>
    </div>
</a>
```

### Step 9: Update sitemap.xml (SEO)

Add a new `<url>` entry to `sitemap.xml` in the "Startup Ideas" section:

```xml
<url>
  <loc>https://weekendmvp.app/ideas/{slug}.html</loc>
  <lastmod>{YYYY-MM-DD}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
```

Use today's date for `lastmod`. Insert before the `<!-- Legal Pages -->` comment.

### Step 10: Update ItemList Schema in startup-ideas.html (AEO)

Find the `"@type": "ItemList"` section in the JSON-LD script block and:

1. **Increment** `numberOfItems` by 1
2. **Add** a new ListItem at the next position:

```json
{
  "@type": "ListItem",
  "position": {NEXT_POSITION},
  "item": {
    "@type": "SoftwareApplication",
    "name": "{TITLE}",
    "applicationCategory": "{SCHEMA_CATEGORY}",
    "description": "{SHORT_DESCRIPTION}",
    "url": "https://weekendmvp.app/ideas/{slug}.html"
  }
}
```

**Category mapping for schema:**
| Idea Category | Schema applicationCategory |
|---------------|---------------------------|
| SaaS | BusinessApplication |
| Productivity | ProductivityApplication |
| Health | HealthApplication |
| Fintech | FinanceApplication |
| Education | EducationalApplication |
| Developer | DeveloperApplication |
| Creator | MultimediaApplication |
| E-commerce | ShoppingApplication |

---

## Output Report

After completion, report:

```
## Published: {IDEA_TITLE}

**Files created/modified:**
- ideas/{slug}.html (new - with GA tracking from template)
- ideas/manifest.json (updated)
- startup-ideas.html (card added + ItemList schema updated)
- sitemap.xml (new URL added)

**Analytics:**
- Google Analytics included via template (or auto-injected via script)
- GA tracking ID: G-Z1NYERTKRS
- Meta Pixel ID: 1602726847528813

**Sections included:**

```
## Published: {IDEA_TITLE}

**Files created/modified:**
- ideas/{slug}.html (new)
- ideas/manifest.json (updated)
- startup-ideas.html (card added + ItemList schema updated)
- sitemap.xml (new URL added)

**Sections included:**
- The Problem
- The Solution
- How It Works (X steps)
- Market Research (if included)
- Competitive Landscape (if included)
- Business Model (if included)
- Tech Stack (if included)
- AI Build Prompts (4 prompts)

**Research Sources Used:**
- [List the key sources found during research]
- Market data: {source}
- Competitor info: {sources}
- Industry trends: {source}

**SEO/AEO:**
- sitemap.xml: New idea page added
- ItemList schema: Updated with {POSITION} items total
- JSON-LD: Article + SoftwareApplication + HowTo + BreadcrumbList

**Preview:** Open ideas/{slug}.html in browser to verify.
```

---

## SEO/AEO Requirements

**IMPORTANT:** All generated idea pages MUST include proper SEO and AEO (Answer Engine Optimization) markup for search engines and AI assistants (ChatGPT, Perplexity, Claude).

### Required Meta Tags

Every idea page must include:

```html
<!-- Twitter Card (with image) -->
<meta property="twitter:image" content="https://weekendmvp.app/image/og-image.png">
```

### Required JSON-LD Schema

Every idea page must include this structured data in a `<script type="application/ld+json">` block:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "{TITLE}",
      "description": "{DESCRIPTION}",
      "author": { "@id": "https://weekendmvp.app/#person" },
      "publisher": { "@id": "https://weekendmvp.app/#person" },
      "datePublished": "{YYYY-MM-DD}",
      "url": "https://weekendmvp.app/ideas/{slug}.html"
    },
    {
      "@type": "SoftwareApplication",
      "name": "{TITLE}",
      "applicationCategory": "{SCHEMA_CATEGORY}",
      "description": "{TAGLINE}",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    },
    {
      "@type": "HowTo",
      "name": "How to Build {TITLE}",
      "description": "Step-by-step guide to building {TITLE}",
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "{STEP_1_TITLE}",
          "text": "{STEP_1_DESCRIPTION}"
        }
        // ... additional steps
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://weekendmvp.app/" },
        { "@type": "ListItem", "position": 2, "name": "Startup Ideas", "item": "https://weekendmvp.app/startup-ideas.html" },
        { "@type": "ListItem", "position": 3, "name": "{TITLE}", "item": "https://weekendmvp.app/ideas/{slug}.html" }
      ]
    }
  ]
}
```

### Email Gate Pattern (Critical for Crawlers)

Content MUST be visible by default for search engine and AI crawlers. Use this pattern:

```html
<!-- Email gate - visible by default, JS shows for non-subscribers -->
<div id="email-gate" class="hidden">
    <!-- Email capture form -->
</div>

<!-- Main content - visible by default for crawlers -->
<div id="gated-content">
    <!-- All idea content here -->
</div>

<script>
// Check subscription and show gate only for non-subscribers
if (!localStorage.getItem('weekendmvp_subscribed')) {
    document.getElementById('email-gate').classList.remove('hidden');
    document.getElementById('gated-content').classList.add('hidden');
}
</script>
```

**Why this matters:** AI crawlers (GPTBot, PerplexityBot, Claude-Web) cannot execute JavaScript. If content is hidden by default with CSS `class="hidden"`, crawlers see empty pages and won't index or cite your content.

### SEO/AEO Checklist for Generated Pages

- [ ] `twitter:image` meta tag present
- [ ] JSON-LD script with Article, SoftwareApplication, HowTo, BreadcrumbList
- [ ] Email gate uses correct visibility pattern (content visible by default)
- [ ] Canonical URL set correctly

---

## Accessibility Requirements

**IMPORTANT:** All generated HTML MUST follow the accessibility guidelines in `/CLAUDE.md`. Every page must pass these checks:

### Required Accessibility Patterns

**1. Icon-Only Buttons:**
```html
<!-- Mobile menu button -->
<button id="mobile-menu-open" class="..." aria-label="Open menu">
    <iconify-icon icon="lucide:menu" width="24" aria-hidden="true"></iconify-icon>
</button>

<!-- Close button -->
<button id="mobile-menu-close" class="..." aria-label="Close menu">
    <iconify-icon icon="lucide:x" width="24" aria-hidden="true"></iconify-icon>
</button>

<!-- Copy button -->
<button onclick="copyPrompt(this)" class="..." aria-label="Copy prompt to clipboard">
    <iconify-icon icon="lucide:copy" width="18" aria-hidden="true"></iconify-icon>
</button>
```

**2. Logo Divs:**
```html
<div class="logo h-4 w-32 text-black" role="img" aria-label="Weekend MVP"></div>
```

**3. External Links:**
```html
<a href="https://cal.com/..." target="_blank" rel="noopener noreferrer" class="...">
    Book a Consult<span class="sr-only"> (opens in new tab)</span>
</a>
```

**4. Focus Rings:**
- Light backgrounds: Use `focus:ring-black/30` (NOT /10)
- Dark backgrounds: Use `focus:ring-white/40` (NOT /20)

**5. Form Inputs:**
All inputs must have visible or aria-labels.

### Accessibility Checklist for Generated Pages

Before saving HTML, verify:
- [ ] Mobile menu open button has `aria-label="Open menu"`
- [ ] Mobile menu close button has `aria-label="Close menu"`
- [ ] All copy buttons have `aria-label="Copy prompt to clipboard"`
- [ ] Both logo instances have `role="img" aria-label="Weekend MVP"`
- [ ] CTA external link has `rel="noopener noreferrer"` and sr-only text
- [ ] Footer creator link has `rel="noopener noreferrer"` and sr-only text
- [ ] All decorative icons have `aria-hidden="true"`
- [ ] Focus rings use `/30` or `/40` opacity (not /10 or /20)

---

## Error Handling

- If `ideas/drafts/{folder-name}/` doesn't exist: Report error with instructions
- If `raw.md` is missing: Report error, it's required
- If content is too sparse: Generate with available data, note gaps in report

---

## Example Raw Content (raw.md)

```markdown
# AI Nutrition Planner for Trainers

## The Problem
Personal trainers certified through NASM spend hours creating meal plans for clients.
Most aren't nutrition experts but clients expect nutrition guidance.
Current tools are either too complex (MyFitnessPal) or too generic.

## Who It's For
- NASM certified personal trainers
- Fitness coaches with 10-50 clients
- Small gym owners

## The Solution
AI-powered nutrition planning that:
- Takes client fitness goals as input
- Generates compliant meal plans
- Adjusts for dietary restrictions
- Exports branded PDFs for clients

## How It Would Work
1. Trainer enters client profile (goals, restrictions, preferences)
2. AI generates weekly meal plan with macros
3. Trainer reviews and adjusts
4. Export branded PDF for client

## Market
- 400k+ NASM certified trainers in US
- Personal training is $40B market
- Nutrition add-on services grow revenue 30%

## Competitors
- MyFitnessPal - too consumer focused, $80/year
- Trainerize - expensive, $50/month minimum
- EatThisMuch - not trainer-focused

## Pricing Idea
- Free: 3 clients
- Pro: $29/month unlimited clients
- Agency: $79/month + white label

## Tech Notes
- OpenAI API for meal generation
- PDF generation with React-PDF
- Simple auth with Clerk
- Postgres for storage
```

### How This raw.md Gets Processed:

**Used directly:**
- Title: "AI Nutrition Planner for Trainers" ✅ (used verbatim)

**Used as research seeds (NOT copied):**
- Keywords: "NASM trainers", "nutrition planning", "meal plans"
- Competitors to research: MyFitnessPal, Trainerize, EatThisMuch
- Target audience: personal trainers, fitness coaches

**Research triggered:**
1. Search "personal trainer software market size 2024"
2. Search "MyFitnessPal pricing 2024"
3. Search "Trainerize pricing plans features"
4. Search "nutrition planning tools for trainers"
5. Search "fitness industry technology trends"

**Content written fresh based on research:**
- Problem section: Written with current stats from research
- Solution section: Original description highlighting gaps found
- Market Research: Real statistics with recent data
- Competitors: Current pricing (may differ from raw.md!)
- Business Model: Informed by competitor pricing research

---

## Checklist

Before marking complete:

### Research Checklist (REQUIRED)
- [ ] Read raw.md and extract title + research keywords
- [ ] **Performed WebSearch for market data** (3+ statistics found)
- [ ] **Performed WebSearch for competitors** (3+ competitors with current pricing)
- [ ] **Performed WebSearch for industry trends**
- [ ] **Performed WebSearch for tech stack** (if applicable)

### Content Checklist (REQUIRED - NO COPYING)
- [ ] Problem section: Written fresh with research stats (NOT from raw.md)
- [ ] Solution section: Original description (NOT from raw.md)
- [ ] How it works: Designed based on research (NOT from raw.md)
- [ ] Market research: Verified statistics with sources
- [ ] Competitive landscape: Current pricing from research
- [ ] Business model: Informed by competitor pricing
- [ ] Tech stack: Researched recommendations
- [ ] Generated 4 AI build prompts

### Publishing Checklist
- [ ] Created HTML file with proper formatting
- [ ] Updated manifest.json
- [ ] Added card to startup-ideas.html
- [ ] Updated sitemap.xml with new idea URL
- [ ] Updated ItemList schema (numberOfItems + new ListItem)
- [ ] Verified HTML renders correctly
- [ ] Listed research sources in output report

### Accessibility Checklist (REQUIRED)

- [ ] Mobile menu open button: `aria-label="Open menu"` + icon `aria-hidden="true"`
- [ ] Mobile menu close button: `aria-label="Close menu"` + icon `aria-hidden="true"`
- [ ] All copy buttons: `aria-label="Copy prompt to clipboard"` + icon `aria-hidden="true"`
- [ ] Nav logo: `role="img" aria-label="Weekend MVP"`
- [ ] Footer logo: `role="img" aria-label="Weekend MVP"`
- [ ] CTA link: `rel="noopener noreferrer"` + `<span class="sr-only"> (opens in new tab)</span>`
- [ ] Creator link: `rel="noopener noreferrer"` + `<span class="sr-only"> (opens in new tab)</span>`
- [ ] Form inputs: `focus:ring-black/30` (not /10)
- [ ] All decorative iconify-icons: `aria-hidden="true"`
