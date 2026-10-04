# WP55 Evidence - Pricing And Billing Research (2026-10-04)

Supports `docs/wp/wp55-stories.md` and the rulings dated 2026-10-04 in `docs/wp/RULINGS.md`. Collected in one planning session. Nothing here changed code, Stripe or production.

## How to read this

- **[P] primary.** Read directly from the source on 2026-10-04: the repository at `f22590e`, Stripe's pricing page and docs, GOV.UK, and Design+Code's own site code.
- **[S] secondary.** A search-tool summary of pages the session could not read directly. Treat as a lead. Numbers can be stale or wrong, and some sources disagree. Re-check before relying on one.
- Design+Code's pricing page is rendered in the browser, so a plain fetch returns an empty shell. The plan table, FAQ and refund text were read from the JavaScript the site ships.
- The fetch tool reported the network as blocked after the owner opened access. Fetching through the session proxy worked, and the primary pages above were read that way.
- Audience numbers are not recorded here because the repository is public. The owner reported zero members and zero ship·able or DARE buyers on 2026-10-04.

## Corrections to the 2026-10-04 chat breakdown

1. **Churn figures did not fit together.** The breakdown quoted monthly churn of 8.5% to 12% and also "annual plans keep 92% after 12 months, monthly plans keep 68%". A 68% twelve-month retention means about 3.1% monthly churn, not 8.5% to 12%. The two summaries use different units, so monthly churn is unknown. See section 9. The ladder does not depend on it, but the value of a monthly subscriber ranges from about $240 to about $935.
2. **A dispute costs more than $15.** Stripe charges $15.00 for each dispute received, plus $15.00 more if you respond to it manually (returned if you win, kept if you lose). See section 4.
3. **Managed Payments has an eligibility limit the breakdown did not know about.** See section 5. It changes how safe the monthly live build is for that route.

## 1. Repository facts [P] (read at `f22590e`)

| Fact | Where |
|---|---|
| Paid plan `builders_hub`, price constant $29 a month, free limits (1 weekend plan; collections, prompt pack and compare off), UI flag `NEXT_PUBLIC_BUILDERS_HUB` (off unless exactly `on`), 24-hour quiet period | `convex/platform/plans.ts` |
| `resolvePlan` returns `free` for everyone | `convex/platform/planResolver.ts` |
| Plan and billing page says there is no upgrade button until the subscription work ships | `components/platform/billing/PlanAndBilling.tsx` |
| WP24 credit packs: $29 for 25 credits, $79 for 75, $199 for 220. Test mode only, with `cs_test_` checks and live-event rejection. Hosted Checkout, signed bridge to Convex, exact-once ledger | `convex/platform/billing/**`, `app/api/platform/billing/**` |
| Legacy ship·able webhook handles `checkout.session.completed` only, enrolls the buyer in a Beehiiv automation, and returns 200 even when Beehiiv or Convex fails | `app/api/stripe-webhook/route.ts` |
| `payments.recordEvent` is a public `mutation` (callable by any client) | `convex/payments.ts` |
| `subscriptions.record` is a public `mutation` (the email-list log) | `convex/subscriptions.ts` |
| `users.stripeCustomerId` exists and is not used by application code | `convex/schema.ts` |
| Typed Convex env has a required `PLATFORM_BILLING_BRIDGE_SECRET`. The rate limiter component is mounted | `convex/convex.config.ts` |
| One Convex cron exists (editorial release recovery, every minute). No Vercel crons | `convex/crons.ts`, `vercel.json` |
| Production builds run `convex deploy` against the live deployment before `next build` | `scripts/vercel-build.mjs` |
| Vercel branch deployments are off for `claude/*`, `codex/*`, `cursor/*` and `dependabot/**` | `vercel.json` |
| Dependencies: `stripe ^22.2.0`, `convex ^1.43.0`, `next ^16.3.0` | `package.json` |
| Existing ladder of products: $9 ship·able workshop, $29 DARE workshop, both sold through Stripe | `STRATEGY.md`, `app/(marketing)/shipable/**` |
| Platform plan priced a "Builder plan" at about $19 to $29 a month for hosting and a credit drip. WP44 later parked hosting and replaced the bundle | `docs/wp/program-platform-plan.md` section 5 |
| Rulings list WP47 to WP53 as reserved by a "membership program". No file or branch for it is visible | `docs/wp/RULINGS.md` (2026-10-02), `docs/wp/wp54-progress.md` |

