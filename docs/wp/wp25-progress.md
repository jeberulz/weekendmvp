# WP25 Progress - Idea Intake, Versioned Briefs, Projects, And Public CTA

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup and story freeze

- Branch/worktree: `codex/wp25-intake-projects`, `.worktrees/wp25-intake-projects`.
- Assignment: WP25 worker owns S1-S5 and prepares S6 evidence. The orchestrator owns story checkboxes, cross-package rulings, registry/manifest/ledger/gate truth, independent review, and integration.
- Frozen paths: `/dashboard/new` for authenticated own-idea intake and `/build/{slug}` as the public repository CTA contract. WP27, not WP25, owns anonymous preview rendering/security.
- Frozen lifecycle: resumable editable draft, immutable confirmed revision, later changes create the next draft revision, and the prior version is superseded only after re-confirmation. Repository source snapshots remain immutable. Cal.com is deferred.
- Shared-contract boundary: WP22 schema, validators, statuses, indexes, transitions, authorization helpers, and document-size rule are immutable in this worktree.
- Public boundary: narrow CTA only; canonical URL, metadata, JSON-LD, public research content, email gate, and collection behavior must not regress or fork.
- Required gate: typecheck, lint, full tests, build, production dependency audit, diff/secret scans, focused browser/a11y/SEO journeys, two-user/revision/idempotency tests, and independent high-risk data review.
- Production remains untouched: no deploy, backfill, environment mutation, customer data inspection, preview generation, or external service call is authorized.
- Next: implement one story at a time, append evidence and blockers here, and return a cleanly scoped diff.
