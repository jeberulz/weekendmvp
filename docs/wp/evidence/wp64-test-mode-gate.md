# WP64-S11 test-mode gate: evidence

Results of `docs/runbooks/wp64-test-mode-gate.md`. Test mode only, sandbox `acct_1ThX7a9tlBLUMkdP`. Ids are shortened to their last six characters. No email, card detail, key or secret.

## Setup (Part A)

| Step | Date | Result | Notes |
|---|---|---|---|
| A1 Stripe sandbox settings (key, public details, retries, emails) | | | |
| A2 Stripe CLI logged in to the sandbox | | | |
| A4 Local env and Convex bridge secret set | | | |
| A5 Seats seeded, `launchCheck` 50 free | | | |
| A7 Smoke checks (401, trigger 200, counts, reconcile) | | | |

## Journeys (Part C)

| Id | Journey | Date | Result | Stripe ids | Notes |
|---|---|---|---|---|---|
| C1 | Free to monthly | | | | |
| C2 | Free to annual | | | | |
| C3 | Free to Founding Lifetime | | | | |
| C4 | Cancel from Settings, then renew | | | | Clicks from Settings to cancelled? Confirmation shown? |
| C4b | Monthly to annual and back | | | | Switch invoice through Managed Payments? Annual to monthly scheduled, not immediate? |
| C5 | Renewal through a test clock | | | | Clock or fallback? |
| C6 | Failed renewal, then recovery | | | | |
| C7 | Failed renewal, then loss of access | | | | Canceled or unpaid? |
| C8a | Full refund, lifetime | | | | |
| C8b | Full refund, subscription | | | | Refund and cancel through the API under Managed Payments? |
| C9 | Partial refund | | | | |
| C10 | Dispute won | | | | What Stripe did under Managed Payments |
| C11 | Dispute lost, then `clearReview` | | | | |
| C12 | Seat hold expiry | | | | |
| C13 | Payment after the hold lapsed, seat free | | | | |
| C14 | Payment after the hold lapsed, seat gone | | | | Refunded automatically? |
| C15 | Sold out | | | | |
| C16 | Window gating, cohort dry run | | | | |
| C17 | Subscriber buys Founding Lifetime (O5) | | | | O5 notice shown before checkout? Subscription set to end at period end? |
| C18 | Live-build gating | | | | |
| C19 | Replays, duplicates, forged signature, reconcile twice | | | | |
| C20 | Checkout switched off, webhook still settles | | | | |

## Automated checks (Part D)

| Check | Date | Result |
|---|---|---|
| `npm run typecheck` | 2026-10-09 | Pass (on `f54bd6b`, main merged in) |
| `npm run lint` | 2026-10-09 | Pass: 0 errors, 34 warnings (unchanged baseline) |
| `npm test` | 2026-10-09 | Pass except the same six known failures (three OG-image, three editorial). Convex 646, platform 405, security 143 node and 121 Vitest, engine 1,076, home 77, auth 146, redirects 76, sitemap 11, links 6, prompts 23 |
| `npm run build` | 2026-10-09 | Pass: 442 pages (main builds 435; the seven extra are the four membership routes, `/dashboard/live`, `/terms`, `/refund-policy`) |
| `npm audit --omit=dev --audit-level=high` | 2026-10-09 | Pass: no high or critical. Four moderate in `gray-matter`/`js-yaml`, not touched by WP64 |
| `git diff --check` | 2026-10-09 | Pass |
| Secret-pattern scan | 2026-10-09 | Pass: 112 files in the WP64 diff, no real key, secret or token. Only short fake test literals. `.env.example` adds names only |
| axe at 390 px and 1440 px | 2026-10-09 | Pass: 11 billing states and the Terms, refund and privacy pages at both widths, 28 runs, 0 violations, no horizontal scroll |
| Dormancy proof | 2026-10-09 | Pass after a fix: main and branch built with no membership env, 165 routes compared (all 157 sitemap URLs plus extras), 0 status and 0 selling-copy differences. Checkout and portal 401 signed out, webhook 503. The first run's reconcile answer was a prerendered page (review finding 3); after the fix the route is dynamic, and the same build answers 200 `skipped` without `CRON_SECRET`, 401 with it set and a missing or wrong bearer, and 200 `skipped` with the right bearer and no billing config. Signed-in 503 is covered by the route tests, not run against a live session |

