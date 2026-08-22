# Idea Engine, operator path

This plan is independent of the Build Platform program. It does not wait on WP29, WP30, WP38, or WP31. It does not edit `docs/wp/program-manifest.md`. It does not merge `codex/wp26-v1.1-engine` onto `main`. It does lift the pure provider and pipeline functions from that branch into `lib/engine/`, and it leaves the Convex workflow, credits, and `ownerId` there.

The deliverable is a research-and-compile loop you already run by hand, owned in this repo, with Ideabrowser MCP removed from `/publish-idea`.

## Context

`/publish-idea` still requires Ideabrowser MCP as Mode A. Seven MCP calls feed the seven MDX sections. The subscription lapses on 2026-09-05.

The platform program parked the replacement behind an admin UI, a customer Validation Report workflow, and an idea-generation library. That is why nothing shipped. Those are different products.

You do not need a clone of Ideabrowser. You need cited market stats, named competitors with pricing, community quotes, real keyword volumes, and a compiler that writes `content/ideas/{slug}.mdx` plus an `ideas/manifest.json` row that already-existing gates will accept.

`ideas/SECTIONS.md` still describes HTML and `scripts/audit-ideas.js`. That script is gone (cutover U14). The live idea-quality gate is a checklist in `.claude/skills/publish-idea/SKILL.md`. Tagging is `npm run validate:idea-tags`, and CI does not run it. Mode B (`--from-draft` plus WebSearch) already publishes without MCP. Articles and programmatic hubs never used MCP.

The newsletter AM slot calls `browse_platform_trends` and `browse_ideas` on every `/newsletter today` run. The "skip MCP" path in `selection-rules.md` is for a pair score under 4 after MCP returned data. There is no `--no-ideabrowser` flag. Dead MCP breaks AM freshness today.

Canonical skill copies: `.claude/skills/publish-idea/SKILL.md` and `.agents/skills/publish-idea/SKILL.md` (identical). Do not use `~/.codex/skills/publish-idea/SKILL.md`. That home copy is stale and missing the WP19 tagging gate. Preview in the skill still says port 5173. Next is 3000.

## Scope

In:

- A storage-agnostic research record with URL citations (not Convex `document_citations` indices).
- A deterministic MDX section auditor.
- An eval script scored against three published gold pages you already have.
- Provider adapters lifted from `codex/wp26-v1.1-engine` (`c99351b`) into `lib/engine/`, fixture-first, no Convex runtime.
- A seven-step research pipeline that fails closed on thin citations or guessed keyword volumes. Same step order as v1.1 `pipeline.ts`. Local CLI, not `@convex-dev/workflow`.
- A compiler from research record to MDX plus manifest.
- Flip `/publish-idea` off MCP. Keep `--from-draft`.
- Newsletter AM can run when Ideabrowser is down.
- Delete live MCP config for Ideabrowser after the gates pass.

Out:

- Merging WP26 S2 through S6 onto `main`. Customer Validation Reports, credits, refunds, `tasks` / `workflow_runs`, `documents` rows, `ownerId`.
- The dirty worktree file `.worktrees/wp26-research-workflow/convex/platform/engine/compile.ts`. That compiler maps URLs onto `CitationRef` for `documents.body`. It is not the MDX compiler.
- Super-admin UI.
- `engine_ideas` library generation (browse-and-score a catalog).
- Scheduled trend harvest crons as a product.
- Copying Ideabrowser page text.
- Auto-push to `main`.
- Rewriting `/publish-article` or `/publish-programmatic`.
- Touching `convex/schema.ts`.

If quality fails before 2026-09-05, default `/publish-idea` to `--from-draft` and leave MCP in place until the eval script is green. Do not retire credentials on a red gate.

## Constraints

