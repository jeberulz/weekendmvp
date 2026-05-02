# Newsletter OG Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-newsletter OG card surface (postcard layout, AM/PM accent rule) to the existing pipeline, register it through the established per-template config pattern, and backfill 10 cards for already-published newsletters.

**Architecture:** New `newsletter` surface is a 3-file addition (template + source + manifest) following the per-template config pattern from Surface A. Postcard layout: top 60% Recraft scene with a postmark circle in the top-right; bottom 40% solid `#050505` panel with WMV mark + meta line + title in Geist Bold + accent bar. AM = mint, PM = lavender, auto-derived from the slug suffix in the source module. Compose gains a small pass-through to thread `edition` + `publishedAt` to the template — harmless on idea/article templates which ignore the extra fields.

**Tech Stack:** Same as v1 + Surface A (Node 20+ ESM, satori, @resvg/resvg-js, sharp, Geist + Geist Mono via @fontsource, node:test).

**Spec:** `docs/superpowers/specs/2026-05-02-newsletter-og-cards-design.md`

---

## File Structure

**New files:**
```
lib/og/templates/newsletter.mjs              — buildElement + config (postcard layout, top-60% bgRect)
lib/og/sources/newsletter.mjs                — listNewsletter() + deriveAccent + edition extraction
newsletter/manifest.json                     — 10 backfilled entries (created in Task 7)
tests/og/templates-newsletter.test.mjs
tests/og/sources-newsletter.test.mjs
tests/og/fixtures/newsletter-manifest-fixture.json
image/og/newsletter/.gitkeep
```

**Modified files:**
```
lib/og/compose.mjs                           — register newsletter template, thread edition + publishedAt
lib/og/templates/idea.mjs                    — buildElement signature accepts (and ignores) extra args
lib/og/templates/article.mjs                 — buildElement signature accepts (and ignores) extra args
scripts/generate-og-cards.mjs                — add newsletter to MANIFEST_PATHS, MANIFEST_KEYS, loadAllItems; pass edition + publishedAt to compose
scripts/check-og-cards.js                    — add newsletter to surfaces array
package.json                                 — add `og:generate:newsletter` convenience script
newsletter/{slug}.html × 10                  — og:image / twitter:image / JSON-LD image meta
IMAGES.md                                    — document newsletter surface + AM/PM rule
.claude/skills/newsletter/SKILL.md           — hook OG card step (gitignored, local only)
```

**Why this shape:** Same boundaries as Surface A — template owns layout, source owns manifest reading + accent derivation, compose stays surface-agnostic. The compose pass-through of `edition` + `publishedAt` is the only API surface change; idea/article templates simply destructure the args they care about and ignore the rest.

---

## Task 1: Add `og:generate:newsletter` script + create output dir

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the npm script**

In `package.json`, the `scripts` block should gain one entry alongside the existing `og:generate:ideas` and `og:generate:articles`:

```json
"og:generate:newsletter": "node scripts/generate-og-cards.mjs --surface newsletter",
```

Final scripts block:

```json
"scripts": {
  "dev": "python3 -m http.server 5173",
  "vercel:dev": "vercel dev --listen 5173",
  "build": "npm run build:css",
  "build:css": "tailwindcss -i ./src/input.css -o ./styles.css --minify",
  "watch:css": "tailwindcss -i ./src/input.css -o ./styles.css --watch",
  "check:links": "node scripts/check-internal-links.js",
  "check:stylesheets": "node scripts/report-missing-stylesheets.js",
  "check:og-cards": "node scripts/check-og-cards.js",
  "inject-analytics": "node scripts/inject-analytics.js",
  "og:generate": "node scripts/generate-og-cards.mjs",
  "og:generate:force": "node scripts/generate-og-cards.mjs --force",
  "og:generate:dry": "node scripts/generate-og-cards.mjs --dry-run",
  "og:generate:ideas": "node scripts/generate-og-cards.mjs --surface idea",
  "og:generate:articles": "node scripts/generate-og-cards.mjs --surface article",
  "og:generate:newsletter": "node scripts/generate-og-cards.mjs --surface newsletter",
  "test:og": "node --test tests/og/"
}
```

- [ ] **Step 2: Create the output dir placeholder**

```bash
mkdir -p image/og/newsletter
touch image/og/newsletter/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add package.json image/og/newsletter/.gitkeep
git commit -m "newsletter-og: add og:generate:newsletter script + output dir"
```

---

## Task 2: Create the newsletter source (`lib/og/sources/newsletter.mjs`)

**Files:**
- Create: `lib/og/sources/newsletter.mjs`
- Create: `tests/og/fixtures/newsletter-manifest-fixture.json`
- Test: `tests/og/sources-newsletter.test.mjs`

The source's job: read `newsletter/manifest.json`, return one normalized item per entry with `surface: 'newsletter'`, `accent` derived from slug suffix (am→mint, pm→lavender), and `edition` extracted from the same suffix. Manifest can override `og.accent` if needed.

- [ ] **Step 1: Create the test fixture**

Create `tests/og/fixtures/newsletter-manifest-fixture.json`:

```json
{
  "newsletters": [
    {
      "slug": "2026-05-01-am",
      "title": "AM Sample Title",
      "publishedAt": "2026-05-01",
      "edition": "am",
      "description": "AM fallback description.",
      "og": {
        "subject": "An AM-specific director's note"
      }
    },
    {
      "slug": "2026-05-01-pm",
      "title": "PM Sample Title",
      "publishedAt": "2026-05-01",
      "edition": "pm",
      "description": "PM fallback description."
    },
    {
      "slug": "2026-05-02-am",
      "title": "Bare AM Title Only"
    },
    {
      "slug": "2026-05-03-pm",
      "title": "PM With Manual Accent Override",
      "edition": "pm",
      "og": { "accent": "lime" }
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/og/sources-newsletter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listNewsletter, deriveAccent } from '../../lib/og/sources/newsletter.mjs';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/newsletter-manifest-fixture.json'
);

test('deriveAccent maps slug suffix to brand accent', () => {
  assert.equal(deriveAccent('2026-05-01-am'), 'mint');
  assert.equal(deriveAccent('2026-05-01-pm'), 'lavender');
  assert.equal(deriveAccent('weird-slug'), 'lime', 'fallback for unknown suffix');
});

test('listNewsletter returns one item per newsletter', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.length, 4);
});

test('listNewsletter uses og.subject when present, falls back through description→title', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  const am = items.find((i) => i.slug === '2026-05-01-am');
  const pm = items.find((i) => i.slug === '2026-05-01-pm');
  const bare = items.find((i) => i.slug === '2026-05-02-am');

  assert.equal(am.subject, "An AM-specific director's note");
  assert.equal(pm.subject, 'PM fallback description.');
  assert.equal(bare.subject, 'Bare AM Title Only');
});

test('listNewsletter auto-derives accent from slug (am→mint, pm→lavender)', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.find((i) => i.slug === '2026-05-01-am').accent, 'mint');
  assert.equal(items.find((i) => i.slug === '2026-05-01-pm').accent, 'lavender');
  assert.equal(items.find((i) => i.slug === '2026-05-02-am').accent, 'mint');
});

test('listNewsletter respects og.accent override when present', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  const overridden = items.find((i) => i.slug === '2026-05-03-pm');
  assert.equal(overridden.accent, 'lime', 'manifest override beats deriveAccent');
});

test('listNewsletter sets surface, edition, publishedAt, outputPath on every item', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'newsletter');
    assert.ok(item.edition === 'am' || item.edition === 'pm', `edition must be am or pm for ${item.slug}`);
    assert.equal(item.outputPath, `image/og/newsletter/${item.slug}.png`);
    assert.ok(item.title);
  }
  // publishedAt should be present when manifest has it
  assert.equal(items.find((i) => i.slug === '2026-05-01-am').publishedAt, '2026-05-01');
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
node --test tests/og/sources-newsletter.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement the module**

Create `lib/og/sources/newsletter.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_MANIFEST = join(process.cwd(), 'newsletter/manifest.json');
const DEFAULT_ACCENT = 'lime';

