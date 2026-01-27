# Publish Programmatic SEO Pages

Generate category, tool, audience, revenue, and problem pages for Weekend MVP's programmatic SEO strategy. This skill packages all research, templates, and processes for generating pages without starting from scratch.

## Usage

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

**Batch Generation:**
- `/publish-programmatic batch categories` - Generate all missing category pages
- `/publish-programmatic batch tools` - Generate all missing tool pages

---

## Workflow

### Step 1: Read Configuration Data

1. Read `ideas/manifest.json` - contains all data for categories, tools, audiences, revenue goals
2. Read `problems.json` from this skill folder for problem page data
3. Validate the requested slug exists in the config

### Step 2: Filter Relevant Ideas

Based on page type, filter ideas from manifest:

**Category pages:**
```javascript
const ideas = manifest.ideas.filter(i => i.category === slug);
```

**Tool pages:**
```javascript
const ideas = manifest.ideas.filter(i => i.tools?.includes(slug));
```

**Audience pages:**
```javascript
const ideas = manifest.ideas.filter(i => i.audiences?.includes(slug));
```

**Revenue pages:**
```javascript
const ideas = manifest.ideas.filter(i => i.revenueGoal === slug);
```

**Problem pages:**
Reference the `problems.json` which maps problems to idea slugs.

### Step 3: Generate HTML

1. Read the appropriate template from `ideas/`:
   - Category: `ideas/_template-category.html`
   - Tool: `ideas/_template-tool.html`
   - Audience: `ideas/_template-audience.html`
   - Revenue: `ideas/_template-revenue.html`
   - Problem: `ideas/_template-problem.html`

2. Replace template variables with data (see Variable Reference below)

3. Generate dynamic content:
   - Ideas grid HTML
   - FAQ items (for category pages)
   - Related items section
   - Schema.org ItemList elements

### Step 4: Create Output Files

**Category pages:** `ideas/{slug}/index.html`
**Tool pages:** `build-with/{slug}/index.html`
**Audience pages:** `ideas-for/{slug}/index.html`
**Revenue pages:** `ideas/{slug}/index.html`
**Problem pages:** `solve/{slug}/index.html`

### Step 5: Update Sitemap

Add new URL to `sitemap.xml`:
```xml
<url>
  <loc>https://weekendmvp.app/{path}/</loc>
  <lastmod>{YYYY-MM-DD}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

### Step 6: Generate Report

```markdown
## Published: {PAGE_TYPE} - {NAME}

**Files created/modified:**
- {path}/index.html (new)
- sitemap.xml (updated)

**Page details:**
- URL: https://weekendmvp.app/{path}/
- Ideas included: {count}
- Target keywords: {primary}, {secondary}

**SEO:**
- Schema: {schema_types}
- Meta description: {description}
- Canonical URL set

