# Plan: idea-driven crew hiring and varied lead names

Status: **plan approved in shape; John answered Q1–Q6 on 2026-11-07 (see "Decisions"). Waiting for the
go-ahead to build.** Nothing here is built. All of it is planned for L1 (Monday 2026-11-09).
Date: 2026-11-07. Lane: Work Package (number to be assigned). Branch: `claude/roster-per-idea-plan`.

## Decisions (John, 2026-11-07)

| Q | Decision | What it changes in this plan |
|---|---|---|
| Q1 core roles | **Lead, Brand, Email, Social** | `CORE_ROLE_KEYS` = these four. The model decides the other 9 |
| Q2 forced hires | **Paid push → Ads, course → Curriculum** | Community, Merch and Outbound become the model's call, with today's rule as the fallback |
| Q3 unbuilt roles | **Yes, the model may hire them** | Hired roles with no built work show "starts when … ships" (WP67 pages already do) |
| Q4 lead avatar | **A one-off set of about 6 lead pictures** | New story S2b: generate them once with `scripts/generate-crew-avatars.mjs` (Recraft). This is a one-time image spend; confirm the exact count and cost with John before the run |
| Q5 hire cap | **No cap** | The model may hire all 9 optional roles; each hire needs its own reason. The prompt still asks for the smallest team that fits |
| Q6 timing | **Everything goes into L1** | S1–S5 target Monday 2026-11-09; S6 (live smoke test) needs John's OK for live spend |

## Why

John saw that every business gets the same AI employees and the same Crew Lead ("Wren"). He wants the idea to
decide who is hired and how they work, and the lead's name to vary per business.

## What the code does today

### Who is hired

- `planRoster` (`convex/crew/roles.ts`) is pure code. It runs in the same transaction that stores the first
  blueprint (`planLaunchRoster` in `convex/crew/launchRoster.ts`). No model call is involved.
- 8 of the 13 roles are always hired: `ALWAYS_HIRED_ROLE_KEYS` in `lib/workspace/contracts/roster.ts` (lead,
  brand, landing, seo, marketing, email, social, engineering). `rosterPlanSchema` enforces this: an always role
  can never be skipped.
- The other 5 are switched on by fixed rules:

  | Role | Hired when |
  |---|---|
  | ads | the goal has a paid push |
  | curriculum | the idea is a course |
  | community | the idea is a course or a cohort |
  | merch | the idea is a physical product |
  | outbound | the buyer is a business |

- The model's only influence is the blueprint's `profile` (`ideaKind`, `buyer`, `deliveryFormat`,
  `audiencePlural`). Both blueprint prompts (`convex/ai/prompts/blueprintPersonalise.v1.ts`,
  `blueprintOwnIdea.v1.ts`) write it. So at most 5 of 13 roles can differ between two businesses.
- "Eight always hired" comes from the design canvas (`docs/wp/wp69-canvas-extract.md`, WP69-S3). Changing it
  overrides that design.
- The launch already copes with a missing owner. `evaluateLaunch` in `convex/crew/steps.ts` skips a step whose
  employee is not hired, and every step below it. Brand's `brand_kit` is the parent of `email_sequence` and
  `social_pack`, so skipping Brand removes everything L1 builds.
- Only roles with a built launch step do any work. Built today: blueprint and roster (lead), brand_kit (brand),
  email_sequence (email), social_pack (social).
  - Landing, seo, marketing, engineering and ads have launch steps that are not built yet.
  - Curriculum, community, merch and outbound have no launch step at all.
- Specialists' names are fixed per role (Iris is always Brand), with one avatar per role
  (`lib/workspace/crew-avatars.ts`).

### The lead's name

- The wizard's `partner_name` step (`components/workspace/wizard/WizardStepPanel.tsx`) offers the presets
  Wren, Juno and Ridge or a typed name. "Wren" is preselected, so most founders keep it.
- The preset names are literals in the stored schema: `convex/schema/workspace.ts` (`partnerName`, Codex-owned)
  and the mirror validator in `convex/workspace/wizard.ts`. A `{ kind: "custom", name }` value accepts any name.