// Maps slug suffix to brand accent. Newsletter slugs end in `-am` or `-pm`,
// which determines the time-of-day accent rule (mint = morning, lavender =
// evening). Anything else falls back to lime — should not hit for valid
// newsletter slugs but keeps the function total.
export function deriveAccent(slug) {
  if (slug.endsWith('-am')) return 'mint';
  if (slug.endsWith('-pm')) return 'lavender';
  return DEFAULT_ACCENT;
}

function deriveEdition(slug, fallback) {
  if (slug.endsWith('-am')) return 'am';
  if (slug.endsWith('-pm')) return 'pm';
  return fallback;
}

export async function listNewsletter({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.newsletters)) {
    throw new Error(`manifest at ${manifestPath} has no "newsletters" array`);
  }
  return manifest.newsletters.map((entry) => {
    const og = entry.og ?? {};
    const subject = og.subject ?? entry.description ?? entry.title;
    const accent = og.accent ?? deriveAccent(entry.slug);
    const edition = deriveEdition(entry.slug, entry.edition);
    return {
      slug: entry.slug,
      title: entry.title,
      subject,
      accent,
      edition,
      publishedAt: entry.publishedAt,
      surface: 'newsletter',
      outputPath: `image/og/newsletter/${entry.slug}.png`,
      status: og.status
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
node --test tests/og/sources-newsletter.test.mjs
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Run the full OG suite for regressions**

```bash
npm run test:og
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/og/sources/newsletter.mjs tests/og/sources-newsletter.test.mjs tests/og/fixtures/newsletter-manifest-fixture.json
git commit -m "newsletter-og: add newsletter manifest source w/ AM/PM accent derivation"
```

---

## Task 3: Create the newsletter template (`lib/og/templates/newsletter.mjs`)

**Files:**
- Create: `lib/og/templates/newsletter.mjs`
- Test: `tests/og/templates-newsletter.test.mjs`

Postcard layout. Recraft scene fills the top 60% (compose places it via `bgRect`). The Satori chrome covers the full 1200×630 frame and renders: a postmark circle in the top-right of the Recraft area, the bottom 40% solid `#050505` panel with WMV mark + 2-line meta in Geist Mono on the left, title in Geist Bold on the right, and a 4px accent bar at the very bottom.

- [ ] **Step 1: Write the failing test**

Create `tests/og/templates-newsletter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildElement,
  ACCENTS,
  pickTitleFontSize,
  formatPostmarkDate,
  config
} from '../../lib/og/templates/newsletter.mjs';

test('ACCENTS mirrors the brand palette', () => {
  for (const k of ['lime', 'mint', 'lavender', 'emerald', 'aubergine']) {
    assert.ok(ACCENTS[k], `missing ${k}`);
    assert.match(ACCENTS[k], /^#[0-9A-F]{6}$/i);
  }
});

test('pickTitleFontSize uses postcard breakpoints (40/48/60)', () => {
  // Bottom panel right column has ~700px usable, narrower than article panel.
  assert.equal(pickTitleFontSize('Short'), 60);
  assert.equal(pickTitleFontSize('A medium-length newsletter title here today'), 48);
  assert.equal(pickTitleFontSize('A really really really long newsletter title that surpasses seventy characters in total'), 40);
});

test('config has top-60% bgRect for horizontal split', () => {
  assert.equal(config.width, 1200);
  assert.equal(config.height, 630);
  assert.deepEqual(config.bgRect, { x: 0, y: 0, width: 1200, height: 378 });
  assert.equal(config.bgFill, '#050505');
});

test('formatPostmarkDate renders YYYY-MM-DD as MMM·DD·YY', () => {
  assert.equal(formatPostmarkDate('2026-05-01'), 'MAY · 01 · 26');
  assert.equal(formatPostmarkDate('2026-04-23'), 'APR · 23 · 26');
  assert.equal(formatPostmarkDate('2026-12-31'), 'DEC · 31 · 26');
});

test('formatPostmarkDate falls back gracefully on missing/invalid input', () => {
  assert.equal(formatPostmarkDate(undefined), '');
  assert.equal(formatPostmarkDate(''), '');
  assert.equal(formatPostmarkDate('not-a-date'), '');
});

test('buildElement returns 1200x630 element tree with postmark + meta + title', () => {
  const el = buildElement({
    title: 'This week in AI: 8 things you may have missed',
    accent: 'lavender',
    edition: 'pm',
    publishedAt: '2026-05-01'
  });
  assert.equal(el.type, 'div');
  assert.equal(el.props.style.width, 1200);
  assert.equal(el.props.style.height, 630);

  const json = JSON.stringify(el);
  assert.ok(json.includes('This week in AI'), 'title not found');
  assert.ok(json.includes('PM'), 'PM letters not in postmark');
  assert.ok(json.includes('PM EDITION'), 'PM EDITION label not in meta line');
  assert.ok(json.includes('FROM: WEEKEND MVP'), 'FROM line not present');
  assert.ok(json.includes('2026·05·01'), 'YYYY-MM-DD meta not rendered with middle dots');
  assert.ok(json.includes('MAY · 01 · 26'), 'postmark date not rendered with MMM·DD·YY');
  assert.ok(json.includes('#C5AEE8'), 'lavender accent not used');
  assert.ok(json.includes('GeistMono'), 'Geist Mono not used in chrome');
});

test('buildElement renders AM EDITION + mint accent for AM newsletters', () => {
  const el = buildElement({
    title: 'Idea of the Day: AI Resume Tailorer',
    accent: 'mint',
    edition: 'am',
    publishedAt: '2026-04-20'
  });
  const json = JSON.stringify(el);
  assert.ok(json.includes('AM EDITION'), 'AM EDITION not rendered');
  assert.ok(json.includes('"AM"') || json.includes('>AM<'), 'AM letters not in postmark center');
  assert.ok(json.includes('#8FF59B'), 'mint accent not used');
});

test('buildElement falls back gracefully when edition/publishedAt missing', () => {
  const el = buildElement({
    title: 'X',
    accent: 'lavender'
    // no edition, no publishedAt
  });
  // Should not throw, should still produce a valid tree.
  assert.equal(el.type, 'div');
  const json = JSON.stringify(el);
  assert.ok(json.includes('FROM: WEEKEND MVP'));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/templates-newsletter.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the template**

Create `lib/og/templates/newsletter.mjs`:

```js
// Same brand accents as the idea/article templates.
export const ACCENTS = {
  lime: '#D4FF5B',
  mint: '#8FF59B',
  lavender: '#C5AEE8',
  emerald: '#2F5F53',
  aubergine: '#1E1B38'
};

// Bottom panel right column has ~700px usable (after left meta column).
// Three breakpoints tuned for that width.
export function pickTitleFontSize(title) {
  const len = title.length;
  if (len <= 30) return 60;
  if (len <= 70) return 48;
  return 40;
}

// Per-template canvas config consumed by compose.mjs.
// Newsletter cards split horizontally: top 60% (378px) Recraft scene,
// bottom 40% (252px) solid #050505 panel for typography.
export const config = {
  width: 1200,
  height: 630,
  bgRect: { x: 0, y: 0, width: 1200, height: 378 },
  bgFill: '#050505'
};

// Helper to build a Satori-compatible element. Same el() shape used by the
// other templates — Satori reads {type, props} like React VDOM but does not
// require React. Empty children arrays are omitted because Satori treats them
// as multi-child and demands display:flex.
function el(type, props = {}, ...children) {
  if (children.length === 0) return { type, props };
  const c = children.length === 1 ? children[0] : children;
  return { type, props: { ...props, children: c } };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Renders YYYY-MM-DD as "MMM · DD · YY" for the postmark center. Returns
// empty string on missing/invalid input so the template degrades gracefully.
export function formatPostmarkDate(iso) {
  if (typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const [, year, monthNum, day] = m;
  const month = MONTHS[parseInt(monthNum, 10) - 1];
  if (!month) return '';
  const yy = year.slice(2);
  return `${month} · ${day} · ${yy}`;
}

// Renders YYYY-MM-DD as "YYYY·MM·DD" for the bottom-panel meta line. Falls
// back to empty string on missing/invalid input.
function formatMetaDate(iso) {
  if (typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[1]}·${m[2]}·${m[3]}`;
}

// Postcard surface dimensions.
const POSTMARK_DIAMETER = 120;
const POSTMARK_INNER_DIAMETER = 90;
const PANEL_HEIGHT = 252;            // bottom 40% of 630
const PANEL_PADDING = 56;
const META_COLUMN_WIDTH = 400;
const ACCENT_BAR_HEIGHT = 4;

// Logo dimensions (matches other templates — Geist logo is 771x98).
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((771 / 98) * LOGO_HEIGHT);

export function buildElement({ title, accent, edition, publishedAt, logoDataUrl }) {
  const accentHex = ACCENTS[accent] ?? ACCENTS.lime;
  const titleSize = pickTitleFontSize(title);
  const editionLabel = edition === 'am' ? 'AM' : edition === 'pm' ? 'PM' : '';
  const editionLine = editionLabel ? `${editionLabel} EDITION` : '';
  const postmarkDate = formatPostmarkDate(publishedAt);
  const metaDate = formatMetaDate(publishedAt);
  const metaSecondLine = [metaDate, editionLine].filter(Boolean).join(' · ');

  return el(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // Transparent root — sharp composites this chrome over the surface
        // canvas (which already has the Recraft bg placed in the top 60%
        // and #050505 fill in the bottom 40%).
        color: '#FFFFFF',
        fontFamily: 'Geist'
      }
    },
    // Postmark circle — top-right of the Recraft area
    el(
      'div',
      {
        style: {
          position: 'absolute',
          top: 56,
          right: 56,
          width: POSTMARK_DIAMETER,
          height: POSTMARK_DIAMETER,
          borderRadius: POSTMARK_DIAMETER / 2,
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: accentHex,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      },
      el(
        'div',
        {
          style: {
            width: POSTMARK_INNER_DIAMETER,
            height: POSTMARK_INNER_DIAMETER,
            borderRadius: POSTMARK_INNER_DIAMETER / 2,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: accentHex,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }
        },
        el(
          'div',
          {
            style: {
              fontFamily: 'GeistMono',
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: 1,
              color: accentHex,
              lineHeight: 1
            }
          },
          editionLabel || '·'
        ),
        el(
          'div',
          {
            style: {
              marginTop: 6,
              fontFamily: 'GeistMono',
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: 1.5,
              color: accentHex
            }
          },
          postmarkDate
        )
      )
    ),
    // Spacer to push the bottom panel to the bottom 40%
    el('div', { style: { flex: 1 } }),
    // Bottom panel: meta column + title column
    el(
      'div',
      {
        style: {
          width: 1200,
          height: PANEL_HEIGHT,
          display: 'flex',
          flexDirection: 'row',
          padding: PANEL_PADDING,
          // Note: the canvas already provides the #050505 fill in this region
          // (compose puts Recraft in top 378px, #050505 in bottom 252px).
          // Setting backgroundColor here would be redundant but harmless.
        }
      },
      // Left column: WMV mark + 2-line meta in Geist Mono
      el(
        'div',
        {
          style: {
            width: META_COLUMN_WIDTH,
            display: 'flex',
            flexDirection: 'column'
          }
        },
        logoDataUrl
          ? el('img', {
              src: logoDataUrl,
              width: LOGO_WIDTH,
              height: LOGO_HEIGHT,
              style: { width: LOGO_WIDTH, height: LOGO_HEIGHT }
            })
          : el(
              'div',
              {
                style: {
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: -0.4,
                  color: '#FFFFFF'
                }
              },
              'WEEKEND MVP'
            ),
        el(
          'div',
          {
            style: {
              marginTop: 18,
              fontFamily: 'GeistMono',
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: 1.5,
              color: '#A1A1AA',
              display: 'flex',
              flexDirection: 'column'
            }
          },
          el('div', { style: { color: '#A1A1AA' } }, 'FROM: WEEKEND MVP'),
          el('div', { style: { marginTop: 4, color: accentHex } }, metaSecondLine)
        )
      ),
      // Right column: title (Geist Bold, autoshrunk)
      el(
        'div',
        {
          style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center'
          }
        },
        el(
          'div',
          {
            style: {
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.0,
              color: '#FFFFFF',
              display: 'flex'
            }
          },
          title
        )
      )
    ),
    // Bottom 4px accent bar
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 1200,
        height: ACCENT_BAR_HEIGHT,
        backgroundColor: accentHex
      }
    })
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/templates-newsletter.test.mjs
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Run full OG suite for regressions**

```bash
npm run test:og
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/og/templates/newsletter.mjs tests/og/templates-newsletter.test.mjs
git commit -m "newsletter-og: add postcard template (postmark + horizontal split)"
```

---

## Task 4: Register newsletter in compose + thread `edition` + `publishedAt`

**Files:**
- Modify: `lib/og/compose.mjs`
- Modify: `tests/og/compose.test.mjs`

`compose.mjs` currently destructures `{bgBuffer, title, surface, accent, readMinutes}`. Extend to accept `edition` and `publishedAt` and pass them through to the template. Idea/article templates ignore them silently (their `buildElement` only destructures the args it needs).

- [ ] **Step 1: Add a test that compose handles surface=newsletter end-to-end**

Append to `tests/og/compose.test.mjs` (keep all existing tests):

```js
test('compose returns 1200x630 PNG for surface=newsletter (with edition + publishedAt)', async () => {
  const png = await compose({
    bgBuffer: await fakeBg(),
    title: 'Sample Newsletter Title',
    surface: 'newsletter',
    accent: 'mint',
    edition: 'am',
    publishedAt: '2026-05-01'
  });
  assert.ok(Buffer.isBuffer(png));
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test('newsletter composite places Recraft bg in top 60% (bottom 40% stays solid)', async () => {
  // Bright RED Recraft stand-in. Top 60% should be dominantly red, bottom
  // 40% should be near-black from the #050505 fill.
  const redBg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();

  const png = await compose({
    bgBuffer: redBg,
    title: 'Newsletter Layout Test',
    surface: 'newsletter',
    accent: 'lavender',
    edition: 'pm',
    publishedAt: '2026-05-02'
  });

  const raw = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const channels = info.channels;

  // Sample top-center pixel (x=600, y=120) — should be dominantly red.
  // Avoid the postmark area (top:56, right:56, 120px circle = roughly x=1024-1144, y=56-176).
  const topIdx = (120 * info.width + 600) * channels;
  const topRed = data[topIdx];
  assert.ok(topRed > 200, `top area should show red Recraft bg, got R=${topRed}`);

  // Sample bottom-center pixel (x=600, y=500) — should be near-black.
  // Avoid the bottom 4px accent bar (y=626-630).
  const bottomIdx = (500 * info.width + 600) * channels;
  const bottomRed = data[bottomIdx];
  assert.ok(bottomRed < 30, `bottom panel should be near-black, got R=${bottomRed}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/compose.test.mjs
```

Expected: FAIL — `compose: unknown surface "newsletter"` (template not registered yet).

- [ ] **Step 3: Replace `lib/og/compose.mjs`**

Replace the entire contents with:

```js
import satori from 'satori';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.mjs';
import { loadLogoDataUrl } from './assets.mjs';
import * as ideaTemplate from './templates/idea.mjs';
import * as articleTemplate from './templates/article.mjs';
import * as newsletterTemplate from './templates/newsletter.mjs';

const TEMPLATES = {
  idea: ideaTemplate,
  article: articleTemplate,
  newsletter: newsletterTemplate
  // carousel — added in follow-up surfaces
};

// Surface-agnostic 2-pass composite:
//   1. sharp resizes the Recraft bg to template.config.bgRect dimensions
//   2. sharp builds a frame-sized canvas, places fittedBg at bgRect offset
//   3. Satori renders the chrome (transparent root) at full frame size
//   4. sharp composites the chrome PNG over the canvas
//
// Each template encodes its own layout intent in `config` (canvas dims,
// where Recraft goes, what fills the rest). Compose has no per-surface
// branching beyond looking up the template.
export async function compose({
  bgBuffer,
  title,
  surface,
  accent,
  readMinutes,
  edition,
  publishedAt
}) {
  const tpl = TEMPLATES[surface];
  if (!tpl) {
    throw new Error(`compose: unknown surface "${surface}"`);
  }
  const cfg = tpl.config;

  const [fonts, logoDataUrl] = await Promise.all([
    loadFonts(),
    loadLogoDataUrl({ height: 28, color: '#FFFFFF' })
  ]);

  // 1. Resize Recraft to bgRect dimensions
  const fittedBg = await sharp(bgBuffer)
    .resize(cfg.bgRect.width, cfg.bgRect.height, {
      fit: 'cover',
      position: 'centre'
    })
    .png()
    .toBuffer();

  // 2. Build the frame canvas, place fittedBg at bgRect offset
  const canvas = await sharp({
    create: {
      width: cfg.width,
      height: cfg.height,
      channels: 3,
      background: cfg.bgFill
    }
  })
    .composite([{ input: fittedBg, left: cfg.bgRect.x, top: cfg.bgRect.y }])
    .png()
    .toBuffer();

  // 3. Render chrome over a transparent root.
  // Templates destructure only the fields they need (idea ignores
  // readMinutes/edition/publishedAt; article ignores edition/publishedAt;
  // newsletter ignores readMinutes). Passing extras through is harmless.
  const element = tpl.buildElement({
    title,
    accent,
    logoDataUrl,
    readMinutes,
    edition,
    publishedAt
  });
  const svg = await satori(element, {
    width: cfg.width,
    height: cfg.height,
    fonts
  });
  const chromePng = new Resvg(svg, {
    fitTo: { mode: 'width', value: cfg.width },
    background: 'rgba(0, 0, 0, 0)'
  })
    .render()
    .asPng();

  // 4. Composite chrome over the canvas
  return await sharp(canvas)
    .composite([{ input: chromePng, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/compose.test.mjs
```

Expected: PASS, all tests including the 2 new newsletter tests.

- [ ] **Step 5: Run full OG suite to confirm no regressions**

```bash
npm run test:og
```

Expected: all tests pass. Idea + article surfaces still work (their templates harmlessly ignore the new args).

- [ ] **Step 6: Commit**

```bash
git add lib/og/compose.mjs tests/og/compose.test.mjs
git commit -m "newsletter-og: register newsletter template + thread edition+publishedAt"
```

---

## Task 5: Add newsletter to orchestrator

**Files:**
- Modify: `scripts/generate-og-cards.mjs`
- Modify: `tests/og/orchestrator.test.mjs`

Add `newsletter` to the `MANIFEST_PATHS` and `MANIFEST_KEYS` lookup tables, import `listNewsletter`, add it to `loadAllItems`, and pass `edition` + `publishedAt` to compose.

- [ ] **Step 1: Add an orchestrator test for newsletter writeback**

Append to `tests/og/orchestrator.test.mjs` (keep all existing tests):

```js
test('updateManifestStatus writes to newsletter/manifest.json for surface=newsletter', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  const path = join(dir, 'newsletter/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [{ slug: '2026-05-01-am', title: 'AM', edition: 'am' }]
    }, null, 2)
  );

  await updateManifestStatus('newsletter', '2026-05-01-am', 'ready', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const entry = json.newsletters.find((i) => i.slug === '2026-05-01-am');
  assert.equal(entry.og.status, 'ready', 'creates og block when missing and sets status');
  assert.equal(entry.title, 'AM', 'preserves non-og fields');
  assert.equal(entry.edition, 'am', 'preserves edition');

  await rm(dir, { recursive: true, force: true });
});

test('parseArgs handles --surface newsletter', () => {
  const opts = parseArgs(['--surface', 'newsletter']);
  assert.equal(opts.surface, 'newsletter');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/orchestrator.test.mjs
```

Expected: FAIL — `updateManifestStatus` doesn't know about `newsletter` surface yet.

- [ ] **Step 3: Update `scripts/generate-og-cards.mjs`**

Make these specific changes to the existing file:

(a) Replace the import line near the top:

```js
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { listArticles } from '../lib/og/sources/articles.mjs';
```

with:

```js
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { listArticles } from '../lib/og/sources/articles.mjs';
import { listNewsletter } from '../lib/og/sources/newsletter.mjs';
```

(b) Replace the `MANIFEST_PATHS` and `MANIFEST_KEYS` declarations with:

```js
// Surface → manifest path (relative to root). Each source returns items with
// item.surface set, so this is just a lookup table for status writeback.
const MANIFEST_PATHS = {
  idea: 'ideas/manifest.json',
  article: 'articles/manifest.json',
  newsletter: 'newsletter/manifest.json'
};

// Surface → manifest top-level array key (idea→ideas, article→articles, newsletter→newsletters).
const MANIFEST_KEYS = {
  idea: 'ideas',
  article: 'articles',
  newsletter: 'newsletters'
};
```

(c) In the `loadAllItems()` function, add a third `tryLoad` call. Replace:

```js
async function loadAllItems() {
  const items = [];
  const tryLoad = async (loader) => {
    try {
      const list = await loader();
      items.push(...list);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // missing manifest is OK — surface just contributes zero items
    }
  };
  await tryLoad(listIdeas);
  await tryLoad(listArticles);
  return items;
}
```

with:

```js
async function loadAllItems() {
  const items = [];
  const tryLoad = async (loader) => {
    try {
      const list = await loader();
      items.push(...list);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // missing manifest is OK — surface just contributes zero items
    }
  };
  await tryLoad(listIdeas);
  await tryLoad(listArticles);
  await tryLoad(listNewsletter);
  return items;
}
```

(d) In `main()`, find the existing `compose({...})` call and update it to also pass `edition` + `publishedAt`. Replace:

```js
      const png = await compose({
        bgBuffer: bg,
        title: item.title,
        surface: item.surface,
        accent: item.accent,
        readMinutes: item.readMinutes
      });
```

with:

```js
      const png = await compose({
        bgBuffer: bg,
        title: item.title,
        surface: item.surface,
        accent: item.accent,
        readMinutes: item.readMinutes,
        edition: item.edition,
        publishedAt: item.publishedAt
      });
```

- [ ] **Step 4: Run orchestrator tests**

```bash
node --test tests/og/orchestrator.test.mjs
```

Expected: PASS, all tests including the 2 new newsletter tests.

- [ ] **Step 5: Smoke test with the dry-run flag**

The newsletter manifest doesn't exist yet (Task 7 creates it), so the dry-run should produce zero newsletter items and skip cleanly:

```bash
node scripts/generate-og-cards.mjs --dry-run --surface newsletter
```

Expected output:
```
No items to process.
```

(The orchestrator gracefully handles ENOENT in `loadAllItems` and shows zero items after filtering by `--surface newsletter`.)

- [ ] **Step 6: Run full OG suite**

```bash
npm run test:og
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-og-cards.mjs tests/og/orchestrator.test.mjs
git commit -m "newsletter-og: orchestrator iterates newsletter surface + dual writeback"
```

---

## Task 6: Add newsletter to the dual-manifest build gate

**Files:**
- Modify: `scripts/check-og-cards.js`
- Modify: `tests/og/check-og-cards.test.mjs`

The build gate currently walks idea + article surfaces. Extend the `surfaces` array config to include newsletter.

- [ ] **Step 1: Update the test for triple-surface behavior**

Replace `tests/og/check-og-cards.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(process.cwd(), 'scripts/check-og-cards.js');

function runIn(dir, env = {}) {
  return spawnSync('node', [SCRIPT], {
    cwd: dir,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function setupDir({ ideaPng = false, articlePng = false, newsletterPng = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'og-check-'));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  mkdirSync(join(dir, 'articles'), { recursive: true });
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  mkdirSync(join(dir, 'image/og/idea'), { recursive: true });
  mkdirSync(join(dir, 'image/og/article'), { recursive: true });
  mkdirSync(join(dir, 'image/og/newsletter'), { recursive: true });
  writeFileSync(
    join(dir, 'ideas/manifest.json'),
    JSON.stringify({ ideas: [{ slug: 'idea-one', title: 'Idea One' }] })
  );
  writeFileSync(
    join(dir, 'articles/manifest.json'),
    JSON.stringify({ articles: [{ slug: 'article-one', title: 'Article One' }] })
  );
  writeFileSync(
    join(dir, 'newsletter/manifest.json'),
    JSON.stringify({ newsletters: [{ slug: '2026-05-01-am', title: 'Newsletter One' }] })
  );
  if (ideaPng) writeFileSync(join(dir, 'image/og/idea/idea-one.png'), 'fake');
  if (articlePng) writeFileSync(join(dir, 'image/og/article/article-one.png'), 'fake');
  if (newsletterPng) writeFileSync(join(dir, 'image/og/newsletter/2026-05-01-am.png'), 'fake');
  return dir;
}

test('exits 0 by default when PNGs missing (warn-only)', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /missing/i);
});

test('exits 1 with STRICT=1 when any PNG missing (idea + article present, newsletter missing)', () => {
  const dir = setupDir({ ideaPng: true, articlePng: true, newsletterPng: false });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 1);
});

test('exits 0 with STRICT=1 when all PNGs present across all 3 surfaces', () => {
  const dir = setupDir({ ideaPng: true, articlePng: true, newsletterPng: true });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 0);
});

test('reports missing slugs broken down by all 3 surfaces', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.match(r.stdout, /idea/);
  assert.match(r.stdout, /article/);
  assert.match(r.stdout, /newsletter/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/check-og-cards.test.mjs
```

Expected: FAIL — script doesn't know about newsletter surface yet.

- [ ] **Step 3: Update `scripts/check-og-cards.js`**

Replace the `surfaces` array declaration. Find this:

```js
const surfaces = [
  { name: 'idea', manifest: 'ideas/manifest.json', listKey: 'ideas', pngDir: 'image/og/idea' },
  { name: 'article', manifest: 'articles/manifest.json', listKey: 'articles', pngDir: 'image/og/article' }
];
```

Replace with:

```js
const surfaces = [
  { name: 'idea', manifest: 'ideas/manifest.json', listKey: 'ideas', pngDir: 'image/og/idea' },
  { name: 'article', manifest: 'articles/manifest.json', listKey: 'articles', pngDir: 'image/og/article' },
  { name: 'newsletter', manifest: 'newsletter/manifest.json', listKey: 'newsletters', pngDir: 'image/og/newsletter' }
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/check-og-cards.test.mjs
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Run against the real project**

```bash
npm run check:og-cards
```

Expected output (newsletter manifest doesn't exist yet — Task 7 creates it):
```
og-cards: ... idea entries ... (some present, some missing depending on current state)
og-cards: all 15 article entries have OG cards
og-cards: no manifest at newsletter/manifest.json — skipping newsletter surface.
```

- [ ] **Step 6: Run full OG suite**

```bash
npm run test:og
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-og-cards.js tests/og/check-og-cards.test.mjs
git commit -m "newsletter-og: check:og-cards walks newsletter surface"
```

---

## Task 7: Author `newsletter/manifest.json` with 10 entries

**Files:**
- Create: `newsletter/manifest.json`

For each of the 10 newsletters in `newsletter/`:
1. Read the HTML
2. Parse `<title>` (strip ` | Weekend MVP Newsletter` suffix)
3. Parse `<meta property="og:description">`
4. Extract `edition` from slug suffix (`am` or `pm`)
5. Extract `publishedAt` from slug date prefix (`2026-04-20-am` → `2026-04-20`)
6. Author `og.subject` matching the AM/PM accent rule (mint-glow language for AM, lavender-glow for PM)

Content authorship — no test for the manifest contents themselves. The schema is validated by `lib/og/sources/newsletter.mjs` (Task 2) and consumed by the orchestrator (Task 5).

- [ ] **Step 1: List newsletters + parse meta in one pass**

Run this script — it parses each file and prints a JSON skeleton that you can hand-fill the og.subject for:

```bash
node -e "
const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');
const dir = 'newsletter';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
const out = [];
for (const f of files) {
  const slug = f.replace(/\\.html\$/, '');
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const \$ = cheerio.load(html);
  const title = \$('title').text().replace(/ \\| Weekend MVP Newsletter\$/, '').trim();
  const description = (\$('meta[property=\"og:description\"]').attr('content') || '').trim();
  const edition = slug.endsWith('-am') ? 'am' : 'pm';
  const publishedAt = slug.slice(0, 10);
  out.push({ slug, title, publishedAt, edition, description });
}
console.log(JSON.stringify(out, null, 2));
"
```

Expected: prints 10 entries with parsed title, publishedAt, edition, description.

- [ ] **Step 2: Author `newsletter/manifest.json`**

Create `newsletter/manifest.json` with this structure. For each entry use the parsed metadata from Step 1, and author `og.subject` matching the accent rule:

- AM newsletters (mint accent): morning-ritual subjects with mint-glow language
- PM newsletters (lavender accent): evening-ritual subjects with lavender-glow language

```json
{
  "newsletters": [
    {
      "slug": "2026-04-20-am",
      "title": "<from parse>",
      "publishedAt": "2026-04-20",
      "edition": "am",
      "description": "<from parse>",
      "og": {
        "subject": "<director's note for an AM/morning-ritual scene with mint-glow language>",
        "status": "pending"
      }
    },
    {
      "slug": "2026-04-20-pm",
      "title": "<from parse>",
      "publishedAt": "2026-04-20",
      "edition": "pm",
      "description": "<from parse>",
      "og": {
        "subject": "<director's note for a PM/evening-ritual scene with lavender-glow language>",
        "status": "pending"
      }
    },
    ... (8 more entries: 21-am, 21-pm, 22-am, 22-pm, 23-am, 23-pm, 24-pm, 2026-05-01-pm)
  ]
}
```

**Subject library reference** (from spec § Brand consistency):

AM (mint-glow):
- "A coffee mug on a near-black counter with a single mint LED clock glow catching the rim, very early morning"
- "A kettle on a dark stovetop, single mint flame visible at the base, deep shadow surrounding"
- "A breakfast bowl on a near-black surface, single mint light from a phone screen catching the spoon"
- "An alarm clock on a bedside table with a mint LED display lit, the rest of the room in deep shadow"

PM (lavender-glow):
- "A reading lamp on a dark desk, single lavender bulb warm-lighting a closed book, deep shadow surrounding"
- "An evening tea cup beside a closed laptop on a near-black desk, single lavender light from a phone screen"
- "A journal open under a single lavender lamp, half-drawn curtain catching the lavender bleed, late evening"
- "A folded letter on a dark surface beside a small lavender wax-seal stamp, single overhead lamp"

Vary the subjects across the 10 entries to avoid repetition (each AM gets a different morning-object, each PM gets a different evening-object). `og.accent` is omitted — auto-derived from the slug suffix by `listNewsletter()`.

- [ ] **Step 3: Verify the manifest parses + listNewsletter returns 10 items with correct accents**

```bash
node -e "
JSON.parse(require('fs').readFileSync('newsletter/manifest.json'));
console.log('JSON OK');
" && node -e "
import('./lib/og/sources/newsletter.mjs').then((m) => m.listNewsletter()).then((items) => {
  console.log('Loaded', items.length, 'newsletters');
  const am = items.filter((i) => i.edition === 'am');
  const pm = items.filter((i) => i.edition === 'pm');
  console.log('AM:', am.length, '(should all be mint)');
  console.log('PM:', pm.length, '(should all be lavender)');
  const wrongAm = am.filter((i) => i.accent !== 'mint');
  const wrongPm = pm.filter((i) => i.accent !== 'lavender');
  if (wrongAm.length || wrongPm.length) {
    console.log('Wrong accent assignment:', { wrongAm, wrongPm });
    process.exit(1);
  }
  const undef = items.filter((i) => !i.subject);
  if (undef.length > 0) {
    console.log('Missing subject:', undef.map((i) => i.slug));
    process.exit(1);
  }
  console.log('All items have subjects + correct accents.');
});
"
```

Expected: prints `JSON OK`, then `Loaded 10 newsletters`, then `AM: 4 (should all be mint)` and `PM: 6 (should all be lavender)`, then `All items have subjects + correct accents.`.

- [ ] **Step 4: Verify dry-run picks them up**

```bash
node scripts/generate-og-cards.mjs --dry-run --surface newsletter | head -25
```

Expected: prints `DRY  newsletter/{slug}` lines for all 10 newsletters with their authored subjects.

- [ ] **Step 5: Commit**

```bash
git add newsletter/manifest.json
git commit -m "newsletter-og: backfill 10 newsletters with og.subject + AM/PM rule"
```

---

## Task 8: Update each newsletter HTML's `og:image` / `twitter:image` / JSON-LD `image`

**Files:**
- Modify: `newsletter/{slug}.html` × 10

Each newsletter currently points at `https://weekendmvp.app/image/og-image.png` in three places: `<meta property="og:image">`, `<meta property="twitter:image">`, and the JSON-LD Article block's `image` field. Update all three to `https://weekendmvp.app/image/og/newsletter/{slug}.png`.

- [ ] **Step 1: Loop through all 10 newsletter files and replace**

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'newsletter';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
let totalReplacements = 0;
let filesChanged = 0;
for (const f of files) {
  const slug = f.replace(/\\.html\$/, '');
  const target = \`https://weekendmvp.app/image/og/newsletter/\${slug}.png\`;
  const filePath = path.join(dir, f);
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = (content.match(/https:\\/\\/weekendmvp\\.app\\/image\\/og-image\\.png/g) || []).length;
  if (matches === 0) continue;
  const updated = content.split('https://weekendmvp.app/image/og-image.png').join(target);
  fs.writeFileSync(filePath, updated);
  console.log(\`  \${slug} (\${matches} replacements)\`);
  totalReplacements += matches;
  filesChanged++;
}
console.log(\`Total: \${totalReplacements} replacements across \${filesChanged} files.\`);
"
```

Expected: prints one line per file with `{slug} ({N} replacements)` (typically 2-3 per file: og:image, twitter:image, JSON-LD image), plus a total line.

- [ ] **Step 2: Spot-check one file**

```bash
grep -E 'og:image|twitter:image|"image":' newsletter/2026-05-01-pm.html | head -5
```

Expected: every line should reference `image/og/newsletter/2026-05-01-pm.png`. No remaining `image/og-image.png`.

- [ ] **Step 3: Confirm zero stragglers across all 10 newsletters**

```bash
grep -l 'image/og-image.png' newsletter/*.html
```

Expected output: nothing.

- [ ] **Step 4: Commit**

```bash
git add newsletter/*.html
git commit -m "newsletter: wire 10 pages to per-page OG cards"
```

---

## Task 9: Generate the 10 newsletter cards (operator)

**Files:**
- Generates: `image/og/newsletter/{slug}.png` × 10

Operator step requiring `RECRAFT_API_KEY` in `.env.local`.

- [ ] **Step 1: Sanity-check env vars are still in place**

```bash
grep -E '^RECRAFT_API_KEY=|^OPENAI_API_KEY=' .env.local | sed -E 's/=.*$/=<set>/'
```

Expected:
```
RECRAFT_API_KEY=<set>
OPENAI_API_KEY=<set>
```

- [ ] **Step 2: Run the newsletter batch (10 Recraft calls, ~$0.40)**

```bash
npm run og:generate:newsletter
```

Expected: 10 `GEN ✓ recraft` lines (or 1-2 fallbacks if any subject hits Recraft moderation).

- [ ] **Step 3: Open the output dir for thumbnail-row drift check**

```bash
open image/og/newsletter/
```

Switch Finder to thumbnail view. Eyeball the 10 cards as a row:
1. AM cards visibly mint-accented (postmark + accent bar)
2. PM cards visibly lavender-accented
3. WMV logo readable in the bottom-left of each
4. Title legible at thumbnail size
5. Postmark circle reads as a postcard stamp (not too busy, not too faint)
6. Recraft scene matches the AM/PM expectation (morning vs evening atmosphere)

If any card sticks out, force-regenerate just that one:

```bash
node scripts/generate-og-cards.mjs --slug {slug} --surface newsletter --force
```

- [ ] **Step 4: Confirm the build gate passes for newsletter**

```bash
STRICT=1 npm run check:og-cards
```

Expected: newsletter section reports "all 10 newsletter entries have OG cards" (alongside existing idea + article assertions).

- [ ] **Step 5: Commit the PNGs + the manifest's status writebacks**

```bash
git add image/og/newsletter/*.png newsletter/manifest.json
git commit -m "newsletter-og: ship 10 newsletter OG cards"
```

---

## Task 10: Update `IMAGES.md` to document the newsletter surface

**Files:**
- Modify: `IMAGES.md`

Add a section documenting the newsletter surface, the AM/PM accent rule, and the postcard layout. Insert AFTER the existing "Article surface" section and BEFORE the "Per-template config" section so the reader sees ideas → articles → newsletter as a sequence.

- [ ] **Step 1: Insert the newsletter surface section**

Find the existing line in `IMAGES.md`:

```markdown
## Per-template config (how surfaces are decoupled)
```

Insert this block IMMEDIATELY BEFORE that line:

````markdown
## Newsletter surface

Newsletters use a postcard layout:

- **Top 60% (378px)**: Recraft scene (the "front of postcard")
- **Postmark circle** in the top-right of the Recraft area: 120px diameter with date + AM/PM letters in Geist Mono, accent-colored
- **Bottom 40% (252px)**: solid `#050505` panel with WMV mark + 2-line meta in Geist Mono on the left, title in Geist Bold (autoshrunk) on the right
- **Bottom**: 4px accent bar spanning the full width

Generate with:

```bash
npm run og:generate:newsletter                  # missing only
npm run og:generate:newsletter -- --force       # regenerate all
node scripts/generate-og-cards.mjs --slug {slug} --surface newsletter
```

### AM/PM accent rule

Newsletter slugs end in `-am` or `-pm` (e.g., `2026-05-01-pm`). The source module auto-derives the brand accent from the suffix:

- **AM** newsletters → **mint** (`#8FF59B`) — fresh, morning energy
- **PM** newsletters → **lavender** (`#C5AEE8`) — calm, evening reflection

The accent shows up in the postmark border + center text, the meta line's second row, and the bottom accent bar. The Recraft scene's `og.subject` should also match (mint-glow phrasing for AM, lavender-glow for PM).

`og.accent` is OMITTED from the manifest for newsletters (auto-derived). It can be overridden manually if needed.

### Newsletter subject library

Subjects shift to **daily-ritual objects** (different from ideas' doing-objects and articles' reading/thinking objects):

- AM: coffee mug, kettle on stovetop, breakfast bowl, alarm clock with mint LED
- PM: reading lamp, evening tea cup, journal under a lamp, folded letter

Same dark + accent atmosphere as the other surfaces.

### Newsletter manifest

`newsletter/manifest.json` — schema mirrors articles, plus an `edition` field (`am` | `pm`):

```json
{
  "newsletters": [
    {
      "slug": "2026-05-01-pm",
      "title": "This week in AI: 8 things you may have missed",
      "publishedAt": "2026-05-01",
      "edition": "pm",
      "description": "<from page meta>",
      "og": {
        "subject": "An evening tea cup beside a closed laptop on a near-black desk, single lavender light from a phone screen",
        "status": "ready"
      }
    }
  ]
}
```

````

- [ ] **Step 2: Spot-check the file renders correctly**

```bash
head -250 IMAGES.md | tail -80
```

Should show the new newsletter section between the article surface and the per-template config sections.

- [ ] **Step 3: Commit**

```bash
git add IMAGES.md
git commit -m "newsletter-og: document newsletter surface + AM/PM rule in IMAGES.md"
```

---

## Task 11: Hook OG card generation into the `newsletter` skill

**Files:**
- Modify: `.claude/skills/newsletter/SKILL.md` (gitignored — local only)

The `newsletter` skill currently doesn't generate OG cards. Apply the same integration pattern used for `publish-idea` and `publish-article`:

1. Add `og_subject` to required fields the skill must author for each new newsletter (the skill already has `edition` and `publishedAt` from the slug structure)
2. Update the meta tag templates the skill writes to point at `image/og/newsletter/{slug}.png`
3. Update the JSON-LD Article schema's `image` field to the per-page card
4. Add (or update) a step that appends the new entry to `newsletter/manifest.json` with `og.subject` + `og.status: "pending"` (no `og.accent` — auto-derived)
5. Add a final step that invokes `node scripts/generate-og-cards.mjs --slug {slug} --surface newsletter --non-blocking`

Because `.claude/skills/` is in `.gitignore`, changes are local-only and won't be committed.

- [ ] **Step 1: Locate the skill file**

```bash
ls .claude/skills/newsletter/
```

Expected: prints the skill files (typically `SKILL.md` plus any reference content).

- [ ] **Step 2: Read the current skill flow**

```bash
cat .claude/skills/newsletter/SKILL.md | head -100
```

Identify where the skill: (a) defines required content fields, (b) writes the newsletter HTML's `<head>` meta tags, (c) writes/appends to a manifest (it may not yet maintain `newsletter/manifest.json` — if so, this step is a NEW addition).

- [ ] **Step 3: Add `og_subject` to the required-fields section**

Find the section listing fields the skill must author (look for "Required", "always generate", or similar). Add this:

- `og_subject`: A concrete director's-note for the per-page OG card. Match the brand: dark scene, ONE concrete daily-ritual object, single accent light source matching the AM/PM rule (mint-glow phrasing for AM, lavender-glow for PM), no people/faces/text. See `IMAGES.md` § Newsletter subject library for examples.

(`og.accent` is NOT a required field — it auto-derives from the slug.)

- [ ] **Step 4: Update the meta tags + JSON-LD `image` template the skill writes**

Find where the skill writes the newsletter's `<head>`. Update the OG/Twitter image meta tags + the JSON-LD Article block's `image` field to point at `https://weekendmvp.app/image/og/newsletter/{slug}.png`:

```html
<meta property="og:image" content="https://weekendmvp.app/image/og/newsletter/{slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="twitter:image" content="https://weekendmvp.app/image/og/newsletter/{slug}.png">
```

```json
"image": "https://weekendmvp.app/image/og/newsletter/{slug}.png"
```

- [ ] **Step 5: Add or update the manifest step**

If the skill doesn't yet manage `newsletter/manifest.json`, add a step before Step 6 that appends to it. If it does, ensure the appended entry includes the `og` block:

```json
{
  "slug": "{slug}",
  "title": "{title cleaned of suffix}",
  "publishedAt": "{YYYY-MM-DD from slug}",
  "edition": "{am or pm from slug}",
  "description": "{meta description}",
  "og": {
    "subject": "{og_subject from required fields}",
    "status": "pending"
  }
}
```

- [ ] **Step 6: Add a final step that invokes the OG generator**

After the manifest is in place, append a new step:

````markdown
### Step N: Generate the per-page OG card (best-effort, never blocks publish)

```bash
node scripts/generate-og-cards.mjs --slug {slug} --surface newsletter --non-blocking
```

**Behavior:**
- **Success:** writes `image/og/newsletter/{slug}.png`, flips manifest `og.status` from `"pending"` → `"ready"`. Provider name (`recraft` or `openai-gpt-image-1`) is logged so you can spot fallbacks.
- **Failure (Recraft AND `gpt-image-1` both errored):** flips `og.status` to `"failed"`, exits 0 (because `--non-blocking`). The publish flow continues. The page meta tags from the previous step already point at the expected PNG path; social crawlers fall back to the site-wide `image/og-image.png` automatically when the file is missing. A future `npm run og:generate:newsletter` run will retry every entry with `og.status: "failed"`.

**Critical invariant:** the newsletter publish flow's success status MUST be independent of the OG card outcome. Never let a Recraft API error block a newsletter from shipping (especially important since the email is the primary distribution channel — the web page is secondary).
````

- [ ] **Step 7: Update the skill's checklist / output report (if present)**

If the skill has a checklist or output report template, add OG card items:

- Manifest entry includes `og.subject` + `og.status: "pending"`
- `og:image` and `twitter:image` meta tags point at `image/og/newsletter/{slug}.png`
- JSON-LD Article `image` field points at the same path
- Ran `node scripts/generate-og-cards.mjs --slug {slug} --surface newsletter --non-blocking`
- Confirmed `og.status` is `"ready"` or `"failed"` (publish proceeds either way)

- [ ] **Step 8: Verify the file saves**

```bash
ls -la .claude/skills/newsletter/SKILL.md
```

Expected: file exists, modified just now. (No commit — `.claude/skills/` is in `.gitignore`.)

---

## Self-review

After writing the complete plan, I checked it against the spec.

**1. Spec coverage:** every section/requirement in the spec maps to a task:
- Spec § Architecture (3-file addition, no compose branching) → Tasks 2, 3, 4 (compose only adds template registration + arg pass-through)
- Spec § Layout (postcard, postmark, bottom panel) → Task 3 (template + 8 tests)
- Spec § Per-template config → Task 3
- Spec § AM/PM accent rule → Task 2 (deriveAccent + 2 tests)
- Spec § Brand consistency / Recraft subjects → Task 7 (manifest authorship references the spec's subject library)
- Spec § Manifest schema → Task 2 (source) + Task 7 (authorship)
- Spec § File structure → all tasks
- Spec § Data flow → Task 5 (orchestrator)
- Spec § updateManifestStatus change → Task 5 (lookup table additions + 2 tests)
- Spec § Backfill content (10 newsletters) → Task 7
- Spec § Error handling → inherits v1; covered by Task 5 (loadAllItems graceful ENOENT)
- Spec § Verification → Tasks 5 (dry-run smoke), 6 (build gate), 9 (eyeball + crawler check)
- Spec § v1 task list (11 items) → Tasks 1-11 of this plan in matching order

**2. Placeholder scan:** no `TBD`, `TODO`, `implement later`, or "Add appropriate error handling". Task 7 uses `<from parse>` and `<director's note...>` placeholders inside the `newsletter/manifest.json` skeleton — these are explicit content-authorship slots with concrete instructions on how to fill them (parsed metadata + the spec's subject library examples directly above).

**3. Type consistency:**
- `compose({bgBuffer, title, surface, accent, readMinutes, edition, publishedAt})` (Task 4) matches what orchestrator calls (Task 5).
- `updateManifestStatus(surface, slug, status, {rootDir?})` unchanged from Surface A; Task 5 only extends the lookup tables.
- Template `config` shape `{width, height, bgRect:{x,y,width,height}, bgFill}` consistent with the established pattern.
- `listNewsletter({manifestPath?})` returns same item shape as `listIdeas` / `listArticles` plus `edition` and `publishedAt` (Task 2). Orchestrator handles all three uniformly (Task 5).
- Surface name string `'newsletter'` (singular) consistent across all tasks; manifest array key `'newsletters'` (plural — matches `MANIFEST_KEYS.newsletter = 'newsletters'`).

---

## Out of scope (next surfaces / follow-ups)

- Newsletter HTML archive index OG card (`newsletter.html` at root) — single one-off, defer
- Newsletter inline email illustration (Surface C — different consumption context, separate spec)
- Carousel slide-1 hero (Surface D — 1080×1350 portrait, integrates with carousel pipeline)

## Cost

- 10 cards × ~$0.04 = ~$0.40 for the backfill batch
- Forever-cost at twice-daily cadence (~14/week): ~$0.56/week
