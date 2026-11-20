# Wizard Step 3 — "Where should it live first?" (Platform) — Audit & Direction

> Scope: the wizard's third step — the platform choice in
> [`WizardStepPanel.tsx`](components/workspace/wizard/WizardStepPanel.tsx:582), the
> shared `OptionCard` ([`wizard-ui.tsx:85`](components/workspace/wizard/wizard-ui.tsx:85))
> radio pattern it uses, and the `QuickConfirm` variant. Audit only — no code
> changed. Fourth in the series (Meet, Step 1, Step 2).

---

## 0. Headline: this is the strongest step — refine, don't rework

Step 3 is the cleanest page in the wizard. The vertical radio-card pattern is the
right choice (it matches Airbnb's and Mintlify's best-in-class versions), the
accessibility is excellent (real radios, arrow keys, filled-dot selection that
isn't colour-only, sr-only legend), and the "Suggested" chip + "Use suggested ·
Continue" is a genuinely nice touch. So this is a **refinement** pass: crisp up
the selected state, separate "suggested" from "selected" so they don't pile onto
one card, and align the card tokens/spacing to the system from Meet/Steps 1–2.
It also lands the shared `OptionCard`, so these changes carry to the Model, Goal,
and Personality steps too.

---

## 1. What's on the screen today

Column: `max-w-[672px]`, stepper + caption `STEP 3 OF 8 · PLATFORM`, and the
(now de-mono'd, post-kit-pass) Founder-signals rail showing 2 kept signals.

**`StepHeadView`** — "Where should it *live* first?" + "Pick what you can ship this weekend. Native apps can come later."

**The choice** ([`WizardStepPanel.tsx:582`](components/workspace/wizard/WizardStepPanel.tsx:582)) — a `<fieldset>` with an sr-only legend and three `OptionCard` radios:
- **Mobile web, installable** — "Works on any phone and adds to the home screen. Ships this weekend." (pre-selected + ember "Suggested" chip)
- **iOS and Android app** — "App-store apps. Review queues add days, not hours."
- **Something else** — "Desktop tool, browser extension, API. Tell me." (→ reveals a "Describe the platform" `Field`)

**`OptionCard`** ([`wizard-ui.tsx:85`](components/workspace/wizard/wizard-ui.tsx:85)) — a `<label>` wrapping a visually-hidden real radio; a 20px ink-ring indicator with a filled dot when checked; label + hint; `SuggestedChip` when suggested. Checked state: `has-[:checked]:border-home-ink` + `has-[:checked]:bg-home-sunk`. `rounded-[10px]`, `min-h-16`, `px-4 py-3.5`.

**Primary** — "Use suggested · Continue" (full-width ink) when the suggested option is selected; "Continue" otherwise.

**`QuickConfirm` variant** (when a confident hint exists) — instead of the radios, a "My suggestion" card with the `SuggestedChip`, a serif title, a detail line, and a "Why I suggest it:" reason, with a "Looks right" / "Change" footer.

---

## 2. The audit (smaller surface — polish, not rework)

### 2.1 The selected state is muddy, and it collides with "suggested"
The checked card fills with `home-sunk` — a muddy beige very close to the paper
background, so the selection doesn't read crisply (compare Airbnb's clean bold
border on near-white). And on load the **suggested option is pre-selected**, so
one card carries *three* signals at once: the ember "Suggested" chip, the ink
border, and the `sunk` fill. "Recommended" and "selected" are different ideas
(you can select a non-recommended option), but here they pile onto the same card
and read as one blob. When the founder picks another option the signals separate
and it's clearer — but the first impression is muddiest.

### 2.2 Token drift from the new system
`rounded-[10px]`, `min-h-16`, `px-4 py-3.5`, `gap-2.5` — the cards predate the
Meet/Steps 1–2 alignment (`rounded-xl`, the 4/8 spacing scale). They're a touch
tall/heavy for three short options.

### 2.3 The primary verb logic is good but could be quieter about it
"Use suggested · Continue" → "Continue" as the selection changes is a nice
micro-interaction; no change needed, just noting it's correct and worth keeping.

### 2.4 `QuickConfirm` card uses the older card chrome
The quick-confirm variant ("My suggestion" + reason) still uses
`rounded-[10px] border … px-[18px] py-4` and an `EYEBROW` "My suggestion" label —
the same pre-system card chrome. It should align with the refreshed option cards
and the `SECTION_LEAD`/hairline treatment.

### 2.5 Accessibility — excellent, preserve it
Real hidden radios inside labels (arrow keys, Space, label clicks all work), the
filled-dot indicator (selection is shape, not colour alone), the sr-only
`<legend>`, focus-visible ring on the card, the custom-platform `Field` revealed
only when "Something else" is chosen. This is the model the other steps should
match — keep every bit.

---

## 3. What's working — keep

- **The vertical radio-card pattern** (Airbnb/Mintlify) — correct for three
  text-heavy options; don't switch to a horizontal 3-up.
- **The filled-dot radio indicator** and all the keyboard/label semantics.
- **The "Suggested" chip** — a legit, honest use (the AI really did suggest the
  default), consistent with the Step 1 ruling to keep `SuggestedChip` for
  AI-prefilled defaults.
- **"Use suggested · Continue" → "Continue"** verb logic.
- **Progressive "Describe the platform"** field for "Something else."

---

## 4. Inspiration (Mobbin)

- **[Airbnb — "What type of place will guests have?"](https://mobbin.com/screens/99ce8d26-0700-4d0c-a282-4d02f2e0bdd1)** — the gold standard: vertical cards, the selected one marked by a **crisp bold ink border** on near-white (no muddy fill), description per option. The model for the selected state.
- **[Brilliant — "Here's what I recommend"](https://mobbin.com/screens/da4c4452-1b86-42b7-bab4-de610a9872ca)** — a **"TOP PICK"** badge marks the recommendation *independently* of the selected border. The model for separating "suggested" from "selected."
- **[Mintlify — "How do you want to make updates?"](https://mobbin.com/screens/3abddd12-6ef2-4abb-a075-4f4c6216d781)** — minimal radio-cards (icon + title + description, radio on the right), one primary + a quiet skip. Clean token reference.
- **[Uxcel — recommended vs starting place](https://mobbin.com/screens/fb7799b3-75b1-486d-a8d3-fce715b245f4)** — selected card = coloured border + an "or press Enter" affordance by the primary. Optional keyboard-hint idea.

**Common thread:** the selected option is marked by a **crisp border** (not a
muddy fill); the recommended option is marked by a **separate badge**; the two
never merge into one blob.

---

## 5. Direction — crisp the selection, separate the recommendation, align tokens

Carry the Meet/Steps 1–2 system; this is mostly token work plus one real fix.

### Principles
1. **Crisp selected state.** Replace the muddy `sunk` fill with a clean selection:
   a stronger ink border (and/or a hairline ink ring) on the card's own
   near-white, so the chosen option reads instantly. Keep the filled-dot radio.
2. **Separate "suggested" from "selected."** Keep the ember "Suggested" chip as
   the *recommendation* marker (Brilliant's badge role); let the border + dot be
   the *selection* marker. They should look different, so when they coincide on
   load it reads as "recommended *and* selected," not one undifferentiated block.
   Optionally give the suggested card a whisper-subtle ember hairline so the
   recommendation is legible even before the eye reaches the chip.
3. **Align tokens.** `rounded-[10px] → rounded-xl`, tighten `min-h`/padding to the
   4/8 scale, and match the card border/hover to the refreshed kit. Three short
   options shouldn't need `min-h-16`.
4. **Align `QuickConfirm`.** Bring the quick-confirm card to the same refreshed
   treatment (hairline surface, `SECTION_LEAD`-consistent heading), so the two
   modes of a choice step feel like one system.

### Tone
It already has the right calm. The goal is only to make "this is the pick, and
it's selected" unmistakable at a glance, and to retire the muddy fill.

---

## 6. Concrete refinement

- **`OptionCard` (shared)** — selected: `has-[:checked]:border-home-ink` kept, but
  swap `has-[:checked]:bg-home-sunk` for a crisp treatment (e.g. a 1.5px ink
  border / ring on `bg-home-card`, or a very light ember-tint only for the
  *suggested* card). `rounded-[10px] → rounded-xl`; trim `min-h-16`/`py-3.5` to the
  scale. Keep the indicator, label, hint, and `SuggestedChip` exactly.
- **Suggested card** — optional whisper ember hairline (`border-home-orange-ink/30`)
  so the recommendation is visible before the chip.
- **`QuickConfirm`** — hairline surface, heading aligned to the kit, same chip and
  `ReasonLine`.
- Platform-specific layout (fieldset, custom `Field`) — unchanged.

---

## 7. Shared-kit note

`OptionCard` is used by **Platform, Commercial model, Goal (kinds + the timeframe
pills), and Personality**. So the selected-state and token refinements here land
across four steps at once — a good, low-risk continuation of the kit pass we just
did (the blueprint PR). The `pill` variant (goal timeframes) inherits the same
treatment, so check both variants when refining. No data contracts change; this is
presentation only.

---

## 8. Decisions

**Settled 2026-11-20 (John):**
1. **Selected state** — a crisp ink border + inset ring on `bg-home-card` (no muddy `sunk` fill), Airbnb-style.
2. **Suggested marker** — the "Suggested" chip **plus** a whisper ember hairline on the suggested card.
3. **Scope** — refine the shared `OptionCard` itself, so all four choice steps (Platform, Model, Goal, Personality + the goal timeframe pills) move together. Wider test surface, one coherent change.

Original questions, for reference:

1. **Selected-state treatment** — crisp ink border/ring on `bg-home-card`
   (recommended, Airbnb-style), or a light ember-tint fill for the selected card?
2. **Suggested marker** — keep only the "Suggested" chip, or also add a whisper
   ember hairline to the suggested card so the recommendation reads before the
   chip?
3. **Scope** — refine just Platform now, or apply the `OptionCard` refinement
   across all four choice steps (Platform, Model, Goal, Personality) in one pass
   since it's a shared component?
4. Want a **clickable mockup** of the refined choice step (showing suggested vs a
   non-suggested selection, plus the `QuickConfirm` variant) before any change?
