# Mode A2 live spot-check — writing-quality pass

Updated: 2026-09-24 (UTC). Branch: `cursor/mode-a2-live-spotcheck-1826` (PR #70).
**Skill flip HELD** — do not change `/publish-idea` Mode A MCP.

## Benchmark correction

Eval bar is **not** the three short Mode B gold pages (~1,080–1,385 words).

Bar = IB deep page in-repo: `content/ideas/course-translation-resale-network.mdx`
(~2,373 words, named product **Revoice**, zero stock filler). Criteria documented in
`engine/eval/deep-benchmark.md`.

| Gate | Hard / soft |
|---|---|
| Word count | Hard ≥1,800; soft target ≥2,200 (warn under target) |
| Stock filler denylist | Hard fail |
| Near-duplicate paragraphs | Hard fail |
| Named How-it-works (not Step N) | Hard fail |
| 4 AI prompts incl. Branding | Hard fail (deep drafts) |
| Niche sizing (no mega SaaS/AI TAM) | Hard fail (deep drafts) |
| Competitor first-party URLs | Hard fail on roundup links; warn if &lt;3 good links |
| Quote fidelity vs research record | Hard fail when `--record` / auto-resolved |

## Secret gate (N=1)

All four present: `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`.
No DataForSEO 401.

## N=1 live re-run — `ai-rfp-response-assistant`

| | |
|---|---|
| Brief | `engine/briefs/rfp-assistant.json` |
| Record | `engine/records/ai-rfp-response-assistant.json` |
| Draft | `content/ideas/engine-draft-ai-rfp-response-assistant.mdx` |
| Attempts | 1–2 failed provenance (`got 2` competitors after pricing-URL filter); attempt 3 succeeded after hostname fallback + roundup skip |
| **Cost (successful pack)** | **$0.3063** |
| Failed attempts | ~$0.25–0.30 each est. (billed before provenance_parse) — under $4/pack still |
| Product name | **RallyRFP** |
| Words | **3,128** (clears 2,200 target) |
| How-it-works | Knowledge Vault / Document Intake / Evidence Drafting / Review Routing / Native Export |
| Tiers | Starter $199 · Team $499 · Scale $999 with unit rows |
| `audit:idea` | **PASS** (warn: 2 first-party competitor links; QorusDocs lacked pricing URL) |
| `validate:idea-tags` | **PASS** (operator-tagged) |
| Gold MDX | Untouched |

### Side-by-side vs IB deep bar (course-translation)

| Criterion | Revoice (IB deep) | RallyRFP draft (N=1) |
|---|---|---|
| Words | ~2,373 | **3,128** |
| Named product | Revoice | RallyRFP |
| Don't-build | Explicit | Explicit (no broad suite / autonomous agent first) |
| Named steps | Audit/Pilot/Sell/Split | Knowledge Vault…Native Export |
| Tier math | $2,500 + % takes | $199/$499/$999 + unit econ |
| 4 prompts + Branding | Yes | Yes (schema/env in Project Setup) |
| Niche market | LATAM e-learning etc. | Proposal/RFP software $3.26B→$9.19B (not global SaaS $375B+) |
| Competitor URLs | First-party style | Responsive + Loopio `/pricing`; QorusDocs roundup dropped from link |
| Filler | None | None (padParagraphs removed) |
| Quotes | Specific | Verbatim from record (fidelity check PASS) |

### Remaining gaps (honest)

1. **Third first-party competitor pricing URL** still weak (QorusDocs came through a comparison page — link suppressed; warn remains).
2. **N=3** (code-reviewer + LP generator) should wait until John likes N=1 voice — old drafts still on disk from prior spot-check and will fail new gates until regenerated.
3. Compiler still operator-tags `category`/`tools`/`audiences` after compile.
4. Skill flip / phases 7–9 still **HELD**.

## Code changes in this pass

- `lib/engine/compile.ts` — kill `padParagraphs`; named product/steps/tiers; 4 prompts; roundup URL hygiene; double-period collapse.
- `lib/engine/pipeline.ts` — niche market search; verbatim quotes; editorial JSON; competitor hostname fallback; reject roundup binds.
- `scripts/lib/idea-quality.mjs` + `scripts/audit-idea-mdx.mjs` — fail-closed writing gates.
- `engine/eval/deep-benchmark.md` — IB deep criteria.
