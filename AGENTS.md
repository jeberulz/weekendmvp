<!-- BEGIN:active-handoff -->
## Active work — read before coding

WP44 dashboard audit repairs are in PR #81 on remote branch
`claude/wizardly-rubin-a6m2th`. The local repair branch is `codex/wp44-audit-fixes`.
**Read `docs/wp/AGENT_HANDOFF.md` first.** Its current section links the repair
report, remaining release gates, isolated local setup and prior platform traps.
Publishing remains paused; Builder's Hub activation is a separate work package.
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

<!-- BEGIN:idea-engine -->

## Idea research (owned engine — not Ideabrowser)

Content research for `/publish-idea` uses the local Idea Engine under
`docs/plans/idea-engine/PIPELINE.md`. There is no Ideabrowser MCP Mode A.
Historical `source: "ideabrowser:{id}"` rows in `ideas/manifest.json` are
provenance only.

Live research → sealed Source Critic PASS (`*.source-review.json`) →
`engine:compile` / `editorial:submit-engine`. Fixture mode skips the source
gate for hermetic replay only.

<!-- END:idea-engine -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
