# Builder's Hub billing: test-mode gate (WP64-S11)

This runbook proves the membership billing works end to end in the Stripe sandbox before anything goes live. You run the journeys on your machine with a browser. Claude checks the Stripe side through the connector, runs the automated suites and the independent review, and writes up the evidence.

Plan for about four hours: 45 minutes of setup, then the journeys. You can stop between journeys. Record each result in `docs/wp/evidence/wp64-test-mode-gate.md` as you go, or paste it to Claude and Claude records it.

S11 passes when every journey in Part C passes or has an accepted note, Part D is green, and the review in Part E has no open critical or high finding.

## Rules

- Test mode only. The WeekendMVP sandbox (`acct_1ThX7a9tlBLUMkdP`, `livemode: false`). No live key, live object, real card, deploy or production write.
- Never paste a key, a `whsec_` secret, the bridge secret or `CRON_SECRET` into chat, a doc, a commit or a ticket. They live in `.env.local` and the local Convex env only.
- Evidence uses ids, never emails or card details. Shorten ids to their last six characters (`cs_test_…a1b2c3`).
- Use test cards only (Part B). Stripe refuses real cards in a sandbox anyway.
- Edits to `convex/platform/membership/windows.ts` for these tests stay local. Never commit them. `git checkout -- convex/platform/membership/windows.ts` when you finish.

## Part A. Set up (once)

### A1. Stripe sandbox settings

In the Stripe Dashboard, switch to the WeekendMVP sandbox, then follow `docs/wp/evidence/wp64-stripe-setup.md` section 2:

1. **Restricted key** (step 1), with the permissions in that table. You need it for `.env.local`.
2. **Public details** (step 6). The Terms URL is required: Checkout refuses terms consent without it.
3. **Revenue recovery** (step 3): Smart Retries on, 8 tries in 2 weeks, cancel the subscription after the last failed retry.
4. **Customer emails** (step 4): upcoming renewals on, at least 7 days ahead, failed-payment and expiring-card emails on.
5. **Branding** (step 5) is optional for this gate.

A sandbox only sends customer emails to team members or a verified email domain. Use test member addresses on an inbox you are a team member for, if you want to see the emails.

### A2. Stripe CLI

Install it (`brew install stripe/stripe-cli/stripe` on a Mac), then:

```bash
stripe login        # choose the WeekendMVP sandbox in the browser
```

### A3. The branch

```bash
git fetch origin claude/tender-heisenberg-bf94ku
git checkout claude/tender-heisenberg-bf94ku
npm ci
```

### A4. Secrets and env

Make two random values, one for the bridge and one for the cron:

```bash
openssl rand -base64 48   # bridge secret
openssl rand -base64 32   # cron secret
```

Local Convex (start `npm run convex:dev` once first if it has never run on this machine):

```bash
npx convex env set MEMBERSHIP_BILLING_BRIDGE_SECRET "<bridge secret>"
```

`.env.local` (values never in git):

```bash
MEMBERSHIP_BILLING_MODE=test
MEMBERSHIP_TAX_MODE=managed_payments
MEMBERSHIP_BILLING_APP_ORIGIN=http://localhost:3000
MEMBERSHIP_BILLING_BRIDGE_SECRET=<the same bridge secret>
STRIPE_MEMBERSHIP_RESTRICTED_KEY=rk_test_...
STRIPE_MEMBERSHIP_WEBHOOK_SECRET=        # filled in at A6
STRIPE_MEMBERSHIP_PRICE_MONTHLY=price_1UOWJo9tlBLUMkdPbDBnyYX5
STRIPE_MEMBERSHIP_PRICE_ANNUAL=price_1UOWJr9tlBLUMkdPx58bYYH6
STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1=price_1UOWJv9tlBLUMkdPYIJEVYTo
STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2=price_1UOWJz9tlBLUMkdPqW9uoTzX
CRON_SECRET=<cron secret>
NEXT_PUBLIC_BUILDERS_HUB=on
```

The price ids are the sandbox ones from the evidence file, section 1. They are not secret.

