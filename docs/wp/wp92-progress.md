# WP92 Progress - Keep per-idea crew seeds current

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-08 - Setup

- Branch and worktree: `claude/wp91-seed-freshness` in `.worktrees/wp91-seed-freshness`, cut from `origin/main` at `2a8c8c54` (the WP90 merge, #278). The root checkout holds other sessions' uncommitted work.
- Assignment: a session that started this one asked for the smallest reliable way to keep WP90 seeds current, with a written proposal, a branch with tests, progress notes and a PR. Nothing may run live against prod.
- Lane: Work Package. It automates AI spend, so it is routed high-tier.

## 2026-11-08 - WP92-S1..S3

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
  - `tests/platform/wp92-seed-auto-run.test.ts` (17): the gate, `autoRunState` in convex-test with a real fixture run, and the workflow guards.
  - `tests/platform/wp92-seed-auto-script.test.ts` (7): the script end to end against a fake `npx` on PATH. Nothing reaches Convex.
- Docs updated: plan 10 (new), plan 09 "Running it", `CLAUDE.md` key paths, `docs/plans/idea-engine/PIPELINE.md`, `docs/PROJECT_STRATEGY.md` (WP92 row), `RULINGS.md` (a row for owner review), stories and progress.
- Not done (owner only):
  - adding the GitHub secret and variables;
  - the first library run;
  - any live or fixture run against prod.
  - The assumption that `npx convex run` honours `CONVEX_DEPLOY_KEY` without `--prod` is checked by the read-only dry run in plan 10, step 4.

## 2026-11-08 - Review fix (PR #280, Codex P2)

- **The open-run check could miss a newer open run.** `autoRunState` and `createRun` read only the first 20 runs at a version. A fixed, long-lived version gains a run every time content changes, so after 20 finished runs a newer preparing or submitted run was invisible, and `--auto` could send the same ideas twice. Both now go through `hasOpenRunAt`, which reads the open statuses through the existing `by_status` index and matches the version. Finished runs can no longer hide an open one, and no schema change was needed.
- New test: 25 finished runs at the version, then an open run. `autoRunState` reports it, and a second `createRun` is refused.
- Checks:
  - `npm run typecheck`: green.
  - Convex tsc: 0 errors.
  - eslint on the changed files: clean.
  - `npm run test:platform`: 2,822 pass.

## 2026-11-08 - Merged `main` and renumbered to WP92

- PR #279 (Roster per idea) landed on `main` as WP91, with its own `docs/wp/wp91-*.md`. This work is now **WP92**:
  - stories and progress moved to `docs/wp/wp92-*.md`, and the tests to `tests/platform/wp92-seed-auto-*.test.ts`;
  - the registry row, the RULINGS row and the code comments now say WP92;
  - `main`'s WP91 files are kept unchanged.
  - The branch keeps its name, `claude/wp91-seed-freshness`.
- `main` moved the seed prompt to `crew-idea-seed@2`. Nothing here depends on the prompt version.
