# Wizard Step 2 — "Here's how I'd build it." (Blueprint) — Audit & Direction

> Scope: the wizard's second step — `BlueprintCard` and the blueprint render
> branch in [`WizardStepPanel.tsx`](components/workspace/wizard/WizardStepPanel.tsx:193),
> its "I'd change some things" rework disclosure, and the `Looks good` /
> `I'd change some things` footer. Audit only — no code changed.
>
> Date: 2026-11-20 · Third in the series (after Meet, Step 1).

---

## 0. The core issue

The blueprint is genuinely the most *content-rich, most important* screen in the
wizard — it's where the founder decides "yes, build this." But it's presented as
**one dashed box with everything stacked flat inside it**, so the thing that
should read like a confident plan reads like a form/receipt. The information
architecture of the content is excellent (pitch → who → the one loop → what I'd
build → what's cut); the *presentation* flattens it, so nothing leads and the
plan's essence (who it's for + the one loop) is visually smaller than the feature
list. One stray accent colour (a sky-blue "+" on the features) and a 50/50 pair
of full-width buttons finish the "assembled, not designed" impression.

---

## 1. What's on the screen today

Column: `max-w-[672px]` form (now centered after the Step 1 change), stepper +
mono caption `STEP 2 OF 8 · BLUEPRINT`, and the step-2 Founder-signals rail
(working, post-Step-1).

**`StepHeadView`** — "Here's how I'd *build* it." + "Skim it. If something's off, tell me and I'll rework it right here."

**`BlueprintCard`** ([`WizardStepPanel.tsx:193`](components/workspace/wizard/WizardStepPanel.tsx:193)) — one `rounded-[10px]` **dashed** (`border-dashed border-home-d2`) card, `px-6`, holding:
- [own ideas only] `NotValidatedNote` — ochre pill "Not yet validated" + meaning + (fallback / removed-figures note).
- `h2` editorial `text-2xl` — the idea title (or "Your idea").
- `pitch` — base text ("No-Code AI Agent Platform: the smallest version you can launch this weekend").
- `dl` grid — **Who it is for** / `oneUser`; **The one loop** / `oneLoop` (small label-value pairs).
- **What I'd build** (`EYEBROW` h3) — `ul` of features, each with a **sky-ink `Plus`** icon.
- **Left out on purpose** (`EYEBROW` h3) — `list-disc` bullets of scope cuts.

**Rework disclosure** (`#…-rework`, hidden unless toggled) — label "What should change?" + hint + one-line `textarea` (Enter submits, Shift+Enter ignored).

**Footer** — a 2-up `grid`: primary **"Looks good"** + **"I'd change some things"** (`SECONDARY_WIDE`, full-width outline, `aria-expanded`/`aria-controls`).

---

## 2. The audit (most damaging first)

### 2.1 One dashed box flattens the most important screen
Everything lives inside a single dashed card. The dashed border reads as
"placeholder / draft / temporary" — thematically it's trying to say "this is a
draft plan," but combined with the card chrome it makes the whole plan feel
provisional and form-like. There's no internal rhythm beyond stacked blocks; the
plan doesn't *lead* anywhere.

### 2.2 The hierarchy inverts importance
The conceptual core — **who it's for** and **the one loop** (the product's whole
mechanic) — are rendered as tiny `dl` label/value pairs, visually *subordinate*
to the longer "What I'd build" feature list. The pitch (the one-liner that sells
the whole thing) is plain base text. So the essence is small and the details are
big — the opposite of what a reader needs to grasp first.

### 2.3 A stray accent + two list treatments
"What I'd build" uses a **sky-ink `Plus`** — the only coloured element in the
card, and a **4th hue** (sky) that appears nowhere else on the page. "Left out on
purpose" uses plain **disc bullets**. So two parallel sections get two different
list treatments, and the one that's coloured pulls the eye to the details rather
than the essence. Same "every subsystem its own colour" tell as Meet/Step 1.

### 2.4 The pitch restates the title
The `h2` is "No-Code AI Agent Platform"; the `pitch` begins "No-Code AI Agent
Platform: the smallest version…". The title is repeated at the start of the pitch
sentence — the same duplicate-title issue we removed on Step 1.

### 2.5 The footer is a 50/50 fork
"Looks good" (ink) and "I'd change some things" (full-width outline) are an equal
2-up grid. Editing *is* more first-class here than on Step 1 (the blueprint is the
thing you most want to tweak), so keeping both is right — but two equal full-width
pills frame it as a hard fork rather than "approve, or tweak if needed."

