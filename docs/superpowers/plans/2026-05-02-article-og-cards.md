# Article OG Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-article OG card surface (split-frame editorial poster layout) to the existing pipeline, refactor compose to be surface-agnostic via per-template config, and backfill 16 cards for already-published articles.

**Architecture:** New `article` surface reuses the v1 sharp+Satori 2-pass composite. The compose module is refactored so each template exports a `config` object describing canvas dims + the Recraft-image rectangle within the canvas — sharp builds the canvas per config, places Recraft per `bgRect`, and composites the chrome on top. Article template is a split-frame: solid `#050505` left 40% holds typography (WMV mark, ARTICLE label, title, read-time chip), Recraft scene fills right 60%.

**Tech Stack:** Same as v1 (Node 20+ ESM, satori, @resvg/resvg-js, sharp, gray-matter, node:test) plus `@fontsource/geist-mono` for the small Geist Mono labels.

**Spec:** `docs/superpowers/specs/2026-05-02-article-og-cards-design.md`

---

## File Structure

**New files:**
```
lib/og/templates/article.mjs         — buildElement + config (split-frame layout)
lib/og/sources/articles.mjs          — listArticles({manifestPath?}) → normalized items
articles/manifest.json               — 16 backfilled entries (created in Task 9)
tests/og/templates-article.test.mjs
tests/og/sources-articles.test.mjs
tests/og/fixtures/articles-manifest-fixture.json
image/og/article/.gitkeep
```

**Modified files:**
```
lib/og/templates/idea.mjs            — export `config` const (full-bleed bg)
lib/og/fonts.mjs                     — also load Geist Mono Regular + Bold
lib/og/compose.mjs                   — surface-agnostic, reads template.config
lib/og/sources/ideas.mjs             — unchanged (already returns surface:'idea')
scripts/generate-og-cards.mjs        — iterate all sources, --surface filter, updateManifestStatus(surface, slug, status)
scripts/check-og-cards.js            — walk both manifests
package.json                         — add devDep + new scripts
tests/og/orchestrator.test.mjs       — update to test new updateManifestStatus signature
articles/{slug}.html × 16            — og:image / twitter:image / JSON-LD image meta
```

**Why this shape:** Each new surface is a 3-file addition (template + source + manifest). The compose module never gains per-surface branching — all variation is encoded in the template's `config`. Future surfaces (newsletter, carousel) reuse the same shape.

---

## Task 1: Install Geist Mono dep + add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Geist Mono**

```bash
npm i -D @fontsource/geist-mono@^5.0
```

- [ ] **Step 2: Confirm WOFF file is present**

```bash
ls node_modules/@fontsource/geist-mono/files/ | grep '400-normal\|700-normal' | head -5
```

Expected output (or similar — what matters is `.woff` files exist for weights 400 and 700):

```
geist-mono-latin-400-normal.woff
geist-mono-latin-400-normal.woff2
geist-mono-latin-700-normal.woff
geist-mono-latin-700-normal.woff2
```

If only `.woff2` is shipped (different from geist-sans), Satori's bundled opentype.js will reject it. Stop and report — the implementation in Task 3 needs the actual filename pattern.

- [ ] **Step 3: Add npm scripts**

Modify `package.json`'s `scripts` block — add three new entries (keep all existing ones intact):

```json
"og:generate:articles": "node scripts/generate-og-cards.mjs --surface article",
"og:generate:ideas": "node scripts/generate-og-cards.mjs --surface idea",
```

Final scripts block should be:

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
  "test:og": "node --test tests/og/"
}
```

- [ ] **Step 4: Create the article output dir placeholder**

```bash
mkdir -p image/og/article
touch image/og/article/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json image/og/article/.gitkeep
git commit -m "article-og: install Geist Mono + add article scripts"
```

---

## Task 2: Extend `lib/og/fonts.mjs` to load Geist Mono

**Files:**
- Modify: `lib/og/fonts.mjs`
- Modify: `tests/og/fonts.test.mjs`

The fonts module currently returns 2 entries (Geist 400 + 700). Extend to 4 entries (add GeistMono 400 + 700) so Satori can render the small label/chip text in the article template.

- [ ] **Step 1: Update the test for the new shape**

Modify `tests/og/fonts.test.mjs` to expect 4 entries:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFonts } from '../../lib/og/fonts.mjs';

test('loadFonts returns Satori-compatible font array', async () => {
  const fonts = await loadFonts();
  assert.ok(Array.isArray(fonts), 'returns an array');
  assert.equal(fonts.length, 4, 'returns Geist regular+bold + GeistMono regular+bold');

  const geistRegular = fonts.find((f) => f.name === 'Geist' && f.weight === 400);
  const geistBold = fonts.find((f) => f.name === 'Geist' && f.weight === 700);
  const monoRegular = fonts.find((f) => f.name === 'GeistMono' && f.weight === 400);
  const monoBold = fonts.find((f) => f.name === 'GeistMono' && f.weight === 700);

  assert.ok(geistRegular, 'has Geist regular');
  assert.ok(geistBold, 'has Geist bold');
  assert.ok(monoRegular, 'has GeistMono regular');
  assert.ok(monoBold, 'has GeistMono bold');

  for (const f of fonts) {
    assert.equal(f.style, 'normal');
    assert.ok(Buffer.isBuffer(f.data) || f.data instanceof ArrayBuffer, 'data is a buffer');
    assert.ok(f.data.byteLength > 1000, 'font file is non-trivial');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/fonts.test.mjs
```

Expected: FAIL — `length should equal 4` (currently 2).

- [ ] **Step 3: Update the implementation**

Replace the entire contents of `lib/og/fonts.mjs` with:

```js
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Resolve WOFF paths via Node's require.resolve so this works regardless of
// monorepo / pnpm hoisting. @fontsource/* v5+ ships WOFF files at
// files/{family}-latin-{weight}-normal.woff (WOFF1 — required by satori's
// bundled opentype.js which does not support WOFF2).
function resolveFontPath(family, weight) {
  return require.resolve(
    `@fontsource/${family}/files/${family}-latin-${weight}-normal.woff`
  );
}

let cache = null;

export async function loadFonts() {
  if (cache) return cache;
  const [geistRegular, geistBold, monoRegular, monoBold] = await Promise.all([
    readFile(resolveFontPath('geist-sans', 400)),
    readFile(resolveFontPath('geist-sans', 700)),
    readFile(resolveFontPath('geist-mono', 400)),
    readFile(resolveFontPath('geist-mono', 700))
  ]);
  cache = [
    { name: 'Geist',     data: geistRegular, weight: 400, style: 'normal' },
    { name: 'Geist',     data: geistBold,    weight: 700, style: 'normal' },
    { name: 'GeistMono', data: monoRegular,  weight: 400, style: 'normal' },
    { name: 'GeistMono', data: monoBold,     weight: 700, style: 'normal' }
  ];
  return cache;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/fonts.test.mjs
```

Expected: PASS, 1 test (with multiple assertions for 4 fonts).

If the test fails because `@fontsource/geist-mono` ships only `.woff2` and not `.woff`, switch the geist-mono lines to `.woff2` and update the comment. (Same approach the v1 fonts module took.)

- [ ] **Step 5: Run the full OG suite to confirm no regressions**

```bash
npm run test:og
```

