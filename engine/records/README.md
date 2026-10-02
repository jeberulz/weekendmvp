# Engine research records

`npm run engine:research -- --brief <brief.json> --live` writes one JSON
research record per idea here (`engine/records/{slug}.json` by default;
`--out` moves it) and a run report next to it (`{out}.report.json` by
default; `--report` moves it). The report is written on failure too; a failed
run writes no record. An existing record or report is never overwritten
without `--force`, so a re-run after a failure needs `--force` or another
`--report` path. Fixture runs (`--fixture <name>`) write to
`engine/records/fixtures/` by default and are refused directly in this
folder, where published records live.

## Contract v2 (current)

A v2 record (`contractVersion: 2`, `pipelineVersion: 2`) holds:

- `mode`: `live` or `fixture`. Fixture records come from synthetic pages.
  `engine:compile` accepts them only under an `engine-draft-*` (or
  `_`-prefixed temp) slug and `audit:idea` only behind an `engine-draft-*`
  slug, so they never become public pages.
- `evidence.accepted`: community quotes, market statistics and competitor
  prices accepted by deterministic code against the pages the searches cited.
  Each keeps its source URL, a bounded excerpt in the page's own characters,
  the excerpt's SHA-256, `retrievedAt` and its typed claim.
- `evidence.rejected`: rejected candidates with their reasons (at most 200).
  Operator-only; never rendered.
- `evidence.sources`: one entry per URL the run tried to read, with its status
  and, for a page that was read, `retrievedAt` and `textSha256` (a hash of the
  page text; page bodies are never stored).
- The writer's fields, which cite evidence only by id or `[[ev:<id>]]` token
  and hold no other figures or quotations (the labelled proposal slots, such
  as tier prices and Year-One counts, aside); keyword rows from DataForSEO;
  provenance (provider calls including billed failures, cost, attempts per
  step, models, code revision).

The run report (`*.report.json`) is redacted: versions, mode, brief slug and
SHA-256, start and end times, the failed step and error, provider calls, cost,
attempts, models, code revision, source statuses, refused citations (host and
reason), accepted counts and rejections. It holds no secrets, page bodies or
local paths.

`engine:compile` and `audit:idea` read records with `parseResearchRecord`
(`lib/engine/research-record.ts`), which re-checks every accepted item against
its own excerpt and every reference against the accepted items. That proves
the record is consistent, not that its excerpts are authentic: for a live
record the operator opens the cited pages (`/publish-idea` Step 4.1); for the
fixture, `npm run engine:replay` and `npm test` compare excerpts and hashes
with the fixture pages.

Do not edit a record by hand. Changing an accepted item or a selected id, or
adding a figure or quotation to writer text, fails the parse; other edits
bypass the research. A wrong record is re-researched.

## Legacy v1 records

Records written before WP54 have `contractVersion: 1`. The three committed
here (`ai-code-reviewer.json`, `ai-landing-page-generator-ecommerce.json`,
`ai-rfp-response-assistant.json`) are v1 and are kept as history, like the
`engine/drafts/engine-draft-*` pages compiled from them. Their narratives
were written before (or without) accepting evidence, so `engine:compile` and
`audit:idea` refuse them with a re-research message, and nothing upgrades
them in place. `readLegacyResearchRecordV1` still reads them for history only.

To research one of these ideas again, run `engine:research` live. Its default
output path is the v1 file, which it refuses to replace without `--force`; an
explicit `--out` (for example `engine/records/engine-draft-ai-code-reviewer.json`)
keeps the v1 file. The three slugs belong to published handwritten pages in
`content/ideas/`, so compile the new record only as a draft
(`--slug engine-draft-<slug>`), never over those pages.

Contract: `docs/plans/idea-engine/pr71-evidence-contract.md`.
