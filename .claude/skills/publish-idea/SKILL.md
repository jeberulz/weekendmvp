---
name: publish-idea
description: "Prepare a startup idea with the local engine and submit it for private editorial review. DEFAULT: /publish-idea {title} — brief, live research, compile, tagging, deep audit, human source check, then editorial:submit-engine dry run. Applying the private submission requires an exact target, backup and operator instruction. Public release remains gated by WP46-E6. OPT-IN: /publish-idea --from-draft {folder-name} when the seed lives in ideas/drafts/. Ideabrowser MCP is not part of this skill."
---

# Publish Idea Skill

Transform a brief (or draft folder) into a research-backed `/ideas/{slug}` page via the **local idea engine** — not Ideabrowser MCP.

## How a page actually renders (read this first)

The site is **Next.js + MDX + Convex**. An idea page is two files plus automated steps — the skill never writes HTML, `<head>`, schema, nav, or analytics:

| Layer | Owned by | This skill writes? |
|---|---|---|
| **Body** (the prose) | `content/ideas/{slug}.mdx` — frontmatter `slug`, `title`, `engine: true` + canonical `##` sections | ✅ via `engine:compile` (unaudited wording may be polished after; factual blocks are audited, see Step 4) |
| **Metadata** (description, category, scores, og, highlights, provenance) | `ideas/manifest.json` `ideas[]` — the source of truth | ✅ compile writes the row (highlights included); you fill the tagging |
| **Grid card + ItemList JSON-LD** on `/startup-ideas`, hub pages | Convex after `seed:convex` | ❌ automatic |
| **Page metadata, OG tags, full JSON-LD @graph** | `app/ideas/[slug]/page.tsx` | ❌ route does it |
| **Nav, footer, analytics** | shared App Router layout | ❌ global |
| **Sitemap entry** | `app/sitemap.ts` auto-discovers `content/ideas/*.mdx` | ❌ automatic |
| **OG card PNG** | `public/image/og/idea/{slug}.png` via `npm run og:generate` | ✅ automated step |

Practical consequences:
- The `HowTo` schema is parsed from the MDX body: `## The Solution` **must** contain `**How it works:**` followed by a numbered list (`1.` / `2.` / `3.`).
- Meta description comes from the manifest `description` field; compile copies the brief's one-liner into it.
- Slugs must match `^[a-z0-9-]+$` (validated in `lib/mdx.tsx`). Files starting with `_` are excluded from the site, and `engine-draft-*` slugs never render.
- The current public site still reads checked-in MDX and the production catalogue seed. A production push or seed can make a page visible **outside** editorial review. Until WP46-E6 installs the public visibility gate, keep new engine ideas private in the editorial workflow; do not use the older direct-publish steps for them.

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

Checks that need no keys and spend nothing:
- `npm run engine:replay` runs the synthetic fixture through the real research → compile → deep-audit CLIs in a temp dir (empty environment; nothing is written to the repo) and prints each step's exit code and the verdict. Run it after pulling engine changes or before a batch; if it fails, the engine itself is broken — stop. A pass says the code paths agree on the fixture, not that live sources or live models will behave.
- `npm run test:engine` (part of `npm test`) runs the engine suites, including the same replay with authenticity and adversarial checks (`lib/engine/replay.test.ts`).
- `npm run engine:eval` only re-audits three handwritten gold pages (a legacy auditor regression). It is not evidence of engine quality.
- `npm run validate:idea-tags` checks the tagging allowlists and the shape of every `highlights` block.

If a live compile cannot clear the auditor on this machine, stop and report — do not start phase 9.

---

## What This Skill Does

1. **Builds a brief** JSON (`title`, `audience`, `revenueModel`, `seedKeywords[]`, optional `slug` / `oneLiner`).
2. **Runs** `npm run engine:research -- --brief {path} --live --out engine/records/{slug}.json` — a contract v2 research record plus a run report, or a run report and no record.
3. **Runs** `npm run engine:compile -- --record engine/records/{slug}.json` → MDX + manifest row (`source: "engine:{slug}"`, generated `highlights`).
4. **Fills tagging** on the manifest row (category, tools≥2, audiences≥2, revenueGoal, buildTime, og).
5. **Gates:** `npm run audit:idea -- --slug {slug}` then `npm run validate:idea-tags -- --slug {slug}`.
6. **Checks the sources by hand** (Step 4.1) — every competitor price and market statistic, plus at least two quotes.
7. **Dry-runs the private editorial submission** with `npm run editorial:submit-engine -- --slug={slug}`; the operator-only apply path is Step 4.2.
8. **Generates the OG card** (`npm run og:generate -- --slug {slug} --surface idea --non-blocking`).
9. **Stops at private editorial review** until the E6 release path exists. A push or production seed through the older direct path makes the page public independently of editorial approval.
10. **Reports** slug, record and report paths, cost and attempts, audit metrics, source-check result, editorial submission/check state and preview status.

---

## ═══════════════════════════════════════════
## DEFAULT: Engine pipeline (title or draft)
## ═══════════════════════════════════════════

### Step 1 — Build the brief

Write `engine/briefs/{slug}.json` (or a temp path). Shape:

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

