# WP70 Stories - Metering, budgets and runtime plumbing

Branch: `codex/wp70-metering`
Lane: Work Package (Phase 1, after G0)
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: C-METER implemented behind dormant workspace switches, exact owner caps and bounded global overshoot verified, full checks and isolated local Convex deploy pass, independent Claude review requested before owner merge.

## Stories

- [x] `WP70-S1` - Mount workflow, workpool, sharded counter and Resend components together
  - Scope: `convex/convex.config.ts`, generated API if needed.
  - Acceptance: one additive mount change, all new env entries optional, isolated local deploy boots.
- [ ] `WP70-S2` - Implement reserve, markSent, settle and fail
  - Scope: `convex/ai/{metering,budgets}.ts`.
  - Acceptance: C-METER signatures, server-derived plan and verified debit; owner and global caps; idempotent lifecycle and exactly-once accounting.
- [ ] `WP70-S3` - Prove concurrent reservations and failure accounting
  - Scope: Convex tests alongside metering.
  - Acceptance: owner cap cannot be oversubscribed; duplicate attempt/finalization is a no-op; possible billing charges worst case.
- [ ] `WP70-S4` - Sweep stale reservations and report spend alarms
  - Scope: `convex/crons.ts`, `convex/ai/metering.ts`, `convex/ops/spend.ts`.
  - Acceptance: unsent rows cost zero, sent rows charge reservation, late settle adds only positive adjustment; 80% and 100% alarm thresholds.
- [ ] `WP70-S5` - Define workspace rate limits
  - Scope: `convex/platform/limits.ts`.
  - Acceptance: named limits from architecture §13 and a guarded `checkLimit` built on the rate limiter component.
- [ ] `WP70-S6` - Add operations spend queries
  - Scope: `convex/ops/spend.ts`.
  - Acceptance: super-admin-only bounded spend summaries by model, prompt and plan, including top spenders.

## Out Of Scope

- Provider calls, gateway logic and prompt registry (WP71); ledger grants and plan catalogue (WP73); live activation, production deploy and owner merge.

## Notes

- C-METER in `lib/workspace/contracts/metering.ts` is frozen. New functions stay internal, and ownerless platform work uses the free global pool without an owner budget row.
