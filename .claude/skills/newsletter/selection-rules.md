# Newsletter Selection Rules

How the `/newsletter` skill picks what to feature in each slot. Keep this deterministic so swaps are predictable.

---

## AM — Idea of the Day

**Goal:** surface a timely trend from Ideabrowser, paired with an owned idea page. Drive SEO traffic back to weekendmvp.app while feeling fresh.

### Inputs
- `trends` = `mcp__ideabrowser__browse_platform_trends({ limit: 8 })`
- `mcp_ideas` = `mcp__ideabrowser__browse_ideas({ sortBy: "newest", limit: 10 })`
- `owned` = `ideas/manifest.json` entries with a `summary` field
- `recent` = slugs featured in any `content/newsletter/YYYY-MM-DD-*.md` in the last 14 days

### Scoring
For each `(trend|mcp_idea, owned_idea)` pair, compute:

1. **Category match** (+3): trend/idea category string overlaps (case-insensitive) with `owned.category` or `owned.applicationCategory`.
2. **Audience match** (+2): any trend audience overlaps with `owned.audiences`.
3. **Tool match** (+1): any tool mentioned in the trend matches `owned.tools`.
4. **Keyword match** (+1 each, cap at +3): `owned.title` words appear in the trend title/summary.
5. **Freshness penalty** (-5): `owned.slug ∈ recent`.
6. **Staleness penalty** (-2): `owned.publishedAt` older than 180 days (prefer fresher pages when tied).

Pick the highest-scoring pair. Tie → earliest `publishedAt` first (favor evergreen that's built).

### Fallback
If no owned pair scores ≥4, skip MCP and use the freshest unrecent `owned` entry in the most-read category (`saas` / `productivity` / `ai-tools`), pairing it with a generic hook from its `summary`.

### Hook copy
Take the trend's 2-3 most interesting sentences (stats, market shift, pain point), rephrase in the skill's voice, ≤60 words. Do not copy verbatim.

### CTA
`https://weekendmvp.app/ideas/{owned.slug}.html?utm_source=beehiiv&utm_medium=newsletter&utm_campaign=am-{YYYYMMDD}`

---

## PM — Builder Brief

**Goal:** one substantial build-focused email. Rotates through a fixed schedule so subscribers know what to expect.

| Day of week | Shape                                      | Picker                                                                                                                        |
| ----------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Monday      | Owned article link                         | Newest `articles/markdown/*.md` not linked in the last 30 days.                                                                |
| Tuesday     | Tool spotlight                             | Rotate through `["cursor","claude","bolt","v0","lovable","replit","windsurf"]`; pick one + oldest-featured tool gets priority. |
| Wednesday   | Evergreen idea deep dive                   | Idea not featured in last 60 days; prefer `revenueGoal: "1k-month"` for readability.                                          |
| Thursday    | Behind-the-build (tech stack + AI prompts) | Same as Wed's pick if the page has a strong "Tech Stack" + "Build Prompts" section; else next-best.                           |
| Friday      | Weekly recap                               | Aggregate `content/newsletter/YYYY-MM-DD-am.md` for Mon–Thu of this ISO week.                                                 |

### PM MCP flavor (optional, per day)
- Mon / Wed: `research_market_insight` for one fresh stat.
- Tue: `get_trend` for the selected tool's adoption curve or current buzz.
- Thu: skip MCP; use the idea page's own content.
- Fri: skip MCP; the recap is self-contained.

### CTA
Different per shape:
- Mon: `{SITE}/articles/{slug}.html?…&utm_campaign=pm-{YYYYMMDD}`
- Tue: `{SITE}/startup-ideas.html?tool={slug}&…&utm_campaign=pm-{YYYYMMDD}`
- Wed/Thu: `{SITE}/ideas/{slug}.html?…&utm_campaign=pm-{YYYYMMDD}`
- Fri: `{SITE}/startup-ideas.html?…&utm_campaign=pm-{YYYYMMDD}` (plus inline links per recap item)

---

## Ad opportunity matching

Ads are handled manually in the Beehiiv dashboard — the skill does not insert ad blocks (we're not on Enterprise, so we can't post via API at all). When drafting, surface a reminder: "Check Beehiiv → Monetize → Ad Network for active opportunities; place them in the post editor between payload and CTA." The skill does not need a local ledger.

---

## Tie-breakers (deterministic)

Whenever two candidates have equal scores, use in order:
1. Earlier `publishedAt` (prefer established owned content).
2. Lexicographic slug (stable, predictable).

---

## Invariants

- The AM pick must be an entry in `ideas/manifest.json` (not an MCP-only idea). Fresh hook, owned payload.
- Never pick a slug appearing in `recent` (last 14 days of drafts) unless the user overrides with `swap am` repeatedly until that's the only option — then warn.
- Never feature the same slug AM and PM on the same day.
