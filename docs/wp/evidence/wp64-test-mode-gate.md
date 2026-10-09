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
| C4 | Cancel at period end, then undo | | | | |
| C4b | Monthly to annual and back | | | | Switch invoice through Managed Payments? |
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
| C17 | Subscriber buys Founding Lifetime (O5) | | | | Subscription set to end at period end? |
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
| Dormancy proof | 2026-10-09 | Pass: main and branch built with no membership env, 165 routes compared (all 157 sitemap URLs plus extras), 0 status and 0 selling-copy differences. Branch: checkout and portal 401 signed out, webhook 503, reconcile 200 `skipped` (also with a guessed bearer). Signed-in 503 is covered by the route tests, not run against a live session |

## Independent review (Part E)

| Area | Finding | Severity | Status |
|---|---|---|---|

## Managed Payments differences found

None recorded yet.

## Restricted key

Permissions that were needed, and any that were not. None recorded yet.
