# Pain Engine — Phase 1

A **new** engine that turns real pains into startup-idea drafts. It is
separate from the old idea engine in `lib/engine/` and does not touch it:
no `engine/records/`, no Source Critic gate, no E7 release gate, no
auto-publish. Drafts land in the single-approval review queue under
`engine/pain/review/` and wait for **one** human approve/reject.

Target: **10 ideas/week, one human approval, then live** (publishing itself
stays a separate, human-operated step after approval).

## How it works

```
listen (6 sources, isolated) -> cluster -> score -> write -> review queue
```

1. **Listen.** Each listener runs on its own (`Promise.allSettled`), with
   retries, timeouts, and an on-disk cache (`engine/pain/cache/`, git-ignored)
   so a retry never re-fetches. One source failing is reported in the run
   report; it can never kill the batch.
2. **Cluster.** Near-duplicate pains are grouped by token-overlap
   coefficient (≥ 0.3, deterministic, no LLM).
3. **Score.** Each cluster scores 0–100 on frequency (×4), pain intensity
   (×3), workaround spend (×2) and weekend-buildability (×1), plus a
   verdict scorecard (composite + four dials + BUILD / PIVOT / PASS).
4. **Write.** Only top-scored clusters reach the writer. The writer is
   deterministic and makes **no LLM calls** — cost is $0 per draft.
5. **Review.** Drafts wait in `engine/pain/review/{slug}.json` as `pending`.
   `decideReview` approves or rejects once; approving does **not** publish.

## Sources and keys (Phase 1 — all free)

| Source | Access | Key / env |
|---|---|---|
| Hacker News | Algolia search API | none |
| Reddit | App-only OAuth when `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` set, else public `.json` (often 403 from cloud IPs — reported, not fatal) | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` (already in the old engine's setup) |
| Product Hunt | GraphQL API, free developer token | `PRODUCT_HUNT_TOKEN` — skipped, not failed, when unset |
| GitHub issues | Free search API, no auth for low volume | `GITHUB_TOKEN` (optional, raises rate limit) |
| App Store reviews | Apple RSS review feeds, no key | `PAIN_ENGINE_APP_STORE_IDS` (comma-separated App Store ids) — skipped when unset |
| Idea 4 requests/votes | Read-only consumer of `convex/ideaRequests.ts` `listForSuggest` rows, supplied as a JSON file | `--idea-requests-file rows.json` — this engine never calls Convex and never modifies that file |

Out of scope in Phase 1: **X** (official API ~$200/mo) and **Facebook
groups** (no clean public API; permissions + login). Both are later phases.

## MDX spec the writer follows

Studied from the published pages before writing the writer
(`content/ideas/prompt-regression-tests-indie-ai-builders.mdx`,
`content/ideas/dmarc-monitor-agencies-small-business.mdx`,
`ideas/manifest.json`, `app/ideas/[slug]/page.tsx`,
`scripts/audit-idea-mdx.mjs`, `scripts/validate-idea-tags.mjs`):

- **Frontmatter:** `slug` + `title` only. Deliberately **no `engine: true`**:
  that marker routes a page through the old engine's sealed Source Critic
  artifact audit, which needs an old-engine research record this engine
  never produces. Drafts carry `source: "pain-engine:{slug}"` instead.
- **Eight H2 sections, in order:** The Problem, The Solution, Market
  Research, Competitive Landscape, Business Model, Recommended Tech Stack,
  AI Prompts to Build This, Sources.
- **`**How it works:**` numbered list** under The Solution (feeds HowTo JSON-LD).
- **Quotes** inline with links, plus blockquotes with source links.
- **Word target ≥ 2,200 body words** — the deep bar for published engine
  pages (`MIN_DEEP_BODY_WORDS = 2200`, `MIN_BODY_WORDS = 800`,
  `MIN_SOURCE_LINKS = 2` in `scripts/lib/idea-sections.mjs` /
  `scripts/lib/idea-quality.mjs`). The writer aims for it; the review
  record reports the actual count.
- **Manifest row** in the exact `ideas/manifest.json` shape: `slug`, `title`,
  `category` (allowlist), `description`, `buildTime` (allowlist), `revenueGoal`
  (allowlist), `applicationCategory`, `tools` (≥2, allowlist), `audiences`
  (≥2, allowlist), `source: "pain-engine:{slug}"`, `scores` (opportunity /
  pain / timing / builder_confidence, 1–10), `og` (`subject`, `accent`,
  `status: "draft"`), `researchLevel` (`deep` when ≥ 2,200 words, else
  `standard`), `provenance` (`researchCalls`, `citations`, `wordCount`,
  `auditPassed: false`, `publishNotes`, `researchMode: "pain-engine"`),
  `highlights.problemQuote` (≤ 190 chars, only when a real quote exists).
- **Page rendering:** `app/ideas/[slug]/page.tsx` renders the MDX file plus
  the manifest row; `scores` is optional in the render, so a draft with
  scores renders the same as a published page.

## Ideabrowser-inspired additions (8 Nov 2026 — structure only, no copied text)

Sir Rulz had ideabrowser.com studied (its idea-page structure, research and
validation signals). The applicable bits were folded into the writer and the
review queue — its **structure and validation discipline, not its copy**,
and **not** its paywall/gating. The house MDX format stays the primary
output; every element below maps onto the existing eight H2 sections as an
H3 subsection, or onto fields in the review record.

| Ideabrowser element | Adopted as |
|---|---|
| IB Index composite + four score dials (Opportunity / Problem / Feasibility / Why Now, /10 with word labels) | `Scorecard` on the cluster and draft (`lib/pain-engine/cluster.ts` `scorecardForCluster`): composite = cluster total / 10; Opportunity = frequency, Problem = intensity, Feasibility = buildability, Why Now = report recency + workaround spend; labels Strong / Good / Weak / Poor. Rendered as `### Scorecard` under Market Research; reasoning visible in the review record. Manifest `timing` now maps to the Why Now dial. |
| Keyword trend chart (volume + growth %, "data usually lags 1-2 months") + dated market figures | Market Research states the reports' date range and that search-volume data lags 1–2 months; keyword volume/growth and market size are shown only when the evidence contains them — otherwise the draft says so plainly and lists it in `gaps` / "What is NOT proven". No keyword data is invented. |
| Value ladder with real prices (free lead magnet → $500 setup → $79/mo) | `### Value ladder` under Business Model, built ONLY from prices actually written in the evidence (`extractPrices`). When none are found the section says so and the tiers stay labelled proposals to test. |
| "What it demands" (time to first revenue, capital, difficulty) + named status-quo competitor + Biggest Risk | `### What it demands` under Business Model: time to first revenue, capital, difficulty (inverted from buildability) — all labelled planning assumptions — plus the status-quo competitor named in the evidence (`alternative to X` / `switching from X`, else "manual work") and the single biggest risk, picked deterministically from the evidence (unproven willingness to pay / thin evidence / single source / distribution). |
| "What is NOT proven" caveat (e.g. no paid pilot / renewal evidence) | `### What is NOT proven` under Market Research on **every** draft: paid-pilot evidence, keyword volume/growth, market size, competitor pricing, plus breadth and value-ladder gaps when they apply. Each item names the test that would close it. |
| Community Signals counts by platform | `### Community signals` under Sources, and `communitySignals` on the draft: reports + total agreement per source platform. Counts are reports found, not audience sizes. |
| Verdict that CAN be no (BUILD / PIVOT / PASS); Roast = four critics | `Scorecard.verdict`: BUILD (composite ≥ 7, ≥ 3 reports, real quote), PASS (composite < 5, or a single report with no quote), PIVOT otherwise. The verdict and its rationale are in the review record and the draft; a PASS draft still lands in the queue for the human to confirm — the verdict advises, the human decides. The four-critic roast was **not** adopted (no LLM in Phase 1; the reviewer plays that role). |

