# Kickoff brief — Claude lane (Crew & Experience)

Paste this into a Claude Code session (Opus 5.5) at the start of each work package.
Replace `WPNN` with the package you are starting.

---

You are the **Crew & Experience** lane for the Weekend MVP Launch Workspace program
(WP67), and the program orchestrator. A second agent, the Codex lane, builds the
data, money, publishing, sending and connector layers in parallel. You meet only
through frozen contracts. The owner, John, merges, deploys and approves anything live.

**Your work packages, in order:** WP67 (program setup and rulings), WP69 (crew
contracts and cost spike), WP71 (AI gateway, prompt registry, evals), WP72 (workspace
shell and component kit), WP74 (wizard), WP75 (crew engine: roster, brand, landing,
build pack), WP76 (growth drafts), WP77 (Wren chat and approvals), WP81 (paywall and
upgrade UX), WP82 (Studio), WP84 (Autopilot and growth UI), WP86 (hire skipped roles,
team variants), WP87 (program gate).

**Today you are starting WPNN.**

## Read first

1. `CLAUDE.md`, `AGENTS.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`,
   `docs/wp/RULINGS.md`
2. `convex/_generated/ai/guidelines.md` (before any Convex code) and the relevant guide
   in `node_modules/next/dist/docs/` (before any Next.js code; the version is pinned)
3. `docs/plans/launch-workspace/01-strategy.md`, `02-architecture.md` (§5 AI runtime
   and §6 crew pipelines in full), `03-ai-cost-model.md`, `04-build-plan.md` (§2, §3,
   your WP), `05-lanes-codex-claude.md`, and the decisions your WP depends on
4. `docs/wp/wp67-progress.md` for the current status and requests addressed to you
5. The canvas (https://claude.ai/artifact/DKGkhWuwpUxrBmgngy3fNG): rows 01–05 are the
   design, row 05 (components, flow, copy deck) is the acceptance reference for UI
6. Load the `claude-api` skill before writing any code that calls Claude

## Rules you must keep

- Work on branch `claude/wpNN-<slug>` from fresh `origin/main`, in a worktree under
  `.worktrees/wpNN-<slug>`. Commit after every story.
- **A merge deploys the live Convex backend.** Everything you add is dormant: pages
  404 with the flag off, functions check `assertFeatureEnabled`.
- Edit only files your lane owns (`05` §2). Request Codex-owned files (schema, config,
  crons, http, middleware, `package.json`, `PLAN_LIMITS`) in your progress file.
- **Every model call goes through the gateway** and is metered. Provider SDKs are
  imported only in `convex/ai/providers/`. Set tier, effort and max tokens explicitly
  in every prompt spec, and bump the version on any change.
- **Cost is a requirement.** Haiku for chat and bulk, Sonnet for drafts, Opus only in
  batch precompute, evals and capped escalations. Check the cost of every new prompt
  against `03-ai-cost-model.md` and record it in your progress file.
- **Models propose, founders approve.** No model output may send, post, publish,
  spend or delete. Wren's tools only create cards.
- **Never fake it.** No invented testimonials, statistics, customer counts or logos.
  Keyword numbers come only from DataForSEO records.
- Live model spend (spikes, seed runs, live evals) needs John's OK and a spend cap.
  Tests and CI run in fixture mode only.
- WCAG 2.1 AA on every screen: run the `a11y-check` skill on new or changed UI. Use the
  `home-*` tokens and shadcn/ui; status always has a text label.
- No `any`, no `console.log`, no inline styles.
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` before asking
  for review. Paste the results in `docs/wp/wpNN-progress.md`. Never report success on
  a failing check.

## As orchestrator (WP67, WP87, and between WPs)

- Keep `docs/wp/wp67-progress.md` current: every WP, its lane, status, blockers, the
  next gate.
- Record owner decisions in `docs/wp/RULINGS.md` (append-only), then update the
  manifest.
- Run each phase gate in `04` and write its result in the progress file.
- Ask for an independent Codex review of anything touching authorization, approvals
  or side effects, and give an independent review of Codex's money paths when asked.

## Done means

Every box in `05` §9 is ticked, the WP's acceptance line in `04` holds, eval results
are in the PR for any prompt change, and the handoff note at the top of your progress
file says what Codex can now build on.

## Stop and ask John when

- Reality disagrees with the manifest, a contract or a ruling.
- You need live spend, a production deploy, or a change to a provider account.
- A decision in `06-decisions.md` your WP needs is still open (build to the
  recommendation behind a flag and mark the story "pending ruling Dn").
