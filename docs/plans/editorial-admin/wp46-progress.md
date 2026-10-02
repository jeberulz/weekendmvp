# WP46 Progress - Editorial Admin

Append-only. Treat entries as claims backed by the commands recorded beside them.

## 2026-09-27 - Lane, branch and WP number

- Lane: Work Package. Branch `codex/editorial-admin-ui` in the contained worktree `.worktrees/editorial-admin-ui`, created from main `359ad428` (equal to `origin/main` at start). The shared root checkout was not switched.
- WP number: **WP46** reserved for Editorial Admin. `main` registers WP01–WP44 plus the Build Platform range; WP45 is claimed by the active `codex/wp45-idea-engine-completion` worktree (uncommitted registry row). No worktree or `main` document claims WP46. Two stale, unmerged membership branches (`codex/wp41-membership-adoption`, `codex/wp42-membership-baseline`, 2026-09-12) list WP46–WP53 as reserved, but their numbering already collides with `main`'s WP41–WP44, so they are not treated as binding. The registry row is left for a coordinated update so this branch does not race the WP45 agent editing `docs/PROJECT_STRATEGY.md`.
- Read before code: `CLAUDE.md`, `AGENTS.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, `docs/wp/RULINGS.md`, `docs/wp/AGENT_HANDOFF.md`, `docs/wp/wp38-stories.md`/`wp38-progress.md`, WP45's stories and completion plan (read-only, from its worktree), the three plan documents, installed Next.js 16.3 docs (Cache Components authentication, `notFound`, `forbidden`, `connection`, `instant`).
- Findings that shape the build:
  - WP38 is planned only: no `super_admin`, `requireSuperAdmin` or admin audit code exists on `main`. E4 therefore needs its editorial-only WP38 subset built in an assigned window.
  - WP45's v2 record, evidence and MDX-safety modules are uncommitted in another worktree. Nothing here imports them; E5 maps them later through the Editorial DTO.
  - `middleware.ts` does not auth-manage or add no-store headers to `/admin/**`, and consented analytics would load there. Both are shared-seam E4 items; meanwhile editorial pages keep generic document titles.
  - `forbidden()` needs `experimental.authInterrupts` (shared config). Production denial uses `notFound()` from the editorial layout; its real status is verified against a production build, not `next dev`.
  - No DOM test library or diff library is installed and no dependency may be added, so interaction logic lives in pure, tested modules, rendering is tested with `renderToStaticMarkup`, and browser behaviour is verified manually in the in-app browser.
- Plan docs copied unchanged from `.worktrees/editorial-admin-plan` (SHA-256 verified identical).
- Next: E0.

## 2026-09-27 - WP46-E0 contract and fixtures

- Built Editorial DTO v1 (`lib/editorial/contracts/**`): strict validators, bounds, UTC timestamps, public-URL rules, evidence consistency, closed metadata mirroring `validate-idea-tags`, error codes, principals, read models, command schemas and the repository interface. Documented in [contract-v1.md](contract-v1.md).
- Contract additions beyond the plan's minimum envelope, recorded in the contract doc: a `legacy` block (first publication date, body origin); the artifact hash covers content only, with verification tracked as a separate assessment digest; `legacy` as a candidate marker that is not a human decision.
- Domain rules (`lib/editorial/domain/**`): hashing, fence-aware section split, measured counts, review items with dependency hashes, issues and approval blockers (one function drives both the UI reasons and the server refusal).
- Fixture adapter (`lib/editorial/adapters/fixture/**`): in-memory repository, simulated checks and worker, demo controls, production guard. Fixtures (`lib/editorial/fixtures/**`): fictional articles on `.example` domains; the seed drives every scenario through the public repository interface (no hand-built records). Seeding takes about 1.1 s.
- Scenario coverage: new candidate (plus an executable-markup blocker), accepted awaiting review, duplicate rejection with slug conflict, evidence unavailable, changed source, live legacy with no record, quarantined legacy markup, live v2 with an edited v3 draft, conflicting autosave, stale approval, failed deployment, uncertain activation, unpublished, trash, preview ready, changes requested.
- Checks run:
  - `npx vitest run tests/editorial`: 6 files, 84 tests passed (repository contract 32, validators 10, states 13, domain 10, fixtures and scenarios 16, drift 3).
  - Mutation check of the security guards (principal guard, save version fence, review hash check, approval artifact binding, producer check, generation fence): each mutation turned the contract suite red; restored and green again.
  - `npm run typecheck`: pass. `npm run lint`: 0 errors, 35 warnings (the existing baseline; none in new files). Staged whitespace check (`diff --cached --check`): pass.
- Limitation, stated honestly: fixture tests serialise commands in one process. They prove the rules, not real concurrency, deployment or authentication.
- Integration note for a later lockfile window: the Markdown parser packages (`mdast-util-from-markdown`, `mdast-util-gfm`, `micromark-extension-gfm`) are resolved through `remark-gfm`'s dependency tree and should become direct dependencies.

## 2026-09-27 - WP46-E1 private shell, review queue and library

- Routes under `app/admin/editorial/**`: review queue (default landing), library, releases, trash, activity and settings, with their own shell (216px sidebar at 1280px and wider, a menu sheet below that), the always-on "Local demo — fictional data" banner, and a header showing environment, data source and account. Releases, trash, activity and settings are read views here; their commands arrive in E3.
- Access: `lib/editorial/runtime/workspace.ts` is the only door. Production never reaches fixture code (the branch is compiled out); development needs the exact `EDITORIAL_FIXTURE_MODE=local-demo`. Every page and metadata function calls `assertEditorialRoutesEnabled()` first and checks access itself; page headings render only after access is confirmed.
- Production finding and fix: the first production probe showed each page's static header serialised into the 404 response (layouts render in parallel with pages) and a missing `<title>`. Guarding every page and `generateMetadata`, and gating headings, removed all editorial copy from denied responses. Residual, documented rather than hidden: the denial is Next's static error shell (real 404, `noindex`, visitors see the normal 404 page) but it is distinguishable from an unknown path until the proxy seam is used (E4).
- Accessibility finding and fix: the keyboard pass showed invisible focus rings. In Tailwind v4, `outline-none`/`outline-hidden` set `--tw-outline-style: none`, which `focus-visible:outline-2` inherits. Every editorial focus ring now adds `focus-visible:outline-solid`, verified in the browser (`solid 2px`), and a guard test enforces it. The same pattern in the member dashboard's `WorkspaceSearch.tsx` was flagged as a separate task, not changed here.
- Seed timeline: scenarios now run on a strictly forward timeline over the last fortnight; "stale approval" comes from a source changing after approval (the seed caught a duplicate reserving the original's slug when ordered wrongly — the state machine refused the approval, as it should).
- Checks run:
  - `npx vitest run tests/editorial`: 10 files, 111 tests passed.
  - `npm run typecheck`: pass. `npx eslint` on the editorial paths: clean.
  - `npm run build`: pass; editorial routes are static 404s (○).
  - `node tests/editorial/scripts/verify-production-build.mjs --probe http://localhost:3247` with `EDITORIAL_FIXTURE_MODE=local-demo` set on the production server: 4,143 build files contain no fixture sentinels (positive control: the dev bundle does); all 10 probed paths return 404 with `noindex` and no editorial or fixture text, including query-string and cookie attempts to enable fixture mode.
  - axe-core 4.12.1 (WCAG 2.0/2.1 A and AA) in the browser: 0 violations on the queue, library, releases, trash, activity and settings at 1440px, and on the queue at 375px with the menu sheet open.
  - Keyboard: logical tab order (skip link, banner, navigation, summary, buckets, filters, table); menu sheet traps focus, opens on the current page's link, closes on Escape and returns focus to its trigger.
  - Layout checked in the browser at 1440, 1024 and 375px.
- Not done: screen-reader (VoiceOver) spot check; gstack `browse` needs its Playwright browser installed (a download), so the in-app browser was used instead.

## 2026-09-27 - WP46-E2 review workspace

- Route `app/admin/editorial/ideas/[ideaId]` (guarded like every editorial page; generic title; `instant = false` because the shared root layout reads the pathname outside Suspense, which this slice may not edit). It loads the idea, the selected revision (`?revision=`, falling back to the working revision with a notice) and compare targets (live, parent, working).
- Workspace (`components/admin/editorial/workspace/**`): title bar with live and selected revision, origin, review state, save state, Save or "Edit in a new revision", and a More actions menu; Write / Preview / Compare / History tabs; Evidence / Quality / Review / Details inspector; an eight-section outline with review status; a sticky review footer. Layout: 340px inspector at 1280px and wider, a toggled inspector below that, and Article / Evidence / Review switching on phones with More actions separate from Save.
- Editor: plain Markdown textarea; `⌘S`/`Ctrl+S` from anywhere; `Ctrl+Alt+↓/↑` section navigation (caret scrolled into view with a hidden twin, announced politely); live measured counts labelled "not a quality score".
- Saving: `SaveController` (E2 engine) behind `useDraftSaver`, which keeps text in memory only. "Keep mine" now sends every field so nothing of the newer copy survives by accident; `pause()` lets React re-run effects without losing text. Unsaved text is protected on reload, close and in-app links (browser back/forward cannot be intercepted reliably; noted in the demo doc). A metadata form with errors keeps the workspace "not saved".
- Conflicts: stale saves show the conflict panel (compare, keep mine, use theirs); a draft approved or discarded elsewhere offers "save my text as a new revision" instead. Found while testing: hot reload remounted the editor because the page key included the server version, which would also let any future refresh drop unsaved text. The key is now revision id and kind only, and "use theirs" is an explicit server read.
- Preview: the safe Markdown renderer (E2 engine), labelled "Editorial preview — public rendering not yet verified", with metadata, tags, highlights, social-card inputs, preview notes and desktop/mobile widths. Claim markers open and focus their evidence card.
- Evidence, quality, review and details panels are read views plus the metadata/highlights form; per-item attestation, decisions, approval and releases are E3.
- Server actions (`app/admin/editorial/_actions/draft.ts`): save, create revision (optionally carrying text), discard, run checks and re-read, all through `withWorkspace` (re-resolve the workspace, then validate input). Documented in [contract-v1.md](contract-v1.md#server-actions-the-uis-only-write-path).
- Smaller fixes: blocker wording for edited claims; canonical tag order in the metadata form (toggling a tag off and on is not a change); inspector tabs fit 320px; the outline fills columns by available width; the review footer is compact on phones.
- Checks run:
  - `npx vitest run tests/editorial`: 16 files, 173 tests passed (new: save controller 14, outline 4, diff 5, safe Markdown 17, workspace render 12, server actions 8, action structure guards 2). Mutation check: removing `withWorkspace` from one action turned the new guard red; restored and green.
  - `npm run typecheck`: pass. `npm run lint`: 0 errors, 35 warnings (unchanged baseline, none in editorial files).
  - `npm run build`: pass; the idea route is partial-prerendered (◐), the rest static 404s.
  - Production probe with `EDITORIAL_FIXTURE_MODE=local-demo` set on the server: 4,170 build files free of fixture sentinels; 13 editorial paths (including the idea route with revision/tab parameters and an invalid id) return 404 with `noindex` and no editorial text; each of the 5 server actions, called directly with its manifest ID, returns `WORKSPACE_UNAVAILABLE` and no fixture data.
  - Browser (fixture dev server): autosave (Unsaved → Saved only after acknowledgement), heading rename raising a missing-section blocker and reverting it, metadata validation (below two tools → "Metadata has errors — not saved"), two-tab conflict with compare and "use theirs", claim marker → focused evidence card, keyboard tabs (arrow keys), More actions menu, discard dialog with Escape returning focus to More actions, tab order with a visible 2px outline at every stop.
  - Layout at 1440, 1024 (inspector toggle) and 390px; no horizontal scroll at 390 or 320px in any tab.
  - axe-core 4.12.1 (WCAG 2.0/2.1 A and AA): 0 violations for all four main tabs with each inspector panel at 1440px, the phone evidence view, a quarantined legacy page, a live legacy page, an older read-only revision, a submitted snapshot and the unknown-revision fallback.
- Not done: VoiceOver spot check; a browser run of "keep mine" (covered by the save-controller tests; the button calls the tested method directly).

## 2026-09-27 - WP46-E3 human workflow, releases, trash and activity (fixture, simulated)

- Decisions (Review tab): accept with a rationale, needs research with a precise question, reject with a reason category (a note is required for Other), and reopen. The engine recommendation is shown separately and never becomes a decision. Rejecting a live idea says it does not unpublish.
- Review: one explicit action per checklist item (Mark reviewed / Review again / Retract), bound to the item's dependency hash; flags (high blocks approval) and notes; warnings and flags resolved only with a written reason; blockers cannot be waived. No bulk action exists. Review is unavailable, with the reason shown, while the editor has unsaved text, for a non-working revision, or in Trash.
- Approval: request changes / resume; Approve opens an explicit statement (checkbox) bound to the artifact hash, policy and current checks. Approving restarts the editor in place as a frozen, read-only snapshot; editing then forks a new revision.
- Releases: prepare a preview of the approved revision; the publish confirmation shows the exact revision and artifact, first publication or republication, public URL, what it replaces, changed sections and the claims in them, checks and the approval, then requires a sign-in confirmation from the last 10 minutes (simulated, labelled, no secrets asked). Cancel, retry, reconcile and rollback follow each release's allowed actions; rollback shows the diff against live and re-run checks first. A simulated worker ticker (workspace and Releases screen) advances in-flight releases while the page is open, with pause and step controls, and says nothing is deployed.
- Lifecycle: Unpublish lists every affected surface, needs a reason and shows pending until removal is verified; Trash is refused for live ideas (menu says "unpublish first") and waits for saved text; Restore (workspace and Trash screen) returns the idea unpublished and awaiting review. Publish, retry, rollback, unpublish and trash all show the sign-in step when it is not fresh.
- Activity already showed actor, reason, revision, outcome and a Denied filter (E1). Settings gained fixture-only demo controls (sign-in, kill switch, failing deployment, lost acknowledgement, policy bump, reset).
- Server actions: 9 review, 9 release/lifecycle and 8 demo actions, all behind `withWorkspace`. Documented in [contract-v1.md](contract-v1.md#server-actions-the-uis-only-write-path), including the E4 obligation to replace the simulated sign-in step.
- Found and fixed while testing by keyboard:
  - Focus fell to `<body>` after "Mark reviewed" (the button disabled itself while busy) and after commands whose button disappears (approve, decisions, release actions, trash/restore). Busy states now use `aria-disabled`, the review toggle is one element, and refreshes run in a transition that moves focus to the affected section (decision, checklist, release, heading, release card) once data arrives.
  - "Prepare preview" was still offered for the revision already live; the rollback diff had no live copy because the displayed revision view went stale after a refresh. The view now follows refreshed server data (the editor's text is untouched), and the live copy comes from the idea's live revision.
  - The simulated worker only ran while the Review tab was open; it now runs at workspace level.
  - Doubled full stops when a reason ended with one; the sign-in text repeated punctuation.
  - Editor remounts: the page key is now the revision id only. Approval, trash and restore restart the editor in place from the server's view, so a refresh can never drop unsaved text.
- Environment note: in the hidden in-app browser pane `requestAnimationFrame` never fires, so React 19.2's batched Suspense reveals leave streamed content in hidden `S:n` containers (two `<main>` elements in the DOM). Forcing one frame completes the reveal (one `<main>`, no leftovers). This explains the duplicate DOM noted in E1; it is not an application defect.
- Checks run:
  - `npx vitest run tests/editorial`: 18 files, 187 tests passed (new: workflow actions 5, workflow render 9). The workflow action tests are labelled fixture-serialised; the existing contract suite (32 cases) covers two-tab contention, stale approval, lost acknowledgement, kill switch, failed deployment, rollback and generation fences.
  - `npm run typecheck`: pass. `npm run lint`: 0 errors, 35 warnings (unchanged baseline).
  - `npm run build`: pass. Production probe with `EDITORIAL_FIXTURE_MODE=local-demo` set: 4,183 build files free of fixture sentinels; 13 editorial paths 404 with `noindex`; all 31 editorial server actions, each called through a page that bundles it, return `WORKSPACE_UNAVAILABLE` with no fixture data.
  - Keyboard end-to-end in the fixture workspace (before the pane was hidden): restore the edited claim, Cmd-S, run checks from the menu, arrow to the Review tab, attest the remaining items, approve through the dialog (checkbox, note, submit), prepare, publish with the simulated sign-in, watch every stage to Succeeded (Live v3), roll back to v2 with the diff and re-run checks, unpublish from the menu (pending, then removed). Every action was triggered with Enter/Space/Tab, but the starting control was sometimes focused by script (including two menu items after my arrow-key counts were off). Trash and restore were verified with DOM events after the pane was hidden.
  - axe-core 4.12.1 (WCAG 2.0/2.1 A and AA): 0 violations for the Review tab, the publish, reject and request-changes dialogs, Releases (with the cancel dialog), Settings (with the reset dialog), Trash (with the restore dialog) and Activity (denied filter).
- Not done: VoiceOver spot check; keyboard run of Trash/Restore (DOM events only, the pane was hidden).

## 2026-10-01 - WP46-E4 window assigned

- Owner instruction in chat: "start E4". This branch is the single writer for the E4 seams listed in [wp46-stories.md](wp46-stories.md#stories) for the duration of E4. Nothing is pushed, merged, deployed, seeded or bootstrapped.
- State at start: E0–E3 committed locally (`24a831a`…`3734b6e`); `main` is six commits ahead (#82, #84–#87, #89). None of them touches `convex/`, `middleware.ts`, the auth helpers or editorial files, so E4 builds on the current branch; the branch is brought up to date before any PR.
- Findings that shape E4:
  - WP38 is still unbuilt on `main`; the 2026-08-06 ruling fixes the model (one `super_admin`, bootstrapped from deployment configuration, bound to the Convex Auth user ID, never an email check). E4 builds only the editorial subset of WP38-S1/S4/S5.
  - Convex Auth creates a new `authSessions` row only on a full sign-in and keeps it across token refreshes, so the session's creation time is the time of the last real authentication. Accounts never auto-link across providers (`createOrUpdateAuthUser`), so a step-up must use the account's own provider. Google may complete silently while its own session is active; the email link always proves inbox possession. Recorded as the chosen mechanism and its limit.
  - Post-sign-in redirects are allowlisted to `/dashboard` in three places (`convex/auth.ts`, `convex/resendMagicLink.ts`, `lib/auth-return.ts`); a step-up must return to `/admin/editorial`.
  - Under Cache Components a route-level `notFound()` after a flushed shell is a soft 404 (WP27). Live editorial pages are dynamic, so middleware has to issue the real 404 for signed-out visitors and accounts without the capability.
  - `npx convex codegen` needs a configured deployment, and this worktree has none. `_generated/api.d.ts` is a static module list, so new modules are added in the generated format and checked by typecheck. Convex functions already import `../../lib/**` and use Web Crypto (`convex/platform/preview/*`), so the shared editorial core can run inside Convex.

## 2026-10-01 - WP46-E4b shared editorial core

- The repository rules moved from `lib/editorial/adapters/fixture/**` into `lib/editorial/core/**` (`repository.ts` as the abstract `EditorialCore`, `derive.ts`, `rules.ts`, `listing.ts`, `state.ts`). The executable-markup scanner moved to `lib/editorial/domain/executable-markup.ts` because the receiver needs it for legacy quarantine in live mode too. The fixture adapter is now a thin subclass with the simulated seams. Described in [contract-v1.md](contract-v1.md#shared-core-wp46-e4b).
- Seams added for the live adapter, each a no-op for the demo: environment `mode`, `simulated` narration, check policy (`run: null` = not connected), release capability, worker actor, id source; caller-established verification authority on import (without one, submitted verification is downgraded and submitted checks dropped); a recorded probe `observation` replaces the demo-only `simulatedWorld`; release and activity records store the revision number.
- Behaviour of the local demo is unchanged; one guard was narrowed: outside the slice, nothing may import fixture code (it previously banned any `lib/editorial` import, which Convex now needs), and a new guard limits Convex to the store-neutral modules.
- Checks run:
  - `npx vitest run tests/editorial`: 18 files, 188 tests passed (187 before plus the new Convex import guard).
  - Mutation check in the moved core: disabling the save version fence turned "a stale base version conflicts" red; letting any signed-in human through the principal guard turned the three authority-boundary cases red. Restored byte-for-byte (`cmp`), green again.
  - `npx tsc --noEmit`: pass. `npx eslint lib/editorial tests/editorial convex/editorial`: clean.
- Not done here: E4a's schema change. The first attempt to add `super_admins` and `editorial_audit` to `convex/schema.ts` was partly blocked by the session's safety check (the import line), so the schema was restored to its committed state and E4a waits for the owner's go-ahead on that edit.

## 2026-10-01 - WP46-E4c groundwork (store-neutral)

- While the schema edit waits, the parts of E4c that need no shared file were built in `lib/editorial/core/**`: the live environment and `LiveEditorialCore` (`live.ts`), change tracking (`changes.ts`), stored list summaries (`summary.ts`), the release-worker step rules (`worker.ts`, now shared by the simulated worker) and the per-idea transaction layer `PartitionedEditorialRepository` over a `WorkingSetStore` (`partitioned.ts`). Convex only has to implement `WorkingSetStore`. Documented in [contract-v1.md](contract-v1.md#shared-core-wp46-e4b).
- Contract change: `listActivity` totals may be `null` (the live log is paged by index, not counted); pagination then reads "Showing x–y".
- Checks run:
  - `npx vitest run tests/editorial`: 20 files, 234 tests passed. New: live rules on an in-memory state (14: fixture envelopes refused, verification downgraded without a receipt, receipt-backed checks kept, legacy always unverified, checks "not connected", release intents refused before anything is recorded, truthful live settings, denial recorded, exact change sets, stored summaries) and the full repository contract (32) through `PartitionedEditorialRepository` over an in-memory store that hands out copies of one idea at a time and commits only change sets. Check results, receipts and worker outcomes there are simulated by the harness; it proves the partitioning and the live rules, not a deployment.
  - Mutation check: skipping the request-key load in the transaction layer turned the exactly-once save and the repeated-publish cases red; restored (`cmp`), green.
  - `npx tsc --noEmit`: pass. `npx eslint lib/editorial tests/editorial components/admin/editorial app/admin/editorial`: clean.

## 2026-10-01 - WP46-E4a super-admin capability (editorial WP38 subset)

- Owner instruction in chat after the safety check stopped the first schema edit: "yes, edit those files and continue E4".
- Additive schema: `super_admins` (user ID, role, bound/revoked times and reason; indexes `by_userId`, `by_role`) and `editorial_audit` (the stored activity record; indexes `by_ideaId`, `by_outcome`, `by_ideaId_and_outcome`). `SUPER_ADMIN_BOOTSTRAP_EMAIL` declared as an optional deployment setting in `convex/convex.config.ts`; `_generated/server.d.ts` and `_generated/api.d.ts` updated in the generated format (no deployment is attached to this worktree, so `npx convex codegen` cannot run; `npx convex dev` regenerates them identically).
- `convex/admin/superAdmin.ts`: `currentAccount` (verified token → existing user and session that belong together, not anonymous, unexpired when a mutation passes the time; plus the active binding), WP38's `requireSuperAdmin`, and internal-only `bootstrapOwner`, `revokeSuperAdmin` and `bindingStatus`. Bootstrap binds only a verified account with a provider account, refuses ambiguity and a second holder, never echoes the email, and records every outcome. Revocation keeps the row. Runbook: [super-admin-runbook.md](super-admin-runbook.md). Nothing was run against any deployment.
- Checks run:
  - `npx vitest run convex/admin`: 10 tests (not configured, unverified/anonymous/no-provider accounts, ambiguity, normalised email and idempotency, second holder refused, owner vs customer vs anonymous resolution, four forged identities, expired and deleted sessions, changed email, revocation with history and re-binding).
  - New static guard: only `convex/admin/superAdmin.ts` and the schema mention `super_admins`, and that module registers no public function.
  - Mutation check: dropping the "session belongs to this user" test turned the forged-identity case red; restored (`cmp`), green.
  - `npx vitest run convex tests/editorial`: 50 files, 617 tests passed. `npx tsc --noEmit` (root and `convex/`): pass. ESLint on the touched paths: clean.

## 2026-10-01 - WP46-E4c private tables and Convex backend

- Additive schema: `editorial_settings`, `editorial_ideas` (`by_key`, `by_lifecycle`), `editorial_revisions` (`by_key`, `by_ideaId_and_number`), `editorial_attestations`, `editorial_flags`, `editorial_resolutions`, `editorial_notes`, `editorial_approvals` (each `by_ideaId`), `editorial_releases` (`by_key`, `by_ideaId`, `by_state`), `editorial_idempotency`, `editorial_submissions`, `editorial_slugs`, `editorial_idea_summaries`. Records are typed Convex validators with compile-time `Same`/`Storable` checks against the core's record types (`convex/editorial/validators.ts`); the publishing taxonomy is stored as strings so a later taxonomy change cannot invalidate stored drafts. List summaries and request-key results are JSON (derived caches, like `preview_capabilities.renderSpec`).
- `ConvexWorkingSetStore` (`convex/editorial/store.ts`): loads one idea's documents, maps them to core records, commits change sets with `insert`/`replace`, keeps summaries current, pages activity on `_creationTime` (short cursors, no count), and fails loudly past its bounds (40 revisions per idea — now also refused by the core when creating one — 5,000 child rows per idea, 2,500 ideas, 4,000 releases, 900 KB per document with a clear "too large" error).
- Public functions: 9 queries (`convex/editorial/reads.ts`, including `session`, which reveals the capability only to its holder and returns its sign-in method for re-authentication) and 22 mutations (`commands.ts`), one per repository command, with argument validators checked against the repository types (`args.ts`). Every one resolves the caller from the verified session (`session.ts`); strong authentication is the session's creation time. Anonymous calls write nothing; an account without the capability has its refusals recorded up to 20 an hour (rate-limiter component); the capability holder's refusals are always recorded. Internal seams (`service.ts`): `importSubmission` (E5), `workerQueue`/`workerAdvance` (E6), `setKillSwitch` (operator). Production behaviour until E5/E6: checks and publishing say "not connected".
- Display counts (words, reading time, prompts, code blocks) became an environment seam: the demo measures with the parser, the live adapter measures on the Next.js side, and nothing Convex loads imports the parser. A new guard walks the import graph from every Convex module and fails if it reaches the parser, React or Next.js (it caught a deliberately re-added import). **Correction (E4f):** this entry first said Convex would load micromark's DOM entity decoder and every editorial function would fail to load. That was wrong: `decode-named-character-reference` 1.3.0 maps the `convex` export condition to its plain build, and the E4f offline bundle check loads the parser under Convex's settings. The DOM build is only picked when the `convex` condition is missing, which the first check left out. The seam and guard stay because they keep a large dependency tree out of Convex functions, but they did not fix a live bug. Read-only repositories use deterministic ids, so no query draws randomness; mutations use `crypto.getRandomValues`, as `generateFromBridge` already does in production.
- Checks run:
  - `convex/editorial/contract.test.ts`: the repository contract (32 cases) against the Convex tables in convex-test, one transaction per call (principals, checks, receipts and worker outcomes simulated by the harness; not proof of authentication, concurrency or deployment).
  - `convex/editorial/functions.test.ts` (9): session check for anonymous, customer and owner; every read refused without data; anonymous commands write nothing; customer refusals recorded and capped at 20; forged identity; revocation at the next request; argument validation; an 11-minute-old session needs a new sign-in before trash and a new session passes; the live journey (queue, decision, fork, save, conflict, review, checks and publishing refused with their reasons, activity paging without a total, settings); fixture envelopes and malformed JSON refused; kill switch and worker seam.
  - Mutation checks: letting anonymous calls write and taking strong authentication from the clock each turned a functions test red; restored (`cmp`), green.
  - Structure guards (4 new): internal-only service module; every public command and read resolves the session; no identity, role or capability arguments; only editorial modules name the editorial tables; the import-graph guard above.
  - `npx vitest run convex tests/editorial`: 660 tests passed. `npx tsc --noEmit` (root and `convex/`): pass. ESLint: clean.
- Not verified here: Convex's real bundler and isolate (no deployment is attached, and starting a local backend may download a new backend binary, which needs your permission). A disposable local push was planned for E4f; see that entry for the offline check that ran instead.

## 2026-10-01 - WP46-E4d live adapter and routes

- `ConvexEditorialRepository` (`lib/editorial/adapters/live/repository.ts`, server-only): every method calls the public editorial Convex function with the signed-in user's own token (`fetchQuery`/`fetchMutation`), so Convex resolves and re-checks the caller on every call. Revisions come back with display counts measured here (Convex functions do not load the parser). A thrown Convex "too large" or invalid-input error becomes `INVALID_INPUT`; any other failure becomes `WORKSPACE_UNAVAILABLE` and is never shown as saved. `importSubmission` is not a workspace action and is refused.
- Workspace gate (`lib/editorial/runtime/workspace.ts`): the fixture branch is unchanged (development, exact opt-in, compiled out of production); otherwise the live workspace, only when a backend is configured, the request carries a session token and Convex's `session` check confirms the capability. Unavailable reasons: not configured, not signed in, no capability, backend unavailable (fails closed). Server actions accept either workspace; demo controls use a fixture-only wrapper and are unavailable in live mode.
- UI: the shell shows a "Live" badge, the private-store connection and the editor's name in live mode, and the "Local demo" banner only in fixture mode; the simulated worker ticker only appears for simulated releases. Production pages still answer 404 until E4e adds the middleware gate and the live sign-in confirmation.
- Checks run:
  - `tests/editorial/runtime/live-workspace.test.ts` (6): with `convex/nextjs` routed to convex-test by token — unavailable when unconfigured, signed out, a customer or a forged token; fails closed when the backend errors; the owner gets the live workspace with measured counts; transport failures become truthful results; server actions decide, review and trash against the private store, a read-only snapshot save is refused, and customer and anonymous actions plus every demo control are unavailable.
  - `npx vitest run convex tests/editorial`: 666 passed. `npx tsc --noEmit` (root and `convex/`): pass. ESLint: clean.

## 2026-10-01 - WP46-E4e edge, analytics and re-authentication

- Middleware (`middleware.ts`): every `/admin/editorial/**` request — page, RSC or server action — asks Convex (`editorial/reads:session` with the session token) whether the account holds the capability; anyone else, and anyone the backend cannot vouch for, is rewritten to the site's own 404. The local-demo skip exists only outside production builds with the exact opt-in. Every `/admin/**` response is `private, no-store`, `noindex, nofollow` and `no-referrer`. Consented analytics never load on `/admin` (`components/consent/AnalyticsScripts.tsx`).
- Post-sign-in allowlists: one shared rule (`lib/private-paths.ts`) used by `lib/auth-return.ts`, `convex/auth.ts` and `convex/resendMagicLink.ts` now accepts `/admin/editorial` as well as `/dashboard`, and nothing else new.
- "Confirm it's you" (live): the editorial layout provides the Convex Auth client and the account's sign-in method; the step signs in again with Google or sends an email link to the account's own address, then returns to the same page. The local demo keeps its labelled simulation. No password or code is ever asked for in the workspace.
- Production: with a Convex URL in the build, editorial pages render per request behind the middleware gate; without one they stay static 404s (`lib/editorial/runtime/route-guard.ts`, build-time constants only).
- Checks run:
  - New tests: `auth-redirects` (13: path rules; Next.js, Convex Auth and email-link allowlists accept editorial targets and refuse lookalikes, traversal, other hosts and backslashes), `middleware-gate` (9: signed out without a backend call, customer, backend failure, server action and RSC requests, the super-admin passes, demo skip only outside production, operator headers, public pages untouched), `strong-auth` render (5: Google, email, unknown method, confirmed, simulated only in the demo, no secret inputs). Updated structure guards for the build-time constants and the middleware gate.
  - `npx vitest run convex tests/editorial tests/redirects/middleware.test.ts tests/auth`: 845 passed. `npx tsc --noEmit` (root and `convex/`): pass. ESLint: 0 errors (4 existing warnings in `lib/og`).
  - `npm run build` (no Convex URL) and `NEXT_PUBLIC_CONVEX_URL=https://editorial-probe.invalid npx next build` (live mode; the `.invalid` host is never reachable): both pass; in the second the editorial routes are partial-prerendered. Probe against each on port 3247: 4,189 and 4,183 build files free of fixture sentinels; all 13 editorial paths, each with a fixture-switch attempt and a forged session cookie, return 404 with `noindex`, `private, no-store` and `no-referrer`; all 31 server actions refused. An editorial 404 is byte-identical to an unknown path's (the old "error shell" note no longer appears); only the operator headers differ, and every `/admin/*` path has them.
  - Accessibility, by checklist: the new step uses native buttons with text, `aria-disabled` while busy, a labelled group, `role="status"` for "link sent" and `role="alert"` for failures; the "Live" badge is text. The fixture UI's markup is unchanged.
- Not verified here: the live screens in a browser (they need a Convex backend; see E4f), and the Google round trip itself.

## 2026-10-02 - WP46-E4f denial matrix, production probe and review

- Denial matrix (`convex/editorial/denials.test.ts`, committed with the gate tests): all 9 public queries and 22 public mutations refuse anonymous, forged, customer, expired-session and revoked callers. Anonymous calls write nothing, and customer refusals are recorded up to the limit.
- `npm test` was red since E0: the environment-documentation guard flagged `NODE_ENV`, which the fixture gate reads. `.env.example` now names it as provided by Next.js. Next 16.3.6 sets it before loading env files (`bin/next` preAction), and `@next/env` never overrides a key already set, so an env-file value cannot change it.
- Independent security review by two read-only reviewers, one for the Convex backend and one for the Next.js edge. No critical or high findings.
  - **Medium:**
    - Refusal records stored caller-chosen id strings of any size, so one free account could break the Activity log.
    - Some URL forms skipped the middleware gate: an asset-like last segment (`…/x.js`), Next.js segment-prefetch paths (`/admin/editorial.segments/…`).
  - **Low:**
    - Binding queries read only the 50 oldest rows (revocation could fail, and a second holder could be bound).
    - Approval was reachable before checks were connected, through a receipt-backed import.
    - Google-only accounts can never be bound, and the runbook said they could.
    - One idea's working set could outgrow a transaction.
    - The gate could fail open on an unexpected session shape.
    - Analytics history listeners.
    - Framing.
    - Canonical redirects lacked operator headers.
    - Denials are distinguishable by rewrite markers.
  - **Info:** the email step-up carried revision ids; probe gaps.
- Fixed:
  - **Refusal records (core `deny()`):** keeps only well-formed ids. A deployment-wide cap of 200 an hour sits on top of the per-account 20 an hour (`editorialDeniedRecordsAll`).
  - **Binding queries:** `super_admins` indexes include `revokedAt`, and active bindings are queried directly. Bootstrap and status throw past 10. Emergency revoke has its own batch query and never stops at that bound.
  - **Approval before E5:** a `CHECKS_NOT_RUN` blocker applies whenever no check runner is connected.
  - **Working-set size:** new revisions are refused past 8 MiB of stored revisions per idea.
  - **Middleware gate:**
    - The matcher adds `/admin` and `/admin/:path*`.
    - The gate and headers cover every `/admin` request path, including transport forms and percent-encoded spellings (`isOperatorRequestPath`).
    - Only an explicit `{ signedIn: true, editor: {…} }` passes, and the `session` query has a `returns` validator.
    - A 3-second timeout denies.
    - The rewrite target is the neutral `/__not-found`.
  - **Headers:** `X-Frame-Options: DENY` and `frame-ancestors 'none'` on every operator response, including canonical redirects.
  - **Step-up email:** the link carries the page path only.
  - **Probe:** RSC, suffix, segment-prefetch and encoded variants; anti-framing headers; body identity; actions posted to `/` too.
- Both reviewers re-checked the fixes: every fixed finding is closed and nothing broke. Their two residuals (the revoke bound, the encoded spelling) are fixed. Finding 8's suggested static test already exists (`boundaries.test.ts`: every exported action returns `withWorkspace`/`withFixtureWorkspace` and nothing else is exported).
- Found in the live browser pass and fixed:
  - Settings in live mode showed the demo's "What is simulated in local demo mode" block. It now renders only in fixture mode, with a structure guard.
  - Wide tables in Settings, Trash and the safe preview were scrollable regions keyboard users could not reach. A focusable, labelled `ScrollRegion` primitive fixes Settings and Trash; preview tables get the same attributes, labelled by their header row.
- Correction recorded in the E4c entry: the "parser crashes in Convex" claim was wrong. `decode-named-character-reference` maps the `convex` condition to its plain build. The new offline check (`tests/editorial/scripts/verify-convex-bundle.mjs`) loads every Convex module the way the CLI bundles it, and controls prove its sandbox would catch a DOM build. The code comments that repeated the claim are corrected.
- Real Convex runtime, verified for the first time:
  - **Backend:** a disposable local backend from the CLI's cached binary (pinned version, no download), bound to 127.0.0.1:3250/3251, beacon off, client logs redacted, data and keys in the session scratchpad.
  - **Push:** schema (56 tables, 15 editorial), all functions and the rate-limiter component. Real codegen produced files identical to the hand-written `_generated` ones, before and after the index change.
  - **Flows:**
    - Sign-in through Convex Auth's verification-code path (no email sent).
    - `bootstrapOwner` bound, then reported `already_bound`.
    - Live imports.
    - Through the real isolate, the owner reads the queue, a customer gets `FORBIDDEN`, and anonymous gets `UNAUTHENTICATED`.
- Live screens in the desktop app's built-in browser. gstack `browse` needs a Playwright build that is not installed, and installing it downloads browser binaries. axe-core was served from `node_modules` on loopback.
  - **Pages scanned:** at 375 px, the queue, the idea's preview, evidence and review views, releases (empty state), trash (empty state), settings, activity (real audit entries) and the trash dialog's live "Confirm it's you" step; at desktop width, the queue, the idea preview and settings.
  - **Result:** 0 WCAG 2.1 A/AA violations after the fixes. Not covered live: the Write tab on its own (the demo's Write tab passed at 1440 px in E2), and Trash with rows, so its new scroll region was exercised only on Settings. The E2/E3 scans ran at 1440 px, where the Settings table fits, which is why its narrow-screen problem surfaced only now.
  - **Real-backend actions:** a new revision and an autosave (`saveDraftAction`) against the real backend.
  - **Keyboard:** Tab focus ring on the scroll region and arrow-key scrolling; the dialog takes focus, Escape closes it and focus returns to "More actions".
  - The stale session showed "Needed before publishing" and offered the email link. It was not sent.
- Harness note, not a finding: a lost browser session was traced to re-injecting refresh tokens the app had already rotated (Convex Auth's reuse detection). It did not reproduce with a clean single sign-in. The Convex Auth client refreshes its token on each full page load (library behaviour).
- Checks run on the final code:
  - `npm test`: exit 0. og 91, links 6, redirects 38 + 76, auth 133, security 82 + 84, sitemap 4, convex 429, engine 62, home 34, platform 209.
  - `npx vitest run tests/editorial`: 22 files, 253 tests.
  - `npx tsc --noEmit` (root and `convex/`): pass.
  - `npx eslint .`: 0 errors. The 35 warnings are all in files this branch does not touch.
  - Mutation checks, each restored with `cmp`:
    - Removing the `CHECKS_NOT_RUN` blocker turned the receipt-backed approval test red.
    - Storing raw refusal ids turned the refusal-id test red.
    - Disabling the per-idea storage budget turned its test red.
  - **Production build A** (no Convex URL; served with `EDITORIAL_FIXTURE_MODE=local-demo` set on purpose):
    - 4,189 build files free of fixture sentinels.
    - 57/57 page checks: 19 paths × fixture switch, forged session and RSC prefetch.
    - 62/62 action checks: 31 actions, each on its own page and on `/`.
    - 38/38 denied HTML bodies byte-identical to an unknown path's.
  - **Production build B** (`NEXT_PUBLIC_CONVEX_URL` = the disposable backend):
    - The same probe: 57/57, 62/62, 38/38.
    - With real sessions, anonymous and customer get 404 with the site's 404 body on all six pages; the owner gets 200 on all six.
    - All 18 responses carry `private, no-store`, `noindex`, `no-referrer` and the anti-framing headers.
    - The customer's RSC navigation and server action are refused. The owner's RSC navigation (Next's 307 cache-busting redirect, then 200) and `getRevisionAction` (200, `ok: true`) work.
  - `node --experimental-vm-modules tests/editorial/scripts/verify-convex-bundle.mjs`: PASS. 67 modules, 147 functions; the editorial surface is 9 public queries, 22 public mutations and 7 internal functions.
- Not fixed, recorded:
  - **Analytics history:** history-based analytics events can still fire on an `/admin` URL after a soft navigation from a public page and Back. Changing it alters public analytics behaviour, so it is the owner's decision.
  - **Google accounts:** making them bindable means mapping Google's verified-email flag in the shared sign-in code; owner decision.
  - **Child-row growth:** child rows per idea can grow past a transaction (5,000 per table, then the load fails loudly); paging or compaction is E7.
  - **Rewrite markers:** they distinguish a denial from an unknown path by headers (documented).
  - **Token refresh:** Convex Auth's middleware token refresh has no timeout (library, every path).
  - **Cookie banner:** the site's cookie banner appears on `/admin` (root layout; analytics never load there).
  - **Public 404 page:** its footer fails color contrast (pre-existing, public page).
  - **CI coverage:** `tests/editorial` is still not part of `npm test` (`package.json`).
- Not done here: no deployment, bootstrap, seed or push to any real Convex deployment or Vercel, and nothing pushed to git. The branch is 6 commits behind `main`; a dry merge shows one conflict, `.env.example`, where both sides appended lines at the end (keep both).

## 2026-10-02 - PR #92 review fixes

- Branch synced with `main` (merge commit; the only conflict was `.env.example`, both sides' lines kept) and opened as PR #92. Checks on the merged branch: `npm test` exit 0, both typechecks, `tests/editorial` 253, lint 0 errors.
- Codex review, three findings:
  - **Carrying unsaved text into a new revision was two backend calls.** A transient failure after the first could leave a new draft without the text. The client then reset its request keys, so a retry was refused ("a working draft already exists"). Fixed:
    - `createRevision` takes an optional `carry` and a `null` base (the idea's working revision, resolved inside the command).
    - Creating the draft and applying the text happen in one command; the action makes that single call.
    - The client keeps its request key until success, and mints a new one only when the conflict or the carried text changes.
    - A contract case on all three backends covers the carry, a replayed request, a reused key with different text, and refusal while the draft exists. The action test replays a request.
  - **Analytics already loaded could report an `/admin` URL after a client-side move from a public page and Back.** Fixed in `components/consent/AnalyticsScripts.tsx`:
    - A page load that has shown an operator path never loads analytics.
    - Analytics already running when one appears are stopped for that page load (GA's opt-out flag, revoked Pixel consent).
    - Public visitors who never touch `/admin` are unaffected.
    - Structure guard added. It supersedes the "found, not fixed" note in the E4f entry.
  - **Google-only owners cannot be bootstrapped.** Not changed: mapping Google's verified-email flag changes the shared sign-in code for every customer, so it stays the owner's decision (runbook and contract say so).
