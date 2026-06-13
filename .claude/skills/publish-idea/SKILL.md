---
name: publish-idea
description: "Publish a startup idea page on the Next.js + MDX + Convex site. REQUIRED PATH: Ideabrowser MCP — pulls a pre-validated, scored, citation-backed idea and runs a 7-call research stack. DRAFT OPT-IN (only when no MCP match exists): /publish-idea --from-draft {folder-name}. Writes content/ideas/{slug}.mdx (body) + an ideas/manifest.json entry (metadata), runs the manual section gate, then seeds Convex (npm run seed:convex) and generates the OG card (npm run og:generate). Usage: /publish-idea <idea_id> (MCP) OR /publish-idea --from-draft {folder-name} (drafts)."
---

# Publish Idea Skill

Transform validated startup ideas into research-backed `/ideas/{slug}` pages on the Next.js App Router site.

## How a page actually renders (read this first)

The site is **Next.js + MDX + Convex**, not static HTML. An idea page is produced from two files plus two automated steps — the skill never writes HTML, `<head>`, schema, nav, or analytics:

| Layer | Owned by | This skill writes? |
|---|---|---|
| **Body** (the prose) | `content/ideas/{slug}.mdx` — frontmatter (`slug` + `title` only) + canonical `##` sections | ✅ yes |
| **Metadata** (description, category, scores, og, provenance) | `ideas/manifest.json` `ideas[]` — the source of truth | ✅ yes |
| **Grid card + ItemList JSON-LD** on `/startup-ideas`, hub pages | generated dynamically from Convex after `seed:convex` | ❌ automatic |
| **Page metadata, OG tags, full JSON-LD @graph** (Person / Article / SoftwareApplication / HowTo / BreadcrumbList) | `app/ideas/[slug]/page.tsx` — derived from MDX + manifest | ❌ route does it |
| **Nav, footer, analytics** | shared App Router layout (`app/layout.tsx`) | ❌ global, no per-page injection |
| **Sitemap entry** | `app/sitemap.ts` auto-discovers `content/ideas/*.mdx` | ❌ automatic |
| **OG card PNG** | `image/og/idea/{slug}.png` via `npm run og:generate` | ✅ automated step |

Practical consequences:
- The `HowTo` schema is parsed from the MDX body: the `## The Solution` section **must** contain a `**How it works:**` line followed by a numbered list (`1.` / `2.` / `3.`). Those become the HowTo steps.
- The idea's meta description comes from the `manifest.json` `description` field; if absent the route falls back to an `excerpt()` of the first paragraph. Always set `description` in the manifest.
- Slugs must match `^[a-z0-9-]+$` (validated in `lib/mdx.tsx`). Files starting with `_` are excluded.
- **An idea is NOT live until it is seeded into Convex.** The grid and all hub pages query Convex first; MDX is only a build-time fallback for the individual page. Skipping `seed:convex` means the page may render at `/ideas/{slug}` but never appears in the `/startup-ideas` grid or hubs.

---

## Two Modes

### 🟢 Mode A — Ideabrowser MCP (REQUIRED default)

```
/publish-idea <idea_id>
```

Example: `/publish-idea 20`

Pulls a pre-validated idea from the Ideabrowser database (1,474+ scored ideas). Each idea ships with cited market research, competitor pricing, community signals from Reddit/YouTube/Facebook, value-ladder pricing tiers, and a Hormozi-style offer breakdown. Mode A is the **default, required path** — it produces bodies that clear the section contract (`ideas/SECTIONS.md`). Do not fall back to WebSearch.

### 🟡 Mode B — Draft Folder (explicit opt-in only)

```
/publish-idea --from-draft {folder-name}
```

Example: `/publish-idea --from-draft nutrition-planner`

Reads `ideas/drafts/{folder-name}/raw.md`, then performs deep WebSearch research. **Only use this when the user explicitly passes `--from-draft`.** Typical trigger: an original concept with no matching MCP record. Mode B must still clear the same section bar (same 7 sections, ≥ ~800 words of body), which means WebSearch must produce 3+ competitors with pricing and 2+ cited market stats — not optional.

### Which mode to pick?

