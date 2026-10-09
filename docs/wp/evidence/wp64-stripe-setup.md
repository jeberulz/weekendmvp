# WP64-S10 Stripe setup (test mode)

Status 2026-10-09: the catalog and the Customer Portal exist in the **WeekendMVP sandbox** (test mode), created through the Stripe connector and checked against `PRICING`. Nothing was created in the live **WeekendMVP** account. O1 and O2 were ruled the same day: Stripe Managed Payments with prices exclusive of tax, and Rulz&Co as the seller (see `docs/wp/RULINGS.md`). The sandbox now carries the tax code and tax behavior, and a Managed Payments Checkout Session was created there (section 1b). Dashboard-only settings and the restricted key are still the owner's. No secret appears in this file: ids of products, prices and portal configurations are not secrets.

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

Tax code `txcd_10103000` (Software as a service, personal use) on both, set on 2026-10-09 after O1. Stripe accepted it on a Managed Payments session, so it is eligible. It can change later without new prices.

### Prices

| Price key | Lookup key | Amount | Billing | Id | Env name |
|---|---|---|---|---|---|
| `monthly` | `weekendmvp_membership_monthly` | $29 | every month | `price_1UOWJo9tlBLUMkdPbDBnyYX5` | `STRIPE_MEMBERSHIP_PRICE_MONTHLY` |
| `annual` | `weekendmvp_membership_annual` | $199 | every year | `price_1UOWJr9tlBLUMkdPx58bYYH6` | `STRIPE_MEMBERSHIP_PRICE_ANNUAL` |
| `lifetime_t1` | `weekendmvp_membership_lifetime_t1` | $249 | once (seats 1 to 15) | `price_1UOWJv9tlBLUMkdPYIJEVYTo` | `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1` |
| `lifetime_t2` | `weekendmvp_membership_lifetime_t2` | $349 | once (seats 16 to 50) | `price_1UOWJz9tlBLUMkdPqW9uoTzX` | `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2` |

All USD, per unit, licensed, active, `livemode: false`, metadata `purpose` and `price_key`. Tax behavior `exclusive`, set on 2026-10-09 after O1: tax is added at checkout. Stripe allows that change only once, from unspecified.

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

Founding Lifetime is a one-time payment, so it is not in the portal. Under Managed Payments, members can also manage orders in Link.

S5 (2026-10-09):

- Re-read through the connector: the configuration above is still the sandbox default and unchanged. The portal route (`app/api/platform/membership/portal/route.ts`) passes no configuration, so it uses the account default. The setup script checks that default. On the live account, make the same configuration the default at S12.
- Plan switch rules. Monthly to annual applies at once: the interval changes, so Stripe resets the billing date and invoices the annual price less the unused part of the month. Annual to monthly waits for the renewal: the interval shortens, so the portal schedules it for the end of the paid year. The portal shows the amount before the member confirms. Settlement reads the new Price from `customer.subscription.updated`, so the dashboard shows the new term once Stripe reports it. The Terms say nothing about switching yet.
- Portal and Link under Managed Payments. Stripe's docs: members "automatically have access to the Link website" to view orders, cancel or update subscriptions and update payment methods, and "you can also offer additional subscription management from your own website using the Customer Portal". Both change the same Stripe subscription, so both reach the dashboard through the same webhook. Our billing page keeps Manage billing (the portal) and adds no Link link. Still to confirm in S11 with a test clock: the portal opens for a Managed Payments subscription, a switch invoices through Managed Payments, and a cancel in Link shows on the dashboard.

## 1b. Managed Payments checks (sandbox, 2026-10-09)

Read from Stripe's documentation through the connector, then tried against the sandbox with test sessions only:

