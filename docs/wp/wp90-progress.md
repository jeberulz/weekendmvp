# WP90 Progress - Research-driven idea seeds

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-07 - Setup

- Branch/worktree: `claude/wp90-idea-seeds` in `.worktrees/wp90-idea-seeds`, from `origin/main` at `9557593e`. The root checkout holds other sessions' uncommitted work, so this WP runs in its own worktree.
- Assignment: owner request, 2026-11-07: build the full research-driven seed feature properly, even if L1 moves.
- File boundaries: see `docs/wp/wp90-stories.md` per story.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; a11y-check on changed wizard screens; `scripts/check-prompt-versions.mjs`.
- Initial risks:
  - The Message Batches submit/poll path does not exist yet (`anthropic.ts` notes it as S5 work). Metering already supports `batch: true` reservations.
  - No research records exist in the repo for the 231 public ideas: the MDX page and the manifest row are the seed source.
  - `convex/schema/workspace.ts` has one writer per merge window.
  - New prompt versions must keep the lock check green.

## 2026-11-07 - WP90-S1 (commit 6fcc8e83)

- C-SEED contract in `lib/workspace/contracts/seeds.ts`: wizard hints with confidence, brand, landing, email, social, build-pack and role-brief seeds. Strict, bounded, and no market claims anywhere.
- `local_business` idea kind and `sellsGoods`. `ROSTER_RULES_VERSION` is now `2026-11-07.1`. Pro Max mapping added.
- Platform rule: `platformSuggestion(deviceNeeds)`. Code chooses the platform, not the model.
- `validated` comes from the research level and audit flag (`ideaIsValidated`). Unvalidated seeds carry no market block.
- The market-claim check moved to the dependency-free `contracts/marketClaims.ts`, so the prompt lock can load it in plain Node.

## 2026-11-07 - WP90-S2 (commit a7bf26bd)

- `lib/workspace/crew/seedSource.ts`: the seed source from the page and manifest row only, bounded per section. The test parses every published idea within bounds.
- `crew-idea-seed@1` (`deep`, batch mode) in `convex/ai/prompts/ideaSeed.v1.ts`, registered.
- `lib/workspace/crew/seedAudit.ts`:
  - buyer quotes must be verbatim in the source;
  - competitors must be named in the source, or be a category;
  - findings report code and path, never model text.

## 2026-11-07 - WP90-S3

- Batch adapter in `convex/ai/providers/anthropic.ts` (`createAnthropicBatchAdapter`): submit, status and results.
  - Each request body is `buildMessageParams`, the same body as a realtime call.
  - Succeeded results are read by `readMessage(..., { batch: true })` at the batch rate.
  - Errored, canceled and expired results come back unbilled.
  - Fixture mode is stateless.
- Schema, additive:
  - `idea_seed_runs` and `idea_seed_items`;
  - optional `wizardHints`, `roleBriefs`, `validated`, `sourceHash` and `runId` on `idea_crew_seeds`.
- `convex/crew/seeds.ts` (queries and mutations) and `convex/crew/seedsBatch.ts` (Node actions). The flow:
  1. dry-run estimate (read-only);
  2. `createRun`, with the sole active super admin as seed owner (zero or several super admins is refused);
  3. `addItems`: every source bound is re-checked, and an unchanged `sourceHash` is skipped;
  4. `submitRun`: ownerless `precompute:` reservations with `batch: true`, then `markSent`, then the batch with `custom_id` = `usageId`. A budget or kill-switch refusal stops reserving, and the rest are marked `not_reserved`;
  5. `pollRun`: reschedules every minute; at end, settles or fails each row once;
  6. `recordResult` re-audits each reply against the stored source before any seed row is written.
