# WP63 Progress - Builder's Hub Billing (Subscriptions, Annual And Founding Lifetime)

> Renumbered twice (see `docs/wp/RULINGS.md`): WP55 became WP62 on 2026-10-07 because a local
> Codex branch, `codex/wp55-price-acceptance`, already uses WP55. WP62 became WP63 on 2026-10-08
> because `main` took WP62 for the public idea SEO summary. Entries dated before 2026-10-08 keep
> the old WP55 or WP62 labels and the old `wp55-*` and `wp62-*` file names. Read them as WP63.

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

## 2026-10-08 - WP63-S1 (legacy webhook guard and signed payment-log hand-off)

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

## 2026-10-08 - WP63-S2 (plan model, membership tables, entitlement resolver)

- Actions taken:
  - Merged `origin/main` first (3 commits, PR #123, which added two tables to `convex/schema.ts`). No conflicts. Checked open pull requests for another schema writer: none touched in the last week, so this branch holds the schema writer slot until it merges.
  - `PRICING` in `convex/platform/plans.ts`: monthly 2,900, annual 19,900, lifetime tranches 1 to 15 at 24,900 and 16 to 50 at 34,900 (minor units, USD). Helpers: `lifetimeTrancheForSeat`, `amountForPriceKey`, `formatUsd`, `ANNUAL_SAVING_PERCENT` (43). `PLANS.builders_hub.priceMonthlyUsd` and `priceLabel` now derive from it and read exactly as before, so no copy changes until S6.
  - Six tables appended to `convex/schema.ts` with the contract's indexes: `billing_customers`, `plan_subscriptions`, `membership_orders`, `plan_grants`, `founding_seats`, `billing_events`. No existing table, field or index changed (`git diff origin/main -- convex/schema.ts` shows only added lines).
  - `convex/platform/membership/state.ts` (read-only, clock-free): `readMembershipState` reads at most 25 grants and 25 subscriptions per owner, newest first, and `deriveMembership` picks the plan and the billing summary. `resolvePlan` now returns its plan. `entitlements.mine` also returns `billing` (term, status, renewsAt, endsAt, foundingSeat). `countSeats` reads at most 51 seat rows.
  - Operator-only internal mutations: `membership/seats:seed` (dry run unless `apply: true`, inserts missing seats only, refuses a bad or duplicate seat number) and `membership/comp:grant` and `:revoke` (comp grants only, never lifetime).
  - Tests: `convex/wp63Membership.test.ts` (34: ladder, schema indexes and no arrays, the resolver matrix, precedence, isolation, no Stripe ids in `mine`, seed and comp) and `tests/security/membership-tables-isolation.test.mjs` (6 static pins). One WP54 test fixture gained the new `billing` field.
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
- Docs updated: `docs/wp/wp63-stories.md` (S2 status, data contract clarifications, and a new S3 criterion that production refuses `test` mode), `docs/wp/wp44-dashboard-prd.md` 9.3 and 9.4 (pointers to the resolver and to WP63), and the `PRICING` comment in `plans.ts`. Not needed: `.agentic-workflow.yml` (the critical flows land with S4), the env lists in `docs/runbooks/2026-cutover.md` (S2 adds no env), `.env.example` (same reason), and `docs/wp/AGENT_HANDOFF.md` (owner-managed).
- Result: S2 built on the branch and pushed (`8bc6831`). Not merged or deployed. The box stays open until the merge, because the schema only reaches Convex then.
- Gotchas:
  - Union validators on a table break `convex/referenceTables.ts`, which spreads `.fields` from every table validator. Grants and seats are flat objects for that reason.
  - The first version of the static "no public registration" pin matched `ctx.db.query(`. It now ignores a call preceded by a dot.
  - `npx convex codegen` still needs a login. `convex/_generated/api.d.ts` gained four lines by hand. `dataModel.d.ts` derives from the schema and needed nothing.
- Next: S3 (Checkout Sessions) needs O1 for the tax mode and O5 for lifetime-while-subscribed, plus S9 for the consent text. S6, S7 and S8 can start on top of S2. S7 and S8 add `offer_cohorts` and `live_builds`, so they should land in this same schema window or wait for the next one.