**Next steps:**
- Add more ideas to this {page_type}: update manifest.json
- Create related pages: {suggestions}
```

---

## Template Variables Reference

### Category Pages (`_template-category.html`)

| Variable | Source | Example |
|----------|--------|---------|
| `{{CATEGORY_NAME}}` | `categories[slug].name` | "SaaS" |
| `{{CATEGORY_SLUG}}` | slug parameter | "saas" |
| `{{CATEGORY_NAME_LOWER}}` | lowercase name | "saas" |
| `{{CATEGORY_DESCRIPTION}}` | `categories[slug].description` | "Software-as-a-service ideas..." |
| `{{CATEGORY_ICON}}` | `categories[slug].icon` | "lucide:cloud" |
| `{{CATEGORY_COLOR}}` | `categories[slug].color` | "blue" |
| `{{IDEA_COUNT}}` | filtered ideas count | 8 |
| `{{IDEAS_GRID}}` | generated HTML | (see Ideas Grid section) |
| `{{FAQ_ITEMS}}` | generated HTML | (see FAQ section) |
| `{{FAQ_SCHEMA_ITEMS}}` | JSON-LD FAQs | (see Schema section) |
| `{{ITEM_LIST_ELEMENTS}}` | JSON-LD items | (see Schema section) |
| `{{RELATED_CATEGORIES}}` | generated HTML | (see Related section) |

### Tool Pages (`_template-tool.html`)

| Variable | Source | Example |
|----------|--------|---------|
| `{{TOOL_NAME}}` | `tools[slug].name` | "Cursor" |
| `{{TOOL_SLUG}}` | slug parameter | "cursor" |
| `{{TOOL_TAGLINE}}` | `tools[slug].tagline` | "AI-powered code editor" |
| `{{TOOL_DESCRIPTION}}` | `tools[slug].description` | "Build full-stack applications..." |
| `{{TOOL_LOGO}}` | `tools[slug].logo` | "/image/tools/cursor.svg" |
| `{{TOOL_WEBSITE}}` | `tools[slug].url` | "https://cursor.sh" |
| `{{TOOL_OS}}` | hardcode | "Web, macOS, Windows, Linux" |
| `{{IDEA_COUNT}}` | filtered ideas count | 12 |
| `{{TOOL_STRENGTHS}}` | generated HTML | (see Strengths section) |
| `{{IDEAS_GRID}}` | generated HTML | (see Ideas Grid section) |
| `{{GETTING_STARTED_STEPS}}` | generated HTML | (see Steps section) |
| `{{GETTING_STARTED_SCHEMA}}` | JSON-LD steps | (see Schema section) |
| `{{TOOL_PROMPTS}}` | generated HTML | (see Prompts section) |
| `{{OTHER_TOOLS}}` | generated HTML | (see Related section) |
| `{{ITEM_LIST_ELEMENTS}}` | JSON-LD items | (see Schema section) |

### Audience Pages (`_template-audience.html`)

| Variable | Source | Example |
|----------|--------|---------|
| `{{AUDIENCE_NAME}}` | `audiences[slug].name` | "Developers" |
| `{{AUDIENCE_SLUG}}` | slug parameter | "developers" |
| `{{AUDIENCE_NAME_LOWER}}` | lowercase | "developers" |
| `{{AUDIENCE_DESCRIPTION}}` | `audiences[slug].description` | "Ideas that leverage your coding skills..." |
| `{{AUDIENCE_ICON}}` | `audiences[slug].icon` | "lucide:terminal" |
| `{{AUDIENCE_COLOR}}` | hardcode based on slug | "blue" |
| `{{SKILL_LEVEL}}` | from traits | "Advanced" |
| `{{TIME_COMMITMENT}}` | from traits | "8-12 hours" |
| `{{IDEA_COUNT}}` | filtered ideas count | 15 |
| `{{AUDIENCE_POSITIONING}}` | generated from traits | "Developers are uniquely positioned..." |
| `{{AUDIENCE_ADVANTAGES}}` | generated HTML | (see Advantages section) |
| `{{IDEAS_GRID}}` | generated HTML | (see Ideas Grid section) |
| `{{RESOURCES}}` | generated HTML | (see Resources section) |
| `{{OTHER_AUDIENCES}}` | generated HTML | (see Related section) |
| `{{ITEM_LIST_ELEMENTS}}` | JSON-LD items | (see Schema section) |

### Revenue Pages (`_template-revenue.html`)

| Variable | Source | Example |
|----------|--------|---------|
| `{{REVENUE_GOAL}}` | `revenueGoals[slug].name` | "$1K/Month" |
| `{{REVENUE_SLUG}}` | slug parameter | "1k-month" |
| `{{REVENUE_DESCRIPTION}}` | `revenueGoals[slug].description` | "Achievable with a small customer base..." |
| `{{IDEA_COUNT}}` | filtered ideas count | 20 |
| `{{METHODOLOGY_DESCRIPTION}}` | `revenueGoals[slug].methodology` | "At $1K/month, you need..." |
| `{{REVENUE_PATHS}}` | generated HTML | (see Paths section) |
| `{{IDEAS_GRID}}` | generated HTML | (see Ideas Grid section) |
| `{{UNIT_ECONOMICS_EXAMPLES}}` | generated HTML | (see Economics section) |
| `{{PRICING_STRATEGIES}}` | generated HTML | (see Pricing section) |
| `{{OTHER_REVENUE_GOALS}}` | generated HTML | (see Related section) |
| `{{ITEM_LIST_ELEMENTS}}` | JSON-LD items | (see Schema section) |

### Problem Pages (`_template-problem.html`)

| Variable | Source | Example |
|----------|--------|---------|
| `{{PROBLEM_NAME}}` | `problems[slug].name` | "Invoicing" |
| `{{PROBLEM_SLUG}}` | slug parameter | "invoicing" |
| `{{PROBLEM_NAME_LOWER}}` | lowercase | "invoicing" |
| `{{PROBLEM_DESCRIPTION}}` | `problems[slug].description` | "Manual invoicing wastes hours..." |
| `{{PROBLEM_ICON}}` | `problems[slug].icon` | "lucide:file-text" |
| `{{PROBLEM_OVERVIEW}}` | `problems[slug].overview` | "Businesses spend 5+ hours/week..." |
| `{{PROBLEM_STATS}}` | `problems[slug].stats` | "$5B market opportunity" |
| `{{SOLUTION_COUNT}}` | filtered ideas count | 3 |
| `{{PROBLEM_PAIN_POINTS}}` | generated HTML | (see Pain Points section) |
| `{{SOLUTIONS}}` | generated HTML | (see Solutions section) |
| `{{QUICKSTART_STEPS}}` | generated HTML | (see Steps section) |
| `{{HOWTO_STEPS}}` | JSON-LD steps | (see Schema section) |
| `{{RELATED_PROBLEMS}}` | generated HTML | (see Related section) |
| `{{ITEM_LIST_ELEMENTS}}` | JSON-LD items | (see Schema section) |

---

## HTML Generation Patterns

### Ideas Grid Card

```html
<a href="../{idea-slug}.html" class="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
    <div class="flex items-center gap-2 mb-4">
        <span class="px-2 py-1 bg-{color}-500/10 text-{color}-400 text-[10px] font-bold uppercase rounded-full">{Category}</span>
        <span class="text-neutral-600 text-xs">~{buildTime} hours</span>
    </div>
    <h3 class="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">{Title}</h3>
    <p class="text-neutral-500 text-sm line-clamp-2">{Short description from idea page}</p>
