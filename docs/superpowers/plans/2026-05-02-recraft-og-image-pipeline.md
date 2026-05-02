# Recraft OG Image Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate per-page OG share cards for every idea page using Recraft v3 (with `gpt-image-1` fallback), composed via Satori with title + WMV chrome, committed to git, and auto-invoked from the `publish-idea` skill with graceful degradation.

**Architecture:** A `.mjs` Node CLI script orchestrates `source → provider → compose → write`. Providers (`recraft`, `openai`) are interchangeable. Templates (Satori element trees, plain JS, no JSX) are isolated per surface. v1 ships idea-card surface only; pipeline shape supports adding articles/newsletter/carousel later by adding a source + a template.

**Tech Stack:** Node 20+ ESM, `satori`, `@resvg/resvg-js`, `sharp`, `gray-matter`, `@fontsource/geist-sans` (devDep, ships TTF), `node:test` (built-in test runner).

**Spec:** `docs/superpowers/specs/2026-05-02-recraft-og-image-pipeline-design.md`

---

## File Structure

**New files:**
```
lib/og/style-blueprint.mjs        — exports STYLE_BLUEPRINT string (terminal-photographic)
lib/og/fonts.mjs                  — loadFonts() returns Geist TTF buffers
lib/og/providers/recraft.mjs      — generate({prompt, styleId}) → Buffer
lib/og/providers/openai.mjs       — generate({prompt}) → Buffer (fallback)
lib/og/sources/ideas.mjs          — list() reads ideas/manifest.json → [items]
lib/og/templates/idea.mjs         — buildElement({title, accent, bgDataUrl}) → satori tree
lib/og/compose.mjs                — compose({bgBuffer, title, surface, accent}) → PNG Buffer
scripts/generate-og-cards.mjs     — orchestrator CLI
scripts/check-og-cards.js         — STRICT-mode build gate (CommonJS, matches existing scripts)
tests/og/style-blueprint.test.mjs
tests/og/fonts.test.mjs
tests/og/providers-recraft.test.mjs
tests/og/providers-openai.test.mjs
tests/og/sources-ideas.test.mjs
tests/og/templates-idea.test.mjs
tests/og/compose.test.mjs
tests/og/orchestrator.test.mjs
tests/og/check-og-cards.test.mjs
tests/og/fixtures/manifest-fixture.json
tests/og/fixtures/recraft-success.json
image/og/idea/.gitkeep
IMAGES.md                         — setup, drift recovery, prompt-writing rules
```

**Modified files:**
```
package.json                      — add deps + scripts
ideas/manifest.json               — extend 5 entries with og.subject/og.accent
.env.example                      — add RECRAFT_API_KEY, RECRAFT_STYLE_ID, OPENAI_API_KEY (create if missing)
.gitignore                        — add node_modules/.cache/og-fonts/ (if cache needed)
ideas/{slug}.html × 5             — update <meta property="og:image"> to point at generated card
```

**Why this shape:** Each file has one responsibility (one provider, one template, one source). Files that change together (template + its test) live in mirrored directories. The orchestrator never imports Recraft/Satori directly — it composes through the provider/source/compose interfaces, so adding a new surface (article cards) means adding three files (`sources/articles.mjs`, `templates/article.mjs`, manifest entry) without touching anything else.

---

## Task 1: Foundation — install dependencies and add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

Run from repo root:

```bash
npm i satori@^0.10 @resvg/resvg-js@^2.6 sharp@^0.33 gray-matter@^4.0
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm i -D @fontsource/geist-sans@^5.0
```

- [ ] **Step 3: Add npm scripts**

Modify `package.json` so the `scripts` block becomes:

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
  "test:og": "node --test tests/og/"
}
```

- [ ] **Step 4: Verify build still works**

Run:

```bash
npm run build
```

Expected: completes without error, writes `styles.css`.

- [ ] **Step 5: Create the output directory placeholder**

```bash
mkdir -p image/og/idea
touch image/og/idea/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json image/og/idea/.gitkeep
git commit -m "og-pipeline: install deps + add scripts (foundation)"
```

---

## Task 2: Style Blueprint module

**Files:**
- Create: `lib/og/style-blueprint.mjs`
- Test: `tests/og/style-blueprint.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/og/style-blueprint.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLE_BLUEPRINT } from '../../lib/og/style-blueprint.mjs';

test('STYLE_BLUEPRINT is a non-empty string', () => {
  assert.equal(typeof STYLE_BLUEPRINT, 'string');
  assert.ok(STYLE_BLUEPRINT.length > 200, 'blueprint should be substantial');
});

