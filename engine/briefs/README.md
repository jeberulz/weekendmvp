# Briefs for engine:research

- Live research: `npm run engine:research -- --brief engine/briefs/<name>.json --live`.
  `code-reviewer.json`, `landing-page-generator-ecommerce.json` and
  `rfp-assistant.json` are the representative live briefs.
- Fixture runs (`--fixture <name>`, no keys, no network) use the synthetic
  fixture in `lib/engine/providers/fixtures.ts`, which describes one idea:
  the RFP assistant (slug `ai-rfp-response-assistant`). The CLI refuses a
  fixture run for any other slug, so fixture data never lands under another
  idea. Records and reports from fixture runs say `"mode": "fixture"`.
  - `rfp-assistant` — the default fixture: a complete record.
  - `rfp-assistant-thin-evidence` — `"fixtureScenario": "thin-evidence"`:
    every community page is unreadable, so acceptance finds no quote and the
    run stops before keyword and editorial spend (a failure with a report).
- `fixtureScenario` is fixture-only; a live run refuses a brief that has it.
