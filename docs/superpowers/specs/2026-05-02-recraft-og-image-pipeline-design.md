# Recraft OG Image Pipeline — Design Spec

**Date:** 2026-05-02
**Author:** Brainstorming session (Claude Opus 4.7 + jeberulz)
**Status:** Approved for planning

## Problem

Weekend MVP publishes ideas, articles, newsletters, and carousels. Today every page shares one site-wide social card (`image/og-image.png`). When a page is shared on LinkedIn, X, or sent through a messaging app, the same generic image appears regardless of the page's topic. This wastes the highest-leverage slot for click-through and brand recognition.

The fix is to generate distinctive, brand-consistent imagery per page through an automated pipeline. The pattern is already proven in the sibling `autocrew-marketing` project (Recraft v3 + `gpt-image-1` fallback + `sharp`). We are adapting it to (a) a static HTML site instead of MDX, (b) the Weekend MVP brand (dark + lime/lavender accents), and (c) a richer composition that overlays headline text on the generated image.

## Non-goals

- Replacing the site-wide `og-image.png` (it remains the fallback for pages without a generated card).
- Generating in-page editorial illustrations for idea pages (separate surface, follow-up).
- Newsletter inline email illustrations (separate surface, follow-up).
- Carousel slide-1 hero art (separate surface, follow-up).
- Per-author OG cards.
- Runtime OG generation at the edge (we pre-render and commit PNGs).
- Midjourney integration (no official API; unofficial wrappers violate Midjourney ToS).

## Decisions reached during brainstorming

| # | Question | Decision |
|---|---|---|
| Q1 | Priority of image surfaces | Idea OG cards first (template), then replicate to articles, newsletter, carousel, in-page hero |
| Q2 | Visual aesthetic | Terminal-photographic — dark scenes, product-photo realism, synthetic glow / accent-lit elements |
| Q3 | OG card composition | Composed (Recraft image as background + Satori-rendered title + WMV chrome on top) |
| Q4 | Compositor tech | Satori + `@resvg/resvg-js` (no headless browser, JSX templates, fast) |
| Q5 | Provider fallback | `gpt-image-1` (matches Autocrew pattern) |
| Q6 | Source-of-truth | Hybrid: manifest for ideas/articles, `<meta name="og-subject">` for one-off pages |
| Q7 | Trigger model + v1 scope | Idempotent CLI script, manual trigger, files committed. v1 = idea OG cards only. |
| Q8 | `publish-idea` integration | Auto-invoked, **graceful degradation** — Recraft failure must never block publish |

## Architecture

A Node CLI script (`scripts/generate-og-cards.mjs`) reads slug metadata from a manifest, calls Recraft v3 (with `gpt-image-1` fallback) to render a "terminal-photographic" background image, then composes a 1200×630 OG card via Satori with a title + WMV chrome on top, and writes the PNG to `image/og/{surface}/{slug}.png` — committed to git.

```
scripts/generate-og-cards.mjs       ← orchestrator (CLI args, manifest read, idempotency, error reporting)
  └─ lib/og/providers/recraft.mjs   ← generate(prompt, styleId) → Buffer (PNG/JPEG)
  └─ lib/og/providers/openai.mjs    ← generate(prompt) → Buffer (fallback)
  └─ lib/og/style-blueprint.mjs     ← exports STYLE_BLUEPRINT string (the brand text anchor)
  └─ lib/og/compose.mjs             ← compose({bgBuffer, title, surface, accent}) → PNG Buffer
        └─ lib/og/templates/idea.mjs       ← Satori element tree for idea cards (plain JS, no JSX)
        └─ lib/og/templates/article.mjs    ← (added in follow-up)
        └─ lib/og/templates/newsletter.mjs ← (added in follow-up)
  └─ lib/og/fonts.mjs               ← loads Geist Regular + Bold as buffers (cached on disk)
  └─ lib/og/sources/ideas.mjs       ← reads ideas/manifest.json → [{slug, title, subject, surface:'idea'}]
  └─ lib/og/sources/articles.mjs    ← (added in follow-up)
  └─ lib/og/sources/pages.mjs       ← (added in follow-up — scrapes <meta name="og-subject">)
```

