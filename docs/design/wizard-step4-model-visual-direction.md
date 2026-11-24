# Wizard Step 4 — "How will it make money?" (Commercial model) — Audit & Direction

> Scope: the wizard's fourth step — the commercial-model choice in
> [`WizardStepPanel.tsx`](components/workspace/wizard/WizardStepPanel.tsx:614) and
> the shared `QuickConfirm` variant ([`WizardStepPanel.tsx:142`](components/workspace/wizard/WizardStepPanel.tsx:142)).
> Audit only — no code changed. Fifth in the series.

---

## 0. Headline: the choice cards are already done — one piece remains

Step 4 is the same `OptionCard` choice pattern as Step 3 (Platform), so **the
main surface of this page is already handled** by the shared `OptionCard`
refinement we just committed (crisp ink-border selection, the suggested card's
whisper ember hairline, `rounded-xl`). The commercial-model options —
**Free for now** (suggested), **Freemium**, **Subscription**, **One-time price** —
inherit it automatically. This is the kit pass paying off: auditing Step 4 mostly
confirms Step 3's work covers it.

The one Step-4-relevant item not yet addressed is the **`QuickConfirm` variant** —
the card shown instead of the radios when the AI has a *confident* suggestion
(library ideas). It's shared by Platform, Model, and Goal, and still wears the
pre-system chrome. That's the real work here.

---

## 1. What's on the screen today

