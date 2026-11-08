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
2. **Cluster.** Near-duplicate pains are grouped by token overlap (Jaccard
   ≥ 0.25, deterministic, no LLM).
3. **Score.** Each cluster scores 0–100 on frequency (×4), pain intensity
   (×3), workaround spend (×2) and weekend-buildability (×1).
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
