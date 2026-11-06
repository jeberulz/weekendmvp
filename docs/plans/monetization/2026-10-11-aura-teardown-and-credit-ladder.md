# Monetization strategy: Aura teardown and a metered ladder for Weekend MVP

**Status:** Strategy draft, no code. Written 2026-10-11 from a live read of
`aura.build/pricing` and the repo's current billing contract (WP64, WP24, WP27/28,
`lib/engine`).
**Owner decisions needed:** listed in section 8. Nothing here changes a ruling until
the owner appends one to `docs/wp/RULINGS.md`.
**Lane:** none yet. If adopted, this becomes a Program (schema + billing + engine
exposure), audited first, sequenced by risk.

---

## 1. What Aura is actually selling

Aura is a Tailwind design tool with an AI prompt box. The pricing page is a
textbook *features + metered AI* ladder. Read as a machine, not a price list:

### 1.1 The tiers (annual promo prices shown, 50% off monthly)

| Tier | Price | AI prompts / month | What else moves |
|---|---|---|---|
| Free | $0 | 0 (no AI at all) | Browse, remix, export HTML, 2 pages, limited CMS, personal use only |
| Pro | $12.50/mo ($150/yr) | 120 (100 + 20 "bonus") | Commercial use, 100 pages, full CMS, custom domain, Figma export, Pro templates, 5 team seats, 30-day analytics, 10 GB bandwidth |
| Max | $25/mo ($300/yr) | 240 (200 + 40) | 10 seats, 60-day analytics, 50 GB, "access to new features" |
| Ultra | $50/mo ($600/yr) | 560 (500 + 60) | 20 seats, 90-day analytics, 100 GB, priority support |
| Elite | $100/mo (table only) | 1,080 (1,000 + 80) | Same as Ultra, more volume |

Note: the page shows "$250/yr" beside Pro's $12.50/mo. That figure does not
multiply out and is almost certainly the pre-promo annual anchor left in the
markup. Treat the monthly figures as the real ladder.

### 1.2 The credit top-up

| Pack | Price | Per prompt |
|---|---|---|
| 100 credits | (not priced on page) | – |
| 200 credits | $50 one-time | $0.25 |
| 500 credits | (not priced on page) | – |

Rules that matter: credits never expire, 1 credit = 1 prompt on any model,
they **auto-activate** when the monthly allowance runs out, and they **do not
unlock Pro features**. So a Free user with credits still cannot export to Figma
or use the product commercially.

### 1.3 The mechanics worth copying

1. **Two currencies, one gate.** The subscription buys *capability* (features,
   seats, domain, commercial licence). Credits buy *volume*. You cannot buy your
   way around the subscription. That is the whole model.
2. **Subscription prompts are 2.4x cheaper than top-up prompts.** Pro works out
   at about $0.10 per prompt, top-ups at $0.25. The top-up is deliberately
   expensive so the rational move is always "upgrade a tier", not "buy credits".
3. **Every tier is exactly 2x the last** in price and roughly 2x in prompts.
   Nobody needs a calculator. Four tiers and the arithmetic is obvious.
4. **"100 + 20 bonus."** The allowance is framed as a base plus a gift. Same
   number, higher perceived value. Cheap trick, works.
5. **Card-required trial: 3 days, 20 prompts.** Short enough to force a
   decision, long enough to ship one thing. Free has *zero* AI, so the trial is
   the only way to feel the product.
6. **Soft caps that grow with the tier:** pages, bandwidth, CMS items, analytics
   window (30/60/90 days), team seats (5/10/20). None of them cost Aura much.
   They exist to give the upgrade sheet something to say.
7. **Ecosystem rows at the bottom:** sell templates (marketplace), affiliates,
   private Discord, "priority to new features". These are retention and
   distribution, not features.
8. **Annual promo "keep this rate while your subscription stays active"** is a
   price lock. It makes cancelling feel like losing something.

### 1.4 Where it is weak

