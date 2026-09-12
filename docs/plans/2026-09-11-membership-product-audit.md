# Weekend MVP product, content and strategy audit

Audit date: 2026-09-11. Independent read-only repository review, Program/Migration audit lane. Repository: `/Users/jeberulz/Documents/AI-projects/weekendmvp`, main `2449200` (clean when inspected). No production access, deployments, data mutations, live provider use, branch switches, or application code changes. Exact line references below are relative to that repository. Counts came from local files; production delivery and actual users/revenue were not verified. This is code/content evidence, not a rendered browser accessibility audit or full security assessment.

## Main conclusion

There is a substantial reusable application foundation, but the business currently encoded is **free research/email acquisition + paid landing-page publishing credits**. The requested product is **daily free research + paid ongoing access to research and decision support**. That is a product and entitlement migration, not a visual redesign or a continuation of WP29–WP31. Preserve the stack and public content URLs; replace the monetization boundary, research model, discovery semantics, editorial operation, and launch scope. Defer owned website hosting while proving research subscriptions.

## Current repository inventory

| Asset | Measured state |
|---|---|
| Idea records | 225 in `ideas/manifest.json`; 225 matching `content/ideas/*.mdx`, no missing MDX or duplicate slugs |
| Articles | 85 `content/articles/*.mdx` |
| Newsletter web archive | 15 `content/newsletter-pages/*.mdx`; latest filename 2026-06-16-pm. This does not prove no later Beehiiv sends exist. |
| Idea taxonomy | 12 categories. SaaS 48; creator-tools 18; education/marketplace 17 each; health/ecommerce/productivity/fintech/B2B 16 each; developer-tools/automation/AI-tools 15 each |
| Idea provenance | 222 records have a provenance object; 184/225 source strings reference IdeaBrowser (81.8%) |
| Idea score coverage | 179/225 have scores. 163/179 opportunity scores are exactly 9 (91.1%); scores do not meaningfully distinguish most content |
| Build-time claims | 49 ideas tagged 8 hours, 136 tagged 10, 38 tagged 12, 2 tagged 20. 223/225 are tagged at most 12 hours |
| Structural content screen | 205 ideas have 8 H2s; 20 have 7 H2s and no `## Sources`; 2 have fewer than 800 lexical words including frontmatter/headings (`markdown-client-proposals`, 778; `shopify-trust-scanner`, 790). This is a mechanical screen, not an authoritative quality score. |
| Route components | 29 `page.tsx` files; dynamic routes render many more URLs |
| Test files | 42 `.test.*` files under tests/, 20 under convex/ (counts are files, not executed tests) |
| Operator engine | No `lib/engine`, `engine/records`, or `engine/evals` on main; `convex/platform/engine/` contains contracts and contract tests only |
| Admin/settings | No `app/admin` or `app/dashboard/settings`; no `convex/crons.ts` |
| Check run | `npm run validate:idea-tags` passed 225/225. No full test/build run was needed for this read-only audit; no claim that all checks are green. |

## Findings and evidence

### 1. Current access gate cannot protect paid research — release blocker

`components/ideas/EmailGate.tsx:7–23` explicitly documents full server-rendered body visible by default, client-only blur after hydration, localStorage access, and trusted newsletter UTM bypass. Its actual children remain in HTML at lines 103–109. `components/ideas/gate-access.ts:66–89` returns unlocked for any stored `ideas_email` or `?utm_source=beehiiv`. This is intentional email lead capture, not a security defect relative to its old contract. It is completely incompatible with charging for research access.

`app/ideas/[slug]/page.tsx:173–204` caches and resolves whole MDX/public Convex body; line 439 wraps research in EmailGate; line 535 renders MDX. `convex/ideas.ts:44–51` returns the full idea document anonymously; `list` at 56–79 does likewise. `convex/schema.ts:59–62` permits arbitrary provenance and an optional body. Adding a subscription flag only to the UI would leave several exfiltration paths.

