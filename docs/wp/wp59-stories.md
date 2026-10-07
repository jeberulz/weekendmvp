# WP59 Stories - Hero tabs that change the prompt

Branch: `codex/wp59-hero-tabs` (stacked on `codex/wp58-weekly-hero`)
Lane: Work Package (visible homepage behavior, prompt copy, analytics)
Registry: `docs/PROJECT_STRATEGY.md`
Product decisions: `docs/wp/RULINGS.md` (2026-10-07 WP59 row)

Definition of done: each tab in the homepage hero build window changes what is shown and what Copy puts on the clipboard. Every tab leads the idea's first prompt with one line written for that tool, and the shown text matches the copied text. Switching tabs and re-selecting the same tab are tracked, and `prompt_copied` carries the tool. The keyboard pattern, contrast and row layout still hold on phone and desktop. Focused tests, a browser check, typecheck, lint, full tests and production build pass. No production deploy is part of this package.

## Stories

- [x] `WP59-S1` - Record the ruling and the design
  - Scope: `docs/wp/RULINGS.md`, `docs/PROJECT_STRATEGY.md`, these stories and progress.
  - Acceptance criteria:
    - The ruling records what changes per tab, what does not, and why a per-tool prompt choice was ruled out.
  - Verification:
    - `git diff --check`

- [x] `WP59-S2` - One lead line per tool
  - Scope: `lib/home/hero-prompt.ts`, `tests/home/hero-prompt.test.ts`.
  - Acceptance criteria:
    - All 7 tools have a lead line, no two alike, each 100 characters or fewer, written as an instruction to the AI tool.
    - Lines claim nothing about a tool's internals. They say what the tool can do with the prompt: work in your folder, return files as code blocks, build in its own stack and report changes, build screens with mock data, use built-in storage.
    - Every tab has the same number of rows, so a tab switch swaps text in place and never mounts a row.
  - Verification:
    - `npx vitest run tests/home/hero-prompt.test.ts`

- [x] `WP59-S3` - The window shows and copies the tool's prompt
  - Scope: `components/home/client/HeroBuildWindow.tsx`, `components/home/client/CopyButton.tsx`, `tests/home/hero-window.test.tsx`.
  - Acceptance criteria:
    - Row 1 is the active tool's lead line in the accent color (7.1:1 on the code background). Rows after it are the idea's prompt, unchanged.
    - The copied text equals the shown rows, plus the rest of the prompt.
    - The Copy button's accessible name names the tool and still starts with "Copy".
    - The stale code comment ("the prompt is the same for every tool") is replaced.
  - Verification:
    - `npx vitest run tests/home`
    - Browser check, see S5.

- [x] `WP59-S4` - Track tab use
  - Scope: `components/home/client/HeroBuildWindow.tsx`, `components/home/client/CopyButton.tsx`.
  - Acceptance criteria:
    - `hero_tool_selected` with `{ tool }` fires when the tab changes, by click or keyboard. It does not fire on load or when the active tab is selected again.
    - `prompt_copied` carries `tool` from the hero. Other copy buttons send the same event as before.
  - Verification:
    - Browser check with a stubbed `gtag`, see S5.

- [ ] `WP59-S5` - Browser check, docs and full checks
  - Scope: `docs/wp/wp59-progress.md`, `CLAUDE.md` (`lib/home/*` line).
  - Acceptance criteria:
    - A real browser at 390px and 1280px confirms the tab, header, row 1, clipboard and event behavior for all 7 tabs, plus ArrowRight wrap and End.
    - The longest hero title (71 characters) causes no horizontal overflow at 390px.
    - `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass.
  - Verification:
    - Results recorded in `docs/wp/wp59-progress.md`.

## Out Of Scope

- Rewriting the idea's prompt per tool. It names its own stack, so a real per-tool rewrite means 7 variants per idea. Only a lead line is tool-specific.
- Choosing a different prompt per tool. Only 84 of 225 ideas have a landing-page-style third prompt and the second prompt has 167 distinct titles, so a title or position rule would be wrong most of the time.
- A "how to start in this tool" hint with menu names or shortcuts. Those go stale.
- The "Build with AI" panel on the homepage, whose peek cards show fixed tool logos.
- Prompt quality for individual ideas, and a link from the hero window to the idea page.

## Notes

- Cursor and Windsurf lines differ only by the tool name. Their agents behave alike, so the honest difference is small. The three real classes are agents in your folder (Cursor, Claude Code, Windsurf), a chat that cannot see your files (Claude), and hosted builders (Lovable, v0, Replit).
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
