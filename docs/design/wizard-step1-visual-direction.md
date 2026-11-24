# Wizard Step 1 — "What are we building?" — Audit & Direction

> Scope: the wizard's first step in both variants — the **library-idea** path
> (`WizardStepPanel` step `idea`, the `LibraryIdea` block, from `/start/{slug}`)
> and the **own-idea** path (`OwnIdeaStart` in `WizardFlow.tsx`, from
> `/start/own`). Audit only — no code changed yet.
>
> Date: 2026-11-20 · Companion to `meet-cofounder-visual-direction.md` (shipped).

---

## 0. The headline problem

The two variants of **the same step** look like two different products. The
library path is a left-aligned, two-column screen with three stacked bordered
boxes and an empty sidebar; the own path is a centered single column with one
input and a different primary verb. A founder who picked a library idea and one
who's typing their own are both answering *"what are we building?"* — they should
meet the same screen, not two.

On top of that, the library path repeats the "every thought in its own box"
pattern we just removed from the Meet screen: an idea card, a loud dashed-ember
"FROM THE LIBRARY" box, and two full-weight outline buttons — with the accent
colour spent on the explanatory footnote instead of the thing you're meant to do.

**Because this is step 1, most of what it touches is shared.** `Field`,
`OptionCard`, the button styles, `FounderSignals`, `StepHeadView`/`ScreenHead`,
`SuggestedChip` are used by all eight steps. So this page's direction is really a
set of **kit-level decisions** that will carry through steps 2–8 — exactly the
moment to promote the Meet redesign's patterns into the shared kit (§7).

---

## 1. What's on the screen today

**Shell (both):** header (wordmark + "Save & exit"), the 8-segment stepper with
mono caption `STEP 1 OF 8 · YOUR IDEA`, then a `max-w-[672px]` form column.

**Library variant** (`LibraryIdea`, [`WizardStepPanel.tsx:249`](components/workspace/wizard/WizardStepPanel.tsx:249)):
1. `StepHeadView` — "What are we *building*?" + "One sentence is plenty. I'll suggest everything else."
2. **Idea card** — `rounded-[10px]` card: eyebrow "Your idea" + `SuggestedChip` "Suggested · from the idea you picked" (ember), then the title in `font-editorial text-xl`.
3. **Dashed ember box** — dashed `home-orange` border + `ember-soft` fill: mono "FROM THE LIBRARY" + "**{title}**. Your co-founder starts from its research and its 4 build prompts." + "Read the research" (ember underline).
4. **Two outline buttons** — "Pick a different idea from the library" (link) + "Write my own idea instead" (toggles an inline own-idea `Field` disclosure).
5. **Primary** — full-width "Use this idea · Continue".
6. **Aside** — `FounderSignals`: "Founder signals", mono "0 logged", "Signals appear as you answer." (empty).

**Own variant** (`OwnIdeaStart`, [`WizardFlow.tsx:168`](components/workspace/wizard/WizardFlow.tsx:168)):
1. `ScreenHead` — same question + sub.
2. A bordered card wrapping one serif `Field` "Your idea in one sentence" + hint about 240 chars / "Not yet validated".
3. Full-width "Start building" (52px).
4. **No aside** — centered single column.

---

## 2. The audit (most damaging first)

### 2.1 The two variants are inconsistent — same step, two screens
- **Layout:** library = left-aligned + right rail; own = centered, no rail.
- **Primary verb:** "Use this idea · Continue" vs "Start building" — two verbs for one action.
- **Idea surface:** library shows the idea as static serif text inside a card; own shows it as a serif *input*. Reasonable (one is chosen, one is typed) but the surrounding chrome diverges completely instead of sharing a frame.
- A founder switching from "Write my own idea instead" on the library path lands in a *third* presentation (an inline disclosure field) — a third way the same input looks.

### 2.2 Stacked boxes / no single focal point (library)
Three bordered objects in a row (idea card → dashed ember box → two buttons) plus the primary. Each is a separate card; nothing leads. The **dashed-ember box is the loudest element on the page** (dashed orange border + ember fill + mono tag + underlined link) — and it's a *footnote* about provenance, not the action. The accent is spent on the least important box while the primary action is plain ink.

### 2.3 Redundancy
The idea title appears **twice**, inches apart: big in the "Your idea" card, then bolded again inside "**{title}**. Your co-founder starts from…". One idea, stated twice.

### 2.4 "Suggested" is the wrong frame for a picked idea
The ember `SuggestedChip` "Suggested · from the idea you picked" labels the idea as a *suggestion* — but the founder **chose** it from the library. "Suggested" should mean "the AI guessed this for you" (as on the platform/model/name steps where a default is pre-filled), not "you picked this." Here it over-labels and slightly misleads. Provenance ("From the library") is the honest label.