Required: a single server entitlement policy; separately projected public cards/summaries and private detailed research; no premium prose in anonymous HTML, RSC payload, JSON-LD, prefetch, cached response, API/Convex query, export, or generated bundles. Preview/metadata queries must return only explicitly public fields. Any protected MDX renderer must run after entitlement verification in a private cache context. `robots`/noindex is not access control. Test anonymous/free/paid/cancelled/admin states and cross-user/cache transitions.

### 2. There is no daily-free product contract yet

`app/ideas/today/route.ts:17–35` simply queries `api.ideas.latest` and redirects to that slug, falling back to archive. `convex/ideas.ts:161–170` selects highest `publishedAt`; it has no schedule, free window, timezone, published state, entitlement, or replacement behavior. Recent content is published in ten-idea batches, which further disconnects latest-from-daily.

Recommend one editorially selected daily feature shared by everyone, using a UTC date key and explicit active research revision. Public summaries remain browseable. If instead the owner wants each free user to choose one arbitrary unlock/day, that is a different transactional product with daily usage claims, replay semantics, account-abuse controls, and recovery policy. Do not leave that interpretation to frontend developers. Define whether today's full idea expires at day boundary, remains owned when saved, or becomes archive-only; saved status must not accidentally grant paid access.

### 3. Discovery is a useful scaffold but unsuitable as paid global search

`convex/platform/ideas.ts:390–403` paginates the newest ideas first, then `finishExplorePage` at 230–243 applies search and sorting to that page. Recommendation is score + at most 0.5 category affinity at 158–198; score itself averages four dimensions at 87–95. Thus a matching or higher-scoring older idea may be absent until users load more pages, and each page is locally sorted. `components/platform/explore/ExploreWorkspace.tsx:93–113` accurately labels this as “Search loaded idea metadata,” an implementation explanation instead of a paid-product expectation.

Retain owner-scoped saved/interested state and URL-addressed filters. Rebuild query behavior for full-library search and globally stable ranking, using indexed facets/full-text search and deterministic cursors. Distinguish buyer category from builder suitability: weekly available hours, experience, startup budget, access to target buyers, upkeep burden, distribution effort, complexity, and sensitive-domain barriers. Cold start should use a short optional fit profile, not an unexplained recommendation score.

### 4. Existing research labels are not evidence of verified premium quality

`convex/schema.ts:43–60` models source as a string, four numeric scores, arbitrary provenance, and research level as a free string. The latest manifest entry stores MCP call labels, citation count, word count, `auditPassed: true`, and a timestamp, not claim-level evidence. A stored boolean is a publisher assertion.

`content/ideas/phone-neck-score-app.mdx:12–14` makes specific community, keyword-volume and hashtag-count claims; its Sources at 146–159 identify a May 2026 IdeaBrowser snapshot and general source list. Local inspection cannot verify those claims; it does establish that citation-to-claim links, provider/geo/date of search volume, and current verification are not machine-enforced.

`content/ideas/markdown-client-proposals.mdx:26–30` has general market-growth claims and links IdeaBrowser homepage as supporting research. It may be useful free inspiration but is not yet a defensible paid report. Twenty pages lack the dedicated Sources section. Do not retrospectively relabel all existing content “verified” or “validated.”

Required record: claim id, claim type (observed/inferred/assumed), source URL/publisher, retrieved/observed dates, allowed short supporting excerpt, measurement geography/window/currency, provider, confidence reason, related report section, model/prompt/record version, last checked and next refresh. A provider outage should mark unavailable, never synthesize keyword numbers. Add researched MVP scope, excluded features, validation experiment, outreach script, pricing hypothesis, downside and stop criteria. Let evidence be incomplete honestly.

### 5. Weekend build-time metadata is currently score-derived, not task-derived

