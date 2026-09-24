---
name: publish-idea
description: "Publish a startup idea page on the Next.js + MDX + Convex site. DEFAULT: /publish-idea {title} — write a brief, run npm run engine:research --live, then npm run engine:compile. OPT-IN: /publish-idea --from-draft {folder-name} when the seed lives in ideas/drafts/. After compile: npm run audit:idea, npm run validate:idea-tags, seed Convex, generate OG; commit/push only when the operator asks. Ideabrowser MCP is not part of this skill."
---

# Publish Idea Skill

Transform a brief (or draft folder) into a research-backed `/ideas/{slug}` page via the **local idea engine** — not Ideabrowser MCP.

## How a page actually renders (read this first)

The site is **Next.js + MDX + Convex**. An idea page is two files plus automated steps — the skill never writes HTML, `<head>`, schema, nav, or analytics:

| Layer | Owned by | This skill writes? |
|---|---|---|
| **Body** (the prose) | `content/ideas/{slug}.mdx` — frontmatter (`slug` + `title` only) + canonical `##` sections | ✅ via `engine:compile` (polish allowed after) |
| **Metadata** (description, category, scores, og, provenance) | `ideas/manifest.json` `ideas[]` — the source of truth | ✅ via compile + tagging fill |
| **Grid card + ItemList JSON-LD** on `/startup-ideas`, hub pages | Convex after `seed:convex` | ❌ automatic |
| **Page metadata, OG tags, full JSON-LD @graph** | `app/ideas/[slug]/page.tsx` | ❌ route does it |
| **Nav, footer, analytics** | shared App Router layout | ❌ global |
| **Sitemap entry** | `app/sitemap.ts` auto-discovers `content/ideas/*.mdx` | ❌ automatic |
| **OG card PNG** | `image/og/idea/{slug}.png` via `npm run og:generate` | ✅ automated step |

Practical consequences:
- The `HowTo` schema is parsed from the MDX body: `## The Solution` **must** contain `**How it works:**` followed by a numbered list (`1.` / `2.` / `3.`).
- Meta description comes from the manifest `description` field.
- Slugs must match `^[a-z0-9-]+$` (validated in `lib/mdx.tsx`). Files starting with `_` are excluded from the site.
- **An idea is NOT live until seeded into the PRODUCTION Convex deployment** (`npm run seed:convex -- --prod`) **and** the MDX/OG are pushed so Vercel builds them. Dev seed alone is not enough for the live grid.

---

## Usage

```
/publish-idea {title}
/publish-idea --from-draft {folder-name}
```

Examples:
- `/publish-idea AI invoice chaser for freelancers` — default engine path
- `/publish-idea --from-draft nutrition-planner` — same engine path; brief built from `ideas/drafts/nutrition-planner/raw.md`

**Do not** pass Ideabrowser numeric `idea_id`s. There is no MCP Mode A in this skill.

| Situation | Path |
|---|---|
| User gives a title / one-liner | **Default** — write brief → `engine:research` → `engine:compile` |
| User passes `--from-draft {folder}` | **Draft** — read `ideas/drafts/{folder}/raw.md` → same engine pipeline |
| User points at `ideas/drafts/` without the flag | Ask whether to run `--from-draft {folder}` |
| Engine research/compile fails the auditor | **STOP** — surface the failure. Do not invent thin WebSearch filler to paper over it. Do not call Ideabrowser MCP. |

`npm run engine:eval` only re-audits the three hand-written gold pages (auditor regressions). Engine output is covered by `npm run test:engine`, which compiles a fixture record and runs the full engine audit on it. If a live compile cannot clear the auditor on this machine, stop and report — do not start phase 9.

---

## What This Skill Does

1. **Builds a brief** JSON (`title`, `audience`, `revenueModel`, `seedKeywords[]`, optional `slug` / `oneLiner`).
2. **Runs** `npm run engine:research -- --brief {path} --live --out engine/records/{slug}.json`.
3. **Runs** `npm run engine:compile -- --record engine/records/{slug}.json` → MDX + manifest stub (`source: "engine:{slug}"`).
4. **Fills tagging** on the manifest row (category, tools≥2, audiences≥2, revenueGoal, buildTime, og).
5. **Gates:** `npm run audit:idea -- --slug {slug}` then `npm run validate:idea-tags -- --slug {slug}`.
6. **Seeds Convex** (dev + `--prod` when publishing live).
7. **Generates the OG card** (`npm run og:generate -- --slug {slug} --surface idea --non-blocking`).
8. **Commits / pushes only when the operator explicitly asks** — never auto-push to `main`.
9. **Reports** slug, record path, audit metrics, seed/OG status, preview URL.

