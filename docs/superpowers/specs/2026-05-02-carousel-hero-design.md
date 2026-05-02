# Carousel Slide-1 Hero — Design Spec

**Date:** 2026-05-02
**Author:** Brainstorming session (Claude Opus 4.7 + jeberulz)
**Status:** Approved for planning
**Builds on:**
- `docs/superpowers/specs/2026-05-02-recraft-og-image-pipeline-design.md` (v1)
- `docs/superpowers/specs/2026-05-02-article-og-cards-design.md` (Surface A — established per-template config)
- `docs/superpowers/specs/2026-05-02-newsletter-og-cards-design.md` (Surface B — newsletter manifest + AM/PM rule)
- `docs/superpowers/specs/2026-05-02-email-newsletter-hero-design.md` (Surface C — no-chrome image-only surface, JPEG output)

## Problem

The 3 existing carousel posts at `content/social/posts/{date}_{slug}/` have a typography-only Slide 01 (eyebrow + headline + meta_strip rendered as HTML/CSS). No image. When LinkedIn or Instagram users scroll past, the first slide reads as a wall of text instead of a scene. Adding a Recraft hero gives slide 01 a brand-cohesive visual signature that matches the OG cards already shipped.

This is the smallest surface we've shipped: NO BACKFILL of the 3 existing posts (user explicitly opted out), only a single test generation against the most recent post to validate the pipeline end-to-end.

## Non-goals

- **Backfill** of the 2 oldest carousel posts (`2026-04-21_the-3-screen-mvp-framework`, `2026-04-22_audit-gate-for-ideas`) — user opted out.
- **HTML render integration** — modifying `content/social/_layouts/*.html` so the slide-01 hero JPG renders as a CSS background underneath the existing typography. Deferred to a Surface D v2 spec/plan after this v1 ships.
- **Build gate coverage** — `scripts/check-og-cards.js` does not get extended to walk carousel posts in v1. The carousel "manifest" is markdown tables in N files (not a single JSON), and the v1 gate logic isn't a clean fit. Documented as a known gap for the v2 follow-up.
- **Synthetic test image** — generation runs against the real `2026-04-23_1k-nutrition-planner` post, not a synthetic one.

## Decisions reached during brainstorming

