# Idea page section contract (MDX)

Every idea published via the `publish-idea` skill must ship as
`content/ideas/{slug}.mdx` with **all seven required `##` sections in this
order**, plus a required `## Sources` section. Depth targets below are
editorial; the mechanical gate is `npm run audit:idea`.

Reference implementations: `content/ideas/ai-rfp-response-assistant.mdx`,
`content/ideas/ai-code-reviewer.mdx`,
`content/ideas/ai-landing-page-generator-ecommerce.mdx`.

## The seven required sections

| # | H2 title (exact) | Minimum depth |
|---|------------------|---------------|
| 1 | The Problem | 250+ words, at least one concrete user pain quote or data point |
| 2 | The Solution | 250+ words, MVP feature set in specifics; must include `**How it works:**` + a numbered list (feeds HowTo JSON-LD) |
| 3 | Market Research | 200+ words, TAM/SAM or market-size trend, 2+ external citations |
| 4 | Competitive Landscape | 3+ named competitors with pricing and positioning |
| 5 | Business Model | Pricing tiers, unit economics, target MRR path |
| 6 | Recommended Tech Stack | Named stack (framework, database, hosting) |
| 7 | AI Prompts to Build This | 3+ reusable prompts scoped to a weekend build |

Required trailer: **`## Sources`** — markdown links to the citations used above
(≥2 links). Optional extras (`## Explore More`, CTA blocks) are allowed only
*after* Sources and are not scored by the auditor.

## Minimum bar (the auditor)

A page passes `npm run audit:idea -- --slug {slug}` when:

- All seven required `##` headings appear **in order**, followed by `## Sources`
- `## The Solution` contains `**How it works:**` plus a numbered list (≥2 steps)
- `## Sources` has ≥2 markdown links (`[label](https://…)`)
- Body word count ≥ 800
- Slug matches `^[a-z0-9-]+$`
- No `{{` placeholders
- No bare `<` or `{` outside code fences (MDX would parse them as JSX — escape as `\<` / `\{`)

```bash
npm run audit:idea -- --slug ai-rfp-response-assistant
npm run audit:idea -- --all
```

Gold-corpus regression (counts generated from the auditor):

```bash
npm run engine:eval
```

Tagging is a separate gate: `npm run validate:idea-tags` (wired in CI).

## Enforcement

- `npm run audit:idea` — structural MDX contract (this doc)
- `npm run evals:run -- --slug {slug}` — WP41 content quality gate: the
  structural contract plus Layer 0 quality checks (slop phrases, verbosity,
  unsourced numbers, source hygiene, placeholders, duplication). Wired in CI
  as `npm run evals:changed`, which blocks any new or edited idea page that
  fails. Existing pages are report-only; the ranked backlog is
  `evals/results/report.md` (`npm run evals:run -- --all --report`).
- `npm run validate:idea-tags` — WP19 tagging allowlists
- `npm run engine:eval` — gold slug metrics must not regress

Do not commit a new idea that fails these gates.

`ideas/_audit.json` is a 2026-06-09 HTML-era fossil and is not consulted by
these scripts. Leave it alone.

## Shared section spec

Canonical titles and HTML fuzzy matchers live in
`scripts/lib/idea-sections.mjs`, imported by both `scripts/audit-idea-mdx.mjs`
and `scripts/extract-idea-bodies.mjs` so the contracts cannot drift.
