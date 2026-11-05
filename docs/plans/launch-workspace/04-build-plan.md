# Launch Workspace — phased build plan

**Status:** Ruled 2026-11-05. Work-package numbers WP67–WP87 are reserved (D14); the
registry rows reach `main` with the plan PR. Lanes are defined in
`05-lanes-codex-claude.md`; every WP below names exactly one lane.

**Lanes:** **Codex** = Platform & Money (data, ledger, billing, metering storage,
limits, publishing, sending, connectors, crons, ops). **Claude** = Crew & Experience
(AI gateway, prompts, generators, Wren, approvals, wizard, workspace UI, Studio, evals).

---

## 1. Shape of the program

| Phase | Weeks | What ships | Gate | Release |
|---|---|---|---|---|
| 0. Decide and freeze | W0–W1 | Rulings, reserved numbers, schema contract, artifact contracts, measured costs | G0 | — |
| 1. Foundations | W1–W2 | Metering and budgets, AI gateway, ledger v2, workspace shell and components | G1 | — |
| 2. The free weekend | W2–W5 | Wizard, crew pipelines, Wren and approvals, publishing, tenant email | G2 | **L1: private beta** (≤ 50 founders, allowlist) |
| 3. Money | W5–W7 | Monthly credits on Builder's Hub, paywall and upgrade, Growth in test mode | G3 | **L2: credits live** |
| 4. Studio | W6–W8 | Images (standard and HD), video behind a flag | G4 | **L3: public launch** (free weekend + Builder's Hub credits + Studio images) |
| 5. Distribution | W8–W10 | Autopilot, native Instagram/Facebook, Meta ads on the founder's account, outbound sends | G5 | **L4** (only if Meta review has passed) |
| 6. Scale | W10–W12 | Growth live, members, three businesses, custom domains, hire skipped roles | G6 | **L5** |
| 7. Program gate | W12 | Full regression, load, cost, security and accessibility review | G7 | Program close |

**Suggested calendar** (W0 starts Monday 2026-11-09): L1 on Friday 2026-12-18. The
two holiday weeks (2026-12-21 and 2026-12-28) are buffer, not build weeks, so W6 starts
2027-01-04, L3 lands about 2027-01-22, and the program closes about 2027-02-19.

```
         W0   W1   W2   W3   W4   W5 │hol hol│ W6   W7   W8   W9   W10  W11  W12
Codex    68───70───78─────────79────80───────80───83────────────85────────87
              73─────────────────────────────────────────────────────────
Claude   67   71───74───75─────────77────81───82────────84──────86────────87
         69   72─────────76──────────────────
Gates        G0   G1                  G2              G3   G4        G5        G6/G7
```

Each lane runs at most **two WPs at once**, in separate worktrees, and only when
their file sets don't overlap (§3).

## 2. Contracts

Phase 0 freezes these. A change after G0 follows the contract-change rule in `05`
§5: the owning lane proposes, the other lane acknowledges, then it merges.

| Id | Contract | Owner | Lives in | Consumers |
|---|---|---|---|---|
| C-DATA | All new tables and the WP22 union amendments | Codex (WP68) | `convex/schema/*.ts` | Everyone |
| C-AUTHZ | `requireBusinessAccess(ctx, projectId, minRole)` | Codex (WP68) | `convex/platform/authz.ts` | Every workspace function |
| C-OPS | `getOpsSettings`, `assertFeatureEnabled(ctx, feature)` | Codex (WP68) | `convex/ops/settings.ts` | Every new mutation and action |
| C-ART | Artifact schemas: BrandKit, LandingSpec, EmailSequence, SocialPack, SeoPack, LaunchPlan, AdsDrafts, BuildPack, RosterPlan, Blueprint | Claude (WP69) | `lib/workspace/contracts/artifacts.ts` (zod) | Generators, renderer, sender, connectors |
| C-JOBS | Job types, credit prices, free-round rule, plan feature keys | Claude (WP69) | `lib/workspace/contracts/jobs.ts` | Ledger, paywall, generators |
| C-PROMPT | `PromptSpec` type, tier names | Claude (WP69) | `lib/workspace/contracts/prompts.ts` | Gateway, evals |
| C-METER | `reserve`, `settle`, `fail` signatures and error codes (`BUDGET_EXHAUSTED`, `AI_DISABLED`) | Claude defines (WP69), Codex implements (WP70) | `lib/workspace/contracts/metering.ts` | Gateway |
| C-LIMITS | Named limits and `checkLimit(ctx, name, key)` | Codex (WP70) | `convex/platform/limits.ts` | Chat, jobs, wizard, Studio, publish |
| C-LEDGER | `debitJob`, `refundJob`, `creditsSummary`, grant functions | Codex (WP73) | `convex/platform/billing/ledger.ts` (+ `grants.ts`) | Jobs, meter, paywall |
| C-APPROVAL | `createApproval`, `decideApproval`, `assertApproved(ctx, approvalId, subject)` | Claude (WP77; table in WP68) | `convex/workspace/approvals.ts` | Publishing, email, social, ads |
| C-SITE | `publishLanding(projectId, siteVersionId, approvalId)` (internal) | Codex (WP78) | `convex/platform/sites/publish.ts` | Landing review UI |
| C-EMAIL | `activateSequence(sequenceId, approvalId)`, send-state queries | Codex (WP79) | `convex/growth/email/*` | Email UI |
| C-CONNECT | `SocialConnector`, `AdsConnector` interfaces and `CopyConnector` | Codex (WP68 types, WP83 real) | `convex/growth/connectors/types.ts` | Social and ads UI, Autopilot |
| C-SHELL | Workspace shell slots, nav entries, credit meter props | Claude (WP72) | `components/platform/shell/*`, `components/workspace/shell/*` | Every workspace page |

## 3. File ownership in one table

Full rules are in `05`. In short:

| Area | Codex owns | Claude owns |
|---|---|---|
| Convex | `convex/schema.ts`, `convex/schema/*`, `convex/convex.config.ts`, `convex/http.ts`, `convex/crons.ts`, `convex/platform/**`, `convex/ai/metering.ts`, `convex/ai/budgets.ts`, `convex/ops/**`, `convex/growth/email/**`, `convex/growth/connectors/**` | `convex/ai/**` (except metering and budgets), `convex/crew/**`, `convex/workspace/**`, `convex/studio/**`, `convex/growth/drafts/**` |
| Next.js | `app/api/**`, `app/admin/ops/**`, `app/u/**`, `middleware.ts`, `vercel.json`, `components/platform/{billing,plan}/**` | `app/start/**`, `app/dashboard/b/**`, `app/site/**`, `components/workspace/**`, `components/tenant-site/**`, `components/platform/shell/**`, idea-page and homepage CTA components |
| Shared | `package.json` and lockfile (every known dependency lands in WP68; later additions are requested from Codex), `.env.example` | `lib/workspace/contracts/**`, `evals/**`, `docs/plans/launch-workspace/**` |

---

## Phase 0 — Decide and freeze (W0–W1)

### WP67 — Program setup and rulings
**Lane:** Claude (orchestrator, high) with the owner · **Weeks:** W0 · **Depends on:** nothing

- S1 Docs-only PR to `main`: reserve WP67–WP87 in `docs/PROJECT_STRATEGY.md`, add
  `docs/wp/wp67-program-manifest.md`, `wp67-stories.md`, `wp67-progress.md`.
- S2 Walk the owner through `06-decisions.md`; record each answer as a dated row in
  `docs/wp/RULINGS.md` (append-only). D1–D6, D11, D14, D19 and D21 before G0.
- S3 Owner starts the long-lead items: Meta business verification and app review
  (D7, D8), the tenant Resend domain (D6), wildcard DNS plan (D2), Terms review for
  credits.
- S4 Freeze the manifest once rulings land; later scope changes need an owner ruling.

**Acceptance:** numbers reserved on `main`; rulings recorded; manifest frozen.

### WP68 — Data contract and ops switches
**Lane:** Codex (high) · **Weeks:** W0–W1 · **Depends on:** D19, D21 ruled
**Owns:** `convex/schema.ts`, `convex/schema/{workspace,ai,growth}.ts`,
`convex/platform/validators.ts` (union amendments), `convex/platform/authz.ts`
(`requireBusinessAccess`), `convex/ops/settings.ts`, `convex/growth/connectors/types.ts`,
tests.

- S1 Split new tables into `convex/schema/*` modules spread into `schema.ts`; add
  every table in `02` §4.2 with its indexes. No function writes them yet.
- S2 Additive WP22 amendments (`02` §4.1): new task, step and document literals,
  ledger reasons, optional fields. Existing tests stay green unchanged.
- S3 `requireBusinessAccess` (owner only), with `RESOURCE_NOT_FOUND` for others.
- S4 `ops_settings` singleton and `workspace_cohort`, super-admin mutations to change
  them, `assertFeatureEnabled`. Defaults: everything off.
- S5 Connector interfaces (types only) and `CopyConnector`.
- S6 Security tests: every new table has an owner index; every new public function
  calls `requireBusinessAccess` or `requireSuperAdmin` (static check in
  `tests/security`).
- S7 Add every dependency the program already knows it needs, unused for now:
  `@anthropic-ai/sdk`, `@convex-dev/sharded-counter`, `@convex-dev/resend`. Later
  additions are requested from Codex, so `package.json` keeps one writer.

**Acceptance:** `convex deploy` to a dev deployment succeeds; the production schema
diff is additive only (checked by hand in the PR); all checks pass.

### WP69 — Crew contracts and the cost spike
**Lane:** Claude (high) · **Weeks:** W0–W1 · **Depends on:** D11, D15 ruled
**Owns:** `lib/workspace/contracts/**`, `convex/crew/roles.ts`, `evals/crew/corpus/**`,
`docs/plans/launch-workspace/03-ai-cost-model.md`, spike scripts on the branch.

- S1 zod schemas for every artifact (C-ART), with the canvas fields, the
  `placeholder` flag on proof elements, and limits (character counts, item counts).
- S2 Job types, credit prices from strategy §6, free-round rule, plan feature keys
  (C-JOBS); `PromptSpec` (C-PROMPT); `reserve` / `settle` / `fail` signatures (C-METER).
- S3 Role catalogue and hiring rules as pure functions, with tests for HydroTrail
  (9 hired, 4 skipped with reasons) and a course idea (different team).
- S4 The measurement spike in `03` §10 (**owner approves the $25 spend first**).
- S5 Update `03-ai-cost-model.md` with measured numbers; propose price or budget
  changes to the owner if any estimate is off by more than 30%.

**Acceptance:** contracts merged (types only, no runtime); spike results recorded.

### Gate G0
D1–D6, D11, D14, D19, D21 ruled. WP68 and WP69 merged dormant. Spike measured and
prices frozen in C-JOBS. Codex has reviewed C-METER and C-ART; Claude has reviewed
C-DATA. `npm run typecheck`, `lint`, `test`, `build` pass on `main`.

---

## Phase 1 — Foundations (W1–W2)

### WP70 — Metering, budgets and runtime plumbing
**Lane:** Codex (high) · **Weeks:** W1–W2 · **Depends on:** WP68, C-METER
**Owns:** `convex/convex.config.ts` (mount `@convex-dev/workflow`,
`@convex-dev/workpool`, `@convex-dev/sharded-counter` and `@convex-dev/resend` in one
change), `convex/ai/metering.ts`, `convex/ai/budgets.ts`, `convex/platform/limits.ts`,
`convex/ops/spend.ts`, `convex/crons.ts` (sweeper, spend alarm).

- S1 Mount the four components. Env entries added as optional only.
- S2 `reserve`: kill switch, global daily budget (sharded counter), owner free
  lifetime ceiling, owner daily cap; inserts `ai_usage` and raises
  `ai_budgets.reservedMicroUsd`. `settle` and `fail` are idempotent by `usageId`.
- S3 Concurrency tests: parallel reservations never exceed the ceiling; settle twice
  is a no-op; a failed call with possible billing charges the worst case.
- S4 Stale reservation sweeper (15 minutes) and spend alarms (80%, 100%).
- S5 All rate-limit definitions in `limits.ts` (`02` §13) with `checkLimit`.
- S6 Ops queries for the console (spend by model, prompt, plan; top spenders).

**Acceptance:** fixture-mode test drives reserve → settle and reserve → fail end to
end; budgets enforced; checks pass.

### WP71 — AI gateway, prompt registry and evals harness
**Lane:** Claude (high) · **Weeks:** W1–W2 · **Depends on:** WP68, WP69; C-METER from WP70
(stubbed until WP70 merges)
**Owns:** `convex/ai/{gateway,router,registry,pricing}.ts`, `convex/ai/providers/**`,
`convex/ai/prompts/**`, `convex/crew/seeds.ts`, `evals/crew/**`,
`scripts/check-prompt-versions.mjs`, `scripts/crew-seeds.mjs`, `tests/security/ai-imports.test.*`.

- S1 Provider adapters (Anthropic SDK, OpenAI Images, Recraft) with injectable
  fetch, fixture mode by default, dated rate cards, conservative usage fallback,
  timeouts.
- S2 Gateway action (`02` §5.1): spec → reserve → call → validate → settle, one
  re-ask on schema failure, refusal → failed.
- S3 Router tiers and the registry; CI script that fails on a prompt change
  without a version bump; security test that provider SDKs are imported only in
  `convex/ai/providers`.
- S4 Cache layout helper; a manual live test that the second call reads the cache.
- S5 Seed precompute on the Batch API into `idea_crew_seeds`; run for the 5 spike
  ideas, then all library ideas once G1 passes (≈ $50, owner OK).
- S6 Eval harness: deterministic graders in CI (fixture mode), live judge runner with
  a spend cap, results files.

**Acceptance:** a fixture-mode gateway call writes a settled `ai_usage` row through
Codex's metering; CI graders run; no live call is possible with the kill switch on.

### WP72 — Workspace shell and component kit
**Lane:** Claude (mid) · **Weeks:** W1–W3 · **Depends on:** WP68 (C-OPS for the flag)
**Owns:** `app/dashboard/b/[projectId]/**` (scaffold), `components/workspace/**`,
`components/platform/shell/**`.

- S1 Route scaffold for every workspace page, 404 unless the flag is on and the
  caller owns the business.
- S2 Shell: business switcher, credit meter (reads `creditsSummary`; mocked until
  WP73), nav entries from canvas row 02.
- S3 Components from canvas row 05: employee card, status pill (text label always),
  approval card (Looks good / Ask for changes, cost badge), Wren thread and cards,
  workstream panel, empty, loading and error states.
- S4 Component tests (vitest) and the a11y-check skill on each component.

**Acceptance:** kit renders behind the flag with fixture data; a11y-check passes;
existing dashboard pages unchanged.

### WP73 — Ledger v2 and plan catalogue
**Lane:** Codex (high) · **Weeks:** W1–W3 · **Depends on:** WP68, C-JOBS
**Owns:** `convex/platform/billing/{ledger,grants,transitions,queries}.ts`,
`convex/platform/{plans,entitlements}.ts`, tests.

- S1 Buckets (`allowance`, `bonus`), `bucketSplit` on debits, refund to the same
  buckets.
- S2 `starter_grant`, `plan_grant`, `allowance_expiry` as internal mutations with the
  idempotency keys in `02` §7. No trigger wired yet (WP80 wires Stripe).
- S3 Refund for `cancelled` as well as `failed` tasks, exactly once.
- S4 `PLAN_LIMITS` rows from `02` §4.3, `growth` plan id (dormant: no price maps to
  it yet), feature checks for workspace features.
- S5 `creditsSummary` query for the meter.
- S6 Property test: after any sequence of grants, debits, refunds and expiries, the
  sum of ledger entries equals the balance and no bucket goes negative except by
  dispute.

**Acceptance:** existing `billing.test.ts` unchanged and green; new tests green.

### Gate G1
Fixture-mode end to end: create a test business → gateway call → metered, settled →
a job debits and refunds exactly once. Shell renders behind the flag. Independent
review (other lane) of WP70 and WP73. All checks pass. Nothing user-visible on
production.

---

## Phase 2 — The free weekend (W2–W5)

### WP74 — Wizard and business creation
**Lane:** Claude (mid-high) · **Weeks:** W2–W3 · **Depends on:** WP71, WP72, WP73
**Owns:** `app/start/**`, `convex/workspace/{wizard,business,signals}.ts`, the
"Build this idea, free" CTA components on idea pages and the homepage.

- S1 Eight steps (strategy §4; no SMS step while D10 is deferred) with suggested defaults from seeds; back, skip and
  rewrite on every step; progress kept in `wizard_sessions`.
- S2 Founder signals logged per step (`kept` / `changed` / `skipped` / `rewrote`).
- S3 Own idea: light blueprint (D15), labelled "Not yet validated".
- S4 Creating the business: one free business per verified account (C-LIMITS,
  entitlements), disposable-domain refusal, tenant slug from the name checked
  against reserved names and existing slugs.
- S5 CTAs behind the flag: hero and Idea of the week, and the build-first account
  card on `/ideas/{slug}` that returns to the wizard after sign-in. SEO rules in the
  project CLAUDE.md still hold (headings keep their words; server-rendered content).
- S6 a11y-check on every step; keyboard-only run-through.

**Acceptance:** a signed-in member goes idea → Meet your co-founder in under three
minutes on fixture data; signals recorded; existing idea pages unchanged with the flag off.

### WP75 — Crew engine: roster, launch workflow, brand, landing, build pack
**Lane:** Claude (high) · **Weeks:** W3–W5 · **Depends on:** WP71, WP73, WP74
**Owns:** `convex/crew/**`, `convex/ai/prompts/{blueprint,brand,landing,buildpack,quality,policy}*`,
`app/site/**`, `components/tenant-site/**`, workspace pages for Team HQ, brand kit,
landing review and build pack.

- S1 Roster at "Meet your co-founder": `roster_plans`, `crew_members`.
- S2 Launch workflow on a workpool (`02` §6.2), job keys, executor retry classes.
- S3 Generators: blueprint personalisation, brand kit text + 3 logo marks (contrast
  check in code), landing spec with waitlist, build pack (compile + personalise,
  every prompt passes standard v1).
- S4 Quality and "never fake it" checks after each generation; one repair call.
- S5 Tenant renderer: `LandingSpec` → fixed section components, AA contrast from the
  brand kit, waitlist form wired to `/__lead` (preview mode until D5).
- S6 Pages: Team HQ (live status), brand kit and Brand Book, landing review (desktop
  and mobile preview), build pack (4 phases, 8 prompts, copy buttons like
  `CopyPromptButton.tsx`).

**Acceptance:** fixture launch for HydroTrail produces every artifact and an
`artifact_review` approval for each; live run on 5 ideas within the spike's cost; a11y.

### WP76 — Growth drafts: email, social, SEO, launch plan, ads
**Lane:** Claude (mid) · **Weeks:** W3–W5 · **Depends on:** WP75 S2 (workflow), C-CONNECT
**Owns:** `convex/growth/drafts/**`, `convex/ai/prompts/{email,social,seo,plan,ads}*`,
workspace pages for Email, Social, SEO, Launch plan, Tasks, Ads (drafts).

- S1 Email sequence draft (4 emails) into `sequences` / `sequence_steps` as drafts.
- S2 Social pack (7 posts, one call), `social_posts` → `copy_ready` through
  `CopyConnector`; copy buttons and character counts per platform.
- S3 SEO pack and first article; keyword numbers only from DataForSEO records.
- S4 Launch plan items with owners and days; approve-all creates one approval per item.
- S5 Ads drafts with deterministic readiness checks (site live, waitlist working,
  budget set, creative approved); no launch button until Phase 5.
- S6 Tasks page (everything waiting on the founder) and a11y-check.

**Acceptance:** every growth artifact exists as an approvable draft for HydroTrail;
nothing sends or posts.

### WP77 — Wren chat and the approvals loop
**Lane:** Claude (high) · **Weeks:** W3–W5 · **Depends on:** WP71, WP72, C-LIMITS
**Owns:** `convex/workspace/{approvals,chat,memory,files}.ts`,
`convex/ai/prompts/wren*`, workspace Dashboard, chat panel, Files ("What Wren knows").

- S1 Approvals: create, decide, expire; `assertApproved` (C-APPROVAL) re-checks the
  subject's version.
- S2 Change rounds: two free per artifact, then a credit card with the price; spend
  approval before any debit.
- S3 Wren chat: streaming by deltas, Haiku first, Sonnet for plan-changing turns,
  escalations capped, daily caps with a calm "tomorrow" card; approval clicks don't count.
- S4 Wren's tools only create cards (approval, explain, navigate). No tool sends,
  posts, spends or publishes.
- S5 Memory summary and facts; Files page shows them; founder can edit or delete a fact.
- S6 Live region for new messages, focus handling on cards, a11y-check.

**Acceptance:** a founder can run the whole weekend from the chat and the cards;
prompt-injection corpus cases cannot trigger a side effect.

### WP78 — Publishing un-park (WP29/30/31 slices)
**Lane:** Codex (high) · **Weeks:** W2–W5 · **Depends on:** D2, D5; WP68; C-APPROVAL
from WP77 (stub until then)
**Owns:** `convex/platform/sites/**`, `middleware.ts` (tenant path), `lib/tenant-*.ts`,
`app/api/**` lead routes, `app/admin/ops/**` (takedowns), retention crons.

- S1 `publishLanding` checks: approved `publish` approval, policy check (calls the
  gateway with Claude's `policy` prompt), reserved names, publish rate limit, kill switch.
- S2 Takedown: super-admin action, audit event, Global Config takedown list read by
  middleware first; fail-open kept for everything else.
- S3 Wildcard DNS and certificate activation runbook; verified on a test slug.
- S4 Real lead capture after D5: consent text and version, double opt-in hook for
  WP79, founder CSV export, per-lead delete, 30-day purge after business deletion.
- S5 Security tests: unapproved publish fails; taken-down slug is never served,
  including when Convex is unreachable.

**Acceptance:** an approved HydroTrail page is live on `{slug}.weekendmvp.app` on a
test deployment; takedown works in under a minute.

### WP79 — Tenant email engine
**Lane:** Codex (high) · **Weeks:** W3–W5 · **Depends on:** D5, D6; WP68; WP76 S1 (drafts)
**Owns:** `convex/growth/email/**`, `convex/http.ts` (delivery webhook),
`convex/crons.ts` (sender), `app/u/**`. The Resend component is already mounted by WP70.

- S1 Configure the mounted Resend component for the tenant project; optional env entries.
- S2 `activateSequence` after an approved `send` approval; per-step approval honoured.
- S3 Sender cron every 5 minutes with idempotency keys, plan caps (Free 50 lifetime).
- S4 Double opt-in, unsubscribe page `/u/{token}`, postal address required before
  the first send.
- S5 Delivery webhook: bounces and complaints pause the sequence and tell Wren.
- S6 Tests: no send without approval, opt-in and address; no duplicate sends on retry.

**Acceptance:** an approved four-email sequence sends to a test inbox on schedule;
unsubscribe stops the next step.

### Gate G2 → L1 private beta
- 20 live test launches (owner's test accounts) across library and own ideas:
  median AI cost ≤ $0.75, p90 ≤ $1.20; every artifact passes deterministic graders.
- Landing page live within 15 minutes of "Meet your co-founder" for 18 of 20.
- Independent security review (other lane's high model) of approvals, publishing,
  email, authorization and the gateway.
- a11y-check on every new page; keyboard and screen-reader pass of the full journey.
- Kill switches tested on production with the cohort empty.
- Runbook: turning the cohort on and off, takedown, budget raise, refund by hand.
- Owner turns on `cohortMode: allowlist` for up to 50 founders.

---

## Phase 3 — Money (W5–W7)

### WP80 — Credits live and the Growth plan
**Lane:** Codex (high) · **Weeks:** W5–W7 · **Depends on:** WP73; D1, D1b, D1c, D16
**Owns:** `convex/platform/membership/**`, `app/api/platform/membership/**`,
`components/platform/{billing,plan}/**`, `vercel.json`, Stripe objects (test, then live
with owner approval), Terms drafts for credits.

- S1 Paid invoice → allowance expiry + grant via `events.settle` (idempotent by invoice).
- S2 Lifetime and comp grants from a daily cron (D1b).
- S3 Reconcile fills missed grants; tests replay duplicated and out-of-order events.
- S4 Growth product and prices in test mode; `deriveMembership` maps them; portal
  plan switch (per the Phase 0 Managed Payments spike).
- S5 Checkout `returnTo` (allow-listed) and `approvalId` passthrough.
- S6 Billing page: credit balance, history, next refresh; ladder copy for the three plans.
- S7 Credits Terms (expiry, no cash value, refunds on failure) as drafts for owner review.

**Acceptance:** in Stripe test mode, a Builder's Hub renewal grants 500 credits exactly
once; lifetime grant runs once per month; Growth checkout works end to end.

### WP81 — Paywall and upgrade UX
**Lane:** Claude (mid) · **Weeks:** W5–W7 · **Depends on:** WP77, WP80 S5
**Owns:** `components/workspace/paywall/**`, Wren upgrade cards, credit meter states.

- S1 Meter states: normal, 20% left (soft Wren card), empty (hard stop with a free
  way forward).
- S2 Cost-before-spend on every credit action; no surprise charges.
- S3 Upgrade cards as approval-style cards with one ask; checkout via the existing
  `useMembershipCheckout`; return resumes the blocked card.
- S4 Copy from the canvas copy deck; a11y-check.

**Acceptance:** a Free founder who runs out mid-action can upgrade and land back on
the same action, which then runs once.

### Gate G3 → L2 credits live
Stripe test-mode suite green (renewal, upgrade, downgrade, refund, dispute,
duplicated webhooks). Ledger property tests green. Owner approves live Growth objects
(or defers Growth to Phase 6) and turns on credit grants for Builder's Hub.

---

## Phase 4 — Studio (W6–W8)

### WP82 — Studio: images and video
**Lane:** Claude (high) · **Weeks:** W6–W8 · **Depends on:** WP71, WP73, WP81; D4
**Owns:** `convex/studio/**`, `convex/ai/providers/video.ts`, Studio pages. Codex adds
the one `convex/crons.ts` entry that calls Claude's poller.

- S1 Image jobs: standard (2) and high quality (5); debit at start, refund on failure;
  alt text required before use on the site.
- S2 Video jobs: `provider_jobs` and the poller; short video (30) on every plan with
  credits; launch film (150) paid only; `studioVideo` kill switch.
- S3 Moderation check before a render and on the result.
- S4 Studio page from the canvas: gallery, prompt, presets from the brand kit,
  credit cost shown, download.
- S5 Per-minute limits; storage cleanup for failed renders.

**Acceptance:** 20 image and 5 video renders in test: every failure refunds once;
cost per credit within the rule.

### Gate G4 → L3 public launch
Measured margins on the first 200 paid actions within `03` §7. Owner opens
`cohortMode: open`, sets the public global daily budget, and turns the public CTAs on.

---

## Phase 5 — Distribution (W8–W10)

### WP83 — Connectors: native social, ads, outbound sends
**Lane:** Codex (high) · **Weeks:** W8–W10 · **Depends on:** Meta review (D7, D8), D9
**Owns:** `convex/growth/connectors/**`, `convex/growth/outbound/**`, OAuth routes in
`app/api/**`, token encryption, scheduled-post cron.

- S1 Meta OAuth for Instagram and Facebook Pages; encrypted tokens.
- S2 `MetaConnector.publish` for approved posts; scheduled posting cron; failures
  return the post to `copy_ready`.
- S3 Ads on the founder's ad account: create, pause, read metrics; launch needs an
  approved `ad_launch` approval, passing readiness checks and a paid plan.
- S4 Outbound: attested list upload, daily caps, sends from the tenant domain.
- S5 Everything behind flags; fake connectors remain the default.

### WP84 — Autopilot and growth UI
**Lane:** Claude (high) · **Weeks:** W8–W10 · **Depends on:** WP83 interfaces; D13
**Owns:** `convex/workspace/autopilot.ts`, Settings pages (How Wren works, Autopilot,
Briefing), Social/Ads/Outbound live UI.

- S1 Autopilot policy as code (D13): allowed actions only, per employee, paid only,
  off by default, every action audited.
- S2 Settings pages from canvas row 04.
- S3 Native posting, ads launch and outbound UI with readiness checks and decision log.
- S4 In-app daily briefing from Wren (no email).

### Gate G5 → L4
Meta app review passed (or Phase 5 ships copy-and-post only). Security review of
OAuth, token storage and Autopilot. Owner turns on native features per platform.

---

## Phase 6 — Scale (W10–W12)

### WP85 — Members, multiple businesses, custom domains
**Lane:** Codex (high) · **Weeks:** W10–W12 · **Depends on:** D12 amendment ruling
**Owns:** `convex/platform/authz.ts` (roles), `business_members`, invites, Vercel
Domains integration, business deletion and export.

- S1 `editor` role; invites through the existing sign-in; members see only invited
  businesses.
- S2 Growth: three businesses enforced.
- S3 Custom domains: add, verify, certificate, fall back to the subdomain.
- S4 Delete a business (D5 retention) and export everything.

### WP86 — Hire skipped roles, team variants, members UI
**Lane:** Claude (mid) · **Weeks:** W10–W12 · **Depends on:** WP75, WP85 S1
**Owns:** hire flow, new role generators (Merch, Outbound, Curriculum, Community),
course-idea team, Members and Danger zone UI.

### Gate G6 → L5
Growth live (if deferred), members and custom domains on for Growth. Security review
of the authorization change.

---

## Phase 7 — Program gate (W12)

### WP87 — Program gate and launch review
**Lane:** Gate (Claude orchestrator, high; Codex reviewer, high) · **Weeks:** W12

- Full regression on the final tree: typecheck, lint, test, build, security tests.
- Load: 100 concurrent fixture-mode launches; workpool queues without errors.
- Cost review against `03`; price changes proposed if needed.
- a11y sweep of every workspace page.
- Docs: `AGENTS.md` and `CLAUDE.md` key paths, runbooks, the registry rows.
- Retro and the owner's go or no-go for anything still flagged off.

---

## 4. Standing rules for every WP

- Branch first: `codex/wpNN-<slug>` or `claude/wpNN-<slug>`; worktree under
  `.worktrees/wpNN-<slug>` only when two WPs run at once.
- Keep `docs/wp/wpNN-stories.md` and `docs/wp/wpNN-progress.md` current.
- Before Convex work, read `convex/_generated/ai/guidelines.md`. Before Next.js work,
  read the relevant guide in `node_modules/next/dist/docs/` (the project pins a custom
  Next.js version).
- Ship dormant. Additive schema only. New env entries optional.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` before asking
  for review; record the results in the progress file.
- No `any`, no `console.log`, no inline styles. a11y-check on every changed screen.
- Never call a live model, image or video API from tests or CI.
- Payments and authorization changes get an independent review by the other lane's
  high model before merge.
