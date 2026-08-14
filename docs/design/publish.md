# Publish packet contract

Status: **accepted product thinking** (2026-08-14). Not implemented.
Branch: `design/platform-experience`.
Visual spec: [`publish-wireframe.html`](./publish-wireframe.html).
Companions: [`signed-in-home.md`](./signed-in-home.md) (Day 1 canvas; Day n = live URL), [`preview.md`](./preview.md) (Keep first; this packet is signed-in only).

Supersedes, for **first publish only**: WP29 cockpit as the Launch UX, `/dashboard/billing` as the publish path, and shopping a credit pack to unlock Launch. Does **not** waive Stripe exact-once, WP30 policy, preview isolation, claim-only exclusivity, or WP31 live host/payment activation.

Do not implement this file as a work package until a later build pass.

## Job

Take this page live. Show me the address and what it costs. I say yes once.

One-shot **pay-to-publish**. Dollars on the packet. Credits may remain the ledger behind Stripe; the user never shops a pack to unlock Launch.

## Product goal vs user goal

| | |
|---|---|
| Product | Convert a kept preview into a paid public tenant. Charge once. Policy may delay go-live; money still happened. |
| User | They already have the page. They want the URL and the price, then they confirm. They are not buying credits or opening a billing cockpit. |

## Where it lives

A **Day 1 state**, not a billing page. Chrome does not grow a Publish item. They are still looking at the site (rail or sheet on the Day 1 canvas).

Anonymous preview: Keep first. This packet is signed-in only.

Already live: the packet does not exist. Day n is revision, not first publish.

## Frames

| Frame | After |
|---|---|
| **Ready** | URL + price + one confirm → Stripe → live → Day n |
| **Slug clash** | Same “unavailable” for taken or reserved. Not charged. Pick another slug. Stay on the packet. |
| **Hold** | Paid, not live yet (WP30 policy). One sentence, not a ticket queue. Then Day 1-with-receipt until it goes live. |
| **Return unpaid** | Same Ready packet. Idempotent. No “you abandoned checkout” theatre. |
| **Already live** | Packet is gone. Chrome title is the live URL. |

## Pixels (keep)

- Canvas stays in view. The packet is beside or over it, not a new app.
- Editable `{slug}.weekendmvp.app` (subdomain only; no custom domain in v1).
- One price in dollars. One confirm.
- Clash copy. Hold sentence. Unpaid return = Ready again.
- Success = Day n: watermark off, public host serving, live URL in chrome.

Honest v1: watermark off + public host. No fake visitors or revenue. Do not promise lead capture (synthetic-only until that product exists).

Dollar **amount** is not this freeze. One publish charge; the figure is the launch-pricing ruling restated as a single charge, not a pack shop.

## Kill

- Credit pack picker on this surface
- Credit balance as a gate or as chrome
- WP29 cockpit as Launch
- `/dashboard/billing` as the publish path
- Billing as a top-bar peer
- Three prices, upsells, or subscriptions on this packet
- Policy as a customer queue / ticket UI
- Confirm with no URL or no price
- “You’re live” before the hostname serves

## Quiet (later)

Receipts, payment method, invoices → Account (later freeze). Not on this packet.

## Mechanism vs frame

Stripe Checkout can be the confirm. Credits can debit in the ledger after the webhook. The frame is still: address, dollars, yes. Do not surface packs, remaining credits, or “you need 1 Launch credit.”

WP30-min is Hold after pay, not a second form before pay. User accepted Hold-after-pay.

If they already paid and the site is live, do not re-open this packet.

## Out of scope (this freeze)

Account chrome (receipts, payment method). Exact dollar figure. Custom domains. Subscriptions. Real lead capture. WP31 DNS/live Stripe. How Day n revisions are charged. Coding.

## Decision log

| Date | Decision |
|---|---|
| 2026-08-14 | Job: take this page live; address + price; yes once. |
| 2026-08-14 | Packet is a Day 1 state on the canvas. No Publish chrome item. |
| 2026-08-14 | Pay-to-publish in dollars. Credits stay ledger-only. |
| 2026-08-14 | Clash = unavailable, not charged. Hold = one sentence after pay. |
| 2026-08-14 | Unpaid return is Ready again. Already live = no packet. |
| 2026-08-14 | Kill cockpit-as-Launch, pack shop, `/billing` as publish path. |
