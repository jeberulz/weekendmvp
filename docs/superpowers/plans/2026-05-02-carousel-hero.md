# Carousel Slide-1 Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `carousel-hero` surface that generates a single 1080×1350 JPEG hero per existing/future carousel post, with a markdown-table-based "manifest" and zero compose changes.

**Architecture:** Reuses the established surface-agnostic compose pipeline. New per-template config (image-only, JPEG, no chrome) + new source that parses the pipe-delimited table at the top of `content/social/posts/*/carousel.md` + register-template-only addition to `compose.mjs` + import-only addition to the orchestrator. No JSON manifest, no build-gate coverage in v1, no orchestrator lookup-table changes (status writeback is a silent no-op for this surface).

**Tech Stack:** Node ESM, `node:test`, `node:fs/promises`, `sharp`, `satori`, `@resvg/resvg-js`, Recraft v3 + OpenAI gpt-image-1 fallback. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-02-carousel-hero-design.md`

---

## File Structure

**New files:**
- `lib/og/templates/carousel-hero.mjs` — per-template config (1080×1350 JPEG q88, no `buildElement`)
- `lib/og/sources/carousel-hero.mjs` — exports `listCarouselHero` + `parseTable` (helper, exported for tests); scans `content/social/posts/*/carousel.md`
- `image/social/carousel/.gitkeep` — output dir
- `tests/og/templates-carousel-hero.test.mjs` — config shape + absence of `buildElement` (2 tests)
- `tests/og/sources-carousel-hero.test.mjs` — table parsing + item shape + fallback subject + accent default (5 tests)
- `tests/og/fixtures/carousel-posts/2026-04-23_test-post/carousel.md` — fixture mirroring real format
- `tests/og/fixtures/carousel-posts/2026-04-22_with-subject/carousel.md` — fixture with `slide_01_subject` set

**Modified files:**
- `lib/og/compose.mjs:1-17` — add 1 import + register `'carousel-hero': carouselHeroTemplate` in TEMPLATES
- `scripts/generate-og-cards.mjs:23-26,130-134` — add 1 import + 1 `tryLoad` line in `loadAllItems`
- `package.json:21` — add `og:generate:carousel-hero` script
- `IMAGES.md` — document the new surface + markdown-table-as-manifest pattern + Surface D v2 caveat
- `.claude/skills/carousel/SKILL.md` — write `slide_01_subject` into the metadata table during draft + invoke generator with `--non-blocking` as a new step (gitignored, local-only)

**Not modified (deliberate):**
- `scripts/check-og-cards.js` — carousel-hero not added to gate (deferred to v2)
- `tests/og/orchestrator.test.mjs` — no STATUS_FIELDS / MANIFEST_PATHS changes
- `tests/og/compose.test.mjs` — no compose logic changes (Surface C already covers no-chrome JPEG)

---

## Task 1: npm script + output directory

**Files:**
- Modify: `package.json`
- Create: `image/social/carousel/.gitkeep`

- [ ] **Step 1: Add the npm script**

Edit `package.json`. After the existing `og:generate:email-newsletter` line, add:

```json
"og:generate:email-newsletter": "node scripts/generate-og-cards.mjs --surface email-newsletter",
"og:generate:carousel-hero": "node scripts/generate-og-cards.mjs --surface carousel-hero",
```

- [ ] **Step 2: Create the output directory**

```bash
mkdir -p image/social/carousel && touch image/social/carousel/.gitkeep
```

- [ ] **Step 3: Verify**

```bash
ls image/social/carousel/.gitkeep && grep og:generate:carousel-hero package.json
```
Expected: both lines print without error.

- [ ] **Step 4: Commit**

```bash
git add package.json image/social/carousel/.gitkeep
git commit -m "og-pipeline: add og:generate:carousel-hero script + output dir"
```

---

## Task 2: carousel-hero template (config-only, no buildElement)

**Files:**
- Create: `lib/og/templates/carousel-hero.mjs`
- Create: `tests/og/templates-carousel-hero.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/og/templates-carousel-hero.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as carouselHeroTemplate from '../../lib/og/templates/carousel-hero.mjs';

test('carousel-hero template exports a config object with 1080x1350 full-bleed JPEG', () => {
  assert.ok(carouselHeroTemplate.config, 'config export missing');
  assert.equal(carouselHeroTemplate.config.width, 1080);
  assert.equal(carouselHeroTemplate.config.height, 1350);
  assert.deepEqual(carouselHeroTemplate.config.bgRect, { x: 0, y: 0, width: 1080, height: 1350 });
  assert.equal(carouselHeroTemplate.config.bgFill, '#050505');
  assert.equal(carouselHeroTemplate.config.format, 'jpeg');
  assert.equal(carouselHeroTemplate.config.jpegQuality, 88);
});

test('carousel-hero template has NO buildElement export (image-only surface)', () => {
  // The compose module uses the absence of buildElement as the signal that
  // this is an image-only surface — no Satori chrome rendered.
  assert.equal(carouselHeroTemplate.buildElement, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/og/templates-carousel-hero.test.mjs`
Expected: FAIL with `Cannot find module '../../lib/og/templates/carousel-hero.mjs'`.

- [ ] **Step 3: Implement the template**

Create `lib/og/templates/carousel-hero.mjs`:

```js
// Per-template canvas config consumed by compose.mjs.
// Carousel slide-1 heroes are 1080x1350 full-bleed JPGs with NO chrome —
// the compose module detects the absence of `buildElement` and skips Satori,
// returning the resized Recraft scene directly. JPEG quality 88 (slightly
// higher than email's 85) because these render at full size on
// LinkedIn/Instagram, not as inbox thumbnails.
export const config = {
  width: 1080,
  height: 1350,
  bgRect: { x: 0, y: 0, width: 1080, height: 1350 },
  bgFill: '#050505',
  format: 'jpeg',
  jpegQuality: 88
};

// Intentionally no `buildElement` export — see Surface C / email-newsletter
// for the precedent. compose.mjs falls through to the no-chrome code path.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/og/templates-carousel-hero.test.mjs`
Expected: PASS — 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/og/templates/carousel-hero.mjs tests/og/templates-carousel-hero.test.mjs
git commit -m "og-pipeline: add carousel-hero template (1080x1350 JPEG, no chrome)"
```

---

## Task 3: carousel-hero source (markdown table parser)

**Files:**
- Create: `lib/og/sources/carousel-hero.mjs`
- Create: `tests/og/sources-carousel-hero.test.mjs`
- Create: `tests/og/fixtures/carousel-posts/2026-04-23_test-post/carousel.md`
- Create: `tests/og/fixtures/carousel-posts/2026-04-22_with-subject/carousel.md`

- [ ] **Step 1: Create fixture A — table without `slide_01_subject` (forces fallback)**

Create `tests/og/fixtures/carousel-posts/2026-04-23_test-post/carousel.md`:

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
| accent_primary | lime |

---

# Slide 01 — Hero
eyebrow: THU · APR 23 · 2026
```

- [ ] **Step 2: Create fixture B — table WITH `slide_01_subject`**

Create `tests/og/fixtures/carousel-posts/2026-04-22_with-subject/carousel.md`:

```markdown
| Field | Value |
|-------|-------|
| date | 2026-04-22 |
| slot | am |
| theme | Tutorial / Vibe Coding |
| topic | Build a startup idea page in 30 minutes |
| accent_primary | mint |
| slide_01_subject | A pencil mid-stroke on a dark notebook page, single mint glow tracing the line |

---

# Slide 01 — Hero
```

- [ ] **Step 3: Write the failing tests**

Create `tests/og/sources-carousel-hero.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listCarouselHero, parseTable } from '../../lib/og/sources/carousel-hero.mjs';

const FIXTURE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/carousel-posts'
);

test('parseTable extracts key/value rows and stops at horizontal rule', () => {
  const md = [
    '| Field | Value |',
    '|-------|-------|',
    '| date | 2026-04-23 |',
    '| theme | Case Study |',
    '',
    '---',
    '',
    '# Slide 01',
    '| ignored | row |'
  ].join('\n');
  const out = parseTable(md);
  assert.deepEqual(out, { date: '2026-04-23', theme: 'Case Study' });
});

test('listCarouselHero returns one item per carousel post directory', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  assert.equal(items.length, 2);
});

test('listCarouselHero sets surface=carousel-hero and uses dirname as slug', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  const item = items.find((i) => i.slug === '2026-04-23_test-post');
  assert.ok(item, 'expected item with slug=2026-04-23_test-post');
  assert.equal(item.surface, 'carousel-hero');
  assert.equal(item.outputPath, 'image/social/carousel/2026-04-23_test-post.jpg');
});

test('listCarouselHero falls back to `${theme} — ${topic}` when slide_01_subject is missing', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  const fallback = items.find((i) => i.slug === '2026-04-23_test-post');
  assert.equal(
    fallback.subject,
    'Case Study / $1K Month — What $1K/mo looks like for AI Nutrition Planner for Trainers'
  );
});

test('listCarouselHero uses slide_01_subject verbatim when present', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  const explicit = items.find((i) => i.slug === '2026-04-22_with-subject');
  assert.equal(
    explicit.subject,
    'A pencil mid-stroke on a dark notebook page, single mint glow tracing the line'
  );
});

test('listCarouselHero reads accent from accent_primary; defaults to lime when missing', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  assert.equal(items.find((i) => i.slug === '2026-04-23_test-post').accent, 'lime');
  assert.equal(items.find((i) => i.slug === '2026-04-22_with-subject').accent, 'mint');
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `node --test tests/og/sources-carousel-hero.test.mjs`
Expected: FAIL with `Cannot find module '../../lib/og/sources/carousel-hero.mjs'`.

- [ ] **Step 5: Implement the source**

Create `lib/og/sources/carousel-hero.mjs`:

```js
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_ROOT = join(process.cwd(), 'content/social/posts');
const DEFAULT_ACCENT = 'lime';

// Parse the pipe-delimited markdown table at the top of carousel.md.
// Stops at the first non-table line OR the first horizontal rule (`---`).
// Skips the header row (| Field | Value |) and the divider (|---|---|).
// Exported for unit testing — listCarouselHero is the public API.
export function parseTable(text) {
  const out = {};
  const lines = text.split('\n');
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '---') break;
    if (line.startsWith('|')) {
      inTable = true;
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length < 2) continue;
      // Skip the header row and the markdown divider row.
      if (cells[0].toLowerCase() === 'field' && cells[1].toLowerCase() === 'value') continue;
      if (/^:?-+:?$/.test(cells[0])) continue;
      out[cells[0]] = cells.slice(1).join(' | ').trim();
      continue;
    }
    if (inTable && line.length > 0) break;
  }
  return out;
}

// Compose subject for the Recraft call. Priority:
//   1. slide_01_subject (author-written director's note)
//   2. `${theme} — ${topic}` (concatenated metadata)
//   3. slug (last resort)
function deriveSubject(meta, slug) {
  if (meta.slide_01_subject) return meta.slide_01_subject;
  if (meta.theme && meta.topic) return `${meta.theme} — ${meta.topic}`;
  return slug;
}

// Walk content/social/posts/* and emit one item per directory containing
// a parseable carousel.md. Missing/unparseable files are skipped silently.
export async function listCarouselHero({ rootDir = DEFAULT_ROOT } = {}) {
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const path = join(rootDir, slug, 'carousel.md');
    let raw;
    try {
      raw = await readFile(path, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    const meta = parseTable(raw);
    if (Object.keys(meta).length === 0) continue;
    const subject = deriveSubject(meta, slug);
    const title =
      meta.theme && meta.topic ? `${meta.theme} — ${meta.topic}` : slug;
    items.push({
      slug,
      title,
      subject,
      accent: meta.accent_primary ?? DEFAULT_ACCENT,
      surface: 'carousel-hero',
      outputPath: `image/social/carousel/${slug}.jpg`,
      status: undefined
    });
  }
  return items;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/og/sources-carousel-hero.test.mjs`
Expected: PASS — 6/6 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/og/sources/carousel-hero.mjs tests/og/sources-carousel-hero.test.mjs tests/og/fixtures/carousel-posts/
git commit -m "og-pipeline: add carousel-hero source (markdown-table manifest)"
```

---

## Task 4: Register carousel-hero in compose

**Files:**
- Modify: `lib/og/compose.mjs:1-17`

- [ ] **Step 1: Add the import**

Edit `lib/og/compose.mjs`. After the `import * as emailNewsletterTemplate ...` line (around line 9), add:

```js
import * as emailNewsletterTemplate from './templates/email-newsletter.mjs';
import * as carouselHeroTemplate from './templates/carousel-hero.mjs';
```

- [ ] **Step 2: Register the template**

In the same file, replace the `TEMPLATES` map (lines 11–17) with:

```js
const TEMPLATES = {
  idea: ideaTemplate,
  article: articleTemplate,
  newsletter: newsletterTemplate,
  'email-newsletter': emailNewsletterTemplate,
  'carousel-hero': carouselHeroTemplate
};
```

(The `// carousel — added in follow-up surfaces` comment goes away.)

- [ ] **Step 3: Run the existing compose tests to verify no regression**

Run: `node --test tests/og/compose.test.mjs`
Expected: PASS — all existing tests still green.

- [ ] **Step 4: Run the full og test suite**

Run: `npm run test:og`
Expected: PASS — every test file under `tests/og/` passes.

- [ ] **Step 5: Commit**

```bash
git add lib/og/compose.mjs
git commit -m "og-pipeline: register carousel-hero template in compose"
```

---

## Task 5: Wire carousel-hero into the orchestrator

**Files:**
- Modify: `scripts/generate-og-cards.mjs:23-26,130-134`

- [ ] **Step 1: Add the import**

Edit `scripts/generate-og-cards.mjs`. After the `import { listEmailNewsletter } ...` line (around line 26), add:

```js
import { listEmailNewsletter } from '../lib/og/sources/email-newsletter.mjs';
import { listCarouselHero } from '../lib/og/sources/carousel-hero.mjs';
```

- [ ] **Step 2: Wire the loader into `loadAllItems`**

In the same file, replace the `loadAllItems` function body (around lines 119–135) so the surface is loaded alongside the others. Replace:

```js
  await tryLoad(listEmailNewsletter);
  return items;
```

with:

```js
  await tryLoad(listEmailNewsletter);
  await tryLoad(listCarouselHero);
  return items;
```

(Do NOT add `MANIFEST_PATHS` / `MANIFEST_KEYS` / `STATUS_FIELDS` entries — `updateManifestStatus` early-returns when `MANIFEST_PATHS[surface]` is undefined, which is the intended silent-no-op behavior for this surface.)

- [ ] **Step 3: Smoke-test the dry-run**

```bash
node scripts/generate-og-cards.mjs --surface carousel-hero --dry-run
```
Expected output (paths may vary if the test fixture posts are still on disk):

```
DRY   carousel-hero/2026-04-21_the-3-screen-mvp-framework
      subject: ...
      → image/social/carousel/2026-04-21_the-3-screen-mvp-framework.jpg

DRY   carousel-hero/2026-04-22_audit-gate-for-ideas
      ...

DRY   carousel-hero/2026-04-23_1k-nutrition-planner
      ...
```

3 entries print, no API calls happen, exit code 0.

- [ ] **Step 4: Verify other surfaces still load**

```bash
node scripts/generate-og-cards.mjs --dry-run | head -20
```
Expected: every surface (idea, article, newsletter, email-newsletter, carousel-hero) still appears.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-og-cards.mjs
git commit -m "og-pipeline: orchestrator iterates carousel-hero surface"
```

---

## Task 6: Test generation against `2026-04-23_1k-nutrition-planner`

**Files:**
- Read-only: `content/social/posts/2026-04-23_1k-nutrition-planner/carousel.md`
- Output: `image/social/carousel/2026-04-23_1k-nutrition-planner.jpg`

This is a manual operator step — one Recraft call (~$0.04). Do NOT run if `RECRAFT_API_KEY` is missing.

- [ ] **Step 1: Confirm credentials**

```bash
grep -q RECRAFT_API_KEY .env.local && echo "ok" || echo "missing"
```
Expected: `ok`. If `missing`, stop here and ask the operator to add the key.

- [ ] **Step 2: Generate one image**

```bash
node scripts/generate-og-cards.mjs --slug 2026-04-23_1k-nutrition-planner --surface carousel-hero
```
Expected: 1 file written at `image/social/carousel/2026-04-23_1k-nutrition-planner.jpg`. Console prints `✓ recraft → image/social/carousel/2026-04-23_1k-nutrition-planner.jpg` (or `openai-gpt-image-1` if Recraft falls back).

- [ ] **Step 3: Verify file metadata**

```bash
file image/social/carousel/2026-04-23_1k-nutrition-planner.jpg
```
Expected output should include `JPEG image data` and `1080 x 1350`.

- [ ] **Step 4: Eyeball the JPG**

```bash
open image/social/carousel/2026-04-23_1k-nutrition-planner.jpg
```
Confirm: dark background, lime accent visible, recognizably brand-cohesive with the existing newsletter postcards.

- [ ] **Step 5: Decide whether to commit the image**

If the operator approves the result:

```bash
git add image/social/carousel/2026-04-23_1k-nutrition-planner.jpg
git commit -m "og-pipeline: generate carousel hero for 2026-04-23_1k-nutrition-planner"
```

If not, leave it uncommitted; the operator may add `slide_01_subject` to that post's `carousel.md` and re-run `--force` to regenerate.

---

## Task 7: Document the surface in IMAGES.md

**Files:**
- Modify: `IMAGES.md` (append a new section)

- [ ] **Step 1: Add a "Surface D — Carousel slide-1 hero" section**

Open `IMAGES.md` and append a new section after the email-newsletter (Surface C) section. The exact prose:

```markdown
## Surface D — Carousel slide-1 hero (`image/social/carousel/`)

**Output:** 1080×1350 JPEG (quality 88), no chrome — full-bleed Recraft scene.

**"Manifest":** the pipe-delimited markdown table at the top of every
`content/social/posts/{date}_{slug}/carousel.md`. There is no JSON manifest
for this surface. The orchestrator's `updateManifestStatus` is a silent
no-op for `carousel-hero` items because `MANIFEST_PATHS[surface]` is
undefined — by design.

**Subject sourcing (priority order):**
1. `slide_01_subject` (author-written director's note in the table) — preferred
2. `${theme} — ${topic}` (concatenated table fields) — fallback for legacy posts
3. `${slug}` — last resort

**Accent:** read directly from `accent_primary` in the table (already a brand
accent name — `lime`, `mint`, `lavender`, etc.). Defaults to `lime`.

**Generate one:**
\`\`\`
node scripts/generate-og-cards.mjs --slug 2026-04-23_1k-nutrition-planner --surface carousel-hero
\`\`\`

**Generate all (future + existing):**
\`\`\`
npm run og:generate:carousel-hero
\`\`\`

**Known v1 gaps (deferred to Surface D v2 spec/plan):**
- `scripts/check-og-cards.js` does NOT walk carousel posts. The build gate
  is JSON-manifest-shaped; a markdown-table-walking strategy is needed before
  it can cover this surface.
- `content/social/_layouts/*.html` does NOT yet honor the slide-01 hero JPG
  as a CSS background. Until that ships, the JPG is a standalone deliverable
  (post to LinkedIn/Instagram as a separate carousel slide-0 card or use
  manually).
```

(Replace each pair of escaped `\`\`\`` with real triple-backtick fences when editing.)

- [ ] **Step 2: Commit**

```bash
git add IMAGES.md
git commit -m "og-pipeline: document carousel-hero surface in IMAGES.md"
```

---

## Task 8: Hook the carousel skill (gitignored)

**Files:**
- Modify: `.claude/skills/carousel/SKILL.md` (gitignored — local-only)

The skill file is gitignored, so this task does not produce a git commit. The goal is to add `slide_01_subject` to draft generation and invoke the generator after Phase 5.

- [ ] **Step 1: Add `slide_01_subject` to the metadata-table draft step**

Open `.claude/skills/carousel/SKILL.md` and locate "Phase 3 — Draft Creation → 3.2 Generate `carousel.md`" (around line 187). After the existing content rules, add a sub-rule under section 3.2:

```markdown
**Slide-1 hero subject (mandatory).** Write a `slide_01_subject` row into
the metadata table — a 1–2 sentence director's note describing the scene
the slide-1 hero image should depict. Match the style of existing
newsletter `og.subject` notes: short, sensory, dark + accent lighting,
no logos or text in the scene. Example for a tutorial theme:
`A pencil mid-stroke on a dark notebook page, single mint glow tracing the line, very shallow focus`.

This field drives the `carousel-hero` Recraft call. Falling back to
`${theme} — ${topic}` produces a generic image — always author the
subject when creating new posts.
```

- [ ] **Step 2: Add a generator-invocation step after Phase 5**

Locate the end of Phase 5 (the "Render & Export" phase, around line 360+). Add a new sub-step `5.4 Generate slide-1 hero image`:

```markdown
### 5.4 Generate slide-1 hero image

After `slides.html` is rendered and approved, kick off the carousel-hero
Recraft call. This runs non-blocking — Recraft/OpenAI failures do NOT
block publish.

\`\`\`bash
node scripts/generate-og-cards.mjs --slug {date}_{slug} --surface carousel-hero --non-blocking
\`\`\`

On success: writes `image/social/carousel/{date}_{slug}.jpg` (1080×1350 JPEG).
On failure: logs to stderr, exits 0 (because of `--non-blocking`),
publish flow continues.

The operator can retry the failed slug later with:
\`\`\`bash
node scripts/generate-og-cards.mjs --slug {date}_{slug} --surface carousel-hero --force
\`\`\`
```

(Replace each escaped `\`\`\`` with a real triple-backtick fence when editing.)

- [ ] **Step 3: Verify the file is gitignored (should not appear in `git status`)**

```bash
git status --short .claude/skills/carousel/SKILL.md
```
Expected: empty output (the file is ignored). If something prints, stop and check `.gitignore` — do NOT commit the skill file.

- [ ] **Step 4: Smoke-test the new flag set**

```bash
node scripts/generate-og-cards.mjs --slug 2026-04-23_1k-nutrition-planner --surface carousel-hero --dry-run --non-blocking
```
Expected: 1 `DRY` line for that slug, exit 0.

This task is complete — no commit, the skill change is local-only.

---

## Self-Review (post-write)

**Spec coverage:**
- Spec § "Per-template config" → Task 2 ✓
- Spec § "Source — markdown table parser" → Task 3 ✓
- Spec § "Compose changes" (1-line registration) → Task 4 ✓
- Spec § "Orchestrator changes" (import + tryLoad) → Task 5 ✓
- Spec § "Test target / Verification" (manual generation) → Task 6 ✓
- Spec § "File structure" → Tasks 1–8 cover every new + modified file
- Spec § "`slide_01_subject` field convention" → Task 8 (skill hook)
- Spec § "Out of scope" — explicitly NOT addressed (build gate untouched, v2 deferred)

**Placeholder scan:** None — every step contains the actual code, command, or fixture text.

**Type/name consistency:**
- `listCarouselHero` (Task 3 export) matches the import in Task 5 ✓
- `parseTable` (Task 3 export) matches the test import in Task 3 ✓
- `carouselHeroTemplate` (Task 4 binding) matches the import path `./templates/carousel-hero.mjs` from Task 2 ✓
- `slide_01_subject` field name consistent across spec, source, fixtures, tests, and skill ✓
- `accent_primary` field name consistent across spec, source, fixtures, tests ✓
- `surface: 'carousel-hero'` consistent across compose registration, source output, and orchestrator filter ✓
