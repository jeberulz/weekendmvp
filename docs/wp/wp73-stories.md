# WP73 Stories - Ledger v2 and plan catalogue

Branch: `codex/wp73-ledger-v2`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: dormant additive credit buckets, idempotent grants and refunds, workspace plan limits and a summary query; existing billing tests unchanged and green.

## Stories

- [x] `WP73-S1` - Allowance and bonus buckets
  - Debit allowance first and record a `bucketSplit`; refund the same split. Preserve the single `balance` and legacy credit-pack behavior.
  - Verify bucket conservation and insufficient-credit behavior in Convex tests.
- [x] `WP73-S2` - Idempotent grants and allowance expiry
  - Add internal starter, paid-invoice and recurring grant mutations using the keys in architecture §7; expire unused allowance before a new period grant.
  - Verify replay, conflict and period replacement; leave triggers for WP74/WP80.
- [x] `WP73-S3` - Cancelled-task refunds
  - Permit a cancelled task to refund only once, to its original buckets.
  - Verify failed and cancelled paths and rejection of other statuses.
- [x] `WP73-S4` - Workspace plan limits
  - Add the §4.3 limits and dormant `growth` ID, with no Stripe price mapping; gate workspace features on the server.
  - Verify Free, Builder's Hub and Growth values and feature denial.
- [x] `WP73-S5` - Credits summary
  - Add an owner-scoped query for balance, allowance, bonus and period end, failing closed behind the workspace switch.
  - Verify ownership and missing-account behavior.
- [ ] `WP73-S6` - Property and full gate
  - Test varied grant, debit, refund and expiry sequences for ledger sum and bucket invariants; leave `billing.test.ts` unchanged.
  - Run typecheck, lint, full tests, build, isolated local Convex and diff check; request Claude's independent review before merge.

## Out of scope

- Membership webhook wiring, Stripe objects, live activation, credit-pack UI, provider calls and production deployment.

## Notes

- `PRICES_STATUS` is frozen. Unpriced video and later change rounds throw `PRICE_NOT_SET`; the ledger never debits a placeholder.
