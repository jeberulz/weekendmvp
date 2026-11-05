# WP70 Progress - Metering, budgets and runtime plumbing

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-05 - Setup

- Branch/worktree: `codex/wp70-metering` in `.worktrees/wp70-metering`, created from `origin/main` at `d67dc8e2` after John's Phase 1 go.
- Assignment: WP70 S1-S6 from `04-build-plan.md`; C-METER implementation and dormant runtime plumbing.
- File boundaries: `convex/convex.config.ts`, `convex/ai/{metering,budgets}.ts`, `convex/platform/limits.ts`, `convex/ops/spend.ts`, `convex/crons.ts`, WP70 tests and these WP70 docs. WP73 owns billing/plans separately.
- Required checks: typecheck, lint, full test, build, security tests, additive isolated anonymous local Convex deploy, diff check; independent Claude review before owner merge.
- Initial risks: sharded global budget has bounded overshoot but exact owner ceilings; the debit must be verified before treating cost as credit-funded; `markSent` separates uncertain provider billing from unsent calls; late settles cannot double count.

## 2026-11-05 - WP70-S1

- Actions taken: mounted workflow, named `crewWorkpool`, sharded counter and Resend together; added the already transitively installed workpool as a direct package dependency. Regenerated the Convex component API.
- Decisions made: no new env entries are needed for mounting; the existing workspace and AI switches remain off by default.
- Checks run: `npm run typecheck` passed. All four components installed and the functions became ready on isolated anonymous local Convex at 3340/3341, with a dummy local-only value for the pre-existing required billing bridge entry. No cloud deployment was contacted.
- Result: S1 complete. Next: C-METER runtime lifecycle and owner/global accounting.

## 2026-11-05 - WP70-S2 and S3

- Actions taken: implemented internal C-METER `reserve`, `markSent`, `settle`, `fail` and bounded stale sweep in `convex/ai/metering.ts`. Added `ai_budgets` storage conversion and sharded per-day/per-pool spent and in-flight counters in `convex/ai/budgets.ts`. Reservations derive the plan from membership, verify owner/project/task and a credit-funded debit, enforce the active workspace and kill switches, and write the owner budget and global counter in the same transaction. Duplicate attempt keys return the existing usage ID. Finalization releases the original reservation day/pool, and late settle adds only the positive difference after a sweep.
- Tests added: eight Convex tests cover exactly-once settle and duplicate attempt, concurrent owner-cap reservation, ownerless precompute, verified credit debit and paid pool, possible-billing failure, shutdown cleanup, bounded sweep and day rollover. Targeted Vitest passed (8/8), typecheck passed, focused ESLint passed.
- Owner ruling received through the Platform lane: `reserve` and `markSent` must be gated while the workspace is off; cleanup-only internal `settle`, `fail` and stale sweep may finalize existing reservations after shutdown. The `markSent` repeat of an already sent row is a no-op. This permits kill-switch shutdown without leaving money reserved forever.
- Needs from Claude orchestrator: append this narrow cleanup-only internal-function ruling to `docs/wp/RULINGS.md` before the WP70 PR is merged. That file belongs to the orchestrator lane.
- Next: S4 alarms/cron, S5 limits, S6 spend console; full verification and independent review remain pending.
