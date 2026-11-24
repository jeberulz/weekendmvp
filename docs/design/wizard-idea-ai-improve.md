# Improve your idea with AI (wizard Step 1)

WP100. Status: design for review. Owner decisions are listed at the end.

## Why

A founder on `/start/own` types a rough sentence. The wizard turns it into a light blueprint marked "Not yet
validated". Many first sentences are vague ("an app for gyms"), and a vague sentence gives a vague blueprint and a
vague crew brief.

The feature helps the founder sharpen their own sentence so they feel good about continuing. It is there to encourage
them, not to correct them:

- It never takes the idea over. It keeps the founder's subject, audience and words wherever it can.
- Nothing changes until the founder says so. The suggestion sits next to their text, never in place of it.
- They can always get back to their own words.
- "Keep yours" is a normal, respectable choice. The copy never suggests their sentence was wrong.

## 1. UX

### Entry points

| Entry | What it does | Notes |
|---|---|---|
| **Improve** button in the field's bottom toolbar (icon plus visible word) | Sharpens the whole sentence | The main path. It works the same with a mouse, by touch or by keyboard. |
| **Select part of the text** | The same button changes its label to **Improve selection** and rewrites only the selected words | There is no floating popover. A `<textarea>` cannot report where a selection is on screen, and popovers over text are fragile on touch. The button lives in one place and only its label changes. |
| **Keyboard shortcut** `Ctrl/⌘ + Shift + Enter` in the field | Same as pressing the button | Exposed through `aria-keyshortcuts` and the button's tooltip. Plain `Enter` still submits the step, as today. We avoided `⌘/Ctrl+I` (Firefox page info) and `Ctrl+Shift+I` (devtools). |

Why one button and not a sparkle icon on its own: an icon-only "magic" button is easy to miss and unclear to screen
readers. The button carries a small icon and the word "Improve", so its purpose is plain.

The button is disabled, with a hint, until the field has at least 3 words ("Write a few words first"). The model can
only improve something that is already there.

### States

```
idle ──Improve──▶ loading ──▶ suggestion ──Use this──▶ accepted (Undo available)
  ▲                  │             │  ├──Try again──▶ loading
  │                  │             │  └──Keep mine───▶ idle (text untouched)
  │                  ▼             ▼
  └──────────── error / rate_limited / unavailable / already_clear (text untouched)
```

| State | What the founder sees | Field |
|---|---|---|
| **idle** | The field and the **Improve** button. With text selected, the button reads **Improve selection**. | Editable |
| **loading** | The button shows a spinner and "Improving…". A **Stop** button appears. The field shows a quiet shimmer on its border. | Read-only while waiting (about 1–2 s), `aria-busy` |
| **suggestion** | A card below the field headed "A sharper version". It shows the full suggested sentence, with the changed words marked (`<mark>`), and a one-line note on what changed (for example "Named who it's for and what they do first"). Buttons: **Use this** (primary), **Try again**, **Keep mine**. Under them: "You can still edit it after." | Editable. If the founder types, the card stays but says "Based on your earlier text" |
| **accepted** | The field holds the new sentence. A quiet line under it reads "Sharpened with AI · **Undo**". After two or more rounds, Undo goes back one round, and **Back to my words** returns the founder's own text. | Editable |
| **already_clear** | "Your sentence is already clear. Nothing to change." | Unchanged |
| **error** | "Couldn't improve it just now. Your idea is unchanged." plus **Try again** | Unchanged |
| **rate_limited** | "You've used today's improvements. Your idea works as it is, so carry on." | Unchanged; the button is disabled until tomorrow (UTC) |
| **unavailable** | The button is hidden while AI is switched off (kill switch or feature off). If a call is refused partway through, the same message as error. | Unchanged |

What "never silently overwrite" means in practice: the field's value changes only when the founder clicks **Use this**,
**Undo** or **Back to my words**, or types.

**Encouragement copy rules**: no "fixed", "corrected" or "better than yours". Use "sharper", "clearer", "your idea".
The change note is written by the model and limited to 90 characters. It says what was made clearer, never what was
wrong.

### Mobile

- Selecting text on touch is awkward (handles, the system menu). The whole-idea **Improve** is the default and is
  enough on its own. Selection mode still works when the founder manages a selection, because the button label follows
  `selectionchange`.
- The suggestion card sits in the normal flow under the field, never in a popover or a sheet. The keyboard can stay
  open, and the card scrolls into view (`scrollIntoView({ block: "nearest" })`).
- Every button is at least 44×44 px. The action row wraps to two lines at 375 px.

### Accessibility

- **The button** is a real `<button type="button">` with a visible label ("Improve" / "Improve selection"), an
  `aria-describedby` hint, and `aria-keyshortcuts`. The icon is `aria-hidden`. While loading it sets
  `aria-disabled` but stays focusable, so focus is never lost.
