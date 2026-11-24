# Wizard Step 6: "What do we *call* it?" (Name). Audit and direction

> Scope: the wizard's sixth step. That is the name choice in
> [`WizardStepPanel.tsx:769`](../../components/workspace/wizard/WizardStepPanel.tsx), its decision logic
> ([`decide()`, `WizardStepPanel.tsx:496`](../../components/workspace/wizard/WizardStepPanel.tsx)), the copy in
> [`copy.ts:51`](../../lib/workspace/wizard/copy.ts) and [`copy.ts:100`](../../lib/workspace/wizard/copy.ts), and the
> name sources in [`defaults.ts`](../../lib/workspace/wizard/defaults.ts) (`nameFromOwnIdea`, `nameFromTitle`,
> `seedNameAnswer`) and the seed prompt [`ideaSeed.v3.ts:54`](../../convex/ai/prompts/ideaSeed.v3.ts).
> This is an audit only. No production code changed. It is the seventh page in the series.

---

## 0. Headline: the surface is fine. The names, and what a name commits you to, are not

Step 6 inherits the refined kit. `OptionCard` uses the crisp ink-border selection and the ember hairline on the
suggested card. The serif `Field` treatment is available, and the primary button uses the shared full-width style.
Nothing on the surface needs redoing.

The problems are specific to Name:

1. **The names are only as good as their source, and two of the three sources aren't naming anything.** A library
   idea with a stored crew seed gets up to three model-drafted names ("HydroTrail", "SipLine", "Trailwater"). Every
   other path gets **one** name cut from a sentence by a string rule. An own idea gets "Packing List", a generic
   library idea gets "Gamified Posture Tracking App", and "An app that helps freelance designers chase late
   invoices politely" gets **"App"**. A lone radio marked "Suggested" is not a choice. It's a default dressed as one.
2. **The founder can't see what the name becomes.** The name becomes the business title, the web address
   (`{slug}.weekendmvp.app`), the brand kit name (the crew is forced to use it), the landing page and `TEAM.md`. The
   step shows none of this. Its only hint is "Your web address is confirmed when you publish", which names no
   address. The address is actually fixed at "Create my business", two steps later, and silently gets `-2` if taken.
3. **Writing your own name is easy to start and easy to get wrong.** The field has no limit hint (40 characters, cut
   silently mid-word), no preview of the address, and no reserved-name check. A name containing "weekendmvp" is
   refused only at Create, after two more steps, and the bounce back to Step 6 doesn't say why (handed off, §2.8).
   Meanwhile the warning that *does* appear ("Renaming later costs links.") fires when the founder picks one of
   *our own* alternatives, as if choosing "SipLine" were a risk.

---

## 1. What's on the screen today

How I looked at it: as on Step 5, the local wizard is sign-in and invite gated. So I rendered the **real
`WizardStepPanel`** for `step="name"` in a throwaway local route (never committed), with the shell's own
`WizardProgress`, `FounderSignals` and `CrewPreview` around it. I fed it the real `wizardSeedFor` output for five
cases and captured them at 1280px and 375px:

| Case | Source (`seed.source`) | Names offered |
|---|---|---|
| HydroTrail with its stored crew seed | `idea_crew_seeds` (model) | HydroTrail · SipLine · Trailwater |
| Bakery pre-orders with its stored crew seed | `idea_crew_seeds` (model) | Loaf Ahead · Counter Ready |
| A library idea with no seed ("Gamified posture tracking app for phone-based office workers") | `fixture_generic` (`nameFromTitle`) | Gamified Posture Tracking App |
| Own idea: "I want to build a packing list that adapts to the weather forecast for weekend hikers" | `fixture_own_idea` (`nameFromOwnIdea`) | Packing List |
| Own idea: "An app that helps freelance designers chase late invoices politely" | `fixture_own_idea` | **App** |

The seeded names are the repo fixtures (`lib/workspace/contracts/fixtures/seeds.ts`). I tried to read production's
stored seeds to judge real model output, but that read was blocked in this session. **Re-check a sample of real
`idea_crew_seeds.wizardHints.names` before settling decision 2.**