**Why this shape:** providers are interchangeable (swap fallback later without touching the orchestrator). Templates are isolated per surface (you can iterate idea-card design without risking article-card). Sources are pluggable (manifest vs HTML scrape vs newsletter index — same shape going in, same shape coming out). The orchestrator never knows about Recraft or Satori — it just iterates `source.list() → provider.generate() → compose() → write`.

## Data flow (per slug)

```
1. orchestrator gathers items
   ideas/manifest.json → sources/ideas.mjs → [{slug:'agent-storefront-platform',
                                                title:'Agent Storefront Platform',
                                                subject:'<from manifest.og.subject>',
                                                surface:'idea',
                                                accent:'lime'}, ...]

2. for each item, check disk:
   if image/og/idea/{slug}.png exists && !FORCE → SKIP
   if --slug X filter set && item.slug !== X → SKIP
   if --dry-run → log subject + path, no API call

3. build prompt:
   prompt = STYLE_BLUEPRINT + "\n\nSubject: " + item.subject

4. provider.generate(prompt, RECRAFT_STYLE_ID):
   POST recraft v1/images/generations { model:'recraftv3', size:'1707x1024',
                                         style_id:..., response_format:'b64_json' }
   → Buffer (the raw illustration, no text yet)
   on error → providers/openai.mjs with same prompt → Buffer

5. compose({bgBuffer, title, surface:'idea', accent:'lime'}):
   - load Geist Regular + Bold (cached)
   - render templates/idea.tsx via satori → SVG string
   - rasterize SVG via @resvg/resvg-js → PNG Buffer (1200×630)
   - the bgBuffer is referenced as <img> inside the JSX, sized to cover

6. write image/og/idea/{slug}.png + log line
```

## Brand consistency — the two-anchor model

Recraft drift is the single biggest failure mode for a long-running image pipeline. We anchor in two places:

| Anchor | Where it lives | Job | Failure mode if missing |
|---|---|---|---|
| **Text anchor** — `STYLE_BLUEPRINT` | `lib/og/style-blueprint.mjs`, in code | Describes terminal-photographic in words. Sent on every Recraft call AND used as prompt prefix on the OpenAI fallback (so fallback drift is bounded) | OpenAI fallback images would look completely different from Recraft images |
| **Visual anchor** — `RECRAFT_STYLE_ID` | Recraft dashboard, UUID in `.env.local` | A trained style on 3-5 reference images. Pins palette, lighting, texture, composition language across hundreds of generations | Recraft outputs vary wildly between batches; you can't get back to a previous look |

**One-time setup:** generate 5 candidate images with just the `STYLE_BLUEPRINT` (no `style_id`), pick the 3-5 best, upload them as a Recraft Style, drop the UUID into `.env.local`. The `IMAGES.md` doc walks through it. If drift later: regenerate 5, add the best to the existing style as new references — that re-anchors without changing the UUID.

### `STYLE_BLUEPRINT` v1 (terminal-photographic)

Authored in code at `lib/og/style-blueprint.mjs`. First-pass text:

> Cinematic product photography of a single object on a near-black surface, color #050505. Low-key lighting with one accent-colored light source: lime (#D4FF5B), lavender (#C5AEE8), or mint (#8FF59B), one accent per image. The subject is a tactile object — a glowing screen, a single lit terminal cursor, a phone notification, a server fan, a coffee cup beside a closed laptop, a desk under a single lamp. Shallow depth of field. Soft synthetic glow. Atmosphere of late-night focus, weekend builder at 2am. Strong negative space. No people. No faces. No visible text or letters. No 3D rendering aesthetic. No glossy gradients. No stock-photo composition.

This wording is iterated during the v1 smoke test (step 13 in the v1 task list).

## Composed-card layout (`templates/idea.tsx`)

```
[Recraft image as bg, 1200×630 cover, ~30% darken gradient bottom-up]
  ┌──────────────────────────────────────────────────┐
  │ [WMV logo, top-left, 24px]      [accent dot, top-right] │
  │                                                  │
  │                                                  │
  │   {title — Geist Bold, 56px, max 3 lines,       │
  │    autoshrinks to 48px if >60 chars,            │
  │    32px if >100 chars}                           │
  │                                                  │
  │   {category chip — accent color from manifest}   │
  │                                                  │
  │ [accent bar, 4px, full width, lime/lavender]    │
  └──────────────────────────────────────────────────┘
```