- **One live region** (`role="status"`, `aria-atomic="true"`) announces each change in a full sentence: "Suggestion
  ready: {sentence}. Use this, try again or keep yours.", "Your idea now reads: {sentence}. Undo is available.",
  "Restored your words.", the error text, and the rate-limit text. Nothing else on the step is a competing live region.
- **Focus**: when a suggestion arrives, focus does not jump (the founder may still be reading). The announcement tells
  them where it is, and Tab reaches **Use this** next. After **Use this**, **Keep mine**, **Undo** or **Back to my
  words**, focus goes back to the field with the caret at the end. **Stop** returns focus to **Improve**.
- **The diff** uses `<mark>` with an `sr-only` "changed:" prefix, so it does not rely on colour. Contrast follows the
  `home-*` tokens (AA).
- **Reduced motion**: the shimmer and the card's entrance are disabled under `prefers-reduced-motion`.

## 2. Data

### What is stored

**New table `wizard_idea_improvements`**: one row per improve call. It is the audit trail and the source of the
original text.

| Field | Meaning |
|---|---|
| `ownerId` | The founder, taken from auth |
| `mode` | `"whole"` or `"selection"` |
| `inputText` | The field text when they pressed Improve |
| `selection` | `{ start, end }` in selection mode |
| `originalText` | The founder's own words before any AI round. A later round inherits it from the round it builds on (`parentId`). |
| `parentId` | The accepted round this one builds on, if any |
| `status` | `pending` → `suggested` / `already_clear` / `rejected` (failed our checks) / `failed` (gateway) / `rate_limited` is not stored (no row: the limiter refuses first) |
| `suggestion`, `changeNote`, `hints` | The checked output |
| `outcome` | `accepted` / `dismissed` / `retried` / `undone`. Set by the founder's click. |
| `usageIds`, `chargedMicroUsd` | The meter's rows for this call |
| `createdAt`, `decidedAt` | |

**On the wizard session**, written when the founder presses Continue (`startOrResume`) or rewrites the idea after Back
(`rewriteStep`), and only when the client passes an `improvementId` that belongs to the founder and whose outcome is
`accepted`:

```ts
ownIdeaAi?: {
  improvementId: Id<"wizard_idea_improvements">;
  originalText: string;            // the founder's own words, never overwritten
  suggestedText: string;           // what the model offered
  editedAfter: boolean;            // final text !== suggestedText
  hints?: OwnIdeaHints;            // only when editedAfter is false (see §3)
}
```

`ownIdeaText` and `answers.idea.text` stay exactly what they are today: the final text the founder chose. So every
existing reader keeps working without change.

### Founder signal

The decision: **a separate signal action, `ai_improved`**, used instead of `rewrote` when the founder continues with an
accepted suggestion.

- `before` holds the founder's original words and `after` holds the final text. Today's `rewrote` signal has
  `before: none`, so it would lose the original.
- In the `answers.signals` mirror (what the crew prompts read through `answersForPrompt`), it maps to `edited` with the
  note "Sharpened idea with AI: {original} → {final}". The crew learns the founder accepted an AI rewrite and sees
  their original wording, without a prompt version bump: the mirror is data, not prompt text.
- The Step 2 rail tag reads `EDIT`, and the note says "with AI".
- Why one signal and not two (`rewrote` plus `ai_improved`): it is one founder decision, and two rows would make the
  rail and any later analytics count it twice.

The founder signal is written only when they continue. Clicking around inside Step 1 (improve, dismiss, retry) is
recorded on the improvement rows, not as signals, so the rail stays a list of decisions.

## 3. Effect on the blueprint (Step 2)

Today an own idea's blueprint is mostly boilerplate (`lib/workspace/wizard/light-blueprint.ts`):

- `pitch` is the sentence with market claims stripped, cut to 160 characters;
- `oneUser`, `oneLoop`, `features` and `scopeCuts` are generic constants;
- the Option A seam (a gateway-drafted outline, `ownIdeaDraft` in `wizardSeedFor`) is built but never fed.

A sharper sentence on its own improves only `pitch`, the business-name default (`nameFromOwnIdea`) and the crew's
`founderIdea`. To be worth more than that, the blueprint has to use what the improve call already understood.

**One shared extraction step.** The improve call already reads the idea, so it also returns small structured hints in
the same response, at no extra call:

```ts
// lib/workspace/wizard/idea-hints.ts (the shared shape, defined once)
type OwnIdeaHints = {
  audience: string | null;    // who it's for, plural, ≤ 60 chars: "weekend campers"
  coreAction: string | null;  // the one thing they do, ≤ 80 chars: "get a packing list that matches the forecast"
  offer: string | null;       // what the founder sells or gives, ≤ 80 chars, only if they said it
};
```

