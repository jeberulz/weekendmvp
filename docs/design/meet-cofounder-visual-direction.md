# Meet Your Co-founder — UI/UX Audit & New Visual Direction

> Scope: the wizard's final screen (`components/workspace/wizard/MeetCofounder.tsx`,
> rendered by `WizardFlow.tsx` once `view.business !== null`). This is a design
> critique and a proposed direction — **no code has been changed.** Build is a
> separate, explicit go-ahead.
>
> Date: 2026-11-20 · Author: design pass (ui-ux-pro-max + Mobbin references)

---

## 0. TL;DR — why it reads "AI-generated, not designed"

The screen is *competent and accessible* but **over-articulated**. Every idea got
its own box, its own colour, and its own badge, so nothing is quiet and nothing
leads. That accretive, "one-component-per-thought" quality is exactly the tell of
machine-assembled UI. Six specific causes:

1. **Five parallel colour-coded pill systems** on one page (ember, sage, clay,
   ink, dashed-neutral) — the eye reads a quilt, not a hierarchy.
2. **Five heading treatments** mixing editorial serif and sans at 16/18/20/24/26/40px.
3. **No focal point** — hero, status bar, "What I read", "Who I hired", the dark
   "They start now" panel, and a two-item sidebar all shout at the same volume.
4. **The same facts repeated 4×** (hired/skipped counts) and the skip reasons
   stated twice.
5. **Ad-hoc spacing** (`px-[18px]`, `py-3.5`, `gap-x-3.5`, `flex-[999_1_600px]`) —
   no spacing scale, so rhythm is slightly off everywhere.
6. **A heavy dark block mid-flow** that unbalances the page weight.

The fix is **not** a new coat of paint. It's *subtraction and a spine*: one column,
one accent, one type system, one roster treatment, and progressive disclosure for
the "proof of reasoning." The brand already owns the right register (warm
"research-desk" paper + editorial serif) — we just need to let it breathe.

---

## 1. What's on the screen today (inventory)

Rendered top-to-bottom inside a `max-w-[1180px]` main with a dot-grid-free paper
background, under the 8-step progress bar (caption swapped to "Meet your co-founder"):

| Zone | Component | Treatment |
|------|-----------|-----------|
| Hero | `Hero` | Ember eyebrow, 40px editorial h1 "Hi, I'm *Jebe jebe*.", sub paragraph, 3-item bullet list, mono web-address line |
| Status | `TeamStatus` | Full-width `CARD` bar, **sans** 16px semibold h2 "Your team", icon + one status line |
| Main col (`flex-[999_1_600px]`) | `WhatIRead` | `CARD`, 20px editorial h2 + mono caption, 2–4 tiles (sunk-bordered) |
| | `WhoIHired` | 24px editorial h2 + mono "Hired · 8", `<ol>` of `HiredRow` (avatar + name/role + reason pill) |
| | `Next` | **Dark** `home-panel` panel, 11px ember eyebrow, 26px editorial h2, CTA + ghost link |
| Aside (`flex-[1_1_320px]`, max 380) | `RolesChecked` | `CARD`, 20px h2 + sentence + **13 chips** (sage "hire" / dashed "skip") |
| | `NotHiring` | 20px h2 + 5 `clay`-coloured reason cards (dashed-circle initial avatar) |
| | `MeanwhileBuilding` | Eyebrow + checklist (check / spinner / empty-ring) + mono state words |

