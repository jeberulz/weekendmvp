# Carousel Slide-1 Hero — HTML Overlay (Surface D v2) Design Spec

**Date:** 2026-05-02
**Author:** Brainstorming session (Claude Opus 4.7 + jeberulz)
**Status:** Approved for planning
**Builds on:**
- `docs/superpowers/specs/2026-05-02-carousel-hero-design.md` (Surface D v1 — produces the JPG at `image/social/carousel/{slug}.jpg`)
- `docs/superpowers/specs/2026-05-02-newsletter-og-cards-design.md` (Surface B — established the gradient-overlay-on-image pattern)

## Problem

Surface D v1 generates a 1080×1350 JPEG hero per carousel post but the JPG is a **standalone deliverable** — slide-1 of `slides.html` still renders the typography (eyebrow + 3-line headline + subtitle + footer) on a flat dark background with grid lines. The image and the slide are decoupled.

This spec wires the v1 hero JPG into slide-1 of `content/social/_layouts/*.html` (all 6 layouts) as a CSS background, so the published carousel renders the typography on top of the hero scene with a bottom-anchored dark gradient that preserves headline contrast.

## Non-goals

- **Mid-deck heroes** (slide 2+ getting their own hero JPGs). Slide 1 only.
- **Automatic backfill** of the 3 existing carousel posts. They've already shipped to LinkedIn/IG; if the operator wants to regenerate, they re-run `/carousel` against that slug.
- **Live site integration.** Slide-1 hero is a slides.html / Figma capture concern — `weekendmvp.app` doesn't render carousel HTML directly.
- **Code changes to v1.** No edits to `lib/og/templates/carousel-hero.mjs`, `lib/og/sources/carousel-hero.mjs`, `lib/og/compose.mjs`, or `scripts/generate-og-cards.mjs`. v1 is the upstream producer; v2 only consumes.

## Decisions reached during brainstorming