### A5. Seats and windows

```bash
npx convex run platform/membership/seats:seed '{"apply":true}'
npx convex run platform/membership/cohorts:launchCheck '{}'
```

`launchCheck` should show 50 free seats and all three windows `null`.

To sell Founding Lifetime during the journeys, open the third window locally. In `convex/platform/membership/windows.ts`, set `everyone` to a time a minute ago in milliseconds (`node -e "console.log(Date.now() - 60000)"`). Leave `buyers` and `newsletter` as `null`. `npm run convex:dev` pushes the change to your local backend.

### A6. Start everything

Three terminals:

```bash
# 1
npm run convex:dev

# 2
stripe listen --forward-to localhost:3000/api/platform/membership/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed,charge.refunded,charge.dispute.created,charge.dispute.closed

# 3 (after copying the printed whsec_... into STRIPE_MEMBERSHIP_WEBHOOK_SECRET)
npm run dev
```

Keep terminal 2 in view. Every event shows a status: 200 is settled or not ours, 400 is a bad request, 500 means Stripe will retry. A 500 during a journey is a failure to record.

### A7. Smoke checks

```bash
# The routes are live. 401 because nobody is signed in.
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' localhost:3000/api/platform/membership/portal

# The webhook verifies signatures. The fixture has no membership purpose, so expect 200 and no write.
stripe trigger checkout.session.completed

# Settlement ledger and seats, counts only.
npx convex run platform/membership/events:counts '{}'

# Reconcile runs with the cron secret.
curl -s -H "Authorization: Bearer <cron secret>" localhost:3000/api/platform/membership/reconcile
```

Expect `401`, a 200 in terminal 2, counts with no events and 50 free seats, and `{"ok":true,"released":0,"pushed":0,"refreshed":0,"capped":false}`.

## Part B. Test members, cards and clocks

### Members

Sign in locally the way you normally do (magic link or Google). Each member needs a confirmed email, or checkout answers "Confirm your email address first". Plus-addresses on one inbox work (`you+m1@…`). Use a fresh member for each journey that says so: a member who already has a Stripe customer reuses it, which matters for test clocks.

| Member | Used in |
|---|---|
| M1 | C1, C4, C4b, C9, C18 |
| M2 | C2, C8b |
| M3 | C3, C8a |
| M4 to M6 | C5 to C7 (test clock, one each) |
| M7, M8 | C10, C11 (disputes) |
| M9, M10 | C13, C14 (late payment) |
| M11 | C17 (subscriber buys lifetime, after a monthly checkout) |
| M12, M13 | C12, C15, C16, C18 (free members) |

Find a member's id in the Convex dashboard (`npx convex dashboard`, `users` table). You need it for test clocks.

### Cards

| Card | What it does | Used in |
|---|---|---|
| `4242 4242 4242 4242` | Pays | Most journeys |
| `4000 0000 0000 0341` | Saves to the customer, then every charge fails | C6, C7 (set as the card before a renewal) |
| `4000 0000 0000 0259` | Pays, then is disputed as fraud | C10, C11 |
| `4000 0000 0000 1976` | Pays, then gets an inquiry | Optional |
| `4000 0025 0000 3155` | Asks for 3D Secure | Optional |

Any future expiry date, any CVC, any postcode.

### Starting a checkout from the browser console

Some journeys need a checkout the page would not offer (a subscriber buying lifetime, a refused purchase). Signed in as the member, on any dashboard page, open the browser console and run (change `term` to `monthly`, `annual` or `lifetime`):

```js
const r = await fetch("/api/platform/membership/checkout", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ term: "lifetime", idempotencyKey: "membership:" + crypto.randomUUID() }),
}).then((res) => res.json());
console.log(r);
if (r.url) location.href = r.url;
```

A refusal prints `{ ok: false, code: "..." }` and charges nothing.

### Test clocks (renewals and failed payments)

A renewal needs time to pass, so C5 to C7 use a Stripe test clock. The customer must be created on the clock, and checkout must use that customer:

1. Stripe Dashboard, Billing, Test clocks (also called Simulations), New simulation. Start it now.
2. Add a customer to the clock with the member's email.
3. Link it to the member in the Convex dashboard: `billing_customers`, add a document `{ "ownerId": "<users id>", "stripeCustomerId": "cus_...", "livemode": false, "createdAt": <now in ms> }`. Do this before the member's first checkout.
4. The member then checks out as usual. Checkout reuses the linked customer, so the subscription runs on the clock.

If Stripe refuses a test-clock customer in a Managed Payments Checkout Session, record it, then use the fallback in C5.

## Part C. Journeys

For each journey, record the date, pass or fail, the shortened Stripe ids, and anything surprising. "The page" means Plan and billing at `/dashboard/billing`. Plan copy below is what the page should say.

### C1. Free to monthly (M1)

1. On the page, choose Monthly and continue to Stripe. Pay with `4242`.
2. Back on the page, the return banner waits, then the plan updates by itself.

Expect:
- Terminal 2: `checkout.session.completed`, `customer.subscription.created`, `invoice.paid`, all 200.
- The page: "Builder’s Hub, monthly" and "$29 a month. Renews on <date a month out>." and a Manage billing button.
- Stripe: an active subscription with metadata `purpose=weekendmvp_membership_v1` and an `order_id`. Under Managed Payments, any tax for your test address is added on top of $29.
- `events:counts`: subscriptions `active: 1`.

### C2. Free to annual (M2)

Same as C1 with Annual. Expect "Builder’s Hub, annual" and "$199 a year. Renews on <date a year out>."

### C3. Free to Founding Lifetime (M3)

1. Choose Founding Lifetime. The ladder shows seat 1 at $249. Pay with `4242`.

Expect:
- The page: "Builder’s Hub, Founding Lifetime" and "Founding member, seat 1 of 50. Nothing more to pay." No Manage billing button.
- `events:counts`: seats `taken: 1`. In the Convex dashboard, one `plan_grants` row for M3 with `seatNumber: 1`.
- The ladder for another free member now shows 49 left.

### C4. Cancel at period end, then undo (M1)

1. Manage billing. Stripe's portal opens for M1's own subscription. Cancel.
2. Back on the page: "Set to end on <date>. You keep access until then." Builder's Hub features still work.
3. Manage billing again and renew (undo the cancel). The page goes back to "Renews on <date>".

Expect `customer.subscription.updated` twice, both 200. Also check the portal shows invoices, a card update, and a switch to Annual, and no pause or quantity option.

### C4b. Monthly to annual and back (M1)

1. Manage billing, switch to Annual. The portal shows the amount due now (annual less the unused month). Confirm.
2. The page: "Builder’s Hub, annual", renewing a year out.
3. Manage billing, switch back to Monthly. The portal says it starts at the end of the annual period. The page stays on Annual.

Record whether the switch invoice goes through Managed Payments (tax shown, Link receipt).

### C5. Renewal through a test clock (M4, clock customer)

1. Link M4 to a clock customer (Part B), then check out Monthly with `4242`.
2. Advance the clock past the renewal date (one month and a day).

Expect `invoice.paid` and `customer.subscription.updated`, 200. The page's renewal date moves a month on.

Fallback if the clock route is refused: in the Dashboard, update the subscription and reset the billing cycle to now. That bills a renewal at once. Record which way you used.

### C6. Failed renewal, then recovery (M5, clock customer)

1. Link M5 to a clock customer, check out Monthly with `4242`.
2. Manage billing, change the card to `4000 0000 0000 0341`.
3. Advance the clock past the renewal.
4. Expect `invoice.payment_failed`. The page keeps Builder's Hub and shows "Your last payment didn’t go through. Update your payment method to keep Builder’s Hub."
5. Manage billing, change the card back to `4242` and pay the open invoice (or advance the clock to the next retry).
6. Expect `invoice.paid`. The notice goes away.

### C7. Failed renewal, then loss of access (M6, clock customer)

