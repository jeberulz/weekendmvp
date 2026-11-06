# WP88 Stories — Source Critic gate + Ideabrowser Phase 9

Branch: `cursor/source-critic-gate-p0p2-53d8`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: live `engine:compile` and `editorial:submit-engine` refuse
without a sealed Source Critic PASS; hermetic tests cover skip/fail/tamper;
Ideabrowser MCP wiring and agent-doc Mode A language removed; one pipeline
truth doc exists. No content publication, no prod deploy, no merge without John.

## Stories

- [x] `WP88-S1` — Source Critic contract + fail-closed gates
  - Scope: `lib/engine/source-review.ts`, `compile-write.ts`, `validated-artifact.ts`,
    `convex/editorial/ingest.ts`, compile/submit CLIs, hermetic tests
  - Acceptance: missing/FAIL/tampered/stale/thin reviews refuse; sealed PASS
    proceeds; fixture mode still compiles without a review
  - Verification: `npm run test:engine` (source-review), `npm run test:editorial`,
    focused convex ingest/release tests

- [x] `WP88-S2` — Ideabrowser Phase 9 cleanup + pipeline truth doc
  - Scope: `.cursor/mcp.json`, `.mcp.json`, `.env.example`, `AGENTS.md`,
    `CLAUDE.md`, `scripts/check-ideabrowser-runtime.mjs`,
    `docs/plans/idea-engine/PIPELINE.md`, skill Step 3.0
  - Acceptance: no Ideabrowser server in MCP configs; docs point at owned engine;
    `npm run check:ideabrowser-runtime` exits 0
  - Verification: check script + doc review

## Deferred (explicit)

- Grok Bot / dr eggbot agent roster definitions (created separately)
- Newsletter Phase 8 Ideabrowser AM retirement
- Deleting Ideabrowser hub credentials / cloud env secrets (irreversible; needs
  explicit owner go per phase-9 plan)
- Rewriting stale WP44 handoff banners in `AGENTS.md` / `CLAUDE.md`
- Backfilling `*.source-review.json` for already-published engine rows (fail-closed
  on re-submit until reviewed)
- Public compile-path soft warnings for handwritten ideas (out of scope)

## Owner ruling (2026-11-06)

Live `engine:compile` and `editorial:submit-engine` are fail-closed without a
sealed Source Critic PASS bound to the record hash. Fixture mode remains exempt
for hermetic replay. Ideabrowser MCP is removed from repo MCP configs and agent
docs (Phase 9); hub credential deletion stays deferred until an explicit
irreversible-go. Pipeline truth: `docs/plans/idea-engine/PIPELINE.md`. No content
publication in this slice.

(RULINGS.md append deferred in this environment: the file already contains a
historical email that matches a configured secret name and blocks commits that
touch the file.)
