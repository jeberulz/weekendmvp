# WP58 Stories - Weekly rotating homepage hero

Branch: `codex/wp58-weekly-hero`
Lane: Work Package (shared rotation logic, homepage behavior)
Registry: `docs/PROJECT_STRATEGY.md`
Product decisions: `docs/wp/RULINGS.md` (2026-10-07 WP58 row)

Definition of done: the homepage hero build window shows a different idea each week (Monday 00:00 UTC), drawn from ideas whose first prompt is long enough to paste in line by line. The hero never shows the same idea as "Idea of the week" (03) or "Inside every idea" (06), never repeats back to back, and never depends on OG art. The section 03 and 06 picks are unchanged. Focused tests, typecheck, lint, full tests and production build pass. No production deploy is part of this package.

## Stories

- [x] `WP58-S1` - Record the ruling and freeze the rule
  - Scope: `docs/wp/RULINGS.md`, `docs/PROJECT_STRATEGY.md`, these stories and progress.
  - Acceptance criteria:
    - The owner ruling "the hero rotates weekly" is recorded with the eligibility rule and the reason for it.
    - The registry names the branch and status.
  - Verification:
    - `git diff --check`

- [x] `WP58-S2` - Hero eligibility that matches what the window shows
  - Scope: `lib/home/library.ts`, `tests/home/library.test.ts`.
  - Acceptance criteria:
    - `isHeroReady` requires 3 or more prompts with real titles, a first prompt of `HERO_MIN_LINES` (8) or more lines, 3 or more citations and a build time above zero.
    - It ignores art, problem, How it works, market, competitors, tiers and stack, because the window shows none of them. An idea with a failed OG card can be the hero.
  - Verification:
    - `npx vitest run tests/home/library.test.ts`

- [x] `WP58-S3` - Weekly hero draw, and remove the pinned hero
  - Scope: `lib/home/rotation.ts`, `lib/home/data.ts`.
  - Acceptance criteria:
    - `pickHero` draws from its own pool with its own hash salt, using the same Monday snapshot as the other picks.
    - It skips this week's section 03 and 06 winners and last week's hero, replayed over the same four weeks.
    - `HERO_SLUG` and the silent fall back to the spotlight are gone. An empty hero pool gives a null hero, and the hero window hides.
    - `pickWeekly` returns exactly the picks it returned before this package.
  - Verification:
    - `npx vitest run tests/home/rotation.test.ts`
    - A comparison of old and new `pickWeekly` over 104 weeks of the real library shows no change.

- [x] `WP58-S4` - Tests and a guard on the shipped library
  - Scope: `tests/home/rotation.test.ts`, `tests/home/library.test.ts`, `tests/home/hero-pool.test.ts`.
  - Acceptance criteria:
    - The hero holds all week and changes on Monday. It never doubles as section 03 or 06 and never repeats back to back across 80 synthetic weeks.
    - A midweek publish or retirement of a non-winner keeps the hero.
    - A golden test pins the section 03 and 06 picks recorded from the pre-WP58 code.
    - A guard reads the real manifest and fails if the hero pool drops below 26 ideas or a year of weeks breaks the rules above.
    - Breaking the skip rule or the hash salt on purpose fails a test.
  - Verification:
    - `npm run test:home`

- [x] `WP58-S5` - Docs, checks and a render check
  - Scope: `CLAUDE.md` (`lib/home/*` line), `docs/wp/wp58-progress.md`.
  - Acceptance criteria:
    - `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass.
    - The longest titles in the hero pool are checked in the window at 390px, if a local render is available. (Not available in the agent checkout. Checked from data instead, see the progress log.)
  - Verification:
    - The commands above, with results recorded in `docs/wp/wp58-progress.md`.

## Out Of Scope

- Making the hero tabs change the prompt. Tabs still show the same prompt for every tool. Planned as its own small package.
- A prompt-quality rule in `ideas/SECTIONS.md` and the auditor. The 8-line rule proves structure, not quality.
- A link from the hero window to the idea page. WP57 gates idea pages behind an account, so where that click goes is an owner decision.
- Regenerating the five failed OG cards. They no longer block the hero. They still keep those ideas out of sections 03 and 06.
- Rewriting MeetingMood AI's prompts.

## Notes

- 102 of 225 ideas have a single-line first prompt and can never be the hero.
- The hero pool and the section 03 and 06 pool overlap but differ. 110 ideas can be the hero and 166 can be the idea of the week.
