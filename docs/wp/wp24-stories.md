# WP24 Stories - Credits, Stripe Checkout, Ledger, Refunds, And Disputes

Branch: `codex/wp24-credits-stripe`
Lane: Work Package within Build Platform Program Wave 2
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: In Stripe test mode, an authenticated project owner can choose one of three server-owned credit packs and enter hosted Checkout; verified purpose-specific webhooks grant credits exactly once; all grants/debits/refunds are atomic append-only ledger entries with server-derived balances; forged, duplicated, delayed, replayed, and unordered events fail safely; the billing UI reports only server-confirmed state; and the standard payment/security gate passes without altering the legacy shipable payment path or production state.

## Frozen Payment Contract

- Platform credit packs are server-owned constants: USD 29 for 25 credits, USD 79 for 75 credits, and USD 199 for 220 credits. The browser never supplies authoritative amount, currency, credit quantity, Price ID, or customer ownership.
- Use Stripe-hosted Checkout Sessions for one-time payments in test mode only. No live Stripe key, live Price/Product, live charge, production webhook, or Vercel/Convex environment mutation is authorized.
- Platform billing has its own routes, secret names, metadata purpose marker, Convex namespace, and webhook idempotency seam. Do not modify or extend `app/api/stripe-webhook/route.ts`, `convex/payments.ts`, or shipable fulfillment.
- Checkout requires a server-verified active owned project because the frozen `purchases` contract is project-scoped. Credits remain account-level after settlement.
- Credit balance is derived and updated only inside atomic server mutations that append a ledger row. Ledger and audit history are never edited or deleted.
- Refunds/disputes may make the account negative; paid actions are suspended until balance recovers. History remains visible. Tax/VAT and customer portal are deferred from v1 pending a live-mode ruling.

## Stories

- [ ] `WP24-S1` - Freeze the test-mode pack catalog and create secure Checkout Sessions
  - Scope: platform billing server modules, `app/api/platform/billing/checkout/route.ts`, focused tests and env-name documentation.
  - Acceptance criteria:
    - Server catalog exposes only the three frozen pack IDs/amounts/credits and resolves configured test Price IDs server-side; unknown/forged pack, amount, currency, credit, Price ID, owner, or project input is rejected.
    - Route derives the authenticated user, verifies an active owned project, creates/reuses an idempotent pending purchase, and creates a one-time hosted Checkout Session with a narrow platform-purpose marker and opaque internal references.
    - Success/cancel URLs are same-origin allowlisted routes; secrets remain server-only; failures return generic user-safe errors without logging secrets, PII, or raw Stripe payloads.
    - Test-mode enforcement rejects live keys/Price IDs by prefix or configured mode before any Stripe call.
  - Verification: forged-input/two-user/idempotency/config-mode tests, `npm run typecheck`, `npm run test:convex`.

- [ ] `WP24-S2` - Implement the atomic credit account and append-only ledger
  - Scope: `convex/platform/billing/**`, focused Convex tests.
  - Acceptance criteria:
    - Server helpers create one account per owner, return bounded owner history, and apply integer credit deltas atomically while writing exactly one immutable ledger row per idempotency key/provider event.
    - Grants, task debits, task-failure refunds, purchase refunds, and dispute reversals use explicit allowed reasons and validate every referenced owner/project/purchase/task through WP22 helpers.
    - Concurrent spends cannot overdraw an account; insufficient credit fails without a partial task/ledger/balance mutation. Negative balance is allowed only from verified refund/dispute reversal and suspends future paid actions.
    - No generic client mutation can set balance, delta, reason, purchase status, amount, credits, or provider identifiers.
  - Verification: concurrent spend, duplicate idempotency, cross-owner, insufficient-credit, projectless/account history, negative-balance suspension, and append-only tests.

