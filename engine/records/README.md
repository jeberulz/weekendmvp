# Engine research records

`npm run engine:research` writes one JSON research record per idea here
(`engine/records/{slug}.json`) and a run report next to it
(`{slug}.json.report.json` by default; `--report` moves it). The report is
written on failure too; a failed run writes no record.

## Contract v2 (current)

A v2 record (`contractVersion: 2`, `pipelineVersion: 2`) holds:

- `mode`: `live` or `fixture`. Fixture records come from synthetic pages and
  are never published.
- `evidence.accepted`: community quotes, market statistics and competitor
  prices accepted by deterministic code against the pages the searches cited.
  Each keeps its source URL, a bounded excerpt in the page's own characters,
  the excerpt's SHA-256, `retrievedAt` and its typed claim.
- `evidence.rejected`: rejected candidates with their reasons (at most 200).
  Operator-only; never rendered.
- `evidence.sources`: one entry per URL the run tried to read, with its status
  and, for a page that was read, `retrievedAt` and `textSha256` (a hash of the
  page text; page bodies are never stored).
- The writer's fields, which reference evidence by id or `[[ev:<id>]]`
  token; keyword rows from DataForSEO; provenance (provider calls including
  billed failures, cost, attempts per step, models).

`engine:compile` and `audit:idea` read records with `parseResearchRecord`
(`lib/engine/research-record.ts`), which re-checks every accepted item against
its own excerpt and every reference against the accepted items. That proves
the record is consistent, not that its excerpts are authentic: for a live
record the operator opens the cited pages (`/publish-idea` Step 4.1); for the
fixture, `npm run engine:replay` and `npm test` compare excerpts and hashes
with the fixture pages.

Do not edit a record by hand. Changing an accepted item, a selected id or a
figure in a factual field fails the parse. A wrong record is re-researched.

## Legacy v1 records

Records written before WP54 have `contractVersion: 1`; on 2026-10-01 all three
committed here are v1. Their narratives were written before (or without)
accepting evidence, so `engine:compile` and `audit:idea` refuse them with a
re-research message and nothing upgrades them in place. Re-run
`npm run engine:research -- --brief engine/briefs/<name>.json --live --force`.
`readLegacyResearchRecordV1` still reads them for history only.

Contract: `docs/plans/idea-engine/pr71-evidence-contract.md`.
