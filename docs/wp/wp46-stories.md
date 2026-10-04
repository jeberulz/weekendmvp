# WP46 Stories — Engine to editorial release

Branch: `codex/wp46-e7-verification` (post-merge E7 verification and private submission follow-up; PR #99 is merged in `main`)
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done for E6: an explicitly approved exact revision can be released through a durable worker; every public reader resolves the activated version, and unpublish/rollback cannot expose an unapproved or stale version. Settings must remain unavailable until the actual release and visibility gates pass.

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

## E6 — Release and lifecycle bridge

- [ ] `WP46-E6a` — Pin the legacy baseline and public reader inventory. The reader inventory is complete; actual production baseline comparison remains an E7 launch gate.
- [x] `WP46-E6b` — Stage an exact private artifact and protected preview. Never commit a private candidate to the public repository. Bind preview, approval, policy, hash, generation and expected live release; refuse changed or unsafe content.
- [x] `WP46-E6c` — Durable release coordinator. Recover after restart, enforce idempotency and stale-job fences; verify artifact and active deployment before pointer movement. No caller-provided worker report is proof of an external side effect.
- [x] `WP46-E6d` — Atomic visibility/version pointer and public projection. Serve the old version until activation, then the selected immutable version. Gate all public surfaces and bypass stale caches. Preserve original published date and update verified release date.
- [ ] `WP46-E6e` — Emergency unpublish and managed-version rollback are implemented and covered in local tests. A production removal probe, restore rehearsal and legacy-baseline recovery remain E7 gates.
- [ ] `WP46-E6f` — Local typecheck, lint, tests, build, traces and HTTP probes pass. A full production-build release/takedown journey against the intended deployment, warm-cache removal and independent review remain E7 gates.

## E7 — Launch gate

- [x] `WP46-E7a` — Verify actual deployed reader and backend target, inventory production tables and baseline artifact hashes, and take target-specific full backups. Evidence: `docs/wp/wp46-e7-gate.md`.
- [x] `WP46-E7b` — Repair the unknown-idea soft 404 and idea/build/art cache headers; preserve valid legacy, collection and `/ideas/today` routes. Extend editorial metadata to retain the new public idea's bounded pricing tiers. Local production-build and isolated Vercel preview probes pass; warm-cache removal and canonical production verification follow merge.
- [ ] `WP46-E7c` — E7 backend-first deploy, exact canonical reader SHA/target and direct route probes pass. Synthetic staging warm-cache removal and backend-outage probes pass. Managed-release removal and every public surface remain open.
- [ ] `WP46-E7d` — Re-run the 226-page import dry run and, after exact inventory approval, import the one missing private legacy baseline. Verify no public row or page changes.
- [ ] `WP46-E7e` — Full snapshot restored twice into an isolated expiring deployment with matching document/file counts. Functional auth and job recovery, genuine private contract-v2 submission, managed publish/edit/republish/unpublish/rollback and independent final security review remain open.
- [ ] `WP46-E7i` — The exposed-production-credential rotation plan maps affected auth and bridge paths, owner approval, matched-key update, smoke checks and recovery. Execute only in the approved production window; verify fresh auth, super-admin binding and revalidation before GO.
- [ ] `WP46-E7g` — Private engine record/MDX/manifest inputs, exact-byte deep audit, public-path/symlink refusal and staging backend ingestion/idempotency passed on a genuine live contract-v2 record without staging it in public Git. Full configured checks pass. Independent review and production submission remain gated by human source review and owner action.
- [x] `WP46-E7h` — Enforce the verified Convex backend before Vercel's production frontend build. The build refuses an absent or wrong-target production deploy key or public URL, uses the deployment-scoped key for Convex, then builds Next only after a successful backend deploy. Local and preview builds do not deploy Convex. A real staged Vercel production build with `--skip-domain` verified the order using the production-only key; the post-merge Git-backed deployment and exact reader SHA remain E7c/E7f gates.
- [ ] `WP46-E7f` — With owner approval, configure the exact reader origin/SHA and enable the Convex release switch. Verify one explicitly approved real release before declaring GO.

## Out of scope

- Automatic publishing or an unreviewed real idea.
- Lowering the Idea Engine's strict evidence and $4/run gates to make a record pass.

## Notes

- PR #94's dry-run-first legacy importer is retained; its successful private production import is historical evidence, not authorization to import again.
- The current engine has no standalone signed receipt. E5 must derive authority from a backend-validated record-plus-artifact audit, not a caller-supplied `engine_receipt` string.
