# WP46 Progress - PR #71 idea-engine remediation

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-01 - Setup (WP46-S0)

- Branch/worktree: `claude/wp46-pr71-remediation` in `.worktrees/wp46-pr71-remediation`, created from `origin/cursor/phase-7-skill-flip-d6b7` at `1c7240bdd30a4f6dff5d02eeab6d95fb36fc48df`. Upstream tracking removed so a bare `git push` cannot reach the PR branch.
- Assignment: implement `docs/plans/idea-engine/pr71-remediation-plan.md` (copied unchanged from the Codex review worktree, with the review it cites) using Claude Opus 5.5 workers under an orchestrator.
- PR #71 state (GitHub, 2026-10-01): head `1c7240bdd30a4f6dff5d02eeab6d95fb36fc48df`, base `7c4fdc3a4493a4a0e1452236912dca561fad0d6d` (`main`), open, mergeable.
- Reconciliation: the head moved one commit past the reviewed `b258ebb`. `1c7240b` makes `htmlToText` break lines at closing `tr`, `li`, `p`, `div` and at `br`, with a test. It narrows the F5 cross-row price mix-up but keeps numeric-membership grounding, so F5 stays open. F1–F4, F6 and F7 are untouched by it.
- WP number: WP45 is in progress on `codex/wp45-idea-engine-completion` (PR #83, branched from `85d1db4`, not merged into PR #71). WP46 is the next free number on every branch. WP45 files and branch are not touched.
- File boundaries and contract: `docs/plans/idea-engine/pr71-evidence-contract.md` and `lib/engine/evidence/contract.ts` (types only).
- Required checks: per story, targeted tests plus `npm run typecheck`; final gate per plan §11.
- Initial risks: live sources may block reads (fail closed, reported honestly); the extra extraction call must stay inside the $4 cap; F3 must not mutate production data; PR #83 overlap needs an owner decision.
- Docs: this log, `docs/wp/wp46-stories.md`, the contract, the WP46 registry row.

## 2026-10-01 - Baseline gate (WP46-S0)

- Revision: `bd3ed53` (PR head `1c7240b` plus WP46 docs and the types-only contract file). Node v22.23.1. Logs kept outside the repo; results below.
- `npm run typecheck` 0 · `npm run lint` 0 (0 errors, 35 warnings) · `npm test` 0 · `npm run validate:idea-tags` 0 · `npm run engine:eval` 0 (3/3 legacy gold pages) · `npm run build` 0 · `npm run check:server-traces` 0 · `npm audit --omit=dev --audit-level=high` 0 (0 vulnerabilities) · `git diff --check` 0.
- `git diff --check origin/main...HEAD` exit 2: trailing whitespace at `artifacts/quote-gate-live-verification.md:3-4` (pre-existing in the PR, as the review reported).
- Test totals measured per suite: og 91, links 6, redirects 38 + 76, auth 85, security 82 + 84, sitemap 7, convex 372, engine 109, home 34, platform 218 — **1,202 total**. The review reports 1,301 (108 engine) for `b258ebb`; engine differs by the one test `1c7240b` added, the other ~100 are unexplained by the code delta and are probably a counting difference. WP46 compares against the measured 1,202.
- Workers launched (Opus 5.5, separate worktrees from `bd3ed53`): T `claude/wp46-transport` (S1), D `claude/wp46-evidence-core` (S2), K `claude/wp46-catalogue` (S5).