| # | Question | Decision |
|---|---|---|
| Q1 | How does the generated image get used? | **C — A now, B later.** v1 is **A: standalone deliverable** at `image/social/carousel/{post-slug}.jpg`. v2 (separate spec) will modify `_layouts/*.html` to honor the JPG as slide-01 background. |
| Q2 | Subject sourcing for the slide-01 hero | **A — new author-written `slide_01_subject` frontmatter field** in `carousel.md`. Falls back to `theme + topic` if missing (so the test doesn't require modifying the existing post). |

Test target: `2026-04-23_1k-nutrition-planner` (most recent existing carousel post). Fallback subject derivation (theme + topic) gets exercised — no carousel.md modification needed.

## Architecture

A new `carousel-hero` surface added to the existing pipeline. Reuses Surface C's no-chrome / JPEG-output codepath verbatim. No new compose extensions needed — Surface C's `format: 'jpeg'` + "missing buildElement → skip Satori" already cover everything.

Two surface-specific quirks:
1. **No JSON manifest.** The "manifest" is the markdown table at the top of each `content/social/posts/*/carousel.md`. The source parses this table format directly (no `gray-matter` — the existing format isn't YAML frontmatter, it's a markdown pipe-delimited table). Status writeback is a silent no-op for this surface (orchestrator's `updateManifestStatus` already returns early when `MANIFEST_PATHS[surface]` is undefined).
2. **No build gate coverage in v1.** The `scripts/check-og-cards.js` `surfaces` array is JSON-manifest-shaped. Carousel-hero would need a different walking strategy. Skipped for v1, documented as a known gap.

```
content/social/posts/{date}_{slug}/carousel.md
  └─ markdown table at top of file (theme, topic, accent_primary, slide_01_subject?, ...)
      ↓ parsed by lib/og/sources/carousel-hero.mjs
      ↓ surface=carousel-hero, accent=accent_primary, subject=slide_01_subject ?? `${theme} — ${topic}`
      ↓ output: image/social/carousel/{date}_{slug}.jpg (1080×1350, no chrome, JPEG)
```

## Per-template config (extends the established pattern)

```js
// lib/og/templates/carousel-hero.mjs
export const config = {
  width: 1080,
  height: 1350,
  bgRect: { x: 0, y: 0, width: 1080, height: 1350 },  // full bleed
  bgFill: '#050505',
  format: 'jpeg',
  jpegQuality: 88                                       // slightly higher than email's 85
};

// NO buildElement export — same pattern as email-newsletter (Surface C)
```

Why JPEG quality 88 vs email's 85? Carousel images render at ~1080px on Instagram/LinkedIn (full size, not thumbnail). A slightly higher quality (~5KB more per image) is worth it for the larger render context.

## Source — markdown table parser

`lib/og/sources/carousel-hero.mjs` scans `content/social/posts/*/carousel.md` and parses the markdown table at the top of each file. The table format observed in existing posts:

```markdown
| Field | Value |
|-------|-------|
| date | 2026-04-23 |
| slot | standalone |
| theme | Case Study / $1K Month |
| topic | What $1K/mo looks like for AI Nutrition Planner for Trainers |
| hook_type | Stat shock |
| layout | wmv-default |
| slide_count | 7 |
| source | newsletter/2026-04-23-am |
| cta_url | https://weekendmvp.app/... |
| accent_primary | lime |

---
```

The parser:
1. Read the file
2. Find the table — lines that start with `|`
3. For each `| key | value |` row (skipping header `| Field | Value |` and divider `|---|---|`), trim and store as `{key: value}`
4. Stop at the first non-table line OR the first horizontal rule (`---`)

Returned item shape (matches established pipeline):

```js
{
  slug: '2026-04-23_1k-nutrition-planner',          // directory name
  title: '<theme> — <topic>',                        // composed for orchestrator logging
  subject: <slide_01_subject ?? `${theme} — ${topic}`>,
  accent: <accent_primary or 'lime' default>,
  surface: 'carousel-hero',
  outputPath: 'image/social/carousel/<slug>.jpg',
  status: undefined                                   // no status writeback for this surface
}
```

The accent is read from `accent_primary` directly (it's already one of the brand accent names — lime / mint / lavender / etc.). No derivation needed.

## File structure

**New:**
```
lib/og/templates/carousel-hero.mjs
lib/og/sources/carousel-hero.mjs
image/social/carousel/.gitkeep
tests/og/templates-carousel-hero.test.mjs
tests/og/sources-carousel-hero.test.mjs
tests/og/fixtures/carousel-post/carousel.md  (a tiny fixture file mirroring the real format)
```

**Modified:**
```
lib/og/compose.mjs                       — register carousel-hero in TEMPLATES (1-line addition + 1-line import)
scripts/generate-og-cards.mjs            — import listCarouselHero, add to loadAllItems (no MANIFEST_PATHS / MANIFEST_KEYS / STATUS_FIELDS entries — surface has no JSON manifest, status writes are silent no-ops)
package.json                             — add og:generate:carousel-hero script
IMAGES.md                                — document carousel-hero surface + the no-manifest pattern + Surface D v2 follow-up note
.claude/skills/carousel/SKILL.md         — write slide_01_subject into table during /carousel + invoke generator (gitignored, local only)
```

**NOT modified:**
- `scripts/check-og-cards.js` — carousel-hero deliberately not added (see Non-goals).
- `tests/og/orchestrator.test.mjs` — no STATUS_FIELDS / MANIFEST_PATHS changes for this surface, no orchestrator test updates needed (existing tests cover the lookup table no-entry case via the `?? 'status'` fallback + early-return on missing manifest path).
- `tests/og/compose.test.mjs` — no compose changes (Surface C's no-chrome/JPEG path already supports this surface).

## Compose changes

**None.** Surface C added the no-buildElement path and JPEG format dispatch. Carousel-hero piggybacks on both — register the template in `TEMPLATES`, that's it.

```js
// lib/og/compose.mjs
import * as carouselHeroTemplate from './templates/carousel-hero.mjs';

const TEMPLATES = {
  idea: ideaTemplate,
  article: articleTemplate,
  newsletter: newsletterTemplate,
  'email-newsletter': emailNewsletterTemplate,
  'carousel-hero': carouselHeroTemplate
};
```

## Orchestrator changes

Two minimal additions to `scripts/generate-og-cards.mjs`:

1. Import `listCarouselHero` from the new source
2. Add `await tryLoad(listCarouselHero)` to `loadAllItems`

NO additions to `MANIFEST_PATHS` / `MANIFEST_KEYS` / `STATUS_FIELDS`. The `updateManifestStatus` function already early-returns when `MANIFEST_PATHS[surface]` is undefined, so status writes for `carousel-hero` items are silent no-ops. This is the intended behavior.

The orchestrator's `--surface carousel-hero` filter, `--slug {dirname}`, dry-run, force, and non-blocking flags all just work via the existing flow.

## `slide_01_subject` field convention

For new carousels (Surface D v1 going forward, after Task 7), the `/carousel` skill writes `slide_01_subject` into the markdown table during draft creation. Example post-Surface-D table:

```markdown
| Field | Value |
|-------|-------|
| date | 2026-05-02 |
| slot | am |
| theme | Tutorial / Vibe Coding |
| topic | Build a startup idea page in 30 minutes |
| accent_primary | mint |
| slide_01_subject | A pencil mid-stroke on a dark notebook page, single mint glow tracing the line, very shallow focus, late-night atmosphere |
```

For the test target (`2026-04-23_1k-nutrition-planner`) which doesn't have this field, the source falls back to `theme + topic`:

```
Subject: Case Study / $1K Month — What $1K/mo looks like for AI Nutrition Planner for Trainers
```

That's not a director's-note (it's just concatenated metadata), but it gives Recraft enough to produce a brand-styled hero. The result is acceptable for a one-off test.

## Test target

**`2026-04-23_1k-nutrition-planner`** — most recent of the 3 existing carousel posts.

Why this slug:
- Already exists (no synthetic content needed)
- `accent_primary: lime` in the table → predictable accent rendering
- Uses fallback subject derivation (no `slide_01_subject` field present) → exercises that codepath
- Recent enough that the user might still want to use the resulting JPG if it looks good

Output: `image/social/carousel/2026-04-23_1k-nutrition-planner.jpg` (1080×1350 JPEG, ~50KB)

User decides post-eyeball whether to commit the JPG. If yes, the carousel-hero surface is fully validated end-to-end. If no (the fallback subject produced a generic image), the user can: (a) add `slide_01_subject` to that post's carousel.md and re-run, or (b) leave it and rely on the next real `/carousel` run for validation.

## Error handling

Inherits the v1 + Surface A/B/C pipeline:
- Recraft fail → falls through to `gpt-image-1`
- Both fail → status would normally write `failed`, but for this surface `updateManifestStatus` is a silent no-op. The script logs the failure to stderr and exits non-zero (or 0 with `--non-blocking`).
- Missing carousel.md or unparseable table → source returns 0 items, surface skipped silently
- `slide_01_subject` missing → fallback to `${theme} — ${topic}` → falls back further to `${slug}` if both missing

## Verification

1. `npm run og:generate:carousel-hero -- --dry-run` → prints all 3 expected output paths (one per existing post), no API calls
2. `node scripts/generate-og-cards.mjs --slug 2026-04-23_1k-nutrition-planner --surface carousel-hero` → smoke test the test target (1 Recraft call, ~$0.04). Writes `image/social/carousel/2026-04-23_1k-nutrition-planner.jpg`.
3. Open the JPG in Preview, confirm 1080×1350 JPEG, dark + lime atmosphere, recognizably brand-cohesive. If yes → ship. If no → iterate.
4. Confirm `STRICT=1 npm run check:og-cards` still passes (carousel-hero is intentionally NOT added to the gate; existing 4 surfaces unaffected).

## v1 task list

1. Add `og:generate:carousel-hero` script to `package.json` + create `image/social/carousel/.gitkeep`
2. Create `lib/og/templates/carousel-hero.mjs` — config only (1080×1350 JPEG quality 88, no buildElement) + 2 tests
3. Create `lib/og/sources/carousel-hero.mjs` — scans `content/social/posts/*/carousel.md`, parses the markdown table, returns items + 5 tests + small fixture
4. Update `lib/og/compose.mjs` — register `'carousel-hero': carouselHeroTemplate` in TEMPLATES (no test changes needed)
5. Update `scripts/generate-og-cards.mjs` — import + loadAllItems addition only (no lookup table changes)
6. Manual: run `node scripts/generate-og-cards.mjs --slug 2026-04-23_1k-nutrition-planner --surface carousel-hero` (1 Recraft call, ~$0.04). Eyeball the JPG.
7. Update `IMAGES.md` to document carousel-hero surface + the markdown-table-as-manifest pattern + the build-gate-skipped caveat + the Surface D v2 follow-up note
8. Hook `carousel` skill (gitignored) — write `slide_01_subject` into the markdown table during draft creation + invoke generator with `--non-blocking` as final step

## Out of scope (Surface D v2 — separate spec/plan)

- Modify `content/social/_layouts/*.html` to honor the slide-01 hero JPG as a CSS background under the existing typography (the "B" half of Q1's "C — both")
- Backfill the 2 older carousel posts (`2026-04-21_the-3-screen-mvp-framework`, `2026-04-22_audit-gate-for-ideas`) — only if the user wants them later
- Build gate coverage — extend `scripts/check-og-cards.js` to walk markdown-table-based "manifests" (would need a `manifestStrategy: 'json' | 'markdown-table'` field on the surfaces array entries)

## Cost

- Test generation: 1 × ~$0.04 = $0.04
- Forever-cost going forward: ~$0.04 per new carousel post (plus optional re-runs if the operator regenerates with a new `slide_01_subject`)
