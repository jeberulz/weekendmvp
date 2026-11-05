# WP68 Progress - Data contract and ops switches

Append-only progress log. Do not rely on chat history for project state.

## Handoff

Pending. This work package is dormant and has not been reviewed or merged.

## Needs from the other lane

- Claude: review C-DATA after S1 and S2 and review C-AUTHZ/C-OPS before merge.

## 2026-11-05 - Setup

- Branch/worktree: `codex/wp68-data-contract` in `.worktrees/wp68-data-contract`, from `origin/main` at `68aa05c5`.
- Assignment: WP68, Work Package lane, Phase 0. Story order S7, S1, S2, then S3–S5, then S6.
- File boundaries: `convex/schema*`, `convex/platform/validators.ts`, `convex/platform/authz.ts`, `convex/ops/settings.ts`, `convex/growth/connectors/types.ts`, package files, and new tests.
- Required checks: typecheck, lint, full test, build, schema diff, safe dev Convex deployment, `git diff --check`.
- Initial risks: merges deploy production Convex; new env entries must be optional; table validators must stay flat; all new functionality is off by default. The main checkout has unrelated uncommitted work and stays untouched.
- Inventory note: architecture §2 says `@convex-dev/workpool` is installed, but `origin/main`'s `package.json` does not list it. WP70 explicitly mounts it. No WP68 scope change is made here.
