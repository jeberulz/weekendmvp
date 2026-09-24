# IB deep writing bar (Mode A2)

Reference page in-repo: [`content/ideas/course-translation-resale-network.mdx`](../../content/ideas/course-translation-resale-network.mdx)

| Signal | Value |
|---|---|
| Source | `ideabrowser:9334` (`researchLevel: deep`) |
| Words | ~2,373 |
| Named product | **Revoice** (not "an AI tool") |
| How-it-works | Named steps: Audit / Pilot / Sell / Split |
| Don't-build | Explicit: no marketplace until pilots prove; no dubbing company |
| Prompts | 4 including **Branding Package**; Project Setup carries schema + Stripe + env |
| Market | Niche (LATAM e-learning, AI dub $/min) — mega e-learning TAM only as context |
| Competitors | Named with prices; opportunity names the leftover job |
| Quotes / specifics | Concrete people, dates, $ figures |

## Measurable gates (engine drafts)

Enforced by `npm run audit:idea -- --slug engine-draft-*` (+ optional `--record`):

1. **No stock filler** — denylist of padParagraphs boilerplate fails.
2. **No near-duplicate paragraphs** — Jaccard ≥0.82 on prose paragraphs fails.
3. **Named How-it-works** — `1. **Title** — …` and Title ≠ `Step N`.
4. **Four AI prompts incl. Branding**; Project Setup ≥60 words (schema/pricing/env).
5. **Niche sizing** — mega SaaS/AI TAM phrases fail on deep drafts.
6. **Competitor URLs** — roundup/best-of/comparison links fail; reused URLs fail.
7. **Quote fidelity** — each research-record quote must appear verbatim in MDX.
8. **Word count** — hard floor **1,800**; soft target **2,200** (warn under target). IB deep reference is 2,300–2,600.

## Not the bar

The three short Mode B / early gold pages (`ai-rfp-response-assistant`, `ai-code-reviewer`, `ai-landing-page-generator-ecommerce` at ~1,080–1,385 words) are **structure** references only. Do not score live packs against their length or voice.