---

## ═══════════════════════════════════════════
## DEFAULT: Engine pipeline (title or draft)
## ═══════════════════════════════════════════

### Step 1 — Build the brief

Write `engine/briefs/{slug-or-temp}.json` (or a temp path). Shape:

```json
{
  "title": "AI Invoice Chaser for Freelancers",
  "audience": "Solo freelancers and agencies chasing late invoices",
  "revenueModel": "SaaS subscription with usage-based reminder credits",
  "seedKeywords": ["invoice chaser", "late payment reminder software", "freelance invoicing automation"],
  "slug": "ai-invoice-chaser-freelancers",
  "oneLiner": "Auto-nags late clients so freelancers get paid without the awkward emails."
}
```

**Idea gate (before spending on research).** Ideabrowser used to pre-validate ideas; now you do. Refuse the title and say why unless all three hold:
1. A **named buyer who pays today** for a worse workaround (a tool, a contractor, or hours they can price).
2. **Evidence the pain is public**: at least one Reddit / HN / forum thread you can link, or a seed keyword you expect to carry search volume.
3. A **wedge the incumbents skip** (too small, too niche, too price-sensitive), stated in one sentence.

Also refuse if an existing idea already covers the same buyer + job (search `ideas/manifest.json` titles and descriptions, not just slugs).

**From a title only:** write a tight audience, revenue model, and 3–5 seed keywords from the title. Confirm the slug is free in `ideas/manifest.json` and `content/ideas/`.

**From `--from-draft {folder}`:**
- Require `ideas/drafts/{folder}/raw.md`.
- Use the draft **title verbatim**.
- Pull audience / keywords / competitors mentioned in raw.md into the brief — do **not** copy draft prose into the MDX.
- Optional `competitors.md` / `notes.md` inform seed keywords only.

### Step 2 — Research (live)

```bash
npm run engine:research -- --brief engine/briefs/{name}.json --live --out engine/records/{slug}.json
```

Requires `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` (shell, then `.env.local`, then `.env`). Cost cap is **$4.00** per run.

Fixture-only (no keys, canned data — **not** for publishing new ideas):

```bash
npm run engine:research -- --fixture rfp-assistant --out /tmp/record.json
```

The pipeline **fails closed** on thin research. That replaces the old chat-only STOP rule:

- Fewer than 2 niche market stats or 3 priced competitors → fail.
- Any stat or competitor price whose numbers do not appear in the search results is **dropped** as model-invented (and can push the run under those minimums).
- Keyword volume / CPC come only from DataForSEO.
- **Quote verification:** right after the community search (before any DataForSEO or synthesis spend) the pipeline reads every cited page: Reddit threads, HN items (Algolia API), or plain pages. Fewer than 2 readable pages → `[community_signals] only N/M cited community pages could be read …` and the run stops cheaply. The page text goes to synthesis, which must copy quotes from it; afterwards each quote is checked against its page, and fewer than 2 found → `[provenance_parse] quote verification: …`. Never hand-mark quotes as verified.
- **Reddit needs app credentials on most networks.** Reddit answers the public `.json` endpoint with HTTP 403 from cloud machines (seen on the Cursor agent). Create a free "script" app at reddit.com/prefs/apps and set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`; the engine then uses Reddit's OAuth API. `ENGINE_QUOTE_FETCH_UA` alone does not get past the block.
- **DataForSEO balance:** a negative balance fails `keywords_demand` with `40200 Payment Required`. Top up before a batch.

### Step 3 — Compile

```bash
npm run engine:compile -- --record engine/records/{slug}.json
# overwrite existing MDX/manifest row only with explicit --force
```

Writes:
- `content/ideas/{slug}.mdx` — frontmatter `slug` + `title`, **eight** `##` headings (seven canonical + `## Sources`)
- `ideas/manifest.json` row with `source: "engine:{slug}"`, provenance, scores when present; tagging fields stubbed for the operator

Compiler does **not** seed Convex, generate OG, or push git.

Spot-check drafts use the `engine-draft-{slug}` slug. They compile to `engine/drafts/` (MDX + `engine/drafts/manifest.json`), are refused in `content/ideas/`, and are blocked from the page route, sitemap, and Convex seed. Never publish an `engine-draft-*` slug.

### Step 3.1 — Quality bar (auditor failures, not chat rules)

