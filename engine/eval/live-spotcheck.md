# Mode A2 live spot-check — Round 3

> **Round 4 status (compiler + auditor fixes, no live re-run yet).** Drafts
> moved to `engine/drafts/` and are blocked from the site. They were
> re-compiled from the Round 3 records with the fixed compiler (no broken
> links, no audience-prefix templates). They now **fail** the deep audit on
> purpose: the Round 3 records predate quote verification, `yearOne`,
> `dataModel`, and number-first unit economics. Re-run
> `engine:research --live` for all three briefs to clear them.

Updated: 2026-09-24 (UTC). Branch: `cursor/mode-a2-live-spotcheck-1826` (PR #70).
**Skill flip HELD** — do not change `/publish-idea` Mode A MCP. Phase 7–9 HELD.

## Benchmark

Bar = IB deep page: `content/ideas/course-translation-resale-network.mdx` (~2,373 words).
Eval criteria: `engine/eval/deep-benchmark.md` + Round 3 gates below.

| Gate | Round 3 |
|---|---|
| Word count | **Hard ≥2,200** (no soft gap) |
| Stock filler + Round-3 padding denylist | Hard fail |
| Near-duplicate paragraphs | Hard fail |
| **Duplicate ≥8-word sentences (in-page)** | **Hard fail** |
| **Same ≥8-word sentence across engine-draft-\*** | **Hard fail** |
| Named How-it-works (not Step N) | Hard fail |
| 4 AI prompts incl. Branding | Hard fail |
| Business Model tiers ↔ Project Setup | Hard fail (one canonical set) |
| Niche sizing (no mega SaaS/AI TAM) | Hard fail |
| Competitor first-party URLs | Hard fail on roundups; warn if &lt;3 links |
| Quote fidelity vs research record | Hard fail when record present |
| Operator/meta prose in MDX | Hard fail |
| Lowercased audience (`smb saas`) | Hard fail — use SMB SaaS |

## Secret gate (Round 3)

All four **PRESENT**: `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`.

## N=3 live re-run (Round 3 compiler)

| Pack | Draft | Product | Words | Cost USD | Audit |
|---|---|---|---|---|---|
| RFP | `engine-draft-ai-rfp-response-assistant` | **BidRelay** | 2905 | **$0.3473** | PASS (warn: 2/3 first-party competitor links) |
| Code reviewer | `engine-draft-ai-code-reviewer` | **DiffBeacon** | 3010 | **$0.3341** | PASS |
| Landing (ecom) | `engine-draft-ai-landing-page-generator-ecommerce` | **ClickWeave** | 3240 | **$0.3439** | PASS |

All packs **≤$4**. Tiers: **Starter / Team / Scale** on every page (Business Model + Setup prompts). Cross-idea 8+ word sentence dups: **0**.

### vs deep bar (N=3)

| | Deep bar (Revoice / course-translation) | Round 3 N=3 |
|---|---|---|
| Words | ~2,373 | 2,905–3,240 |
| Named product | Revoice | BidRelay / DiffBeacon / ClickWeave (idea-specific) |
| Stock filler | none | none (padding templates removed from `compile.ts`) |
| Sentence dedupe | n/a historically | in-page + cross-idea enforced |
| Competitor pricing URLs | strong first-party | soft gap on RFP (2 linked; 1 roundup suppressed) |

## Compiler / auditor changes (Round 3)

- `lib/engine/compile.ts` — kill hardcoded cross-idea padding; idea-specific stack/prompts/tiers; collapse in-page duplicate sentences; suppress `/blog-posts/` + `/top-` roundups; preserve audience casing.
- `lib/engine/pipeline.ts` — richer editorial (300–420w problem, competitiveNarrative, Starter/Team/Scale); prefer seed audience casing; broader roundup URL filter.
- `scripts/lib/idea-quality.mjs` + `scripts/audit-idea-mdx.mjs` — hard 2200; sentence + cross-idea dedupe; tier match; Round-3 denylist; operator-note denylist; lowercase-audience hygiene.

## Remaining gaps (do not block Round 3 PASS)

1. RFP competitor strip: Proposify came back on a roundup URL → link suppressed (2 first-party links). Prefer vendor pricing pages when research supplies them.
2. N=3 clears the writing bar mechanically; still not a human editorial polish pass vs Revoice prose density.
3. **Skill flip HELD** until owner says otherwise.

## Overwrite policy

Only `engine/drafts/engine-draft-*.mdx` (+ `engine/drafts/manifest.json`) and `engine/records/*.json`. Published gold MDX untouched.