test('STYLE_BLUEPRINT contains terminal-photographic markers', () => {
  // These strings anchor the brand. Changing them is a deliberate brand decision,
  // not an incidental edit.
  assert.match(STYLE_BLUEPRINT, /#050505/);
  assert.match(STYLE_BLUEPRINT, /cinematic|photograph/i);
  assert.match(STYLE_BLUEPRINT, /accent/i);
  assert.match(STYLE_BLUEPRINT, /No\s+(people|faces)/i);
  assert.match(STYLE_BLUEPRINT, /No\s+(visible\s+)?text/i);
});

test('STYLE_BLUEPRINT mentions all three accent colors', () => {
  assert.match(STYLE_BLUEPRINT, /#D4FF5B/i); // lime
  assert.match(STYLE_BLUEPRINT, /#C5AEE8/i); // lavender
  assert.match(STYLE_BLUEPRINT, /#8FF59B/i); // mint
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/style-blueprint.test.mjs
```

Expected: FAIL with "Cannot find module '../../lib/og/style-blueprint.mjs'".

- [ ] **Step 3: Create the module**

Create `lib/og/style-blueprint.mjs`:

```js
// The brand text-anchor for Recraft + OpenAI fallback. This wording, together
// with RECRAFT_STYLE_ID, defines the terminal-photographic look across every
// generated card. Changes here re-skin the brand for any newly generated
// images — treat as an asset, not casual prose.
export const STYLE_BLUEPRINT = [
  'Cinematic product photography of a single object on a near-black surface,',
  'color #050505. Low-key lighting with one accent-colored light source:',
  'lime (#D4FF5B), lavender (#C5AEE8), or mint (#8FF59B), one accent per image.',
  'The subject is a tactile object — a glowing screen, a single lit terminal',
  'cursor, a phone notification, a server fan, a coffee cup beside a closed',
  'laptop, a desk under a single lamp. Shallow depth of field. Soft synthetic',
  'glow. Atmosphere of late-night focus, weekend builder at 2am. Strong',
  'negative space. No people. No faces. No visible text or letters. No 3D',
  'rendering aesthetic. No glossy gradients. No stock-photo composition.'
].join(' ');
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/style-blueprint.test.mjs
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/og/style-blueprint.mjs tests/og/style-blueprint.test.mjs
git commit -m "og-pipeline: add STYLE_BLUEPRINT brand anchor"
```

---

## Task 3: Fonts module — load Geist TTF buffers

**Files:**
- Create: `lib/og/fonts.mjs`
- Test: `tests/og/fonts.test.mjs`

`@fontsource/geist-sans` v5 ships TTF files at `node_modules/@fontsource/geist-sans/files/geist-sans-latin-400-normal.ttf` (and `-700-normal.ttf` for bold). We read them as Buffers for Satori.

- [ ] **Step 1: Write the failing test**

Create `tests/og/fonts.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFonts } from '../../lib/og/fonts.mjs';

test('loadFonts returns Satori-compatible font array', async () => {
  const fonts = await loadFonts();
  assert.ok(Array.isArray(fonts), 'returns an array');
  assert.equal(fonts.length, 2, 'returns regular + bold');

  const regular = fonts.find((f) => f.weight === 400);
  const bold = fonts.find((f) => f.weight === 700);

  assert.ok(regular, 'has regular weight');
  assert.ok(bold, 'has bold weight');

  for (const f of fonts) {
    assert.equal(f.name, 'Geist');
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

Expected: FAIL with "Cannot find module '../../lib/og/fonts.mjs'".

- [ ] **Step 3: Implement the module**

Create `lib/og/fonts.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Resolve TTF paths via Node's require.resolve so this works regardless of
// monorepo / pnpm hoisting. @fontsource/geist-sans v5+ ships TTFs at
// files/geist-sans-latin-{weight}-normal.ttf.
function resolveFontPath(weight) {
  return require.resolve(
    `@fontsource/geist-sans/files/geist-sans-latin-${weight}-normal.ttf`
  );
}

let cache = null;

export async function loadFonts() {
  if (cache) return cache;
  const [regular, bold] = await Promise.all([
    readFile(resolveFontPath(400)),
    readFile(resolveFontPath(700))
  ]);
  cache = [
    { name: 'Geist', data: regular, weight: 400, style: 'normal' },
    { name: 'Geist', data: bold, weight: 700, style: 'normal' }
  ];
  return cache;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/fonts.test.mjs
```

Expected: PASS, 1 test (containing several assertions).

If it fails with "Cannot find module '@fontsource/geist-sans/files/geist-sans-latin-400-normal.ttf'", the package layout differs from expected. Inspect: `ls node_modules/@fontsource/geist-sans/files/ | head -10` and adjust the filename pattern in `resolveFontPath`. Common alternates: `geist-sans-latin-400-normal.woff2` (Satori v0.10+ supports woff2 too — switch the read + the test if so).

- [ ] **Step 5: Commit**

```bash
git add lib/og/fonts.mjs tests/og/fonts.test.mjs
git commit -m "og-pipeline: add Geist font loader"
```

---

## Task 4: Sources/ideas module — read manifest into normalized items

**Files:**
- Create: `lib/og/sources/ideas.mjs`
- Create: `tests/og/fixtures/manifest-fixture.json`
- Test: `tests/og/sources-ideas.test.mjs`

The source's job: read the manifest, return one normalized item per idea with the exact shape the orchestrator expects: `{slug, title, subject, surface, accent, outputPath}`. It applies the `og.subject → description → title` fallback and the default accent.

- [ ] **Step 1: Create the test fixture**

Create `tests/og/fixtures/manifest-fixture.json`:

```json
{
  "ideas": [
    {
      "slug": "with-og",
      "title": "Idea With OG Block",
      "description": "Fallback description.",
      "category": "developer",
      "og": {
        "subject": "A glowing terminal at 2am",
        "accent": "lavender"
      }
    },
    {
      "slug": "no-og-has-description",
      "title": "Idea With Only Description",
      "description": "Falls back to this description.",
      "category": "saas"
    },
    {
      "slug": "no-og-no-description",
      "title": "Bare Idea Title Only",
      "category": "productivity"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/og/sources-ideas.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listIdeas } from '../../lib/og/sources/ideas.mjs';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/manifest-fixture.json'
);

test('listIdeas returns one item per idea', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  assert.equal(items.length, 3);
});

test('listIdeas uses og.subject when present', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'with-og');
  assert.equal(item.subject, 'A glowing terminal at 2am');
  assert.equal(item.accent, 'lavender');
});

test('listIdeas falls back to description when og.subject is missing', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-has-description');
  assert.equal(item.subject, 'Falls back to this description.');
  assert.equal(item.accent, 'lime', 'defaults to lime when og.accent is absent');
});

test('listIdeas falls back to title when description is also missing', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-no-description');
  assert.equal(item.subject, 'Bare Idea Title Only');
});

test('listIdeas sets surface and outputPath on every item', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'idea');
    assert.equal(item.outputPath, `image/og/idea/${item.slug}.png`);
    assert.ok(item.title);
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
node --test tests/og/sources-ideas.test.mjs
```

Expected: FAIL with "Cannot find module '../../lib/og/sources/ideas.mjs'".

- [ ] **Step 4: Implement the module**

Create `lib/og/sources/ideas.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_MANIFEST = join(process.cwd(), 'ideas/manifest.json');
const DEFAULT_ACCENT = 'lime';

export async function listIdeas({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.ideas)) {
    throw new Error(`manifest at ${manifestPath} has no "ideas" array`);
  }
  return manifest.ideas.map((idea) => {
    const og = idea.og ?? {};
    const subject = og.subject ?? idea.description ?? idea.title;
    const accent = og.accent ?? DEFAULT_ACCENT;
    return {
      slug: idea.slug,
      title: idea.title,
      subject,
      accent,
      surface: 'idea',
      outputPath: `image/og/idea/${idea.slug}.png`,
      status: og.status
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
node --test tests/og/sources-ideas.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/og/sources/ideas.mjs tests/og/sources-ideas.test.mjs tests/og/fixtures/manifest-fixture.json
git commit -m "og-pipeline: add ideas manifest source with fallback chain"
```

---

## Task 5: Recraft provider

**Files:**
- Create: `lib/og/providers/recraft.mjs`
- Test: `tests/og/providers-recraft.test.mjs`

Recraft API: `POST https://external.api.recraft.ai/v1/images/generations` with `{prompt, model:'recraftv3', size:'1707x1024', response_format:'b64_json', style_id?}`. Returns `{data:[{b64_json}]}`. Use `globalThis.fetch` (Node 20+ has it native) and inject a custom `fetch` for tests.

- [ ] **Step 1: Write the failing test**

Create `tests/og/providers-recraft.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../../lib/og/providers/recraft.mjs';

const FAKE_KEY = 'test-key';
const FAKE_STYLE = 'aaaa-bbbb';

function mockFetch(response) {
  return async (url, init) => {
    mockFetch.lastCall = { url, init };
    return response;
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

test('generate returns a Buffer on success', async () => {
  const fakePng = Buffer.from('fake-png-bytes');
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: fakePng.toString('base64') }] })
  );
  const buf = await generate({
    prompt: 'a glowing terminal',
    apiKey: FAKE_KEY,
    styleId: FAKE_STYLE,
    fetchImpl
  });
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.toString(), 'fake-png-bytes');
});

test('generate sends model + size + style_id when styleId provided', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('x').toString('base64') }] })
  );
  await generate({
    prompt: 'subject',
    apiKey: FAKE_KEY,
    styleId: FAKE_STYLE,
    fetchImpl
  });
  const body = JSON.parse(mockFetch.lastCall.init.body);
  assert.equal(body.model, 'recraftv3');
  assert.equal(body.size, '1707x1024');
  assert.equal(body.style_id, FAKE_STYLE);
  assert.equal(body.response_format, 'b64_json');
  assert.equal(mockFetch.lastCall.init.headers.Authorization, `Bearer ${FAKE_KEY}`);
});

test('generate falls back to style:realistic_image when no styleId', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('x').toString('base64') }] })
  );
  await generate({
    prompt: 'subject',
    apiKey: FAKE_KEY,
    fetchImpl
  });
  const body = JSON.parse(mockFetch.lastCall.init.body);
  assert.equal(body.style, 'realistic_image');
  assert.equal(body.style_id, undefined);
});

test('generate throws on non-OK response', async () => {
  const fetchImpl = mockFetch(jsonResponse({ error: 'rate limited' }, 429));
  await assert.rejects(
    generate({ prompt: 'x', apiKey: FAKE_KEY, fetchImpl }),
    /Recraft error 429/
  );
});

test('generate throws when apiKey is missing', async () => {
  await assert.rejects(
    generate({ prompt: 'x' }),
    /RECRAFT_API_KEY/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/providers-recraft.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the module**

Create `lib/og/providers/recraft.mjs`:

```js
const ENDPOINT = 'https://external.api.recraft.ai/v1/images/generations';

export async function generate({
  prompt,
  apiKey = process.env.RECRAFT_API_KEY,
  styleId = process.env.RECRAFT_STYLE_ID,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey) {
    throw new Error('RECRAFT_API_KEY not set — see IMAGES.md setup section');
  }
  const body = {
    prompt,
    n: 1,
    model: 'recraftv3',
    response_format: 'b64_json',
    size: '1707x1024'
  };
  if (styleId) {
    body.style_id = styleId;
  } else {
    body.style = 'realistic_image';
  }
  const r = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Recraft error ${r.status}: ${txt.slice(0, 300)}`);
  }
  const json = await r.json();
  return Buffer.from(json.data[0].b64_json, 'base64');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/providers-recraft.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/og/providers/recraft.mjs tests/og/providers-recraft.test.mjs
git commit -m "og-pipeline: add Recraft v3 provider"
```

---

## Task 6: OpenAI fallback provider

**Files:**
- Create: `lib/og/providers/openai.mjs`
- Test: `tests/og/providers-openai.test.mjs`

Same shape as Recraft for swappability. Endpoint: `POST https://api.openai.com/v1/images/generations` with `{model:'gpt-image-1', prompt, n:1, size:'1536x1024', quality:'medium', output_format:'png'}`. Returns `{data:[{b64_json}]}`.

- [ ] **Step 1: Write the failing test**

Create `tests/og/providers-openai.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../../lib/og/providers/openai.mjs';

function mockFetch(response) {
  return async (url, init) => {
    mockFetch.lastCall = { url, init };
    return response;
  };
}
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

test('generate returns Buffer on success', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('png').toString('base64') }] })
  );
  const buf = await generate({
    prompt: 'subject',
    apiKey: 'k',
    fetchImpl
  });
  assert.ok(Buffer.isBuffer(buf));
});

test('generate sends gpt-image-1 model and medium quality', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('p').toString('base64') }] })
  );
  await generate({ prompt: 'x', apiKey: 'k', fetchImpl });
  const body = JSON.parse(mockFetch.lastCall.init.body);
  assert.equal(body.model, 'gpt-image-1');
  assert.equal(body.quality, 'medium');
  assert.equal(body.size, '1536x1024');
});

test('generate throws on non-OK response', async () => {
  const fetchImpl = mockFetch(jsonResponse({ error: 'bad' }, 500));
  await assert.rejects(
    generate({ prompt: 'x', apiKey: 'k', fetchImpl }),
    /OpenAI error 500/
  );
});

test('generate throws when apiKey is missing', async () => {
  await assert.rejects(
    generate({ prompt: 'x' }),
    /OPENAI_API_KEY/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/providers-openai.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the module**

Create `lib/og/providers/openai.mjs`:

```js
const ENDPOINT = 'https://api.openai.com/v1/images/generations';

export async function generate({
  prompt,
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set — see IMAGES.md setup section');
  }
  const r = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'png',
      moderation: 'auto'
    })
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${txt.slice(0, 300)}`);
  }
  const json = await r.json();
  return Buffer.from(json.data[0].b64_json, 'base64');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/providers-openai.test.mjs
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/og/providers/openai.mjs tests/og/providers-openai.test.mjs
git commit -m "og-pipeline: add OpenAI gpt-image-1 fallback provider"
```

---

## Task 7: Idea template — Satori element tree

**Files:**
- Create: `lib/og/templates/idea.mjs`
- Test: `tests/og/templates-idea.test.mjs`

Satori takes an element tree shaped like React VDOM. Plain JS object literals work — no JSX/TSX/React build step needed. The template builds a 1200×630 frame with the Recraft image as background, dark gradient overlay, WMV mark, accent dot, title, category chip, and accent bar.

The accent color map and the title autoshrink rule live here.

- [ ] **Step 1: Write the failing test**

Create `tests/og/templates-idea.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildElement, ACCENTS, pickTitleFontSize } from '../../lib/og/templates/idea.mjs';

test('ACCENTS map contains all five brand accents', () => {
  for (const k of ['lime', 'mint', 'lavender', 'emerald', 'aubergine']) {
    assert.ok(ACCENTS[k], `missing ${k}`);
    assert.match(ACCENTS[k], /^#[0-9A-F]{6}$/i);
  }
});

test('pickTitleFontSize shrinks for long titles', () => {
  assert.equal(pickTitleFontSize('Short Title'), 64);
  assert.equal(pickTitleFontSize('A title that is somewhere in the middle range here'), 52);
  assert.equal(pickTitleFontSize('A really really really really long title that surpasses one hundred characters in total'), 40);
});

test('buildElement returns an element tree with title and 1200x630 frame', () => {
  const el = buildElement({
    title: 'Test Title',
    accent: 'lime',
    bgDataUrl: 'data:image/png;base64,fake'
  });
  assert.equal(el.type, 'div');
  assert.equal(el.props.style.width, 1200);
  assert.equal(el.props.style.height, 630);
  // Title text should appear somewhere in the tree.
  const json = JSON.stringify(el);
  assert.ok(json.includes('Test Title'), 'title not found in element tree');
  assert.ok(json.includes('#D4FF5B'), 'lime accent color not used');
});

test('buildElement defaults to lime when accent is unknown', () => {
  const el = buildElement({
    title: 'X',
    accent: 'unknown-accent',
    bgDataUrl: 'data:image/png;base64,fake'
  });
  assert.ok(JSON.stringify(el).includes('#D4FF5B'));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/templates-idea.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the module**

Create `lib/og/templates/idea.mjs`:

```js
// Brand accents from content/social/_brand/palette.md.
export const ACCENTS = {
  lime: '#D4FF5B',
  mint: '#8FF59B',
  lavender: '#C5AEE8',
  emerald: '#2F5F53',
  aubergine: '#1E1B38'
};

// Three breakpoints. Tuned so long idea titles ("Cross-timezone meeting
// scheduler with AI conflict resolution and team round-robin") still wrap
// to 3 lines max in the 1200×630 card.
export function pickTitleFontSize(title) {
  const len = title.length;
  if (len <= 32) return 64;
  if (len <= 70) return 52;
  return 40;
}

// Helper to build a Satori-compatible element. Satori reads `type`, `props`,
// and `props.children` exactly like React VDOM, but does not require React.
function el(type, props = {}, ...children) {
  return {
    type,
    props: { ...props, children: children.length === 1 ? children[0] : children }
  };
}

export function buildElement({ title, accent, bgDataUrl }) {
  const accentHex = ACCENTS[accent] ?? ACCENTS.lime;
  const titleSize = pickTitleFontSize(title);

  return el(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: '#050505',
        color: '#FFFFFF',
        fontFamily: 'Geist',
        padding: 56
      }
    },
    // Background image (Recraft output)
    el('img', {
      src: bgDataUrl,
      width: 1200,
      height: 630,
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1200,
        height: 630,
        objectFit: 'cover'
      }
    }),
    // Dark gradient overlay for legibility (bottom-up)
    el('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1200,
        height: 630,
        background:
          'linear-gradient(180deg, rgba(5,5,5,0.20) 0%, rgba(5,5,5,0.55) 60%, rgba(5,5,5,0.85) 100%)'
      }
    }),
    // Top row: WMV mark + accent dot
    el(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          position: 'relative'
        }
      },
      el(
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
      el('div', {
        style: {
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: accentHex
        }
      })
    ),
    // Spacer
    el('div', { style: { flex: 1 } }),
    // Title
    el(
      'div',
      {
        style: {
          fontSize: titleSize,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -1.5,
          color: '#FFFFFF',
          maxWidth: 1000,
          position: 'relative'
        }
      },
      title
    ),
    // Bottom accent bar
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 1200,
        height: 6,
        backgroundColor: accentHex
      }
    })
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/templates-idea.test.mjs
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/og/templates/idea.mjs tests/og/templates-idea.test.mjs
git commit -m "og-pipeline: add idea card Satori template"
```

---

## Task 8: Compose module — Satori → SVG → PNG

**Files:**
- Create: `lib/og/compose.mjs`
- Test: `tests/og/compose.test.mjs`

Compose ties everything together: takes the raw Recraft buffer + title + surface + accent, builds the element tree, runs Satori to SVG, rasterizes via `@resvg/resvg-js` to PNG. Returns a PNG Buffer.

This is a real integration test — we generate a tiny actual PNG from a tiny actual JPEG (one solid pixel). Slow-ish (~500ms) but worth it because Satori + resvg integration is exactly the layer most likely to silently break on dependency upgrades.

- [ ] **Step 1: Write the failing test**

Create `tests/og/compose.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { compose } from '../../lib/og/compose.mjs';

// Build a tiny in-memory "Recraft output": a 100x100 dark grey PNG
async function fakeBg() {
  return await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 20, g: 20, b: 20 }
    }
  })
    .png()
    .toBuffer();
}