| Situation | Mode |
|---|---|
| User gives a numeric `idea_id` | **A (MCP)** — default |
| User says "find a new idea to publish" | **A (MCP)** — call `browse_ideas`, then publish chosen result |
| User passes `--from-draft {folder-name}` explicitly | **B (folder)** |
| User points to `ideas/drafts/` without `--from-draft` | Ask: do they want Mode A (look up matching MCP idea) or Mode B (pass `--from-draft`)? |
| Folder exists AND matching MCP idea exists | **A (MCP)** — richer data, do not prompt |

If ambiguous, default to Mode A and ask the user to confirm the idea_id.

---

## What This Skill Does (both modes)

1. **Sources content** — Mode A: MCP `get_idea_research` calls. Mode B: WebSearch on raw.md keywords.
2. **Writes original expanded content** based on research findings (NEVER copies raw text verbatim except the title).
3. **Writes** `content/ideas/{slug}.mdx` — minimal frontmatter (`slug` + `title`) + the canonical `##` body sections.
4. **Adds** an entry to `ideas/manifest.json` with full provenance, scores, og, and the meta description.
5. **Runs the manual section gate** against `ideas/SECTIONS.md` (all 7 sections present, body ≥ ~800 words, no leftover placeholders).
6. **Seeds Convex** via `npm run seed:convex` so the idea appears in the grid + hubs.
7. **Generates the OG card** via `npm run og:generate -- --slug {slug} --surface idea --non-blocking` (best-effort, never blocks the publish).
8. **Reports** what was created with research sources/citations.

The grid card, ItemList JSON-LD, page schema graph, nav/footer/analytics, and sitemap entry are **all produced automatically** by the App Router routes + layout after seeding and the next build — the skill no longer emits any of them.

---

## ═══════════════════════════════════════════
## MODE A: Ideabrowser MCP Workflow (DEFAULT)
## ═══════════════════════════════════════════

### A.1 — Source the idea

If the user supplies an `idea_id`, skip to A.2. Otherwise, call `mcp__ideabrowser__browse_ideas` to pick one. **Filter for weekend-MVP fit:**

```
mcp__ideabrowser__browse_ideas({
  sort: "highest_opportunity",
  build_difficulty: "easy",   // or "moderate" — never "hard"
  limit: 15
})
```

Then narrow to ideas where `scores.builder_confidence >= 7` AND `scores.opportunity >= 8`. Skip ideas with `founder_fit_tags` containing "domain_expertise_required" if it's deeply specialized (e.g., medical, legal).

Present the user a numbered shortlist (3–5 picks) with title, scores, and 1-line summary, then ask which to publish.

### A.2 — Pull deep research (7 calls, all required)

Run these MCP calls **in parallel** before writing any MDX. All seven are required — the section gate in Step 3 will fail without the sections they populate.

```
mcp__ideabrowser__get_idea_research({ idea_id })                                   // base record
mcp__ideabrowser__get_idea_research({ idea_id, section: "competitive_analysis" })  // → Competitive Landscape
mcp__ideabrowser__get_idea_research({ idea_id, section: "go_to_market" })          // → positioning, Business Model
mcp__ideabrowser__get_idea_research({ idea_id, section: "keyword_list" })          // → meta description keywords
mcp__ideabrowser__get_idea_research({ idea_id, section: "community_analysis" })    // → Problem evidence, social proof
mcp__ideabrowser__research_market_insight({ idea_id })                             // → Market Research stats
mcp__ideabrowser__research_trend({ idea_id })                                      // → "Why Now" timing angle
```

Capture the citation arrays from `competitive_analysis.data.citations` and `research_market_insight` for the `## Sources` section.

### A.2.1 — STOP rule (thin-research guard)

Before proceeding to A.3, verify:

- `competitive_analysis` returned **3 or more named competitors with pricing**
- `research_market_insight` returned **at least 2 cited market statistics**
- `go_to_market` returned **pricing tiers or positioning angles** (not empty)

If any fail, **STOP**. Do not fall back to generic WebSearch — that is what produced the thin pages Phase 1 quarantined. Surface the gap to the user:

> "MCP research for idea_id {n} returned thin data on {section}. Pick a different idea_id, or pass `--from-draft` to enter Mode B with full WebSearch discipline."

Wait for the user's decision. Never paper over thin MCP data.

### A.3 — Map MCP data → MDX body sections

