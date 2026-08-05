# WP11 Stories - Convex database I/O audit and safe fixes

Branch: `feat/wp11-convex-performance-audit`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Hot Convex reads are traced end-to-end, safe indexed/bounded fixes preserve related-idea eligibility and ordering, local-only parity tests and project gates pass, and the audit documents expected monthly I/O below 250 MB without a migration.

## Stories

- [x] `WP11-S1` - Audit hot query read sets and public callsites
  - Scope: `convex/`, `app/`, `components/`, local seed data, `docs/convex-performance-audit.md`
  - Acceptance criteria:
    - Every dashboard hot function has a callsite/page-flow, table/index, document-shape, and read-set analysis.
    - Current related-idea behavior and representative results are captured before implementation.
    - Convex commands are pinned to a local deployment; no cloud deployment is read or changed.
  - Verification:
    - Read-only code trace, local document-size measurements, and local baseline queries.

- [x] `WP11-S2` - Replace the related-idea full scan with indexed bounded reads
  - Scope: `convex/ideas.ts`, related-query tests
  - Acceptance criteria:
    - Same-category ideas remain first and newest-first.
    - Shared-audience fallback remains newest-first, excludes the current idea, and cannot duplicate category results.
    - The query returns only the requested bounded card count and preserves empty/missing-field behavior.
  - Verification:
    - Convex unit/integration tests and old/new result parity on representative local seeded data.

- [x] `WP11-S3` - Narrow reference-table reads on static hub pages
  - Scope: `convex/referenceTables.ts`, `components/hubs/hub-data.ts`, affected hub and startup-index routes
  - Acceptance criteria:
    - Tool hubs read one indexed tool row and audience hubs read one indexed audience row.
    - The startup-ideas filter reads categories only.
    - Public copy, fallback behavior, and result ordering do not change.
  - Verification:
    - Typecheck, tests, production build, and code-level read-set comparison.

- [x] `WP11-S4` - Verify and document the performance envelope
  - Scope: `docs/convex-performance-audit.md`, `docs/wp/wp11-progress.md`
  - Acceptance criteria:
    - Formatting, linting, typechecking, tests, Convex code generation, local Convex validation, and production build results are recorded.
    - Estimated before/after monthly database I/O and assumptions are explicit.
    - Migration-heavy opportunities are documented but not implemented.
  - Verification:
    - Final diff review, required project gates, and local-only command audit.

## Out Of Scope

- Cloud or production Convex reads, writes, imports, deployment changes, or pauses.
- Digest tables, relation tables for array facets, document splitting, denormalized fields, backfills, or other migration-heavy changes.
- Any change to public page behavior, related-idea eligibility, deduplication, or ordering.
- Commits, pushes, and deployments.

## Notes

- The user supplied production dashboard evidence; do not run cloud `insights`.
- If a safe fix begins to require a new table, backfill, or dual-read rollout, stop at a migration-safe plan.