- Free has nothing to do. 189,000 users, and the free tier is a gallery.
- Credits at 2.4x are so expensive that a bursty user feels punished.
- Max, Ultra and Elite are the same product with bigger numbers. Four tiers of
  "more prompts" is lazy, and it only works because prompts are the obvious unit.

---

## 2. Where Weekend MVP is today

From `convex/platform/plans.ts` and the WP64 frozen contract:

| Plan | Price | Gets |
|---|---|---|
| Free | $0 | Every idea, every score, every prompt, search, one saved list, 1 active weekend plan. Research gated behind a free verified account (WP57), never a paywall. |
| Builder's Hub | $29/mo, $199/yr (43% saving), Founding Lifetime $249 (seats 1–15) / $349 (16–50) | Collections + notes, unlimited weekend plans with history, prompt pack export, compare 4 ideas, one live build a month with replays |

Everything else is built and parked:

- **Credit wallet** (WP24): `credit_accounts`, `credit_ledger`, three packs
  (Starter $29/25, Builder $79/75, Studio $199/220), Stripe checkout and
  webhook, exactly-once settlement. Dormant.
- **Idea Engine** (`lib/engine`): the in-house 360° research pipeline with a
  **$4.00 hard cost cap per full report**, provenance, evidence acceptance.
  Used only by the editorial queue (WP46). Not exposed to members.
- **Preview + tenant hosting** (WP27/28): isolated renderer, `{project}.weekendmvp.app`,
  publish/rollback, leads. Paused 2026-09-25.
- **Intake + briefs + projects** (WP25): repository idea or own idea → Build
  Brief. Built.
- **Validation Reports** (WP26 S2–S6): deferred.

### 2.1 The honest comparison

Builder's Hub is priced **above** Aura Pro and Max, and what it gates is
*organisational* (folders, notes, compare, export) plus one live event. Nothing
in the paid tier consumes anything when a member uses it more. So:

- There is no natural reason to have a second or third tier. "More collections"
  is not a ladder.
- There is no volume currency, so there is nothing for a top-up to buy.
- The upgrade sheet has to argue on convenience, which is the weakest argument
  there is.

Aura's model only works because it has a **metered unit** (a prompt). Weekend
MVP already owns a far better one and is not selling it.

---

## 3. The unit: a Validated Build

Weekend MVP's wedge (platform plan §2.2) is *validation first, then build*.
Aura meters prompts. Polsia meters tasks. Weekend MVP should meter
**research and build actions** against the Idea Engine, with the published
library as the free, zero-marginal-cost top of funnel.

Call the currency **credits** (the WP24 tables already use the word). One
credit is a unit of engine work. Price actions so the most valuable thing a
member can do (validate *their own* idea to the same standard as a published
page) is the headline.

### 3.1 Action menu (what a credit buys)