The run keeps `title`, `audience`, `slug` and `oneLiner` exactly as written; without a `slug` it derives one from the title. The brief-normalization call may only tidy `revenueModel` into one line and refine the seed keywords (at most 20, each at most 80 characters, no links). The one-liner (the title when omitted) becomes the manifest `description` and the Landing Page prompt's hero line, so it may hold no figure, quotation or `[[ev:…]]` token: the run refuses such a brief before spending anything, as it does any brief text with an invisible or bidirectional control character. `fixtureScenario` belongs to fixture briefs only; a live run refuses a brief that has it.

When broad search misses an official pricing page or a relevant buyer discussion, add optional `sourceHints` with public URLs grouped under `market`, `competitors` or `community` (up to eight per group). Open those pages first; supply URLs, not claims or hoped-for prices. The engine fetches and checks them, and they never replace the human source check. Do not use comparisons, roundups or generic market reports to force a minimum.

**Idea gate (before spending on research).** Ideabrowser used to pre-validate ideas; now you do. Refuse the title and say why unless all three hold:
1. A **named buyer who pays today** for a worse workaround (a tool, a contractor, or hours they can price).
2. **Evidence the pain is public**: at least one Hacker News / forum / Reddit thread you can link, or a seed keyword you expect to carry search volume.
3. A **wedge the incumbents skip** (too small, too niche, too price-sensitive), stated in one sentence.

Also refuse if an existing idea already covers the same buyer + job (search `ideas/manifest.json` titles and descriptions, not just slugs).

**From a title only:** write a tight audience, revenue model, and 3–5 seed keywords from the title. Confirm the slug is free in `ideas/manifest.json`, `content/ideas/` and `engine/records/`.

**From `--from-draft {folder}`:**
- Require `ideas/drafts/{folder}/raw.md`.
- Use the draft **title verbatim**.
- Take the audience, revenue model and seed keywords from raw.md. The brief has no competitor or statistic claims. Optional `sourceHints` may list vetted public page URLs; competitors, prices, statistics and quotes still come only from pages the research run fetches and accepts, never from draft prose.
- Do **not** copy draft prose into the MDX. Optional `competitors.md` / `notes.md` inform seed keywords only.

### Step 2 — Research (live)

```bash
npm run engine:research -- --brief engine/briefs/{name}.json --live --out engine/records/{slug}.json
# --out     record path (default engine/records/{slug}.json)
# --report  run report path (default {out}.report.json; must differ from --out)
# --force   replace an existing record and run report
```

The mode is always explicit: `--brief` requires `--live`, `--fixture <name>` (below) takes neither, and the CLI refuses anything else. Live runs need `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` (shell, then `.env.local`, then `.env`; shell values win). Before spending, the CLI refuses to overwrite an existing record or run report without `--force`. A failed run leaves its report behind, so re-running needs `--force` or another `--report` path; a forced re-run that fails replaces the report but leaves any earlier record in place. The record is parsed as contract v2 again at the CLI boundary before it is written.

**What a run does, in order.** Evidence is extracted and accepted deterministically **before** anything is written:

1. Brief normalization, then three searches (market statistics, competitors, community pain). Only search citations (at most 8 each) and validated operator `sourceHints` URLs reach acquisition; search answer prose never reaches a later step. A search citation carrying userinfo or a credential-like path or query value is never read (the report lists it by host and reason); a brief hint with one is refused before spending. When fewer than two community pages can be read, one non-Reddit supplement search runs.
2. Source acquisition: every distinct cited page is read once per run — at most 2 MiB of body, 15 s per read including DNS and up to five redirects, four reads at a time, public addresses only. If no page can be read, the run stops at `source_acquisition`, before the extraction call.
3. Evidence extraction: one schema-only call sees bounded excerpts of the read pages and proposes candidate quotes, market statistics, competitor prices and explicit pricing-availability statements copied from them. Its output is untrusted: unknown fields, prose and any verification flag are ignored, and acceptance re-derives every claim from the page. When exact community quotes alone miss the minimum, the remaining budgeted extraction attempt can ask for quotes only; the original accepted statistics and competitor claims stay fixed.
4. **Acceptance (deterministic code, no model)** against the full text of each candidate's own cited page — rules below. Rejections keep their reasons in the record and the report (operator-only; never shown to the writer or on the page).
5. **Minimums on accepted evidence:** at least 2 market statistics, 3 distinct competitors with an accepted numeric price or first-party pricing-availability statement (at least 1 numeric-priced vendor), and 2 distinct community quotes (neither text contains the other). If they are not met the run **stops at `evidence_acceptance`**: the report names the shortfall and the top rejection reasons, no record is written, and no keyword or writer call is made after that point.
6. Keyword volume, competition and CPC come only from DataForSEO; a keyword failure fails the run (nothing is estimated).
7. The writer gets the brief, the accepted evidence and the keyword rows — nothing else — and must follow the writer text rules below. A reply that fails the record parse is regenerated with the issue list under the same rules; after three billable attempts the run fails at `editorial_synthesis`.
8. The record is assembled and parsed as contract v2: every accepted item is re-derived from its own excerpt and every reference must resolve.

