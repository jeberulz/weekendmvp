# Phase 7. Skill flip

Back: [overview](overview.md)

## Goal

`/publish-idea` no longer requires Ideabrowser. Default path: brief or draft in, `engine:research` plus `engine:compile`, then the existing seed, OG, and (only when you ask) commit. `--from-draft` stays. MCP Mode A is deleted, not kept as a dual default.

If `engine:eval` plus one live compile cannot clear the auditor, stop. Switch the skill default to `--from-draft` only, leave MCP config in place, and do not start phase 9.

## Changes

- Rewrite `.claude/skills/publish-idea/SKILL.md` with Cursor `create-skill`. Default usage becomes `/publish-idea {title or --from-draft folder}`. Steps call `npm run engine:research` then `npm run engine:compile`, then `npm run audit:idea` and `npm run validate:idea-tags`. Remove every `mcp__ideabrowser__*` instruction. Fix the preview host to `http://localhost:3000`. Count eight headings (Sources included).
- Copy the same file to `.agents/skills/publish-idea/SKILL.md` in the same change. Those two copies are identical today. Do not update `~/.codex/skills/publish-idea/SKILL.md`. That home copy is stale and outside the repo.
- Strip Mode A checklists that name MCP. Keep STOP-rule numbers (3 competitors, 2 cited stats) as auditor failures, not chat-only rules.

Do not delete `.cursor/mcp.json` in this phase.

## Data structures

None. The skill is operator prose around the CLIs.

## Verification

Static: `rg 'mcp__ideabrowser' .claude/skills/publish-idea` prints nothing. Same for `.agents/skills/publish-idea`. `npm run typecheck`, `npm run lint`.

Runtime: run the new default path on one unpublished brief (not a gold slug). Auditor green. `control-ui` on `/ideas/{slug}`. Do not push to `main` unless you explicitly ask. A local 200 after `next dev` is enough to pass this phase.