The same D15 market-claim check as the blueprint (`hasMarketClaim`) runs on every hint. A hint that fails is set to
null, so a bad hint never blocks a good sentence.

**How the enrichment uses it** (shared with `wizard-e2e-audit` for `docs/design/wizard-own-idea-blueprint-enrichment.md`):

1. **When hints exist and the founder did not edit after accepting** (`ownIdeaAi.hints` present): the enrichment uses
   them directly. `oneUser` comes from `audience`, `oneLoop` from `coreAction`. This is deterministic and costs no
   extra AI, so it can ship even before Option A is approved.
2. **When there are no hints** (the founder never pressed Improve, edited after accepting, or the hints failed the
   check): the enrichment's own extraction runs. It calls the same extraction prompt that `wizard-idea-improve` uses,
   in an "extract only" mode, returning the same `OwnIdeaHints` shape. So there is one prompt, one schema and one
   check, and the cost is paid at most once per idea.
3. **The Option A gateway draft** (if approved) receives the hints as one more quoted data block, so the draft doesn't
   rediscover the audience.

Hints are kept only while the final text equals the suggested text. Any edit afterwards drops them (`editedAfter:
true`) rather than letting the hints describe a sentence that no longer exists.

## 4. Effect on the rest of the platform

Where the idea text goes after the wizard (research map, 2026-11-24):

| Reader | What it reads | With an AI-improved idea |
|---|---|---|
| `createBusiness` → `projects.workspace.ownIdeaText` | the final text | The improved text. Unchanged code. |
| Crew `<business_context>` `founderIdea` (`lib/workspace/crew/context.ts`) | `ownIdeaText` | The improved text, in every crew step. |
| Blueprint prompt `own_idea` block (`blueprintOwnIdea.v3`) | `ownIdeaText` | The improved text. Its rule "sharpen it, do not replace it" still holds. |
| Crew `answers` (`answersForPrompt` → `answers.signals`) | the signal mirror | Now says "Sharpened idea with AI: {original} → {final}", so the crew sees the original wording too. |
| Wren chat and memory (`chat.ts`, `wrenMemory.ts`) | `founderIdea` | The improved text. |
| Quality checks (`checks/`, `quality.ts`) | only `source === "own_idea"` | Unchanged. AI help does not make an idea validated: it stays "Not yet validated" (D15). |
| Seeds (`idea_crew_seeds`) | library ideas only | Not affected. |
| Build prompts | none exist yet | Will read `ownIdeaText` (the improved text). |

**Where the original must stay available**:

- On the session (`ownIdeaAi.originalText`) and on the improvement rows, for the team and later analytics. The session
  links to the project through `wizard_sessions.projectId`.
- In the crew's view, through the signal note.
- Nothing needs it on `projects` today. If a later feature (for example "your idea, then and now" in the workspace)
  needs it there, copy `ownIdeaAi` into `projects.workspace` in `createBusiness`. That is a two-line change, left out
  until something reads it.

**Account deletion** (WP96): `wizard_idea_improvements` joins the owner drains in `convex/account/purge.ts`. The data
map gains a row.

**The cost console** (WP93): calls show up under the prompt ref `wizard-idea-improve@1`, in the category "other". They
are owner-scoped rows (`ownerId`, no project), so they count toward the founder's daily cap and the Free lifetime
ceiling, as a pre-business wizard spend should.

## 5. Model, metering and cost

### Path

The client calls the public action `api.workspace.ideaImprove.improve({ text, selection?, parentId? })`. The action:

1. Runs the internal mutation `begin`. It derives the founder from auth, checks the `ai` and `workspace` features,
   applies the per-founder limit (C-LIMITS `ideaImprove`), validates the text and inserts the `pending` row.
2. Calls `internal.ai.gatewayActions.runPrompt` with the prompt ref `wizard-idea-improve@1`, `ownerId`, and a new
   C-METER key form, `idea_improve`: `idea-improve:{improvementId}:{attempt}`. The gateway does reserve → call →
   validate → settle, with one re-ask on a schema failure (D23). Nothing bypasses the meter.
3. Re-parses the output, applies the guardrails in code, splices a selection back into the sentence, and runs
   `finish` to record the result.
4. Returns a typed result: `suggested | already_clear | rejected | rate_limited | unavailable | failed`. It never throws
   to the UI.

**Why a new key form.** The existing `wizard` key needs a `wizard_sessions` id, and on `/start/own` there is no
session until Continue (`startOrResume` creates it and commits the idea step at once). Creating a session early would
spend the 3-per-day `wizardStart` allowance and commit an idea the founder hasn't chosen yet. The new form follows the
`wizard` form's rules exactly: it needs `ownerId`, refuses a project, task, debit or business context, and the caller
checks that the improvement row is the owner's. It is a C-METER contract change, so it is listed for owner approval.