**What acceptance requires.** Anything ambiguous is rejected.
- **Every item:** its URL is a search citation or validated operator hint that was read; its excerpt is a contiguous span of that page in the page's own characters (an internal ellipsis rejects); the excerpt and any vendor, plan or stat subject hold no invisible or bidirectional control character. A citation title over 120 characters, or one with a figure, link, email or such a control in it, is replaced by the source's host label.
- **Quotes:** only from pages the community search cited; whole sentences from one line of the page (one comment or block, never two speakers); 6–80 words.
- **Market statistics:** the whole claim re-derives from the one sentence that states it — the amount with its currency, unit and magnitude; a metric the sentence's own words state; every subject word (short function words aside) in that sentence; a declared year that belongs to that figure; measured or projected as the sentence says (a forecast is never accepted as measured, and a bare year is never an amount).
- **Competitor prices:** amount, currency, period, per-user/flat basis and every billing qualifier in the price's clause (billed annually or monthly, starting at, introductory, plus usage) equal the page's own price expression. When the page shows annual billing above a monthly price (a monthly/yearly toggle, an "all plans billed annually" line), the price's own clause must say which billing it is. On the vendor's own site the price is first-party; anywhere else the vendor must be named before the price in its clause, and the price is secondary, shown as "(via host)". On every page the nearest brand-like name before the price must be that vendor or its plan (this fails closed: an unrecognised capitalised word nearer the price than the vendor or plan name rejects it), no other known vendor may share the clause, a comparison (unlike, than, versus, compared, alternative, switched from, migrated to, replaced by, …) binds no price, and a known vendor's own site is never evidence for a rival's price. Ranges, "up to" prices, custom pricing and currencies other than USD, EUR, GBP, CAD and AUD are not prices.

**Writer text rules (rulings R6, R13).** The record parser applies them (a violation sends the writer back with the issue list) and the final audit applies them again on the page:
- **No figures in writer text** — the narratives, summaries, Why now, competitor notes, positioning, pricing notes, channels, How-it-works steps, product name, audience label, what not to build, stack notes, brand brief, tier names, unit-economics labels, funnel stage names and the Year-One assumptions: no digits in any script, no currency sign, no number word from two upward (two, twelve, forty seven, hundreds, a dozen), no percent or per cent, no forms such as sub-10 or top-5. Allowed: a bare year 1990–2039, names with digits (B2B, GPT-4o, 3D) and standard or version names (SOC 2, ISO 27001, OAuth 2.0, 24/7, Microsoft 365, Form 1099, Next.js 15, Claude 3.5).
- **No quotations:** no span of three or more words between quotation marks of any kind (straight or curly, double or single, guillemets, corner brackets); apostrophes inside words are fine.
- **Facts only through evidence tokens:** `[[ev:<id>]]` of an accepted item, which the page renders as that item's whole claim (a stat's subject, metric and period; a price's vendor and plan; the quote itself). Each field may cite only some kinds, and a competitor's notes only its own prices.
- **Numeric proposal slots** — tier price and includes, unit-economics values, Year-One counts and seats, data-model columns — are the only places for figures. The page labels them as proposals or assumptions; they take no tokens and hold no revenue total, no `N × $X = $Y` computation and no quotation.

**Cost and attempts.** The cap is **$4.00** per run. Every billable attempt reserves its step's worst case against the cap before the call, and each step has a fixed attempt limit (brief normalization 2, market search 2, competitor search 3 including supplements, community 4 including the supplement, extraction 2, keywords 2, writer 3 — provider retries and regenerations included), so a run cannot pass the cap. Billed failures are recorded. The CLI prints the cost, attempts per step, accepted counts and rejection reasons, and writes the run report on success **and** failure (code revision, brief SHA-256, provider calls, models, source statuses, refused citations; no secrets, page bodies or local paths).

**Fixture mode** (no keys, no network, synthetic pages and fictional vendors — **never** for publishing):

```bash
npm run engine:research -- --fixture rfp-assistant --out /tmp/record.json
```

Fixture briefs live in `engine/briefs/fixtures/` and all describe one idea, slug `fixture-rfp-response-assistant`; the CLI refuses a fixture run for any other slug. Without `--out` the record goes to `engine/records/fixtures/`; a fixture record is never written straight into `engine/records/`. `--fixture rfp-assistant-thin-evidence` stops at `evidence_acceptance` (a failure with a report). Fixture records and reports say `"mode": "fixture"`; compile accepts them only under an `engine-draft-*` (or `_`-prefixed temp) slug, and the audit refuses them behind any slug but `engine-draft-*`. `npm run engine:replay` runs the fixture through compile and audit for you.

