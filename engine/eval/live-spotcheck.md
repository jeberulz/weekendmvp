# Mode A2 live spot-check — 3 gold briefs

Ran: 2026-09-24 (UTC). Branch: `cursor/mode-a2-live-spotcheck-1826`.
Pipeline: `engine:research --live` → `engine:compile --slug engine-draft-*`.
Providers: OpenAI `gpt-5.6-sol`, Perplexity `sonar-pro`, DataForSEO keyword volume (live).
Cost cap: ≤$4.00/pack. Retries: none observed (each pack = 6 provider calls, all succeeded).

## Secret gate

All four required secrets present at boot (values never logged):
`OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`.
DataForSEO returned keyword rows (no HTTP 401).

## Per-pack cost (provenance.costUsd)

| Brief | Record | Cost USD | Under $4? | Retries |
|---|---|---:|:---:|---|
| `ai-rfp-response-assistant` | `engine/records/ai-rfp-response-assistant.json` | **0.2478** | yes | none |
| `ai-code-reviewer` | `engine/records/ai-code-reviewer.json` | **0.2592** | yes | none |
| `ai-landing-page-generator-ecommerce` | `engine/records/ai-landing-page-generator-ecommerce.json` | **0.2658** | yes | none |

Total spend ≈ **$0.77**. Reference budget in pricing.ts is ~$0.52/clean run; these live packs landed ~half of that.

## Draft outputs (gold MDX untouched)

| Gold slug | Draft MDX | Manifest source |
|---|---|---|
| `ai-rfp-response-assistant` | `content/ideas/engine-draft-ai-rfp-response-assistant.mdx` | `engine:engine-draft-ai-rfp-response-assistant` |
| `ai-code-reviewer` | `content/ideas/engine-draft-ai-code-reviewer.mdx` | `engine:engine-draft-ai-code-reviewer` |
| `ai-landing-page-generator-ecommerce` | `content/ideas/engine-draft-ai-landing-page-generator-ecommerce.mdx` | `engine:engine-draft-ai-landing-page-generator-ecommerce` |

`audit:idea` PASS on all three drafts. `validate:idea-tags` PASS after operator tagging (compiler still leaves category/tools/audiences empty by design — see compile `publishNotes`).

## Side-by-side: structure

Gold metrics from `engine/eval/gold.json`. Draft metrics from `audit:idea`.

| Metric | RFP gold | RFP draft | Code gold | Code draft | LP gold | LP draft |
|---|---:|---:|---:|---:|---:|---:|
| Word count | 1324 | 2092 | 1080 | 2086 | 1385 | 2217 |
| Competitor mentions (auditor) | 4 | 5 | 4 | 4 | 4 | 5 |
| Source links | 4 | 10 | 4 | 13 | 5 | 14 |
| HowTo steps | 4 | 5 | 3 | 5 | 4 | 5 |
| Canonical 8 `##` sections | yes | yes | yes | yes | yes | yes |

Notes:
- Drafts are longer and citation-heavier than gold (Perplexity-backed Sources). That is expected for a live research pack vs. curated gold pages.
- Section order matches `ideas/SECTIONS.md` / skill contract on all three drafts.
- Compiler default `og.accent: "blue"` is not a brand accent; drafts were patched to `lime` / `mint` / `lavender` for this spot-check. Worth a follow-up so compile emits an allowlisted accent.

## Side-by-side: competitors (named)

| Pack | Gold competitors (published) | Live record competitors |
|---|---|---|
| RFP | Loopio, Responsive (ex-RFPIO), Qvidian, DIY stack | AutoRFP.ai, Inventive AI, 1up, DeepRFP, Loopio |
| Code review | CodeRabbit, Greptile, Copilot Code Review, Sourcery/Codium | CodeRabbit, Qodo, Bito, Copilot Code Review |
| LP / ecommerce | HubSpot, Unbounce, SiteKick, GetResponse | PagePilot, Instant AI Page Builder, Swipe Pages, AI Page Builder…, Frontend AI |

Overlap exists (Loopio, CodeRabbit, Copilot) but live packs often surface newer/niche tools than the gold pages. Pricing strings are present on every live competitor row (pipeline gate). Quality judgment for “right” competitor set is deferred to John — this note only records what live mode returned.

## Keyword honesty (fail-closed path)

All keyword rows in the three records carry `source: "provider"`. Volumes used in draft MDX match DataForSEO rows (spot-checked term + volume string present in MDX). No invented CPC/volume when the provider answered.

| Pack | Seed keywords | Provider rows returned | Sample (term → volume / CPC) |
|---|---|---:|---|
| RFP | 3 | 3 | `rfp response software` → 90 / $45.60; `proposal management software` → 320 / $62.79 |
| Code review | 3 | 2 | `ai code review` → 1300 / $55.73; `github pr review bot` → 10 / $18.42 (third seed dropped by provider — not invented) |
| LP | 3 | 1 | `ai landing page builder` → 480 / $27.29 (other seeds returned no usable row — not invented) |

## Gates held (explicit)

- `/publish-idea` still Mode A MCP — **not flipped** (phase 7 held).
- Newsletter MCP (phase 8) / MCP retire (phase 9) — **not touched**.
- Gold files `content/ideas/ai-{rfp-response-assistant,code-reviewer,landing-page-generator-ecommerce}.mdx` — **not overwritten**.

## Operator follow-ups (not blocking this PR)

1. Compiler should accept/emit allowlisted `category` / `tools[]` / `audiences[]` / `og.accent` so spot-check drafts do not need a manual manifest patch for tagging green.
2. Live competitor sets diverge from gold — decide whether gold should stay as editorial targets or be refreshed from engine packs after sign-off.
3. Phase 7 skill flip waits on John sign-off after reviewing this spot-check.
