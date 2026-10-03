# WP46 Stories — Engine to editorial checks

Branch: `codex/wp46-admin-login-fix` (draft PR #94, updated from `main`)
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done for this slice: a contract-v2 live engine artifact reaches the private editorial queue through a trusted backend path; real, non-empty checks run against a saved revision and bind to its artifact hash; an editor can review and approve only a passing current revision. Publication remains unavailable until WP46-E6.

The complete WP46 story contract remains in `docs/plans/editorial-admin/wp46-stories.md`. This file tracks the current integration slice and its gates.

## Stories

- [x] `WP46-E5b` — Validate and map engine artifacts
  - Scope: engine/editorial adapter, operator script, contract tests.
  - Acceptance: parse contract-v2 records; reject fixture/v1/invalid records; re-run the deep artifact audit against the exact MDX and manifest row; map bounded sources, claims and metadata without upgrading uncertain evidence; derive stable submission identity and artifact hash; no human decision is expressible through the envelope.
  - Checks: mapping fixtures, swapped-source/quote/price and edited-byte refusals, `npm run typecheck`.
- [x] `WP46-E5c` — Trusted, idempotent ingestion
  - Scope: private Convex action/mutation and bounded record storage, CLI integration.
  - Acceptance: only a trusted operator path can issue engine verification authority; producer, mode, artifact hash and record/audit binding are verified server-side; duplicates are idempotent and changed use of a submission ID is refused; fixture mode never enters live editorial; existing public pages and imported legacy baselines are unchanged.
  - Checks: Convex function tests, two-account denial matrix, malformed/oversized/replay tests, local backend smoke.
- [x] `WP46-E5d` — Current-revision quality policy
  - Scope: live check policy, saved-revision check action, persistence and settings.
  - Acceptance: a non-empty required check set replaces `not-connected`; submitted placeholder-policy checks are discarded; checks re-run against the saved artifact and stored research record, then commit only if the revision hash and policy still match. Audit errors and missing records fail closed. Existing legacy ideas cannot gain an engine receipt by editing. Only a current passing check set can support human approval.
  - Checks: contract and Convex tests for edits, stale hashes, stale policy, missing record, check failure and human authorization; real local backend journey.
- [ ] `WP46-E5e` — Integration gate and documentation
  - Scope: docs, runbook, repeatable flow evidence.
  - Acceptance: live-mode test demonstrates engine submission → queue → checks → explicit review → approval; anonymous/customer/service callers cannot review or approve. Settings accurately show engine/check availability while publishing stays unavailable through E6.
  - Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npx vitest run tests/editorial`, `npm run build`, `npm run check:server-traces`, `git diff --check`.
  - Remaining: positive real local-backend journey with a genuine live contract-v2 record. No such record is checked in; the in-memory Convex journey and local backend's rejection path pass. Production deployment and the first real submission are separate operator steps.

## Out of scope

- WP46-E6 release worker, public visibility, deployment, unpublish and rollback.
- WP46-E7 launch activation, production data mutation, automatic publishing or a new public idea.
- Lowering the Idea Engine's strict evidence and $4/run gates to make a record pass.

## Notes

- PR #94's dry-run-first legacy importer is retained; its successful private production import is historical evidence, not authorization to import again.
- The current engine has no standalone signed receipt. E5 must derive authority from a backend-validated record-plus-artifact audit, not a caller-supplied `engine_receipt` string.
