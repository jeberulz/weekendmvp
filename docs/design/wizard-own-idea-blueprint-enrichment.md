# Own-idea blueprint enrichment (wizard Step 2)

Status: plan for review. Nothing here is built. Date: 2026-11-24.
Clickable mockup (today vs proposed, every Step 2 state): https://claude.ai/artifact/5kxy2mX6bJW2MuWp2VMLbm (private
until shared).
Related: `docs/design/wizard-e2e-audit.md`, WP100 "Improve with AI" (#311, `docs/design/wizard-idea-ai-improve.md` §3,
which owns the shared hint shape below),
D15 and the WP71 C-METER wizard key ruling (`docs/wp/RULINGS.md`), WP74-S3 notes (`docs/wp/wp74-progress.md`).

## The problem

A library idea's Step 2 blueprint comes from a researched crew seed. It names a specific user, a loop, 3–5 features
built for that idea, and scope cuts that fit it. An own idea's blueprint is a fixed outline
(`lib/workspace/wizard/light-blueprint.ts`, "Option D"): only the pitch comes from the founder's sentence, and every
other line is the same for every idea ("The one person who feels this problem most."). The founder is asked to
approve a blueprint that says almost nothing about their idea. It also feeds the crew: the after-Create prompt
`crew-blueprint-own-idea@3` reads "the light outline the founder saw in the wizard" (`idea_outline`).

## Field by field

| Field | Library idea (crew seed) | Own idea today | Gap |
|---|---|---|---|
| Heading | The idea's title | "Your idea" | none |
| `pitch` | Researched, one line | The founder's sentence, market claims stripped, cut to 160 characters | small: never sharpened |
| `oneUser` | A specific person | "The one person who feels this problem most." (constant) | **large** |
| `oneLoop` | The idea's real loop | "They arrive, do the one core thing, and come back next time they need it." (constant) | **large** |
| `features` | 3–5, specific to the idea | 3 constants ("Sign up and get started in one step", …) | **large** |
| `scopeCuts` | Specific to the idea | 2 constants ("No payments this weekend", "No team accounts") | medium |
| `validated` | true ("Read the research" link) | false: "Not yet validated" label plus meaning | **keep** (D15) |
| Market evidence | Idea page research | none | **keep none** (D15) |
| `profile` (ideaKind, buyer, deliveryFormat, audiencePlural) | Seeded, so the crew preview names the right roles | null, so the crew preview is generic | medium |
| Platform / model / goal suggestions | Seeded with reasons; confident ones open as a quick confirm | Fixed defaults (web, free, waitlist) with no reason | medium |
| Business names | 3 seeded | 1, from the sentence (audit F15) | small |
| Brand, landing, email and social seeds, build-pack seeds, role briefs | From the seed, read by the crew after Create | none; the crew drafts them after Create | out of scope for Step 2 |

## Constraints

- Keep "Not yet validated". Never invent market numbers, prices of competitors or keyword data. The founder's own
  facts (their price, their product) are allowed (WP75-S4a ruling).
- Every model call goes through the metered path: `internal.ai.gatewayActions.runPrompt` → `ai_usage`, with an owner
  and a C-METER key. The wizard key form is already ruled and built:
  `wizard:{wizardSessionId}:{step}:{attempt}` (`wizardAttemptKey`, `lib/workspace/contracts/metering.ts:333`). By
  default it counts inside the Free owner's $1.50 lifetime ceiling and $1.00 daily cap.
- Every output goes through `acceptLightBlueprint` (strict schema, market-claim strip, re-validate). That's the
  path already built for this in WP74-S3.
- The founder can always continue: no call may block the step for long, and every failure falls back to today's
  outline with an honest note.

## Options

### A. Keep the fixed outline (status quo)

- **Cost:** $0. **Latency:** none.
- The blueprint stays generic, and the crew starts from a generic outline.
- Honest, but the step isn't worth much.

### B. Fill fields from the WP100 hints (no extra call when they exist)

The WP100 "Improve" call also returns `OwnIdeaHints { audience, coreAction, offer }` (see "Shared with WP100" below).