`npm run audit:idea -- --slug {slug}` must pass. It finds the record at `engine/records/{slug}.json` automatically (or pass `--record path`). Every page whose manifest `source` starts with `engine:` gets the **deep bar**, not just drafts. The bar includes (see `ideas/SECTIONS.md` + `scripts/audit-idea-mdx.mjs`):

- All **8** headings in order: The Problem → The Solution → Market Research → Competitive Landscape → Business Model → Recommended Tech Stack → AI Prompts to Build This → **Sources**
- `**How it works:**` numbered list (≥2 steps) under The Solution
- **≥2** markdown citation links in Sources (cited market stats live here)
- Competitive Landscape names **≥3 competitors with pricing** (pipeline + deep-draft gates enforce this; treat missing competitors as a failed publish)
- Body **≥2,200 words**, no stock filler, no ≥8-word sentence repeated on the page or shared with another engine page
- No broken markdown links; no placeholders; no bare `<` / `{` in prose (MDX JSX traps → 500)
- Named How-it-works steps (never `Step 1`), niche market sizing only, first-party competitor pricing links
- **Business Model**: number-first Unit Economics bullets, and **Year-One Math** (funnel → paying accounts → compiler-computed ARR + half-close-rate downside) landing on a real tier
- **AI Prompts**: four prompts (Setup ≥60 words with ≥3 idea-specific tables, Core Feature ≥70, Landing ≥40, Branding ≥70); Setup tiers match Business Model tiers
- **≥2 community quotes verified on their cited pages**, every on-page quote present in the record, and the full audience label used at most twice

If audit fails: **STOP**. Fix the record (re-research) or refuse the idea. Do not fall back to Ideabrowser MCP.

### Step 4 — Tagging fill (required before seed)

Compile leaves `category: "uncategorized"` and empty `tools` / `audiences`. Edit the manifest row:

| Field | Rule |
|---|---|
| `category` | Exactly one of: `saas`, `productivity`, `health`, `marketplace`, `ai-tools`, `automation`, `education`, `b2b`, `developer-tools`, `ecommerce`, `creator-tools`, `fintech` |
| `buildTime` | Canonical hour string only: `"8"`, `"10"`, `"12"`, `"20"`, `"24"`, `"30"`, `"40"` |
| `revenueGoal` | Exactly one of: `1k-month`, `5k-month`, `10k-month`, `passive-income`, `quick-wins` |
| `tools[]` | ≥2 from: `cursor`, `claude`, `bolt`, `v0`, `lovable`, `replit`, `windsurf`, `no-code` (tag `claude`, not `claude-code`) |
| `audiences[]` | ≥2 from: `developers`, `designers`, `non-technical`, `solo-founders`, `weekend-builders`, `side-hustlers`, `marketers`, `freelancers`, `creators`, `small-business-owners` |
| `description` | ~155-char SEO blurb if the one-liner is weak |
| `og.subject` / `og.accent` | Concrete still-life director's note; accent one of `lime`, `mint`, `lavender`, `emerald`, `aubergine` |
| `applicationCategory` | Schema.org SoftwareApplication category |

Then:

```bash
npm run audit:idea -- --slug {slug}
npm run validate:idea-tags -- --slug {slug}
# expect: 1/1 ideas pass tagging contract (0 fail)
```

Set `provenance.auditPassed: true` and `provenance.auditRunAt` only after both pass.

Optional voice polish: read `content/ideas/course-translation-resale-network.mdx` (the benchmark in `engine/eval/deep-benchmark.md`), then edit the compiled MDX to match its depth — **re-run `audit:idea` after any prose edit**. Never edit a quote's wording; the auditor fails a quote that no longer matches its verified record entry.

### Step 4.1 — Human spot check (before any `--prod` seed)

Open two of the cited community threads in a browser and confirm the quoted words are there. Open two competitor pricing links and confirm the prices. The pipeline checks these automatically; this catches a thread that was deleted or edited since the run. If anything is off, re-run research — do not patch the MDX by hand.

### Step 5 — Seed Convex (dev + prod for live grid)

```bash
npm run seed:convex              # dev
npm run seed:convex -- --prod    # production — REQUIRED for live /startup-ideas + hubs
```

Skipping `--prod` is the #1 "I can't see my idea" cause.

### Step 6 — OG card (best-effort, never blocks publish)

```bash
npm run og:generate -- --slug {slug} --surface idea --non-blocking
```

Success → `og.status: "ready"`. Both providers fail → `"failed"`, exit 0, publish continues.

