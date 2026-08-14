# Account chrome contract

Status: **accepted product thinking** (2026-08-14). Not implemented.
Branch: `design/platform-experience`.
Visual spec: [`account-wireframe.html`](./account-wireframe.html).
Companions: [`signed-in-home.md`](./signed-in-home.md) (chrome; Day n short list under the object), [`signed-in-library.md`](./signed-in-library.md) (Library is the other exit), [`publish.md`](./publish.md) (receipts live here, not on the packet).

Supersedes, for **Account only**: `/dashboard/billing` as the signed-in billing destination, credit balance/packs as Account UI, and a settings/profile app behind the chrome item. Does **not** waive Stripe exact-once, Customer Portal for card updates, WP30 Hold-on-canvas, or super-admin as a separate plane.

Do not implement this file as a work package until a later build pass.

## Job

This isn’t the page. My other sites, what I paid, sign out.

Account is the only chrome item that isn’t about the current idea. Library is “not this idea.” Account is “not this page — me.”

## Product goal vs user goal

| | |
|---|---|
| Product | Keep money and identity off the canvas. Don’t reopen a billing cockpit. |
| User | Leave this page. Switch if they own more than one. See the charge. Get out. |

## Where it lives

A **menu**, not a page. Popover on desktop, sheet on mobile. Canvas / Library stays behind it.

Chrome does not grow a Billing item. **Account** in the existing bar (mobile tab bar too) is the only door.

Signup never lands here. Post-pay never lands here. Clash and Hold stay on the publish packet.

Anonymous: no Account.

## Always

Signed-in **email**, read-only. **Sign out** — one control, actually signs out, lands on public `/`.

## Then, only if true

| If | Menu also has |
|---|---|
| **2+ owned projects** | Switcher. Current marked, inert. Pick → close menu → that object’s home (Day 1 or Day n). |
| **Any successful charge** | One receipt line in dollars (the publish charge) + **Update card** → Stripe Customer Portal. No card form here. |

Owned = kept unpublished + Hold + live. Not anonymous previews. Not Saved/Interested. Replace leftovers live here or they’re orphans.

**One site / one unpublished:** no list. Chrome already is that object.

**Never paid:** no receipt row. No “$0.” No credit balance.

**Hold:** stays on the Day 1 packet. Account may show the receipt. Not a ticket. Don’t mark Hold as live.

## Two places, one set

Day n home still has the short other-projects list under the current object. Account is the same inventory when they’ve left the canvas (Library, Day 0). Not a third Library view.

Switcher labels: live row = hostname (`cool-shop.weekendmvp.app`). Unpublished / Hold = object name.

## Kill

- `/dashboard/billing` as Account
- Credit balance, packs, “Launch credits”
- Profile editor (name, avatar, password)
- Settings / notifications / theme / plan
- Billing as a fourth chrome item
- Empty “Your sites (0)” or a list of one
- Hold / policy copy in the menu
- Member-since, usage meters, fake “Pro”
- Landing on Account after signup or after pay

## Quiet (not this freeze)

GDPR delete. Full invoice history (portal can carry it). Day n revision charges. Receipt microcopy. Visual design of the menu. Coding.

## Honest v1

Email is what Auth has. Receipt is the publish charge they actually made. Don’t show credits. Don’t mark Hold as live.

## Out of scope (this freeze)

Own-idea Validation Report path (v1.1). Exact dollar figure. Custom domains. Subscriptions. How Day n revisions are charged. GDPR. Visual design system. Coding.

## Decision log

| Date | Decision |
|---|---|
| 2026-08-14 | Job: this isn’t the page; other sites, what I paid, sign out. |
| 2026-08-14 | Account is a menu, not a destination. No `/dashboard/billing`. |
| 2026-08-14 | Always: email + sign out. Sign out lands on public `/`. |
| 2026-08-14 | Switcher only if 2+ owned projects. List of one is illegal. |
| 2026-08-14 | Receipt + Stripe portal only if a successful charge exists. |
| 2026-08-14 | Day n short list stays under the object; Account is the inventory off-canvas. |
