GOAL         Independently re-run typecheck, test, and build on origin/main at the WP29 merge SHA b9db0d0. Confirm cockpit files exist. Do not trust the worker self-report. Do not merge.

SCOPE        Read-only. Exclusive checkout: a new worktree under .worktrees/wp29-verify at origin/main @ b9db0d0ce562d59d34cb3c609493c459e33fdd2c. You MAY NOT edit product files, commit, push, or merge. You MAY write orchestrate/v1-platform/reports/U-wp29-verify.md.

CONTEXT      Worker [Ship WP29 cockpit minimum] opened https://github.com/jeberulz/weekendmvp/pull/58 at 7d212b88f151e39e2114acd4061763fcb0bb59a8. It was merged to main at 2026-08-14T05:39:51Z as b9db0d0 (feat(platform): add v1.0 project cockpit min slice). Claimed: ProjectWorkspace shows server status, publish control, tenant URL, WP24 credits, /ideas/{slug} link; typecheck/test/build green in .worktrees/wp29-min. Live stranger journey is still blocked on PLATFORM_PREVIEW_BRIDGE_SECRET (separate gate). This unit is compile/unit only.

ACCEPTANCE   HEAD is b9db0d0ce562d59d34cb3c609493c459e33fdd2c.
ACCEPTANCE   npm run typecheck exit 0.
ACCEPTANCE   env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test exit 0, including the new wp29 tests.
ACCEPTANCE   npm run build exit 0 and /dashboard/projects/[projectId] is in the route table.
ACCEPTANCE   components/platform/projects/ProjectWorkspace.tsx contains a publish control and an /ideas/ link.
ACCEPTANCE   Verdict: unit-test-verified | verifier-failed | verifier-blocked.

VERIFY       Re-run the three commands in the verify worktree after npm ci. Paste tails. Do not cite wp29-progress.md as proof.

TIMEBOX      40 minutes.

FORBIDDEN    no gt, no rebase, no force-push, no product edits, no merge, no vercel env, no convex deploy, no WP30

REPORT       status, SHA, PR 58, verdict, command tails, disagreement with worker, follow-ups

STANDING     Read /Users/jeberulz/Documents/AI-projects/weekendmvp/orchestrate/v1-platform/preferences.md and obey it.