- When those hints exist (`ownIdeaAi.hints`, kept only while the founder didn't edit after accepting): `oneUser` ←
  `audience`, `oneLoop` ← `coreAction`, and `profile.audiencePlural` ← `audience`. The rest stays fixed.
- When they don't, B alone would need WP100's extract-only call (fast tier, about $0.0001 per idea) to get them.
- **Cost:** $0 extra with hints, about $0.0001 without. **Latency:** none with hints, ~1 s without.
- `features` and `scopeCuts` stay generic either way.

### C. One light drafting call (D15 "Option A"). Recommended

One call per idea text, after Step 1, that returns a light blueprint that fits the idea.

- **Output** (one strict schema):
  - `blueprint`: `pitch` (sharpened, stays with the founder's words), `oneUser`, `oneLoop`, 3–5 `features`, 2–3
    `scopeCuts`.
  - `profile`: the roster profile, so the crew preview and roster fit the idea.
  - `suggestions`: platform, commercial model and goal, each with a one-line reason. They are never confident, so an
    own idea never gets a quick confirm (the founder chooses).
  - `names`: 3 business names (fixes audit F15).
- **Inputs:**
  - the founder's sentence (quoted data)
  - the WP100 hints, when present (quoted data, so the draft doesn't rediscover the audience)
  - on a redraft, the founder's rework notes (quoted data)
- **Prompt:** a new `wizard-own-blueprint@1` on the `draft` tier, with the same D15 system rules as
  `crew-blueprint-own-idea@3`. Every string runs through `hasMarketClaim`. Stripped claims are counted and disclosed
  by the existing `NotValidatedNote` ("We left out one market figure…").

### D. Run the research seed for own ideas (rejected)

- The `crew-idea-seed@3` precompute (deep tier, research, minutes, tens of cents) is built for published library
  pages.
- D15 rules that own ideas get a light blueprint, not research. Rejected.

## Shared with WP100 (#311): one extraction, paid for once

WP100 and this plan both need to know who the idea is for and what they do with it. That read happens once.

- **One shape, owned by WP100.** `OwnIdeaHints { audience, coreAction, offer }` and `cleanOwnIdeaHints` live in
  `lib/workspace/wizard/idea-hints.ts`. This plan imports them and never defines its own. Every hint passes
  `hasMarketClaim`, and a failed hint is null, not an error.
- **Where hints come from.** When the founder presses Improve and continues with the suggestion unedited, the session
  stores `ownIdeaAi.hints`. Any edit after accepting drops them (`editedAfter: true`). WP100 owns that field; this plan
  only reads it.
- **Which call extracts, by case:**

| Case | With C approved (recommended) | With B only |
|---|---|---|
| `ownIdeaAi.hints` present | The draft gets them as a quoted data block. No extraction. | Used directly. No call. |
| No hints (no Improve, edited after, or all failed the check) | The draft call extracts them itself: its schema adds an `hints: OwnIdeaHints` field, checked with `cleanOwnIdeaHints`. **No separate extract call.** | WP100's extract-only mode runs once (fast tier, `wizard-idea-improve@1`, ~$0.0001) |

- **Never both.** With C approved, WP100's extract-only mode isn't needed for the blueprint. The draft already reads the
  sentence, so a second call would pay twice for the same read.
- **Where draft hints are stored.** In the `wizard_blueprint_drafts` row, never in `ownIdeaAi`. `ownIdeaAi.hints`
  keeps meaning "what the Improve call understood".
- **Worst case per idea:** the founder's own Improve calls (WP100's daily cap: 20 calls, ≈ $0.01 a day at most), plus
  at most 3 drafts (≈ $0.03 on the draft tier). Nothing is extracted twice.

## Recommendation: C, fed by B

Build C, and pass the WP100 hints into it when they exist. B on its own isn't enough: most founders won't press
Improve, and the features and scope cuts stay generic.

### How C works

**When the call runs:**

- `startOrResume` (own idea) and `rewriteStep(idea)` schedule an internal action with
  `ctx.scheduler.runAfter(0, …)`.
- The action checks that the owner owns the session (as the WP71 ruling requires), reserves with
  `wizardAttemptKey(sessionId, "blueprint", attempt)`, calls the model, then runs `acceptLightBlueprint`.

**Where the draft is stored:**

- In a new table `wizard_blueprint_drafts`, holding:
  - `ownerId`, `wizardSessionId`, `ideaTextHash`, `attempt`
  - `status` (`pending` / `ready` / `failed`)
  - the accepted output, and `usageId`
  - index `by_wizardSessionId_and_ideaTextHash`
- `wizard_sessions` stays lean, and the table joins the WP96 owner purge drains.
- `getSession` reads the newest `ready` draft for the current idea text and passes it to `wizardSeedFor` as
  `ownIdeaDraft`. That's the seam left in `seedFor` (WP74-S3).

**What the founder sees** (see the mockup):

- **Drafting:** Step 2 opens with "Drafting your blueprint from your idea…": skeleton lines, `aria-busy`, and a polite
  status message.
- **Ready:** the drafted blueprint, still labelled "Not yet validated", with a line "Drafted from your words. Nothing
  here is researched yet."
- **Slow or failed:** after 8 seconds, or on a failure, a refusal or a budget stop, today's outline shows with the
  existing honest note. A draft that lands later doesn't replace the page; it shows as "A sharper outline is ready ·
  Show it", so the text never changes under the founder's eyes.

**Idempotency and cost control:**

- One draft per (session, idea text, attempt). A reload never calls again.
- Editing the sentence after Back is a new idea text, so a new draft.
- Cap: 3 drafts per session (first draft, an edited idea, one redraft). After that, the outline stays and the
  founder can still continue.

**How rework fits:** with a real draft, "Save notes" (#312) can become **Redraft with my notes**.

- That's attempt 2, with the notes as a data block. There's one redraft per session.
- After it, rework goes back to notes-only, as in #312: notes saved, carried to the crew in the blueprint signal.
- This makes "I'll rework it" true again for own ideas. Library ideas keep notes-only, because their blueprint is
  researched and the after-Create `crew-blueprint-personalise@3` call already applies the founder's answers.

**What the rest of the platform gets:**

- The accepted draft becomes the `idea_outline` that `crew-blueprint-own-idea@3` reads after Create. So the crew
  starts from the blueprint the founder approved, not from boilerplate.
- `profile` drives the crew preview on Steps 2–8.
- The suggestions give Steps 3–5 reasons ("Ships this weekend because…").
- The names fill the name step.

### Cost and latency

| | Draft tier (Sonnet 5.5, $2 / $10 per M) | Fast tier (Haiku 5.5, $0.10 / $0.50 per M) |
|---|---|---|
| Tokens per call (estimate) | ~1.5K in, ~0.7K out | same |
| Cost per call | ≈ $0.003 + $0.007 ≈ **$0.01** | ≈ **$0.0005** |
| Worst case per session (3 drafts) | ≈ $0.03, 2% of the Free $1.50 ceiling | ≈ $0.0015 |
| Hint extraction | Inside the draft call: $0 extra | same |
| Latency (estimate; measure in the live test launches) | ~4–6 s | ~1–2 s |

Rates come from `convex/ai/pricing.ts`, and the tier to model mapping from `lib/workspace/contracts/prompts.ts:56`.
Token counts are estimates from the size of the `crew-blueprint-own-idea@3` system prompt and a 5-feature output.

### Failure handling

| Case | What happens |
|---|---|
| AI off or the kill switch is on | A new start is already refused (#313 copy). A resumed session shows the outline |
| Budget stop (`BUDGET_EXHAUSTED`) | The outline, with the honest note. No error, no charge |
| Model error or timeout | The `failed` row, then the outline. The founder can continue |
| The output fails the schema, or is only market claims | `acceptLightBlueprint` rejects it, then the fallback outline (`own_fallback`, as today) |
| Prompt injection in the sentence | The sentence is quoted data. The output schema is strict, and the claims check runs on every string |

### Tests

- **Prompt evals:** no market claims, stays with the founder's idea, injection is kept as data, the shape is valid.
- **convex-test:** one call per (session, text, attempt), with no call on reload; the key form; owner isolation; the
  cap; budget-stop fallback; purge.
- **UI:** the drafting state with `aria-busy` and a status message; the 8-second fallback; "A sharper outline is
  ready"; redraft. Axe on each state.

### Build order (small PRs, none stacked)

1. The prompt, the schema (including `hints` from `idea-hints.ts`), the `wizard_blueprint_drafts` table, the internal
   action and metering. Backend only, behind an ops flag that is off by default. After WP100's backend (#311) merges,
   so the shared hint shape exists on main.
2. `getSession` wiring and the Step 2 drafting, fallback and "ready" states. After #310 and #312 merge.
3. Redraft with notes, plus the name step reading `names`.
4. Turn the flag on for the cohort after the live test launches confirm latency and cost.

## Decisions for you

1. **Option C.** Build the light draft (recommended), or stay on A or B.
2. **Model tier.** `draft` (Sonnet 5.5, ~$0.01, ~5 s; what D15's "drafting model" reads as) or `fast` (Haiku 5.5,
   ~$0.0005, ~1–2 s). Recommended: `draft`, but measure `fast` in an eval first, because it would make the step
   near-instant.
3. **Waiting.** A drafting state of up to 8 seconds, then the fallback (recommended). Or show the outline at once and
   offer the draft when it's ready.
4. **Redraft.** One redraft with notes per session (recommended), or notes-only as today.
5. **Free ceiling.** Keep the draft inside the Free $1.50 lifetime ceiling (the current default), or count it
   outside, like the D15 Validation Report.
