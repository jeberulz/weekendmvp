# WP99 Stories - Own-idea example chips from the library

Branch: `claude/step1-idea-suggestions`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: `npm run typecheck` green; the Step 1 wizard suites and the new WP99 tests green; a11y-check passed
on the changed Step 1 screen; recommendation written in `docs/design/wizard-step1-own-idea-suggestions.md`.

## Why

The "Try one of these" chips on `/start/own` were three hard-coded strings. The owner wants them driven by real data
or an LLM. The recommendation doc weighs a per-view LLM call, an LLM pool in Convex and the ideas library, and picks the
library: real ideas, no spend, no schema.

## Rules this package holds to

- **No paid call per view, no new prompt, no schema.** The chips come from the public library, the same membership rule
  as `/ideas` (`mergeHomeIdeas` + `liveIdeas`).
- **Never slow the field.** The pool is cached server-side and the draw happens during the request render. There is no
  client fetch and no layout shift.
- **At most 60 characters per chip**, and no idea shown twice.
- **A tap still fills and focuses the field** (`applyExample`). Continue still starts an own-idea session from whatever
  is in the field.
- **A static fallback only as a last resort**, used when the pool can't fill three.

## Stories

- [x] `WP99-S1` - Recommendation doc
  - Scope: `docs/design/wizard-step1-own-idea-suggestions.md`.
  - Acceptance criteria: options (a), (b) and (c) weighed on cost, latency, quality and build cost; one recommended.

- [x] `WP99-S2` - Example source with fallback
  - Scope: `lib/workspace/wizard/own-idea-examples.ts` (pure pool + draw + fallback),
    `lib/workspace/wizard/own-idea-examples.server.ts` (cached library read), `app/start/own/page.tsx`.
  - Acceptance criteria:
    - The pool is live library ideas with a buildable slug and a short title of 60 characters or fewer, deduplicated
      by slug and by text.
    - Each request draws three distinct chips from the pool. Short pools are padded from the static fallback, never
      repeating a line.
    - A failed editorial read falls back to the manifest-only pool; a failure to build any pool falls back to the static
      list. The page always renders.
  - Verification: `npx vitest run tests/platform/wp99-own-idea-examples.test.ts`.

- [x] `WP99-S3` - Chips and the researched-version line on Step 1
  - Scope: `components/workspace/wizard/OwnIdeaExamples.tsx` (chips + researched-version line, data passed in, so
    every Step 1 own-idea surface can render it), used by `OwnIdeaStart` in `WizardFlow.tsx`; `ownIdeaExamples` prop on
    `WizardFlow`.
  - Acceptance criteria:
    - The chips render the drawn examples. A tap fills the field and focuses it.
    - While the field holds a library chip's exact text, a polite status line offers "Build the researched version" →
      `/start/{slug}`. Editing the text removes it. Fallback chips never show it.
    - Without examples passed in (tests, other callers) the static fallback shows.
  - Verification: `npx vitest run tests/platform/wp74-wizard-flow.test.tsx`; a11y-check.

## Out Of Scope

- An LLM-generated pool (option (b)). The prop seam allows it later.
- Personalised chips.
- Any change to the library-variant Step 1 or to what Continue sends.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
