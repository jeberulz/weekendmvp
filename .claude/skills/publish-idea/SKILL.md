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

If `engine:eval` plus one live compile cannot clear the auditor on this machine, stop the phase-7 flip, leave MCP config in place, and report — do not start phase 9.

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

**From a title only:** invent a tight audience, revenue model, and 3–5 seed keywords from the title. Confirm the slug is free in `ideas/manifest.json` and `content/ideas/`.

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

The pipeline **fails closed** on thin research (missing competitors, thin market stats, invented keyword volumes). That replaces the old chat-only STOP rule.

### Step 3 — Compile

```bash
npm run engine:compile -- --record engine/records/{slug}.json
# overwrite existing MDX/manifest row only with explicit --force
```

Writes:
- `content/ideas/{slug}.mdx` — frontmatter `slug` + `title`, **eight** `##` headings (seven canonical + `## Sources`)
- `ideas/manifest.json` row with `source: "engine:{slug}"`, provenance, scores when present; tagging fields stubbed for the operator

Compiler does **not** seed Convex, generate OG, or push git.

### Step 3.1 — Quality bar (auditor failures, not chat rules)

`npm run audit:idea` must pass. The bar includes (see `ideas/SECTIONS.md` + `scripts/audit-idea-mdx.mjs`):

- All **8** headings in order: The Problem → The Solution → Market Research → Competitive Landscape → Business Model → Recommended Tech Stack → AI Prompts to Build This → **Sources**
- `**How it works:**` numbered list (≥2 steps) under The Solution
- **≥2** markdown citation links in Sources (cited market stats live here)
- Competitive Landscape names **≥3 competitors with pricing** (pipeline + deep-draft gates enforce this; treat missing competitors as a failed publish)
- Body ≥ ~800 words (deep `engine-draft-*` slugs: ≥2200 unique words, no stock filler)
- No placeholders, no bare `<` / `{` in prose (MDX JSX traps → 500)

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

Optional voice polish: read `content/ideas/sms-time-tracker.mdx` and `content/ideas/ai-nutrition-planner-trainers.mdx`, then edit the compiled MDX to match depth — **re-run `audit:idea` after any prose edit**.

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
- [ ] `npm run audit:idea -- --slug {slug}` PASS (8 headings, How-it-works, ≥2 Sources links, ≥3 competitors with pricing in landscape, word floor, no JSX traps)
- [ ] `npm run validate:idea-tags -- --slug {slug}` PASS
- [ ] `provenance.auditPassed` set true only after both gates
- [ ] `npm run seed:convex` (+ `--prod` when publishing live)
- [ ] `npm run og:generate -- --slug {slug} --surface idea --non-blocking`
- [ ] Commit/push **only if operator asked**
- [ ] Preview at `http://localhost:3000/ideas/{slug}` (all 8 sections)
- [ ] No Ideabrowser MCP calls were made
