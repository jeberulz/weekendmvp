# WP62 Progress - Idea of the week link worded for the audience

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-07 - Setup and build

- Branch: `codex/wp62-idea-of-week-link`, cut from `main` at `05ae555` (WP58 to WP61 all merged). No worktree. Single agent, mid tier.
- Found: `IdeaOfTheWeek` is a server component with a static "Read the research" `ButtonLink` to `/ideas/{slug}`. The destination was already right. Only the wording and tracking were missing.
- Actions: added `IdeaOfTheWeekLink` (client, reuses `heroCta` wording and `useSessionHint`), swapped it into the section, added `IDEA_OF_WEEK_CTA_LOCATION`, a test file, the ruling and registry row.
- Decisions: reuse the hero's labels so both surfaces read the same. Separate report location so the funnel can compare them. No note line under the button, because the section has no room for it and the gate explains the account.
- Checks: `npx vitest run tests/home` 13 files, 79 tests pass. `npm run typecheck` pass. eslint on the touched folders clean.
- Docs updated: RULINGS, PROJECT_STRATEGY, wp62 stories and progress. `CLAUDE.md` note added.