Expected: all 31 v1 tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/og/fonts.mjs tests/og/fonts.test.mjs
git commit -m "article-og: load Geist Mono alongside Geist in font loader"
```

---

## Task 3: Add `config` export to `lib/og/templates/idea.mjs`

**Files:**
- Modify: `lib/og/templates/idea.mjs`
- Modify: `tests/og/templates-idea.test.mjs`

Idea template gains a `config` const that compose.mjs (Task 5) will read. No visual change — config describes the existing full-bleed layout.

- [ ] **Step 1: Add a test for the new export**

Modify `tests/og/templates-idea.test.mjs` — add this test at the end of the file:

```js
import { config } from '../../lib/og/templates/idea.mjs';

test('config describes a full-bleed 1200x630 frame', () => {
  assert.equal(config.width, 1200);
  assert.equal(config.height, 630);
  assert.deepEqual(config.bgRect, { x: 0, y: 0, width: 1200, height: 630 });
  assert.equal(config.bgFill, '#050505');
});
```

(Add `config` to the existing import statement at the top of the file:
`import { buildElement, ACCENTS, pickTitleFontSize, config } from '../../lib/og/templates/idea.mjs';`)

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/templates-idea.test.mjs
```

Expected: FAIL — `config` is not exported.

- [ ] **Step 3: Add the export to `lib/og/templates/idea.mjs`**

Add this near the top of the file (after `ACCENTS`, before `pickTitleFontSize`):

```js
// Per-template canvas config consumed by compose.mjs.
// Idea cards are full-bleed: the Recraft scene fills the entire 1200x630 frame.
export const config = {
  width: 1200,
  height: 630,
  bgRect: { x: 0, y: 0, width: 1200, height: 630 },
  bgFill: '#050505'
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/templates-idea.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/og/templates/idea.mjs tests/og/templates-idea.test.mjs
git commit -m "article-og: idea template exports per-template config"
```

---

## Task 4: Create `lib/og/templates/article.mjs` (split-frame)

**Files:**
- Create: `lib/og/templates/article.mjs`
- Test: `tests/og/templates-article.test.mjs`

The article template renders the LEFT 40% of the canvas as a typography panel (WMV mark + ARTICLE label + title + READ chip + accent bar). The RIGHT 60% is left transparent — sharp will composite the Recraft image into that area in compose (Task 5). The Satori chrome covers the full 1200×630 frame so the bottom accent bar can span both halves.

- [ ] **Step 1: Write the failing test**

Create `tests/og/templates-article.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildElement,
  ACCENTS,
  pickTitleFontSize,
  config
} from '../../lib/og/templates/article.mjs';

test('ACCENTS map mirrors the brand palette', () => {
  for (const k of ['lime', 'mint', 'lavender', 'emerald', 'aubergine']) {
    assert.ok(ACCENTS[k], `missing ${k}`);
    assert.match(ACCENTS[k], /^#[0-9A-F]{6}$/i);
  }
});

test('pickTitleFontSize uses narrow-panel breakpoints (44/52/64)', () => {
  // Article panel is only 480px wide, so titles wrap sooner than ideas.
  assert.equal(pickTitleFontSize('Short'), 64);
  assert.equal(pickTitleFontSize('A medium-length article title here'), 52);
  assert.equal(pickTitleFontSize('A really really really long article title that surpasses seventy characters in total'), 44);
});

test('config has the right-60% bgRect and 1200x630 frame', () => {
  assert.equal(config.width, 1200);
  assert.equal(config.height, 630);
  assert.deepEqual(config.bgRect, { x: 480, y: 0, width: 720, height: 630 });
  assert.equal(config.bgFill, '#050505');
});

test('buildElement returns 1200x630 element tree with title + ARTICLE label + read time', () => {
  const el = buildElement({
    title: 'A Test Article Title',
    accent: 'lavender',
    readMinutes: 6
  });
  assert.equal(el.type, 'div');
  assert.equal(el.props.style.width, 1200);
  assert.equal(el.props.style.height, 630);

  const json = JSON.stringify(el);
  assert.ok(json.includes('A Test Article Title'), 'title not found');
  assert.ok(json.includes('ARTICLE'), 'ARTICLE label not found');
  assert.ok(json.includes('6 MIN READ'), 'read-time chip not found');
  assert.ok(json.includes('#C5AEE8'), 'lavender accent not used');
  assert.ok(json.includes('GeistMono'), 'Geist Mono not used (label/chip should use it)');
});

test('buildElement defaults to lime + 5 MIN READ when accent unknown / readMinutes missing', () => {
  const el = buildElement({
    title: 'X',
    accent: 'unknown',
    readMinutes: undefined
  });
  const json = JSON.stringify(el);
  assert.ok(json.includes('#D4FF5B'), 'lime fallback not applied');
  assert.ok(json.includes('5 MIN READ'), 'read-time fallback (5) not applied');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/templates-article.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the template**

Create `lib/og/templates/article.mjs`:

```js
// Same brand accents as the idea template.
export const ACCENTS = {
  lime: '#D4FF5B',
  mint: '#8FF59B',
  lavender: '#C5AEE8',
  emerald: '#2F5F53',
  aubergine: '#1E1B38'
};

// Article panel is 480px wide (left 40% of the 1200px frame), so titles wrap
// sooner than idea cards. Three breakpoints tuned for that narrower column.
export function pickTitleFontSize(title) {
  const len = title.length;
  if (len <= 30) return 64;
  if (len <= 70) return 52;
  return 44;
}

// Per-template canvas config consumed by compose.mjs.
// Article cards split the frame: solid #050505 left 40% (480px) for typography,
// Recraft scene fills the right 60% (720px) via sharp composite.
export const config = {
  width: 1200,
  height: 630,
  bgRect: { x: 480, y: 0, width: 720, height: 630 },
  bgFill: '#050505'
};

// Article surface dimensions.
const PANEL_WIDTH = 480;
const PANEL_PADDING = 56;

// Logo dimensions (matches idea template — Geist logo is 771x98).
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((771 / 98) * LOGO_HEIGHT);

// Helper to build a Satori-compatible element. Same el() shape used by the
// idea template — Satori reads {type, props} like React VDOM but does not
// require React. Empty children arrays are omitted because Satori treats them
// as multi-child and demands display:flex.
function el(type, props = {}, ...children) {
  if (children.length === 0) return { type, props };
  const c = children.length === 1 ? children[0] : children;
  return { type, props: { ...props, children: c } };
}

