# Wizard Step 5: "What's the *first* win?" (Goal). Audit and direction

> Scope: the wizard's fifth step. That is the goal choice in
> [`WizardStepPanel.tsx:632`](../../components/workspace/wizard/WizardStepPanel.tsx), its quick-confirm summary
> ([`quickSummary`, `WizardStepPanel.tsx:132`](../../components/workspace/wizard/WizardStepPanel.tsx)), the options in
> [`labels.ts:53`](../../lib/workspace/wizard/labels.ts) and the defaults in
> [`defaults.ts:238`](../../lib/workspace/wizard/defaults.ts).
> This is an audit only. No production code changed. It is the sixth page in the series.

---

## 0. Headline: the kit covers the surface, but Goal is three questions in one step

Step 5 inherits everything Steps 3 and 4 refined. The `OptionCard` uses the crisp ink-border selection and an ember
hairline on the suggested card. `QuickConfirm` uses the hairline surface, with "Looks right" leading and a quieter
"Change". Nothing on the surface needs redoing.

The problems are specific to Goal, and the kit doesn't touch them:

1. **It's three questions in one step.** The founder picks a goal (5 cards), a deadline (4 pills) and an optional
   paid test (a checkbox card). That's **10 controls and 2 "Suggested" chips**. On a 375px phone, the Continue button
   sits about 170px below the first screen. This is the densest step in the wizard.
2. **The options don't match the question.** The heading asks for the *first* win, and the sub line promises "One
   number every launch task aims at". Two of the five options have no number ("Replace my income", "Just testing the
   idea"). Two are not first wins at all ("$500 a month", "Replace my income"). The deadline pills let a founder pick
   "Replace my income · This weekend".
3. **The step's real consequence is hidden.** Goal is the answer that shapes the crew most. It decides whether Ads is
   hired, what Landing and Email build, and what Marketing "owns". None of that shows while the founder chooses. The
   paid test, the only thing that hires Ads, is **hidden entirely in the quick confirm**.

---

## 1. What's on the screen today

How I looked at it: I couldn't sign in to production, and the local wizard is sign-in and invite gated. So I rendered
the **real `WizardStepPanel`** for `step="goal"` in a throwaway local route (never committed), with the shell's own
`WizardProgress`, `FounderSignals` and `CrewPreview` around it. I captured four cases at 1280px and at 375px:

- an own idea with no hint
- a library idea with a confident hint (HydroTrail's seed hint)
- the same library idea after "Change"
- an own idea whose founder picked **Subscription** on Step 4

The crew rail uses HydroTrail's roster profile, so its reasons are illustrative.

Column: `max-w-[672px]`, with the stepper and the caption `STEP 5 OF 8 · GOAL`. Beside it sit the Founder-signals
rail (4 logged) and "Your crew" (8 hiring, 5 not hiring).

**`StepHeadView`**: "What's the *first* win?", with the sub line "One number every launch task aims at."

**Full choice** (own ideas, or a hint that isn't confident):
- A `<fieldset>` (sr-only legend "Goal") with five `OptionCard` radios: **First 50 waitlist signups** ("Right for a
  free app.", Suggested), **First sale** ("One paying customer."), **$500 a month** ("A real side income."),
  **Replace my income** ("The long game."), **Just testing the idea** ("See if anyone cares.").
- A second `<fieldset>` with the visible legend "**By when?** (optional)" and four `pill` radios: **This weekend**
  (Suggested, with the chip inside the pill), In two weeks, In 30 days, No deadline.
- A checkbox `OptionCard`: "**Add a $7 a day paid test**", with the hint "Your own ad budget. Nothing runs without
  your approval."
- A full-width primary button: "Use suggested · Continue" while the answer equals the default, and "Continue"
  otherwise.
- For a library idea that isn't confident, the "**Why I suggest it:** …" line sits above the cards.

**`QuickConfirm`** (a confident library hint): the hairline surface, the eyebrow "My suggestion", and the chip
"Suggested · from the idea page". Under them come the serif title **First 50 waitlist signups**, the detail line
**This weekend**, and "Why I suggest it: Hikers plan ahead, so a waitlist before the hot months tests demand
fastest." The footer has **Looks right** (leading) and **Change** (quiet).

---

## 2. The audit

### 2.1 What Step 5 inherits for free (verify, don't redo)
- **`OptionCard`** (Step 3). The selected card has the ink border and inset ring. The suggested card has the ember
  hairline. The pill variant (used only here) gets the same selected treatment. ✔ Seen in the render.
- **`QuickConfirm`** (Step 4). It has the hairline top and bottom surface, the serif lead, "Looks right" leading and a
  quiet auto-width "Change". ✔ Seen. On mobile, "Change" wraps under the full-width primary, which is acceptable.
- **The reason and its link.** The accept button's `aria-describedby` points at the "Why I suggest it" line.
  ✔ Verified in the DOM.
- **"Change" focus.** After "Change", focus lands on the checked radio ("First 50 waitlist signups").
  ✔ Verified in the DOM.

So, as on Step 4, **no new work on the shared pieces**. Everything below is specific to Goal.

### 2.2 Density: three questions, one step
| | Controls | "Suggested" chips | Rows at 375px |
|---|---|---|---|
| Platform (Step 3) | 3 cards | 1 | 3 |
| Model (Step 4) | 4 cards | 1 | 4 |
| **Goal (Step 5)** | **5 cards + 4 pills + 1 checkbox** | **2** | **5 + 3 pill rows + 1** |

- **At 375px, Continue sits at y≈985 on an 812px screen.** It's the only quick step where the founder must scroll to
  find the button. The `pill` with the chip inside it ("This weekend ✓ Suggested") is about twice the width of the
  other pills, so the four pills wrap onto three rows.
- **Two chips compete.** The series rule is one ember accent per view. Here the eye meets two chips and an ember
  hairline before reading the question. The second chip (on the pill) says nothing the first doesn't.
- **The chip squeezes the label.** On mobile, "First 50 waitlist signups" breaks onto two lines because the chip takes
  the right edge (the `ui-ux-pro-max` compact-label rule).
- **The paid test looks like a sixth goal.** It uses the same card, the same height and the same border as the goal
  options, and only the square box tells it apart. It is an add-on, not a goal (`progressive-disclosure`).

### 2.3 The options themselves
The heading is good: "What's the *first* win?" is the right question for a weekend build. The options drift away from
it.

- **The sub line makes a promise two options break.** "One number every launch task aims at." is false for **Replace
  my income** and **Just testing the idea**, because `GOAL_TARGETS` is `null` for both. Downstream, the crew falls
  back to vague reasons ("Owns the first goal", "No course or cohort to run yet").
- **Two options are not first wins.** "$500 a month" ("A real side income.") and "Replace my income" ("The long game.")
  are milestones months away. They sit badly with the weekend-MVP standard and with the "first" in the heading. The
  hints admit it ("The long game.").
- **Three options do the same thing for the crew.** In `roles.ts`, `first_sale`, `mrr_500` and `replace_income` are all
  `SALE_GOALS`. They produce the same Landing ("Sales page and early-bird list") and the same Email ("Pre-launch and
  launch-day emails"). Only the number Marketing "owns" differs, and one of them has no number. The five choices are
  really **three outcomes**: build a list, make a sale, or just test.
- **Some combinations don't make sense.** "Replace my income · This weekend" and "$500 a month · This weekend" are both
  selectable, and nothing reacts.
- **One hint is tied to Step 4 and goes stale.** "Right for a free app." is static copy. In the Subscription case, the
  rail shows "**EDIT** Changed commercial model: Free for now → Subscription" right beside the suggested goal "First 50
  waitlist signups · Right for a free app." The default doesn't change either (see §2.7, handed off).
- **The hints are thin.** "A real side income.", "The long game." and "See if anyone cares." describe ambitions. They
  don't say what the crew will do. Compare Platform's hints, which tell the founder the consequence ("Ships this
  weekend").

### 2.4 The deadline ("By when?")
- **"(optional)" isn't true.** It's a radio group that always has a value. The founder can't clear it, and "No
  deadline" is the real opt-out. The label teaches the founder that the group doesn't matter, which leads to the next
  point.
- **Nothing downstream reads it.** The contract says the timeframe "is not a roster input: the launch plan reads it"
  ([`wizard.ts:258`](../../lib/workspace/contracts/wizard.ts)). A repo-wide grep finds only the Meet summary and the
  signal note. So we ask a question whose answer changes nothing the founder can see (handed off, §2.7).
- **In the quick confirm, the deadline is an orphan.** The detail line reads just "This weekend", a fragment under the
  title. "First 50 waitlist signups **by this weekend**" reads as one thought.

### 2.5 The paid test
- **It's the most consequential input on the page,** and the only founder fact that forces a hire
  (`forcedHire("ads")`). It also commits real money ($7 a day). Its hint, "Your own ad budget. Nothing runs without
  your approval.", is honest and good. **Keep it.**
- **The quick confirm hides it completely.** "Looks right" silently means "no paid test". The founder can reach it only
  through "Change", and nothing on the confirm says it exists. The crew rail does say "Ads · No paid goal yet", but
  that's far from the decision.

### 2.6 The crew link is invisible while choosing
`CrewPreview` reads the saved answers (`WizardFlow` passes `view.crew`). So selecting a goal, or ticking the paid test,
changes nothing on screen until Continue. Goal is the step where this matters most:

| The founder picks | The crew changes |
|---|---|
| First 50 waitlist signups | Landing: "Site and waitlist" · Email: "Waitlist email sequence" · Marketing: "Owns 50 signups" |
| First sale | Landing: "Sales page and early-bird list" · Email: "Pre-launch and launch-day emails" · Marketing: "Owns 1 sale" |
| + $7 a day paid test | **Ads is hired** ("Goal has a paid push: $7/day test") |

The rail says "It changes as you answer", but on this step it changes one click late. A founder who picks "First sale"
never sees that they just asked for a sales page.

### 2.7 Functional issues, handed off (not fixed here)
Sent to the wizard end-to-end audit session (`wizard-e2e-audit`) with repros:
1. **The goal default ignores Step 4.** `baseDefaults` hard-codes `{ waitlist, weekend }`, and seed hints are fixed
   before Step 4 is answered. So after "Subscription" the step still suggests a waitlist "Right for a free app." with
   "Use suggested · Continue".
2. **The timeframe has no consumer**, despite the contract comment. Either wire it in or stop asking.
3. **The crew preview lags a step**: it reads saved answers, so the paid test only adds Ads after Continue. This is a
   design choice as much as a bug, and §5 proposes a client-side consequence line instead.

Back, focus on step change and "Change"→focus all read correctly in code, and the last one also in the render. The e2e
session owns verifying Back and reload against a live backend.

### 2.8 Accessibility
- **Good. Keep it.** These are real radios and a checkbox, with the native input visually hidden. Selection is shown
  by shape (the filled dot and the tick), never by colour alone. The pills meet the 44px touch target (`min-h-11`).
  The goal group is a `<fieldset>` and the deadline group has a visible `<legend>`. Focus moves to the h1 on step
  change. The reason is linked to the accept button by `aria-describedby`, and "Change" moves focus to the selected
  radio.
- **Small fixes:**
  - The goal fieldset's sr-only legend is just "Goal". It could repeat the question ("Your first win") so a screen
    reader user hears the question when they enter the group.
  - The pill's accessible name is "This weekend Suggested". With the chip removed from the pill (§5), it becomes the
    plain label.
  - "(optional)" is announced as part of the legend, and it's untrue (§2.4).
  - The paid-test checkbox sits outside any group. That's fine once it's visually separated as an add-on, but give it
    a short heading ("Add-on") so it isn't read as part of the deadline group.

---

## 3. What's working (keep)

- **The question.** "What's the *first* win?" is the right frame for a weekend MVP.
- **Waitlist as the default** for a free consumer app, and "First sale" for ideas that can take an order (the seed
  prompt already says this).
- **"No deadline"** as an honest opt-out.
- **The paid test's hint copy** and its "nothing runs without your approval" promise.
- **The confident-hint path**: one tap with a cited reason ("Hikers plan ahead…").
- **The crew rail's plain reasons** ("Owns 50 signups", "No paid goal yet"). These are the right words; they just
  arrive late.

---

## 4. Inspiration (Mobbin)

Two patterns matter here: a goal that is a single clear choice, and a goal whose consequence is shown before you
commit.

- **[Lloyds: add a savings goal](https://mobbin.com/screens/313689d0-ee4f-4117-9942-0ef1006f55a3)**. A target, then
  date chips, then a "You'll need to save £3.85 a week" summary right above Continue. The consequence sits next to the
  decision. This is the model for a one-line "your crew will aim at…" note.
- **[MacroFactor: edit goal](https://mobbin.com/screens/5c5a6cb0-8678-4c3c-a2ec-f7b96b3a04f3)**. Two tiles at the top
  ("1900 kcal initial daily budget", "projected end date") update live as you adjust. The goal is understood through
  what it causes.
- **[KOHO: "When do you want the money by?"](https://mobbin.com/screens/5ba07d1a-8178-46fd-88cd-072020285f87)**. The
  deadline question says why it's asked ("Choosing a goal deadline will determine your deposit amount"). That's the
  test our "By when?" fails: ask it only if it changes something, and say what.
- **[Origin: "Where would you like to start?"](https://mobbin.com/screens/72077c3b-76d9-4302-94bd-ae89387984e4)**. A
  serif question over one calm, hairline list of five self-explanatory options and one primary. It's close to our
  editorial tone, and it shows a single question per screen reading as confident rather than sparse.
- **[Hotjar: "What would you like to do first?"](https://mobbin.com/screens/877c3a34-857f-43aa-8933-7a1938617769)**.
  The sub line says what the answer is for ("used to personalize your next steps"), which is honest framing for a
  question that configures the product.
- **[Asana: "How would you group these tasks?"](https://mobbin.com/screens/ecbaca38-1db4-4034-a02d-2b9dc4fa872f)**.
  The question sits on the left and a preview of the project on the right updates from your answers. It's the
  desktop version of the live crew line: you see what your answer builds while you give it.
- **[Airwallex: "What is your primary area of interest?"](https://mobbin.com/screens/f8a9374e-acec-4346-b630-61841b86d93e)**.
  One question, one short sub line, and six hairline rows that each say in plain words what you'll do. The options
  describe outcomes, not internal names, which is what decision 6 asks of our hints.
- **[Klook: "Select your plan"](https://mobbin.com/screens/fd4bec09-be4d-45ee-a2ae-6c11f5e2d5c3)**. Three plan
  cards with one "Best Value" badge on one card and nothing else accented. That's the one-chip rule (decision 5).

**What they share:** one question leads. Secondary details are visibly secondary. The consequence of the choice sits
beside it, not a step later.

---

## 5. Direction: one question, a quiet details row, and the consequence in view

1. **Lead with the goal, and make every option a *first* win.** Cut the list to the three real outcomes (see decision
   1): **First 50 signups** (a list), **First sale** (a sale) and **Test the idea** (no target). Keep the stored enum
   values for compatibility. "$500 a month" and "Replace my income" leave this step, because they are later
   milestones, not first wins. Rewrite the hints to say what the crew does, not what the founder wants:
   - *First 50 signups* · "A site and a waitlist. People ask to hear when it's live."
   - *First sale* · "A sales page that takes a real order or pre-order."
   - *Test the idea* · "A simple page and a short welcome email. No target."
2. **Fix the sub line** so it's true for every option: "The one result your crew aims at first." (replacing "One
   number every launch task aims at.").
3. **Move the deadline and the paid test into a quiet "Details" block** under a hairline, after the goal list, in
   smaller type:
   - "**By when?**" as compact pills with **no chip**. The suggested pill keeps only the ember hairline. Drop
     "(optional)". If the deadline stays (decision 2), give it a reason line in the KOHO style ("Sets the pace of your
     launch plan.").
   - The paid test as an **inline checkbox row**, not a card: "Add a $7 a day paid test. Your own ad budget. Nothing
     runs without your approval." That leaves one card style for one kind of choice.
4. **Show the consequence live, in one line** (the Lloyds and MacroFactor pattern). Under the goal list, a quiet
   sentence computed client-side from the current selection, for example: "Your crew will aim at **50 signups**: Leo
   builds a site and waitlist, Elle writes the waitlist emails." Ticking the paid test adds: "Ads joins for a $7 a day
   test." `planRoster` is pure, so this needs no backend call. The rail stays as it is.
5. **Make the quick confirm whole.** The title and deadline read as one line ("First 50 waitlist signups · by this
   weekend"). Under the reason, add one quiet line, "**No paid ads.** Add a $7 a day test", where the link opens the
   full choice with the checkbox focused. Confirming then means something visible.
6. **One accent.** One "Suggested" chip per view, on the goal card. Everything else is ink or the hairline.
7. **Mobile.** With three goal cards, no chip in the pills and the details row in smaller type, Continue should land
   on the first 812px screen. Verify that in the mockup rather than assuming it.

### Tone
Lloyds' calm and MacroFactor's honesty: one clear question, the details tucked under it, and a sentence that tells the
founder what their choice will make the crew do.

---

## 6. Shared-kit note

Step 5 adds very little shared debt:
- **`OptionCard` pill and the chip.** The pill variant exists only for Goal. Rendering `suggested` on a pill as the
  ember hairline alone (no chip) is a one-line change that touches only this step.
- **`QuickConfirm` stays shared and unchanged.** The goal-specific parts are its summary, built in `quickSummary`
  (per step), and an optional quiet "paid test" line. The extra line could be an optional `footnote` slot on
  `QuickConfirm` that Platform and Model leave empty.
- **The consequence line** would be new and Goal-only for now. If Personality (Step 7) later wants "how I'll sound"
  driven by the selection, it could share the same tiny "consequence note" style (hairline-free, `text-sm
  text-home-ink-2`, one bold phrase). Don't build it as a kit piece until a second step needs it.

The content changes (the option list, the hints, the sub line) live in `labels.ts` and `copy.ts`. The default goal
reacting to Step 4 is backend logic, handed off (§2.7).

---

## 7. Decisions for you

> **Settled 2026-11-24: John accepted 1A to 6A, as drawn in the mockup, and asked for them to be wired in.**
> Built in `WizardStepPanel.tsx` (goal body and quick confirm), `wizard-ui.tsx` (no chip on a pill),
> `labels.ts` (`FIRST_WIN_GOALS`, rewritten hints), `copy.ts` (sub line) and `goal-line.ts` (the live crew line).
> Two things differ from the mockup on purpose:
> - **No deadline reason line yet.** Nothing reads the timeframe today, so "Sets the pace of your launch plan" would
>   be untrue. Add it when the launch plan reads the deadline (the "timeframe has no consumer" finding handed to the
>   wizard end-to-end audit, §2.7).
> - **A sticky Continue on phones (John's call, 2026-11-24).** The goal panel alone measures about 794px at 375px,
>   so with the header and progress bar Continue fell below the first 812px screen. Below `sm`, Continue now sits in a
>   bar stuck to the bottom of the screen until the form ends (a paper fill and a hairline on top). It is on the
>   first screen at 748–800px. Focused options keep a scroll margin so the bar never hides them. Desktop is unchanged,
>   and so is the quick confirm, which already fits.
>   Step 6 (Name) uses the same bar since 2026-11-24 (its doc's decision 6).

1. **The goal options.**
   **(A, recommended)** Three first wins (First 50 signups, First sale, Test the idea). Hide `mrr_500` and
   `replace_income` from the step but keep them valid in the schema.
   (B) Keep all five, but split them into "First win" (three) and "Longer term" (two, collapsed).
   (C) Keep all five and only fix the copy and the sub line.
2. **The deadline ("By when?").**
   **(A, recommended)** Keep it in the Details block, drop "(optional)", and ask the backend owner to make the launch
   plan actually read it (or remove the claim).
   (B) Remove it from the step until something reads it, defaulting to "This weekend".
3. **The paid test.**
   **(A, recommended)** A quiet inline checkbox row under "Details", plus a "No paid ads · Add a $7 a day test" line
   on the quick confirm.
   (B) Keep it as a card, as it is today.
4. **The live crew consequence line.**
   **(A, recommended)** Yes: one line under the goal list, computed client-side, with the rail unchanged.
   (B) No: rely on the rail, which updates after Continue.
5. **The suggested-chip rule.**
   **(A, recommended)** One chip per view (the goal card). The suggested pill gets only the ember hairline.
   (B) Keep both chips.
6. **The hint copy.**
   **(A, recommended)** Rewrite the hints to say what the crew will build (§5.1), and drop "Right for a free app."
   (B) Keep today's hints.
7. **Clickable mockup: built.** [Wizard Step 5 Goal mockup](https://claude.ai/artifact/Ds1CzSghxC5N3DTKknGxtS)
   (private until shared) has the full choice and the quick confirm, each at desktop and 375px. It applies options
   1A to 6A, the options now settled.
