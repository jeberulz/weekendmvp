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
