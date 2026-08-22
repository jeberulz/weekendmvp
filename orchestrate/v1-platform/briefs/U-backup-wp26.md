GOAL         Push local WP26 S2-S4 commits to origin as a backup branch so they cannot die with the worktree. Then stash dirty main working-tree files onto a content WIP branch.

SCOPE        git refs only. May create and push `codex/wp26-v1.1-engine` from local `codex/wp26-research-workflow` (worktree `.worktrees/wp26-research-workflow`). May create `wip/main-dirty-2026-08-14` from current main dirty files (calendar.csv, week-05.md, scripts/seed-convex.mjs) and commit them there so main is clean. May not edit platform product code. May not implement S5. Exclusive to this machine.

CONTEXT      Local wp26 is c99351b, 3 commits ahead of origin/codex/wp26-research-workflow @ 5f29557 (S2, S3, S4). Those commits are not in origin/codex/wp28-tenant-hosts. Main checkout de8b495 has uncommitted content files. Repo /Users/jeberulz/Documents/AI-projects/weekendmvp

ACCEPTANCE   origin/codex/wp26-v1.1-engine exists and points at c99351b (or the worktree HEAD if it moved).
ACCEPTANCE   git ls-remote shows the backup SHA.
ACCEPTANCE   main working tree no longer has those three dirty files, or they live only on wip/main-dirty-2026-08-14.
ACCEPTANCE   No force-push. No deletion of the wp26 worktree.

VERIFY       git ls-remote origin refs/heads/codex/wp26-v1.1-engine; git status -sb on main; git log -3 --oneline origin/codex/wp26-v1.1-engine

TIMEBOX      15 minutes. On expiry, report what was pushed.

FORBIDDEN    no gt, no rebase, no force-push, no WP26-S5, no worktree remove, no merge to main

REPORT       status, branch, head SHA, PRs, verdict, what you actually ran, deviations, suggested follow-ups

STANDING
1. Never force-push shared branches. Never production deploy. Never live Stripe. Never wildcard DNS. Never store real tenant leads.
2. One writer per branch. The brief names the exclusive branch. Do not push to a sibling unit's branch.
3. Feature workers never rebase and never run gt. Only the stacker unit U-land-stacker may merge origin/main into the integration branch.
4. Stay inside the brief's path allowlist. If you need a product ruling, stop and report. Do not invent policy copy, prices, or homepage replacement.
5. Do not resume worktrees wp23, wp24, wp25, or wp38. Do not implement WP26-S5 or S6.
6. v1.0 is the repository-idea journey only. WP26 S2-S6 is v1.1. Out of scope except the backup push.
7. Required checks: npm run typecheck, npm test, npm run build. Behavioral units need a stranger-journey proof, not typecheck-only.
8. Treat docs/wp/wp*-progress.md as claims. Re-run the check. Record the SHA and the command.
9. Do not edit content MDX or ideas/manifest.json unless the brief names those files.
10. Do not merge PRs. Do not close someone else's PR. Push the branch. Open the PR if the brief says so.
11. U-land-stacker is the stacker for stack v1-platform until a later stacker unit replaces it.
12. Push before returning. Work that exists only on one VM is not done.
13. Next product WP numbers are 29, 30, 38-min, then 31. Do not reuse 19. Main already used WP19 for tagging.
14. Magic-link signup may fail on preview without Resend. Use existing platform test helpers and the WP23-S6 / WP27-S6 recorded path. Do not enable Google OAuth.
15. Stop line: if origin/main rebase produces an unresolvable auth or schema conflict, return partial findings. Do not delete platform tables to make it compile.