Use this mapping (the MCP gives you most fields directly — don't re-research). Each row maps to a canonical `##` section in `content/ideas/{slug}.mdx`:

| MDX section | MCP source field |
|---|---|
| `title` (frontmatter) | `title` (clean it: strip "($XM ARR)" suffixes) |
| `description` (→ manifest, not MDX) | `summary` rewritten as a ~155-char SEO blurb |
| Category (→ manifest) | Map `categorization.type` + content domain → site category (SaaS/Productivity/Developer/etc.) |
| Build time (→ manifest) | If `builder_confidence >= 7` → 8-10 hrs. If 5-6 → 10-12 hrs. |
| **`## The Problem`** | `detailed_idea.pain_points_addressed` + `scores.pain.key_pain_points` + `scores.pain.market_evidence` |
| **`## The Solution`** (incl. `**How it works:**` numbered list) | `detailed_idea.detailed_summary` + `research_summaries.analysis.core_proposition.solution` + `product_offerings` for the steps |
| **`## Market Research`** | `scores.opportunity.market_potential.reason` + `tags.highlight_justification` + `research_market_insight` (real numbers + CAGR, already cited) |
| **`## Competitive Landscape`** (incl. `**Your Opportunity**`) | `competitive_analysis.data.content` (competitor names, pricing, gaps) + `research_summaries.market_gap` |
| **`## Business Model`** (incl. unit economics) | `value_ladder.offers` (Frontend / Middle / Backend tiers, already priced) + `revenue_potential.examples` |
| **`## Recommended Tech Stack`** | Derive from `detailed_idea.detailed_summary` (AI/API mentions); fall back to Next.js + Supabase + Clerk + the relevant AI API |
| **`## AI Prompts to Build This`** | Generate 3+ prompts (see Step 4) seeded with MCP-sourced features |
| **`## Sources`** | `competitive_analysis.data.citations` array + `research_market_insight` citations — markdown links |

### A.4 — Generate slug

From the cleaned title:
- Strip parentheticals: `"X ($2M ARR)"` → `"X"`
- Strip "AI-Powered", "Automated" prefixes if it makes the slug too long
- Lowercase, kebab-case: `"AI Landing Page Generator E-commerce"` → `"ai-landing-page-generator-ecommerce"`
- Must match `^[a-z0-9-]+$` (lowercase letters, digits, hyphens only — strip anything else, e.g. `&` → `and` or drop it)
- Verify uniqueness against `ideas/manifest.json` and `content/ideas/`

### A.5 — Write MDX, manifest, then seed + OG

Follow the shared sink sequence in **Steps 5–9** below (write `content/ideas/{slug}.mdx`, add the manifest entry, run the section gate, `npm run seed:convex`, `npm run og:generate`). Use the body-shape exemplars named in Step 4.5.

### A.6 — Output report (Mode A)

```
## Published: {IDEA_TITLE}

**Source:** Ideabrowser MCP (idea_id: {idea_id}) — opportunity {opportunity_score}/10, pain {pain_score}/10, timing {timing_score}/10

**Files created/modified:**
- content/ideas/{slug}.mdx (new — slug + title frontmatter, 8 canonical sections)
- ideas/manifest.json (updated — provenance, scores, og.subject/accent/status, description)
- Convex (seeded via `npm run seed:convex` — idea now in /startup-ideas grid + hubs)
- image/og/idea/{slug}.png (new — composed OG card via Recraft v3, IF og.status=ready)

**Seed status:** {seeded OK | FAILED — see seed-failure note in Step 8}
**OG card:** {provider: recraft | openai-gpt-image-1} — og.status: {ready | failed}. {If failed: page ships with the site-wide fallback image; a future `npm run og:generate` retries.}

**Sections included:** The Problem, The Solution (+ How it works), Market Research, Competitive Landscape, Business Model, Recommended Tech Stack, AI Prompts to Build This, Sources

**Citations (from MCP):**
- {citation_1}
- {citation_2}
- ... (list all from competitive_analysis.data.citations)

**Preview:** Run `npm run dev` and open http://localhost:5173/ideas/{slug} to verify all 8 sections render.
```

---

## ═══════════════════════════════════════════
## MODE B: Draft Folder Workflow (fallback)
## ═══════════════════════════════════════════

Use only when no MCP idea matches. Process below.

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

The 7 canonical sections are **always** present in a published MDX file. Research determines their depth, not their existence:

| Section (MDX `##`) | Always present | Research required |
|---------|---------------|-------------------|
| The Problem | ✅ | Search for pain points, user complaints, industry challenges |
| The Solution (+ How it works) | ✅ | Design user flow based on competitor analysis; numbered steps feed HowTo schema |
| Market Research | ✅ | **Must find 3+ stats** from web research |
| Competitive Landscape | ✅ | **Must research 3+ competitors** with current pricing |
| Business Model | ✅ | Base tiers on competitor pricing research |
| Recommended Tech Stack | ✅ | Research best tools for this type of app |
| AI Prompts to Build This | ✅ | Generate 3+ prompts based on researched tech stack |
| Sources | ✅ | Markdown links to the stats/pricing you cited |

If research is genuinely thin for a section, that is a signal to **stop and reconsider the idea** (Mode A: re-check the STOP rule; Mode B: do more WebSearch) — not to ship a stub section.

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

**Goal:** Understand current solutions and identify gaps for the "Your Opportunity" callout.

#### 2d. Tech Stack Research (if needed)
- `"best tech stack for {type of app} 2024"`
- `"{specific feature} API integration options"`

**Goal:** Recommend modern, appropriate technologies.

### Step 3: Write Original Content

Based on research findings, write ORIGINAL content for each section. **Do NOT copy from raw.md.**

**Body sections (live in the MDX file):**
- `## The Problem` — pain points and frustrations, cite stats
- `## The Solution` — how the product solves it, **including** a `**How it works:**` line followed by a numbered list (`1.` / `2.` / `3.`) — these steps are parsed into the page's HowTo JSON-LD
- `## Market Research` — stats, trends, validation (from Step 2a)
- `## Competitive Landscape` — named competitors, pricing, gaps (from Step 2b), plus a `**Your Opportunity**` callout
- `## Business Model` — pricing tiers, unit economics, target MRR path
- `## Recommended Tech Stack` — named framework/database/hosting/AI API
- `## AI Prompts to Build This` — 3+ fenced code blocks (see Step 4)
- `## Sources` — markdown links to everything you cited

**Metadata fields (live in `ideas/manifest.json`, NOT in MDX frontmatter):**
- `title` — the idea name (the only thing copied verbatim from raw.md); also the MDX `title`
- `description` — full meta description for SEO (write fresh, ~155 chars)
- `category` — one of: SaaS, Productivity, Creator, E-commerce, Fintech, Health, Education, Developer
- `buildTime`, `revenueGoal`, `applicationCategory`, `tools[]`, `audiences[]` — see the manifest schema in Step 6
- `og.subject` — a concrete, single-subject director's-note for the per-page OG card. Used by `npm run og:generate` (Step 9). Example: `"A glowing laptop screen on a dark counter, lavender backlight, late night, shallow focus"`. Match the brand: dark scene, one accent color visible, one tactile object, no people/faces/text. See `IMAGES.md` for the full prompt-writing guide.
- `og.accent` — one of `lime`, `mint`, `lavender`, `emerald`, `aubergine` — the brand accent for the card's logo chip / dot / bottom bar. Pick one that fits the idea's vibe and avoids monotony with adjacent manifest entries.

> Do **not** add `description`, `category`, `og`, or any other field to the MDX frontmatter. All 57 existing idea files carry **only** `slug` and `title`, and the route derives everything else from the manifest. Richer idea frontmatter is a bug.

### Step 4: Generate AI Build Prompts

Always generate 3+ prompts tailored to the specific idea, as fenced ```text code blocks under `## AI Prompts to Build This`. Suggested set:

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

**3. Configuration / Landing Page Prompt** (pick what fits the idea):
```
Add per-{entity} configuration for {IDEA_NAME}: {CONFIG_FIELDS_AND_BEHAVIOR}.
```

### Step 4.5: Voice check (required before writing MDX)

Before writing any prose, read **two existing well-formed idea MDX files** to calibrate tone, section depth, and link density:

- `content/ideas/sms-time-tracker.mdx` (8 sections, ~2,400 words, full Sources block)
- `content/ideas/ai-nutrition-planner-trainers.mdx` (8 sections, ~2,200 words, full Sources block)

Also keep `content/ideas/ai-code-reviewer.mdx` open as the **body-shape reference** for the `**How it works:**` numbered list, the `**Your Opportunity**` callout, the unit-economics bullets, and the AI-prompt code blocks.

Do **not** skim — read them. Then match their rhythm: section count, paragraph length in The Problem / The Solution, citation style in Market Research, competitor density, pricing-tier structure. Thin pages exist because earlier runs skipped this step and drifted toward short, generic copy. This step is cheap insurance.

### Step 5: Write the MDX file

Save the body to:

```
content/ideas/{slug}.mdx
```

Frontmatter is **exactly** two quoted fields, nothing else:

```mdx
---
slug: "{slug}"
title: "{Idea Title}"
---

## The Problem

{...}

## The Solution

{...}

**How it works:**

1. **{Step title}** — {step description}
2. **{Step title}** — {step description}
3. **{Step title}** — {step description}

## Market Research

{...}

## Competitive Landscape

{...}

**Your Opportunity**

{...}

## Business Model

{...}

## Recommended Tech Stack

{...}

## AI Prompts to Build This

Copy and paste these into Claude, Cursor, or your favorite AI tool.

**1. Project Setup**

```text
{prompt}
```

## Sources

- [{Source title}]({url})
- [{Source title}]({url})
```

Authoring rules for body quality:
- Plain GitHub-flavored markdown only (`##`/`###`, `**bold**`, `-` lists, `1.` lists, fenced ```code```, `[text](url)` links). No raw HTML, no `<head>`, no `<script>`, no email-gate markup, no nav/footer — the route and layout provide all of that.
- The `## The Solution` section **must** include the `**How it works:**` numbered list (HowTo schema depends on it).
- Slug in frontmatter must equal the filename and match `^[a-z0-9-]+$`.

### Step 6: Add the manifest entry (with provenance)

Add an entry to `ideas/manifest.json` `ideas[]` that captures full provenance so future backfill passes can reason about where content came from. **`manifest.json` is the metadata source of truth** — `seed:convex` reads it (→ Convex grid/hubs) and `og:generate` reads it (→ OG PNG):

```json
{
  "slug": "{slug}",
  "title": "{title}",
  "publishedAt": "{YYYY-MM-DD}",
  "category": "{category}",
  "description": "{meta_description}",
  "buildTime": "{hours}",
  "revenueGoal": "{1k-month|5k-month|10k-month}",
  "applicationCategory": "{SchemaCategory}",
  "tools": ["cursor", "claude", "bolt"],
  "audiences": ["developers", "solo-founders"],
  "source": "ideabrowser:{idea_id}",
  "og": {
    "subject": "{og_subject from Step 3}",
    "accent": "{og_accent from Step 3}",
    "status": "pending"
  },
  "provenance": {
    "researchCalls": [
      "get_idea_research",
      "competitive_analysis",
      "go_to_market",
      "keyword_list",
      "community_analysis",
      "research_market_insight",
      "research_trend"
    ],
    "citations": {N},
    "wordCount": {N},
    "auditPassed": true,
    "auditRunAt": "{ISO-8601 timestamp}"
  },
  "scores": { "opportunity": N, "pain": N, "timing": N, "builder_confidence": N },
  "researchLevel": "{deep|standard}"
}
```

Field rules:
- `description` — the meta description you wrote in Step 3. This feeds Convex and the grid card excerpt, and is the route's preferred meta description. Always set it.
- `source` — Mode A: `"ideabrowser:{idea_id}"`. Mode B (`--from-draft`): `"draft:{folder-name}"` and **drop the `scores` block** (scores are Mode A only).
- `applicationCategory` — Schema.org category for the SoftwareApplication node (e.g. `BusinessApplication` for SaaS, `DeveloperApplication` for Developer, `ProductivityApplication` for Productivity, `HealthApplication`, `FinanceApplication`, `EducationalApplication`, `MultimediaApplication`, `ShoppingApplication`).
- `og.subject` / `og.accent` — copy the values you authored in Step 3. `og.status` is `"pending"` here; Step 9 flips it to `"ready"` (success) or `"failed"` (both providers errored — non-blocking, page still ships).
- `provenance.researchCalls` — list the calls actually made. Mode B replaces MCP names with `"websearch:market"`, `"websearch:competitors"`, `"websearch:tech"`.
- `provenance.citations` / `provenance.wordCount` — count from your written MDX (citation links in `## Sources`; body words). `wordCount` should be ≥ ~800.
- `provenance.auditPassed` — set `true` only after the Step 7 manual gate passes.

Use today's date for `publishedAt`.

### Step 7: Manual section gate (replaces the old audit script)

There is **no audit script** anymore. Manually verify the MDX body against `ideas/SECTIONS.md` before seeding:

- [ ] All 7 required `##` sections present, in order: The Problem → The Solution → Market Research → Competitive Landscape → Business Model → Recommended Tech Stack → AI Prompts to Build This (plus `## Sources`).
- [ ] `## The Solution` contains the `**How it works:**` line + a numbered list (1./2./3.) — confirm it's there or the HowTo schema breaks.
- [ ] Body word count ≥ ~800 words (aim for 1,500–2,400 like the exemplars).
- [ ] Competitive Landscape names 3+ competitors with pricing; Market Research has 2+ cited stats.
- [ ] No leftover placeholders (`{{VAR}}`, `IDEA_TITLE`, `{slug}`, `TODO`, `Lorem`).
- [ ] Frontmatter is exactly `slug` + `title`, both quoted.

Quick mechanical check you can run:

```bash
grep -c '^## ' content/ideas/{slug}.mdx        # expect 8 (7 canonical + Sources)
grep -n 'How it works' content/ideas/{slug}.mdx # expect 1 hit under The Solution
wc -w content/ideas/{slug}.mdx                  # expect ~800+ words
```

If any check fails, fix the MDX before continuing. Do not set `provenance.auditPassed: true` until this passes.

### Step 8: Seed Convex (required for grid/hub visibility)

Push the idea (and the rest of the manifest) into Convex so it appears in `/startup-ideas` and all hub pages:

```bash
npm run seed:convex
```

- Seeds the **dev** Convex deployment (no `--prod`). It is **idempotent** — upserts by slug, so re-running is safe and re-seeds the whole manifest.
- **Prerequisite:** `npx convex dev` must be running in another terminal (or the seed functions must already be deployed via `npx convex deploy`). The seed script calls deployed Convex mutations.
- **Failure signature:** if Convex dev is not running, the command errors with a connection/deployment-not-found message and exits non-zero — it does **not** seed. If this happens, the idea page may still render at `/ideas/{slug}` (MDX fallback) but **will NOT appear in the grid or hubs**. Do not report the idea as "live" on the grid until seeding succeeds. Tell the user: start `npx convex dev`, then re-run `npm run seed:convex`.
- Dry-run preview (optional): `npm run seed:convex -- --dry-run`.

### Step 9: Generate the per-page OG card (best-effort, never blocks publish)

After the manifest entry is in place (with `og.subject` + `og.accent`), run the OG generator scoped to this slug with `--non-blocking`:

```bash
npm run og:generate -- --slug {slug} --surface idea --non-blocking
```

Behavior:
- On success: writes `image/og/idea/{slug}.png`, flips manifest `og.status` from `"pending"` → `"ready"`. Provider (`recraft` or `openai-gpt-image-1`) is logged so you can spot fallbacks.
- On failure (Recraft AND `gpt-image-1` both errored): flips `og.status` to `"failed"`, exits 0 (because `--non-blocking`). The publish continues. The route's OG meta points at the expected PNG path; social crawlers fall back to the site-wide `image/og-image.png` when the file is missing. A future `npm run og:generate` retries every entry with `og.status: "failed"`.

**Critical invariant:** the publish flow's success status MUST be independent of the OG card outcome. Never let a Recraft/OpenAI API error block an idea page from shipping.

See `IMAGES.md` for setup, drift recovery, and prompt-writing rules.

---

## What the route already provides (do NOT author these)

The old skill emitted `<head>` meta, JSON-LD, an email gate, nav, footer, and analytics into each HTML file. **None of that is the skill's job anymore.** For reference, here is who owns each piece now:

- **Page metadata + OG/Twitter tags** — `app/ideas/[slug]/page.tsx` `generateMetadata`, built from manifest (`description`) + the `image/og/idea/{slug}.png` path. No longer needed in the skill — handled by the route.
- **JSON-LD @graph** (Person / Article / SoftwareApplication / HowTo / BreadcrumbList) — emitted by the route. The `HowTo` steps come from your `**How it works:**` numbered list; `SoftwareApplication.applicationCategory` comes from the manifest. No longer needed in the skill — handled by the route.
- **Nav + sticky subnav + footer** — the shared App Router layout. No longer needed — handled by the layout (the old `scripts/sync-idea-nav.js` step is gone).
- **Analytics (GA / Meta Pixel)** — global in the layout. No longer needed — handled by the layout (the old `scripts/inject-analytics.js` step is gone).
- **Email gate** — handled by the app, not per-page MDX. No longer author email-gate markup.
- **Grid card + ItemList JSON-LD** on `/startup-ideas` — generated dynamically from Convex after `npm run seed:convex`. No longer needed — automatic (the old "edit `startup-ideas.html`" steps are gone).
- **Sitemap entry** — `app/sitemap.ts` auto-discovers `content/ideas/*.mdx`. No longer needed — automatic (the old "edit `sitemap.xml`" step is gone).

The only thing that affects SEO/AEO quality from the skill's side is **MDX body quality**: complete sections, real citations in `## Sources`, and a clean `**How it works:**` numbered list.

---

## Error Handling

- If `ideas/drafts/{folder-name}/` doesn't exist (Mode B): report the error with instructions.
- If `raw.md` is missing (Mode B): report the error, it's required.
- If MCP research is thin (Mode A): apply the A.2.1 STOP rule — do not paper over it.
- If `npm run seed:convex` fails: surface the `npx convex dev` prerequisite and do not claim grid visibility (see Step 8).
- If `npm run og:generate` fails: that's fine — `og.status: "failed"`, the publish still succeeds (non-blocking invariant).

---

## Checklist

Before marking complete:

### Research Checklist — Mode A (MCP, default)
- [ ] Resolved `idea_id` (user-supplied or chosen via `browse_ideas` shortlist)
- [ ] Called `get_idea_research(idea_id)` for base record
- [ ] Called `get_idea_research(idea_id, "competitive_analysis")` — 3+ named competitors with pricing
- [ ] Called `get_idea_research(idea_id, "go_to_market")` — pricing tiers / positioning
- [ ] Called `get_idea_research(idea_id, "keyword_list")` — meta description keywords
- [ ] Called `get_idea_research(idea_id, "community_analysis")` — Reddit/YT/FB demand signals
- [ ] Called `research_market_insight(idea_id)` — 2+ cited market statistics
- [ ] Called `research_trend(idea_id)` — "Why Now" timing angle
- [ ] Passed the A.2.1 STOP rule (no thin sections)
- [ ] Captured citations from `competitive_analysis.data.citations` + `research_market_insight`
- [ ] Never used WebSearch fallback (if tempted, re-check STOP rule)

### Research Checklist — Mode B (folder, fallback only)
- [ ] Read raw.md and extracted title + research keywords
- [ ] **Performed WebSearch for market data** (3+ statistics found)
- [ ] **Performed WebSearch for competitors** (3+ competitors with current pricing)
- [ ] **Performed WebSearch for industry trends**
- [ ] **Performed WebSearch for tech stack** (if applicable)

### Content Checklist (REQUIRED - NO COPYING)
- [ ] Completed Step 4.5 voice check (read 2 reference MDX files)
- [ ] The Problem: written fresh with research stats (NOT from raw.md)
- [ ] The Solution: original, with `**How it works:**` numbered list (NOT from raw.md)
- [ ] Market Research: verified statistics with sources
- [ ] Competitive Landscape: 3+ competitors, current pricing, `**Your Opportunity**` callout
- [ ] Business Model: pricing tiers + unit economics
- [ ] Recommended Tech Stack: named framework/database/hosting
- [ ] AI Prompts to Build This: 3+ fenced code blocks
- [ ] Sources: markdown links to everything cited

### Publishing Checklist
- [ ] Wrote `content/ideas/{slug}.mdx` — frontmatter exactly `slug` + `title`, slug matches `^[a-z0-9-]+$`
- [ ] Added `ideas/manifest.json` entry with full provenance (researchCalls, citations, wordCount, auditPassed, auditRunAt), `description`, `scores` (Mode A only), `source`, `applicationCategory`
- [ ] Manifest entry includes `og.subject` + `og.accent` + `og.status: "pending"`
- [ ] Passed the Step 7 manual section gate (8 `##` sections, How-it-works list, ≥ ~800 words, no placeholders)
- [ ] Ran `npm run seed:convex` and confirmed it succeeded (idea now in grid/hubs); if it failed, surfaced the `npx convex dev` fix and did NOT claim grid visibility
- [ ] Ran `npm run og:generate -- --slug {slug} --surface idea --non-blocking`
- [ ] Confirmed `og.status` is `"ready"` or `"failed"` (publish proceeds either way)
- [ ] Verified `/ideas/{slug}` renders all 8 sections in `npm run dev`
- [ ] Listed research sources in the output report