Accent color comes from the manifest entry. If absent, defaults to lime per the existing carousel layout-to-accent mapping in `content/social/_brand/palette.md`.

## Manifest schema extension

`ideas/manifest.json` entries gain an optional `og` object:

```json
{
  "slug": "agent-storefront-platform",
  "title": "Agent Storefront Platform",
  "category": "developer",
  "...existing fields...": "...",
  "og": {
    "subject": "A glowing terminal window on a dark desk at midnight, cursor blinking, single lavender screen-glow lighting the surface",
    "accent": "lavender",
    "status": "ready"
  }
}
```

| Field | Required | Default | Purpose |
|---|---|---|---|
| `og.subject` | optional | falls back to `description`, then `title` | The visual prompt subject sent to Recraft (after `STYLE_BLUEPRINT`) |
| `og.accent` | optional | `"lime"` | Which brand accent the composed card uses (lime / mint / lavender / emerald / aubergine) |
| `og.status` | optional | unset | Set by `publish-idea` to `"pending"` (queued for next batch), `"ready"` (generated successfully), or `"failed"` (last attempt errored — page shipped with site-wide fallback) |

Writing-good-`og.subject` rules go into `IMAGES.md`, mirroring the `coverAlt` guidance in `autocrew-marketing/content/blog/IMAGES.md`.

## `publish-idea` integration (graceful degradation)

The `publish-idea` skill, after writing the idea page and the manifest entry, calls the OG generator as its final step. **Recraft failure must never block the publish.**

Flow:

```
1. publish-idea writes ideas/{slug}.html
2. publish-idea writes manifest entry with og.status: "pending"
3. publish-idea sets the page's <meta property="og:image"> to the EXPECTED future path
   (image/og/idea/{slug}.png) AND <meta property="og:image:fallback" content="image/og-image.png">
4. publish-idea spawns: node scripts/generate-og-cards.mjs --slug {slug}
5. on success: generator updates manifest og.status → "ready", commits PNG. publish-idea continues.
6. on failure: generator updates manifest og.status → "failed", logs to stderr, exits 0.
   publish-idea continues unaffected. Page ships with the meta tag pointing at the path that
   doesn't exist yet — but social crawlers fall back to og-image.png, so no broken share card.
   A future og:generate run (manual or batched) will retry "failed" entries.
```

Key invariant: `publish-idea` exit status is independent of OG generation outcome. The OG step is observability-on-failure (logs + status field), not a hard gate.

## Error handling

| Failure | Behavior |
|---|---|
| `RECRAFT_API_KEY` missing | Hard exit with link to `IMAGES.md` setup section |
| `RECRAFT_STYLE_ID` missing | Warn once, continue with `style: "realistic_image"` baseline. Output gets a `[no-style-id]` log marker so you spot drift |
| Recraft 429 / 5xx / moderation reject | Log warning, fall through to `gpt-image-1`. Provider name printed per slug so you know which engine drew which file |
| Both providers fail for a slug | Log error, mark `og.status: "failed"` in manifest, continue to next slug. Final summary lists failed slugs and exits non-zero (manual run) or exits 0 (when invoked from `publish-idea`) |
| Manifest entry missing `og.subject` | Log warning, fall back to `description`, then `title`. Same fallback chain Autocrew uses |
| Satori font load fails | Hard exit (no point continuing — every card would be broken) |
| `image/og/idea/` missing | `mkdirSync recursive: true`, no error |
| Existing PNG, no `--force` | Skip silently, count toward "skipped" total |

The "exit 0 when invoked from `publish-idea`" path is controlled by a `--non-blocking` CLI flag.

## Verification

1. **Dry run** — `npm run og:generate -- --dry-run` prints the slug + subject + output path for every item, no API calls. Catches missing `og.subject` fields and path mistakes for free.
2. **Single-slug smoke test** — `npm run og:generate -- --slug agent-storefront-platform`. Manually open the resulting PNG, confirm: (a) bg is recognizably terminal-photographic, (b) title is readable at thumbnail size, (c) WMV logo + accent are present, (d) no clipped text.
3. **Thumbnail-row drift check** — open `image/og/idea/` in Finder thumbnail view after a 5-card batch. Any card that visually sticks out gets `--force` regenerated.
4. **Crawler check** — for one shipped page, run it through the LinkedIn Post Inspector + Twitter Card Validator. Confirms the `<meta og:image>` path resolves and renders at the expected size.
5. **Build gate (light)** — `scripts/check-og-cards.js` walks `ideas/manifest.json` and asserts each slug has a corresponding PNG on disk. Hooked into `STRICT=1` style — exit 0 by default, exit 1 if `STRICT=1`. Catches "you forgot to commit the PNG."

