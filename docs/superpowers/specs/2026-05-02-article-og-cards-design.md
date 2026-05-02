# Article OG Cards — Design Spec

**Date:** 2026-05-02
**Author:** Brainstorming session (Claude Opus 4.7 + jeberulz)
**Status:** Approved for planning
**Builds on:** `docs/superpowers/specs/2026-05-02-recraft-og-image-pipeline-design.md` (Surface A — first follow-up surface)

## Problem

The 16 articles published under `articles/*.html` all share one site-wide social card (`image/og-image.png`). When shared on LinkedIn / X they render with the generic logo card, wasting the highest-leverage CTR slot. The idea-card pipeline (shipped in v1) gives us reusable infrastructure; we now extend it to articles.

## Non-goals

- Replacing the site-wide fallback (it remains the safety net for any page without a generated card).
- Auto-generating subjects from article body content (subjects are author-curated for brand quality).
- Article carousel slide-1 art (separate surface, follow-up D).

## Decisions reached during brainstorming

| # | Question | Decision |
|---|---|---|
| Q1 | Visual differentiation from idea cards | **C — different template per surface** (full visual differentiation) |
| Q2 | Layout direction | **A — editorial poster, split-frame** (left 40% solid dark panel, right 60% Recraft scene). Geist primary + Geist Mono for small labels |
| Q3 | Recraft subject library | Same dark + accent-lit world, **shifted toward reading/thinking objects** (open notebook, bookmark, highlighted page, sticky note, pencil mid-stroke) instead of doing-objects (laptop, phone, watch) |
| Q4 | Backfill workflow for 16 existing articles | **A — author all 16 manifest entries in one pass** |

## Architecture

A new `article` surface is added to the existing pipeline. The compose module is refactored to be surface-agnostic: each template module exports a `config` object describing its frame dimensions, the Recraft-image rectangle within the frame, and the canvas fill color outside that rectangle. `compose.mjs` reads the config, builds the canvas via sharp, places the Recraft image per `bgRect`, and composites the Satori-rendered chrome on top. This refactor is a small one-time investment that makes future surfaces (newsletter heroes, carousel slide-1, idea-page in-page hero) trivial — they just declare a different `config`.

```
lib/og/templates/idea.mjs          → exports buildElement + config (full-frame bg)
lib/og/templates/article.mjs       → exports buildElement + config (right-60% bg, left-40% solid)
lib/og/templates/{newsletter,carousel}.mjs  → (follow-ups, same shape)

lib/og/compose.mjs                 → surface-agnostic, reads template.config, no per-surface branching
lib/og/sources/{ideas,articles,newsletter}.mjs → manifest readers, all return same item shape
scripts/generate-og-cards.mjs      → iterates ALL surfaces by default, supports --surface filter
```

## Per-template config

```js
// lib/og/templates/idea.mjs
export const config = {
  width: 1200, height: 630,
  bgRect: { x: 0, y: 0, width: 1200, height: 630 },   // full bleed
  bgFill: '#050505'
};

// lib/og/templates/article.mjs
export const config = {
  width: 1200, height: 630,
  bgRect: { x: 480, y: 0, width: 720, height: 630 },  // right 60%
  bgFill: '#050505'                                    // left 40% remains solid
};
```

`compose.mjs` becomes:

```js
const tpl = TEMPLATES[surface];
const cfg = tpl.config;

// 1. Resize Recraft to bgRect dimensions
const fittedBg = await sharp(bgBuffer)
  .resize(cfg.bgRect.width, cfg.bgRect.height, { fit: 'cover', position: 'centre' })
  .png().toBuffer();

// 2. Build a frame-sized canvas, place fittedBg at bgRect offset
const canvas = await sharp({
  create: { width: cfg.width, height: cfg.height, channels: 3, background: cfg.bgFill }
})
  .composite([{ input: fittedBg, left: cfg.bgRect.x, top: cfg.bgRect.y }])
  .png().toBuffer();

// 3. Render chrome (transparent root)
const svg = await satori(tpl.buildElement({ title, accent, logoDataUrl }), {
  width: cfg.width, height: cfg.height, fonts
});
const chromePng = new Resvg(svg, { fitTo: { mode: 'width', value: cfg.width },
                                    background: 'rgba(0,0,0,0)' }).render().asPng();

// 4. Composite chrome over canvas
return await sharp(canvas).composite([{ input: chromePng, top: 0, left: 0 }])
  .png().toBuffer();
```

## Article template layout (Satori chrome)

