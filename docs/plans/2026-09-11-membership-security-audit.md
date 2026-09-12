# Weekend MVP security and infrastructure audit for paid research transition

Audit date: 2026-09-11. Scope: read-only source and dependency review of `/Users/jeberulz/Documents/AI-projects/weekendmvp`, main at `24492003c60c208a2efd311fa0a707c104322869`. No source mutations, production calls, exploit attempts, deployments, provider account operations, or secret reads. Parent strategy work may subsequently change the branch; this report describes the audited SHA. Read handoff/workflow/rulings/Convex guidance. Existing plans and historical gate claims are context, not evidence of current production behavior.

## Executive judgment

Retain Next.js + Convex + Stripe + Resend + Beehiiv rather than undertake an infrastructure rewrite. The significant work is a new paid research entitlement/content architecture, account lifecycle and operator control plane, and production operations. Existing platform identity/ownership and ledger code are useful foundations; existing newsletter gates and one-off credit purchases do not constitute a paid research application. Do not activate payment access based on the current gate. Pause the customer website hosting branch of the product unless it has a separately justified business case: it adds tenant, abuse, moderation, lead PII, and availability obligations without being necessary for paid startup research.

## Prioritized findings

### S1 — Critical dependency advisories; release gate failure, exploitability not established

Current `npm audit --omit=dev --audit-level=high --json` reports four production dependency entries: Next critical, sharp high, js-yaml high, fflate moderate. Evidence is [dependency audit snapshot](2026-09-11-membership-dependency-audit.json). Package-lock locks Next 16.3.0 (`package-lock.json:10675`), sharp 0.35.3 (`package-lock.json:12176`), and vulnerable fflate (`package-lock.json:7717`); `package.json:94` explicitly overrides js-yaml to 3.15.1, so simply upgrading gray-matter may retain the pin.

Registry advisory IDs and fixed boundaries returned on this audit:
- Next Windows-hosted unauthenticated RCE: GHSA-p293-qw3h-jr36; affected <16.3.3.
- Next image optimization AVIF unauthenticated RCE: GHSA-2xp9-vwfh-vxw4; affected <16.3.3.
- sharp bundled libheif issues: GHSA-rgj7-g3m4-5g8c; affected <0.35.4.
- js-yaml CPU exhaustion with empty merge sources: GHSA-2883-xcg3-v3hh; affected <3.15.2.
- fflate malformed ZIP64 infinite loop: GHSA-px8p-9vwx-vf98; affected 0.7.0–0.7.4.

Do not label the production site remotely exploitable solely from audit severity. The Windows condition likely differs from the documented Vercel host, but actual runtime/platform/image optimizer usage was not inspected; AVIF/input reachability and bundle applicability need review. Patch through controlled dependency change and rerun real build/image/content/auth checks. Do not auto-force audit fixes. Existing CI includes this audit and should fail on the current registry result.

### S2 — High: legacy event writers accept anonymous client writes

`convex/payments.ts:10-37` exports a public mutation with no authentication or signature validation. Anyone able to reach the deployed Convex function can insert supplied event IDs, emails, money fields and raw payloads. The signature check at `app/api/stripe-webhook/route.ts:89` only protects callers going through that route; direct Convex requests bypass it. This is verified source behavior, not a production exploit test.

Impact: forged payment logs, storage/operational pollution. A known Stripe event ID can be pre-seeded, causing the legitimate webhook to return early as a duplicate (`app/api/stripe-webhook/route.ts:123-135`), suppressing follow-up enrollment. Guessing opaque event IDs is not assumed; this is a conditional consequence of obtaining one. This does **not** grant platform credits: those use a separately authenticated HMAC bridge and internal settlement.

`convex/subscriptions.ts:9-28` likewise allows anonymous arbitrary newsletter event insertion without proof that Beehiiv accepted it or user consent. It is a log, not the subscription entitlement table. Convert server-only event writes to internal functions reached through verified HTTP/provider action boundaries; bound payload lengths and log minimal PII. Add negative tests for the public/internal function visibility boundary rather than trusting convex-test to enforce it.

