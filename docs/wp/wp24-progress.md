# WP24 Progress - Credits, Stripe Checkout, Ledger, Refunds, And Disputes

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup and story freeze

- Branch/worktree: `codex/wp24-credits-stripe`, `.worktrees/wp24-credits-stripe`.
- Assignment: high-risk payment worker owns S1-S5 and prepares S6 evidence. The orchestrator owns story checkboxes, policy rulings, registry/manifest/ledger/gate truth, independent review, and integration.
- Frozen catalog: $29/25 credits, $79/75, $199/220; authoritative amounts/credits/Price IDs remain server-side and test-mode only.
- Frozen policy: account credits, project-scoped purchases, exact-once append-only ledger; verified refunds/disputes may create negative balance and suspend paid actions without deleting history. Tax/VAT and customer portal are deferred.
- Legacy separation: platform-specific routes/namespaces/secrets/metadata only; `app/api/stripe-webhook/route.ts`, `convex/payments.ts`, and shipable fulfillment are outside scope.
- Shared-contract boundary: WP22 schema, validators, statuses, indexes, transitions, and authorization helpers are immutable in this worktree.
- Required gate: typecheck, lint, full tests, build, production dependency audit, diff/secret scans, adversarial exact-once suite, focused billing browser/a11y journey, and independent high-risk payments review.
- Production remains untouched: no live Stripe key/object/charge/refund/webhook, deploy, environment mutation, or production Convex record change is authorized.
- Next: implement one story at a time, append evidence and blockers here, and return a cleanly scoped diff.

## 2026-08-05 - WP24-S1 secure test-mode Checkout implementation

- Added the frozen server catalog at `convex/platform/billing/catalog.ts`: exactly `$29 / 25`, `$79 / 75`, and `$199 / 220`; browser input resolves only a pack ID and never supplies authoritative money, credits, currency, or Price ID.
- Added `app/api/platform/billing/checkout/route.ts` with Convex Auth token forwarding, owner/project verification through `checkout.prepare`, exact purchase idempotency, same-origin configured return routes, Stripe-hosted `mode: "payment"` Checkout, test-key/mode/session enforcement, and a strict `checkout.stripe.com` redirect allowlist.
- Added purpose-separated environment key names only to `.env.example`; no values or environment state were created or changed. The integration prefers a least-privilege Stripe test restricted key.
- Focused evidence: server-boundary tests reject live mode/key configuration, unknown/forged packs, extra amount fields, cross-owner project references, and concurrent duplicate purchase preparation. `npm run typecheck` and the focused tests pass.

## 2026-08-05 - WP24-S2 atomic account ledger implementation

- Added an internal-only ledger mutation layer that creates at most one account per owner, checks business and provider idempotency conflicts, appends exactly one immutable ledger row, and patches the denormalized balance in the same Convex transaction.
- Added internal task debit and failed-task refund seams. They validate the active task/project/owner chain; debits cannot overdraw, task refunds require a failed task, and no public mutation accepts a balance, delta, reason, provider ID, purchase status, or authoritative money value.
- Public billing summary derives the current user server-side and returns bounded, narrowed purchase/ledger/project views without exposing owner IDs, account IDs, idempotency keys, or provider references.
- Focused evidence: concurrent 20-credit spends against a 25-credit balance result in one success and one atomic failure; duplicate task refunds are exact-once; the final balance equals the sum of immutable deltas.

## 2026-08-05 - WP24-S3 verified purpose-specific settlement

- Added a platform-only webhook route that reads the raw request body once, verifies the platform Stripe signing secret with `constructEvent`, rejects live events, and normalizes only paid/failed Checkout, full/partial refund, and dispute families.
- Checkout events require the platform purpose marker and stored purchase/session reference. Refunds/disputes resolve only through the stored PaymentIntent index. Stored purchase amount/currency/credits remain authoritative.
- Added a signed HMAC bridge to a public Convex action because Next.js cannot call internal Convex mutations directly. The action receives no bridge secret or PII, verifies the signature in constant time, parses a bounded normalized payload, then calls internal atomic settlement mutations.
- Completion, refund, and dispute mutations converge under duplicate/replayed/concurrent/out-of-order delivery. An early refund returns a retryable failure; a partial refund makes no ledger change; a full refund reverses stored credits once; a refund after a dispute advances status without a second reversal.
- Focused evidence: invalid/foreign/live normalization, money mismatch, cross-owner reference conflict, replay, unordered refund, partial/full refund, dispute, and refund-after-dispute cases pass. Transient settlement failures return HTTP 500 so Stripe retries rather than silently losing a required mutation.

## 2026-08-05 - WP24-S4 server-confirmed billing workspace

- Added private noindex `/dashboard/billing` and a dark editorial workspace showing the server-derived balance, explicit one-time packs, active-project selector, bounded purchase/ledger history, and negative-balance suspension state.
- Checkout sends only pack ID, owned project reference, and an opaque retry idempotency key. The UI redirects only to the server-returned Stripe-hosted URL and never treats a return query string as payment confirmation.
- Added keyboard-native buttons/selects, visible focus rings, labelled status/error regions, loading/empty/retry states, mobile-safe overflow, and no gradients or urgency/payment dark patterns.
- Focused route/static accessibility tests and the production build pass. A real hosted-Checkout return/browser journey was intentionally not run because no Stripe test objects, keys, webhook, environment mutation, or external transaction was authorized; this remains explicit S6 gate evidence rather than a claimed live E2E pass.

## 2026-08-05 - WP24-S5 adversarial invariants and legacy isolation

