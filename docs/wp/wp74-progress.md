# WP74 Progress - Wizard and business creation

## 2026-11-06 - Started (Phase 2)

- G1 passed (`d8055b98`); the owner said "Merged, go Phase 2".
- Branch and worktree: `claude/wp74-wizard` at `.worktrees/wp74-wizard`, from `d8055b98`.
- Runs alongside WP77 (lane limit: two WPs at once; file sets do not overlap).
- Needs from Codex: none yet.

## 2026-11-06 - S1 and S2

- What: the eight-step wizard (C-WIZARD `WIZARD_STEPS`, no SMS step, no phone field: D10) with a suggested
  default on every step, Back, Skip and Rewrite. Progress lives in `wizard_sessions`, so a reload resumes. Every
  decision writes one `founder_signals` row and mirrors a summary into `answers.signals`. The flow ends on a
  "Meet your co-founder" placeholder. No business or project is created (S4); there is no roster (WP75).
- Files:
  - `convex/workspace/wizard.ts`: `getWizardAccess` (route gate), `startOrResume`, `getSession`, `saveStep`,
    `skipStep`, `rewriteStep`, `goBack`.
  - `convex/workspace/signals.ts`: `recordFounderSignal`, `mirrorSignal` (helpers only, no public functions).
  - `lib/workspace/wizard/defaults.ts`: `wizardSeedFor` (the single seed switch point) and step helpers.
    `lib/workspace/wizard/labels.ts`: copy and bounded summaries.
  - `lib/workspace/wizard-access.ts`: the server gate. `app/start/{layout,WizardPage,error}.tsx`,
    `app/start/[ideaSlug]/page.tsx`, `app/start/own/page.tsx`.
  - `components/workspace/wizard/{WizardFlow,WizardStepPanel,WizardProgress,MeetCofounder}.tsx`.
  - `convex/_generated/api.d.ts`: two modules added by hand, matching codegen (regenerate at the next
    `convex dev`).
  - Tests: `convex/workspace/{wizard,signals}.test.ts`, `tests/platform/wp74-wizard-{ui,flow,access}.test.ts(x)`,
    `tests/security/wp74-wizard-guards.test.mjs` (new Claude file).
- Decisions:
  - Defaults come from fixtures until WP71-S5: HydroTrail by slug, a generic seed for other library ideas, and a
    light own-idea outline marked "Not yet validated" (D15). Only `wizardSeedFor` changes when `idea_crew_seeds`
    lands. Suggested answers: web, free, a waitlist goal this weekend, strategist, Wren, the name from the title.
  - Each step mutation names the step it answers. A call for any other step changes nothing (double click, stale
    tab). Signals are also deduped per (session, step, action). That uses a bounded scan of the owner's latest 200
    rows, because there is no session index.
  - Classification: equal to the default is `kept`, the founder's own words is `rewrote`, another offered choice
    is `changed`, and Skip applies the default as `skipped`. In the C-WIZARD `kept`/`edited` mirror, `changed`
    and `rewrote` become `edited`, and `skipped` becomes `kept` with a "Skipped; used the suggested …" note.
  - `rewriteStep` takes free text on idea (own idea), blueprint (rework notes), platform (custom), name and
    partner name. Commercial model, goal and partner personality have no free-text field in C-WIZARD, so their
    Rewrite button opens the choice editor (it saves through `saveStep`) and the server refuses `rewriteStep`
    there with `INVALID_STEP`.
  - Rework keeps the session on the blueprint step. Completion parses through `wizardAnswersSchema`, so it needs
    `looks_good`. An own idea starts on the blueprint step and logs `idea: rewrote` with no `before`. Back from
    the finished screen reopens the last step. A completed session without a project still counts as active, so
    starting again resumes it. Limit: 20 new sessions per owner per rolling day.
- Flag behaviour: every page calls `requireWizardAccess` (C-OPS `workspace` + cohort, signed in, known idea) before
  any JSX and answers `notFound()` otherwise. There is no `NEXT_PUBLIC_LAUNCH_WORKSPACE` helper in the repo yet
  (WP72 deferred it), so the runtime flag is the gate. Middleware does not cover `/start`, so under PPR a refusal
  can stream with status 200 (no wizard content). See Needs from Codex.
- Tests: convex-test (22 wizard, 3 signals) covers auth, flag off, cohort, owner isolation, phone fields refused,
  over-long and multi-line text, back/skip/rewrite, the double-click no-op, resume, rework, completion needing
  `looks_good` with no project, and one signal per decision. DOM tests (testing-library + vitest-axe, jsdom,
  colour-contrast off because jsdom can't paint) cover the step panel, keyboard-only choice, progress
  `aria-current`, the live-region announcement and focus move, and the Meet screen. The gate tests cover every
  404 path.
- Checks: `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing
  warnings); wizard test files 0; `npm run test:security` **1**: the Codex-owned WP68 scanner fails on
  `convex/workspace/wizard.ts` (below); everything else passes (203/204 Node tests, 121/121 Vitest).
  `npm test` **1**, because it stops at `test:security`. Every other suite run on its own exits 0 (og, links,
  redirects, auth, sitemap, convex 804, engine, editorial on re-run, after one 5 s timeout while the build ran
  alongside, home, prompts, platform 1084, live). `npm run build` 0 (`/start/[ideaSlug]` ◐, `/start/own` ƒ).
- Docs: this entry; the stories are not ticked yet (see below).
- Needs from Codex:
  1. `tests/security/wp68-workspace-boundaries.test.mjs` requires `requireBusinessAccess` or
     `requireSuperAdmin` in every public `convex/workspace` function. The wizard runs before a business exists,
     so its capability guard is `requireCurrentPlatformUser*` plus a session-ownership check. Please allow that
     guard for `convex/workspace/wizard.ts`, for example with a named pre-business allowlist. Alternatively add a
     C-AUTHZ helper such as `requireOwnedWizardSession` (or `wizard_sessions` in `OWNER_RECORD_TABLE_NAMES`)
     and accept it in the scanner.
  2. Middleware hard 404 for `/start` and `/start/*` (matcher + gate), the same as `/dashboard/b`. It can call
     `api.workspace.wizard.getWizardAccess` with `{ ideaSlug }` taken from the first segment (omit it for
     `own`).
  3. Optional: index `founder_signals.by_wizardSessionId_and_step` for exact dedupe instead of the bounded
     owner scan.
  4. Optional: `NEXT_PUBLIC_LAUNCH_WORKSPACE` in `.env.example`, so the build flag can be added to the gate.
- Not done: S3–S6. The a11y-check skill and live keyboard pass are S6, and contrast is unchecked in jsdom.
  S1/S2 are met in code but stay unticked until item 1 lands and the full gate is green.
