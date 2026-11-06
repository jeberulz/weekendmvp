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

## 2026-11-06 - S3: Option D built as an interim; Option A awaits the owner's ruling

- Why not the real draft: no C-METER attempt-key form fits a call made before the business exists.
  - `job` needs `ownerId`, `taskId` and a `crew:` job key, and `tasks.projectId` is required.
  - `chat` needs the run's `projectId`.
  - `eval` is ownerless. It skips the owner's Free $1.50 lifetime ceiling and $1.00 daily cap, its gate
    (`settingsForCall`) skips the cohort, and it is the CI graders' key. Rejected.
  - The meter itself (`convex/ai/metering.ts`) already accepts an owner with no project and any key string. Only
    the gateway's key forms and the C-METER contract list block it.
  - There is also no place to keep the draft. A replayed `reserve` returns `duplicate_attempt` with no output,
    `documents.projectId` is required, and `wizard_sessions` has no blueprint field.
  - The orchestrator sent Option A to the owner and asked for D now.
- Built (Option D, no model call, no new public function, no prompt file):
  - `lib/workspace/wizard/light-blueprint.ts` (pure):
    - `lightBlueprintSchema`: the C-ART own-idea `Blueprint` picked to pitch, one user, one loop, features and
      scope cuts. Strict, so a `market` block or an `ideaSlug` is refused.
    - `hasMarketClaim` / `stripMarketClaims`. Claims are money, percentages, market-size words, audience counts of
      100 or more, per-period prices, market or keyword metrics, and TAM/SAM/SOM/CAGR/CPC (case-sensitive).
      Stripping drops the clause that carries the claim and keeps the founder's other words. Small counts, B2B,
      Web3 and "5k" runs are not claims.
    - `acceptLightBlueprint(unknown)`: validate, strip every field (list items with a claim are dropped), then
      re-validate. It rejects, never repairs, a candidate that is invalid (`invalid`) or empty once the claims are
      gone (`only_market_claims`). The future gateway output goes through it unchanged.
    - `ownIdeaBlueprintPreview(text, draft?)`: with no draft, the fixture outline (the founder's words, cut to the
      160-character pitch limit, plus the generic weekend outline). With a rejected draft or fixture, the honest
      fallback outline (`own_fallback`), so the founder can always continue.
  - `wizardSeedFor` builds the own-idea branch from it, and takes an optional `ownIdeaDraft` (undefined for now).
    The preview gains `origin` (`library` / `own_fixture` / `own_drafted` / `own_fallback`) and `removedClaims`.
    `getSession`'s return validator carries both. The founder's stored idea text is never altered. Library ideas
    keep their seeded path.
  - The seam: one comment in `convex/workspace/wizard.ts` `seedFor`, where the session's stored gateway draft
    will be passed as `ownIdeaDraft` once A lands.
  - UI (`WizardStepPanel`): the visible "Not yet validated" label plus a plain-words line on what it means. A note
    names the market figures that were left out, or says the outline is a plain fallback. "Looks good" is
    `aria-describedby` the note, so screen readers hear the label before accepting.
  - Tests:
    - `tests/platform/wp74-light-blueprint.test.ts` (36): claims flagged and not flagged, stripping, accept and
      reject, the fixture, fallback and drafted paths, instruction-like text kept as data, the library path.
    - `tests/platform/wp74-light-blueprint-ui.test.tsx` (5, axe): the label, the describedby link, the
      left-out-figures note, the fallback note, markup rendered as text, no label on library ideas.
    - `convex/workspace/wizard.test.ts` +5: the stripped preview with stored text unchanged and no `ai_usage` rows
      (a reload makes no call), the fallback with continue working, owner isolation, flag off, the library path.
- Option A, a proposal awaiting the owner's ruling:
  - Add a fourth C-METER attempt-key form, `wizard:{wizardSessionId}:{step}:{attempt}` (`wizardAttemptKey`). It
    needs an owner and forbids a project, task or credit debit.
  - It changes the C-METER contract (`lib/workspace/contracts/metering.ts`) plus `attemptKeyFormValidator` and
    `keyFormMismatch` in `convex/ai/gatewayActions.ts`.
  - The wizard action checks session ownership before calling, because the meter cannot see the session.
  - One drafting call per session, idempotent through the stored draft and its `drafting` claim. The output goes
    through `acceptLightBlueprint` at the seam above.
  - The prompt would be `ownIdeaBlueprint.v1.ts`, because `04` gives WP75 `convex/ai/prompts/blueprint*`.
  - **Open question for the owner:** does the light blueprint count inside the Free $1.50 lifetime ceiling? D15
    puts the future Validation Report outside it but says nothing about the light blueprint.
  - Rejected alternatives: create the business before the blueprint step (B: reorders C-WIZARD and spends the one
    free business on a draft the founder may discard), and `eval` (C: see above).
