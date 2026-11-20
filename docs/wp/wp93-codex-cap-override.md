# WP93 — Codex request: per-founder daily cap override

Status: done. Codex C2 landed in #296 (the meter honours an expiring override on `ai_budgets`). WP93 Phase 3 (#300) built the console side, wired it to Convex and turned it on (`CAP_OVERRIDE_LIVE` is `true`). See "Turning it on" at the end.

The C2 implementation stores all five optional fields below on the founder's existing `ai_budgets` row. The console follow-up should set the fields together with the audit event in its mutation. Use an exclusive expiry in epoch milliseconds (the following midnight UTC for a whole-day override). The meter uses the plan cap again at the expiry instant or UTC rollover, whichever comes first. Partial overrides use the plan cap.

The Claude lane owns the console control. Local verification is recorded in `wp93-c2-progress.md`. The console rules are in `lib/admin/ai-costs/cap-override.ts`; the UI works on local fixtures.

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

## Turning it on (Claude lane) — done in #300

All four steps below are done. `convex/admin/aiControls.ts` has `capOverrides` (a bounded read by founder id, using the meter's own `activeCapOverrideMicroUsd`), `setCapOverride` and `clearCapOverride`. A raise patches the five fields together with its audit row, and creates a zero `ai_budgets` row when the founder has made no AI call yet. `convex/admin/aiControls.test.ts` checks every refusal and the audit rows, and checks that `internal.ai.metering.reserve` honours a raise set through the console.


1. Add `setCapOverride` and `clearCapOverride` to `convex/admin/aiControls.ts`, using the rules in `lib/admin/ai-costs/cap-override.ts`: `requireSuperAdmin`, a reason, `capOverrideRefusal`, `expiryFor`, a recent sign-in and the typed confirm for a raise, and an `audit_events` row (`ops.cap_override.set` / `ops.cap_override.cleared`, the metadata the fixture store writes today). Add a read of live overrides to `controlsState` or a new query.
2. Wire `liveBackend` in `lib/admin/ai-costs/controls-server.ts` (`capOverrides`, `setCapOverride`, `clearCapOverride`) to those functions.
3. Set `CAP_OVERRIDE_LIVE` to `true` and update the test that pins it to `false` (`tests/admin-ai/cap-override.test.ts`).
4. Convex tests for every refusal, as `convex/admin/aiControls.test.ts` does for the spend controls.