- **Bug found:** `WREN_SYSTEM_RULES` in `convex/ai/prompts/wrenShared.ts` starts "You are Wren, …". The business
  context block does carry the real `partner.name` and personality (`convex/workspace/chat.ts`), but the fixed
  system rule names Wren. A founder who chose "Juno" can get a chat partner that calls itself Wren.
- There is one lead avatar (`lead-wren.webp`). The file's comment rules that "the picture belongs to the role,
  the name to the founder".
- UI fallbacks use "Wren" when no name is stored: the layout, the files and employee pages, `WrenCards`,
  `WrenMemoryPanel` and `wrenCards.ts`. These are fallbacks only; a stored name wins.

### Fixture mode (local, zero spend)

- `convex/ai/providers/fixtureOutputs.ts` answers every blueprint request with the HydroTrail blueprint: a
  consumer app, self-serve, for hikers. The own-idea variant returns one fixed light blueprint.
- So locally every business gets the same `profile`, hence the same 8 employees, and the same brand voice. This
  is why the local businesses (PostureUp, AI Receptionist, Meal-Prep Planner) all look identical. AI Receptionist
  should be a business buyer and hire Outbound.

## Goals

1. The idea decides the team: who is hired, who is not, and why, in words specific to the business.
2. A small, guaranteed core, so the built L1 loop (blueprint → brand kit → emails and social posts) still runs.
3. No extra AI calls and no new spend per launch.
4. The lead's name varies per business, stays stable on reload, is still the founder's choice, and the chat
   uses it.
5. Local fixture runs show different teams for different ideas.

Not in scope: renaming specialists per business, new launch steps for unbuilt roles, payments, and any
production deploy.

## Part A: the idea decides the team

### Options

| | How | Calls | Pros | Cons |
|---|---|---|---|---|
| A1 | Keep rules, shrink the always-on list to a core | 0 | Smallest change | Still not the idea deciding; only more rules |
| **A2** | **The blueprint call also proposes the team: hire or skip each non-core role, with a reason. Code applies guardrails and falls back to rules** | **0 extra** | **The model reads the idea once and decides both; reasons are specific; deterministic fallback** | **Blueprint prompt and contract change; prompt version bump** |
| A3 | A separate `crew_roster` model call after the blueprint | +1 draft call | Clean separation | More spend, more latency before the team appears, a new job type and new metering |

**Recommendation: A2.**

### A2 design

**Core (always hired, never skipped).** Decided (Q1): `lead`, `brand`, `email`, `social`, the roles whose steps
are built.

**Proposal from the model.** Add an optional `team` block to the blueprint output (C-ART `blueprintFields`,
`lib/workspace/contracts/artifacts.ts`):

```
team: [{ roleKey, hire: boolean, reason }]   // one entry per non-core role, reason ≤ 160 chars
```

The system block of both blueprint prompts gains the role catalogue (key, label, one line of what each does).
This is stable text, so the prompt cache still works. It also gets one instruction: decide each non-core role
for this business, with a one-line reason a founder understands, and no market numbers (D15 still applies to
own ideas).

**Guardrails in code** (`planRoster`, still pure). The model proposes; code decides what is stored:

1. Core roles are hired whatever the proposal says.
2. Founder-stated facts still force a hire, so the model cannot drop them: a paid push hires Ads, a course
   hires Curriculum (decided, Q2). The other three rules (community, merch, outbound) become fallbacks the model
   overrides with a reason.
3. Every non-core role must appear exactly once. A missing, duplicate, unknown or over-long entry falls back to
   today's rule for that role, with today's reason.
4. Reasons pass the existing deterministic text checks (the own-idea market check, length and single line).
   A failing reason falls back to the rule's reason.
5. If the whole `team` block is missing or invalid, use today's rules entirely. Older blueprints, and a
   revision that drops the block, keep working.

**Contract changes** (`lib/workspace/contracts/roster.ts`):

- `ALWAYS_HIRED_ROLE_KEYS` becomes `CORE_ROLE_KEYS`, and the always-on checks in `rosterPlanSchema` follow it.
- `RosterInput` gains an optional `proposal`.
- `ROSTER_RULES_VERSION` bumps, so stored plans show which rules made them.
- `engineering` keeps its weight rule when hired.

