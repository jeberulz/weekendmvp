# WP79 Stories — Tenant email engine

Branch: `codex/wp79-tenant-email`
Lane: Work Package (Phase 2, Codex)
Registry: `docs/PROJECT_STRATEGY.md`; source: `docs/plans/launch-workspace/04-build-plan.md` §WP79
Definition of done: an approved four-step sequence reaches a test inbox on schedule with double opt-in, consent, postal address and unsubscribe; retry does not duplicate; an independent Claude security review passes before owner merge.

## Stories

- [ ] `WP79-S1` — Configure the mounted Resend component for a separate tenant project and domain using optional tenant-only env. Keep auth mail isolated and all sends off without credentials.
- [ ] `WP79-S2` — `activateSequence` requires current approved `send` approval and version; respect per-step approvals. Fail closed until WP76 draft and WP77 C-APPROVAL contracts merge.
- [ ] `WP79-S3` — Five-minute sender scans due opted-in enrollments, reserves a stable `send:{enrollmentId}:{stepId}` key, enforces plan caps including Free 50 lifetime, and handles retries exactly once.
- [ ] `WP79-S4` — Double opt-in confirmation first, tokenized `/u/{token}` unsubscribe, and mandatory founder postal address in every tenant email before any send.
  - [x] `WP79-S4a` — Schedule daily seven-day finalized and 30-day abandoned Resend component cleanup, including while workspace/email is off. Prove cleanup removes due rows, preserves younger rows, and never enqueues mail. Keep tenant sending off.
  - [x] `WP79-S4b` — Before contact erasure, inspect a bounded set of every enrollment state for the lead and cancel linked queued mail, including paused, completed and unknown states. Revoke nonterminal enrollments; prove owner deletion leaves no linked queued send behind. No new enrollment writer or sender.
  - [x] `WP79-S4c1` — Add an optional contact-revocation proof timestamp and lead/pending index on enrollments. Missing proof stays pending regardless of state. Scope: growth schema, schema checks, WP79 docs. Verify legacy rows still validate and the index is additive.
  - [x] `WP79-S4c2` (WP78-S4e2c) — Revoke historical mail in batches using that proof. Due purge must keep the lead until every enrollment and token is safe. Retain the atomic owner delete for ordinary contacts; allow bounded maintenance for exceptional histories. Add internal, non-sending recovery for missing send links with exact component-key and ownership verification. Unknown links fail closed. Scope: WP79 contact helpers/tests, WP78 due worker/test, generated API if needed, WP79/WP78 docs. Test bounded progress, replay, cross-tenant refusal, and safe recovery with the mounted component.
  - [x] `WP79-S4d` (WP78-S4e3) — Own the hourly privacy recovery cron, bounded dispatcher and overdue audit alerts. Keep the existing workspace-off cleanup rulings, and test with restored job rows and no pending scheduled calls.
- [ ] `WP79-S5` — Verify Resend delivery webhook; bounce and complaint pause the sequence and surface state to Wren.
- [ ] `WP79-S6` — Security and integration gate: no send without approval, opt-in, postal address or feature flag; no duplicate on retry; unsubscribe blocks the next step. Record checks and independent review.

## File boundary

Own `convex/growth/email/**`, tenant webhook in `convex/http.ts`, sender in `convex/crons.ts`, `app/u/**`, tenant env in `.env.example`, WP79 docs and new WP79 security tests. WP78 owns tenant middleware, sites and lead routes. WP79 is the sole Phase 2 writer of `convex/crons.ts`; integrate WP78 retention entry on request after its function lands. Schema additions require a separate early contract change and coordination before implementation uses them.

## Out of scope

- No live Resend project/domain creation, production send, credential changes, DNS changes or production deploy by the agent.
- No Claude-owned draft, approval, Wren UI, or tenant renderer edits.
- No fabricated C-APPROVAL or WP76 draft contract; dependent paths fail closed pending merged contracts.