- Provider rulings already in `docs/wp/RULINGS.md`: synthesis on a dated `gpt-5.6-sol` snapshot, Perplexity Sonar Pro for search and community, DataForSEO for volume/CPC/competition. An LLM must never invent keyword metrics. On 2026-08-07 the v1.1 branch pinned `gpt-5.6-sol` because no dated snapshot existed. Re-check at phase 4. Keep a dated ID if one exists then.
- Fixture mode for this CLI must run with no live keys. v1.1 `providers/registry.ts` still required keys to exist in fixture mode. Do not copy that.
- Cost cap per research run: $4.00. Expected full run is about $0.52.
- Tagging contract stays `npm run validate:idea-tags` (WP19). Allowlists do not change.
- MDX body: seven canonical `##` sections in order, plus `## Sources` (the skill counts 8 headings). `**How it works:**` numbered list under The Solution. No placeholders. Bare `<` or `{` in prose compiles as JSX and 500s. The auditor must catch that.
- Seed and OG stay `npm run seed:convex` and `npm run og:generate`. The compiler does not reinvent them.
- `convex/schema.ts` stays a platform one-writer seam. This program stores records as JSON under `engine/records/` in git, plus optional local Convex later as an adapter, not as a blocker.
- Do not publish Ideabrowser text. Independent sources and citations only.

## Alternatives

**A. Platform engine.** Convex actions, `documents` bodies, WP38 review UI, then compilers. Correct for customer reports. Blocked on work this plan is not doing. Rejected.

**B. Mode B as the default.** One skill edit. Zero new code. Quality follows whichever model is in the chat. No owned keyword volumes, no replayable research. Keep as the abort path at phase 7, not the target.

**C. Local operator engine.** Domain types and pipeline in `lib/engine/`, CLIs in `scripts/`, skill as the thin operator UI. Chosen. Lift pure modules from `codex/wp26-v1.1-engine` (`providers/*`, `pipeline.ts` step table, `pricing.ts`, `cost.ts` cap math). Do not lift `workflow.ts`, `tasks.ts`, ledger debit, or `compile.ts` from the dirty worktree. The skill already is the UI. Scripts are what a reviewer re-runs.

## Applicable skills

Implementers read these by name before the matching work:

- `how` before editing `.claude/skills/publish-idea/` or `app/ideas/[slug]/page.tsx`.
- Cursor `create-skill` when changing any `SKILL.md`.
- `interrogate` on the compiler versus skill split before phase 6 ships.
- `unslop` and `technical-writing` on every prose file, including the skill.
- `show-me-your-work` for the decision TSV across this program.
- `/deslop` before each commit.
- `control-ui` (cursor-team-kit) to load `/ideas/{slug}` after compile.
- Built-in babysit only after the user asks, once the stack of PRs exists.

## Phases

1. [Research record](phase-1-research-record.md)
2. [MDX auditor](phase-2-mdx-auditor.md)
3. [Eval corpus](phase-3-eval-corpus.md)
4. [Provider adapters](phase-4-providers.md)
5. [Research pipeline](phase-5-pipeline.md)
6. [Compiler](phase-6-compiler.md)
7. [Skill flip](phase-7-skill-flip.md)
8. [Newsletter without Ideabrowser](phase-8-newsletter.md)
9. [Retire Ideabrowser MCP](phase-9-mcp-retire.md)

Shared commands live in [testing.md](testing.md).

## Verification

Project commands every phase must leave green:

```
npm run typecheck
npm run lint
npm test
npm run validate:idea-tags
```

New commands the phases add, then keep:

```
npm run audit:idea -- --slug {slug}
npm run engine:eval
npm run engine:research -- --fixture {name}
npm run engine:compile -- --record {path}
```

Runtime for anything that writes a page: `control-ui` against `http://localhost:3000/ideas/{slug}`. Confirm the seven headings, HowTo list, and Sources. Unit tests do not replace that load.

## Implementation guidance

- Run `how` over `/publish-idea` and the idea route before changing either.
- Run `interrogate` before shipping the compiler.
- `/deslop` every diff. `unslop` every prose file.
- Keep a `show-me-your-work` TSV for this program. One row per phase verdict.
- Do not start babysit because a PR opened. Finish the phase stack first.
- Sequence: types and the auditor before providers, fixtures before live spend, compile before the skill flip, skill flip green before deleting MCP config.
- One writer per shared file. Skill, `ideas/SECTIONS.md`, and `package.json` scripts are serialized. Pipeline code does not share those files with the auditor phase.
- If a phase wants a Convex table, stop. That is a different program.
- Lift, do not rewrite, the v1.1 provider adapters and step order. Rewrite the storage boundary (JSON files, URL citations) and the MDX compiler.