### Step 7 — Deploy only when asked

Commit + push MDX + OG PNG **only if the operator explicitly asks**. Do not push to `main` on your own.

```bash
git add content/ideas/{slug}.mdx ideas/manifest.json public/image/og/idea/{slug}.png
git commit -m "content(idea): {title}"
git push   # only when asked; triggers Vercel
```

Confirm live: `curl -s -o /dev/null -w "%{http_code}\n" https://www.weekendmvp.app/ideas/{slug}` → **200**.

### Step 8 — Output report

```
## Published: {IDEA_TITLE}

**Source:** idea engine (`engine:{slug}`) — record at engine/records/{slug}.json

**Files:**
- content/ideas/{slug}.mdx (8 headings including Sources)
- ideas/manifest.json (tagged, provenance, og)
- engine/records/{slug}.json
- image/og/idea/{slug}.png (if og.status=ready)

**Audit:** words={N} competitors={N} sources={N} howTo={N} — audit:idea PASS; validate:idea-tags PASS
**Seed:** {dev: OK/failed; prod: OK/failed}
**OG:** {ready|failed}
**Deploy:** {LIVE | STAGED — not pushed}

**Preview:** npm run dev → http://localhost:3000/ideas/{slug}
```

---

## MDX shape (compiler output — do not break)

```mdx
---
slug: "{slug}"
title: "{Idea Title}"
---

## The Problem
...

## The Solution
...

**How it works:**

1. **{Step}** — ...
2. **{Step}** — ...
3. **{Step}** — ...

## Market Research
...

## Competitive Landscape
...

**Your Opportunity**
...

## Business Model
...

## Recommended Tech Stack
...

## AI Prompts to Build This
...

## Sources

- [{title}]({url})
- [{title}]({url})
```

Authoring rules:
- GFM only. No raw HTML / email-gate / nav.
- Escape bare `<` and `{` in prose (`under $0.01`, not `<$0.01`) or the page 500s.
- Frontmatter is **exactly** `slug` + `title`.

Quick checks:

```bash
grep -c '^## ' content/ideas/{slug}.mdx        # expect 8
grep -n 'How it works' content/ideas/{slug}.mdx
wc -w content/ideas/{slug}.mdx
awk '/^```/{c=!c} !c && /[<{]/{print NR": "$0}' content/ideas/{slug}.mdx
```

---

## What the route already provides (do NOT author)

Page metadata, JSON-LD @graph, nav/footer, analytics, email gate, grid ItemList, sitemap — all owned by App Router routes/layouts after seed. Skill quality = MDX body + manifest tagging.

---

## Error Handling

- Missing `ideas/drafts/{folder}/raw.md` → report and stop.
- `engine:research` throws (thin research / cost cap / missing keys) → surface the error; do not call Ideabrowser MCP; do not invent stats.
- `engine:compile` refuses overwrite → pass `--force` only with operator OK, or pick a new slug.
- `audit:idea` fails → fix or abandon; never set `auditPassed: true`.
- `validate:idea-tags` fails → fix allowlists before seed.
- `seed:convex` fails → do not claim grid visibility.
- `og:generate` fails → fine (`og.status: "failed"`); publish continues.
- No commit authorization → report **staged + seeded**, not live.

---

## Checklist

### Engine path
- [ ] Brief written (from title or `--from-draft` raw.md)
- [ ] `npm run engine:research -- --brief … --live --out engine/records/{slug}.json`
- [ ] `npm run engine:compile -- --record engine/records/{slug}.json`
- [ ] Manifest tagging filled (category, ≥2 tools, ≥2 audiences, revenueGoal, buildTime, og)
- [ ] Idea gate passed (paying buyer, public pain, wedge) and no existing idea covers it
- [ ] `npm run audit:idea -- --slug {slug}` PASS on the deep bar (≥2,200 words, verified quotes, Year-One Math, idea-specific schema, no broken links)
- [ ] `npm run validate:idea-tags -- --slug {slug}` PASS
- [ ] `provenance.auditPassed` set true only after both gates
- [ ] Human spot check: 2 cited threads + 2 competitor prices confirmed in a browser
- [ ] `npm run seed:convex` (+ `--prod` when publishing live)
- [ ] `npm run og:generate -- --slug {slug} --surface idea --non-blocking`
- [ ] Commit/push **only if operator asked**
- [ ] Preview at `http://localhost:3000/ideas/{slug}` (all 8 sections)
- [ ] No Ideabrowser MCP calls were made
