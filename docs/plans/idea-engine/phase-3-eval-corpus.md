# Phase 3. Eval corpus

Back: [overview](overview.md)

## Goal

A fixed, committed baseline so later phases prove "as complete as pages we already shipped", not "as good as the last Ideabrowser dump". You cannot A/B against MCP after the sub lapses. Do not wait on MCP for this corpus.

## Changes

- Add `engine/eval/gold.json` listing three slugs: `ai-rfp-response-assistant`, `ai-code-reviewer`, `ai-landing-page-generator-ecommerce`. Each row stores the auditor checks that already pass, competitor count, citation URL count from `## Sources`, and word count. Generate those numbers from the auditor. Do not hand-type them.
- Add `scripts/engine-eval.mjs` and `engine:eval` in `package.json`. The script re-runs the auditor on those slugs and diffs counts against `gold.json`. Fail if a gold page regresses. Later phases will add a compiled-output comparison against the same checks.

Do not scrape Ideabrowser. Do not store MCP payloads.

## Data structures

`GoldEntry`: `{ slug, wordCount, competitorMentions, sourceLinkCount, howToStepCount }`. The eval script treats `gold.json` as the expected side of the diff.

## Verification

Static: `npm run typecheck`, `npm run lint`.

Runtime: `npm run engine:eval` exits 0 on current `main`. Break one gold MDX heading in a throwaway copy, confirm the script goes red, restore it. No browser.