| Action | Credits | Raw cost ceiling | Why it exists |
|---|---|---|---|
| **Validate my idea** (full 360° research record, same contract as a published idea page, private to the member) | 10 | ≤ $4.00 (engine cap) | The hero action. The thing nobody else sells. |
| **Quick check** (market stat + 3 competitors + pricing + one-paragraph verdict, lite pipeline) | 3 | ≤ $1.00 | The trial hook and the impulse buy. |
| **Refresh a library idea** (re-run signals on a published idea, dated delta) | 3 | ≤ $1.00 | Turns the static library into a living one. |
| **Prompts for my stack** (regenerate the four prompts for Cursor / Claude Code / Lovable / v0 with the member's own constraints: name, auth, DB) | 2 | ≤ $0.40 | WP59 tab data already shows people want this. |
| **Pivot** (take a validated idea, change audience or model, re-score) | 4 | ≤ $1.50 | Where founders actually spend their weekend. |
| **Compare report** (N ideas side by side with a recommendation) | 1 per idea | ≤ $0.20 | Compare is already a Hub feature; this is the AI version. |
| **Landing page build + deploy** (Landing Page prompt → WP27 renderer → `{project}.weekendmvp.app`) | 5 | ≤ $0.50 + hosting | Needs WP27/28 un-paused. Biggest "wow". |
| **Launch pack** (OG card, X/LinkedIn/PH copy, waitlist email) | 3 | ≤ $0.60 | Cheap, shareable, drives referral. |

Credit value: anchor **1 credit ≈ $0.40 of engine ceiling** and sell credits at
roughly $0.70–$1.20 depending on the tier, so gross margin on the engine stays
above 60% even at the cap and above 85% at typical spend. Set actual prices
after one month of real `spentMicroUsd` data from member runs, not the cap.

---

## 4. The ladder

Keep Aura's shape (features + volume, 2x steps, expensive top-ups) but anchor
it to the $29 price that is already live and to the Founding Lifetime promise
that is already sold. Four public tiers, one invisible.

| | **Free** | **Builder's Hub** | **Studio** | **Founder Team** |
|---|---|---|---|---|
| Price | $0 | **$29/mo · $199/yr** (unchanged) | **$79/mo · $590/yr** | **$199/mo · $1,490/yr** |
| Credits / month | 0, plus **one free Quick check per account** | **40** (30 + 10 bonus) | **150** (120 + 30) | **450** (400 + 50) |
| Effective credit price | – | $0.73 | $0.53 | $0.44 |
| Library + research + prompts | ✔ all, forever | ✔ | ✔ | ✔ |
| Saved ideas | One list | Collections + notes | Collections + notes | Shared team collections |
| Weekend plans | 1 active | Unlimited + history | Unlimited + history | Unlimited + history |
| Compare | – | 4 side by side | 8 | 8 |
| Prompt pack export | – | ✔ | ✔ | ✔ + white-label |
| Validate my idea | Quick check only | ✔ | ✔ priority queue | ✔ priority queue |
| Private validation reports | – | ✔ | ✔ + shareable link / PDF | ✔ + white-label PDF |
| Live sites (WP27/28) | – | – | **3 live sites**, custom domain, 30-day analytics | **10 live sites**, custom domain, 90-day analytics |
| Live builds | See schedule | Join + replays | Join + replays + **monthly office hours** | + a private build review per quarter |
| Seats | 1 | 1 | 3 | 10 |
| Commercial use of reports | Personal | Personal | Commercial | Commercial + resale |
| Support | Community | Email, 2 working days | Priority | Priority + Slack Connect |

**Top-ups** (reuse the WP24 catalog as is, numbers already in
`billing/catalog.ts`):

| Pack | Price | Credits | Per credit |
|---|---|---|---|
| Starter | $29 | 25 | $1.16 |
| Builder | $79 | 75 | $1.05 |
| Studio | $199 | 220 | $0.90 |

Rules copied from Aura: top-ups never expire, auto-activate when the monthly
allowance is spent, and **never unlock a feature**. Subscription credits are
spent first, purchased credits second. A Free account can buy a top-up and
run Quick checks and full validations with it, but gets no collections, no
export, no sites. That is the "you cannot buy your way around the plan" gate.

**The invisible fifth tier: Done-for-you.** $499 one-off: a validated idea,
the four prompts, a deployed landing page and a 45-minute call. It is the
original platform plan's deliverable, sold as a service until the agent path
is trustworthy enough to automate it. Lives on the Plan and billing page for
Studio members, nowhere public. This is Aura's "Need more? Contact us" line,
with a price on it.

### 4.1 What changes for existing members

- **Builder's Hub keeps its price and gains 40 credits a month.** No existing
  member pays more. The upgrade email writes itself.
- **Founding Lifetime seats get Hub credits for as long as Builder's Hub is
  offered** (the O3 wording already covers "as long as it is offered"). This is
  a real cost exposure: 50 seats × 40 credits × ~$0.40 ceiling = up to $800/mo
  if every seat maxes out every month. Realistic usage is a fraction of that,
  and the ceiling is already enforced per run. Accept it; it is the price of
  the seats having been sold as "same entitlements".
- **Monthly → annual stays 43% off.** Do not copy Aura's 50% promo yet. The
  current saving is honest and already generous. Keep the "price lock while
  active" line though; it costs nothing.

### 4.2 Trial

Do **not** copy Aura's card-required 3-day trial. Weekend MVP's free tier is
the funnel and WP57 already proved a free verified account converts anonymous
readers. The trial is the **one free Quick check per account**: a member types
their own idea, waits ninety seconds, and gets a dated verdict with three
competitors and a price point. The upgrade sheet opens on the report page with
"Run the full validation · 10 credits · included in Builder's Hub".

That is the moment of desire the platform plan (§3.1 step 5) wanted to charge
at. It is also fully automated, which keeps the Managed Payments eligibility
argument strong (see 7.3).

---

## 5. Features that make the price worth it (build list, ranked by leverage)

Everything below reuses something already in the repo. Ranked by how much
revenue it unlocks per unit of work.

1. **Member-facing "Validate my idea"** – expose `lib/engine` to members.
   WP25 intake already produces a Build Brief. Needs: a member run queue with
   the existing cost cap, a private report page (the same renderer as a public
   idea page, with `robots: noindex`), and a ledger debit. This alone turns
   Builder's Hub from "folders" into "a research analyst for $29".
2. **Credit wallet wired to the subscription** – WP24 tables plus one new
   concept: a monthly grant row per active plan, reset on `currentPeriodEnd`,
   spent-first ordering. Top-up checkout already exists.
3. **Quick check (lite pipeline)** – a capped, two-step version of the engine
   (search + synthesis, no deep evidence pass). It is the free trial, the
   cheapest paid action, and the thing people screenshot.
4. **Prompts for my stack** – the four prompts re-rendered with the member's
   constraints. Prompt standard v1 (`ideas/SECTIONS.md`) is already the
   contract; `lib/engine/compile.ts` already emits compliant prompts.
5. **Validation report share link / PDF** – the artefact a founder sends to a
   cofounder or an investor. Every share is a referral.
6. **Live sites** (un-pause WP27/28) – the Studio tier's reason to exist.
   Hosting, custom domain and an analytics window are the classic retention
   levers Aura uses, and the infrastructure is built.
7. **Portfolio with weekly re-score** – promote Compare into "my five ideas",
   re-run signals weekly, show the delta. Recurring value is what justifies a
   subscription over a one-off.
8. **Office hours + build review** – cheap to deliver, high willingness to
   pay, differentiates Studio from Hub without more compute.
9. **Kit marketplace** (later) – members who shipped an idea publish their
   repo template + prompts; Weekend MVP takes a cut. Aura's "Sell templates"
   row. Also the first step toward the Polsia-style platform fee, without the
   revenue-share compliance surface.
10. **Affiliates** (later) – 30% recurring for 12 months, through Stripe
    promotion codes (already on, ruling 2026-10-09) plus a referral table.
    Beehiiv is already synced per account.

Items 1–3 are the minimum to make the ladder in section 4 true. Items 4–5 fill
the Hub. Item 6 creates Studio. Items 7–10 are retention and distribution.

---

## 6. Phasing

**Phase 0 – Hub gets credits (no new tier, no new price).**
Expose the engine to members, wire the WP24 wallet to the plan, add the free
Quick check, turn top-ups on. Builder's Hub becomes "40 credits + everything
today". Founding Lifetime stays open. Measure: validations per member per
month, credit burn, cost per run, top-up attach rate.

**Phase 1 – Studio.**
Un-pause WP27/28 behind the Studio entitlement. Add share links, office hours,
the invisible Done-for-you line. Introduce the 2x ladder publicly. Measure:
Hub → Studio upgrade rate, sites published per Studio member.

**Phase 2 – Founder Team, marketplace, affiliates.**
Seats, shared collections, white-label reports, kit marketplace, referral
programme.

Each phase is its own Work Package with its own gate. Phase 0 is high-risk
(billing + engine cost exposure) and should be audited before code, like WP64.

---

## 7. Risks and constraints already in the repo

### 7.1 The public homepage does not sell (PRD 6.6, WP44)

Aura's pricing page is public and ranks for "aura pricing". Weekend MVP has no
`/pricing` route; the offer lives inside the dashboard by owner input (WP64
input 7). A credit ladder with four tiers is hard to explain inside a sheet.
**Recommendation:** a public `/pricing` page with the comparison table, no
countdowns, no strike-throughs, true seat counts. This needs an owner ruling
because it amends the WP44 rule.

### 7.2 Refunds and credits

The frozen policy is "30 days, full refund, no proration". Once a plan includes
credits that cost real money to deliver, a full refund after a member burned 40
credits is a loss. **Recommendation:** full refund within 30 days *if fewer than
10 credits were used*; otherwise refund minus credits used at the top-up rate.
Needs a ruling and a Terms update (`lib/legal/content.ts`).

### 7.3 Managed Payments eligibility

Stripe's rule is "fully automated digital product". Engine runs and credits are
fully automated and strengthen the case. The monthly live build and office
hours are the weak spot, as the O1 ruling already notes. Keep the live
elements as a minority of each tier's value and keep asking Stripe in writing.

### 7.4 Cost exposure

The engine's $4.00 per-run cap is the only thing standing between a credit
ladder and a surprise bill. Keep it. Add a per-account daily cap (e.g. 5 full
validations a day) and a global daily spend cap with a kill switch, both read
from Convex env, both failing closed. Lifetime seats need the same caps.

### 7.5 Entitlement stays server-side

`resolvePlan` is the single swap point. Credits must flow through the same
resolver and the same signed bridge, never a client-side balance. WP24's
exactly-once ledger is the pattern.

### 7.6 Promotion codes

Already on for every Checkout Session. A 100% code on a credit-bearing plan
grants free credits every month. Coupons with `applies_to` should exclude
credit top-ups and have a `duration` of `once` or `repeating` with a cap.

---

## 8. Decisions for the owner

| # | Question | Recommended |
|---|---|---|
| D1 | Adopt credits as the metered unit and add 40/mo to Builder's Hub at no price change? | Yes. Phase 0. |
| D2 | Expose the Idea Engine to members (private runs) with the $4 cap plus daily caps? | Yes. It is the product. |
| D3 | One free Quick check per account instead of a card-required trial? | Yes. The free tier is the funnel. |
| D4 | Founding Lifetime seats receive Hub credits for as long as Hub is offered? | Yes. Already implied by "same entitlements". |
| D5 | Public `/pricing` page (amends WP44 PRD 6.6)? | Yes, with the WP44 honesty rules kept. |
| D6 | Refund rule with credits: full within 30 days if fewer than 10 used, else net of usage? | Yes. Needs a Terms line. |
| D7 | Studio at $79 with live sites once WP27/28 resumes? | Yes. Phase 1. |
| D8 | Founder Team at $199 and the invisible $499 Done-for-you line? | Later. Phase 2. |
| D9 | Reuse the WP24 pack prices exactly ($29/25, $79/75, $199/220)? | Yes. Ratio to subscription credits is close to Aura's 1.6–2.6x. |
| D10 | Credit prices per action in 3.1: freeze now, or set after a month of real member spend? | Freeze the ratios now, set the numbers after one month of data. |

---

## 9. One-line version

Aura sells capability by subscription and volume by credit, with credits
priced so the rational move is always to upgrade. Weekend MVP has the better
unit already built and idle: a validated build. Put the engine behind the $29
plan with 40 credits, make a free Quick check the trial, reuse the parked
credit wallet and packs, and let hosting create the $79 tier when it is
switched back on.
