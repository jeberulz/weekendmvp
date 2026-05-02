# Carousel Slide-1 Hero — HTML Overlay (Surface D v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Surface D v1's hero JPG into slide-1 of `slides.html` as a CSS background under the existing typography, with a bottom-anchored dark gradient that preserves headline contrast and graceful fallback when no JPG exists.

**Architecture:** One CSS rule appended to `content/social/_layouts/_shared.css` targets `.slide-hero[data-has-hero]` across all 6 layouts. The `/carousel` skill (gitignored) restructures Phase 5 so the hero generates *before* HTML render, and adds a transform sub-step `5.1.i` that copies the canonical JPG into the post directory and injects the `data-has-hero` attribute on slide-1. Zero changes to v1 code.

**Tech Stack:** CSS (no preprocessor), Node ESM `node:test`, plain `bash` for skill-driven file ops, sed for attribute injection during render.

**Spec:** `docs/superpowers/specs/2026-05-02-carousel-hero-html-overlay-design.md`

---

## File Structure

**Modified files (committed):**
- `content/social/_layouts/_shared.css` — append the `.slide-hero[data-has-hero]` rule + `::after` gradient overlay at the bottom of the file
- `tests/og/shared-css.test.mjs` (new) — assert the CSS rule and gradient declaration are present

**Modified files (gitignored, local-only — no commit):**
- `.claude/skills/carousel/SKILL.md` — restructure Phase 5 (move existing `5.4 Generate slide-1 hero image` to new `5.0`, rename existing `5.5 Report & Cleanup` back to `5.4`); add transform `5.1.i`; update verification block `5.1.1`

**Per-post (committed when operator re-renders / runs /carousel):**
- `content/social/posts/{slug}/hero.jpg` — copied from canonical `image/social/carousel/{slug}.jpg` by transform 5.1.i
- `content/social/posts/{slug}/slides.html` — re-rendered with `data-has-hero` attribute on slide-1

**Unchanged (deliberate):**
- `lib/og/templates/carousel-hero.mjs`, `lib/og/sources/carousel-hero.mjs`, `lib/og/compose.mjs`, `scripts/generate-og-cards.mjs` — Surface D v1 untouched
- All 6 layout HTML files — markup already shares `.slide-hero` + `[data-slide="1"]`; the new CSS rule + attribute injection covers them all
- `IMAGES.md` — v1 docs already cover the canonical path; the post-local `hero.jpg` is a build artifact, not a documented public surface

---

## Task 1: CSS rule + presence test

**Files:**
- Modify: `content/social/_layouts/_shared.css` (append at end)
- Create: `tests/og/shared-css.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/og/shared-css.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SHARED_CSS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../content/social/_layouts/_shared.css'
);

test('_shared.css contains the .slide-hero[data-has-hero] selector', async () => {
  const css = await readFile(SHARED_CSS, 'utf8');
  assert.match(
    css,
    /\.slide-hero\[data-has-hero\]/,
    'Surface D v2 selector missing — hero overlay rule was deleted or never added'
  );
});

test('_shared.css contains the bottom-anchored dark gradient overlay', async () => {
  const css = await readFile(SHARED_CSS, 'utf8');
  assert.match(css, /linear-gradient\(\s*180deg/, 'gradient direction missing');
  assert.match(
    css,
    /rgba\(\s*5,\s*5,\s*5,\s*0\.55\s*\)/,
    'gradient mid-stop colour rgba(5,5,5,0.55) missing'
  );
});

test('_shared.css declares background-image: url(\'hero.jpg\') for the hero rule', async () => {
  const css = await readFile(SHARED_CSS, 'utf8');
  assert.match(
    css,
    /background-image:\s*url\(\s*['"]hero\.jpg['"]\s*\)/,
    'hero.jpg URL reference missing — slide-1 background will not load'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/og/shared-css.test.mjs`
Expected: 3 tests FAIL with `the input did not match the regular expression`.

- [ ] **Step 3: Append the CSS rule to _shared.css**

