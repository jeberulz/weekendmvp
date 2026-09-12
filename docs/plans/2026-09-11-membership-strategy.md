# Weekend MVP membership strategy

Weekend MVP should become a research and validation membership for people building a business alongside a full-time job. Keep the existing application foundation and canonical URLs. Rebuild the product around one shared free daily report, a paid research library, realistic founder-fit information, and a small workspace that turns research into a weekend experiment.

The product promise is: **Find an idea that fits your life. Test it before you spend your weekends building it.**

This is a proposed replacement strategy, supported by an audit of repository commit `24492003c60c208a2efd311fa0a707c104322869` and live research on 11 September 2026. The confirmed constraints are the same featured idea for everyone each day and operating expenditure below £200/month before meaningful revenue. Prices, policies, milestones and product details below are recommendations unless explicitly described as confirmed. This plan does not activate services, change existing customer rights, or amend historical rulings. Implementation starts only after this strategy is adopted.

Read alongside the [implementation plan](2026-09-11-membership-implementation.md), [member and super-admin design specification](2026-09-11-membership-design.md), [product/content evidence](2026-09-11-membership-product-audit.md), and [security/infrastructure evidence](2026-09-11-membership-security-audit.md). Those evidence files contain exact code references and verification limits. The design specification extends this strategy with the user's subsequent request for a complete logged-in product redesign; marketing landing-page design remains separate.

## 1. The business decision

The previous program sold website-building credits and treated research as free acquisition content. The newer operator-engine plan sought an internal replacement for IdeaBrowser sourcing. Neither is the complete membership business now requested. Continuing the old work-package order would spend time on customer hosting before delivering the new revenue product.

