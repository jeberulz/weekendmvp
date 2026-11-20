# WP93 Progress - AI cost console

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-20 - Setup

- Branch/worktree: `claude/wp93-ai-cost-console` in the Claude Code worktree `.claude/worktrees/ai-cost-console-6d447c` (created by the app, not by this WP).
- Assignment: owner-only AI cost console at `/admin/ai` (Phase 1 build, Phase 2 write-up). Started from another session's brief.
- Number: WP93 is the first number used nowhere on `main` or a remote branch (highest in use WP92; WP67–WP87 reserved by D14).
- File boundaries: new `convex/admin/aiCosts.ts`, `lib/admin/ai-costs/**`, `app/admin/ai/**`, `components/admin/ai-costs/**`, their tests, and these docs. Read only against `convex/schema*`, `convex/crons.ts`, http and `middleware.ts` (Codex-owned).
- Read first: `CLAUDE.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, `docs/wp/RULINGS.md` (WP38, D3, D22, WP70 shutdown monitoring), `convex/_generated/ai/guidelines.md`, `convex/schema/ai.ts`, `convex/ai/metering.ts`, `convex/ai/pricing.ts`, `lib/workspace/contracts/metering.ts`, `convex/ops/settings.ts`, `convex/ops/spend.ts`, `convex/admin/superAdmin.ts`, `app/admin/editorial/layout.tsx`, `lib/editorial/runtime/workspace.ts`, `middleware.ts`.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; a11y-check on every new screen.
- Initial risks:
  - `ai_usage` has no `createdAt`-only index. The built-in `by_creation_time` index is used for range reads (rows are inserted with `createdAt = Date.now()` in the same mutation, so the two agree to the millisecond).
  - No rollup table: reads are bounded and the UI says when a range is cut off (Codex need 1).
  - `errorDetail` exists only on `idea_seed_items`, not on `ai_usage`.
  - Thinking tokens are not stored apart from output.

## 2026-11-20 - Build, tests, a11y

- Built (S1–S4): `convex/admin/aiCosts.ts` (5 read queries, each `requireSuperAdmin`), `lib/admin/ai-costs/*` (pure aggregation, what-if, forecast, CSV, fixtures, server source), `app/admin/ai/**` (Overview, Prompts and models, Founders, Founder call timeline, Forecast), `components/admin/ai-costs/*`.
- Access: middleware already 404s `/admin/*` for anyone but the super admin; the page also probes `controlRoom` with the session token and calls `notFound()` on any refusal; `noindex`; not in the sitemap (`app/sitemap.ts` reads content and `*_SLUGS` only); no link outside `/admin`.
- Money: `convex/admin/aiCosts.test.ts` drives the real `reserve` / `markSent` / `settle` / `fail` / `sweepStale` + late `settle` mutations and checks the console's own `overview()` totals equal `readGlobalBudget` (spent and in flight, both pools), `controlRoom`, and the founder's `ai_budgets.daySpentMicroUsd` to the micro-dollar.
- Tests: `convex/admin/aiCosts.test.ts` 4/4; `tests/admin-ai/ai-costs.test.ts` 20/20 (`npm run test:admin-ai`, added to the `npm test` chain).
- Checks:
  - `npm run typecheck` pass.
  - `npm run lint` 0 errors (45 warnings, all in files this WP does not touch).
  - `npm test`: every suite up to `test:prompts` passes, and `test:platform` (2,901) and `test:live` pass when run alone. The chain stops at `check:ideabrowser-runtime`, which flags `.claude/skills/newsletter/*`. Those files are untracked local skill copies in this worktree, not in git, so CI does not see them; not a WP93 change.
  - `npm run build`: compiles and lists every route, including `/admin/ai/**`, then exits 1 at a Next.js security-advisory check that asks for a Next upgrade. Not caused by this WP; the upgrade is left to the owner.
- a11y-check: code review clean (labelled inputs and selects, `aria-hidden` icons, text beside every status colour, h1 → h2 → h3, focus-visible outlines, focusable table scroll regions, chart `role="img"` + table equivalents, `aria-live` results). axe-core WCAG 2.1 A/AA on all five screens at 1280 px: 0 violations; overview and timeline at 375 px: 0 violations, no horizontal page overflow.
- Fix found in browser: the drill-down (the only dynamic segment) tripped the root layout's `usePathname()` prerender check; set `export const instant = false`, as `app/admin/editorial/ideas/[ideaId]` does.
- Known: a malformed id on the drill-down shows the not-found page with HTTP 200 (the check runs inside the streamed Suspense boundary). Only the super admin reaches it.
- Evidence: `docs/reviews/evidence/wp93-ai-costs-2026-11-20/` (fixture data, `EDITORIAL_FIXTURE_MODE=local-demo`).
- Not done: no prod read for a sanity check (fixtures only); nothing deployed, merged or applied.
