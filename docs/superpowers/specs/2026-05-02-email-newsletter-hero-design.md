# Email Newsletter Hero — Design Spec

**Date:** 2026-05-02
**Author:** Brainstorming session (Claude Opus 4.7 + jeberulz)
**Status:** Approved for planning
**Builds on:**
- `docs/superpowers/specs/2026-05-02-recraft-og-image-pipeline-design.md` (v1)
- `docs/superpowers/specs/2026-05-02-article-og-cards-design.md` (Surface A — established per-template config)
- `docs/superpowers/specs/2026-05-02-newsletter-og-cards-design.md` (Surface B — newsletter manifest + AM/PM rule)

## Problem

The Beehiiv newsletter sends twice daily but every email body is text-only — no inline imagery to set tone or break up the scroll. A hero illustration at the top of each email gives the brand a visual signature in inboxes (where most subscribers actually consume the content) and creates parity with the per-page OG cards we just shipped.

## Non-goals

- Section-divider images mid-email (rejected as Q1B during brainstorming — too busy, doubles cost).
- Per-section illustrations (Q1C — too expensive, risks "decorated" feel).
- A separate "lighter" brand for email (Q2B/C — rejected for brand cohesion).
- Newsletter archive index OG card (deferred from Surface B).
- Carousel slide-1 hero (Surface D, separate spec).

## Decisions reached during brainstorming

| # | Question | Decision |
|---|---|---|
| Q1 | Image placement strategy | **A — Single hero at the top, 600×400 (3:2)** |
| Q2 | Visual style direction | **A — Same dark + accent brand as OG cards** (same Recraft Style ID, same prompt structure) |
| Q3a | Recraft call strategy | **A — Independent generation** per surface (one call for OG card, one for email hero); surfaces stay decoupled |
| Q3b | Backfill scope | **Yes** — backfill all 10 existing newsletters now (~$0.40) |

## Architecture

A new `email-newsletter` surface is added to the existing pipeline. It **reuses** `newsletter/manifest.json` (same source data) but produces a different output per entry: a 600×400 JPG with **no chrome** (no logo, no title, no postmark — pure Recraft scene). The newsletter skill writes a markdown image ref into the BODY section pointing at the hosted URL.

Two surfaces, one manifest, one Recraft call each:

```
newsletter/manifest.json
  └─ slug=2026-05-01-pm
      ├─ surface=newsletter         → image/og/newsletter/{slug}.png    (1200×630, postcard chrome)
      └─ surface=email-newsletter   → image/email/newsletter/{slug}.jpg (600×400, no chrome)
```

Two writeback fields (`og.status` for OG card, `og.emailStatus` for email hero) prevent surfaces from clobbering each other.

The compose pipeline gains two minor extensions (no breaking changes):
1. When a template doesn't export `buildElement`, skip Satori entirely and return the canvas directly.
2. Honor `format` from template config (`'png'` default, `'jpeg'` for email).

## Per-template config (extends the established pattern)

```js
// lib/og/templates/email-newsletter.mjs
export const config = {
  width: 600,
  height: 400,
  bgRect: { x: 0, y: 0, width: 600, height: 400 },  // full bleed (no chrome panel)
  bgFill: '#050505',
  format: 'jpeg',                                    // NEW — defaults to 'png'
  jpegQuality: 85                                    // NEW — only used if format='jpeg'
};

// NO buildElement export — compose detects this and skips Satori chrome
```

## Compose changes

Two minor extensions documented in v1 spec language:

```js
// 1. Skip chrome rendering when template has no buildElement
const element = tpl.buildElement?.({ title, accent, ... });
if (element) {
  // existing Satori → Resvg → composite path produces chromedPng
  return await sharp(canvas)
    .composite([{ input: chromedPng, top: 0, left: 0 }])
    .toFormat(...)
    .toBuffer();
}
// image-only surface — canvas IS the final output (resized Recraft scene)
return await sharp(canvas).toFormat(...).toBuffer();

// 2. Honor format from config
function applyFormat(sharpInstance, cfg) {
  if (cfg.format === 'jpeg') {
    return sharpInstance.jpeg({ quality: cfg.jpegQuality ?? 85, mozjpeg: true });
  }
  return sharpInstance.png();
}
```

