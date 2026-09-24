# WP43 Progress - Homepage motion

Append-only progress log. Do not rely on chat history for project state.

## 2026-09-24 - Setup

- Branch/worktree: `claude/compassionate-fermi-eau6rv` (no worktree), restarted from `main` at `05c9ce3` after #76 (WP42) merged
- Assignment: build the owner-approved GSAP motion plan for the homepage, in a new PR
- File boundaries: `components/home/**`, `lib/home/count.ts`, `tests/home/count.test.ts`, `app/(marketing)/page.tsx` (mount only), `app/globals.css`, `package.json` / `package-lock.json` (`gsap`), WP43 docs, `docs/wp/RULINGS.md`, `CLAUDE.md`
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, WCAG 2.1 AA review
- Initial risks:
  - Scroll-in motion can hide content from crawlers, keyboard users or visitors without JavaScript
  - Line splitting can re-wrap headings and shift the layout
  - A new dependency on the main thread of slow phones

## 2026-09-24 - S1 to S3 implemented

- Dependency: `gsap@3.15.0` (exact). ScrollTrigger and SplitText ship in the package; GreenSock's Standard "no charge" license, not MIT
- Hero (S1): CSS keyframes in `app/globals.css` (`.home-intro`, `.home-word`, `.home-paste`, `.home-press`), per-element delays through `--d`. The headline words are `aria-hidden` and the `h1` carries the sentence as `aria-label`
- Engine (S2): `HomeMotion` imports `motion/scenes` in an idle callback after `document.fonts.ready`, and only when motion is allowed. `scenes.ts` reads `data-scene` / `data-m` markers. Beats are queued and armed in ~10ms idle slices inside the `gsap.matchMedia` context, so crossing the `lg` breakpoint reverts and re-arms them cleanly
- Sections (S3): markers added to all nine sections. The index hover art now eases between rows with a CSS `translate` transition
- Found while testing and fixed:
  - SplitText made two headings one line taller (CLS 0.05): shrink-to-fit headings are exactly as wide as their text, so any rounding wraps the last word, and a flex item shrinks to its widest line. The heading is pinned to its width rounded up while split
  - SplitText breaks at every `<br>`, including one hidden on desktop in 06. Replaced by a `max-lg:block` span, and "Not a vibe." now stays whole (it also wrapped badly at 1024–1280px before this package)
  - The 226 count re-laid out the flex row beside a split heading (CLS 0.035). Counters now count in an `aria-hidden` overlay over the transparent real text
  - Tall letters peeked through the line masks at `yPercent: 110`; lines start at 130%
  - Arming everything in one task took 753ms on a 4x-throttled CPU (hundreds of per-cell tweens). Hour cells now fill with one stepped clip per row, and beats arm in idle slices

## 2026-09-24 - Verification

- `npm run typecheck` pass
- `npm run lint` 0 errors; the 35 warnings are all in files this package does not touch
- `npm test` pass, including `test:home` (30 tests; 11 new for the counter helper)
- `npm run build` pass; `/` stays static with `Revalidate 1h`, `Expire 1d`. The Turbopack tracing warnings are the existing ones in `lib/mdx.tsx` and `lib/sitemap-data.ts`
- Production build, Playwright (Chromium):
  - Scrolling the whole page: CLS 0 at 1440px and 390px; no console errors; nothing left below full opacity; no split lines or `aria-label`s left behind; every counter ends on its rendered text
  - Line breaks of the 9 split headings match the plain text at 360, 390, 768, 1024, 1100, 1280, 1440 and 1920px
  - Reduced motion: no GSAP request, no hero animation, nothing hidden
  - JavaScript off: every element visible, `h1` text intact
  - Focusing the Starter Kit email field before scrolling reveals that section at once; a `beforeprint` event reveals everything
  - Resizing across `lg` before scrolling re-arms with no errors and nothing stuck
  - GSAP chunk: 48.6 KB gzipped, requested after `load`; initial JavaScript unchanged
  - LCP median of 5 loads, reduced vs full motion: 216 vs 212ms (1440px), 176 vs 180ms (390px); with 4x CPU throttling 328 vs 340ms and 388 vs 332ms
  - Longest main-thread task after `load`: none at 1x; 100–108ms at 4x CPU (was 753ms before arming in slices)
- WCAG 2.1 AA: axe-core 4.12 (`wcag2a/aa`, `wcag21a/aa`) on `main` after the motion settles, 1440px and 390px: 0 violations. Motion is skipped entirely under `prefers-reduced-motion`; nothing autoplays for more than five seconds (the art strip moves only with the scroll)

## Docs

- Updated: `docs/wp/RULINGS.md` (one WP43 row), `CLAUDE.md` (key paths), WP43 stories/progress

## 2026-09-24 - Review fix: focus and revert safety (#77, Codex P2 x2)

- Finding 1: a beat left the `waiting` map when it started playing, so focus landing in a section mid-animation could not finish it. Verified: focusing the Starter Kit email 120ms into its beat left the stub at opacity 0. Fix: a beat stays finishable until its timeline completes
- Finding 2: crossing `lg` mid-count reverted the timeline without the counter cleanup. Verified: the 226 read "2260" (real text transparent, overlay stuck at 0). Same class, found while fixing: split headings kept their pinned width after a revert (up to 1202px on an 800px viewport). Fix: every DOM change GSAP does not track registers an undo on its timeline; the beat returns them as its context cleanup
- Re-verified on a production build: both repros fixed; no pinned widths, overlays or transparent counters remain after scrolling, with or without a 1440→800 resize; CLS 0, axe 0 violations, line breaks match at 8 widths, `test:home` 30/30
