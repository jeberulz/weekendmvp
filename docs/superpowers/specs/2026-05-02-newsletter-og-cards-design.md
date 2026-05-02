# Newsletter OG Cards — Design Spec

**Date:** 2026-05-02
**Author:** Brainstorming session (Claude Opus 4.7 + jeberulz)
**Status:** Approved for planning
**Builds on:**
- `docs/superpowers/specs/2026-05-02-recraft-og-image-pipeline-design.md` (v1 idea pipeline)
- `docs/superpowers/specs/2026-05-02-article-og-cards-design.md` (Surface A — established the per-template config pattern)

## Problem

The 10 published newsletters at `newsletter/{date}-{am|pm}.html` all share one site-wide social card (`image/og-image.png`). Beehiiv subscribers receive the email directly, but when someone shares a newsletter URL on social media, the generic logo card appears. The newsletter is twice-daily — over time this is the highest-volume surface, so per-page cards compound the SEO/CTR win.

## Non-goals

- Generating an OG card for the archive index page (`newsletter.html`) — single one-off, low ROI to template; stays on the site-wide fallback for now (follow-up if needed).
- Inline newsletter email illustrations (Surface C — different consumption context, separate spec).
- Carousel slide-1 hero (Surface D — different aspect ratio).

## Decisions reached during brainstorming

| # | Question | Decision |
|---|---|---|
| Q1 | Visual layout direction | **C — postal/email metaphor + AM/PM accent rule** (mint=AM, lavender=PM) |
| Q2 | Postal layout refinement | **A — postcard horizontal split** (top 60% Recraft scene + postmark circle, bottom 40% solid panel with typography) |
| Q3 | Subject library | **Daily-ritual objects** (coffee mug, kettle, alarm clock, reading lamp, evening tea, journal) — same dark + accent atmosphere as ideas/articles |

## Architecture

A new `newsletter` surface added to the existing pipeline. Reuses everything established in v1 + Surface A:
- Same Recraft v3 + `gpt-image-1` fallback
- Same sharp + Satori 2-pass composite
- Same per-template `config` shape (canvas + bgRect + bgFill)
- Same multi-surface orchestrator

The newsletter template introduces a **horizontal split** layout (top 60% Recraft, bottom 40% solid panel) — distinct from ideas (full-bleed) and articles (vertical split, left-panel typography). The compose module needs no changes; it already reads each template's `config`.

```
lib/og/templates/newsletter.mjs    → buildElement + config (top 60% bgRect)
lib/og/sources/newsletter.mjs      → listNewsletter() with AM/PM accent auto-derivation
newsletter/manifest.json           → 10 backfilled entries
```

## Layout (1200×630)

```
┌────────────────────────────────────────────────┐
│                                  ┌──────────┐  │  ← top 60% (378px):
│                                  │   AM     │  │    Recraft scene
│       Recraft scene              │ MAY·01·26│  │    + postmark circle
│       (daily-ritual object)      └──────────┘  │    in top-right corner
│                                                │
│                                                │
├────────────────────────────────────────────────┤
│ [WMV]  FROM: WEEKEND MVP                       │  ← bottom 40% (252px):
│        2026·05·01 · AM EDITION   {Title —      │    solid #050505 panel
│                                   Geist Bold,  │
│                                   autoshrink}  │
│ ════════ accent bar 4px (mint or lavender) ════│
└────────────────────────────────────────────────┘
```

### Per-template config

```js
export const config = {
  width: 1200,
  height: 630,
  bgRect: { x: 0, y: 0, width: 1200, height: 378 }, // top 60% horizontal slice
  bgFill: '#050505'                                  // bottom 40% panel fill
};
```

Compose places the resized Recraft buffer at `(0, 0)` filling the top 378px; the bottom 252px is solid `#050505`. Satori chrome covers the full 1200×630 frame so the postmark, typography, and accent bar can all sit on top.

### Postmark circle (top-right)

- Position: `top: 56, right: 56` (matches panel padding)
- Outer ring: 120px diameter, 2px solid `accentHex`
- Inner ring: 90px diameter, 1px solid `accentHex` (creates the stamped look)
- Center text: "AM" or "PM" in Geist Mono Bold 36px, color `accentHex`
- Below center text: date in format `MAY · 01 · 26` in Geist Mono Regular 10px, color `accentHex`, letter-spacing 1.5

### Bottom panel typography (56px padding)

Single row, two columns:
- **Left column (~400px wide):** WMV mark (28px tall, white) stacked above 2-line meta in Geist Mono 13px:
  - Line 1: `FROM: WEEKEND MVP`
  - Line 2: `2026·05·01 · AM EDITION` (or `PM EDITION`), color `accentHex`
