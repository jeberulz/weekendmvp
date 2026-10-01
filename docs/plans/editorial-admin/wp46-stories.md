# WP46 Stories - Editorial Admin

Branch: `codex/editorial-admin-ui` (contained worktree `.worktrees/editorial-admin-ui`, based on main `359ad428`)
Lane: Work Package
Plan: [README](README.md), [design](design.md), [implementation contract](implementation.md)
Registry: `docs/PROJECT_STRATEGY.md` is **not** edited by this branch. WP46 is reserved here and joins the registry in a coordinated update (see [progress](wp46-progress.md)).

Definition of done for this branch: E0–E3 are built as a private, fixture-backed editorial workspace that is impossible to activate in production, with tests for every state and command boundary. E4–E7 stay blocked until their serialized schema/auth/engine/publishing integration windows are assigned; the branch reports the exact blocked integrations instead of simulating them. A demo approval or publish is never described as real.

## File boundaries (parallel slice)

Owned, new files only:

- `app/admin/editorial/**`
- `components/admin/editorial/**`
- `lib/editorial/**`
- `tests/editorial/**`
- `docs/plans/editorial-admin/**`

Read-only reuse: `components/ui/**`, `components/primitives/**`, `lib/utils.ts`, installed `radix-ui`, `lucide-react`, `zod` and the `remark-gfm` Markdown stack.

Not touched during E0–E3: `convex/**` (including `schema.ts` and `_generated/**`), auth helpers, `middleware.ts`, root layout/styles, `next.config.ts`, `package.json`/lockfile, `.github/**`, public routes, `ideas/manifest.json`, `content/**`, `lib/engine/**`, engine/seed/compiler scripts, the member dashboard, `docs/PROJECT_STRATEGY.md`, `docs/wp/**`. E4 opens only the seams listed under `WP46-E4`.

Commands live in [local-demo.md](local-demo.md) until a package-script merge window.

## Stories

- [x] `WP46-E0` - Contract and fixtures
  - Scope: `lib/editorial/contracts/**`, `lib/editorial/domain/**`, `lib/editorial/fixtures/**`, `lib/editorial/adapters/fixture/**`, `tests/editorial/**`, feature docs.
  - Acceptance criteria:
    - Editorial DTO v1 (`EditorialSubmission`, metadata, sources, claims, quality checks) has explicit validators: unknown keys rejected, bounded strings/arrays/bodies, UTC timestamp rules, explicit unknown values, tag/highlight allowlists matching `validate-idea-tags`, no `any` and no free-form metadata bag.
    - Producer, actor, mode and verification authority are server-established. A submission whose producer or mode disagrees with its credential is rejected; the receiver recomputes the artifact hash and rejects a mismatch; nothing in an envelope becomes a human decision, review or approval.
    - The repository interface is frozen with typed results and error codes. Commands never accept an actor ID, role, approval status, published pointer or verification flag from the caller.
    - Candidate decision, revision review, publication and release state machines plus the trash lifecycle are encoded as transition tables with guards and documented in [contract-v1.md](contract-v1.md).
    - Fixtures cover: new accepted engine candidate; duplicate rejection; evidence unavailable; changed source; live legacy idea with no record; live idea with edited draft; conflicting autosave; stale approval; failed deployment; uncertain activation; unpublished; trash. All fixture content is fictional and labelled demo data.
    - A reusable repository contract suite runs against the fixture adapter and is written so the later real adapter runs the same cases.
    - Tests prove an ingestion/service principal cannot accept, review, approve, stage, publish, unpublish, trash or restore, and that `recommendation: "accept"` never changes the candidate decision.
    - The fixture adapter refuses to construct when `NODE_ENV` is `production`.
  - Verification: `npx vitest run tests/editorial`, `npm run typecheck`, `npm run lint`, `git diff --check`.

- [x] `WP46-E1` - Private shell, review queue and library
  - Scope: `app/admin/editorial/**` (layout, queue, library), `components/admin/editorial/{shell,queue,library,common}/**`, `lib/editorial/runtime/**`.
  - Acceptance criteria:
    - Production builds answer every editorial path with HTTP 404 and `noindex`, with no editorial copy, data, fixture module or fixture text (production build scan plus live probe). Byte-identical responses to an unknown path need the proxy seam and are an E4 item. Development and test need the explicit `EDITORIAL_FIXTURE_MODE=local-demo` opt-in. No query parameter, cookie, browser storage or production environment variable enables the workspace. Every page, metadata function and server action re-checks access.
    - A conspicuous "Local demo — fictional data" banner appears on every fixture screen; simulated approvals and releases are labelled as simulated.
    - A separate editorial shell: 216px sidebar (Review queue, Library, Releases, Trash, Activity, Settings) and a header reading "Weekend MVP / Editorial" with environment, connection state and account. No member-dashboard navigation; no member or public UI changes.
    - The review queue is the default landing page. Its summary line is derived from data. A semantic table shows title + buyer, candidate decision, working revision, publication state, blockers, reviewed sections, evidence freshness and updated time. Server-side filters (decision/bucket, issue severity, source age, engine run, buyer/category) and cursor pagination.
    - The library searches title, slug, buyer and job; filters publication state, review coverage, stale evidence and category; sorts by last update; paginates by cursor.
    - Pages are `noindex`/`nofollow` with generic document titles (no draft titles reach the tab title or analytics).
    - Loading, empty, filtered-empty and unavailable states are truthful. Layouts work at 1440, 1024 and 390px; keyboard-only operation, visible focus and an automated axe scan pass.
  - Verification: render/unit tests, production build + status probe + bundle scan, browser checks at three widths, keyboard pass, axe scan.

