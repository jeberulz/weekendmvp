# WP100 Progress - Improve your idea with AI (wizard Step 1)

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-24 - Setup

- Branch: `claude/wp100-idea-ai-improve`, cut from `origin/main` (after WP99, #308). Not stacked.
- Assignment: an "Improve with AI" control for the own-idea field on `/start/own` that encourages and never takes the
  idea over. A cheap metered model, a per-founder cap, no invented facts, full undo, and a field that works without AI.
- File boundaries (backend PR): `convex/ai/prompts/ideaImprove.v1.ts`, the prompt registry and lock,
  `convex/ai/providers/ideaImproveFixtureReply.ts`, `convex/ai/gatewayActions.ts` (the key form only),
  `convex/workspace/ideaImprove.ts`, `convex/schema/workspace.ts` (one table), `convex/platform/limits.ts`,
  `convex/account/purge.ts`, `lib/workspace/contracts/metering.ts`, `lib/workspace/wizard/idea-*.ts`, tests and docs.
- The UI PR waits for the unified Step 1 component from the `wizard-e2e-audit` session.
- Initial risks: the model rewriting the founder's idea into a different one, invented market facts (D15), spend
  with no session to key it to, and a broken field when AI is down.

## 2026-11-24 - WP100-S1..S3 (backend)

- Actions taken:
  - Design doc `docs/design/wizard-idea-ai-improve.md` and a clickable mockup (private Artifact).
  - `wizard-idea-improve@1` on the `fast` tier: effort `low`, thinking off, `maxTokens` 400, `realtime`. The idea and
    the selected words reach the model only as quoted data blocks. It answers `improved`, `already_clear` or
    `not_an_idea` with a change note and three hints (audience, core action, offer).
  - Code checks after the schema (`judgeIdeaImprovement`): one line, at most 240 characters, no extra sentence, no
    new number, market claim, proper noun or hype, and at least one of the founder's own content words kept. Selection
    mode splices the reply into the founder's text and rejects a reply that rewrites the rest. A failed check is stored
    with its reason and never shown.
  - `wizard_idea_improvements` table: one row a call (input, original, suggestion, hints, outcome, usage ids,
    charge). Purged with the account.
  - New C-METER key form `idea_improve` (`idea-improve:{rowId}:{attempt}`): owner-scoped, pre-business, and it runs
    only `wizard-idea-improve`. The wizard key needs a session, and the session does not exist before Continue.
  - C-LIMITS `ideaImprove`: 20 a founder a day (fixed window).
  - `improve` action: begin (auth, switches, limit, row) → `internal.ai.gatewayActions.runPrompt` → re-parse →
    judge → finish. Every ending is a typed result; nothing throws to the UI. `decide` records accepted, dismissed,
    retried or undone. `availability` hides the button when the workspace or AI is off.
- Decisions made: see "Owner decisions" in the design doc (cap, signal action, key form, change note).
- Checks run: `npm run typecheck`; `tests/platform/wp100-idea-improve.test.ts` (34);
  `convex/workspace/ideaImprove.test.ts` (14, real gateway body and meter with the fixture adapter, no spend);
  `tests/platform/crew-fixture-outputs.test.ts`; prompt version check. Full suite results are in the PR.
- Gotchas: this worktree has no Convex deployment, so `convex/_generated/api.d.ts` got the new module by hand in the
  codegen's own order. `npx convex codegen` on a linked checkout reproduces it.
- Next: UI PR (`IdeaImprove` control and `useIdeaImprove` hook) on the unified Step 1, then `startOrResume` storing the
  accepted improvement and the `ai_improved` signal.

## 2026-11-24 - WP100-S4 (UI)

- Branch: `claude/wp100-idea-ai-improve-ui`, on top of the backend branch. Its PR opens once #311 is merged
  (no stacked PRs).
- Actions taken:
  - `useIdeaImproveApi` (Convex binding, called only in `WizardFlow`) and `useIdeaImprove` (the state machine).
    `OwnIdeaForm` and `WizardStepPanel` take an optional `improve` prop, so they still render without a Convex client.
  - `IdeaImprove`: the Improve button (it reads "Improve selection" when words are selected; Ctrl or ⌘ + Shift + Enter),
    Stop while loading with the field read-only, the "A sharper version" card with a word diff (`<mark>`, underline and
    an sr-only "changed:"), Use this / Try again / Keep mine, the "Sharpened with AI · Undo" line, Back to my words
    after two rounds, calm notices, and one live region.
  - Typing after asking keeps the card and marks it "Based on your earlier text"; typing after Use this drops Undo.
- Checks run: `tests/platform/wp100-idea-improve-ui.test.tsx` (20, axe included); the wizard suites
  (`l1-wizard-fidelity`, `wp74-*`, `wp75-*`, `wp90-*`, `wp99*`: 312); typecheck; eslint.
- Browser: a temporary harness page in this worktree rendered the real `OwnIdeaForm` with a scripted API at desktop
  and 375 px. Checked the suggest, use, undo and shortcut paths, tab order, no horizontal scroll, 44 px targets, and
  contrast of at least 5.7:1. The harness was deleted and is not committed. The end-to-end flow against Convex has not
  been run in a browser yet, because this worktree has no deployment and pushing to the shared local backend would
  disturb other sessions.
- a11y-check: one fix, so the diff is no longer shown by colour alone (an underline on the changed words).
- Not done yet (WP100-S5): storing the accepted improvement on the session (`startOrResume` / `rewriteStep`
  `improvementId`, `ownIdeaAi`) and the `ai_improved` founder signal. Today the accepted text is saved like typed text.

## 2026-11-24 - Step 1 slot (#316)

- `wizard-e2e-audit` added `renderFieldAction?: (field: OwnIdeaFieldApi) => ReactNode` to `OwnIdeaForm` in PR #316
  (open). It renders under the field and before the chips. The API is `text`, `setText`, `fieldId`, `getSelection()`
  and `pending`.
- Plan: once #311 and #316 are on main, rebase this branch onto main. Drop the `improve` prop and the
  `useIdeaImprove` call inside `OwnIdeaForm`. `WizardFlow` and `WizardStepPanel` pass `renderFieldAction`, which
  renders `IdeaImprove` with a hook that reads and writes through `OwnIdeaFieldApi` (`getSelection()` replaces the
  DOM selection read). Then open the UI PR.
- S5: `improvementId` goes from the hook to the `onSubmit` callers (`WizardFlow` → `startOrResume`,
  `WizardStepPanel` → `onRewrite`). The blueprint reads the stored `ownIdeaAi.hints` as quoted data (the #314 plan),
  so the extract-only prompt mode is needed only if the owner picks option B alone.

## 2026-11-24 - UI PR

- #311 (backend) merged. Rebased the UI commits onto main. The conflicts with #315 (the Step 5 `crew` prop) were
  additive and both sides were kept.
- #316 (the `renderFieldAction` slot) is still open, so the UI PR keeps the `improve` prop on `OwnIdeaForm`. It moves
  to the slot in a follow-up once #316 lands.
- Checks: typecheck, eslint on the wizard folders, `tests/platform` plus `convex/workspace/ideaImprove.test.ts` (124
  files, 3054 tests), `test:security` (221), `git diff --check`.

## 2026-11-24 - Moved onto the #316 slot

- #316 merged while the UI PR was open, so the PR conflicted on `OwnIdeaForm`. Rebased onto main and took main's
  `OwnIdeaForm` unchanged: this branch no longer edits it.
- `useIdeaImprove` now takes `{ api, field: OwnIdeaFieldApi }` and reads the selection through
  `field.getSelection()`. `ideaImproveAction(api)` (in `IdeaImprove.tsx`) returns the `renderFieldAction`, or undefined
  while AI is off. `WizardFlow` passes it to `OwnIdeaForm` and to `WizardStepPanel` (`ownIdeaFieldAction`).
- Change: the button is now inert while the step saves (`field.pending`). Continue is no longer blocked while a
  suggestion loads, because the slot cannot block the form's submit. The field is read-only then, so Continue sends the
  founder's own words, and a late reply after the step moves on is dropped with the unmounted control.
- Checks: typecheck, eslint on the changed files, `tests/platform` plus `convex/workspace/ideaImprove.test.ts` (125
  files, 3057 tests), `test:security` (121), `git diff --check`. The control's markup and place are unchanged, so the
  browser pass from S4 was not repeated.

## 2026-11-24 - #317 review (Codex)

- Undo and Back to my words now stay while the field holds accepted AI text: after a later round ends in a notice or
  Stop, not only right after Use this.
- The read-only and `aria-busy` state on the field is set in an effect with a cleanup, so the field is handed back
  when the control unmounts mid-request (AI switched off, the step moving on).
- Two regression tests. `tests/platform` plus `convex/workspace/ideaImprove.test.ts`: 125 files, 3059 tests;
  typecheck and eslint pass.