```
┌──────────────────────────────┬─────────────────────────────────┐
│ #050505 panel (480px wide)   │ Recraft image (720×630)         │
│                              │                                 │
│ [WMV logo, 28px]             │                                 │
│ [ARTICLE — Geist Mono 13px,  │                                 │
│  uppercase, lavender, .15em  │                                 │
│  letter-spacing]             │                                 │
│                              │                                 │
│                              │                                 │
│ {Title — Geist Bold,         │                                 │
│  44/52/64 autoshrunk by len, │                                 │
│  6 lines max,                │                                 │
│  white, letter-spacing -1.0} │                                 │
│                              │                                 │
│                              │                                 │
│ [6 MIN READ — Geist Mono     │                                 │
│  13px, zinc-400]             │                                 │
│ [accent dot, 12px]           │                                 │
│                              │                                 │
│ ──── accent bar 4px, full ── │ ─────────────────────────────── │
└──────────────────────────────┴─────────────────────────────────┘
```

Padding 56px inside the left panel. The accent bar runs full width across both halves at the bottom, tying the panel to the scene. Title autoshrink breakpoints (different from idea card because the panel is narrower):
- ≤ 30 chars → 64px
- ≤ 70 chars → 52px
- > 70 chars → 44px

## Brand consistency — Recraft subjects

Same `STYLE_BLUEPRINT` text anchor, same `RECRAFT_STYLE_ID`, but the per-article `og.subject` shifts toward reading/thinking objects. Examples:

- "An open notebook on a dark surface, single line of mint-glowing handwriting visible, very shallow focus, late-night atmosphere"
- "A closed paperback book on a near-black desk, lavender-edged bookmark protruding, single overhead lamp lighting the cover"
- "A pencil mid-stroke on a piece of dark paper, single lime light glancing off the lead, shallow focus"
- "A sticky note crumpled at the edge of a dark desk, one word lit by a phone screen glow"

These keep the brand world (dark + single accent + late-night) but signal "lessons / frameworks / advice" rather than "moments of building." The objects are stationary and contemplative rather than active.

## Manifest schema

`articles/manifest.json` (NEW):

```json
{
  "articles": [
    {
      "slug": "the-3-screen-mvp-framework",
      "title": "The 3-Screen MVP Framework",
      "publishedAt": "2026-04-XX",
      "description": "<copied from page's og:description>",
      "wordCount": 2347,
      "readMinutes": 12,
      "og": {
        "subject": "<author's director's note>",
        "accent": "lavender",
        "status": "pending"
      }
    },
    ...
  ]
}
```

| Field | Required | Purpose |
|---|---|---|
| `slug` | yes | Filename without `.html` |
| `title` | yes | Cleaned of " | Weekend MVP" suffix; goes into the card title overlay |
| `publishedAt` | yes | YYYY-MM-DD; used by `lastmod` in sitemap |
| `description` | optional | Falls back to `title` if missing; used by `og.subject` fallback chain |
| `wordCount` | optional | For analytics + read-time computation |
| `readMinutes` | yes | Rendered in the "X MIN READ" chip; default = `Math.round(wordCount/200)` |
| `og.subject` | optional | Director's-note for Recraft. Falls back to `description` then `title`. |
| `og.accent` | optional | Defaults to `lime`. |
| `og.status` | optional | `pending` / `ready` / `failed`, written by orchestrator. |

## File structure (new + modified)

**New:**
```
lib/og/templates/article.mjs
lib/og/sources/articles.mjs
articles/manifest.json
tests/og/templates-article.test.mjs
tests/og/sources-articles.test.mjs
tests/og/fixtures/articles-manifest-fixture.json
image/og/article/.gitkeep
```

**Modified:**
```
lib/og/compose.mjs                ← surface-agnostic refactor (per-template config)
lib/og/templates/idea.mjs         ← export `config` const (full-bleed bg)
lib/og/fonts.mjs                  ← also load Geist Mono Regular
scripts/generate-og-cards.mjs     ← iterate all surfaces, --surface filter, --slug filter still works
scripts/check-og-cards.js         ← walk both manifests
package.json                      ← add `og:generate:articles` convenience script
ideas/manifest.json               ← unchanged (orchestrator no longer hardcodes "ideas")
articles/{slug}.html × 16         ← og:image / twitter:image / JSON-LD image meta updated
.claude/skills/publish-article/SKILL.md ← hook OG card step (gitignored, like publish-idea)
IMAGES.md                         ← document the article surface + workflow
```

## Data flow

Same shape as ideas, with a `--surface` filter. Default = both surfaces.

