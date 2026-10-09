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
| `npm run typecheck` | | |
| `npm run lint` | | |
| `npm test` | | |
| `npm run build` | | |
| `npm audit --omit=dev --audit-level=high` | | |
| `git diff --check` | | |
| Secret-pattern scan | | |
| axe at 390 px and 1440 px | | |
| Dormancy proof | | |

## Independent review (Part E)

| Area | Finding | Severity | Status |
|---|---|---|---|

## Managed Payments differences found

None recorded yet.

## Restricted key

Permissions that were needed, and any that were not. None recorded yet.
