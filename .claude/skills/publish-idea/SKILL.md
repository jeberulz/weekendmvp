---
name: publish-idea
description: "Publish a startup idea from raw research dumps. Reads unstructured content from ideas/drafts/{name}/, analyzes it, generates a polished idea page, and updates the manifest. Usage: /publish-idea {folder-name}"
---

# Publish Idea Skill

Transform raw research dumps into polished startup idea pages.

---

## Usage

```
/publish-idea {folder-name}
```

Example: `/publish-idea nutrition-planner`

---

## What This Skill Does

1. **Reads** all markdown files from `ideas/drafts/{folder-name}/`
2. **Analyzes** content to determine which sections have sufficient data
3. **Extracts/generates** content for each section
4. **Generates** HTML using the dynamic template
5. **Updates** `ideas/manifest.json` with the new idea
6. **Adds** a card to `startup-ideas.html`
7. **Reports** what was created

---

## Source Structure

The skill expects this folder structure:

```
ideas/drafts/{folder-name}/
  raw.md              <- main research dump (REQUIRED)
  competitors.md      <- optional: deep competitor analysis
  notes.md            <- optional: additional notes
  assets/             <- optional: screenshots, images
```

At minimum, `raw.md` must exist with the core idea research.

---

## Section Analysis

The skill dynamically includes sections based on content richness:

| Section | Included When | What to Look For |
|---------|---------------|------------------|
| The Problem | Always | Pain points, frustrations, user quotes |
| The Solution | Always | Features, how it works, value prop |
| How It Works | Always | 3-5 steps extracted from user flow |
| Market Research | Market data present | Stats, trends, TAM/SAM, Reddit/Twitter mentions |
| Competitive Landscape | Competitors mentioned | Names, pricing, features, gaps |
| Business Model | Revenue details present | Pricing tiers, subscription models, unit economics |
| Tech Stack | Tech mentioned | APIs, frameworks, tools, integrations |
| AI Prompts | Always | Generated based on idea |

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

Combine all content for analysis.

### Step 2: Extract Core Information

From the combined content, extract:

**Required (always present):**
- `title`: The idea name (e.g., "AI Nutrition Planner for Trainers")
- `slug`: URL-safe version (e.g., "ai-nutrition-planner-trainers")
- `category`: One of: SaaS, Productivity, Creator, E-commerce, Fintech, Health, Education, Developer
- `tagline`: One-liner value proposition
- `short_description`: 1-2 sentence summary for cards
- `description`: Full meta description for SEO
- `build_time`: Estimated hours (usually 6-12)
- `problem`: Pain points and frustrations
- `solution`: How the product solves it
- `how_it_works`: 3-5 step user flow

**Conditional (include if data present):**
- `market_research`: Stats, trends, validation data
- `competitors`: Names, pricing, features, gaps
- `business_model`: Pricing strategy, tiers, unit economics
- `tech_stack`: Recommended technologies

### Step 3: Generate AI Build Prompts

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

### Step 4: Generate HTML

Use the template at `ideas/_template-dynamic.html`:

1. Replace all `{{PLACEHOLDER}}` values with extracted content
2. For conditional sections (wrapped in `{{#SECTION_NAME}}...{{/SECTION_NAME}}`):
   - Include the section if data is present
   - Remove the entire block (including markers) if no data
3. Generate proper HTML for lists and grids

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

### Step 5: Save HTML File

Save the generated HTML to:
```
ideas/{slug}.html
```

### Step 6: Update Manifest

Add entry to `ideas/manifest.json`:

```json
{
  "slug": "{slug}",
  "title": "{title}",
  "publishedAt": "{YYYY-MM-DD}"
}
```

Use today's date for `publishedAt`.

### Step 7: Add Card to startup-ideas.html

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

---

## Output Report

After completion, report:

```
## Published: {IDEA_TITLE}

**Files created/modified:**
- ideas/{slug}.html (new)
- ideas/manifest.json (updated)
- startup-ideas.html (card added)

**Sections included:**
- The Problem
- The Solution
- How It Works (X steps)
- Market Research (if included)
- Competitive Landscape (if included)
- Business Model (if included)
- Tech Stack (if included)
- AI Build Prompts (4 prompts)

**Preview:** Open ideas/{slug}.html in browser to verify.
```

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

This raw content would generate a complete idea page with all sections populated.

---

## Checklist

Before marking complete:

- [ ] Read all markdown files from drafts folder
- [ ] Extracted all required fields
- [ ] Determined which conditional sections to include
- [ ] Generated 4 AI build prompts
- [ ] Created HTML file with proper formatting
- [ ] Updated manifest.json
- [ ] Added card to startup-ideas.html
- [ ] Verified HTML renders correctly