- [x] `WP46-E2` - Review workspace
  - Scope: `app/admin/editorial/ideas/**`, `components/admin/editorial/workspace/**`, `lib/editorial/markdown/**`, `lib/editorial/editor/**`, `lib/editorial/domain/diff.ts`. Also, inside the editorial slice: draft server actions in `app/admin/editorial/_actions/**` behind `lib/editorial/runtime/action-support.ts`, presentation labels, a shared dialog and the production probe (see progress).
  - Acceptance criteria:
    - The title bar always shows the selected revision, current live revision, origin, save state and review state.
    - Main tabs Write, Preview, Compare and History; inspector tabs Evidence, Quality, Review and Details; one section outline for the eight headings with per-section review status.
    - A Markdown textarea editor with keyboard support and section navigation. The preview parses Markdown (CommonMark + GFM) and renders an allowlist: raw HTML, JSX, ESM and expressions are shown as text, never executed; links are limited to safe schemes with safe `rel`; remote images are not fetched. The preview is labelled "Editorial preview — public rendering not yet verified".
    - Autosave after idle and Cmd/Ctrl-S send a base version and idempotency key. Saved, Saving…, Offline — changes not saved, Conflict — review newer revision and Save failed are distinct; nothing is reported saved before the server acknowledges it; unacknowledged changes are protected on navigation; a conflict offers compare, keep mine and use theirs. Draft bodies are not written to browser storage.
    - Measured counts: prose words (frontmatter, code and markup excluded), reading time, sections, prompts and code blocks, labelled as measured and not as quality.
    - The evidence inspector shows each source's publisher/domain, canonical URL, type, publication/retrieval dates, freshness, related claims, verification result and a short excerpt, expandable to quote and context, with clearly labelled external links. Labels are distinct: Machine verified, Reviewed by you, Unavailable, Changed since review, Provisional search summary, Assumption. Claim markers in the preview open their claim.
    - The quality panel lists navigable issues (unsupported assertions, stale quotes, broken links, repetition, missing sections) without an aggregate score.
    - Details edits metadata and highlights with validation. History lists revisions; Compare shows a line diff against the live and previous revisions.
  - Verification: save-controller tests with fake timers, hostile Markdown tests, diff tests, render tests, browser keyboard pass at three widths, axe scan.

- [x] `WP46-E3` - Human workflow, releases, trash and activity (fixture/dry-run)
  - Scope: `components/admin/editorial/{workspace,releases,trash,activity,settings}/**`, remaining `app/admin/editorial/**` routes, fixture simulated worker. Also: review, release and demo server actions in `app/admin/editorial/_actions/**` and shared dialogs in `components/admin/editorial/common/**` (see progress).
  - Acceptance criteria:
    - Candidate decisions: accept (rationale), needs research (precise question), reject (reason category + note) and reopen, with the engine recommendation shown separately. Reject never unpublishes; reopening invalidates decision-dependent approvals.
    - Review attestation is explicit per item and bound to its dependency hash. There is no "mark everything" action. Edits invalidate only affected items. The checklist lists exactly what remains, and Approve stays disabled with linked reasons. Approval binds the artifact hash, policy version and current checks; later edits fork a new draft.
    - Publish confirmation shows the exact revision, new or republication, public URL, changed sections and claims, checks, approval time and previous live revision, then requires a (simulated, labelled) recent strong authentication. Releases run asynchronously with readable stages and persistent history, all labelled simulated.
    - Releases screen: preview-ready, running, failed, reconciling and completed releases with steps, exact revision, timestamps and errors, plus retry, cancel, reconcile and rollback controls guarded by state preconditions.
    - Unpublish lists affected surfaces, needs a reason and shows Pending until removal is verified. Trash is refused for live ideas (Unpublish first). Restore returns an idea unpublished and awaiting review. Rollback shows the diff and renewed checks. Emergency unpublish stays available when checks fail; the kill switch blocks new activations but not unpublish or recovery. Generation fences stop a delayed release after unpublish.
    - Activity shows actor, reason, revision and outcome, including denied attempts. Settings shows capability, integrations, policy version and publishing readiness as configured, verified or unavailable separately.
    - Backend-interface tests cover every transition, two-tab contention, stale approval, lost acknowledgement and generation fences. They are labelled as fixture-serialised, not proof of real concurrency or deployment.
  - Verification: contract suite, lifecycle tests, render tests, keyboard end-to-end review journey in fixture mode, axe scan.

