# Weekend MVP → Build Platform: Program Plan

**Status:** Plan frozen for review — not yet a committed program manifest
**Lane:** Program/Migration (multi-WP, schema + auth + payments + AI agents)
**Author:** Claude (Fable 5) orchestration session, 2026-08-05
**Owner:** John
**Target:** Working v1 slice live by **Sunday 2026-08-16** (end of next weekend) — people can sign up, buy credits, click "Build this idea," and get a deployed landing page URL.

---

## 1. Vision (one paragraph)

Weekend MVP evolves from a content site (daily validated ideas, articles, newsletter)
into a **build platform**: a visitor sees an idea they love, clicks **"Build this idea
for me,"** creates an account, buys credits, and AI agents research, scaffold, and
deploy the MVP of that idea — starting with a live landing page on a real URL. The
free content engine stays exactly as it is and becomes the top of the funnel. The
product is "Polsia, but validation-first": every build starts from research we have
already done (1,474+ Ideabrowser-scored ideas + our published research pages) or from
a full 360° research pass on the customer's own idea.

## 2. Why this wins — research findings

### 2.1 Polsia teardown (logged into John's account, live product, 2026-08-05)

**Product model** (`polsia.com/dashboard/{company}`):
- One dashboard per "company" with panels: **Tasks** (credit-priced, categorized
  `feature` / `research` / `content` / `engineering`, schedulable "Tonight"),
  **AI cofounder chat** (persona checks in daily: "Morning John…"), **Documents**
  (mission, day summaries, research reports), **Email** (company gets
  `{company}@polsia.app`, cold outreach with a 2/day limit), **Twitter**
  (auto-tweet), **Business** (visitors, revenue, "Setup payments"), **Website**
  (`{company}.polsia.app`, manage domain, versions), **Ads** (budgeted spend), Teams,
  and a "God Mode" autonomy toggle.
- **Cycles**: one autonomous "night shift" task per day chosen by the system;
  instant tasks cost credits.