## 2. Design+Code (the owner's reference)

[P] from the site's own JavaScript and page head:

| | Free | Legacy Pro (old members) | Pro | Lifetime |
|---|---|---|---|---|
| Payment | Free | Existing plan | $349 yearly or $99 monthly | $499 once |
| Legacy upgrade | none | $199 yearly or $349 lifetime | none | none |
| Library | public previews, limited templates and files | core library | core library | full library |
| Weekly live sessions | no | not included | yes | yes |
| Product Pass (partner perks) | no | not included | yes | yes |
| Support | community | member | member | priority |
| AI chat | limited | unlimited | unlimited | unlimited |

- Page meta description: "Compare DesignCode Free, Pro at $349 yearly or $99 monthly, and Lifetime at $499 with member access and checkout details."
- FAQ: Lifetime "keeps member access active without renewal" and "includes future member resource updates". Every live session is recorded and added to a session vault.
- Refunds: "New purchases have a voluntary 30-day refund period starting on the initial purchase date; subscription renewals do not restart that period." Only claiming a Product Pass offer ends eligibility. "Attending a weekly session does not affect refund eligibility." Statutory rights are unaffected.
- The page loads an affiliate-tracking script (PromoteKit). The app bundle contains affiliate code.
- Annual costs 3.5 months of monthly (71% below twelve months of monthly). Lifetime costs 1.43 times annual and gets more than Pro (full library, priority support).

[S] from search summaries, not verified: a late-August 2026 launch offered "50% off for early adopters" and "a $499 Lifetime option for anyone tired of another subscription". Site banners said prices go up soon. The Product Pass is reported as a year each of Framer Pro ($312 value), Mobbin Pro ($168) and Aura Pro ($150). Terms: the company's definition of "lifetime" could not be read.

What does not transfer to Builder's Hub: Design+Code sells a library, live sessions and partner perks. Builder's Hub today sells organizing tools on top of a free library. Their 1.43 times lifetime ratio is far below the usual range (section 8).

## 3. Competitors [S]

Idea and validation tools:

| Product | Plans (as summarized) |
|---|---|
| IdeaBrowser | Free. Starter $499 a year. Pro $1,499 a year. Empire $2,999 a year. Annual only in early access |
| Ideagrape | Free full idea library plus 3 AI reports a month. Pro $19 a month or $190 a year (30 reports, collections, export). Premium $39 a month. The closest structural match to Weekend MVP, and cheaper |
| BigIdeasDB | From $29 a month. Lifetime one-time: Lite $99, Basic $199, Pro $349 |
| preuve | Founder report $29 once. Radar $9 a month, Radar Pro $24, Builder $59. 5 reports $89, 10 reports $149. 14-day guarantee |
| DimeADozen | $9 starter, $129 entrepreneur, $179 three-pack. Credits never expire. 14-day guarantee |
| IdeaProof | EUR 19.99, 49.99, 99.99 one-time credit packs. No refunds |
| IdeaBuddy | Dreamer $5, Founder $10, Team Pro $20 a month billed annually ($15, $25, $35 monthly). A time-limited $155 lifetime deal existed. 15-day guarantee |
| ValidatorAI | Pro $25 a month |
| Exploding Topics | $39, $99, $249 a month, billed annually |
| Starter Story | Sources disagree: $995 one-time founder plan in one summary, $495 and $795 a year plus a $4,995 one-time club in another |
| Trends.vc | Sources disagree: $299 a year for Trends Pro in one summary |
| GummySearch | Closed 2025-11-30 after failing to secure a Reddit data license. Final prices were $29, $59 and $199 a month with a 33% annual discount |