### S3 — High for paid launch: current gates intentionally expose research

`components/ideas/EmailGate.tsx:98-110` always renders children; lock is a CSS blur/clip. `app/ideas/[slug]/page.tsx:535-539` renders full body via MDX. `convex/ideas.ts:44-80` exposes full idea documents through anonymous bySlug/list. Category/revenue/tool/audience/latest queries also return full documents; schema includes body and provenance (`convex/schema.ts:59-62`). Existing gate resolves a localStorage email, email URL query, and newsletter UTM marker as access. This is intentional email acquisition behavior under the previous SEO contract, not a defect against its original requirements. It cannot implement paid access.

Required: separate public teaser/card DTOs and protected report payloads. A single server entitlement function must guard all report reads, downloads, exports, search snippets, related data and future tool/MCP responses. Prevent private data in HTML/RSC/JSON caches, metadata/structured data, client bundles, preload responses, and static builds. Browser blur, email possession strings, Beehiiv membership and UTM parameters must not be authorization. Keep historical free content policy explicit; a smooth transition can preserve old public pages while charging for new deep research/features, or stage paid sections at existing canonical URLs. Do not silently claim historical content can be made secret after publication.

### S4 — High if tenant publishing activated: ownership exists, paid/policy/kill-switch gate does not

`convex/platform/sites/publish.ts:188-250` authenticates and checks owned project/site plus hostname availability, but no payment entitlement, manual moderation approval, or launch feature flag is required. `:122-141` automatically progresses draft → ready → published. Missing policy/kill-switch/admin work is also acknowledged by the handoff. UI hiding would not disable the mutation.

This is an unfinished platform gate, not a demonstrated cross-owner breach. No production DNS activation was inspected. For the research pivot, park/disable public tenant publishing at the server. If retained later, require explicit approval/version policy, abusive-content controls, suspension state, rate limit, lead privacy controls and emergency shutdown before activation. Tenant host partitioning and owned render retrieval are worth retaining only if hosting returns to scope.

### S5 — High business-readiness gap: existing payments do not sell recurring research access

`app/api/platform/billing/_server.ts:23-28` requires test mode/test key; live events are rejected in normalizeStripeEvent; `app/api/platform/billing/checkout/route.ts` creates mode `payment` and requires `cs_test_`; `convex/platform/billing/checkout.ts:6-15` requires an owned project and a credit pack. No recurring membership/customer-portal lifecycle is present. `convex/schema.ts:171` “subscriptions” is a newsletter event log, not Stripe subscriptions. Preserve purpose separation from legacy ship·able.

Create a new membership domain: billing customer bound to verified user, product/price mapping, subscription snapshot, entitlements, invoice/event inbox, processing/reconciliation state, auditable overrides. Handle checkout pending/paid, renewal, invoice failures and grace period, cancel-at-period-end, expiry, upgrade/downgrade, refund/dispute, webhook replay/out-of-order delivery, deleted user/customer and account collisions. Customer portal is required for self-service management. Grant from verified provider state, never success redirect. Retain ledger for metered AI credits only if needed; membership should not depend on creating a project.

### S6 — High reliability: legacy webhook acknowledges lost follow-up work

`app/api/stripe-webhook/route.ts:138-152` returns 200 after Convex/Beehiiv failures. When event insertion succeeds and Beehiiv fails, later retries return early because event already exists. This preserves documented legacy semantics but loses durable paid-cohort delivery. Also no payment_status/purpose/payment-link allowlist precedes enrollment at :97-108; a shared Stripe endpoint can mix products and deferred-payment completion. Do not reuse it for subscription fulfillment. Introduce durable inbox → verified state update → retryable outbox, separate event receipt from completion, route by validated purpose/product, and reconcile failures. Existing platform webhook correctly returns 500 when its atomic settlement fails; retain that pattern.

### S7 — Medium/high abuse exposure: public email flows lack issuance throttling