- Auth: Google OAuth + passwordless magic-link email. No credit card to start.
- Code: users can download their code and deploy elsewhere (FAQ: "Where is my
  code?", "Can I deploy somewhere else?").
- `/live` feed is the growth engine: real-time counters (15,596 companies, 2M tasks,
  893K emails) + streams of tasks/documents/tweets/ads across all companies. Pure
  social proof, publicly visible.

**Pricing (captured from the live upgrade modal):**
- **$20/mo base**: 1 company, 30 night shifts (1 task/day), 5 task credits/mo (+10
  first month), unlimited strategy/planning chat, "Server, Database, Email, Browser
  included," $5/mo AI credits.
- **Extra companies:** +$20/mo each. **Downgrade:** "keep site online" $19/mo.
- **Credit packs (monthly):** 15 (+$19), 25 (+$29), 50 (+$49), 100 (+$99),
  200 (+$199), 500 (+$499), 1000 (+$999).
- **Terms §4:** **20% platform fee on all customer revenue** collected through the
  platform (Stripe; user is merchant of record; ~14-day hold). Stripe subscription
  billing, no refunds.

**Polsia's traction and its soft spot:**
- Raised $30M at $250M valuation; ~$10M run rate; ~10K paying customers; solo
  founder (Ben Cera).
- **80% of its Trustpilot reviews are 1-star (28/35)** and reviewers converge on one
  complaint: *the AI starts building with no validation* — it burns credits shipping
  things nobody asked for. Independent reviews score it ~3.5/5: "fast but needs
  human review."

### 2.2 The strategic wedge

Polsia's weakness is Weekend MVP's existing core asset. We already run a
**validation engine**: Ideabrowser-backed research (opportunity/pain/timing scores,
cited market stats, competitor pricing, community signals), a 7-section idea
contract, and a library of published, SEO-ranked idea pages. Nobody clicking "Build
this idea" on our site starts from a cold prompt — they start from a researched,
scored opportunity. Positioning:

> **"Don't let AI build an idea nobody wants. Weekend MVP validates first, then
> builds."**

### 2.3 Competitive field (for the plan doc's positioning section)

- **Prompt-to-app builders** (Lovable, Base44/Wix, Bolt, v0, Replit Agent): solve
  *how to build*, not *what to build* or *whether to build it*. Self-serve tools; the
  user still drives.
- **Polsia**: autonomous company-runner; breadth (ads, outreach, tweets) but weak
  validation and mixed quality reputation.
- **Agencies/Fiverr/ShipFast**: expensive, slow, or still require code.
- **Weekend MVP platform**: validated idea → done-for-you build → live URL, with the
  content site as a zero-CAC funnel. We do *less* than Polsia on purpose at launch
  (no ads, no cold outreach, no auto-tweets) and go deeper on the
  idea → research → landing page → MVP chain.

### 2.4 Ideabrowser integration (already proven in this repo)

- HTTP MCP at `https://www.ideabrowser.com/api/mcp/http` with `Authorization:
  Bearer ib_…` (ruling 2026-07-22; never `/api/mcp/sse` for cloud agents).
- Call surface used by `/publish-idea`: `browse_ideas`,
  `get_idea_research({idea_id})` + sections `competitive_analysis`, `go_to_market`,
  `keyword_list`, `community_analysis`, plus `research_market_insight` and
  `research_trend`. Quota constraint: **3 deep research reports/month** on the
  current plan — plan capacity accordingly (see §7 Risks).

---

## 3. Product definition

### 3.1 The end-to-end customer journey

1. **Discover (free, unchanged):** visitor lands on `/startup-ideas`, an idea page,
   an article, or the newsletter.
2. **Trigger:** every idea page gets a **"Build this idea for me"** CTA (also a
   generic **"Bring your own idea"** entry on the homepage/nav).
3. **Sign up:** magic-link email + Google OAuth. No credit card to browse the
   platform.
4. **Intake:** short wizard — chosen idea (pre-filled from our repository) or their
   own idea (free text + a few qualifying questions: audience, revenue model
   preference, name preference). Output: a **Build Brief** the user confirms.
5. **Pay:** buy a credit pack or subscribe (see §5). First action is always visible
   before payment (transparent preview of what the credits will produce).
6. **Research phase:**
   - *Repository idea:* we already hold the research → agents compile it into a
     customer-facing **Validation Report** (near-zero marginal cost, instant
     delivery). This is the "minimum viable product of the product."
   - *Own idea:* agents run the full 360° — market stats, competitors + pricing,
     community signals, positioning, suggested value ladder — via Ideabrowser MCP
     (when a matching record exists) or the web-research fallback discipline already
     defined in `/publish-idea` Mode B. Delivered as the same Validation Report.
7. **Build phase (the deliverable ladder):**
   - **Tier 1 — Landing page:** branded, conversion-ready landing page for the idea
     (hero, offer, social proof placeholders, waitlist/email capture wired to the
     customer's audience list), deployed at `{project}.weekendmvp.app` with SSL.
   - **Tier 2 — MVP scaffold:** landing page + auth + one core flow (the "weekend
     MVP" of the idea), same subdomain, code exportable.
   - **Tier 3 — Launch pack (later):** OG cards, launch copy (X/LinkedIn/Product
     Hunt), analytics wired.
8. **Dashboard:** project page showing brief → research → build progress →
   live URL + documents (Validation Report, build log), plus a task queue for
   follow-up work ("add testimonials section", "change pricing"), each task priced
   in credits.
9. **Iterate:** customer requests tasks; agents execute; every completed task posts
   an update to the dashboard and email.

### 3.2 What we explicitly do NOT build at launch (anti-scope)

- No ads management, cold outreach, auto-tweeting, or revenue-share payment rails
  (Polsia's breadth; heavy trust/abuse/compliance surface).
- No autonomous nightly cycles — every task is user-initiated at launch (the
  validation-first brand demands human-in-the-loop; autonomy can come later as
  "Night Shift" once quality is proven).
- No custom domains at launch (subdomain only; custom domain is a fast follow).
- No team seats.

### 3.3 Naming — RULED (2026-08-05)

**Keep `weekendmvp.app`; no new brand.** Platform marketing lives at
`weekendmvp.app/build`, the product at `/dashboard` (or `app.weekendmvp.app` if
route separation demands it later), customer sites at
`{project}.weekendmvp.app`. Recorded in `docs/wp/RULINGS.md`.

---

## 4. Architecture

### 4.1 Principles

- **Keep the content site untouched.** Marketing/content stays RSC + MDX + Convex
  read-paths exactly as today. The platform is additive routes + new Convex tables.
  SEO must not regress (canonical host, sitemap, JSON-LD rules all unchanged).
- **One repo, one Convex deployment.** New tables namespaced; new functions in
  `convex/platform/`. No second backend until scale demands it.
- **Agents run outside the request path.** Long-running research/build jobs are
  queued and executed by worker processes (Claude Agent SDK) in sandboxes —
  never inside a Next.js request.
- **Ship the deliverable, not the tool.** Customers get URLs and reports, not a
  chat-with-code IDE. (That's how we avoid competing head-on with Lovable/Bolt.)

### 4.2 System components

| Component | Choice (default) | Notes |
|---|---|---|
| Web app | Existing Next.js App Router repo; new route group `app/(platform)/` | Dashboard, intake wizard, project pages, billing pages |
| Auth | **Convex Auth** (magic-link email + Google OAuth) | Matches repo stack default; passwordless mirrors Polsia's low-friction entry. Convex Auth supports Resend-style email OTP/magic links |
| DB / state | Convex (new tables, §4.3) | Real-time dashboard updates for free via subscriptions |
| Payments | **Stripe Checkout + customer portal** (`stripe` already in package.json; `convex/payments.ts` exists) | Credit packs = one-time Checkout; Pro plan = subscription. Webhooks → Convex ledger |
| Job orchestration | **`@convex-dev/workflow`** (already a dependency) for task state machines; agent execution on **Vercel Sandbox** or a small worker (Claude Agent SDK) triggered by Convex actions | Durable, resumable, observable per-step |
| AI | Claude API via **Claude Agent SDK** for agent loops; models routed by task risk (Sonnet for build/copy tasks, Opus/high tier for research synthesis + code review) | Same routing philosophy as this repo's workflow |
| Research source | Ideabrowser HTTP MCP (Bearer key, server-side only) + web-research fallback | Cache every MCP payload in Convex (`research_cache`) — quota is scarce |
| Customer sites | **Vercel** project(s) with wildcard domain `*.weekendmvp.app` | v1: landing pages are **data-driven pages rendered by one multi-tenant Next.js app** (template + JSON content per project) — instant "deploys," zero per-site infra. Tier 2 scaffolds graduate to per-project Vercel deployments via the Vercel API |
| Email (transactional) | Resend (auth links, task-complete notices) | Beehiiv stays for the newsletter only |
| Analytics | Existing GA4 + per-project visit counters (Convex) surfaced in dashboard | Polsia's "Visitors: 11 / Revenue: $0" panel is table stakes |

**Why multi-tenant rendering for Tier 1 instead of real deploys:** a landing page
"build" becomes a *content generation* problem (agents produce structured page
config + copy + OG image), rendered by a battle-tested template. Seconds-fast,
credit-cheap, no build queue, trivially versioned, and the quality floor is high —
the exact opposite of Polsia's 1-star "it built junk" failure mode. Real code
scaffolds (Tier 2) are where sandboxes + deploy pipelines come in, one tier later.

### 4.3 Data model (Convex additions — names indicative)

- `users` — via Convex Auth (email, name, oauth ids).
- `projects` — owner, source (`repository_idea` | `own_idea`), ideaSlug?, name,
  subdomain, status (`intake` → `research` → `ready_to_build` → `building` →
  `live`), createdAt.
- `briefs` — projectId, answers (audience, model, tone, naming), confirmedAt.
- `credit_ledger` — userId, delta (+purchase/−spend/+refund/+grant), reason,
  stripeRef?, taskId?, balance is derived. Append-only.
- `purchases` — stripe session/subscription records, pack size, status.
- `tasks` — projectId, type (`validation_report` | `landing_page` | `revision` |
  `mvp_scaffold`), creditCost, status (`queued` | `running` | `review` | `done` |
  `failed` | `refunded`), workflowId, output refs, timestamps.
- `documents` — projectId, kind (`validation_report` | `build_log` | `research_raw`),
  markdown/JSON body, citations.
- `site_configs` — projectId, versioned page config (sections, copy, theme, OG
  image ref), publishedVersion.
- `research_cache` — ideabrowser idea_id → raw payloads + fetchedAt (quota shield).
- `events` — audit log (payments, task transitions, publishes) for the ops view.

### 4.4 Agent system

- **Orchestrator (per task):** deterministic workflow steps, not a free-running
  loop. Each task type has a fixed pipeline with one or more agent steps inside.
- **Research agent:** Ideabrowser MCP first (cached), web fallback with the
  citation discipline from `/publish-idea` Mode B; emits Validation Report JSON +
  markdown.
- **Landing-page agent:** Brief + Validation Report → `site_configs` entry
  (sections, copy variants, palette pick from approved design tokens) + OG image
  via existing Recraft/OG pipeline. A **quality gate step** (higher-tier model)
  reviews copy/claims before publish — no hallucinated testimonials or fake stats;
  placeholder social proof must be labeled as such.
- **Revision agent:** takes a customer task ("swap hero copy", "add pricing
  section") against the current `site_configs` version; produces a diff the
  customer sees before/after.
- **Guardrails:** every task has a credit budget, wall-clock timeout, and an
  explicit output contract; failures auto-refund credits (directly answers
  Polsia's top complaint); all agent outputs stored as documents for transparency.

### 4.5 Security/compliance notes

- Ideabrowser + Anthropic + Stripe keys server-side only (Convex env / Vercel env;
  never `NEXT_PUBLIC_*`).
- Subdomain content is customer-directed → publish pipeline needs a content policy
  check (no impersonation, no regulated-industry claims) before a page goes live
  under our domain.
- Rate-limit signups and task creation; credits are the natural abuse throttle.
- No revenue-share/merchant-of-record features at launch — avoids money-transmitter
  adjacency entirely.

---

## 5. Monetization

**Model: credits for deliverables + a light subscription later.** (Polsia
validates the credit mental model at $1–2/credit; our deliverables are chunkier.)

| Offer | Price (launch) | What it buys |
|---|---|---|
| **Validation Report** — repository idea | **Free with signup** (first one) | The hook. Near-zero marginal cost — we already have the research. Converts readers into accounts |
| Validation Report — own idea | ~15 credits | Full 360° research pass |
| **Landing page build** (Tier 1) | ~25 credits | Deployed page + email capture + OG card + report bundled |
| Revision task | 1–3 credits | Scoped changes |
| MVP scaffold (Tier 2) | ~75–100 credits | Post-launch fast follow |
| **Credit packs** | $29 / 25cr · $79 / 75cr · $199 / 220cr | One-time Stripe Checkout; credits don't expire |
| **Builder plan** (fast follow) | ~$19–29/mo | Keeps site hosted after 30 days, monthly credit drip, priority queue — mirrors Polsia's "keep site online" retention lever |

Anchor: "an agency charges $4K+ and takes weeks; ship·able proved people pay to get
unstuck; here the whole loop is under $100 and done this weekend." Ties directly
into the existing ship·able → DARE ladder (a live build session upsell for
platform customers is an obvious bridge).

**Unit-economics guardrail:** each landing-page build ≈ one bounded agent pipeline
(target < $3 inference + $0 infra at v1 architecture) against $25-in-credits
revenue. Own-idea research is the expensive path (Ideabrowser quota or long web
research) — price it accordingly and cache aggressively.

---

## 6. Delivery plan (waves → work packages)

Program lane rules apply: audit → freeze `docs/wp/program-manifest.md` from this
plan → gate every wave. Branch-first; stories/progress files per WP. Model routing
per `.agentic-workflow.yml` (auth/payments/agents = high tier).

### Wave 0 — Program setup (half day)
- **WP15 (this doc):** ruling on naming/domain (§8), freeze manifest, confirm
  pricing numbers, create Stripe products in test mode.

### Wave 1 — Reversible foundations (aim: weekdays)
- **WP16 — Auth + accounts:** Convex Auth (magic link + Google), `app/(platform)`
  shell, protected `/dashboard`, profile basics. *Gate: signup→login→logout on
  preview, a11y-check, no SEO regression.*
- **WP17 — Credits + billing:** Stripe Checkout packs, webhook → `credit_ledger`,
  balance UI, purchase history, customer portal. *Gate: test-mode purchase credits
  land exactly once (idempotent webhooks).*
- **WP18 — Intake + projects:** "Build this idea for me" CTA on idea pages
  (repository path pre-fills the brief), own-idea wizard, `projects`/`briefs`
  tables, dashboard project cards. *Gate: both intake paths produce a confirmed
  brief.*

### Wave 2 — The product (weekend build)
- **WP19 — Research pipeline:** workflow task `validation_report`; repository-idea
  compiler (from existing research/MDX + manifest), own-idea 360° (MCP + fallback),
  report renderer in dashboard + email notification. *Gate: one repo-idea report
  free-flow end-to-end; one own-idea report with ≥2 cited stats + 3 competitors.*
- **WP20 — Landing-page builder:** `site_configs` schema + multi-tenant renderer on
  `*.weekendmvp.app`, landing-page agent pipeline with quality gate, publish/version
  flow, email-capture block. *Gate: from a confirmed brief, a real subdomain URL in
  < 10 min with zero manual steps.*
- **WP21 — Task queue + revisions:** task list UI, revision agent, credit
  spend/refund logic, task status live-updates. *Gate: a revision visibly changes
  the live page and debits correctly; a forced failure auto-refunds.*

### Wave 3 — Launch hardening (weekend + spillover)
- **WP22 — Trust & safety:** content policy check in publish pipeline, rate
  limits, abuse kill-switch per project, terms/AUP pages for the platform.
- **WP23 — Launch surface:** `/build` marketing page, pricing page, homepage +
  idea-page CTA rollout, changelog/`/live`-style social-proof module (counts of
  reports + builds — start honest and small), analytics events for the whole
  funnel.
- **Gate (program):** full checks (`typecheck`, `lint`, `test`, `build`), Stripe
  live-mode smoke with a real card, one stranger-test of the full journey.

### Post-launch backlog (explicitly deferred)
Tier 2 MVP scaffolds (sandbox builds + per-project Vercel deploys + code export),
custom domains, Builder subscription, Night Shift autonomy, launch packs,
team seats, affiliate/referral.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **Ideabrowser quota (3 deep reports/mo)** starves own-idea research | Repository ideas need no quota; cache every payload; own-idea path uses web-research discipline when no MCP record; consider Ideabrowser plan upgrade before launch |
| Agent output quality = brand damage (Polsia's 1-star lesson) | Fixed pipelines not free loops; quality-gate model step; template-rendered pages (high floor); auto-refund on failure; human-visible artifacts for every step |
| Payments/webhook correctness | Idempotent ledger, test-mode gate in Wave 1, Stripe CLI replay in tests |
| SEO regression on the money pages | Platform is additive routes only; Wave 1 gate includes sitemap/canonical diff |
| Scope blowup before the weekend | Anti-scope list (§3.2) is binding; Tier 2 is post-launch, period |
| Solo-operator support load | Task statuses + documents make the product self-explaining; support = email only at launch |

## 8. Open rulings needed from John (before Wave 1)

1. ~~**Naming/domain**~~ — **RULED 2026-08-05:** keep `weekendmvp.app`, no new
   brand (see §3.3 and `docs/wp/RULINGS.md`).
2. **Pricing sign-off:** §5 numbers are proposals anchored on Polsia/agency/ShipFast.
3. **Free hook:** confirm "first repository-idea Validation Report free" as the
   activation gift.
4. **Auth provider:** Convex Auth assumed (stack default). Veto window before WP16.
5. **Ideabrowser plan:** upgrade for research quota, or launch own-idea research on
   web-fallback only?

## 9. KPIs (first 30 days)

- Signups from idea-page CTA (activation of the content moat).
- Free report → paid conversion (the funnel's core validation).
- Builds delivered < 10 min, task failure rate, refund rate (quality proxy — this
  is the metric Polsia loses on).
- Credit revenue; blended inference cost per build.

---

*Sources: live Polsia product (logged-in dashboard, pricing modal, FAQ, terms §3–4,
`/live` feed, magic-link auth flow, 2026-08-05); [Polsia $30M raise](https://x.com/Bencera/status/2057847644966547920),
[Polsia review — preuve.ai](https://preuve.ai/blog/polsia-review),
[Polsia review — maiamichelle.com](https://maiamichelle.com/ai-reviews/polsia-review/),
[Polsia alternatives — crevio.co](https://crevio.co/blog/polsia-alternatives),
[Base44 vs Lovable](https://www.softr.io/blog/base44-vs-lovable),
[Lovable alternatives 2026](https://emergent.sh/learn/best-lovable-alternatives-and-competitors);
repo: `/publish-idea` skill (Ideabrowser MCP surface), `docs/wp/RULINGS.md`,
`STRATEGY.md`, `convex/schema.ts`, `package.json`.*
