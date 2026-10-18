# Live Build-Along — Stripe objects to create

Checkout is purpose-separated from ship·able Payment Links, Builder's Hub
membership, and platform credit packs. Do **not** reuse the parked claim-to-pay
Payment Link or the legacy `/api/stripe-webhook` handler for these tickets.

Buyers must be signed in (magic-link / Google). Guest checkout is not offered.

**Purpose metadata (required on product + every Checkout Session + PaymentIntent):**
`purpose=weekendmvp_workshop_v1`

**Seller / MoR:** Rulz&Co (confirmed). Checkout uses Stripe Payments (not Managed
Payments) with `automatic_tax`, required billing address, tax-inclusive prices,
and `payment_method_types: ["card"]`. Checkout copy:
`No VAT added: Rulz&Co is not VAT-registered.`

## Product

| Field | Value |
|-------|--------|
| Name | Weekend MVP Build-Along: Sat 14 Nov 2026, 15:00 GMT |
| Description | Build it Saturday, ship it Sunday. 2 hours live on Zoom. Ship Sheet, prompts and the replay (no expiry) included. |
| Metadata | `purpose=weekendmvp_workshop_v1` |
| Tax code | `txcd_20060045` (digitally delivered education / training materials) |

## Prices (one-time, USD, tax_behavior=inclusive)

| Price | Amount | Lookup key | Env override (optional) | Active when |
|-------|--------|------------|-------------------------|-------------|
| Early-bird | $19.00 | `weekendmvp_buildalong_20261114_early` | `STRIPE_LIVE_WORKSHOP_PRICE_EARLY` | through **23:59:59 GMT Sun 8 Nov 2026** inclusive |
| Regular | $29.00 | `weekendmvp_buildalong_20261114_regular` | `STRIPE_LIVE_WORKSHOP_PRICE_STANDARD` | from that moment |
| Next session (optional, gated off in UI) | $29.00 | `weekendmvp_buildalong_20261205_regular` | `STRIPE_LIVE_WORKSHOP_PRICE_DEC5` | only once `NEXT_SESSION_CHECKOUT_ENABLED` is turned on |

The app picks early vs regular server-side from `EARLY_BIRD_ENDS_AT` in
`lib/live/config.ts` (lookup key first; env price id is an optional override).
One buy button — never two price links.

**Shared 20-seat cap:** both 14 Nov prices draw from `workshop_seats` (20 rows,
event key `build-along-2026-11-14`). Reserve holds a seat for 35 minutes and
**renews** that hold on checkout retry so `expires_at` stays ~31 minutes out
(Stripe rejects sessions under 30 minutes). Webhook
`checkout.session.completed` / `async_payment_succeeded` takes the seat only
when `payment_status === "paid"`; `checkout.session.expired` /
`async_payment_failed` or a **full** `charge.refunded` frees it. Daily
reconcile sweeps lapsed holds.

## Stripe Tax

| Setting | Value |
|---------|--------|
| Product tax code | `txcd_20060045` |
| Price tax behavior | `inclusive` (both early and regular) |
| Checkout | `automatic_tax: { enabled: true }`, `billing_address_collection: "required"` |
| Origin address | Set the business origin on the Stripe account (Rulz&Co) in Tax settings |
| Registrations | None for now — seller is not VAT-registered; checkout copy states no VAT is added |
| Tax inclusive | Prices already include any applicable tax Stripe calculates |

Dashboard: **Tax → Settings** — confirm origin address, leave registrations empty
until Platform says otherwise, keep inclusive pricing.

## Restricted key permissions

Create a restricted key named `weekendmvp-live-workshop`
(`STRIPE_LIVE_WORKSHOP_RESTRICTED_KEY`). Grant only:

| Resource | Access | Why |
|----------|--------|-----|
| Checkout Sessions | Write | Create + retrieve sessions (with line items) |
| Customers | Write | Checkout `customer_creation` / email attach |
| Prices | Read | Resolve lookup keys / optional env overrides |
| Products | Read | Price checks with product expanded |
| PaymentIntents | Read | Refund purpose check via PI metadata |
| Charges | Read | Full-refund webhook path |
| Tax Rates | Read | `automatic_tax` calculation |

Do **not** grant Refunds: Write, Subscriptions, or Billing Portal on this key.

## Webhook

