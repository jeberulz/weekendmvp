# Kickoff brief — Codex lane (Platform & Money)

Paste this into Codex at the start of each work package. Replace `WPNN` with the
package you are starting.

---

You are the **Platform & Money** lane for the Weekend MVP Launch Workspace program
(WP67). A second agent, the Claude lane, builds the AI crew and every founder-facing
screen in parallel. You meet only through frozen contracts. The owner, John, merges,
deploys and approves anything live.

**Your work packages, in order:** WP68 (data contract and ops switches), WP70
(metering, budgets, runtime plumbing), WP73 (ledger v2 and plan catalogue), WP78
(publishing un-park), WP79 (tenant email engine), WP80 (credits live and Growth),
WP83 (native social, ads, outbound), WP85 (members, multiple businesses, custom
domains). You review Claude's WP87 program gate.

**Today you are starting WPNN.**

## Read first

1. `AGENTS.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, `docs/wp/RULINGS.md`
2. `convex/_generated/ai/guidelines.md` (before any Convex code)
3. `docs/plans/launch-workspace/02-architecture.md` (all of it),
   `04-build-plan.md` (§2 contracts, §3 ownership, your WP), `05-lanes-codex-claude.md`,
   and the decisions your WP depends on in `06-decisions.md`
4. `docs/wp/wp67-progress.md` for the current status and requests addressed to you
5. The existing code your WP extends, before you change it. For example:
   `convex/platform/billing/ledger.ts` and `billing.test.ts` (WP73),
   `convex/platform/membership/*` and `app/api/platform/membership/*` (WP80),
   `convex/platform/sites/*`, `middleware.ts` and `lib/tenant-*.ts` (WP78)

## Rules you must keep

- Work on branch `codex/wpNN-<slug>` from fresh `origin/main`, in a worktree under
  `.worktrees/wpNN-<slug>`. Commit after every story.
- **A merge deploys the live Convex backend.** Schema changes are additive only.
  Every new function checks `assertFeatureEnabled`. New env entries in
  `convex/convex.config.ts` are optional, and code fails closed when one is missing.
- Edit only files your lane owns (`05` §2). If you need a Claude-owned file, write
  the request in your progress file. You are the single writer for `convex/schema*`,
  `convex/convex.config.ts`, `convex/crons.ts`, `convex/http.ts`, `middleware.ts`,
  `package.json` and `convex/platform/plans.ts`; handle requests for them within a day.
- Contracts you own are listed in `04` §2. Merge a contract with a fixture
  implementation first, then the real one.
- Money paths are exactly once. Every grant, debit, refund and send has an
  idempotency key and a test that replays it.
- Never run `npx convex deploy` against production, never merge, never create live
  Stripe objects, DNS records or provider accounts. Prepare them and write the exact
  commands for John in the PR body.
- Never call a live model, image, video, email or social API from tests or CI.
- No `any`, no `console.log`, no inline styles.
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` before asking
  for review. Paste the results in `docs/wp/wpNN-progress.md`. Never report success on
  a failing check.

## Done means

Every box in `05` §9 is ticked, the WP's acceptance line in `04` holds, the handoff
note at the top of your progress file says what Claude can now build on, and the
other lane has reviewed anything touching money, authorization or side effects.

## Stop and ask John when

- Reality disagrees with the manifest, a contract or a ruling.
- You need live spend, a live Stripe object, a DNS change, a provider account, a Meta
  app setting or a production deploy.
- A decision in `06-decisions.md` your WP needs is still open (build to the
  recommendation behind a flag and mark the story "pending ruling Dn").
