# Phase 4. Provider adapters

Back: [overview](overview.md)

## Goal

One typed interface per role so the pipeline never imports an SDK. Fixture playback runs CI with zero spend. Missing keys fail closed. Keyword metrics never come from a model.

Reuse the *roles* already ruled for WP26. Lift the adapters from `codex/wp26-v1.1-engine` at `c99351b`, do not rewrite them. Copy into `lib/engine/` and strip Convex types. Do not import `workflow.ts` or `providers/registry.ts`.

## Changes

- Copy `convex/platform/engine/providers/{types,openai,perplexity,keywordData,pricing,fixtures}.ts` from that branch into `lib/engine/providers/`. Keep injectable `fetchImpl`. Keep the rate card in `pricing.ts`.
- Add `lib/engine/providers.ts` as the factory: `createProviders({ mode: "fixture" | "live" })`. Fixture mode must not require env keys. v1.1 `registry.ts` required keys even in fixture mode. Leave that file behind.
- Pin OpenAI to a dated snapshot if one exists at implementation time. If not, keep `gpt-5.6-sol` as v1.1 did on 2026-08-07, and write the ID into the phase progress note.
- Add `lib/engine/providers.test.ts`. Include: missing key in live mode, keyword provider failure does not return guessed volume, fixture mode estimates cost from `pricing.ts` with no network.
- Add `PERPLEXITY_API_KEY` and DataForSEO keys to `.env.example` only. `OPENAI_API_KEY` already exists.

Do not fold the three adapters into one file. They already exist as three files on the branch. Keep that split.

## Data structures

`ProviderCall` in provenance: `{ role, modelOrEndpoint, inputTokens?, outputTokens?, requestFeeUsd, estimatedUsd }`. `KeywordRow` matches the research record. Search results are `{ snippets, citationUrls }` with no full third-party page bodies stored.

## Verification

Static: `npx vitest run lib/engine/providers.test.ts`, `npm run typecheck`, `npm run lint`.

Runtime: none in CI. Optional local live smoke is out of this phase. Flag: no browser page for `control-ui`.