`app/api/ideas-verify/route.ts:33-54` accepts an arbitrary email and returns active/validating membership. This is a subscriber-status oracle and an unbounded outbound Beehiiv lookup; origin wildcard is not authorization. `app/api/ideas-subscribe/route.ts:29-73` and `app/api/subscribe/route.ts:70-148` lack application-level rate/bot controls. CORS in subscribe accepts any origin ending with `weekendmvp.app` or `.vercel.app` (:36-45), including unrelated deployment origins and suffix-host lookalikes. CORS restrictions alone do not stop direct requests.

`convex/auth.ts` normalization wrapper does not enforce issuance rate limits. Installed @convex-dev/auth email issuance creates a code and calls delivery (`node_modules/@convex-dev/auth/src/server/implementation/signIn.ts:124-170`, createVerificationCode.ts:21-71) without issuance throttle; code verification does have package rate-limit logic. Differentiate them. Add per-email and trusted-IP issuance quotas, progressive bot challenge when suspicious, bounded request sizes, generic responses, and cost alerts. Provider/WAF controls may exist but were not inspected. Avoid claiming auth brute-force is wholly unprotected.

### S8 — Medium: test discovery contaminated by local worktrees; route billing test omitted by normal scripts

`npm run test:auth` failed by discovering `.worktrees/v1-repository-launch/tests/auth/auth-platform-ssr.test.tsx` with unresolved `@/lib/platform-convex-url`. `vitest.config.ts` has no worktree exclusion. It reported 19 passed suites/221 tests plus one failed suite, including multiple checkouts. The chained security/Convex runs did not execute after this failure.

Root-only focused command succeeded: `npx vitest run tests/auth convex app/api/platform/billing/_server.test.ts --exclude '**/.worktrees/**'`: 25 files / 315 tests passed. `npm run test:security`: 80 Node tests passed; Vitest found 8 files/339 tests because of worktrees. Root-only two template suites: 2 files / 84 tests passed. Do not add these overlapping totals into a single coverage claim. `app/api/platform/billing/_server.test.ts` is not included by the package's normal npm test subcommands (which select convex/, tests/auth, selected template files, etc.); it only ran here because explicitly requested.

Required: root-scoped discovery excluding worktrees, central test inventory, include route/server tests, and real browser acceptance tests for critical account/paid content flows. Existing CI runs install/audit/typecheck/lint/test/build and read-only permissions (`.github/workflows/ci.yml`); preserve and make required in branch protection. Branch protection/deployed CI state unknown.

### S9 — Medium operational gaps: admin, retention, recovery and observability are planned, not built

No super_admin role field/authorization/control plane appears in inspected app/Convex code (`convex/schema.ts:200+` user fields have no role). Current audit_events support user project/billing actions, not a complete privileged operator control plane. No account deletion/export/session management UI or corresponding own-data lifecycle services were found. No `convex/crons.ts` exists; expiring preview rows have enforced read expiry but no physical purge. No application error tracing package/Sentry/OpenTelemetry integration found; GA/Meta event tracking is marketing analytics, not operational monitoring.

`docs/wp/backup-restore.md` explicitly records no program production backup or restore test. August production counts are dated historical evidence and cannot be treated as September truth. Existing platform/domain/env/Beehiiv/Stripe settings and production traffic/data remain unknown. Before paid launch: prove backup+restore including storage, code/env/domain/provider recovery; define RPO/RTO and retention; add alerting/error tracing with PII redaction; implement scheduled cleanup, webhook/job reconciliation, and incident runbooks. Logs currently include customer emails (legacy webhook :59-67/:139-149), so define retention and scrub downstream reporting. Inspect actual deployed security headers; no general CSP/frame-ancestor/HSTS policy is evident in application config, but host-level controls were not checked.

### S10 — Medium scale/content trust: unbounded public full-document reads and executable MDX