`.agents/skills/publish-idea/SKILL.md:140–145` maps builder confidence >=7 to exactly 10 hours, 5–6 to 12, lower to 20. This explains the compressed time distribution. It is not a feasibility estimate for a particular builder. The library includes native motion-sensor wellness apps, two-sided marketplaces, fintech and safety products. Their safe commercial operation cannot be assumed equivalent to a weekend prototype.

For the target 9–5 worker, distinguish: weekend validation experiment, demo prototype, first paid pilot, and reliable production service. Estimate ranges by tasks, skill prerequisite and weekly time; include ongoing support and distribution workload. “A weekend experiment” is a stronger honest promise than “a fully functioning business by Sunday.” Keep existing claims visible only where verified, and tag old estimates as editorial estimates during backfill.

### 6. Publication is split across filesystem, Convex, assets, and deployments with an observed broken-link window

`.agents/skills/publish-idea/SKILL.md:68–78` seeds live Convex before Git/Vercel deploy. `docs/wp/wp40-progress.md:35–40` explicitly records production grid cards existing while `/ideas/{slug}` returns 404 until branch merge. This is observed workflow behavior in the checked-in record, not a hypothetical race. `scripts/seed-convex.mjs:48–64` further explains that default `--prod` may target a different deployment from the live site, requiring named deployment selection.

Required editorial release record: draft -> research review -> copy review -> ready/scheduled -> build/preview verification -> active revision. Public discovery must only expose active content revisions whose body/assets are reachable. For current MDX keep Git PR and deploy preview as the reviewable artifact, then activate after health checks. Long term use typed research data as the source and compile public MDX projections. Revisions, rollback pointers, correction notes, scheduler timezone, idempotency, audit and dead-letter recovery belong in the operator product. Avoid rewriting static articles into a CMS just to ship the paid library.

### 7. Product surfaces communicate three different businesses

Homepage `app/(marketing)/page.tsx:93–113` sells a free Starter Kit, not research membership. `components/marketing/home-data.tsx:29–35` promises free kit and 1:1 build help. `app/startup-ideas/StartupIdeasGate.tsx:314–322` promises email unlocks the entire library. `/signin` copy `app/signin/SignInPanel.tsx:50–55` centers previews, validation work and projects. Dashboard `components/platform/shell/DashboardHome.tsx:110–117` says “server-owned records,” and lines 146–154 explain independent Saved/Interested state. These are coherent implementation milestones, not a coherent new customer journey.

`components/layout/IdeaNav.tsx:53–72` links All Ideas/Starter Kit without an account return affordance. Workspace has separate rail/navigation at `components/platform/shell/WorkspaceShell.tsx:40–70`. `app/globals.css:23–69` already defines dark and cream themes; retain Geist, warm neutrals/orange, accessible primitives and editorial reading surfaces. Consolidate navigation, account state, CTA and spacing tokens before fine visual polish. Add outcome-oriented copy and remove data-platform terminology. No browser-rendered visual judgment is claimed in this audit.

Target sequence: understand promise -> see today's useful idea -> browse public previews -> create account -> optional fit preferences -> save first idea -> see a specific premium benefit -> subscribe -> access complete research and shortlist -> perform one validation action -> return to updated evidence or next weekly action. Returning members should land at saved work/today, not re-enter an email gate.

### 8. Existing commerce is credits for building, not subscription access

`convex/platform/billing/catalog.ts:3–25` names purpose `weekendmvp_platform_credits_v1` and test-mode Starter $29/25 credits, Builder $79/75, Studio $199/220. This may offer useful Stripe event/idempotency patterns but does not establish recurring membership entitlements. Preserve existing money/ledger history and namespace separation; never reinterpret prior credits as research access silently. Inventory actual customers, subscriptions, unused credits, promises and refund exposure through authorized production evidence before transition.

Add subscription plan/version, billing period, Stripe subscription/customer linkage, entitlement state and expiry, cancellation-at-period-end, delinquency/grace rules, portal, refunds/disputes handling and reconciliation. Treat old build products as legacy offerings behind flags until a migration policy is approved. Parent infra/security review covers implementation details.

