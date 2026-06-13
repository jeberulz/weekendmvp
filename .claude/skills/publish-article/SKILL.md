---
name: publish-article
description: "Research, write, and publish SEO-optimized articles to drive traffic to /startup-ideas. Performs keyword research, selects the best framework, writes an original MDX article with rich frontmatter, appends the articles manifest, then seeds Convex and generates the OG/hero card. Usage: /publish-article {topic-or-keyword}"
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
8. **Writes the MDX article** to `content/articles/{slug}.mdx` (rich frontmatter + markdown body)
9. **Appends the manifest entry** to `articles/manifest.json` (metadata + OG subject/accent)
10. **Seeds Convex** via `npm run seed:convex` so the article wires into the `/articles` index
11. **Generates the OG/hero card** via `npm run og:generate` (non-blocking)
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
8. CTA to /startup-ideas
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
7. CTA to /startup-ideas
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
8. CTA to /startup-ideas

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
4. CTA to /startup-ideas

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
5. CTA to /startup-ideas

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
4. CTA to /startup-ideas

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
5. CTA to /startup-ideas

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
- All link to `/startup-ideas` (the App Router route — no `.html`)

### Step 8: Write the MDX Article File

Save the article to:
```
content/articles/{slug}.mdx
```

The article page (`app/articles/[slug]/page.tsx`) reads this file directly. **The route — not the skill — produces the page metadata, OpenGraph/Twitter tags, JSON-LD `Article` schema, the hero image, the nav, and the footer.** Do NOT emit any `<!DOCTYPE html>`, `<head>`, `<script>`, nav, breadcrumb, footer, hero `<figure>`, or JSON-LD HTML. You write only frontmatter + a markdown body.

(Analytics, the canonical link, and the author byline are also handled globally by the App Router layout/route — no per-page injection step exists anymore.)

**Frontmatter (rich — the page reads these fields directly):**

```yaml
---
slug: "{slug}"
title: "{Full article title}"
description: "{150-160 char meta description — REQUIRED, non-empty}"
category: "{e.g. Tutorial, Mindset, Ideas}"
publishedAt: "{YYYY-MM-DD}"
wordCount: {body word count}
readMinutes: {Math.max(1, Math.round(wordCount / 200))}
heroAlt: "{concise, article-specific alt text for the hero/OG image}"
---
```

Field reference (authoritative `ArticleFrontmatter` type in `app/articles/[slug]/page.tsx`):

| Field | Required | Notes |
|-------|----------|-------|
| `slug` | **yes** | lowercase, hyphenated, matches the filename and `^[a-z0-9-]+$` |
| `title` | **yes** | full title, no ` \| Weekend MVP` suffix |
| `description` | **yes** | 150-160 chars, **non-empty** — there is NO excerpt fallback for articles, so an empty `description` breaks the page metadata |
| `category` | no | e.g. `Tutorial`, `Mindset`, `Ideas` |
| `publishedAt` | no | `YYYY-MM-DD` |
| `wordCount` | no | integer |
| `readMinutes` | no | integer |
| `heroAlt` | no | alt text for the hero/OG image |

**`heroAlt` rules** (this frontmatter field replaces the old in-HTML hero `<figure>` `alt`):
- Derive from the `og.subject` you write in Step 9 — shorten to one descriptive sentence, article-specific (not decorative)
- Informative, never empty; passes WCAG
- Example: `og.subject` = *"A pencil mid-stroke on a dark desk beside an open planner…"* → `heroAlt` = *"Pencil on a dark desk beside an open planner with a circled date, lit from the side"*

The route renders the hero from `/image/og/article/{slug}.png` using `heroAlt`. That PNG is generated in Step 11; if generation fails the hero `<img>` simply 404s until a retry — the article still ships.

