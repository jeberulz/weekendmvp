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

## 2026-11-05 - Independent S1-S3 review repairs

- The independent reviewer found two P1s: a reused `attemptKey` could return another owner's usage ID before identity/gate checks, and a refunded debit or terminal task could still fund a new attempt. Fixed by checking the caller's owner/project/task and debit, enforcing the gate, comparing all immutable attempt fields, requiring queued/running tasks, and rejecting task debits with a matching refund row.
- Regression tests cover cross-owner and cross-task collisions, refunded debits, failed tasks, and a duplicate reserve after shutdown. Focused C-METER tests passed (9/9), typecheck and focused ESLint passed. A fresh full gate on the repaired tree remains next.
- Follow-up P2 from the same review: ownerless `markSent` did not inherit C-OPS's positive-global-budget AI gate. It now refuses a new send when both global budgets are zero. A transition test reserves ownerless work, zeros the budgets and expects `AI_DISABLED`; focused tests pass (9/9).
- First full `npm test` rerun overlapped review-fix checks and hit one 5-second timeout in the unrelated engine CLI test (`refuses to overwrite a record without --force`). No assertion failed. A clean serial rerun is required and has not yet passed.
- Independent review recheck closed the two P1s and the ownerless-budget P2 at `a8c842e2`. A cross-WP review then found that WP73 could cancel/refund a task between reserve and markSent. `markSent` now re-reads the task/project chain and debit/refund state in its own transaction before the first send. The regression test covers reserve → refund/cancel → refused send → unsent zero-charge cleanup. Focused tests passed (9/9); the clean full suite passed before this last fix, so its post-fix rerun remains required.
- Post-fix full `VITEST_MAX_WORKERS=2 npm test` passed all 13 scripted suites. Two earlier attempts with default worker parallelism timed out in unrelated 5-second engine/editorial tests under concurrent workstation load; the isolated engine CLI test passed 10/10. The worker cap changes only test concurrency, not test selection. `npm run typecheck`, focused ESLint and `npm run test:security` passed; production dependency audit reported 0 high/critical (1 existing moderate). The final build and isolated local Convex deploy on this last fix remain pending.
- Final S1-S3 gate: `npm run build` passed and anonymous isolated local Convex at 3340/3341 reported functions ready on the reviewed tree. `git diff --check` passed. Full lint was green (0 errors, 37 existing warnings) before the final markSent guard; focused ESLint on both edited files passed after it. A final full lint rerun is next before the PR.
- Needs from Claude orchestrator before owner merge: add the cleanup-only internal-function ruling to `RULINGS.md` and update `02-architecture.md`'s installed-but-unmounted component survey after WP70 S1. Both files are Claude-owned. No new environment variable was introduced.
- Final full `npm run lint` rerun on the PR tree passed with 0 errors and 37 existing warnings. All requested S1-S3 local checks are now green; no production or shared local backend was touched.
