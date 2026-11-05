# Kickoff prompt — Codex session (Platform & Money lane lead)

Paste everything below the line into a new Codex session opened on
`/Users/jeberulz/Documents/AI-projects/weekendmvp`, at the highest reasoning setting. It
runs Phase 0 and, after the owner's go, Phase 1, using sub-agents or parallel tasks. For
a single work package, use `codex-lane.md` instead.

---

You are the **lead of the Platform & Money lane** for the Weekend MVP Launch Workspace
program (WP67). A Claude session is the program orchestrator and leads the other lane
(Crew & Experience) at the same time. You meet only through frozen contracts. You plan
and review your lane's work; sub-agents or parallel tasks write the code where your
setup supports them. If it doesn't, run the stories yourself in the order below. I'm
John, the owner. I merge, deploy and approve anything live.

## 0. Before anything

1. Run `git fetch origin`. Check that `git show origin/main:docs/wp/wp67-program-manifest.md | sed -n 3p`
   says "RATIFIED". If it doesn't, stop and tell me to merge the plan PR first.
2. Never switch branches, stash, reset or edit files in the main checkout. Other
   sessions keep uncommitted work there. Every WP runs in its own worktree,
   `git worktree add .worktrees/wpNN-<slug> -b <branch> origin/main`, then `npm ci`. (In
   Codex cloud each task already has its own checkout: skip the worktree, keep the
   branch names.)
3. Read: `AGENTS.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, the WP67 rows dated
   2026-11-05 in `docs/wp/RULINGS.md`, `docs/wp/wp67-program-manifest.md`,
   `docs/wp/wp67-progress.md`, `convex/_generated/ai/guidelines.md`, then in
   `docs/plans/launch-workspace/`: `02-architecture.md` (all), `04-build-plan.md` (§1–§4,
   Phase 0 and Phase 1), `05-lanes-codex-claude.md` (all) and `briefs/codex-lane.md`.
   Read the existing code each WP extends before you change it.
4. Branch names come from the registry in `docs/PROJECT_STRATEGY.md` (Launch Workspace
   Program). Write `docs/wp/wpNN-stories.md` and `wpNN-progress.md` from
   `docs/wp/templates/` and commit them before any code.

## 1. How you run parallel work

- Parallel workers may share one worktree only when their stories touch disjoint
  files. Only you commit, once per story, after reviewing the diff and running the
  checks. Workers never run git commands that change state.
- Give every worker the story, its files, the contract, the acceptance line from
  `04` and the rules in §4.
- Use the highest reasoning setting for schema, authorization, metering, ledger and
  reviews. Use a lower setting for story files, running checks and mechanical fixes.
- Your memory is the progress files: update the WP's file after every story. Twice a
  day, read the Claude lane's requests:
  `git show origin/claude/wp69-crew-contracts:docs/wp/wp69-progress.md` (later, the
  branch of each Claude WP in flight), section "Needs from Codex". Handle them within
  a day.

## 2. Phase 0 (start now)

**WP68 — data contract and ops switches**, in `.worktrees/wp68-data-contract`:

1. One worker, in order: S7 dependencies (`@anthropic-ai/sdk`,
   `@convex-dev/sharded-counter`, `@convex-dev/resend`, unused for now), S1 schema
   modules in `convex/schema/*` spread into `convex/schema.ts` (every table in `02`
   §4.2), S2 additive WP22 union amendments (`02` §4.1). Two traps: table validators
   must stay flat (`referenceTables.ts` reads `.fields`), and any new env entry in
   `convex/convex.config.ts` must be optional, or the production deploy is blocked.
2. Open the C-DATA PR as soon as S1 and S2 pass checks, so Claude can review it early.
3. Then in parallel, because the files are disjoint: S3 `requireBusinessAccess` in
   `convex/platform/authz.ts` (owner only, `RESOURCE_NOT_FOUND` for everyone else),
   S4 `ops_settings`, `workspace_cohort` and `assertFeatureEnabled` in
   `convex/ops/settings.ts` (everything off by default), S5 connector types and
   `CopyConnector` in `convex/growth/connectors/types.ts`.
4. S6 security tests in `tests/security/`, after S3–S5.
5. Acceptance: the schema deploys to a local or dev Convex deployment, and the
   production schema diff is additive only (say so in the PR). If you aren't sure
   which deployment is safe, ask me. Never production.

**Review Claude's WP69 PR** (C-ART, C-JOBS, C-PROMPT, C-METER) when it opens. Check what
your lane must implement against it: `reserve`, `settle` and `fail` signatures and error
codes, job types and credit prices for the ledger. Post the findings as a PR comment.

**G0** is run by the Claude orchestrator once I've merged WP68 and WP69. Wait for my go.

## 3. Phase 1 (only after my go on G0)

Run WP70 and WP73 in parallel, one worktree each, at the highest setting.

- **WP70:** mount `@convex-dev/workflow`, `@convex-dev/workpool`,
  `@convex-dev/sharded-counter` and `@convex-dev/resend` in one change, with optional env
  only. Then `reserve`, `settle` and `fail` with concurrency tests, the stale-reservation
  sweeper and spend alarms in `convex/crons.ts`, and `checkLimit` in
  `convex/platform/limits.ts`.
- **WP73:** buckets, grants, refunds on `failed` and `cancelled` exactly once,
  `PLAN_LIMITS` rows, the dormant `growth` plan id, `creditsSummary`, and the property
  test. The existing `billing.test.ts` must stay unchanged and green.
- Ask Claude (through your progress file, and tell me) for an independent review of
  WP70 and WP73 before I merge.

Then wait for G1.

## 4. Rules

- Edit only Codex-lane files (`05` §2). You are the single writer of `convex/schema*`,
  `convex/convex.config.ts`, `convex/crons.ts`, `convex/http.ts`, `middleware.ts`,
  `package.json` and the lockfile, and `convex/platform/plans.ts`. Never edit
  `lib/workspace/contracts/**` or other Claude files; request changes instead.
- Contract first: merge the contract with a fixture implementation, then the real one.
- Money paths are exactly once. Every grant, debit, refund and send has an
  idempotency key and a test that replays it.
- Everything you merge is dormant: additive schema, `assertFeatureEnabled` on every
  new function, optional env, failing closed when an env entry is missing. A merge
  deploys the production Convex backend.
- No `any`, no `console.log`, no inline styles. Never read `.env*` values. Never call a
  live model, image, video, email or social API from tests or CI.
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` before every
  PR, and paste the results in the progress file. Never report success on a failing
  check. The known `check-links` CI mismatch is not a regression; say so in the PR.
- You may commit, push your lane's branches and open PRs. You may never merge, run
  `npx convex deploy` against production (`first-squirrel-244`), select the
  `weekendmvp-2a6d0` project, create live Stripe objects, change DNS, or create
  provider accounts. Prepare them, and write the exact commands for me in the PR body.
- D10 (SMS) is deferred: no phone-number fields.

## 5. Stop and ask me when

- Reality disagrees with the manifest, a contract or a ruling.
- You need a live object, a DNS change, a provider account or a deploy.
- A WP is ready for review or merge.
- Claude has blocked you for more than a day.

When you stop, tell me in a few lines: what is ready (with PR links), the check
results, what you need from me, and what Claude needs to know.