1. As C6 steps 1 to 4.
2. Advance the clock past the last retry (more than two weeks).
3. Expect `customer.subscription.deleted` (or `updated` to `unpaid`, depending on the revenue recovery setting). The page shows Free and "Your monthly plan ended on <date>." (or the on-hold notice for unpaid). Builder's Hub features lock.

### C8. Full refunds

a. Lifetime (M3, after C3): in the Dashboard, refund the payment in full.
- Expect `charge.refunded`, 200. The page shows Free. `plan_grants` row has `revokeReason: "refund"`. Seat 1 is free again, and the next lifetime buyer gets seat 1 at $249.

b. Subscription (M2, after C2): refund the first invoice's payment in full.
- Expect `charge.refunded`, then `customer.subscription.deleted` (our webhook cancels it through the API). The page shows Free.

C8b proves our webhook can cancel a subscription through the API under Managed Payments. C14 proves it can refund through the API. Record both.

### C9. Partial refund

Refund $5 of M1's monthly payment (after C1). Run this before C8, while every payment is still whole.

Expect `charge.refunded`, 200, and nothing else changes: same plan, same seat. `events:counts` shows one more `ignored`.

### C10. Dispute won (M7)

1. M7 buys Monthly or Founding Lifetime with `4000 0000 0000 0259`.
2. Stripe opens a dispute a moment later. Expect `charge.dispute.created`, 200.
3. The page: "Builder’s Hub is paused" with the dispute sentence, and no buy buttons. A checkout started from the console answers `ACCOUNT_REVIEW`.
4. In the Dashboard, respond to the dispute with the text `winning_evidence`, if Stripe lets you. Under Managed Payments, Stripe may answer the dispute itself: record what it did.
5. Expect `charge.dispute.closed`, 200. Access comes back.

### C11. Dispute lost (M8)

As C10, but respond with `losing_evidence` (or accept the dispute).

Expect `charge.dispute.closed`, 200. Access ends. For lifetime: `revokeReason: "dispute_lost"` and the seat is free. For a subscription: it is canceled through the API. New checkouts stay refused. Then clear the flag:

```bash
npx convex run platform/membership/events:clearReview '{"ownerId":"<M8 users id>"}'
```

After that, M8 can check out again. Access does not come back by itself.

### C12. Seat hold expiry

1. M12 starts Founding Lifetime and closes the Stripe tab without paying. In the Convex dashboard, the seat is `reserved` with M12's order.
2. Expire the session now instead of waiting about 31 minutes:

```bash
stripe post /v1/checkout/sessions/<cs_test_...>/expire
```

Expect `checkout.session.expired`, 200. The seat is `free`, the order `expired`.

### C13. Payment after the hold lapsed, seat still free (M9)

1. M9 starts Founding Lifetime and keeps the Stripe tab open. Note the seat number.
2. In the Convex dashboard, set that seat's `reservedUntil` to `1`.
3. Run reconcile (A7). Expect `"released":1`. The seat is free and the order `expired`.
4. Pay in the open tab with `4242` (within 31 minutes of step 1).

Expect M9 gets the same seat and a grant. The order is `paid`.

### C14. Payment after the hold lapsed, seat gone (M10)

1. As C13 steps 1 to 3 for M10.
2. Before M10 pays, someone else takes the seat. To make it certain, set that seat's `status` to `taken` in the Convex dashboard.
3. M10 pays in the open tab.

Expect `checkout.session.completed`, 200, then a full refund of M10's payment by our webhook (`charge.refunded` follows, also 200). M10 has no grant and the page shows Free. Then set the seat back to `free`.

### C15. Sold out

1. In the Convex dashboard, set every free seat but one to `status: "taken"` (bulk edit, or one by one).
2. A free member buys the last seat.
3. Another free member opens the page. Founding Lifetime stays visible but cannot be chosen, with "All 50 founding seats are taken."
4. That member starts a lifetime checkout from the console. Expect `{ ok: false, code: "SOLD_OUT" }` and no charge.

