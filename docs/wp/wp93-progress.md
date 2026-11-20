# WP93 Progress - AI cost console

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-20 - Setup

- Branch/worktree: `claude/wp93-ai-cost-console` in the Claude Code worktree `.claude/worktrees/ai-cost-console-6d447c` (created by the app, not by this WP).
- Assignment: owner-only AI cost console at `/admin/ai` (Phase 1 build, Phase 2 write-up). Started from another session's brief.
- Number: WP93 is the first number used nowhere on `main` or a remote branch (highest in use WP92; WP67–WP87 reserved by D14).
- File boundaries: new `convex/admin/aiCosts.ts`, `lib/admin/ai-costs/**`, `app/admin/ai/**`, `components/admin/ai-costs/**`, their tests, and these docs. Read only against `convex/schema*`, `convex/crons.ts`, http and `middleware.ts` (Codex-owned).
- Read first: `CLAUDE.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, `docs/wp/RULINGS.md` (WP38, D3, D22, WP70 shutdown monitoring), `convex/_generated/ai/guidelines.md`, `convex/schema/ai.ts`, `convex/ai/metering.ts`, `convex/ai/pricing.ts`, `lib/workspace/contracts/metering.ts`, `convex/ops/settings.ts`, `convex/ops/spend.ts`, `convex/admin/superAdmin.ts`, `app/admin/editorial/layout.tsx`, `lib/editorial/runtime/workspace.ts`, `middleware.ts`.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; a11y-check on every new screen.
- Initial risks:
  - `ai_usage` has no `createdAt`-only index. The built-in `by_creation_time` index is used for range reads (rows are inserted with `createdAt = Date.now()` in the same mutation, so the two agree to the millisecond).
  - No rollup table: reads are bounded and the UI says when a range is cut off (Codex need 1).
  - `errorDetail` exists only on `idea_seed_items`, not on `ai_usage`.
  - Thinking tokens are not stored apart from output.
