# Idea page section contract

Every idea page is an MDX body at `content/ideas/{slug}.mdx` plus a metadata
row in `ideas/manifest.json`. The body carries **eight `##` headings**: the
seven required sections below, in order, followed by `## Sources`. Everything
else on the rendered page — `<head>`, JSON-LD, nav, footer, OG tags, sitemap
entry — is produced by `app/ideas/[slug]/page.tsx` and the shared layout. The
publishing skill never writes HTML.

Structure is enforced by `npm run audit:idea`. Depth and truthfulness are the
author's job; no script can check whether a market stat is real.

Reference implementations: `content/ideas/ai-rfp-response-assistant.mdx`,
`content/ideas/ai-landing-page-generator-ecommerce.mdx`.

## The seven required sections

| # | `##` heading | Auditor key | Minimum depth |
|---|--------------|-------------|---------------|
| 1 | The Problem | `problem` | 250+ words, at least one concrete user pain quote or data point |
| 2 | The Solution | `solution` | 250+ words, MVP feature set in specifics, plus the HowTo list below |
| 3 | Market Research | `market` | 200+ words, TAM/SAM figures, market trend, 2+ cited stats |
| 4 | Competitive Landscape | `competitive` | 3+ named competitors with pricing and positioning |
| 5 | Business Model | `business` | Pricing tiers, unit economics, target MRR path |
| 6 | Recommended Tech Stack | `stack` | Named stack (framework, database, hosting), not vague |
| 7 | AI Prompts to Build This | `prompts` | 3+ reusable prompts scoped to a weekend build |

Then `## Sources` — the citation list, with at least two URLs. Markdown links
and bare trailing URLs both count.

The section regexes live in `scripts/lib/idea-sections.mjs` and are shared with
`scripts/extract-idea-bodies.mjs` so the two can never drift.

## Two structures the route parses

- **HowTo schema.** `## The Solution` must contain a `**How it works:**` line
  followed by a numbered list of 3+ steps. `app/ideas/[slug]/page.tsx` turns
  those into `HowTo` JSON-LD. No list, no schema.
- **Competitors.** `## Competitive Landscape` lists competitors as bullets that
  open with a bold name (`- **Name** — …`). The auditor counts those.

## MDX traps

- A bare `<` or `{` in prose is parsed as JSX and 500s the route. Escape them
  as `\<` and `\{`. Inside fenced or inline code they are safe and need no
  escape — that is where `{{merge_tags}}` in AI prompts belong.
- Frontmatter carries `slug` and `title` only, and `slug` must match the
  filename and `^[a-z0-9-]+$`.
- Files beginning with `_` are excluded from the site and from `--all`.

## Enforcement

```
npm run audit:idea -- --slug <slug>    # gate one page before publishing
npm run audit:idea -- --all            # whole corpus, against the debt baseline
npm run audit:idea -- --all --strict   # whole corpus, baseline ignored
npm run engine:eval                    # three gold pages must not regress
```

`npm run audit:idea -- --all` runs in CI alongside `npm run validate:idea-tags`.
A new page that misses a section, the HowTo list, the Sources list, or 800 words
of prose fails the build.

### The debt baseline

`ideas/audit-baseline.json` records the structural debt of pages published
before this auditor existed — 32 pages, mostly missing `## Sources`, some under
the word bar. Each is exempt from exactly the checks named for it, so `--all`
stays a live gate for new work instead of being permanently red and ignored.

The file is generated, never hand-edited:

```
npm run audit:idea -- --all --write-baseline
```

Fix a legacy page and re-record to shrink the list. Never add a new page to it —
a new page that cannot pass `--strict` is not ready to publish.

`ideas/_audit.json` is a 2026-06-09 fossil from the retired HTML auditor and is
not read by anything.