- **Right column (rest of width):** title in Geist Bold, autoshrunk by length:
  - ≤ 30 chars → 60px
  - ≤ 70 chars → 48px
  - else → 40px
- **Bottom:** 4px accent bar, full width, `accentHex`

### AM/PM accent rule (auto-derived)

The source module extracts `am` or `pm` from the slug suffix and sets the accent automatically. The manifest can omit `og.accent` for newsletters — it falls out of the slug. (Manifest can still override if a one-off needs it.)

```js
function deriveAccent(slug) {
  if (slug.endsWith('-am')) return 'mint';
  if (slug.endsWith('-pm')) return 'lavender';
  return 'lime'; // fallback, shouldn't hit for valid newsletter slugs
}
```

The accent in the *card chrome* (postmark, label color, accent bar) is auto-derived. The accent in the *Recraft scene* (per-newsletter `og.subject`) should match — author chooses mint-glow phrasing for AM newsletters and lavender-glow phrasing for PM ones.

## Brand consistency — Recraft subjects

Same `STYLE_BLUEPRINT` text anchor and `RECRAFT_STYLE_ID`. Subjects shift to **daily-ritual objects** that respect the dark + late-night/early-morning atmosphere:

**AM subjects** (mint-glow):
- "A coffee mug on a near-black counter with a single mint LED clock glow catching the rim, very early morning"
- "A kettle on a dark stovetop, single mint flame visible at the base, deep shadow surrounding"
- "A breakfast bowl on a near-black surface, single mint light from a phone screen catching the spoon"
- "An alarm clock on a bedside table with a mint LED display lit, the rest of the room in deep shadow"

**PM subjects** (lavender-glow):
- "A reading lamp on a dark desk, single lavender bulb warm-lighting a closed book, deep shadow surrounding"
- "An evening tea cup beside a closed laptop on a near-black desk, single lavender light from a phone screen"
- "A journal open under a single lavender lamp, half-drawn curtain catching the lavender bleed, late evening"
- "A folded letter on a dark surface beside a small lavender wax-seal stamp, single overhead lamp"

**Universal** (works for either, accent matches AM or PM):
- "An envelope on a dark desk, single overhead lamp catching the corner, very shallow focus"
- "A postcard leaning against a coffee mug on a near-black surface, single soft light"

## Manifest schema

`newsletter/manifest.json` (NEW):

```json
{
  "newsletters": [
    {
      "slug": "2026-05-01-pm",
      "title": "This week in AI: 8 things you may have missed",
      "publishedAt": "2026-05-01",
      "edition": "pm",
      "description": "<copied from page's meta og:description>",
      "og": {
        "subject": "<director's note matching the AM/PM accent rule>",
        "status": "pending"
      }
    }
  ]
}
```

| Field | Required | Purpose |
|---|---|---|
| `slug` | yes | Filename without `.html` (e.g., `2026-05-01-pm`) |
| `title` | yes | Cleaned of " | Weekend MVP Newsletter" suffix; goes into the card title overlay |
| `publishedAt` | yes | YYYY-MM-DD; used by `lastmod` in sitemap and rendered in the card meta line |
| `edition` | yes | `am` or `pm`; rendered in the card meta line as "AM EDITION" / "PM EDITION" |
| `description` | optional | Falls back to `title` if missing; used by `og.subject` fallback chain |
| `og.subject` | optional | Director's-note for Recraft. Falls back to `description` then `title`. |
| `og.accent` | optional | Auto-derived from slug suffix (am→mint, pm→lavender). Manifest can override. |
| `og.status` | optional | `pending` / `ready` / `failed`, written by orchestrator. |

## File structure

**New:**
```
lib/og/templates/newsletter.mjs              — buildElement + config (postcard layout)
lib/og/sources/newsletter.mjs                — listNewsletter() with deriveAccent + edition extraction
newsletter/manifest.json                     — 10 backfilled entries
tests/og/templates-newsletter.test.mjs
tests/og/sources-newsletter.test.mjs
tests/og/fixtures/newsletter-manifest-fixture.json
image/og/newsletter/.gitkeep
```

**Modified:**
```
lib/og/compose.mjs                           — register `newsletter` in TEMPLATES map
scripts/generate-og-cards.mjs                — add newsletter to MANIFEST_PATHS, MANIFEST_KEYS, loadAllItems
scripts/check-og-cards.js                    — add newsletter to surfaces array
package.json                                 — add `og:generate:newsletter` convenience script
newsletter/{slug}.html × 10                  — og:image / twitter:image / JSON-LD image meta
IMAGES.md                                    — document newsletter surface
.claude/skills/newsletter/SKILL.md           — hook OG card step (gitignored, like publish-idea/publish-article)
```

## Data flow

Same shape as articles, with newsletter-specific source. Items have `surface: 'newsletter'` so the orchestrator routes status writebacks to `newsletter/manifest.json` automatically via the lookup tables.

