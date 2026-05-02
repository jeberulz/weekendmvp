# Email Newsletter Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `email-newsletter` surface to the existing pipeline that produces a 600×400 JPG hero per Beehiiv newsletter (no chrome — pure Recraft scene), reusing the existing `newsletter/manifest.json` and writing to a separate status field so it doesn't clobber the OG newsletter card surface.

**Architecture:** New `email-newsletter` surface is a 2-file addition (template config-only + source) that reads the same `newsletter/manifest.json` Surface B uses and produces a 600×400 JPG output at `image/email/newsletter/{slug}.jpg`. The compose pipeline gains two minor extensions: (1) when a template doesn't export `buildElement`, skip Satori entirely and return the canvas directly; (2) honor `format: 'jpeg' | 'png'` from template config. Status writes are routed through a new `STATUS_FIELDS` lookup so OG card (`og.status`) and email hero (`og.emailStatus`) stay independent on the same manifest entry.

**Tech Stack:** Same as v1 + Surfaces A/B (Node 20+ ESM, satori, @resvg/resvg-js, sharp, Geist + Geist Mono via @fontsource, node:test). Sharp's `.jpeg({quality, mozjpeg})` handles JPG output.

**Spec:** `docs/superpowers/specs/2026-05-02-email-newsletter-hero-design.md`

---

## File Structure

**New files:**
```
lib/og/templates/email-newsletter.mjs           — config only (600x400 JPG, no buildElement)
lib/og/sources/email-newsletter.mjs             — listEmailNewsletter (reads newsletter/manifest.json, returns surface='email-newsletter')
image/email/newsletter/.gitkeep                 — output dir placeholder
tests/og/templates-email-newsletter.test.mjs
tests/og/sources-email-newsletter.test.mjs
```

**Modified files:**
```
lib/og/compose.mjs                              — register email-newsletter; handle "no buildElement" path; honor format from config
scripts/generate-og-cards.mjs                   — add email-newsletter to MANIFEST_PATHS, MANIFEST_KEYS; add STATUS_FIELDS lookup; refactor updateManifestStatus to use it; add listEmailNewsletter to loadAllItems
scripts/check-og-cards.js                       — add email-newsletter to surfaces array (note: shares manifest with newsletter, different pngDir + extension)
package.json                                    — add og:generate:email-newsletter script
IMAGES.md                                       — document email surface + no-chrome / JPG pattern
.claude/skills/newsletter/SKILL.md              — write markdown image ref into BODY + invoke email generator (gitignored, local only)
```

**Why this shape:** The pattern from Surface A (per-template config) + Surface B (newsletter manifest) extends naturally — a NEW surface is a template + source + manifest, but here the manifest is REUSED so we only add 2 lib files. The compose extensions are additive (optional chaining + format dispatch); idea/article/newsletter templates keep their existing exports and behaviors.

---

## Task 1: Add `og:generate:email-newsletter` script + create output dir

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the npm script**

In `package.json`, add ONE new entry to the `scripts` block alongside the existing `og:generate:newsletter` entry:

```json
"og:generate:email-newsletter": "node scripts/generate-og-cards.mjs --surface email-newsletter",
```

Final scripts block (do NOT modify any other entry):

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
  "og:generate:email-newsletter": "node scripts/generate-og-cards.mjs --surface email-newsletter",
  "test:og": "node --test tests/og/"
}
```

- [ ] **Step 2: Create the output dir placeholder**

```bash
mkdir -p image/email/newsletter
touch image/email/newsletter/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add package.json image/email/newsletter/.gitkeep
git commit -m "email-og: add og:generate:email-newsletter script + output dir"
```

---

## Task 2: Create the email-newsletter template (config only, no buildElement)

**Files:**
- Create: `lib/og/templates/email-newsletter.mjs`
- Test: `tests/og/templates-email-newsletter.test.mjs`

This template is fundamentally simpler than the OG templates — it has NO `buildElement` export. The compose module (Task 4) detects the absence of `buildElement` and returns the canvas directly without rendering Satori chrome. The config declares 600×400 dims, full-bleed bgRect, and `format: 'jpeg'` for sharp's output encoder.

- [ ] **Step 1: Write the failing test**

Create `tests/og/templates-email-newsletter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as emailTemplate from '../../lib/og/templates/email-newsletter.mjs';

test('email-newsletter template exports a config object with 600x400 full-bleed JPG', () => {
  assert.ok(emailTemplate.config, 'config export missing');
  assert.equal(emailTemplate.config.width, 600);
  assert.equal(emailTemplate.config.height, 400);
  assert.deepEqual(emailTemplate.config.bgRect, { x: 0, y: 0, width: 600, height: 400 });
  assert.equal(emailTemplate.config.bgFill, '#050505');
  assert.equal(emailTemplate.config.format, 'jpeg');
  assert.equal(emailTemplate.config.jpegQuality, 85);
});