- Entry points are internal functions: only the deploy key (`npx convex run`) can call them. That is stricter than a super-admin UI gate.
- `seedFixtureReply` is registered for `crew-idea-seed@1`, so fixture runs write a test-mode seed per idea. A test proves it passes the audit for every published page.
- `scripts/crew-seeds.mjs` (`npm run crew:seeds`): dry run by default; `--apply`, `--status` and `--poll`; `--prod` / `--deployment`.
- `convex/_generated/api.d.ts` was edited by hand for the four new modules. Codegen needs the main checkout's local deployment config.
- Checks:
  - `npm run typecheck`: green.
  - eslint on changed files: clean.
  - `vitest tests/platform convex`: 4,167 pass. One existing guard (`crew-fixture-outputs`) was updated for the new registered ref.
  - `tests/platform/wp90-seed-batch.test.ts`: 10 tests (fixture end to end, unchanged skip, budget stop, audit failure charged and not stored, errored and create-failure release, owner ambiguity, source re-check, scripted live client, fixture audit over the library).
- Known red, fixed in S5: `check-prompt-versions` flags the five crew v1 specs (the contract hash moved) and the unlocked `crew-idea-seed@1`. S5 bumps the crew specs to v2 and runs `--write` once the contracts settle.
- Not run: no live batch, and nothing against the shared local or prod Convex. A live run needs the owner's go-ahead and a dry run first.
- Docs: stories and progress updated. CLAUDE.md key paths are deferred to S6.

## 2026-11-07 - WP90-S4

