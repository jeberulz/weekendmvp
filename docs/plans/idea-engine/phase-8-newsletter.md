# Phase 8. Newsletter without Ideabrowser

Back: [overview](overview.md)

## Goal

`/newsletter today` still drafts AM and PM when Ideabrowser is gone. Beehiiv MCP stays. Only the Ideabrowser signal pull is replaced.

Do not treat today's `selection-rules.md` fallback as MCP-down handling. That path runs after MCP returned a pair that scored under 4. There is no `--no-ideabrowser` flag. Phase 8 adds a path that never calls those tools.

## Changes

- Edit `.claude/skills/newsletter/SKILL.md` and `selection-rules.md` with `create-skill`. Delete required `mcp__ideabrowser__browse_platform_trends`, `browse_ideas`, `research_market_insight`, and `get_trend` calls. Default AM pick: freshest unrecent owned idea from `ideas/manifest.json` plus a hook from its summary or from a matching `engine/records` file if present.
- Keep Beehiiv `save_post` as-is. Keep `--no-beehiiv`.

Do not build a trend harvester. If AM feels stale after a week of owned-only picks, that is a later program (M1), not this one.

## Data structures

No new type. Selection reads `ideas/manifest.json` and optional `engine/records/*.json`.

## Verification

Static: `rg 'mcp__ideabrowser' .claude/skills/newsletter` prints nothing. `npm run typecheck`, `npm run lint`.

Runtime: dry-run the selection rules against current manifest (a small node snippet or a documented manual pass that names the AM pick). Do not send Beehiiv. Flag: no `control-ui` unless you also open `/newsletter/{date}-am`.
