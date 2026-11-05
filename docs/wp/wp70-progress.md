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
