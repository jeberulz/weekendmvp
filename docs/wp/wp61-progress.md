# WP61 Progress - Weekend prompt standard and backfill

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-07 - Setup

- Branch/worktree: `codex/wp61-prompt-backfill`, cut from `origin/main` at `4b442e8`. Independent of WP58 to WP60, which touch only homepage code. No worktree.
- Assignment: single agent. Lane: Program/Migration. Owner decisions: no billing in prompts, Branding Package stays required, backfill all 176 `ideabrowser` ideas.
- File boundaries: the prompts section of the 176 pages, `scripts/*prompt*`, `scripts/lib/idea-quality.mjs`, `scripts/audit-idea-mdx.mjs`, `ideas/SECTIONS.md`, `ideas/prompt-standard.json`, `tests/prompts/*`, docs. Not touched: other sections of any page, `ideas/manifest.json`, Convex, seeding, homepage code.
- Required checks: per wave, the lint and the audit baseline. At the end, typecheck, lint, test and build.
- Initial risks: unreviewed AI rewrites of customer-facing content, drift from each page's Stack and Business Model sections, and facts invented for an idea.

## 2026-10-07 - WP61-S1 to S3 (audit, standard, tooling)

- Audit, read-only, all 225 ideas:
  - 102 first prompts are a single line (88 of them `ideabrowser`).
  - 170 put Stripe or billing in prompt 1. 48 name four or more services there. 32 pair Clerk with Supabase, 13 with row rules.
  - 5 have any `Done when` line. 19 say what not to build.
  - 42% pin Next.js 14, 16% pin 15, 1% pin 16. The repo runs 16.3.
  - Only 2 ideas come from the engine. 176 come from `ideabrowser`.
  - The deep audit applies only to engine pages. It requires every Business Model tier name inside Project Setup (which forces billing into prompt 1) and a Branding Package prompt.
- Baseline: `npm run audit:idea -- --all` passed 198 of 227, with 29 failing for other reasons (saved as the comparison set). `audit:prompts` under standard v1: 0 of 225 pass. Errors by rule: `done-when` 749, `titles` 211, `branding-missing` 185, `setup-fence` 182, `setup-tables` 149, `setup-billing` 145, `next-pin` 139, `setup-structure` 119, `branding-tool` 40, `setup-auth-rls` 31, `setup-services` 20, `setup-auth` 4.
- Actions taken:
  - Wrote the standard into `ideas/SECTIONS.md`, and the lint in `scripts/lib/prompt-standard.mjs` with a report CLI (`npm run audit:prompts`).
  - Added the ratchet: `ideas/prompt-standard.json` lists the pages that must keep passing. `audit:idea` fails a listed page and warns once for the rest.
  - Relaxed the tier-in-setup rule in `scripts/lib/idea-quality.mjs`.
  - Added `tests/prompts` (21 tests) and `test:prompts` in the `npm test` chain.
  - Froze `docs/wp/wp61-program-manifest.md`: 9 waves, 176 slugs, 30 marked as taking payment as their function.
- Decisions made:
  - Exactly four prompts with fixed titles. The audit and engine already use them, and a fixed set makes the lint mechanical.
  - A `Do not build:` line may name billing without counting as using it.
  - A Setup that never mentions billing owes no tier names, so the standard is reachable for new ideas.
  - Payment may stay in Core Feature only where payment is the product's function. 30 ideas are marked for that.
  - A ratchet list, not a global error, so each wave locks in without failing the ideas not yet rewritten.
  - Not wiring `audit:idea` to error for unlisted ideas until the engine template is aligned (S7).
- Checks run:
  - `npx vitest run tests/prompts lib/engine/audit.redos.test.ts lib/engine/audit.page.test.ts`: 80 tests pass.
  - `npm run audit:idea -- --all`: the failing set is identical to the baseline. Every page gets the one-line warning.
  - `npm run engine:eval`: 3 of 3 gold pages ok.
- Gotchas the tests caught in my own lint, fixed before use:
  - The compliant fixture failed because its `Do not build: billing...` line named billing. A fence line must not count as using what it excludes. The tier check shares the same rule.
  - "Supabase (..., Auth with Google)" was not read as a login provider, and "nextjs 15" was not read as a pin.
  - The first pin regex would have flagged prose such as "next 7 days". It now needs `Next.js` or `nextjs` and a version.
- Next: wave 1 (pilot).
