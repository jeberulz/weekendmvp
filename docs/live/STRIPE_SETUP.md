# Live Build-Along — Stripe objects to create

Checkout is purpose-separated from ship·able Payment Links, Builder's Hub
membership, and platform credit packs. Do **not** reuse the parked claim-to-pay
Payment Link or the legacy `/api/stripe-webhook` handler for these tickets.

Buyers must be signed in (magic-link / Google). Guest checkout is not offered.

**Purpose metadata (required on product + every Checkout Session + PaymentIntent):**
`purpose=weekendmvp_workshop_v1`

**Seller / MoR:** Rulz&Co (confirmed). Checkout uses Stripe Payments (not Managed
Payments) with `automatic_tax`, required billing address, and tax-inclusive
prices. Checkout copy: `No VAT added: Rulz&Co is not VAT-registered.`

## Product

| Field | Value |
|-------|--------|
| Name | Weekend MVP Build-Along: Sat 14 Nov 2026, 15:00 GMT |
| Description | Build it Saturday, ship it Sunday. 2 hours live on Zoom. Ship Sheet, prompts and the replay (no expiry) included. |
| Metadata | `purpose=weekendmvp_workshop_v1` |

## Prices (one-time, USD, tax_behavior=inclusive)

| Price | Amount | Lookup key | Env override (optional) | Active when |
|-------|--------|------------|-------------------------|-------------|
| Early-bird | $19.00 | `weekendmvp_buildalong_20261114_early` | `STRIPE_LIVE_WORKSHOP_PRICE_EARLY` | through **23:59:59 GMT Sun 8 Nov 2026** inclusive |
| Regular | $29.00 | `weekendmvp_buildalong_20261114_regular` | `STRIPE_LIVE_WORKSHOP_PRICE_STANDARD` | from that moment |
| Next session (optional) | $29.00 | `weekendmvp_buildalong_20261205_regular` | `STRIPE_LIVE_WORKSHOP_PRICE_DEC5` | Sat 5 Dec sold-out / after-event CTA |

The app picks early vs regular server-side from `EARLY_BIRD_ENDS_AT` in
`lib/live/config.ts` (lookup key first; env price id is an optional override).
One buy button — never two price links.

**Shared 20-seat cap:** both 14 Nov prices draw from `workshop_seats` (20 rows,
event key `build-along-2026-11-14`). Reserve holds a seat for 35 minutes;
Checkout Session `expires_at` is ~31 minutes. Webhook
`checkout.session.completed` takes the seat; `checkout.session.expired` or
`charge.refunded` frees it. Daily reconcile sweeps lapsed holds.

## Webhook

| Field | Value |
|-------|--------|
| URL | `https://<host>/api/live/webhook` |
| Events | `checkout.session.completed`, `checkout.session.expired`, `charge.refunded` |
| Secret env | `STRIPE_LIVE_WORKSHOP_WEBHOOK_SECRET` (`whsec_…`) |

## API / billing env (Vercel + Convex)

| Env | Where | Notes |
|-----|--------|--------|
| `LIVE_WORKSHOP_BILLING_MODE` | Vercel | `test` \| `live` \| unset/off |
| `LIVE_WORKSHOP_BILLING_APP_ORIGIN` | Vercel | e.g. `https://weekendmvp.app` |
| `LIVE_WORKSHOP_BILLING_BRIDGE_SECRET` | Vercel **and** Convex | 32+ chars, same value |
| `STRIPE_LIVE_WORKSHOP_RESTRICTED_KEY` | Vercel | `rk_test_…` / `rk_live_…` (or `sk_`) |
| `STRIPE_LIVE_WORKSHOP_WEBHOOK_SECRET` | Vercel | `whsec_…` |
| `STRIPE_LIVE_WORKSHOP_PRICE_EARLY` | Vercel | optional `price_…` override |
| `STRIPE_LIVE_WORKSHOP_PRICE_STANDARD` | Vercel | optional `price_…` override |
| `STRIPE_LIVE_WORKSHOP_PRICE_DEC5` | Vercel | optional until 5 Dec |
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

## Convex (post-merge — do not run against prod from this PR)

1. Deploy Convex so `workshop_seats`, `workshop_orders`, `workshop_seat_counts`,
   and `live/workshop*` modules are live.
2. Set `LIVE_WORKSHOP_BILLING_BRIDGE_SECRET` on the Convex deployment.
3. Seed 20 free seat rows once (internal mutation — dry-run first):

```bash
npx convex run --internal live/workshopCheckout:seedSeats '{"eventKey":"build-along-2026-11-14"}'
# then with apply:
npx convex run --internal live/workshopCheckout:seedSeats '{"eventKey":"build-along-2026-11-14","apply":true}'
```

4. Magic-link sign-in needs `AUTH_RESEND_KEY` and `AUTH_RESEND_FROM` on Convex
   (may already be set for membership).

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
- [ ] Prices use the lookup keys above with `tax_behavior=inclusive`
- [ ] Legacy `/api/stripe-webhook` left unchanged (ignores this purpose)
- [ ] Membership / credit-pack catalogs unchanged
- [ ] Parked claim-to-pay flow / preview bridge untouched
- [ ] No bare Payment Link without purpose (would enroll ship·able Beehiiv)