### 2.6 System tells (shared)
- **Colour count on one screen:** ink + sky (the `+`) + ochre (the "Not yet
  validated" pill) + ember (stepper) — four hues, only one of them earning it
  (ochre as genuine caution state).
- **Heading-scale drift:** `BlueprintCard` h2 is `text-2xl`; `QuickConfirm`/
  `FounderSignals` use `text-xl`; the step h1 is 34px; EYEBROW h3s. No single
  section-lead size — the shared-kit issue again.
- **Arbitrary spacing:** `rounded-[10px]`, `px-[18px]`, `px-6 pb-5 pt-6`.

### 2.7 Accessibility — strong, preserve it
Labeled `textarea` with `aria-describedby` + `aria-invalid`, the disclosure's
`hidden` attribute, `Plus` is `aria-hidden`, the footer toggle's `aria-expanded`/
`aria-controls`, Enter-to-submit with Shift+Enter guarded, Escape-closes-the-
disclosure at the form level, the `NotValidatedNote` stating its meaning in words
(not colour alone). Keep every one.

---

## 3. What's working — keep

- **The content model** (pitch → who → one loop → what I'd build → left out on
  purpose) is excellent and matches the weekend-prompt standard. Don't touch the
  information; re-rank its *presentation*.
- **"Skim it… I'll rework it right here."** — sets exactly the right expectation.
- **Inline rework** with keyboard handling and "You can still choose Looks good
  afterwards." — thoughtful.
- **"Left out on purpose"** — naming the scope cuts is a strong trust move; keep
  it prominent, not buried.
- **`NotValidatedNote`** honesty for own ideas.

---

## 4. Inspiration (Mobbin)

- **[Cofounder — Business Plan review](https://mobbin.com/screens/8ba6a623-93db-49d9-acaf-17419f1ef952)** — almost this exact screen: a generated plan with labeled sections (Company, Product, ICP, Mission), a "Refine / Complete" pair, an "accepted" state, and an "Ask for follow-up changes" field. Warm, sectioned, not one box. The closest model.
- **[Obvious — Q1 Design Recap](https://mobbin.com/screens/48ebdb36-0d47-4585-8e92-fee7b45133f8)** — the plan *as an editorial document*: title + dek + byline, a clean reading column, "EXECUTIVE SUMMARY" section labels, hairline rhythm. The "document, not boxed form" model.
- **[incident.io — Post-Incident Review](https://mobbin.com/screens/a5235dc1-5a89-4bac-b80c-2ac88bb07cc4)** / **[Microsoft Copilot](https://mobbin.com/screens/f398c2aa-bb16-49b5-9619-33320765343d)** — a **Summary** lead + labeled sections + one **left-accent callout** for the key takeaway. The pattern for emphasising the essence (the loop).
- **[Descript — Project plan](https://mobbin.com/screens/d7b719a7-32f8-4ca8-b589-89aaf5facec2)** / **[Contra — Review & sign](https://mobbin.com/screens/30eab093-9fc4-4290-9b04-5b8973d2e0d5)** — one clear primary (Approve / Review and sign) with refine/change as a quieter secondary. The footer-balance model.

**Common thread:** the plan reads as a sectioned document with a clear lead and
one emphasised core idea; approve dominates; refine is present but quieter; no
box-in-box and no stray accent on the details.

---

## 5. Direction — the blueprint as a confident document

Carry the Meet/Step 1 system: one reading column, one accent, one type scale,
hairline rhythm.

### Principles
1. **Retire the single dashed box.** Present the blueprint as a structured
   document on paper with hairline section dividers — not one bordered container.
   If a "draft" signal is wanted, make it a small labeled tag, not a dashed frame
   around the whole plan.
2. **Lead with the pitch; emphasise the core.** The pitch becomes a serif lead
   (the one line that sells it). Promote **"Who it is for"** and **"The one loop"**
   to the visual core — the loop especially (it's the product). Consider a single
   quiet left-accent callout for the loop (incident.io/Copilot), so the essence is
   what the eye lands on first.
3. **One list treatment, one accent.** Drop the sky-blue `+`. Give "What I'd
   build" and "Left out on purpose" the same clean row treatment, distinguishing
   "left out" quietly (a muted tint or a minus/strike, in ink — not a new hue).
   Ember stays the only decorative accent; ochre stays *only* for "Not yet
   validated" (genuine caution).
4. **One section-lead size.** The plan's h2/h3 use the shared `SECTION_LEAD`
   (same as Meet/Step 1), retiring the `text-2xl`/`text-xl`/EYEBROW mix.
5. **Rebalance approve vs refine.** Keep both (editing is first-class here), but
   make **"Looks good"** the clear primary and **"I'd change some things"** a
   quieter secondary — not two equal full-width pills. Keep the inline rework and
   all its keyboard behaviour.
6. **De-dupe** the pitch so it doesn't restate the title.

### Tone
Cofounder's warmth × Obvious's editorial calm. The founder should feel they're
reading a sharp one-page plan from a capable partner — and that saying "looks
good" is the confident, obvious next move.

---

## 6. Concrete redesign (one document, one column)

- **Lead:** idea title (serif `SECTION_LEAD`) + the pitch as a serif sub-lead
  (de-duped — drop the leading title repeat).
- **The core, emphasised:** "Who it is for" and "The one loop" as the prominent
  pair — the loop in a single quiet left-accent callout (or larger weight), since
  it's the product's mechanic. *Ref: incident.io, Cofounder.*
- **What I'd build:** clean rows (neutral marker, no sky `+`), hairline-separated.
- **Left out on purpose:** the same row treatment, muted (ink-2/ink-3), clearly a
  trust move — kept visible, not shrunk.
- **Not yet validated (own):** one quiet ochre tag at the top with its meaning —
  unchanged in substance.
- **Rework disclosure:** unchanged behaviour; style the textarea to the kit's
  input treatment.
- **Footer:** "Looks good" primary (ink) + "I'd change some things" quieter
  secondary (not a 50/50 of two full pills). *Ref: Descript, Contra.*

---

## 7. Shared-kit deltas (the ripple, continued)

This step reinforces the same shared pieces flagged on Step 1 — another argument
for the dedicated kit-promotion pass:

- **`SECTION_LEAD`** — the single serif heading size now wanted in `BlueprintCard`,
  `QuickConfirm`, `FounderSignals`, `CrewPreview`, and the idea surface.
- **A neutral list-row treatment** to replace the sky-`Plus` feature list (and
  the `list-disc` cuts) — reusable wherever the wizard lists items.
- **Button balance** — a quieter "secondary action" style distinct from the
  full-width `SECONDARY_WIDE`, so approve/refine and keep-or-edit pairs stop
  reading as 50/50 forks (applies to Step 1's disclosure, this footer, and the
  quick-confirm "Change").
- **Input/textarea** — one shared field treatment (the Step 1 serif field, this
  rework textarea, the `Field` component).
- **Hairline-surface + spacing tokens** — to retire `rounded-[10px]`, the dashed
  card, and the `px-[18px]`/`px-6 pb-5 pt-6` arbitraries.

**Sequencing (unchanged recommendation):** land each step's layout locally first,
then one kit-promotion pass that updates these shared pieces and re-verifies every
step's tests together. We're now at 3 pages audited — a good point to schedule the
kit pass soon, before the shared debt compounds across steps 3–8.

---

## 8. Decisions

**Settled 2026-11-20 (John):**
1. **Document on paper** — drop the dashed frame; hairline section dividers.
2. **"The one loop"** gets the **ember left-accent callout** (the single emphasis).
3. **"Left out on purpose"** — muted minus rows, no new colour.
4. **Footer** — "Looks good" prominent primary + quieter "I'd change some things".
5. **Kit timing — do the shared-kit promotion pass NOW, as part of Step 2.** This
   is bigger than the Meet/Step 1 local changes: it touches the shared kit
   (`SECTION_LEAD`, neutral list rows, a quieter secondary-button style,
   `FounderSignals`/`SuggestedChip`) and re-verifies **every** wizard step's tests
   together (steps 1–8 + Meet), not just Step 2.

Original questions, for reference:

1. **Drop the dashed frame entirely** (document on paper, recommended), or keep a
   lighter dashed "draft" treatment on just the plan body?
2. **Emphasise "The one loop"** with a left-accent callout (recommended), or keep
   who/loop as a plain but larger pair?
3. **"Left out on purpose"** treatment — muted rows with a minus, a subtle strike,
   or just quieter text? (recommend muted rows, no new colour)
4. **Footer** — "Looks good" primary + quieter "I'd change some things"
   (recommended), or keep the 50/50 two-up because editing is first-class here?
5. **Kit timing** — still land Step 2 locally first, or make Step 2 the moment we
   do the shared-kit promotion pass (since the blueprint leans hardest on the
   shared heading/list/button patterns)?
6. Want a **clickable mockup** of the redesigned blueprint before any production
   change?