Then set the seats you changed back to `free`.

### C16. Window gating

1. In `windows.ts`, set `everyone` to tomorrow (`Date.now() + 86400000`).
2. A free member opens the page. Founding Lifetime is visible, cannot be chosen, and says when it opens. A lifetime checkout from the console answers `NOT_YET_ELIGIBLE` with `opensAt`.
3. Set `everyone` back to a minute ago. The option appears.

The buyer and newsletter cohorts are covered by the Convex tests. The import needs a cloud deployment, so the local check stops at the dry run:

```bash
# a private file outside the repo, one test address per line
npm run membership:import-cohorts -- --cohort=buyers --file=/tmp/wmvp-buyers.csv
```

Expect counts and a batch id, and no address in the output.

### C17. Subscriber buys Founding Lifetime (O5) (M11)

No page offers lifetime to a subscriber yet. Signed in as M11 with an active monthly plan, start a lifetime checkout from the console (Part B) and pay with `4242`.

Expect the lifetime grant, and our webhook sets the monthly subscription to cancel at period end (`customer.subscription.updated`). No refund of the current month. The page shows Founding Lifetime.

### C18. Live-build gating

```bash
npx convex run platform/liveBuildsOperator:create '{"title":"Test session","summary":"S11 check.","startsAt":<one hour from now in ms>,"durationMin":30,"joinUrl":"https://example.com/test-room"}'
```

At `/dashboard/live`: a Builder's Hub member (M1) sees "Join the live build" with the link. A free member (M13) sees the upgrade sheet instead. Cancel the session afterwards (`docs/runbooks/wp64-live-builds.md`).

### C19. Replays, duplicates and forged requests

1. Resend an event that already settled. In the Dashboard, open Workbench, Events, pick one terminal 2 showed as 200, and resend it to your local listener. Expect 200 and no change. `events:counts` shows no new event row.
2. A forged signature:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'stripe-signature: t=1,v1=forged' -d '{}' localhost:3000/api/platform/membership/webhook
   ```

   Expect `400`.
3. Run reconcile twice in a row (A7). Expect the same counts both times and no change on the page.

### C20. Checkout switched off

1. Set `MEMBERSHIP_BILLING_MODE=off` in `.env.local` and restart `npm run dev`.
2. Buy buttons answer "Checkout isn’t open yet. Nothing was charged." Manage billing answers "Billing management isn’t open yet."
3. Refund something in the Dashboard. The webhook still settles it (200, access changes). This is the rollback guarantee.
4. Set it back to `test`.

## Part D. Automated checks (Claude)

Claude runs these on the branch and records the numbers:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

Plus a secret-pattern scan of the diff, axe at 390 px and 1440 px on the billing page and the Terms pages, and the dormancy proof: a build with none of the membership env set serves every existing route unchanged, the webhook answers 503, checkout and portal answer 401 signed out and 503 signed in, reconcile answers 200 with `skipped`, and no Builder's Hub surface shows with the flag off.

## Part E. Independent review (Claude)

A separate high-risk review of the WP64 diff, with no stake in the code. Areas: authorization and owner derivation, server-owned prices, exactly-once settlement, seat inventory, replay and order handling, refund and dispute policy, secret handling, separation from the legacy and WP24 Stripe handlers, and dormancy. Every critical or high finding is fixed and re-checked before S11 closes.

## Part F. Clean up

1. Delete each test clock (Dashboard, Test clocks). That deletes its customers and subscriptions.
2. Cancel any other active test subscriptions in the sandbox.
3. `git checkout -- convex/platform/membership/windows.ts`.
4. Stop `stripe listen`. Remove the `whsec_` from `.env.local` if you like. It only works with that listener.
5. Leave the sandbox products, prices and portal configuration in place. S12 recreates them on the live account.

## What S11 hands to S12

- The evidence file with every journey's result.
- Any Stripe behavior under Managed Payments that differed from this runbook (test clocks, disputes, the switch invoice, Link).
- Confirmation that the restricted key's permissions were enough, and any it did not need.