- [ ] `WP24-S3` - Process purpose-separated Stripe webhooks exactly once
  - Scope: `app/api/platform/billing/webhook/route.ts`, platform billing event functions/tests.
  - Acceptance criteria:
    - Verify the raw request body with the platform-specific webhook secret before parsing or mutating; missing/invalid signatures fail with no state change.
    - Accept only explicitly handled Checkout/payment/refund/dispute event families whose metadata and stored provider references prove platform purpose and purchase ownership; unrelated shipable or malformed events are safely ignored/rejected.
    - Completion grants the stored purchase's credits exactly once and advances only valid frozen purchase transitions. Duplicate, replayed, delayed, and out-of-order events converge without double grants or terminal-state escape.
    - Refund/dispute processing appends a compensating entry exactly once, retains the original ledger, and never trusts event amount/credits over the stored purchase contract.
    - Acknowledgement/retry behavior distinguishes invalid requests from transient internal failure and does not silently acknowledge a required mutation that failed.
  - Verification: invalid signature, foreign purpose, replay, delayed/unordered completion, duplicate refund, dispute, amount mismatch, and transient failure tests.

- [ ] `WP24-S4` - Build the server-confirmed billing workspace
  - Scope: `app/dashboard/billing/**`, `components/platform/billing/**`, billing UI tests.
  - Acceptance criteria:
    - Show server-derived balance, pack choices, bounded ledger/purchase history, and clear pending/paid/refunded/disputed states; never claim credits from a redirect query string or optimistic browser state.
    - Checkout initiation sends only the chosen pack ID and owned project reference, handles pending/error/retry states, and redirects only to Stripe's returned hosted URL after server validation.
    - Return/cancel screens poll or subscribe to Convex state and explain that webhook confirmation is authoritative.
    - Keyboard/focus/loading/error/empty states meet WCAG 2.1 AA and match the approved dark editorial dashboard system without gradients or payment dark patterns.
  - Verification: component/route tests plus desktop/mobile keyboard and automated a11y journey.

- [ ] `WP24-S5` - Prove adversarial money invariants and legacy isolation
  - Scope: WP24-owned tests and documentation only.
  - Acceptance criteria:
    - Test matrix covers two users/projects, concurrent checkout and spend, forged prices/metadata, repeated route calls, webhook replays, unordered events, partial/full refund, dispute, refund after spend, and negative-balance recovery.
    - Every accepted provider event and business idempotency key produces at most one purchase transition and one appropriate ledger delta; balance equals the ordered sum of immutable deltas.
    - Static/behavioral tests prove the platform handler cannot fulfill shipable and the legacy handler cannot grant platform credits.
    - No raw card data is accepted or stored, and logs/errors contain no Stripe secret, webhook signature, session cookie, email, or raw event body.
  - Verification: focused adversarial suite, `npm run test:convex`, route tests, secret/log scan.

- [ ] `WP24-S6` - Run the WP24 payment/security gate
  - Scope: `docs/wp/wp24-progress.md` plus WP24-owned fixes only.
  - Acceptance criteria:
    - Standard checks and all focused route/Convex/adversarial/browser tests pass; Stripe SDK use follows hosted Checkout and signature-verification guidance.
    - Independent high-risk reviewer reports no unresolved critical/high finding in authorization, server-owned pricing, exact-once settlement, ledger atomicity, replay/order handling, refund/dispute policy, secret handling, or legacy separation.
    - Evidence confirms Stripe test mode only and no live object, charge, deploy, key change, production webhook, portal/tax implementation, or production data mutation.
  - Verification: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, secret-pattern scan.

## File Boundaries

The WP24 worker may add `convex/platform/billing/**`, `app/api/platform/billing/checkout/route.ts`, `app/api/platform/billing/webhook/route.ts`, `app/dashboard/billing/**`, `components/platform/billing/**`, focused tests, generated Convex API types when required, env-key names/examples without values, and `docs/wp/wp24-progress.md`. It must not edit `convex/schema.ts`, `convex/payments.ts`, `app/api/stripe-webhook/route.ts`, shipable marketing/checkout code, WP23/WP25 routes, or production environments.

## Stop Conditions

- Stop if WP22 schema/status/index changes appear necessary, Stripe tax/portal/live-mode behavior is required, or the frozen negative-balance policy is insufficient.
- Stop before creating/changing any live Stripe object, live webhook, deployed environment variable, charge/refund, production Convex record, or secret.
- Stop if exact-once behavior cannot be proven under concurrent/replayed/unordered events; do not weaken the acceptance criteria.