- `wizardSeedFor` (`lib/workspace/wizard/defaults.ts`) takes `storedSeed` and `ideaFacts`.
  - A valid stored seed for the same idea gives source `idea_crew_seeds`:
    - the seed's blueprint;
    - the platform from `platformSuggestion(deviceNeeds)`;
    - the commercial model, goal and names from the hints;
    - a one-line reason per step and a `confident` flag.
  - Defaults are safe-parsed; anything the schema refuses falls back to the fixtures.
  - `validated` now comes from the idea row (`ideaIsValidated`) for every library seed, fixtures included. This fixes concept ideas shown as validated. An idea row with no research level still counts as validated (legacy researched).
  - The seed also carries the roster `profile` (seed blueprint, or the HydroTrail fixture's; null for the generic fixture).
- `convex/workspace/wizard.ts`:
  - `seedFor` reads `platformSeedRow` + `seedFromColumns`, and passes `researchLevel` and `provenance.auditPassed`.
  - `getSession` returns `hints` and `crew`. `crewPreviewFor` runs `planRoster` on the profile with the answers so far, defaults filling the rest, and the lead name from the partner-name answer.
  - `seedSource` gains `idea_crew_seeds`.
- UI:
  - A "Why I suggest it" line on platform, commercial model, goal and name when the seed gives a reason.
  - A confident platform, commercial-model or goal suggestion opens as a quick confirm with "Looks right" and "Change". "Change" opens the full choice and focuses the selected option. A step answered differently before opens on the full choice.
  - `CrewPreview` ("Your crew": hiring and not hiring yet, each with its reason) sits under Founder signals once the blueprint is reviewed.
- Checks:
  - `npm run typecheck`: green.
  - eslint on changed files: clean.
  - `vitest tests/platform convex/workspace convex/crew`: 3,265 pass.
  - New tests: `convex/workspace/wizardSeeds.test.ts` (6) and `tests/platform/wp90-wizard-seed-ui.test.tsx` (9, with axe).
- a11y-check: passes. No icon-only controls; headings go h1 → h2 → h3; focus moves on "Change"; the reason is linked to the primary button by `aria-describedby`. jsdom cannot check colour contrast; the tokens are the ones Founder signals already uses.
- Not run: the browser check of a seeded and an unseeded idea. The worktree has no Convex deployment of its own; the rule is not to run convex dev against the shared local or prod from here, and the preview server runs the main checkout. It belongs in the S6 owner handoff, after a fixture `crew:seeds` run on a local deployment.
- Docs: stories and progress updated.

## 2026-11-07 - WP90-S5

- The five crew specs move to v2 (`git mv` of the v1 modules, so each file's history continues):
  - `crew-blueprint-personalise@2` and `crew-blueprint-own-idea@2`: the blueprint schema gained `local_business` and `sellsGoods` (S1). The prompt now says when to use them.
  - `crew-brand-kit@2`, `crew-email-sequence@2`, `crew-social-pack@2`: an optional `ideaAngles` input, quoted as an `<idea_angles>` data block plus one usage line, only when a seed exists. Without a seed the user block is v1's, and the system blocks are unchanged apart from the comments in the module header, so the cache layout is unchanged.
- `lib/workspace/crew/inputs.ts`: `ideaAnglesFor` (brand seeds; email or social angles plus buyer words as bare quotes, never their attribution); the three copy-step plans take `seed`.
- `convex/crew/generators.ts`: a library business's brand kit, email and social steps read the newest platform seed (`platformSeedRow` + `seedFromColumns`). An unreadable seed means no angles, never a refusal.
- Lock:
  - the five `@1` entries carry a `retired` note;
  - `--write` locked the five `@2` refs and `crew-idea-seed@1`;
  - `check-prompt-versions`: 9 match the lock.
- Risk noted: a crew task queued with an `@1` ref before deploy would not resolve after it. The crew generators are still dormant (WP75/WP76), so no such task should exist; check before deploying if they have been switched on.
- Checks:
  - `npm run typecheck`: green.
  - eslint on changed files: clean.
  - `vitest tests/platform convex`: 4,191 pass. New tests: `tests/platform/wp90-crew-angles.test.ts` (7) and a seeded brand-kit generator case in `convex/crew/generators.test.ts`.
- Docs: stories and progress updated.

## 2026-11-07 - WP90-S6

- The full gate found two repo rules the S3 code broke. Both are fixed:
  - D22 ownership (`tests/security/wp68-workspace-boundaries.test.mjs`): `idea_seed_items` now has `ownerId` (the run's owner), and both seed tables have a `by_ownerId` index. The table count went from 30 to 32, with WP90 named.
  - WP46-E4a (`tests/editorial/structure/boundaries.test.ts`): only `convex/admin/superAdmin.ts` reads `super_admins`. The sole-owner lookup moved there (`soleActiveSuperAdminUserId`), and `convex/crew/seeds.ts` calls it.
- Gate:
  - `npm run typecheck`: green.
  - `npm run lint`: 0 errors. The 43 warnings are in files WP90 did not touch.
  - `npm test`: exit 0, 6,539 tests across every suite.
  - `npm run build`: exit 0. It ran before the two small Convex fixes; typecheck and the affected suites were rerun after them.
  - `check-prompt-versions`: 9 match.
- Cost, worked out locally (`seedRequestFor` over all 231 pages; 227 validated, 4 concept):
  - worst-case reservation $53.28 for the library, about $1.15 for a spike of 5;
  - expected spend about $13–$22 for the library (Opus 5.5 batch at $2 / $10 per MTok, about 7.5K input and 4K–8K output per idea).
  - Recorded in plan 09 ("Running it").
- Docs updated:
  - plan `09` (status, as built, running it, answers);
  - `CLAUDE.md` key paths;
  - `RULINGS.md` (a WP90 build-choices row for owner review);
  - stories and progress.
  - No prompt-registry doc table exists; the registry is `convex/ai/prompts/index.ts`, updated in S5.
- Not done, owner-only or blocked here:
  - a live or fixture seed run;
  - the browser check of a seeded and an unseeded idea (the worktree has no Convex deployment of its own);
  - deploying the schema;
  - a PR.

## 2026-11-07 - Small fix: Convex deploy typecheck

- `npx convex deploy` from `main` (by the owner) stopped at Convex's own typecheck (`convex/tsconfig.json`). It found 12 errors, all from `main` (#275). `convex/workspace/employees.test.ts` dynamically imported `lib/workspace/teamHq.ts`, whose `@/` imports that tsconfig cannot resolve. No "Deployed" line was printed, so nothing went live.
- Fix: that one test ("every specialist owns the artifact kinds Team HQ routes to them") moved to `tests/platform/workspace-team-hq-helpers.test.ts`, which resolves `@/`. It narrows with `isSpecialistRoleKey` instead of indexing by `RoleKey`.
- Checks:
  - `npx tsc -p convex/tsconfig.json --noEmit`: 0 errors (was 12).
  - `npm run typecheck`: green.
  - Both test files: 33 pass.
- This lands on `main` with the WP90 merge. Until then, a deploy from `main` still fails this check.
