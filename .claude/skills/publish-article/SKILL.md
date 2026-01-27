---
name: publish-article
description: "Research, write, and publish SEO-optimized articles to drive traffic to startup-ideas.html. Performs keyword research, selects the best framework, writes original content, and handles all technical setup. Usage: /publish-article {topic-or-keyword}"
---

# Publish Article Skill

Research, write, and publish high-quality articles that drive traffic to the startup-ideas page.

---

## Usage

```
/publish-article {topic-or-keyword}
```

**Or pick from the pre-researched queue:**
```
/publish-article next
```

Examples:
- `/publish-article micro-saas ideas 2026` - Write about a specific topic
- `/publish-article next` - Pick the next queued topic from research.md
- `/publish-article topic 3` - Pick a specific topic number from the queue

---

## Topics Queue Location

**Pre-researched topics are stored in:**
```
.claude/skills/publish-article/topics/research.md
```

This file contains:
- Keyword research data and market stats
- 14 pre-researched article topics with SEO analysis
- Status tracking (queued/published)
- Research sources for each topic
- Publishing schedule recommendations

---

## What This Skill Does

1. **Checks the topics queue** in `topics/research.md` for pre-researched topics
2. **If topic provided:** Performs additional keyword research using WebSearch
3. **If "next" or "topic N":** Uses pre-researched data from the queue
4. **Suggests/confirms article title** with SEO potential
5. **Gets user approval** on title and framework selection
6. **Selects the best framework** based on article goal (7 frameworks available)
7. **Writes original, researched content** following the chosen framework
8. **Generates HTML** matching site design (dark theme)
9. **Updates sitemap.xml** for SEO
10. **Updates articles.html** index page (schema, category, all articles, search)
11. **Generates Markdown** for newsletter reuse (saved in `articles/markdown/`)
12. **Marks topic as PUBLISHED** in research.md
13. **Reports** what was created with sources

---

## Article Frameworks

### Framework 1: PAS (Problem → Agitate → Solution)

**Structure:**
1. Hook with pain-point questions ("Can you answer YES to any of these?")
2. Describe the problem in detail
3. Agitate: Make it worse, show consequences
4. Expose lies/myths people believe
5. "Just imagine..." (show the desired state)
6. Present the solution/system
7. Proof points and examples
8. CTA to startup-ideas.html
9. FAQ / TL;DR

**Best for:** Conversion-focused content, sales-style articles
**Tone:** Direct, empathetic, slightly urgent, uses "you" constantly
**Example:** "Stop Overthinking, Start Building"

---

### Framework 2: How-To Tutorial (PIE)

**Structure:**
1. Hook: Who this is for (pain-point questions)
2. Context: Why the old way doesn't work
3. The tools/resources needed
4. Step-by-step framework with phases
   - Each step: Point → Illustration → Explanation
5. Real example walkthrough
6. What to do if stuck
7. CTA to startup-ideas.html
8. FAQ / TL;DR

**Best for:** Educational content, tutorials, practical guides
**Tone:** Helpful, instructive, clear, encouraging
**Example:** "How to Build Your First App in a Weekend"

---

### Framework 3: Hero's Journey (StoryBrand)

