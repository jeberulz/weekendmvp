# WP64-S10 Stripe setup (test mode)

Status 2026-10-09: the catalog and the Customer Portal exist in the **WeekendMVP sandbox** (test mode), created through the Stripe connector and checked against `PRICING`. Nothing was created in the live **WeekendMVP** account. Dashboard-only settings, the restricted key, the tax path (O1) and the seller details (O2) are still the owner's. No secret appears in this file: ids of products, prices and portal configurations are not secrets.

Source of truth for every value below: `lib/membership/stripe-catalog.ts` (built from `PRICING` in `convex/platform/plans.ts`). Check the account against it any time with:

```bash
STRIPE_MEMBERSHIP_SETUP_KEY=sk_test_... npm run membership:stripe-setup            # read-only
STRIPE_MEMBERSHIP_SETUP_KEY=sk_test_... npm run membership:stripe-setup -- --apply # create what is missing
```

The script refuses any key that is not a test key and stops on any live object.

## 1. Created on 2026-10-09 (sandbox, test mode)

### Products

| Key | Name | Id | Metadata |
|---|---|---|---|
| `builders_hub` | Builder’s Hub | `prod_VPKzNTk78zFb4h` | `purpose=weekendmvp_membership_v1`, `product_key=builders_hub` |
| `founding_lifetime` | Builder’s Hub Founding Lifetime | `prod_VPKzLcirgpy9Cr` | `purpose=weekendmvp_membership_v1`, `product_key=founding_lifetime` |

No tax code yet (O1). It can be set later on both products without new prices.

### Prices

| Price key | Lookup key | Amount | Billing | Id | Env name |
|---|---|---|---|---|---|
| `monthly` | `weekendmvp_membership_monthly` | $29 | every month | `price_1UOWJo9tlBLUMkdPbDBnyYX5` | `STRIPE_MEMBERSHIP_PRICE_MONTHLY` |
| `annual` | `weekendmvp_membership_annual` | $199 | every year | `price_1UOWJr9tlBLUMkdPx58bYYH6` | `STRIPE_MEMBERSHIP_PRICE_ANNUAL` |
| `lifetime_t1` | `weekendmvp_membership_lifetime_t1` | $249 | once (seats 1 to 15) | `price_1UOWJv9tlBLUMkdPYIJEVYTo` | `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1` |
| `lifetime_t2` | `weekendmvp_membership_lifetime_t2` | $349 | once (seats 16 to 50) | `price_1UOWJz9tlBLUMkdPqW9uoTzX` | `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2` |

All USD, per unit, licensed, active, `livemode: false`, metadata `purpose` and `price_key`. Tax behavior is `unspecified`, so O1 can still set it to `inclusive` or `exclusive` once (Stripe allows one change from unspecified).

Verified: each price passes `reviewPrice` with no blocking item and no warning, and the setup planner finds nothing left to create.

For a local `.env.local` in test mode (ids, not secrets):

```bash
STRIPE_MEMBERSHIP_PRICE_MONTHLY=price_1UOWJo9tlBLUMkdPbDBnyYX5
STRIPE_MEMBERSHIP_PRICE_ANNUAL=price_1UOWJr9tlBLUMkdPx58bYYH6
STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1=price_1UOWJv9tlBLUMkdPYIJEVYTo
STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2=price_1UOWJz9tlBLUMkdPqW9uoTzX
```

### Customer Portal (S5 configuration)

Configuration `bpc_1UOWL79tlBLUMkdP5EgGFqF4`, named "Builder’s Hub", the sandbox default.

| Feature | Setting | Why |
|---|---|---|
| Cancel | on, at period end, no proration, asks for a reason | Frozen policy: access to the end of the paid period. Reasons feed the S12 churn review |
| Payment method update | on | O9: a member fixes a failed card |
| Invoice history | on | S5 |
| Plan switch | on, Builder’s Hub monthly and annual only, prorations created | S5: monthly to annual applies now |
| Scheduled switch | when the interval shortens or the amount drops | S5: annual to monthly waits for renewal |
| Quantity change | **off** | Stripe turned it on by default. One seat per member |
| Pause | off | S5: no pause |
| Customer details | address and name only | Email stays the account's. Tax id waits for O1 |
| Links | Terms `https://www.weekendmvp.app/terms`, Privacy `https://www.weekendmvp.app/privacy-policy`, return `/dashboard/billing` | `/terms` returns 404 in production until the S9 text is approved |

Founding Lifetime is a one-time payment, so it is not in the portal.

## 2. Owner steps in the Dashboard (sandbox now, live again at S12)

A sandbox is its own account: everything here must be repeated on the live account in S12 step 3.