Plus assembling / failed / terminal / unavailable states, which are genuinely well
handled (words + shape, retry that doesn't dead-end, live regions). **Keep those.**

---

## 2. The audit (by problem, most damaging first)

### 2.1 Hierarchy & information architecture — *the core problem*
- There is **no single focal point.** The emotional beat ("you have a co-founder
  and a team") competes with a status bar, a receipt ("What I read"), an audit
  trail ("Roles I checked"), and two CTAs. Everything is a card; therefore nothing
  is primary.
- **The dark `Next` panel lands in the middle of the main column**, so the visual
  climax (the CTA) is sandwiched above a lighter sidebar — the page peaks and then
  trails off instead of resolving.
- **The aside is doing primary work.** "Roles I checked" (13 pills) and "Not
  hiring" (5 clay cards) are *reasoning/proof*, i.e. reassurance — they should be
  secondary and collapsible, not a co-equal rail that's as loud as the roster.
- **Redundancy inflates the page.** The hired/skipped counts appear in `TeamStatus`
  ("hired 8 and left 5"), `WhoIHired` ("Hired · 8"), `RolesChecked` ("8 fit… 5
  don't"), and `Next` ("8 hired · 5 skipped"). Skip reasons appear both as chips
  ("SEO · skip") and as full clay cards. That's ~40% of the page restating itself.

### 2.2 Visual system incoherence — *the "AI slop" tell*
- **Five pill/badge languages**, each with its own fill+ink pair:
  1. Hired reason — core: `sunk`/`ink-2`; non-core: `ember-soft`/`orange-ink`
  2. "Stays in your chat" — solid `ink` fill, `card` text
  3. Roles-checked — hire: `sage`/`sage-ink`; skip: dashed `sunk`/`ink-2`
  4. Not-hiring reason — `clay`/`clay-ink`
  5. Eyebrows + mono tags — `ink-3` / ember
- The project's palette has **four accent hues** (ember, sage, sky, clay) that are
  meant as *semantic state* (per `globals.css` comments: sage=go/success,
  clay=stop/error, sky=info). Here they've been recruited as **decorative
  categorisation** — sage just means "hired," clay just means "skipped." That
  drains the semantic meaning and paints the page in four directions at once.
- **Two avatar treatments**: real `EmployeeAvatar` (with AI badge) for hired, a
  dashed circle with a letter for skipped. Different shapes for the same mental
  model ("a role").

### 2.3 Typography
- **Serif/sans collision within the heading role.** `TeamStatus` h2 "Your team" is
  **sans** `text-base` semibold; every other h2 is **editorial serif**. One screen,
  two definitions of "section heading."
- **Scale sprawl:** 40 (hero) / 26 (`Next`) / 24 (`WhoIHired`) / 20 (`WhatIRead`,
  `RolesChecked`, `NotHiring`) / 16 (`TeamStatus`). Five sizes, no clear step
  ratio, and `SECTION_H2` vs `SECTION_H2_LARGE` is an arbitrary split.
- **Mono overuse.** `font-mono` is used for "Your wizard answers + library
  research," "Hired · 8," "Team ready · …," and every step-state word. Mono reads as
  "system/technical"; sprinkling it as decoration cheapens the editorial tone. It
  should be reserved for the *one* genuinely system-ish detail (the web address).

### 2.4 Spacing & rhythm
- Arbitrary values throughout: `px-[18px]`, `py-3.5`, `gap-x-3.5`, `gap-y-2.5`,
  `py-[22px]`, `px-[22px]`, `rounded-[10px]`. No 4/8 grid, so card paddings and gaps
  are *almost* aligned but not quite — the subliminal "off" feeling.
- `flex-[999_1_600px]` is a grow-hack to force the column ratio; it signals the
  layout was tuned by trial rather than designed on a grid.

### 2.5 Layout
- The **two-column split is unstable**: a `600px`-ish main and a `320–380px` aside
  that, on common laptop widths, squeezes the roster rows (name + role + reason
  pill wrap awkwardly at `flex-[1_1_260px]` inside already-narrow rows).
- The **status bar as a full-width horizontal strip** between hero and content
  reads like a dismissible alert, not a confident "your team is forming" moment.

### 2.6 Motion & state
- **Spinner soup:** independent `Loader2` spinners in `TeamStatus`, `RolesChecked`,
  `WhoIHired` skeleton, and each `MeanwhileBuilding` step can spin simultaneously —
  up to ~4 spinners at once with no shared rhythm. Reduced-motion is handled
  (good), but there's no *choreography* — nothing reveals in sequence, so the
  "assembling" moment feels busy rather than alive.

### 2.7 Narrative / voice
- The first-person Crew Lead voice ("I read your answers… Who I hired… Not hiring,
  on purpose") is a genuinely strong idea — but it's **applied unevenly**: "Your
  team" (second person, sans) breaks character right after the hero's "Hi, I'm…".
  The voice should be consistent and the UI should feel like *one letter from the
  co-founder*, not a dashboard narrated in first person.

### 2.8 Accessibility — *what's already good (preserve it)*
- Live regions (`role="status"`/`aria-live`), state-in-words-and-shape, focus
  management on the status heading, `aria-current` on the stepper, sr-only labels on
  reason pills, `min-h` touch targets, reduced-motion guards, no colour-only
  signalling. **This is above average and must survive the redesign** — the new
  direction keeps every one of these affordances.

---

## 3. What's working — keep these

1. **The Crew Lead conceit** (a named co-founder who hires, skips, and explains).
   It's the emotional hook; the redesign amplifies it.
2. **The warm "research-desk" palette** (`paper`/`card`/`ink` + ember). It's
   distinctive and premium — the problem is *overuse of the secondary hues*, not
   the palette itself.
3. **Editorial serif for emotional headings.** Correct instinct; just needs one
   consistent scale.
4. **Honest, non-dead-end states** (assembling / failed / terminal / unavailable
   with retry). Best-in-class; don't touch the logic.
5. **The "Meanwhile, building" honesty** (real `launchProgress`, nothing faked).

---

## 4. Inspiration synthesis (Mobbin)

I searched Mobbin for the three patterns this screen fuses — an AI-agent intro, a
personalized "you're set up" summary, a team roster, and a build/progress state.
The most useful, and *why*:

- **[Pi — "I'm Pi / Your personal AI"](https://mobbin.com/screens/d7bddc8f-920c-4ae4-a3f2-65b2f11e0905)**
  — the closest tonal twin: warm paper, giant editorial serif, intentional
  asymmetry, radical restraint. Proof that the brand's own register can feel
  *premium* when it's quiet. **Borrow:** the confident serif hero on paper, one
  focal idea, lots of air.
- **[Fabric — "Your AI thinking partner"](https://mobbin.com/screens/d89e63b7-e082-4184-9de2-9980ff37ec4f)**
  — serif headline, a single product card, one black CTA, enormous whitespace.
  **Borrow:** resolve the page with *one* primary action, not a dark mid-page slab.
- **[Etsy — Shop team](https://mobbin.com/screens/e1599d38-0469-437d-9b56-7d0bda51e40f)**
  — the roster done calmly: avatar + name + role + one muted line, rule-separated,
  no competing chips. **Borrow:** the entire "Who I hired" row treatment.
- **[Aboard — person profile](https://mobbin.com/screens/93484c7a-b4e5-4a1b-b807-fe22e33ad634)**
  — big avatar then a row of small *labeled* tiles. **Borrow:** the "What I read"
  tiles, but quieter and label-led.
- **[AirOps — "Stand by for your report card"](https://mobbin.com/screens/0a9b3407-3578-4f6b-b18b-b6d9ae306fc4)**
  and **[Rox — Step 1 of 7](https://mobbin.com/screens/107c729c-a68d-48e3-8ece-51d43eff4215)**
  — a single slim progress bar + a short sub-step list, calm not busy. **Borrow:**
  the "assembling" and "Meanwhile building" treatment — one progress spine, not
  four spinners.
- **[Linear — "You're good to go"](https://mobbin.com/screens/287d9435-e8b9-497f-a632-9bdbd827414c)**
  and **[ChatGPT — "You're all set"](https://mobbin.com/screens/585f5ac6-c97e-4970-85f9-2272e72a86b2)**
  — how restrained a "setup complete" screen can be: centered, one accent, one
  button. **Borrow:** the discipline, not the literal centering.

**Common thread across the premium examples:** one accent, massive whitespace, one
clear primary action, serif for the one emotional line, and *strict* restraint on
chips and colour. The current screen violates each of these — which is the whole
diagnosis in one sentence.

---

## 5. The new direction — "The hire letter"

**Big idea:** present the whole screen as **one calm, editorial letter from your
co-founder** — a single reading column with a clear spine, where the team is
introduced like a real roster and the reasoning is available but never shouting.
It should feel *written and art-directed by one person*, not assembled by a
committee of components.

### Five principles

1. **One spine, one column, one climax.** A single centered reading column
   (≈ 720px) with generous vertical rhythm. Order:
   `Hero → forming/ready status (inline, not a bar) → Who I hired → What I read →
   How I decided (disclosure) → the single way forward`. The CTA is the *resolution*
   at the bottom, not a dark slab in the middle.
2. **One accent.** Ember/orange (`home-orange`/`home-orange-ink`) is the only
   decorative hue. Ink + paper + card + rule carry everything else. Sage and clay
   survive **only** as genuine state (success tick / error), never as "hired vs
   skipped" categorisation.
3. **One type system.** Editorial serif for emotional headings at a strict 3-step
   scale (40 / 24 / 18); Geist sans for all body and labels; eyebrows in a single
   uppercase ink-3 style; **mono reserved for the web address alone.** "Your team"
   becomes serif like everything else.
4. **A quiet roster.** Hired specialists as rule-separated rows: avatar · name ·
   role · one-line "does" · a *muted* one-line "why" (ink-2 text, no coloured pill).
   The Lead gets one subtle distinction — a hairline ink ring + a single small
   "Stays in your chat" tag — not a solid-black pill.
5. **Compress the proof.** Replace the 13-pill cloud + 5 clay cards with: one
   sentence, a compact **"8 of 13 roles hired"** meter, and a single
   **"Why I left 5 out" ▸** disclosure that expands to the muted reasons. Reasoning
   is reassurance; it should reward curiosity, not tax every viewer.

### Tone target
Pi's calm × a founder's letter. Confident, warm, unhurried. The reader should feel
*"someone capable has this handled,"* not *"a system generated a report about me."*

---

## 6. Concrete redesign spec (section by section)

Column: `max-w-[720px]` reading measure, centered, on `home-paper`. Vertical rhythm
on an **8px scale**: section gaps `48px` (`gap-12`), intra-section `16–24px`. Retire
all `px-[18px]`/`py-3.5`/`flex-[999…]` arbitraries.

### 6.1 Hero — unchanged intent, tighter
- Keep ember eyebrow + 40px editorial "Hi, I'm *Name*." + sub.
- **Cut the 3-bullet list** into the body or into "How I decided"; it currently
  front-loads detail before the reader has met the team. Keep the web-address line
  (the *one* mono detail), de-emphasised to `ink-3`.
- *Ref: Pi, Fabric.*

### 6.2 Status — inline, not a bar
- Remove the full-width `CARD` strip. Fold status into **one line directly under the
  hero**: a single state dot/tick + "{Name} is putting your team together…" →
  on ready, "{Name} hired 8 and left 5 out." This is the *only* place the count
  appears in prose.
- Heading "Your team" becomes a serif section lead **or** disappears (the line
  self-describes). Keep the live region and focus logic verbatim.
- *Ref: AirOps status line.*

### 6.3 Who I hired — the quiet roster (now the visual centre)
- Promote this to the **primary** block (it's the payoff). Single serif h2 "Who I
  hired" + plain "8" count (no mono).
- Each row: `avatar(lg)` · column[`name` bold · `· role` ink-2 · `does` ink-2 sm] ·
  then the **why as a muted single line** right-aligned or on a second line
  (`ink-2`, no fill, no border). Rule divider between rows (`border-home-rule`),
  not a bordered card per row — lighter, more "roster."
- **Lead distinction:** hairline `ring-1 ring-home-ink/15` + one small ember-less
  "Stays in your chat" tag (ink-2 on card). Drop the solid-black pill.
- Unify the skipped avatar treatment with this one (same circle, dashed only to
  signal "not hired").
- *Ref: Etsy Shop team, Notion team list.*

### 6.4 What I read — quiet receipt
- Keep the tile grid but make it **label-led and hue-free**: `EYEBROW` label,
  value in `ink`, detail in `ink-3`, hairline `home-rule` separators or a 2×2 grid
  with minimal borders. Drop the mono caption; a serif "What I read" h2 + plain sub
  is enough.
- *Ref: Aboard labeled tiles.*

### 6.5 How I decided — one disclosure, not a rail
- Collapse `RolesChecked` + `NotHiring` into **one section** with:
  - a single sentence: "I checked 13 roles against {business}. 8 fit; 5 didn't."
  - a slim **meter**: `████████░░░░░ 8 / 13` (ink fill on rule track — *not* sage).
  - a **"Why I left 5 out" ▸** expandable → the 5 reasons as muted rows
    (`ink-2`, dashed-circle initial, one line each). No clay fills.
- This removes the 13-pill cloud entirely and the colour quilt with it.
- *Ref: progressive disclosure; Linear restraint.*

### 6.6 The way forward — one resolution
- Replace the mid-page dark `home-panel` slab with a **single calm closing block**
  at the bottom: serif line "They start now. *I keep the chat.*", one sentence,
  **one primary button** ("Go to your workspace") + one quiet ghost link ("Meet
  your team in Team HQ"). Light, on paper — reserve the dark panel (if used at all)
  for a thin footer accent, not a mid-column slab.
- *Ref: Fabric / ChatGPT single-CTA resolution.*

### 6.7 Meanwhile, building — one progress spine
- Keep the honest checklist, but give it **one shared rhythm**: a single slim
  progress line (done/total) + sub-steps with a *single* active indicator at a time;
  staggered fade-in as steps complete. No independent spinners elsewhere on the page.
- Place it **under** the CTA (it's ambient/background work), de-emphasised.
- *Ref: AirOps, Rox, SoundCloud stepper.*

### 6.8 Assembling state — choreograph it
- During assembly, reveal roster rows in sequence (80–120ms stagger, reduced-motion
  → instant) so "the team is forming" is *felt*, not spun. One accent spinner at the
  status line only.

---

## 7. Design-system deltas (`components/workspace/kit/styles.ts` + tokens)

**Add**
- `SECTION_LEAD` — one serif section heading (e.g. `font-editorial text-[22px]
  font-normal text-home-ink`). Replaces both `SECTION_H2` and `SECTION_H2_LARGE`.
- `ROSTER_ROW` — rule-separated row (no per-row border/card).
- `META_LINE` — the muted "why/does" line (`text-sm text-home-ink-2`), the single
  replacement for the ember/sunk/clay reason pills.
- `METER` — ink-on-rule progress track for "8 / 13".
- A spacing contract comment: section `gap-12`, block `gap-6`, intra `gap-3/4`.

**Retire (on this screen)**
- The ember/sunk reason-pill pair in `HiredRow`.
- The sage/dashed chip pair in `RolesChecked` (replaced by the meter + disclosure).
- The clay reason cards in `NotHiring` (replaced by muted disclosure rows).
- The solid-ink "Stays in your chat" pill (replaced by ring + quiet tag).
- `font-mono` everywhere except the web address.

**Constrain**
- Sage → success state only. Clay → error state only. Sky → info only. None used as
  category colour.

---

## 8. Suggested phasing (once you say build)

1. **Spine + type pass** (highest impact, lowest risk): single column, one heading
   style, kill mono, fix spacing scale. ~½ the perceived improvement, touches layout
   + `styles.ts` only.
2. **Roster + proof pass:** Etsy-style rows, collapse Roles-checked/Not-hiring into
   the meter + disclosure.
3. **Resolution + motion pass:** single closing CTA, one progress spine, staggered
   assembly reveal.

Each phase keeps every existing a11y affordance and the launch/retry logic
untouched; the WP90/WP91 data contracts (`launchStatus`, `launchProgress`, roster
seeds) don't change — this is presentation only. `npm run typecheck` + the
`wp74`/`wp75`/`l1-wizard-fidelity` UI tests are the gates; several assert current
copy/structure (e.g. `wp75-meet-cofounder-team`), so expect to update those
alongside.

---

## 9. Decisions for you

1. **Centered single column vs. keep an asymmetric layout?** I'm recommending a
   single ≈720px reading column (Pi/Fabric). The alternative is a lighter
   two-column where the right rail is *only* "Meanwhile building" (ambient), never
   the reasoning.
2. **How hard to lean into "the letter"?** Full editorial (serif section leads,
   first-person throughout) vs. a lighter touch (serif hero only, sans sections).
3. **Keep any dark surface?** I'd drop the mid-page `home-panel` slab entirely; open
   to a thin dark footer accent if you want one moment of contrast.
4. **Want a clickable mockup?** I can build a static HTML/React prototype of the
   redesigned screen (dummy data, the real tokens) so you can judge it live before
   any production change — that's the natural next step.