## Independent review (Part E)

A separate reviewer read the whole WP64 diff on 2026-10-09 (`f54bd6b`), with no stake in the code, and ran the S4 suites. No critical finding. One high, four medium, nine low. Fixed in `fix(wp64-s11): review findings 1 to 7 and 9`, re-checked by tests written for each and 16 deliberate breakages, all caught.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | A stored subscription stopped following Stripe once its Price was replaced: a cancel or unpaid renewal was rejected for good, and the member kept access | High (latent, needs a Price swap) | Fixed: a stored row follows Stripe's status whatever the Price, keeping its last known term. Only a first snapshot is checked against its order |
| 2 | A subscription rejected at settlement (wrong Price, foreign customer) was canceled but not refunded | Medium | Fixed: `refund_and_cancel` refunds the latest paid invoice, then cancels. Also used for a second subscription |
| 3 | The reconcile route was prerendered when built without `CRON_SECRET`, so the cron kept reading "skipped" after the secret was set | Medium | Fixed: `await connection()`. Proved on a build: no prerender entry, and the secret is read at run time |
| 4 | One follow-up Stripe kept refusing blocked every webhook for that member and stopped the whole reconcile run. An O5 cancel on a subscription under a scheduled plan switch was one such case | Medium | Fixed: follow-ups run one by one. Stripe's invalid-request refusals are logged and settled, transient failures still get a 500. A scheduled switch is released first. Reconcile keeps going and answers 500 with counts |
| 5 | A lapsed seat hold moved to the next buyer 4 minutes after the session closed, even if a paid session's webhook was only delayed | Medium | Fixed: the clock reclaims a hold only 30 minutes after it lapses. `checkout.session.expired` still frees an abandoned seat at once |
| 6 | "Newest wins" used our clock: reconcile stamped items when pushed, the webhook before its read | Low | Fixed: reconcile stamps before the list read, the webhook after its read |
| 7 | A lifetime payment rejected because the member already holds a seat kept its own held seat until the hold lapsed | Low | Fixed: the seat is freed at once |
| 8 | Events that arrive before the state they act on (a refund before the subscription row, a dispute before the grant) are recorded as ignored | Low | Accepted: needs out-of-order delivery after repeated failures. Reconcile repairs subscription status, not these. Revisit if S11 shows it |
| 9 | Owed refunds read only the 5 newest failed orders, and a once-disputed charge was never refunded | Low | Fixed: 25 orders, and a disputed charge is attempted (Stripe refuses an open dispute, which is logged and retried later) |
| 10 | Keeping test purchases out of production relies on `VERCEL_ENV` in Next only | Low | Accepted: misconfiguration only (a test key plus the production bridge secret). S12 checks the env |
| 11 | The checkout rate limit is per member, so about 50 scripted accounts could hold every seat in window 3 | Low | Accepted for launch. Holds last 35 minutes and need a verified email each. Watch at window 3 |
| 12 | Reconcile compares the newest 1,000 rows and makes its Convex calls one at a time | Low | Accepted at launch scale. It reports `capped` |
| 13 | The WP24 credit webhook handles every refund and dispute event without checking `purpose` | Low (WP24, unchanged) | Separate task suggested. Membership never reaches it unless that endpoint subscribes to these events on the same account |
| 14 | The legacy ship·able handler logs the buyer's email | Low (existed before WP64) | Separate task suggested |

Still to confirm in S11 (Stripe behavior under Managed Payments): the payment intent, its metadata and the `invoicePayments` link on refunded and disputed payments (C8, C10, C11, C14), and the Checkout host (C1).

## Managed Payments differences found

None recorded yet.

## Restricted key

Permissions that were needed, and any that were not. None recorded yet.