### Model

`fast` tier, which is **Haiku 5.5** (`claude-haiku-5-5`), effort `low`, thinking `disabled`, `maxTokens` 400. Not
Sonnet, never Opus. The router takes the model from the tier, so nothing at call time can upgrade it.

### Cost per call

Rates: Haiku 5.5 is $0.10 per million input tokens and $0.50 per million output tokens (`convex/ai/pricing.ts`).

| | Tokens (estimate) | Cost |
|---|---|---|
| System rules | ~450 | |
| Task block (idea, selection, quoted) | ~120 | |
| **Input** | **~570** | $0.000057 |
| **Output** (sentence, note, hints, JSON) | **~130** | $0.000065 |
| **Typical call** | | **≈ $0.00012** (about 0.012¢) |
| Reservation (input bound + 400 out) | | ≈ $0.00026 |
| Worst case with the one re-ask | | ≈ $0.0005 |

The system block is below the minimum cacheable prompt length, so there is no prompt caching. At this size it doesn't
matter.

### Caps

- **Per founder: 20 improve calls per UTC day** (C-LIMITS fixed window, the same mechanism as `wizardStart`). Unlimited
  owners skip it, like the other wizard limits. Worst case: 20 × $0.0005 = **$0.01 per founder per day**, which is 1%
  of the Free daily cap ($1.00) and 0.7% of the Free lifetime ceiling ($1.50).
- **In flight: one at a time.** The button is disabled while loading. The server does not need a lock, because each
  call is its own row and key.
- **The meter's own gates still apply**: the kill switch, the `ai` feature, the global pools, the owner daily cap and
  the Free lifetime ceiling.

At the cap: the limiter refuses in `begin`, before any row, reservation or model call. The founder sees "You've used
today's improvements. Your idea works as it is, so carry on." The field and Continue work normally.

Budget refused (`BUDGET_EXHAUSTED`) or AI off (`AI_DISABLED`): the meter refuses before any call. The founder sees the
error state (or no button, when the client already knows AI is off). Nothing is charged.

## 6. Guardrails (in code, after the model)

The prompt asks for these, and code checks them anyway. A check failure returns `rejected` ("Couldn't find a sharper
version. Yours stands."), never the bad text.

1. Exactly one line, trimmed, 1–240 characters, and `singleLineText` rules (no control or bidi characters).
2. One sentence: no line breaks and at most one sentence-ending mark, at the end.
3. **No invented facts**: every number in the output must appear in the founder's text. No market claim
   (`hasMarketClaim`) unless the founder's text already had one. No names of companies or competitors that the founder
   didn't write (checked as capitalised words that appear nowhere in the input, except at the start of the sentence).
4. **No hype**: a short list of banned words ("revolutionize", "game-changer", "seamless", "unlock", "cutting-edge",
   "AI-powered" unless the founder said AI, exclamation marks, emoji).
5. **Keeps the meaning**: at least one of the founder's content words (4 letters or more, not a stop word) survives.
   This is a coarse check that catches a model replacing the idea.
6. **Selection mode**: the model returns only the replacement for the selected span. Code splices it in, so the text
   outside the selection cannot change. The resulting sentence goes through checks 1–5.
7. **Not an idea** (gibberish, an instruction to the model, abuse): the model returns `not_an_idea`. The UI shows
   "Write your idea as a sentence and try again."

Founder text reaches the model only inside quoted, escaped data blocks (`dataBlock`), as for every crew prompt.

## 7. Delivery

- **PR 1, backend** (independent of the Step 1 UI work): the prompt and registry lock, the guardrails, the action and
  table, the key form, the limiter, purge, and tests with the fixture adapter (no live spend).
- **PR 2, UI**: `IdeaImprove` plus `useIdeaImprove`, dropped into the unified Step 1 component from `wizard-e2e-audit`
  once that is on `main`. It also passes `improvementId` on Continue and Rewrite, and adds the `ai_improved` signal.
- Never stacked: PR 2 rebases on `main` after PR 1 and the unified component merge.

## Owner decisions

1. **Daily cap**: 20 improve calls per founder per UTC day (recommended; about $0.01 worst case). Alternatives are 10,
   or 50 for paid plans.
2. **Signal**: a separate `ai_improved` founder signal that replaces `rewrote` when an AI suggestion was accepted
   (recommended), or keep `rewrote` and only add the session field.
3. **C-METER key form** `idea_improve` for pre-session wizard calls (needed, because the `wizard` form requires a
   session). This changes the meter contract.
4. **Change note**: show the model's one-line "what changed" note (recommended, it is the encouraging part), or show
   the sentence alone.
