# WP73 Progress - Ledger v2 and plan catalogue

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-05 - Setup

- Branch/worktree: `codex/wp73-ledger-v2` in `.worktrees/wp73-ledger-v2`, based on `origin/main` at `d67dc8e2` after owner go on G0.
- Assignment: WP73 S1-S6, Work Package lane. The existing ledger remains the single credit store; C-JOBS is frozen.
- File boundaries: `convex/platform/billing/{ledger,grants,queries}.ts`, `convex/platform/{plans,entitlements,transitions}.ts`, new tests and this WP's docs. No WP70 files, shared contracts, Stripe wiring or production deployment.
- Required checks: typecheck, lint, full tests, build, isolated anonymous local Convex, diff check. Existing `convex/platform/billing/billing.test.ts` must remain unchanged.
- Initial risks: legacy purchase/dispute entries have no bucket metadata; disputes may make the bonus-derived balance negative. Grant replay must not expire a new period. Growth must remain dormant in checkout and existing membership UI.

## 2026-11-05 - Contract-change request for period-safe refunds

- Finding: C-DATA's optional `bucketSplit` records source amounts but not the allowance period. A refund after a renewal would restore expired allowance as spendable balance.
- Proposed additive change: optional `credit_ledger.allowancePeriodEnd` on task debit/refund. Refund still records the exact original split; if its period expired or was replaced, an idempotent `allowance_expiry` entry removes that old allowance in the same mutation.
- This is a post-G0 schema contract change. Claude orchestrator: please acknowledge it and add the corresponding line to `docs/plans/launch-workspace/contract-changes.md` under the §5 process. This WP will carry the `contract-change` PR label. No production data migration is required because old debit rows have no allowance split.

## 2026-11-05 - WP73-S1 through S5

- S1: the existing ledger now allocates `task_debit` from allowance first and stores the positive source split. `task_refund` restores exactly that split. Legacy purchase and dispute entries continue to affect the bonus-derived balance without new bucket metadata.
- S2: added internal starter, paid-invoice and recurring grants. A replay checks the existing grant before any expiry; invoice references are unique across owners, and replaced allowances expire once. Nothing calls these mutations yet; WP74/WP80 own the triggers.
- S3: failed and cancelled tasks can refund; queued and successful tasks cannot. An old-period refund writes the original split and an idempotent expiry in one transaction. An overdue allowance also expires before a new debit if renewal has not arrived.
- S4: `WORKSPACE_PLAN_LIMITS` derives the frozen C-JOBS reference for Free, Builder's Hub and dormant Growth. Growth has no checkout price or live membership mapping. Existing `PLAN_LIMITS` remains the live legacy storefront catalogue; workspace feature checks use the new rows and fail with `UPGRADE_REQUIRED` behind the workspace switch.
- S5: `creditsSummary` is owner scoped and requires the workspace feature gate. It reports balance, allowance, bonus, period end and suspension from the existing account.
- Focused checks: new WP73 tests plus the unchanged legacy billing suite passed (17 tests total). Typecheck passed before the final stale-period/dispute tests; full gate follows.

## 2026-11-05 - Security boundary and shell contract refinement

- Existing WP64 security tests forbid the credit ledger module from importing or reading membership tables. Removed direct membership access from grant entry points; WP74 must verify Free before starter grant and WP80 must verify the live lifetime/comp grant before recurring grant. Those mutations remain internal and unwired in WP73.
- `creditsSummary` now returns both raw ledger `balance`/`allowanceRemaining` for reconciliation and `spendableBalance`/`spendableAllowance` at read time. Claude WP72: consume the spendable fields for the shell meter, and use `allowancePeriodEnd` to refresh around expiry; no query-side write occurs.
- A direct TypeScript import from the frozen C-JOBS contract uses its `.ts` extension so Node's source-level security test can import the catalogue. No Claude-owned contract file was edited.
- Caller preconditions: WP74 must verify the signed-in owner is on Free and the new wizard project is their first workspace business before calling `grantStarter(ownerId, projectId)`. WP80 must verify a paid Stripe invoice's owner, plan and billing period before `grantPaidInvoice`, or a live, unsuspended, unrevoked lifetime/comp grant's owner and anniversary period before `grantRecurring`. The internal mutations validate owner existence, fixed plan amount, period/key format and replay identity; invoice and recurring references are globally unique across owners.
