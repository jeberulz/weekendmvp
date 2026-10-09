# WP64-S12 — Builder's Hub go-live

Owner-approved on 2026-10-09 (ruling "WP64 / go live"). This is the S12 order from `docs/wp/wp64-stories.md`, with who does each step. Env values and secrets never go in this file, in git or in chat: names only.

Live Stripe account: **WeekendMVP** (`acct_1ThX6u4fUcq943uM`). Sandbox for tests: `acct_1ThX7a9tlBLUMkdP`.

## Preconditions

| Precondition | State on 2026-10-09 |
|---|---|
| S1 to S10 done | Built and merged into the WP64 branch. S1's legacy webhook keeps working before and after its switch step (see Step 2) |
| S11 test-mode gate | Claude's checks D1 to D4 and the independent review E1 pass. The owner reports the sandbox journeys pass. The checklist page has no per-journey ticks, so there is no journey-by-journey record (`docs/wp/evidence/wp64-test-mode-gate.md`) |
| O1 to O9 ruled | O1 to O5 and O9 ruled. O7 window lengths are set at Step 6. O6 (invite parameter) and O8's operating details (slot, tool, capacity, replay hosting) are still open |
| Terms live and reviewed | Owner-signed (no lawyer review). Live once this branch merges. The registered company name, number and office are still to come (ruling "WP64 / legal pages live") |
| First live build scheduled | Owner, before Step 8 |
| Backup marker | Owner, before Step 5 (Convex dashboard, Backups, then note the backup time here) |

## Live account state, read on 2026-10-09

- No membership prices (none of the four lookup keys exist).
- One webhook endpoint: the legacy `https://www.weekendmvp.app/api/stripe-webhook` (`checkout.session.completed`). Leave it alone.
- No Customer Portal configuration in live mode. Manage billing, Switch and Cancel plan fail until Step 3c is done.

## Step 1 — Merge, everything dormant

- Merge the WP64 PR when CI is green. Not during a WP46 E7 GO step.
- The Vercel production build deploys the live Convex backend first. Never run `convex deploy --prod` by hand: this checkout's `--prod` targets a different, paused project.
- Check, signed out and signed in: Plan and billing shows the Free plan only (flag off), `/api/platform/membership/checkout` and `/portal` answer 503 for a signed-in member, the webhook answers 503 (no config), `/terms` and `/refund-policy` load.

## Step 2 — Live env values (owner)

Generate each secret yourself (for example `openssl rand -base64 48`). Never paste one into chat.

Vercel, Production only:

| Name | Value |
|---|---|
| `MEMBERSHIP_BILLING_MODE` | leave **empty** (off) until Step 4 |
| `MEMBERSHIP_TAX_MODE` | `managed_payments` |
| `MEMBERSHIP_BILLING_APP_ORIGIN` | `https://www.weekendmvp.app` |
| `MEMBERSHIP_BILLING_BRIDGE_SECRET` | 32+ random characters, the same value as in Convex |
| `STRIPE_MEMBERSHIP_RESTRICTED_KEY` | the live restricted key from Step 3a (`rk_live_…`) |
| `STRIPE_MEMBERSHIP_WEBHOOK_SECRET` | the live endpoint's signing secret from Step 3d (`whsec_…`) |
| `STRIPE_MEMBERSHIP_PRICE_MONTHLY`, `_ANNUAL`, `_LIFETIME_T1`, `_LIFETIME_T2` | the live price ids from Step 3b (not secrets) |
| `CRON_SECRET` | 16+ random characters |

Convex, the serving production deployment (Convex dashboard, Settings, Environment variables):

| Name | Value |
|---|---|
| `MEMBERSHIP_BILLING_BRIDGE_SECRET` | the same value as in Vercel |

Optional, S1's switch step, any time after Step 1: set `LEGACY_PAYMENTS_BRIDGE_SECRET` in Convex, then the same value in Vercel. The legacy webhook works either way.

Redeploy production after changing Vercel values. `MEMBERSHIP_*` and `STRIPE_*` are read at run time, so a plain redeploy is enough.

## Step 3 — Live Stripe objects

### 3a. Restricted key (owner)

Developers, API keys, Create restricted key, named `weekendmvp-membership`, with exactly the permissions in `docs/wp/evidence/wp64-stripe-setup.md` step 1 (Subscription schedules: Write included). Put it in Vercel only.

### 3b. Products and prices (Claude can create these through the Stripe connection on the owner's word, or the owner creates them in the Dashboard)

Every price: USD, tax behavior **exclusive**, per unit. Both products: tax code `txcd_10103000` (SaaS, personal use). Metadata on products `purpose=weekendmvp_membership_v1`, `product_key=<key>`. Metadata on prices `purpose=weekendmvp_membership_v1`, `price_key=<key>`.