</a>
```

### FAQ Item

```html
<div class="p-6 bg-white/5 border border-white/10 rounded-2xl">
    <h3 class="text-white font-medium mb-3">{question}</h3>
    <p class="text-neutral-400 text-sm leading-relaxed">{answer}</p>
</div>
```

### Strength Card (Tool Pages)

```html
<div class="p-4 bg-white/5 border border-white/10 rounded-xl">
    <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-3">
        <iconify-icon icon="lucide:check" class="text-green-400" width="20" aria-hidden="true"></iconify-icon>
    </div>
    <p class="text-white text-sm">{strength}</p>
</div>
```

### Resource Card (Audience Pages)

```html
<a href="{url}" target="_blank" rel="noopener noreferrer" class="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
    <h3 class="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">{title}<span class="sr-only"> (opens in new tab)</span></h3>
    <p class="text-neutral-500 text-sm">{description}</p>
</a>
```

### Related Category Card

```html
<a href="../{slug}/" class="group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all text-center">
    <div class="w-10 h-10 mx-auto mb-3 bg-{color}-500/10 rounded-lg flex items-center justify-center">
        <iconify-icon icon="{icon}" class="text-{color}-400" width="20" aria-hidden="true"></iconify-icon>
    </div>
    <span class="text-white text-sm font-medium group-hover:text-neutral-200 transition-colors">{name}</span>
</a>
```

---

## Schema.org Generation

### ItemList Element

```json
{
  "@type": "ListItem",
  "position": {index + 1},
  "name": "{idea.title}",
  "url": "https://weekendmvp.app/ideas/{idea.slug}.html"
}
```

### FAQ Schema Item

```json
{
  "@type": "Question",
  "name": "{question}",
  "acceptedAnswer": {
    "@type": "Answer",
    "text": "{answer}"
  }
}
```

### HowTo Step

```json
{
  "@type": "HowToStep",
  "position": {index + 1},
  "name": "{step title}",
  "text": "{step description}"
}
```

---

## Data Files

### manifest.json Location
`ideas/manifest.json` - Contains:
- `ideas[]` - All idea entries with category, tools, audiences, revenueGoal
- `categories[]` - Category definitions with keywords, FAQs, colors, icons
- `tools[]` - Tool definitions with strengths, getting started, keywords
- `audiences[]` - Audience definitions with traits, filters, resources
- `revenueGoals[]` - Revenue goal definitions with methodology, unit economics
- `buildTimes[]` - Build time definitions

### problems.json Location
`.claude/skills/publish-programmatic/data/problems.json` - Contains problem definitions:
- Problem name, slug, icon
- Description and overview
- Pain points
- Stats/market data
- Related idea slugs
- Quick start steps

---

## Color Mapping

| Category/Type | Color |
|---------------|-------|
| saas | blue |
| productivity | yellow |
| health | green |
| marketplace | purple |
| ai-tools | violet |
| automation | orange |
| education | teal |
| b2b | slate |
| developer-tools | emerald |
| ecommerce | pink |
| creator-tools | rose |
| fintech | cyan |

---

## File Structure Output

After running the skill, new files will be created:

```
weekendmvp/
├── ideas/
│   └── {category-slug}/
│       └── index.html
├── build-with/
│   └── {tool-slug}/
│       └── index.html
├── ideas-for/
│   └── {audience-slug}/
│       └── index.html
└── solve/
    └── {problem-slug}/
        └── index.html
```

---

## Validation Checklist

Before publishing, verify:

- [ ] All template variables replaced (no `{{VAR}}` in output)
- [ ] Ideas grid populated with at least 3 ideas
- [ ] Schema.org JSON-LD is valid
- [ ] Sitemap updated with new URL
- [ ] Meta description under 160 characters
- [ ] Title under 60 characters
- [ ] All links use correct relative paths for depth
- [ ] Accessibility: aria-labels, sr-only text present
- [ ] WCAG compliant focus states and color contrast

---

## Extending the Skill

### Adding a New Category

1. Add entry to `manifest.json` under `categories`:
```json
{
  "slug": "new-category",
  "name": "New Category",
  "displayName": "New Category Startup Ideas",
  "description": "Description here...",
  "icon": "lucide:icon-name",
  "color": "color",
  "keywords": { "primary": "...", "secondary": [...], "volume": "X/mo" },
  "faqs": [...]
}
```

2. Add `category: "new-category"` to relevant ideas in `ideas[]`

3. Run `/publish-programmatic category new-category`

### Adding a New Tool

1. Add entry to `manifest.json` under `tools`
2. Add `tools: ["new-tool"]` to relevant ideas
3. Run `/publish-programmatic tool new-tool`

### Adding a New Problem

1. Add entry to `data/problems.json`
2. Run `/publish-programmatic problem new-problem`
