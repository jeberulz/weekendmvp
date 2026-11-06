# WP78 / WP79 privacy and publishing review (before D5)

Reviewed 2026-11-06 by the Claude lane: an independent Opus review, read-only, of `main` at `eaec0abc`.

What it covers:
- #211, WP78 lead privacy primitives (merged as `7f84d354`);
- #212, WP79 tenant email and retention primitives (merged as `2d324f3f`);
- the #214 follow-up (revoking queued mail before a contact is deleted).

This is the review the WP67 board owed before D5 opens real capture. Findings go to the Codex lane, which owns the code.

## How it was checked

- The tree was exported to a scratch folder, so nothing was written to the repo.
- The existing focused tests pass: 7 files, 30 of 30.
- A probe suite of 7 tests passes. Each passing probe proves the finding it is named for. Probes live outside the repo; ask the Claude lane for them.
- Each finding is marked either:
  - CONFIRMED: probed or traced, or
  - PLAUSIBLE: traced in a dependency and not reproduced.
- The orchestrator re-read items 1, 3 and 5 against the code before filing this.

## Verdict

Both PRs are sound and dormant as code. Nothing in them can send mail or accept real personal data today.

They do not yet meet D5, for four reasons:
- Two of D5's three controls are missing: the privacy notice, and retention that matches the owner's ruling.
- Erased contacts' PII stays in the Resend component's tables.
- Revocation covers only `active` enrollments.
- The capture pattern that real capture would copy has a rate limit any caller can bypass.

**When each item must be fixed:**
- Before D5: items 1–6 and 10.
- Before any tenant send, including the opt-in confirmation: items 7–9. In practice D5 needs them too.

## Blockers (before D5)

1. **Retention is missing, and the code that exists uses the wrong trigger.** CONFIRMED.
   - `convex/platform/sites/retention.ts:20-21` purges on `project.archivedAt`, and `:38-40` refuses every real lead.
   - `convex/schema/growth.ts:38` keys `lead_retention_jobs` on `archivedAt`.
   - The owner ruled that only "Delete business" or account closure starts the 30-day timer (now in `RULINGS.md`).
   - Nothing writes `lead_retention_jobs`. There is no cron, no delete-business runtime and no account-closure runtime.
   - **Fix:**
     - Rename the epoch to a deletion request (for example `deletionRequestedAt`), and drop the archive trigger.
     - Build delete-business and account-closure mutations that upsert the job.
     - Add an hourly due-job cron that, for each real lead, revokes it and deletes the lead with its tokens, enrollments and sends.
     - Add tests that archiving never purges.
2. **Erased contacts stay in the Resend component, and no cleanup is scheduled.** CONFIRMED.
   - After `deleteContact`, the component's `emails` row still holds the recipient address, the subject and the body.
   - Real bodies will also hold raw token URLs.
   - The docstring at `convex/platform/sites/leads.ts:214` ("Erase contact PII immediately") overstates what happens.
   - The owner accepted a seven-day component cleanup, but nothing calls `cleanupOldEmails` or `cleanupAbandonedEmails`.
   - **Fix:**
     - Add daily crons for both cleanups. They are exempt from the shutdown switch, with tests that they never enqueue mail.
     - Optionally clean up the cancelled row at once.
     - Correct the docstring.
3. **Revocation covers only `active` enrollments.** CONFIRMED.
   - `convex/growth/email/contacts.ts:64-66` reads `by_leadId_and_state` with `state: "active"` only.
   - `convex/schema/growth.ts:87` leaves `state` as an open `v.string()`.
   - In a probe, a `paused` enrollment's queued email stayed `queued` after `deleteContact` returned `{ deleted: true }`.
   - **Fix:** make `state` a closed union and revoke every state that is not terminal. Alternatively, cancel queued mail on every transition out of `active`, with a test for each transition.
4. **No tenant privacy notice in `app/site/**`.** CONFIRMED by grep.
   - Nothing names the founder as controller and Weekend MVP as processor.
   - Nothing discloses Resend's 30-day US retention.
   - **Fix:** a versioned notice under every form, with each submission checked against its `consentVersion`.
5. **Anyone can bypass the lead rate limit.** CONFIRMED. This is WP28 code, not these PRs, but it gates D5.
   - `convex/platform/sites/leads.ts:84-99`: `recordSynthetic` is a public mutation that takes a `rateLimitKey` chosen by the client.
   - The comment says the key is "signed", but nothing verifies a signature.
   - Twelve calls with rotating keys all succeeded against a limit of 5 a minute.
   - With real capture plus double opt-in, this allows subscription bombing from our domain and burns through Free's 50 sends.
   - **Fix:**
     - Make `recordReal` internal, behind a signed bridge hand-off, as `PLATFORM_PREVIEW_BRIDGE_SECRET` does.
     - Add limits per site, per normalized email and per day on confirmations.
6. **Owner rulings and guards.** CONFIRMED.
   - The owner rulings these PRs rely on were recorded only in the WP78/WP79 logs. The Claude lane has now added them to `docs/wp/RULINGS.md` in the same PR as this review.
   - The guards are still open:
     - `exportPage` and `deleteContact` correctly skip `assertFeatureEnabled`, under the "privacy work while off" ruling.
     - The WP68 scanner does not cover `convex/platform/sites`.
   - **Fix:** a security test that pins the public functions in `leads.ts` to an allow-list.

## Majors (before any tenant send)

