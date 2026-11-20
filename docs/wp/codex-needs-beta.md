# Codex brief: beta readiness (2026-11-20)

Lane: Codex. Requested by the Claude orchestrator for the L1 private beta (`docs/wp/l1-release-plan.md`).
This file is the one place for the Codex work the beta needs. Needs from WP94–WP96 are listed under
"Schema needs from parallel WPs" as their PRs land, so the schema changes can go out in one pass.

Context: production is `www.weekendmvp.app` with Convex `first-squirrel-244`, `AI_PROVIDER_MODE=live`. The workspace
is on, the cohort is `allowlist`, and the daily pool budgets are $7 free and $3 paid. The owner manages budgets and the
cohort at `/admin/ai/controls` (#291).

Rules:
- Branch first.
- One PR per task below, unless two tasks change the schema; then put the schema in one PR.
- Tests for every behaviour listed.
- Never deploy, and never run anything against production. Merging to `main` deploys Convex prod through the Vercel
  build.

## C1. Tell the owner when a pool's budget alarm fires

**Today.** `internal.ops.spend.checkDailyAlarms` (`convex/ops/spend.ts`) runs every 15 minutes (`convex/crons.ts`,
"workspace AI spend alarms"). When the free or paid pool passes 80% or 100% of its daily budget, it sets the flag in
`ops_settings.spendAlarmState` and inserts an `audit_events` row. Nobody is told. The owner finds out only by opening
`/admin/ai`.

**Ask.**
1. For each newly due key (`free80`, `free100`, `paid80`, `paid100`, for today or the prior day), schedule one internal
   action from the mutation (`ctx.scheduler.runAfter(0, …)`). It sends the owner an email through the existing Resend
   component (`@convex-dev/resend`, already used by `convex/resendMagicLink.ts`).
   - Schedule only for `due` keys. The existing flags already make each key once per UTC day.
2. Recipient: the email of the account bound in `super_admins`, read at send time. Never hard-code or commit an
   address. If there is no active binding, send nothing and record that in the audit row.
3. Content:
   - pool, threshold, spent, in flight, budget, and the UTC day
   - a link to `https://www.weekendmvp.app/admin/ai`
   - no founder names, emails, ideas or business data
4. **Kill switches.** This alert must still go out while the `email` kill switch is on, because that switch stops
   founder-facing sends. **Owner decision needed** if Codex disagrees. Leave it unchanged otherwise.
5. A failed send is logged, retried once at most, and never blocks the alarm mutation or the meter.

**Tests:**
- a newly due key schedules exactly one send;
- a second run of the same day schedules none;
- the `email` kill switch on still sends;
- no super admin binding sends nothing;
- the email body has no founder data.

## C2. Per-founder daily cap override

Already specified by WP93: **`docs/wp/wp93-codex-cap-override.md`**. That covers:
- a schema field or table with an expiry, a reason and who set it;
- the meter reading it in `reserve`;
- the Free lifetime ceiling and pool budgets never lifted;
- tests.

The console UI (a `setCapOverride` mutation with step-up, a $25 a day ceiling, and a founder form) is built in the
Claude lane once this lands.

## C3. Testers' Free lifetime ceiling (waiting on an owner decision; do nothing yet)

A Free account stops for good at $1.50 of AI (`FREE_LIFETIME_CEILING_MICRO_USD`), Wren chat included, and gets one
business. Beta testers will reach it. The owner chooses one of:
- (a) cohort members get a complimentary Builder's Hub plan without payment. Codex would need a membership grant path
  that `readMembershipState` honours, audited and revocable from `/admin/ai/controls`.
- (b) the lifetime ceiling does not apply to cohort members during L1. This is a meter change that leaves the daily
  caps and pools untouched.
- (c) leave it as is.

Once ruled, it is recorded in `docs/wp/RULINGS.md` and this section turns into a task.

## Not Codex: the Wren "try again tomorrow" message (Claude lane)

The meter already says why it refused: `BUDGET_EXHAUSTED` with scope `owner_free_lifetime`, `owner_daily`,
`owner_daily_escalations`, `global_daily_free` or `global_daily_paid` (`lib/workspace/contracts/metering.ts`).
`causeFor` in `convex/workspace/chatActions.ts` collapses every one of them to `budget`, so a founder at the lifetime
ceiling reads "Try again tomorrow". The fix is in the Claude lane:
- a cause per scope;
- copy in `lib/workspace/wren.ts` (`WREN_FAILURE_COPY`).

The failure cause is not stored in the schema, so no Codex change is needed.

## Schema needs from parallel WPs (added as their PRs land)

- **WP94 (tester panel): none.** It was dropped because #291 shipped the controls and the cohort, and C2 covers the
  cap raise.
- **WP95 (tester feedback and error log, PR #298): required, and #298 waits on it.**
  - Two additive tables, defined once in `convex/feedback/tables.ts` as `feedbackTables`:
    - `feedback_entries`: indexes `by_createdAt`, `by_ownerId_and_createdAt`;
    - `client_errors`: indexes `by_createdAt`, `by_ownerId_and_createdAt`, `by_ownerId_and_dedupeKey`.
  - Codex spreads `...feedbackTables` into `defineSchema` in `convex/schema.ts`. No backfill is needed.
  - #298 carries a stand-in commit, `chore(wp95): wire feedbackTables into the schema (stand-in for Codex)`. Codex
    either takes it as is or lands the same line in its own PR, and the stand-in commit is then dropped from #298.
- **WP96 (account deletion, #294 merged): optional.** See `docs/wp/wp96-progress.md` § Codex needs.
  - A cron, or a guard in the sweeper, that restarts a stopped deletion chain. Today an operator must rerun
    `account/deletion:step` by hand. This is the most useful of the three.
  - An optional `users.deletedAt`.
  - A `stripe_events.by_email` index, only if the owner wants legacy payment rows scrubbed.
