# WP69 Stories - Crew contracts and the cost spike

Branch: `claude/wp69-crew-contracts`
Lane: Work Package (Claude lane, high), inside the WP67 Program/Migration lane
Registry: `docs/PROJECT_STRATEGY.md` (Launch Workspace Program, WP69)
Plan: `docs/plans/launch-workspace/04-build-plan.md` (WP69), `02-architecture.md` (§4, §5, §6),
`03-ai-cost-model.md` (§3, §7, §10), `01-strategy.md` (§6, §7)
Definition of done: contracts merged as types only (no runtime, no Convex functions),
role rules tested, spike costs measured and recorded (`04` WP69 acceptance).

## Stories

- [x] `WP69-S1` - Artifact schemas (C-ART)
  - Scope: `lib/workspace/contracts/artifacts.ts`, `lib/workspace/contracts/fixtures/hydrotrail.ts`,
    `tests/platform/workspace-artifacts.test.ts`
  - Acceptance criteria:
    - zod schemas and inferred types for Blueprint, RosterPlan (re-exported from `roster.ts`),
      BrandKit, LandingSpec, EmailSequence, SocialPack, SeoPack, LaunchPlan, AdsDrafts, BuildPack.
    - Canvas fields (canvas rows 01b–03), the `placeholder` flag on every proof element, and
      limits on every string and array (character counts, item counts).
    - A `schemaVersion` literal on every artifact and one registry mapping artifact kind to schema.
    - The HydroTrail fixture parses for every artifact; invalid inputs are rejected.
    - No Convex imports, no runtime side effects.
  - Verification: `npx vitest run tests/platform/workspace-artifacts.test.ts`, `npm run typecheck`

- [x] `WP69-S2` - Job, prompt and metering contracts (C-JOBS, C-PROMPT, C-METER)
  - Scope: `lib/workspace/contracts/jobs.ts`, `lib/workspace/contracts/prompts.ts`,
    `lib/workspace/contracts/metering.ts`, `tests/platform/workspace-jobs-contracts.test.ts`
  - Acceptance criteria:
    - C-JOBS: job types (the D19 task literals), credit prices from strategy §6 (D4), the
      two-free-rounds rule (D17), plan feature keys (`02` §4.3), and the provider-cost rule
      (≤ $0.013 per credit). Prices are marked provisional until S5 freezes them.
    - C-PROMPT: `PromptSpec` type and tier names (`fast`, `draft`, `deep`) with explicit
      effort and max tokens (`02` §5.2–§5.4).
    - C-METER: `reserve`, `settle`, `fail` argument and result types, error codes
      `BUDGET_EXHAUSTED` and `AI_DISABLED`, integer micro-USD, idempotency by `usageId`.
    - Types and pure helpers only; Codex implements the functions in WP70.
  - Verification: `npx vitest run tests/platform/workspace-jobs-contracts.test.ts`, `npm run typecheck`

- [x] `WP69-S3` - Role catalogue and hiring rules
  - Scope: `lib/workspace/contracts/roster.ts`, `convex/crew/roles.ts`, `convex/crew/roles.test.ts`
  - Acceptance criteria:
    - 13 roles; 8 always hired (Engineering weight by idea kind); 5 added or skipped by rule,
      each skip with a reason from a template.
    - Pure functions, no model call, no Convex function registration.
    - HydroTrail: 9 hired, 4 skipped (merch, outbound, curriculum, community) with reasons.
    - A course idea: a different team (Curriculum and Community added, Ads skipped, Engineering light).
  - Verification: `npx vitest run convex/crew/roles.test.ts`, `npm run typecheck`

- [ ] `WP69-S4` - Measurement spike (`03` §10)
  - **Owner approves the spend first. Cap $25. Nothing live runs before that.**
  - Scope: spike scripts on the branch only (`scripts/spikes/wp69-*`), results in
    `docs/wp/wp69-spike-results.md`.
  - Acceptance criteria: the seven steps of `03` §10 measured; tokens by class, cost, latency,
    cache hits, image and video cost and quality recorded; total spend reported.

- [ ] `WP69-S5` - Record measured costs and freeze C-JOBS
  - Scope: `docs/plans/launch-workspace/03-ai-cost-model.md`, `lib/workspace/contracts/jobs.ts`
  - Acceptance criteria: measured numbers replace estimates with dates; any estimate off by
    more than 30% goes to the owner with a price or budget proposal before C-JOBS is frozen.

## Out Of Scope

- Any Convex schema, function or component mount (WP68, WP70, Codex).
- The gateway, providers and prompt registry (WP71).
- Any UI.
- SMS of any kind (D10 deferred).

## Notes

- Tests live under `tests/platform/` because `npm test` already runs that path; `package.json`
  is Codex-owned, so no new test script is added here.
- Promote unknown product decisions to `docs/wp/RULINGS.md` through the orchestrator.