Source-reading notes:
- **Reddit needs app credentials on most networks.** Reddit answers the public `.json` endpoint with HTTP 403 from cloud machines. Create a free "script" app at reddit.com/prefs/apps and set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`; the engine then uses Reddit's OAuth API. `ENGINE_QUOTE_FETCH_UA` alone does not get past the block. Hacker News item URLs (read through the Algolia items API) and public forum threads usually read without credentials.
- **DataForSEO balance:** an account without balance fails `keywords_demand`; the error carries DataForSEO's status code (`40200`, Payment Required). Top up before a batch.

### Step 3 — Compile

```bash
npm run engine:compile -- --record engine/records/{slug}.json
# --slug name   compile under another slug (engine-draft-{slug} for a spot check)
# --force       replace an existing MDX file and manifest row that engine:compile wrote
# --replace-handwritten   with --force, also replace a handwritten page or manifest row
# --help        --ideas-dir, --manifest, --no-manifest, --json
```

The compiler parses the record first and refuses:
- a **contract v1 (legacy) record**, with the re-research message (see Legacy records below);
- an invalid record, listing its issues;
- a record missing the editorial fields the deep audit needs (the three narratives, what not to build yet, stack notes, brand brief, ≥2 pricing tiers, ≥2 unit-economics rows, a Year-One plan, ≥3 idea-specific data-model tables) or citing fewer than 2 distinct sources — it does not pad with generic text;
- a `mode: "fixture"` record under a slug that is not `engine-draft-*` (or `_`-prefixed temp);
- an `engine-draft-*` slug aimed at `content/ideas/` or `ideas/manifest.json`, however the path is spelled;
- an existing MDX file or manifest row without `--force`. With `--force` the whole manifest row is replaced, tagging included, so redo Step 4 after it. Never force a compile over a page that is not this idea's engine page;
- a **handwritten** page or manifest row, even with `--force`: a page without the `engine: true` marker (and no `engine:*` row for it), or a row whose `source` is not `engine:*`. The manifest row is checked even with `--no-manifest`. The refusal suggests compiling to `engine-draft-{slug}` instead; `--replace-handwritten` together with `--force` replaces the handwritten idea on purpose.

Writes:
- `content/ideas/{slug}.mdx` — frontmatter `slug`, `title`, `engine: true` (the marker keeps the deep audit on; the site ignores it), **eight** `##` headings (seven canonical + `## Sources`).
- `ideas/manifest.json` row — `source: "engine:{slug}"`, `description` = the one-liner, scores when present, `highlights` generated from the selected evidence (left out when the record cannot fill them), `provenance` (`researchMode`, `auditPassed: false`, word count, citations), and stub tagging for Step 4: `category: "uncategorized"`, empty `tools` / `audiences`, `buildTime: "10"`, `revenueGoal: "1k-month"`, `applicationCategory: "BusinessApplication"`, a generic `og.subject` with accent `lime` and status `pending`, `publishedAt` = the compile date.

What the page renders from the record:
- quote blockquotes `> "…"` / `>` / `> — [source title](url)`;
- market signal rows: each stat's rendering (amount, subject, metric, year or "projected") with its source link;
- competitor rows: `**Name** — notes. Published pricing: …` with each accepted price's rendering, "(via host)" on a secondary price, and its source link;
- evidence tokens in prose as links whose text is the item's rendering; search demand rows as recorded from DataForSEO;
- labels on every proposal and planning assumption: How it works, what not to build, pricing tiers, unit economics, Year-One Math, channels and the stack;
- **Year-One Math** computed by `lib/engine/finance.ts`: funnel stage lines, one base line and one downside line. Money is integer cents: per-account price = tier price × seats, ARR = accounts × per-account price × 12 for a monthly tier (× 1 for a yearly one), downside = floor(accounts ÷ 2) at the same price, which may be zero. Only a tier with one fixed USD monthly or yearly price can drive it. The funnel counts, seat count and close rate are the writer's planning assumptions; only the arithmetic is exact;
- `## Sources`: exactly the sources of the evidence the page uses.

Compiler does **not** seed Convex, generate OG, or push git.

**Spot-check drafts** use an `engine-draft-{slug}` slug (`--slug engine-draft-{slug}`). They compile to `engine/drafts/` (MDX + `engine/drafts/manifest.json`) and are refused in `content/ideas/` and `ideas/manifest.json`. `npm run audit:idea -- --slug engine-draft-{slug}` reads `engine/records/engine-draft-{slug}.json`, else `engine/records/{slug}.json`; pass `--record` for any other path. A draft page answers 404 and no discovery surface lists it: the sitemap, the homepage and the Convex seed skip drafts, and the Convex discovery queries (archive, hubs, related ideas, latest, dashboard catalogue, search, facets and counts) drop them on the server at read time, so rows seeded earlier stay stored but hidden. Members' saves, notes, collections and plans that reference a draft stay owner-scoped and show "Research retired". Never publish or seed an `engine-draft-*` slug.

**Shipping the draft rule:** deploy the Convex backend before the frontend that blocks the draft pages, and roll back in reverse, code only — there is no data migration. Pages cached under the `ideas` tag (`cacheLife("hours")`: the homepage, `/startup-ideas`, hubs and idea pages) can keep showing pre-deploy cards for about an hour unless the `ideas` tag is revalidated (`app/api/revalidate/route.ts`).

**Legacy records.** Every record written before WP54 is contract v1. `engine:compile` and `audit:idea` refuse it with a re-research message, and nothing upgrades it. The three v1 records committed in `engine/records/` (`ai-code-reviewer`, `ai-landing-page-generator-ecommerce`, `ai-rfp-response-assistant`) and the `engine/drafts/engine-draft-*` pages compiled from them are history: they fail the audit by design, nothing edits or upgrades them in place, and they are never published. Those slugs, which the representative briefs in `engine/briefs/` also use, belong to published handwritten pages. Research those briefs only as spot-check drafts: an explicit `--out` (for example `engine/records/engine-draft-ai-code-reviewer.json`) leaves the v1 file in place, and `--slug engine-draft-…` keeps the compile out of `content/ideas/` (replacing an existing draft needs `--force`).