test('compose returns a 1200x630 PNG buffer', async () => {
  const bg = await fakeBg();
  const png = await compose({
    bgBuffer: bg,
    title: 'Composed Test Title',
    surface: 'idea',
    accent: 'lime'
  });
  assert.ok(Buffer.isBuffer(png));
  // Inspect the PNG header dimensions.
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.format, 'png');
});

test('compose throws on unknown surface', async () => {
  const bg = await fakeBg();
  await assert.rejects(
    compose({
      bgBuffer: bg,
      title: 'X',
      surface: 'nonexistent-surface',
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

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the module**

Create `lib/og/compose.mjs`:

```js
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.mjs';
import { buildElement as buildIdea } from './templates/idea.mjs';

const TEMPLATES = {
  idea: buildIdea
  // article, newsletter, carousel — added in follow-up tickets
};

export async function compose({ bgBuffer, title, surface, accent }) {
  const builder = TEMPLATES[surface];
  if (!builder) {
    throw new Error(`compose: unknown surface "${surface}"`);
  }
  const fonts = await loadFonts();
  const bgDataUrl = `data:image/png;base64,${bgBuffer.toString('base64')}`;

  const element = builder({ title, accent, bgDataUrl });
  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts
  });
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 }
  })
    .render()
    .asPng();
  return png;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/compose.test.mjs
```

Expected: PASS, 2 tests.

If the test hangs or errors with a Satori font issue, double-check Task 3's font filename pattern was correct. Satori is the most failure-prone link in the chain.

- [ ] **Step 5: Commit**

```bash
git add lib/og/compose.mjs tests/og/compose.test.mjs
git commit -m "og-pipeline: add compose (Satori + resvg)"
```

---

## Task 9: Orchestrator script

**Files:**
- Create: `scripts/generate-og-cards.mjs`
- Test: `tests/og/orchestrator.test.mjs`

Orchestrator responsibilities:
1. Parse CLI flags (`--dry-run`, `--force`, `--slug X`, `--non-blocking`)
2. Load `.env.local`
3. Walk source items, apply `--slug` filter and idempotency check
4. Call provider with fallback (Recraft → OpenAI)
5. Compose, write to disk
6. On total failure: update manifest entry's `og.status`, exit non-zero (or 0 with `--non-blocking`)
7. Print a summary

The orchestrator is a hard thing to fully unit-test. We test the **pure parts** in isolation (CLI flag parsing, the write-status-to-manifest helper) and run an end-to-end smoke separately in Task 13.

- [ ] **Step 1: Write the failing test for CLI flag parsing**

Create `tests/og/orchestrator.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, updateManifestStatus } from '../../scripts/generate-og-cards.mjs';

test('parseArgs handles --dry-run', () => {
  const opts = parseArgs(['--dry-run']);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.force, false);
  assert.equal(opts.slug, null);
  assert.equal(opts.nonBlocking, false);
});

test('parseArgs handles --force --slug X --non-blocking together', () => {
  const opts = parseArgs(['--force', '--slug', 'my-slug', '--non-blocking']);
  assert.equal(opts.force, true);
  assert.equal(opts.slug, 'my-slug');
  assert.equal(opts.nonBlocking, true);
});

test('updateManifestStatus writes og.status without losing other fields', async () => {
  const dir = await mkdir(join(tmpdir(), `og-test-${Date.now()}`), { recursive: true });
  const path = join(dir, 'manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      ideas: [
        { slug: 'foo', title: 'Foo', description: 'desc', og: { subject: 's' } },
        { slug: 'bar', title: 'Bar' }
      ]
    }, null, 2)
  );

  await updateManifestStatus(path, 'foo', 'ready');
  await updateManifestStatus(path, 'bar', 'failed');

  const json = JSON.parse(await readFile(path, 'utf8'));
  const foo = json.ideas.find((i) => i.slug === 'foo');
  const bar = json.ideas.find((i) => i.slug === 'bar');

  assert.equal(foo.og.status, 'ready');
  assert.equal(foo.og.subject, 's', 'preserves existing og fields');
  assert.equal(foo.title, 'Foo', 'preserves non-og fields');
  assert.equal(bar.og.status, 'failed', 'creates og block when missing');
  assert.equal(bar.title, 'Bar');

  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/orchestrator.test.mjs
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the orchestrator**

Create `scripts/generate-og-cards.mjs`:

```js
#!/usr/bin/env node
/**
 * Generate per-page OG share cards.
 *
 * Usage:
 *   node scripts/generate-og-cards.mjs               # generate any missing
 *   node scripts/generate-og-cards.mjs --force       # regenerate all
 *   node scripts/generate-og-cards.mjs --slug X      # one specific slug
 *   node scripts/generate-og-cards.mjs --dry-run     # log only, no API calls
 *   node scripts/generate-og-cards.mjs --non-blocking  # exit 0 even on failures
 *
 * Env (read from .env.local or process env):
 *   RECRAFT_API_KEY=
 *   RECRAFT_STYLE_ID=  (optional, hugely recommended)
 *   OPENAI_API_KEY=    (fallback)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { generate as generateRecraft } from '../lib/og/providers/recraft.mjs';
import { generate as generateOpenAI } from '../lib/og/providers/openai.mjs';
import { compose } from '../lib/og/compose.mjs';
import { STYLE_BLUEPRINT } from '../lib/og/style-blueprint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST = join(ROOT, 'ideas/manifest.json');

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
    slug: args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null
  };
}

export async function updateManifestStatus(manifestPath, slug, status) {
  const json = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = json.ideas.find((i) => i.slug === slug);
  if (!entry) return;
  entry.og = entry.og ?? {};
  entry.og.status = status;
  writeFileSync(manifestPath, JSON.stringify(json, null, 2) + '\n');
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

  const items = (await listIdeas()).filter((i) => !opts.slug || i.slug === opts.slug);

  if (items.length === 0) {
    console.log('No items to process.');
    return;
  }

  let generated = 0, skipped = 0, failed = 0;
  const failedSlugs = [];

  for (const item of items) {
    const outPath = join(ROOT, item.outputPath);
    mkdirSync(dirname(outPath), { recursive: true });

    if (existsSync(outPath) && !opts.force) {
      console.log(`SKIP  ${item.slug}`);
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      console.log(`DRY   ${item.slug}`);
      console.log(`      subject: ${item.subject}`);
      console.log(`      → ${item.outputPath}\n`);
      continue;
    }

    console.log(`GEN   ${item.slug}`);
    console.log(`      subject: ${item.subject}`);

    try {
      const { buffer: bg, provider } = await generateOne({ subject: item.subject });
      const png = await compose({
        bgBuffer: bg,
        title: item.title,
        surface: item.surface,
        accent: item.accent
      });
      writeFileSync(outPath, png);
      await updateManifestStatus(MANIFEST, item.slug, 'ready');
      console.log(`      ✓ ${provider} → ${item.outputPath}\n`);
      generated++;
    } catch (err) {
      console.error(`      ✗ ${item.slug}: ${err.message}`);
      await updateManifestStatus(MANIFEST, item.slug, 'failed');
      failedSlugs.push(item.slug);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failedSlugs.length > 0) {
    console.log(`Failed slugs: ${failedSlugs.join(', ')}`);
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

Expected: PASS, 3 tests.

- [ ] **Step 5: Run dry-run on real manifest as smoke check**

```bash
node scripts/generate-og-cards.mjs --dry-run | head -20
```

Expected: prints `DRY  {slug}` lines for the first ideas in `ideas/manifest.json`. No API calls (no env vars needed). If you see `subject: undefined`, the source fallback chain is broken — re-check Task 4.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-og-cards.mjs tests/og/orchestrator.test.mjs
git commit -m "og-pipeline: add orchestrator script with CLI + manifest writeback"
```

---

## Task 10: Build gate — `check-og-cards.js`

**Files:**
- Create: `scripts/check-og-cards.js`
- Test: `tests/og/check-og-cards.test.mjs`

Matches the existing `check:stylesheets` / `check:links` pattern: CommonJS, exits 0 by default, exits 1 with `STRICT=1`. Asserts that every idea in the manifest has a corresponding PNG on disk.

- [ ] **Step 1: Write the failing test**

Create `tests/og/check-og-cards.test.mjs`:

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

function setupDir({ withPng = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'og-check-'));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  mkdirSync(join(dir, 'image/og/idea'), { recursive: true });
  writeFileSync(
    join(dir, 'ideas/manifest.json'),
    JSON.stringify({ ideas: [{ slug: 'one', title: 'One' }] })
  );
  if (withPng) writeFileSync(join(dir, 'image/og/idea/one.png'), 'fake');
  return dir;
}

test('exits 0 by default when PNG missing (warn-only)', () => {
  const dir = setupDir({ withPng: false });
  const r = runIn(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /missing/i);
});

test('exits 1 when STRICT=1 and PNG missing', () => {
  const dir = setupDir({ withPng: false });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 1);
});

test('exits 0 when all PNGs present even under STRICT=1', () => {
  const dir = setupDir({ withPng: true });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/og/check-og-cards.test.mjs
```

Expected: FAIL — script doesn't exist yet, all three tests fail.

- [ ] **Step 3: Implement the script**

Create `scripts/check-og-cards.js`:

```js
#!/usr/bin/env node
/**
 * Asserts every idea in ideas/manifest.json has a corresponding OG PNG on
 * disk at image/og/idea/{slug}.png.
 *
 * Default: warn-only, exit 0.
 * STRICT=1: exit 1 if any are missing. Used in CI gates.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const manifestPath = path.join(root, 'ideas/manifest.json');
const ogDir = path.join(root, 'image/og/idea');
const strict = process.env.STRICT === '1';

if (!fs.existsSync(manifestPath)) {
  console.log(`No manifest at ${manifestPath} — nothing to check.`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const missing = [];

for (const idea of manifest.ideas ?? []) {
  const png = path.join(ogDir, `${idea.slug}.png`);
  if (!fs.existsSync(png)) missing.push(idea.slug);
}

if (missing.length === 0) {
  console.log(`og-cards: all ${manifest.ideas.length} ideas have OG cards`);
  process.exit(0);
}

console.log(`og-cards: ${missing.length} missing`);
for (const s of missing) console.log(`  - ${s}`);
console.log(`run: npm run og:generate`);

process.exit(strict ? 1 : 0);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/og/check-og-cards.test.mjs
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-og-cards.js tests/og/check-og-cards.test.mjs
git commit -m "og-pipeline: add check:og-cards build gate"
```

---

## Task 11: Manifest schema extension — backfill 5 ideas with `og.subject`

**Files:**
- Modify: `ideas/manifest.json`

Pick 5 representative ideas covering the brand range. Each gets a concrete `og` block with `subject` (the visual prompt) and `accent` (one of lime / mint / lavender). The subjects below are tuned for the terminal-photographic aesthetic — concrete single subjects, no abstractions.

- [ ] **Step 1: Add `og` block to `agent-storefront-platform`**

In `ideas/manifest.json`, find the `"slug": "agent-storefront-platform"` entry and add this `og` block (place it as a sibling of `"description"`, not nested in `provenance`):

```json
"og": {
  "subject": "A single glowing laptop screen on a dark counter, lavender backlight, a cluster of small product cards floating in shallow depth above the keyboard, late night",
  "accent": "lavender"
}
```

- [ ] **Step 2: Add `og` block to `contract-analyzer`**

```json
"og": {
  "subject": "A stack of paper documents lit by a single overhead lamp on a near-black desk, lime accent glow from a phone screen beside them, shallow focus",
  "accent": "lime"
}
```

- [ ] **Step 3: Add `og` block to `meeting-scheduler`**

```json
"og": {
  "subject": "A wristwatch face glowing in mint light on a dark wooden surface, a closed laptop just out of focus behind it, pre-dawn atmosphere",
  "accent": "mint"
}
```

- [ ] **Step 4: Add `og` block to `habit-tracker`**

```json
"og": {
  "subject": "A small open notebook on a black surface with a single lavender highlighter beside it, single-light side lighting, very shallow focus, no visible writing",
  "accent": "lavender"
}
```

- [ ] **Step 5: Add `og` block to `email-to-todo`**

```json
"og": {
  "subject": "A phone face-up on a dark desk showing a single notification dot in lime, paper sticky note crumpled beside it, low key lighting, late evening",
  "accent": "lime"
}
```

- [ ] **Step 6: Verify manifest still parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('ideas/manifest.json'))" && echo OK
```

Expected: prints `OK`. If you get a SyntaxError, fix the trailing-comma / brace mistake at the line number Node reports.

- [ ] **Step 7: Verify dry-run picks up the subjects**

```bash
node scripts/generate-og-cards.mjs --dry-run --slug agent-storefront-platform
```

Expected output:

```
DRY   agent-storefront-platform
      subject: A single glowing laptop screen on a dark counter, lavender backlight, ...
      → image/og/idea/agent-storefront-platform.png
```

- [ ] **Step 8: Commit**

```bash
git add ideas/manifest.json
git commit -m "og-pipeline: backfill og.subject for 5 seed ideas"
```

---

## Task 12: One-time Recraft style ID setup (manual)

**Files:**
- Create: `.env.example`

This is operator work, not engineering. Document it carefully so the next person can repeat it.

- [ ] **Step 1: Create `.env.example`**

If `.env.example` does not yet exist, create it. If it does, append these lines:

```
# Recraft v3 — primary image generator
# Sign up at https://www.recraft.ai → Settings → API
RECRAFT_API_KEY=

# Optional but strongly recommended: a Recraft "Style" UUID created from
# 3-5 reference images. Anchors brand consistency across hundreds of
# generations. See IMAGES.md "One-time setup" for how to seed it.
RECRAFT_STYLE_ID=

# OpenAI — fallback when Recraft errors (rate limit, moderation, downtime)
# Uses gpt-image-1 model at "medium" quality (~$0.042/image).
OPENAI_API_KEY=
```

- [ ] **Step 2: Sign up for Recraft and add key**

Go to https://www.recraft.ai. Create an account. Settings → API → copy the key. Drop it into `.env.local` (create the file if it doesn't exist; it must NOT be committed):

```
RECRAFT_API_KEY=re_xxxxxxxxxxxxx
```

Verify `.env.local` is in `.gitignore`:

```bash
grep -q '^\.env\.local$' .gitignore && echo OK || echo "ADD .env.local TO .gitignore"
```

If you see `ADD .env.local TO .gitignore`, append `.env.local` on its own line to `.gitignore` and commit it.

- [ ] **Step 3: Generate 5 candidate images for the Recraft style seed**

Add `OPENAI_API_KEY` to `.env.local` first if you have one (so the fallback works during this seeding step — without a Recraft style yet, you may want a comparison). Then run:

```bash
node scripts/generate-og-cards.mjs --force --slug agent-storefront-platform
node scripts/generate-og-cards.mjs --force --slug contract-analyzer
node scripts/generate-og-cards.mjs --force --slug meeting-scheduler
node scripts/generate-og-cards.mjs --force --slug habit-tracker
node scripts/generate-og-cards.mjs --force --slug email-to-todo
```

Open the resulting PNGs in `image/og/idea/`. They will look "close" to terminal-photographic but not yet anchored. That's expected.

- [ ] **Step 4: Open Recraft dashboard → Styles → Create style**

In the Recraft web UI:
1. Go to **Styles** → **Create new style**
2. Pick the 3 best-looking PNGs from step 3 as **reference images** (the ones that most match "terminal-photographic, dark scene with single accent light")
3. Name the style: `weekend-mvp-terminal-photographic`
4. After creation, copy the **Style UUID** from the URL or the Styles list

- [ ] **Step 5: Save Style UUID**

Add to `.env.local`:

```
RECRAFT_STYLE_ID=00000000-0000-0000-0000-000000000000
```

- [ ] **Step 6: Push the same key to Vercel**

In the Vercel dashboard for this project: Settings → Environment Variables → add `RECRAFT_API_KEY`, `RECRAFT_STYLE_ID`, `OPENAI_API_KEY` for **Production** and **Preview**. (These are only needed if you later run the script in CI/Vercel; safe to add now so it's done.)

- [ ] **Step 7: Commit `.env.example`**

```bash
git add .env.example
git commit -m "og-pipeline: document required env vars in .env.example"
```

---

## Task 13: Smoke test + iterate STYLE_BLUEPRINT until the look is right

This is operator work — calibrating the brand. No code changes unless the wording in `lib/og/style-blueprint.mjs` needs adjustment.

- [ ] **Step 1: Force-regenerate the 5 seed ideas with the now-anchored Style ID**

```bash
node scripts/generate-og-cards.mjs --force
```

Expected: 5 `GEN ✓ recraft` lines, no fallbacks.

- [ ] **Step 2: Open the 5 PNGs in Finder thumbnail view**

```bash
open image/og/idea/
```

Switch to Finder's thumbnail view. Look at the 5 thumbnails as a row. Ask:
1. Do they share a coherent palette (mostly black with one accent each)?
2. Is the title legible at thumbnail size?
3. Does anything look stock-photo-y, photorealistic-people-y, or off-brand?

- [ ] **Step 3: If drift, refine `STYLE_BLUEPRINT` and regenerate**

If the look is wrong (e.g., too colorful, too synthetic, too many props in scene), edit `lib/og/style-blueprint.mjs` — *only* the wording inside the array — then `node scripts/generate-og-cards.mjs --force` and re-eyeball.

If the look is wrong in a way `STYLE_BLUEPRINT` can't fix (e.g., the underlying Recraft style references are weak), go back to Recraft dashboard and **add 1-2 more reference images** to the existing style. This re-anchors without changing `RECRAFT_STYLE_ID`.

- [ ] **Step 4: Commit any blueprint changes**

```bash
git add lib/og/style-blueprint.mjs image/og/idea/
git commit -m "og-pipeline: tune STYLE_BLUEPRINT after first smoke test"
```

If no blueprint changes needed:

```bash
git add image/og/idea/
git commit -m "og-pipeline: ship 5 seed OG cards"
```

---

## Task 14: Update `<meta property="og:image">` on the 5 idea pages

**Files:**
- Modify: `ideas/agent-storefront-platform.html`
- Modify: `ideas/contract-analyzer.html`
- Modify: `ideas/meeting-scheduler.html`
- Modify: `ideas/habit-tracker.html`
- Modify: `ideas/email-to-todo.html`

For each of the 5 pages: find the `<meta property="og:image">` (and its `twitter:image` sibling) and update them to point at the new card.

- [ ] **Step 1: Inspect the current og:image for one file**

```bash
grep -n 'og:image\|twitter:image' ideas/agent-storefront-platform.html
```

Note the exact existing tag(s) so the replacement is precise.

- [ ] **Step 2: Update each of the 5 files**

For `agent-storefront-platform.html`, replace the og:image line:

```html
<meta property="og:image" content="https://weekendmvp.app/image/og/idea/agent-storefront-platform.png">
```

If a `twitter:image` line is present, update it to match:

```html
<meta name="twitter:image" content="https://weekendmvp.app/image/og/idea/agent-storefront-platform.png">
```

Repeat for `contract-analyzer.html`, `meeting-scheduler.html`, `habit-tracker.html`, `email-to-todo.html`, substituting the slug in the URL.

- [ ] **Step 3: Verify all 5 are updated**

```bash
grep -l 'image/og/idea/' ideas/agent-storefront-platform.html ideas/contract-analyzer.html ideas/meeting-scheduler.html ideas/habit-tracker.html ideas/email-to-todo.html
```

Expected: prints all 5 filenames.

- [ ] **Step 4: Commit**

```bash
git add ideas/agent-storefront-platform.html ideas/contract-analyzer.html ideas/meeting-scheduler.html ideas/habit-tracker.html ideas/email-to-todo.html
git commit -m "ideas: wire 5 pages to per-page OG cards"
```

---

## Task 15: Write `IMAGES.md`

**Files:**
- Create: `IMAGES.md`

- [ ] **Step 1: Create the document**

Create `IMAGES.md` at the repo root:

````markdown
# OG Image Generation — Workflow

Every idea page gets its own 1200×630 OG share card. Cards are generated by
`scripts/generate-og-cards.mjs` from `ideas/manifest.json` entries and live at
`image/og/idea/{slug}.png`. They are committed to git so social crawlers (and
the static site) can serve them directly.

## One-time setup

1. **Sign up for Recraft v3** at https://www.recraft.ai. Settings → API → copy key. Drop into `.env.local`:
   ```
   RECRAFT_API_KEY=re_xxx
   ```

2. **Sign up for OpenAI** (used as fallback). Drop into `.env.local`:
   ```
   OPENAI_API_KEY=sk-xxx
   ```

3. **Seed the Recraft style** (this is the brand anchor — do not skip):
   - Run `node scripts/generate-og-cards.mjs --force --slug <some-slug>` 5 times against 5 different slugs without `RECRAFT_STYLE_ID` set
   - In Recraft dashboard → Styles → Create style, upload the 3-5 best PNGs as references
   - Name it `weekend-mvp-terminal-photographic`
   - Copy the Style UUID into `.env.local`:
   ```
   RECRAFT_STYLE_ID=00000000-0000-0000-0000-000000000000
   ```

4. **Add the same env vars to Vercel** Production + Preview environments.

## Generating cards

```bash
npm run og:generate              # generate any missing
npm run og:generate:force        # regenerate all (use sparingly — costs money)
npm run og:generate:dry          # show what would run, no API calls

# Generate a single slug
node scripts/generate-og-cards.mjs --slug agent-storefront-platform

# Non-blocking mode (used by publish-idea — exits 0 on failure)
node scripts/generate-og-cards.mjs --slug X --non-blocking
```

The script:
1. Reads `ideas/manifest.json`, applies `og.subject → description → title` fallback
2. For each slug without an existing PNG (or all, with `--force`), calls Recraft v3 with the prompt = `STYLE_BLUEPRINT` + subject
3. If Recraft errors, falls back to `gpt-image-1` (medium quality)
4. Composes the result through Satori with title + WMV chrome → 1200×630 PNG
5. Writes to `image/og/idea/{slug}.png`
6. Updates `og.status` in the manifest to `ready` or `failed`
7. Skips slugs whose PNG already exists (use `--force` to regenerate)

## Writing good `og.subject` text

The `og.subject` field in `ideas/manifest.json` is the *visual* prompt sent to
Recraft after the `STYLE_BLUEPRINT` prefix. Write it like a director's note for
a photographer — concrete, single-subject, scene-specific:

✅ **Good**: `"A glowing laptop screen on a dark counter, lavender backlight, late night, shallow focus"`

❌ **Bad**: `"agent storefront platform image"` (too vague — model has nothing to anchor on)

❌ **Bad**: `"image showing AI agents shopping for products"` (abstract, not visual)

Match the brand: dark scenes, one accent color (lime / lavender / mint), one subject, late-night atmosphere. No people, no faces, no visible text.

## How the prompt is built

```
{STYLE_BLUEPRINT}

Subject: {og.subject || description || title}
```

The `STYLE_BLUEPRINT` is fixed in `lib/og/style-blueprint.mjs`. **Do not change it casually** — every regenerated card will look subtly different from existing ones. Treat as a brand asset.

## Drift recovery

Even with `RECRAFT_STYLE_ID`, Recraft can drift over months:

1. Generate one new card and place it in a thumbnail row beside the last 3 published cards
2. If it sticks out (different palette, lighting, vibe), force-regenerate just that slug: `node scripts/generate-og-cards.mjs --slug X --force`
3. If 3+ recent cards feel "off", refresh the Recraft style by adding the most recent good cards as new references in the Recraft dashboard. This re-anchors without changing the UUID.

## Cost expectations

- Per card: ~$0.04 (Recraft) or ~$0.042 (gpt-image-1 medium)
- 50 ideas: ~$2 total
- Forever-cost (~5 ideas/week): ~$0.20/week

Cheap. Optimize against quality, not cost.

## Manual override

If you have a hand-picked image for a specific slug:
1. Drop it at `image/og/idea/{slug}.png` (1200×630)
2. The generator will skip it (existence check)

## Build gate

`npm run check:og-cards` walks the manifest and warns about any slug missing a PNG. Exits 0 by default; exits 1 with `STRICT=1` (use this in CI to block deploys with missing cards).

## Adding new surfaces (articles, newsletter, carousel)

The pipeline shape supports it. Each new surface needs:
1. A new source module: `lib/og/sources/{surface}.mjs`
2. A new template: `lib/og/templates/{surface}.mjs`
3. Register the template in `lib/og/compose.mjs` `TEMPLATES` map
4. Add the surface to the orchestrator's source list

See the spec at `docs/superpowers/specs/2026-05-02-recraft-og-image-pipeline-design.md` for the full surface roadmap.
````

- [ ] **Step 2: Commit**

```bash
git add IMAGES.md
git commit -m "og-pipeline: add IMAGES.md docs (setup, drift, prompt-writing)"
```

---

## Task 16: Crawler validation (manual)

After the 5 idea pages are deployed (or running locally on `npm run vercel:dev`), verify the cards render correctly in social previews.

- [ ] **Step 1: Pick one shipped page URL**

Use a deployed URL like `https://weekendmvp.app/ideas/agent-storefront-platform` (if shipped), or use ngrok to expose a local server.

- [ ] **Step 2: Run LinkedIn Post Inspector**

Go to https://www.linkedin.com/post-inspector/

Paste the URL. Verify:
- The OG card renders (not the old generic site image)
- Title is overlaid in the image
- Image is 1200×630, no scaling artifacts

- [ ] **Step 3: Run Twitter/X Card Validator**

Go to https://cards-dev.twitter.com/validator (or use the X dev portal's card preview if deprecated).

Paste the URL. Verify the same.

- [ ] **Step 4: If renders are wrong**

Common causes:
- The `og:image` URL is relative not absolute → fix the meta tag
- The PNG isn't actually committed → `git ls-files image/og/idea/`
- The PNG is too large (>5MB) → run `sharp` to recompress (shouldn't happen at 1200×630)
- Cache: LinkedIn caches aggressively. Add `?v=2` to the image URL in the meta tag, redeploy, re-inspect.

(No commit step — this is verification only.)

---

## Task 17: Hook OG generation into `publish-idea` skill

**Files:**
- Locate and modify the `publish-idea` skill file (path varies by install — look for `~/.claude/plugins/.../publish-idea/SKILL.md` or similar)

The `publish-idea` skill is project-specific (it's listed in available skills). The integration is documented as the skill's behavior — actual edit depends on where the skill file lives in the user's environment.

- [ ] **Step 1: Locate the skill file**

```bash
find ~/.claude -type f -name '*.md' 2>/dev/null | xargs grep -l 'publish-idea' 2>/dev/null | head -5
find ~/.paperclip -type f -name '*.md' 2>/dev/null | xargs grep -l 'publish-idea' 2>/dev/null | head -5
```

Note the path that contains the actual `publish-idea` skill definition (the file that describes what the skill DOES, not just references it).

- [ ] **Step 2: Read current skill flow**

Read the located file. Identify the section where `publish-idea`:
- Writes the new entry to `ideas/manifest.json`
- Writes the page HTML
- Updates `sitemap.xml`

This is where the OG hook lands — as the **last** step.

- [ ] **Step 3: Add the OG generation step to the skill**

Append this step to the skill's flow (after the page is written and the manifest entry is in place):

```markdown
### Step N: Generate the OG card (best-effort, never blocks publish)

Run:
\`\`\`bash
node scripts/generate-og-cards.mjs --slug {slug} --non-blocking
\`\`\`

The `--non-blocking` flag means a Recraft/OpenAI failure exits 0 so the publish flow continues. The script writes `og.status: "ready"` or `og.status: "failed"` into the manifest entry — a future `npm run og:generate` run will retry any "failed" entries.

The page already references `image/og/idea/{slug}.png` in its `<meta property="og:image">` tag (set during page generation). If the OG card generation fails, social crawlers fall back to the site-wide `image/og-image.png` automatically when fetching the missing path.
```

- [ ] **Step 4: Update the page-generation step to write the og:image meta tag**

In whatever section of `publish-idea` writes the new page's `<head>`, ensure the `og:image` and `twitter:image` tags are set to:

```html
<meta property="og:image" content="https://weekendmvp.app/image/og/idea/{slug}.png">
<meta name="twitter:image" content="https://weekendmvp.app/image/og/idea/{slug}.png">
```

The PNG may not exist yet at this point — that's intentional. Crawlers fall back to the site-wide image; subsequent regeneration fills in the slot.

- [ ] **Step 5: Update the manifest-write step to include `og.subject`**

In whatever section of `publish-idea` writes the new manifest entry, ensure it includes an `og` block:

```json
{
  "slug": "...",
  "title": "...",
  "...other fields...": "...",
  "og": {
    "subject": "{a director's note generated for this idea — see IMAGES.md guidelines}",
    "accent": "{one of: lime, mint, lavender — chosen to match the idea's category}",
    "status": "pending"
  }
}
```

The skill should generate `og.subject` as part of its content-research output (concrete, visual, single-subject — see `IMAGES.md` § Writing good `og.subject` text).

- [ ] **Step 6: Smoke test the integrated flow**

Run a real `publish-idea` invocation on a fresh idea slug. Verify:
1. The HTML page is created with the correct og:image meta tag
2. The manifest entry has an `og.subject`
3. `node scripts/generate-og-cards.mjs --slug {newslug} --non-blocking` runs as the final step
4. `image/og/idea/{newslug}.png` exists after success
5. `og.status` in manifest is `ready` (or `failed`, which is acceptable — the publish still completes)

- [ ] **Step 7: Commit**

```bash
# If the skill file is in this repo:
git add path/to/publish-idea/SKILL.md
git commit -m "publish-idea: hook OG card generation as final step (graceful)"

# If the skill is in ~/.claude (user-global):
# No commit — the skill file lives outside this repo. Note in IMAGES.md
# that the skill was updated.
```

---

## Self-review

This plan was self-reviewed after writing — checks performed:

**1. Spec coverage:** Every numbered item in the spec's v1 task list (1-17) maps to a task in this plan:
- Spec items 1, 5-9 → Plan Tasks 1-9 (deps + 8 modules + orchestrator)
- Spec item 9 → Plan Task 10 (check-og-cards)
- Spec item 10 → Plan Task 1 step 3 (npm scripts in package.json)
- Spec item 11 → Plan Task 11 (manifest backfill)
- Spec item 12 → Plan Task 12 (manual Recraft style setup)
- Spec item 13 → Plan Task 13 (smoke test + iterate)
- Spec item 14 → Plan Task 14 (update meta tags)
- Spec item 15 → Plan Task 15 (IMAGES.md)
- Spec item 16 → Plan Task 16 (crawler validation)
- Spec item 17 → Plan Task 17 (publish-idea integration)

**2. Placeholder scan:** No `TBD`, `TODO`, "implement later", or "add appropriate error handling". All test code and implementation code is concrete. The 5 backfill subjects in Task 11 are real prose, not placeholders.

**3. Type consistency:** `generate({prompt, apiKey, styleId, fetchImpl})` signature matches across both providers. `compose({bgBuffer, title, surface, accent})` matches what the orchestrator calls. `listIdeas({manifestPath?})` returns items shaped exactly as the orchestrator consumes them. `parseArgs` and `updateManifestStatus` exports match the orchestrator test imports.

**4. Test framework:** Plan uses `node:test` (built-in, no new dep) consistently across all test files. Tests run with `node --test path/to/test.mjs` — confirmed by Task 1's `test:og` script.

---

## Out of scope (follow-up plans)

- `articles/manifest.json` + `lib/og/sources/articles.mjs` + `lib/og/templates/article.mjs`
- Newsletter HTML archive page OG cards (`templates/newsletter.mjs`)
- Newsletter inline email illustration (separate Recraft call inside email body)
- Carousel slide-1 hero illustration (different aspect ratio, different template)
- Idea-page in-page editorial illustration (separate from the OG card)
- `<meta name="og-subject">` scraper for one-off pages (`index.html`, etc.)
- Hooks into `publish-article`, `publish-programmatic`, `newsletter`, `carousel` skills
