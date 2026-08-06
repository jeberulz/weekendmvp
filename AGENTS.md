<!-- BEGIN:active-handoff -->
## Active work — read before coding

The Build Platform program is mid-flight on branch `codex/wp27-site-preview`.
**Read `docs/wp/AGENT_HANDOFF.md` first.** It carries the current state, the
two open items blocking the WP27 gate, the local environment setup, and a list
of traps that have already cost real time (soft-404 under Cache Components,
`convex-test` ignoring internal/public visibility, vacuous proxy assertions,
root-absolute `import.meta.glob`, and tests that match their own comments).
<!-- END:active-handoff -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

<!-- BEGIN:agentic-delivery-workflow -->
This repo uses the agentic delivery workflow.

Before coding, read:
- `AGENTS.workflow.md`
- `.agentic-workflow.yml`
- `docs/wp/RULINGS.md`

Required defaults:
- Choose Program/Migration, Work Package, Small Fix, or Gate lane before editing.
- For large/risky programs, audit first, freeze `docs/wp/program-manifest.md`, sequence by risk, and gate every wave.
- Create/switch to a branch before story or code changes.
- For work packages, maintain `docs/wp/wpNN-stories.md` and `docs/wp/wpNN-progress.md`.
- Use Git worktrees only when needed, and only under `.worktrees/`.
- Never create sibling project folders for work packages.
- Use sub-agents only for parallel work packages, independent review, gate runs, or context isolation.
- Route model quality by risk: high for orchestration/security/architecture/data/AI/final review, mid for standard WPs, low for scaffolding/docs/checks/mechanical fixes.
- Run the configured checks and record docs updated/not needed.
<!-- END:agentic-delivery-workflow -->

<!-- BEGIN:ideabrowser-mcp -->

## Ideabrowser MCP (required for `/publish-idea` Mode A)

Cloud agents do **not** inherit desktop/global MCP configs. Ideabrowser must be
wired for Cloud Agents explicitly.

**Endpoint (HTTP — not SSE):** `https://www.ideabrowser.com/api/mcp/http`  
Auth: `Authorization: Bearer ib_…` (key from Hub → MCP Connectors; Pro/Empire)

### Cloud Agents (required)

1. Generate an API key at https://www.ideabrowser.com/hub → MCP Connectors.
2. Open https://cursor.com/agents → **MCP** dropdown → add custom HTTP server:
   - Name: `ideabrowser`
   - URL: `https://www.ideabrowser.com/api/mcp/http`
   - Header: `Authorization` = `Bearer ib_YOUR_KEY`
3. Enable the server for Cloud Agents. Start a **new** agent run (existing runs
   do not pick up newly added MCPs).

Optional: also set secret `IDEABROWSER_API_KEY=ib_…` on the Cloud Agent
environment so project `.cursor/mcp.json` / `.mcp.json` can interpolate it.

Do **not** use `/api/mcp/sse` for Cloud Agents — SSE/`mcp-remote` are unsupported.

Repo config lives in `.cursor/mcp.json` (Cursor) and `.mcp.json` (Claude Code).

<!-- END:ideabrowser-mcp -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