### Step 3.1 — Quality bar (auditor failures, not chat rules)

`npm run audit:idea -- --slug {slug}` must pass (exit 0). It audits `content/ideas/{slug}.mdx` (else `engine/drafts/{slug}.mdx`) against `engine/records/{slug}.json`; `--record path` names another record, `--file path` audits an MDX file anywhere, `--manifest path` reads another manifest. The **deep bar** applies when the frontmatter says `engine: true`, the manifest source is `engine:*`, the slug is `engine-draft-*`, or `--record` is passed (see `ideas/SECTIONS.md` + `scripts/audit-idea-mdx.mjs --help`):

- All **8** headings in order: The Problem → The Solution → Market Research → Competitive Landscape → Business Model → Recommended Tech Stack → AI Prompts to Build This → **Sources**
- `**How it works:**` numbered list (≥2 named steps, never `Step 1`) under The Solution
- **≥2** markdown citation links in Sources
- Body **≥2,200 words**, no stock filler, no ≥8-word sentence repeated on the page or shared with another engine page, no near-duplicate paragraphs
- No broken markdown links; no placeholders; no bare `<` / `{` in prose (MDX JSX traps → 500); niche market sizing only
- **AI Prompts**: four prompts (Setup ≥60 words with ≥3 idea-specific tables, Core Feature ≥70, Landing ≥40, Branding ≥70); Setup tiers match Business Model tiers; number-first Unit Economics bullets
- The full audience label at most twice
- **Final artifact audit against the record** (a legacy or invalid record fails; a fixture record fails behind any slug but `engine-draft-*`):
  - structure: no JSX, HTML, images, footnotes, link definitions or raw `[[ev:` tokens; fenced code only in the build prompts; nothing before The Problem or after Sources; every proposal and assumption label stays;
  - links: every link targets a source the page's evidence uses, with that source's title or an evidence rendering as its text; Sources lists exactly those sources;
  - quotes: every blockquote equals a selected accepted quote exactly (case, digits, order and punctuation; only typographic quote marks, apostrophes, dashes and whitespace are folded) with a `— [title](url)` line naming and linking that quote's own source; every selected quote appears; ≥2 distinct quotes; any other quoted span of three or more words must be a quote the record uses;
  - rows: market and competitor rows show their evidence renderings and sources ("(via host)" on secondary prices); a first-party pricing URL backs one competitor only and may not be a roundup or comparison page; keyword rows, tier rows (name, price, includes) and unit-economics values print the record exactly;
  - figures: in every section, a figure (digits in any script, number words, percent, currency) outside linked evidence renderings and source titles, evidence and keyword rows, tier rows, unit-economics values, the Year-One lines, bare years and competitor names fails as an "unbound figure"; inside the prompt fences only renderings and the numeric proposal values may hold figures (a guard against typed-in numbers, not proof that prose is true);
  - money: Year-One Math is recomputed from the record (accounts, per-account price, period, ARR, tier, seats, downside, funnel counts), with exactly one base and one downside line; no section states another revenue total or a Year-One-style computation;
  - manifest: `highlights`, when present, must equal what the record generates, and `provenance.researchMode` must match the record's mode.
- Warning only: fewer than three first-party pricing URLs.

If audit fails: **STOP**. Re-research, or refuse the idea. Do not patch factual blocks by hand, and do not fall back to Ideabrowser MCP.

### Step 4 — Tagging fill (required before seed)

Compile stubs the tagging (`category: "uncategorized"`, empty `tools` / `audiences`, default `buildTime`, `revenueGoal`, `applicationCategory` and `og`). Edit the manifest row:

| Field | Rule |
|---|---|
| `category` | Exactly one of: `saas`, `productivity`, `health`, `marketplace`, `ai-tools`, `automation`, `education`, `b2b`, `developer-tools`, `ecommerce`, `creator-tools`, `fintech` |
| `buildTime` | Canonical hour string only: `"8"`, `"10"`, `"12"`, `"20"`, `"24"`, `"30"`, `"40"` (compile writes `"10"`) |
| `revenueGoal` | Exactly one of: `1k-month`, `5k-month`, `10k-month`, `passive-income`, `quick-wins` (compile writes `1k-month`) |
| `tools[]` | ≥2 from: `cursor`, `claude`, `bolt`, `v0`, `lovable`, `replit`, `windsurf`, `no-code` (tag `claude`, not `claude-code`) |
| `audiences[]` | ≥2 from: `developers`, `designers`, `non-technical`, `solo-founders`, `weekend-builders`, `side-hustlers`, `marketers`, `freelancers`, `creators`, `small-business-owners` |
| `description` | Compile copies the brief's one-liner (figure-free by rule). A rewrite (~155-char SEO blurb) must stay free of figures and quotations: no audit checks this field |
| `og.subject` / `og.accent` | Replace compile's generic subject with a concrete still-life director's note; accent one of `lime`, `mint`, `lavender`, `emerald`, `aubergine` |
| `applicationCategory` | Schema.org SoftwareApplication category (compile writes `BusinessApplication`) |