### 9. Engine and operator plans have drifted; the latest strategic task should supersede targets explicitly

Handoff `docs/wp/AGENT_HANDOFF.md:1–15` describes post-WP28 consolidation pending merge and WP29 next; main contains `docs/wp/wp29-progress.md:21–29`, ProjectWorkspace cockpit and `convex/platform/projects.cockpit.test.ts`. The registry remains behind this evidence. Historical program `docs/wp/program-platform-plan.md:17–26` explicitly keeps free research unchanged and makes paid deployment the product. UX brief at `docs/wp/platform-ux-brief.md:7–13` does the same. Current user request changes both.

A newer independent plan, `docs/plans/idea-engine/overview.md:1–30`, explicitly rejects dependence on WP29/30/38/31, proposes a local operator research/compiler engine and says “You do not need a clone of Ideabrowser.” It also documents stale HTML-era quality contracts. Those assumptions are now superseded by user intent, not a license to copy old task sequencing.

Reuse its storage-agnostic records, fixture-first providers, capped research and compiler/eval concepts. Do not mistake those markdown phases for implemented capability. Main has only engine contracts; provider/workflow branch work requires separate review before reuse. Freeze a new manifesto/roadmap with achieved code, deferred legacy scope and explicit replaced assumptions; preserve old rulings append-only.

### 10. Acquisition assets are valuable, measurement is not enough to establish demand

Keep 225 canonical idea URLs, 85 articles, tool/audience/problem hubs, author page, structured metadata and sitemap automation. `app/robots.ts:4–30` intentionally allows AI crawlers/full free content under the old contract; revisit public projections while preserving lawful discovery. Do not charge for a subset by hiding already-public HTML cosmetically. Decide transition treatment of existing full pages: retain legacy free articles and make new structured research premium, or a staged paywall with clear notice and protected content projection. No recommendation should assume traffic survives unchanged.

`lib/track.ts:19–26` maps marketing signup/CTA events; `:32–35` suppresses client analytics before consent. `content/newsletter/METRICS.md:6–9` contains only two historical April 21 sends with 3 and 2 unique clicks. These figures are not current funnel evidence or willingness to pay. Retrieve authorized current 90-day GA/GSC/Beehiiv/Stripe data before forecasting acquisition. Instrument activation, daily idea read, save, shortlist, premium prompt, checkout, verified subscription, cancellation and successful validation action; revenue truth must be server-side.

Newsletter skill `.agents/skills/newsletter/SKILL.md:3–12` targets twice-daily output and public archive; `:121–127` sources fresh IdeaBrowser signals. For a solo side business, start one daily idea email only if opt-in engagement supports it, otherwise allow daily/weekly digest choice. Reuse one approved daily edition across homepage/member app/email; no independent competing daily pick. Keep unsubscribe/consent distinct from account access.

### 11. Current quality checks can pass while the product contract is wrong

`ideas/SECTIONS.md:1–35` still requires HTML files and `scripts/audit-ideas.js`, which is absent. `.agents/skills/publish-idea/SKILL.md:74` calls the replacement a manual section gate. `.github/workflows/ci.yml:28–44` runs audit/typecheck/lint/tests/build but no `validate:idea-tags` or semantic research gate. Tag validation passed in this audit yet does not check citations or useful build times.

`tests/platform/wp23-explore.test.ts:9–35` uses source-string assertions and deliberately asserts explanatory text for per-page filtering. Those three tests/platform suites are not selected by current npm test scripts: test:convex only selects convex, test:auth only tests/auth, and security/redirects name their suites. This should be verified by test collection, then repaired. Existing tests are useful technical guardrails; they do not establish subscription E2E, global search, entitlements, recurring billing, publishing schedule or authenticated rendered UX.

