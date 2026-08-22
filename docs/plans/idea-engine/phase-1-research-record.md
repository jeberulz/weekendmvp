# Phase 1. Research record

Back: [overview](overview.md)

## Goal

A versioned TypeScript type plus a parse function that accepts only complete research. Illegal states do not compile. Thin citations fail at parse time, not in the skill.

This is the operator record. It is not `ValidationReportPayload` in `convex/platform/engine/contracts.ts`. That type stores citation indices into Convex `document_citations`. This type stores URLs. Mirror the same fail-closed bars (`MIN_MARKET_STATS = 2`, `MIN_COMPETITORS = 3`, finite `volume`/`cpc`). Do not import `ConvexError` or `assertGeneratedDocumentBody`. A mapper can exist later.

## Changes

- Add `lib/engine/research-record.ts` with the type, `parseResearchRecord`, and the fail-closed checks (min 2 market stats with URLs, min 3 competitors with pricing and a URL, keyword rows must include numeric volume from a provider, never from a model).
- Add `lib/engine/research-record.test.ts` with fixtures: valid gold, missing citations, guessed keywords, unknown `contractVersion`.

Do not add CLI, providers, or MDX output.

## Data structures

`ResearchRecord` with `contractVersion: 1`, `brief`, `market`, `competitors`, `community`, `keywords`, `goToMarket`, `whyNow`, optional `scores`, and `provenance` (`providerCalls`, `costUsd`, `ranAt`). Citations are `{ url, title }`. Keyword rows are `{ term, volume, competition, cpc }`.

## Verification

Static: `npx vitest run lib/engine/research-record.test.ts`, then `npm run typecheck` and `npm run lint`.

Runtime: none. No UI yet. Flag: this phase has no browser page for `control-ui`.