Idea/article/newsletter (Surface A/B) templates keep their existing `buildElement` exports — the `?.` optional chain plus the `if (element)` branch is purely additive.

## Status writeback fields

Add a `STATUS_FIELDS` lookup parallel to MANIFEST_PATHS in `scripts/generate-og-cards.mjs`:

```js
const STATUS_FIELDS = {
  idea: 'status',
  article: 'status',
  newsletter: 'status',
  'email-newsletter': 'emailStatus'
};

// updateManifestStatus writes to entry.og[STATUS_FIELDS[surface]]
```

For the OG newsletter and email-newsletter surfaces, both write to the SAME manifest entry (same slug in `newsletter/manifest.json`) but to DIFFERENT fields (`og.status` vs `og.emailStatus`). Concurrent writes from the orchestrator's per-item loop are serialized so no race.

## Source

`lib/og/sources/email-newsletter.mjs` reads the same `newsletter/manifest.json` that the newsletter source reads, but returns items with:

```js
{
  slug,                                       // same as newsletter source
  title,                                      // same
  subject,                                    // og.subject — same as newsletter source (same Recraft prompt)
  accent,                                     // same (auto-derived from slug suffix, mint=AM, lavender=PM)
  surface: 'email-newsletter',                // distinct
  outputPath: `image/email/newsletter/${slug}.jpg`,
  status: og.emailStatus                      // reads the email-specific status field
}
```

The accent doesn't drive any visible chrome (no chrome on email hero), but it's preserved in case a future iteration wants to use it (e.g., as a Recraft style hint).

## File structure

**New:**
```
lib/og/templates/email-newsletter.mjs
lib/og/sources/email-newsletter.mjs
image/email/newsletter/.gitkeep
tests/og/templates-email-newsletter.test.mjs
tests/og/sources-email-newsletter.test.mjs
```

**Modified:**
```
lib/og/compose.mjs                       — register email-newsletter, handle "no buildElement", honor format from config
scripts/generate-og-cards.mjs            — MANIFEST_PATHS + MANIFEST_KEYS + STATUS_FIELDS gain email-newsletter; loadAllItems calls listEmailNewsletter; updateManifestStatus uses STATUS_FIELDS lookup
scripts/check-og-cards.js                — surfaces array gains email-newsletter
package.json                             — og:generate:email-newsletter script
IMAGES.md                                — document email surface
.claude/skills/newsletter/SKILL.md       — write markdown image ref into BODY + invoke email generator (gitignored)
.claude/skills/newsletter/web-publish.md — confirm BODY-section image ref placement (gitignored)
```

## Data flow

Same shape as the OG surfaces. The orchestrator iterates ALL surfaces by default; `--surface email-newsletter` filters down to just the email hero pass.

```
1. orchestrator: loadAllItems()
   listIdeas() ∪ listArticles() ∪ listNewsletter() ∪ listEmailNewsletter() → flat array
2. filter by --surface and --slug if provided
3. for each item:
   - check disk at item.outputPath
   - if exists && !force → skip
   - dry-run → log + skip
   - generateOne(subject) → bgBuffer + provider name
   - compose({bgBuffer, title, surface, accent, ...passthrough}) → png OR jpeg buffer
   - write to outputPath
   - updateManifestStatus(item.surface, item.slug, 'ready')  // writes to og.status OR og.emailStatus per STATUS_FIELDS
4. summary
```

Default behavior (`npm run og:generate` with no flags) iterates all 4 surfaces. After this surface ships, that means each newsletter slug gets two outputs (OG card + email hero).

## Brand consistency — Recraft subjects

Reuses the **exact same `og.subject`** from `newsletter/manifest.json` that the OG newsletter card uses. This is the whole point of "Strategy A independent generation": same prompt, same Style ID, two outputs at two different sizes/formats. The email hero scene will visually match the OG card scene.

The 10 existing newsletter subjects (already authored in Surface B) carry over verbatim. Examples:
- AM `2026-04-20-am`: "A coffee mug on a near-black counter with a single mint LED clock glow catching the rim, very early morning, deep shadow elsewhere"
- PM `2026-05-01-pm`: "A postcard leaning against a coffee mug on a near-black surface, single lavender light glancing across the postcard's edge, late evening"

