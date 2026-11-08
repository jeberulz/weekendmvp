# WP91 Progress - Keep per-idea crew seeds current

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-08 - Setup

- Branch and worktree: `claude/wp91-seed-freshness` in `.worktrees/wp91-seed-freshness`, cut from `origin/main` at `2a8c8c54` (the WP90 merge, #278). The root checkout holds other sessions' uncommitted work.
- Assignment: a session that started this one asked for the smallest reliable way to keep WP90 seeds current, with a written proposal, a branch with tests, progress notes and a PR. Nothing may run live against prod.
- Lane: Work Package. It automates AI spend, so it is routed high-tier.

## 2026-11-08 - WP91-S1..S3

- Proposal: `docs/plans/launch-workspace/10-seed-freshness.md`. It chooses option (b), a GitHub workflow after Production deploys, over (a), a step in the publish path, and proposes a $2.50 per-run cap and a founders' share of 0.5.
- What was found in the WP90 code, and how it shaped the design:
  - `createRun` refuses only while a run at the version is open, so a fixed version can be re-run. But until that run's results land, its ideas have no seed row, and a second run would send them again. The gate therefore skips while a run is open.
  - In fixture mode, a run writes fixture seeds at the version. An unchanged page is then skipped for good once live mode is on. The gate therefore never sends outside live mode.
  - Seeds reserve from the free global pool (D22). `autoRunState` reads today's free-pool budget, plus what is spent and in flight, from the same counters the meter uses.
- Code:
  - `lib/workspace/crew/seedAutoRun.ts` (new): `decideSeedAutoRun`, `usdToMicroUsd`.
  - `convex/crew/seeds.ts`: `autoRunState`, an internal, read-only query.
  - `scripts/crew-seeds.mjs`: `--auto`, `--max-reserve-usd` and `--keep-free-pool`. It can target a deploy key, refuses `vibrant-jackal-308`, and writes its decision to the GitHub step summary.
  - `.github/workflows/crew-seeds.yml` (new): runs on `deployment_status` (Production, success), daily and by hand, with concurrency 1 on `main`. It skips when the secret or the version is missing, and passes `--apply` only on `CREW_SEEDS_AUTO_APPLY=true`.
  - `.env.example`: `CONVEX_DEPLOY_KEY` and `GITHUB_STEP_SUMMARY`. `tests/security/env-documentation` requires every key the code reads to be listed.
- Tests:
  - `tests/platform/wp91-seed-auto-run.test.ts` (17): the gate, `autoRunState` in convex-test with a real fixture run, and the workflow guards.
  - `tests/platform/wp91-seed-auto-script.test.ts` (7): the script end to end against a fake `npx` on PATH. Nothing reaches Convex.
- Docs updated: plan 10 (new), plan 09 "Running it", `CLAUDE.md` key paths, `docs/plans/idea-engine/PIPELINE.md`, `docs/PROJECT_STRATEGY.md` (WP91 row), `RULINGS.md` (a row for owner review), stories and progress.
- Not done (owner only):
  - adding the GitHub secret and variables;
  - the first library run;
  - any live or fixture run against prod.
  - The assumption that `npx convex run` honours `CONVEX_DEPLOY_KEY` without `--prod` is checked by the read-only dry run in plan 10, step 4.