`convex/ideas.ts:84-158` uses collect for category/revenue and full-table scans before tool/audience filtering; return shape includes full research fields. An archive growing into thousands of richer reports raises query limits/bandwidth and scraping exposure. Replace with bounded indexed card queries and searchable derived facets.

`lib/mdx.tsx` uses MDXRemote; current filesystem content is trusted code, and Convex body fallback is fed through same renderer. Do not pipe scraped or LLM-authored raw MDX into this execution boundary. Use validated JSON/report blocks or a constrained markdown AST, allowlisted components/URLs and no arbitrary JS/HTML. No arbitrary-user upload-to-MDX execution exploit was verified; this is a design boundary that becomes critical with an automated content pipeline.

## Architecture disposition

- RETAIN: Next.js App Router, SEO/canonical route work, Convex transactional database, Convex Auth user IDs, server-derived session+ownership checks, nested parent authorization, template renderer safety constraints, Stripe signature verification and atomic ledger/idempotency patterns, email provider separation, reusable UX components and deterministic tests.
- REFACTOR: schema into public catalog/protected report versions; add user preferences/saves/collections/feedback; shared entitlement decision and daily issue selector; authenticated account settings; Stripe membership subsystem; super_admin permission guard with immutable privileged audit and protected bootstrap; editorial publication transactions; bounded search; resilient email/job pipeline; telemetry and cost controls.
- RETIRE FROM ACCESS CONTROL: localStorage/UTM/Beehiiv gate; unauthenticated legacy writer trust; success-URL payment assumptions; newsletter subscription log as any account authority.
- PARK: anonymous generated sites, wildcard tenant hosting, leads, project credit cockpit and custom research generation until core paid research retention is demonstrated. Preserve code in history or disabled modules; do not delete production/customer data without inventory and explicit migration authorization.

## Minimum launch gates and acceptance evidence

1. Patch dependency advisories; clean root-scoped CI; independent security review on deployed preview.
2. Freeze explicit policy for shared daily free idea (prefer one selected editorial issue for everyone per UTC day, no rolling unlimited per-account free catalog unlock) versus paid archive, and treatment of historical public content. Store issue+release state server-side; advance by scheduled mutation; never rely on client clock or Date.now in cached queries. Test UTC boundary, retries, unpaid access, no leaked report fields.
3. Account journey: Google and email signup/login/logout, collisions and email normalization, scanner-safe single-use magic links, session expiry/revocation, email changes/linking with reauthentication, recovery/support, export/deletion and suppression handling. Separate marketing consent from mandatory service email. Strong administrator authentication/MFA or identity-provider control; assess capability before committing to auth-provider change.
4. Subscription test matrix: duplicates, out-of-order and missed webhook, delayed payment, renewal failure/grace, cancellation at term, refunds/disputes, reconciliation. Verify protected payload access using server requests and raw HTML/RSC inspection, not screenshots alone.
5. Operator journey: bootstrap reviewed verified owner account; every admin query/mutation guarded server-side; publish requires evidence review and version approval; immutable audit; emergency hide/rollback; no generic cross-owner support bypass.
6. Content safety/economics: source provenance and citation checks, prompt injection isolation, schema validation, editor review, duplication controls, provider budget caps, queue retry/dead-letter, per-run cost telemetry and golden evaluation set. Store secrets only server-side and keep raw provider responses/PII retention bounded.
7. Production inventory and isolated rehearsal: backups/storage restore, route/canonical redirect map, environment separation, monitoring/alerts, support/refund operating procedure, canary feature flags, rollback that keeps account/payment state consistent. Activation is a separate approved gate, not implied by this audit.

## Verification limits

No full typecheck/lint/build/E2E run here; audit targeted auth/security/Convex suites only. No external services were mutated. Package audit fetched advisory metadata only. No production endpoint or dashboard inspection, secret scan, load test, penetration test, DNS check, branch-protection verification or user inventory. “No implementation found” is an inventory result, not evidence that the host/provider has no compensating control. Upgrade choices and vendor prices/feature availability need current official-document verification by implementation planning.
