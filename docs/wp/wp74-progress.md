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
- Needs from Codex: superseded by the review-fixes entry below.
- Not done: S3–S6. The a11y-check skill and live keyboard pass are S6, and contrast is unchecked in jsdom.
  S1/S2 are met in code but stay unticked until item 1 lands and the full gate is green.

## 2026-11-06 - S1/S2 review fixes (after 82036f77)

- C-LIMITS: the local 20-a-day counter is gone. `startOrResume` calls `checkLimit(ctx, "wizardStart", user._id)`
  (3 a day) only on the insert path, after the resume lookup. A resume costs nothing. A refusal throws before the
  insert in the same transaction. `checkLimit` also needs the `ai` feature, which is kept because the blueprint
  and roster spend AI right after start. With AI off a new start is refused (`AI_DISABLED`) but a resume still
  works.
- Resume is exact at any number of sessions. The lookup reads the owner's sessions with no `projectId`
  (`by_ownerId_and_projectId`, `projectId` unset) and matches the idea exactly, instead of scanning the latest 50.
- Engine drafts: `libraryIdea` returns null for `isEngineDraftSlug` (re-exported in `catalogPolicy.ts`). Neither
  the route gate nor `startOrResume` accepts a draft, and neither reveals its title.
- Signals: a signal is skipped only when it repeats the latest one for the same (session, step), with the same
  action and the same `after`. Kept → changed → rewrote → kept now records four rows. Double clicks were already
  no-ops through the step-key check.
- UI: a library session rewritten as an own idea now replaces the URL with `/start/own?session=…`, so a reload
  resumes it. `MeetCofounder` shows a failed Back as `role="alert"`.
- Session guard: the five session functions now call `ownedWizardSession(ctx, sessionId)`. It does the C-AUTHZ
  user check (expiry-aware in mutations) and the ownership check, with the same signature as the planned
  `requireOwnedWizardSession`. The swap is the import plus the name at each call site.
  `tests/security/wp74-wizard-guards.test.mjs` pins the exact guard per function.
- Decision for the orchestrator to record (Rewrite on fixed-choice steps): C-WIZARD has no free-text field for
  commercial model, goal or partner personality. On those steps Rewrite opens the choice editor (saved through
  `saveStep`, logged `changed` or `kept`), and `rewriteStep` refuses them with `INVALID_STEP`. Rewrite takes the
  founder's own words on idea, blueprint (rework notes), platform (custom), name and partner name.
- Tests: wizard 27 and signals 3 (convex-test), plus the UI, flow and access files. New cases: the 4th start
  refused while resumes work, AI off, resume past 60 sessions, the engine-draft refusal, the four-decision
  sequence, the own-idea URL move, and the Meet alert.
- Needs from Codex:
  - (a) `requireOwnedWizardSession(ctx, sessionId)` in `convex/platform/authz.ts`. Plus an exact
    `PRE_BUSINESS_CONTROLS` allowlist in `tests/security/wp68-workspace-boundaries.test.mjs`:
    `getWizardAccess` and `startOrResume` require `requireCurrentPlatformUser*`; `getSession`, `saveStep`,
    `skipStep`, `rewriteStep` and `goBack` require `requireOwnedWizardSession`; all still require
    `assertFeatureEnabled`.
  - (b) A middleware hard 404 for `/start` and `/start/*`.
  - (c) Optional: index `founder_signals.by_wizardSessionId_and_step`.
- Checks: typecheck 0; `npx tsc --noEmit -p convex` 0; lint 0 (0 errors, 37 existing warnings); the five wizard
  test files 0 (54 tests); `npm run test:security` 1, failing only on the known WP68 scanner test
  (`not ok 200 - workspace public Convex functions check both the feature and the capability`,
  `convex/workspace/wizard.ts:getWizardAccess missing capability guard`). The other 204 Node security tests pass
  (1 skipped, as before), and so do 121/121 Vitest security tests. Every other `npm test` suite exits 0 (og,
  links, redirects, auth, sitemap, convex 809, engine, editorial, home, prompts, platform 1087, live).
  `npm run build` 0.
