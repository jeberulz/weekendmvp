# WP78 Progress — Publishing un-park

Append-only progress log. Claims must cite checks or code evidence.

## 2026-11-06 — Setup

- Branch/worktree: `codex/wp78-publishing` / `.worktrees/wp78-publishing`, from `origin/main` `d8055b98` after G1 passed.
- Assignment: WP78-S1–S5 per `04-build-plan.md` and owner rulings D2/D5.
- File boundaries: in `wp78-stories.md`; WP79 owns shared cron/http/env files for this phase.
- Required checks: typecheck, lint, test, build, targeted security tests, independent Claude review, `git diff --check`.
- Initial risks: C-APPROVAL and Claude policy prompt are not on main yet; wildcard DNS and Global Config provider setup need owner action; real leads remain synthetic-only until D5 controls ship together; no live activation or production deployment authorized.
- Needs from other lane: WP77 must merge C-APPROVAL fixture/contract and WP75 or gateway owner must merge policy prompt contract before WP78-S1 can enable publish. Claude reviews publishing and takedown before merge.
