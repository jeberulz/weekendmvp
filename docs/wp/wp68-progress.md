# WP68 Progress - Data contract and ops switches

Append-only progress log. Do not rely on chat history for project state.

## Handoff

Pending. This work package is dormant and has not been reviewed or merged.

## Needs from the other lane

- Claude: review C-DATA after S1 and S2 and review C-AUTHZ/C-OPS before merge.

## 2026-11-05 - Setup

- Branch/worktree: `codex/wp68-data-contract` in `.worktrees/wp68-data-contract`, from `origin/main` at `68aa05c5`.
- Assignment: WP68, Work Package lane, Phase 0. Story order S7, S1, S2, then S3–S5, then S6.
- File boundaries: `convex/schema*`, `convex/platform/validators.ts`, `convex/platform/authz.ts`, `convex/ops/settings.ts`, `convex/growth/connectors/types.ts`, package files, and new tests.
- Required checks: typecheck, lint, full test, build, schema diff, safe dev Convex deployment, `git diff --check`.
- Initial risks: merges deploy production Convex; new env entries must be optional; table validators must stay flat; all new functionality is off by default. The main checkout has unrelated uncommitted work and stays untouched.
- Inventory note: architecture §2 says `@convex-dev/workpool` is installed, but `origin/main`'s `package.json` does not list it. WP70 explicitly mounts it. No WP68 scope change is made here.

## 2026-11-05 - WP68-S7

- Actions taken: installed the three specified, currently unused dependencies with npm; lockfile updated.
- Decisions made: left `@convex-dev/workpool` for WP70 because it is outside S7's explicit list; the architecture inventory discrepancy is recorded above.
- Checks run: `npm ci` passed before edits; `npm run typecheck` passed; package diff reviewed.
- Result: S7 complete. npm reported 24 existing audit findings (13 moderate, 11 high); no audit fix was run.
- Next: S1 schema modules.

## 2026-11-05 - WP68-S1

- Actions taken: added 26 new tables in flat `workspace`, `ai`, and `growth` schema modules and spread them into `schema.ts`; each has an owner index and the architecture's primary lookup index.
- Decisions made: `ai_usage.ownerId` remains optional as explicitly specified in architecture §4.2; singleton ops settings still carries the admin owner ID. Flexible wizard answers and idea seed payloads use Convex dynamic validators until Claude's C-ART review fixes their shapes.
- Checks run: `npx vitest run convex/wp68Schema.test.ts` (26 passed), `npm run typecheck` (passed), `git diff --check` (passed).
- Result: S1 schema contract ready for S2's additive amendments. No deployment has been attempted; the safe nonproduction target is being confirmed with John.
- Next: S2 WP22 amendments, then C-DATA review PR.

## 2026-11-05 - WP68-S2

- Actions taken: extended the existing project, task, document, site, lead and ledger tables with optional fields; added crew, Studio, document and ledger literals while keeping every prior value. Added owner/workspace slug and owner/job key indexes.
- Decisions made: `site_versions.landingSpec` holds serialized validated JSON until C-ART defines the runtime shape; senders must validate before writing. No phone-number field was added. Existing audit action is a string, so no audit validator change was needed.
- Checks run: `npx vitest run convex/wp68Schema.test.ts` (35 passed), `npm run typecheck` (passed), `git diff --check` (passed); existing `convex/platform/billing/billing.test.ts` passed in the prior focused run.
- Result: S1 and S2 are ready for the early C-DATA PR, subject to the required full checks and isolated local schema check.
- Next: run full checks, validate schema locally, open C-DATA PR for Claude review.

## 2026-11-05 - C-DATA early review gate

- Actions taken: reviewed `git diff origin/main -- convex/schema.ts convex/platform/validators.ts` line by line. Existing tables have only optional fields, new indexes and added union literals; no field, literal, table or index was removed or renamed. New tables are separate flat modules.
- Checks run: `npm run typecheck` passed; `npm run lint` passed with 37 warnings and zero errors; `npm test` passed (all suites, zero failures); `npm run build` passed (455 static page generation targets); `git diff --check` passed. `CONVEX_AGENT_MODE=anonymous npx convex dev --once --local-cloud-port 3310 --local-site-port 3311 --typecheck disable --codegen disable` deployed successfully to the isolated local instance after setting a dummy local-only value for the pre-existing required billing bridge env entry. No cloud or production deployment was touched.
- Result: C-DATA is ready for an early draft PR and Claude contract review. S3–S6 remain open. `@convex-dev/workpool` remains a WP70 dependency request.
- Next: push the branch and open the draft PR, then implement S3–S6 on this branch.
