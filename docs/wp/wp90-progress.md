# WP90 Progress — Roster per idea

## 2026-11-07

- Branch: `claude/roster-per-idea-plan` (worktree `.claude/worktrees/wp67-employee-pages-5df33e`), on top of
  WP67 (#275).
- Commits: S1 `8e573dab`, S2 `61064218`, S3+S4 `3ffee6e5`, S5 `de78c429`, docs (this commit).
- Prompt lock: wren-chat@4, wren-plan-turn@4, crew-blueprint-personalise@2, crew-blueprint-own-idea@2,
  crew-brand-kit@2, crew-email-sequence@2, crew-social-pack@2 locked; the old versions are retired with notes.
  The brand, email and social bumps are forced by the lock hashing imported modules (`artifacts.ts`,
  `roster.ts`); their text is unchanged.
- Codex-owned files: only the approved `@1`→`@2` ref strings in `convex/growth/drafts/emailSequence.test.ts`
  and `socialPack.test.ts` (John approved, 2026-11-07). Nothing else under the Codex list was edited.
- Decisions made while building:
  - The fixture classifier uses keywords and defaults to consumer app (no hash), so the result is easy to
    predict in tests.
  - The model-facing blueprint schema (v2) requires `team`; the stored schema keeps it optional, so older
    blueprints and the rule fallback still work.
  - `convex/crew/launchRoster.ts` needed no change: `rosterInputFromWizard` passes the cleaned proposal.
- Docs updated: this file, `wp90-stories.md`, `roster-per-idea/PLAN.md` status.
- Not done: S2b (image spend) and S6 (live spend) wait for John's OK.
- Review fix (Codex P1 on #279): plans stored under the pre-WP90 rules version `2026-11-05.1` marked eight roles
  always, so checking them against the new four-role core would have hidden an existing business's team.
  `rosterPlanSchema` now checks each plan against the always set of its own rules version
  (`alwaysRoleKeysFor`, `LEGACY_ROSTER_RULES_VERSIONS`). Regression tests: schema cases plus a launch whose
  stored plan is rewritten to the legacy shape still reads as ready. The branch's new prompt versions were
  relocked (they hash `roster.ts`; none is on main yet).
