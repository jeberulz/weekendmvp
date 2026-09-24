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

## Measurable gates (every engine page)

Enforced by `npm run audit:idea -- --slug {slug}` on every page whose manifest
`source` is `engine:*` and on `engine-draft-*` spot checks in `engine/drafts/`.
The research record is found at `engine/records/{slug}.json` (or `--record`).

1. **No stock filler** — denylist of padParagraphs boilerplate and operator notes fails.
2. **No repetition** — near-duplicate paragraphs (Jaccard ≥0.82) and any ≥8-word sentence repeated on the page or shared with another engine page fail. Link titles are not prose and are ignored.
3. **No broken links** — a `](http` without its `[`, or a bare URL tail line, fails.
4. **Named How-it-works** — `1. **Title** — …` and Title ≠ `Step N`.
5. **Four AI prompts with real content** — Setup ≥60 words with ≥3 idea-specific tables (not the generic workspaces/documents/jobs set), Core Feature ≥70, Landing ≥40, Branding ≥70; Setup tiers match Business Model tiers.
6. **Business Model** — Unit Economics bullets lead with a short figure; **Year-One Math** shows the funnel, a compiler-computed ARR line on a real tier, and the half-close-rate downside.
7. **Niche sizing** — mega SaaS/AI TAM phrases fail. In research, a stat or competitor price whose numbers are not in the search results is dropped.
8. **Competitor URLs** — roundup/best-of/comparison links fail; reused URLs fail.
9. **Verified quotes** — the pipeline fetches each cited thread and marks quotes `verified`. The page needs ≥2 verified quotes; any on-page quote that is unverified or missing from the record fails.
10. **Audience label** — the full brief audience appears at most twice; later mentions use `editorial.audienceShort`.
11. **Word count** — hard floor **2,200**. IB deep reference is 2,300–2,600.

## Not the bar

The three short Mode B / early gold pages (`ai-rfp-response-assistant`, `ai-code-reviewer`, `ai-landing-page-generator-ecommerce` at ~1,080–1,385 words) are **structure** references only. Do not score live packs against their length or voice.