7. **Paid plans have no hard sending ceiling.** CONFIRMED.
   - `convex/growth/email/caps.ts:29-31`: soft enforcement always allows the send. Ten million a month on Builder's Hub still returns `allowed: true`.
   - **Ruled 2026-11-06** (`RULINGS.md`, "WP79 / D6 paid send ceiling"): a hard monthly ceiling at twice the soft threshold (10,000 / 40,000), a daily limit per business (1,000 / 3,000), and an automatic pause over 0.1% complaints or 4% bounces, with a manual operator override per business.
   - **Fix:**
     - Enforce the three ruled layers in the sender's enqueue mutation.
     - The sender reads exact `ShardedCounter.count()` totals in the enqueue mutation.
     - A test of two sends racing past the cap.
8. **The opt-in and unsubscribe flow is unbuilt and unproven.** PLAUSIBLE.
   - Nothing enforces `expiresAt`, `usedAt` or one token per purpose when tokens are issued.
   - Mail scanners that prefetch links with GET could confirm double opt-in automatically.
   - Tokens in the URL path end up in request logs.
   - **Fix:**
     - Act on POST only.
     - Support RFC 8058 one-click unsubscribe.
     - Send `no-referrer`, `no-store` and `noindex`.
     - Consume each token in one mutation.
     - Rate-limit `/u/*`.
9. **A "queued" email can still go out after it is cancelled.** PLAUSIBLE (traced in the component's `lib.ts`).
   - In 0.2.10, `queued` means the email is already in a send batch.
   - If the batch payload has been built, the email is sent anyway, and `onEmailComplete` overwrites the status to `sent`.
   - **Fix:**
     - Treat cancellation as best effort, and say so in the deletion copy.
     - Recheck `deletedAt` and `unsubscribedAt` right before enqueue.

## Minors

10. **The CSV export has no `unsubscribed_at` column.** CONFIRMED. See `leads.ts:201-209` and `lib/tenant-lead-csv.ts:17`. A founder could re-import people who opted out. This is a one-line fix and should land before D5.
11. Leads archived at row level are left out of the export (`leads.ts:199`).
12. **Archive is handled inconsistently.**
    - `exportPage` allows an archived business, which fits the ruling, but checks ownership by hand instead of with C-AUTHZ `requireBusinessAccess`.
    - `listForProject` refuses archived businesses.
    - **Fix:** one documented helper that includes archived businesses, used in both places.
13. No audit event, free of PII, is written for erasure or export.
14. **Integrity checks can block erasure.** A graph mismatch or too many rows (`contacts.ts:51-53, 61, 67-69`) aborts the owner's deletion, and there is no operator repair path or runbook for it.
15. **The Resend component's `lastOptions` is global.** A second `new Resend(components.resend, …)` would mix API keys. There is one today. **Fix:** a security test that allows exactly one.
16. CSV escaping skips `＝` (U+FF1D) and a leading `|`. The risk is negligible.
17. On Free, confirmations use up the cap, so fifty signups exhaust the 50 sends. This matches the owner's ruling; it is flagged for product.

## Checked and sound

- **Authorisation.**
  - `exportPage` checks the user, then the project owner, then the owner of each row, through an index.
  - `deleteContact` checks session expiry, the lead owner and the project owner.
  - `revokeLeadContact` and the purge are internal. Revocation re-checks the owner chain before it touches mail.
  - Calls across owners fail with `RESOURCE_NOT_FOUND`.
- **Atomicity.**
  - Revocation runs through an uncaught `ctx.runMutation`, so any error rolls back before PII is cleared.
  - Deletes are idempotent, and the tombstone left behind is minimal.
- **Export route.**
  - It answers only on the www, platform-preview and local hosts; middleware keeps tenant hosts off `/api/*`.
  - It returns the same 404 for every refusal and logs nothing.
  - Headers: `private, no-store`, `nosniff`, and an attachment with a fixed filename.
  - Pages are bounded at 100 rows, and aborts are handled.
- **CSV.** Formula characters (`= + - @`) are escaped, including after leading whitespace, a BOM, a tab or a CR. Every cell is quoted.
- **Tokens.**
  - Each token is 256 random bits.
  - Only a SHA-256 hash, with the purpose mixed in, is stored.
  - Lookup goes through an index, so there is no timing side channel.
- **Provider isolation.**
  - Explicit empty keys mean the generic `RESEND_*` key is never picked up.
  - Test mode stays on unless all four tenant conditions hold.
  - Auth mail is sent separately.
- **Tests.** No test makes a network call.
- **Dormancy.**
  - Nothing calls `sendEmail`.
  - There is no tenant webhook, sender cron, `/u` route or writer of real leads.
  - What runs today (`exportPage`, `deleteContact`, the export route) only reads or erases, and no real leads exist.
  - Paths that could later send mail or accept PII:
    - `recordReal`;
    - `requestOptInForLead`;
    - the sender cron;
    - the `/u` handler;
    - the webhook;
    - setting `TENANT_EMAIL_LIVE_ENABLED=true` together with the other three settings.
- **Secrets.**
  - `.env.example` adds four `TENANT_*` names, all empty.
  - `convex.config.ts` declares all four as optional and reads them through the typed `env`.
- **Convex.**
  - Every function has validators.
  - Reads are indexed and bounded, with no `.collect()`.
  - The new tables carry `ownerId` and `projectId`, with an index that starts with the owner.
- **Logs.** The new code has no `console.*`, and errors carry codes only.

## Next steps

- Codex lane (WP78/WP79): items 1–17 above. Items 1–6 and 10 come before D5; items 7–9 come before the first tenant send.
- Owner: ruled the paid-plan send ceiling (item 7), 2026-11-06.
- Claude lane: this PR adds the five owner rulings from the WP78/WP79 logs to `RULINGS.md`, as both logs asked.
