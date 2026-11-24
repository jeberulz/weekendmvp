# WP92 Stories - Keep per-idea crew seeds current

Branch: `claude/wp91-seed-freshness` (worktree `.worktrees/wp91-seed-freshness`)
Lane: Work Package (AI spend automation, CI; high-tier routing)
Registry: `docs/PROJECT_STRATEGY.md`
Plan / proposal: `docs/plans/launch-workspace/10-seed-freshness.md`
Definition of done: a written proposal, plus a guarded automatic seed run on its own
branch with tests and docs, and a PR open for review. Nothing runs live against prod.
Live spend stays off until the owner switches it on.

## Stories

- [x] `WP92-S1` - Unattended-run gate
  - Scope: `lib/workspace/crew/seedAutoRun.ts` (new), `convex/crew/seeds.ts`
    (`autoRunState`, read-only), tests.
  - Acceptance criteria:
    - `decideSeedAutoRun` skips while a run at the version is open. It sends nothing
      when nothing changed, and only dry runs outside live mode or with the switch
      off. It refuses over the per-run cap, and waits when the reservation would cut
      into the founders' share of today's free pool.
    - `autoRunState` reports the open run, live mode (whether a key is set, never the
      key) and today's free-pool budget and use.
  - Verification: `npx vitest run tests/platform/wp92-seed-auto-run.test.ts`
- [x] `WP92-S2` - `crew:seeds --auto`
  - Scope: `scripts/crew-seeds.mjs`, `tests/platform/wp92-seed-auto-script.test.ts`.
  - Acceptance criteria:
    - `--auto` needs `--max-reserve-usd` and `--keep-free-pool`, plus a target
      (`--prod`, `--deployment` or `CONVEX_DEPLOY_KEY`). It submits only the changed
      ideas, and only when the gate says apply and `--apply` was given.
    - Over the cap it exits 3, and it writes a line to the GitHub step summary.
    - It never targets `vibrant-jackal-308`, and it prints only a deploy key's
      deployment name.
  - Verification: `npx vitest run tests/platform/wp92-seed-auto-script.test.ts` (a
    fake `npx`; nothing reaches Convex).
- [x] `WP92-S3` - Workflow and docs
  - Scope: `.github/workflows/crew-seeds.yml`, plan 10, plan 09, `CLAUDE.md`,
    `docs/plans/idea-engine/PIPELINE.md`, `docs/PROJECT_STRATEGY.md`, `RULINGS.md`.
  - Acceptance criteria:
    - The workflow runs after a successful Production deployment, daily, or by hand,
      one run at a time, on `main`. It skips when the secret or the seed version is
      missing, and passes `--apply` only when `CREW_SEEDS_AUTO_APPLY` is `true`.
  - Verification: workflow guard tests in `wp92-seed-auto-run.test.ts`.

## Out Of Scope

- Setting the secret or variables, or any live or fixture run against prod (owner only).
- A seed step inside `/publish-idea` or `editorial:submit-engine` (option (a), not chosen; plan 10 explains why).
- Changes to the meter, the seed prompt or the batch path.