**Who hired them.** `crew_members.hiredBy` is `"rule" | "founder"` in the Codex-owned schema. Codex gap G1 asks
for a `"lead"` value (the Crew Lead chose). Until it lands, a model-chosen hire is stored as `"rule"`, and its
reason text says it was the lead's call. `TEAM.md` (`renderTeamMd`) shows "added" either way.

**Hired roles with no built step.** Decided (Q3): the model may hire them. WP67's employee pages already show
such a role as "starts when … ships", with no invented work. No cap on optional hires (Q5); each needs a reason.

**Existing businesses.** No change: a stored roster is never re-planned. New launches use the new rules version.

**Cost.** No new call. The blueprint is a `draft`-tier call that gains about 13 short reasons, roughly
300–500 output tokens. Measure this in the fixture-to-live smoke test (L1-C4 style) before switching on.

## Part B: varied lead names

### Options

| | How | Schema change | Notes |
|---|---|---|---|
| **B1** | **The wizard suggests three names drawn from a larger pool, seeded by the wizard session id so they are stable. The first is preselected. "Type your own" stays. A chosen suggestion is stored as `{ kind: "custom", name }`** | **None** | **Works now. `kind: "custom"` slightly misdescribes a suggestion** |
| B2 | As B1, but Codex adds `{ kind: "suggested", name }` (or widens the presets) to `partnerName` | Codex (G2) | The cleanest record; needs Codex first |

**Recommendation: B1 now, B2 when Codex can.** The pool lives in `lib/workspace/contracts/wizard.ts`:

- About 24 short names, one or two syllables, easy to read.
- None may clash with a specialist's name (Iris, Leo, Sana, Marco, Elle, Theo, Kai, Ada, Cora, Nia, Max, Oli).
- A unit test checks for clashes.

Selection is deterministic: a hash of the wizard session id picks three distinct names. No clock or randomness
is read in Convex queries.

**Make the chat use the name.** This is the bug fix, and it is wanted whatever else is chosen:

- The system rule becomes "You are the founder's Crew Lead. Your name is `partner.name` in
  `<business_context>`; use it." That keeps the system block stable for caching.
- Bump `wrenChat` and `wrenPlanTurn` to new versions, and update `convex/ai/prompts/versions.lock.json`
  (`scripts/check-prompt-versions.mjs --write`).
- Add a fixture test that a business named "Juno" gets "Juno" in the reply's context.

**Avatar.** The current rule is that the picture belongs to the role. Options:

- (a) Keep one lead picture for every name. No cost.
- (b) Generate a small one-off set of lead avatars, about 6, with `scripts/generate-crew-avatars.mjs`, and pick
  one by a hash of the name. This is a one-time Recraft spend and needs John's OK.

Decided (Q4): **(b)**, a one-off set of about 6 lead pictures. The lead's picture is then chosen by a hash of
the lead's name, so the same name always gets the same face. Specialists keep one picture per role.

**UI fallbacks.** Keep "Wren" only as the last-resort fallback for missing data, never as a default choice.

## Part C: fixtures that vary by idea

- In `fixtureOutputs.ts`, a deterministic classifier reads the idea text in the blueprint request (the library
  idea record or the own-idea sentence). It uses keywords first, then a hash, to pick one of about 5 fixture
  profiles: consumer app, B2B software, course or cohort, physical product, local service.
- Each profile comes with a matching `team` proposal and `audiencePlural`. Everything else stays HydroTrail.
- It stays pure (no env, network or clock), and `tests/platform/crew-fixture-outputs.test.ts` keeps proving
  that live mode never reaches it.
- Result: locally, AI Receptionist gets Outbound, a course idea gets Curriculum and Community, and so on.
- Varying the brand voice per fixture is optional and left out unless asked.

## Stories (proposed order)

