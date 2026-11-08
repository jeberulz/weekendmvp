# WP91 Progress — Roster per idea

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
- Docs updated: this file, `wp91-stories.md`, `roster-per-idea/PLAN.md` status.
- Not done: S2b (image spend) and S6 (live spend) wait for John's OK.
- Review fix (Codex P1 on #279): plans stored under the pre-WP91 rules versions (`2026-11-05.1` and main's `2026-11-07.1`) marked eight roles
  always, so checking them against the new four-role core would have hidden an existing business's team.
  `rosterPlanSchema` now checks each plan against the always set of its own rules version
  (`alwaysRoleKeysFor`, `LEGACY_ROSTER_RULES_VERSIONS`). Regression tests: schema cases plus a launch whose
  stored plan is rewritten to the legacy shape still reads as ready. The branch's new prompt versions were
  relocked (they hash `roster.ts`; none is on main yet).

## 2026-11-08 — merge with main (#278, WP90 research-driven seeds)

- This work was WP90 on the branch; main's #278 took WP90, so it is renumbered WP91 (stories, progress,
  plan status, comments). Main's WP90 docs are kept as they are.
- Prompts: #278 locked the blueprint, brand-kit, email and social prompts at @2, so this branch's versions
  became @3 (blueprint v3 = WP90's v2 text plus the team rules; the others' text is unchanged).
  `crew-idea-seed` went to @2 because it imports `contracts/wizard.ts` and `roster.ts`, which changed
  (text unchanged). The @2 versions and `crew-idea-seed@1` are retired with notes. The growth tests' ref
  strings moved to @3 (the same string-only edit John approved).
- Roster: rules version `2026-11-08.1`; main's `2026-11-07.1` (eight always-hired roles) is treated as
  legacy alongside `2026-11-05.1`. Main's `sellsGoods` (local business that sells goods → Merch) and the
  local-business SEO and Merch reasons are kept.
- `normaliseTeamProposal` (zod-only structural cleaning) moved into `contracts/roster.ts` so the prompt
  import graph stays plain-Node loadable; `cleanTeamProposal` wraps it with the content checks the quality
  gate runs.
- Wizard: the stored-seed path (`seedFromStored`) also suggests the session's own lead names, first one
  preselected; `seedFor` passes the session id as `leadSeedKey`.
- Follow-up: the wizard crew preview (`crewPreviewFor`) uses the rules without a lead proposal, so the
  launched team can differ from the preview.
- Review fix (CodeRabbit on #279): `seedBlueprintDraftSchema` now omits `team`, so the idea-seed prompt's
  output schema no longer offers an unvetted team (and a market number in one can't reject a seed). The
  stored seed keeps `team` optional. `crew-idea-seed@2` relocked (new on this branch). Regression test in
  `tests/platform/wp90-seed-contract.test.ts`.
