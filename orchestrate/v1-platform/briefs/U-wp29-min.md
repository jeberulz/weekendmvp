GOAL         Ship the v1.0 project cockpit minimum: status, publish action, tenant URL, credit balance, and a link back to /ideas/{slug}. Freeze docs/wp/wp29-stories.md first. Open a PR off origin/main.

SCOPE        Exclusive branch feat/wp29-min from origin/main @ 80d6f27. Worktree only under .worktrees/wp29-min. You MAY write: docs/wp/wp29-stories.md, docs/wp/wp29-progress.md, app/dashboard/projects/**, components/platform/projects/**, convex/platform/projects.ts and sibling project/site/credit query files already owned by those modules, plus tests next to them. You MAY NOT write: content/**, ideas/manifest.json, articles/manifest.json, proxy.ts/middleware.ts, convex/schema.ts, Stripe routes, WP26 engine, WP30 policy copy, homepage. Do not resume worktrees wp23/24/25/26/38.

CONTEXT      origin/main already has ProjectWorkspace.tsx. It is brief-centric (draft/confirmed, beginRevision). v1.0 min from docs/wp/v1-scope-cut.md: cockpit shows live status from the server, a publish action, the tenant URL if published, credit balance, and a link to canonical /ideas/{slug} for repository projects. Full WP29 (revision tasks, artifact browser, refund UX) is out. Sibling U-e2e-verify is reading production; do not touch origin/main. Cloud agents are broken (environment.json ports); you are local. Base SHA 80d6f27fa6bfee1bd9150e07a11fba699e8d8377.

ACCEPTANCE   docs/wp/wp29-stories.md exists and lists only the v1.0 min slice; S-numbers do not invent deferred revision/refund stories as in-scope.
ACCEPTANCE   Signed-in /dashboard/projects/[projectId] shows server-derived status (not a client claim).
ACCEPTANCE   Publish control is present for a claimable/publishable repository project; disabled/error states are labeled.
ACCEPTANCE   After a successful publish (or when a site record exists), the tenant URL is visible. Do not activate wildcard DNS.
ACCEPTANCE   Credit balance is visible (existing WP24 query; do not change ledger math).
ACCEPTANCE   Repository projects link to /ideas/{sourceSlug}.
ACCEPTANCE   npm run typecheck, env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test, npm run build all exit 0.
ACCEPTANCE   Branch pushed. PR opened against main. You do not merge.

VERIFY       In the worktree: npm run typecheck; env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test; npm run build. Paste tails. Do not cite a progress file as proof.

TIMEBOX      75 minutes. On expiry, push whatever compiled and return partial findings.

FORBIDDEN    no gt, no rebase, no force-push, no merge, no schema.ts edits, no live Stripe, no wildcard DNS, no WP26-S5/S6, no Google OAuth, no content MDX, no squash

REPORT       status, branch, head SHA, PR URL, files changed, verify tails, deviations, suggested follow-ups

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
16. Never squash-merge a platform stack onto main. PR 56 squash dropped wp28 ancestry. Do not run git merge -s ours unless a later brief names it.
17. Cloud Agent environment.json ports must be objects, not numbers. This unit is local because of that.
