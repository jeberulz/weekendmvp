# Idea page section contract

Every `ideas/<slug>.html` page published from the `publish-idea` skill must render all seven required H2 sections **in this order** and meet the depth targets below. The auditor at `scripts/audit-ideas.js` enforces the structural checks; the human (or the skill) is responsible for content depth.

Reference implementations: `ideas/brakes-maintenance-tracker-app.html`, `ideas/ai-rfp-response-assistant.html`, `ideas/ai-landing-page-generator-ecommerce.html`.

## The seven required sections

| # | H2 title (exact or near-match) | Auditor regex key | Minimum depth |
|---|--------------------------------|-------------------|---------------|
| 1 | The Problem | `problem` | 250+ words, at least one concrete user pain quote or data point |
| 2 | The Solution | `solution` | 250+ words, describes the MVP feature set in specifics |
| 3 | Market Research | `market` | 200+ words, TAM/SAM figures, market size trend, 2+ external citations |
| 4 | Competitive Landscape | `competitive` | 3+ named competitors with pricing and positioning |
| 5 | Business Model | `business` | Pricing tiers, unit economics, target MRR path |
| 6 | Recommended Tech Stack | `stack` | Named stack (framework, database, hosting), not vague |
| 7 | AI Prompts to Build This | `prompts` | 3+ reusable prompts scoped to a weekend build |

Optional but recommended: **Sources** (citation list), **Explore More** (cross-links to related ideas), **Want me to build this for you?** (CTA block).

## Minimum bar (the auditor)

A page is considered `PASS` (`node scripts/audit-ideas.js --strict`) when:

- File size ≥ 15,000 bytes
- Rendered body word count ≥ 800 words
- All seven required H2s present (matched by regex on `<h2>` text)
- No unreplaced placeholders (no `{{VAR}}`, `IDEA_TITLE`, `IDEA_SLUG`, `IDEA_DESCRIPTION`)
- `<meta name="description">` set
- Email gate pattern: `#email-gate` starts hidden, `#gated-content` visible by default (crawler safety per CLAUDE.md SEO rules)

Pages that miss one or more of the first four structural checks are classified `THIN`. Pages under 5 KB or with zero H2s are `STUB`.

## Enforcement

- `node scripts/audit-ideas.js` — reports every page with status + reasons
- `node scripts/audit-ideas.js --apply` — trims STUB pages out of `manifest.json` into `manifest.draft.json`
- `node scripts/audit-ideas.js --strict` — exits non-zero if any idea linked from `manifest.json` fails the full bar. Wire into pre-publish hooks inside the `publish-idea` skill; do not commit a new idea if this fails.

## Phase 4 backfill queue

Pages classified `THIN` in `ideas/_audit.json` have `_needsBackfill: true` in `manifest.json`. Re-publish them via `/publish-idea <idea_id>` (Mode A, Ideabrowser MCP) to bring them up to the bar. Track progress by rerunning the auditor — when THIN count hits zero, tighten `QUARANTINE_STATUSES` in `audit-ideas.js` to `['STUB', 'THIN']`.
