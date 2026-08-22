# Phase 5. Research pipeline

Back: [overview](overview.md)

## Goal

A brief in, a `ResearchRecord` out. Seven steps. Thin research throws. Cost over $4.00 throws before another provider call. Fixture mode is deterministic.

This is Mode A without MCP. It is not the customer report renderer.

## Changes

- Add `lib/engine/pipeline.ts`. Reuse the v1.1 step order from `convex/platform/engine/pipeline.ts` on `codex/wp26-v1.1-engine`: brief normalization, market stats, competitors, community signals, keywords, synthesis and scores, attach provenance (their `report_render` becomes provenance + parse, not a `documents` insert). Each external step uses the phase 4 interface. Retry once, then fail. Keyword step fails closed on provider error. Lift `assertWithinCap` / micro-USD math from v1.1 `cost.ts`. Do not lift `recordProviderCost` (writes `audit_events`).
- Do not copy `workflow.ts`, `tasks.ts`, `executor.ts` ledger hooks, or `VALIDATION_REPORT_CREDITS`. No `ownerId`. No 15-credit debit.
- Add `scripts/engine-research.mjs` and `engine:research` in `package.json`. Flags: `--brief path.json`, `--fixture name`, `--out engine/records/{slug}.json`.
- Add `lib/engine/pipeline.test.ts` using fixture providers. Cases: happy path parses as `ResearchRecord`, two stats and three priced competitors required, keyword failure does not emit guessed CPC, cost cap aborts.

Do not write MDX. Do not call the skill.

## Data structures

`BriefInput`: `{ title, audience, revenueModel, seedKeywords: string[] }`. Pipeline output is `ResearchRecord`. Step results stay internal. Do not invent a parallel "step state" type the compiler must know.

## Verification

Static: `npx vitest run lib/engine/pipeline.test.ts`, `npm run typecheck`, `npm run lint`.

Runtime: `npm run engine:research -- --fixture rfp-assistant --out /tmp/record.json` writes a file that `parseResearchRecord` accepts. No browser. Live spend waits until phase 6 has a compiler to judge.