**Where a new frontmatter / section field would be needed:** if the
published page should *render* the scorecard and verdict (rather than
keeping them in the draft MDX as H3 subsections and in the review record),
the page would need either new frontmatter fields (e.g. `verdict`,
`scorecard: {composite, opportunity, problem, feasibility, whyNow}`) or a
new H2 section (e.g. `## Verdict`) — both would need the page renderer
(`app/ideas/[slug]/page.tsx`) and the manifest shape updated, and the
eight-heading audit contract extended. That is a separate decision, not
part of Phase 1: drafts already carry everything in MDX + review record.

## Evidence rule (hard)

Every fact in a draft traces to a finding. Market stats, competitor pricing
and search demand are **omitted when the evidence does not contain them** —
the omission is listed in the draft's `gaps` for the reviewer. Pricing
tiers, unit economics and year-one math are labelled planning assumptions,
exactly as published engine pages label them. If a required field cannot be
filled from real evidence, the writer leaves it out / flags it rather than
inventing it.

## Cost per published idea (Phase 1)

**$0.00 provider spend.** Every listener API is free and the writer uses no
LLM. The old engine's clean run was ~$0.57/idea (OpenAI extraction ~40%,
editorial ~31%, DataForSEO $0.09, Perplexity ~12%); the Pain Engine replaces
that spend with free listeners + a deterministic writer, and only spends
human review time — one approval per idea.

## Run it

```sh
npm run pain-engine:fixture   # offline E2E: fixture -> cluster -> draft -> queue
npm run pain-engine:run -- --live [--top 3] [--idea-requests-file rows.json]
npm run pain-engine:run -- --list
npm run pain-engine:run -- --approve <slug>
npm run pain-engine:run -- --reject <slug> [--reason "..."]
```

## What is explicitly out of scope

X, Facebook groups, the old engine (`lib/engine/`, `scripts/publish-ideas-batch.mjs`,
`.claude/skills/publish-idea/`, `engine/records/`, `engine/briefs/`), the
Source Critic gate, the E7 release gate, WP75 crew, WP77 Wren, WP78
publishing/leads, WP79 tenant email, WP74 wizard, checkout/credits, and the
Idea 4 widget/panel/Convex files.
