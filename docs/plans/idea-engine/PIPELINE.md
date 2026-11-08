# Idea Engine pipeline (current truth)

Last updated: 2026-11-06. Supersedes the seven-step narrative in `overview.md`
and the pre-WP54 step list still lingering in older phase docs. Contract detail
lives in `pr71-evidence-contract.md`. Skill SOP: `.claude/skills/publish-idea/SKILL.md`.

## Mission

High-quality startup ideas → evidence-bound research → Weekend MVP
`/ideas/{slug}` pages. Refuse thin evidence. Do not mass-generate SEO filler.
Ideabrowser MCP is retired (Phase 9); historical `ideabrowser:*` manifest
sources are provenance only.

## Runtime (permanent)

Idea Engine CLIs import TypeScript via `node --experimental-strip-types`.
That flag exists only on **Node >= 22.6** (CI uses `22.x`; `.nvmrc` pins `22`).

| Host Node | Result |
|---|---|
| 22.6+ / 24.x with strip-types | supported |
| 20.x (common `/usr/bin/node` on some agent VMs) | **unsupported** — Node exits 9 (`bad option: --experimental-strip-types`) |

Portable entrypoints resolve a valid binary first (or exit **3** with install
steps). They do not polyfill Node 20 and do not mask the failure:

```bash
bash scripts/engine-replay.sh --work-root /tmp/wmvp-engine-replay
# or
npm run engine:replay -- --work-root /tmp/wmvp-engine-replay
npm run engine:research -- --brief … --live
```

Override: `export ENGINE_NODE=/path/to/node-22.6+-or-24`. Owner setup when
only Node 20 is present: `nvm install && nvm use` (reads `.nvmrc`), then re-run
the strip-types probe: `node --experimental-strip-types -e 'console.log("ok")'`.

## Stages

| # | Stage | Owner | Artifact | Hard gate |
|---|---|---|---|---|
| 0 | Suggest (optional) | Scout + Corpus Guardian | shortlist | $0 spend; **semantic dedupe** (customer / JTBD / workflow / mechanism) vs corpus; then operator pick |
| 1 | Brief | Operator | `engine/briefs/{slug}.json` | paying buyer + public pain + wedge; slug free; dedupe still holds |
| 2 | Research | `lib/engine/pipeline.ts` via `npm run engine:research -- --live` | `engine/records/{slug}.json` + `.report.json` | market stats optional (use when verified; omit TAM/growth/revenue when none); ≥3 vendors (≥1 priced), ≥2 quotes; $4 cap; `provenance.evidencePolicy: buyer-first-v1` |
| 3 | Source Critic | Operator / agent + `lib/engine/source-review.ts` | `engine/records/{slug}.source-review.json` | sealed **PASS** bound to record hash |
| 4 | Compile | `npm run engine:compile` | `content/ideas/{slug}.mdx` + `ideas/manifest.json` row | live records require Source Critic PASS; fixture exempt |
| 5 | Tag + deep audit | Operator + `audit:idea` / `validate:idea-tags` | tagged row | deep bar (≥2200 words for engine) |
| 6 | Editorial submit | `npm run editorial:submit-engine` | private candidate | Source Critic PASS + deep audit + structural source-quality |
| 7 | Admin review / release | `/admin/editorial` + E6 worker | public pointer | WP46-E7 triad; currently **NO-GO** |

### Semantic dedupe before spend (permanent)

Scout + Corpus Guardian must refuse a candidate that overlaps an existing idea
on **customer + JTBD + workflow + mechanism** (not slug alone) before any
`engine:research --live` call. `npm run publish:ideas -- --live` requires
`--confirm-semantic-dedupe` after that $0 check. Drop overlaps; do not spend to
rediscover them.

### Provider failure map (do not invent failover)

| Condition | Behavior |
|---|---|
| Missing `OPENAI_API_KEY` / Perplexity / DataForSEO | `ProviderConfigError`, non-retryable, $0 |
| OpenAI / Perplexity / DataForSEO **429** or 5xx | `ProviderCallError` retryable; one automatic retry; unbilled if pre-2xx → can show **$0** at `brief_normalization` |
| Other 4xx | non-retryable |
| Cross-provider synthesis swap | **not implemented** — Claude/Codex/Grok hosts call these CLIs; OpenAI remains synthesis per RULINGS |

### SEO / AEO Search Console

`gsc:submit-sitemap` / `gsc:inspect-indexing` are **post-publish indexing**
only. Candidate selection uses manifest category coverage + Step 0 evidence
fetches. There is **no** GSC impressions/queries feed into Scout — report
missing rather than inventing demand data.

Crew seeds (WP92): no publish step seeds the crew. Once an idea page is live on
`main`, the `Crew seeds` workflow writes its per-idea crew seed after the next
Production deploy, if the owner has switched it on. See
`docs/plans/launch-workspace/10-seed-freshness.md`.

Legacy bypass (git push + `seed:convex` to the live deployment) can still put
MDX on the public catalogue without editorial. Do not use it for new engine
ideas until E7 GO. Checkout `--prod` targets a paused Convex project — not the
live site (`first-squirrel-244`).

## Source Critic contract (P2)

- Schema: `lib/engine/source-review.ts` (`SOURCE_REVIEW_CONTRACT_VERSION = 1`).
- Required coverage: every **used** market stat (none required when
  `market.statIds` is empty), competitor price, and pricing-availability
  claim, plus at least two used community quotes.
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

- `bash scripts/engine-replay.sh --work-root DIR` / `npm run engine:replay` —
  fixture research → compile → deep audit (empty env); writes
  `engine-replay-complete` on PASS.
- `npm run test:engine` — includes `lib/engine/source-review.test.ts` and
  `resolve-engine-node` version gates.
- `npm run check:ideabrowser-runtime` — no `mcp__ideabrowser` in skills/agent docs.

## What this doc is not

- Not a replace for `ideas/SECTIONS.md` (MDX shape) or `wp46-e7-gate.md` (release GO).
- Not authorization to publish, seed production, or flip `EDITORIAL_RELEASE_ENABLED`.