**Structure:**
1. The reader's ordinary world (current struggles)
2. The call to adventure (opportunity presented)
3. Meeting the guide (introduce Weekend MVP/methodology)
4. The plan (clear steps to follow)
5. The call to action
6. Showing what failure looks like (if they don't act)
7. Showing success (transformation achieved)
8. CTA to startup-ideas.html

**Best for:** Brand stories, transformation content, case studies
**Tone:** Narrative, emotional, aspirational
**Example:** "From Side Hustle to Shipped: A Weekend Builder's Story"

---

### Framework 4: BAB (Before → After → Bridge)

**Structure:**
1. BEFORE: Paint the painful current state vividly
   - What life looks like now (frustration, stuckness)
   - Specific details that resonate
2. AFTER: Show the desired outcome
   - What life could look like
   - Specific, tangible results
3. BRIDGE: How to get from Before to After
   - The methodology/approach
   - Why it works
   - How to start
4. CTA to startup-ideas.html

**Best for:** Transformation stories, testimonial-style content
**Tone:** Visual, contrast-heavy, inspiring
**Example:** "What Changes When You Finally Ship Something"

---

### Framework 5: Inverted Pyramid (Journalist)

**Structure:**
1. Lead: Most important information first (the answer)
2. Key supporting facts (the why)
3. Background and context
4. Additional details
5. CTA to startup-ideas.html

**Best for:** News-style posts, announcements, quick-hit SEO
**Tone:** Factual, authoritative, scannable
**Example:** "The AI Tools Changing How Non-Technical Founders Build"

---

### Framework 6: Listicle

**Structure:**
1. Brief intro (why this matters)
2. Numbered items (5, 7, or 10 work best)
   - Each item: Title + Description + Why it matters
3. Brief conclusion
4. CTA to startup-ideas.html

**Best for:** SEO content, social shares, resource compilations
**Tone:** Practical, organized, snackable
**Example:** "7 Micro-SaaS Ideas You Can Build Solo in 2026"

---

### Framework 7: Myth-Busting

**Structure:**
1. Hook: Common belief that's wrong
2. List of myths/lies (3-5)
   - Myth stated
   - Why people believe it
   - The truth (with proof)
3. What to do instead
4. The better approach
5. CTA to startup-ideas.html

**Best for:** Contrarian content, thought leadership
**Tone:** Authoritative, slightly provocative, backed by evidence
**Example:** "5 Startup Myths Keeping You From Shipping"

---

## Framework Selection Matrix

| Article Goal | Recommended Framework |
|-------------|----------------------|
| Drive signups/conversions | PAS |
| Teach a skill/process | How-To Tutorial |
| Tell a success story | Hero's Journey or BAB |
| Rank for "[X] ideas" keywords | Listicle |
| Challenge conventional wisdom | Myth-Busting |
| Break news or announce | Inverted Pyramid |
| Show transformation | BAB |

---

## Step-by-Step Process

### Step 0: Check Topics Queue (FIRST STEP)

**Always start by reading the topics queue:**

```
Read: .claude/skills/publish-article/topics/research.md
```

**If user says "next" or "topic N":**
1. Find the next `[ ] **QUEUED**` topic in research.md
2. Use the pre-researched keywords, framework, and sources
3. Skip to Step 4 (title is already defined)

**If user provides a specific topic:**
1. Check if it matches a queued topic (use that research)
2. If not found, proceed with fresh keyword research (Step 1)

### Step 1: Keyword Research (if not using queue)

Use WebSearch to research:

```
"{topic} 2026"
"{topic} for beginners"
"how to {topic}"
"{topic} ideas"
"{topic} without {barrier}"
```

**Goal:** Find 3-5 high-potential keywords and understand search intent.

### Step 2: Competitor Analysis

Search for existing content:
```
"best articles about {topic}"
"{topic} guide"
```

**Goal:** Identify gaps and angles not covered.

### Step 3: Generate Title Options

Create 5-10 title options considering:
- Primary keyword near the front
- Specific numbers when possible (7, 5, 48 hours)
- Clear benefit or outcome
- Curiosity or pattern interrupt

**Title Formulas:**
- How to [Achieve X] (Even If [Barrier])
- [Number] [Things] You Can [Action] in [Timeframe]
- The [Adjective] Guide to [Topic]
- Why [Common Belief] Is Wrong (And What to Do Instead)
- [Topic]: From [Before State] to [After State]
- Stop [Bad Action], Start [Good Action]

### Step 4: Get User Approval

Present title options with:
- Target keyword for each
- Recommended framework
- Brief rationale

Use AskUserQuestion to get selection.

### Step 5: Select Framework

Based on the chosen title and goal, select the best framework from the 7 options above.

### Step 6: Research Content

Perform additional WebSearch queries for:
- Statistics and data points
- Real examples and case studies
- Expert quotes (if applicable)
- Tool/resource recommendations

**CRITICAL:** All statistics must come from WebSearch, not invented.

### Step 7: Write Content

Follow the selected framework structure exactly. Key guidelines:

**Tone (consistent across all frameworks):**
- Direct, conversational
- Uses "you" constantly
- Short paragraphs (1-3 sentences)
- Lots of white space
- Real talk, no corporate speak
- Specific > vague
- Avoid: "disrupt", "scale", "iterate", startup jargon

**CTAs:**
- Include 3 CTA placements minimum
- Early CTA (after establishing problem)
- Middle CTA (after showing solution/value)
- Final CTA (end of article)
- All link to `/startup-ideas.html`

### Step 8: Generate HTML

Use the article template structure:

```html
<!DOCTYPE html>
<html lang="en" class="antialiased dark">
<head>
    <!-- Meta tags, schema, etc. -->
    <link rel="canonical" href="https://weekendmvp.app/articles/{slug}.html">
    <!-- Google Analytics will be auto-injected after canonical -->
</head>
<body class="relative min-h-screen overflow-x-hidden selection:bg-white/20 selection:text-white bg-[#050505]">
    <!-- Navigation -->
    <!-- Article content -->
    <!-- Footer -->
</body>
</html>
```

**Required elements:**
- Dark theme (#050505 background)
- Navigation with "Browse Ideas" CTA
- Breadcrumb navigation
- Proper heading hierarchy (h1 > h2 > h3)
- Multiple CTAs linking to startup-ideas.html
- Footer matching site design
- **Canonical link** (required for GA auto-injection)

**After generating HTML, auto-inject Google Analytics:**
```bash
node scripts/inject-analytics.js articles/{slug}.html
```

This automatically adds GA tracking code after the canonical link. The script is idempotent (safe to run multiple times).

### Step 9: Add Meta Tags & Schema

**Required meta tags:**
```html
<meta property="og:type" content="article">
<meta property="og:image" content="https://weekendmvp.app/image/og-image.png">
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:image" content="https://weekendmvp.app/image/og-image.png">
<link rel="canonical" href="https://weekendmvp.app/articles/{slug}.html">
```

**Required JSON-LD:**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{TITLE}",
  "description": "{META_DESCRIPTION}",
  "author": {
    "@type": "Person",
    "name": "John Iseghohi",
    "url": "https://cal.com/switchtoux"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Weekend MVP",
    "url": "https://weekendmvp.app"
  },
  "datePublished": "{YYYY-MM-DD}",
  "dateModified": "{YYYY-MM-DD}",
  "image": "https://weekendmvp.app/image/og-image.png"
}
```

### Step 10: Save HTML File

1. Save HTML to: `articles/{slug}.html`
2. Update `sitemap.xml`:

```xml
<url>
  <loc>https://weekendmvp.app/articles/{slug}.html</loc>
  <lastmod>{YYYY-MM-DD}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

### Step 10.5: Update Articles Index Page (REQUIRED)

**Update `articles.html` to include the new article in 5 places:**

1. **Update JSON-LD Schema** - Increment `numberOfItems` and add new ListItem:
```json
{
  "@type": "ListItem",
  "position": {NEXT_NUMBER},
  "item": {
    "@type": "Article",
    "name": "{TITLE}",
    "url": "https://weekendmvp.app/articles/{slug}.html"
  }
}
```

2. **Add to Category Card** - Add to the appropriate category (Building, Mindset, or Ideas):
```html
<li class="relative pl-8">
    <span class="article-number">{NN}</span>
    <a href="articles/{slug}.html" class="article-link group flex items-start justify-between gap-4 text-neutral-300" data-article>
        <span class="group-hover:text-[#CC5500] transition-colors">{TITLE}</span>
        <iconify-icon icon="lucide:arrow-up-right" width="16" class="text-neutral-600 group-hover:text-[#CC5500] transition-colors shrink-0 mt-1" aria-hidden="true"></iconify-icon>
    </a>
</li>
```
Also update the category footer article count.

3. **Add to "All Articles" Section** - Add at top (newest first):
```html
<a href="articles/{slug}.html" class="group block p-6 bg-[#0A0A0A] border border-white/[0.06] rounded-xl hover:border-[#CC5500]/30 transition-all" data-article-item>
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#CC5500]/10 text-[#CC5500] border border-[#CC5500]/20">{CATEGORY}</span>
                <span class="text-xs font-mono text-neutral-600">{DATE}</span>
            </div>
            <h3 class="text-lg font-medium text-white group-hover:text-[#CC5500] transition-colors">{TITLE}</h3>
            <p class="mt-2 text-sm text-neutral-500 line-clamp-2">{DESCRIPTION}</p>
        </div>
        <iconify-icon icon="lucide:arrow-right" width="20" class="text-neutral-600 group-hover:text-[#CC5500] group-hover:translate-x-1 transition-all" aria-hidden="true"></iconify-icon>
    </div>
</a>
```

4. **Update Stats Bar** - Change `id="article-count"` value

5. **Update JavaScript Array** - Add to the `articles` array for search:
```javascript
{
    title: '{TITLE}',
    category: '{building|mindset|ideas}',
    element: document.querySelector('[data-category="{category}"]')
}
```
Also update the fallback count in `articleCount.textContent`.

**Category Mapping:**
| Article Type | Category |
|--------------|----------|
| Tutorials, How-To | building |
| Mindset, Strategy, Myths | mindset |
| Ideas, Listicles | ideas |

### Step 11: Generate Markdown File (for Newsletter)

Save a markdown version for newsletter reuse in `articles/markdown/{slug}.md`.

**Template:**
```markdown
---
title: "{TITLE}"
description: "{META_DESCRIPTION}"
date: "{YYYY-MM-DD}"
author: "John Iseghohi"
slug: "{slug}"
---

# {TITLE}

{SUBHEADLINE}

---

{ARTICLE_CONTENT_AS_MARKDOWN}

---

**[Browse Startup Ideas →](https://weekendmvp.app/startup-ideas.html)**
```

**Guidelines:**
- Extract pure content (no HTML nav/footer/scripts)
- Convert all HTML formatting to markdown (h2 → ##, lists → -, bold → **)
- Keep all CTAs as markdown links
- Frontmatter enables easy parsing for Beehiiv newsletters
- No HTML elements or Tailwind classes in the markdown

### Step 12: Mark Topic as Published (REQUIRED)

**Update the topics queue in `.claude/skills/publish-article/topics/research.md`:**

Find the topic entry and change:
```markdown
#### Topic N
- [ ] **QUEUED**
- **Title:** {title}
```

To:
```markdown
#### Topic N
- [x] **PUBLISHED**
- **Title:** {title}
- **Slug:** {slug}
- **Framework:** {framework-used}
- **Published:** {YYYY-MM-DD}
- **File:** articles/{slug}.html
```

**This step is REQUIRED** - the queue must stay accurate for future runs.

---

## Accessibility Requirements

**CRITICAL:** All articles must follow `/CLAUDE.md` accessibility guidelines.

**Checklist:**
- [ ] All icon-only buttons have `aria-label`
- [ ] All decorative icons have `aria-hidden="true"`
- [ ] Logo divs have `role="img"` and `aria-label="Weekend MVP"`
- [ ] External links have `rel="noopener noreferrer"` + sr-only text
- [ ] Focus rings use `focus:ring-white/40` (not /20)
- [ ] Proper heading hierarchy (no skipped levels)

---

## SEO Requirements

**Title Tag:** 50-60 characters, keyword near front
**Meta Description:** 150-160 characters, includes keyword
**URL Slug:** Lowercase, hyphens, keyword-rich
**H1:** Matches title (one per page)
**Internal Links:** Link to startup-ideas.html multiple times
**External Links:** If citing sources, use `rel="noopener noreferrer"`

---

## Article Topics Bank

**Full topic queue with research is stored in:**
```
.claude/skills/publish-article/topics/research.md
```

### Quick Reference (14 topics total):

**Published:**
- [x] Stop Overthinking, Start Building (PAS)
- [x] How to Build Your First App in a Weekend (How-To)

**Tier 1 - High Volume (Queued):**
- [ ] 7 Micro-SaaS Ideas You Can Build Solo in 2026 (Listicle)
- [ ] How to Validate a Startup Idea in 48 Hours (How-To)
- [ ] The $1K/Month Idea: Why You Don't Need a Billion-Dollar Startup (Myth-Busting)

**Tier 2 - Medium Volume (Queued):**
- [ ] Vibe Coding 101: Build Apps with Claude, Cursor, and Bolt (How-To)
- [ ] 5 Side Projects That Actually Make Money (Listicle)
- [ ] When to Quit Your Job for Your Side Project (Listicle/BAB)
- [ ] Why ChatGPT Can't Give You Good Startup Ideas (Myth-Busting)
- [ ] The 3-Screen MVP: The Only Framework You Need (How-To)

**Tier 3 - Niche (Queued):**
- [ ] The Real Cost of Not Shipping (BAB)
- [ ] Build in Public in 2026: What's Changed (Myth-Busting)
- [ ] The Non-Technical Founder's Stack in 2026 (Listicle)
- [ ] Ship It Saturday: A Framework for Weekend Builders (How-To)

**See `topics/research.md` for full details including:**
- Keywords and search volume indicators
- Pre-researched sources
- Market statistics to use
- Recommended frameworks

---

## Output Report

After completion, report:

```
## Published: {ARTICLE_TITLE}

**Files created/modified:**
- articles/{slug}.html (new - with GA tracking auto-injected)
- articles/markdown/{slug}.md (new - for newsletter)
- sitemap.xml (updated)
- articles.html (updated - added to index)
- .claude/skills/publish-article/topics/research.md (topic marked as published)

**Analytics:**
- Google Analytics automatically injected via `scripts/inject-analytics.js`
- GA tracking ID: G-Z1NYERTKRS
- Meta Pixel ID: 1602726847528813

**Framework used:** {FRAMEWORK_NAME}

**Target keywords:**
- Primary: {keyword}
- Secondary: {keyword}, {keyword}

**CTAs included:** {NUMBER} links to startup-ideas.html

**SEO:**
- Title: {TITLE} ({CHAR_COUNT} chars)
- Meta description: {DESC} ({CHAR_COUNT} chars)
- Sitemap updated: Yes

**Topics Queue:**
- Topic {N} marked as PUBLISHED
- Remaining queued topics: {COUNT}

**Research sources:**
- {SOURCE_1}
- {SOURCE_2}

**Preview:** Open articles/{slug}.html in browser to verify.
```

---

## Checklist

Before marking complete:

- [ ] Topics queue checked (research.md read)
- [ ] Keyword research performed (or used from queue)
- [ ] Title approved by user
- [ ] Framework selected and followed
- [ ] Content is original (not copied from sources)
- [ ] All statistics sourced from WebSearch
- [ ] 3+ CTAs to startup-ideas.html included
- [ ] HTML follows site design patterns
- [ ] Meta tags and JSON-LD schema added
- [ ] sitemap.xml updated
- [ ] **articles.html updated** (schema, category card, all articles, JS search array)
- [ ] Markdown version saved in articles/markdown/
- [ ] **Topic marked as PUBLISHED in research.md** (REQUIRED)
- [ ] Accessibility requirements met
- [ ] Mobile responsive design
- [ ] Links tested and working

---

## Error Handling

- If keyword has low search potential: Suggest alternatives
- If topic is too broad: Ask for narrowing
- If no good data found: Note gaps, proceed with available info
- If similar article exists: Suggest differentiation angle

---

## Quick Reference: Framework Cheat Sheet

| Framework | Opens With | Middle | Closes With |
|-----------|------------|--------|-------------|
| PAS | Pain questions | Agitate + Lies + Solution | CTA + FAQ |
| How-To | Who this is for | Step-by-step + Example | CTA + FAQ |
| Hero's Journey | Ordinary world | Guide + Plan + Stakes | Transformation + CTA |
| BAB | Before (pain) | After (vision) | Bridge (how) + CTA |
| Inverted Pyramid | Key answer | Supporting facts | Background + CTA |
| Listicle | Why this matters | Numbered items | Conclusion + CTA |
| Myth-Busting | Wrong belief | Myths + Truths | Better approach + CTA |
