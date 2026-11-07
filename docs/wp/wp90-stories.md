# WP90 Stories - Research-driven idea seeds

Branch: `claude/wp90-idea-seeds` (worktree `.worktrees/wp90-idea-seeds`)
Lane: Work Package (contracts + AI prompt behavior + wizard UI; high-tier routing)
Registry: `docs/PROJECT_STRATEGY.md`
Plan: `docs/plans/launch-workspace/09-research-driven-seeds.md`
Definition of done: every public library idea can carry an audited, schema-checked
seed built from its own page. The wizard's suggestions, reasons and crew preview come
from it. The blueprint, brand kit, email and social steps read it. The checks in
`.agentic-workflow.yml` (standard) pass, a11y-check passes on the changed wizard
screens, and the live seed run is handed to the owner with its exact cost.

Owner rulings for this WP (2026-11-07, recorded in `docs/wp/RULINGS.md`):
add `local_business`, show a crew preview in the wizard, allow a quick confirm on
confident steps, seed every public idea (concept-level ideas unvalidated). The owner
accepted moving the L1 date if this needs more time.

## Stories

- [x] `WP90-S1` - Seed contract, `local_business`, platform rule
  - Scope: `lib/workspace/contracts/seeds.ts` (new), `lib/workspace/contracts/roster.ts`,
    `convex/crew/roles.ts`, `lib/workspace/crew/design/proMax.ts`, tests.
  - Acceptance criteria:
    - `ideaCrewSeedSchema` (strict, bounded) covers `blueprint` (library variant),
      `wizardHints` (platform with `deviceNeeds`, commercial model, goal, names, each with
      a reason and a confidence), `brandSeeds`, `landingSeeds`, `emailAngles`,
      `socialAngles`, `buildPackSeeds`, `roleBriefs`, and `validated`.
    - No seed text field can carry a market claim (`hasMarketClaim`), enforced by a
      refinement, not by convention.
    - `platformSuggestion(deviceNeeds)` is pure: any need → `native` with the need named;
      none → `web`.
    - `local_business` is an idea kind with its own roster rules (no merch unless it
      sells goods, local outreach reasons), engineering weight and Pro Max product type.
  - Verification: `npm test -- tests/workspace/seeds convex/crew/roles`, `npm run typecheck`.

- [x] `WP90-S2` - Seed source, prompt spec and audit
  - Scope: `lib/workspace/crew/seedSource.ts` (new), `lib/workspace/crew/seedAudit.ts` (new),
    `convex/ai/prompts/ideaSeed.v1.ts` (new), registry, `versions.lock.json`.
  - Acceptance criteria:
    - The source is built from the idea's MDX sections and manifest row only, bounded,
      and quoted as data.
    - `crew-idea-seed@1` is a `deep` + `batch` spec whose output schema is the seed
      contract minus server-set fields (`validated`, `ideaSlug`, `source`).
    - The audit rejects a seed whose quotes are not verbatim in the source, whose
      competitors are not named in the source, or that carries a market claim. It sets
      `validated` from `researchLevel` / provenance, never from the model.
  - Verification: unit tests over fixtures for a deep, a concept and a local-business idea.

- [x] `WP90-S3` - Batch precompute path
  - Scope: `convex/ai/providers/anthropic.ts` (submit, retrieve, results),
    `convex/crew/seeds.ts` (new), `convex/schema/workspace.ts` (`idea_seed_runs`),
    `scripts/crew-seeds.mjs` (new), fixture responder.
  - Acceptance criteria:
    - Every batch request is reserved through C-METER with `batch: true`, `custom_id` =
      `usageId`, and settled or failed exactly once from its result.
    - A super-admin-only entry point submits; a scheduled poll collects results, audits
      them and writes platform rows (`projectId` unset). A failed seed writes nothing.
    - The script reads `content/ideas/*.mdx` + `ideas/manifest.json`, prints a dry-run
      cost estimate, and needs `--apply` to submit. Fixture mode works with zero spend.
  - Verification: convex-test over the full submit → poll → write path in fixture mode.

- [x] `WP90-S4` - Wizard reads the seed
  - Scope: `lib/workspace/wizard/defaults.ts`, `convex/workspace/wizard.ts`,
    `components/workspace/wizard/*`, `lib/workspace/wizard/copy.ts`.
  - Acceptance criteria:
    - `seedFor` reads the newest platform seed; with none, today's fixtures, with
      `validated` from the idea row (fixes concept ideas shown as validated).
    - Steps 2–6 take their default and a one-line reason from the seed.
    - A confident platform, commercial-model or goal hint shows as a quick confirm with
      "Looks right" and a "Change" control that opens the full choice.
    - A "Your crew" panel after the blueprint step shows `planRoster` for the seed
      profile and the current answers (hired and skipped, with reasons).
    - a11y-check passes on every changed step.
  - Verification: wizard unit + convex tests; browser check of a seeded and an unseeded idea.

- [ ] `WP90-S5` - Crew steps read the seed's angles
  - Scope: `lib/workspace/crew/inputs.ts`, `convex/crew/generators.ts`,
    `convex/ai/prompts/{brandKit,emailSequence,socialPack}.v2.ts`, registry, lock.
  - Acceptance criteria:
    - Brand kit, email and social specs get the seed's brand seeds and angles as quoted
      data when a seed exists, and behave exactly as v1 without one.
    - Prompt versions bump; the lock check passes.
  - Verification: inputs/generators tests; `scripts/check-prompt-versions.mjs`.

- [ ] `WP90-S6` - Gate, docs and handoff
  - Scope: docs only.
  - Acceptance criteria:
    - Standard checks pass. Docs updated: plan `09`, `CLAUDE.md` key paths, stories,
      progress, registry row, rulings.
    - The owner gets the exact live commands (spike of 5, then the library) with the
      dry-run cost.

## Out Of Scope

- Consumers that do not exist yet: the landing page, build pack, SEO and outbound
  steps. Their seed fields are written and validated now and read by those WPs.
- Own ideas (D15): no seed, unchanged.
- Running the live batch: owner-only, after review.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- `convex/schema` has one writer per merge window: S3's table is additive; check open
  PRs touching `convex/schema/workspace.ts` before merging.
