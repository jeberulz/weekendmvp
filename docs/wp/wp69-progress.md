# WP69 Progress - Crew contracts and the cost spike

Append-only progress log. Do not rely on chat history for project state.

## Handoff note

Not yet. Written when the WP closes.

## Needs from Codex

These are for WP68 and WP70 schema work. They mirror the WP69 contracts; please import the literals or
copy them exactly.

1. `documents.kind`: the 10 values in `ARTIFACT_KINDS` (`lib/workspace/contracts/artifacts.ts`):
   blueprint, roster_plan, brand_kit, landing_spec, email_sequence, social_pack, seo_pack,
   launch_plan, ads_drafts, build_pack.
2. Task type literals (D19): the 13 values in `JOB_TYPES` (`jobs.ts`): crew_blueprint, crew_roster,
   crew_brand_kit, crew_landing, crew_email_sequence, crew_social_pack, crew_seo_pack,
   crew_launch_plan, crew_ads_drafts, crew_build_pack, crew_hire, studio_image, studio_video.
   Task job keys use the form `crew:{projectId}:{type}:{subject}:{revision}`. Dedupe applies to
   live tasks only.
3. `ai_usage` fields beyond `02` §4.2, as in `AiUsageRow` (`metering.ts`):
   - attemptKey (unique, indexed)
   - dayKey
   - expiresAt
   - feature, plan?, globalPool (free|paid)
   - creditFunded, creditDebitId?
   - batch?, escalation?, reask?
   - sentAt?, finalizedAt?, sweptAt?
   - billed?, errorClass?, lateCostMicroUsd?
   The sweep reads `expiresAt`: 15 min realtime, 25 h batch.
4. `ai_budgets` fields, as in `AiBudgetsRow`: freeReservedMicroUsd and dayEscalations, added to the
   §4.2 set (freeLifetimeSpent, reserved, dayKey, daySpent).
5. `ops_settings.paidGlobalDailyBudgetMicroUsd`, a second global pool next to the existing global
   budget. The sharded global counter needs a free and a paid key, and it counts in-flight
   reservations as well as spend.
6. `PLAN_LIMITS` feature keys: `WORKSPACE_FEATURE_KEYS` (autopilot, adsLive, nativePublishing,
   customDomain, studioLongVideo, hireSkippedRoles), with per-plan values in
   `WORKSPACE_PLAN_REFERENCE`.
7. The C-METER implementation adds a `markSent` mutation, `attemptKey` idempotency on `reserve`, and a
   plan derived inside `reserve`. A `creditDebitId` is checked against the same owner and task.
8. Add `ANTHROPIC_API_KEY=` (empty, optional) to `.env.example`, with a comment saying the WP69 spike script and WP71 gateway read it. `tests/security/env-documentation.test.mjs` scans `scripts/`, so the WP69-S4 spike scripts can't be committed until this is in.
9. Type `wizard_sessions.answers` from `wizardAnswersSchema` (`lib/workspace/contracts/wizard.ts`), and store `parse()` output only. Assert that the validator accepts `wizardAnswersSchema.parse(hydrotrailWizardAnswers)`. `answers.idea` is the source of truth; any session-level `ideaSlug` must equal it.
10. Throw gate errors in the shapes `isWorkspaceGateErrorData` accepts. `AI_DISABLED` carries a `scope` that is absent or a `METER_FEATURES` value.

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

## 2026-11-05 - WP69-S2 (job, prompt and metering contracts) - done

- Files: `lib/workspace/contracts/{jobs,prompts,metering}.ts`,
  `tests/platform/workspace-jobs-contracts.test.ts`. Author: Opus. Reviewer: Opus (diff + contract).
- Review: 15 findings (4 high). Decisions sent to the author:
  - `extra_social_pack` is always paid (it was free at round 0).
  - Job key gains a subject discriminator (`crew:{projectId}:{type}:{subject}:{revision}`). changeRound
    is derived server-side from prior non-failed revisions. Failed rounds don't use a free round.
  - Batch reservations: `batch` flag, `expiresAt`, 25 h sweep horizon, settle by `custom_id` = usageId.
  - Global budget is a soft check (bounded overshoot, reservations counted). Owner checks are exact.
    Separate free and paid global budgets (paid default $50, provisional, owner to confirm). `dayKey`
    on the usage row.
  - Fail closed on missing owner rows and on NaN or negative state.
  - `reserve` derives the plan itself. A `creditDebitId` replaces the `creditFunded` boolean.
  - `attemptKey` makes reserve idempotent. `markSent`/`sentAt`: the sweep charges the worst case only
    for calls that were sent.
  - A late settle records `lateCostMicroUsd` and adds the difference to the totals.
  - The gateway sends no server-side fallbacks (a refusal fails and refunds the job, `02` §5.8).
  - `purpose: escalation | eval_judge` on deep realtime specs.
  - Worst-case reservation is at least 1 micro-USD.
  - `creditCostFor` takes `plan` and throws `PLAN_GATED`.
  - Separate Free lifetime reservations.
  - Per-tier input caps. Escalation and re-ask flags. 3 escalations per owner per day (provisional).
  - Media reservation helper.
