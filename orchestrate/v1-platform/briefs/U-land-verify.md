GOAL         Independently verify PR 56 at SHA 1386262. Confirm both ancestries, required checks, F2/F3, v1-cut ruling row, and /build/[slug] in the production build. Do not trust the stacker's self-report.

SCOPE        Read and re-run checks only. Exclusive checkout feat/platform-wp19-28-onto-main at 1386262af39454125c59ef444ce7de976a4c9b18. You MAY NOT edit files, open commits, push, or merge. If a check is red, report the failure. Do not fix it.

CONTEXT      PR https://github.com/jeberulz/weekendmvp/pull/56. Worker claimed: merge of origin/main (live 4ee44b2, not the brief's de8b495) into origin/codex/wp28-tenant-hosts; conflicts only ci.yml and RULINGS.md; F2 strip-types + engines >=22.6 + nanoid 3.3.18; npm test only passes with RECRAFT_* unset; audit high clean; quality CI already SUCCESS on GitHub. Ancestor must include origin/codex/wp28-tenant-hosts and origin/main.

ACCEPTANCE   git merge-base --is-ancestor origin/codex/wp28-tenant-hosts HEAD is true.
ACCEPTANCE   git merge-base --is-ancestor origin/main HEAD is true.
ACCEPTANCE   HEAD is 1386262af39454125c59ef444ce7de976a4c9b18.
ACCEPTANCE   npm run typecheck exit 0.
ACCEPTANCE   env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test exit 0, including test:security.
ACCEPTANCE   npm run build exit 0 and the route table includes /build/[slug] and /preview/[token].
ACCEPTANCE   npm audit --omit=dev --audit-level=high exit 0.
ACCEPTANCE   RULINGS.md contains a 2026-08-14 row adopting v1-scope-cut.md.
ACCEPTANCE   Verdict is one of: unit-test-verified (checks green, no live UI), verifier-failed, verifier-blocked.

VERIFY       Re-run the four commands above. Paste tails and exit codes. Do not cite WP28 progress files.

TIMEBOX      45 minutes.

FORBIDDEN    no gt, no rebase, no force-push, no file edits, no merge, no WP29, no production deploy

REPORT       status, branch, head SHA, PR, verdict (unit-test-verified|verifier-failed|verifier-blocked), commands and exit codes, any disagreement with the worker report, suggested follow-ups

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
