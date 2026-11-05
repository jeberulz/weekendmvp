# Launch Workspace — strategy

**Status:** Ruled 2026-11-05. The owner approved every decision in `06-decisions.md`
except D10 (SMS), which is deferred. The rulings are in `docs/wp/RULINGS.md`.
**Program:** WP67 (Program/Migration lane). Work packages WP68–WP87 are reserved (D14) and
described in `04-build-plan.md`.
**Design source:** the "Weekend MVP Launch Experience" canvas
(https://claude.ai/artifact/DKGkhWuwpUxrBmgngy3fNG), rows 01–05 and 01b–01c.
**Reading order:** this file → `06-decisions.md` → `02-architecture.md` →
`03-ai-cost-model.md` → `04-build-plan.md` → `05-lanes-codex-claude.md`.

---

## 1. What we are building

A founder picks a Weekend MVP idea (or types their own), answers eight short wizard
questions with suggested defaults, and gets a small team of AI employees hired for
that idea. Wren, the Crew Lead, runs the team and is the only voice in the chat.
The specialists produce a brand kit, a live landing page with a waitlist on
`{slug}.weekendmvp.app`, a 4-email waitlist sequence, 7 launch posts, page titles
and a first article, a weekend launch plan, and a phased build pack of prompts for
the real product. The founder approves each piece with **Looks good** or **Ask for
changes**. Nothing sends, posts or spends without their OK.

**Free finishes one weekend launch.** Money starts only with compute the founder
chooses (Studio images and video, regenerations, extra hires), with paid
distribution (ads going live, native publishing, sends past the free cap, outbound),
or with scale (more businesses, members, custom domain, Autopilot).

## 2. Why this, and why now

- **The validation-first wedge still holds.** The 2026-08-05 platform plan found
  that the leading autonomous competitor's top complaint is that it builds things nobody
  validated. We start every build from a researched, scored idea page: 231 public
  ideas with competitors, pricing, community quotes and four build prompts that
  already pass the weekend prompt standard.
- **Most of the expensive work for a library idea is already done.** The research,
  the prompts and the positioning exist per idea. A wizard run on a library idea is
  mostly *personalising* stored material, not generating from nothing. That is
  what makes a free weekend affordable at scale (see `03-ai-cost-model.md`).
- **The audience already lives on the site.** Idea pages, the newsletter, the live
  builds and the `/live/48-hours` HydroTrail build are the funnel. The workspace
  turns readers into builders without a new acquisition channel.
- **Builder's Hub billing is live.** Stripe Managed Payments, webhooks, the portal and
  entitlement checks already work in production (WP64). This program extends that
  billing; it does not start a second one.

## 3. What already exists, and what this program changes

| Area | Exists today | This program |
|---|---|---|
| Public idea pages, engine, prompt standard | Live (WP42–WP62, WP54, WP61) | Reused as the wizard's seed and the build pack's source. No change to public pages beyond the build-first CTA on the account card. |
| Auth | Convex Auth, magic link + Google (WP21, account linking ruling 2026-10-06) | Reused. No new provider. |
| Dashboard | WP44 member dashboard (Home, Library, Saved, Weekend plans, Builds, Settings, Plan and billing) | A business workspace is added beside it under one shell. Existing member features keep working. |
| Paid plan | Builder's Hub live: $29/mo, $199/yr, 50 Founding Lifetime seats (WP64) | Becomes the middle plan of one ladder (decision D1). Gains monthly credits and the paid workspace features. |
| Credits | WP24 platform credit ledger, built and tested (idempotent debit, refund once on failure) but test-mode only and called by nothing | Extended into the one credit ledger: monthly allowance grants, allowance expiry, debit at job start, refund once on failure. |
| Site publishing | WP27 preview + WP28 tenant hosting code built; parked by WP44 R5; WP29–WP31 paused | Un-parked (decision D2) for the generated landing page only. WP30 trust/safety and WP31 activation slices become prerequisites. |
| AI calls | **No hosted code calls a model today.** The engine (OpenAI synthesis, Perplexity, DataForSEO) and OG art (Recraft, OpenAI Images) run only as local CLIs, with an in-memory per-run cost cap | A hosted AI runtime in Convex for every crew call: model tiers, prompt registry, structured output, durable metering, budgets, evals. The engine's provider adapters and micro-USD cost maths are reused. |
| Email | Resend for auth links; Beehiiv for the newsletter | Tenant waitlist sequences sent from a separate sending domain (decision D6). |

## 4. Product shape (from the canvas)

**Row 01 — Discover → build.** The production homepage stays. Only the CTAs change:
"Build this idea, free" on the hero and Idea of the week, and a build-first account
card on `/ideas/{slug}` that returns to the wizard after sign-in.

**Row 01 — Wizard (8 steps).** Idea → Blueprint → Platform → Commercial model → Goal
→ Name → Partner personality → Partner name → Meet your co-founder. The canvas also
shows an optional SMS step; it is not built while D10 is deferred. Every step has a
suggested default. Every choice is logged as a founder
signal (kept, changed, skipped, rewrote), which later tunes Wren.

**Row 01b — The team.** Wren hires from a fixed role catalogue by rule (always /
added) and skips roles with a stated reason. For HydroTrail: Wren, Iris (Brand),
Leo (Landing), Sana (SEO), Marco (Marketing), Elle (Email), Theo (Social), Kai
(Engineering), Ada (Ads); skipped Merch, Outbound, Curriculum, Community. A course
idea gets a different team. Team HQ shows status (Queued, Working, Needs you, Done)
with text labels. Each employee has a workstream panel with outputs, files,
blockers and one ask.

**Row 01c — Plans, credits and upgrade.** Free / paid middle plan / Growth, Scale
"Coming". Credits meter in the nav. Soft Wren card at 20% left, hard stop at 0.
Upgrade asks are Wren approval-style cards with one ask and a free way forward.
Checkout returns the founder to the action they were blocked on.

**Row 02 — Workspace.** Dashboard, Launch plan (owners on every item, approve all),
Brand kit and Brand Book, generated landing page, Build pack (4 phases, 8 prompts),
Tasks, Files ("What Wren knows"), Studio (images and video).

**Row 03 — Growth.** Email (inbox + sequences), Social (7 posts, copy-and-post on
Free), Ads (one $7/day waitlist test, readiness checks, decision log), Outbound.

**Row 04 — Ops and memory.** Settings (how Wren works, Plan, Autopilot, Briefing,
domain, Members, Danger zone), Files.

**Row 05 — System.** Components, the user flow, the copy deck. These are the
acceptance references for UI work.

## 5. Plan ladder (ruled: D1, D1b, D1c)

The canvas drafts Free / Starter $29 / Growth $79. Builder's Hub already sells at
$29/mo and $199/yr, with 50 Founding Lifetime seats whose Terms say lifetime lasts
"as long as Builder's Hub is offered." Running a second $29 subscription beside it
would confuse members and break that promise. **Recommendation: one ladder, and
keep the live plan's name and id.**

| | Free | Builder's Hub (was "Starter" on the canvas) | Growth |
|---|---|---|---|
| Price | $0 | $29/mo · $199/yr (live) · Founding Lifetime (live, closed set) | $79/mo · $790/yr (draft) |
| Businesses | 1 | 1 | 3 |
| Credits | 50 one-time | 500 / month, refresh on the billing anchor | 2,000 / month |
| Member features (WP44/WP64) | Free limits | All Builder's Hub features, as today | Same |
| Workspace | Full weekend team for business 1; copy-and-post social; 50 lifetime email sends; drafts for ads and outbound | Autopilot, ads go live, native publishing, unlimited waitlist sends (fair use), 20 outbound sends/day, custom domain | + hire skipped roles, 100 outbound/day, 3 members |
| Scale $199 | "Coming" only | | |

Why keep "Builder's Hub": no Terms change for lifetime holders, no renamed Stripe
products, and existing members see their plan get better rather than replaced.
The canvas word "Starter" becomes a descriptor ("Builder's Hub — most founders
start here"). If the owner prefers the new name, D1 lists what a rename costs.

**The annual price conflict:** the canvas drafts $290/yr; live is $199/yr. Keep
$199 for now. Raising it for new buyers later is a pricing change, not a build task.

**Lifetime seats and compute:** a one-time payment cannot fund unlimited monthly
compute. The 2026-10-04 ruling says every term gets the same features, so lifetime
holders would receive 500 credits a month by default. At the cost model's image
rates that is roughly $5–$15 a month per active holder, capped at 50 seats (about
$3k–$9k a year at full use). D1b asks the owner to accept that or set a lifetime
credit allotment with notice under the Terms.

## 6. Credit prices (ruled: D4)

One credit is worth $0.058 on Builder's Hub ($29/500) and $0.040 on Growth
($79/2,000). The rule (D4): **provider cost per credit must stay at or below
$0.013**, so that even Growth keeps about a 3× gross margin on compute.

| Action | Canvas draft | Recommended | Why |
|---|---|---|---|
| Offer image, standard quality | 2 | **4** (owner, 2026-11-05) | Rendered on gpt-image-2 medium (D11), measured at $0.041 in WP69-S4. At 4 credits the rule allows ≤ $0.052. |
| Offer image, high quality | — | **5** (new) | For the $0.04–$0.06 models and quality settings. |
| Story / post image | 2 | **4** (owner, 2026-11-05) | Same render as the standard offer image. |
| Short video (≤8 s) | 15 | **Unpriced until WP82** (owner, 2026-11-05) | 8 s on the cheapest tier is about $0.40, which 30 credits does not cover. No provider is measured yet; WP82 sets the price through a contract change. |
| UGC / launch film (≤30 s) | 25 | **Unpriced until WP82**, paid plans only | About $1.50 for 30 s on the cheapest tier; 25 credits loses money. Priced in WP82 with the short video. |
| Brand kit regenerate | 10 | **11** (owner, 2026-11-05) | Measured: text $0.027 plus 3 Recraft logo marks at $0.035 ≈ $0.132, just over 10 × $0.013. |
| Landing regenerate | 8 | 5 | Text only (about $0.05). A new hero image is a separate 4-credit image. |
| Email sequence regenerate | 5 | 3 | Text only (about $0.04). |
| Extra social pack (7) | 5 | 5 | Text only (under $0.03); images are priced separately. |
| Hire a skipped specialist | 20 | 20 | Covers its first workstream (about $0.05–$0.10). |
| Engineering pack regenerate | 10 | 8 | Text, about $0.08 with the drafting model. |

These prices were measured in Phase 0 (`03-ai-cost-model.md` §7) and frozen in
C-JOBS on 2026-11-05 at G0. Video and change round 3+ of the five unpriced
artifacts stay unpriced. Any change is a contract change (`05` §5). Every price is
re-checked after the first 200 paid actions.

Every first draft in the weekend shell, and **two "Ask for changes" rounds per
artifact**, stay free. Regenerations after that use credits. Wren always shows the
cost before running anything that spends credits.

## 7. Free tier economics (ruled: D3)

- **Target AI cost of one free weekend launch: ≤ $0.75. Hard ceiling: $1.50 per free
  account, lifetime, excluding the 50 starter credits.** The ceiling is enforced in
  code, not documented.
- The 50 starter credits cost us at most about $0.65, because the credit rule in
  §6 caps provider cost at $0.013 a credit.
- Wren chat on Free: 40 messages a day on the small model, with a calm "I'll pick
  this up tomorrow" card past the cap. Approvals and buttons never count.
- One free business per verified account. Disposable-domain sign-ups are refused
  at the wizard, not at sign-in, so research access is unchanged.

`03-ai-cost-model.md` shows how the target is met: precomputed per-idea material,
tiered models, prompt caching, structured one-shot generation, and metering with
budgets.

## 8. Positioning

> **Free finishes your weekend.** Pick an idea we've already researched, and a small
> AI team builds your brand, your site and your launch with you. You approve every
> step.

Three promises the build must keep, because the competitor's reviews show what
breaks trust:

1. **Never surprise-charge.** Wren names the cost before spending a credit. No
   action that costs money runs on Autopilot.
2. **Never fake it.** No invented testimonials, statistics, logos of other companies
   or customer counts. Placeholder proof is labelled as placeholder.
3. **Never hold work hostage.** Downgrading or running out of credits never deletes
   or hides what was built. The site stays up on Free.

## 9. What we will not build in this program

- Running or hosting the founder's real product code (the build pack is prompts the
  founder runs in Cursor, Claude Code or Codex).
- Revenue share, payments on behalf of founders, or being merchant of record for
  them.
- Unapproved sends, posts or spend of any kind, including on Autopilot.
- Cold outreach at scale. Outbound stays drafts plus small, approved daily sends to
  lists the founder supplies (decision D9).
- SMS of any kind, including collecting phone numbers (D10 is deferred).
- Credit packs (ruling 2026-09-25 R9 stands).
- A public live-activity feed of customer businesses.

## 10. Success measures (first 60 days after public launch)

| Measure | Target |
|---|---|
| Wizard start → Meet Wren | ≥ 70% |
| Meet Wren → landing page live | ≥ 80% within 15 minutes |
| Free launches with ≥ 1 real waitlist signup within 7 days | ≥ 35% |
| Free → paid within 30 days | ≥ 4% |
| Median AI cost per free launch | ≤ $0.75 (measured, not estimated) |
| Credit-action gross margin | ≥ 70% |
| Refund rate on failed credit actions | 100% automatic, exactly once |
| WCAG 2.1 AA on every new screen | 100% (a11y-check skill) |

## 11. Top risks

| Risk | Mitigation |
|---|---|
| Free-tier abuse turns into a compute bill | Hard per-account ceiling, per-day global kill switch, verified email, one free business, metering alarms (`03`). |
| Two billing systems drift | One plan catalogue, one credit ledger, membership and credits share WP64's webhook path (`02` §5). |
| Tenant email harms deliverability for auth email | Separate sending domain and Resend project for tenant mail; auth mail untouched (D6). |
| Real waitlist leads make us a data processor | Privacy and retention text before real capture (D5); WP28's synthetic-only rule stays until then. |
| Ads and native social need platform approvals that take weeks | Apply in Phase 0; ship copy-and-post and fake connectors first; native features are flag-gated. |
| Merges deploy the live Convex backend | Everything ships dormant behind flags; schema changes are additive only; a phase gate turns a cohort on. |
| Two agents building in parallel collide | Contract-first Phase 0, single-writer files, one lane per directory, separate worktrees, reserved WP numbers (`05`). |
| Video providers change or shut down (Sora's API closed in Sept 2026) | All generation behind a provider adapter with a fallback list; price credits from measured cost. |