- Repair result: all 15 applied. Fallbacks finding: the claude-api skill says server-side fallbacks are
  opt-in per request (param + beta header), so `PromptSpec.fallbacks: "none"` is required and the gateway
  never sends the param. Ownerless work (precompute, evals) counts against the free global pool for now.
  New provisional caps: `MAX_RESERVATION_MICRO_USD` $2, 3 deep escalations per owner per day.
- Checks (orchestrator re-run): vitest on `workspace-jobs-contracts.test.ts` 50 passed; eslint on the
  four files exit 0; `tsc -p .` shows no errors in S2 files (remaining errors are S1 mid-repair, untracked).
- Owner questions raised by this story (not invented in code): paid global budget amount; whether
  seed precompute counts against the global budget; prices for the five job types without one; short
  video at 35 credits or 6 s clips.

## 2026-11-05 - WP69-S1 (artifact schemas) - done

- Files: `lib/workspace/contracts/artifacts.ts`, `fixtures/hydrotrail.ts`,
  `tests/platform/workspace-artifacts.test.ts` (plus bounds in `roster.ts`). Author: Opus. Reviewer: Opus.
- First pass: 61 tests passed, eslint clean. Review: 16 findings. Decisions sent to the author:
  - Fixed shapes become keyed objects so the output grammar enforces them: palette roles, the 4 emails,
    build-pack phases × prompts, landing slots (the renderer owns the order), social posts by day.
    Limits go into field descriptions. Zod stays the post-parse check, with one re-ask.
  - Markdown fields: CommonMark, raw HTML off, https/relative links only, never MDX. Prompt bodies are
    plain text.
  - Proof is never published in v1: workspace-only slots with bracketed placeholder text; `rating` added.
  - `BRAND_TEXT_PAIRS` (ink/ground, primary/ground, ground/primary, ground/ink). Accent is never text.
  - Blueprint is a union on `source`; own ideas carry no market data (D15).
  - Ads: USD only; the budget and cap are platform-set from the founder's paid push.
  - Social: `caption` + `shortCaption` and per-platform limits.
  - Email: first-name fallback "there"; the platform owns the opt-in email; delays count from
    confirmation; optional CTA; no URLs in bodies. Privacy text is platform-owned (D5).
  - Control characters banned; size test under 256 KiB.
  - Build-pack variant of prompt standard v1: setup rules on `scaffold.first`; the light pack is
    exempt from "no billing".
  - `artifactJsonSchema(kind)` rewrites oneOf to anyOf.
  - Strict URL checks.
  - Roster plan bounded.
  - Emphasis must end the text.
  - The launch link is split into site path or workspace page.
  - Every landing page keeps a waitlist (v1 sites have no checkout).
- Repair result: all 16 applied. Structured-outputs limits checked against the live docs: no length,
  numeric or maxItems keywords; minItems only 0 or 1; anyOf yes, oneOf and `\p{}` undocumented (treated as
  unsupported); 24 optional and 16 union parameters per request. `artifactJsonSchema(kind)` strips the
  unsupported keywords and rewrites oneOf; zod keeps every limit as the post-parse check.
  Every kind fits those limits (largest: landing_spec 15 optional, 1 union).
- Author decisions accepted: FAQ section dropped (can return as an optional slot); launch links keep the
  `artifactKind` variant; blueprint and build pack export per-variant schemas so the gateway sends a
  single-object schema; URLs need a dotted host; email bodies reject bare domains.
  `PLATFORM_CAPTION_LIMITS` values are marked unverified.
- The fixture's `scaffold.first` passes the repo's own `lintPrompts` (setup rules).
- Checks: 142 artifact tests + 36 role tests pass; `tsc -p .` exit 0; eslint clean on the touched files.

## 2026-11-05 - Full checks before the contract PR

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 (37 warnings, all in files this WP does not touch).
- `npm test`: exit 0. All 13 suites pass; `test:platform` 37 files / 680 tests, including
  `workspace-artifacts` and `workspace-jobs-contracts`. `test:convex` includes `crew/roles.test.ts`.
