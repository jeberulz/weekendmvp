# Idea Engine testing

Back: [overview](overview.md)

Facts for lookup. Commands, gates, browser pages. No procedure narrative.

## Static, every phase

| Command | Meaning |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, 0 errors |
| `npm test` | existing repo suite. Do not shrink it. |
| `npm run validate:idea-tags` | WP19 tagging. Phase 2 puts this in CI. |

## Added by this plan

| Command | From phase | Passes when |
|---|---|---|
| `npm run audit:idea -- --slug {slug}` | 2 | MDX meets the eight-heading contract (seven sections plus Sources, HowTo list, no JSX traps) |
| `npm run engine:eval` | 3 | gold slugs still meet stored counts |
| `npx vitest run lib/engine/providers.test.ts` | 4 | fixtures only, no live keys |
| `npm run engine:research -- --fixture {name}` | 5 | writes a parseable `ResearchRecord` |
| `npm run engine:compile -- --record {path}` | 6 | auditor-clean MDX in a temp or throwaway slug |
| `rg 'mcp__ideabrowser' .claude/skills/publish-idea` | 7 | empty |
| `rg 'mcp__ideabrowser' .claude/skills/newsletter` | 8 | empty |
| `npm run check:ideabrowser-runtime` | 9 | no live skill or agent-doc dependency |

## Runtime checks

| Page or check | Skill | When |
|---|---|---|
| `/ideas/{slug}` after compile | `control-ui` | phases 6, 7, 9 |
| `/newsletter/{date}-am` | `control-ui` | phase 8 only if you open the archive page |
| Provider HTTP | none in CI | live spend is a local, opt-in smoke after phase 5, judged by the compiler in phase 6 |

There is no TUI. CLI checks are the scripts above. If `control-ui` is unavailable, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ideas/{slug}` plus a heading grep is the fallback. Record that fallback in the phase progress note. Do not call a 200 on `next dev` a production launch.

## Gold slugs

- `ai-rfp-response-assistant`
- `ai-code-reviewer`
- `ai-landing-page-generator-ecommerce`

Counts in `engine/eval/gold.json` are generated from the auditor, not edited by hand.

## Abort

If phase 6 or 7 cannot produce an auditor-green page from a live or fixture record, do not run phase 9. Default the skill to `--from-draft`. Leave MCP config.
