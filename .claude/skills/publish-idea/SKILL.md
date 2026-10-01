---
name: publish-idea
description: "Publish a startup idea page on the Next.js + MDX + Convex site. DEFAULT: /publish-idea {title} — write a brief, run npm run engine:research --live (evidence is accepted against the cited pages before anything is written), then npm run engine:compile. OPT-IN: /publish-idea --from-draft {folder-name} when the seed lives in ideas/drafts/. After compile: npm run audit:idea, npm run validate:idea-tags, a human source check, seed Convex, generate OG; commit/push only when the operator asks. Ideabrowser MCP is not part of this skill."
---

# Publish Idea Skill

Transform a brief (or draft folder) into a research-backed `/ideas/{slug}` page via the **local idea engine** — not Ideabrowser MCP.

## How a page actually renders (read this first)

The site is **Next.js + MDX + Convex**. An idea page is two files plus automated steps — the skill never writes HTML, `<head>`, schema, nav, or analytics:

| Layer | Owned by | This skill writes? |
|---|---|---|
| **Body** (the prose) | `content/ideas/{slug}.mdx` — frontmatter (`slug` + `title` only) + canonical `##` sections | ✅ via `engine:compile` (prose polish allowed after; factual blocks are audited, see Step 4) |
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
| Research stops, compile refuses, or the page fails the auditor | **STOP** — surface the failure and the run report. Do not invent thin WebSearch filler to paper over it. Do not call Ideabrowser MCP. |

Two checks that need no keys and spend nothing:
- `npm run engine:replay` runs the synthetic fixture through the real research → compile → deep-audit CLIs in a temp dir and prints each step's exit code and the verdict. Run it after pulling engine changes or before a batch; if it fails, the engine itself is broken — stop. `npm test` runs the same flow plus adversarial checks (`lib/engine/replay.test.ts`). A pass says the code paths agree on the fixture, not that live sources or live models will behave.
- `npm run engine:eval` only re-audits the three hand-written gold pages (a legacy auditor regression). It does not measure engine output.

If a live compile cannot clear the auditor on this machine, stop and report — do not start phase 9.

---

## What This Skill Does

1. **Builds a brief** JSON (`title`, `audience`, `revenueModel`, `seedKeywords[]`, optional `slug` / `oneLiner`).
2. **Runs** `npm run engine:research -- --brief {path} --live --out engine/records/{slug}.json` — a contract v2 research record plus a run report, or a failure report.
3. **Runs** `npm run engine:compile -- --record engine/records/{slug}.json` → MDX + manifest stub (`source: "engine:{slug}"`).
4. **Fills tagging** on the manifest row (category, tools≥2, audiences≥2, revenueGoal, buildTime, og).
5. **Gates:** `npm run audit:idea -- --slug {slug}` then `npm run validate:idea-tags -- --slug {slug}`.
6. **Checks the sources by hand** (Step 4.1) — every competitor price and market statistic, plus at least two quotes.
7. **Seeds Convex** (dev now; `--prod` only after the operator-authorized deploy returns 200).
8. **Generates the OG card** (`npm run og:generate -- --slug {slug} --surface idea --non-blocking`).
9. **Commits / pushes only when the operator explicitly asks** — never auto-push to `main`.
10. **Reports** slug, record and report paths, cost and attempts, audit metrics, source-check result, seed/OG status, preview URL.

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
2. **Evidence the pain is public**: at least one Hacker News / forum / Reddit thread you can link, or a seed keyword you expect to carry search volume.
3. A **wedge the incumbents skip** (too small, too niche, too price-sensitive), stated in one sentence.

Also refuse if an existing idea already covers the same buyer + job (search `ideas/manifest.json` titles and descriptions, not just slugs).

**From a title only:** write a tight audience, revenue model, and 3–5 seed keywords from the title. Confirm the slug is free in `ideas/manifest.json` and `content/ideas/`.

**From `--from-draft {folder}`:**
- Require `ideas/drafts/{folder}/raw.md`.
- Use the draft **title verbatim**.
- Take the audience, revenue model and seed keywords from raw.md. The brief has no competitor or statistic fields: competitors, prices, statistics and quotes come only from pages the research run cites and accepts, never from the draft.
- Do **not** copy draft prose into the MDX. Optional `competitors.md` / `notes.md` inform seed keywords only.

