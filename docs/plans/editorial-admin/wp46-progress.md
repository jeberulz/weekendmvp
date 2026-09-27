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