- Added a focused Convex suite covering two owners/projects, concurrent checkout preparation, concurrent spend, forged pack/money/metadata/provider references, replay, unordered delivery, partial/full refund, dispute after spend, refund after dispute, negative balance, and recovery through a later verified grant.
- Added static behavioral isolation checks proving platform handlers do not call legacy `api.payments`/Beehiiv/shipable fulfillment, the legacy handler cannot call platform billing, no raw card/payment-method field is accepted, and the platform webhook verifies the raw signed body.
- Secret/log scan passes: no key, webhook signing secret, bridge secret, session cookie, email, signature value, raw event body, or Stripe client secret is logged or committed. Platform routes return generic user-safe errors.
- Legacy `app/api/stripe-webhook/route.ts`, `convex/payments.ts`, shipable code, and `convex/schema.ts` remain untouched.

## 2026-08-05 - S6 evidence prepared; independent gate remains open

- `npm run typecheck` - pass.
- `npm run lint` - pass with 35 pre-existing warnings and zero errors; no WP24 warning.
- `npm test` - pass, including 83 Convex tests and 6 security tests.
- Focused billing suites - pass: 6 Convex adversarial tests, 4 route-boundary tests, and 2 legacy/UI isolation tests.
- `npm run build` - pass after replacing a temporary cross-root worktree dependency symlink with an ignored local `npm ci` install; the first two build attempts were tooling/config diagnostics, and the final build includes both platform billing routes plus `/dashboard/billing`. Existing dynamic-filesystem tracing warnings remain outside WP24.
- `npm audit --omit=dev --audit-level=high` - pass, 0 vulnerabilities.
- `git diff --check` and focused secret-pattern scan - pass.
- Documentation: `.env.example` updated with names and test-mode intent; no dependency, schema, production runbook, tax/VAT, or customer-portal documentation change was needed.
- Still required before S6 can be marked complete: independent high-risk payments/security review and configured local/test browser E2E for Checkout return/webhook confirmation. No live/test Stripe object, key, webhook, charge/refund, deploy, Convex data, or cloud environment was created or mutated in this worktree.

## 2026-08-05 - Independent-gate remediation

- HIGH dispute replay finding resolved: once a purchase is `disputed`, replay of the original Stripe event resolves the existing `dispute` ledger row and returns `duplicate`; a later distinct dispute event for the same stored PaymentIntent returns `ignored`. Both acknowledge successfully without another delta, invalid `disputed -> disputed` transition, or webhook retry loop. A provider-event collision against another purchase still fails closed.
- HIGH task business-idempotency finding resolved: `debitTask` no longer accepts a caller idempotency key and derives `task-debit:{taskId}`. This permits exactly one debit per task; an exact concurrent retry returns the same ledger result, while a different credit amount conflicts rather than creating a second debit. `refundFailedTask` accepts neither a debit key nor refund key, resolves the original debit through the derived task key, verifies owner/project/task/reason/sign relationships, and derives `task-refund:{debitLedgerId}` for at most one corresponding refund.
- Regression coverage now includes same-ID and distinct-ID dispute replay, concurrent task debit retry, changed-amount debit conflict, rejected extra caller key fields, concurrent failed-task refund, and exact inspection of the server-derived debit/refund business keys. Focused route/Convex suites pass 11 tests; full Convex remains 83/83.
- MEDIUM typed-environment finding resolved in the authorized shared seam: added `convex/convex.config.ts` with required `PLATFORM_BILLING_BRIDGE_SECRET: v.string()`, updated generated server declarations/runtime, and changed the provider bridge to read the typed `env` export. No environment value or deployment was changed.
- Partial refunds are explicitly unsupported in this frozen contract: a verified `charge.refunded` with `refunded=false` returns HTTP 422 before any Convex mutation, and the internal settlement seam also rejects `PARTIAL_REFUND_POLICY_UNSUPPORTED`. Supporting them requires a separately gated contract that freezes proportional credit-reversal/rounding rules, cumulative refunded-minor accounting, provider-event idempotency storage, a `partially_refunded` purchase transition/status (or equivalent adjustment state), and safe promotion to full refund.
- Dispute won/closed/funds-reinstated resolution is explicitly unsupported: verified resolution events return HTTP 422 with no balance or purchase mutation. Supporting them requires a separately gated purchase-resolution transition (`disputed` to a frozen won/lost outcome), an allowed compensating ledger reason for credit reinstatement, idempotent resolution-event storage, and an owner policy for won, lost, withdrawn, and reopened disputes.
- Remediation checks: typecheck pass; focused 11/11 pass; `npm run test:convex` 83/83 pass; security 7/7 pass; lint 0 errors with the same 35 unrelated warnings; production build pass with the same five pre-existing MDX/sitemap tracing warnings. No schema/status/index, legacy billing, tax/portal, package, cloud, Stripe object, Convex data, or production mutation was made.

## 2026-08-05 - Independent re-review and test-mode gate pass

- Independent re-review found no remaining Critical or High issue and reproduced the corrected dispute replay, concurrent/changed-argument task operations, relationship denials, typed server-only bridge configuration, legacy separation, and full configured gate.
- Final evidence: focused remediation 11/11, focused security/isolation 3/3, Convex 83/83, full `npm test`, typecheck, lint with 0 errors and 35 inherited warnings, production build, production dependency audit with 0 vulnerabilities, diff check, secret scan, and frozen-schema/legacy-seam checks all pass.
- S6 passes for the test-mode code package. Partial refunds and dispute `closed`/`funds_reinstated` remain explicit hard live-mode blockers pending an owner-approved status/schema/ledger policy. Credential-backed hosted Checkout, authenticated browser, and webhook E2E also remain activation gates because no test credentials or external mutation were authorized here.