### 2.5 The escape hatches are too loud
"Pick a different idea from the library" and "Write my own idea instead" are full-width outline buttons with equal weight to the content. At the *first* step this frames the screen as a fork ("are you sure?") rather than a confident "here's your idea — continue." Mobin's best-in-class versions make the alternative a quiet link (Fibery's "or Start without AI", Mintlify's "Skip, start from a blank template").

### 2.6 The Founder-signals rail is an empty box on step 1
On step 1 there are no signals yet, so the rail is a bordered empty-state card ("0 logged / Signals appear as you answer.") taking ~30% of the width from the very first screen. It has nothing to show until step 2+. The own path (correctly) has no rail — another inconsistency, and evidence the rail is premature here.

### 2.7 The one-input card is unnecessary chrome (own)
A bordered card wrapping a single text field adds an object for no reason. The field can stand on its own (as the Meet redesign's hairline surfaces do).

### 2.8 Same system tells as the Meet screen (shared)
- **Mono as decoration:** the stepper caption, "FROM THE LIBRARY", "0 logged", the `KEPT`/`EDIT` signal tags — mono sprinkled for texture.
- **Arbitrary spacing:** `px-[18px]`, `py-4`, `rounded-[10px]`, `min-h-[52px]`, `flex-[1_1_240px]`, `leading-[1.45]` — off-grid, same as before.
- **Serif scale drift:** the idea-card title is `text-xl` editorial; the hero h1 is 34px editorial; `FounderSignals`/`CrewPreview` use `text-xl` editorial h2. No single section-lead size.

### 2.9 Accessibility — already strong, preserve it
Labeled `Field`, `aria-expanded`/`aria-controls` on the "Write my own" toggle, **Escape closes the disclosure and returns focus** to the toggle, `role="status"` saving region, `role="alert"` errors, focus-to-h1 on step change, `SuggestedChip` tick decorative with a word. Keep every one of these.

---

## 3. What's working — keep

- The editorial question headline "What are we *building*?" (and the whole `STEP_HEADS` system) — strong, on-brand.
- "Write my own idea instead" as an **inline disclosure** with Escape handling — good progressive pattern.
- The **serif idea input** — a lovely editorial touch; make it the shared idea surface.
- Honest "Not yet validated" framing for own ideas.
- "Read the research" as a real link to the idea page.

---

## 4. Inspiration (Mobbin)

- **[Fibery — "Generate the workspace for your team"](https://mobbin.com/screens/85f98468-26f4-4411-8c6e-ec175c3a1b2a)** — one prompt surface, example chips, and the alternative as a quiet "or Start without AI". The model for the own path and for demoting the escape hatches.
- **[Mintlify — "Build your knowledge base"](https://mobbin.com/screens/cfc361ff-ca31-495d-aaf4-1c406f5a3c74)** — one input card, one arrow primary, "Skip, start from a blank template" as a quiet link. Exactly the "write my own instead" treatment.
- **[Chatbase — "Let's create your first AI agent"](https://mobbin.com/screens/e6b6c766-ad61-48b3-aedd-f9a6b40bcb40)** — label + input, one Continue, calm single column.
- **[v0 — "Start from Template"](https://mobbin.com/screens/0c747dad-d666-4663-81c1-9d6d76b85c02)** — a *confirmation of the thing you picked* (preview + trust + Continue). The model for the library path: confirm the idea, don't re-advertise it.
- **[Oyster — "What kind of template is this?"](https://mobbin.com/screens/66d69c79-a167-4549-a457-42ab3463bd1e)** / **[Gamma — Generate](https://mobbin.com/screens/23a25ddc-5d71-44d3-af2b-ff2ea0ec1767)** — centered single column, one primary, examples as quiet chips.

**Common thread:** one idea/prompt surface, one primary, the alternative as a quiet link, generous air. None stack three bordered boxes; none shout provenance in the accent colour.

---

## 5. Direction — one step, two contents, one frame

Carry the Meet "hire letter" system here: one calm reading column, one accent, one type system, quiet alternatives.

### Principles
1. **One shared frame for both variants.** Same column, same heading, same primary treatment, same alternative-link row. The only thing that differs is the idea surface: a **chosen idea** (library) reads as confirmed text; an **own idea** is a serif input. Everything around it is identical.
2. **One idea surface, not three boxes.** Library: a single block — the idea title (serif) with a quiet one-line provenance underneath ("From the library · your co-founder starts from its research and 4 build prompts · Read the research"). Drop the separate dashed-ember box and the duplicate title.
3. **Honest provenance, not "Suggested".** Replace the ember `SuggestedChip` on the idea with a neutral "From the library" label. Keep `SuggestedChip` for steps where the AI actually pre-fills a default (platform, model, name, lead) — that's where "Suggested" is true.
4. **One accent, on the primary path.** Retire the dashed-orange provenance box. Ember appears only where it earns it (the current stepper segment; optionally the "Read the research" link). The loudest thing on the page is the primary action, in ink.
5. **Quiet the alternatives.** "Pick a different idea" and "Write my own instead" become quiet text links in one row under the idea (Fibery / Mintlify), not equal-weight outline buttons. The confident path dominates.
6. **One primary verb.** Standardise the continue action: library "Use this idea · Continue", own "Continue" (or "Start building" kept only because it also *creates the session* — if so, keep it but give both the same button treatment, weight and position).
7. **Defer the signals rail on step 1.** No `FounderSignals` card until there's a signal to show (step 2+). Step 1 is a single centered column in **both** variants — which also fixes the own-vs-library layout split. (Alternative if you want the rail present: replace the empty card with a single muted line, no border.)
8. **One type + spacing system.** Shared serif section-lead size, Geist body, mono only for the one system detail, 4/8 spacing — the kit tokens from §7.

### Tone
Fibery's calm confidence. Step 1 should feel like "tell me (or confirm) the one thing, I'll handle the rest" — not a fork in the road wrapped in boxes.

---

## 6. Concrete redesign (both variants on one frame)

Column: centered `max-w-[600–672px]`, `home-paper`, 8px rhythm.

**Shared top:** `StepHeadView` "What are we *building*?" + sub (unchanged copy).

**Library idea surface:**
- The idea **title** in serif (one defined size), with a small "From the library" label above it (neutral, not the ember Suggested chip).
- One quiet provenance line under it: "Your co-founder starts from its research and 4 build prompts." + "Read the research" link.
- No separate card-in-card; one hairline-framed block or a bare block on paper.
- *Ref: v0 Start-from-Template, Chatbase.*

**Own idea surface:**
- The serif `Field` on its own (drop the wrapping card), with the "Not yet validated" hint.
- Optional: 2–3 example idea chips below (like Fibery/Gamma) to lower the blank-page cost — only if you want them.
- *Ref: Fibery, Mintlify.*

**Shared alternatives row (quiet links, under the idea surface):**
- Library: "Pick a different idea" · "Write my own instead" (toggles the inline serif field — keep the disclosure + Escape behaviour).
- Own: "Pick one from the library instead".

**Shared primary:** one full-width ink button — "Use this idea · Continue" (library) / "Continue" (own), same treatment and position.

**No rail on step 1.** Introduce `FounderSignals` from step 2, when `loggedSignals` is non-empty.

---

## 7. Shared-kit deltas (this is the ripple you flagged)

Step 1 is where the Meet redesign's local patterns should graduate into the kit so steps 2–8 inherit them in one move:

**Promote into `components/workspace/kit/styles.ts` / `wizard-ui.tsx`:**
- `SECTION_LEAD` — the single serif section-lead size (replaces the ad-hoc `text-xl`/`text-2xl` editorial headings in `LibraryIdea`, `FounderSignals`, `CrewPreview`, `BlueprintCard`).
- A **quiet-link** style for subordinate actions (the alternatives row), distinct from `BTN_SECONDARY` (reserve the outline button for genuine secondary *choices*, not escape hatches).
- Hairline-surface tokens (the Meet tiles/rows treatment) to replace `rounded-[10px] border … px-[18px] py-4` card chrome.
- A spacing contract (section `gap-12`, block `gap-6`, intra `gap-3/4`) to retire the arbitrary values.

**Reconsider at the kit level (touches every step):**
- `SuggestedChip` — keep for AI-prefilled defaults; **don't** use it for user-picked content (the idea).
- `FounderSignals` — make its appearance conditional on having signals; de-mono the "N logged" and `KEPT`/`EDIT` tags (words + one quiet tint, not mono pills). This is a shared component, so change it once, deliberately, when we do the step that first shows it.

**Sequencing:** because these are shared, the safe order is (a) land Step 1's own layout using local classes first (as we did for Meet), then (b) do one dedicated "promote to kit" pass that updates the shared pieces and re-verifies every step's tests together — rather than mutating `FounderSignals`/`StepHeadView` mid-page-1.

---

## 8. Decisions

**Settled 2026-11-20 (John):**
1. **Single centered column** for both variants on step 1; the Founder-signals rail appears from **step 2** (when `loggedSignals` is non-empty).
2. **Example idea chips** on the own path — **yes**, 2–3 (click fills the field).
3. Own-path primary verb — **"Continue"** (unify with the library path).
4. **Kit timing** — land **Step 1 locally first** (like Meet), then a **separate shared-kit promotion pass** that re-verifies every step together.

Original questions, for reference:

1. **Single centered column for both variants on step 1** (recommended — fixes the own-vs-library split and the empty rail), or keep a rail that only appears from step 2?
2. **Example idea chips** on the own path (Fibery-style) — yes or no?
3. **"Start building" vs "Continue"** on the own path — unify the verb, or keep "Start building" because it also creates the session?
4. **Kit timing:** land Step 1 locally first (fast, low-risk, like Meet), then a separate shared-kit promotion pass — or do the kit promotion now and absorb the cross-step test churn in one go?
5. Want a **clickable mockup** of both variants on the unified frame before any production change?
