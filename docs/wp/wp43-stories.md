# WP43 Stories - Homepage motion

Branch: `claude/compassionate-fermi-eau6rv`
Lane: Work Package
Registry: Marketing homepage (`app/(marketing)/page.tsx`)
Definition of done: every homepage section plays the owner-approved motion plan (subtle, one pass, three signature moments), with no layout shift, no hidden content when JavaScript is off or motion is reduced, no long main-thread task on a slow phone, and it passes `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` plus a WCAG 2.1 AA review.

Design source: the section-by-section motion plan the owner approved on 2026-09-24 ("build the full GSAP plan in a new PR"). Ruling dated 2026-09-24 in `docs/wp/RULINGS.md`.

## Stories

- [x] `WP43-S1` - Hero intro on CSS
  - Scope: `components/home/sections/Hero.tsx`, `components/home/client/HeroBuildWindow.tsx`, `components/home/ui.tsx`, `app/globals.css`
  - Acceptance criteria:
    - Headline words rise in turn, "Ship it by Sunday." last; copy, buttons, build window, prompt lines pasting in, stamp pressing on last (about 1.4s)
    - Plays at first paint without JavaScript; skipped under `prefers-reduced-motion`
    - The headline keeps its full sentence as the accessible name
  - Verification:
    - Frame sheets at 1440px and 390px; JavaScript-off run

- [x] `WP43-S2` - Motion engine
  - Scope: `components/home/motion/*`, `lib/home/count.ts`, `tests/home/count.test.ts`, `package.json`
  - Acceptance criteria:
    - GSAP (ScrollTrigger, SplitText) loads only after the page is idle, and never under reduced motion
    - A beat hides its elements only if they are still below the fold; each beat plays once
    - Focus entering a section, or printing, finishes its beats at once
    - Only opacity, transforms and decorative clip-paths change; counters land on the exact rendered text
    - Beats arm in idle slices so no single task blocks a slow phone
  - Verification:
    - `npm run test:home`

- [x] `WP43-S3` - Sections 02 to 10
  - Scope: `components/home/sections/*`, `components/home/client/IndexList.tsx`
  - Acceptance criteria:
    - 02 count-up, chips, rows with hour cells filling; hover art eases between rows
    - 03 art settles with the scroll (wide screens), title lines, columns, scores
    - 04 sticky notes drop out of order, pins pop, stamp presses on
    - 05 logo tiles, "Paste. Run. Ship." one beat at a time, prompt cards deal out
    - 06 tiles in reading order with counters (phones reveal each tile as it arrives)
    - 07 photo drift (wide screens), 12 hrs count, hour bars fill day by day, Monday stays empty
    - 08 ticket slides and straightens, stub joins, notches, barcode ripple
    - 09 portrait pill widens, letter settles, signature writes itself
    - 10 art strip moves with the scroll (wide screens), last call rises line by line
  - Verification:
    - Frame sheets per beat at 1440px and 390px

- [x] `WP43-S4` - Verification
  - Scope: none (checks only)
  - Acceptance criteria:
    - CLS 0 while scrolling the whole page at 1440px and 390px
    - Split headings break into the same lines as the plain text at 8 widths
    - axe-core 0 violations after the motion settles
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`

## Out Of Scope

- Motion on any page other than `/`
- A smooth-scroll library or pinned sections (ruled out in the plan)
- GSAP anywhere in the Build Platform

## Notes

- `.agentic-workflow.yml` prefers `codex/` branches; this session is pinned to `claude/compassionate-fermi-eau6rv`, restarted from `main` after #76 merged.
