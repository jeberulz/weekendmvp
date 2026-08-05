# WP22 Progress - Platform Schema, State Machines, And Authorization

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup and contract freeze

- Branch/worktree: `codex/wp22-platform-contracts`, primary checkout; no worktree because WP22 is the sole shared-schema writer and executes sequentially after WP21.
- Assignment: high-risk data/security worker owns WP22-S1 through WP22-S5 and prepares S6 evidence. The orchestrator owns rulings, story checkboxes, registry/manifest/ledger/gate truth, downstream release, and the final commit.
- File boundaries: `convex/schema.ts`, new `convex/platform/**`, generated Convex type/API files, and this progress log. No app UI, routing, Stripe handlers, workflow execution, public-content mutation, or production operation.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, focused ownership/state tests, isolated `local:` Convex schema push, secret-pattern scan, and independent high-risk review.
- Owner rulings applied: archive/soft-delete only with immutable ledger/audit; no support/admin bypass; no user uploads; generated document bodies capped at 256 KiB with child rows/storage references for growing or large artifacts.
- Migration strategy: additive empty-table expansion only. Existing `users`, `ideas`, `saved_ideas`, public content, and auth schema remain compatible. No backfill, migration component, destructive narrowing, cloud deployment, or production mutation is authorized.
- Initial risks: schema overreach before WP23-WP25; missing ownership index; trusting redundant parent/owner IDs; unbounded arrays or reads; incompatible status strings; money fields that imply unsafe mutation; accidental cloud target; and test-only functions exposed publicly.
- Frozen consumer seam: table names, shared validators/statuses, ownership helpers, index names, and generated types become the contract for WP23, WP24, and WP25 after S6 passes.
- Next: worker implements one story at a time, records checks and any stop condition here, and returns the unstaged diff for independent review.