Column: `max-w-[672px]`, with the stepper and the caption `STEP 6 OF 8 · NAME`. Beside it are the Founder-signals rail
and "Your crew".

**`StepHeadView`**: "What do we *call* it?", with the sub line "A name is pre-selected. Keep it or type your own."

**Body** (Name has no quick confirm; its hint is always `confident: false`):
- For a seeded library idea only, a reason line: "**Why I suggest it:** Drafted from the idea's page. Pick one or type
  your own."
- A `<fieldset>` (sr-only legend "Name") of `OptionCard` radios. The default has the "Suggested" chip and the
  alternatives have the hint "**Also suggested**".
- A `Field`: label "Or type your own", placeholder "Name your business", `maxLength` 40, sans (not the serif variant
  Step 1 uses).
- Below it, one of two lines:
  - With the default kept: "Your web address is confirmed when you publish." in sage.
  - After picking an alternative or typing: an ember-soft box, "**Renaming later costs links.** Pick now; the site,
    email and brand kit use it."
- A full-width primary: "Use suggested · Continue" with the default, and "Continue" otherwise.

Typing clears the radio selection, and picking a radio clears the text. The two are one choice. An empty field with
no radio gives "Pick a name or type your own." on Continue.

---

## 2. The audit

### 2.1 What Step 6 inherits for free (verify, don't redo)
- **`OptionCard`** (Step 3): ink border and inset ring on the selected card, ember hairline on the suggested card, and
  the filled dot. ✔ Seen.
- **The reason and its link.** The primary's `aria-describedby` points at the "Why I suggest it" line. ✔ Verified in
  the DOM (seeded case only; the fixture cases have no hint, so nothing is linked).
- **`Field`**: a visible label tied by `htmlFor`, and `aria-invalid` plus the error id when invalid. ✔ Verified.
- **Focus on step change** goes to the h1 (the shared `headingRef`). ✔ In code.

So, as on Steps 4 and 5, **no new work on the shared pieces**. Everything below is specific to Name.

### 2.2 How AI is used in this step today
John asked for this explicitly. The honest answer is "only sometimes, and never for the founder in front of us":

| Path | How names are made | AI? | When |
|---|---|---|---|
| Library idea **with** a stored crew seed | The `crew-idea-seed` precompute (`ideaSeed.v3`) asks the model for "one to three short business names (at most four words, no taglines). The first is the suggestion. Use the page's product name when it has one." `seedNameAnswer` bounds and dedupes them. | Yes | Once per idea, operator-run (`npm run crew:seeds`), shared by every founder who picks that idea |
| Library idea **without** a seed | `nameFromTitle`: the idea title cut at the first dash or colon, at most 4 words, title-cased | No | Live, a string rule |
| Own idea | `nameFromOwnIdea`: the sentence's first clause minus "I want to build a…", at most 3 words | No | Live, a string rule |
| HydroTrail fixture | Hand-written | No | — |

What follows from that:
- **The founder is never told where the names came from,** except the seeded case's "Drafted from the idea's page",
  which doesn't say a model drafted them, and doesn't say nobody checked them.
- **Two founders on the same library idea get the same three names.** The first is "the page's product name", so the
  default is the name the *idea page* already uses publicly. That's a good default for "build this idea", and a bad
  one if the founder wants their own brand. The step doesn't make that trade-off visible.
- **The founder's own words never reach a model here.** Steps 1 and 2 now have "Improve with AI" (WP100) and the
  planned own-idea enrichment, but Step 6 for an own idea is a string cut.
- **Nothing checks a name for problems**: a famous brand, a generic noun, a reserved address. Not the model, not the
  code (until Create).

§5.6 and decision 5 propose where AI earns its place here, and where it shouldn't be used.

### 2.3 The names themselves
- **One option is not a choice.** On every unseeded path (own ideas, and library ideas without a seed) the fieldset
  holds a single radio with a "Suggested" chip. The founder is shown a list of one, and a chip that compares it to
  nothing. This is audit F15, and it reaches beyond own ideas: every unseeded library idea has it too.
