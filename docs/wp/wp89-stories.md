# WP89 Stories — Engine runtime gate + batch research path

Branch: `cursor/publish-ideas-batch-adapters-5637`
Lane: Work Package
Definition of done: Grok/agent hosts on Node 20 get exit 3 + install steps
(not opaque exit 9); Node >= 22.6 runs `engine-replay.sh` to completion;
semantic-dedupe-before-spend is documented and enforced on `publish:ideas --live`;
E7 public release unchanged (NO-GO). No agent profile expansion. No prod publish.

## Stories

- [x] `WP89-S1` — Portable engine Node resolver
  - `scripts/lib/resolve-engine-node.sh` + `.mjs`, `run-engine-node.sh`,
    `engine-replay.sh`, `.nvmrc`, package.json engine script wrappers
  - Acceptance: Node 20-only → exit 3 + help; Node 22.6+ → replay PASS +
    `engine-replay-complete`; no strip-types polyfill

- [x] `WP89-S2` — Semantic dedupe before spend + Source Critic draft CLI
  - PIPELINE + skill rule (Scout + Corpus Guardian); `publish:ideas` requires
    `--confirm-semantic-dedupe` for `--live`; `engine:source-review --draft`
  - Acceptance: live batch without confirm exits 2; draft FAIL never clears gate

## Out of scope

- Agent chat profile / eggbot roster files
- WP46-E7 release switch / prod seed / managed publish
- Invented 429 failover or GSC candidate-selection feed
