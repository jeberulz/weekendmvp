# Program Manifest

Source of truth for the Weekend MVP Build Platform Program/Migration Lane. This manifest supersedes the proposed WP identifiers and operational sequencing in `docs/wp/program-platform-plan.md`. Workers may not re-litigate scope; disagreement or an `UNKNOWN` means stop and escalate to the orchestrator.

## Program

- **Name:** Weekend MVP Build Platform
- **Owner:** John
- **Orchestrator:** Codex `/root`
- **Branch:** `codex/platform-wave0-manifest`
- **Baseline commit:** `f35ccfd`
- **Goal:** Turn the existing validation/content site into a validation-first build platform where a user can preview a repository idea, sign up, pay, publish a tenant landing page, and manage research, tasks, revisions, leads, and credits from a signed-in workspace.
- **Launch target:** 2026-08-16 for the v1 repository-idea journey. The date is at risk and cannot override security, ownership, payment, preview-isolation, or restore gates.
- **Independence deadline:** all live Ideabrowser dependencies retired by 2026-09-05 after replacement quality gates pass.
- **Non-goals:** Tier 2 application scaffolds, arbitrary code execution, code export, custom domains, subscriptions, night shifts, outbound email/ads/social automation, teams, referrals, and a public live-activity feed.
- **Source docs:** `AGENTS.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, `docs/wp/RULINGS.md`, `docs/wp/program-platform-plan.md`, `docs/wp/platform-ux-brief.md`, `docs/PROJECT_STRATEGY.md`, Convex AI guidelines, and the Program Lane templates.
- **Required gates:** configured checks; zero unwaived high production dependency vulnerabilities on auth/routing/data paths; WCAG 2.1 AA; anonymous/cross-user denial; canonical/SEO regression; Stripe replay and concurrency; workflow retry/refund; preview isolation; tenant host matrix; policy/abuse; backup/restore; owner-approved production activation; engine/compiler evals.

## Binding Product Contract

- Public `/ideas/{slug}` remains the only canonical, shareable research page for a published idea.
- Signed-in Explore uses the same idea records and adds personal and project state. `Saved` and `Interested` are independent flags; `Building` is derived from an active project.
- Repository path: research -> free anonymous preview -> signup to keep -> checkout -> policy gate -> publish -> project.
- Own-idea path: signup -> first free Validation Report -> preview -> checkout -> policy gate -> publish -> project.
- Marketing uses dollars; credits are an internal task currency.
- Previews are private capability/owner artifacts with `noindex`, `noarchive`, private/no-store caching, disabled production lead capture, watermarking, and expiry. A public wildcard URL alone is not “non-shareable.”
- Tenant pages render only structured, schema-validated content. No raw HTML, JSX, script, arbitrary CSS, or client-supplied protocol is accepted.

## Wave 0 Audit Findings

1. Existing WP15-WP18 files are unrelated live work. Platform numbering therefore starts at WP19.
2. `npm run typecheck`, `npm test` (113 configured tests), and `npm run build` pass; the build produces 299 pages.
3. `npm run lint` is missing. CI also calls missing `check:links`, `check:stylesheets`, and `check:all-nav` scripts.
4. `npm audit --omit=dev` reports seven high-severity production vulnerabilities, including Next.js middleware/proxy bypass and direct Next, Convex, Sharp, Undici, and `ws` findings.
5. Convex Auth is absent and beta. The reserved Clerk-era `users` table conflicts with Convex Auth's owned tables; it must be migrated compatibly, never dropped/recreated.
6. The current plain Convex provider, public mutations, email gates, and client inputs provide no private platform authorization.
7. Legacy ship·able Stripe fulfillment is unsuitable for credits: its Convex mutation is public, all Checkout purposes are conflated, Convex failure still returns 200, and no durable idempotent ledger exists.
8. `@convex-dev/workflow` is installed but not mounted. There is no workflow manager, task state machine, worker lease, engine contract, telemetry, or eval harness.
9. Tenant routing, wildcard project association, reserved host policy, preview authorization, tenant CSP/cookie policy, site versions, leads, and rollback are absent. The legacy fallback origin is not operational.
10. Current publishing skills still depend on Ideabrowser and contain branch/deploy instructions that conflict with this workflow. There is no machine-readable MCP backlog inventory.

## Waves

| Wave | Purpose | Entry Criteria | Parallel Work | Gate | Exit Criteria |
|---|---|---|---|---|---|
| 0 | Audit, rulings, UX contract, registry repair, manifest | Owner starts Wave 0 | Three read-only audits | Docs-only profile: YAML parse, diff check, independent manifest review | Manifest and gate artifacts committed; baseline runtime failures assigned to WP20 without waiver |
| 1 | Reversible security, CI, environment, dependency baseline, and read-only migration preflight | Wave 0 docs gate passed | Test/CI, dependency investigation, and read-only inventory may split by non-overlapping files | Full checks, audit, canonical-host suite, production row/env inventory | WP20 green; no unwaived high auth-path finding; Wave 2 inventory ready |
| 2 | Auth, authorization, schema, shell, Explore, billing, intake | Wave 1 passed; production inventory and restore plan ready | UI shell may run beside auth; after WP22, WP23-WP25 may run in parallel with serialized shared-file windows | Auth, ownership, schema, ledger, intake, SEO/a11y | Stable authenticated project and money contracts |
| 3 | Research, preview renderer, tenant publish code, project operations | Wave 2 passed | WP27 may start after the named WP26 report/site-input contract subgate while remaining M3 work continues | Workflow/refund, engine quality/cost, preview, tenant-code, lead, policy gates | Complete staging journey with no production domain or live-charge activation |
| 4 | Production activation and launch surface | Wave 3 passed; backup, dry-run, owner approval | Marketing/case-study work may run beside gate rehearsal | Real payment smoke, wildcard/rollback, stranger journey, analytics | v1 live and verified; exact counts recorded |
| 5 | Idea Engine expansion and Ideabrowser retirement | M3 contract stable; provider/eval choices ruled | WP33-WP36 run in parallel after WP32 and compiler API freeze | Fixed-corpus quality gates per compiler; engine-only daily cycle | Live tool dependency removed before 2026-09-05 |
| 6 | Closeout and durable knowledge | Waves 4 and 5 complete | Independent final review and docs audit | Full checks, runbook review, recovery reconciliation | Program closed with no orphaned UNKNOWNs |

## Work Package Sequence

```text
WP19 Program freeze
  -> WP20 Security/tooling baseline
      -> WP21 Auth compatibility migration
          -> WP22 Platform schema + authorization contracts
              -> WP23 Shell/Explore -------+
              -> WP24 Credits/Stripe ------+-> WP26 Workflow + M3 reports --+
              -> WP25 Intake/projects -----+-> WP27 Renderer + preview -----+-> WP28 Tenant code/hosts/leads
                                                                                 -> WP29 Project cockpit/revisions
                                                                                 -> WP30 Trust/safety/observability
                                                                                 -> WP31 Launch activation/surface