export function buildElement({ title, accent, readMinutes, logoDataUrl }) {
  const accentHex = ACCENTS[accent] ?? ACCENTS.lime;
  const titleSize = pickTitleFontSize(title);
  const minutes = typeof readMinutes === 'number' && readMinutes > 0 ? readMinutes : 5;

  return el(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        // Transparent root — sharp composites this chrome over the surface
        // canvas (which already has the Recraft bg placed in the right 60%).
        color: '#FFFFFF',
        fontFamily: 'Geist'
      }
    },
    // LEFT panel: solid #050505, holds all typography
    el(
      'div',
      {
        style: {
          width: PANEL_WIDTH,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#050505',
          padding: PANEL_PADDING
        }
      },
      // Top: WMV logo
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
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: '#FFFFFF'
              }
            },
            'WEEKEND MVP'
          ),
      // ARTICLE label (Geist Mono, accent-colored)
      el(
        'div',
        {
          style: {
            marginTop: 18,
            fontFamily: 'GeistMono',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            color: accentHex,
            textTransform: 'uppercase'
          }
        },
        'ARTICLE'
      ),
      // Spacer pushes title toward middle/bottom
      el('div', { style: { flex: 1 } }),
      // Title
      el(
        'div',
        {
          style: {
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1.0,
            color: '#FFFFFF',
            display: 'flex'
          }
        },
        title
      ),
      // Spacer between title and read-time chip
      el('div', { style: { height: 24 } }),
      // Bottom row: read-time chip + accent dot
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }
        },
        el(
          'div',
          {
            style: {
              fontFamily: 'GeistMono',
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: 1.5,
              color: '#A1A1AA'
            }
          },
          `${minutes} MIN READ`
        ),
        el('div', {
          style: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: accentHex
          }
        })
      )
    ),
    // Bottom accent bar — spans full 1200px width (positioned absolute so it
    // crosses the panel/scene boundary).
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 1200,
        height: 4,
        backgroundColor: accentHex
      }
    })
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/templates-article.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/og/templates/article.mjs tests/og/templates-article.test.mjs
git commit -m "article-og: add split-frame article template (Satori tree + config)"
```

---

## Task 5: Refactor `lib/og/compose.mjs` to be surface-agnostic

**Files:**
- Modify: `lib/og/compose.mjs`
- Modify: `tests/og/compose.test.mjs`

Compose now reads each template's `config` to size the canvas + place the Recraft image at the right `bgRect` offset, then composites the Satori chrome on top. This eliminates per-surface branching: adding a new surface = adding a template module + registering it.

- [ ] **Step 1: Update the test to cover both surfaces**

Replace `tests/og/compose.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { compose } from '../../lib/og/compose.mjs';

// 100x100 dark grey PNG — stand-in for a Recraft output.
async function fakeBg() {
  return await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 30, g: 30, b: 30 }
    }
  })
    .png()
    .toBuffer();
}

test('compose returns a 1200x630 PNG buffer for surface=idea', async () => {
  const png = await compose({
    bgBuffer: await fakeBg(),
    title: 'Composed Idea Title',
    surface: 'idea',
    accent: 'lime'
  });
  assert.ok(Buffer.isBuffer(png));
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.format, 'png');
});

