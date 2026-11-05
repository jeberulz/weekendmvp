# WP68 Progress - Data contract and ops switches

Append-only progress log. Do not rely on chat history for project state.

## Handoff

Pending. This work package is dormant and has not been reviewed or merged.

## Needs from the other lane

- Claude: review C-DATA after S1 and S2 and review C-AUTHZ/C-OPS before merge.
- Claude: confirm whether `site_versions.landingSpec` is serialized validated JSON or a typed Convex object; confirm the schema for wizard answers and per-idea seed payloads before C-DATA freezes.
- Claude orchestrator: update architecture §4.2 and the dated rulings for John's decision that system/admin owner IDs are required on every new row, including library seeds and batch `ai_usage`.
- Claude: in the later image-file writer, enforce required alt text for image kinds; cap the variable arrays in workstreams, Wren memory and ad decisions before activation.
- Claude orchestrator: record John's 2026-11-05 approval that only super-admin ops control functions are exempt from `assertFeatureEnabled`, so activation and shutdown work while the workspace flag is off.

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

## 2026-11-05 - WP68-S3

- Actions taken: opened draft PR #167 for early C-DATA review; added `requireBusinessAccess(ctx, projectId, "owner")` on the existing project ownership helpers, using the expiry-aware mutation helper when a mutation context is passed.
- Checks run: `npx vitest run convex/platform/authz.test.ts` (7 passed, including cross-owner, archived and expired-session cases), `npm run typecheck` (passed).
- Result: C-AUTHZ implemented for owner-only Phase 0; no editor access is active.
- Next: S4 C-OPS, then S5/S6 and final PR gate.

## 2026-11-05 - WP68-S5

- Actions taken: added C-CONNECT SocialConnector and AdsConnector interfaces and a fixture CopyConnector that returns copy-ready content, with no external post or send. The caller will persist the result in WP83 after authorization and approval checks.
- Checks run: `npx vitest run convex/growth/connectors/types.test.ts` (1 passed), `npm run typecheck` (passed), `git diff --check` (passed).
- Result: connector contract fixture ready; native connectors remain dormant.
- Next: resolve the C-OPS control-plane flag rule, then S4 and S6.

## 2026-11-05 - WP68-S4

- Actions taken: added `getOpsSettings`, `assertFeatureEnabled` and `assertWorkspaceCohort`, all failing closed when the singleton is absent. Added super-admin-only settings read/update and cohort change functions, with audit rows and idempotent cohort updates. All runtime switches default off; the AI gate also requires a positive global budget.
- Decisions made: John approved a narrow exemption from the feature gate for super-admin ops controls because the workspace must be activatable and shut off while disabled. Those functions still use the existing server-verified `requireSuperAdmin`; the Claude orchestrator is asked above to record the ruling.
- Checks run: `npx convex codegen --typecheck disable` against isolated local Convex (passed); `npx vitest run convex/ops/settings.test.ts` (3 passed); `npm run typecheck` (passed); focused ESLint and `git diff --check` (passed).
- Result: C-OPS implemented, with no active workspace behavior. No production deployment.
- Next: S6 security matrix, final full gate and Claude review.

## 2026-11-05 - WP68-S6

- Actions taken: added a TypeScript-AST security test in `tests/security/` for the 26 flat owner-indexed tables, direct capability guards on every new public WP68 function, and provider SDK import confinement to `convex/ai/providers/`.
- Checks run: `npm run test:security` passed (149 Node security tests and 121 Vitest security tests), focused ESLint and `git diff --check` passed after correcting a Next.js lint rule on the test variable name.
- Result: S6 complete. No new customer function is active, no new env entry is required, and no provider call runs in tests.
- Next: final full checks and Claude's independent review before handing the WP to John.

## 2026-11-05 - Final local gate and review findings

- Checks run: `npm run typecheck` passed; `npm run lint` passed with 37 warnings and zero errors; `npm test` passed with zero failures across all suites; `npm run build` passed; `npm run test:security` passed (149 Node and 121 Vitest security tests); `git diff --check` passed. The complete WP68 tree deployed successfully to the isolated anonymous local Convex instance on 3310/3311. No cloud target or production data was touched.
- Independent C-DATA review: all 26 named tables and their indexes are present, and existing WP22 amendments are additive. Before contract freeze, Claude should confirm the serialized LandingSpec field, bounded/validated wizard and seed payload shapes, and the owner model for global seed and batch usage rows. Future image-file writes must require alt text; variable arrays need writer caps before activation.
- Decision pending from John: D12 requires an owner ID on every new row, while architecture §4.2 makes `ai_usage.ownerId` optional. Asked whether system-level rows use a system/admin owner ID or a narrow exception. Do not mark C-DATA merge-ready until the answer is reflected in schema and the Claude lane reviews it.
- Result: implementation and local gate complete; PR #167 remains draft for contract review.

## 2026-11-05 - C-DATA owner-ID correction

- Owner decision: John chose a system/admin owner ID on every new row. The earlier S1 note following architecture §4.2's optional usage owner is superseded. `ai_usage.ownerId` is now required; `idea_crew_seeds.ownerId` was already required. The Claude orchestrator owns the architecture and ruling update.
- Checks run: production dependency audit `npm audit --omit=dev --audit-level=high` passed (0 high, 0 critical; 1 moderate). Revalidation of the schema correction is next.
- Result: the D12 ownership ambiguity is resolved in code; C-ART shape questions and Claude's independent review remain open.
- Revalidation: C-DATA schema test (35 passed), static security test (3 passed), typecheck and diff check passed. The corrected schema deployed to isolated anonymous local Convex on 3310/3311 (passed). The earlier full lint/test/build pass predates only this required-field correction; no runtime function changed.