Column: `max-w-[672px]`, stepper + caption `STEP 4 OF 8 · COMMERCIAL MODEL`, and
the (de-mono'd) Founder-signals rail — now showing 4 signals cleanly.

**`StepHeadView`** — "How will it *make money*?" + "Free for now keeps checkout out of launch weekend. Switch anytime."

**Full choice** (shown for own ideas / no confident hint) — a `<fieldset>` + sr-only legend + four `OptionCard` radios (`COMMERCIAL_MODELS`), with "Free for now" carrying the "Suggested" chip. Primary: "Use suggested · Continue" when the suggested option is selected, "Continue" otherwise.

**`QuickConfirm`** (shown for a confident library-seed hint) — a `rounded-[10px]` boxed card: an `EYEBROW` "My suggestion" label + `SuggestedChip`, a serif `text-xl` title, a detail line, and a "Why I suggest it:" `ReasonLine`. Footer: a `grid sm:grid-cols-2` of "Looks right" + "Change" (both full-width).

---

## 2. The audit

### 2.1 Choice cards — already refined (verify, don't re-do)
The four model cards use the shared `OptionCard`, so the muddy `sunk` selected
fill is already replaced by the crisp ink border, and "Free for now" (suggested)
reads distinctly from "Freemium" (selected) once the Step 3 change lands. The
suggested-vs-selected separation matters **especially here**: the screenshot
shows the recommended option (Free for now) and the chosen option (Freemium)
being *different*, which is exactly the case the old muddy treatment blurred.
**No new work on the cards** — just confirm after #295 + the Step 3 commit merge.

### 2.2 `QuickConfirm` — the outstanding piece (shared across 3 steps)
The confident-suggestion card still uses the old chrome and the 50/50 footer:
- **Boxed `rounded-[10px]` card** with `px-[18px] py-4` — the pre-system
  container, inconsistent with the hairline document treatment on Meet/Steps 1–2.
- **`EYEBROW` "My suggestion"** heading — not aligned to the `SECTION_LEAD`
  system; the serif title under it is `text-xl` (its own scale).
- **50/50 footer** — "Looks right" + "Change" as two equal full-width buttons
  (`PRIMARY` + `SECONDARY_WIDE`), the same hard-fork balance we rebalanced on the
  blueprint. Confirming the suggestion should lead; "Change" should be quieter.
- The **"Why I suggest it:" reason** is genuinely good — it's the trust/reasoning
  that makes a one-tap confirm safe. **Keep it prominent.**

### 2.3 Model-specific notes (minor)
- **Copy is strong and on-ethos** — "Free for now keeps checkout out of launch
  weekend" matches the weekend-MVP "no billing" prompt standard, and suggesting
  "Free for now" is the right default. No change.
- **Four options** (vs three on Platform) — fine; no density problem. The cards
  are a touch tall (`min-h-16`), shared with Platform; optional future trim.
- **Verb logic works** — "Continue" (not "Use suggested · Continue") because the
  selected option (Freemium) isn't the suggested one. Correct.

### 2.4 Accessibility — preserve
Full choice: the `OptionCard` semantics (already strong). `QuickConfirm`: the
`ReasonLine` is linked to the accept button via `aria-describedby` (`reasonId`),
and "Change" opens the full radio choice with focus moved to the selected option.
Keep both — they're good patterns.

---

## 3. What's working — keep

- The shared `OptionCard` (now refined) carrying this step for free.
- The honest, on-ethos copy and the "Free for now" default.
- `QuickConfirm`'s "Why I suggest it:" reason and its `aria-describedby` linkage.
- The "Change" → full-choice escalation with focus management.

---

## 4. Inspiration (Mobbin)

The confident-suggestion pattern — present one AI recommendation with its
rationale, let the user confirm or refine:
- **[Confluence — "Change tone to professional"](https://mobbin.com/screens/048344a5-3f3c-4740-b41f-c8ca1e34b23f)** — a suggestion with a clear primary (Replace), a quieter Refine, and a "Tell AI what to do" field. The confirm-leads balance.
- **[Databricks — AI generate / Accept / Reject](https://mobbin.com/screens/340e5292-4ca8-4482-aea8-18882b2ca58c)** and **[Delphi — refine before saving](https://mobbin.com/screens/f68e7e9a-f4cc-442f-bf4a-4949a94eca8d)** — the suggestion shown cleanly with one accept primary and a secondary refine; no boxed-form chrome.
- (Earlier series refs still apply: **Brilliant** "Here's what I recommend" for the recommendation framing.)

**Common thread:** the recommendation is confirmed by one clear primary; the
alternative (change/refine) is quieter; the reasoning sits with it.

---

## 5. Direction — align `QuickConfirm` to the system

The full choice needs nothing (Step 3 handles it). For `QuickConfirm`:

1. **Refreshed surface** — drop the boxed `rounded-[10px]` card for the hairline
   treatment (or a light, aligned card), matching Meet/Steps 1–2.
2. **One heading system** — "My suggestion" and the suggested value in the
   `SECTION_LEAD`/eyebrow rhythm, not a one-off `text-xl`.
3. **Rebalance the footer** — "Looks right" the prominent primary, "Change" a
   quieter auto-width secondary (mirror the blueprint footer; no 50/50).
4. **Keep the reason** — "Why I suggest it:" stays prominent and
   `aria-describedby`-linked; it's what makes the one-tap confirm trustworthy.
5. **One accent** — the `SuggestedChip` is the only ember; everything else ink.

Because `QuickConfirm` is shared by Platform, Model, and Goal, this one change
aligns the confident-suggestion mode across all three quick steps at once.

### Tone
Confluence/Databricks calm: a clear recommendation with its reason, a confident
"Looks right," and a quiet way to change your mind.

---

## 6. Shared-kit note

This step adds no new shared debt — it *confirms* the `OptionCard` refinement
covers it, and scopes the remaining `QuickConfirm` alignment, which is itself a
shared component across the three quick steps. So "wiring Step 4" is really
"align the shared `QuickConfirm`," small and presentation-only, verified across
Platform/Model/Goal by the `wp90` quick-confirm tests.

---

## 7. Decisions for you

1. **`QuickConfirm` surface** — hairline treatment (recommended, matches the
   series), or keep a card but aligned to `rounded-xl` + the kit tokens?
2. **Footer** — "Looks right" prominent + quieter "Change" (recommended), or keep
   the 50/50 two-up?
3. **Scope** — align the shared `QuickConfirm` now (covers Platform, Model, Goal
   at once), or defer until we reach Goal?
4. Want a **clickable mockup** of the refined `QuickConfirm` (confident path) +
   a quick confirmation that the refined full-choice cards look right here?