| # | Question | Decision |
|---|---|---|
| Q1 | CSS overlay treatment for typography readability | **A — Bottom-anchored dark gradient.** `linear-gradient(180deg, transparent 0%, rgba(5,5,5,0.55) 55%, var(--bg) 100%)`. Image breathes at top, headline lands on a solid darker band. |
| Q2 | How does the JPG get into the post directory (Python http.server in Phase 5.2 can't reach outside `content/social/posts/{slug}/`) | **A — Skill copies it during Phase 5.1.** Surface D v1 still writes to the canonical `image/social/carousel/{slug}.jpg`; the `/carousel` skill copies it to `content/social/posts/{slug}/hero.jpg` as a build artifact when rendering slides.html. |
| Q3 | Fallback when Recraft failed and no JPG exists | **A — Skill checks file existence; if missing, skips both the copy AND the `data-has-hero` attribute injection.** Slide-1 falls back to today's dark `var(--bg)` + grid lines. The gradient overlay is gated on `[data-has-hero]` so it doesn't apply on missing-asset fallback. |

## Architecture

A render-time hook in the `/carousel` skill's Phase 5 wires the v1 hero JPG into slide-1. **No JS code changes.** Two surface-level changes:

1. One CSS rule added to `content/social/_layouts/_shared.css` (committed) targeting `.slide-hero[data-has-hero]` plus a `::after` pseudo-element for the gradient overlay.
2. Skill markdown (`.claude/skills/carousel/SKILL.md`, gitignored, local-only) restructures Phase 5 so the hero generates *before* HTML render, and adds a new transform sub-step `5.1.i` that copies the JPG into the post directory + injects the `data-has-hero` attribute on slide-1.

Phase 5 sequence after this spec:

```
5.0 Generate slide-1 hero image (Recraft, --non-blocking)  ← was 5.4 in v1, moved up
5.1 Generate HTML — extended with new transform 5.1.i
5.2 Serve Locally
5.3 Figma Capture
5.4 Report & Cleanup                                       ← reverts to original numbering
```

## CSS rule (only committed code change)

Added to the bottom of `content/social/_layouts/_shared.css`:

```css
/* ==========================================================================
   Slide-1 hero image overlay (Surface D v2)
   --------------------------------------------------------------------------
   Activates when the /carousel skill's render step copies image/social/carousel/{slug}.jpg
   to {post-dir}/hero.jpg AND adds data-has-hero to the [data-slide="1"] element.
   Without the attribute, slide-1 renders identically to today (dark bg + grid lines).
   ========================================================================== */

.slide-hero[data-has-hero] {
  background-image: url('hero.jpg');
  background-size: cover;
  background-position: center;
}

.slide-hero[data-has-hero]::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(5, 5, 5, 0.55) 55%,
    var(--bg) 100%);
  pointer-events: none;
  z-index: 0;
}
```

Why `[data-has-hero]` instead of just `.slide-hero`? The attribute is the explicit signal the skill injects only when a hero JPG exists on disk. Without it, the rule (and its gradient overlay) doesn't apply — graceful fallback for Recraft failures.

The existing `.slide-inner { z-index: 1 }` rule keeps the typography above the gradient `::after` (z-index 0) and the `.grid-lines::before` (z-index 0). All three layers compose:

```
z-index 1: typography (eyebrow, headline, subtitle, footer)
z-index 0: ::after gradient overlay
z-index 0: ::before grid-lines (still rendered, mostly invisible over the dark gradient)
z-index -: background-image: url('hero.jpg') (slide background)
```

## Skill changes (gitignored)

Three changes inside `.claude/skills/carousel/SKILL.md`:

### 1. Restructure Phase 5

Move existing `5.4 Generate slide-1 hero image` (added in v1) to the start of Phase 5 as `5.0 Generate slide-1 hero image`. Rename existing `5.5 Report & Cleanup` back to `5.4`. The hero must be on disk before 5.1 runs because 5.1.i needs to copy it.

### 2. Add transform 5.1.i to the render-step sequence

Inserted at the end of the existing transform list `(a–h)` in Phase 5.1:

> **i. Wire slide-1 hero image.** If `image/social/carousel/{date}_{slug}.jpg` exists on disk, `cp` it to `content/social/posts/{date}_{slug}/hero.jpg` (sibling of slides.html), then add the `data-has-hero` attribute to the `<div class="slide grid-lines slide-hero" data-slide="1" ...>` element. If the JPG is missing (Recraft failed in 5.0), skip both — slide-1 falls back to today's dark `var(--bg)` + grid lines render. The CSS rule in `_shared.css` is gated on `[data-has-hero]` so the gradient overlay doesn't apply on missing-asset fallback either.

### 3. Update the verification block (5.1.1)

Add to the failure-signature grep list:

> ❌ `data-has-hero` present BUT no `hero.jpg` next to slides.html → transform (i) injected the attribute but skipped/failed the copy. Either remove the attribute or restore the file.

## Data flow

```
1. Operator runs /carousel
2. Phases 0–4: context, content strategy, draft creation, review pause
3. Phase 3.2 (v1 hook): author writes slide_01_subject into carousel.md table
4. Phase 5.0 (NEW POSITION): generate slide-1 hero
     node scripts/generate-og-cards.mjs --slug {date}_{slug} --surface carousel-hero --non-blocking
     → success: writes image/social/carousel/{date}_{slug}.jpg
     → failure: logs to stderr, exits 0, skill continues
5. Phase 5.1: renders slides.html via existing transforms (a–h), then new (i):
     if image/social/carousel/{date}_{slug}.jpg exists:
       cp it to content/social/posts/{date}_{slug}/hero.jpg
       add data-has-hero attribute to slide-1
     else: skip both
6. Phase 5.2: python3 -m http.server 8888 from inside post dir
     hero.jpg lives next to slides.html, served at localhost:8888/hero.jpg
     CSS rule .slide-hero[data-has-hero] picks it up
7. Phase 5.3: Figma capture sees the hero as part of slide-1 background
8. Phase 5.4: report & cleanup (renamed back from 5.5)
```

## Two-on-disk path (intentional)

| Path | Purpose | Lifecycle |
|---|---|---|
| `image/social/carousel/{slug}.jpg` | **Canonical** — manifest-paired output, deployed to `weekendmvp.app/image/social/carousel/{slug}.jpg`, used by future v3 surfaces or direct sharing. Already documented in `IMAGES.md`. | Written by `og:generate:carousel-hero`. Committed once per post. |
| `content/social/posts/{slug}/hero.jpg` | **Build artifact** — sibling of slides.html, served by Python http.server, referenced via simple `url('hero.jpg')` in CSS. | Copied during render step 5.1.i. Committed alongside slides.html in the post directory. |

The duplication is ~400KB per post (trivial). It eliminates the alternative trade-offs:
- **Symlink** would solve duplication but breaks Figma capture portability across OS / git checkout state.
- **Move canonical to post dir** would break v1's documented surface contract and lose the public/deployable URL.
- **Absolute production URL** would only work post-deploy (Figma capture happens pre-deploy).

## File structure

**New / modified (committed):**
```
content/social/_layouts/_shared.css   — append the .slide-hero[data-has-hero] rule + ::after overlay
tests/og/shared-css.test.mjs          — verify _shared.css contains the rule + gradient declaration
```

**Modified (gitignored, local-only):**
```
.claude/skills/carousel/SKILL.md       — restructure Phase 5, add transform 5.1.i, update verification block
```

**Per-post (committed when operator runs /carousel against that slug):**
```
content/social/posts/{slug}/hero.jpg  — copied from image/social/carousel/{slug}.jpg by transform 5.1.i
content/social/posts/{slug}/slides.html — re-rendered with data-has-hero attribute on slide-1
```

**Unchanged (deliberate):**
```
lib/og/templates/carousel-hero.mjs    — Surface D v1 untouched
lib/og/sources/carousel-hero.mjs      — Surface D v1 untouched
lib/og/compose.mjs                    — Surface D v1 untouched
scripts/generate-og-cards.mjs         — Surface D v1 untouched
content/social/_layouts/*.html        — markup already shares .slide-hero + [data-slide="1"] across all 6 layouts
IMAGES.md                             — v1 docs already cover the canonical path; no v2 additions needed (the post-local hero.jpg is a build artifact, not a documented surface)
```

## Error handling

| Scenario | Behavior |
|---|---|
| Recraft fails in Phase 5.0 (`--non-blocking`) | exit 0, no JPG written. 5.1.i skips copy + skips attribute. Slide-1 renders identically to today. Retry later with `--force`. |
| Stale JPG from a previous run, fresh generation fails | `--non-blocking` exits 0; existing JPG unchanged on disk. 5.1.i finds the (stale) file, copies it, injects attribute. Slide-1 renders with the stale hero. Operator can `--force` regenerate when ready. |
| `cp` fails (permissions, disk full) | Real bug — surface as an error in the render step. Do NOT degrade silently. |
| Operator skipped `slide_01_subject` in carousel.md | v1 source falls back to `${theme} — ${topic}` (existing v1 behavior). JPG generates fine, just less directional. Slide-1 still gets a hero overlay. |
| Operator runs `/carousel --re-render {slug}` for a v1-shipped post | 5.1.i picks up `image/social/carousel/{slug}.jpg` if present, produces new slides.html with `data-has-hero`. The post's earlier shipped slides.html is overwritten. |

## Testing strategy

1. **CSS rule presence test** (`tests/og/shared-css.test.mjs`): assert `_shared.css` contains both the `.slide-hero[data-has-hero]` selector and the bottom-anchored gradient declaration. Catches accidental deletion during future edits.
2. **Skill behavior** is untested in code (the skill file is gitignored markdown).
3. **Manual smoke test**:
   - Re-render `2026-04-23_1k-nutrition-planner` (already has a v1 JPG on disk from Surface D v1 Task 6) via `/carousel --re-render 2026-04-23_1k-nutrition-planner`.
   - Confirm: `content/social/posts/2026-04-23_1k-nutrition-planner/hero.jpg` exists, slides.html has `data-has-hero` on the slide-1 div.
   - Open `localhost:8888/slides.html`, eyeball: typography readable, headline solidly on the bottom-darkened band, eyebrow legible at top.
4. **Figma capture sanity check**: re-run capture on the smoke-test post to confirm Figma sees the new hero in slide-1.
5. **Fallback verification**: rename `image/social/carousel/2026-04-23_1k-nutrition-planner.jpg` away temporarily, re-run render, confirm slide-1 falls back to dark grid (no `data-has-hero` injected, no broken-image artifact).

## v1 task list

1. Append the `.slide-hero[data-has-hero]` CSS rule + `::after` gradient block to `content/social/_layouts/_shared.css`.
2. Add `tests/og/shared-css.test.mjs` asserting the rule + gradient are present (TDD: write the test first, see it fail, add the CSS, see it pass).
3. Update `.claude/skills/carousel/SKILL.md` (gitignored): restructure Phase 5 (5.4 → 5.0 → 5.4 rename cycle), add transform 5.1.i, extend the 5.1.1 verification block.
4. Manual: `/carousel --re-render 2026-04-23_1k-nutrition-planner` against the existing post + JPG; eyeball slide-1; confirm `hero.jpg` and `data-has-hero` appear; commit the re-rendered slides.html + hero.jpg if it looks right.
5. Manual: rename the JPG away, re-render, confirm graceful fallback. Restore the JPG.
6. Optional: regenerate any of the 2 older posts (`2026-04-21_the-3-screen-mvp-framework`, `2026-04-22_audit-gate-for-ideas`) if the operator wants the new look.

## Out of scope (potential v3 / follow-ups)

- Mid-deck hero JPGs (slide 2+).
- Build-gate coverage for carousel-hero (`scripts/check-og-cards.js` still doesn't walk markdown-table-based "manifests"). Inherited from v1 spec, still deferred.
- Live-site integration (rendering carousel slide-1 inside `weekendmvp.app/...` pages, not just slides.html).
- Per-layout overrides — if a future layout (e.g., a build-in-public pipeline) wants a different gradient or no overlay, the rule would need a `data-hero-style` attribute hook. Not needed for v2 (all 6 current layouts share the same hero structure and benefit from the same overlay).

## Cost

- **Code**: zero new Recraft calls (v1 already produces the JPG). Cost is dev time only.
- **Disk**: ~400KB per post for the duplicated `hero.jpg`. Trivial.
- **Future per-carousel**: same as v1 (~$0.04 per Recraft call). v2 doesn't add to per-post cost.