```
1. orchestrator: loadAllItems()
   listIdeas() ∪ listArticles() ∪ listNewsletter() → flat array
2. filter by --surface and --slug if provided
3. for each item:
   - check disk at `image/og/newsletter/{slug}.png`
   - if exists && !force → skip
   - dry-run → log + skip
   - generateOne(subject) → bgBuffer + provider name
   - compose({bgBuffer, title, surface, accent, edition, publishedAt}) → png
   - write png; updateManifestStatus('newsletter', item.slug, 'ready')
4. summary
```

The compose call gains two new optional pass-through fields: `edition` (`am`|`pm`) and `publishedAt` (YYYY-MM-DD) — both used by the newsletter template for the postmark + bottom-panel meta line. They're harmless on idea/article templates (which simply ignore them).

## `updateManifestStatus` change

Add `newsletter` to the lookup tables in `scripts/generate-og-cards.mjs`:

```js
const MANIFEST_PATHS = {
  idea: 'ideas/manifest.json',
  article: 'articles/manifest.json',
  newsletter: 'newsletter/manifest.json'
};

const MANIFEST_KEYS = {
  idea: 'ideas',
  article: 'articles',
  newsletter: 'newsletters'
};
```

## Backfill content (the 10 existing newsletters)

I author all 10 manifest entries in one pass:
- Parse `<title>` (strip ` | Weekend MVP Newsletter`)
- Parse `<meta og:description>`
- Extract `edition` from slug suffix (`am` or `pm`)
- Extract `publishedAt` from slug date prefix
- Author `og.subject` matching the AM/PM accent rule

Newsletter slugs to backfill:
- 2026-04-20-am, 2026-04-20-pm
- 2026-04-21-am, 2026-04-21-pm
- 2026-04-22-am, 2026-04-22-pm
- 2026-04-23-am, 2026-04-23-pm
- 2026-04-24-pm
- 2026-05-01-pm

10 entries total. 4 AM (mint) + 6 PM (lavender) by current ratio.

## Error handling

Inherits the v1 + Surface A pipeline behavior:
- Recraft fail → falls through to `gpt-image-1`
- Both fail → `og.status: "failed"`, page ships with site-wide fallback, `--non-blocking` exits 0
- Missing newsletter manifest → log + skip surface gracefully (no error)
- Postmark date format edge case (e.g., 2026-12-31) → date string is computed from `publishedAt` field, deterministic, no edge cases

## Verification

1. `npm run og:generate:newsletter -- --dry-run` → prints all 10 expected output paths, no API calls
2. `npm run og:generate -- --slug 2026-05-01-pm --surface newsletter` → smoke test one
3. Open thumbnail row of `image/og/newsletter/` after batch — eyeball brand consistency + AM/PM rhythm (mint vs lavender alternates clearly)
4. Open one shipped newsletter URL through LinkedIn Post Inspector after deploy
5. `STRICT=1 npm run check:og-cards` exits 0 once all 10 newsletter PNGs are committed (alongside the existing idea + article assertions)

## v1 task list

1. Add `og:generate:newsletter` script to `package.json` + create `image/og/newsletter/.gitkeep`
2. Create `lib/og/templates/newsletter.mjs` — postcard layout + config (top-60% bgRect) + 6 tests
3. Create `lib/og/sources/newsletter.mjs` — listNewsletter + deriveAccent + edition extraction + 5 tests
4. Update `lib/og/compose.mjs` — register newsletter template + thread through edition + publishedAt
5. Update `scripts/generate-og-cards.mjs` — add newsletter to MANIFEST_PATHS, MANIFEST_KEYS, loadAllItems; pass edition + publishedAt to compose
6. Update `scripts/check-og-cards.js` — add newsletter surface
7. Author `newsletter/manifest.json` with 10 entries
8. Update each newsletter HTML's `<meta og:image>` + `<meta twitter:image>` + JSON-LD `image` to point at `image/og/newsletter/{slug}.png`
9. Manual: run `npm run og:generate:newsletter` (10 Recraft calls, ~$0.40), eyeball thumbnail row
10. Update `IMAGES.md` to document the newsletter surface + AM/PM accent rule + horizontal split layout
11. Hook `newsletter` skill (gitignored, local only) — append to manifest with og.subject + edition; final step invokes generator with `--non-blocking`

## Out of scope (next surfaces)

- Newsletter HTML archive index OG card (`newsletter.html`) — single one-off, defer
- Newsletter inline email illustration (Surface C — different consumption context)
- Carousel slide-1 hero (Surface D — different aspect ratio)

## Cost

- 10 cards × ~$0.04 = ~$0.40 for the backfill batch
- Forever-cost at twice-daily cadence (~14/week): ~$0.56/week