| Product (key) | Price key | Lookup key | Amount | Billing |
|---|---|---|---|---|
| Builder’s Hub (`builders_hub`) | `monthly` | `weekendmvp_membership_monthly` | $29.00 | every month |
| Builder’s Hub (`builders_hub`) | `annual` | `weekendmvp_membership_annual` | $199.00 | every year |
| Builder’s Hub Founding Lifetime (`founding_lifetime`) | `lifetime_t1` | `weekendmvp_membership_lifetime_t1` | $249.00 | one time |
| Builder’s Hub Founding Lifetime (`founding_lifetime`) | `lifetime_t2` | `weekendmvp_membership_lifetime_t2` | $349.00 | one time |

Checkout refuses a price that differs from `PRICING` (amount, currency, interval, mode, tax behavior, archived), so a mistake here stops a sale rather than charging the wrong amount.

**Done 2026-10-09 by Claude, on the owner's word** ("create the LIVE prroducts and prices in stripe"), through the Stripe connection. Copied field for field from the sandbox catalog. All four prices pass `reviewPrice(price, key, livemode = true)` with no blocking issue and no warning.

| Object | Live id |
|---|---|
| Product Builder’s Hub | `prod_VPR7BdtHNIAjiO` |
| Product Builder’s Hub Founding Lifetime | `prod_VPR7rrNHH46YKM` |

Vercel production values (not secrets):

```bash
STRIPE_MEMBERSHIP_PRICE_MONTHLY=price_1UOcFL4fUcq943uMv3X9nLWZ
STRIPE_MEMBERSHIP_PRICE_ANNUAL=price_1UOcFR4fUcq943uMkXxyPfbO
STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1=price_1UOcFV4fUcq943uMO4xkV2hK
STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2=price_1UOcFX4fUcq943uMDRqSAf59
```

When setting up the Customer Portal (3c), add only the two Builder’s Hub prices (monthly and annual) to the plan switch.

### 3c. Customer Portal (done by Claude, 2026-10-09)

Settings, Billing, Customer portal, live mode. Match the sandbox table in `docs/wp/evidence/wp64-stripe-setup.md` ("Customer Portal"): cancel at period end with a reason, payment method update, invoice history, plan switch between the two Builder’s Hub prices only with prorations, downgrades scheduled when the interval shortens or the amount drops, quantity **off**, pause off, Terms and Privacy links. Save, so it becomes the default configuration.

The live check after Step 2 found no portal configuration in live mode. On the owner's word ("yes create the live portal configuration"), Claude created `bpc_1UOdc94fUcq943uM3RolKV18` through the Stripe connection, a copy of the sandbox default `bpc_1UOWL79tlBLUMkdP5EgGFqF4` with the live product and prices. It is the live default (`is_default: true`), and re-reading it confirms: cancel at period end with reasons, no proration on cancel, card update, invoice history, address and name updates only, plan switch on `prod_VPR7BdtHNIAjiO` with the live monthly and annual prices only, prorations created, downgrades scheduled when the interval shortens or the amount drops, quantity off, pause off, Terms and Privacy links, return to `/dashboard/billing`. Edits in the Dashboard change this same configuration.

### 3d. Webhook (owner)

Developers, Webhooks, Add endpoint: `https://www.weekendmvp.app/api/platform/membership/webhook`, API version `2026-05-27.dahlia`, these twelve events:

`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`

Copy its signing secret into Vercel (`STRIPE_MEMBERSHIP_WEBHOOK_SECRET`) and redeploy.

### 3e. Account settings (owner)

Managed Payments on, with the Terms URL in the public details. Revenue recovery, emails and branding as in the setup evidence, steps 3 to 5.

Claude then re-reads the live account (prices, portal configuration, webhook events) and records the result here.

## Launch order chosen (ruling "WP64 / launch order", option B)

The owner turned the flag on before the real-card test: `MEMBERSHIP_BILLING_MODE=live` and `NEXT_PUBLIC_BUILDERS_HUB=on` went on together, with a fresh production build. Monthly and annual are on sale from that build, Step 7 is done early, and Step 4 runs through the real Plan and billing page. The founding window is dated in code (Step 6, ruling "WP64 / founding windows"), so no step below deploys a temporary window.

## Step 4 — Real-card smoke test (owner), on the live page

Test signed in on `https://www.weekendmvp.app/dashboard/billing`. Claude watches the live Stripe account (payments, subscriptions, refunds, webhook deliveries) while you test. The Convex dashboard (serving deployment, Data) shows the same results: `plan_subscriptions`, `plan_grants`, `founding_seats` and `billing_events`.

1. Monthly: Upgrade to Builder's Hub · $29/mo, pay with a real card. Expect "Payment confirmed" and "Builder's Hub, monthly" with Cancel plan. Click Cancel plan, confirm on Stripe's page, and expect "Your plan is cancelled…" with Renew plan. Click Renew plan once and renew in the portal. Refund in full in the Stripe Dashboard. The page returns to Free.
2. Annual: the same, and before refunding, Switch to monthly. Stripe's page should say the change starts at renewal.
3. Founding Lifetime, once Step 5 has seeded the seats and PR #134 is live: Buy Founding Lifetime · $249 once. Expect seat 1 taken and a lifetime grant. Refund in full and expect the seat free again (50 of 50). The offer is open to members during this test.