- `npm run build`: exit 0 (no errors or warnings in the output).
- Docs updated: `wp69-stories.md`, this file. `02`, `03` and `05` unchanged; S5 updates `03` after the spike.

## 2026-11-05 - Contract follow-ups from the WP68 cross-check

- Files:
  - `metering.ts`: micro-USD int64 boundary helpers, gate error codes (incl. `UNAUTHENTICATED`) with
    guards and a refund table.
  - `artifacts.ts`: header note on `seo_article`.
  - `wizard.ts` (new): 8-step answers schema, progress variant, `rosterInputFromWizard`.
  - `roster.ts`: `singleLineText` rejects invisible and bidi characters; target count capped.
  - Fixtures, and the roles and contract tests.
- Review: independent Opus review, 1 high and 5 medium findings, all fixed.
  - The goal target is derived from the goal kind (`GOAL_TARGETS`), not answered.
  - A finished wizard requires `looks_good`.
  - `paidPush` lives under `goal`.
  - Gate errors have shapes and guards.
  - Convex storage keeps only `parse()` output.
- Orchestrator decisions: non-Latin business names allowed (names dedupe on the slug, else on the NFKC
  name); `UNAUTHENTICATED` is a gate code.
- Checks:
  - `npm run typecheck`: exit 0.
  - `npm run lint`: exit 0 (37 pre-existing warnings).
  - `npm test`: exit 1, from the uncommitted spike files only. `test:security` fails
    `env-documentation`: `ANTHROPIC_API_KEY` is not in `.env.example` (Needs from Codex item 8).
  - Every suite after `test:security` passes when run separately (sitemap, convex, engine, editorial,
    home, prompts, platform, live).
  - The committed tree has no spike files.

## 2026-11-05 - S4 finding: two schemas too large for structured outputs (C-ART fix)

- Live spike, config A: every `landing_spec` and `social_pack` call was rejected with HTTP 400 "The compiled
  grammar is too large" (billed $0). Spike paused at $1.84.
- Cause, from 11 live probes:
  - Social: 7 inlined copies of the post schema (8.3 KB).
  - Landing: the `proofSlots` 5-way union array.
  - Neither the optional count nor patterns caused it.
  - The API also rejects `$defs` beside a root `anyOf`, and rejects the combined build_pack union.
- Fix in `artifacts.ts`, with the stored shape unchanged for every kind:
  - Model-facing schemas use local `$ref`s.
  - Landing gets a draft schema without `proofSlots`; code adds the placeholder slots.
  - `parseModelOutput(kind, raw, existing?)` is the single entry point for model output.
  - Union kinds (blueprint, build_pack) only go out through `artifactVariantJsonSchema`.
  - Per-schema byte ceilings: ≤ 7,000 B; the smallest live rejection was 8,288 B.
  - Anchors and `imageAlt` rules are spelled out in the field descriptions.
- Independent Opus review: no high findings; M1 (proof slots never added) and M2 (combined union still
  obtainable) fixed, along with the low findings.
- Probe spend: $0.24 (separate ledger, $0.50 cap). Every one of the 19 schemas the spike sends compiled
  live. A full landing and social call each parsed first try.
- Checks:
  - typecheck: exit 0.
  - lint: exit 0.
  - `test:platform`, `test:convex`, `test:prompts`: exit 0 (296 contract tests).
  - `tsc -p scripts/spikes`: exit 0.
  - Full `npm test` is still blocked only by the uncommitted spike files (Needs from Codex item 8).

## 2026-11-05 - S4 done; S5 recorded, freeze pending owner

- Live spike finished: $5.72 of the $25 cap; results in `docs/wp/wp69-spike-results.md`.
- Typical free launch measured at $0.57 (config A), under the $0.75 target. Config A stays: Haiku social
  and email scored 0.32 below Sonnet, past the 0.3 rule.
- Rows more than 30% off: launch plan (+96%), social on Sonnet (by design), OpenAI images (+77% logos,
  +37% hero), seeds (-77%, good news).
- Credit rule fails for brand kit regenerate and the standard offer image with either image provider.
  Proposals sent to the owner (3 credits offer image, 11 brand kit regenerate, Recraft default).
- Measured values written into `03-ai-cost-model.md` §1, §3, §4, §7, including the Sonnet cache-read price
  correction ($0.10).
- Not measured: Recraft (no credits, plus a spike bug on hero size), video (no provider), chat and change
  rounds.
- Added proposed S6 (visual system in C-ART) from the landing design brief (`07-landing-design.md`).
- Docs updated: `03-ai-cost-model.md`, `wp69-spike-results.md`, stories, this file. No code changed.