- **The string rules produce descriptions, not names.** "Packing List" and "Gamified Posture Tracking App" say what
  the product is, which is fine for a working title. But they will become the brand kit name and the web address
  (`gamified-posture-tracking-app.weekendmvp.app`). "App" is a hard failure (handed off, §2.8).
- **The seeded names are the right kind of thing.** "HydroTrail", "SipLine", "Trailwater", "Loaf Ahead" and
  "Counter Ready" are short, pronounceable and tied to the idea. They're also distinct from each other. Two
  cautions:
  - "Trailwater" and "HydroTrail" overlap in sound and meaning. Three names should give three *directions* (a
    descriptive one, a coined one, a warm or human one), not three variants.
  - The prompt says "no taglines" but gives no rules against the usual AI tells (CamelCase compounds, "-ify",
    "-ly", "Hub", "AI"). Fixtures can't show whether real output drifts there. Check the production sample.
- **"Also suggested" is filler.** It's the hint on every alternative, so it says nothing. The slot could carry *why*
  each name fits ("Says what it does", "Short and ownable", "Warmer, for a local crowd"). That needs one reason per
  name from the seed (§5.2).

### 2.4 What the name is for, and what it commits you to
The name flows further than any earlier answer, and the step says almost none of it:

| Where the name goes | Source |
|---|---|
| The business title and the Create screen heading ("Create *HydroTrail*") | `business.ts`, `CreateBusiness.tsx` |
| The web address `{slug}.weekendmvp.app`, picked at Create, with `-2`, `-3` … appended on a collision | `tenant-slug.ts`, `business.ts:233` |
| The brand kit: the crew is forced to use the chosen name | `lib/workspace/crew/quality.ts:109` |
| The landing page, emails and `TEAM.md` header | `convex/crew/roles.ts:502`, `jobs.ts:484` |

- **"Your web address is confirmed when you publish."** is technically true (publishing re-checks the hostname), but
  it shows no address. The founder can't see that "Gamified Posture Tracking App" becomes a 29-character subdomain,
  or that their name might come out as `hydrotrail-2`. Mintlify does this in one line: "Your site will be at
  **mobbin**.mintlify.app" (§4).
- **"Renaming later costs links. Pick now; the site, email and brand kit use it."** has the right content but the
  wrong trigger and tone. It appears only when the founder *departs from the default*, so picking "SipLine" (our own
  suggestion) earns a warning box in ember. The consequence is the same whichever name they pick. It belongs on the
  step as a calm, permanent fact, not as a reaction to a choice. I also found **no rename path in the workspace
  today**. If renaming isn't possible yet, "renaming later costs links" understates it. Say what's true (decision 3).
- **The sub line describes the controls, not the stakes.** "A name is pre-selected. Keep it or type your own."
  repeats the UI. The seeded reason line then says nearly the same thing again ("Pick one or type your own."). That's
  two instructions and no purpose. Slack's version tells you what the name is *for* ("This will be the name of your
  Slack workspace — choose something that your team will recognize", §4).

### 2.5 Writing your own name
- **Easy to start.** It's a visible label, a real input, typing takes over from the radios, and the error clears as
  soon as the founder fixes it. Good.
- **The limit is invisible.** `maxLength={40}` cuts silently. I typed "Weekend MVP Hydration Planner for Trail
  Hikers" and the field kept "Weekend MVP Hydration Planner for Trail " (trailing space, "Hikers" gone) with no
  feedback. The Step 1 field says its limit ("Up to 240 characters…"). This one should too, and show a counter only
  near the limit.
- **The field is sans, while the names above are a label.** The founder is naming a brand. The serif `Field` variant
  (used on Step 1) would let the typed name look like the cards' names do, and like it will on the Create screen
  heading.
- **No feedback that it's usable.** No address preview, no reserved check, no hint that "&" or emoji disappear from the
  address. All of these are pure functions that already exist (`tenantSlugBase`, `isReservedTenantBase`) and need no
  backend call. A taken check would need one query (`isTenantSlugTaken`). Etsy shows the pattern: rules ticked under
  the field, then "already taken" with alternatives (§4).