test('compose returns a 1200x630 PNG buffer for surface=article', async () => {
  const png = await compose({
    bgBuffer: await fakeBg(),
    title: 'Composed Article Title',
    surface: 'article',
    accent: 'lavender',
    readMinutes: 8
  });
  assert.ok(Buffer.isBuffer(png));
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test('compose throws on unknown surface', async () => {
  await assert.rejects(
    compose({
      bgBuffer: await fakeBg(),
      title: 'X',
      surface: 'nonexistent-surface',
      accent: 'lime'
    }),
    /unknown surface/i
  );
});

test('article composite places Recraft bg in the right 60% (left panel stays solid)', async () => {
  // Build a bright RED Recraft stand-in so we can sample the output and prove
  // (a) the right side is dominated by red, (b) the left side is dominated by
  // black (#050505 panel from config.bgFill).
  const redBg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();

  const png = await compose({
    bgBuffer: redBg,
    title: 'Layout Test',
    surface: 'article',
    accent: 'lime',
    readMinutes: 5
  });

  const raw = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const channels = info.channels; // 3 or 4

  // Sample center-left pixel (x=240, y=315) — should be near-black.
  const leftIdx = (315 * info.width + 240) * channels;
  const leftRed = data[leftIdx];
  assert.ok(leftRed < 30, `left panel should be near-black, got R=${leftRed}`);

  // Sample center-right pixel (x=900, y=315) — should be dominantly red
  // (allowing for any chrome overlay; bottom 4px accent bar is far away).
  const rightIdx = (315 * info.width + 900) * channels;
  const rightRed = data[rightIdx];
  assert.ok(rightRed > 200, `right area should show red Recraft bg, got R=${rightRed}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/compose.test.mjs
```

Expected: FAIL — surface 'article' not registered yet OR the layout test fails because compose doesn't yet honor `bgRect`.

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

const TEMPLATES = {
  idea: ideaTemplate,
  article: articleTemplate
  // newsletter, carousel — added in follow-up surfaces
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
export async function compose({ bgBuffer, title, surface, accent, readMinutes }) {
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

  // 3. Render chrome over a transparent root
  const element = tpl.buildElement({ title, accent, logoDataUrl, readMinutes });
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

Expected: PASS, 4 tests.

If the layout-sampling test fails because the bg color sampled is unexpected, run the full suite first to make sure nothing else is breaking:

```bash
npm run test:og
```

Expected: all tests pass (31 from v1 + new article tests).

- [ ] **Step 5: Commit**

```bash
git add lib/og/compose.mjs tests/og/compose.test.mjs
git commit -m "article-og: refactor compose to be surface-agnostic via template config"
```

---

## Task 6: Create `lib/og/sources/articles.mjs`

**Files:**
- Create: `lib/og/sources/articles.mjs`
- Create: `tests/og/fixtures/articles-manifest-fixture.json`
- Test: `tests/og/sources-articles.test.mjs`

Same shape as `lib/og/sources/ideas.mjs` but reads from `articles/manifest.json` (which has an `articles` array, not `ideas`) and adds a `readMinutes` field to each item.

- [ ] **Step 1: Create the test fixture**

Create `tests/og/fixtures/articles-manifest-fixture.json`:

```json
{
  "articles": [
    {
      "slug": "with-og",
      "title": "Article With OG Block",
      "description": "Fallback description.",
      "readMinutes": 8,
      "og": {
        "subject": "An open notebook with one mint line",
        "accent": "mint"
      }
    },
    {
      "slug": "no-og-has-description",
      "title": "Article With Only Description",
      "description": "Falls back to this description.",
      "readMinutes": 4
    },
    {
      "slug": "no-og-no-description",
      "title": "Bare Article Title Only"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/og/sources-articles.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listArticles } from '../../lib/og/sources/articles.mjs';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/articles-manifest-fixture.json'
);

test('listArticles returns one item per article', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  assert.equal(items.length, 3);
});

test('listArticles uses og.subject + og.accent when present', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'with-og');
  assert.equal(item.subject, 'An open notebook with one mint line');
  assert.equal(item.accent, 'mint');
  assert.equal(item.readMinutes, 8);
});

test('listArticles falls back to description when og.subject missing', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-has-description');
  assert.equal(item.subject, 'Falls back to this description.');
  assert.equal(item.accent, 'lime', 'defaults to lime when og.accent is absent');
});

test('listArticles falls back to title when description missing', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-no-description');
  assert.equal(item.subject, 'Bare Article Title Only');
  assert.equal(item.readMinutes, 5, 'defaults to 5 when readMinutes is absent');
});

test('listArticles sets surface and outputPath on every item', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'article');
    assert.equal(item.outputPath, `image/og/article/${item.slug}.png`);
    assert.ok(item.title);
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
node --test tests/og/sources-articles.test.mjs
```

Expected: FAIL with "Cannot find module '../../lib/og/sources/articles.mjs'".

- [ ] **Step 4: Implement the module**

Create `lib/og/sources/articles.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_MANIFEST = join(process.cwd(), 'articles/manifest.json');
const DEFAULT_ACCENT = 'lime';
const DEFAULT_READ_MINUTES = 5;

export async function listArticles({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.articles)) {
    throw new Error(`manifest at ${manifestPath} has no "articles" array`);
  }
  return manifest.articles.map((article) => {
    const og = article.og ?? {};
    const subject = og.subject ?? article.description ?? article.title;
    const accent = og.accent ?? DEFAULT_ACCENT;
    const readMinutes = article.readMinutes ?? DEFAULT_READ_MINUTES;
    return {
      slug: article.slug,
      title: article.title,
      subject,
      accent,
      readMinutes,
      surface: 'article',
      outputPath: `image/og/article/${article.slug}.png`,
      status: og.status
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
node --test tests/og/sources-articles.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/og/sources/articles.mjs tests/og/sources-articles.test.mjs tests/og/fixtures/articles-manifest-fixture.json
git commit -m "article-og: add articles manifest source with fallback chain"
```

---

## Task 7: Update orchestrator — multi-surface iteration + `--surface` filter + new `updateManifestStatus` signature

**Files:**
- Modify: `scripts/generate-og-cards.mjs`
- Modify: `tests/og/orchestrator.test.mjs`

Today the orchestrator iterates only ideas and writes status to `ideas/manifest.json`. Update it to iterate both `idea` and `article` sources by default, accept a `--surface idea|article` filter, and route `og.status` writebacks to the right manifest based on the item's `surface` field.

- [ ] **Step 1: Update orchestrator tests**

Replace `tests/og/orchestrator.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, updateManifestStatus } from '../../scripts/generate-og-cards.mjs';

test('parseArgs handles --dry-run', () => {
  const opts = parseArgs(['--dry-run']);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.force, false);
  assert.equal(opts.slug, null);
  assert.equal(opts.surface, null);
  assert.equal(opts.nonBlocking, false);
});

test('parseArgs handles --force --slug X --non-blocking together', () => {
  const opts = parseArgs(['--force', '--slug', 'my-slug', '--non-blocking']);
  assert.equal(opts.force, true);
  assert.equal(opts.slug, 'my-slug');
  assert.equal(opts.nonBlocking, true);
  assert.equal(opts.surface, null);
});

test('parseArgs handles --raw', () => {
  const opts = parseArgs(['--raw']);
  assert.equal(opts.raw, true);
  assert.equal(parseArgs([]).raw, false);
});

test('parseArgs handles --surface article', () => {
  const opts = parseArgs(['--surface', 'article']);
  assert.equal(opts.surface, 'article');
});

test('parseArgs handles --surface idea', () => {
  const opts = parseArgs(['--surface', 'idea']);
  assert.equal(opts.surface, 'idea');
});

test('updateManifestStatus writes to ideas/manifest.json for surface=idea', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  const path = join(dir, 'ideas/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      ideas: [{ slug: 'foo', title: 'Foo', og: { subject: 's' } }]
    }, null, 2)
  );

  await updateManifestStatus('idea', 'foo', 'ready', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const foo = json.ideas.find((i) => i.slug === 'foo');
  assert.equal(foo.og.status, 'ready');
  assert.equal(foo.og.subject, 's', 'preserves existing og fields');
  assert.equal(foo.title, 'Foo', 'preserves non-og fields');

  await rm(dir, { recursive: true, force: true });
});

test('updateManifestStatus writes to articles/manifest.json for surface=article', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'articles'), { recursive: true });
  const path = join(dir, 'articles/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      articles: [{ slug: 'bar', title: 'Bar' }]
    }, null, 2)
  );

  await updateManifestStatus('article', 'bar', 'failed', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const bar = json.articles.find((i) => i.slug === 'bar');
  assert.equal(bar.og.status, 'failed', 'creates og block when missing');
  assert.equal(bar.title, 'Bar', 'preserves non-og fields');

  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/orchestrator.test.mjs
```

Expected: FAIL — `parseArgs` doesn't return `surface`, `updateManifestStatus` has the wrong signature.

- [ ] **Step 3: Replace `scripts/generate-og-cards.mjs`**

Replace the entire contents with:

```js
#!/usr/bin/env node
/**
 * Generate per-page OG share cards across all surfaces.
 *
 * Usage:
 *   node scripts/generate-og-cards.mjs                   # all surfaces, missing only
 *   node scripts/generate-og-cards.mjs --force           # regenerate all
 *   node scripts/generate-og-cards.mjs --slug X          # one slug (any surface)
 *   node scripts/generate-og-cards.mjs --surface article # filter to one surface
 *   node scripts/generate-og-cards.mjs --dry-run         # log only
 *   node scripts/generate-og-cards.mjs --raw             # also write {slug}-raw.png
 *   node scripts/generate-og-cards.mjs --non-blocking    # exit 0 even on failures
 *
 * Env (loaded from .env.local or process env):
 *   RECRAFT_API_KEY=
 *   RECRAFT_STYLE_ID=  (optional, hugely recommended)
 *   OPENAI_API_KEY=    (fallback)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { listArticles } from '../lib/og/sources/articles.mjs';
import { generate as generateRecraft } from '../lib/og/providers/recraft.mjs';
import { generate as generateOpenAI } from '../lib/og/providers/openai.mjs';
import { compose } from '../lib/og/compose.mjs';
import { STYLE_BLUEPRINT } from '../lib/og/style-blueprint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Maps surface name → manifest path (relative to root). Each source returns
// items with item.surface set, so this is just a lookup table for writeback.
const MANIFEST_PATHS = {
  idea: 'ideas/manifest.json',
  article: 'articles/manifest.json'
};

// Maps surface name → manifest top-level array key (idea→ideas, article→articles).
const MANIFEST_KEYS = {
  idea: 'ideas',
  article: 'articles'
};

// Minimal .env.local loader (matches the autocrew pattern; no dotenv dep)
function loadDotEnv() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function parseArgs(argv) {
  const args = argv;
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    nonBlocking: args.includes('--non-blocking'),
    raw: args.includes('--raw'),
    slug: args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null,
    surface: args.includes('--surface') ? args[args.indexOf('--surface') + 1] : null
  };
}

// Routes status writes to the correct manifest based on item surface.
// `rootDir` is overridable for tests.
export async function updateManifestStatus(surface, slug, status, { rootDir = ROOT } = {}) {
  const relPath = MANIFEST_PATHS[surface];
  if (!relPath) return;
  const path = join(rootDir, relPath);
  if (!existsSync(path)) return;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const list = json[MANIFEST_KEYS[surface]];
  if (!Array.isArray(list)) return;
  const entry = list.find((i) => i.slug === slug);
  if (!entry) return;
  entry.og = entry.og ?? {};
  entry.og.status = status;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

// Collect items from every available source. Each surface is loaded
// gracefully — a missing manifest skips that surface without erroring.
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

async function generateOne({ subject }) {
  const prompt = `${STYLE_BLUEPRINT}\n\nSubject: ${subject}`;
  try {
    return { buffer: await generateRecraft({ prompt }), provider: 'recraft' };
  } catch (err) {
    console.warn(`      ⚠ Recraft failed: ${err.message}`);
    console.warn(`      → falling back to gpt-image-1`);
    return { buffer: await generateOpenAI({ prompt }), provider: 'openai-gpt-image-1' };
  }
}

async function main() {
  loadDotEnv();
  const opts = parseArgs(process.argv.slice(2));

  let items = await loadAllItems();
  if (opts.surface) items = items.filter((i) => i.surface === opts.surface);
  if (opts.slug) items = items.filter((i) => i.slug === opts.slug);

  if (items.length === 0) {
    console.log('No items to process.');
    return;
  }

  let generated = 0, skipped = 0, failed = 0;
  const failedKeys = [];

  for (const item of items) {
    const outPath = join(ROOT, item.outputPath);
    mkdirSync(dirname(outPath), { recursive: true });

    if (existsSync(outPath) && !opts.force) {
      console.log(`SKIP  ${item.surface}/${item.slug}`);
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      console.log(`DRY   ${item.surface}/${item.slug}`);
      console.log(`      subject: ${item.subject}`);
      console.log(`      → ${item.outputPath}\n`);
      continue;
    }

    console.log(`GEN   ${item.surface}/${item.slug}`);
    console.log(`      subject: ${item.subject}`);

    try {
      const { buffer: bg, provider } = await generateOne({ subject: item.subject });
      if (opts.raw) {
        const rawPath = outPath.replace(/\.png$/, '-raw.png');
        writeFileSync(rawPath, bg);
        console.log(`      ✎ raw → ${rawPath.replace(ROOT + '/', '')}`);
      }
      const png = await compose({
        bgBuffer: bg,
        title: item.title,
        surface: item.surface,
        accent: item.accent,
        readMinutes: item.readMinutes
      });
      writeFileSync(outPath, png);
      await updateManifestStatus(item.surface, item.slug, 'ready');
      console.log(`      ✓ ${provider} → ${item.outputPath}\n`);
      generated++;
    } catch (err) {
      console.error(`      ✗ ${item.surface}/${item.slug}: ${err.message}`);
      await updateManifestStatus(item.surface, item.slug, 'failed');
      failedKeys.push(`${item.surface}/${item.slug}`);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failedKeys.length > 0) {
    console.log(`Failed: ${failedKeys.join(', ')}`);
  }
  if (failed > 0 && !opts.nonBlocking) {
    process.exit(1);
  }
}

// Only run when invoked as a script (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/orchestrator.test.mjs
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Smoke test with the real ideas manifest (no API call needed)**

```bash
node scripts/generate-og-cards.mjs --dry-run --surface idea --slug agent-storefront-platform
```

Expected output:
```
DRY   idea/agent-storefront-platform
      subject: A single glowing laptop screen on a dark counter, lavender backlight, ...
      → image/og/idea/agent-storefront-platform.png
```

- [ ] **Step 6: Run the full test suite**

```bash
npm run test:og
```

Expected: all tests pass (idea, fonts, sources, providers, templates × 2, compose, orchestrator).

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-og-cards.mjs tests/og/orchestrator.test.mjs
git commit -m "article-og: orchestrator iterates all surfaces + --surface filter"
```

---

## Task 8: Update `scripts/check-og-cards.js` to walk both manifests

**Files:**
- Modify: `scripts/check-og-cards.js`
- Modify: `tests/og/check-og-cards.test.mjs`

Today the build gate only checks `ideas/manifest.json` against `image/og/idea/*.png`. Extend to also check `articles/manifest.json` against `image/og/article/*.png`.

- [ ] **Step 1: Update the test for the dual-manifest behavior**

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

function setupDir({ ideaPng = false, articlePng = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'og-check-'));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  mkdirSync(join(dir, 'articles'), { recursive: true });
  mkdirSync(join(dir, 'image/og/idea'), { recursive: true });
  mkdirSync(join(dir, 'image/og/article'), { recursive: true });
  writeFileSync(
    join(dir, 'ideas/manifest.json'),
    JSON.stringify({ ideas: [{ slug: 'idea-one', title: 'Idea One' }] })
  );
  writeFileSync(
    join(dir, 'articles/manifest.json'),
    JSON.stringify({ articles: [{ slug: 'article-one', title: 'Article One' }] })
  );
  if (ideaPng) writeFileSync(join(dir, 'image/og/idea/idea-one.png'), 'fake');
  if (articlePng) writeFileSync(join(dir, 'image/og/article/article-one.png'), 'fake');
  return dir;
}

test('exits 0 by default when PNGs missing (warn-only)', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /missing/i);
});

test('exits 1 with STRICT=1 when any PNG missing', () => {
  const dir = setupDir({ ideaPng: true });
  // article PNG still missing
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 1);
});

test('exits 0 with STRICT=1 when all PNGs present', () => {
  const dir = setupDir({ ideaPng: true, articlePng: true });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 0);
});

test('reports missing slugs broken down by surface', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.match(r.stdout, /idea/);
  assert.match(r.stdout, /article/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/check-og-cards.test.mjs
```

Expected: FAIL — current script doesn't know about articles.

- [ ] **Step 3: Replace `scripts/check-og-cards.js`**

Replace the entire contents with:

```js
#!/usr/bin/env node
/**
 * Asserts every entry in ideas/manifest.json AND articles/manifest.json has
 * a corresponding OG PNG on disk.
 *
 * Default: warn-only, exit 0.
 * STRICT=1: exit 1 if any are missing. Used in CI gates.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const strict = process.env.STRICT === '1';

const surfaces = [
  { name: 'idea', manifest: 'ideas/manifest.json', listKey: 'ideas', pngDir: 'image/og/idea' },
  { name: 'article', manifest: 'articles/manifest.json', listKey: 'articles', pngDir: 'image/og/article' }
];

let totalChecked = 0;
let totalMissing = 0;

for (const s of surfaces) {
  const manifestPath = path.join(root, s.manifest);
  if (!fs.existsSync(manifestPath)) {
    console.log(`og-cards: no manifest at ${s.manifest} — skipping ${s.name} surface.`);
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const list = manifest[s.listKey] ?? [];
  totalChecked += list.length;

  const missing = [];
  for (const entry of list) {
    const png = path.join(root, s.pngDir, `${entry.slug}.png`);
    if (!fs.existsSync(png)) missing.push(entry.slug);
  }

  if (missing.length === 0) {
    console.log(`og-cards: all ${list.length} ${s.name} entries have OG cards`);
  } else {
    totalMissing += missing.length;
    console.log(`og-cards: ${missing.length} ${s.name} missing`);
    for (const slug of missing) console.log(`  - ${s.name}/${slug}`);
  }
}

if (totalMissing === 0) {
  console.log(`og-cards: ${totalChecked} total entries OK`);
  process.exit(0);
}

console.log(`og-cards: run \`npm run og:generate\` to fill the gaps`);
process.exit(strict ? 1 : 0);
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

Expected output (something like):
```
og-cards: no manifest at articles/manifest.json — skipping article surface.
og-cards: 9 idea entries OK
og-cards: 9 total entries OK
```

(articles/manifest.json doesn't exist yet — that's Task 9.)

- [ ] **Step 6: Commit**

```bash
git add scripts/check-og-cards.js tests/og/check-og-cards.test.mjs
git commit -m "article-og: check:og-cards walks both manifests"
```

---

## Task 9: Author `articles/manifest.json` with 16 entries

**Files:**
- Create: `articles/manifest.json`

For each of the 16 articles in `articles/`:
1. Read the HTML file
2. Parse `<title>` (strip ` | Weekend MVP` suffix)
3. Parse `<meta property="og:description">`
4. Count words inside the `<body>` (rough heuristic — doesn't need to be perfect)
5. Compute `readMinutes = Math.max(1, Math.round(wordCount / 200))`
6. Author an `og.subject` (director's-note for Recraft, reading/thinking object world) and `og.accent`

This task is content authorship — there's no test for the manifest contents. The schema is validated by `lib/og/sources/articles.mjs` (Task 6) and consumed by the orchestrator (Task 7).

- [ ] **Step 1: List all article files + their titles**

```bash
for f in articles/*.html; do
  slug=$(basename "$f" .html)
  title=$(grep -m1 '<title>' "$f" | sed -e 's/.*<title>//;s/<\/title>.*//;s/ | Weekend MVP$//')
  echo "$slug | $title"
done
```

Expected output: 15 lines (the `markdown` directory is also in `articles/` but has no HTML files inside the listing — confirmed by earlier inspection).

- [ ] **Step 2: For each article, capture description + word count**

Run this for one article first to verify the approach:

```bash
node -e "
const fs = require('fs');
const cheerio = require('cheerio');
const slug = 'the-3-screen-mvp-framework';
const html = fs.readFileSync('articles/' + slug + '.html', 'utf8');
const \$ = cheerio.load(html);
const title = \$('title').text().replace(/ \\| Weekend MVP\$/, '').trim();
const description = \$('meta[property=\"og:description\"]').attr('content') || '';
const bodyText = \$('body').text().replace(/\\s+/g, ' ').trim();
const wordCount = bodyText.split(' ').filter(Boolean).length;
const readMinutes = Math.max(1, Math.round(wordCount / 200));
console.log({ slug, title, description, wordCount, readMinutes });
"
```

Expected: prints a JSON-like object with title, description, wordCount, readMinutes for the article.

- [ ] **Step 3: Author all 16 entries by hand into `articles/manifest.json`**

Create the file with the structure below. For each entry:
- Use the slug + title + description + wordCount + readMinutes from Step 2's approach
- Author `og.subject` as a director's note in the reading/thinking object world (open notebook, bookmark, highlighted page, sticky note, pencil, paperback book — single accent light, dark surface, late-night atmosphere)
- Distribute `og.accent` across `lime` / `mint` / `lavender` / `emerald` / `aubergine` to avoid monotony

```json
{
  "articles": [
    {
      "slug": "5-claude-code-skills-for-solo-founders",
      "title": "5 Claude Code Skills for Solo Founders",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": {
        "subject": "<director's note>",
        "accent": "lime",
        "status": "pending"
      }
    },
    {
      "slug": "5-side-projects-that-make-money",
      "title": "5 Side Projects That Make Money",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "mint", "status": "pending" }
    },
    {
      "slug": "7-micro-saas-ideas-solo-2026",
      "title": "7 Micro-SaaS Ideas for Solo Founders in 2026",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lavender", "status": "pending" }
    },
    {
      "slug": "7-things-to-build-with-claude-code-this-weekend",
      "title": "7 Things to Build with Claude Code This Weekend",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "emerald", "status": "pending" }
    },
    {
      "slug": "claude-code-48-hour-workflow",
      "title": "The Claude Code 48-Hour Workflow",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lime", "status": "pending" }
    },
    {
      "slug": "claude-code-for-non-technical-founders",
      "title": "Claude Code for Non-Technical Founders",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lavender", "status": "pending" }
    },
    {
      "slug": "claude-code-on-your-phone",
      "title": "Claude Code on Your Phone",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "mint", "status": "pending" }
    },
    {
      "slug": "how-to-build-your-first-app-in-a-weekend",
      "title": "How to Build Your First App in a Weekend",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lime", "status": "pending" }
    },
    {
      "slug": "stop-overthinking-start-building",
      "title": "Stop Overthinking, Start Building",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "emerald", "status": "pending" }
    },
    {
      "slug": "the-1k-month-idea",
      "title": "The $1K/Month Idea",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lime", "status": "pending" }
    },
    {
      "slug": "the-3-screen-mvp-framework",
      "title": "The 3-Screen MVP Framework",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lavender", "status": "pending" }
    },
    {
      "slug": "validate-startup-idea-48-hours",
      "title": "Validate a Startup Idea in 48 Hours",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "mint", "status": "pending" }
    },
    {
      "slug": "vibe-coding-101",
      "title": "Vibe Coding 101: Build Real Apps with Claude, Cursor, and Bolt",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lime", "status": "pending" }
    },
    {
      "slug": "when-to-quit-your-job",
      "title": "When to Quit Your Job",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "aubergine", "status": "pending" }
    },
    {
      "slug": "why-chatgpt-cant-give-good-startup-ideas",
      "title": "Why ChatGPT Can't Give You Good Startup Ideas",
      "description": "<copied from page>",
      "wordCount": 0,
      "readMinutes": 0,
      "og": { "subject": "<director's note>", "accent": "lavender", "status": "pending" }
    }
  ]
}
```

For each entry, replace `<copied from page>` (description), `0` (wordCount + readMinutes), and `<director's note>` with real values. Examples of director's notes in the reading/thinking object world:

- "An open notebook on a dark surface with a single line of mint-glowing handwriting visible, very shallow focus"
- "A closed paperback book on a near-black desk, lavender-edged bookmark protruding, single overhead lamp lighting the cover"
- "A sticky note crumpled at the edge of a dark desk, one word lit by a phone screen glow in lime"
- "A pencil mid-stroke on dark paper, single emerald light glancing off the lead, very shallow focus"
- "A page with a few sentences highlighted in lavender, the rest of the desk falling into deep shadow"

Real titles + descriptions can guide the subject choice — e.g., "Stop Overthinking, Start Building" pairs well with "an unopened notebook with a pencil resting on the cover, single overhead lamp, late-night."

- [ ] **Step 4: Verify the manifest parses + can be loaded by the source**

```bash
node -e "
JSON.parse(require('fs').readFileSync('articles/manifest.json'));
console.log('JSON OK');
" && node -e "
import('./lib/og/sources/articles.mjs').then((m) => m.listArticles()).then((items) => {
  console.log('Loaded', items.length, 'articles');
  const undef = items.filter((i) => !i.subject);
  if (undef.length > 0) {
    console.log('Items without subject:', undef.map((i) => i.slug));
    process.exit(1);
  }
  console.log('All items have subjects.');
});
"
```

Expected: prints `JSON OK` then `Loaded 15 articles` then `All items have subjects.` (15, not 16, because the `markdown/` directory in `articles/` is not an article HTML file.)