**Body (standard markdown):**
- Follow the selected framework structure exactly.
- Use `##` / `###` headings. **Do not add an `<h1>` or a `#` title** — the route renders the `<h1>` from `title`.
- Use markdown lists, bold, and fenced code blocks (```` ``` ````) as needed.
- Keep the tone guidelines from Step 7.
- **Include 3+ CTAs linking to `/startup-ideas`** (the App Router route — no `.html`). Place one early (after establishing the problem), one middle (after the solution), one at the end.

Mirror an existing well-formed article for frontmatter shape and body rhythm:
```
content/articles/how-to-build-your-first-app-in-a-weekend.mdx
```

**Automatic (no manual step):** the `/articles` index, its ItemList JSON-LD, the per-article schema/OG tags, and the sitemap entry are all generated from the MDX + Convex after seeding (Step 10) and build. The skill never hand-edits `articles.html` or `sitemap.xml`.

### Step 9: Append the Manifest Entry (REQUIRED for OG + Convex)

`articles/manifest.json` is the metadata source of truth for OG card generation and Convex seeding. Append a new entry to the `articles[]` array (read an existing entry in `articles/manifest.json` for the exact shape):

```json
{
  "slug": "{slug}",
  "title": "{title — no ' | Weekend MVP' suffix}",
  "description": "{same description as the MDX frontmatter}",
  "wordCount": {body word count},
  "readMinutes": {Math.max(1, Math.round(wordCount / 200))},
  "og": {
    "subject": "{director's-note for Recraft — see guide below}",
    "accent": "{one of: lime, mint, lavender, emerald}",
    "status": "pending"
  }
}
```

**Writing `og.subject` (the Recraft prompt subject):**

Articles use the **reading/thinking object** library — pencil mid-stroke, open notebook, paperback book with bookmark, sticky note, index cards, planner with date circled, clipboard with checklist, weathered receipts, crumpled paper beside a fresh notebook. Match the brand: **dark scene, single accent light source, ONE concrete tactile object, very shallow focus, no people/faces/text**.

✅ **Good**: `"An open notebook on a dark surface, single line of mint-glowing handwriting visible, very shallow focus, late-night atmosphere"`

❌ **Bad**: `"image about claude code"` (vague, no scene, no object)

❌ **Bad**: `"a developer thinking about ideas"` (people, abstract)

See `IMAGES.md` for the full prompt-writing guide.

**Picking `og.accent`:**

`lime` (#D4FF5B), `mint` (#8FF59B), `lavender` (#C5AEE8), `emerald` (#2F5F53). Pick one that fits the article's emotional vibe (lime for money/CTA, mint for progress, lavender for calm/welcome, emerald for grounding) AND avoids monotony with adjacent articles in the manifest.

**Aubergine (`#1E1B38`) is intentionally NOT used on article cards** — it's too dark to read as a label / dot / bar on the article template's `#050505` left panel. Only ideas use aubergine.

See `IMAGES.md` for the full prompt-writing guide referenced above.

### Step 10: Seed Convex (REQUIRED for index visibility)

The `/articles` index (`app/articles/page.tsx`) lists articles from the filesystem MDX but overlays Convex for `publishedAt`. Seed Convex so the new entry is fully wired:

```bash
npm run seed:convex -- --only articles
```

(Plain `npm run seed:convex` re-seeds everything idempotently — upsert by slug — and is also fine.)

**Prerequisite:** the Convex **dev** deployment must be running. In a separate terminal:
```bash
npx convex dev
```

**Failure mode:** if `npx convex dev` is not running, `seed:convex` errors because it cannot reach the deployment. The MDX page at `/articles/{slug}` still renders from disk, but the `/articles` index `publishedAt` overlay won't update until you start Convex dev and re-run the seed. Surface this clearly — do **not** report the article as fully live if seeding failed.

### Step 11: Generate the OG/Hero Card (non-blocking — never fails the publish)

```bash
npm run og:generate -- --slug {slug} --surface article --non-blocking
```

**Behavior:**
- **Success:** writes `image/og/article/{slug}.png` and flips manifest `og.status` from `"pending"` → `"ready"`. The same PNG is the in-page hero (the route renders it via `heroAlt`). Provider name (`recraft` or `openai-gpt-image-1`) is logged so you can spot fallbacks.
- **Failure (Recraft AND `gpt-image-1` both errored):** flips `og.status` to `"failed"` and exits 0 (because `--non-blocking`). The publish flow continues; the hero `<img>` 404s until a retry, and a future `npm run og:generate` pass retries every `"failed"` entry.

**Critical invariant:** publish-article's success status MUST stay independent of the OG card outcome. Never let a Recraft/OpenAI API error block an article from shipping. See `IMAGES.md` for setup and drift recovery.

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
- **File:** content/articles/{slug}.mdx
```

**This step is REQUIRED** - the queue must stay accurate for future runs.

---

## Accessibility Requirements

The page chrome (nav, logo, footer, author byline, hero image, focus styles) is rendered by `app/articles/[slug]/page.tsx` + the App Router layout and already meets `/CLAUDE.md` accessibility guidelines — the skill does not author that HTML. Your only accessibility responsibilities live in the MDX:

**Checklist:**
- [ ] `heroAlt` frontmatter is informative and non-empty (the route uses it as the hero/OG `alt`)
- [ ] Body heading hierarchy is logical (`##` then `###`, no skipped levels; no manual `<h1>`)
- [ ] Any markdown links to external sources are written with descriptive link text

---

## SEO Requirements

**Title Tag:** 50-60 characters, keyword near front
**Meta Description:** 150-160 characters, includes keyword
**URL Slug:** Lowercase, hyphens, keyword-rich
**H1:** Rendered by the route from `title` (do not author one in the body)
**Internal Links:** Link to `/startup-ideas` multiple times from the body
**External Links:** If citing sources, use standard markdown links with descriptive text

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
- content/articles/{slug}.mdx (new — rich frontmatter + markdown body)
- articles/manifest.json (entry appended with og.subject + og.accent + og.status)
- Convex (seeded via `npm run seed:convex` — `/articles` index overlay)
- image/og/article/{slug}.png (new — composed OG card, IF og.status=ready; also the in-page hero)
- .claude/skills/publish-article/topics/research.md (topic marked as published)

**Convex seed:** {success | FAILED — Convex dev not running; article renders from MDX but index publishedAt not updated until reseed}

**OG card:** {provider used: recraft | openai-gpt-image-1} — og.status: {ready | failed}. {If failed: hero 404s until a future `npm run og:generate` retry; publish still succeeded.}

**Framework used:** {FRAMEWORK_NAME}

**Target keywords:**
- Primary: {keyword}
- Secondary: {keyword}, {keyword}

**CTAs included:** {NUMBER} links to /startup-ideas

**SEO:**
- Title: {TITLE} ({CHAR_COUNT} chars)
- Meta description: {DESC} ({CHAR_COUNT} chars)

**Topics Queue:**
- Topic {N} marked as PUBLISHED
- Remaining queued topics: {COUNT}

**Research sources:**
- {SOURCE_1}
- {SOURCE_2}

**Preview:** Run `npm run dev` and open `/articles/{slug}` to verify.
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
- [ ] 3+ CTAs to `/startup-ideas` included in the body
- [ ] `content/articles/{slug}.mdx` written with rich frontmatter (non-empty `description`) + markdown body
- [ ] No HTML/head/nav/footer/hero/JSON-LD emitted (the route owns all of it)
- [ ] `heroAlt` frontmatter is descriptive and non-empty
- [ ] `articles/manifest.json` appended with new entry (og.subject + og.accent + og.status: "pending")
- [ ] Ran `npm run seed:convex -- --only articles` (Convex dev running); seed result reported
- [ ] Ran `npm run og:generate -- --slug {slug} --surface article --non-blocking` (Step 11)
- [ ] Confirmed og.status is "ready" or "failed" (publish proceeds either way)
- [ ] **Topic marked as PUBLISHED in research.md** (REQUIRED)
- [ ] Body heading hierarchy logical (no manual `<h1>`)
- [ ] `/articles/{slug}` renders in `npm run dev`

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
