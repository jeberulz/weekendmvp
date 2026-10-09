# WP64 Progress - Builder's Hub Billing (Subscriptions, Annual And Founding Lifetime)

> Renumbered three times (see `docs/wp/RULINGS.md`): WP55 became WP62 on 2026-10-07 because a
> local Codex branch, `codex/wp55-price-acceptance`, already uses WP55. WP62 became WP63 on
> 2026-10-08 because `main` took WP62 for the public idea SEO summary. WP63 became WP64 on
> 2026-10-09 because `main` took WP63 for public navigation consistency (PR #127). Entries dated
> before 2026-10-08 keep the old WP55 or WP62 labels and file names. Entries from 2026-10-08 and
> 2026-10-09 were relabeled WP64 in this file, and their commits still say WP63. Read all as WP64.

Append-only progress log. Do not rely on chat history for project state. Treat this file as claims, not evidence. Verify before relying on a number.

## 2026-10-04 - Setup

- Branch/worktree: planning docs only, on `claude/tender-heisenberg-bf94ku`, fast-forwarded to `origin/main` at `f22590e` before writing (the branch had no commits of its own). No build branch exists. No worktree.
- Assignment: the owner asked for a strategy and pricing review of the paid plan, then approved a price ladder and asked for it to become a work package. This session wrote the plan. It wrote no code.
- File boundaries: this session touched only `docs/wp/RULINGS.md` (six rows appended), `docs/PROJECT_STRATEGY.md` (one registry row), `docs/wp/wp55-stories.md`, `docs/wp/wp55-progress.md` and `docs/wp/evidence/wp55-pricing-and-billing-research.md`.
- Required checks for this docs-only change: `git diff --check`, ruling rows have five cells, referenced paths exist, no secret and no audience numbers in the public repo.
- Initial risks:
  1. A merge to `main` deploys the live Convex backend before the Next build (`scripts/vercel-build.mjs`). Billing code must ship dormant.
  2. Stripe Managed Payments covers UK-based sellers but limits itself to "fully automated" digital products. The approved monthly live build may disqualify the plan, which would make Managed Payments unsafe (O1).
  3. The live ship·able webhook acts on every Checkout Session completed event on the account. A membership checkout would enroll the buyer in the workshop emails until S1 lands.
  4. `payments.recordEvent` and `subscriptions.record` are public mutations. Neither table can be trusted for eligibility.
  5. There is no audience baseline. Members and buyers are zero, so launch depends on the newsletter list and the first live build.
  6. The first-day quiet period would hide the offer from people who sign up because of an offer email (O6).
  7. The E7 editorial launch is using the same production pipeline. Do not merge WP55 during an E7 GO step.

## 2026-10-04 - WP55-S0

- Actions taken:
  - Read the WP44 PRD, the rulings log, the WP24 billing code and stories, the legacy webhook, the plan and entitlement code, the dashboard offer code, the Convex guidelines and the current handoff.
  - Compared the plan against Design+Code (read from the site's own code), Stripe's pricing page and Managed Payments docs, GOV.UK, and search summaries for other products. Two research agents were interrupted by the owner. Their search results were read from the saved transcripts. No agent report was used as a conclusion.
  - Checked which WP numbers exist on `main`: WP45, WP46 and WP54 are in use. WP47 to WP53 appear only as a reservation text. WP55 is unused.
  - Appended six rulings, reserved the registry row, and froze the stories, contract, data model and open decisions.
- Decisions made (all in `docs/wp/RULINGS.md`, 2026-10-04): the number WP55 (owner delegated), the price ladder, the live build in the bundle, the offer order, the 30-day refund, and UK as the seller location. The offer lives inside the dashboard. Hosted Checkout is a design choice in the frozen contract and is reversible. The owner's phrase "embedded in the dashboard" was read as the offer surfaces, not Stripe's embedded Checkout. If that was not the intent, say so before S3.
- Checks run: ruling rows each have five cells. The registry row has six cells and sits inside its table. `git diff --check` is run before the commit (see the next entry).
- Result: S0 done. Open decisions O1 to O9 remain, each with a recommended default and a decider.
- Gotchas:
  - The fetch tool said `designcode.io`, `stripe.com`, `docs.stripe.com` and `gov.uk` were blocked after the owner opened network access. The session proxy allowed them, and curl through it worked. Both facts are recorded in the evidence file.
  - The earlier chat breakdown contained two errors, corrected in the evidence file: conflicting churn figures, and a dispute fee that left out the $15 countered fee.
  - Primary and secondary labels in the evidence file are the source of truth for how much to trust a number.
- Next: owner rulings on O1 to O9, starting with a written answer from Stripe on the live build (O1). Then S1 (legacy isolation) and S2 (schema and resolver), which can start once the owner opens the build lane and names a branch. S1 needs no open decision.

## Owner follow-ups

- Ask Stripe in writing whether Builder's Hub (software features plus one live group build a month with replays) qualifies for Managed Payments. Also ask whether Billing's 0.7% applies and how the Customer Portal works with Managed Payments subscriptions.
- Confirm the seller's legal form, registered address and VAT status (O2). Take O1 and O3 to an accountant and a lawyer.
- Confirm that WP55 is not already planned inside the unseen "membership program" (WP47 to WP53). If it is, renumber with a new ruling.
- Say whether "embedded in the dashboard" meant the offer surfaces (assumed) or Stripe's embedded Checkout.
- Decide the live build slot and logistics (O8) and schedule the first session before window 1.

## 2026-10-07 - Renumber and sync

- Actions taken:
  - Merged `origin/main` (57 then 65 commits behind, merge commit `8bb15b1`). Two docs conflicts (the rulings log and the registry) were resolved by keeping both sides. No code conflicts.
  - Renumbered the package from WP55 to WP62. WP62 is used nowhere on `main` or on any remote branch (highest in use: WP61). Renamed the stories, progress and evidence files. Moved the registry row after WP61. Appended the ruling "WP62 / renumbering". Left the six 2026-10-04 rulings untouched.
  - Added "Changes on main since planning" to the stories (WP57 account gate and Beehiiv sync, busy seams, S1 unchanged).
- Decisions made: none new. The renumber follows the owner's instruction of 2026-10-07.
- Checks run:
  - Baseline of `main` at `09ef90e` in a throwaway worktree (since removed): `npm run typecheck` passed. Test stages passed for links, redirects, auth, security, sitemap, Convex (490), engine (1,076), home, prompts and platform. Six tests failed in this sandbox: three OG-image tests that call OpenAI and Recraft (hosts blocked here, so environmental) and three editorial tests ("headers was called outside a request scope", not diagnosed, unrelated to billing). Lint and the build were not run. The baseline predates the last merge of `main`.
  - `git diff --check` on the docs passes. It flags blank lines at the end of two files that came from `main` (`components/public/IdeaCards.tsx`, `components/public/Sections.tsx`), which are not part of this work.
- Result: branch is in sync with `main` and carries only docs. No Stripe code exists yet.
- Gotchas:
  - A registry row on a side branch does not protect a number. Other sessions only see rows on `main`. The row reserves WP62 for real once it is merged to `main`.
  - Local-only branches are invisible from a cloud checkout. If one already uses WP62, renumber again the same way.
- Next: unchanged. Owner rulings on O1 to O9, starting with Stripe's written answer on the live build. S1 and S2 can start once the owner opens the build lane, names a branch, and confirms no other package holds the schema writer slot.

## 2026-10-08 - WP64-S1 (legacy webhook guard and signed payment-log hand-off)

- Actions taken:
  - Renumbered the package from WP62 to WP63 first: `main` took WP62 for the public idea SEO summary (PR #125) and a remote branch also claims it. Merged `main` again (14 commits, one docs conflict in the registry table).
  - Inventory of Stripe code paths: only the legacy handler (`app/api/stripe-webhook/route.ts`) and the WP24 checkout and webhook. ship·able seat sales were paused on 2026-10-05 (PR #113), so no page links the Payment Link now. The link itself may still be live in Stripe, which the owner should confirm.
  - Guard: the legacy handler now acts only on a Payment Link session with no `purpose` marker (`_guard.ts`). Anything else gets a 200, no Convex write, no Beehiiv call, and a log line with ids and a reason only.
  - Expand step for `payments.recordEvent`, which is a public mutation: added `recordEventInternal`, a Node action `paymentsBridge.accept` that verifies an HMAC signature (`lib/legacy-payments-bridge.ts`), and an optional typed env `LEGACY_PAYMENTS_BRIDGE_SECRET`. The route uses the bridge only when that secret is set, so merging changes nothing until the operator switches.
  - Tests: route behavior with signed Stripe events (13), bridge signature and payload shape (22), Convex mutation and action (7), and static pins (5). The two new Vitest files are added to `test:security`, so `npm test` runs them.
- Decisions made: new secret named `LEGACY_PAYMENTS_BRIDGE_SECRET`, optional, fail closed. No timestamp or nonce on the signed payload, because a replay only returns "duplicate" (the log is idempotent by event id) and a forged event needs the secret. A too-short or half-configured secret records nothing but never fails the webhook or the Beehiiv enrollment, matching the existing rule that Stripe must not enter a retry loop.
- Checks run on the branch (final, single run):
  - `npm run typecheck` passes. `npm run lint` has 0 errors and 34 warnings. `npm run build` succeeds (434 static pages).
  - Test stages pass: links 6, redirects 76, auth 144, security (94 node tests, 121 Vitest tests), sitemap 11, Convex 497 (up from 490), engine 1,076, home 77, prompts 23, platform 250.
  - Six tests fail, none from this work. Three OG-image tests call OpenAI and Recraft, which this sandbox blocks. Three editorial tests ("headers was called outside a request scope") fail identically on `main` at `09ef90e`, which was checked before any change.
  - Break-on-purpose: 19 deliberate breakages (guard checks removed, signature check removed, short secret allowed, unknown keys allowed, public mutation restored, process.env read, entitlements reading the payment log, and others) were each caught by at least one suite. One first attempt survived only because it inserted a comment, which the static test strips on purpose. Redone with real code, it was caught.
- Result: S1 code is complete on the branch and pushed (`ba2b01a`). Nothing is merged or deployed. S1 is not ticked: the switch step, contract step, owner's call on `subscriptions.record`, and the owner-run test-mode purchase are still open (see the story).
- Gotchas:
  - `stripe trigger checkout.session.completed` creates an API session with no `payment_link`, so the legacy handler now ignores it. To smoke the legacy flow, buy through a test-mode Payment Link with a test card.
  - `npx convex codegen` needs a Convex login, so `convex/_generated/api.d.ts` and `server.d.ts` were edited by hand, one line each. The next deploy's codegen should produce the same lines. Check that the deploy leaves no diff.
  - `tests/security/env-documentation.test.mjs` requires every env name used in code to be in `.env.example`. That is where the new name is documented. The cutover runbook is a finished migration checklist and was left alone.
  - A first gate launch of mine started two copies that overwrote each other's log. Those results were discarded and the gate was rerun once, behind a lock.
  - `convex-test` ignores public versus internal visibility, so the static test pins that `recordEventInternal` is an `internalMutation` and that `api.payments.recordEvent` has exactly one caller. The contract step must update that test on purpose.
- Next, owner steps, in order: (1) confirm whether the ship·able Payment Link is still active in Stripe. (2) Decide whether `subscriptions.record` (the email-list log, also public) gets the same fix now or later. (3) After merge and deploy, generate a 32+ character secret, set `LEGACY_PAYMENTS_BRIDGE_SECRET` in Convex first and then in Vercel, and confirm a test-mode Payment Link purchase is logged. (4) Only then the contract step. Next story S2 can start once nothing else holds the schema writer slot.

## 2026-10-08 - WP64-S2 (plan model, membership tables, entitlement resolver)

- Actions taken:
  - Merged `origin/main` first (3 commits, PR #123, which added two tables to `convex/schema.ts`). No conflicts. Checked open pull requests for another schema writer: none touched in the last week, so this branch holds the schema writer slot until it merges.
  - `PRICING` in `convex/platform/plans.ts`: monthly 2,900, annual 19,900, lifetime tranches 1 to 15 at 24,900 and 16 to 50 at 34,900 (minor units, USD). Helpers: `lifetimeTrancheForSeat`, `amountForPriceKey`, `formatUsd`, `ANNUAL_SAVING_PERCENT` (43). `PLANS.builders_hub.priceMonthlyUsd` and `priceLabel` now derive from it and read exactly as before, so no copy changes until S6.
  - Six tables appended to `convex/schema.ts` with the contract's indexes: `billing_customers`, `plan_subscriptions`, `membership_orders`, `plan_grants`, `founding_seats`, `billing_events`. No existing table, field or index changed (`git diff origin/main -- convex/schema.ts` shows only added lines).
  - `convex/platform/membership/state.ts` (read-only, clock-free): `readMembershipState` reads at most 25 grants and 25 subscriptions per owner, newest first, and `deriveMembership` picks the plan and the billing summary. `resolvePlan` now returns its plan. `entitlements.mine` also returns `billing` (term, status, renewsAt, endsAt, foundingSeat). `countSeats` reads at most 51 seat rows.
  - Operator-only internal mutations: `membership/seats:seed` (dry run unless `apply: true`, inserts missing seats only, refuses a bad or duplicate seat number) and `membership/comp:grant` and `:revoke` (comp grants only, never lifetime).
  - Tests: `convex/wp64Membership.test.ts` (34: ladder, schema indexes and no arrays, the resolver matrix, precedence, isolation, no Stripe ids in `mine`, seed and comp) and `tests/security/membership-tables-isolation.test.mjs` (6 static pins). One WP54 test fixture gained the new `billing` field.
- Decisions made (mine, reversible, none is a ruling):
  - Access: a live lifetime grant, then a subscription stored `active` or `past_due` with no open dispute, then a live comp grant. A dispute on a subscription suspends it, following O9, which the contract's resolver line did not spell out.
  - Summary status mirrors Stripe (`active`, `past_due`, `canceled`, `unpaid`, `paused`) plus `suspended`. `incomplete`, `incomplete_expired` and `trialing` grant nothing and show nothing. A revoked grant shows nothing.
  - No typed env in S2, because nothing reads one yet.
  - Money in `plan_subscriptions` and `membership_orders` is a plain number of minor units, not `int64` as in WP24, so the client never handles a bigint.
- Checks run on the branch (final, single run):
  - `npm run typecheck` passes. `npm run lint` has 0 errors and 34 warnings, the same count as before S2. `npm run build` succeeds (434 static pages).
  - Test stages pass: links 6, redirects 76, auth 144, security (100 node tests, up from 94, and 121 Vitest tests), sitemap 11, Convex 534, engine 1,076, home 77, prompts 23, platform 250.
  - The same six failures as in S1, none from this work: three OG-image tests (OpenAI and Recraft are blocked in this sandbox) and three editorial tests ("headers was called outside a request scope"), which also fail on `main`.
  - Break-on-purpose: 34 deliberate breakages, each caught by at least one suite. Examples: past_due losing access, trialing granting it, an open dispute ignored, a suspended or revoked grant still granting, reads across owners, a clock read in the state module, `.collect()` in the seat count, a Stripe field in the summary, the seed writing without `apply` or re-inserting seats, the seed or comp revoke turning public, a renamed index, an array column, an off-by-one tranche. The index-rename case first matched the legacy `stripe_events` index too, so it was rerun with a pattern unique to `billing_events`, and caught.
  - Schema diff against `origin/main`: 91 lines added, 0 removed.
- Docs updated: `docs/wp/wp64-stories.md` (S2 status, data contract clarifications, and a new S3 criterion that production refuses `test` mode), `docs/wp/wp44-dashboard-prd.md` 9.3 and 9.4 (pointers to the resolver and to WP64), and the `PRICING` comment in `plans.ts`. Not needed: `.agentic-workflow.yml` (the critical flows land with S4), the env lists in `docs/runbooks/2026-cutover.md` (S2 adds no env), `.env.example` (same reason), and `docs/wp/AGENT_HANDOFF.md` (owner-managed).
- Result: S2 built on the branch and pushed (`8bc6831`). Not merged or deployed. The box stays open until the merge, because the schema only reaches Convex then.
- Gotchas:
  - Union validators on a table break `convex/referenceTables.ts`, which spreads `.fields` from every table validator. Grants and seats are flat objects for that reason.
  - The first version of the static "no public registration" pin matched `ctx.db.query(`. It now ignores a call preceded by a dot.
  - `npx convex codegen` still needs a login. `convex/_generated/api.d.ts` gained four lines by hand. `dataModel.d.ts` derives from the schema and needed nothing.
- Next: S3 (Checkout Sessions) needs O1 for the tax mode and O5 for lifetime-while-subscribed, plus S9 for the consent text. S6, S7 and S8 can start on top of S2. S7 and S8 add `offer_cohorts` and `live_builds`, so they should land in this same schema window or wait for the next one.

## 2026-10-08 - WP64-S6 (dashboard surfaces: ladder, sheet, current plan, return state)

- Actions taken:
  - Route contract `app/api/platform/membership/_contract.ts`, for S3 and S5 to import: paths, the body `{ term, idempotencyKey }`, the key pattern, error codes with their HTTP statuses, `{ ok: true, url }` answers, the return parameter (`?checkout=return` and `?checkout=cancelled`), and `isStripeRedirect` (https on `checkout.stripe.com` or `billing.stripe.com` only, no credentials or port). A 404 reads as "not open yet", so the surfaces work before S3 exists.
  - Copy in `convex/platform/plans.ts`, all from `PRICING`: `TERM_COPY` (for example "$199 billed once a year. Renews until you cancel."), `upgradeLabel(term)`, `ANNUAL_SAVING_LINE` ("Save 43% compared with 12 months of monthly"), the tranche line, `REFUND_LINE`, a neutral `TAX_LINE` and `MEMBERSHIP_LEGAL_LINKS`. `priceLabel` is now "$29 a month or $199 a year". The research row says "Every idea, never paywalled" (WP57 note). `UPGRADE_LABEL` stays the monthly label.
  - Signed-in query `membership/queries:ladder`: seeded or not, seats left, seats held by unfinished checkouts, and the next seat's price. Reads at most 51 rows plus one index lookup, no clock, no owner or order ids.
  - Surfaces: `TermPicker` (one native radio group with a legend, monthly and annual side by side, Founding Lifetime full width), `PurchaseFinePrint` (refund line, tax line, Terms and Refund policy links beside every buy button), `MembershipLadder` on Plan and billing, `CurrentPlan` (term, renewal or end date, founding seat, payment notices, Manage billing for subscribers), `CheckoutReturn` (confirming, slow after 90 seconds, confirmed, cancelled). The upgrade sheet now has the term picker and its button starts checkout.
  - Analytics: `upgrade_clicked` carries `term`. New `checkout_started` (fires after the route answers with a Stripe URL, before the redirect), `checkout_completed` and `founding_seat_taken` (fire once, only after `entitlements.mine` confirms the term this tab bought). Undefined props are no longer forwarded.
  - Tests: `tests/platform/wp64-surfaces.test.tsx` (29), 3 more Convex tests for the seat query, and updated WP44 pins (see decisions).
- Decisions made (mine, reversible, none is a ruling):
  - One radio group and one button, on the page and in the sheet, rather than a button per card. The button label names the chosen price.
  - Monthly is selected by default. It is the smallest commitment and matches the old label. It is a choice of term, not an add-on, so it is not a pre-checked box.
  - Founding Lifetime is hidden until the seats are seeded, shown but unselectable when sold out, and the page explains held seats in plain words. The seat count is plain text. Only a sell-out that happens while the member is looking is announced, once, politely.
  - The ladder follows the first-day quiet period, like the Plan card (PRD 6.6). The sheet still starts checkout on day one, because the member asked. A member with an open dispute is not offered the ladder.
  - The return page never reads payment from the URL. Paid events dedupe through a per-tab session-storage note that is cleared before the events fire, so a reload fires nothing.
  - WP44 tests that banned "annual" in plan copy were updated to cite the ladder ruling. The bans on hosting, credits and publishing stay.
- Checks run on the branch (final, single run):
  - `npm run typecheck` passes. `npm run lint` has 0 errors and 34 warnings, the same count as before S6. `npm run build` succeeds (434 static pages).
  - Test stages pass: links 6, redirects 76, auth 144, security (100 node tests and 121 Vitest tests), sitemap 11, Convex 537 (up from 534), engine 1,076, home 77, prompts 23, platform 279 (up from 250).
  - The same six failures as in S1 and S2, none from this work: three OG-image tests (blocked hosts) and three editorial tests that also fail on `main`.
  - Break-on-purpose: 42 deliberate breakages. 39 were caught on the first run. The 3 survivors were test gaps, not code bugs: a host-suffix match and a username-only URL were missing from the bad-URL list, and the analytics test omitted `term` instead of passing `undefined` (and `toEqual` ignores undefined keys, so it now uses `toStrictEqual`). After adding those cases, all 3 were caught. Examples of the 42: following an http or non-Stripe URL, sending an amount in the body, firing `checkout_started` before the answer, confirming from the URL, paid events without this tab's checkout or before clearing it, the ladder for Builder's Hub members, on day one or during a dispute, a selectable sold-out seat, lifetime before the seed, a lost legend or description, the refund line dropped, a typed-out price, a client secret.
- Accessibility: each state was rendered to static HTML (free with the ladder, sold out, first day, annual past due, monthly set to cancel, lifetime, return confirming, return confirmed, cancelled, the open sheet, plus error and notice snippets) and checked in Chromium with axe-core 4 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) and the app's freshly built CSS, at 390 px and 1440 px. 0 violations in all 22 runs, and no horizontal scroll. A control page with a known faint color was flagged, so contrast really ran. Every color class in the new files was confirmed present in the built CSS. Tab order: the radio group, the buy button, Terms, Refund policy (the sheet adds Not now before the links). Arrow keys move and select within the radio group. The real app was not run with a signed-in session (that needs a temporary auth bypass, as WP44 did), so focus return and the Radix focus trap were not rechecked in a browser.
- Docs updated: `docs/wp/wp64-stories.md` (S6 status), `docs/wp/wp44-dashboard-prd.md` 6.5 (pointer to the ladder), the comments in `plans.ts` and `flag.ts`. Not needed: `.env.example` and the cutover env lists (no env), `.agentic-workflow.yml` (S4), `docs/wp/AGENT_HANDOFF.md` (owner-managed).
- Result: S6 built on the branch and pushed (`9fafae8`). Not merged. Dormant: every surface sits behind `NEXT_PUBLIC_BUILDERS_HUB`, and until S3 ships the buy button answers "Checkout isn’t open yet. Nothing was charged."
- Handed on:
  - S3 must answer exactly as `_contract.ts` says, use `/dashboard/billing?checkout=return` and `?checkout=cancelled`, and accept keys matching `IDEMPOTENCY_KEY_PATTERN`.
  - S5 answers `POST {}` with a `billing.stripe.com` URL. If O1 picks Managed Payments and members must use Link's order management, add that host to `STRIPE_REDIRECT_HOSTS` on purpose, with a test.
  - S9 must publish `/terms` and `/refund-policy`. Until then those links 404, behind the flag.
  - O1 decides `TAX_LINE`. O3 decides what Founding Lifetime promises; today it only says "One payment. No renewal." O5: subscribers never see the ladder (FR-24), so lifetime-while-subscribed has no surface yet. O6: no invite parameter was built.
  - S7 adds window gating. The `NOT_YET_ELIGIBLE` message already shows the opening date when the route sends `opensAt`.
- Gotchas:
  - Tailwind only emits classes the code uses, so an axe run against an old build can pass a color that does not exist. Rebuild first, then check the classes are present.
  - React writes `checked` before `value` on a radio, so markup tests match attributes in any order.
  - `useSearchParams` sits inside a `Suspense` boundary. The billing route was already dynamic in the build, so this changes nothing today, but it keeps the page safe if it ever becomes static.
- Next: S3 (Checkout Sessions), once O1 and O5 are ruled and S9 has the Terms text. S7 and S8 can start now, and both add a table, so they belong in this branch's schema window.

## 2026-10-09 - WP64-S7 (founding offer: cohorts, windows and the seat counter)

- Actions taken:
  - `offer_cohorts` appended to `convex/schema.ts` in this branch's schema window: cohort (`buyers` or `newsletter`), `emailHash`, `importedAt`, `batchId`, with `by_emailHash`, `by_cohort_and_emailHash` and `by_batchId`. Additive only.
  - Windows: `convex/platform/membership/windows.ts`, three dates, all null. Buyers open at window 1, newsletter at window 2 (buyers included), everyone at window 3. Each stays open until the seats are gone.
  - Eligibility: `convex/platform/membership/offer.ts` (read-only, clock-free). It hashes the member's email only when it is verified and the account is not anonymous, and looks it up in `offer_cohorts`. `assertFoundingEligible(ctx, user, now)` is the guard S3's checkout must call. It throws `NOT_YET_ELIGIBLE`, with `opensAt` when the member's window is dated.
  - Operator writes: `membership/cohorts:importBatch` (200 hashes per call, rejects a bad hash, a repeat or a mismatched batch id, skips rows already there), `removeBatch` (undo by batch id, a page at a time) and the internal query `launchCheck` (seat counts, window dates, and whether they are in order).
  - Import script: `npm run membership:import-cohorts -- --cohort=buyers --file=PATH`. It reads a file outside the repo or under `tmp/`, hashes on the operator's machine, and prints counts and a batch id only. Applying needs `--apply`, the dry run's exact `--confirm=<batch id>`, an existing `--backup=PATH`, and env `MEMBERSHIP_COHORT_CONVEX_URL` and `MEMBERSHIP_COHORT_ADMIN_KEY` matching `--target`, the same rules as `editorial-submit-engine.mjs`.
  - Ladder: the seat query now also returns this member's `eligibleFrom`. Founding Lifetime stays hidden until a window is dated for the member. Before it opens, it shows but can't be picked, with "Not open yet" and "Opens for you on November 4, 2026 at 5:00 PM" in the member's time zone.
  - Home card: a new `founding_lifetime` offer kind. It shows to a free member past day one whose window is open, while seats remain and only with the Builder's Hub flag on (the browser passes the flag, because the card links to the ladder the flag hides). It shows the true seats left and the next seat's price, ranks above a promo and the Starter Kit, can be dismissed like any card, and retires when the seats are gone.
  - Tests: `convex/wp64FoundingOffer.test.ts` (23), `tests/platform/wp64-founding.test.tsx` (11), `tests/security/membership-cohort-import.test.mjs` (7), and updated pins in the S2 static test, the WP44 offer test and the S6 tests.
- Decisions made (mine, reversible, none is a ruling):
  - Hash cohort emails instead of storing them. Convex already holds members' emails, so hashing protects buyers and subscribers who never signed up. It is unsalted, so a guessed address can still be checked: the table is still personal data. A secret pepper would add a key to manage for little gain.
  - Normalize like sign-in does (NFKC, trim, lowercase). No plus-tag or dot stripping. A buyer who signs up with another address can be added with a new import.
  - An unverified or anonymous account gets no cohort but still gets window 3. S3 requires a verified email to check out anyway.
  - The founding card ranks first among Home cards while it is open. PRD 6.2 had promo, then the kit. Say if a promo should win.
  - The card keeps the first-day quiet period (O6 not ruled). No invite parameter.
- Checks run on the branch (final, single run):
  - `npm run typecheck` passes. `npm run lint` has 0 errors and 34 warnings, the same count as before. `npm run build` succeeds (434 static pages).
  - Test stages pass: links 6, redirects 76, auth 144, security (107 node tests, up from 100, and 121 Vitest tests), sitemap 11, Convex 560 (up from 537), engine 1,076, home 77, prompts 23, platform 290 (up from 279).
  - The same six failures as before, none from this work: three OG-image tests (blocked hosts) and three editorial tests that also fail on `main`.
  - Break-on-purpose: 39 deliberate breakages. 37 were caught on the first run. The 2 survivors were redundant guards. The "seats seeded" check in `readFoundingInput` changed nothing, because an unseeded table already reads as no seats and no price, so I removed it. The card's own seats-left guard overlaps with "the next seat has a price", so I kept it and added a test where the two disagree. That mutation is now caught. Examples of the 39: buyers left out of window 2, the latest window winning, a window opening a moment late or without a date, unverified or anonymous accounts getting a cohort, eligibility reading the subscription log, the checkout guard passing or hiding the date, hash drift between the script and Convex, the import accepting bad or repeated hashes or a foreign batch id, the undo touching other batches, the card ignoring the window, the flag, dismissal or the plan, windows dated by default, the dry run printing the list, and apply skipping the batch id, the backup or the repo-file check.
  - Schema diff against `origin/main`: only added lines.
- Accessibility: the ladder before a member's window, the Home founding card, the open ladder and the sheet, rendered to static HTML and checked with axe-core 4 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) and the built CSS at 390 px and 1440 px: 0 violations in all 8 runs, and no horizontal scroll. The unselectable lifetime radio drops out of the Tab order, and the arrow keys still move between monthly and annual.
- Docs updated: `docs/wp/wp64-stories.md` (S7 status, the hashed-email contract change, S12 tooling pointers), `.env.example` (the two import keys). Not needed: `.agentic-workflow.yml` (S4), the cutover env lists (operator-only keys, like the editorial import), `docs/wp/AGENT_HANDOFF.md` (owner-managed).
- Result: S7 built on the branch and pushed (`120fa57`, cleanup `b11139c`). Not merged. The offer stays closed after a merge, because every window date is null.
- Handed on:
  - S3: call `assertFoundingEligible` before reserving a seat and map its error to `{ ok: false, code: "NOT_YET_ELIGIBLE", opensAt }` with HTTP 409.
  - S9: the privacy policy should say cohort emails are stored hashed, and name the sources (Stripe buyers, Beehiiv subscribers).
  - S12: date the windows (a code change and a deploy), import each cohort (dry run, then apply with a backup and the exact target), then run `launchCheck` to confirm 50 free seats, none held or taken, and windows in order.
  - Owner: export the ship·able and DARE buyer emails from Stripe and the newsletter list from Beehiiv to private files. Input 8 says both may be empty, which the code treats as normal.
- Gotchas:
  - The dashboard refuses anonymous sessions before any query runs, so the anonymous case is tested against the eligibility helper directly.
  - `toEqual` ignores keys set to `undefined`. Tests that care whether a key exists use `toStrictEqual` (found in S6, reused here).
  - Only the date list in `windows.ts` changes at launch. A test fails if the committed dates are not all null, so a launch commit must update that test on purpose.
- Next: S8 (live builds) is the last story that adds a table in this schema window. S3 still waits on O1, O5 and S9.

## 2026-10-09 - WP64-S8 (live builds hub)

- Actions taken:
  - `live_builds` appended to `convex/schema.ts` in this branch's schema window, with the contract's fields and `by_startsAt` and `by_status_and_startsAt`. Additive only. This is the last table WP64 adds.
  - Rules in `convex/platform/liveBuildRules.ts` (pure): scheduled, open from 24 hours before the start until the end, ended after, canceled hidden. Links must be https with no credentials.
  - Operator-only internal mutations in `convex/platform/liveBuildsOperator.ts`: `create`, `update` (a new time must be in the future, `joinUrl: null` clears the link), `setReplay`, `cancel`, and `advance`. Each write schedules `advance` for the moment the join link opens and the moment the session ends. `advance` recomputes the status from the row and the server clock, so a flip left over from an earlier time does nothing, and a canceled session stays canceled. They return ids and statuses, never a link.
  - Member query `platform/liveBuilds:list` (read-only, clock-free): everyone signed in gets the schedule and titles. The join link goes only to Builder's Hub members while a session is open, the replay only after it ends. Free members get `hasJoinLink` and `hasReplay` flags instead. Canceled sessions are not listed.
  - Page `/dashboard/live`: 404 without the flag, noindex, no nested `main`, an empty state, and times in the member's zone with the zone named ("Wednesday, November 4, 2026 at 5:00 PM GMT"). Links open in a new tab and say so. A free member's join or replay button opens the upgrade sheet, which now has live-build wording.
  - Nav: "Live builds" under Builds in the desktop sidebar and in the phone Account sheet, flag on only. `PRIMARY_NAV` is unchanged, because the phone tab bar has five slots and the idea page mirrors it.
  - Plan copy: `live_builds` is now a gated feature (`PLAN_LIMITS.liveBuilds`, `requireFeature`, `entitlements.check`), and `PLANS`, the sheet comparison and the Plan and billing table list "One live build a month, with replays".
  - Analytics: `live_build_opened` with `action` (`join` or `replay`) only. Never the link or the title.
  - Runbook: `docs/runbooks/wp64-live-builds.md` (commands, link rules, captions before a replay, the missed-month rule, and first session before window 1).
  - Tests: `convex/wp64LiveBuilds.test.ts` (15), `tests/platform/wp64-live.test.tsx` (10), `tests/security/live-builds-isolation.test.mjs` (4), and updated WP44, WP54 and S7 pins for the new feature and plan line.
- Decisions made (mine, reversible, none is a ruling):
  - Stored status flipped by scheduled mutations, not a clock passed from the browser. A browser clock could open a join link early. The Convex guidelines recommend this pattern for time-based state.
  - Free members see a "Join the live build" button on every upcoming session, not only open ones, because the click is the point of intent. They see no extra upsell text, so the first-day rule holds.
  - Canceled sessions disappear from the page. The operator tells members about the make-up session or the extension, as the runbook says.
  - No host allowlist for links, because the tool is O8's call.
- Checks run on the branch (final, single run, after merging `main` at `a80836b`):
  - `npm run typecheck` passes. `npm run lint` has 0 errors and 34 warnings, the same count as before. `npm run build` succeeds (435 static pages, one more than before for `/dashboard/live`, which renders as a 404 while the flag is off).
  - Test stages pass: links 6, redirects 76, auth 146 (two new from `main`), security (111 node tests, up from 107, and 121 Vitest tests), sitemap 11, Convex 575 (up from 560), engine 1,076, home 77, prompts 23, platform 300 (up from 290).
  - The same six failures as before, none from this work: three OG-image tests (blocked hosts) and three editorial tests that also fail on `main`.
  - Break-on-purpose: 30 deliberate breakages. 27 were caught on the first run. The 3 survivors were test gaps. The tests used the 24-hour constant itself, so doubling it went unnoticed (it is now pinned as a literal). No test put a replay on a session that had not ended. No test sent `setReplay` a bad link. After adding those cases, all 3 were caught. Examples of the 30: the join link opening at the start or a moment late, a canceled session revived, http or credentialed links, a free member getting the join link or the replay, a join link before the window, everyone counted as entitled, past starts and tiny sessions, unchecked links, no flips scheduled or none after a move, `advance` ignoring the clock, cancel not locking, the page treating everyone as entitled, links in the same tab, analytics carrying the link, the zone not named, and the page or the sidebar link showing without the flag.
  - Schema diff against `origin/main`: only added lines.
- Accessibility: the page for a Builder's Hub member (open, scheduled, ended with and without a replay), for a free member, and empty, rendered to static HTML and checked with axe-core 4 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) and the built CSS at 390 px and 1440 px: 0 violations in all 6 runs, and no horizontal scroll. The Tab walk showed two identical "Join the live build" buttons for a free member, so each action is now also described by its session title.
- Docs updated: `docs/wp/wp64-stories.md` (S8 status), `docs/runbooks/wp64-live-builds.md` (new). Not needed: `.env.example` (no env), `.agentic-workflow.yml` (S4), `docs/wp/AGENT_HANDOFF.md` (owner-managed). PRD 6.5 already points at the ladder, and the live build row is in `BILLING_COMPARISON`.
- Result: S8 built on the branch and pushed (`43aa042`, follow-ups `1a20486`). Not merged. Nothing shows until the flag is on and the operator schedules a session.
- Handed on:
  - Owner: decide O8 (slot, length, tool, capacity, replay hosting, captions, missed months). Then schedule the first session before window 1 opens (S12).
  - S9: the Terms must state one live build a month with a replay, and the missed-month remedy (a make-up session or a one-month extension).
- Gotchas:
  - The feature id and the table share the name `live_builds`, so the static test matches table access (`.query("live_builds")`, `v.id(...)` and so on), not the bare string.
  - `toMatchObject` treats a missing key differently from `undefined`. The cleared-link test checks the key is absent.
  - `vi.useFakeTimers({ toFake: ["Date"] })` moves the server clock for `advance` without stopping convex-test's own timers. The full-scheduler test fakes all timers and runs `finishAllScheduledFunctions`.
- Next: every story that needs only S2 is now built (S6, S7, S8). S3 (checkout) waits on O1, O5 and S9. S9 (Terms) can start any time, but its text needs O1 to O4 and O8, and a lawyer's review before S12.

## 2026-10-09 - Renumber to WP64 and sync

- Actions taken:
  - `main` merged PR #127 from `codex/wp63-navigation-consistency`, which claims WP63 for public navigation consistency and adds its own `docs/wp/wp63-stories.md` and `wp63-progress.md`. WP64 is used nowhere on `main` or on any remote branch, so this package is now WP64.
  - Renamed before merging, so their files are untouched: this file, the stories, the evidence file, the live-builds runbook, six test files, the registry row, and every WP63 label in code, tests and living docs. The renumbering history sentences in this file and in the stories keep the old numbers. Appended the ruling "WP64 / renumbering". Earlier rulings keep their labels.
  - Merged `origin/main` (2 commits). One conflict, in the registry table, resolved by keeping both rows (theirs as WP63, this package as WP64). The WP64 row's status now says what is built.
- Decisions made: WP64, under the owner's delegation of 2026-10-07 to renumber on a collision.
- Checks run: the S8 gate above ran on the merged tree.
- Result: the branch is in sync with `main` at `a80836b`.
- Gotchas:
  - This is the third collision in three days. A registry row protects a number only once it is on `main`. A small docs-only change with the WP64 row, merged to `main`, would stop a fourth.
  - Commits before 2026-10-09 say WP63. Read them as WP64.
- Next: unchanged. S3 waits on O1, O5 and S9.

## 2026-10-09 - WP64-S9 (Terms, refund policy and privacy section)

- Actions taken:
  - Content as data in `lib/legal/content.ts`: the Builder's Hub Terms (13 sections), the refund policy (7 sections) and a privacy section, "Builder's Hub" (renamed from "Payments and Builder's Hub" after PR #129, see below). Prices, the lifetime tranches, the seat count, the plan's features, the refund line and the tax line come from `PRICING` and `PLANS`, so the pages cannot drift from checkout. Where a decision is open, the text is the recommended default from the stories, and the section carries a review note naming the decision (O1, O2, O3, O4, O8, O9), "lawyer" or "owner". Facts only the owner can supply (seller name, address, VAT status, support email) are `{{O2: …}}` gaps, never invented.
  - One approval switch, `MEMBERSHIP_LEGAL_APPROVED` in `lib/legal/status.ts`, off. While off, `/terms`, `/refund-policy` and the new privacy section show in local development only. A production build returns 404 for both pages and leaves the privacy policy exactly as it is. Not tied to the Builder's Hub flag: Stripe needs the Terms live at S12 step 4, before the flag turns on at step 7.
  - Renderer `components/public/LegalPage.tsx` in the privacy policy's layout, with an "On this page" list. While a draft, it shows a banner ("Draft for review. Not in force." and "This is not legal advice."), each section's review notes, and each gap as a highlighted "To be confirmed (O2): …". Drafts are `noindex, nofollow` with their own canonical.
  - Routes `app/(marketing)/terms/page.tsx` and `app/(marketing)/refund-policy/page.tsx`. The privacy policy adds the section before Contact, behind the same switch.
  - The sitemap and the site footer list both pages only once approved, so approval is one reviewed change.
  - Checkout consent sentence for S3 in `app/api/platform/membership/_consent.ts`: `checkoutConsentMessage({ term, origin, lifetimeAmountMinor })` returns one sentence with the price, the renewal and the 30-day refund, linking both pages, for `custom_text.terms_of_service_acceptance.message`. Monthly: "I agree to the [Builder’s Hub Terms](https://weekendmvp.app/terms): $29 a month, renewing every month until I cancel, with a full refund within 30 days of my first payment under the [refund policy](https://weekendmvp.app/refund-policy)." It refuses a lifetime amount that is not a tranche price, and any origin that is not a bare https origin (http only for localhost in test mode).
  - Tests: `tests/platform/wp64-legal.test.tsx` (17).
- Decisions made (mine, reversible, none is a ruling):
  - Approval-gated, not flag-gated, for the S12 order above. A test refuses `MEMBERSHIP_LEGAL_APPROVED = true` while any review note or gap remains.
  - Drafts are visible in local development only, not on previews, because previews are production builds and are off for agent branches anyway.
  - The 30-day window covers the first payment only (O4 default), with a 7-day goodwill refund on a renewal not used since. The lifetime clause is the O3 default: 90 days' notice and a refund that falls evenly to nothing over three years.
  - Consent sentence length is held under Stripe's 1,200 characters by a test, not a runtime throw, so a copy change fails in CI rather than at checkout.
- Checks run on the branch (final, single run):
  - `npm run typecheck` passes. `npm run lint` has 0 errors and 34 warnings, the same count as before. `npm run build` succeeds (437 static pages, two more for `/terms` and `/refund-policy`, which prerender as 404 with no draft title, description or canonical). The built privacy policy does not mention Stripe, so it is unchanged in production.
  - Test stages pass: links 6, redirects 76, auth 146, security (111 node tests and 121 Vitest tests), sitemap 11, Convex 575, engine 1,076, home 77, prompts 23, platform 317 (up from 300).
  - The same six failures as before, none from this work: three OG-image tests (blocked hosts) and three editorial tests that also fail on `main`.
  - Break-on-purpose: 25 deliberate breakages, all caught on the first run. Examples: drafts visible in production, approval with open items, drafts indexable, metadata ungated on either page, gaps shown as plain text or leaking their code, placeholders, list placeholders or review notes not counted, either page or the privacy section ungated, no draft banner, no review notes, no table of contents, http or path-bearing consent origins, any lifetime amount accepted, annual priced as monthly, the refund link dropped, the sitemap or footer listing drafts, and the live build remedy or the lifetime clause dropped from the text.
- Accessibility: the Terms, the refund policy and the privacy policy with its draft section, rendered to static HTML and checked with axe-core 4 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) and the built CSS at 390 px and 1440 px: 0 violations in all 6 runs, and no horizontal scroll. The Tab walk reaches the "On this page" links in reading order with a visible 2 px outline.
- Docs updated: `docs/wp/wp64-stories.md` (S9 status), `docs/PROJECT_STRATEGY.md` (WP64 row). Not needed: `.env.example` (no env), runbooks (approval is a code change, described here and in the stories).
- Result: S9 built on the branch and pushed. Not merged. Nothing changes in production until the owner approves the text.
- Handed on:
  - Owner: supply O2 (seller identity, address, VAT status, support email). Decide O1, O3, O4, O8 and O9, or accept the defaults in the text. Confirm fair use, the notice periods and the two-working-day reply time.
  - Owner and a lawyer or accountant: review the Terms, the refund policy and the privacy section. Then remove each review note and gap, set `MEMBERSHIP_LEGAL_APPROVED = true` in a reviewed commit and update "Last updated". S12 does not pass without this.
  - S3: send `checkoutConsentMessage(...)` as `custom_text.terms_of_service_acceptance.message` with `consent_collection.terms_of_service: "required"`, and pass the reserved seat's tranche amount for lifetime.
  - S10: set the Terms and Privacy URLs in Stripe's public details, turn on the annual renewal reminder (at least 7 days, as the Terms say) and Smart Retries (the Terms say about two weeks).
- Gotchas:
  - `legalPagesVisible()` reads `NODE_ENV` when called, so tests can stub it per case. Next sets it to `production` for every build, previews included.
  - The privacy policy (outside this story) did not mention Stripe, though ship·able used a Stripe Payment Link. Reported to the owner and fixed separately in PR #129, see below.
- Next: S3 waits on O1 and O5 now, not on S9. The text needs the review above before S12.

## 2026-10-09 - Privacy policy Stripe gap (PR #129) and sync

- Actions taken:
  - At the owner's request, a Small Fix outside WP64 on `claude/privacy-stripe-gap`: the live privacy policy gains a "Payments" section for ship·able seats (Stripe Payment Link, the purchase record the legacy webhook stores, Beehiiv enrollment, a link to Stripe's privacy policy), with `tests/platform/privacy-payments.test.tsx`. Merged to `main` as PR #129.
  - Merged `origin/main` into this branch. One conflict, in `app/(marketing)/privacy-policy/page.tsx`, where both sides added a section before Contact. Kept both: the live "Payments" section, then the gated draft.
  - The draft section is now "Builder's Hub" (id `builders-hub`) and covers only what Builder's Hub adds: Stripe Checkout and the billing address, what we store, cohort hashes and live builds. The Stripe link and the card line for ship·able stay in "Payments".
  - `tests/platform/privacy-payments.test.tsx` renders as production, so it checks the live page. `tests/platform/wp64-legal.test.tsx` checks the order in both modes: the live sections in production, and "builders-hub" between "payments" and "contact" in development.
- Decisions made: none beyond the merge.
- Checks run on the merged tree: `npm run typecheck` passes, `npm run lint` has 0 errors and 34 warnings, `npm run build` succeeds (437 pages, and the built privacy policy has the Payments section and no draft). Test stages pass (platform 320, up from 317), with the same six failures as before (three OG-image, three editorial).
- Result: the branch is in sync with `main` at `6dd2668`.
- Next: unchanged. S3 waits on O1 and O5. The Terms text needs the owner's and a lawyer's review before S12.

## 2026-10-09 - WP64-S10 (Stripe setup, test mode) - in progress

- Actions taken:
  - The owner connected Stripe to this session. The connector shows two accounts: WeekendMVP (live) and WeekendMVP sandbox (test). Every call in this story used the sandbox with `livemode: false`. The live account was not read or written.
  - Read first: the sandbox had no products, prices, webhook endpoints or portal configurations.
  - Created in the sandbox: the Builder's Hub and Founding Lifetime products, the four prices ($29 a month, $199 a year, $249 and $349 once) with lookup keys and `purpose` metadata, and a Customer Portal configuration (cancel at period end with a reason, payment method update, invoice history, monthly and annual switch with annual to monthly at renewal, no pause). Stripe turned quantity changes on by default for the portal product, which would let a member hold two seats, so it is now off. Ids are in `docs/wp/evidence/wp64-stripe-setup.md`.
  - `lib/membership/stripe-catalog.ts`: the catalog as data from `PRICING` (products, prices, lookup keys, env names, the twelve S4 webhook events, the pinned API version `2026-05-27.dahlia`) and `reviewPrice`, which S3 calls before each Checkout Session. It returns blocking items (amount, currency, interval, type, mode, archived) and label warnings (lookup key, metadata).
  - `npm run membership:stripe-setup` (`scripts/membership-stripe-setup.mjs`, logic in `scripts/lib/stripe-setup.mjs`): read-only by default, `--apply` creates only what is missing, never edits an amount, never archives or deletes, refuses any key that is not a test key, stops on any live object, prints settings as set or MISSING without values, and strips key-shaped text from errors. Tax code and tax behavior are flags for O1.
  - `.env.example`: the membership env names, empty, so the mode is off.
  - Tests: `tests/security/membership-stripe-setup.test.mjs` (16).
- Decisions made (mine, reversible, none is a ruling):
  - Test mode means the Stripe sandbox, a separate account. Every Dashboard setting must be repeated on the live account in S12 step 3.
  - No tax code and tax behavior `unspecified` until O1, because Stripe lets tax behavior change only once.
  - The portal lets members edit their address and name, not their email, so receipts follow the account email. Tax id waits for O1.
  - The portal asks why a member cancels, for the S12 churn review.
  - The setup script uses its own operator key, `STRIPE_MEMBERSHIP_SETUP_KEY`, because creating products needs more access than the runtime restricted key should have.
- Checks run on the branch: `npm run typecheck` passes, `npm run lint` has 0 errors and 34 warnings, `npm run build` succeeds (437 pages). Test stages pass: security 127 node tests (up from 111) and 121 Vitest tests, platform 320, Convex 575, engine 1,076, home 77, auth 146, redirects 76, sitemap 11, links 6, prompts 23. The same six failures as before (three OG-image, three editorial). The S7 import-isolation test now accepts an explicit `.ts` extension on a read-only module, and still fails on a write module imported that way (checked by hand). Break-on-purpose: 25 deliberate breakages, all caught. The first run had 2 survivors: one was a broken mutation (`[] && x` still runs `x`), the other a real gap, since nothing tested key redaction in errors (now `redactKeys` with its own test). Examples: live keys accepted, unknown arguments ignored, any tax code, live objects ignored, duplicates unreported, a price without metadata, tax behavior always sent or overwritten, a wrong price unreported, apply ignoring a live result, products not filtered by purpose, settings printing values, the portal quantity check, unchecked amount, interval, mode, usage type or metadata, annual billed monthly, shifted env names, a dropped webhook event, API version drift, no pinned version in the CLI, and unredacted errors. Secret-pattern scan of the staged diff: clean (a fake test key is built at runtime so scanners never see a key-shaped literal).
- Docs updated: `docs/wp/evidence/wp64-stripe-setup.md` (new), `docs/wp/wp64-stories.md` (S10 status), `docs/PROJECT_STRATEGY.md` (WP64 row), `.env.example`. Not needed: runbooks (the evidence file holds the owner steps).
- Result: the test-mode catalog and portal exist in the sandbox and match the code. S10 stays open.
- Handed on:
  - Owner, in the sandbox Dashboard: the restricted key with the listed permissions, Smart Retries and failed-payment emails, renewal reminders at least 7 days ahead, receipts, branding.
  - Owner (O2): business name, support email, statement descriptor, Terms and Privacy URLs in public details. Checkout needs the Terms URL to require acceptance.
  - Owner and accountant (O1): the tax path, then `npm run membership:stripe-setup -- --apply --tax-code=... --tax-behavior=...`.
  - S3: read prices by id from the env names, call `reviewPrice` and refuse on any blocking item, pin `MEMBERSHIP_STRIPE_API_VERSION`.
  - S4: subscribe to exactly `MEMBERSHIP_WEBHOOK_EVENTS`. Then run the Stripe CLI forward in the evidence file to close the last S10 item.
  - S5: use the sandbox default portal configuration, or pass its id.
- Gotchas:
  - The connector cannot read account settings (no account retrieve), so branding, public details and email settings are checked in the Dashboard or with the setup script and a key.
  - Stripe's API is blocked from this cloud sandbox, so the setup script was tested against a fake client. The connector did the real calls.
- Next: S3 waits on O1 and O5. The rest of S10 waits on the owner, O1 and O2, and on S4 for the webhook check.

## 2026-10-09 - Owner rulings O1, O2 and the Terms sign-off; Managed Payments checks

- Owner inputs (logged in `docs/wp/RULINGS.md`): tax through Stripe Managed Payments; seller Rulz&Co, support email given, not VAT registered; the S9 Terms signed off by the owner without a separate lawyer review.
- Actions taken:
  - Read Stripe's current Managed Payments documentation through the connector. GB sellers are supported. Products need an eligible tax code and must be "fully automated digital products"; live 1-to-1 coaching is named as ineligible, so the monthly live group build is a grey area (recorded in the ruling as an accepted risk).
  - In the sandbox: set tax code `txcd_10103000` on both products and tax behavior `exclusive` on all four prices. Created a Managed Payments Checkout Session (accepted, tax automatic with Stripe liable). The same session with `custom_text` was rejected, and terms consent was rejected only for the missing Terms URL in public details. The open test session expires unpaid within 24 hours; the connector cannot expire it.
  - Terms, refund policy and privacy section: seller and support email filled in, Link named as merchant of record, review notes removed per the sign-off. Two placeholders remain (business form, postal address), so the pages still 404 in production.
  - `TAX_LINE` now says sales tax or VAT is added at checkout. `lib/membership/stripe-catalog.ts` holds the ruled tax mode, code and behavior; `reviewPrice` blocks a tax-inclusive price; the setup script uses the ruled values by default. `_consent.ts` now says the sentence shows beside our buy button.
  - Stories: S3 records what Managed Payments changes (no `custom_text`, no `billing_address_collection`, Stripe's unsupported parameters), S9 and S10 statuses, and the ruled decisions.
- Decisions made (mine, reversible): tax code SaaS personal use and tax-exclusive prices, both Managed Payments defaults that match the existing price copy. The owner may change the code at any time; the price behavior needs new prices to change.
- Checks run: `npm run typecheck` passes, `npm run lint` has 0 errors and 34 warnings (one new unused-variable warning in a test was fixed), `npm run build` succeeds (437 pages). Test stages pass: security 127 node and 121 Vitest tests, platform 321, Convex 575, engine 1,076, home 77, auth 146, redirects 76, sitemap 11, links 6, prompts 23. The same six failures as before (three OG-image, three editorial). Break-on-purpose: S10 now has 29 deliberate breakages and S9 has 25, all caught. New ones: an inclusive price allowed, the ruled tax code or behavior not the default, and the tax code or behavior never sent. One earlier S10 mutation, "tax behavior always sent", became equivalent once the ruled default always sends it, and was replaced. The sandbox catalog passes `reviewPrice` and the planner finds nothing to do with the ruled settings.
- Result: O1 and O2 are reflected in Stripe (sandbox), the code and the legal text. Nothing live was created or changed.
- Handed on:
  - Owner: business form and a postal address for legal notices (then the legal pages go live). Activate Managed Payments on the live account. Public details in both accounts with the Terms URL. Restricted key, revenue recovery and branding as in the evidence file.
  - S3: build to the Managed Payments rules above.
  - S5: check whether Link sends the 7-day annual renewal reminder the Terms promise; if not, send it ourselves. Check how the portal and Link's order management coexist.
- Next: S3, S4 and S5 can start. O5 (subscriber buying lifetime) is the only open decision S3 needs.

## 2026-10-09 - WP64-S3 (checkout) and O5

- Owner inputs: O5 accepted as recommended (a subscriber may buy lifetime; the subscription then ends at period end, no refund of the current period). Rulz&Co is a limited company in Manchester; the address is on its Google Business Profile, which this session cannot reach, and Companies House is blocked from the sandbox, so the registered name, number and office stay as the last two placeholders. Both logged in `docs/wp/RULINGS.md`.
- Actions taken:
  - `app/api/platform/membership/checkout/route.ts`: auth, a body of exactly `{ term, idempotencyKey }`, configuration that fails closed (`_server.ts`), the signed hand-off to Convex, the per-session price check against `PRICING` (cached five minutes), the Checkout Session with the Stripe idempotency key `membership-checkout:{orderId}`, mode and host checks on the returned session, attaching it, and expiring the member's other open sessions. Answers follow `_contract.ts`.
  - Configuration (`readMembershipBillingConfig`): unset or `off` is 503; `test` or `live` with a key of the same mode; a production deployment (`VERCEL_ENV=production`) refuses `test`; a 32+ character bridge secret; a bare https origin (http only on localhost in test); `MEMBERSHIP_TAX_MODE` of `managed_payments` or `automatic_tax`; four price ids.
  - Session parameters (`checkoutSessionParams`): subscription or payment mode, metadata `purpose`, `order_id` and `term` on the session and on the subscription or payment intent, `client_reference_id`, the customer or a prefilled email (and `customer_creation=always` for lifetime), `expires_at` for lifetime, `consent_collection.terms_of_service=required`, and `managed_payments[enabled]=true`. The Stripe Tax fallback sends `automatic_tax`, a required billing address and the S9 consent sentence instead.
  - `lib/membership-bridge.ts` and `convex/platform/membership/provider.ts`: an HMAC-signed bridge with its own secret. The payload never names the owner; Convex reads the owner from the member's forwarded auth. Fails closed without the secret.
  - `convex/platform/membership/checkout.ts` (internal only): `consumeQuota` (5 a minute, 20 an hour per member, in its own committed step), `begin` and `attachSession`. `begin` checks the verified email, a lost-dispute flag (O9), the idempotency key (same order back, or a refusal when the term, mode, age or status no longer fits), one plan per member for subscriptions, O5 for lifetime, founding eligibility, then reserves the lowest free or lapsed seat in the same mutation, at the seat's tranche price, holding it 35 minutes. A member's second lifetime attempt continues the first hold. A lapsed hold that is taken back expires its order.
  - `convex/convex.config.ts`: optional `MEMBERSHIP_BILLING_BRIDGE_SECRET`. `convex/_generated/api.d.ts` and `server.d.ts` edited by hand (codegen needs a Convex login).
  - Dashboard hook: a refused key is dropped, so a stale attempt never blocks a new one.
  - Checked against the Stripe sandbox through the connector: the exact lifetime and annual session parameters were accepted (evidence file, section 1b). Local test-mode setup steps added (section 1c).
  - Tests: `convex/wp64Checkout.test.ts` (25), `tests/platform/wp64-checkout-route.test.ts` (16), `tests/security/membership-checkout-isolation.test.mjs` (5), one pin in `wp64-surfaces`.
- Decisions made (mine, reversible):
  - The bridge forwards the member's auth instead of signing an owner id, so even a leaked bridge payload can only act for its own sender.
  - A new attempt expires the member's other open sessions, so two paid subscriptions need two tabs and a race; S4 still handles that case.
  - The Stripe Tax path stays in the code behind `MEMBERSHIP_TAX_MODE=automatic_tax`, because Managed Payments eligibility is a known risk.
  - The 23-hour replay limit keeps a retry inside Stripe's 24-hour idempotency window.
- Checks run: `npm run typecheck` passes, `npm run lint` has 0 errors and 34 warnings, `npm run build` succeeds (438 pages, one more for the route). Test stages pass: Convex 600 (up from 575), platform 337 (up from 321), security 132 node tests (up from 127) and 121 Vitest tests, engine 1,076, home 77, auth 146, redirects 76, sitemap 11, links 6, prompts 23. The same six failures as before (three OG-image, three editorial). No schema change. Break-on-purpose: 43 deliberate breakages. 39 were caught on the first run. The 4 survivors were test gaps: a free seat below a lapsed hold, the hold length pinned only by its own constant, open sessions from the other mode, and the server-side bridge secret check. With tests added, all 43 are caught. Examples: unverified email, lost dispute ignored, replays across term, mode, age or a paid order, a second subscription or lifetime, eligibility skipped, holds not reused or never reclaimed, a session outliving its hold, one tranche for every seat, attaching to another member's order or the wrong mode or over another session, no rate limit, a skipped signature, test mode in production, a key of the other mode, an http origin, price drift ignored, custom text under Managed Payments, no terms consent, metadata without the order, a lifetime session that never expires, extra body keys, unknown codes echoed, a session of the wrong mode or host, and expiring the new session.
- Result: S3 built on the branch, dormant: every request answers 503 until the env is set. Nothing granted; S4 grants.
- Handed on:
  - Owner: the Terms URL in Stripe public details (Checkout refuses terms consent without it), the restricted key, then the local test-mode setup in the evidence file. The registered company name, number and office for the Terms.
  - S4: settle `checkout.session.completed` for these orders (order `paid`, grant or subscription row, seat `taken`), `checkout.session.expired` (order `expired`, seat `free`), O5 (set the old subscription to cancel at period end after a lifetime payment), and a second paid subscription (cancel and refund it). Record the Stripe customer in `billing_customers`.
  - A surface that offers lifetime to a subscriber must say, before checkout, that the subscription ends at period end with no refund of the current period (O5).
- Next: S4 (webhooks), then S5 (portal), then S11.

## 2026-10-09 - WP64-S4 (webhooks, settlement and daily reconcile)

- Owner input: "Go ahead" after S3. No new ruling needed. O5 and O9 drive the follow-ups.
- Actions taken:
  - `app/api/platform/membership/webhook/route.ts`: reads the raw body (capped at 512 KB), verifies it with `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`, refuses an event whose `livemode` differs from the key's mode, answers 200 for an event type outside the twelve, fetches the current Stripe object, settles it in Convex through the signed bridge, then makes the Stripe calls settlement asks for. 400 for a bad request, 200 once settled or not ours, 500 for anything that failed part way, so Stripe retries. A failed settlement or follow-up is never acknowledged.
  - `readMembershipWebhookConfig` in `_server.ts`: the key prefix sets the mode, a set `MEMBERSHIP_BILLING_MODE` must agree, `off` or unset still settles (contract 11), a production deploy refuses a test key, and it needs a `whsec_` secret, the bridge secret and four distinct price ids.
  - `_events.ts`: thin event, fat fetch on the pinned API version. Checkout Sessions with line items (one line at one of our Prices, or the Price is unknown), subscriptions (period end from the subscription item, in milliseconds; a cancel date counts as ending), invoices re-read and followed through `parent.subscription_details` (so the endpoint's own API version never matters), refunds and disputes through the payment's own metadata (lifetime) or `invoicePayments` to the invoice to the subscription. A dispute's outcome comes from its current status, so a late `created` event settles as whatever happened since. Anything without our `purpose` is 200 with no write.
  - Follow-ups (`performFollowUps`): refund in full (`membership-refund:{payment}`), cancel now (`membership-cancel:{subscription}`), cancel at period end for O5 (`membership-cancel-at-period-end:{subscription}`), and for a second subscription, refund its latest paid invoice and then cancel it. Each reads Stripe first and does nothing when the work is already done, so a retry is safe after the 24-hour idempotency window too.
  - `convex/platform/membership/events.ts` (internal only): `settle` records each event id once in `billing_events` and applies it in the same transaction. Owners come from our orders, subscription rows and customer links; metadata only points at an order we created. Subscription snapshots never let an older fetch overwrite a newer one. Lifetime: the paid Price and quantity must match the order, the seat must be held by this order or still free, and the member must not hold another seat; otherwise the order fails and the payment is refunded. Refunds and disputes follow O9 and contract 9. Follow-ups are worked out from stored state on every delivery, including a duplicate, so a failed Stripe call is retried when Stripe redelivers. Also `applySnapshot`, `releaseExpiredHolds`, `runningSubscriptionIds`, the operator `counts` and `clearReview`.
  - `app/api/platform/membership/reconcile/route.ts` and the `vercel.json` cron (04:17 UTC daily): bearer `CRON_SECRET`, compared in constant time. Frees lapsed holds, pushes a fresh snapshot of every membership subscription Stripe lists as active or past due at our two subscription Prices (1,000 at most), then re-reads any we think runs that Stripe no longer lists. Does nothing and answers 200 until `CRON_SECRET` and the webhook config are set.
  - `lib/membership-bridge.ts` and `provider.ts`: four server-only kinds (`event`, `subscription_snapshot`, `release_expired_holds`, `running_subscriptions`) with exact keys and an `issuedAt` stamp. Convex refuses one more than five minutes old or ahead. The size cap is now 4,096 characters. Convex validators check every event field.
  - `checkout.ts` `begin`: a dispute that is still open, on a grant or a subscription, now answers `ACCOUNT_REVIEW` too, as does a lost one on a subscription.
  - `.agentic-workflow.yml`: critical flows `membership_checkout_webhook_entitlement_exactly_once` and `founding_seat_cap_never_exceeded`.
  - Tests: `convex/wp64Webhooks.test.ts`, `tests/platform/wp64-webhook-route.test.ts` (Stripe's own signing code, everything else faked), `tests/security/membership-webhook-isolation.test.mjs`, and updated pins in `membership-checkout-isolation` (settlement may take or free a seat, never reserve one) and `membership-tables-isolation` (type-only imports may name any module).
- Decisions made (mine, reversible):
  - No new index on `plan_subscriptions`: the data contract froze its indexes, so the reconcile reads the newest 1,000 rows and reports `capped` if it hits the limit. A capped run skips the re-read step, so an unscanned subscription is never treated as stopped.
  - A payment from a Stripe customer already linked to another member fails its order, so a lifetime payment is refunded and a subscription canceled rather than kept without access.
  - A rejected lifetime payment frees its seat at once instead of waiting for the hold to lapse.
  - A second running subscription is refunded first, then canceled. If the cancel fails, the refund's own event cancels it, and a retry finds the refund already made.
  - Under Managed Payments, Stripe may refund within 60 days and answers disputes itself. Settlement follows the money, so those reach the member's access the same way ours do.
- Checks run: `npm run typecheck` passes, `npm run lint` has 0 errors and 34 warnings, `npm run build` succeeds (440 pages, two more for the routes). Test stages pass: Convex 632 (up from 600), platform 387 (up from 337), security 139 node tests (up from 132) and 121 Vitest tests, engine 1,076, home 77, auth 146, redirects 76, sitemap 11, links 6, prompts 23. The same six failures as before (three OG-image, three editorial). No schema change. Break-on-purpose: 94 deliberate breakages on the first run, 89 caught. The 5 survivors: no test changed the quantity on a stored subscription, none put an ended subscription beside a new one, none cleared a lost lifetime dispute, the body-cap test used a bad signature so it got 400 either way, and the route and the normalizer both skipped unhandled event types (the route's copy is gone). With tests added, all 95 are caught (the duplicate check's mutant now targets the one that remains, plus one for re-reading invoices). Examples: idempotency off, a stale or equal snapshot applied, a row or order from the other mode accepted, the Price, quantity or customer unchecked, the dispute flag wiped by a snapshot, a seat stolen, retaken or held twice, a partial refund revoking, a refund keeping the grant or seat, disputes not suspending, restoring or flagging, follow-ups missing or repeated, the newest subscription kept, live holds released, freshness or exact keys skipped on the bridge, a mode or key mismatch accepted, follow-ups skipped or a failure acknowledged, foreign purposes settled, seconds instead of milliseconds, a cancel date ignored, two line items read as one Price, the dispute or refund state taken from the event, refunds without a key or made twice, an ended subscription canceled again, a duplicate canceled before its refund, and a reconcile without auth or past its cap.
- Result: S4 built on the branch, dormant. Nothing settles until the webhook env is set, and nothing is live.
- Handed on:
  - Owner: the Stripe CLI run in test mode (evidence step 2), then `CRON_SECRET` and the live endpoint at API version `2026-05-27.dahlia` at S12.
  - S11: confirm refunds and cancels through the API under Managed Payments, and whether the restricted key needs a separate Invoice payments permission.
  - S5: the portal. Settlement already handles what the portal changes (cancel at period end, plan switch, payment method), and what members change on Link's order page under Managed Payments, through `customer.subscription.updated`.
- Next: S5 (portal), then S11.