Education and communities:

| Product | Plans |
|---|---|
| Scrimba | Pro $49 a month list, $294 a year |
| Frontend Masters | $39 a month or $390 a year. Refund window 10 days for monthly, 30 days for yearly, first period only |
| Codecademy | Plus $14.99 billed annually or $29.99 monthly. Pro $19.99 annual or $39.99 monthly |
| Zero To Mastery | $49 monthly, $299 yearly, lifetime $1,299 in one summary (another showed $999) |
| egghead | Lifetime was $500 and the sale is closed |
| Lenny's Newsletter | $200 a year. Insider $400 a year |
| Build-with-AI communities | $29 a month (Skool) up to $97 to $99 a month. CodeFast course $169 once (list $299) |

Starter kits and boilerplates (all one-time with lifetime updates):

| Product | Plans |
|---|---|
| ShipFast | Starter $199 on sale (list $299). All-in $249 on sale (list $349) |
| Supastarter | Solo $299 to $349 by source. Startup $799 |
| MakerKit | Pro $349. Teams $649 |
| TurboStarter | Core $249 (list $349). All-in-one $399 (list $499) |

AI building tools your members already pay for: Cursor Pro $20 a month ($16 on annual billing, $192 a year), Pro+ $60, Ultra $200. Windsurf Pro $20 (moved from $15 in March 2026). Replit Core $25. v0 $20. Lovable $20 to $50. Copilot $10.

## 4. Stripe pricing [P] (stripe.com/pricing, 2026-10-04)

- Cards: 2.9% + 30 cents per successful domestic transaction. Plus 1.5% for international cards, plus 1% if currency conversion is needed, plus 0.5% for manually entered cards.
- Billing: Pay as you go, 0.7% of Billing volume. Excludes one-off invoices.
- Tax Basic: 0.5% per transaction where you are registered, for Billing, Checkout, Invoicing and Payment Links. API-created transactions outside those: $0.50 each. Tax Complete (registrations and filings): from $90 a month on a one-year contract. Stripe Tax calculates and collects. Registration and filing stay with the seller under Basic.
- Managed Payments: 3.5% per successful transaction on top of payment fees. The pricing page says tax compliance and remittance in "more than 75 countries". The docs say "more than 80". It includes fraud prevention, dispute management, invoicing and support.
- Disputes: $15.00 for each dispute received (network fees can apply). $15.00 more for each dispute you respond to manually, returned if you win and kept if you lose. Smart Disputes: 30% of the disputed amount for each dispute won, nothing if lost, and the received fee still applies.
- Refunds: no fee for issuing refunds on cards. The original processing fees are not returned.

Computed from those rates (US card):

| Charge | Stripe fee | You keep | With Managed Payments added |
|---|---|---|---|
| $29 monthly | $1.34 (4.6%) | $27.66 | fee $2.36 (8.1%), keep $26.64 |
| $199 annual | $7.46 (3.8%) | $191.54 | fee $14.43 (7.3%), keep $184.57 |
| $249 lifetime | $7.52 (3.0%) | $241.48 | fee $16.24 (6.5%), keep $232.76 |
| $349 lifetime | $10.42 (3.0%) | $338.58 | fee $22.64 (6.5%), keep $326.36 |

Assumptions: Billing's 0.7% applies to the two subscription rows only. Whether it still applies under Managed Payments was not verified. International cards add 1.5% of the charge.

## 5. Stripe Managed Payments [P] (docs.stripe.com, 2026-10-04)

