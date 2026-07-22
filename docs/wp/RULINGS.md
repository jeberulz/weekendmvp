# Rulings

Append-only owner/orchestrator decisions for questions not settled by project docs.

| Date | Scope | Question | Ruling | Decider |
|---|---|---|---|---|
| 2026-07-22 | MCP / Cloud Agents | Why can't Cloud Agents use Ideabrowser MCP? | Desktop/global MCP is not inherited. Wire Ideabrowser as Cloud Agent HTTP MCP at `https://www.ideabrowser.com/api/mcp/http` with `Authorization: Bearer ib_…` via cursor.com/agents MCP dropdown (and/or `IDEABROWSER_API_KEY` + `.cursor/mcp.json`). Never use `/api/mcp/sse` on Cloud Agents. | cloud-agent |
