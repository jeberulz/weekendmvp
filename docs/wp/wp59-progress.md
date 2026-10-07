# WP59 Progress - Hero tabs that change the prompt

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-07 - Setup

- Branch/worktree: `codex/wp59-hero-tabs`, cut from `codex/wp58-weekly-hero` at `1a3c8e4`. No worktree. Stacked because both packages edit the homepage hero and append to `RULINGS.md` and the registry. Open this PR against the WP58 branch, or after WP58 merges.
- Assignment: single agent, mid tier. Lane: Work Package (visible behavior, prompt copy, analytics).
- File boundaries: `lib/home/hero-prompt.ts`, `components/home/client/{HeroBuildWindow,CopyButton}.tsx`, `tests/home/*`, docs.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Initial risks: the lead line takes rows from a small phone window. Copy claims about a tool must stay true.

Why this package exists: the hero tabs changed only the label and logo. The prompt, and what Copy wrote to the clipboard, were identical for all 7 tools. A code comment said so on purpose, but the tab pattern promises different content.

## 2026-10-07 - WP59-S1 to S4

- Actions taken:
  - Added `lib/home/hero-prompt.ts`: the tool list, one lead line per tool, and `heroPromptLines`.
  - `HeroBuildWindow` shows and copies `[lead line, ...idea prompt]`. Row 1 is in the accent color. The Copy label now reads "Copy prompt 1 for {tool}: {title}".
  - `hero_tool_selected` fires on a real tab change, by click or arrow keys. `CopyButton` takes an optional `tool` for `prompt_copied`.
  - Replaced the stale "same for every tool" comment.
  - Added `tests/home/hero-prompt.test.ts` and `tests/home/hero-window.test.tsx`. Recorded the ruling, the registry row and the `CLAUDE.md` note.
- Decisions made:
  - A lead line, not a different prompt per tool. Data from the 225 ideas: 84 have a landing-page-style third prompt, and the second prompt has 167 distinct titles. A title or position rule would be wrong most of the time. This replaces my earlier recommendation to pick a prompt per tool.
  - The lead line goes first, so the change is visible at the top of the window. It is one row of text on every tab, so rows never mount on a switch and the paste animation does not replay.
  - Lines are 100 characters or fewer, so a phone shows the idea's prompt under them. They are written as instructions to the AI tool and claim nothing about its internals. No menu names or shortcuts.
  - Cursor and Windsurf differ only by the tool name. Their agents behave alike.
- Checks run:
  - `npx vitest run tests/home`: 11 files, 66 tests, pass.
  - Mutation checks: two tabs sharing a line fails the distinct-line test, and reverting the Copy label fails the window test. Both were restored.
  - Contrast of the lead line, `#f08a3e` on `#1a1814`: 7.10:1. Body text on the same background: 14.29:1.
  - Real browser (Chromium, Playwright) against a temporary harness route that rendered the real `Hero` with real data for `adventure-date-night-app`. The route was deleted afterwards. 47 of 47 checks pass, at 390px and 1280px:
    - no tracking event fires on load
    - for each of the 7 tabs: the tab is selected, the header names the tool, row 1 equals the first clipboard line, and the Copy label names the tool
    - 7 distinct first rows, the same row count on every tab
    - `hero_tool_selected` fires 6 times for 6 changes and not for re-selecting Cursor
    - `prompt_copied` carries the tool on all 7 copies
    - ArrowRight wraps from Windsurf to Cursor, End selects the last tab
    - no horizontal overflow, including the longest hero title (71 characters) at 390px
    - no page errors
  - Screenshots checked by eye at 390px for Cursor, Claude and v0, and at 1280px for Lovable. The lead line reads as the tool-specific part and the idea's prompt follows it.
- Gotchas:
  - Next 16 dev blocks its client chunks when a page is opened by `127.0.0.1`. React did not hydrate and every click did nothing. Using `localhost` fixed it. It looked like a bug in the tabs and was not.
  - Next 16 with Cache Components rejects `searchParams` outside `Suspense`. The harness needed a boundary.
  - The fixed cookie banner covers the Copy button at 390px height until it is dismissed. It was hidden in the harness only. This is existing behavior and not part of this package.
  - `pkill -f "next dev"` killed the shell that contained that text. Not a repo issue.
- Next: record the full check results.

## 2026-10-07 - WP59-S5 (open)

- Full `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`: running. Results to be appended below.
