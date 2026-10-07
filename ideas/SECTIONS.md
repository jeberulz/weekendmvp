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
| 7 | AI Prompts to Build This | Exactly four prompts that meet the weekend prompt standard below |

Required trailer: **`## Sources`** — markdown links to the citations used above
(≥2 links). Optional extras (`## Explore More`, CTA blocks) are allowed only
*after* Sources and are not scored by the auditor.

## Weekend prompt standard v1

Section 7 holds exactly four prompts, in this order, each as a bold
`**N. Title**` line above one ```` ```text ```` fence: **Project Setup**,
**Core Feature**, **Landing Page**, **Branding Package**. A prompt is something a
coding agent can run in a weekend, so it is structured, scoped and checkable.
The lint is `npm run audit:prompts` (`scripts/lib/prompt-standard.mjs`).

Every prompt:

- ends with a `Done when:` line, a check you can run or see
- does not pin a Next.js major version (write "Next.js", not "Next.js 15")
- holds no code fence, which would end its block early

**Project Setup** (8+ lines, one idea per line):

- opens with one line naming the product and the one thing it does
- `Stack:` line with the framework, database, one login and hosting
- one login path only. Use Supabase Auth, so row rules work. Never pair Clerk with Supabase
- at most three outside services (Supabase counts as one, hosting does not count)
- 3+ tables as `- name(column, column)` lines, each with a one-line purpose where it helps
- `Screens:` line, three at most
- `Env vars (names only):` line
- **no billing**: no Stripe, plans, tiers, subscriptions or checkout
- one-line `Do not build:` fence naming what is left out. It may name billing,
  teams, an admin area or a second provider, and it does not count as using them
- `Done when:` names something checkable, such as sign-in works and the tables exist

**Core Feature**: the one feature that proves the idea, as numbered lines, with
the input and output shape, an empty state, and `Done when:`. Payments are fine
here only when taking payment is the product's own function.

**Landing Page**: copy skeleton and sections, a waitlist stored in a table of
your own (no extra service), voice, and `Done when:`.

**Branding Package**: the first line says to use a design or image tool ("Use a
design or image tool for this one. A coding agent cannot draw a logo."), then
wordmark, colors, deliverables and `Done when:`.

### Rollout (ratchet)

`ideas/prompt-standard.json` lists the slugs that already meet the standard. Each
must keep passing: `npm run audit:idea` fails an idea on that list and only warns
for the rest, and `tests/prompts` lints every listed idea. WP61 moves the legacy
`ideabrowser` ideas onto the list wave by wave. A Project Setup that never
mentions billing owes no Business Model tier names (the old tier-in-setup rule
now applies only when the Setup mentions billing).

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
- `npm run audit:prompts` — weekend prompt standard v1 (this doc)
- `npm run validate:idea-tags` — WP19 tagging allowlists
- `npm run engine:eval` — gold slug metrics must not regress

Wire `audit:idea` into the publish skill's pre-seed checklist. Do not commit a
new idea that fails this gate.

`ideas/_audit.json` is a 2026-06-09 HTML-era fossil and is not consulted by
these scripts. Leave it alone.

## Shared section spec

Canonical titles and HTML fuzzy matchers live in
`scripts/lib/idea-sections.mjs`, imported by both `scripts/audit-idea-mdx.mjs`
and `scripts/extract-idea-bodies.mjs` so the contracts cannot drift.