- [ ] `WP46-E4` - Auth and private backend — **window assigned 2026-10-01** (owner: "start E4"; this branch is the single writer for the seams below)
  - Shared seams opened for E4 only: additive tables in `convex/schema.ts`; `convex/_generated/api.d.ts` (new module entries; regenerated by `npx convex dev` when a deployment is attached); `convex/convex.config.ts` (one optional env declaration); new `convex/admin/**` and `convex/editorial/**`; the post-sign-in redirect allowlists in `convex/auth.ts`, `convex/resendMagicLink.ts` and `lib/auth-return.ts` (add `/admin/editorial` only); `middleware.ts` (admin headers and real 404s); `components/consent/AnalyticsScripts.tsx` (no analytics on `/admin`). Still untouched: `package.json`/lockfile, `next.config.ts`, root layout/styles, public routes, content, `lib/engine/**`, WP45, the member dashboard, CI.
  - No production bootstrap, deploy, seed, import or push. Production keeps failing closed until the owner binds the account through deployment configuration (runbook only).
  - [x] `WP46-E4a` - Super-admin capability (editorial WP38 subset)
    - `super_admins` table; `convex/admin/superAdmin.ts`: an internal, idempotent bootstrap that binds the one verified account named in deployment configuration (`SUPER_ADMIN_BOOTSTRAP_EMAIL`) to its Convex Auth user ID, an internal revoke, and `resolveEditorialPrincipal(ctx)` used by every editorial function. Runtime authorization uses the bound user ID and the current session, never an email comparison or a client value. No public function can write the binding.
    - Tests: anonymous, forged identity, missing or other-user session, anonymous account, customer, unverified or ambiguous bootstrap email, changed email, revoked binding, repeated bootstrap; a structure guard that no public function touches `super_admins`.
  - [x] `WP46-E4b` - Shared editorial core (refactor, no behaviour change)
    - Move the repository rules out of `adapters/fixture/**` into `lib/editorial/core/**` over a store-neutral state with seams (clock, ids, check policy, release capability, verification authority, accepted modes, probe result). The fixture adapter becomes the core plus simulated seams. All existing editorial tests stay green; a guard mutation still turns them red.
  - [x] `WP46-E4c` - Private tables and Convex backend
    - Additive `editorial_*` tables and indexes (records typed with Convex validators checked against the TypeScript records), a unit-of-work store (load one idea's working set, run the core, write only what changed), list projections, bounded reads, public super-admin-gated queries and commands, and internal seams for ingestion (E5), the release worker (E6) and operator controls. Live checks and releases report "not connected" until E5/E6.
    - The repository contract suite runs unchanged against the Convex backend in `convex-test` (labelled: serialised, simulated check and worker policies supplied by the test harness only).
  - [ ] `WP46-E4d` - Live adapter and routes
    - `ConvexEditorialRepository` (Next.js) calling the public functions with the signed-in user's token; `resolveWorkspace()` returns the live workspace for a bound super-admin and is unavailable for everyone else; pages, metadata and server actions work in live mode; demo controls stay fixture-only; settings report live capability, re-authentication and integrations truthfully.
  - [ ] `WP46-E4e` - Edge, analytics and re-authentication
    - `/admin/**` responses are `private, no-store`, `noindex, nofollow` and `no-referrer`; signed-out visitors and accounts without the capability get a real 404 from middleware; consented analytics never load on `/admin`. Strong authentication is a fresh sign-in (session created within 10 minutes) through the account's own provider; the live "Confirm it's you" step starts that sign-in and returns to the editorial page.
  - [ ] `WP46-E4f` - Denial matrix, production probe and review
    - Every public editorial function denies anonymous, customer and revoked principals; the production probe covers live-mode routes and actions without a session; independent security review; docs and runbook.

- [ ] `WP46-E5` - Engine and legacy bridge — **blocked: needs WP45 contract freeze and E4**
  - Map WP45 v2 records/checks/receipts to Editorial DTO v1, authenticated ingestion, fixture-mode rejection, read-only import inventory and private import adapter.

- [ ] `WP46-E6` - Release and lifecycle bridge — **blocked: needs WP45 promotion, E4/E5 and a public-site integration window**
  - Durable release worker, protected preview, exact-artifact activation, visibility/version gate, projection updates, unpublish/rollback/recovery.

- [ ] `WP46-E7` - Launch gate — **blocked on E4–E6**
  - Full checks, staging journeys, visibility scans, restore rehearsal, bootstrap/import dry run, independent security review, owner activation plan.

## Stop conditions

- Stop before touching any shared seam listed above; record the need as an integration item instead.
- Stop if a requirement would need an authentication bypass on a deployable route or a production switch for fixture mode.
- Stop before any production bootstrap, import, seed, deploy, push or merge.
