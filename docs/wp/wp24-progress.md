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