**Homepage `highlights` are generated, never written.** `engine:compile` builds the block from the first selected quote that fits 190 characters, up to three selected stats with their full typed labels, at least three competitors whose first-party numeric price or explicit first-party pricing status fits, and up to three proposed product tiers from the validated editorial record. Secondary competitor prices stay off the homepage because the compact tile cannot show their `(via host)` attribution. The status labels never imply a numeric price. `audit:idea` fails a row whose highlights differ from what the record generates; `validate:idea-tags` checks their shape. Do not add, edit or reorder them by hand. For engine rows the homepage shows these generated highlights only (no MDX fallback). An engine idea can enter the weekly feature pool when its other required tiles, citations and art are present; it is not featured automatically.

Then:

```bash
npm run audit:idea -- --slug {slug}
npm run validate:idea-tags -- --slug {slug}
# expect: PASS, and "1/1 ideas pass tagging contract (0 fail)"
```

Set `provenance.auditPassed: true` and `provenance.auditRunAt` (the time of the passing audit; compile pre-fills the research time) only after both pass **and** the source check in Step 4.1 is done.

**What you may edit after compile.** Wording that no audit compares with the record: the narratives, summaries, Why now, competitor notes, positioning, pricing notes, How-it-works descriptions, what not to build, stack notes, channel lines, funnel stage names, unit-economics labels, the Year-One assumptions and the build-prompt wording (keep the tier names and tables). An edit may add no figure, no quoted span of three or more words, no link, no evidence token, no revenue total and no HTML/JSX, image, footnote or code fence; it keeps every heading and label and keeps the page above 2,200 words without duplicate sentences.

**What you may not hand-edit:** quotes, their attribution lines and titles; market, competitor and keyword rows (renderings, prices, "(via host)" labels, links); linked evidence renderings in prose; tier rows; unit-economics values; the Year-One Math lines and funnel counts; the Sources list; the proposal labels; the generated manifest `highlights` and `provenance.researchMode`. The audit compares these with the record, so a hand edit fails; a wrong fact means re-research, not a patch. Never edit the record either: a changed accepted item or id, or a figure added to writer text, fails its parse, and any other change bypasses the research. **Re-run `audit:idea` after every edit.** For voice, `content/ideas/course-translation-resale-network.mdx` is the depth benchmark (`engine/eval/deep-benchmark.md`).

### Step 4.1 — Human source check (before any commit or `--prod` seed)

Open, in a browser, the cited source of **every** competitor price and **every** market statistic on the page, plus **at least two** community quotes. The record keeps each item's excerpt (`evidence.accepted[].excerpt`), its `retrievedAt` and a hash of the page text; the page may have changed since. Confirm:
- **Prices:** vendor, plan, amount, currency, billing period, per-user/flat basis and billing qualifiers. Watch page-level monthly/annual toggles and "billed annually" notes away from the price. A "(via host)" price comes from a third-party page: check that the page ties that price to that vendor. For contact-sales rows, check the whole page for self-serve plans; do not describe one custom-quote option as the vendor's only pricing model.
- **Statistics:** subject, metric, year, and whether the figure is a measurement or a projection. If the cited page attributes a number to another publication or survey, open that original source and confirm the same claim there; a vendor repeating an unsupported survey figure is insufficient.
- **Niche fit:** each selected market statistic must measure the idea's product category, not a larger adjacent category presented as its market size. Recheck the surrounding prose for that implication even when the stat label itself is accurate.
- **Quotes:** a whole statement read in its context — no dropped negation or condition, not two speakers merged. It must describe a concrete problem the target buyer faces in this workflow; a maker announcing a tool, a vendor reply or generic frustration does not count as buyer pain.
- **Source type:** vendor marketing, independent research, review site or user anecdote; note any important qualification.

A matching excerpt proves the page contained that text when it was read. It does not prove that the source is credible, independent or current, or that the claim holds everywhere; a vendor blog is not independent customer evidence. If anything is wrong, stale or unsupported, do not publish: re-run research — never patch the MDX or the record by hand.

### Step 4.2 — Private editorial submission (WP46-E5)

After tagging, deep audit and the human source check, run `npm run editorial:submit-engine -- --slug={slug}`. It checks the contract-v2 live record, exact MDX and manifest row again, and prints the submission ID plus artifact and record hashes. It writes nothing on a dry run. A fixture, legacy record, changed evidence rendering or invalid metadata stops here.

The operator may submit that exact artifact to the private editorial workspace only after the E5 backend is deployed, a fresh backup is verified and the target deployment is identified. Use the hash from the dry run:

```bash
EDITORIAL_ENGINE_CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud \
EDITORIAL_ENGINE_ADMIN_KEY=... \
npm run editorial:submit-engine -- --slug={slug} --apply \
  --confirm-submission={artifactHash} --target=YOUR-DEPLOYMENT --backup=/absolute/path/to/backup.zip
```

Set the admin key in the environment, never in a committed file or shell argument. The private backend re-audits the input and pins the research record in the same transaction as the candidate. Then sign in to `/admin/editorial`, accept or request research on the candidate, run the saved-revision checks, review sources and sections, and approve only a passing current revision. A stale or edited figure fails the required check. **Approval is private:** the Settings page still says Publishing readiness “Unavailable” until WP46-E6 adds the release worker and public visibility gate.