| Field | Value |
|-------|--------|
| URL | `https://<host>/api/live/webhook` |
| Events | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded` |
| Secret env | `STRIPE_LIVE_WORKSHOP_WEBHOOK_SECRET` (`whsec_…`) |

**Refund policy in code:** free the seat only when `charge.refunded === true`
(full refund) **and** purpose resolves to `weekendmvp_workshop_v1` (charge
metadata, payment intent metadata, or linked Checkout Session). Partial
refunds are ignored. If the Stripe lookup needed to resolve purpose fails,
the webhook returns **HTTP 500** so Stripe retries — never `"Ignored"`.

**Disputes:** `charge.dispute.*` is **not** handled automatically. Free the seat
manually in Convex / Dashboard until a dispute handler is implemented.

## API / billing env (Vercel + Convex)

| Env | Where | Notes |
|-----|--------|--------|
| `LIVE_WORKSHOP_BILLING_MODE` | Vercel | `test` \| `live` \| unset/off |
| `LIVE_WORKSHOP_BILLING_APP_ORIGIN` | Vercel | e.g. `https://weekendmvp.app` |
| `LIVE_WORKSHOP_BILLING_BRIDGE_SECRET` | Vercel **and** Convex | 32+ chars, same value |
| `STRIPE_LIVE_WORKSHOP_RESTRICTED_KEY` | Vercel | `rk_test_…` / `rk_live_…` |
| `STRIPE_LIVE_WORKSHOP_WEBHOOK_SECRET` | Vercel | `whsec_…` |
| `STRIPE_LIVE_WORKSHOP_PRICE_EARLY` | Vercel | optional `price_…` override |
| `STRIPE_LIVE_WORKSHOP_PRICE_STANDARD` | Vercel | optional `price_…` override |
| `STRIPE_LIVE_WORKSHOP_PRICE_DEC5` | Vercel | optional; UI gated off |
| `LIVE_SEATS_SOLD` | Vercel | optional manual sold count if Convex count isn't used |
| `CRON_SECRET` | Vercel | already used by membership reconcile; also gates `/api/live/reconcile` |

## Public URL / asset env (Vercel)

| Env | Purpose |
|-----|---------|
| `NEXT_PUBLIC_LIVE_LUMA_URL` | Free webinar Luma registration |
| `NEXT_PUBLIC_LIVE_YOUTUBE_URL` | Public stream during 31 Oct 16:00–17:00 GMT |
| `NEXT_PUBLIC_LIVE_YOUTUBE_REPLAY_URL` | Edited public replay (later) |
| `NEXT_PUBLIC_LIVE_ZOOM_URL` | Paid session join link (ticket card + prep email) |

Asset slots (headshot, host video, personal note, demo idea, tool list, proof)
live in `LIVE_ASSETS` in `lib/live/config.ts` — empty means the section stays
hidden.

## Convex (post-merge — do not run against prod from this agent)

### 1. Deploy Convex

```bash
npx convex deploy
```

Deploys `workshop_seats`, `workshop_orders`, `workshop_seat_counts`, and
`live/workshop*` modules.

### 2. Bridge secret

Set `LIVE_WORKSHOP_BILLING_BRIDGE_SECRET` on the Convex deployment (same value
as Vercel).

### 3. Seed 20 free seat rows (dry-run, then apply)

```bash
# Dry run — reports created/already counts, writes nothing
npx convex run --internal live/workshopCheckout:seedSeats '{"eventKey":"build-along-2026-11-14","apply":false}'

# Apply — inserts missing free seats + refreshes the count row
npx convex run --internal live/workshopCheckout:seedSeats '{"eventKey":"build-along-2026-11-14","apply":true}'
```

### 4. Magic-link

Magic-link sign-in relies on the existing `AUTH_RESEND_*` env on Convex prod
`first-squirrel-244`. It was reported working 15 Oct; not re-verified from
env, and no change needed.

## Test-mode purchase walkthrough

1. Set `LIVE_WORKSHOP_BILLING_MODE=test` and the test restricted key / webhook
   secret / bridge secret / app origin on a preview or local stack.
2. Seed seats (`apply:true`) on the matching Convex deployment.
3. Sign in (magic-link or Google), open `/live/build-along`, click Buy.
4. Pay with Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC).
5. Confirm webhook delivery: `checkout.session.completed` with
   `payment_status=paid` → Convex order `paid`, seat `taken`, seats-left cache
   revalidated.
6. In Stripe Dashboard, **fully** refund the charge → `charge.refunded` with
   `refunded: true` frees the seat (`free`) and marks the order `refunded`.
7. A partial refund must leave the seat taken.

## Cron

`vercel.json` runs `GET /api/live/reconcile` daily (`23 4 * * *`) with
`Authorization: Bearer $CRON_SECRET` to release lapsed holds.

## Email follow-ups (not in this PR — John to approve)

- Abandoned-cart reminder for pending workshop orders
- Session reminder / Zoom link email before Sat 14 Nov
- Replay delivery email after the session

No workshop emails are sent automatically beyond the existing auth magic-link
flow and Stripe's own receipt.

## Isolation checklist

- [ ] New Checkout Sessions always set `metadata.purpose` and
      `payment_intent_data.metadata.purpose` to `weekendmvp_workshop_v1`
- [ ] Prices use the lookup keys above with `tax_behavior=inclusive` and tax
      code `txcd_20060045` on the product
- [ ] Webhook events include async payment succeeded/failed
- [ ] Legacy `/api/stripe-webhook` left unchanged (ignores this purpose)
- [ ] Membership / credit-pack catalogs unchanged
- [ ] Parked claim-to-pay flow / preview bridge untouched
- [ ] No bare Payment Link without purpose (would enroll ship·able Beehiiv)
