GOAL         Prove the repository-idea stranger journey on production www.weekendmvp.app at SHA 80d6f27. Write a live-ui-verified|verifier-failed|verifier-blocked verdict with screenshots of how far a stranger gets. Do not trust the unit-test ledger.

SCOPE        Read-only. Browser + HTTP probes against production only. You MAY NOT edit files, commit, push, merge, run convex deploy, enable Google OAuth, complete a live Stripe charge, or store real tenant leads. Exclusive surface: https://www.weekendmvp.app (not localhost; local main is still 4ee44b2).

CONTEXT      PR 56 squash-merged to origin/main @ 80d6f27fa6bfee1bd9150e07a11fba699e8d8377. Vercel Production deploy succeeded (https://vercel.com/john-iseghohis-projects/weekendmvp/73kwZMu3hUWSqhTAMnD7QiE1X2La). HTTP already: GET /build/healthsync → 200 x-matched-path /build/[slug]; GET /dashboard → 307 /signin; GET /ideas/abandoned-cart-recovery exists on sitemap. Ledger has unit-test-verified for 1386262 only. WP31 wildcard DNS and live Stripe are out of scope; tenant host may not resolve. Magic-link may fail without Resend. Convex prod schema is unknown (local convex MCP is down). If generate fails, capture the network/Convex error; do not deploy.

ACCEPTANCE   Open https://www.weekendmvp.app/ideas/abandoned-cart-recovery (or another sitemap idea if that 404s).
ACCEPTANCE   Click through to /build/{slug}. Page is the build UI, not a marketing 404.
ACCEPTANCE   Generate an anonymous preview. /preview/{token} renders the idea site (or record the exact failure).
ACCEPTANCE   Attempt signup/signin. Do not enable Google OAuth. If magic-link does not arrive, stop and call verifier-blocked with the last working step.
ACCEPTANCE   If signed in: claim the preview into a project. Do not use a real customer email.
ACCEPTANCE   Credits: use test-mode only. If checkout is live Stripe, STOP without paying and report.
ACCEPTANCE   Attempt publish as far as WP28 allows. If {project}.weekendmvp.app does not resolve, that is a WP31 DNS gap, not a product-code fail, as long as the app returned a tenant URL or a clear publish error.
ACCEPTANCE   Verdict is live-ui-verified only if idea → build → preview render succeeded AND (claim succeeded OR magic-link blocked with proof). Otherwise verifier-failed (product/Convex) or verifier-blocked (auth/env).
ACCEPTANCE   Save a report at orchestrate/v1-platform/reports/U-e2e-verify.md with URLs, HTTP codes, screenshots or browser refs, and the first blocking step.

VERIFY       cursor-ide-browser against www.weekendmvp.app. curl -sI for /ideas/{slug}, /build/{slug}, /preview/{token}, /signin, /dashboard. Do not cite wp*-progress.md.

TIMEBOX      40 minutes. On expiry, return partial findings and stop.

FORBIDDEN    no gt, no rebase, no force-push, no file edits except the report path above, no merge, no convex deploy, no live Stripe, no Google OAuth, no real tenant leads, no localhost, no WP29 implementation

REPORT       status, production SHA 80d6f27, verdict, journey table (step, URL, HTTP, result), first blocker, Convex/auth/DNS notes, suggested follow-ups

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