Until E6, stop after private editorial review. Do not run the older production push or `seed:convex -- --prod` path for a new engine idea: it can bypass editorial release.

### Step 5 — Legacy direct-publication path (paused for new engine ideas until E6)

```bash
npm run seed:convex              # dev — staged work
```

Do **not** seed production yet. The seed marks the idea as MDX-backed because the file exists locally, but the live route cannot read it until Vercel has built it; seeding prod first puts a card on the live grid that links to a 404. Production seeding happens in Step 7, after the deploy is live and only on the operator's instruction. The seed never includes `engine-draft-*` drafts.

### Step 6 — OG card (best-effort, never blocks publish)

```bash
npm run og:generate -- --slug {slug} --surface idea --non-blocking
```

Success → `og.status: "ready"`. Both providers fail → `"failed"`, exit 0, publish continues.

### Step 7 — Deploy only when asked

Commit + push MDX, research record + OG PNG **only if the operator explicitly asks**. Do not push to `main` on your own. This skill never seeds production or publishes without the operator's explicit instruction.

```bash
# The record is what audit:idea reads (Step 3.1); commit it so the audit can be re-run.
git add content/ideas/{slug}.mdx ideas/manifest.json engine/records/{slug}.json
# The OG card is non-blocking (Step 6): stage it only if it was generated.
[ -f public/image/og/idea/{slug}.png ] && git add public/image/og/idea/{slug}.png
git commit -m "content(idea): {title}"
git push   # only when asked; triggers Vercel
```

The run report next to the record (`engine/records/{slug}.json.report.json`) holds no secrets, page bodies or local paths; stage it too if the operator wants the run's cost and rejections kept in git. If the release also ships the engine-draft rule, deploy the Convex backend before the frontend (Step 3).

Confirm the page is live: `curl -s -o /dev/null -w "%{http_code}\n" https://www.weekendmvp.app/ideas/{slug}` → **200**.

Only then, on the operator's instruction, seed production so the grid and hubs list it:

```bash
npm run seed:convex -- --prod    # after the 200 above; REQUIRED for live /startup-ideas + hubs
```

Skipping `--prod` after deploy is the #1 "I can't see my idea" cause. The seed does not revalidate the page cache, so the cached grid, hubs and homepage (`ideas` tag, about an hour) may lag unless that tag is revalidated. No deploy authorization → no prod seed; report **staged (dev seed only)**.

### Step 8 — Output report

```
## Published: {IDEA_TITLE}

**Source:** idea engine (`engine:{slug}`) — record at engine/records/{slug}.json, report at engine/records/{slug}.json.report.json

**Research:** mode live; code {sha}{, dirty}; cost ${X} (cap $4.00); attempts {per step}; accepted {quotes}/{stats}/{prices}; rejected {top reasons}; refused citations {N}

**Files:**
- content/ideas/{slug}.mdx (8 headings including Sources; frontmatter engine: true)
- ideas/manifest.json (tagged, provenance, og, generated highlights)
- engine/records/{slug}.json
- public/image/og/idea/{slug}.png (if og.status=ready)

**Audit:** words={N} competitors={N} sources={N} howTo={N} — audit:idea PASS (warnings: …); validate:idea-tags PASS
**Source check:** {N} prices, {N} statistics, {N} quotes confirmed; source types and qualifications: {…}
**Seed:** {dev: OK/failed; prod: OK/failed/not authorized}
**OG:** {ready|failed}
**Deploy:** {LIVE | STAGED — not pushed}

**Preview:** npm run dev → http://localhost:3000/ideas/{slug}
```

---

## MDX shape (compiler output — do not break)

````mdx
---
slug: "{slug}"
title: "{Idea Title}"
engine: true
---

## The Problem

{problem narrative}

{community summary}

> "{accepted quote, verbatim}"
>
> — [{source title}]({source url})

## The Solution

{solution narrative}

The workflow below is {Product}'s proposed first version: a plan to build, not a tested product.

**How it works:**

1. **{Step}** — ...
2. **{Step}** — ...

