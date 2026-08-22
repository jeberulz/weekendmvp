# Phase 9. Retire Ideabrowser MCP

Back: [overview](overview.md)

## Goal

Live config no longer points at Ideabrowser. Skills and agent docs no longer tell Cloud Agents to wire that server. Historical `source: "ideabrowser:{id}"` rows in `ideas/manifest.json` stay. They are provenance, not a runtime dependency.

Do not start this phase if phase 7 took the abort path (Mode B default, MCP still required).

## Changes

- Remove the `ideabrowser` server from `.cursor/mcp.json` and `.mcp.json`. Leave `beehiiv`.
- Remove `IDEABROWSER_API_KEY=` from `.env.example`.
- Edit the Ideabrowser Cloud Agent block in `AGENTS.md` (`BEGIN:ideabrowser-mcp`) and any MCP-as-required language in `CLAUDE.md`. One sentence: content research is the operator engine under `docs/plans/idea-engine/`.
- Add a scoped grep gate, `scripts/check-ideabrowser-runtime.mjs`, that fails on `mcp__ideabrowser` under `.claude/skills/`, `.agents/skills/`, `AGENTS.md`, and `CLAUDE.md`. Allow matches inside `ideas/manifest.json`, `docs/wp/`, and this plan directory. Wire `check:ideabrowser-runtime` into `package.json`.

Credential deletion in the Ideabrowser hub and the `IDEABROWSER_API_KEY` env var is irreversible. Pause and get an explicit go from you before anyone deletes the hub key. Removing repo config is reversible via git.

## Data structures

None.

## Verification

Static: `npm run check:ideabrowser-runtime` exits 0. `npm run typecheck`, `npm run lint`, `npm test`.

Runtime: `/publish-idea` path from phase 7 still works with Ideabrowser MCP disconnected. `control-ui` on the last engine-published idea. Newsletter selection still names an owned AM pick.