### Step 2 — Research (live)

```bash
npm run engine:research -- --brief engine/briefs/{name}.json --live --out engine/records/{slug}.json
# --report path   run report location (default: {out}.report.json)
# --force         replace an existing record (refused without it)
```

Requires `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` (shell, then `.env.local`, then `.env`; shell values win). There is no implicit mode: `--live` or `--fixture` must be given.

**What a run does, in order.** Evidence is extracted and accepted deterministically **before** anything is written:

1. Brief normalization, then three searches (market statistics, competitors, community pain). Only the searches' citations are kept; their answer prose is dropped and never reaches a later step. When fewer than two community pages can be read, one non-Reddit supplement search runs.
2. Every cited page is read once, with bounded downloads (2 MiB, 15 s per read including redirects, 4 reads at a time) and private-address protection.
3. A schema-only extraction call proposes candidate quotes, market statistics and competitor prices copied from those pages. Its output is untrusted.
4. **Acceptance (deterministic code, no model):** a quote must be a contiguous span of its cited page (an internal ellipsis is rejected); a statistic's amount, unit, period, year and subject must re-derive from the sentence that states it (a projection is never accepted as measured, a bare year is never an amount); a price's amount, currency, period, per-user/flat basis and billing qualifiers must equal the page's price expression, and the vendor must own the page or be named before the price in that price's own clause, with no other known vendor in the clause. A known vendor's own site is never evidence for a rival's price. Anything ambiguous is rejected. Rejections are kept with their reasons in the record and the report (operator-only, never on the page).
5. **Minimums on accepted evidence:** at least 2 market statistics, 3 competitors with at least one accepted price each, and 2 community quotes with different text. If they are not met the run **stops at `evidence_acceptance`**: the report is written, there is no record, and no keyword or writer call is made (no further spend). The error names the shortfall and the top rejection reasons. If no cited page can be read at all, the run stops at `source_acquisition`, before the extraction call.
6. Keyword volume, competition and CPC come only from DataForSEO (a keyword failure fails the run; nothing is estimated).
7. The writer gets the brief, the accepted evidence and the keyword rows — nothing else. Factual fields can carry figures only through `[[ev:<id>]]` references to accepted evidence. A reply that fails validation is regenerated once with the issue list, then the run fails.
8. The record is validated as contract v2 before it is written.

**Cost and attempts.** The cap is **$4.00** per run. Every billable attempt reserves its step's worst case against the cap first, retries are bounded per step (extraction and writing get two attempts each, regeneration included), and billed failures are recorded. The CLI prints the cost, attempts per step, accepted counts and rejection reasons, and writes the run report on success **and** failure (no secrets, page bodies or local paths in it).

**Fixture mode** (no keys, no network, synthetic pages and fictional vendors — **never** for publishing):

```bash
npm run engine:research -- --fixture rfp-assistant --out /tmp/record.json
```

Only the fixture's own idea (slug `ai-rfp-response-assistant`) can run in fixture mode; records and reports say `"mode": "fixture"`. `npm run engine:replay` runs this plus compile and audit for you.

Source-reading notes:
- **Reddit needs app credentials on most networks.** Reddit answers the public `.json` endpoint with HTTP 403 from cloud machines. Create a free "script" app at reddit.com/prefs/apps and set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`; the engine then uses Reddit's OAuth API. `ENGINE_QUOTE_FETCH_UA` alone does not get past the block. Hacker News item URLs and public forum threads usually read without credentials.
- **DataForSEO balance:** a negative balance fails `keywords_demand` with `40200 Payment Required`. Top up before a batch.

### Step 3 — Compile

```bash
npm run engine:compile -- --record engine/records/{slug}.json
# overwrite existing MDX/manifest row only with explicit --force
```

The compiler validates the record first and refuses:
- a **contract v1 (legacy) record** — every record committed before WP46 is one. Its evidence was not accepted before its narrative was written, so it cannot be compiled or pass the audit, and nothing upgrades it: re-run `engine:research … --live` for that brief;
- an invalid record, listing its issues;
- a record missing the editorial fields the deep audit needs (the three narratives, what not to build yet, stack notes, brand brief, ≥2 pricing tiers, ≥2 unit-economics rows, a Year-One plan, ≥3 idea-specific tables). The compiler no longer pads with generic text.

Writes:
- `content/ideas/{slug}.mdx` — frontmatter `slug` + `title`, **eight** `##` headings (seven canonical + `## Sources`)
- `ideas/manifest.json` row with `source: "engine:{slug}"`, provenance, scores when present; tagging fields stubbed for the operator

