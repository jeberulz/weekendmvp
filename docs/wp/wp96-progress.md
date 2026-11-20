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

## 2026-11-20 - WP96-S1, S2 (data map, policy drafts)

- Actions taken: a subagent researched and wrote `docs/wp/wp96-data-map.md` (read-only research, one file). I spot-checked the high-stakes claims: Impact script in `app/layout.tsx`, no caller of `runImageGateway`, no non-test `ctx.storage` use, buyer email in `app/api/stripe-webhook/route.ts` logs. All held. I wrote `docs/wp/wp96-policy-drafts.md` from it and from the deletion code.
- Decisions made: the live privacy and terms pages are untouched. Claims the code could not confirm are marked `[UNCONFIRMED]`; choices for the owner are marked `[OWNER]` and listed as 14 questions at the end of the drafts file.
- Result: both files committed for review.
- Gotchas found, outside WP96's files, for the owner:
  - Founder dashboard URLs (with the business id) reach Google Analytics and Meta when a founder accepts analytics. `/dashboard` is not excluded.
  - The Impact.com affiliate script loads on every page with no consent check.
  - The live policy names no AI provider, Convex, Vercel, Resend, Google sign-in or Meta.
  - Nothing in the repo shows Anthropic's retention or training position.

## 2026-11-20 - WP96-S3 (deletion backend)

- Actions taken: `convex/account/deletion.ts` (public `requestDeletion`, public `getDeletionState`, internal `step`), `convex/account/purge.ts` (row drains), `convex/account/deletion.test.ts` (5 tests).
- Design:
  - The caller comes from the session; the only argument is the typed word `DELETE`. An extra argument such as `ownerId` fails validation.
  - The request does the urgent part in one transaction: audit event `account.deletion_requested`, the `users` row emptied (name, email, phone, image, tokens removed, `accountClosureRequestedAt` set), sign-in records removed, newsletter rows and sign-in rate-limit rows removed. The emptied `users` row stays so kept rows still point at something.
  - `step` then deletes at most 120 rows per run (20 for large documents and site versions), one business at a time with its children first, then the founder's own rows, then leftover sign-in rows, then removes `metadata` from the founder's `audit_events`, then writes `account.deletion_completed`. It schedules itself with `runAfter(0)` until done. Progress lives in the scheduled arguments, so no schema change was needed.
  - Kept untouched: `ai_usage`, `ai_budgets`, `credit_*`, `purchases`, all billing and membership rows, `workshop_*`, `offer_cohorts`, operator tables (`idea_crew_seeds`, `idea_seed_*`, `ops_settings`, `super_admins`).
  - Refused with `DELETION_BLOCKED`: a bound super admin, an account with `platformOwnerAccess`, and a monthly or annual plan that still renews. The plan is read through `convex/platform/membership/state.ts`, because `tests/security/membership-tables-isolation.test.mjs` allows membership table names only in the membership module.
  - Public idea suggestions keep their text with `submitterKey` set to `deleted`; the founder's votes are removed and counts decremented.
  - `step` refuses an account that never asked, and does nothing a second time after completion.
- Tests (`npx vitest run convex/account`, 15 passed including the older suites that share the folder name): everything personal is gone (a scan of every table for the email, name, business title and chat text); the other founder's rows are intact; `ai_usage` and `ai_budgets` are identical before and after; a user cannot delete another (no target argument, anonymous and wrong-word calls change nothing); batches continue (260 chat messages and 4 businesses need several runs); blockers; votes and suggestions.
- Gotchas: the first full `npm test` failed the membership isolation test because my first version read `plan_subscriptions` directly. Fixed by using `readMembershipState`. Test seeds must use a valid `ideas` row (needs `description`, `buildTime` and others).

## 2026-11-20 - WP96-S4 (deletion screen)

- `app/dashboard/settings/DeleteAccountSection.tsx` plus a new "Delete account" section in `app/dashboard/settings/page.tsx`.
- a11y-check findings and fixes: labelled input (`htmlFor`), no icons, visible 2px focus outline, errors in text inside a `role="status"` region (not colour only), heading order h1 > h2 > h3, 44px targets, focus moves to the input when the form opens and to the confirmation heading when done. One gap fixed: a keyboard user had no way to back out, so a Cancel button was added that returns focus to "Delete account…". Colours use `home-clay-ink` on white or card (about 8:1).
- Not verified in a browser: the screen sits behind sign-in and a Convex backend, and nothing was run against production, so I checked it by reading the code, typecheck, lint and tests only.

## 2026-11-20 - Checks

- `npm run typecheck`: pass.
- `npm test`: pass on the final run for the suites touched; the one earlier failure was mine and is fixed (see S3). Full re-run recorded in the final entry below.
- `npm run lint`: 1 error, in `components/workspace/wizard/WizardFlow.tsx:240` (`react-hooks/rules-of-hooks`, `useExample` inside a callback). Not touched by WP96; it is on `main` and in WP95's area. 45 warnings, none in WP96 files.
- `npm run build`: the first run stopped at the end with Next.js's "your version of Next.js is affected by a known security vulnerability" notice (`next` is `^16.4.1`); the same command passed on retry. The upgrade recommendation stands.
