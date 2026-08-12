# WP19 Stories — Idea tagging contract + corpus retag

Branch: `cursor/idea-tagging-contract-2db3`
Lane: Work Package
Definition of done: `/publish-idea` enforces allowlisted multi-tag metadata (category / tools / audiences / revenueGoal / buildTime); the existing 170-idea corpus is normalized so hubs actually match; the 10 recently published ideas are re-tagged for real hub enrichment; Convex is re-seeded.

## Stories

- [x] `WP19-S1` — Codify the tagging contract in `/publish-idea`
- [x] `WP19-S2` — One-shot corpus retag (buildTime + orphan audiences + unknown tools)
- [x] `WP19-S3` — Retag the 10 Aug-12 publishes for secondary hubs + seed

## Out Of Scope

- Filling or deleting empty hubs (`passive-income`, `quick-wins`, `build-in-1-week`) — deferred to step 4
- Publishing new ideas aimed at thin secondary surfaces — deferred to step 5
- Schema / Convex index changes for tools/audiences