If anything is wrong: set `MEMBERSHIP_BILLING_MODE` empty and redeploy (rollback below).

## Step 5 — Seats (owner, with a fresh backup) — pending

Window 3 is open to everyone, so the cohort import is not needed. In the Convex dashboard for `first-squirrel-244`: Backups, Backup now. Then Functions, run `platform/membership/seats:seed` with `{"apply":true}`, then `platform/membership/cohorts:launchCheck` with `{}`. Expect 50 free seats, `everyone` dated and `windowsInOrder: true`. Until this runs, Founding Lifetime stays hidden even with the window open.

## Step 6 — Windows (done in code, PR #134)

`convex/platform/membership/windows.ts`: `everyone` opens 2026-10-09 13:32 UTC. `buyers` and `newsletter` stay null (ruling "WP64 / founding windows"). Live when PR #134 merges and the production build deploys Convex.

## Step 7 — Flag on (done early, launch order B)

`NEXT_PUBLIC_BUILDERS_HUB=on` in Vercel production with a fresh build. It is inlined at build time, so a changed value alone does nothing.

## Step 8 — Offer open

Once Steps 5 and 6 are both live, every signed-in member sees Founding Lifetime on Plan and billing and the Home founding card. There is no separate window 1 or 2.

## Step 9 — Watch

Daily for the first week: webhook failures (Stripe, Developers, Webhooks), Vercel logs for `membership follow-up failed` and `membership portal flow refused`, refunds, disputes, and `platform/membership/events:counts`.

## Promotion codes (ruling "WP64 / promotion codes")

Every Checkout Session sends `allow_promotion_codes: true`, live once the PR that adds it merges. Stripe's page then shows an "Add promotion code" field. Nothing works until a code exists. In live mode, Product catalog, Coupons, Create coupon:

- **Discount:** a percentage or a fixed amount in USD.
- **Duration:** for monthly and annual, once (first payment only), repeating for some months, or forever. Founding Lifetime is one payment, so any duration takes off once.
- **Apply to specific products:** Builder's Hub (`prod_VPR7BdtHNIAjiO`), Founding Lifetime (`prod_VPR7rrNHH46YKM`), or both. Leave it empty and the code works on both.
- **Promotion code:** the word members type, with optional expiry, a redemption limit, first-time customers only, or a minimum amount.

A code changes only what the member pays. The plan, the founding seat and its tranche price stay the same. A 100% code needs no card and still grants the plan. A refund returns what the member paid. To stop a code, archive the promotion code in Stripe.

## Rollback

Set `MEMBERSHIP_BILLING_MODE` empty and redeploy: checkout and the portal answer 503, the webhook keeps settling. Turn `NEXT_PUBLIC_BUILDERS_HUB` off and rebuild. Never delete tables. Refunds happen in Stripe.

## Reviews

Day 14, 30 and 60 from the day window 3 opens, with the triggers in the S12 story.

## Signed checklist

| Step | Done by | Date | Evidence (redacted) |
|---|---|---|---|
| 1 Merge, dormant | Owner merged PR #131; Claude checked | 2026-10-09 | Vercel production `dpl_3EzBE2…` READY on `27eeac9` (the Convex deploy runs first in that build). `/terms`, `/refund-policy` 200, indexable, no draft text, email line present, both in the sitemap and footer. Signed out: checkout 401, portal 401. Webhook 503 (no config). Reconcile 200 `skipped: not_configured`. Signed-in checkout and portal 503: covered by the route tests, not checked live |
| 2 Live env values | Owner | 2026-10-09 | Owner reports done and redeployed. Checked from outside: a forged webhook now gets 400 "Invalid signature" (the key, signing secret, bridge secret and four price ids are set and parse), and reconcile without the bearer gets 401 (`CRON_SECRET` set). The Vercel variable list was not readable from here (403). `MEMBERSHIP_BILLING_MODE` and the Convex secret are confirmed by Step 4 |
| 3 Live Stripe objects | 3b, 3c Claude; 3a, 3d, 3e owner | 2026-10-09 | 3b: 2 products and 4 prices, catalog check clean. 3c: portal `bpc_1UOdc9…`, the live default. 3d: endpoint `we_1UOdJI…` with the 12 events on `2026-05-27.dahlia`, enabled. 3a and 3e: owner reports done (key permissions and Managed Payments are not readable from here) |
| 4 Real-card smoke test | | | |
| 5 Seats | | | Pending: backup, seed, `launchCheck` |
| 6 Windows | Claude (PR #134) | 2026-10-09 | `everyone` 13:32 UTC, windows 1 and 2 null. Live on merge |
| 7 Flag on | Owner | 2026-10-09 | Done early (option B). Plan and billing shows monthly and annual with the flag on (owner screenshot) |
| 8 Offer open | | | |
| 9 First week watched | | | |