Open `content/social/_layouts/_shared.css`. Append at the very bottom of the file (after the last existing rule on line 193):

```css

/* ==========================================================================
   Slide-1 hero image overlay (Surface D v2)
   --------------------------------------------------------------------------
   Activates when the /carousel skill's render step copies
   image/social/carousel/{slug}.jpg → {post-dir}/hero.jpg AND adds the
   `data-has-hero` attribute to the [data-slide="1"] element. Without the
   attribute, slide-1 renders identically to today (dark bg + grid lines).
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

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/og/shared-css.test.mjs`
Expected: PASS — 3/3 tests.

- [ ] **Step 5: Run the full og test suite to confirm no regression**

Run: `npm run test:og`
Expected: PASS — every test under `tests/og/` (including the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add content/social/_layouts/_shared.css tests/og/shared-css.test.mjs
git commit -m "carousel-hero v2: add slide-1 hero CSS rule + presence test"
```

---

## Task 2: Skill — restructure Phase 5 (gitignored, no commit)

**Files:**
- Modify: `.claude/skills/carousel/SKILL.md` (gitignored)

This task moves the Phase 5 hero-generation step *up* so the JPG is on disk before the HTML render step copies it into the post directory. Currently:

```
5.1 Generate HTML
5.2 Serve Locally
5.3 Figma Capture
5.4 Generate slide-1 hero image     ← runs AFTER render (won't work for v2)
5.5 Report & Cleanup
```

After this task:

```
5.0 Generate slide-1 hero image     ← runs FIRST so the file exists
5.1 Generate HTML
5.2 Serve Locally
5.3 Figma Capture
5.4 Report & Cleanup                ← reverts to original numbering
```

- [ ] **Step 1: Verify the file is gitignored before editing**

```bash
git status --short .claude/skills/carousel/SKILL.md
```
Expected: empty output (file is ignored). If anything prints, stop and check `.gitignore` — do NOT proceed.

- [ ] **Step 2: Read the current Phase 5 sub-section headings**

```bash
grep -n "^### 5\." .claude/skills/carousel/SKILL.md
```
Expected (current state):
```
293:### 5.1 Generate HTML
326:### 5.1.1 Verification
336:### 5.2 Serve Locally
346:### 5.3 Figma Capture
358:### 5.4 Generate slide-1 hero image
377:### 5.5 Report & Cleanup
```

- [ ] **Step 3: Cut the existing `5.4 Generate slide-1 hero image` block**

Open `.claude/skills/carousel/SKILL.md` and locate the heading `### 5.4 Generate slide-1 hero image` (around line 358). Cut the entire block — heading + body — through to the line immediately before `### 5.5 Report & Cleanup`. The block looks like:

```markdown
### 5.4 Generate slide-1 hero image

After `slides.html` is rendered and approved, kick off the carousel-hero Recraft call. This runs non-blocking — Recraft/OpenAI failures do NOT block publish.

```bash
node scripts/generate-og-cards.mjs --slug {date}_{slug} --surface carousel-hero --non-blocking
```

On success: writes `image/social/carousel/{date}_{slug}.jpg` (1080×1350 JPEG, ~$0.04 / call).
On failure: logs to stderr, exits 0 (because of `--non-blocking`), publish flow continues.

The operator can retry the failed slug later with:

```bash
node scripts/generate-og-cards.mjs --slug {date}_{slug} --surface carousel-hero --force
```

The JPG is currently a standalone deliverable — Surface D v2 will wire it into `_layouts/*.html` as a CSS background under the slide-1 typography.
```

- [ ] **Step 4: Paste the cut block as new `5.0` at the start of Phase 5**

Locate the line `## Phase 5 — Render & Export` and find the next heading `### 5.1 Generate HTML`. Insert the cut block *immediately before* `### 5.1 Generate HTML`, with the heading changed from `5.4` to `5.0` and the body updated to reflect its new position. The full inserted block:

```markdown
### 5.0 Generate slide-1 hero image

Run BEFORE the HTML render so the JPG exists on disk when transform 5.1.i copies it into the post directory. This Recraft call is non-blocking — failures do NOT block publish.

```bash
node scripts/generate-og-cards.mjs --slug {date}_{slug} --surface carousel-hero --non-blocking
```

On success: writes `image/social/carousel/{date}_{slug}.jpg` (1080×1350 JPEG, ~$0.04 / call). Transform 5.1.i will then copy this file to `content/social/posts/{date}_{slug}/hero.jpg`.
On failure: logs to stderr, exits 0 (because of `--non-blocking`). Transform 5.1.i sees no file and gracefully skips — slide-1 falls back to today's dark `var(--bg)` + grid lines.

The operator can retry later with:

```bash
node scripts/generate-og-cards.mjs --slug {date}_{slug} --surface carousel-hero --force
```

After a successful retry, re-render slides.html (re-execute Phase 5.1) so transform 5.1.i picks up the freshly generated JPG.

```

- [ ] **Step 5: Rename `### 5.5 Report & Cleanup` back to `### 5.4 Report & Cleanup`**

Find the line `### 5.5 Report & Cleanup` and change it to `### 5.4 Report & Cleanup`. Leave the body content untouched.

- [ ] **Step 6: Verify the new section ordering**

```bash
grep -n "^### 5\." .claude/skills/carousel/SKILL.md
```
Expected:
```
{line}:### 5.0 Generate slide-1 hero image
{line}:### 5.1 Generate HTML
{line}:### 5.1.1 Verification
{line}:### 5.2 Serve Locally
{line}:### 5.3 Figma Capture
{line}:### 5.4 Report & Cleanup
```

(Exact line numbers will differ; the ordering is what matters.) `5.5` should be gone, `5.0` should be present.

- [ ] **Step 7: Confirm no commit happens**

```bash
git status --short .claude/skills/carousel/SKILL.md
```
Expected: empty (gitignored). This task produces no git commit.

---

## Task 3: Skill — add transform 5.1.i + update verification (gitignored)

**Files:**
- Modify: `.claude/skills/carousel/SKILL.md` (gitignored)

Adds the new render-step sub-transform that wires the hero into slide-1, plus extends the failure-signature grep list in `5.1.1`.

- [ ] **Step 1: Locate the existing transform list in `5.1 Generate HTML`**

The transforms are sub-steps `a` through `h` (around lines 297–322). The current last transform is:

```markdown
   **h. Ensure Figma capture script is present:** `<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>` should remain in `<head>`. This is the only script that should remain.
```

- [ ] **Step 2: Append transform `i` after transform `h`**

Insert immediately after the `**h. Ensure Figma capture script ...**` line, before the `**Why this matters:**` paragraph. The new transform:

```markdown

   **i. Wire slide-1 hero image (Surface D v2).** If `image/social/carousel/{date}_{slug}.jpg` exists on disk:
   1. Copy it to `content/social/posts/{date}_{slug}/hero.jpg` (sibling of `slides.html`):
      ```bash
      cp image/social/carousel/{date}_{slug}.jpg content/social/posts/{date}_{slug}/hero.jpg
      ```
   2. Add the `data-has-hero` attribute to the slide-1 element in `slides.html`:
      ```bash
      sed -i '' 's/\(data-slide="1"\)/\1 data-has-hero/' content/social/posts/{date}_{slug}/slides.html
      ```
      (macOS BSD sed uses `-i ''`; Linux GNU sed uses `-i` without the empty arg.)

   If the JPG is missing (Recraft failed in 5.0), skip BOTH steps. The CSS rule in `_shared.css` is gated on `[data-has-hero]`, so without the attribute the gradient overlay also doesn't apply — slide-1 falls back to today's dark `var(--bg)` + grid lines render. Graceful fallback.
```

- [ ] **Step 3: Extend the `5.1.1 Verification` failure-signature list**

Locate the section `### 5.1.1 Verification` (around line 326) and the list of failure signatures. Currently:

```markdown
Before moving to 5.2, grep the generated `slides.html` for failure signatures:
- ❌ `iconify-icon` → transform (c) was skipped
- ❌ `href="#wmv-logo"` → transform (b) was skipped
- ❌ `<symbol id="wmv-logo"` → transform (b) was skipped
- ❌ `iconify-icon.min.js` → transform (d) was skipped

If any of these appear, the capture WILL fail silently. Redo the transform.
```

Append two new failure signatures at the end of the list (before the closing paragraph):

```markdown
- ❌ `data-has-hero` present in `slides.html` BUT `hero.jpg` missing from the post dir → transform (i) injected the attribute but skipped/failed the copy. Either remove the attribute or restore the file (e.g. re-run Phase 5.0 + transform i).
- ❌ `hero.jpg` present in the post dir BUT `data-has-hero` missing from slide-1 → transform (i) copied the file but skipped/failed the sed. Re-run the sed command from transform (i).
```

- [ ] **Step 4: Verify both edits landed**

```bash
grep -n "i. Wire slide-1 hero image" .claude/skills/carousel/SKILL.md
grep -n "data-has-hero" .claude/skills/carousel/SKILL.md
```
Expected: each grep returns at least 2 lines (the transform body, plus the verification entries, plus references inside the inserted text).

- [ ] **Step 5: Confirm no commit happens**

```bash
git status --short .claude/skills/carousel/SKILL.md
```
Expected: empty (gitignored).

---

## Task 4: Manual smoke test — apply v2 to `2026-04-23_1k-nutrition-planner`

**Files:**
- Read: `image/social/carousel/2026-04-23_1k-nutrition-planner.jpg` (already on disk from v1 Task 6)
- Read/modify: `content/social/posts/2026-04-23_1k-nutrition-planner/slides.html`
- Create: `content/social/posts/2026-04-23_1k-nutrition-planner/hero.jpg`

This task simulates exactly what transform 5.1.i would do for a future `/carousel` run, and validates the v2 pipeline end-to-end against the existing v1 test image. No new Recraft calls (~$0).

- [ ] **Step 1: Confirm the v1 hero JPG exists at the canonical path**

```bash
ls -lh image/social/carousel/2026-04-23_1k-nutrition-planner.jpg
```
Expected: shows ~386KB JPEG. If missing, stop and re-run `node scripts/generate-og-cards.mjs --slug 2026-04-23_1k-nutrition-planner --surface carousel-hero --force` first.

- [ ] **Step 2: Confirm slide-1 in the existing slides.html matches the expected markup**

```bash
grep -n 'data-slide="1"' content/social/posts/2026-04-23_1k-nutrition-planner/slides.html
```
Expected: exactly one match, on a `<div class="slide ... slide-hero" data-slide="1" ...>` line.

- [ ] **Step 3: Apply transform 5.1.i manually (copy + sed)**

```bash
SLUG=2026-04-23_1k-nutrition-planner
cp image/social/carousel/$SLUG.jpg content/social/posts/$SLUG/hero.jpg
sed -i '' 's/\(data-slide="1"\)/\1 data-has-hero/' content/social/posts/$SLUG/slides.html
```

- [ ] **Step 4: Verify both changes landed**

```bash
ls -lh content/social/posts/2026-04-23_1k-nutrition-planner/hero.jpg
grep -n 'data-has-hero' content/social/posts/2026-04-23_1k-nutrition-planner/slides.html
```
Expected: hero.jpg exists (~386KB), `data-has-hero` appears exactly once (on the slide-1 div).

- [ ] **Step 5: Serve locally + open in browser**

```bash
cd content/social/posts/2026-04-23_1k-nutrition-planner && python3 -m http.server 8888 &
sleep 2
open "http://localhost:8888/slides.html"
```

Eyeball slide-1:
- Hero JPG visible as background
- Headline (`$1K/mo`, `for trainers`, `nobody serves.`) lands solidly on the bottom-darkened band
- Eyebrow + slide counter still legible at the top
- Footer (`weekendmvp.app` + swipe arrow) still legible at the bottom
- No broken-image artifact, no double-darkened overlay

If anything looks off, iterate on the gradient tuning in Task 1 before continuing.

- [ ] **Step 6: Verify graceful fallback by temporarily removing the attribute**

```bash
sed -i '' 's/data-slide="1" data-has-hero/data-slide="1"/' content/social/posts/2026-04-23_1k-nutrition-planner/slides.html
```

Reload the browser tab. Slide-1 should now render identically to today (dark `var(--bg)` + grid lines, no gradient overlay, no hero image). This confirms the CSS rule's `[data-has-hero]` gate works.

- [ ] **Step 7: Re-apply the attribute**

```bash
sed -i '' 's/\(data-slide="1"\)/\1 data-has-hero/' content/social/posts/2026-04-23_1k-nutrition-planner/slides.html
grep -c 'data-has-hero' content/social/posts/2026-04-23_1k-nutrition-planner/slides.html
```
Expected: `1`.

- [ ] **Step 8: Stop the local server**

```bash
# Find and kill the python http.server background process
pkill -f "python3 -m http.server 8888" || true
```

- [ ] **Step 9: Decide whether to commit the re-rendered post**

If the smoke test looked right and you want this post to ship with the v2 hero, commit:

```bash
git add content/social/posts/2026-04-23_1k-nutrition-planner/hero.jpg \
        content/social/posts/2026-04-23_1k-nutrition-planner/slides.html
git commit -m "carousel-hero v2: re-render 2026-04-23_1k-nutrition-planner with hero overlay"
```

If the smoke test surfaced issues, revert the post directory and iterate:

```bash
git checkout -- content/social/posts/2026-04-23_1k-nutrition-planner/slides.html
rm content/social/posts/2026-04-23_1k-nutrition-planner/hero.jpg
```

---

## Self-Review (post-write)

**Spec coverage:**
- Spec § "CSS rule (only committed code change)" → Task 1 ✓
- Spec § "Skill changes (gitignored) — Restructure Phase 5" → Task 2 ✓
- Spec § "Skill changes (gitignored) — Add transform 5.1.i" → Task 3 ✓
- Spec § "Skill changes (gitignored) — Update the verification block (5.1.1)" → Task 3 Step 3 ✓
- Spec § "Testing strategy — CSS rule presence test" → Task 1 ✓
- Spec § "Testing strategy — Manual smoke test" → Task 4 Steps 3–5, 9 ✓
- Spec § "Testing strategy — Fallback verification" → Task 4 Steps 6–7 ✓
- Spec § "Testing strategy — Figma capture sanity check" → not included as a discrete task. Figma capture is part of the existing Phase 5.3 and exercises the same `slides.html`; running the smoke test in the browser proves the rendered output is correct, which is what Figma would capture. Operator can run a separate `/carousel` capture if they want a Figma-side verification.
- Spec § "File structure" → Tasks 1–4 cover every file listed
- Spec § "Error handling" — fallback path covered by Task 4 Step 6; other scenarios are inherent to the CSS gate + skill conditional in Task 3 (no separate task needed)

**Placeholder scan:** None — every step contains the actual file path, code, command, or expected output.

**Type/name consistency:**
- `.slide-hero[data-has-hero]` — consistent across spec, Task 1 CSS, Task 1 test, Task 3 transform, Task 4 sed, Task 4 verification grep ✓
- `hero.jpg` filename — consistent across spec, CSS `url('hero.jpg')`, sed copy target, post-dir ls verify ✓
- Phase numbering: `5.0`, `5.1`, `5.1.i`, `5.1.1`, `5.2`, `5.3`, `5.4` — consistent across Task 2 (rename) and Task 3 (anchors) ✓
- `image/social/carousel/{slug}.jpg` canonical path — consistent across spec, Task 3 transform, Task 4 cp source ✓
- `2026-04-23_1k-nutrition-planner` test slug — consistent with v1 Task 6 and Surface D v1 spec ✓