## Newsletter skill hook (modifies `.claude/skills/newsletter/SKILL.md` — gitignored)

After Step 5b (web HTML written) but before Step 5b.1 (manifest append), prepend a markdown image ref to the BODY section that gets pasted into Beehiiv:

```markdown
![](https://weekendmvp.app/image/email/newsletter/{date}-{slot}.jpg)

{existing body content}
```

After the manifest is updated (Step 5b.1) and the OG card is generated (Step 5b.2), invoke the email surface:

```bash
node scripts/generate-og-cards.mjs --slug {date}-{slot} --surface email-newsletter --non-blocking
```

Same graceful-degradation invariant: the email gets sent regardless of generation outcome. If Recraft fails, the markdown image ref points at a missing URL — Beehiiv typically renders this as a broken image placeholder (annoying but non-fatal). A subsequent `npm run og:generate:email-newsletter` retries the failed slugs.

## Error handling

Inherits the v1 + Surface A/B pipeline behavior, with one addition:
- "No buildElement" path doesn't change error semantics — Recraft/OpenAI fallbacks, manifest writeback, `--non-blocking` exit codes all behave identically.
- Email hero failure → `og.emailStatus: "failed"`. The OG card status (`og.status`) is unaffected. Operator can retry just the email surface independently with `npm run og:generate:email-newsletter`.

## Verification

1. `npm run og:generate -- --surface email-newsletter --dry-run` → prints all 10 expected output paths, no API calls
2. `node scripts/generate-og-cards.mjs --slug 2026-05-01-pm --surface email-newsletter` → smoke test one (writes a single 600×400 JPG)
3. `sharp image/email/newsletter/2026-05-01-pm.jpg --metadata` (or `file` command) → confirms 600×400 JPG output
4. Open thumbnail row of `image/email/newsletter/` after batch — eyeball brand consistency + AM/PM atmosphere
5. Verify `STRICT=1 npm run check:og-cards` exits 0 once all 10 email PNGs are committed alongside the existing surfaces (4 surfaces × ~10-20 entries each)
6. Send a test newsletter through Beehiiv to confirm the markdown image ref renders as a full-width hero in Gmail / Apple Mail

## v1 task list

1. Add `og:generate:email-newsletter` script to `package.json` + create `image/email/newsletter/.gitkeep`
2. Create `lib/og/templates/email-newsletter.mjs` — config only (600×400 JPG, no buildElement) + 2 tests asserting config shape and absence of buildElement
3. Create `lib/og/sources/email-newsletter.mjs` — reads `newsletter/manifest.json`, returns items with surface='email-newsletter', JPG outputPath, status from `og.emailStatus` + 5 tests
4. Update `lib/og/compose.mjs` — register email-newsletter; handle "no buildElement" code path; honor format from config (PNG default, JPEG when `format: 'jpeg'`); update compose tests to cover the no-chrome JPG path
5. Update `scripts/generate-og-cards.mjs` — add email-newsletter to MANIFEST_PATHS / MANIFEST_KEYS / STATUS_FIELDS; refactor `updateManifestStatus` to use STATUS_FIELDS lookup; add listEmailNewsletter to loadAllItems; tests
6. Update `scripts/check-og-cards.js` — add email-newsletter to surfaces array (note: shares manifest with newsletter surface, but checks a different pngDir extension)
7. Manual: run `npm run og:generate:email-newsletter` (10 Recraft calls, ~$0.40), eyeball thumbnail row
8. Update `IMAGES.md` to document the email surface + the no-chrome / JPG path / dual-status-field pattern
9. Hook `newsletter` skill (gitignored, local only) — prepend markdown image ref to BODY section + invoke email generator with `--non-blocking`

## Out of scope (next surfaces / follow-ups)

- Carousel slide-1 hero (Surface D, separate spec)
- Per-section divider illustrations (Q1B from brainstorming, deferred)
- Newsletter archive index OG card (deferred from Surface B)

## Cost

- Backfill: 10 × $0.04 = ~$0.40
- Forever-cost at twice-daily cadence: ~$0.56/week (newsletter email surface only) → ~$1.12/week newsletter total when combined with OG cards
