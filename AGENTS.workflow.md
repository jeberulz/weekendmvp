# Agentic Delivery Workflow

This project uses a branch-first, story-driven workflow for coding agents.

## Lanes

- **Program/Migration**: large migrations, multi-WP programs, broad refactors, production data, schema changes, cross-cutting architecture work. Audit first and freeze `docs/wp/program-manifest.md` before implementation.
- **Work Package**: features, multi-file work, product behavior, shared logic, schema/auth/payment/publishing/prompt/UI-flow changes.
- **Small Fix**: at most 2 files, no product decision, no shared contracts, no schema/auth/payment/publishing/prompt/dependency/migration/UX redesign.
- **Gate**: verification only; report failures and create scoped fixes.

## Required Order

1. Read project truth docs listed in `.agentic-workflow.yml`.
2. Choose a lane.
3. Create/switch to a branch before editing files.
4. For Program/Migration work, audit first and commit `docs/wp/program-manifest.md` before implementation.
5. For Work Packages, create/update `docs/wp/wpNN-stories.md` and `docs/wp/wpNN-progress.md` before code.
6. Implement one story or manifest slice at a time.
7. Run required checks.
8. Update progress, manifest, rulings, gate reports, and docs.
9. Summarize verification honestly.

## Program/Migration

- Start with audit sessions that write manifest entries; do not implement during audit.
- Treat `docs/wp/program-manifest.md` as source of truth after it is committed.
- Workers may not re-scope manifest entries. If reality disagrees with the manifest, stop and escalate.
- Sequence waves by risk: reversible work first, production data/schema/irreversible cleanup late.
- Gate every wave and record evidence in `docs/wp/wave-gate-report.md`.
- Track sessions in `docs/wp/session-ledger.md` when practical.
- For irreversible work, use `docs/wp/backup-restore.md`: restore marker, backup inventory, dry-run inventory, owner approval, execution evidence, post-run verification.

## Worktrees

- Default: do not use a worktree.
- Use worktrees only for parallel work packages, gate runs, or risky isolated experiments.
- Worktrees must be inside `.worktrees/`.
- Never create sibling folders beside the repo.
- Clean up with `git worktree remove` and `git worktree prune`.

## Orchestration

- Default: use one agent.
- Use sub-agents for parallel work packages, independent review, gate runs, or context isolation.
- Orchestrator plans, assigns file boundaries, records rulings, chooses model tiers, and does not write feature code.
- Workers own one WP/story and must not expand scope or make product rulings.
- Reviewers lead with correctness findings.
- Gate runners verify only and report scoped failures.

## Model Routing

- High/top model: orchestrator, architecture, security/auth/payments/publishing, production data, migrations, AI/prompt behavior, final review.
- Mid model: standard WPs with clear stories, focused UI, tests, documented integrations, contained refactors.
- Low/fast model: story scaffolding, inventories, docs cleanup, running checks, mechanical lint fixes.
- Escalate one tier when scope becomes ambiguous, risk increases, product decisions are needed, or a worker repeatedly fails.

## Unknowns

If product behavior, scope, file ownership, or irreversible work is unclear, stop and ask. Record final rulings in `docs/wp/RULINGS.md`.

## Docs

Any change to architecture, conventions, schema, commands, env vars, workflow, design rules, or user-visible behavior must update the relevant docs in the same PR. Otherwise state why docs were not needed.