- Supported business locations include the United Kingdom (`GB`, listed under Europe in the page data). Others listed: Austria, Belgium, Bulgaria, Croatia, Switzerland, Cyprus, Czechia, Estonia, Finland, France, Germany, Denmark, Greece, Hungary, Ireland, Italy, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania, Sweden, Slovakia, Slovenia, Spain, Canada, the United States, Australia, Japan, Hong Kong and Singapore.
- Access is by Stripe's eligibility review of "business type and geography". The seller must accept the Managed Payments terms in the Dashboard.
- **Product rule:** "You sell a fully automated digital product. If your service involves human intervention (such as live 1-1 coaching), it doesn't qualify." If Stripe decides a product is ineligible, the seller "is responsible for any indirect tax liability" and must stop using Managed Payments for it. Unsupported categories include professional services and live in-person events. Supported categories include software, online courses and training, and electronically supplied web services.
- Technical: set `managed_payments[enabled]=true` on the Checkout Session (works for `mode=subscription` and one-time). API version `2025-03-31.basil` or later. Each product needs an eligible tax code. Not supported: Connect, Elements and other embeddable components, creating a subscription outside Checkout or Payment Links, attaching invoice items, third-party tax tools. Custom domains are not supported on these checkouts.
- Customer view: Stripe's Link is the merchant of record. Statements read `LINK.COM*` plus your descriptor. Receipts, invoices and refund notices come from Link. Customers manage orders on the Link website and can cancel or update subscriptions there. The seller can also offer the Customer Portal.
- Operations: Stripe handles disputes and fraud. If the seller does not answer a product-specific support request within 48 hours, Stripe may refund without approval. UK customers get an upcoming-renewal email before the 6-month and 12-month anniversaries even if the seller turns reminders off.
- Eligible tax codes include `txcd_10000000` (general electronically supplied services), `txcd_10103000` (SaaS, personal use) and `txcd_10103001` (SaaS, business use).
- Adaptive Pricing is on by default, so customers may pay in local currency. Settlement checks must not assume the presented amount equals the USD price.

Open question for Stripe (blocks the tax decision): does a subscription that includes software features plus one live group session a month, with replays, count as a "fully automated digital product"?

## 6. UK and international tax and law

[P] GOV.UK, 2026-10-04: UK businesses must register for VAT when taxable turnover over the last 12 months goes over £90,000, or is expected to in the next 30 days. Voluntary registration below that is allowed.

[S] search summaries, for an accountant or lawyer to confirm:

- A seller outside the EU has no registration threshold for digital services sold to EU consumers. VAT is due in the customer's country from the first sale. The non-Union One Stop Shop lets the seller register in one EU country and file one quarterly return. The UK's own MOSS service was withdrawn on 2021-01-01.
- US sales tax on software varies by state and mostly bites at economic-nexus thresholds.
- FTC "Click-to-Cancel" rule: vacated by the Eighth Circuit on 2025-07-08. The FTC sought comment on a new rulemaking on 2026-03-11.
- California's automatic renewal law changes (AB 2863) took effect 2025-07-01: express consent and easy cancellation. Massachusetts rules (940 CMR 38) took effect 2025-09-02: total price and renewal terms before purchase, cancellation as easy as sign-up, notice before the cancellation deadline on plans longer than 31 days.
- EU Directive 2023/2673 requires an online withdrawal function for consumer contracts from 2026-06-19. A CJEU judgment on 2026-07-09 (Sky Österreich, C-234/25) treated a dynamic streaming offer as a digital service, not digital content.
- The UK subscription regime under the Digital Markets, Competition and Consumers Act is reported to start in January 2027.
- A 30-day full refund is longer than the 14-day statutory window in the UK and EU. A lawyer should confirm the Terms wording and the digital-content acknowledgment.

Price display: a headline price that excludes VAT can mislead consumers where VAT applies. If prices are VAT-inclusive, the seller absorbs the VAT: 20% UK VAT is 16.7% of a VAT-inclusive price, and EU standard rates (17% to 27%) are 14.5% to 21.3%.

## 7. Lifetime-deal evidence [S]