- **"Or type your own" sits after the list,** so on mobile it's at the bottom, just above Continue. That's fine for
  the seeded case (pick one). For the single-name cases, where typing is the likelier action, the field is the real
  choice and should read as one.

### 2.6 Honest availability
- **We imply nothing about domains or trademarks today. Good. Keep it that way.** The step never says ".com is free"
  or "this name is available". The web address line is the only availability claim, and it's hedged.
- **But we check nothing either,** and the seeded default is deliberately "the page's product name": a name already
  published on our idea page, and shared by every founder who builds that idea. Founder A and founder B both get
  `hydrotrail`, and the second silently gets `hydrotrail-2`. Neither is told.
- **AI-drafted names carry an IP risk the step doesn't mention.** Wix says it plainly under its AI suggestions:
  "Make sure the suggestion you choose does not infringe on intellectual property rights" (§4). A one-line, quiet
  version belongs here.
- **Rule for the redesign:** say what we checked (the Weekend MVP address), say what we didn't (trademarks, domains),
  and never imply more.

### 2.7 Density, copy and consistency with the series
- **Desktop is calm.** The seeded case is three cards, a field, a line and the button, about 560px tall.
- **Mobile: Continue falls just below the fold.** At 375px, with the real 68px header, the primary ends at about
  y≈831 on an 812px screen. When the rename box shows (69px), it ends at about y≈880. That's the same "Continue below
  the fold" problem Step 5 recorded and left open (Step 5 doc §7: "needs a further choice, such as a sticky
  Continue"). John picked a sticky Continue for Step 5. It's built as `stickyPrimary` in `WizardStepPanel.tsx`
  (commit `d67a75ca`, a `max-sm:sticky` bar with a hairline top and safe-area padding, plus `scroll-mb-28` on inputs
  for WCAG 2.4.11). That commit was pushed after #315 merged, so **it is not on `main` yet**. It is landing in
  [#320](https://github.com/jeberulz/weekendmvp/pull/320).
- **Two accents compete again.** The "Suggested" chip and the ember-soft rename box are both ember, so the series'
  "one ember accent per view" rule breaks whenever the founder departs from the default.
- **The sage web-address line is the only sage text in the wizard body.** Sage means "kept" in the signals rail. Here
  it's just a note, so the colour carries a meaning it doesn't have.
- **"Use suggested · Continue"** is consistent with Steps 3–5. Keep it.

### 2.8 Functional issues, handed off (not fixed here)
Sent to the wizard end-to-end audit session (`wizard-e2e-audit`) with repros:
1. **A reserved or taken name is refused only at Create, and the bounce back explains nothing.** Type a name whose
   slug contains "weekendmvp", finish Steps 7–8 and click Create. You get `NAME_RESERVED` and "Choose a different
   name". That runs `goBack(to: "name")` through `run()`, which clears `error` and `refusal`, so Step 6 opens with the
   refused name still filled in and no message. `isReservedTenantBase` is pure and could run inline on Step 6.
2. **The own-idea heuristic returns "App"** for "An app that helps freelance designers chase late invoices politely".
   The article is stripped, then the clause starter "that" stops the cut after one word. It needs a minimum-quality
   rule (no lone generic noun), or the enrichment call's names (F15).

**Status:** both now have PRs into `main`. [#319](https://github.com/jeberulz/weekendmvp/pull/319) checks for a reserved
name on Step 6 itself and keeps the reason after a Create bounce (`NAME_RESERVED_MESSAGE` in `labels.ts`).
[#321](https://github.com/jeberulz/weekendmvp/pull/321) makes `nameFromOwnIdea` fall back to "Weekend Launch" when every
word is generic. That fallback is safe but still isn't a name. Decision 4's "Working name" field, and the enrichment
call's names, are the real fix. Wiring this redesign must build on #319's `decide()` change, not replace it.

Back keeps a typed name (`savedNameIsListed` false → the field is pre-filled) and a picked alternative. Focus goes to
the h1 on step change. Both read correctly in code. The e2e session owns verifying them against a live backend.

### 2.9 Accessibility
- **Good. Keep it.** These are real radios in a `<fieldset>`, with selection shown by a filled dot, never colour
  alone. The field has a visible label. The error is `role="alert"` and linked by `aria-describedby` only while
  invalid. The cards meet the 44px target (64–73px tall).
- **Fixes:**
  - **The legend is just "Name".** Repeat the question ("What do we call it?" or "Business name") so a screen reader
    user entering the group hears the question.
  - **Typing silently unchecks every radio.** A screen reader user who types hears nothing about the list losing its
    selection, and arrowing back into the group finds no checked radio. Model "type your own" as the last option of
    the same group (a radio whose label is the field, the Etsy and Whop "Something else" pattern), or announce the
    switch in the existing polite status region.
  - **"Also suggested" is part of each radio's accessible name** ("SipLine Also suggested"), which is noise on every
    option. A real reason (§5.2) would be worth hearing. If there's no reason, drop it.
  - **The 40-character limit isn't exposed.** Put it in the field's hint (linked by `aria-describedby`), and announce
    the counter only when it's close to the limit.
  - **The rename box is `role="note"`** and appears and disappears with the selection. It isn't announced when it
    appears, so a screen reader user never hears the warning that was meant for them. Making it a static fact on the
    step (§5.4) fixes this for free.
  - **The address preview, when built,** should update in a polite live region, debounced, rather than on every
    keystroke.

---

## 3. What's working (keep)

- **The question.** "What do we *call* it?" is warm and short, and the italic lands on the right word.
- **One choice, two ways.** Picking a card or typing, with the other clearing, is the right model. It just needs
  better semantics (§2.9).
- **The seeded names**, when they exist: short, specific and pronounceable, and "the page's product name first" is
  a sensible default for building a library idea.
- **The restraint on availability claims.** We don't promise domains or trademarks.
- **"Use suggested · Continue"** and the full-width primary, consistent with Steps 3–5.
- **The rename sentence's content** ("the site, email and brand kit use it"). It's the right fact in the wrong place.

---

## 4. Inspiration (Mobbin)

Two patterns matter here: say what the name is used for, and show what it becomes as you type.

- **[Mintlify: "Name your site"](https://mobbin.com/screens/9670636f-f740-43f0-986b-3e5c21d33603)**. One field, and
  directly under it a quiet confirmation: "Your site will be at **mobbin**.mintlify.app". The derived address updates
  live, in place of a vague promise. This is the model for our address line.
- **[Etsy: "Name your shop"](https://mobbin.com/screens/40580105-95f1-4c8b-8dab-171924b0aa07)**. "You can just draft a
  name now and change it later", the rules ticked under the field ("Between 4-20 characters", "No special
  characters…"), and when the name is taken, a row of alternatives to tap. Rules shown before they're broken, and
  a way forward when they are.
- **[Wix: AI-generated taglines](https://mobbin.com/screens/501b7631-fe45-475f-ae6e-af21b61f80f6)**. The field
  leads, the AI suggestions sit under a small label ("AI taglines generated for you"), there's a quiet "Generate more
  suggestions", and the footnote says honestly that the suggestions are AI-made and must not infringe IP. That's the
  tone for decision 5.
- **[Whop: "Pick a name for your design content platform"](https://mobbin.com/screens/28e0cd44-8c13-4871-adeb-87efc72b068f)**.
  AI-drafted names as one calm list, with "Something else" as the last row of the *same* list. Typing your own is
  one of the options, not a separate form below it.
- **[Slack: "What's the name of your company or team?"](https://mobbin.com/screens/b58ce3ef-5180-4cee-a62c-20347539d2ea)**.
  The sub line says where the name goes and who will see it: "This will be the name of your Slack workspace —
  choose something that your team will recognize." That's purpose, not mechanics.
- **[Plain: "Name your workspace"](https://mobbin.com/screens/77fb8797-212a-4040-adbc-9eeb17e18d68)**. Each field says
  who sees it ("visible to your customers"). That separates a public name from an internal one, which is a useful
  lens: our name is public from day one (address, landing page).

**What they share:** the field (or list) leads. The name's consequence (the address, who sees it) sits right under
it, in one quiet line. AI suggestions are labelled as AI and come with an honest caveat.

---

## 5. Direction: one list, the address in view, honest about AI

1. **Fix the sub line to say what the name is for.** Replace "A name is pre-selected. Keep it or type your own." with
   a purpose line, for example: "**It goes on your site, your emails and your brand kit.**" Drop "Pick one or type your
   own" from the reason line, since the controls say it.
2. **Make the list a real choice with a reason per name.** Seeded ideas keep the three model names, with a short
   reason in place of "Also suggested" (needs a `names[].reason` field in the seed, decision 2). Unseeded paths get a
   proper list too (decision 4). Until then, **when there's only one candidate, don't show a list of one.** Show the
   field, pre-filled with the candidate and labelled "Working name", so the founder reads it as a draft to edit.
3. **"Type your own" becomes the last option of the same group** (the Whop pattern): a radio row labelled "Something
   else" that reveals the field in place, or a field row inside the fieldset. One group, one selection, announced
   correctly. Use the serif `Field` so a typed name looks like the names above it. The hint says the limit: "Up to 40
   characters."
4. **Show the address, live, in one quiet line** (the Mintlify pattern). Under the list: "Your site:
   **hydrotrail**.weekendmvp.app". It's computed client-side from `tenantSlugBase`, so no backend call, and it updates
   as the founder picks or types, in a debounced polite live region. When `isReservedTenantBase` is true, it says so
   right there: "That address is kept for Weekend MVP. Try another name." This replaces both the sage
   "confirmed when you publish" line and the ember rename box. A collision can't be checked client-side, so the line
   keeps a small honest hedge: "We'll add a number if it's taken." (decision 3 covers showing a real taken check).
5. **Say the commitment once, as a fact, not a warning.** Fold it into the sub line (§5.1) or a single ink-2 line under
   the address. It's always visible, the same whichever name is picked, and never ember. If renaming isn't built,
   don't hint that it is (decision 3).
6. **Be honest about AI, in one quiet line** (the Wix pattern). Under the list, for seeded names: "Drafted by AI from
   the idea page. Not checked for trademarks or domains." For own-idea names, once AI drafts them, the same line. No
   AI badge, no sparkles, just the fact.
7. **One accent.** The "Suggested" chip on the default card is the only ember on the view. The address line is ink-2,
   and an error is clay.
8. **Mobile.** With the rename box gone and the address line in its place, the panel is shorter, but Continue still
   ends near the fold. Reuse Step 5's sticky Continue (`stickyPrimary`) by widening its condition from `goal` to
   `name` (decision 6). Its `scroll-mb-28` keeps a focused card or the typed-name field clear of the bar (WCAG
   2.4.11). Check that with the keyboard up at 375px.

### Where AI earns its place (John's question)
In order of value for cost:

- **A. Real names for every founder (own ideas and unseeded library ideas).** Return three names from the own-idea
  enrichment call already planned (`wizard-own-idea-blueprint-enrichment.md`, F15). It's one call that is already
  being made, so the marginal cost is a few tokens. This removes "Packing List" and "App". It's the single biggest
  quality win on the step.
- **B. Three names, three directions, each with a reason.** Tighten the seed prompt: one descriptive, one coined, one
  warm or human. Add a one-line reason per name, avoid the usual AI-name tells (CamelCase mash-ups, "-ify", "-ly",
  "Hub", "AI"), and don't return two names built from the same root. The reason fills the empty hint slot and makes
  the choice meaningful.
- **C. "More names", with a steer.** A quiet "Suggest three more" link under the list, with optional one-tap steers
  ("Shorter", "Plainer", "More playful"). It's metered like WP100's "Improve with AI" (same limits, same `ai_usage`
  meter, same fixtures), and the earlier names stay visible. That's the Wix "Generate more suggestions" pattern.
- **D. Gentle feedback on a typed name. Use deterministic checks, not AI.** Length, a reserved address, and "this
  reads like a description" (e.g. it ends in "App" or "Tool") are rules, not judgement calls. Keep the model out of
  grading the founder's own name. It would be slow, metered and patronising.
- **Don't:** claim availability we didn't check, call a model on every keystroke, or auto-replace a name the founder
  typed.

### Tone
Mintlify's calm (one field, one line showing what it becomes) and Slack's honesty about what the name is for. The
names should feel drafted by someone who read the idea, not generated.

---

## 6. Shared-kit note

- **`OptionCard` and `Field` stay as they are.** "Type your own as the last option" can be built from an `OptionCard`
  plus a `Field` inside the fieldset, without a new kit piece. Step 8 (Lead name) has the same list-plus-field shape
  (`partner_name`), so build it once as a small local `ChoiceWithOther` in `WizardStepPanel` and use it for both. It
  becomes a kit piece only if a third step needs it.
- **The address line** is Name-only. It's a one-line `<p>` in the same `text-sm text-home-ink-2` style as Step 5's
  consequence line, so the two read as one family ("what your answer does").
- **The sticky mobile Continue** already exists for Step 5 as `stickyPrimary` (`step === "goal" && !quick`), now in
  [#320](https://github.com/jeberulz/weekendmvp/pull/320) and not yet on `main`. Step 6 adopts it by widening that condition, not by adding a new
  component (decision 6).
- **The AI-names line** ("Drafted by AI from the idea page…") could share the reason-line style. No new component.
- **Content changes** live in `copy.ts` (sub line, address line, AI line) and the seed prompt `ideaSeed.v3.ts`
  (names with reasons, three directions), which needs a seed version bump (`CREW_SEED_VERSION`) and a re-seed.

---

## 7. Decisions for you

1. **The sub line and the commitment.**
   **(A, recommended)** Replace the sub line with what the name is for ("It goes on your site, your emails and your
   brand kit."), delete the ember rename box, and show the commitment as that one calm fact.
   (B) Keep today's sub line, and move the rename sentence into a permanent ink-2 line under the list.
2. **Better seeded names.**
   **(A, recommended)** Update the seed prompt to three directions with a one-line reason each, and an avoid-list for
   AI-name tells. Show the reason in place of "Also suggested". This needs a seed version bump and a re-seed run
   (it costs money in live mode, so you approve the run). First check a sample of real production names.
   (B) Keep the prompt. Just drop "Also suggested".
3. **The address and availability.**
   **(A, recommended)** A live address line ("Your site: **hydrotrail**.weekendmvp.app") from the pure slug function,
   with the reserved check inline and the hedge "We'll add a number if it's taken." No trademark or domain claims, and
   one quiet "Not checked for trademarks or domains" line.
   (B) Same, plus a real taken check against `isTenantSlugTaken` (one query, debounced), so the line can say
   "hydrotrail is taken, you'd get hydrotrail-2".
   (C) Keep "Your web address is confirmed when you publish."
4. **Names for own ideas and unseeded library ideas.**
   **(A, recommended)** Take three names from the planned own-idea enrichment call (F15). Until that ships, show a
   single candidate as a pre-filled "Working name" field, not a list of one. Generate seeds for the unseeded library
   ideas via the existing `crew:seeds` run.
   (B) Keep the string rules, add the minimum-quality guard (handed off), and live with one option.
5. **"More names" with AI.**
   **(A, recommended)** Yes, later: a metered "Suggest three more" with optional steers, built on the WP100 metering
   and fixtures. Ship 1–4 first.
   (B) No: the step offers its first three names and the field, nothing more.
6. **Sticky Continue on mobile (reuse Step 5's).**
   **(A, recommended)** Once Step 5's `stickyPrimary` is on `main` (#320), widen its condition to include `name` (and later
   the other non-quick steps). That's the same bar and the same 2.4.11 guard, with no new component.
   (B) No sticky bar. Shorten the step until Continue fits, and accept that it won't on the seeded case with a typed
   name.
7. **"Type your own" semantics.**
   **(A, recommended)** Make it the last option of the same radio group ("Something else" → field), with the serif
   field and the limit in its hint.
   (B) Keep the separate field below the list, and only add a polite announcement when typing clears the selection.
