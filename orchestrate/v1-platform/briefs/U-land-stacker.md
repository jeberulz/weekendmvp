GOAL         Get the build-platform stack onto current main as one open PR whose required checks pass, so a preview can run the repository-idea journey.

SCOPE        Exclusive branch `feat/platform-wp19-28-onto-main` created from `origin/codex/wp28-tenant-hosts` (d3ae862, same as origin/cursor/platform-consolidation-wp28-cea8). You MAY merge (not rebase) `origin/main` into that branch and resolve conflicts. You MAY fix F2/F3 only: `test:security` failing to load on Node 22.14 (add --experimental-strip-types or pin engines to >=22.6 and CI Node 22.x), and npm audit high `nanoid` GHSA-2v37-7h3g-55p8 / related postcss bump. You MAY append one RULINGS.md row adopting docs/wp/v1-scope-cut.md (owner: user 2026-08-14 "go ahead" on the v1 cut). You MAY patch AGENT_HANDOFF.md HEAD to the new SHA and remove the false "draft PR open" / "pick WP26 next" lines. You MAY NOT implement WP29/30/31/38. You MAY NOT production deploy. You MAY NOT merge the PR.

CONTEXT      Repo jeberulz/weekendmvp. Main is de8b495, 7 content/CI commits past merge-base d7a5dd7 (Feat/publish five ideas #44). Stack is 56 commits. Known collision: main PR #46 rewrote ci.yml; WP20 on the stack has its own CI. Prefer the stack's WP20 checks plus the required .agentic-workflow.yml set (typecheck, test, build). Do not resurrect check:links. Open PRs #41 and #45 collide with program seams; do not touch them. Local wp26 S2-S4 is a fork; do not merge it. Docs: docs/wp/v1-scope-cut.md, docs/wp/program-manifest.md, docs/wp/program-review-2026-08-12.md on origin/cursor/program-status-review-7265, docs/wp/AGENT_HANDOFF.md. Convex guidelines: convex/_generated/ai/guidelines.md. Four components on this stack link to /build/{slug}; keeping WP27 in the merge is mandatory.

ACCEPTANCE   Branch feat/platform-wp19-28-onto-main exists on origin.
ACCEPTANCE   It contains origin/codex/wp28-tenant-hosts history and origin/main history (merge commit is fine).
ACCEPTANCE   npm run typecheck passes.
ACCEPTANCE   npm test passes, including security suites that previously failed to load.
ACCEPTANCE   npm run build passes.
ACCEPTANCE   npm audit --omit=dev --audit-level=high is clean or the remaining findings are documented as pre-existing and not auth-path.
ACCEPTANCE   gh pr create against main is open. Do not merge it.
ACCEPTANCE   RULINGS.md has the v1-cut adopt row.

VERIFY       npm run typecheck && npm test && npm run build. Paste the tail of each. gh pr view --json url,number,headRefOid. Do not claim green from a prior WP28 progress file.

TIMEBOX      90 minutes. On expiry, push whatever compiles and report remaining conflicts by file.

FORBIDDEN    no gt, no force-push, no rebase of shared branches (merge origin/main into your exclusive branch is required and allowed), no WP26-S5, no production deploy, no live Stripe, no DNS, no merging the PR, no editing #41/#45

REPORT       status, branch, head SHA, PR URL and number, verdict, exact commands run and their exit codes, conflict files and how you resolved them, deviations, suggested follow-ups

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
