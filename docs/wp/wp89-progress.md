# WP89 Progress — Engine runtime gate + batch research path

## 2026-11-06

- Branch: `cursor/publish-ideas-batch-adapters-5637` from `origin/main` @ `40aa7ce4`
- Trigger: Orchestrator no-cost replay on Node v20.19.2 → exit 9
  (`bad option: --experimental-strip-types`); five research runs blocked
- Actions: portable resolver (bash + mjs), `engine-replay.sh` with log +
  `engine-replay-complete`, npm engine scripts via `run-engine-node.sh`,
  `.nvmrc`=22 (matches CI), semantic-dedupe confirm on batch live, Source Critic
  draft CLI, PIPELINE/skill/AGENTS runtime + dedupe rules
- Verified: stub Node20-only → exit 3, no complete marker; real Node 22.23.4 →
  replay PASS + complete marker; focused vitest 21/21; OpenAI probe 200 on this
  host (credit present). E7 still NO-GO.
- Next: PR for John; Orchestrator must `nvm install && nvm use` (or set
  `ENGINE_NODE`) on the Grok VM before the five live researches
