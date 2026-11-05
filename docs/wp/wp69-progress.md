# WP69 Progress - Crew contracts and the cost spike

Append-only progress log. Do not rely on chat history for project state.

## Handoff note

Not yet. Written when the WP closes.

## Needs from Codex

- None yet.

## 2026-11-05 - Setup

- Branch/worktree: `claude/wp69-crew-contracts` in `.worktrees/wp69-crew-contracts`, from
  `origin/main` at `68aa05c5` (plan PR #166 merged; manifest RATIFIED).
- Assignment: C-ART, C-JOBS, C-PROMPT, C-METER as types only; role rules; cost spike.
- File boundaries: `lib/workspace/contracts/**`, `convex/crew/roles.ts` (+ test),
  `tests/platform/workspace-*.test.ts`, `evals/crew/corpus/**`, `docs/wp/wp69-*`,
  `docs/plans/launch-workspace/03-ai-cost-model.md`, spike scripts on the branch.
- Parallel stories: S1, S2, S3 have disjoint files. S1 imports `IDEA_KINDS`, `ROLE_KEYS` and
  `rosterPlanSchema` from `roster.ts`, which S3 writes.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Initial risks: contracts frozen too early (prices before the spike); the roster rule inputs
  depend on blueprint fields that C-ART defines; any merge deploys production Convex, so
  nothing here registers a Convex function.
- Spend: S4 needs the owner's OK (cap $25). Not requested yet.

## 2026-11-05 - WP69-S3 (role catalogue and hiring rules)

- Files: `lib/workspace/contracts/roster.ts`, `convex/crew/roles.ts`, `convex/crew/roles.test.ts`.
- Author: Sonnet sub-agent. Independent review: Opus, given the files and the contract only.
- Review findings (7), all fixed before commit: TEAM.md line injection through free text and
  `leadName`; `rosterPlanSchema` let `always`, `hiredBy` and empty reasons through; float budgets
  printed raw; capitalisation broke "iOS"; reasons keyed on idea kind, not the rule's own input;
  catalogue could drift from `ALWAYS_HIRED_ROLE_KEYS`; missing negative tests and a full sweep.
- Decisions: Merch is "Max" and Outbound is "Oli" (no canvas names); `rulesVersion`
  "2026-11-05.1"; skipped order ads, merch, outbound, curriculum, community. `roles.ts` registers
  no Convex function. The next Convex codegen will list `crew/roles` in `_generated/api.d.ts`
  (no functions; harmless).
- Checks: `npx vitest run convex/crew/roles.test.ts` 36 passed; eslint clean on the three files;
  `tsc -p convex` clean for these files. Full-suite checks run before the PR.
