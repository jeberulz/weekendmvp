# Briefs for engine:research

- Live research: `npm run engine:research -- --brief engine/briefs/<name>.json --live`.
  `code-reviewer.json`, `landing-page-generator-ecommerce.json` and
  `rfp-assistant.json` are the representative live briefs. A live brief's
  title, slug and one-liner are used as written (the brief-normalization
  model may only tidy the business model line and the seed keywords), and
  the one-liner may hold no figures, quotations or evidence tokens.
- Fixture runs (`--fixture <name>`, no keys, no network) read
  `engine/briefs/fixtures/<name>.json` and use the synthetic fixture in
  `lib/engine/providers/fixtures.ts`, which describes one idea under the slug
  `fixture-rfp-response-assistant`. No published idea has that slug (a test
  checks), the CLI refuses a fixture run for any other slug, and a fixture
  record is written to `engine/records/fixtures/` by default and never to
  `engine/records/<slug>.json`, where published records live. Records and
  reports from fixture runs say `"mode": "fixture"`.
  - `fixtures/rfp-assistant` — the default fixture: a complete record.
  - `fixtures/rfp-assistant-thin-evidence` — `"fixtureScenario": "thin-evidence"`:
    every community page is unreadable, so acceptance finds no quote and the
    run stops before keyword and editorial spend (a failure with a report).
- `fixtureScenario` is fixture-only; a live run refuses a brief that has it.
- `npm run engine:replay` runs the `rfp-assistant` fixture through the real
  research, compile and deep-audit CLIs in a temp dir (no keys, nothing
  written to the repo); `npm test` runs the same flow with adversarial cases.