```
1. orchestrator: loadDotEnv, parseArgs, loadAllSources()
2. allSources = await Promise.all([listIdeas(), listArticles()])
   → flatten → items with surface field on each
3. filter by --surface and --slug if provided
4. for each item:
   - check disk at `image/og/{surface}/{slug}.png`
   - if exists && !force → skip
   - dry-run → log + skip
   - generateOne(subject) → buffer + provider name
   - compose({bgBuffer, title, surface, accent}) → png buffer
   - write png; updateManifestStatus(item.surface, item.slug, 'ready')
5. summary
```

## `updateManifestStatus` change

Now writes to the right manifest based on surface:

```js
const MANIFEST_PATHS = {
  idea: 'ideas/manifest.json',
  article: 'articles/manifest.json'
};

export async function updateManifestStatus(surface, slug, status) {
  const path = join(ROOT, MANIFEST_PATHS[surface]);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const list = surface === 'idea' ? json.ideas : json.articles;
  const entry = list.find((i) => i.slug === slug);
  if (!entry) return;
  entry.og = entry.og ?? {};
  entry.og.status = status;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}
```

## Backfill content (the 16 existing articles)

I author all 16 in one pass. For each: read the article HTML, parse `<title>` (strip ` | Weekend MVP`), parse `<meta og:description>`, count words from body text, then write `og.subject` + `og.accent`. Accents distributed across the brand palette to avoid monotony.

Backfilled list (subjects authored at implementation time, not pre-committed here):
- 5-claude-code-skills-for-solo-founders
- 5-side-projects-that-make-money
- 7-micro-saas-ideas-solo-2026
- 7-things-to-build-with-claude-code-this-weekend
- claude-code-48-hour-workflow
- claude-code-for-non-technical-founders
- claude-code-on-your-phone
- how-to-build-your-first-app-in-a-weekend
- stop-overthinking-start-building
- the-1k-month-idea
- the-3-screen-mvp-framework
- validate-startup-idea-48-hours
- vibe-coding-101
- when-to-quit-your-job
- why-chatgpt-cant-give-good-startup-ideas

## Error handling

Inherits the v1 pipeline's behavior:
- Recraft fail → falls through to gpt-image-1
- Both fail → `og.status: "failed"`, page ships with site-wide fallback, `--non-blocking` exits 0
- Missing fonts → hard fail (Geist Mono now also required)
- Missing manifest → log + exit 0 (orchestrator skips that surface gracefully)

## Verification

1. `npm run og:generate:dry --surface article` → prints all 16 expected output paths, no API calls
2. `npm run og:generate -- --slug the-3-screen-mvp-framework --surface article` → smoke test one
3. Open thumbnail row of `image/og/article/` after batch — eyeball brand consistency
4. Open one shipped article URL through LinkedIn Post Inspector after deploy
5. `STRICT=1 npm run check:og-cards` exits 0 once all 16 PNGs are committed

## v1 task list

1. Refactor `lib/og/compose.mjs` to read per-template `config` (canvas + bgRect + bgFill); idea template stays visually identical, just gains a config export
2. Update `lib/og/templates/idea.mjs` to export `config` (full-frame full-bleed)
3. Extend `lib/og/fonts.mjs` to also load Geist Mono Regular (weight 400, name 'GeistMono')
4. Create `lib/og/templates/article.mjs` — split-frame Satori tree + config (right-60% bgRect)
5. Create `lib/og/sources/articles.mjs` + fixture + tests (mirror ideas.mjs shape)
6. Update `scripts/generate-og-cards.mjs` — iterate all sources, add `--surface` filter, refactor `updateManifestStatus(surface, slug, status)`
7. Update `scripts/check-og-cards.js` — walk both manifests
8. Author `articles/manifest.json` with 16 entries (parse HTML for title + description + word count, author og.subject + og.accent)
9. Update each article HTML's `<meta og:image>` + `<meta twitter:image>` + JSON-LD `image` to point at `image/og/article/{slug}.png`
10. Add `og:generate:articles` and `og:generate:ideas` convenience scripts to package.json
11. Manual: run `npm run og:generate -- --surface article --force` (16 Recraft calls, ~$0.64), eyeball thumbnail row
12. Update `IMAGES.md` to document the article surface + the per-template config pattern
13. Hook `publish-article` skill (gitignored, like publish-idea)

## Out of scope (next surfaces)

- Newsletter HTML archive page OG cards (Surface B)
- Newsletter inline email illustration (Surface C — different consumption context, different aspect ratio considerations)
- Carousel slide-1 hero (Surface D — 1080×1350 portrait, integrates with existing carousel pipeline)
- Article in-page hero illustration (separate from OG card; would also need a per-page hero block in the HTML template)

## Cost

- 16 cards × ~$0.04 = ~$0.64 for the backfill batch
- Forever-cost as ~1-2 articles/week ship → ~$0.04-0.08/week