- [ ] **Step 5: Verify dry-run picks them up**

```bash
node scripts/generate-og-cards.mjs --dry-run --surface article | head -20
```

Expected: prints `DRY  article/{slug}` lines for 15 articles, each with their authored subject.

- [ ] **Step 6: Commit**

```bash
git add articles/manifest.json
git commit -m "article-og: backfill 15 articles with og.subject + og.accent + readMinutes"
```

(Note: the spec mentions 16 articles but Task 9 Step 1 will reveal the exact count from the directory listing — likely 15 since `markdown/` is a subdirectory.)

---

## Task 10: Update each article HTML's `og:image` / `twitter:image` / JSON-LD `image`

**Files:**
- Modify: `articles/{slug}.html` × 15

Each article currently points at `https://weekendmvp.app/image/og-image.png` in three places: `<meta property="og:image">`, `<meta property="twitter:image">`, and the JSON-LD Article block's `image` field. Update all three to `https://weekendmvp.app/image/og/article/{slug}.png`.

- [ ] **Step 1: Loop through all 15 article files and replace**

Run this script (it parses the slug from the filename and does a global string replace within each file):

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'articles';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
let total = 0;
for (const f of files) {
  const slug = f.replace(/\\.html\$/, '');
  const target = \`https://weekendmvp.app/image/og/article/\${slug}.png\`;
  const filePath = path.join(dir, f);
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.split('https://weekendmvp.app/image/og-image.png').join(target);
  if (updated !== content) {
    fs.writeFileSync(filePath, updated);
    const n = (content.match(/https:\\/\\/weekendmvp\\.app\\/image\\/og-image\\.png/g) || []).length;
    console.log('updated', slug, '(' + n + ' replacements)');
    total += n;
  }
}
console.log('Total replacements:', total);
"
```

Expected: prints one line per file with `updated {slug} (3 replacements)` (or similar — count varies if some pages have non-OG references), and a total line.

- [ ] **Step 2: Spot-check one file**

```bash
grep -E 'og:image|twitter:image|"image":' articles/the-3-screen-mvp-framework.html | head -5
```

Expected: every line should reference `image/og/article/the-3-screen-mvp-framework.png`. No remaining `image/og-image.png`.

- [ ] **Step 3: Confirm zero stragglers across all 15 articles**

```bash
grep -l 'image/og-image.png' articles/*.html
```

Expected output: nothing. (If any files are listed, they have references that didn't match the exact replacement — investigate and fix.)

- [ ] **Step 4: Commit**

```bash
git add articles/*.html
git commit -m "articles: wire 15 pages to per-page OG cards"
```

---

## Task 11: Generate the 15 article cards (real Recraft calls)

**Files:**
- Generates: `image/og/article/{slug}.png` × 15

This is operator work that requires `RECRAFT_API_KEY` (and `RECRAFT_STYLE_ID` for brand consistency) in `.env.local`.

- [ ] **Step 1: Sanity-check env vars are in place**

```bash
grep -E '^RECRAFT_API_KEY=|^OPENAI_API_KEY=' .env.local | sed -E 's/=.*$/=<set>/'
```

Expected:
```
RECRAFT_API_KEY=<set>
OPENAI_API_KEY=<set>
```

If either is missing, see `IMAGES.md` § One-time setup before continuing.

- [ ] **Step 2: Run the article batch (15 Recraft calls, ~$0.60)**

```bash
npm run og:generate:articles
```

Expected: 15 `GEN ✓ recraft` lines, no fallbacks (or 1-2 fallbacks if any subject hits Recraft's content moderation).

- [ ] **Step 3: Open the output dir for thumbnail-row drift check**

```bash
open image/og/article/
```

Switch Finder to thumbnail view. Eyeball the 15 cards as a row:
1. Same dark + accent palette across all?
2. WMV logo readable in the left panel?
3. ARTICLE label visible in accent color?
4. Title legible at thumbnail size?
5. Read-time chip readable at the bottom?
6. Bottom accent bar consistent?

If any card sticks out (different vibe, washed out, weird crop), force-regenerate just that one:

```bash
node scripts/generate-og-cards.mjs --slug {slug} --surface article --force
```

If 3+ cards feel off, it's likely a `STYLE_BLUEPRINT` drift — see `IMAGES.md` § Drift recovery.

- [ ] **Step 4: Confirm the build gate passes**

```bash
STRICT=1 npm run check:og-cards
```

Expected exit code: 0. Output should mention both surfaces ("9 idea entries OK", "15 article entries OK", "24 total entries OK").

- [ ] **Step 5: Commit the PNGs + the manifest's status writebacks**

```bash
git add image/og/article/*.png articles/manifest.json
git commit -m "article-og: ship 15 article OG cards"
```

---

## Task 12: Update `IMAGES.md` to document the article surface + per-template config

**Files:**
- Modify: `IMAGES.md`

The current docs only describe the idea surface. Add a section documenting the article surface, the per-template config pattern, and how to add future surfaces.

- [ ] **Step 1: Add a new section to `IMAGES.md` (insert before "Adding new surfaces")**

Find the existing "Adding new surfaces (articles, newsletter, carousel)" section near the bottom of `IMAGES.md` and replace it with the expanded content below:

````markdown
## Article surface

Articles use a different layout than ideas (split-frame editorial poster):

- Left 40% (`480px`): solid `#050505` panel containing WMV logo, "ARTICLE" label (Geist Mono, accent color), title (Geist Bold, autoshrunk), and a "X MIN READ" chip
- Right 60% (`720px`): Recraft scene
- Bottom: 4px accent bar spanning the full width

Generate with:

```bash
npm run og:generate:articles            # missing only
npm run og:generate:articles -- --force # regenerate all
node scripts/generate-og-cards.mjs --slug {slug} --surface article
```

Same `STYLE_BLUEPRINT` text anchor as ideas. Subjects shift toward reading/thinking objects (open notebook, bookmark, highlighted page, sticky note, pencil mid-stroke) instead of doing-objects (laptop, phone, watch). The brand world stays the same: dark surface, single accent light, late-night atmosphere.

Manifest at `articles/manifest.json` — same `og.subject` / `og.accent` / `og.status` schema as ideas, plus a `readMinutes` field that drives the read-time chip in the lower-left corner.

## Per-template config (how surfaces are decoupled)

Each template module in `lib/og/templates/` exports a `config` object:

```js
export const config = {
  width: 1200,                                       // canvas width
  height: 630,                                       // canvas height
  bgRect: { x: 0, y: 0, width: 1200, height: 630 }, // where the Recraft image goes
  bgFill: '#050505'                                  // fills any pixels outside bgRect
};
```

`compose.mjs` reads this config to:
1. Resize the Recraft buffer to `bgRect.{width,height}` (sharp, fit:cover, position:centre)
2. Build a frame-sized canvas with `bgFill` background
3. Place the resized Recraft image at `(bgRect.x, bgRect.y)`
4. Render the Satori chrome over the full canvas (chrome's root must be transparent)

Idea cards have `bgRect = full frame`. Article cards have `bgRect = right 60%`. New surfaces (newsletter, carousel) just declare their own `config` — no compose changes needed.

## Adding a new surface (newsletter, carousel, etc.)

1. Create `lib/og/templates/{surface}.mjs` exporting `buildElement({title, accent, ...})` + `config`
2. Create `lib/og/sources/{surface}.mjs` exporting `list{Surface}({manifestPath?})` returning items with `surface`, `slug`, `title`, `subject`, `accent`, `outputPath` fields
3. Register the template in `lib/og/compose.mjs`'s `TEMPLATES` map
4. Add the source to the orchestrator's `loadAllItems` and the `MANIFEST_PATHS` / `MANIFEST_KEYS` lookups
5. Add the surface to `scripts/check-og-cards.js`'s `surfaces` array
6. Add `og:generate:{surface}` to `package.json` scripts
7. Author the manifest + run the batch

See the spec at `docs/superpowers/specs/2026-05-02-article-og-cards-design.md` for how this pattern was established.
````

- [ ] **Step 2: Commit**

```bash
git add IMAGES.md
git commit -m "article-og: document article surface + per-template config in IMAGES.md"
```

---

## Task 13: Hook OG card generation into `publish-article` skill

**Files:**
- Modify: `.claude/skills/publish-article/SKILL.md` (gitignored — local only)

The `publish-article` skill currently doesn't generate OG cards. Apply the same 5-point integration pattern that was used for `publish-idea`:

1. Add `og_subject` + `og_accent` + `readMinutes` to required fields
2. Update meta tag templates to point at `image/og/article/{slug}.png`
3. Update JSON-LD Article schema's `image` field
4. Add `og` block to manifest entry (`pending` initially)
5. Add a final step that invokes `node scripts/generate-og-cards.mjs --slug {slug} --surface article --non-blocking`

Because `.claude/skills/` is gitignored on this project, the changes are local-only and won't be committed.

- [ ] **Step 1: Read the current skill**

```bash
cat .claude/skills/publish-article/SKILL.md | head -80
```

Note where the existing skill: defines required fields, writes meta tags, writes the manifest entry (or its equivalent), and where its final step / output report lives.

- [ ] **Step 2: Add `og_subject` + `og_accent` + `readMinutes` to the required-fields section**

Find the section that lists fields the skill must author (look for "Required fields", "always generate", or similar). Add these three:

- `og_subject`: A concrete director's-note for the per-page OG card (Recraft prompt subject). Match the brand: dark scene, one accent color visible, ONE reading/thinking object (open notebook, bookmark, highlighted page, sticky note, pencil mid-stroke), no people / faces / text. See `IMAGES.md` for the full prompt-writing guide.
- `og_accent`: One of `lime`, `mint`, `lavender`, `emerald`, `aubergine` — the brand accent for the article card's ARTICLE label, dot, and bottom bar.
- `readMinutes`: Estimated read time in minutes, computed as `Math.max(1, Math.round(wordCount / 200))`.

- [ ] **Step 3: Update the meta tags and JSON-LD `image` template the skill writes**

Find where the skill writes the article HTML's `<head>`. Update the OG/Twitter image meta tags + the JSON-LD Article block's `image` field to point at `https://weekendmvp.app/image/og/article/{slug}.png`:

```html
<meta property="og:image" content="https://weekendmvp.app/image/og/article/{slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="twitter:image" content="https://weekendmvp.app/image/og/article/{slug}.png">
```

```json
"image": "https://weekendmvp.app/image/og/article/{slug}.png"
```

- [ ] **Step 4: Add the `og` block to the manifest entry the skill writes**

If the skill writes to `articles/manifest.json` (it might not yet), include an `og` block on the new entry:

```json
{
  "slug": "{slug}",
  "title": "{title}",
  "publishedAt": "{YYYY-MM-DD}",
  "description": "{meta_description}",
  "wordCount": {wordCount},
  "readMinutes": {readMinutes},
  "og": {
    "subject": "{og_subject from required fields}",
    "accent": "{og_accent from required fields}",
    "status": "pending"
  }
}
```

If the skill doesn't yet manage `articles/manifest.json`, add a step before Step 5 that creates / appends to it.

- [ ] **Step 5: Add a final step that invokes the OG generator**

After the manifest is in place, append:

````markdown
### Step N: Generate the per-page OG card (best-effort, never blocks publish)

```bash
node scripts/generate-og-cards.mjs --slug {slug} --surface article --non-blocking
```

Behavior:
- Success: writes `image/og/article/{slug}.png`, flips manifest `og.status` to `"ready"`.
- Failure (Recraft AND `gpt-image-1` both errored): flips `og.status` to `"failed"`, exits 0 (because `--non-blocking`). The publish flow continues. Page meta tags already point at the expected PNG path; social crawlers fall back to the site-wide `image/og-image.png` automatically when the file is missing. A future `npm run og:generate:articles` run will retry every entry with `og.status: "failed"`.

**Critical invariant:** publish-article's success status MUST be independent of the OG card outcome.
````

- [ ] **Step 6: Update the skill's checklist / output report**

If the skill has a checklist or an output report template, add OG card items to it:

- Manifest entry includes `og.subject` + `og.accent` + `og.status: "pending"`
- `og:image` and `twitter:image` meta tags point at `image/og/article/{slug}.png`
- JSON-LD Article `image` field points at the same path
- Ran `node scripts/generate-og-cards.mjs --slug {slug} --surface article --non-blocking`
- Confirmed `og.status` is `"ready"` or `"failed"` (publish proceeds either way)

- [ ] **Step 7: Verify the file saves and parses**

```bash
ls -la .claude/skills/publish-article/SKILL.md
```

Expected: file exists, modified just now. (No commit — `.claude/skills/` is in `.gitignore`.)

---

## Self-review

After writing the complete plan, I checked it against the spec.

**1. Spec coverage:** every section/requirement in the spec maps to a task:
- Spec § Architecture (per-template config refactor) → Tasks 3 + 4 + 5
- Spec § Article template layout → Task 4
- Spec § Brand consistency / Recraft subjects → Task 9 (subject authorship guidance + examples)
- Spec § Manifest schema → Task 6 (source) + Task 9 (manifest authorship)
- Spec § File structure → all tasks (each file mentioned in spec is created/modified by a numbered task)
- Spec § Data flow → Task 7
- Spec § `updateManifestStatus` change → Task 7 (signature change + dual-manifest test)
- Spec § Backfill content → Task 9 (15 entries authored)
- Spec § Error handling → inherits v1 pipeline; covered by Task 7's --non-blocking + provider fallback
- Spec § Verification → Tasks 7, 8, 11 (dry-run smoke, build gate, eyeball)
- Spec § v1 task list (13 items) → Tasks 1-13 of this plan, in matching order

**2. Placeholder scan:** no `TBD`, `TODO`, `implement later`, or "Add appropriate error handling". One spot uses `<copied from page>` and `<director's note>` placeholders inside the `articles/manifest.json` skeleton in Task 9 — these are explicit content-authorship slots with concrete instructions on how to fill them (read the article, parse fields, author per the brand) and concrete examples directly above. That's authorship guidance, not a plan failure.

**3. Type consistency:**
- `compose({bgBuffer, title, surface, accent, readMinutes})` (Task 5) matches what orchestrator calls (Task 7 — adds `readMinutes` from item)
- `updateManifestStatus(surface, slug, status, {rootDir?})` consistent across Tasks 7 and 8
- Template `config` shape `{width, height, bgRect:{x,y,width,height}, bgFill}` consistent across Tasks 3, 4, 5
- `listArticles({manifestPath?})` returns same item shape as `listIdeas` plus `readMinutes` (Task 6) — orchestrator handles both uniformly (Task 7)
- Surface name string `'article'` (singular, matches `surface: 'article'` in source items) used consistently — NOT `'articles'`

---

## Out of scope (next surfaces — own plans)

- Newsletter HTML archive page OG cards (Surface B)
- Newsletter inline email illustration (Surface C — different consumption context, possibly different aspect ratio)
- Carousel slide-1 hero (Surface D — 1080×1350 portrait, integrates with existing carousel pipeline)
- Article in-page hero illustration (separate from the OG card)
