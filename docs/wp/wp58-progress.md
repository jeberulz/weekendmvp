# WP58 Progress - Weekly rotating homepage hero

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-07 - Setup

- Branch/worktree: `codex/wp58-weekly-hero`, cut from `main` at `4b442e8`. No worktree.
- Assignment: single agent, mid tier. Lane: Work Package (shared rotation logic, homepage behavior).
- File boundaries: `lib/home/{library,rotation,data}.ts`, `tests/home/*`, docs. No UI component changes.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Initial risks: titles vary weekly. The 8-line rule proves structure, not quality.

Why this package exists: the homepage showed MeetingMood AI in sections 01, 03 and 05. The hero was pinned to `freelance-scope-creep-detector` (`HERO_SLUG`). The pin required `og.status === "ready"` through `isFeatureReady`, and that idea's card had `status: "failed"`. The code then fell back to the weekly spotlight without a sound. The hero window never shows art, so the requirement blocked it for no reason.

## 2026-10-07 - WP58-S1 to S4

- Actions taken:
  - Added `isHeroReady` and `HERO_MIN_LINES` to `lib/home/library.ts`.
  - Added `pickHero` to `lib/home/rotation.ts`. A shared `replayedPicks` helper gives each replayed week's section 03 and 06 picks. `ranked` takes a hash salt. The default salt is empty, so the existing picks hash exactly as before.
  - Removed `HERO_SLUG` and the fall back from `lib/home/data.ts`. The hero pool is built from `isHeroReady`.
  - Added hero tests to `tests/home/rotation.test.ts` and `tests/home/library.test.ts`, and a new `tests/home/hero-pool.test.ts` that reads the real manifest.
  - Recorded the ruling in `docs/wp/RULINGS.md`, the registry row in `docs/PROJECT_STRATEGY.md`, and the `lib/home/*` note in `CLAUDE.md`.
- Decisions made:
  - The hero draws from its own pool with its own salt (`hero:`). It does not take a third pick from the section 03 and 06 ranking, so those picks cannot move.
  - The minimum is 8 lines, tunable through `HERO_MIN_LINES`. Of 225 live ideas, 110 pass. 102 have a single-line first prompt.
  - When every hero candidate is taken, the hero may repeat a winner rather than hide. Only a one-idea pool reaches this.
  - Generic prompt titles ("Prompt 1") disqualify a hero. They are the extractor's fall back for a block with no title.
- Checks run:
  - `npx vitest run tests/home`: 9 files, 58 tests, pass.
  - `npm run typecheck`: pass.
  - `eslint lib/home tests/home` and full `npm run lint`: pass.
  - Mutation checks: ignoring the skip rule fails the back-to-back test, and changing the hash salt fails the golden test. Both were restored.
  - Old versus new `pickWeekly` over 104 weeks of the real library: 0 changes to sections 03 and 06. The hero equalled a section 03 or 06 pick in 0 weeks and repeated back to back in 0 weeks.
- Result: for the week of Oct 5 to 11 the hero is `adventure-date-night-app` (9-line first prompt). Idea of the week stays `meeting-mood-ai` and Inside every idea stays `website-accessibility-ada-scanner`.
- Gotchas:
  - The hero pool and the section 03 and 06 pool differ. A hero can lack art, and a feature-ready idea can have a one-line prompt.
  - Removing last week's replayed hero from the pool can shift this week's hero in rare cases, about 1 in the pool size. Section 03 and 06 have the same limit and the rotation header documents it.
  - The longest title in the hero pool is 71 characters. That is the old pinned hero's title, so rotation adds no new worst case on mobile. No local render was possible, because the homepage needs a Convex backend and this checkout has no `.env`.
- Next: record the full `npm test` and `npm run build` results.

## 2026-10-07 - WP58-S5

- Checks run on the pushed commit `9f71b44` (before this log entry):
  - `npm run lint`: exit 0.
  - `npm test`: exit 0. The vitest groups reported no failures, including `tests/home` (9 files, 58 tests).
  - `npm run build`: exit 0.
  - `npm run typecheck`: exit 0 (run earlier on the same code).
- Not done: the 390px render check. The homepage needs a Convex backend and this checkout has no `.env`. Title length was checked from data instead (longest hero-pool title is 71 characters, the old pinned hero's title).
- Result: all required checks pass.
- Next: owner review. No PR is open.