Every factual block is rendered from accepted evidence: quote blockquotes with a `— [title](url)` attribution line, market signal rows, competitor rows ("Published pricing:", with "(via host)" on a price taken from someone else's page), linked figures in prose, and Year-One Math computed with exact cents (downside = half the paying accounts, rounded down). Pricing tiers, unit economics and the funnel are labelled as assumptions, not measured facts.

Compiler does **not** seed Convex, generate OG, or push git.

**Spot-check drafts** use the `engine-draft-{slug}` slug. They compile to `engine/drafts/` (MDX + `engine/drafts/manifest.json`) and are refused in `content/ideas/` and `ideas/manifest.json`. They are hidden from every discovery surface: the page route answers 404, the sitemap and Convex seed skip them, and the Convex discovery queries (archive, hubs, related ideas, latest, dashboard catalogue, search and counts) exclude them at read time while members' saves and plans that reference one stay owner-scoped and show "Research retired". When this code ships, **deploy the Convex backend before the frontend** (roll back in reverse). Never publish an `engine-draft-*` slug.

### Step 3.1 — Quality bar (auditor failures, not chat rules)

`npm run audit:idea -- --slug {slug}` must pass. It finds the record at `engine/records/{slug}.json` automatically (or pass `--record path`; `--file path` audits an MDX file anywhere). Every page whose manifest `source` starts with `engine:` gets the **deep bar**, not just drafts. The bar (see `ideas/SECTIONS.md` + `scripts/audit-idea-mdx.mjs`):

- All **8** headings in order: The Problem → The Solution → Market Research → Competitive Landscape → Business Model → Recommended Tech Stack → AI Prompts to Build This → **Sources**
- `**How it works:**` numbered list (≥2 named steps, never `Step 1`) under The Solution
- **≥2** markdown citation links in Sources
- Body **≥2,200 words**, no stock filler, no ≥8-word sentence repeated on the page or shared with another engine page, no near-duplicate paragraphs
- No broken markdown links; no placeholders; no bare `<` / `{` in prose (MDX JSX traps → 500); niche market sizing only
- **AI Prompts**: four prompts (Setup ≥60 words with ≥3 idea-specific tables, Core Feature ≥70, Landing ≥40, Branding ≥70); Setup tiers match Business Model tiers; number-first Unit Economics bullets
- The full audience label at most twice
- **Final artifact audit against the record** (a legacy v1 record fails with the re-research message):
  - every blockquote equals a selected accepted quote exactly (case, digits, order and punctuation; only typographic quote marks, apostrophes, dashes and whitespace are folded), with its `— [title](url)` line linking to that quote's own source; every selected quote appears; ≥2 distinct quotes (a repeated quote counts once);
  - market signal and competitor rows show their evidence's own rendering and source, with "(via host)" on secondary prices; a first-party pricing URL backs one competitor only;
  - a figure typed into The Problem, Market Research or Competitive Landscape prose that is not a rendering of the record's evidence fails as an "unbound figure" (a guard against typed-in numbers, not proof that prose is true);
  - Year-One Math is recomputed from the record (accounts, per-account price, ARR, tier, seats, downside, funnel), with exactly one base and one downside line and no other ARR/MRR total.

If audit fails: **STOP**. Re-research, or refuse the idea. Do not patch factual blocks by hand, and do not fall back to Ideabrowser MCP.

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

**Homepage `highlights` block (required for new ideas).** The homepage features one idea a week in "Inside every idea" and reads this block before falling back to parsing the MDX (WP42 ruling, 2026-09-24). Write it from the compiled MDX: every figure must already be in the body and its `## Sources`, the quote comes from `## The Problem`, and competitors and prices come from `## Competitive Landscape`. Never invent a number.

```json
"highlights": {
  "problemQuote": "Freelancers rarely lose money because they forgot to send an invoice. They lose money because the work quietly changed three Slack threads ago.",
  "stats": [
    { "value": "20M", "label": "skilled knowledge freelancers in the US", "source": "Upwork 2025" },
    { "value": "50%+", "label": "of projects face scope creep", "source": "Harvest" },
    { "value": "$5,968", "label": "average unpaid income per freelancer", "source": "Freelancers Union" }
  ],
  "competitors": [
    { "name": "Bonsai", "price": "$15–$59/mo" },
    { "name": "Harvest", "price": "from $0" },
    { "name": "Dubsado", "price": "$335/yr" }
  ]
}
```

Field rules (checked by `npm run validate:idea-tags`):
- `problemQuote`: one or two sentences from `## The Problem`, ≤ 190 characters. It renders inside quote marks, so write it as a quote.
- `stats`: 1–3 entries. `value` ≤ 12 characters (`20M`, `$15.8B`, `27%`); `label` ≤ 90 characters and reads after the value; `source` (optional) ≤ 48 characters, the publisher's short name.
- `competitors`: optional, 3–5 entries. `name` ≤ 32 characters; `price` ≤ 16 characters (`$15–$59/mo`, `from $0`, `$335/yr`).

The validator treats `highlights` as optional for older ideas, so also confirm by eye that a new entry has one.

Then:

```bash
npm run audit:idea -- --slug {slug}
npm run validate:idea-tags -- --slug {slug}
# expect: 1/1 ideas pass tagging contract (0 fail)
```

Set `provenance.auditPassed: true` and `provenance.auditRunAt` only after both pass **and** the source check in Step 4.1 is done.

**What you may polish after compile.** Ordinary prose and labels: narratives, competitor notes, row labels, link titles, step wording — as long as you add no figure to The Problem, Market Research or Competitive Landscape prose. What you may **not** edit by hand: a quote's words or its attribution link, the figures and links in market signal and competitor rows, figures linked from evidence, and the Year-One Math lines. The auditor compares those with the record, so a hand edit fails the audit; a wrong fact means re-research, not a patch. **Re-run `audit:idea` after every edit.** For voice, `content/ideas/course-translation-resale-network.mdx` is the depth benchmark (`engine/eval/deep-benchmark.md`).

### Step 4.1 — Human source check (before any commit or `--prod` seed)

Open, in a browser, the cited source of **every** competitor price and **every** market statistic on the page, plus **at least two** community quotes, and confirm each one: the number, currency, billing period and per-user/flat basis for prices; the figure, year and whether it is measured or a projection for statistics; the exact words for quotes. Note any important qualification and whether the source is the vendor itself, a review site, a research vendor or a forum post.

The engine proved only that each page contained the accepted text when it was read (the record keeps `retrievedAt` and a hash of the page text). It did not prove that the source is credible, independent or current, or that the claim is true everywhere. A vendor blog is not independent customer evidence. If anything is wrong or stale, re-run research — do not patch the MDX by hand.

### Step 5 — Seed Convex (dev now; prod only after deploy)

```bash
npm run seed:convex              # dev — staged work
```

Do **not** seed production yet. The seed marks the idea as MDX-backed because the file exists locally, but the live route cannot read it until Vercel has built it; seeding prod first puts a card on the live grid that links to a 404. Production seeding happens in Step 7, after the deploy is live. The seed never includes `engine-draft-*` drafts.

### Step 6 — OG card (best-effort, never blocks publish)

```bash
npm run og:generate -- --slug {slug} --surface idea --non-blocking
```

Success → `og.status: "ready"`. Both providers fail → `"failed"`, exit 0, publish continues.

### Step 7 — Deploy only when asked

Commit + push MDX, research record + OG PNG **only if the operator explicitly asks**. Do not push to `main` on your own.

```bash
# The record is what audit:idea reads (Step 3.1); commit it so the audit can be re-run.
git add content/ideas/{slug}.mdx ideas/manifest.json engine/records/{slug}.json
# The OG card is non-blocking (Step 6): stage it only if it was generated.
[ -f public/image/og/idea/{slug}.png ] && git add public/image/og/idea/{slug}.png
git commit -m "content(idea): {title}"
git push   # only when asked; triggers Vercel
```

Confirm the page is live: `curl -s -o /dev/null -w "%{http_code}\n" https://www.weekendmvp.app/ideas/{slug}` → **200**.

Only then seed production so the grid and hubs list it:

```bash
npm run seed:convex -- --prod    # after the 200 above; REQUIRED for live /startup-ideas + hubs
```

Skipping `--prod` after deploy is the #1 "I can't see my idea" cause. No deploy authorization → no prod seed; report **staged (dev seed only)**.

### Step 8 — Output report

```
## Published: {IDEA_TITLE}

**Source:** idea engine (`engine:{slug}`) — record at engine/records/{slug}.json, report at engine/records/{slug}.json.report.json

**Research:** cost ${X} (cap $4.00), attempts {per step}; accepted {quotes}/{stats}/{prices}; rejected {top reasons}

**Files:**
- content/ideas/{slug}.mdx (8 headings including Sources)
- ideas/manifest.json (tagged, provenance, og)
- engine/records/{slug}.json
- image/og/idea/{slug}.png (if og.status=ready)

**Audit:** words={N} competitors={N} sources={N} howTo={N} — audit:idea PASS; validate:idea-tags PASS
**Source check:** {N} prices, {N} statistics, {N} quotes confirmed; qualifications: {…}
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

> "{accepted quote, verbatim}"
>
> — [{source title}]({source url})

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
- `engine:research` exits 1 → read the printed summary and the run report: `failedStep`, the redacted error, cost, attempts, and the rejection reasons. `evidence_acceptance` means the cited pages did not support enough claims: try a sharper brief or seed keywords once, or refuse the idea — never hand-write evidence. `source_acquisition` means no cited page could be read. Missing keys, the cost cap and provider failures are reported the same way. Do not call Ideabrowser MCP; do not invent stats.
- `engine:compile` refuses a **legacy v1 record** → re-run `engine:research … --live`; nothing upgrades a v1 record. Refuses an incomplete record → re-research. Refuses an overwrite → pass `--force` only with operator OK, or pick a new slug.
- `audit:idea` fails → re-research or abandon; revert any hand edit to a factual block; never set `auditPassed: true`.
- `validate:idea-tags` fails → fix allowlists before seed.
- Source check finds a wrong, stale or unsupported claim → do not publish; re-research.
- `seed:convex` fails → do not claim grid visibility.
- `og:generate` fails → fine (`og.status: "failed"`); publish continues.
- No commit authorization → report **staged + seeded**, not live.

---

## Checklist

### Engine path
- [ ] Idea gate passed (paying buyer, public pain, wedge) and no existing idea covers it
- [ ] Brief written (from title or `--from-draft` raw.md)
- [ ] `npm run engine:research -- --brief … --live --out engine/records/{slug}.json` — ok, under the $4.00 cap; cost, attempts and rejections noted from the report
- [ ] `npm run engine:compile -- --record engine/records/{slug}.json`
- [ ] Manifest tagging filled (category, ≥2 tools, ≥2 audiences, revenueGoal, buildTime, og)
- [ ] Homepage `highlights` block written from the MDX (quote, 1–3 stats, 3–5 competitors), no invented numbers
- [ ] Prose polish only; no hand edits to quotes, attributions, evidence rows or Year-One Math; `audit:idea` re-run after every edit
- [ ] `npm run audit:idea -- --slug {slug}` PASS on the deep bar (≥2,200 words, verified quotes, evidence rows, Year-One Math, idea-specific schema, no broken links)
- [ ] `npm run validate:idea-tags -- --slug {slug}` PASS
- [ ] Human source check: every competitor price and market statistic source, plus ≥2 quotes, opened and confirmed
- [ ] `provenance.auditPassed` set true only after both gates and the source check
- [ ] `npm run seed:convex` (dev)
- [ ] `npm run seed:convex -- --prod` only after the authorized deploy returns 200
- [ ] `npm run og:generate -- --slug {slug} --surface idea --non-blocking`
- [ ] Commit/push **only if operator asked**
- [ ] Preview at `http://localhost:3000/ideas/{slug}` (all 8 sections)
- [ ] No Ideabrowser MCP calls were made