## v1 task list

1. `npm i -D satori @resvg/resvg-js sharp gray-matter` and lock versions
2. `lib/og/style-blueprint.mjs` — author the terminal-photographic blueprint paragraph (initial wording above)
3. `lib/og/fonts.mjs` — fetch + cache Geist Regular/Bold buffers
4. `lib/og/providers/recraft.mjs` + `lib/og/providers/openai.mjs` — provider modules with the same `generate()` signature
5. `lib/og/templates/idea.mjs` — Satori element tree for idea cards (plain JS object literals, no JSX/TSX — keeps the static-HTML site free of a TS/React build step), autoshrinking title, accent chip
6. `lib/og/compose.mjs` — Satori → SVG → resvg → PNG
7. `lib/og/sources/ideas.mjs` — manifest reader returning normalized items
8. `scripts/generate-og-cards.mjs` — orchestrator (CLI flags incl. `--non-blocking`, idempotency, summary, manifest `og.status` writeback)
9. `scripts/check-og-cards.js` — STRICT-mode build gate
10. Add `og:generate`, `og:generate:force`, `og:generate:dry`, `check:og-cards` to `package.json`
11. Extend `ideas/manifest.json` schema: add `og.subject`, `og.accent`, `og.status` (all optional). Backfill 5 ideas as smoke test.
12. **Manual one-time:** create Recraft style in dashboard from 3-5 generated references, drop `RECRAFT_STYLE_ID` into `.env.local` and Vercel env
13. Run generator on the 5 backfilled ideas, eyeball, iterate on `STYLE_BLUEPRINT` wording until the look is right
14. Update those 5 idea pages' `<meta property="og:image">` to point at the new PNGs
15. `IMAGES.md` doc — setup, drift recovery, prompt-writing rules, cost expectations
16. Run LinkedIn + Twitter card validators on one live page
17. Modify `publish-idea` skill to (a) write `og.status: "pending"`, (b) emit page meta tag pointing at expected path, (c) spawn `node scripts/generate-og-cards.mjs --slug {slug} --non-blocking`

## Out of v1 (separate tickets, design intentionally extensible)

- `articles/manifest.json` + `lib/og/sources/articles.mjs` + `templates/article.mjs`
- Newsletter HTML archive page OG cards via `templates/newsletter.mjs`
- Newsletter **inline email illustration** (the artwork inside the Beehiiv email body)
- Carousel slide-1 hero illustration (different aspect ratio, different template)
- Idea-page **in-page editorial illustration** (separate Recraft call from the OG card)
- `<meta name="og-subject">` scraper for one-off pages (`index.html`, `starter-kit.html`, `privacy-policy.html`)
- Hooks into `publish-article`, `publish-programmatic`, `newsletter`, `carousel` skills

## Cost back-of-envelope

- ~$0.04/card × ~50 ideas = ~$2 total for v1 backfill
- Forever-cost as you publish ~5 ideas/week = ~$0.20/week
- Negligible — optimize for quality, not cost

## Provider stack rationale (recap)

- **Primary: Recraft v3** — official API, supports `style_id` for visual consistency across hundreds of generations. Already in use successfully in `autocrew-marketing`.
- **Fallback: `gpt-image-1` (OpenAI)** — proven, ~$0.042/image, fires when Recraft errors. Style will diverge slightly (no `style_id` equivalent) but `STYLE_BLUEPRINT` text bounds the drift.
- **Midjourney: rejected.** No official API. Unofficial Discord-bridge wrappers (useapi.net, GoAPI, ImagineAPI) violate Midjourney ToS and risk account bans. If we want a stylistic alternative later, **Ideogram 3.0** or **Flux 1.1 Pro** (both with official APIs and native style references) are the safer Midjourney-substitutes.

## Open questions (parked for v1)

- Whether to add the OG generation as a Vercel build step in v2 (currently committed-to-git is sufficient)
- Whether to compose author/credit overlay for newsletter cards
- Whether to add a sparkline / metric overlay for revenue-themed idea cards