| Story | Work | Risk |
|---|---|---|
| S1 | Chat uses the founder's lead name (prompt version bumps, test). Ship first: it is a bug | Low |
| S2 | Lead-name suggestions in the wizard (pool, deterministic pick, preselect, store as custom). Copy and a11y | Low |
| S2b | Lead avatar set: about 6 pictures generated once (Recraft, one-time spend after John confirms the count and cost), `CREW_AVATAR_SRC` lead lookup by name hash, `EmployeeAvatar` and the chat header use it | Low (spend gate) |
| S3 | Contracts: `team` on the blueprint, `CORE_ROLE_KEYS`, a proposal in `RosterInput`, new rules version; `planRoster` guardrails and fallback, with full unit tests | Medium (contract) |
| S4 | Blueprint prompts v2 with the catalogue and the team instruction; version lock; fixture classifier (Part C) | Medium (prompt) |
| S5 | UI wording: Meet your co-founder, Team HQ "Why this team?" and the employee pages say "Wren chose …" where the lead decided | Low |
| S6 | Live smoke test of 3–5 different ideas (after John's OK for live spend): team variety, reasons, token cost | Gate |

**L1 timing (Q6: everything in L1).** Monday is 2026-11-09. To fit:
- S1 and S2 are independent and small; they can run in parallel with S3.
- S3 → S4 → S5 are sequential (contract, then prompts and fixtures, then copy).
- S2b waits only on John confirming the image spend.
- If S3–S5 slip, S1 and S2 still ship alone. The team logic falls back to today's rules by design, so a late
  S3–S5 never blocks the launch.

## Files

**To change:**
- `lib/workspace/contracts/roster.ts`
- `lib/workspace/contracts/artifacts.ts`
- `lib/workspace/contracts/wizard.ts`
- `convex/crew/roles.ts`
- `convex/crew/launchRoster.ts` (passes the proposal through)
- `convex/ai/prompts/blueprintPersonalise.v2.ts` and `blueprintOwnIdea.v2.ts` (new), plus `index.ts` and
  `versions.lock.json`
- `convex/ai/prompts/wrenShared.ts`, plus `wrenChat` and `wrenPlanTurn` version bumps
- `convex/ai/providers/fixtureOutputs.ts` and `lib/workspace/contracts/fixtures/` (new profiles)
- `components/workspace/wizard/WizardStepPanel.tsx`
- `convex/workspace/wizard.ts` (only if B2)
- Team HQ, Meet your co-founder and employee-page copy

**Tests:**
- `convex/crew/roles.test.ts`: guardrails, fallback, forced hires, core never skipped.
- `convex/crew/roster.test.ts` and `launch.test.ts`: a launch with a proposal, and one without.
- `tests/platform/crew-fixture-outputs.test.ts`: per-idea fixtures.
- Wizard and chat prompt tests.
- The prompt version check.
- The axe tests on the changed UI.

**Codex-owned, do not edit:** `convex/schema.ts`, `convex/schema/**`, `convex/platform/**`,
`convex/ai/metering.ts`, `convex/ai/budgets.ts`, `convex/convex.config.ts`, crons, http, `middleware.ts`,
`package.json` and the lockfile, `.env.example`, `convex/ops/**`, `convex/growth/**`, `.github/**`,
`tests/security/**`.

## Codex gaps

- **G1.** `crew_members.hiredBy` gains `"lead"`, so a team member the Crew Lead chose is recorded truthfully.
- **G2.** Optional: `partnerName` gains `{ kind: "suggested", name }`, or a wider preset list, in
  `convex/schema/workspace.ts`.

Neither blocks S1–S5.

## Risks

- **The model hires too many roles to look busy.** No cap was chosen (Q5). The instruction asks for the
  smallest team that fits and a specific reason per hire; S6 checks team sizes across ideas, and a cap can be
  added later without a contract change.
- **Reasons that sound like market claims.** The deterministic checks fall back to the rule's reason.
- **Two days to Monday.** See "L1 timing": S3–S5 are the risk, and the fallback keeps the launch safe if they
  slip.
- **A changed core breaks assumptions in tests and UI copy** ("8 on the team"). Counts are already computed
  from the roster, but the tests need updating.
- **Prompt cache hit rate.** The catalogue goes in the system block, which stays stable per version.

## Open questions for John

All six were answered on 2026-11-07; see "Decisions" at the top. Still to confirm at build time:
- The image spend for S2b (count and cost) before the Recraft run.
- Live spend for S6.
