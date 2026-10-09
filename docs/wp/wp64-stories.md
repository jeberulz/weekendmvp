# WP64 Stories - Builder's Hub Billing (Subscriptions, Annual And Founding Lifetime)

Branch: no build branch yet. These planning docs are on `claude/tender-heisenberg-bf94ku`. Suggested build branch when the owner opens the build lane: `codex/wp64-builders-hub-billing`.
Lane: Work Package, high-risk payments. Model routing: high for S1 to S5, S7 (eligibility), S11 and S12. Mid for S6, S8 and S9. Low for S0 and the S10 checklist.
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: In Stripe test mode, and then live after owner approval, a signed-in member upgrades from the dashboard to Builder's Hub monthly ($29), annual ($199) or a Founding Lifetime seat (50 seats, $249 then $349). Verified, purpose-separated webhooks grant and revoke access exactly once, in any order, with replays and delays. The server is the only source of entitlement. Refunds, disputes and failed payments follow the frozen policy. The legacy ship·able path and the WP24 credit code are untouched and namespaced. Merging ships everything dormant, because a merge deploys the live Convex backend. Activation is a separate owner-approved gate (S12).

Status: Planned on 2026-10-04. No code, no Stripe object, no deploy, no production data change.

Renumbered three times. WP55 became WP62 on 2026-10-07, because a local Codex branch, `codex/wp55-price-acceptance`, already uses WP55. WP62 became WP63 on 2026-10-08, because `main` took WP62 for the public idea SEO summary. WP63 became WP64 on 2026-10-09, because `main` took WP63 for public navigation consistency (PR #127, see `docs/wp/RULINGS.md`). The six rulings dated 2026-10-04 keep the scope label `WP55 / ...`, the 2026-10-07 ruling keeps `WP62 / ...` and the 2026-10-08 ruling keeps `WP63 / ...`, because the log is append-only. Commits made before 2026-10-09 say WP63. Read all of them as WP64.

## Read first

1. `CLAUDE.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, `docs/wp/RULINGS.md` (rows dated 2026-09-25 and 2026-10-04).
2. `docs/wp/wp44-dashboard-prd.md` sections 6.5, 6.6 and 9.4. They define the plan, the upgrade surfaces and the rule that billing is its own high-risk package.
3. `docs/wp/wp24-stories.md` and `convex/platform/billing/**`. They are the pattern: signed bridge, exactly-once events, purpose separation. WP64 copies the pattern and never edits that code.
4. `convex/_generated/ai/guidelines.md` before any `convex/` work.
5. `docs/wp/evidence/wp64-pricing-and-billing-research.md`. Every number below traces to it, with a primary or secondary label.
6. `docs/wp/AGENT_HANDOFF.md` (current E7 section) and `scripts/vercel-build.mjs`. The production build deploys Convex before Next.

## Owner inputs recorded 2026-10-04

| # | Question | Answer |
|---|---|---|
| 1 | Approve the price ladder? | Yes (ruling "WP55 / price ladder") |
| 2 | Add a monthly live build to the bundle? | Yes (ruling "WP55 / bundle") |
| 3 | Offer order: ship·able and DARE buyers, then newsletter, then public? | Yes (ruling "WP55 / founding offer order") |
| 4 | Refunds: 30 days, full? | Yes (ruling "WP55 / refunds") |
| 5 | Tax | "UK". Recorded as seller location only (ruling "WP55 / seller location"). The mechanism is open (O1) |
| 6 | Which WP number? | "Please decide". First chosen as WP55 (ruling "WP55 / numbering"), then WP62 on 2026-10-07 (ruling "WP62 / renumbering"), then WP63 on 2026-10-08 (ruling "WP63 / renumbering"), then WP64 on 2026-10-09 (ruling "WP64 / renumbering") |
| 7 | Where does the offer live? | Inside the dashboard. Upselling strategy comes later |
| 8 | Audience data | Members: zero. ship·able and DARE buyers: zero. GA4 sessions were not provided. There is no baseline, so the first review dates in S12 run from the day window 3 opens |

Consequence of input 8: the window 1 cohort may be empty. Code and runbooks treat an empty cohort as normal.

## Frozen Billing Contract

1. **Prices (USD).** Monthly $29. Annual $199, billed once a year. Founding Lifetime: 50 seats, one-time payment, seats 1 to 15 at $249, seats 16 to 50 at $349. The seat number sets the price. A refunded seat returns to the pool at its own number and price. Prices live in one constant (`PRICING`, beside `PLANS`). The browser never supplies an amount, currency, Price ID, seat, tranche or owner.
2. **One plan, three terms.** Plan id stays `builders_hub`. Terms are `monthly`, `annual` and `lifetime`. Every term gets the same entitlements. A comp grant (operator-issued, for testers and support) is a fourth way to hold the plan.
3. **Entitlements live in Convex.** `resolvePlan` in `convex/platform/planResolver.ts` is the one swap point (WP44 FR-21 and FR-22). Reads are clock-free (no `Date.now()` in a query, per the Convex guidelines and the 2026-09-26 review follow-up). Mutation guards may read the clock. Stripe Entitlements is not used: lifetime and comp grants are not Stripe subscriptions, so a second source of truth would only add drift.
4. **Hosted Checkout only.** Stripe-hosted Checkout by redirect. No embedded Checkout, no Elements, no `client_secret` in any client file. The WP24 tests pin the same rule for the credit checkout, and WP64 adds its own. Hosted Checkout keeps card data out of our scope and adds no client-side Stripe library. The Checkout success page never grants anything. Only a verified webhook does.
5. **Purpose separation.** Metadata `purpose` is `weekendmvp_membership_v1`. New routes under `app/api/platform/membership/**`. New Convex namespace `convex/platform/membership/**`. New secret names. The legacy ship·able handler and the WP24 credit handler must never act on a membership event, and the reverse. A static test pins each direction.
6. **Webhook design.** Thin events, fat fetch. The Next route verifies the signature on the raw body, then fetches the current Stripe object and sends a normalized, size-capped snapshot to Convex through an HMAC-signed bridge (the WP24 pattern). Convex never holds a Stripe key. Settlement is idempotent by event id, never lets an older snapshot overwrite a newer one, and resolves the owner from our own stored orders and customer links, never from metadata alone.
7. **Settlement checks identity, not presentment.** Verify mode, payment status, the paid line item's Stripe Price ID and quantity against the stored order. Record the presented amount, currency, tax and any FX for reporting only. Tax and Adaptive Pricing change `amount_total`, so the WP24 amount-equality check cannot be reused as is. Confirm the exact fields against the pinned API version in test mode.
8. **Seat inventory is rows, not a count.** A seeded `founding_seats` table has 50 rows (seat number 1 to 50). Reserve the lowest free seat inside one mutation, set it `reserved` until the Checkout session expires, mark it `taken` on a verified payment, and free it on expiry or full refund. A payment that arrives after its reservation was released takes the same seat if it is still free, and is fully refunded automatically if it is not.
9. **Refund policy (owner ruling).** 30 days from first purchase, full refund, no proration. A full refund of a lifetime payment revokes the grant. A full refund of a subscription charge cancels the subscription. A partial refund changes nothing and is logged. Renewals: see O4.
10. **Dormant by default.** A merge to `main` makes the Vercel production build run `convex deploy` first (`scripts/vercel-build.mjs`). So at merge time: every new Convex env var is `v.optional` and fails closed, every membership route returns 503 until `MEMBERSHIP_BILLING_MODE` is set, the schema change is additive tables only, no live Stripe object or key exists, and `NEXT_PUBLIC_BUILDERS_HUB` stays off. Merge is not activation.
11. **Modes.** `MEMBERSHIP_BILLING_MODE` is `off` (default), `test` or `live`. The key prefix must match the mode. `off` stops new checkouts and portal sessions but keeps the webhook processing, so a rollback never strands a paying member. The WP24 credit guards (`cs_test_`, live-event rejection) stay exactly as they are.
12. **Upgrade surfaces stay inside the WP44 rules (PRD 6.6).** Plan card, point-of-intent sheet, locked-action tag, Plan and billing page, Home offer card. No countdown timers, no strike-through "regular" prices, no pre-checked boxes. The seat counter shows only the true remaining count. The public homepage does not sell.
13. **No card data, no PII in logs.** No email, raw event body, signature or secret in logs, errors or analytics. `billing_events` stores ids, types and outcomes only.

## Data contract (additive tables; names frozen here)

All new, none touch an existing table or index. Index names follow `by_field1_and_field2`. Every row stores `livemode`, and settlement rejects a row whose mode differs from the configured mode. One schema writer per merge window.

Clarified in S2 (2026-10-08): `livemode` is stored on the four tables that mirror a Stripe object. `plan_grants` and `founding_seats` point at an order, which stores it, and a comp grant has no mode. Times are milliseconds (S4 converts Stripe's seconds). `plan_subscriptions.canceledAt` means when the subscription ended (Stripe `ended_at`), not when the member asked to cancel. The presented amount is `presentedAmountMinor` and `presentedCurrency`. `revokeReason` is `refund`, `dispute_lost` or `operator`. `billing_events.outcome` is `applied`, `ignored`, `stale` or `rejected`. Grants and seats are flat objects, not unions, because `convex/referenceTables.ts` reads `.fields` from every table validator, so the writers keep the shape rules: a lifetime grant names its order and seat and a comp grant names neither. A free seat holds no owner, and a reserved seat has `reservedUntil`.

Changed in S7 (2026-10-09): `offer_cohorts` stores `emailHash` (a SHA-256 of the normalized address with a fixed prefix, see `convex/platform/membership/cohortHash.ts`) instead of `normalizedEmail`, with indexes `by_emailHash`, `by_cohort_and_emailHash` and a new `by_batchId` so the operator can undo one import. The import script hashes on the operator's machine, so no buyer or newsletter address reaches Convex, a log or git. An unsalted hash can still be checked against a guessed list of addresses, so the table is still treated as personal data (S9).

| Table | Key fields | Indexes | Story |
|---|---|---|---|
| `billing_customers` | ownerId, stripeCustomerId, livemode, createdAt | by_ownerId, by_stripeCustomerId | S2 |
| `plan_subscriptions` | ownerId, stripeSubscriptionId, stripeCustomerId, term (monthly or annual), status (Stripe status), currentPeriodEnd, cancelAtPeriodEnd, canceledAt, disputedAt, snapshotAt, updatedAt, livemode | by_ownerId_and_updatedAt, by_stripeSubscriptionId, by_stripeCustomerId | S2 |
| `membership_orders` | ownerId, term, priceKey (monthly, annual, lifetime_t1, lifetime_t2), status (pending, paid, expired, failed, refunded, disputed), idempotencyKey, stripeCheckoutSessionId, stripePaymentIntentId, seatNumber, presented amount and currency (reporting only), createdAt, updatedAt, livemode | by_ownerId_and_idempotencyKey, by_ownerId_and_status_and_createdAt, by_stripeCheckoutSessionId, by_stripePaymentIntentId | S2 |
| `plan_grants` | ownerId, kind (lifetime or comp), orderId, seatNumber, grantedAt, suspendedAt, revokedAt, revokeReason | by_ownerId, by_kind_and_seatNumber | S2 |
| `founding_seats` | seatNumber (1 to 50), status (free, reserved, taken), ownerId, orderId, reservedUntil, updatedAt | by_seatNumber, by_status_and_seatNumber | S2 |
| `billing_events` | stripeEventId, type, livemode, receivedAt, processedAt, outcome, errorCode (no payloads) | by_stripeEventId | S2 |
| `offer_cohorts` | cohort (buyers or newsletter), normalizedEmail, importedAt, batchId | by_normalizedEmail, by_cohort_and_normalizedEmail | S7 |
| `live_builds` | title, summary, startsAt, durationMin, status, joinUrl, replayUrl, createdAt, updatedAt | by_startsAt, by_status_and_startsAt | S8 |

Proposed env names (values never in git, final names set in S2 and S3): Convex typed env `MEMBERSHIP_BILLING_BRIDGE_SECRET` (optional). Next and Vercel: `MEMBERSHIP_BILLING_MODE`, `MEMBERSHIP_TAX_MODE`, `MEMBERSHIP_BILLING_APP_ORIGIN`, `MEMBERSHIP_BILLING_BRIDGE_SECRET`, `STRIPE_MEMBERSHIP_RESTRICTED_KEY`, `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_MONTHLY`, `STRIPE_MEMBERSHIP_PRICE_ANNUAL`, `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1`, `STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2`, `CRON_SECRET`. The existing `NEXT_PUBLIC_BUILDERS_HUB` flag stays.

## Open decisions (owner, accountant, Stripe)

Recommended defaults are mine. They are not rulings. Each needs a ruling in `docs/wp/RULINGS.md` before the story it blocks.

Ruled on 2026-10-09: O1 (Managed Payments, prices exclusive of tax), O2 (Rulz&Co; business form and postal address still to come), and through the Terms sign-off O3, O4, O9 and the O8 missed-month remedy. O5 was ruled the same day as recommended (S3, S4). Still open: O6, O7 and O8's operational details.

| ID | Question | Recommended default | Who decides | Blocks |
|---|---|---|---|---|
| O1 | Tax mechanism and price display. Stripe Managed Payments (merchant of record, +3.5%) or Stripe Tax with the owner's own registrations. Prices tax-inclusive or tax-exclusive | Ask Stripe in writing first. Managed Payments covers UK-based sellers, but its eligibility page limits it to a "fully automated digital product" and names live 1-to-1 coaching as ineligible. A monthly live group session may disqualify the plan. If Stripe says yes, use Managed Payments. If no, use Stripe Tax Basic, register for the EU non-Union One Stop Shop before the first EU consumer sale, and register for UK VAT at £90,000 turnover. Tax-exclusive with "plus tax where it applies" is simplest, but UK consumer rules favor showing the total price, and tax-inclusive pricing gives away about 15% to 21% of the headline price in VAT regions (20% UK VAT is 16.7% of a VAT-inclusive price). Decide with the accountant | Owner and accountant, after Stripe replies | S3, S6, S9, S10 |
| O2 | Seller identity: sole trader or limited company, registered address, VAT status, support email, statement descriptor | Owner supplies. Needed for Terms, invoices and the Stripe account | Owner | S9, S10 |
| O3 | What "lifetime" means, and what happens if Builder's Hub is discontinued | "For as long as Builder's Hub is offered. If we discontinue it we give at least 90 days' notice and refund founding members pro rata over three years." Lifetime deals have failed this way before (see evidence) | Owner and lawyer | S9, S12 |
| O4 | Renewals and refunds. Does the 30-day window apply to renewals? Under Managed Payments Stripe may also refund without approval if the owner does not answer a support request within 48 hours | Window covers first purchase only. Renewal reminder email sent at least 7 days ahead for annual plans. Goodwill refunds of a renewal within 7 days when the member has not used the product, owner's call | Owner | S5, S9 |
| O5 | A monthly or annual subscriber buys Founding Lifetime | Allow it. After the lifetime payment is verified, set the old subscription to cancel at period end. No refund of the current period. Say so before checkout | Owner | S3, S4 |
| O6 | The 24-hour quiet period would hide the offer from people who sign up because of a founding-offer email | Let an explicit invite link show the ladder on the Plan and billing page only. Never cards or tags. Amends PRD 6.6 | Owner | S6, S7 |
| O7 | Window lengths | Window 1: 3 days. Window 2: 3 days. Window 3: open until sold out. Window 1 may be empty | Owner at launch | S7, S12 |
| O8 | Live build operations: slot, length, tool, capacity, replay hosting, captions, and what happens if a month is missed | A fixed monthly slot, 90 minutes, announced 30 days ahead, live on Zoom, replay behind the member gate with captions. If a month is missed, run a make-up session or extend every member by one month | Owner | S8, S9 |
| O9 | Failed payments, disputes and partial refunds | Access continues while Stripe retries (8 tries over 2 weeks). Access ends on unpaid or canceled. A dispute opened suspends access. Won restores. Lost revokes and blocks new checkouts until the owner clears the account. A partial refund changes nothing | Owner | S4, S5 |

## Stories

- [x] `WP64-S0` - Record decisions, reserve the package and freeze the contract (docs only)
  - Scope: `docs/wp/RULINGS.md` (append only), `docs/PROJECT_STRATEGY.md` (one registry row), `docs/wp/wp64-stories.md`, `docs/wp/wp64-progress.md`, `docs/wp/evidence/wp64-pricing-and-billing-research.md`.
  - Acceptance criteria:
    - Six rulings appended without editing an earlier row: numbering, price ladder, bundle, offer order, refunds, seller location.
    - The registry row exists before any code.
    - Open decisions O1 to O9 are listed with a recommended default, a decider and the story each one blocks.
    - Every fact in the evidence file is labelled primary (read from the source on 2026-10-04) or secondary (a search summary), and unverified items are listed.
  - Verification: `git diff --check`, ruling rows have five cells, referenced paths exist.
  - Result: done on 2026-10-04. O1 to O9 stay open.

- [ ] `WP64-S1` - Isolate the live ship·able path and close its public write hole
  - Scope: `app/api/stripe-webhook/route.ts`, `convex/payments.ts`, optionally `convex/subscriptions.ts`, tests under `tests/security/**` and `convex/**`. No change to ship·able or DARE copy, prices or links. This is the only story allowed to edit those files.
  - Acceptance criteria:
    - Inventory every Stripe checkout in the repo first (the ship·able Payment Link, DARE, anything API-created). The guard must not break any live flow.
    - The legacy handler acts only on a `checkout.session.completed` whose `payment_link` is a string and whose metadata has no `purpose`. Any other session gets a 200 with no Convex write and no Beehiiv enrollment. Regression tests cover a membership-shaped session, a credit-pack session and the ship·able fixture, which still enrolls exactly once.
    - `payments.recordEvent` is currently a public `mutation`, so any visitor can insert `stripe_events` rows. Close it with the expand, switch, contract order: add an internal mutation and a signed-bridge action (new secret, optional typed env), switch the route, deploy, then remove the public mutation in a later deploy. The live webhook never breaks mid-rollout.
    - Optional, owner's call: `convex/subscriptions.ts` `record` is also a public mutation (the email-list log). Same fix, or track it separately. Neither table is ever used for eligibility or entitlement (static test).
    - A re-run of the $9 ship·able purchase in Stripe test mode passes. A live smoke is owner-run, refunded, and never done without the owner's go-ahead.
  - Verification: `npm run typecheck`, `npm test`, new security tests that fail on the old code and pass now, mutation-test the suites (break on purpose, confirm red).
  - Status 2026-10-08: the code and tests are written on the branch. Nothing is merged or deployed. Still open before this box can be ticked: (a) the switch step, where the operator sets `LEGACY_PAYMENTS_BRIDGE_SECRET` in Convex and then in Vercel. (b) The contract step, a later deploy that deletes `payments.recordEvent` and the route's fallback, and updates the "exactly one caller" static test. (c) The owner's call on `subscriptions.record`. (d) The owner-run test-mode purchase and the live smoke. Inventory result: the only Stripe code paths are this handler and the WP24 checkout and webhook. ship·able seat sales were paused on 2026-10-05 (PR #113), so no page links the Payment Link now, but the link may still be live in Stripe. Files added: `app/api/stripe-webhook/_guard.ts`, `lib/legacy-payments-bridge.ts`, `convex/paymentsBridge.ts`, three test files and one Convex test. Also touched: `.env.example`, `convex/convex.config.ts`, `package.json` (`test:security`) and, by hand, `convex/_generated/api.d.ts` and `server.d.ts`, because codegen needs a Convex login. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S2` - Plan model, subscription and grant tables, entitlement resolver (additive, one schema writer)
  - Scope: `convex/schema.ts` (the six S2 tables in the data contract), `convex/platform/plans.ts`, `convex/platform/planResolver.ts`, `convex/platform/entitlements.ts`, new `convex/platform/membership/**` (queries and internal mutations), `convex/convex.config.ts` (optional env only), tests.
  - Acceptance criteria:
    - Tables and indexes match the data contract. No index added to an existing table. No unbounded array fields. Counts come from bounded reads of `founding_seats` (at most 50 rows), never `.collect().length`.
    - `resolvePlan` returns `builders_hub` for an owner with an unrevoked, unsuspended grant, or a subscription whose stored status is `active` or `past_due` (O9). Everything else is `free`. No clock read in the resolver.
    - `PRICING` holds the ladder in minor units and the seat tranches. UI strings derive from it. `PLANS.builders_hub.priceLabel`, `UPGRADE_LABEL` and the comparison rows move to the ladder in S6, not here.
    - `entitlements.mine` also returns a billing summary: term (monthly, annual, lifetime, comp or null), status, renewal or cancel date, founding seat number. No Stripe ids reach the client.
    - No public function writes any of these tables. Every write is internal, reached through the signed bridge (S4) or an operator run. A static test asserts it (the `api` proxy is empty in tests, so assert on source).
    - New typed env is `v.optional`. A deploy with none set boots and every membership function fails closed.
  - Verification: Convex tests for the resolver matrix (free, active monthly, annual, past_due, canceled, unpaid, lifetime, suspended, revoked, comp), two-user isolation, schema additive diff, `npx convex codegen --typecheck disable`, `npm run typecheck`.
  - Status 2026-10-08: built on the branch, not merged or deployed. Files: `convex/platform/membership/validators.ts`, `state.ts` (read-only: `readMembershipState`, `deriveMembership`, `countSeats`, the billing summary), `seats.ts` (operator seed, dry run by default) and `comp.ts` (operator comp grant and revoke). Edited: `convex/schema.ts` (six tables appended), `plans.ts` (`PRICING`, with today's monthly label derived from it, unchanged), `planResolver.ts`, `entitlements.ts`. No typed env was added, because nothing in S2 reads one. S4 adds `MEMBERSHIP_BILLING_BRIDGE_SECRET`. Codegen still needs a Convex login, so `api.d.ts` was edited by hand again. Handed on: the resolver honors stored rows of either mode, so mode separation happens at write time. S4 rejects a mismatched event, and S3 must also refuse `MEMBERSHIP_BILLING_MODE=test` on a production deployment, so a test-card purchase can never land in production data. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S3` - Create secure Checkout Sessions for monthly, annual and lifetime
  - Scope: `app/api/platform/membership/checkout/route.ts`, `app/api/platform/membership/_server.ts`, `convex/platform/membership/checkout.ts`, tests.
  - Acceptance criteria:
    - The body is exactly `{ term, idempotencyKey }`. Unknown keys are rejected. The owner comes from the Convex Auth token, and the account must have a verified email.
    - `MEMBERSHIP_BILLING_MODE` unset or `off` returns 503. `test` accepts only test keys and `live` only live keys. A production deployment refuses `test` (added in S2: the resolver trusts stored rows of either mode). Config validates the four Price IDs, and before each session the server reads the Price from Stripe (cached briefly) and refuses on any mismatch with `PRICING` in amount, currency or interval.
    - Monthly and annual create `mode: "subscription"`. Lifetime creates `mode: "payment"`. Metadata carries `purpose`, `order_id` and `term` on the session and on the subscription or payment intent. `client_reference_id` is the opaque order id.
    - Checkout requires terms acceptance with custom text that states price, renewal and the 30-day refund in one sentence and links S9's pages. Billing address is required. Promotion codes are off. Success and cancel URLs are allowlisted same-origin routes. Lifetime sessions expire after 30 minutes.
    - Tax follows O1 behind `MEMBERSHIP_TAX_MODE` (`managed_payments[enabled]=true` or `automatic_tax[enabled]=true`, never both). The Stripe API version is pinned explicitly (Managed Payments needs `2025-03-31.basil` or later) and the pin is covered by a test.
    - Changed by O1 (ruled 2026-10-09, Managed Payments; checked in the sandbox, see `docs/wp/evidence/wp64-stripe-setup.md` section 1b): Stripe rejects `custom_text` on a Managed Payments session, so the price, renewal and refund sentence (`checkoutConsentMessage`) shows beside our buy button, and `consent_collection.terms_of_service: "required"` collects consent on Stripe's page once the Terms URL is in public details. Stripe collects the billing address itself, so S3 does not set `billing_address_collection`. S3 sends `managed_payments[enabled]=true` and none of Stripe's unsupported parameters (`automatic_tax`, `tax_id_collection`, `payment_method_types`, `payment_method_configuration`, `customer_update`, `subscription_data.invoice_settings`, `invoice_creation`, `adaptive_pricing`, statement descriptors). The price check is `reviewPrice` in `lib/membership/stripe-catalog.ts`, which also blocks a tax-inclusive price.
    - One active subscription or active grant per owner. A second subscription is refused. Lifetime while subscribed follows O5. An account flagged for review (O9) is refused.
    - A lifetime request reserves the lowest free seat in one mutation, fixes its tranche price, allows one open reservation per owner and returns `SOLD_OUT` when no seat is free. Reservations expire with the session. Requests are rate limited with `@convex-dev/rate-limiter` (already mounted).
    - Calls are idempotent: the same key returns the same order and session, and Stripe gets `membership-checkout:{orderId}` as its idempotency key. Errors are generic and carry no secret or PII.
  - Verification: forged input, two users, idempotency, config modes, price mismatch, sold out, reservation expiry, last-seat race (structural test: one mutation reads and writes the seat rows, since `convex-test` runs sequentially, see ruling 2026-08-07), static checks (`mode` strings, no `charges.create`, no `client_secret`).
  - Status 2026-10-09: built on the branch, dormant, not merged. Route `app/api/platform/membership/checkout/route.ts`, helpers `_server.ts`, signed bridge `lib/membership-bridge.ts` and `convex/platform/membership/provider.ts`, orders and seat holds in `convex/platform/membership/checkout.ts`, new optional Convex env `MEMBERSHIP_BILLING_BRIDGE_SECRET`. The owner comes from the member's forwarded auth, never from input. Seats are held 35 minutes and the lifetime session closes 4 minutes sooner. A new attempt expires the member's other open sessions. The exact session parameters were accepted by the Stripe sandbox. Stripe Tax stays available behind `MEMBERSHIP_TAX_MODE=automatic_tax` in case Managed Payments rules the plan out. Not built: an O5 notice, because no surface offers lifetime to a subscriber yet. Update 2026-10-09: Plan and billing now offers lifetime to active monthly and annual members with the O5 notice (see S6). Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S4` - Process webhooks exactly once and reconcile daily
  - Scope: `app/api/platform/membership/webhook/route.ts`, `app/api/platform/membership/reconcile/route.ts`, `convex/platform/membership/provider.ts` (`"use node"`, bridge action only), `convex/platform/membership/events.ts` (internal mutations), `vercel.json` (cron entry only), `.agentic-workflow.yml` (critical flows), tests.
  - Acceptance criteria:
    - The raw body is verified with `STRIPE_MEMBERSHIP_WEBHOOK_SECRET` before parsing. Missing or invalid signatures return 400 with no state change. An event whose `livemode` does not match the key mode is rejected.
    - Handled events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`. Everything else, and anything with a foreign purpose or unknown customer, gets a 200 with no state change.
    - For subscription events the route fetches the current subscription and sends a normalized snapshot over the bridge. The route and the snapshot handle the field moves between Stripe API versions (period end now lives on the subscription item, and the invoice to subscription link moved). Verify against the pinned SDK in test mode.
    - Settlement is idempotent by event id, monotonic by snapshot time, and order independent: `checkout.session.completed` before or after `customer.subscription.created` converges to one state.
    - Lifetime payment: verify mode, paid status, Price ID and quantity against the order. Grant exactly one `plan_grants` row, mark the seat `taken`. If the reservation was released and the seat is gone, refund fully through the API and grant nothing. Duplicates and replays change nothing.
    - Refund: full refund of a lifetime payment revokes the grant and frees the seat. Full refund of a subscription charge cancels the subscription through the API. Partial refund changes nothing and is logged.
    - Dispute (O9): created suspends access, closed in our favor restores it, closed against us revokes it and flags the owner for review.
    - Failure semantics: invalid requests get 400. Transient failures get 500 so Stripe retries. A required mutation that failed is never acknowledged with 200.
    - Reconcile: a Vercel cron (production only, sends the `CRON_SECRET` bearer header) calls the reconcile route daily. The route compares Stripe's active and past_due subscriptions with ours, pushes snapshots for any difference, and frees expired reservations. It is bounded, idempotent and safe to run twice. If Vercel cron is unavailable, a Convex cron with a read-only Stripe key is the fallback and needs its own ruling.
    - An operator-only internal query reports counts: events by outcome, subscriptions by status, seats by status. No emails.
    - `.agentic-workflow.yml` gains the critical flows `membership_checkout_webhook_entitlement_exactly_once` and `founding_seat_cap_never_exceeded`.
  - Verification: signature, replay, out-of-order, duplicate, foreign purpose, mode mismatch, stale snapshot, full and partial refund, dispute created, won and lost, reservation expiry, payment after expiry, transient failure. Stripe CLI forwarding in test mode.
  - Status 2026-10-09: built on the branch, not merged. Routes `app/api/platform/membership/webhook/route.ts` and `reconcile/route.ts`, Stripe reads and follow-ups in `_events.ts`, settlement in `convex/platform/membership/events.ts` (internal only), four server-only bridge kinds stamped with `issuedAt` (refused after five minutes), and a daily cron at 04:17 UTC in `vercel.json`. The webhook runs whatever `MEMBERSHIP_BILLING_MODE` says, including `off` (contract 11). The key prefix sets its mode, and a production deploy refuses a test key. No schema change: the reconcile query reads the newest 1,000 subscription rows instead of adding an index to the frozen table. Added beyond the criteria: a payment from a Stripe customer linked to another member fails its order (refund or cancel), a member never holds two seats, a dispute that is still open also blocks new checkouts, and `events:clearReview` lets the operator clear the O9 flag. Not done: the Stripe CLI run in test mode (owner, `docs/wp/evidence/wp64-stripe-setup.md` step 2) and confirming refunds through the API under Managed Payments. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S5` - Customer self-service and payment-failure behavior
  - Scope: `app/api/platform/membership/portal/route.ts`, Stripe dashboard configuration (documented in S10), `convex/platform/membership/queries.ts`, tests.
  - Acceptance criteria:
    - A Billing Portal session is created only for the signed-in owner's own Stripe customer, returns only Stripe's URL, and returns to a same-origin route. The portal allows cancel at period end, payment-method update, invoice history and a monthly to annual switch. No pause.
    - If O1 chooses Managed Payments, confirm in test mode how the Customer Portal and Link's order management coexist. Record the result. If the portal cannot manage a Managed Payments subscription, the billing page links to Link's order management instead.
    - Failed payment: Smart Retries and dunning emails on. Access continues while `past_due` (O9). Access ends on the unpaid or canceled event. The billing page shows a plain "Update your payment method" notice to that member only.
    - Cancel at period end keeps access to the end date, and the page states the date.
    - Plan switch rules are written down: monthly to annual immediate with proration, annual to monthly at renewal. Upcoming-renewal emails are on.
  - Verification: route tests (auth, ownership, no foreign customer), test-clock journeys in S11.
  - Status 2026-10-09: built on the branch, dormant, not merged. Route `app/api/platform/membership/portal/route.ts` takes `{}` and nothing else. Convex (`convex/platform/membership/portal.ts`, internal, through the signed bridge with the member's auth) picks the customer on the member's newest subscription in this mode, refuses one linked to anyone else, and rate limits each member (5 a minute, 30 an hour). The route passes no configuration, so the account's default portal configuration applies, and it returns to `/dashboard/billing` on our origin. Members without a subscription (Free, comp, Founding Lifetime) get `INVALID_REQUEST`, and the page never offers them the button. The S6 billing page already shows the past-due notice, the unpaid notice and the cancel date; S5 adds tests that run a Stripe snapshot through settlement to that summary. Plan switch rules: monthly to annual at once with proration, annual to monthly at renewal (`docs/wp/evidence/wp64-stripe-setup.md`, Customer Portal). Managed Payments: Stripe's docs say the portal and Link's order page coexist, and both reach us through the same webhook, so no Link link was added. Not done: the test-clock journeys (S11) and the Dashboard emails and retries (owner, evidence steps 3 and 4). The Terms say nothing about switching plans. Update 2026-10-09: the route also takes `{ switchTo: "monthly" | "annual" }`. Convex returns the member's newest subscription id with the customer. The route checks the Price against the catalog, reads the subscription, and opens Stripe's `subscription_update_confirm` page for that one item at our configured Price, returning to Plan and billing. It refuses a subscription that is another customer's, not ours, in the other mode, or not one seat. A subscription that is not active, already ends, already has a switch scheduled, or is not on the other term opens the portal home instead. The portal configuration still decides the timing. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S6` - Dashboard surfaces: the ladder, the upgrade sheet, the plan card, the return state
  - Scope: `components/platform/billing/PlanAndBilling.tsx`, `components/platform/plan/**` (sheet, comparison, flag, `useUpsell`), `app/dashboard/billing/page.tsx`, `lib/track.ts` and its event types, tests.
  - Acceptance criteria:
    - With the flag on, Plan and billing shows the current plan (term, renewal or cancel date, founding number) and the ladder: monthly and annual side by side, and the lifetime card with the true seats remaining. Each option states price, billing period and renewal in plain words, for example "$199 billed once a year. Renews until you cancel." The 30-day refund line and links to the Terms and refund pages sit beside the buttons. Tax wording follows O1.
    - Annual is labelled with its real saving (43% below twelve months of monthly). No strike-through prices, no timers, no pre-checked boxes. Subscribers get "Manage billing" (S5).
    - The upgrade sheet's primary button starts checkout for the term chosen in the sheet. `UPGRADE_LABEL` and the comparison rows are updated. "Not now" and the free way forward stay.
    - Starting checkout posts only `{ term, idempotencyKey }` and redirects only to Stripe's returned URL. 503, sold-out and already-subscribed responses show plain messages with a retry.
    - `?checkout=return` shows "Confirming your payment" and subscribes to `entitlements.mine`. It flips when the server says so. After 90 seconds it says the payment may still be processing and a receipt will be emailed, and it still grants nothing from the URL. `?checkout=cancelled` says nothing was charged.
    - Free members keep the plan card. Builder's Hub members see their term and never see an upsell (FR-24).
    - Quiet period unchanged by default. Under O6, an explicit invite parameter shows the ladder on this page only, and is never used for eligibility.
    - Events: `upgrade_clicked` carries the term, `checkout_started` fires from the client, and paid outcomes (`checkout_completed`, `founding_seat_taken`) fire once per order only after `entitlements.mine` confirms. No email or free text in any event. Revenue reporting comes from Stripe, not GA.
    - WCAG 2.1 AA at 390 px and 1440 px: the term selector is a radio group, focus order is logical, seat-count changes are announced politely and rarely, contrast follows the WP42 tokens.
  - Verification: component tests, axe at both widths, keyboard-only journey, `npm run lint`.
  - Status 2026-10-08: built on the branch behind the flag, not merged. The route contract S3 and S5 must follow is `app/api/platform/membership/_contract.ts`. Until S3 ships, the buy button answers "Checkout isn’t open yet". Not built because their decisions are open: the O6 invite parameter, O1 tax wording (a neutral line stands in), O3 lifetime wording, and any O5 surface for subscribers. The Terms and refund links point at `/terms` and `/refund-policy`, which S9 must publish. Update 2026-10-09: "Change your plan" (`components/platform/billing/PlanChanges.tsx`) sits under the member's plan for active monthly and annual members: switch to the other term through Stripe's confirmation page, or buy Founding Lifetime with the seats left, the O5 notice and the fine print. It is plan management, so the first-day quiet period does not apply. Past due, ending-soon switches, Free, comp, lifetime and disputed accounts get no switch. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S7` - Founding offer: cohorts, windows and the seat counter
  - Scope: `convex/schema.ts` (`offer_cohorts`, in the S2 schema window), `convex/platform/membership/offer.ts`, `convex/platform/membership/cohorts.ts`, `lib/dashboard/offers.ts` (new `founding_lifetime` kind), the `offer` query in `convex/platform/dashboard.ts`, an operator import script, tests.
  - Acceptance criteria:
    - Windows are dated typed config. Eligibility is computed on the server from the signed-in user's verified, normalized email against `offer_cohorts`. That table is written only by an operator-run internal mutation. The import is dry-run by default, prints counts only, takes bounded batches, reads a local file that is never committed, and never writes emails to logs, docs or git. Use the same exact-target, backup and operator-instruction pattern as `scripts/editorial-submit-engine.mjs`.
    - `stripe_events` and `subscriptions` are never read for eligibility. Both are publicly writable today, so anyone could forge a "buyer". A test proves a forged row gains nothing.
    - Before a member's window opens, the checkout route refuses with `NOT_YET_ELIGIBLE` and the UI says when it opens. After window 3 every signed-in member qualifies until the seats are gone.
    - The seat counter shows the true remaining count from `founding_seats`. No timers, no low-stock wording that is not literally true, and the card retires when the seats are gone.
    - The offer card follows PRD 6.2 and 6.6: Home rail only, free members only, dismissible and remembered, never shown to Builder's Hub members, one card at a time. First-day behavior follows O6.
    - Smoke purchases made during S12 are refunded and their grants revoked before window 1 opens, so the counter reads 50 of 50 at launch.
  - Verification: window matrix with a fixed clock passed in, empty-cohort test, forged-row test, sell-out test, dry-run import test.
  - Status 2026-10-09: built on the branch behind the flag, not merged. Windows live in `convex/platform/membership/windows.ts`, all closed (null) until the owner dates them (O7). S3 must call `assertFoundingEligible(ctx, user, Date.now())` before it reserves a seat, and answer `NOT_YET_ELIGIBLE` with `opensAt` as the route contract says. Not built: the O6 invite parameter (the card keeps the first-day quiet period). The owner still has to export the buyer and newsletter lists to a private file before S12. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S8` - Live builds hub (members only)
  - Scope: `convex/schema.ts` (`live_builds`, in the S2 schema window), `convex/platform/liveBuilds.ts`, `app/dashboard/live/**`, the dashboard nav, `convex/platform/plans.ts` (new gated feature `live_builds`), analytics types, an operator runbook.
  - Acceptance criteria:
    - Operator-only internal mutations create, update and cancel sessions. There is no admin UI in this package.
    - A member query returns `joinUrl` only to entitled members from 24 hours before the start until the end, and `replayUrl` only to entitled members after the session. Neither URL appears in static HTML, client bundles, analytics or logs. Free members see the schedule and titles, and clicking join or replay opens the upgrade sheet (point of intent).
    - Times show in the member's time zone with the zone named. The page is `noindex`, has no nested `main`, and has an empty state.
    - The first session is scheduled before window 1 opens. Replays carry captions or a transcript (O8). The Terms commitment from S9 is met by a make-up session or a one-month extension if a month is missed.
    - `PLANS` lists the live build only when this story ships (the "only what ships today" rule).
  - Verification: entitlement matrix (free, monthly, annual, lifetime, comp, revoked), a static test that fails if a join or replay URL reaches a client file, axe.
  - Status 2026-10-09: built on the branch behind the flag, not merged. Status is stored and flipped by scheduled mutations (scheduled, open 24 hours before the start, ended at the end), so the member query stays clock-free. Operator commands, link rules, the captions rule and the missed-month rule are in `docs/runbooks/wp64-live-builds.md`. Owner still to decide: O8 (slot, tool, replay hosting, captions), then schedule the first session before window 1 opens. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S9` - Terms, refund policy and privacy updates
  - Scope: public routes for the Terms and the refund policy, `app/(marketing)/privacy-policy`, the Checkout `custom_text` strings, sitemap and robots only if needed.
  - Acceptance criteria:
    - Plain-words pages cover: what Builder's Hub includes, including one live build a month and what happens if a month is missed (O8). Prices, billing and renewal. Cancellation at period end. The 30-day full refund (O4 for renewals). Statutory rights and the digital-content acknowledgment. The lifetime definition and the discontinuation clause (O3). Fair use. Disputes. Seller identity (O2). The tax statement that matches O1. Contact details.
    - The privacy policy names Stripe (and Link if Managed Payments is used) as processors, lists what we store (Stripe customer id, subscription status, grants, cohort email hashes or emails per S7) and what we do not (card data).
    - The pages say they are drafts until the owner and a lawyer or accountant of the owner's choosing have reviewed them. S12 does not pass without that review. This is not legal advice.
    - The Checkout consent sentence links these pages and states price, renewal and refund.
  - Verification: copy review by the owner, link check, axe, canonical SEO checks unchanged.
  - Status update 2026-10-09 (later): the owner signed the text off without a separate lawyer review (ruling "WP64 / Terms sign-off"), accepting the written defaults for O3, O4, O9 and the O8 missed-month remedy. O1 (Managed Payments) and O2 (Rulz&Co) are in the text: Link is named as merchant of record and the support email is filled in. Two O2 facts remain, the business form and a postal address for legal notices. Once they are in, `MEMBERSHIP_LEGAL_APPROVED` turns on and the pages go live.
  - Status 2026-10-09: built on the branch, not merged. Text is data in `lib/legal/content.ts`, with prices and features from `PRICING` and `PLANS`. Open decisions carry their recommended default and a review note. Facts only the owner can supply are highlighted gaps. One switch, `MEMBERSHIP_LEGAL_APPROVED` in `lib/legal/status.ts`, is off: `/terms`, `/refund-policy` and the privacy section show in local development only, and a production build returns 404 with no draft metadata. A test refuses approval while any review note or gap remains. The sitemap and footer list the pages once approved. The S3 consent sentence is `checkoutConsentMessage` in `app/api/platform/membership/_consent.ts`. Still needed before S12: O2 facts, O1, O3, O4, O8 and O9 (or the defaults), and review by the owner and a lawyer or accountant. Details in `docs/wp/wp64-progress.md`.

- [ ] `WP64-S10` - Configure Stripe and the tax path (test mode first)
  - Scope: Stripe dashboard state, documented without secrets in `docs/wp/evidence/wp64-stripe-setup.md`. Env-name docs.
  - Acceptance criteria:
    - O1 and O2 are ruled. For Managed Payments: the account is activated, the terms accepted, Stripe's written answer about the live build is captured without personal data, products carry an eligible tax code (candidates read from Stripe's list on 2026-10-04: `txcd_10000000` General electronically supplied services, `txcd_10103000` SaaS personal use, `txcd_10103001` SaaS business use), and the API version is pinned. For Stripe Tax: origin address in the UK, registrations as the accountant advises, tax codes per product, and invoice settings with the VAT number if registered.
    - Test-mode objects: Builder's Hub subscription product with monthly and annual prices, a Founding Lifetime product with the two one-time prices (one product with four prices is acceptable if reporting stays clear), a restricted API key with the minimum permissions, Smart Retries and dunning on, renewal and failed-payment emails on, branding, support email, statement descriptor, public business details, Terms and Privacy URLs.
    - A test-mode webhook reaches a local server through the Stripe CLI. Vercel previews are off for `claude/*`, `codex/*` and `cursor/*` branches (`vercel.json`), so do not rely on them.
    - No live object is created in this story.
  - Verification: dated checklist, env-name inventory (names only), a secret-pattern scan of the diff.
  - Status update 2026-10-09 (later): O1 and O2 are ruled. The sandbox products carry tax code `txcd_10103000` and the prices are tax-exclusive, and a Managed Payments Checkout Session was created there. Left: the owner's Dashboard steps (restricted key, revenue recovery, branding, public details with the Terms URL, Managed Payments activation on the live account) and the Stripe CLI webhook check after S4.
  - Status 2026-10-09: in progress. Through the Stripe connector, the WeekendMVP sandbox (test mode) now holds the two products, the four prices (checked against `PRICING`) and the Customer Portal configuration. Nothing exists in the live account. The catalog, the env names, the webhook event list and the pinned API version live in `lib/membership/stripe-catalog.ts`. `npm run membership:stripe-setup` checks or fills a test account from it and refuses live keys. Still the owner's: the restricted key, revenue recovery and customer emails, branding, O2 public details, and the O1 tax path. The Stripe CLI webhook check waits for S4's route. Checklist and ids in `docs/wp/evidence/wp64-stripe-setup.md`.

- [ ] `WP64-S11` - Test-mode gate
  - Scope: tests, evidence, independent review.
  - Acceptance criteria:
    - With the flag on locally and Stripe in test mode: free to monthly, free to annual, free to lifetime, cancel at period end, renewal through a test clock, payment failure then recovery, payment failure then loss of access, full refund, partial refund, dispute created, won and lost, sold out, reservation expiry, payment after expiry, window gating, live-build gating, monthly to lifetime upgrade (O5).
    - Replays, duplicates, delays, out-of-order events and forged signatures all converge or fail safely. Every accepted event and business key produces at most one transition.
    - Dormancy proof: a build with none of the new env vars set boots Convex, serves every existing route unchanged, returns 503 from every membership route, and shows no Builder's Hub UI.
    - Static suites are mutation-tested: break the code on purpose and confirm red.
    - An independent high-risk reviewer reports no unresolved critical or high finding in authorization, server-owned pricing, exact-once settlement, seat inventory, replay and order handling, refund and dispute policy, secret handling, legacy separation and dormancy.
    - Evidence confirms test mode only: no live key, object, charge, webhook, env change, deploy or production data write.
  - Verification: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, secret-pattern scan, axe at 390 px and 1440 px.
  - Status 2026-10-09: runbook ready, not run. `docs/runbooks/wp64-test-mode-gate.md` covers setup, test members, cards and clocks, and journeys C1 to C20 (every criterion above, plus the portal switch, replays, a forged signature and checkout switched off). Results go in `docs/wp/evidence/wp64-test-mode-gate.md`. The owner runs the journeys locally against the sandbox. Claude runs the automated checks, the dormancy proof and the independent review.
  - Status 2026-10-09, later: Claude's part done. Suite, secret scan, axe (28 runs, 0 violations) and the dormancy proof pass. The independent review found no critical issue, one high (a replaced Price froze stored subscriptions) and four medium (no refund for a rejected subscription, a prerendered reconcile route, one failing follow-up blocking the rest, a lapsed seat moving before a delayed webhook). All five are fixed and re-checked, with lows 6, 7 and 9. Lows 8, 10, 11 and 12 are accepted and recorded, and 13 and 14 (WP24 and legacy code) are separate tasks. The restricted key now also needs Subscription schedules: Write. Still open: the owner's journeys C1 to C20.

- [ ] `WP64-S12` - Live activation, launch order and review (owner-approved)
  - Scope: `docs/wp/wp64-go-live.md` (written in this story), Vercel and Convex environments, Stripe live objects, the flag.
  - Acceptance criteria:
    - Preconditions are recorded: S1 to S11 done, O1 to O9 ruled, Terms live and reviewed, the first live build scheduled, a backup marker and inventory for the seat seed and cohort import (the only production data writes beyond additive tables), and the owner's approval as a ruling.
    - Order of steps (S7 tooling: `npm run membership:import-cohorts` for step 5, `membership/cohorts:launchCheck` to confirm 50 free seats and dated windows in order): (1) merge with everything dormant, let the production build deploy Convex, verify the new tables exist and nothing is reachable. (2) Set the live env values (names only in docs). (3) Create live Stripe objects and register the live webhook. (4) The owner buys monthly with a real card, checks the entitlement, refunds within minutes and checks the revoke. Repeat for annual. Buy one founding seat, check grant and seat, refund, check the seat is free again. (5) Seed the 50 seats. Import cohorts (dry run, then apply). (6) Set the windows. (7) Turn `NEXT_PUBLIC_BUILDERS_HUB` on and rebuild, because it is inlined at build time. (8) Window 1 opens. (9) Watch webhook failures, refunds and disputes.
    - Rollback: set `MEMBERSHIP_BILLING_MODE=off` (checkout and portal return 503, the webhook keeps processing), turn the flag off and rebuild. Never delete tables. Refunds happen in Stripe.
    - Reviews at day 14, 30 and 60 from the day window 3 opens. Suggested triggers, owner may change them: refund rate above 10% of purchases in 30 days means review the promise and copy. Fewer than 30% of started checkouts completing means review checkout friction (tax display, consent text, price display). Tranche 1 not sold in 21 days means do not discount, extend the windows and review the offer. Monthly churn above 15% after day 60 means push annual and review live-build attendance. Any change to a price or term needs a ruling.
    - Coordination: do not merge during an E7 GO step. One writer for the schema, middleware, webhooks and generated files at a time. Never run `convex deploy --prod` by hand: this checkout's `--prod` targets a different, paused project (see the handoff). Use the Vercel production build path.
  - Verification: a dated, signed checklist in `docs/wp/wp64-progress.md` with redacted evidence.

## Sequencing

```text
S0 done
S1 (legacy isolation)  ->  S3 and S4 may not start live work before S1 lands
S2 (schema, resolver)  ->  S3, S4, S6, S7, S8
S3 -> S4 -> S5
S9 (Terms)  feeds the S3 consent text and S12
S10 (Stripe setup) runs beside S3 to S5, needs O1 and O2
S6, S7, S8 after S2. S8 and S9 touch no serialized seam and may run in parallel.
S11 needs S1 to S9.  S12 needs S10, S11 and the owner's approval.
```

Default is one agent. Parallel work only for S8 and S9. Schema, middleware, webhooks, lockfiles and generated Convex files stay one writer at a time.

## File Boundaries

The worker may add `convex/platform/membership/**`, `app/api/platform/membership/**`, `app/dashboard/live/**`, the public Terms and refund routes, tests, evidence docs and `docs/wp/wp64-progress.md`. It may edit `convex/schema.ts` (additive, one writer window), `convex/convex.config.ts` (optional env), `convex/platform/plans.ts`, `planResolver.ts`, `entitlements.ts`, `convex/platform/dashboard.ts` (offer query), `lib/dashboard/offers.ts`, `lib/track.ts`, `components/platform/billing/**`, `components/platform/plan/**`, the dashboard nav, `app/dashboard/billing/page.tsx`, `app/(marketing)/privacy-policy`, `vercel.json` (cron entry only), `.agentic-workflow.yml` (critical flows) and generated Convex types when required.

It may edit `app/api/stripe-webhook/route.ts`, `convex/payments.ts` and `convex/subscriptions.ts` only in S1.

It must not edit ship·able or DARE marketing pages and checkout links, `convex/platform/billing/**` or `app/api/platform/billing/**` (WP24), their tests, `middleware.ts`, `scripts/vercel-build.mjs`, editorial or engine code, or any production environment.

## Stop Conditions

- Stop if Stripe says the live build disqualifies Managed Payments and O1 is not re-ruled.
- Stop if a change beyond additive tables is needed in `convex/schema.ts`.
- Stop before creating or changing any live Stripe object, live key, live webhook, env value, charge or refund, production data write (seat seed, cohort import), or the flag.
- Stop if exact-once behavior cannot be proven under replayed, delayed and out-of-order events. Do not weaken the criteria.
- Stop if a merge would put billing code in reach without the mode switch.
- Stop if an E7 GO step is in flight.

## Out Of Scope

Credit packs (R9). Site publishing, hosting and own-idea Validation Reports (v1.1, priced separately later). Teams and seats. Promo codes, coupons and trials. Usage billing. A public pricing page. Embedded Checkout. Affiliates. Refund or dispute tooling beyond the policy above. Launch email copy and the wider upselling strategy (separate work). Account merging for a member who signs in with two emails: entitlement belongs to the account that paid, and support can issue a comp grant.

## Findings from planning (not caused by WP64)

- `convex/payments.ts` `recordEvent` is a public `mutation`. Anyone with the Convex URL can insert `stripe_events` rows. Handled in S1.
- `convex/subscriptions.ts` `record` is a public `mutation`. Anyone can insert email-list rows, which can fake the "kit claimed" state that hides the free-kit card. Low impact. Optional in S1.
- The production build deploys the live Convex backend before Next (`scripts/vercel-build.mjs`). Anything merged to `main` that touches `convex/` reaches the live backend. This shapes the dormant-by-default rule.
- The first-24-hours quiet period (PRD 6.6) would hide the offer from people who sign up because of an offer email. See O6.
- Stripe's Managed Payments eligibility rule on human involvement may conflict with the live build. See O1.

## Changes on main since planning (checked 2026-10-07 at `b61652e`)

- **WP57 gates the idea library behind a verified account** (ruling 2026-10-06). Anonymous visitors get teasers. Research is still free on every plan, but it now needs a free account. Builder's Hub never paywalls research, and the plan copy should say "never paywalled".
- **WP57 syncs each newly verified account to Beehiiv** (new table `account_beehiiv_sync`). Members will arrive faster than the "zero members" input assumed, and offer windows 2 and 3 will overlap more. An empty window 1 cohort is still possible. Re-check the audience before S12. The O6 quiet-period question matters more.
- **Seams are busy.** WP56 to WP61 touched `convex/schema.ts`, `convex/convex.config.ts`, `middleware.ts` and `scripts/vercel-build.mjs`. Before S2, confirm no other package holds the schema writer slot.
- **Dormant by default still holds.** The production build still runs `convex deploy`, then a slug check, then `next build`. New Convex env on `main` is optional, which is the pattern S2 follows.
- **S1 is unchanged.** `payments.recordEvent` and `subscriptions.record` are still public mutations on `main`.

## Docs to update when built

`docs/wp/wp44-dashboard-prd.md` sections 6.5 and 9.4 (pointer to the ladder), the `PLANS` and `PRICING` comments in `convex/platform/plans.ts`, `.agentic-workflow.yml` critical flows, the env lists in `docs/runbooks/2026-cutover.md`, `docs/wp/wp64-progress.md` after every story, and `docs/wp/AGENT_HANDOFF.md` (owner-managed). If a doc needs no change, say why in the progress log.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`. Do not reinterpret an open decision to close a gate.
- Treat `wp64-progress.md` as claims, not evidence. Verify before relying on a number.
- Never print or commit a secret. Convex environment listing returns raw values, so do not paste its output anywhere.
