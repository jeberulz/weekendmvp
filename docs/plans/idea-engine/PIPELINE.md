# Idea Engine pipeline (current truth)

Last updated: 2026-11-06. Supersedes the seven-step narrative in `overview.md`
and the pre-WP54 step list still lingering in older phase docs. Contract detail
lives in `pr71-evidence-contract.md`. Skill SOP: `.claude/skills/publish-idea/SKILL.md`.

## Mission

High-quality startup ideas → evidence-bound research → Weekend MVP
`/ideas/{slug}` pages. Refuse thin evidence. Do not mass-generate SEO filler.
Ideabrowser MCP is retired (Phase 9); historical `ideabrowser:*` manifest
sources are provenance only.

## Stages

| # | Stage | Owner | Artifact | Hard gate |
|---|---|---|---|---|
| 0 | Suggest (optional) | Operator / Scout | shortlist | $0 spend; operator pick |
| 1 | Brief | Operator | `engine/briefs/{slug}.json` | paying buyer + public pain + wedge; slug free |
| 2 | Research | `lib/engine/pipeline.ts` via `npm run engine:research -- --live` | `engine/records/{slug}.json` + `.report.json` | ≥2 stats, ≥3 vendors (≥1 priced), ≥2 quotes; $4 cap |
| 3 | Source Critic | Operator / agent + `lib/engine/source-review.ts` | `engine/records/{slug}.source-review.json` | sealed **PASS** bound to record hash |
| 4 | Compile | `npm run engine:compile` | `content/ideas/{slug}.mdx` + `ideas/manifest.json` row | live records require Source Critic PASS; fixture exempt |
| 5 | Tag + deep audit | Operator + `audit:idea` / `validate:idea-tags` | tagged row | deep bar (≥2200 words for engine) |
| 6 | Editorial submit | `npm run editorial:submit-engine` | private candidate | Source Critic PASS + deep audit + structural source-quality |
| 7 | Admin review / release | `/admin/editorial` + E6 worker | public pointer | WP46-E7 triad; currently **NO-GO** |

Legacy bypass (git push + `seed:convex` to the live deployment) can still put
MDX on the public catalogue without editorial. Do not use it for new engine
ideas until E7 GO. Checkout `--prod` targets a paused Convex project — not the
live site (`first-squirrel-244`).

## Source Critic contract (P2)

- Schema: `lib/engine/source-review.ts` (`SOURCE_REVIEW_CONTRACT_VERSION = 1`).
- Required coverage: every used market stat, competitor price, and pricing-
  availability claim, plus at least two used community quotes.
- Each item carries kind-specific boolean checks (excerpt match, topicality,
  comparable SaaS price / niche fit / whole-statement context / availability
  status). PASS requires every applicable check `true`.
- `recordHash` = sha256 of `JSON.stringify(parsedRecord)` (same as editorial).
- `seal` = sha256 of stable JSON of the document without `seal`. Tamper fails.
- Fail-closed: missing, FAIL, stale hash, broken seal, thin coverage, or a
  false check refuses `writeCompiledIdea` and `validateEngineSubmission`.
- Fixture-mode records skip the gate (hermetic `engine:replay` only).

CLI:

```bash
# next to the record by default
npm run engine:compile -- --record engine/records/{slug}.json --source-review engine/records/{slug}.source-review.json

npm run editorial:submit-engine -- --slug={slug} --source-review=engine/records/{slug}.source-review.json
# private tmp/ path: also pass --source-review= with the other private files
```

## Providers (live research only)

| Role | Module | Env |
|---|---|---|
| Synthesis | `lib/engine/providers/openai.ts` | `OPENAI_API_KEY` |
| Search (citations only) | `lib/engine/providers/perplexity.ts` | `PERPLEXITY_API_KEY` |
| Keywords | `lib/engine/providers/keywordData.ts` | DataForSEO login + password env vars |
| Page text | `lib/engine/providers/sourceText.ts` | optional `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` |

## Hermetic checks

- `npm run engine:replay` — fixture research → compile → deep audit (empty env).
- `npm run test:engine` — includes `lib/engine/source-review.test.ts`.
- `npm run check:ideabrowser-runtime` — no `mcp__ideabrowser` in skills/agent docs.

## What this doc is not

- Not a replace for `ideas/SECTIONS.md` (MDX shape) or `wp46-e7-gate.md` (release GO).
- Not authorization to publish, seed production, or flip `EDITORIAL_RELEASE_ENABLED`.
