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
