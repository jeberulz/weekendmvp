# WP46 Stories — Engine to editorial release

Branch: `codex/wp46-e7-activation` (PR #100 merged in `main`; post-merge E7 activation gate)
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
- [x] `WP46-E7d` — The approved 226-page private baseline import completed on the verified live target: 225 duplicates, one insertion, 229 private ideas, 230 unchanged public ideas and zero public pointers. The first attempt exposed a stale live validator; the merged backend was redeployed after a no-deletion dry run and the same digest succeeded. Backups, recovery and key revocation are recorded in `docs/wp/backup-restore.md`.
- [ ] `WP46-E7e` — Full snapshot restored twice into an isolated expiring deployment with matching document/file counts. Functional email auth and a unit-level lost-scheduler-job recovery/once-only pointer check pass. A **nonempty cloud scheduled-job snapshot/restore**, genuine private contract-v2 submission, managed Vercel publish/edit/republish/unpublish/rollback and independent final security review remain open.
- [x] `WP46-E7i` — The exposed-production-credential rotation plan maps affected auth and bridge paths, owner approval, matched-key update, smoke checks and recovery. Google OAuth, JWT/JWKS, inactive billing bridge and revalidation were rotated on the verified production target. Fresh owner re-auth and sole super-admin binding passed; billing remains disabled without a matching Vercel test-mode bridge.
- [x] `WP46-E7j` — Authenticated cache revalidation moved from URL credentials to a header. Missing/query-only credentials return 401, and the production Convex/Vercel pair shares a new value. A direct canonical route call and the exact-target Convex internal action both succeeded; the warmed `/articles` response changed HIT → STALE → fresh HIT. The release switch remained off.
- [x] `WP46-E7k` — Remove the stale live Settings integration row that claims the legacy private import was not run. Import is a one-time operator gate recorded in the E7 report, not a continuously configured dashboard integration; actual release readiness and public-site state remain separate. Live Settings contract tests pass.
- [x] `WP46-E7l` — PR #105 merged at `752dc3a`; canonical reader health returned that exact commit. The DMARC idea and build routes return 200/no-store, unknown routes 404/no-store, and the sitemap includes the slug. The generated middleware set now checks all 227 entries before any production backend deploy. The private importer reads 227/227 pages without applying them.
- [x] `WP46-E7m` — The one-slug public seed inserted the missing DMARC catalogue row with zero updates. PR #107 added a one-slug private importer; after it merged, one private baseline imported under the unchanged full-inventory digest and post-seed backup. Live counts are 231 public ideas, 230 private ideas/submissions, one matching DMARC artifact hash, zero managed public versions/pointers, and the release switch remains off.
- [x] `WP46-E7n` — PR #109 merged at `8457e75b`; the canonical reader reported that exact SHA. Private engine submission refuses selected market figures from one source host, buyer quotes from one discussion, and setup/managed-service fees presented as software prices. Research guidance favors independent observed evidence. The rejected live record triggers the structural guard; human source review remains mandatory.
- [x] `WP46-E7o` — Correct the live engine's false-negative source classification without accepting copied market claims: permit a statistic on a publisher's blog only when its own bound excerpt explicitly identifies first-party research, keep comparisons and generic guides refused, and apply the same rule during stored-record revalidation. Give relevant late-report figures extraction context under the existing $4 cap, retry a market-only shortfall once, and refuse accepted evidence from one source host/discussion before writer spend. Adversarial tests and three private research probes confirm fail-closed behavior; no candidate is approved for release.
- [ ] `WP46-E7p` — Enable an isolated cloud release drill against a protected immutable Vercel deployment. The worker must accept that origin only when the Convex deployment proves it is not the serving production backend, the expected staging backend URL matches the runtime URL, and an automation bypass secret is present. Send the bypass only in request headers, never URLs or logs; verify reader commit and backend identity before any pointer movement. Production keeps its canonical-only origin. Test wrong target, wrong backend, absent secret and header scoping before staging deployment and nonempty-job restore.
- [ ] `WP46-E7g` — Private engine record/MDX/manifest inputs, exact-byte deep audit, public-path/symlink refusal and staging backend ingestion/idempotency passed on a genuine live contract-v2 record without staging it in public Git. Full configured checks pass. Independent review and production submission remain gated by human source review and owner action.
- [x] `WP46-E7h` — Enforce the verified Convex backend before Vercel's production frontend build. The build refuses an absent or wrong-target production deploy key or public URL, uses the deployment-scoped key for Convex, then builds Next only after a successful backend deploy. Local and preview builds do not deploy Convex. Both a staged build and the first Git-backed production build verified the order on `first-squirrel-244`; the canonical reader now reports merge SHA `752dc3a` after PR #105.
- [ ] `WP46-E7f` — After final review, create a pre-release annotated Git restore tag and full exact-target snapshot, then configure the exact reader origin/SHA and enable the Convex release switch under the owner's standing E7 authorization. Verify one explicitly approved real release before declaring GO.

## Out of scope

- Automatic publishing or an unreviewed real idea.
- Lowering the Idea Engine's strict evidence and $4/run gates to make a record pass.

## Notes

- PR #94's dry-run-first legacy importer is retained; its successful private production import is historical evidence, not authorization to import again.
- The current engine has no standalone signed receipt. E5 must derive authority from a backend-validated record-plus-artifact audit, not a caller-supplied `engine_receipt` string.
