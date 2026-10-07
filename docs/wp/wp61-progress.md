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

## 2026-10-07 - WP61-S4 (wave 1, pilot, 5 ideas)

- Ideas: `meeting-mood-ai`, `marketplace-meetup-safety`, `ai-code-coach-tutor`, `contractor-ai-receptionist`, `tattoo-dm-booking-agent`.
- Method: for each idea, printed a packet of its own facts (description, Solution, How it works, Tech Stack, Business Model tier names, the old prompts), wrote four prompts by hand, and applied them with a helper that rewrites only the prompts section, lints it, and refuses on any error. The helper and the per-wave source files live in the session scratchpad and are not committed, because the diff of the pages is the record.
- What changed and what was kept:
  - Kept each idea's own tables, columns, enums, copy, palette and rules (for example SafeMeet's rule that a spot is never shown as verified without a source and a date, and InkReply's rule never to invent an exact sleeve price).
  - Removed billing, plans, a second calendar provider, Clerk, extra services and version pins. Added a `Do not build:` fence and a `Done when:` line to every prompt.
  - Folded or dropped prompts outside the four: Code Coach's Freemium Gating (billing, now fenced), SafeMeet's Verified Spot Pipeline (an admin tool, now fenced, with its trust rule kept in Core Feature), the tattoo agent's separate Stripe and Calendar prompt (the deposit step moved into Core Feature, the calendar sync fenced).
  - Added Landing Page and Branding Package where an idea had none (tattoo agent, contractor receptionist's brand, SafeMeet, Code Coach), using only the page's own headline, steps and tone.
  - The standard flexes by stack. SafeMeet is Expo with Supabase, Code Coach is a local VS Code extension with no server (its "tables" are three local storage records from its own settings, cache and triggers), and the tattoo agent starts on a mock inbox because its own old Setup already did.
- MeetingMood AI, the evaluation's example, now: Google Calendar only with read-only scope in the same sign-in, one login, four tables with row rules, the service-role key marked server only for the Sunday job (which resolves the old "no admin read path" contradiction), a 4-week backfill at first sign-in, buttons plus keys alongside the swipe, three SQL group-bys instead of a regression, an empty state, and no billing.
- Checks run (gates in the manifest):
  - `npm run audit:prompts -- --slugs <the five>`: 5 of 5 pass. One warning, `core-billing` on the tattoo agent, which is intended because deposits are its function.
  - `npm run audit:idea -- --all`: 198 of 227, the failing set identical to the baseline of 29. None of the five pages carries a warning.
  - `npx vitest run tests/prompts`: 21 tests pass, and the ratchet test now lints the five.
  - Only the prompts section changed in each page, checked by comparing every other line against `HEAD`.
  - The homepage's prompt reader parses each page as four real prompts, and the first prompt is 15 to 17 lines, so all five can now be a weekly hero.
- Sampling: MeetingMood AI's section was read in full after applying. The other four were written from their packets and checked by the lint and the diff. They were not re-read line by line after applying.
- The `*` payment tag in the manifest is a keyword match. `marketplace-meetup-safety` matched on "marketplace" and takes no payment, so its Core Feature has none.
- Next: wave 2 (22 ideas).