Use IdeaBrowser as the functional benchmark: daily discovery, useful research, saved work, personal fit, and a route from evidence to action. Build Weekend MVP's own interface, writing, research and methodology. A literal content clone would create both dependency and rights problems; IdeaBrowser's terms restrict copying, modification and redistribution of its content. Existing attribution does not itself establish a resale licence. Audit the provenance and rights of legacy material before packaging it into a paid archive. [S7](https://www.ideabrowser.com/terms)

The differentiation should be operationally useful, not merely a different colour palette:

| Customer constraint | Weekend MVP response |
| --- | --- |
| Five to ten hours available each week | Time estimates split into validation, demo, pilot and reliable service |
| Cannot answer customer calls during work | Filter for asynchronous sales, delivery and support |
| Modest startup budget | Upfront and monthly cost ranges, with assumptions and exclusions |
| No established audience | Specific paths to the first five buyer conversations |
| Fear of choosing badly | Evidence, counterarguments, missing information and stop criteria |
| Can use AI tools but lacks product experience | A small build brief and validation checklist with explicit exclusions |
| Too many interesting ideas | Compare three, choose one experiment, and keep the next action visible |

The initial audience is employed professionals with useful domain knowledge, basic digital confidence and a willingness to speak to buyers. Start with narrow B2B workflows, productized services and small software utilities. High-liability health/finance products, regulated advice, physical logistics, real-time operations and two-sided marketplaces can remain discovery content with conspicuous barriers; they should not dominate recommendations for a first weekend project.

Do not promise a profitable business by Sunday. Promise a decision, a small test, and a clearer next step. “Research-backed” means evidence exists; “validated” should mean an actual defined customer test passed. Search demand, forum complaints and an LLM score do not prove willingness to pay.

## 2. IdeaBrowser: current product analysis

The authenticated Pro hub, database/filter panel, current daily report, research entry flow, generator, trends library and build workspace were inspected. Public acquisition, pricing, terms and connector pages were also reviewed. No new research run, purchase, account modification or external send was performed. The super-admin interface and backend are not visible; any description of how those might work is an architectural inference, not an observed feature.

### Product structure and conversion

The public homepage offers the day's complete idea/report after signup, with free availability ending at midnight UTC. The member hub connects that daily selection to library discovery and saved activity. This creates a repeat visit and a clear archive upgrade boundary. [S1](https://www.ideabrowser.com/)

The hub visibly combines daily content, trending ideas, demand signals, niche research, recent work, agent connections, training and member outcomes. These are multiple return paths rather than a single endless card grid. Its weakness for a busy newcomer is competing calls to action and a large amount of material before a clear decision. Weekend MVP should retain continuity while reducing the initial home screen to today's idea, the member's selected experiment, and a short relevant shortlist. [S2](https://www.ideabrowser.com/hub)

The database displayed 1,878 ideas during inspection, while marketing pages used lower approximate counts. Treat these as different visible snapshots, not verified growth figures. Discovery includes search, card/table views, saved/interest/building states and filters for market, idea type, difficulty, founder requirements and scores. Weekend MVP should deliver whole-library search and consistent facets, then add recommendations with visible reasons. [S3](https://www.ideabrowser.com/hub/ideas/browse)

### The report is the paid product

The inspected report brings together the customer, demand, competitors, supporting sources, objections, founder requirements, economics and a proposed first plan. The useful pattern is evidence adjacent to the decision it supports. Its numerical forecasts remain publisher estimates rather than measured business outcomes. Weekend MVP should add task-based weekend scope, ongoing workload and explicit test/stop criteria, and distinguish facts from scenarios. [S4](https://www.ideabrowser.com/hub/ideas/food-product-launch-platform-for-family-recipes)

### Personalization, research and building

The generator uses profile/trend/insight inputs and lets members sort their generated candidates into interest states. Treat this as hypothesis generation, separate from researched publication. The research entry flow asks for a description, confirms a brief before spending a credit, and states a usual duration of 20–40 minutes; this is a displayed expectation, not measured performance. [S5](https://www.ideabrowser.com/hub/idea-generator), [S6](https://www.ideabrowser.com/hub/idea-agent)

The build workspace combines projects, founder/business context, agent skills and external tool connections. This is particularly relevant: Weekend MVP can help members carry a research brief into tools they already pay for, without immediately becoming their hosting provider. Start with a reviewed downloadable brief; add controlled integrations when there is demand. [S8](https://www.ideabrowser.com/hub/build), [S9](https://www.ideabrowser.com/agents)

### Monetization observed

The public pricing page displayed these annual USD offers on the research date. They are advertised offers, not the existing account's contract or a verified checkout total. Do not infer every feature's tier availability from text extraction where the comparison table uses graphical checkmarks. [S10](https://www.ideabrowser.com/pricing)

| Advertised tier | Annual price | Position and explicit limits |
| --- | ---: | --- |
| Starter | $499 | Discovery library, trends, market signals and 20 idea generations/month |
| Pro | $1,499 | Research/build tools; 20 research runs/year and 100 strategist interactions/month |
| Empire | $2,999 | Coaching/community layer; 40 research runs/year and 300 strategist interactions/month |

The strategic lesson is to meter expensive custom work while reusing editorial research across members. Coaching and community justify a different business model and workload; they should not become included obligations for a solo founder at a low subscription price.

### Feature disposition

| Capability | Initial membership | Expansion |
| --- | --- | --- |
| Shared daily idea and archive paywall | Required | Personalized digest preferences |
| Evidence-rich report and sources | Required | Refresh history and change alerts |
| Search, filters, saved ideas | Required | Semantic search if keyword search proves insufficient |
| Founder fit | Short optional constraints profile; explain matches | Learned recommendations after enough usage |
| Compare/choose/validation checklist | Required, small scope | Multiple experiments and progress history |
| Trends and niche signals | Embedded evidence in reports | Dedicated libraries once coverage/freshness justify them |
| Own-idea research | Deferred | Capped paid runs with draft confirmation and refunds |
| Idea generator | Deferred | Clearly labelled unverified candidates, metered |
| Context-aware strategist | Deferred | Retrieval only from authorized evidence; strict quotas |
| Build playbooks and exports | Reviewed templates and owned brief export | Scoped MCP/API connectors |
| Hosted customer sites | Park | Separate product case and abuse/privacy gates |
| Community, live coaching, founder cards | Park | Paid cohort experiment before permanent product commitment |
| Training and success stories | Small owned guides; truthful evidence | Expand with proven member outcomes and permission |

This is a phased route to functional breadth. It avoids making an underfunded first release responsible for every feature at once.

## 3. Audit of the current product

The codebase is worth preserving. It contains a substantial content corpus, canonical routing, Next.js/Convex integration, owned projects, saved/interested state, authentication foundations, an isolated preview renderer and transaction/idempotency patterns. A ground-up rewrite would discard useful work without solving the actual product gaps.

| Finding | Measured evidence | Consequence |
| --- | --- | --- |
| Content estate | 225 idea records and matching MDX pages; 85 articles | Preserve URLs and useful acquisition material |
| Supplier dependence | 184/225 source strings mention IdeaBrowser | Rights/provenance review and independent sourcing required |
| Score compression | 163/179 scored ideas have opportunity = 9 | Existing score is weak paid discovery information |
| Unrealistic precision | 223/225 build-time tags are 8–12 hours; skill maps confidence to hours | Re-estimate from work and skill requirements |
| Content completeness | 20 pages lack a dedicated Sources heading | Full editorial qualification before premium labelling |
| Current email gate | Full body rendered; localStorage/UTM can unlock visual gate | Cannot protect paid reports |
| Current daily route | Redirects to latest record | Needs an explicit daily edition and access window |
| Explore | Search/sort applied after pagination | Needs globally correct search and ordering |
| Billing | Test-mode project credit purchases | Needs independent recurring membership domain |
| Admin/engine | Plans/contracts, no working admin or full engine on audited main | These are implementation work, not activation switches |
| Publishing | Checked-in progress records show live cards before page deployment | Needs staged release and activation ordering |
| Planning | WP29 code is on main; handoff still calls it next | Reconcile facts before reusing package status |

These are repository findings, not a production inventory. Current traffic, paid users, unused credits, Stripe configuration, Beehiiv tier, provider bills and deployed security controls remain unverified. The audit did not establish demand or product-market fit.

The security review found current dependency advisories, unauthenticated legacy event-write functions and incomplete operational controls. It also found strong ownership boundaries worth retaining. It did not run exploits or establish that the live site is compromised. See the [security evidence](2026-09-11-membership-security-audit.md) for severity, reachability limitations and checks.

## 4. Membership and access contract

Launch with two tiers: **Free** and **Plus**. Avoid credits for simply reading research.

| Capability | Anonymous | Free verified account | Plus |
| --- | --- | --- | --- |
| Public summaries, articles, Starter Kit | Yes | Yes | Yes |
| Today's complete featured report | Signup prompt | Yes, until daily window ends | Yes |
| Complete report archive | Preview only | Locked | Yes, qualified published reports |
| Save ideas and personal notes | Signup prompt | Yes | Yes |
| Full comparison/validation plans | Preview | Today's included plan | Archive and saved plans |
| Own work and accepted minimal checklist | — | Retained/exportable, including after daily expiry | Retained/exportable after downgrade |
| Marketing emails | Only after valid opt-in | Preference-controlled | Preference-controlled |
| Custom research/chat | No | No | Not included in initial release |
| Account settings, own-data export/deletion | — | Yes | Yes |

The confirmed “one free idea per day” rule applies to complete reports. Browsable summaries are acquisition material, not additional complete unlocks. Every member receives the same edition; saving a report does not make its paid content permanently free. Personal notes remain accessible after subscription cancellation.

The design specification makes the personal-work boundary concrete: everyone can compare public summary fields, write their own test, and retain/export their own notes and progress. Full comparison fields and licensed report/plan material require current report access. An entitled template grants durable personal use/export of up to five accepted short task titles, estimated effort, task order and idea/revision link. Publisher evidence, detailed instructions, report-specific hypotheses/criteria and the full build brief remain linked licensed research; the corresponding personal-plan fields are member-authored. Adopt the exact field/licence mapping in design section 6 with M03 so downgrade, exports and migration preserve this distinction.

Recommended daily rule: a UTC edition starts at 00:00 and ends at the next 00:00. Show the local equivalent in the interface without changing the global window. Store the edition, approved report revision and effective interval on the server. A browser timezone, UTM parameter, email string or clock cannot grant access. Evaluate current time on protected server reads; a cached Convex query does not rerun simply because midnight has passed. Pair scheduling with a request-time expiry check and explicit client refresh behavior.

Schedule at least 14 approved editions ahead. The scheduler may activate only a ready revision. Before opening an edition, select its primary or preapproved fallback atomically and lock the selected idea for that date. After activation, corrections may replace only an approved revision of that same idea; a serious issue withdraws access rather than granting a second different free idea. If neither candidate is safe before opening, show temporary unavailability and notify the operator. Do not silently carry yesterday's entitlement into another day or publish an unreviewed AI draft. Already-delivered content cannot be recalled from a reader's browser; enforce the boundary for subsequent retrieval, downloads and exports.

### Pricing hypothesis

Test **£15/month** and **£120/year** for Plus. The annual offer is £10/month equivalent with the complete annual charge prominent. These are hypotheses to validate with customers, not inferred market-clearing prices. Make cancellation easy, avoid lifetime deals, and do not sell unlimited AI. Initially offer monthly paid beta access only; enable annual billing after at least one renewal cycle and reliable content operations.

A customer should pay for less wasted time, better selection, useful evidence and a practical experiment—not the raw count of ideas. Launch with roughly 30 genuinely qualified reports and a 14-day forward schedule drawn from that reviewed inventory, clearly disclosing the paid catalogue size. The 225 old pages are not automatically 225 premium reports.

## 5. Accounts and user journeys

### First visit to first useful action

The homepage explains the employed-builder audience, previews today's idea, shows a real sample of report depth and offers “See today's idea.” Signup uses the existing Google/email foundation. Return the member to the report they requested; do not require a multi-step profile before access. After the first read, invite an optional profile: weekly hours, experiment budget, technical comfort, industries known and sales preferences.

The first activation event is **saving an idea and choosing a concrete validation action**, not merely logging in. The dashboard should display the chosen experiment, its next step and today's edition. A member who has already chosen a project should not be pushed into perpetual browsing.

### Upgrade and return

A locked report shows its public summary, research sections included, freshness, fit information and an honest upgrade offer. Checkout is hosted by Stripe. The return page shows payment pending until the server verifies entitlement; it then restores the exact report. Delayed webhooks must not prompt a second purchase. A returning member sees saved work and current access state across devices.

### Account completeness

Implement login/logout, session expiry and revocation, email delivery failure handling, account recovery, safe identity linking, verified email changes, preferences, receipts/portal access, export and deletion. A newsletter email address is not a verified account. Do not merge Google and email identities solely because an untrusted address string matches. Require an authenticated linking flow and preserve existing user IDs and owned records.

Marketing opt-in must be separate from account creation. Cancelling newsletter delivery does not cancel membership; cancelling billing does not delete an account. Subscription cancellation preserves access until the paid period ends. Customer-owned notes and progress remain exportable independently of access to the report licence.

### Interface and voice

Retain Weekend MVP's warm neutrals, orange accent and existing typography foundation, then consolidate spacing, navigation, form states and reading components. Use one member navigation: Today, Explore, Saved, My Weekend, Account. Keep Admin separate. Full reports need a readable single-column narrative with a compact section index on desktop and clear navigation on mobile.

The [design specification](2026-09-11-membership-design.md) is the concrete build baseline for this direction: Hilos-inspired workspace warmth, Aura-inspired library organization and IdeaBrowser-inspired research structure, using the existing shadcn/Radix foundation. It defines ten member screen families, twelve operator screen families, tokens, dimensions, responsive behaviour, access/payment states, copy, component contracts and design verification. Use one warm light member workspace and a denser separate admin console; dark mode follows a complete state/contrast pass. Keep public marketing styling and legacy customer obligations isolated during the transition.

Complete the D0–D3 flow, foundation and visual prototype gates before their corresponding production screens are built. The larger design scope revises the programme estimate to 55–90 combined design/engineering working days plus a real-renewal beta; see the implementation plan for calendar assumptions. It does not require a new recurring design-tool subscription or change the £200/month ceiling.

Avoid build-system language in the product. Replace “server-owned records” with the next useful action. Examples: “Five hours this week? Start here.” “The evidence is promising. Pricing still needs a test.” “Save this for Saturday.” Empty, locked, loading, offline, expired and payment-pending states need the same design attention as the happy path. Target WCAG 2.2 AA, keyboard completion and reduced-motion support.

## 6. Research quality and content supply

### The owned report contract

Each qualified report should answer: who has the problem, what evidence supports it, how buyers solve it now, why a narrower alternative could work, why it could fail, and what can be tested this weekend. Include named competitors and dated pricing, demand measurements with provider/geography/period, acquisition routes, a small initial offer, costs, task estimates, upkeep, prerequisites and a decision checklist.

Separate three classes of statement: **observed fact**, **analytical inference**, and **testable assumption**. Revenue scenarios must show customers × price and capacity constraints. Never describe hypothetical revenue as traction. Competitor absence is “not found in this search,” not proof there are no competitors. Search volume is an estimate for a query/market/window, not a customer count.

Replace the single persuasive score with explainable dimensions: problem evidence, buyer reachability, small-scope feasibility, ongoing workload, upfront cost and founder fit. Display confidence separately. Any optional overall ranking uses a documented rubric and version; weak evidence can mean “insufficient evidence.” A high score is not a probability of success.

### Production pipeline

Use one storage-independent research contract shared by the operator CLI and the future admin application. This salvages the useful part of the operator-engine plan while making the admin workflow the durable operating interface.

1. Collect permitted signals from independent sources and manual nominations.
2. Normalize source URLs, dates, topics and licensing/retention requirements.
3. Deduplicate by buyer, problem, solution and existing catalogue similarity.
4. Triage for audience fit before spending on deep research.
5. Research competitors, demand, customer complaints and contrary evidence.
6. Build claim-to-source records; verify material numbers against original sources.
7. Draft typed report blocks and a Weekend MVP experiment plan.
8. Run deterministic schema, provenance, safety, taxonomy and cost checks.
9. Have an editor approve the exact revision, including the weakest claims.
10. Schedule, activate, monitor and later refresh or withdraw the revision.

The LLM receives source material as untrusted evidence, not instructions. It must not execute commands, visit arbitrary internal URLs or publish. Do not render arbitrary generated MDX: use validated structured blocks or a constrained Markdown AST. Trusted historical MDX remains a separate publishing path for static articles.

### Editorial workload

Start with seven approved daily selections/week, created in batches. A 14–21 day buffer makes this possible alongside a day job. Estimate 20–30 minutes of human review per accepted report plus triage, corrections and distribution: approximately 5–8 operator hours/week is an initial planning assumption. Measure actual review time; daily top-quality research will not become effortless through model choice alone.

If this exceeds capacity, narrow the topics and reduce new custom features. Daily selection may use a reviewed report already in the library; label repeats rather than imply seven brand-new reports every week. Do not silently lower evidence standards to satisfy the calendar.

Refresh volatile competitor pricing and demand evidence on an initial 30–90 day cadence, selected by claim type and prominence. Foundational evidence may remain useful longer with its date visible. Reports with expired critical evidence enter review and stop appearing as fresh recommendations. Maintain corrections and revision history.

## 7. LLM requirements and evaluation

Use models for research synthesis and structured drafting. Keep authentication, access control, billing, date arithmetic, numerical transformations and publication decisions deterministic. No model training or fine-tuning is needed initially.

Current official OpenAI documentation supports this starting configuration; exact account access still needs an implementation-time API smoke test. This retains the historical Sol synthesis choice while replacing stale cost assumptions. No dated Sol snapshot was listed on the inspected model page, so do not invent one. Record the returned model ID, prompt/schema hashes and evaluation version; rerun the corpus when aliases or providers change. [S11](https://developers.openai.com/api/docs/models/gpt-5.6-sol)

| Task | Starting choice | Condition |
| --- | --- | --- |
| Cheap extraction/tag suggestions | GPT-5.6 Luna | Validate against schema; no unsupported metric creation |
| Bounded rewrites/formatting | GPT-5.6 Terra | Compare against Sol on a fixed corpus first |
| Final research synthesis and hard counterarguments | GPT-5.6 Sol | Source-grounded structured output; editor approval |
| Web evidence discovery | Perplexity Sonar Pro | Follow citations to originals; provider answers are not primary evidence |
| Keyword metrics | DataForSEO selected endpoint | Real provider measurements, locale/date recorded; null when unavailable |
| Entitlements, financial math, publishing | Application code | Never delegate authority to the LLM |

At inspection, token prices per million input/output tokens were Sol $4/$20, Terra $2/$12 and Luna $0.20/$1.20. Sol pricing is promotional at least through 21 November 2026. These exclude tool charges, taxes, retry costs and long-context multipliers. Keep current rates in a versioned configuration and validate invoices against telemetry. [S11](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [S12](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [S13](https://developers.openai.com/api/docs/models/gpt-5.6-luna)

Illustrative synthesis only: 20,000 input plus 5,000 billed output tokens at Sol's current rates costs $0.18. A second equivalent review brings it to $0.36 before research, extraction, retries and overhead. Actual reasoning/output usage can differ materially. Perplexity Sonar Pro separately prices input/output and request context; DataForSEO requires at least a $50 top-up, so cash expenditure can exceed a month's consumed usage. Do not reuse the old plan's $0.52/report estimate as a forecast. [S14](https://docs.perplexity.ai/docs/sonar/models/sonar-pro), [S15](https://dataforseo.com/faq)

Retain the prior $4 hard per-research-run ceiling as an upper safety boundary, subject to revalidation. Target substantially lower average cost: an initial £35 LLM and £20 data allowance cannot finance 30 reports/month at the hard ceiling plus extensive retries. Reserve estimated worst-case spend before each call, cap calls/output/concurrency, account for failed billable calls, and stop dispatch when the monthly budget is exhausted. Shared editorial research is generated once for all members; no model call is required on a report read.

### Quality gate

Create 30–50 evaluation cases spanning strong opportunities, sparse evidence, stale prices, conflicting sources, duplicate concepts, sensitive domains, impossible weekend scopes and malicious source instructions. Include deliberately bad cases that must be rejected.

Require valid schema and source links for every material numerical claim; zero fabricated citations or invented keyword measurements in the acceptance set; explicit uncertainty when evidence is absent; no unreviewed executable content; and reliable hard-budget behavior under timeouts/retries. Have a human score buyer specificity, counterarguments, scope realism and usefulness on a 1–5 rubric, targeting at least 4 on each for publishable reports. An automated judge is a review aid, not independent verification of its own output.

Maintain a held-out set and a regression set. Measure cost per accepted report including rejected runs, editor minutes, correction rate, source validity and quality by category. Later chatbot evaluations must also check cross-user retrieval, expired membership and prompt-injection resistance.

For implementation agents, use high-capability reasoning for architecture, auth, billing, security, migrations and final review; mid-tier agents for bounded UI work; inexpensive models for mechanical checks. Human product decisions and independent review remain necessary. Coding-agent subscriptions are development tools, separate from production API spend.

## 8. Infrastructure and operating economics

Keep a modular monolith: Next.js on Vercel; Convex for authenticated data, membership projections, report versions and scheduling; Stripe Checkout/Billing/Portal; Resend for transactional email; Beehiiv for opted-in editorial distribution. Use existing provider relationships where verified. Do not introduce Kubernetes, a separate search cluster, a second database or a custom authentication server for this scale.

Use Convex text indexes and bounded facet queries before external search. Keep public catalogue projections small and cacheable; private reports require access checks and private/no-store delivery. Expensive research runs happen in durable background stages, not a long browser request. Start with source/claim retrieval rather than a vector database; add embeddings only after a measured retrieval need.

Convex Auth is a material gate: current docs describe it as beta and Next.js support as experimental. Preserve the existing user model while time-boxing verification of login/linking/session revocation and strong admin authentication. If it cannot satisfy those requirements reliably, choose a supported managed identity integration before adding billing customers. Avoid an automatic migration solely because another stack is fashionable. [S16](https://docs.convex.dev/auth/overview)

Vercel Hobby is restricted to non-commercial personal use, so budget Pro for the business. Published starting prices are Vercel Pro $20/month, Convex Professional $25/developer/month and Resend Pro $20/month. Convex Professional includes daily backups; backups still need a restore exercise. Resend Free's 100/day cap can bottleneck login emails during a launch. [S17](https://vercel.com/docs/plans/hobby), [S18](https://vercel.com/pricing), [S19](https://www.convex.dev/pricing), [S20](https://resend.com/pricing)

Beehiiv Launch advertises up to 2,500 subscribers, unlimited sends and API access excluding the Send API. Paid automation/send features must not be assumed free. Under the lean budget, prepare drafts in the operator workflow and schedule approved sends in Beehiiv's UI if the current account lacks the necessary API. Do not build an admin Send button that cannot work on the paid-for plan. [S21](https://www.beehiiv.com/pricing)

### Monthly envelope

These are GBP planning allowances, not currency conversions or account-specific quotes. Verify actual invoices, VAT, renewal terms and existing subscriptions before committing. The ceiling includes software needed to run the product, but excludes founder labour, development subscriptions and one-time professional review; those need a separate investment decision.

| Cost category | Monthly allowance |
| --- | ---: |
| Vercel commercial hosting | £25 |
| Convex including recovery capability | £25 |
| Transactional email | £20 |
| Beehiiv within existing/free eligible tier | £0 incremental assumption |
| LLM production usage | £35 |
| Search/keyword data | £20 |
| Backup storage, domain/DNS allowance | £10 |
| Basic monitoring using included/free capabilities | £0 |
| Tax, currency, usage and incident contingency | £40 |
| **Planned ceiling** | **£175** |

This is feasible only if the Beehiiv assumption and existing provider commitments hold. An already-paid newsletter plan, initial DataForSEO deposit, advanced monitoring or extra API usage must come out of contingency or force a revised scope. Count cash top-ups separately from consumption. Set warning thresholds at 50%, 75% and 90%; stop optional generation before the total forecast reaches £200. Vendor billing alerts are not guaranteed hard caps—enforce application dispatch limits and measure accrued usage. Preserve login, paid reads and billing processing when optional research is paused.

### Contribution model

For illustration, a £15 monthly payment using a standard UK card incurs £0.225 + £0.20 payment processing plus £0.105 at Stripe Billing's advertised 0.7% usage rate: approximately £14.47 remains before VAT/taxes, refunds, variable serving cost and labour. International cards and currency conversion differ. [S22](https://stripe.com/gb/pricing)

At £175 monthly operating cost, roughly 13 monthly subscribers cover that amount before those exclusions. With a conservative £2/member provision for refunds/support/variable costs, approximately 15 are needed. These are break-even arithmetic, not a profit forecast. At 50 monthly members, £750 gross becomes about £448.50 after the illustrative fees, £100 provision and £175 operating cost, before taxes and founder pay. Annual plans lower recognized monthly revenue per member; track cash separately and reserve for refund obligations.

If human operation takes six hours/week, the apparent software margin is not the owner's hourly profit. The business is viable when recurring contribution and customer outcomes justify the actual work. No traffic, conversion or retention figures were available to forecast when that will happen.

## 9. Super-admin and business operations

The super-admin dashboard is a launch requirement. Its purpose is to keep one operator in control of content, access problems, money reconciliation and spend without editing production tables manually.

| Area | Required operator capability |
| --- | --- |
| Overview | Current edition, next 14 dates, queue failures, costs, payment/access mismatches |
| Editorial | Candidate triage, evidence review, revision diff, approve/reject with reason, schedule |
| Catalogue | Tags, freshness, rights status, public summary, protected report, correction/withdrawal |
| Members | Minimal account lookup, access state, consent state, export/delete request status |
| Billing | Read provider-linked status, reconcile, investigate failed events; link to Stripe for refunds |
| Operations | Retry safe jobs, inspect redacted errors, pause generation, pause new checkout, roll back content |
| Audit | Actor, command, reason, timestamp, before/after identifiers and correlation ID |

Bind the initial admin role to a verified identity through deployment-only bootstrap, then disable bootstrap reuse. Require MFA or equivalent managed identity assurance and fresh authentication for dangerous commands. Protect every admin server operation, including reads. A hidden route and an email comparison in a client component are insufficient.

Admin must not receive a general cross-owner bypass, impersonation capability or direct ledger editor. For support, expose a narrow diagnostic view. Audits are append-only through the application; database operators can still alter storage, so stronger tamper evidence needs restricted privileges plus external audit exports. Avoid calling database rows absolutely immutable.

Use a daily 10–15 minute check for access/billing failures and schedule coverage; two editorial batches/week; a weekly reconciliation/cost/source-health review; and a monthly restore exercise, access review and dependency review. Promise a realistic support response such as two working days, with automated acknowledgement. Automated alerts should identify impact and the recovery action. Do not promise 24/7 human support.

## 10. Security, privacy and launch assurance

Prioritize the confirmed findings: patch vulnerable dependencies; restrict legacy public event writers; remove client-only trust from protected reads; add subscription lifecycle handling; prevent unapproved tenant publishing; and repair test collection. The current advisory result is a release blocker, not evidence of a live compromise. The Next AVIF advisory identifies 16.3.3 as a fixed version; select the complete compatible patch set during the dedicated security work package. [S23](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)

Threat-model anonymous visitors, free users, paid users, suspended users, admins, webhook senders and malicious research sources separately. Exercise object-level authorization, mass assignment, input bounds, CSRF/origin rules, XSS, SSRF, prompt injection, replay, scraping and denial-of-wallet scenarios. Feature flags must be enforced server-side. If customer hosting is parked, directly calling its mutation must also fail.

Account for data export/deletion, sessions, consent records, billing retention, provider payloads and backups. A sensible starting policy is short retention for raw research/provider payloads and operational logs, longer retention for approved non-personal evidence, and legally required retention for financial records. Exact durations belong in the adopted data inventory. This revises the old indefinite-research-retention assumption: licensed source restrictions and personal data must not be retained forever merely because research is valuable.

For a UK-operated launch, confirm merchant entity, tax treatment, sales geography and consumer terms with qualified advice before charging. Use explicit marketing opt-in as the simple default and preserve suppression records. Explain total/recurring prices, cancellation and renewal terms clearly. Do not copy a competitor's blanket no-refund policy; digital services/content and evolving subscription rules need the correct treatment for the offering and launch date. [S24](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/), [S25](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling)

No ethical or technical process can certify that a system works perfectly. Set explicit acceptance criteria, independent reviews, monitoring and recovery. Proposed initial objectives are 99.5% monthly application availability, p95 cached public page delivery under one second, protected reads under two seconds excluding network extremes, and verified payment access normally within 60 seconds with an alert at five minutes. These are targets to measure in staging and production, not promises already achieved.

## 11. Smooth transition and acquisition

Keep `www.weekendmvp.app` and existing canonical paths. Change the main proposition and navigation in a controlled rollout; keep the Starter Kit as a secondary lead magnet. Avoid a domain or stack migration at the same time as billing and content access.

Default to useful, indexable public summaries on existing idea URLs and genuinely protected complete reports. This follows the one-free-report rule without pretending previously published material can be made secret. Preserve topic, title intent, backlinks, author, relevant links and substantive public usefulness. Removing existing free detail can affect search rankings and reader trust; pilot the projection on a small noncritical set and measure before rolling across the corpus. Do not hide full content in HTML for crawlers while presenting a visual paywall to people.

Inventory all accounts, newsletter subscribers, payments, credit balances and promised benefits before cutover. Preserve identity and private records. Keep old credit products and ledgers separately named; no automatic conversion, expiry or forced charge. Announce changes only to appropriately opted-in recipients; never create authenticated accounts from an email list. Old email links should land on the relevant public summary and explain current access. Their UTM parameters must cease being credentials.

Acquisition should focus on one consistent journey: a concrete idea from an article, social post or newsletter → today's useful report → a saved experiment → a relevant paid archive offer. Refresh the strongest existing SEO pages before mass-producing more. Publish practical examples of scope cuts and buyer tests for employed builders. Avoid paid acquisition until there is evidence that members renew and contribution supports it.

The North Star is **members completing a buyer-validation action each week**, with a clear self-reported/evidence-backed distinction. Track signup completion, first report read, first save, chosen experiment, completed action, paid conversion, renewal and cancellation. Measure daily and weekly cohorts; do not interpret a small sample as a stable percentage. Revenue comes from server-verified billing events; consent-gated analytics can undercount behaviour and must be interpreted accordingly.

### Validation and expansion gates

Recruit 10–15 target readers for problem/price interviews and a concrete report comparison. A useful initial decision gate is at least five willing to pay the proposed monthly price and able to explain the benefit. This is a planning threshold, not statistical proof. Open a 10–25-member paid beta after technical gates pass. Observe at least one renewal and preferably two before annual sales or feature expansion.

Review cancellations and inactivity individually at this scale. If people browse but never choose an experiment, improve selection and next-action design. If they choose but cannot reach buyers, improve distribution guidance. If they act and leave after success, consider a time-bounded research pass or alumni offer before artificially forcing retention. Add custom research only when members request it and its measured contribution and review load fit capacity.

## 12. Decision and next execution boundary

Adopting this strategy would explicitly replace the old free-entire-library/paid-hosting launch promise, prioritize membership and editorial operations, and park the tenant-hosting critical path. Preserve ownership, payment integrity, privacy, independent review and recovery gates. Reconcile the existing operator-engine plan into the shared report/pipeline contract instead of starting a third competing implementation.

The next action is a documentation and inventory freeze, followed by security containment, account/entitlement contracts and a reviewed sample corpus. The [implementation plan](2026-09-11-membership-implementation.md) defines work boundaries, dependencies, acceptance gates, migration steps, rollback and release milestones. It intentionally uses provisional membership identifiers until adoption resolves the existing WP registry.

## Sources

All live sources accessed 11 September 2026. Authenticated pages require a member session; their visible features were inspected, not their internal implementation. Marketing outcome claims were not independently audited.

1. IdeaBrowser, [Homepage and free daily offer](https://www.ideabrowser.com/).
2. IdeaBrowser, [Member hub](https://www.ideabrowser.com/hub), authenticated observation.
3. IdeaBrowser, [Idea database](https://www.ideabrowser.com/hub/ideas/browse), authenticated observation.
4. IdeaBrowser, [Daily report](https://www.ideabrowser.com/hub/ideas/food-product-launch-platform-for-family-recipes), authenticated structural observation.
5. IdeaBrowser, [Idea generator](https://www.ideabrowser.com/hub/idea-generator), authenticated observation.
6. IdeaBrowser, [Idea research entry](https://www.ideabrowser.com/hub/idea-agent), authenticated observation.
7. IdeaBrowser, [Terms of Service](https://www.ideabrowser.com/terms), updated 18 April 2025.
8. IdeaBrowser, [Build workspace](https://www.ideabrowser.com/hub/build), authenticated observation.
9. IdeaBrowser, [Agent Connector](https://www.ideabrowser.com/agents).
10. IdeaBrowser, [Pricing](https://www.ideabrowser.com/pricing).
11. OpenAI, [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).
12. OpenAI, [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
13. OpenAI, [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
14. Perplexity, [Sonar Pro pricing and model documentation](https://docs.perplexity.ai/docs/sonar/models/sonar-pro).
15. DataForSEO, [FAQ and minimum funding](https://dataforseo.com/faq).
16. Convex, [Authentication overview](https://docs.convex.dev/auth/overview).
17. Vercel, [Hobby plan restrictions](https://vercel.com/docs/plans/hobby).
18. Vercel, [Pricing](https://vercel.com/pricing).
19. Convex, [Pricing](https://www.convex.dev/pricing).
20. Resend, [Pricing](https://resend.com/pricing).
21. Beehiiv, [Pricing and feature availability](https://www.beehiiv.com/pricing).
22. Stripe, [UK pricing](https://stripe.com/gb/pricing).
23. GitHub/Next.js, [AVIF optimizer security advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), published August 2026, updated September 2026.
24. ICO, [Electronic-mail marketing rules](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/).
25. UK Government, [Online selling requirements](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling).
26. Stripe, [Subscription webhooks and access lifecycle](https://docs.stripe.com/billing/subscriptions/webhooks), used in the implementation plan.
27. Weekend MVP, [Live homepage](https://www.weekendmvp.app), public observation: Starter Kit remains the primary promise.

Repository evidence is the audited SHA and the two accompanying audit reports; historical progress logs are explicitly distinguished from code and live observations.