Required gates: inventory/redirect compatibility; public-vs-premium payload tests including RSC/cache/JSON-LD; free-day rollover/replay; paid lifecycle and duplicate/out-of-order webhooks; account-linking and ownership; full-library search result correctness; corpus source and numerical grounding evals; draft not discoverable; scheduled activation/rollback; offline provider/cost caps; accessibility/keyboard/mobile; credential-backed isolated end-to-end stranger-to-paid journey. Have separate independent reviewers for security, subscription correctness, research quality and production activation.

## Keep / rebuild / defer

| Area | Decision | Reason |
|---|---|---|
| Next App Router, TypeScript, Convex, Vercel | Retain | Existing working app, ownership patterns, deploy and query integration; no evidence a platform rewrite helps |
| Canonical content URLs/SEO/articles/hubs | Retain, audit thin/old entries | Compounding acquisition assets and links |
| Auth and owner-scoped intents/projects | Retain foundation, productize account lifecycle | Relevant existing code; activation/recovery/settings still need validation |
| Public email gates | Retire as access mechanism | Only client-side marketing capture |
| Membership + daily free | Build | New authoritative business contract |
| Paid discovery/recommendations | Rebuild query contract; retain cards/URL filters | Existing per-page search/rank differs from user expectations |
| Research record and scoring | Rebuild typed evidence model, migrate corpus | Current labels/score compression cannot support trustworthy premium differentiation |
| Editorial engine/admin | Build a small operator-first control plane | Actual solo operator needs queues, review, scheduling, costs and rollback |
| MDX publishing | Retain for trusted static content, refactor activation | Avoid CMS rewrite; eliminate split deploy state |
| LLM-generated MDX | Constrain to trusted compiler/allowlisted output | `lib/mdx.tsx:164–194` passes source to MDXRemote; arbitrary generated/externally supplied MDX is executable syntax, so do not treat it as ordinary text |
| Billing credit ledger | Preserve; reuse event patterns carefully | Old paid commitments and audit trail must remain distinct |
| Anonymous landing-page generator, tenant hosting, lead capture | Defer launch/expansion | Larger abuse, privacy and operations burden unrelated to proving research subscriptions |
| Bring-your-own-idea reports | Phase 2, capped paid usage | Valuable upsell only after research QA/unit economics and member demand are proven |
| Community, chat, agents that build/run businesses, ads, outreach | Defer | Moderation/support/cost burden; not needed to validate the paid idea library |
| Starter Kit | Retain as secondary lead magnet | Useful audience fit; stop making it the primary homepage product |

## Suggested research engine acceptance standard

Run an owned pipeline from independent sources and permitted excerpts: gather signals -> normalize/deduplicate -> score suitability -> evidence research -> claim verification -> editorial draft -> deterministic checks -> independent editorial review -> schedule/activate. A human approves every launch-period premium report. Do not depend on competitor account/API access as the durable research supply chain.

Evaluate a fixed, versioned corpus containing easy software, marketplace, sensitive-domain, sparse-evidence, stale-pricing, contradictory-source, prompt-injection, inaccessible-source and duplicate-idea cases. Deterministic checks enforce schema, citation coverage, numerical provenance, missing-data behavior, no executable output, budget and section contracts. Human review scores actionable specificity, realistic first experiment, buyer access, weekend fit, confidence honesty and tone. A large model judge can assist but cannot certify its own work. Historical model names/prices in RULINGS need present-day official verification before implementation; do not encode obsolete prices as spend estimates.

## Suggested first strategy decisions

1. Define the daily-free rule and existing-subscriber transition clearly.
2. Choose the paid research promise and member activation action; validate willingness to pay with current audience interviews and a concrete preview.
3. Establish corpus suitability/quality baseline before selling the entire archive as deep research.
4. Freeze one replacement roadmap that prioritizes entitlements, subscription lifecycle, editorial release and an operator dashboard ahead of hosting.
5. Require a measured, reversible launch: cohort/flag rollout, restore and rollback rehearsals, no broken existing URLs, protected premium responses, verified billing, and an owner-manageable support schedule.
