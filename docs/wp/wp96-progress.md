# WP96 Progress - Privacy and deletion basics for the beta

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-20 - Setup

- Branch/worktree: `claude/wp96-privacy-deletion-af66c4`, worktree `.claude/worktrees/wp96-privacy-deletion-af66c4`, cut from `main` at `013fdf23`.
- Assignment: from the orchestrator session. Draft the data map and policy text, and build account and data deletion. WP94 (tester panel) and WP95 (feedback) run in parallel.
- File boundaries:
  - Owned: `convex/account/**`, `app/dashboard/settings/**`, `docs/wp/wp96-*`.
  - Do not edit: the live privacy and terms pages, `components/workspace/**`, `lib/track.ts`, `app/admin/feedback/**`, `components/admin/ai-costs/*`, `app/admin/ai/**`, `CLAUDE.md`, `AGENTS*`, `package.json` scripts, `docs/wp/l1-release-plan.md`.
  - Codex-owned: `convex/schema*`, `convex/crons.ts`, http and middleware.
  - Also touched: one registry row in `docs/PROJECT_STRATEGY.md` (WP number reservation).
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `a11y-check` on the deletion screen.
- Initial risks:
  - `docs/wp/RULINGS.md` 2026-08-05 (WP22): "No destructive deletion in v1 ... physical deletion ... requires a later policy and separately gated migration." Also: "credit-ledger and audit records remain immutable." This package physically deletes founder data and edits the `metadata` field of audit rows, so both need owner ratification (Q1, Q2).
  - A dormant D5 account-closure path already exists (`convex/platform/sites/accountClosure.ts`, behind `TENANT_LEAD_DELETE_REQUESTS_ENABLED`). It only archives businesses and schedules a 30-day lead purge. WP96 must not fight it.
  - No new table or field is allowed (schema is Codex-owned), so the deletion chain keeps its state in scheduled-function arguments and in the existing `users.accountClosureRequestedAt` marker.

## Codex needs (schema, index, cron, http)

None are required for the delivered scope. These would improve it:

1. A `deletedAt` field on `users`, so a scrubbed account can be told apart from a never-filled one without reading `accountClosureRequestedAt`. Optional; today the marker is enough.
2. An index `idea_request_votes.by_voterKey` already exists, but `voterKey` embeds the session id (`user:<userId>|<sessionId>`), so WP96 finds a founder's votes by a string-prefix range. No change needed; noted so nobody "fixes" the key shape without telling WP96.
3. `stripe_events` (legacy ship·able payments) holds an `email` with no email index. WP96 cannot find or scrub those rows. If the owner wants them scrubbed, Codex adds `by_email` (staged) or a one-off script.
4. `offer_cohorts` stores an email hash only. WP96 does not touch it (owner question Q6).
5. A cron that re-runs a stuck deletion chain. Today a failed batch retries by rescheduling itself; if Convex drops the chain, a founder can press "Delete my account" again and it resumes. A cron would remove the need for that (Q7).