test('email-newsletter template has NO buildElement export (image-only surface)', () => {
  // The compose module uses the absence of buildElement as the signal that
  // this is an image-only surface — no Satori chrome rendered.
  assert.equal(emailTemplate.buildElement, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/templates-email-newsletter.test.mjs
```

Expected: FAIL with "Cannot find module '../../lib/og/templates/email-newsletter.mjs'".

- [ ] **Step 3: Implement the template**

Create `lib/og/templates/email-newsletter.mjs`:

```js
// Per-template canvas config consumed by compose.mjs.
// Email newsletter heroes are 600x400 full-bleed JPGs with NO chrome —
// the compose module detects the absence of `buildElement` and skips
// Satori chrome rendering, returning the resized Recraft scene directly.
//
// JPEG instead of PNG because email clients (Gmail, Apple Mail, Outlook)
// prefer JPG for hero photography — smaller file size, broadly supported.
export const config = {
  width: 600,
  height: 400,
  bgRect: { x: 0, y: 0, width: 600, height: 400 },
  bgFill: '#050505',
  format: 'jpeg',
  jpegQuality: 85
};

// Intentionally no `buildElement` export — this is an image-only surface.
// See `lib/og/compose.mjs` for the no-chrome code path.
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/templates-email-newsletter.test.mjs
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Run full OG suite for regressions**

```bash
npm run test:og
```

Expected: all tests pass (existing 66 + new 2).

- [ ] **Step 6: Commit**

```bash
git add lib/og/templates/email-newsletter.mjs tests/og/templates-email-newsletter.test.mjs
git commit -m "email-og: add email-newsletter template (config only, no chrome)"
```

---

## Task 3: Create the email-newsletter source

**Files:**
- Create: `lib/og/sources/email-newsletter.mjs`
- Test: `tests/og/sources-email-newsletter.test.mjs`

The source reuses the same `newsletter/manifest.json` Surface B's `listNewsletter` reads. It produces items with `surface: 'email-newsletter'`, JPG `outputPath`, and reads the email-specific status from `og.emailStatus` (NOT `og.status` — which belongs to the OG card surface).

- [ ] **Step 1: Write the failing test**

Create `tests/og/sources-email-newsletter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listEmailNewsletter } from '../../lib/og/sources/email-newsletter.mjs';

// Reuses the existing newsletter fixture so both surfaces share data.
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/newsletter-manifest-fixture.json'
);

test('listEmailNewsletter returns one item per newsletter', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.length, 4); // matches fixture
});

test('listEmailNewsletter sets surface=email-newsletter on every item', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'email-newsletter');
  }
});

test('listEmailNewsletter outputPath uses image/email/newsletter/{slug}.jpg', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  const am = items.find((i) => i.slug === '2026-05-01-am');
  assert.equal(am.outputPath, 'image/email/newsletter/2026-05-01-am.jpg');
});

test('listEmailNewsletter reuses og.subject from the same manifest entry as the OG card', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  const am = items.find((i) => i.slug === '2026-05-01-am');
  // From fixture: og.subject = "An AM-specific director's note"
  assert.equal(am.subject, "An AM-specific director's note");
});

test('listEmailNewsletter reads status from og.emailStatus (NOT og.status)', async () => {
  // Build a temp fixture with both fields set differently, verify which one is read.
  const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(join(tmpdir(), 'email-newsletter-src-'));
  const path = join(dir, 'newsletter.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [
        {
          slug: '2026-05-01-pm',
          title: 'X',
          edition: 'pm',
          og: { subject: 's', status: 'ready', emailStatus: 'failed' }
        }
      ]
    })
  );
  const items = await listEmailNewsletter({ manifestPath: path });
  assert.equal(items[0].status, 'failed', 'should read og.emailStatus, not og.status');
  await rm(dir, { recursive: true, force: true });
});

test('listEmailNewsletter auto-derives accent from slug suffix (am→mint, pm→lavender)', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.find((i) => i.slug === '2026-05-01-am').accent, 'mint');
  assert.equal(items.find((i) => i.slug === '2026-05-01-pm').accent, 'lavender');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/sources-email-newsletter.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the source**

Create `lib/og/sources/email-newsletter.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deriveAccent } from './newsletter.mjs';

const DEFAULT_MANIFEST = join(process.cwd(), 'newsletter/manifest.json');
const DEFAULT_ACCENT = 'lime';

// Reads the same newsletter/manifest.json that listNewsletter reads, but
// produces items for the `email-newsletter` surface — different outputPath
// (JPG instead of PNG, image/email/newsletter/ instead of image/og/newsletter/)
// and reads status from og.emailStatus (NOT og.status, which belongs to the
// OG card surface). Reuses og.subject so the email scene visually matches
// the OG card scene.
export async function listEmailNewsletter({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.newsletters)) {
    throw new Error(`manifest at ${manifestPath} has no "newsletters" array`);
  }
  return manifest.newsletters.map((entry) => {
    const og = entry.og ?? {};
    const subject = og.subject ?? entry.description ?? entry.title;
    const accent = og.accent ?? deriveAccent(entry.slug);
    return {
      slug: entry.slug,
      title: entry.title,
      subject,
      accent,
      surface: 'email-newsletter',
      outputPath: `image/email/newsletter/${entry.slug}.jpg`,
      status: og.emailStatus
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/sources-email-newsletter.test.mjs
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run full OG suite for regressions**

```bash
npm run test:og
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/og/sources/email-newsletter.mjs tests/og/sources-email-newsletter.test.mjs
git commit -m "email-og: add email-newsletter source (reuses newsletter manifest)"
```

---

## Task 4: Compose handles no-chrome path + format dispatch

**Files:**
- Modify: `lib/og/compose.mjs`
- Modify: `tests/og/compose.test.mjs`

Two extensions to compose, both purely additive:
1. When `tpl.buildElement` is undefined, skip the Satori chrome render entirely. The canvas (which IS the resized Recraft scene because bgRect = full frame) becomes the final output directly.
2. Honor `cfg.format === 'jpeg'` to encode JPEG with `cfg.jpegQuality` (default 85). Default remains PNG.

- [ ] **Step 1: Append three new tests to `tests/og/compose.test.mjs`** (KEEP all existing tests intact, add at end)

```js
test('compose returns a 600x400 JPEG buffer for surface=email-newsletter (no chrome)', async () => {
  const png = await compose({
    bgBuffer: await fakeBg(),
    title: 'Sample Email Hero',
    surface: 'email-newsletter',
    accent: 'mint'
  });
  assert.ok(Buffer.isBuffer(png));
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 600);
  assert.equal(meta.height, 400);
  assert.equal(meta.format, 'jpeg', 'output format should be JPEG, not PNG');
});

test('email-newsletter output has NO chrome — full-bleed Recraft scene', async () => {
  // Use a bright RED stand-in. The entire output should be dominantly red
  // because there's no Satori chrome compositing dark text/postmark on top.
  // Sample multiple points across the frame.
  const redBg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();

  const jpg = await compose({
    bgBuffer: redBg,
    title: 'Red Test',
    surface: 'email-newsletter',
    accent: 'lavender'
  });

  const raw = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const channels = info.channels;

  // Sample 4 corners + center — all should be dominantly red (allowing
  // some JPEG compression noise, but >180 R is safe with quality=85).
  const samples = [
    { x: 50, y: 50, label: 'top-left' },
    { x: 550, y: 50, label: 'top-right' },
    { x: 50, y: 350, label: 'bottom-left' },
    { x: 550, y: 350, label: 'bottom-right' },
    { x: 300, y: 200, label: 'center' }
  ];
  for (const { x, y, label } of samples) {
    const idx = (y * info.width + x) * channels;
    assert.ok(data[idx] > 180, `${label} pixel should be dominantly red, got R=${data[idx]}`);
  }
});

test('compose throws on unknown surface (regression)', async () => {
  await assert.rejects(
    compose({
      bgBuffer: await fakeBg(),
      title: 'X',
      surface: 'totally-unknown',
      accent: 'lime'
    }),
    /unknown surface/i
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/compose.test.mjs
```

Expected: FAIL — `compose: unknown surface "email-newsletter"` (template not registered yet).

- [ ] **Step 3: Replace ALL of `lib/og/compose.mjs` with this**

```js
import satori from 'satori';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.mjs';
import { loadLogoDataUrl } from './assets.mjs';
import * as ideaTemplate from './templates/idea.mjs';
import * as articleTemplate from './templates/article.mjs';
import * as newsletterTemplate from './templates/newsletter.mjs';
import * as emailNewsletterTemplate from './templates/email-newsletter.mjs';

const TEMPLATES = {
  idea: ideaTemplate,
  article: articleTemplate,
  newsletter: newsletterTemplate,
  'email-newsletter': emailNewsletterTemplate
  // carousel — added in follow-up surfaces
};

// Encode the final sharp pipeline to PNG or JPEG depending on template config.
// Defaults to PNG (the OG card pattern); email surfaces opt in to JPEG via
// `format: 'jpeg'` + optional `jpegQuality` in their config.
function applyFormat(pipeline, cfg) {
  if (cfg.format === 'jpeg') {
    return pipeline.jpeg({ quality: cfg.jpegQuality ?? 85, mozjpeg: true });
  }
  return pipeline.png();
}

// Surface-agnostic 2-pass composite:
//   1. sharp resizes the Recraft bg to template.config.bgRect dimensions
//   2. sharp builds a frame-sized canvas, places fittedBg at bgRect offset
//   3. (only if template exports buildElement) Satori renders the chrome,
//      then sharp composites the chrome PNG over the canvas
//   4. encode to format (PNG or JPEG per config) and return the buffer
//
// Image-only surfaces (no buildElement) skip step 3 entirely and emit the
// canvas directly.
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

  // 3. If the template has a chrome layer, render + composite it.
  // Image-only surfaces (no buildElement) skip this entirely.
  if (typeof tpl.buildElement === 'function') {
    const [fonts, logoDataUrl] = await Promise.all([
      loadFonts(),
      loadLogoDataUrl({ height: 28, color: '#FFFFFF' })
    ]);

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

    return await applyFormat(
      sharp(canvas).composite([{ input: chromePng, top: 0, left: 0 }]),
      cfg
    ).toBuffer();
  }

  // No chrome — canvas IS the final output. Just encode to the right format.
  return await applyFormat(sharp(canvas), cfg).toBuffer();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/compose.test.mjs
```

Expected: PASS, all tests including the 3 new email-newsletter tests.

- [ ] **Step 5: Run full OG suite for regressions**

```bash
npm run test:og
```

Expected: all tests pass. Idea/article/newsletter surfaces still produce PNG (their templates have buildElement; their configs don't set `format`, so PNG default applies).

- [ ] **Step 6: Commit**

```bash
git add lib/og/compose.mjs tests/og/compose.test.mjs
git commit -m "email-og: compose handles no-chrome path + jpeg format dispatch"
```

---

## Task 5: Orchestrator iterates email-newsletter + STATUS_FIELDS lookup

**Files:**
- Modify: `scripts/generate-og-cards.mjs`
- Modify: `tests/og/orchestrator.test.mjs`

Add `email-newsletter` to MANIFEST_PATHS, MANIFEST_KEYS, and a NEW `STATUS_FIELDS` lookup (since OG card writes `og.status` but email writes `og.emailStatus`). Update `updateManifestStatus` to use `STATUS_FIELDS` instead of hard-coding `'status'`. Add `listEmailNewsletter` to `loadAllItems`.

- [ ] **Step 1: Append two new tests to `tests/og/orchestrator.test.mjs`** (KEEP existing tests intact, add at end)

```js
test('updateManifestStatus writes to og.emailStatus for surface=email-newsletter', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  const path = join(dir, 'newsletter/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [{ slug: '2026-05-01-am', title: 'AM', edition: 'am' }]
    }, null, 2)
  );

  await updateManifestStatus('email-newsletter', '2026-05-01-am', 'ready', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const entry = json.newsletters.find((i) => i.slug === '2026-05-01-am');
  assert.equal(entry.og.emailStatus, 'ready', 'writes to emailStatus, not status');
  assert.equal(entry.og.status, undefined, 'does not touch og.status');

  await rm(dir, { recursive: true, force: true });
});

test('updateManifestStatus surface=newsletter and surface=email-newsletter share manifest but use different fields', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  const path = join(dir, 'newsletter/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [{ slug: '2026-05-01-pm', title: 'PM', edition: 'pm', og: { subject: 's' } }]
    }, null, 2)
  );

  await updateManifestStatus('newsletter', '2026-05-01-pm', 'ready', { rootDir: dir });
  await updateManifestStatus('email-newsletter', '2026-05-01-pm', 'failed', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const entry = json.newsletters.find((i) => i.slug === '2026-05-01-pm');
  assert.equal(entry.og.status, 'ready', 'OG card status preserved');
  assert.equal(entry.og.emailStatus, 'failed', 'email status independent');
  assert.equal(entry.og.subject, 's', 'existing fields preserved');

  await rm(dir, { recursive: true, force: true });
});

test('parseArgs handles --surface email-newsletter', () => {
  const opts = parseArgs(['--surface', 'email-newsletter']);
  assert.equal(opts.surface, 'email-newsletter');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/orchestrator.test.mjs
```

Expected: FAIL — `updateManifestStatus` writes to `og.status` for ALL surfaces (no STATUS_FIELDS lookup yet).

- [ ] **Step 3: Modify `scripts/generate-og-cards.mjs`**

Make these specific changes:

**(a)** Replace the import block. Find:

```js
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { listArticles } from '../lib/og/sources/articles.mjs';
import { listNewsletter } from '../lib/og/sources/newsletter.mjs';
```

Replace with:

```js
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { listArticles } from '../lib/og/sources/articles.mjs';
import { listNewsletter } from '../lib/og/sources/newsletter.mjs';
import { listEmailNewsletter } from '../lib/og/sources/email-newsletter.mjs';
```

**(b)** Replace the `MANIFEST_PATHS` block. Find:

```js
const MANIFEST_PATHS = {
  idea: 'ideas/manifest.json',
  article: 'articles/manifest.json',
  newsletter: 'newsletter/manifest.json'
};
```

Replace with:

```js
// Surface → manifest path (relative to root). Each source returns items with
// item.surface set, so this is just a lookup table for status writeback.
// Note: `newsletter` and `email-newsletter` SHARE the same manifest path —
// they write to different status fields (see STATUS_FIELDS below).
const MANIFEST_PATHS = {
  idea: 'ideas/manifest.json',
  article: 'articles/manifest.json',
  newsletter: 'newsletter/manifest.json',
  'email-newsletter': 'newsletter/manifest.json'
};
```

**(c)** Replace the `MANIFEST_KEYS` block. Find:

```js
const MANIFEST_KEYS = {
  idea: 'ideas',
  article: 'articles',
  newsletter: 'newsletters'
};
```

Replace with:

```js
// Surface → manifest top-level array key (idea→ideas, article→articles,
// newsletter→newsletters). email-newsletter shares the newsletter manifest.
const MANIFEST_KEYS = {
  idea: 'ideas',
  article: 'articles',
  newsletter: 'newsletters',
  'email-newsletter': 'newsletters'
};
```

**(d)** Add a NEW `STATUS_FIELDS` block IMMEDIATELY AFTER the `MANIFEST_KEYS` block:

```js
// Surface → field on entry.og to write status to. Lets two surfaces
// (newsletter OG card + email-newsletter hero) share a manifest entry
// without clobbering each other's state.
const STATUS_FIELDS = {
  idea: 'status',
  article: 'status',
  newsletter: 'status',
  'email-newsletter': 'emailStatus'
};
```

**(e)** Replace the body of `updateManifestStatus` to use the lookup. Find:

```js
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
```

Replace with:

```js
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
  const field = STATUS_FIELDS[surface] ?? 'status';
  entry.og = entry.og ?? {};
  entry.og[field] = status;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}
```

**(f)** Update `loadAllItems` to include email-newsletter. Find:

```js
  await tryLoad(listIdeas);
  await tryLoad(listArticles);
  await tryLoad(listNewsletter);
  return items;
```

Replace with:

```js
  await tryLoad(listIdeas);
  await tryLoad(listArticles);
  await tryLoad(listNewsletter);
  await tryLoad(listEmailNewsletter);
  return items;
```

DO NOT touch any other code in the file (parseArgs, main, generateOne, file:// guard, loadDotEnv).

- [ ] **Step 4: Run orchestrator tests**

```bash
node --test tests/og/orchestrator.test.mjs
```

Expected: PASS, all tests including the 3 new email-newsletter tests.

- [ ] **Step 5: Smoke check via dry-run**

```bash
node scripts/generate-og-cards.mjs --dry-run --surface email-newsletter --slug 2026-05-01-pm
```

Expected output:
```
DRY   email-newsletter/2026-05-01-pm
      subject: A postcard leaning against a coffee mug on a near-black surface, single lavender light glancing across the postcard's edge, late evening
      → image/email/newsletter/2026-05-01-pm.jpg
```

(Reads from real `newsletter/manifest.json`, which Surface B already populated.)

- [ ] **Step 6: Run full OG suite**

```bash
npm run test:og
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-og-cards.mjs tests/og/orchestrator.test.mjs
git commit -m "email-og: orchestrator iterates email-newsletter + STATUS_FIELDS lookup"
```

---

## Task 6: Build gate adds email-newsletter

**Files:**
- Modify: `scripts/check-og-cards.js`
- Modify: `tests/og/check-og-cards.test.mjs`

The build gate iterates a `surfaces` config array. Add `email-newsletter` — note that it SHARES the `newsletter/manifest.json` with the OG newsletter surface but checks a DIFFERENT pngDir + extension (`image/email/newsletter/{slug}.jpg` vs `image/og/newsletter/{slug}.png`).

- [ ] **Step 1: Replace `tests/og/check-og-cards.test.mjs`** (full replacement to cover all 4 surfaces)

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

function setupDir({
  ideaPng = false,
  articlePng = false,
  newsletterPng = false,
  emailNewsletterJpg = false
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'og-check-'));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  mkdirSync(join(dir, 'articles'), { recursive: true });
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  mkdirSync(join(dir, 'image/og/idea'), { recursive: true });
  mkdirSync(join(dir, 'image/og/article'), { recursive: true });
  mkdirSync(join(dir, 'image/og/newsletter'), { recursive: true });
  mkdirSync(join(dir, 'image/email/newsletter'), { recursive: true });
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
  if (emailNewsletterJpg) writeFileSync(join(dir, 'image/email/newsletter/2026-05-01-am.jpg'), 'fake');
  return dir;
}

test('exits 0 by default when PNGs/JPGs missing (warn-only)', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /missing/i);
});

test('exits 1 with STRICT=1 when any output missing across 4 surfaces', () => {
  const dir = setupDir({ ideaPng: true, articlePng: true, newsletterPng: true, emailNewsletterJpg: false });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 1);
});

test('exits 0 with STRICT=1 when all outputs present across 4 surfaces', () => {
  const dir = setupDir({ ideaPng: true, articlePng: true, newsletterPng: true, emailNewsletterJpg: true });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 0);
});

test('reports missing slugs broken down by all 4 surfaces', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.match(r.stdout, /idea/);
  assert.match(r.stdout, /article/);
  assert.match(r.stdout, /\bnewsletter\b/);          // includes "newsletter" (OG)
  assert.match(r.stdout, /email-newsletter/);        // includes "email-newsletter"
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/check-og-cards.test.mjs
```

Expected: FAIL — script doesn't iterate email-newsletter.

- [ ] **Step 3: Modify `scripts/check-og-cards.js`**

The current `surfaces` array uses a simple structure. Extend each entry to ALSO carry a file extension, so newsletter (PNG) and email-newsletter (JPG) can coexist over the same manifest. Replace the `surfaces` declaration. Find:

```js
const surfaces = [
  { name: 'idea', manifest: 'ideas/manifest.json', listKey: 'ideas', pngDir: 'image/og/idea' },
  { name: 'article', manifest: 'articles/manifest.json', listKey: 'articles', pngDir: 'image/og/article' },
  { name: 'newsletter', manifest: 'newsletter/manifest.json', listKey: 'newsletters', pngDir: 'image/og/newsletter' }
];
```

Replace with:

```js
// Each surface declares where to look for outputs and the file extension.
// `email-newsletter` shares the newsletter manifest but checks a different
// directory + extension (.jpg vs .png).
const surfaces = [
  { name: 'idea', manifest: 'ideas/manifest.json', listKey: 'ideas', outDir: 'image/og/idea', ext: 'png' },
  { name: 'article', manifest: 'articles/manifest.json', listKey: 'articles', outDir: 'image/og/article', ext: 'png' },
  { name: 'newsletter', manifest: 'newsletter/manifest.json', listKey: 'newsletters', outDir: 'image/og/newsletter', ext: 'png' },
  { name: 'email-newsletter', manifest: 'newsletter/manifest.json', listKey: 'newsletters', outDir: 'image/email/newsletter', ext: 'jpg' }
];
```

Then find the line that builds the path. Find:

```js
    const png = path.join(root, s.pngDir, `${entry.slug}.png`);
    if (!fs.existsSync(png)) missing.push(entry.slug);
```

Replace with:

```js
    const out = path.join(root, s.outDir, `${entry.slug}.${s.ext}`);
    if (!fs.existsSync(out)) missing.push(entry.slug);
```

(The variable rename + dynamic extension is the only behavioral change — the rest of the loop logic stays identical.)

DO NOT touch any other code in the file.

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/check-og-cards.test.mjs
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Run against the real project**

```bash
npm run check:og-cards
```

Expected output (email-newsletter dir is empty — Task 7 fills it):
```
og-cards: ... idea entries ...
og-cards: all 15 article entries have OG cards
og-cards: all 10 newsletter entries have OG cards
og-cards: 10 email-newsletter missing
  - email-newsletter/2026-04-20-am
  ...
```

- [ ] **Step 6: Run full OG suite**

```bash
npm run test:og
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-og-cards.js tests/og/check-og-cards.test.mjs
git commit -m "email-og: check:og-cards walks email-newsletter surface"
```

---

## Task 7: Generate the 10 email newsletter heroes (operator)

**Files:**
- Generates: `image/email/newsletter/{slug}.jpg` × 10

Operator step requiring `RECRAFT_API_KEY` in `.env.local`.

- [ ] **Step 1: Sanity-check env vars**

```bash
grep -E '^RECRAFT_API_KEY=|^OPENAI_API_KEY=' .env.local | sed -E 's/=.*$/=<set>/'
```

Expected:
```
RECRAFT_API_KEY=<set>
OPENAI_API_KEY=<set>
```

- [ ] **Step 2: Run the email batch (10 Recraft calls, ~$0.40)**

```bash
npm run og:generate:email-newsletter
```

Expected: 10 `GEN ✓ recraft` lines (or 1-2 fallbacks if any subject hits Recraft moderation). Output paths land in `image/email/newsletter/{slug}.jpg`.

- [ ] **Step 3: Confirm output dimensions + format**

```bash
ls -la image/email/newsletter/
node -e "
const sharp = require('sharp');
const fs = require('fs');
const dir = 'image/email/newsletter';
for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.jpg'))) {
  sharp(\`\${dir}/\${f}\`).metadata().then(m => console.log(f, m.width + 'x' + m.height, m.format, m.size + ' bytes'));
}
"
```

Expected: each entry prints `... 600x400 jpeg ... bytes` (typical 30-60KB per JPG at quality 85).

- [ ] **Step 4: Open the output dir for thumbnail-row drift check**

```bash
open image/email/newsletter/
```

In Finder thumbnail view, confirm:
1. Each scene matches the corresponding OG newsletter card's scene (same Recraft prompt → similar but not identical output)
2. AM and PM editions visually differ (mint vs lavender lighting cues in the scene)
3. No banding / heavy compression artifacts at quality 85
4. Each looks legitimate as an "email hero" (not too dark to be unreadable on a white email body, not too sparse)

If any card sticks out, force-regenerate just that one:

```bash
node scripts/generate-og-cards.mjs --slug {slug} --surface email-newsletter --force
```

- [ ] **Step 5: Confirm the build gate passes for email-newsletter**

```bash
STRICT=1 npm run check:og-cards
```

Expected: email-newsletter section reports "all 10 email-newsletter entries have OG cards".

- [ ] **Step 6: Commit the JPGs + the manifest's `og.emailStatus` writebacks**

```bash
git add image/email/newsletter/*.jpg newsletter/manifest.json
git commit -m "email-og: ship 10 email newsletter heroes"
```

---

## Task 8: Update `IMAGES.md` to document the email surface

**Files:**
- Modify: `IMAGES.md`

Add a section documenting the email-newsletter surface, the no-chrome / JPG path, and the dual-status-field pattern. Insert AFTER the existing "Newsletter surface" section and BEFORE the "Per-template config" section so the reader sees ideas → articles → newsletter → email-newsletter as a sequence.

- [ ] **Step 1: Insert the email-newsletter surface section**

Find the existing line in `IMAGES.md`:

```markdown
## Per-template config (how surfaces are decoupled)
```

Insert this block IMMEDIATELY BEFORE that line:

````markdown
## Email newsletter hero surface

The email surface produces a 600×400 JPG hero that gets embedded at the top of each Beehiiv send. **No chrome** — pure Recraft scene resized + JPG-encoded. The newsletter skill writes a markdown image ref into the BODY section pointing at `weekendmvp.app/image/email/newsletter/{slug}.jpg`.

Generate with:

```bash
npm run og:generate:email-newsletter            # missing only
npm run og:generate:email-newsletter -- --force # regenerate all
node scripts/generate-og-cards.mjs --slug {slug} --surface email-newsletter
```

### Why two newsletter surfaces?

Each Beehiiv send produces TWO outputs from a single manifest entry:

- `surface: 'newsletter'` → `image/og/newsletter/{slug}.png` (1200×630, postcard chrome — for social shares)
- `surface: 'email-newsletter'` → `image/email/newsletter/{slug}.jpg` (600×400, no chrome — for the email body)

Both surfaces read the same `newsletter/manifest.json` entry and use the same `og.subject` (so the email scene visually matches the OG card scene), but write status to **different fields**:

- `og.status` ← OG card surface
- `og.emailStatus` ← email-newsletter surface

This means re-running one surface doesn't clobber the other's state. If only the email hero failed, run `npm run og:generate:email-newsletter` to retry just those.

### No-chrome surfaces (templates without `buildElement`)

If a template module exports `config` but NOT `buildElement`, the compose pipeline detects this and skips the Satori chrome render entirely. The output is the resized Recraft scene placed on the canvas, encoded per `config.format`.

This is how email-newsletter works: pure image, no logo, no title overlay. Useful when the surrounding context (e.g., the email body itself) provides all the typography.

### JPEG vs PNG output

Templates can declare an output format in their `config`:

```js
export const config = {
  width: 600,
  height: 400,
  bgRect: { x: 0, y: 0, width: 600, height: 400 },
  bgFill: '#050505',
  format: 'jpeg',       // 'png' (default) or 'jpeg'
  jpegQuality: 85       // only used if format === 'jpeg'
};
```

`png` is the default (matches the OG card pattern). Email surfaces opt into `jpeg` because (a) email clients prefer JPGs for hero photography (smaller file size, broadly supported), and (b) the Beehiiv editor renders embedded JPGs reliably across Gmail / Apple Mail / Outlook.

````

- [ ] **Step 2: Spot-check the file**

```bash
grep -n '## ' IMAGES.md | head -20
```

Should show the new "Email newsletter hero surface" section between "Newsletter surface" and "Per-template config".

- [ ] **Step 3: Commit**

```bash
git add IMAGES.md
git commit -m "email-og: document email-newsletter surface + no-chrome / JPG pattern"
```

---

## Task 9: Hook the email surface into the `newsletter` skill (gitignored)

**Files:**
- Modify: `.claude/skills/newsletter/SKILL.md` (gitignored — local only)

Two integration points:

1. **Prepend a markdown image ref to the BODY section** that gets pasted into Beehiiv. The image URL points at the per-newsletter email hero (which Step 2 of this task generates).
2. **Add a final step** that invokes the email-newsletter generator with `--non-blocking` (after the existing OG card generator step from Surface B).

Because `.claude/skills/` is in `.gitignore`, changes are local-only and won't be committed.

- [ ] **Step 1: Locate the skill file**

```bash
ls .claude/skills/newsletter/
```

Should include `SKILL.md` and other reference files (`web-publish.md`, etc.).

- [ ] **Step 2: Find Step 5b.1 (manifest append) — Surface B added this**

```bash
grep -n 'Step 5b.1\|Step 5b.2\|Append both slots' .claude/skills/newsletter/SKILL.md
```

This is where Surface B injected the og.subject + manifest append + OG generator step. We're adding a sibling step for email.

- [ ] **Step 3: Modify the markdown image ref instruction in the BODY-writing step**

Find the section in the skill where it documents BODY content for the markdown draft (typically Section 5 or Step 4 — search for "## BODY" or "BODY section"). Add this guidance immediately above the existing BODY content rules:

```markdown
**Hero image (REQUIRED for email body):**

Prepend a single markdown image reference at the very top of the BODY section, before any text content:

\`\`\`markdown
![](https://weekendmvp.app/image/email/newsletter/{date}-{slot}.jpg)

{existing body opens here}
\`\`\`

Beehiiv parses this as a full-width image block at the top of the email. The actual JPG is generated by Step 5b.3 (below) — the URL is deterministic so the markdown ref is safe to write before the file exists.
```

- [ ] **Step 4: Add Step 5b.3 — generate the email hero**

Find the existing Step 5b.2 (which invokes the OG newsletter generator). Append a NEW step IMMEDIATELY AFTER it:

````markdown
### 5b.3 Generate the email newsletter hero (best-effort, never blocks publish)

After Step 5b.2 (OG card generator) finishes, invoke the email-newsletter generator for both slots:

```bash
node scripts/generate-og-cards.mjs --slug {date}-am --surface email-newsletter --non-blocking
node scripts/generate-og-cards.mjs --slug {date}-pm --surface email-newsletter --non-blocking
```

**Behavior:**
- **Success:** writes `image/email/newsletter/{slug}.jpg`, flips manifest `og.emailStatus` from `"pending"` → `"ready"`. Provider name (`recraft` or `openai-gpt-image-1`) is logged.
- **Failure (Recraft AND `gpt-image-1` both errored):** flips `og.emailStatus` to `"failed"`, exits 0 (because `--non-blocking`). The publish flow continues. The markdown image ref written in Step 5 already points at the expected URL — Beehiiv typically renders this as a broken image placeholder when the file is missing (annoying but non-fatal). A future `npm run og:generate:email-newsletter` run retries every entry with `og.emailStatus: "failed"`.

**Critical invariant:** newsletter publish status MUST be independent of the email hero outcome. The email is the primary distribution channel — never let a Recraft error block the inbox push. The email hero is decorative; the body content is what matters.

Note that `og.status` (OG card surface) and `og.emailStatus` (this surface) are TWO INDEPENDENT FIELDS on the same manifest entry. If only the email hero fails, only `og.emailStatus` changes — the OG card stays whatever state it was in.
````

- [ ] **Step 5: Update the checklist / output report (if present)**

If the skill has a checklist or output report, add email-hero items:

- BODY section starts with markdown image ref to `image/email/newsletter/{slug}.jpg`
- Ran `node scripts/generate-og-cards.mjs --slug {date}-{slot} --surface email-newsletter --non-blocking` for both slots
- Confirmed `og.emailStatus` is `"ready"` or `"failed"` for both slots (publish proceeds either way)

- [ ] **Step 6: Verify the file saves**

```bash
ls -la .claude/skills/newsletter/SKILL.md
```

Expected: file exists, modified just now. (No commit — `.claude/skills/` is in `.gitignore`.)

---

## Self-review

After writing the complete plan, I checked it against the spec.

**1. Spec coverage:** every section/requirement in the spec maps to a task:
- Spec § Architecture (2-file addition, no breaking changes) → Tasks 2, 3, 4 (compose extensions are additive)
- Spec § Per-template config (format + jpegQuality) → Task 2 (template) + Task 4 (compose honors it)
- Spec § Compose changes (no-buildElement path + format dispatch) → Task 4 (rewrite + 3 new tests)
- Spec § Status writeback fields (STATUS_FIELDS lookup) → Task 5
- Spec § Source (reuses newsletter manifest, surface='email-newsletter', og.emailStatus) → Task 3 (6 tests)
- Spec § File structure → all tasks (each file mentioned in the spec is created/modified by a numbered task)
- Spec § Data flow (orchestrator iterates 4 surfaces) → Task 5
- Spec § Backfill (10 newsletters via single Recraft call each) → Task 7
- Spec § Newsletter skill hook → Task 9
- Spec § Verification (dry-run smoke, build gate, eyeball, dimensions+format check) → Tasks 5, 6, 7
- Spec § v1 task list (9 items) → Tasks 1-9 of this plan in matching order

**2. Placeholder scan:** no `TBD`, `TODO`, `implement later`, or "Add appropriate error handling". Task 7 references the operator's eyeball + the build gate's existence-check — these are concrete commands with concrete expected output, not placeholders.

**3. Type consistency:**
- `compose({bgBuffer, title, surface, accent, readMinutes, edition, publishedAt})` (Task 4) matches Surface B's signature; the new no-buildElement path doesn't change the signature.
- `updateManifestStatus(surface, slug, status, {rootDir?})` unchanged — Task 5 only changes the BODY of the function (which field it writes to), not the signature.
- Template `config` shape gains optional `format` + `jpegQuality` fields. Existing idea/article/newsletter templates don't set these → PNG default → no behavior change. Verified across Tasks 2 + 4.
- `listEmailNewsletter({manifestPath?})` returns same item shape as `listNewsletter` (Task 3) but with `surface: 'email-newsletter'`, JPG `outputPath`, and reads `og.emailStatus` for status. Orchestrator (Task 5) handles uniformly via the lookup tables.
- Surface name string `'email-newsletter'` (with hyphen, lowercased) used consistently across all tasks. Manifest key `'newsletters'` (plural) unchanged.

---

## Out of scope (next surfaces / follow-ups)

- Carousel slide-1 hero (Surface D — 1080×1350 portrait, integrates with carousel pipeline) — separate spec
- Per-section divider illustrations inside the email body (rejected as Q1B during brainstorming)
- Newsletter HTML archive index OG card (deferred from Surface B)

## Cost

- 10 cards × ~$0.04 = ~$0.40 for the backfill batch
- Forever-cost at twice-daily cadence: ~$0.56/week (newsletter email surface only) → ~$1.12/week newsletter total when combined with OG cards
