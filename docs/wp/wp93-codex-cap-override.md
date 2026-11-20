# WP93 — Codex request: per-founder daily cap override

Status: requested 2026-11-20. Blocks the Phase 2 "raise one founder's cap" control.
Owner decision: deferred until Codex lands the schema and meter change below. The console builds the UI after that.

## Why

The meter refuses a founder's call once `ai_budgets.daySpentMicroUsd` would pass `OWNER_DAILY_CAP_MICRO_USD`. That cap is one constant (`lib/workspace/contracts/metering.ts`). The owner wants to lift it for one founder for a short time, for example during a demo or a support case. The change must be audited and must expire on its own.

## Asked of Codex (schema and meter are Codex-owned)

1. **Schema.** Add optional fields to `ai_budgets` (or a new `ai_cap_overrides` table keyed by `ownerId`, whichever fits the meter better):
   - `capOverrideMicroUsd: v.int64()`: the daily cap while the override is live;
   - `capOverrideExpiresAt: v.number()`: epoch ms; at most the end of the current UTC day unless the owner rules otherwise;
   - `capOverrideSetBy: v.id("users")`, `capOverrideSetAt: v.number()`, `capOverrideReason: v.string()`.
2. **Meter.** Wherever the owner's daily cap is checked (`reserve` and its pure helpers), use `capOverrideMicroUsd` while `now < capOverrideExpiresAt`, and the constant otherwise. The override must never:
   - lift the Free lifetime ceiling (`FREE_LIFETIME_CEILING_MICRO_USD`);
   - lift the global pool budgets or kill switches;
   - apply to `ownerBudgetBypass` calls, which are already uncapped.
3. **Tests.** A meter test where:
   - an override lets a call through above the constant;
   - the same call is refused after expiry;
   - the Free lifetime ceiling still holds under an override.

## What the console will add once that lands

- In `convex/admin/aiControls.ts`, a `setCapOverride` mutation:
  - `requireSuperAdmin(ctx, now)` and an `audit_events` row;
  - a hard ceiling of $25 a day;
  - a required reason;
  - an expiry that defaults to the end of the UTC day;
  - a fresh sign-in and a typed confirm, the same as other risky controls.
- On the founder drill-down, a "Raise today's cap" form, and the live override shown in the founder row with its expiry.