- Needs from Codex, **only if A is approved**:
  - (d) A draft slot on `wizard_sessions`, e.g. `blueprintDraft: v.optional(v.object({ status: "drafting" |
    "ready" | "failed", promptRef, attemptKey, usageId?, blueprint?: <light blueprint validator>, failedReason?,
    updatedAt }))`.
  - (e) `PRE_BUSINESS_CONTROLS` entries in `tests/security/wp68-workspace-boundaries.test.mjs` for the new public
    functions (`requestOwnIdeaBlueprint`, `getOwnIdeaBlueprint`), guarded by `requireOwnedWizardSession`.
  - Items (a)–(c) from the S1/S2 entry still stand.
- S3 stays unticked: the gateway draft is not built.
- Checks:
  - `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing warnings).
  - The seven wizard and S3 test files 0 (100 tests). `npm run check:prompt-versions` 0 (no prompt changed).
  - `npm run test:security` 1, only the known WP68 scanner failure (`not ok 200`,
    `convex/workspace/wizard.ts:getWizardAccess missing capability guard`). 204 pass, 1 skipped. The Vitest half,
    run on its own, passes 121/121.
  - Every other suite exits 0: og, links, redirects, auth, sitemap, convex (814), engine, home, prompts, platform
    (1128), live. Editorial exited 0 on a re-run (295 tests). Its first run hit hook timeouts while
    `npm run build` ran alongside, as in S1.
  - `npm run build` 0.
- Docs: this entry.

## 2026-11-06 - S1–S3 review fixes, round 3 (after 05d8f2e5 and bcea91a0)

- Market-claim stripper (`lib/workspace/wizard/light-blueprint.ts`). The rule is in the doc comment above
  `MARKET_CLAIM_PATTERNS`.
  - Now caught:
    - bare magnitudes after a number ("2.3B market", "reach 1M");
    - revenue metrics with a number ("5k MRR", "ARR of 2m");
    - ratios ("1 in 5 people", "4 out of 5");
    - currency codes before a number ("USD 49");
    - currency symbols after a number ("49€", "49 €/month").
  - The closed audience list is gone. A count of 100 or more, or any k-count, followed by any noun is now a
    traction claim ("50000 dentists", "10k dentists", "500 waitlist sign ups").
  - Kept:
    - counts under 100 ("3 steps", "2 founders", "1 app", "Top 10 tips");
    - glued numbers ("B2B", "B2C", "v2"), "Web 3", "step 2", "24/7";
    - years, and time or measure units ("100 days");
    - a k-distance before a function word ("Couch to 5k for beginners").
  - Known trade-off: "100 m sprint" reads as a magnitude and is stripped.
  - Every example is a `test.each` case.
- Strip before truncating: the fixture pitch strips the whole idea, then cuts to 160. Before this, a 240-character
  idea was cut first, so "10,000 users" became "10,0…" and got through. Tested. The removed count now includes
  those clauses.
- Bounded resume lookup (`convex/workspace/wizard.ts`):
  - `activeSessionsFor` reads the owner's newest `RESUME_WINDOW` (100) sessions with no project, using the
    `by_ownerId_and_projectId` range in descending creation order, then matches the idea in code.
  - A match older than the window is not found, so the founder gets a new session. Tested.
  - The wrong "exactly the candidates" comment is corrected.
- One active session per (owner, idea): when the idea step moves a session onto own-idea text that another active
  session holds, that other session is abandoned in the same mutation. Tested.
- Decision: the idea title shows the founder's own text, unstripped. D15 governs what we assert, and the founder's
  own words are theirs. Only the drafted pitch is stripped.
- Deferred: the signal repeat check (`recordFounderSignal`) only looks at the owner's latest 200 signals until the
  `founder_signals` index (item c) lands.
- Needs from Codex: (a)–(e) from the entries above still stand. New:
  - (f) An index that makes the resume lookup exact. Either `wizard_sessions.by_ownerId_and_ideaSlug` plus
    `by_ownerId_and_ownIdeaText`, or a normalised `ideaKey` field (`library:<slug>` / `own:<text>`) with
    `by_ownerId_and_ideaKey`. With it, `activeSessionsFor` becomes a single index range and `RESUME_WINDOW` goes.
- Checks:
  - `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors, 37 existing warnings).
  - The seven WP74 test files 0 (125 tests).
  - `npm run test:security` 1, only the known WP68 scanner failure (`not ok 200`, `getWizardAccess missing
    capability guard`). 204 pass, 1 skipped. The Vitest half, run on its own, passes 121/121.
  - Every other suite exits 0: og, links, redirects, auth, sitemap, convex (816), home, prompts, platform (1151),
    live.
  - The first pass ran at load average 30. Editorial (295) and engine (1076) hit 5–10 s timeouts in files this
    change does not touch, then exited 0 when re-run alone.
  - `npm run build` 0.
- Docs: this entry.