- Typical pricing: lifetime is often 3 to 5 times annual. One data set spans 2 to 12 times annual across subscription apps. When unsure, price higher.
- Founders cap lifetime seats and time-box them to limit exposure.
- A "lifetime" definition in one provider's terms: the life of the account owner or 99 years, whichever is shorter. Others tie it to the life of the product.
- Reported failures: a funnel software company that sold $300 to $1,000 lifetime deals in 2021 and shut down in January 2022 without refunds. A tool that revoked every lifetime deal in 2025 citing API costs. A VPN whose new owner cancelled lifetime plans on 2025-04-28. Plex raised its lifetime price from $120 to $250 (March 2025) and to $749.99 (from 2026-07-01).
- Reported upside: Lemlist took $161,896 from 3,304 AppSumo buyers and kept $48,596 after the 70/30 split. AppSumo says its own revenue fell about 50% over two years.
- An Indie Hackers poll summary: 68% of respondents offer lifetime deals, 32% do not.

## 8. Break-even and funnel math (computed; assumptions stated)

- Lifetime $249 equals 8.6 months of monthly, and 1.25 times annual. Lifetime $349 equals 12.0 months of monthly, and 1.75 times annual. Both sit below the usual 3 to 5 times range. The ruling accepts that because 50 seats caps the exposure and the bundle is thin today.
- Annual $199 is 43% below twelve months of monthly ($348). An annual subscriber who renews 40% or 60% of the time is worth about $310 or $390 over three years before fees.
- Maximum Founding Lifetime revenue if all 50 seats sell: 15 × $249 + 35 × $349 = $15,950.
- Per 1,000 free members, at 2%, 3% and 5% conversion: 20, 30 or 50 payers. On monthly that is $580, $870 or $1,450 a month. On annual that is $3,980, $5,970 or $9,950 a year. These are scenarios, not forecasts. The real audience is zero today.
- $10,000 a month on the monthly plan needs 345 payers, which is about 17,250, 11,500 or 6,900 members at 2%, 3% or 5%.
- Value of a monthly subscriber ($29, before fees) by assumed monthly churn: 3.1% gives about $935. 6% gives $483. 8.5% gives $341. 12% gives $242.

## 9. Benchmarks [S]

- Free-to-paid: a median of 8% across 200 products (one report), though about a quarter of freemium products convert below 2.5%. Another source calls 3% to 5% typical for self-serve freemium. A 2026 app report puts freemium at 2.1% against 10.7% for hard paywalls.
- Opt-out trials (card up front) convert about 48.8% of trials against 18.2% for opt-in trials. Different thing from freemium. Not used here, since trials are out of scope.
- Annual discount: pages that state one average 23% to 27%, with a median near 20%. "Two months free" is 17%. The ladder's 43% is deeper than usual because the monthly price is the anchor.
- Retention: one summary says annual plans keep about 92% of customers after 12 months against 68% for monthly. Another says monthly churn is 8.5% to 12% a month against 3.1% to 7% a year for annual. **These disagree.** 68% after 12 months implies about 3.1% a month. Treat monthly churn as unknown until there is data. The pre-registered reviews in S12 exist for this reason.
- Money-back guarantees: vendor-reported lifts in conversion (one source says 27% on average across 37 tests). Treat as marketing, not evidence.
- New product with no data: test with real prices on real traffic, change one thing at a time, and grandfather early buyers.

## 10. Not verified or unavailable

- Design+Code's logged-in pages, checkout flow and terms. No login exists in this environment and the terms page is not readable as text.
- IdeaBrowser's own pricing page (rate limited). Other competitor pages were not read. Section 3 is search summaries.
- Whether Billing's 0.7% applies under Managed Payments. How the Customer Portal behaves with Managed Payments subscriptions. Both are S5 and S10 test items.
- Whether Stripe treats a monthly live group session as human intervention. Needs Stripe's written answer.
- All tax and consumer-law points in section 6 beyond the GOV.UK threshold.
- Traffic, conversion, churn and refund rates for Weekend MVP. There is no data yet.
