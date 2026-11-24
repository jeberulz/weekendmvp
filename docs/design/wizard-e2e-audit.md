# Wizard end-to-end audit

Date: 2026-11-24. Branch base: `main` at `f0b94bdd` (after #306 and #308). Scope: all 8 steps of `/start/*`
(idea, blueprint, platform, commercial model, goal, name, partner personality, partner name), then Create my
business and Meet your co-founder.

## How it was tested

- **Isolated local backend.** A worktree-only `convex dev` (ports 3710/3711) with a seeded verified founder, a
  library idea with a stored platform seed whose hints are confident (`neighbourhood-bakery-preorder`), the
  HydroTrail fixture, and own ideas. Nothing touched the shared dev or prod deployments.
- **Both variants:** library idea (`/start/{slug}`) and own idea (`/start/own`).
- **Both modes:** quick confirm (a confident seed hint on platform, model and goal) and full choice (no seed, or
  after "Change").
- **Per step:** Back and forward (answers kept, focus, announcement), reload with `?session=`, Save & exit and
  resume, earlier answers flowing into later steps, validation, the pending guard, errors, keyboard only,
  screen-reader semantics (roles, names, live regions, `aria-describedby`), and 375px width.
- **Automated:** `vitest run tests/platform convex/workspace` (133 files, 3254 tests, passing on each fix branch),
  `npm run typecheck`, eslint on changed files, and axe in the component tests.

## Summary

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| F1 | Own idea Step 1 changes look after Back or a reload | High | **Fixed** in #310 |
| F2 | Focus falls to `<body>` after the first own-idea sentence; Step 2 is not announced | Medium | **Fixed** in #310 |
| F3 | Blueprint "Rework it" gives no feedback, and the copy promises a rework that never happens | High | **Fixed** in #312 |
| F4 | Rework notes are lost when the founder then picks "Looks good" | High | **Fixed** in #312 (first ~130 characters; see D2) |
| F5 | No way back to an own-idea session after Save & exit | High | Open, needs decision D1 |
| F6 | `AI_DISABLED` shows "Something went wrong. Try again." | Medium | **Fixed** in #313 |
| F7 | A "fill this in first" error stays after a valid choice | Low | **Fixed** in #313 |
| F8 | The goal suggestion ignores the Step 4 answer | Medium | Open, needs decision D3 |
| F9 | Nothing downstream reads the goal timeframe | Medium | Open, needs decision D4 |
| F10 | A founder at the business limit finds out only after typing an idea | Low–Medium | Open follow-up |
| F11 | Library Step 1 shows the own-idea sub ("One sentence is plenty…") | Low | Open (copy) |
| F12 | The quick-confirm platform sub talks about picking | Low | Open (copy) |
| F13 | Some founder-signal notes read awkwardly | Low | Open |
| F14 | At 375px the header buttons wrap onto two lines | Low | Open |
| F15 | The own-idea name step offers a single option | Low | Open, part of the blueprint enrichment plan |
| F16 | The Create screen has no answer summary | Low | Open (design) |
| F17 | The Step 1 library link goes to `/ideas`; the dashboard's library is `/dashboard/explore` | Low | Open, needs decision D5 |
| F18 | The crew preview lags a step (it reads saved answers) | Low | In-step part covered by #315 (live goal line); rail still updates after Continue |

File and line references are to `main` at `f0b94bdd` unless a fix PR is named.

## Fixed

### F1. Own idea Step 1 changes look after Back or a reload (High). Fixed in #310

- **Repro:** `/start/own`, type a sentence, Continue, then Back (or reload `/start/own?session=…` on Step 1).
- **Actual:** the first visit shows the new surface (example chips, "Pick one from the library instead"). After Back
  or a reload the step renders an older boxed card from `WizardStepPanel` with no chips and a "Bookmark this page"
  hint. Same step, two looks.
- **Cause:** two render paths. `OwnIdeaStart` in `components/workspace/wizard/WizardFlow.tsx` ran before a session
  existed; the own-idea branch of `components/workspace/wizard/WizardStepPanel.tsx` ran after.
- **Fix:** one shared `components/workspace/wizard/OwnIdeaForm.tsx`, rendered by both, with the saved idea filled in.
  Unchanged text calls `saveStep`; edited text calls `rewriteStep`, and Step 2's pitch follows. The library variant
  was checked: its Step 1 has one path and was already consistent.
- **Regression test:** `tests/platform/wp74-wizard-flow.test.tsx` "own idea: step 1 looks the same on first visit and
  after Back from the blueprint, with the idea pre-filled" (fails on `main`).
- **Browser:** first visit and after Back match (heading, chips, link, note, pre-filled value). A reload on Step 1
  matches too. Editing the idea updates Step 2.

### F2. Focus lost after the first own-idea sentence (Medium). Fixed in #310

- **Repro:** `/start/own`, type a sentence, press Continue with the keyboard.
- **Actual:** Step 2 renders, but focus falls to `<body>` and nothing is announced. Every other step change moves
  focus to the new h1 and announces "Step N of 8: …".
- **Cause:** `startOwn` set the session id and tracked the move by hand, so `WizardFlowInner`'s step-change effect
  saw no change.
- **Fix:** the first view of a new session counts as a step change (`lastPosition.current = "idea"` before
  `setSessionId`). Focus goes to Step 2's h1, the live region says "Step 2 of 8: Blueprint", and the move is still
  tracked once.
- **Regression test:** `wp74-wizard-flow.test.tsx` "own idea: once the first sentence starts the session, step 2 is
  announced and its h1 takes focus".

### F3. Blueprint rework gives no feedback (High). Fixed in #312

- **Repro:** Step 2, "I'd change some things", type notes, "Rework it".
- **Actual:**
  - The page shows the same outline, with the text still in the box.
  - The button still says "Rework it", and "Looks good" is hidden until the founder closes the field.
  - Opening the field didn't move focus into it.
  - The sub said "I'll rework it right here" (`lib/workspace/wizard/copy.ts:31`). The hint said "Your notes go back
    with the blueprint". But the outline is never redrafted: own ideas use a fixed outline and library ideas a
    seeded one.
- **Fix:**
  - Opening the field focuses it, and the button reads **Save notes**.
  - A save closes the field and shows the notes under the outline ("Saved. Your crew reads these before it builds.
    The outline stays as it is."). Focus moves to **Looks good** and the save is announced.
  - The toggle becomes **Edit my notes**.
  - The sub and the hint now say what really happens.
- **Regression tests:** `tests/platform/wp74-wizard-ui.test.tsx`, "saved rework notes close the field…" and "notes
  already carried in the blueprint signal…".

### F4. Rework notes are lost on "Looks good" (High). Fixed in #312

- **Repro:** save rework notes, then "Looks good", then check the founder signals rail or `answers.signals`.
- **Actual:** the blueprint signal is overwritten by a plain "Approved suggested blueprint: Looks good". The
  completed answers only allow `{ decision: "looks_good" }` (`lib/workspace/contracts/wizard.ts:231`), and the crew
  reads `answers.signals` (`lib/workspace/crew/inputs.ts:111`). So the crew never sees the notes.
- **Fix:** in `commitStep` (`convex/workspace/wizard.ts`), "Looks good" after notes is recorded as `changed`, with
  the note "Approved blueprint with notes: …". The notes are carried from the saved rework, or from the existing
  signal, so Back plus "Looks good" again keeps them. An accept with no notes stays `kept`.
- **Limit:** signal notes are capped at 160 characters (`WIZARD_LIMITS.signalNote`). The crew sees about the first
  130 characters of notes that can be up to 400. See D2.
- **Regression test:** `convex/workspace/wizard.test.ts` "looks good after rework notes keeps the notes in the
  blueprint signal, also after Back and looks good again".

### F6. `AI_DISABLED` shows the generic error (Medium). Fixed in #313

- **Repro:** switch AI off (kill switch, or no global budget). Then start a new own idea.
- **Actual:** `checkLimit("wizardStart")` throws `{ code: "AI_DISABLED" }` (`convex/ops/settings.ts:93`). That code is
  not in `ERROR_COPY` (`components/workspace/wizard/WizardFlow.tsx:50`), so the founder sees "Something went wrong.
  Try again."
- **Fix:** "Starting new builds is paused right now. Builds you already started still open. Try again later." That's
  true: resuming still works with AI off.

### F7. Stale "fill this in first" error (Low). Fixed in #313

- **Repro:** Platform, "Something else", Continue with the field empty, then pick "Mobile web, installable".
- **Actual:** the red "Describe the platform first…" alert stays.
- **Fix:** a local "missing" error clears as soon as the choice is valid, on every step, and returns only on the
  next Continue.

## Open

### F5. No way back to an own-idea session after Save & exit (High). Needs D1

- **Repro:** on `/start/own`, reach any step and press Save & exit. Later, open the dashboard's "Start building".
- **Actual:**
  - Save & exit goes to `/ideas` (`WizardFlow.tsx:315–326`).
  - "Start building" (`components/platform/home/StartBuildingCard.tsx:18`) opens a blank `/start/own`. Nothing
    lists the saved session.
  - Only the bookmarked `?session=` URL brings it back, or retyping the exact same sentence (which resumes through
    `startOrResume`).
  - A library idea resumes from its idea page, so this only affects own ideas.
- **Proposed fix:**
  - Add a query for the owner's newest active own-idea session. `/start/own` then offers "Pick up where you left
    off: *{first sentence}* · Step N of 8" above the form, as a link to `?session=`.
  - Save & exit goes to the dashboard, and the dashboard card shows the same link.
  - Small, but it touches `OwnIdeaForm` (#310), so it waits for #310 to merge (no stacked PRs).

### F8. The goal suggestion ignores the Step 4 answer (Medium). Needs D3

Handed over by the Step 5 audit (#309, §2.7).

- **Repro:** library or own idea. At Step 4 pick "Subscription", then go to Step 5.
- **Actual:** Step 5 still suggests "First 50 waitlist signups · Right for a free app.", with "Use suggested ·
  Continue". Meanwhile the rail beside it says "Changed commercial model: Free for now → Subscription".
- **Cause:**
  - `baseDefaults` hard-codes `goal: { kind: "waitlist", timeframe: "weekend" }`
    (`lib/workspace/wizard/defaults.ts:238`).
  - A stored seed's goal hint is fixed before Step 4 is answered (`defaults.ts:313, 337`). Its `confident` flag can
    still open the quick confirm.
  - The hint "Right for a free app." is static (`lib/workspace/wizard/labels.ts:54`).
- **Proposed fix:**
  - Derive the goal default from the saved commercial model. Free and freemium → `waitlist`; subscription and
    one-time → `first_sale`.
  - When the founder's model differs from the seed's, the goal hint stops being confident (no quick confirm).
  - It's a product mapping, and it interacts with #309's decision 1 (which goal options to offer), so it isn't
    built here.

### F9. Nothing reads the goal timeframe (Medium). Needs D4

Handed over by #309 (§2.4).

- `wizardGoalSchema`'s comment says "the launch plan reads it" (`lib/workspace/contracts/wizard.ts:258`). But only
  `MeetCofounder.tsx` and the signal note use `timeframe`. No crew prompt or launch plan reads it.
- Either wire it into the launch plan's schedule, or stop asking. #309 decision 2 recommends keeping it and wiring it
  in.
- #315 (the Step 5 redesign) leaves out the "Sets the pace of your launch plan" line until something reads the
  timeframe, so the step doesn't promise what the plan ignores.

### F10. Business limit learned late (Low–Medium)

- **Repro:** a founder at their plan's business limit opens `/start/own`, types an idea and presses Continue.
- **Actual:** only then do they see "Your plan includes one business, and you already have it." (`startOrResume`,
  `convex/workspace/wizard.ts:540`). A resumed session shows `BusinessLimitNotice` up front (`WizardFlow.tsx:135`).
  A fresh `/start/own` can't, because there's no session to read.
- **Proposed fix:** a small owner query (`businessLimitFor`) read by `/start/own` before the form, showing the same
  notice and a link to the existing business. It can be done together with D1, since both add an owner query to
  `/start/own`.

### F11. Library Step 1 uses the own-idea sub (Low)

- `STEP_HEADS.idea.sub` (`lib/workspace/wizard/copy.ts:25`) reads "One sentence is plenty. I'll suggest everything
  else." Both variants show it, but on a library idea there is no sentence to write.
- Suggested sub for the library variant: "Here's the idea you picked. Check it's the one."

### F12. The quick-confirm platform sub (Low)

- In quick confirm, Platform shows one suggestion and "Looks right", under the sub "Pick what you can ship this
  weekend. Native apps can come later." (`copy.ts:37`). There is nothing to pick until "Change".
- A quick-confirm sub per step ("Here's what I'd pick. Change it if it's wrong.") would read true.

### F13. Awkward founder-signal notes (Low)

- An own idea's first sentence logs "Rewrote idea: none → Own idea: …". `hadSuggestion` is false, so `before` is
  undefined and `signalNote` prints "none" (`labels.ts:156`).
- Editing it later logs "Own idea: X → Own idea: Y".
- Suggested wording: "Wrote own idea: …" and "Changed idea: X → Y".

### F14. 375px header wraps (Low)

- On a 375px screen, "Send feedback" and "Save & exit" in the wizard header (`WizardFlow.tsx:454`) wrap onto two
  lines each. There is no horizontal scroll and both stay tappable, but the header doubles in height.
- Fix options: icon plus a short label ("Feedback"), or move feedback into the footer on small screens.

### F15. Own-idea name step offers one option (Low)

- For an own idea the name step lists a single radio (`nameFromOwnIdea`), plus "type your own". Library ideas get 3
  seeded names.
- It belongs with the blueprint enrichment (`wizard-own-idea-blueprint-enrichment.md`), which can return name ideas
  from the same call.

### F16. No summary before "Create my business" (Low)

- The Create screen (`components/workspace/wizard/CreateBusiness.tsx`) asks the founder to commit without showing
  the eight answers. The rail shows signals, not answers, and it is hidden on mobile.
- A compact summary list (with a link back to each step) would help. It's a design change.

### F17. Library link target (Low). Needs D5

- Step 1's "Pick one from the library instead" goes to `/ideas`, the public site
  (`components/workspace/wizard/OwnIdeaLibraryLink.tsx:14`, from #306).
- For a signed-in founder the dashboard's library is `/dashboard/explore` (`StartBuildingCard.tsx:14`). Leaving to
  the public site drops the workspace navigation.
- Not changed here: #306 owns the link.

### F18. The crew preview lags a step (Low, design)

- From #309 (§2.7.3). The crew preview reads saved answers, so a choice (for example the paid test that hires Ads)
  shows in the preview only after Continue.
- #309 §5 proposes a client-side consequence line instead.
- #315 adds that live line under the goal options, so the in-step part is covered for Step 5. The crew rail and the
  preview on other steps still update only after Continue.

## Verified working

- Back and forward keep every answer. Focus moves to the new h1, and the step is announced in the live region.
- A reload with `?session=` resumes the right step with its answers (library and own).
- **Quick confirm** (bakery seed): "Looks right" accepts. "Change" opens the full choice, with focus on the
  selected option. Back from the next step returns to the quick confirm.
- **Full choice:** a different answer is preselected after Back, and Continue keeps it.
- Editing the own idea after Back updates Step 2's pitch and the name default.
- **Validation:** empty own idea, empty custom platform, empty custom names and empty rework notes all show an
  alert. The field gets `aria-invalid` and `aria-describedby` pointing at the alert.
- **Pending guard:** while a call is in flight, buttons are `aria-disabled` but keep focus. Double clicks are
  no-ops on the server (step-key check).
- **The rate limit message:** the 4th new start in a day shows "Try again in about N hours". Resuming still works.
- Create my business → Meet your co-founder works, and the founder signals rail lists every step.
- **375px:** no horizontal scroll on any step, and Continue stays reachable.
- **Keyboard:** every step can be completed with Tab, arrows, Space and Enter. Escape closes the blueprint notes
  field and returns focus to its toggle.
- **Focus rings:** a 2px `home-orange-ink` outline on every control (checked with real Tab presses, after the
  colour transition).

## Decisions for you

1. **D1. Own-idea resume** (F5).
   **(A, recommended)** "Pick up where you left off" on `/start/own` and on the dashboard card. Save & exit goes to
   the dashboard.
   (B) Keep Save & exit as is, and show a "Bookmark this link" line before leaving.
2. **D2. Full rework notes** (F4).
   **(A, recommended)** Let the accepted blueprint decision carry `notes` (`{ decision: "looks_good", notes? }`), so
   the crew gets all 400 characters. This is a C-WIZARD contract change.
   (B) Keep the signal carry from #312 (about 130 characters).
3. **D3. The goal default follows Step 4** (F8).
   **(A, recommended)** Free and freemium → First 50 signups; subscription and one-time → First sale. A seed hint
   for a different model is no longer confident.
   (B) No default at all when the model differs from the seed.
   Decide this together with #309's decision 1.
4. **D4. The timeframe** (F9). Wire it into the launch plan, or drop the question (#309 decision 2).
5. **D5. The library link** (F17). `/dashboard/explore` for signed-in founders, or keep `/ideas`.

## Follow-ups ready to build once decided

- D1 + F10 together: one PR adding the owner queries and the `/start/own` lines, after #310 merges.
- D3: a small change in `defaults.ts` plus `seedFor`, with tests for each commercial model.
- F11–F14: one copy and layout PR.