WP26 -> WP32 Signals + idea generation -> WP33/WP34/WP35/WP36 compilers -> WP37 Offboarding
WP31 + WP37 -> Wave 6 closeout
```

`convex/schema.ts`, `convex/convex.config.ts`, `middleware.ts`/`proxy.ts`, `package-lock.json`, generated Convex files, webhook routes, ledger mutations, MCP configs, and production migrations have one writer per merge window. Parallel work may prepare new files against frozen contracts, but the orchestrator serializes these seams.

## Manifest Entries

| ID | Area | Files | Verdict | Risk | Wave | Worker | Dependencies | Boundary | Gate | Unknowns | Irreversible | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WP19 | Program freeze and recovery inventory | Program docs, workflow config, registry | In scope | High | 0 | Orchestrator + high reviewers | None | Docs only | Unique WP IDs; contradictions resolved; independent review; commit | Production data/env counts remain inventory items | No | This package is Wave 0 |
| WP20 | Dependency, security, CI, test baseline, and migration preflight | `package*.json`, `.github/workflows/ci.yml`, security/redirect tests, `.env.example`, redacted inventory evidence | Required before auth | Critical | 1 | High security worker | WP19 | Dependencies, CI, tests, automated a11y tooling, and read-only production row/env inventory; no feature UX or mutation | `npm audit --omit=dev` has no unwaived high finding; runnable lint/CI; typecheck/test/build; host regression; `users`/`saved_ideas`/Stripe/env inventory complete | Exact compatible Next/Convex/Sharp upgrades; browser/a11y runner; credential availability | No | Do not use blind `npm audit fix --force`; never record PII or secret values |
| WP21 | Convex Auth compatibility migration | `convex/schema.ts`, new auth/config/http files, root provider, auth routes/tests | Migration required | Critical | 2 | High auth worker | WP20 inventory/security gate; backup plan | Sole owner of auth schema/provider; route protection must not take tenant routing | Development: credential-backed Resend session/dashboard plus deterministic Google/logout/callback/expiry/same-email/anonymous/canonical contracts. Go-live: credential-backed Google redirect/callback/session/logout | Convex Auth beta/Next 16 viability; account-linking policy; email provider | Production auth rows and key rotation only after separate owner-approved execution record | Owner deferred credential-backed Google E2E to go-live; keep user IDs and optional legacy fields |
| WP22 | Platform schema, state machines, and authorization | `convex/schema.ts`, `convex/platform/{validators,authz}.ts`, ownership/state tests | Required | Critical | 2 | High data/security worker | WP21 | Sole schema writer; freeze tables/validators/generated API for parallel WPs | Two users/two projects denial matrix; bounded indexes; valid transitions; isolated deploy | Retention/deletion; support/admin role; document storage limits | Additive only; later narrowing separately gated | Defines projects, briefs, submissions, intents, tasks/steps, documents, sites/versions, leads, audit, credits, purchases, runs |
| WP23 | Signed-in shell, dashboard, Explore, and idea intent | `app/(platform)/**`, `components/platform/{shell,explore}/**`, `convex/platform/ideas.ts` | Required | High | 2 | Mid UI worker + high auth review | WP22; static shell may start after WP19 route contract | New platform UI/query files; no marketing/global-nav rewrite | Responsive keyboard navigation, AA contrast, state persistence/ownership, pagination/search/filter | Recommendation algorithm v1 | No | Reuses public records; no duplicate research corpus |
| WP24 | Credits, Checkout, ledger, refunds, and disputes | Platform billing Convex modules, new purpose-specific Stripe routes, billing UI/tests | Replace/segregate legacy path | Critical | 2 | High payments worker | WP22 | Platform billing namespace only; never extend legacy ship·able fulfillment | Concurrent spend, exact-once grant/debit/refund, forged-price denial, delayed/replayed/unordered event suite | Negative balance/suspension policy after refund/dispute; tax/VAT; portal value | Live Stripe objects and append-only ledger in Wave 4 | Money/refund policy is an owner ruling before live mode |
| WP25 | Repository/own-idea intake, briefs, projects, public CTA | Public idea CTA seam, `app/(platform)` intake/project cards, project/brief functions | Required | High | 2 | Mid UI + high data review | WP22; CTA URL contract frozen | Own intake/project modules; public idea edit limited to CTA; preserve canonical/JSON-LD | Both paths create one owner-scoped, resumable, confirmed versioned brief; CTA on every idea; SEO/a11y | Cal.com secondary path; brief edit/confirmation rules | No | Repository source snapshot is immutable/versioned |
| WP26 | Durable task workflow and M3 Validation Reports | Workflow mount/manager, engine contracts/providers, tasks/runs, report compiler/renderer/evals | Absent | Critical | 3 | High AI/backend worker | WP24 and WP25 | Workflow/M3 only; first subgate freezes versioned report and site-input contracts; external steps use stable idempotency keys; no long Next request | Contract subgate; resume/retry/cancel/timeout/onComplete; exact refund; citations/competitors/scores; cost under owner cap; PII-redacted telemetry | Worker/runtime, model/search/community providers, licensing, budgets | Live external jobs only in Wave 4 | WP27 may start after the contract subgate, not merely because WP26 opened |
| WP27 | Structured site renderer and isolated preview | Site config/version functions, preview route, renderer/components, metadata/security tests | Absent | Critical | 3 | High publishing worker + mid UI worker | WP25; passed WP26 report/site-input contract subgate | Structured renderer and preview path; no host cutover | Owner/capability-only preview; noindex/noarchive/no-store; expiry/watermark; disabled leads; schema/XSS/CSP tests | Capability lifetime; template/theme set | No | Anonymous repository generation may occur, but resulting artifact must use a scoped capability |
| WP28 | Tenant publish code, host routing, versions, leads, and activation runbook | `proxy.ts`/`middleware.ts`, host resolver, `next.config.ts`, tenant route, site/lead APIs, Vercel runbook | Absent; current fallback unsafe | Critical | 3 | High publishing/security worker | WP21, WP22, WP27 | Sole owner of reversible host-routing code, tenant metadata, lead endpoint, and dry-run/runbook; no production wildcard/domain activation | Apex/www/tenant/reserved/unknown/preview matrix; atomic publish/rollback in staging; host-only cookies; self-canonical; host-derived synthetic leads; privacy/rate limits | Keep/remove legacy fallback; reserved names; staging environment; live lead retention | No; production activation and customer PII are excluded | Unknown tenant is 404; WP31 alone owns live wildcard/domain/payment activation |
| WP29 | Project cockpit, tasks, artifacts, revisions, and refunds | Project pages/components, task/document/revision functions | Required | High | 3 | Mid UI + high workflow/payments review | WP24, WP26, WP28 contracts | Project workspace and revision task types only | Owner isolation; live status a11y; revision changes staged/live version; debit/refund exact once | Launch task granularity | Live revision job in Wave 4 | Status derives from server workflow, never client claims |
| WP30 | Trust, safety, abuse controls, and observability | Policy validators/classifier, rate limits, kill switch, AUP/terms, alerts/ops queries | Required before public publish | Critical | 3 | High security/AI worker | WP26-WP29 | Policy transition and operational controls; no launch copy | Red-team corpus; manual review; project kill switch; free-preview/report abuse; audit event; stuck-job/reconciliation alerts | Prohibited content policy, escalation owner, classifier | Policy activation only | Generated structured content remains binding for v1 |
| WP31 | Production activation, launch surface, analytics, and case studies | Homepage composition, `/build`, pricing, cases, `lib/track.ts`, runbooks/gate report | Required | Critical | 4 | Mid marketing/UI worker + independent high gate runner | WP20-WP30; owner approval | Public launch surface and production activation only | Full checks, real payment smoke, wildcard and prior-version rollback, stranger journey, truthful events/counters | Final copy; case-study candidates; target date feasibility | Charges, domain activation, public tenant sites | Dollars on marketing; no client-confirmed money events |
| WP32 | M1 signals plus M2 idea generation/scoring/review | `convex/engine/**`, crons, provider adapters, review UI, evals | Absent | High | 5 | High AI/data worker | WP26 contract | Signals/candidates/review only; no automatic publish | Idempotent harvest; provenance/licensing; dedupe; calibrated scores; human approval | Providers, cadence, locale, semantic dedupe, threshold | No | Can run beside launch after WP26 |
| WP33 | Owned idea-page compiler | `.claude/skills/publish-idea/**`, associated scripts/evals | Replace live MCP path | Critical | 5 | High content/AI worker | WP32; compiler API/eval freeze | Idea compiler only; branch-first; no direct-main push | Fixed corpus vs baseline; seven-section completeness; citations; seed/deploy/activate ordering | Judge weights/corpus | No | Historical Ideabrowser mentions may remain |
| WP34 | Owned article compiler | `.claude/skills/publish-article/**`, article keyword inputs/evals | Replace stale sourcing | High | 5 | High content/AI worker | WP32; compiler API/eval freeze | Article compiler only | Fixed corpus, provenance, SEO/AEO, citations, branch-first activation | Keyword provider and freshness | No | Runs parallel with WP33/35/36 |
| WP35 | Owned programmatic compiler | `.claude/skills/publish-programmatic/**`, keyword/tag provenance/evals | Replace stale sourcing | High | 5 | High content/AI worker | WP32; compiler API/eval freeze | Programmatic compiler only | Source-dated keyword evidence, taxonomy, internal links, build | Volume provider | No | Runs parallel with WP33/34/36 |
| WP36 | Owned newsletter compiler | `.claude/skills/newsletter/**`, newsletter docs/scripts/evals | Replace MCP/legacy paths | High | 5 | High content/AI worker | WP32; compiler API/eval freeze | Newsletter compiler only | Engine-only selection, current App Router/MDX paths, rendered/send dry run | Beehiiv send approval and cadence | External send requires owner approval | Runs parallel with WP33/34/35 |
| WP37 | Ideabrowser backlog, default flip, and retirement | MCP configs, active skill defaults, agent docs, backlog ledger, closeout ruling | Blocked until replacement passes | Critical | 5 | High integration worker + independent reviewer | WP32-WP36 | Sole owner of configs/default flip/credential removal | Backlog count zero; all compiler gates pass; engine-only idea+newsletter cycle; scoped live-dependency grep; rollback tag | Exact expiry/cancellation time; backlog IDs/status | Subscription lapse and credential removal | Do not require zero historical textual mentions |

## Owner Rulings Required Before Their Gates

| Needed By | Question | Default Until Ruled |
|---|---|---|
| WP21 | When Google and magic-link produce the same email, may accounts link automatically? | Do not auto-link; require a verified signed-in linking flow |
| WP24 live mode | What happens after a pack refund/dispute when granted credits were spent? | Suspend paid actions and allow a negative balance; never silently delete ledger history |
| WP24 live mode | Are tax/VAT handling and a customer portal required for v1 credit packs? | Remain in Stripe test mode; no live sale until the owner/accountant approves tax treatment. Defer the portal unless it has a concrete pack/refund job. |
| WP26 | Which model/search/community providers, source licensing, per-report cost cap, and retention policy are approved? | Provider adapters stay disabled outside isolated fixtures |
| WP28 | Is the dead legacy fallback removed or replaced, and which subdomains are permanently reserved? | Remove fallback from tenant hosts; unknown/reserved hosts return 404 |
| WP28/WP31 | Which staging host is approved, and what is the tenant-lead retention period? | Use isolated preview deployments with synthetic leads only. Store no production tenant leads until owner-approved retention/privacy text is recorded. |
| WP30 | Prohibited-content policy, regulated claims, manual escalation owner, and retention/deletion periods | No public publish without manual approval |
| WP31 | Is platform-first homepage positioning approved as the primary promise? | `/build` launches additively; homepage replacement waits |
| WP37 | Exact Ideabrowser expiry/cancellation time and authoritative backlog inventory | No config/key removal |

## Rulings Applied

| Date | Entry | Question | Ruling | Decider |
|---|---|---|---|---|
| 2026-08-05 | Domain | Brand and host model | Keep `weekendmvp.app`; platform at `/build`; customer sites at `{project}.weekendmvp.app` | Owner |
| 2026-08-05 | Auth | Provider | Convex Auth with magic link and Google; time-box beta integration and escalate if the security gate fails | Owner |
| 2026-08-05 | Auth | Google activation timing | Resend magic links gate development; credential-backed Google OAuth E2E is required at go-live and does not block WP22 | Owner |
| 2026-08-05 | Free hook | What is free? | Repository idea gets anonymous preview; own idea gets first report after signup | Owner |
| 2026-08-05 | UX | Signed-in model | Hilos-inspired workspace plus Explore over the canonical public idea corpus | Owner |
| 2026-08-05 | Billing | Launch prices | Pricing in plan §5 approved; exact Stripe objects wait for test-mode WP24 | Owner |
| 2026-08-05 | Idea Engine | Renew or replace Ideabrowser | Do not renew; replace M1-M4 and quality-gate every compiler before removal | Owner |
| 2026-08-05 | Numbering | Resolve collisions | Platform begins WP19 and manifest owns remapping | Orchestrator |

## Dispatch Rules

- The orchestrator creates each WP's `wpNN-stories.md` and `wpNN-progress.md`, assigns one bounded worker, and records the session before implementation.
- High-tier workers own auth, security, architecture, schema, payments, publishing, AI behavior, migrations, and final review. Mid-tier workers own bounded UI work after contracts freeze.
- Workers may create new files inside their boundary. Shared seams require an explicit integration window from the orchestrator.
- A worker stops on an unknown, file-boundary expansion, missing owner ruling, dependency-risk increase, production target, or destructive step.
- Gate runners are read-only and findings-first. The worker that built a WP does not provide its only review.
- Production changes, external sends, charges, DNS/domain mutation, key rotation/removal, and data backfills require the recorded approval and restore steps in `backup-restore.md`.