What not to build yet (scope advice for {Product}'s first version, not research):

{what not to build}

## Market Research

{market summary}

Why now: {why now}

**Market signals**

- {stat rendering} ([{source title}]({source url})).

**Search demand** (DataForSEO, US monthly)

- **{term}** — {volume}/mo, competition {competition}, CPC ${cpc}

## Competitive Landscape

{competitive narrative}

- **{Competitor}** — {notes}. Published pricing: {price rendering} [{source title}]({source url}).

**Your Opportunity**

{positioning}

## Business Model

{pricing notes}

Proposed {Product} pricing to test with early buyers (an assumption, not observed market data):

- **{Tier}** ({price}) — {includes}

**Unit Economics**

Planning estimates to verify, not measured results:

- **{value}** — {label}

**Year-One Math**

{Product}'s funnel, seat count and close rate below are planning assumptions, not measured results; the totals are plain arithmetic on them.

{Year-One assumptions}

- **{count}** — {funnel stage}
- **{N} × ${price}/mo = ${ARR} ARR** — {Tier} accounts paying by month 12
- **{floor(N/2)} × ${price}/mo = ${ARR} ARR** — downside if the close rate halves (half of {N} accounts, rounded down)

**Channels**

Channels to test (proposals, not measured results):

- {channel}

## Recommended Tech Stack

A suggested stack for {Product} (a recommendation, not research):

{stack notes}

- **Next.js + TypeScript** — screens for {step titles}
- … (Postgres, Auth, Stripe Billing, Vercel)

## AI Prompts to Build This

Copy these {Product} build prompts into Claude, Cursor, or your AI coding tool.

**1. Project Setup**

```text
...
```

(**2. Core Feature**, **3. Landing Page** and **4. Branding Package** follow the same pattern.)

## Sources

- [{title}]({url})
- [{title}]({url})
````

Authoring rules:
- GFM only. No raw HTML, JSX, images, footnotes or link definitions; fenced code only inside the build prompts.
- Escape bare `<` and `{` in prose (`\<`, `\{`) or the page 500s; compile already escapes record text once.
- Frontmatter is exactly what compile writes: `slug`, `title`, `engine: true`.

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
- `engine:research` refuses before running (mode flags, brief JSON, a one-liner with a figure or quotation, an existing record or report without `--force`, a fixture brief for another slug) → fix the input; nothing was spent.
- `engine:research` exits 1 after starting → read the printed summary and the run report: `failedStep`, the redacted error, cost, attempts, accepted counts, rejection reasons, source statuses and refused citations.
  - `evidence_acceptance`: the cited pages did not support enough whole claims. Try a sharper brief or seed keywords once, or refuse the idea — never hand-write evidence.
  - `source_acquisition`: no cited page could be read (see the Reddit note in Step 2).
  - `keywords_demand`: DataForSEO failed (balance, credentials); nothing is estimated in its place.
  - `editorial_synthesis`: the writer's reply failed validation three times; the error lists the issues. Re-run at most once, or refuse the idea.
  - `provenance_parse`: the record failed its own parse; report it as an engine defect.
  - Missing keys, the cost cap and provider failures are reported the same way. Do not call Ideabrowser MCP; do not invent stats.
- `engine:compile` refuses a **legacy v1 record** → re-run `engine:research … --live`; nothing upgrades a v1 record. Refuses an incomplete or invalid record → re-research. Refuses a fixture record → it compiles only as an `engine-draft-*` draft. Refuses an overwrite → pass `--force` only with operator OK and only for this idea's own engine page, or pick a new slug.
- `audit:idea` fails → re-research or abandon; revert any hand edit to a factual block; never set `auditPassed: true`.
- `validate:idea-tags` fails → fix the allowlist fields before seed. A `highlights` error on an engine row means the block was edited: restore the compiled one.
- Source check finds a wrong, stale or unsupported claim → do not publish; re-research.
- `seed:convex` fails → do not claim grid visibility.
- `og:generate` fails → fine (`og.status: "failed"`); publish continues.
- No commit authorization → report **staged + seeded**, not live.

---

## Checklist

### Engine path
- [ ] Idea gate passed (paying buyer, public pain, wedge) and no existing idea covers it; slug free in the manifest, `content/ideas/` and `engine/records/`
- [ ] Brief written (from title or `--from-draft` raw.md); one-liner free of figures and quotations
- [ ] `npm run engine:research -- --brief … --live --out engine/records/{slug}.json` — ok, under the $4.00 cap; cost, attempts and rejections noted from the report
- [ ] `npm run engine:compile -- --record engine/records/{slug}.json`
- [ ] Manifest tagging filled (category, ≥2 tools, ≥2 audiences, revenueGoal, buildTime, og); generated `highlights` left untouched
- [ ] Only unaudited wording polished; no hand edits to quotes, attributions, evidence rows, tier rows, unit-economics values, Year-One Math, Sources, labels or highlights; `audit:idea` re-run after every edit
- [ ] `npm run audit:idea -- --slug {slug}` PASS on the deep bar (≥2,200 words, verified quotes, evidence rows, recomputed Year-One Math, no unbound figures, idea-specific schema, no broken links)
- [ ] `npm run validate:idea-tags -- --slug {slug}` PASS
- [ ] Human source check: every competitor price and market statistic source, plus ≥2 quotes, opened and confirmed (billing toggles, projections, whole statements, source type)
- [ ] `provenance.auditPassed` set true only after both gates and the source check
- [ ] `npm run editorial:submit-engine -- --slug={slug}` dry run passed; exact hash recorded
- [ ] If specifically authorized, exact target/backup confirmed and private submission applied; editor ran current-revision checks and reviewed the evidence
- [ ] New engine idea has not been pushed or production-seeded through the direct path while E6 is absent
- [ ] `npm run seed:convex` (dev)
- [ ] `npm run og:generate -- --slug {slug} --surface idea --non-blocking`
- [ ] Commit/push **only if operator asked**
- [ ] `npm run seed:convex -- --prod` only on the operator's instruction, after the deploy returns 200
- [ ] Preview at `http://localhost:3000/ideas/{slug}` (all 8 sections)
- [ ] No Ideabrowser MCP calls were made