1. **Restricted key** for the runtime, `STRIPE_MEMBERSHIP_RESTRICTED_KEY` (Developers, API keys, Create restricted key). Name it `weekendmvp-membership`. Grant only:

   | Resource | Access | Used by |
   |---|---|---|
   | Checkout Sessions | Write | S3 create, S4 retrieve with line items |
   | Customers | Write | S3 creates or reuses the owner's customer |
   | Prices | Read | S3 checks each price against `PRICING` |
   | Products | Read | price checks with the product expanded |
   | Subscriptions | Write | S4 cancels after a full refund, O5 cancels at period end, reconcile lists |
   | Invoices | Read | S4 invoice events |
   | Payment Intents | Read | S4 lifetime payments |
   | Charges | Read | S4 refund and dispute events |
   | Refunds | Write | S4 refunds a payment whose seat is gone |
   | Disputes | Read | S4 dispute events |
   | Customer portal | Write | S5 portal sessions |
   | Events | Read | S4 reconcile and replay |
   | Everything else | None | |

   S3 to S5 confirm this list in test mode and remove anything unused. The setup script uses a separate operator key (`STRIPE_MEMBERSHIP_SETUP_KEY`), kept in the operator's shell only.

2. **Webhook in test mode.** Once S4's route exists, run locally:

   ```bash
   stripe login   # pick the WeekendMVP sandbox
   stripe listen --forward-to localhost:3000/api/platform/membership/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed,charge.refunded,charge.dispute.created,charge.dispute.closed
   ```

   Put the printed `whsec_...` in `.env.local` as `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`. The list is `MEMBERSHIP_WEBHOOK_EVENTS`. Vercel previews are off for agent branches, so no hosted test endpoint is needed.

3. **Revenue recovery** (Billing, Revenue recovery): Smart Retries on, about 8 tries within 2 weeks (O9 default). After the last failed retry: cancel the subscription (O9: access ends on unpaid or canceled). Failed-payment emails on. Expiring-card emails on.

4. **Customer emails** (Settings, Customer emails): receipts for successful payments and refunds on. Upcoming-renewal reminders on, at least 7 days before an annual renewal (the draft Terms promise this, O4).

5. **Branding** (Settings, Branding): icon and logo, brand color `#cc5500`, accent `#1a1814`, matching the site.

6. **Public business details** (Settings, Public details), needs O2: business name, support email, support URL, statement descriptor (up to 22 characters), Terms URL `https://www.weekendmvp.app/terms` (Checkout needs it to require terms acceptance, S3), Privacy URL `https://www.weekendmvp.app/privacy-policy`.

7. **Tax path**, needs O1:
   - Managed Payments: ask Stripe in writing whether a plan with one live group session a month is eligible, record the answer here without personal data, activate, accept the terms.
   - Or Stripe Tax: UK origin address, registrations as the accountant advises, default tax behavior.
   - Then set the tax code and behavior from the repo: `npm run membership:stripe-setup -- --apply --tax-code=<code> --tax-behavior=<exclusive|inclusive>`. Candidates: `txcd_10000000` (general electronically supplied services), `txcd_10103000` (SaaS, personal use), `txcd_10103001` (SaaS, business use).

## 3. Dated checklist

| Item | Status | Date | Evidence |
|---|---|---|---|
| Builder’s Hub product, monthly and annual prices | Done (sandbox) | 2026-10-09 | Section 1, `reviewPrice` clean |
| Founding Lifetime product, two one-time prices | Done (sandbox) | 2026-10-09 | Section 1, `reviewPrice` clean |
| Customer Portal configuration | Done (sandbox) | 2026-10-09 | Section 1 |
| API version pinned | Done in code | 2026-10-09 | `MEMBERSHIP_STRIPE_API_VERSION = 2026-05-27.dahlia` (the installed SDK's), test pins it |
| Env-name inventory | Done | 2026-10-09 | `.env.example`, `MEMBERSHIP_ENV`, test checks each name |
| Restricted key | Owner | | Step 1 |
| Smart Retries and dunning, failed-payment emails | Owner | | Step 3 |
| Renewal reminders and receipts | Owner | | Step 4 |
| Branding | Owner | | Step 5 |
| Support email, statement descriptor, public details, Terms and Privacy URLs | Owner, needs O2 | | Step 6 |
| Tax path, tax codes, tax behavior | Owner and accountant, needs O1 | | Step 7 |
| Test webhook through the Stripe CLI | Waits for S4's route | | Step 2 |
| Live objects | Not in S10 | | S12 step 3 |

## 4. Env names (names only)

Next.js and Vercel: `MEMBERSHIP_BILLING_MODE`, `MEMBERSHIP_TAX_MODE`, `MEMBERSHIP_BILLING_APP_ORIGIN`, `MEMBERSHIP_BILLING_BRIDGE_SECRET`, `STRIPE_MEMBERSHIP_RESTRICTED_KEY`, `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_MONTHLY`, `STRIPE_MEMBERSHIP_PRICE_ANNUAL`, `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1`, `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2`, `CRON_SECRET`. Convex: `MEMBERSHIP_BILLING_BRIDGE_SECRET` (S4, optional). Operator shell only: `STRIPE_MEMBERSHIP_SETUP_KEY`. Unset `MEMBERSHIP_BILLING_MODE` means off.