| Check | Result | Consequence |
|---|---|---|
| Checkout Session with `managed_payments[enabled]=true`, monthly price, eligible tax code | Created. Tax is automatic with Stripe liable; Stripe collects name and billing address and offers tax id entry itself | Managed Payments is usable in the sandbox. The session expires unpaid within 24 hours (the connector cannot expire it early) |
| Same, with `custom_text.terms_of_service_acceptance` | **Rejected**: "You cannot use custom_text with Managed Payments" | The S9 consent sentence goes beside our buy button instead (`_consent.ts` updated). The plan picker already shows price, renewal, the refund line, the tax line and the Terms links |
| Same, with `consent_collection.terms_of_service: "required"` | Rejected only because no Terms URL is set in public details | Stripe's terms checkbox works once the owner adds the Terms URL (step 6) |
| Parameters S3 must not send under Managed Payments (Stripe's list) | `automatic_tax`, `tax_id_collection`, `subscription_data.default_tax_rates`, `payment_method_types`, `payment_method_configuration`, `customer_update[name]`, `customer_update[address]`, shipping, Connect fields, `subscription_data.invoice_settings`, `invoice_creation`, `adaptive_pricing`, statement descriptors | S3 sends `managed_payments[enabled]=true` and none of these |
| Eligibility | GB sellers are supported. Products must be "fully automated digital products"; live 1-to-1 coaching is named as ineligible | The monthly live group build is a grey area the owner accepted (ruling "WP64 / tax"). Asking Stripe in writing is still recommended |
| Emails and support | Link sends receipts, invoices, refund and subscription emails, and handles transaction support and disputes. Stripe may refund within 60 days in some cases, to prevent chargebacks | S5 checks whether Link sends the annual renewal reminder the Terms promise (7 days ahead). If not, S5 sends it |
| The exact S3 parameters, lifetime: `mode=payment`, the lifetime price, `client_reference_id`, `metadata` and `payment_intent_data.metadata` (`purpose`, `order_id`, `term`), `customer_email`, `customer_creation=always`, `expires_at` 31 minutes out, `managed_payments[enabled]=true` | Accepted (2026-10-09). Stripe adds an invoice issued by Stripe | Matches `checkoutSessionParams` in `app/api/platform/membership/_server.ts` |
| The exact S3 parameters, annual: `mode=subscription`, `subscription_data.metadata`, the rest as above without `customer_creation` or `expires_at` | Accepted (2026-10-09) | Same |

The probe sessions (ids starting `cs_test_a1Qh`, `cs_test_a1FP` and `cs_test_a1xA`, client references `probe_s3_*`) expire unpaid on their own.

## 1c. Run checkout locally in test mode (S3, for S11)

Checkout answers 503 until all of these are set, and Stripe refuses the session until the Terms URL is in public details (step 6).

1. Convex dev deployment: `npx convex env set MEMBERSHIP_BILLING_BRIDGE_SECRET <32+ random characters>`.
2. `.env.local` (values never in git): `MEMBERSHIP_BILLING_MODE=test`, `MEMBERSHIP_TAX_MODE=managed_payments`, `MEMBERSHIP_BILLING_APP_ORIGIN=http://localhost:3000`, the same `MEMBERSHIP_BILLING_BRIDGE_SECRET`, `STRIPE_MEMBERSHIP_RESTRICTED_KEY=rk_test_...` (step 1), and the four price ids from section 1.
3. `NEXT_PUBLIC_BUILDERS_HUB=on` locally to see the buttons. For Founding Lifetime, seed the seats (`npx convex run platform/membership/seats:seed '{"apply":true}'`) and date a window in `convex/platform/membership/windows.ts` on a local branch only.
4. Nothing is granted until the S4 webhook settles the payment, so run step 2's `stripe listen` alongside `npm run dev`. Without it, the return page waits, then says the payment is still being confirmed.

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
   | Refunds | Write | S4 refunds a payment whose seat is gone, a payment rejected at settlement, and a duplicate subscription |
   | Disputes | Read | S4 dispute events |
   | Subscription schedules | Write | O5 and refunds release a plan switch the member scheduled in the portal before changing the subscription |
   | Invoice payments | Read, if listed separately | S4 finds the invoice behind a refunded or disputed subscription payment. If the key form has no such line, Invoices: Read covers it. Confirm in S11 |
   | Customer portal | Write | S5 portal sessions |
   | Events | Read | S4 reconcile and replay |
   | Everything else | None | |

   S3 to S5 confirm this list in test mode and remove anything unused. The setup script uses a separate operator key (`STRIPE_MEMBERSHIP_SETUP_KEY`), kept in the operator's shell only.

2. **Webhook in test mode.** The S4 route exists (`app/api/platform/membership/webhook/route.ts`). Run locally:

   ```bash
   stripe login   # pick the WeekendMVP sandbox
   stripe listen --forward-to localhost:3000/api/platform/membership/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed,charge.refunded,charge.dispute.created,charge.dispute.closed
   ```

   Put the printed `whsec_...` in `.env.local` as `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`. The list is `MEMBERSHIP_WEBHOOK_EVENTS`. Vercel previews are off for agent branches, so no hosted test endpoint is needed.

   The route needs the restricted key, the `whsec_` secret, the bridge secret and the four price ids. It does not need `MEMBERSHIP_BILLING_MODE`: `off` still settles (frozen contract 11). The full S11 run is `docs/runbooks/wp64-test-mode-gate.md`. The short version, in this order: a monthly checkout (subscription row, order `paid`), a lifetime checkout (seat `taken`, one grant), an expired lifetime session (seat back), a full refund of each from the Dashboard (grant revoked, subscription canceled), a partial refund (nothing changes), and `stripe trigger charge.dispute.created` for a dispute. Each Dashboard action should show one `billing_events` row per event id (`npx convex run platform/membership/events:counts`).

   For S12, the live endpoint is registered in the Dashboard (Developers, Webhooks, Add endpoint): URL `https://www.weekendmvp.app/api/platform/membership/webhook`, the same twelve events, API version `2026-05-27.dahlia`, to match the code. The route re-reads every object on that version, so an endpoint left on an older version still settles correctly. Its signing secret goes in Vercel production as `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`.

   Daily reconcile: set `CRON_SECRET` (16+ random characters) in Vercel production. Vercel then calls `/api/platform/membership/reconcile` at 04:17 UTC with it as a bearer header. Unset, the route does nothing and answers 200, which is the dormant state.

   Disputes under Managed Payments: Stripe answers disputes itself and may accept one it expects to lose. The `charge.dispute.*` events still arrive, and settlement follows the outcome (O9). The Dashboard setting "Manage disputed payments" can stay at its default, because a lost dispute already cancels the subscription through the API.

3. **Revenue recovery** (Billing, Revenue recovery): Smart Retries on, about 8 tries within 2 weeks (O9 default). After the last failed retry: cancel the subscription (O9: access ends on unpaid or canceled). Failed-payment emails on. Expiring-card emails on.

4. **Customer emails** (Settings, Billing, Subscriptions and emails): under Managed Payments, Link sends receipts, invoices and refund notices, and the Dashboard receipt settings do not apply. These settings still do: turn on **Upcoming renewals** and set the reminder to at least 7 days before renewal (the Terms promise this for annual plans, O4). Turn on failed-payment and expiring-card emails. Whatever the setting, Stripe also sends anniversary reminders before the 6- and 12-month anniversary to members in the UK and Australia, and before the 12-month anniversary elsewhere (Stripe's Managed Payments docs, read 2026-10-09).

5. **Branding** (Settings, Branding): icon and logo, brand color `#cc5500`, accent `#1a1814`, matching the site.

6. **Public business details** (Settings, Public details), O2 ruled: business name Rulz&Co, support email `iseghohi.john@gmail.com`, support URL `https://www.weekendmvp.app`, Terms URL `https://www.weekendmvp.app/terms` (Checkout needs it to require terms acceptance, section 1b), Privacy URL `https://www.weekendmvp.app/privacy-policy`. No statement descriptor: Managed Payments manages it.

7. **Managed Payments** (Settings, Managed Payments), O1 ruled: the sandbox already accepts Managed Payments sessions. On the live account, activate it and accept its terms before S12 step 3. Optionally ask Stripe in writing whether a plan with one live group session a month is eligible, and record the answer here without personal data. The tax code and behavior are already the setup script's defaults (`MEMBERSHIP_TAX_CODE`, `MEMBERSHIP_TAX_BEHAVIOR`).

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
| Renewal reminders and receipts | Owner (where the settings live confirmed from Stripe's docs) | 2026-10-09 | Step 4 |
| Portal configuration is the default; plan switch rules | Done (sandbox), re-read for S5 | 2026-10-09 | Section 1, Customer Portal, S5 |
| Portal with a Managed Payments subscription, Link cancel | Docs say they coexist; confirm in S11 with a test clock | | Section 1, Customer Portal, S5 |
| Branding | Owner | | Step 5 |
| Support email, public details, Terms and Privacy URLs | Owner (O2 ruled) | | Step 6 |
| Tax path: Managed Payments (O1 ruled) | Sandbox done; live activation is the owner's | 2026-10-09 | Section 1b, step 7 |
| Tax code and tax behavior on the sandbox catalog | Done | 2026-10-09 | `txcd_10103000`, `exclusive`, planner clean |
| Test webhook through the Stripe CLI | Route built (S4); owner runs it in S11 | 2026-10-09 | Step 2 |
| Refunds and subscription changes through the API under Managed Payments | Allowed by Stripe's docs ("you can still issue refunds, update subscriptions"); confirm in S11 | 2026-10-09 | docs.stripe.com/payments/managed-payments/how-it-works |
| `CRON_SECRET` in Vercel production | Owner, at S12 | | Step 2 |
| Live webhook endpoint at API version `2026-05-27.dahlia` | Owner, at S12 | | Step 2 |
| Live objects | Not in S10 | | S12 step 3 |

## 4. Env names (names only)

Next.js and Vercel: `MEMBERSHIP_BILLING_MODE`, `MEMBERSHIP_TAX_MODE`, `MEMBERSHIP_BILLING_APP_ORIGIN`, `MEMBERSHIP_BILLING_BRIDGE_SECRET`, `STRIPE_MEMBERSHIP_RESTRICTED_KEY`, `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_MONTHLY`, `STRIPE_MEMBERSHIP_PRICE_ANNUAL`, `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1`, `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2`, `CRON_SECRET`. Convex: `MEMBERSHIP_BILLING_BRIDGE_SECRET` (S4, optional). Operator shell only: `STRIPE_MEMBERSHIP_SETUP_KEY`. Unset `MEMBERSHIP_BILLING_MODE` means off.
