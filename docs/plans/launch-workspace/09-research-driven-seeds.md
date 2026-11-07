# 09 — Research-driven seeds: how idea-page content shapes the wizard, the crew and the landing page

**Status:** proposal, 2026-11-07. Not ruled, not built. Extends `WP71-S5`
(seed precompute). Nothing here changes the eight wizard steps, D10 or D15.

## The question

When a founder clicks **Build this idea**, we already hold a lot about that
idea: the MDX page (Problem, Solution, How it works, Competitive Landscape,
Business Model, Tech Stack, four build prompts, Sources) and, for engine
ideas, the research record (`lib/engine/research-record.ts`: target customer,
competitors, go-to-market channels, pricing tiers, buyer quotes, keyword
rows). How much of it should decide what the wizard asks and suggests, which
AI employees get hired, which platform gets built, and what the landing page
says?

**Answer:** all of it should feed in, through one structured per-idea seed
built once at publish time. It sets the suggested answers. The founder makes
the final choice. Deterministic rules pick the roles.

## What happens today (2026-11-07)

1. **Wizard defaults are fixtures.** `wizardSeedFor` in
   `lib/workspace/wizard/defaults.ts` gives every library idea except
   HydroTrail the generic outline ("The one person who feels this problem
   most.") and the same answers: platform `web`, `free`, goal
   `waitlist`/`weekend`, `strategist`. The only idea data used is the title,
   for the suggested name.
2. **The crew blueprint sees six fields.** `blueprintStepPlan` in
   `lib/workspace/crew/inputs.ts` passes slug, title, description, summary,
   category and audiences to `crew-blueprint-personalise@1`. It never sees the
   MDX body or the research record. The seed input is `null` for every idea
   but HydroTrail.
3. **The roster comes from a guessed profile.** The model infers
   `profile.ideaKind / buyer / deliveryFormat / audiencePlural` from those six
   fields, and `planRoster` (`convex/crew/roles.ts`) hires from it: merch for
   `physical_product`, outbound for a business buyer, curriculum and community
   for a course or cohort, ads for a paid push, and engineering weight by kind.
   The founder has already answered the platform step before any of this runs.
4. **The hook exists.** `wizardSeedFor` is documented as the single switch
   point. `idea_crew_seeds` already has `blueprint`, `brandSeeds`,
   `landingSeeds`, `emailAngles`, `socialAngles` and `buildPackSeeds` (all
   `v.any()`). `crewSeedFor` already prefers a stored seed that parses as a
   library blueprint. `WP71-S5` is unchecked.
5. **Validated flag bug.** The generic seed marks every library idea
   `validated: true`, including `researchLevel: "concept"` ideas whose own
   summary says buyer demand "need[s] manual validation".

## Principles

- **Built once, per idea, offline.** One Batch call per idea and seed version
  (Opus 5.5 per D11), audited like the engine audits pages. Not per founder,
  not per click: lower cost, the same result for every founder, and the
  no-market-numbers rule checked once.
- **The research suggests, the founder decides, the rules hire.** The seed
  sets defaults, option order and a one-line "why" under each suggestion.
  Founder edits always win (the kept/edited signals already record this).
  `planRoster` stays deterministic so every hire and skip has a stated reason.
- **The eight steps stay fixed.** No LLM-invented steps. The strict schemas
  and tests depend on a fixed step list. Content may collapse a step to a
  quick confirm when the seed is confident.
- **Research is data.** Seed text is quoted as data in every prompt, as
  `crewBusinessContext` already does.
- **D15 and the engine rulings still hold.** No model-written market numbers,
  prices, percentages or keyword volumes in a seed. Keyword numbers stay in
  DataForSEO records only (ruling 38). Own ideas get no seed.

## Source → seed → consumer map

| Idea-page / research source | Seed field (new or existing) | Consumer |
|---|---|---|
| Problem, Solution, `**How it works:**` steps, Core Feature prompt | `blueprint` (pitch, oneUser, oneLoop, features, scopeCuts) | Wizard step 2; crew blueprint step |
| `brief.targetCustomer`, Business Model, manifest `audiences` | `blueprint.profile` (ideaKind, buyer, deliveryFormat, audiencePlural) | `planRoster`. The roster can now be shown during the wizard, before launch |
| Tech Stack, the core loop's device needs | **new** `wizardHints.platform` `{ kind, reason, deviceNeeds[] }` | Wizard step 3 |
| Business Model tiers (names only, no prices) | **new** `wizardHints.commercialModel` `{ value, reason }` | Wizard step 4 |
| Buyer (consumer vs business), build time | **new** `wizardHints.goal` `{ kind, timeframe, reason }` | Wizard step 5 |
| Title, positioning | **new** `wizardHints.names` (chosen + up to 2 alternatives) | Wizard step 6 |
| Verified buyer quotes, competitor positioning, How it works | `landingSeeds` (hero angle, pain lines, "unlike X" line, section order) | Landing page step |
| Positioning, voice cues | `brandSeeds` | Brand kit step |
| `goToMarket.channels`, community signals | `emailAngles`, `socialAngles` | Email and social roles |
| Competitor list, keyword terms (terms only) | **new** `roleBriefs.outbound`, `roleBriefs.seo` | Outbound and SEO roles |
| Project Setup and Core Feature prompts | `buildPackSeeds` | Engineering role starts from these instead of regenerating |
| Manifest `researchLevel`, `provenance.auditPassed` | **new** `validated: boolean` | Wizard "validated" label; blueprint context |

Every new field gets a strict zod schema in `lib/workspace/contracts/` (the
table is `v.any()`, so the parse is the only guard, as with
`wizardAnswersSchema`).

## Platform rule (step 3)

The decision comes from the seed's `deviceNeeds` (a closed enum, e.g.
`background_location`, `health_data`, `camera`, `push`, `offline`,
`daily_phone_habit`) through a pure function, not free model prose:

- any device need → suggest `native`, with the reason naming the need;
- otherwise → suggest `web`, with the reason "nothing here needs a phone app";
- the founder can still pick `native` or `custom`.

**Example, a physical store.** No device needs. Suggest a web storefront:
landing page, waitlist or pre-order, maybe booking. Show step 3 as a confirm.
The roster hires merch, and outbound only if the buyer is a business.

**Gap:** `IDEA_KINDS` has no local or retail business kind. A shop must be
`physical_product` or `service`, which skews merch, engineering weight and the
Pro Max product type. Add `local_business` (contract change, a roster rule and
a `proMax.ts` mapping), or rule that a shop is `service`.

## Wizard behaviour by step

| Step | With a seed |
|---|---|
| 1 idea | Unchanged |
| 2 blueprint | Real pitch, user, loop, features and cuts from the seed. "Validated" only when `seed.validated` |
| 3 platform | Suggested kind plus reason; a confirm when no device needs |
| 4 commercial model | Suggested model plus reason. Weekend scope still ships no billing |
| 5 goal | Suggested goal and timeframe plus reason |
| 6 name | Seed names offered as one-click choices |
| 7–8 partner | Unchanged. Optional: suggest a personality from the buyer type |

New, optional: under step 2, a "Your crew" preview from `planRoster(profile)`,
so the founder sees who gets hired and why before launch.

## Implementation order

1. **Fix the validated flag.** `fixture_generic` reads `researchLevel` and
   `provenance.auditPassed`. Small fix, no LLM.
2. **Contracts.** Add the `wizardHints`, `roleBriefs` and `validated` schemas
   and a `deviceNeeds` enum. Add the pure `platformSuggestion(deviceNeeds)`.
   Decide `local_business`.
3. **Seed builder (WP71-S5, extended).** `convex/crew/seeds.ts` and
   `scripts/crew-seeds.mjs` read the MDX and research record and write
   `idea_crew_seeds` through the Batch API. Fixture run first.
4. **Seed audit.** Reuse `hasMarketClaim` / `stripMarketClaims` and the engine
   auditor checks on every text field. Quotes must match a verified record
   quote. A failed seed is not written, and that idea falls back to the
   generic fixture.
5. **Switch the wizard.** `wizardSeedFor` reads the newest platform seed
   (`newestPlatformSeed`) and falls back to fixtures. Each step panel shows the
   reason line.
6. **Feed the crew.** `blueprintStepPlan` already passes the seed. Add
   landing, brand, email, social and role briefs to their step plans.
7. **Evals.** Add a seed suite (`evals/crew/**`, WP71-S6): profile accuracy on
   a labelled set, platform suggestion, zero market claims.

## Cost and gates

- `03-ai-cost-model.md` puts the full library (231 ideas, one seed version) at
  **≈ $40–$51** on Batch. The `WP71-S5` story says ≈ $15 (5 spike ideas, then
  the library). Reconcile the two before the live run.
- Live runs need the owner's OK. Run the 5 spike ideas first and record the
  cost per idea.
- A seed is regenerated when the seed prompt version changes or the idea's
  content changes. Store a content hash next to `seedVersion` so stale seeds
  can be found.

## Open questions for the owner

1. Add `local_business` to `IDEA_KINDS`, or treat a shop as `service`?
2. Show the crew preview inside the wizard, or keep the roster a launch-time
   reveal?
3. May a confident seed collapse a step (e.g. platform) to a confirm, or must
   every step stay a full choice?
4. Do concept-level ideas (`researchLevel: "concept"`) get seeds at all, or
   only engine ideas with a Source Critic PASS?
