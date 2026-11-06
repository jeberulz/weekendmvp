# WP75 Stories - Crew engine: roster, launch workflow, brand, landing, build pack

Branch: `claude/wp75-crew` (worktree `.worktrees/wp75-crew`, cut from `origin/main` at `d0f6e572`). The WP67 board
row says `claude/wp75-crew-engine`; the board should be corrected.
Lane: Work Package (Claude lane, high), inside the WP67 Program/Migration lane
Plan: `docs/plans/launch-workspace/04-build-plan.md` (WP75; contracts C-JOBS, C-LEDGER, C-APPROVAL, C-LIMITS, C-OPS,
C-AUTHZ, C-DATA, C-CONNECT; Gate G2), `02-architecture.md` §5 (gateway, prompt layout, tiers), §6.1–§6.4 (roster,
launch workflow, revisions, build pack), §9 (renderer), §13, §14, §16; `03-ai-cost-model.md` §3; `07-landing-design.md`
§2, §4, §5; `06-decisions.md` D2, D3, D4 (+ amendment), D5, D11, D13, D15, D17, D19, D21, D23 (D24, D25 proposed)
Owns: `convex/crew/**` (except `convex/crew/seeds.ts`, WP71-S5), `convex/ai/prompts/{blueprint,brand,landing,buildpack,quality,policy}*`,
`convex/ai/imageActions.ts` (new, see S3b), `app/site/**`, `components/tenant-site/**`, `lib/workspace/crew/**` (new,
pure helpers), workspace pages Team HQ, Brand kit / Brand Book, landing review and Build pack under
`app/(launch-workspace)/dashboard/b/[projectId]/**` and `components/workspace/**`
Depends on: WP71 (gateway action #192; S4 cache helper, S5 seeds and S6 evals still open), WP73 (#179), WP74 (#208,
merged as draft), WP77-S1 (C-APPROVAL #203). WP76 starts after S2b merges.
Definition of done (`04` WP75 acceptance):
- a fixture launch for HydroTrail produces every WP75 artifact (roster, blueprint, brand kit + 3 logo marks, landing
  spec, build pack) and one `artifact_review` approval for each;
- a live run on 5 ideas stays within the spike's cost (owner OK first; see progress "Live spend");
- a11y-check passes on every new page and on the tenant renderer.

Standing rules:
- Ship dormant. Every public function calls `assertFeatureEnabled` (C-OPS) and `requireBusinessAccess` (C-AUTHZ);
  every crew action is internal and starts from a mutation that already authorised the caller (`02` §14). Pages 404
  with the flag off. Schema, `package.json`, `convex/crons.ts`, `convex/platform/**`, `middleware.ts`, `app/api/**`
  are Codex's: request changes in the progress file.
- Every model or image call goes through the WP71 gateway with a C-METER `job` attempt key
  (`{jobKey}:{attempt}`, `jobKey = crew:{projectId}:{type}:{subject}:{revision}` from C-JOBS `jobKey()`). No other
  key form is used by WP75 generators. Fixture mode in every test; never a live call from tests or CI.
- No model tool loops (D23). Vendored data is looked up in TypeScript before the call; checks run after it.
- The model never writes HTML; founder text and seeds are data blocks, never instructions (`02` §5.8).
- Every stored artifact is parsed with its C-ART schema first and written through `assertGeneratedDocumentBody`.
- Every new prompt spec is registered in `convex/ai/prompts/index.ts` and locked with `npm run check:prompt-versions`.
- No `any`, no `console.log`, no inline styles. WCAG 2.1 AA; a11y-check on every changed screen.
- One reviewable commit per story (about 1,500 lines at most). Suffixes (S2a, S2b, ...) split a plan story that is
  bigger than that; each suffix is its own commit and review.

## Story map

| Plan story | Split | Why split |
|---|---|---|
| S1 roster | S1 | Fits one commit |
| S2 launch workflow | S2a job runner, S2b launch DAG | The single-step runner (attempts, retry classes, finishing a step) is reviewable alone and is what WP76 reuses; the DAG on `crewWorkpool` is a second concern |
| S3 generators | S3a blueprint + brand text, S3b logo marks, S3c landing spec, S3d build pack | Four prompts, four artifacts, one new image action; together well over 1,500 lines |
| S4 quality | S4a deterministic checks, S4b quality + policy prompts and the repair call | S4a is pure and has no dependencies, so it can start first; S4b wires model calls |
| S5 renderer | S5a sections and directions, S5b tenant route and waitlist form, S5c CI render matrix | S5c waits on Codex dependencies; S5a is large UI |
| S6 pages | S6a Team HQ + Meet your co-founder roster, S6b Brand kit + Brand Book, S6c landing review, S6d build pack | Four pages, each a separate a11y pass |

## Stories

- [x] `WP75-S1` - Roster at "Meet your co-founder". Built 2026-11-06; design, plan vs reality and checks in
  `wp75-progress.md` § WP75-S1. No roster card (owner ruling Q13, `docs/wp/RULINGS.md`).
  **Ship gate:** do not switch S1 on in production until Codex Need 13 (the cron calling
  `internal.crew.jobs.recoverStaleCrewRuns`) is registered. Without it, a blueprint action that dies leaves the
  founder on "putting your team together" with no way out.
  - Scope: `convex/crew/roster.ts` (new), `convex/crew/roster.test.ts`, the roster list in
    `components/workspace/wizard/MeetCofounder.tsx`.
  - `startLaunch({ projectId })` (public mutation; `assertFeatureEnabled("workspace")`, then `"ai"`;
    `requireBusinessAccess(owner)`), called from Meet your co-founder after `createBusiness` returns. It does not
    change `convex/workspace/business.ts`. Idempotent: a second call returns the existing roster and launch.
  - Builds `RosterInput` with C-WIZARD `rosterInputFromWizard(answers, blueprint)` and runs `planRoster`
    (`convex/crew/roles.ts`, `ROSTER_RULES_VERSION`). **Profile source ruled 2026-11-06: blueprint first**
    (`docs/wp/RULINGS.md`). `startLaunch` starts the blueprint step (S3a's `crew_blueprint` job through S2a's runner)
    and returns; the roster is planned in the blueprint step's finish, from the stored blueprint's `profile`. Until
    then Meet your co-founder shows "putting your team together"; a failed blueprint shows a retry and writes no
    roster. S1 therefore lands after S2a and S3a's blueprint half.
  - Runner mode (S2a review N1): `startLaunch` schedules the blueprint step as `runCrewStep` in schedule mode (the
    default, no `retryMode`). Retries are re-invoked by S2a itself: `settleCrewRun` schedules them in the transaction
    that closes the run. If the action dies, nothing re-invokes it: `recoverStaleCrewRuns` (cron, Codex Need 13)
    fails the task after the 11-minute lease with "interrupted, try again", refunding a debit by the usual rule. Meet
    your co-founder then shows the failed-blueprint retry; retrying inserts a new first draft (`createCrewTask`).
  - Writes, in one transaction: a `crew_roster` task (status `succeeded`, no gateway call, job key revision 0),
    `roster_plans` (`rulesVersion`, `hired` role keys, `skipped[{roleKey, reason}]`), one `crew_members` row per hired
    role (`status: queued`, `hiredBy: rule`, `autopilot: false`) and per skipped role (`status: skipped`), a
    `documents` row kind `roster_plan` (format `json`, full `RosterPlan`), and one `workstreams` row per hired
    specialist. Then hands off to S2b (until S2b lands, it stops here).
  - Acceptance (fixture, convex-test): HydroTrail gives 9 hired / 4 skipped with the C-ROSTER reasons; a course idea
    gives a different team; replay returns the same rows; non-owner, signed-out, archived business, workspace off
    and AI off all refuse with no writes; the scanner (`tests/security/wp68-workspace-boundaries.test.mjs`) accepts
    the new function. The roster list on Meet your co-founder renders hired and skipped roles with reasons and passes
    axe.

- [x] `WP75-S2a` - Crew job runner (one step). Built 2026-11-06; design, Needs and checks in `wp75-progress.md` § S2a.
  - Scope: `convex/crew/jobs.ts` (task lifecycle mutations), `convex/crew/runner.ts` (internal action),
    `lib/workspace/crew/retry.ts` (pure classification), `convex/ai/providers/fixtureOutputs.ts` (new; see below),
    tests.
  - **As built** (the review rounds replaced the first design; `wp75-progress.md` § S2a has the detail, and where
    this story and the progress doc disagree, the progress doc wins):
    - `insertCrewTask` inserts first drafts only (round 0, `creditCost: 0`, no debit), built by `planFirstDraft`.
      It builds `jobKey()`, dedupes live work through `tasks.by_ownerId_and_jobKey`, and checks
      `checkLimit(ctx, "crewJob", ownerId)` (C-LIMITS; semantics open, progress Stop-and-ask 10).
    - Revisions come only from WP77's `insertRevisionTask`, which prices the round and writes the debit.
      Callers never pass a debit id: `startCrewRun` reads `task-debit:{taskId}` on the server, and a priced task
      with no debit fails as `unpaid`.
  - Attempt numbers: one `workflow_runs` row per execution of a task (`type` = the task's job type, which
    `WORKFLOW_TYPE_VALUES` already allows; `idempotencyKey = run:{taskId}:{n}`; `attempt` holds the next gateway
    attempt number; `errorCode` holds the retry class). Every provider call of the task (text, re-ask, logos, quality,
    repair) takes the next number and stores the gateway's `nextAttempt` back, so `{jobKey}:{attempt}` is never
    reused. No schema change needed (progress Stop-and-ask 5).
  - `runCrewStep` (internal action) calls `internal.ai.gatewayActions.runPrompt` with
    `attemptKey: { kind: "job", jobKey }`, `ownerId`, `projectId`, `taskId`, the server-read `creditDebitId` when the task is priced, and the
    per-business context block (`02` §5.4).
  - Retry classes (`02` §6.2, WP26 classes), owned by the runner, never by workpool retries (`retry: false`):
    - retryable and unbilled (`provider` with `retryable: true`, `billed: none`; `duplicate_attempt` with
      `key_reused_for_different_call` after moving to `nextAttempt`): up to 2 runner retries with backoff;
    - indeterminate (`billed: possible`, timeout): one retry, cost already charged worst case by the meter;
    - permanent (`config`, `refusal`, `schema_invalid` after the gateway's one re-ask, `internal`): task `failed`,
      refund through `refundFailedTask` only when a debit exists;
    - parked (`meter_refused` `AI_DISABLED`, `WORKSPACE_DISABLED`, `BUDGET_EXHAUSTED`): task `blocked`, employee
      `needs_you` with a calm reason; resumed by the founder or the next launch tick, never auto-looped;
    - closed (`meter_refused` `RESOURCE_NOT_FOUND` on a terminal task): stop, no refund (gatewayActions.ts notes).
  - `finishCrewStep` (internal mutation, one transaction): re-parses the output with the C-ART schema, writes the
    `documents` row (kind, `format: json`, `taskId`, `promptRef`, `schemaVersion: "1"`, `contentSha256`,
    `supersedesDocumentId` for revisions), marks the task `succeeded`, sets the employee `needs_you`, links the
    workstream (`documentIds`, `askApprovalId`), and raises the card with `createApprovalRecord` (kind
    `artifact_review`, subject `documents`/document id, `changeRound` = the task's round). Approval and the
    subject link are written in the same mutation (WP77 contract rule).
  - Fixture outputs: the registered `runPrompt` in fixture mode returns the smallest schema instance
    (`providers/fixtures.ts:119`), which fails C-ART refinements. Add a fixture-output registry keyed by `promptRef`
    that the default fixture client consults (HydroTrail artifacts from `lib/workspace/contracts/fixtures/hydrotrail.ts`,
    a generic fallback per kind). Live mode never reads it. (Progress Stop-and-ask 3.)
  - Revisions (as built): the runner takes no revision arguments. `startCrewRun` reads the revised draft from the
    task's `revisionOfTaskId` and the founder's note with `revisionNoteFor`, both on the server, and passes the note
    as a quoted data block. A revision whose draft is missing fails before any run opens. The trigger and round
    pricing are WP77-S2's.
  - Wren cards: posting a chat card on finish needs WP77-S3's chat module. Until it lands, the approval row is the
    card (Team HQ and the dashboard list read `listPendingApprovals`).
  - Acceptance (fixture, convex-test with the real meter and ledger, like `tests/platform/ai-gateway-action.test.ts`):
    a step runs reserve → sent → settled and writes one document and one pending `artifact_review`; replay of the
    same job key is a no-op; each retry class takes its path (scripted fixture adapter); attempt numbers are unique
    across a re-ask and a retry; a refusal fails the task with no further provider call; a parked step makes zero
    provider calls; kill switch on with live mode and a fake key makes zero fetch calls.

- [x] `WP75-S2b` - Launch DAG on `crewWorkpool`
  - Built 2026-11-06 (`docs/wp/wp75-progress.md` § WP75-S2b). As built: only the blueprint, roster and brand kit
    text run; the other steps are slots that read `skipped` with a reason. The 5-minute landing-spec timing check
    moves to S3c. Steps run as `runCrewGeneratorStep` (server-built inputs). In a launch the brand kit briefs from
    the launch's own first-draft blueprint (RULINGS 2026-11-06, "WP75-S2b brand-kit brief in a launch").
  - S3a hand-off: every brand-kit step must be prepared through `convex/crew/generators.ts`, so it carries
    `briefDocumentId` and `seedId`. `finishCrewStep` re-checks the approved blueprint only for a step that carries
    `briefDocumentId`; a step that builds its own inputs skips that check.
  - Scope: `convex/crew/launch.ts`, `convex/crew/steps.ts` (step registry), `convex/crew/workpool.ts`, tests.
  - Uses the mounted `crewWorkpool` (`convex/convex.config.ts:63`) through `@convex-dev/workpool` `Workpool`:
    `enqueueAction(internal.crew.runner.runCrewStep, …, { retry: false, onComplete: internal.crew.launch.stepDone })`.
    `stepDone` advances the DAG in a mutation. `@convex-dev/workflow` is not used: 0.4.4 runs its own internal pool
    and cannot use `crewWorkpool` (progress Stop-and-ask 4).
  - Runner mode and re-invoker (S2a review N1): every step is enqueued with `retryMode: "return"`; the workpool's
    own retries stay off. `stepDone` is the re-invoker:
    - `retry` outcome: re-enqueue the same step after the returned `delayMs`.
    - `skipped: in_flight`: re-enqueue after `RUN_LEASE_MS`.
    - Action failure (it died or timed out, so the run may still be open): re-enqueue after `RUN_LEASE_MS`. The
      next `startCrewRun` closes the abandoned run and applies the same indeterminate decision recovery uses.
    - `skipped: terminal` or `failed`: treat the step as failed.
    - `parked`: wait for `resumeLaunch`, which re-enqueues with `resume: true`.
    `recoverStaleCrewRuns` runs too. Whichever of it and the delayed re-enqueue comes first settles an abandoned
    run, and the other finds nothing to do. Recovery fails the task, because it has no step inputs to retry with.
    `workflow_runs` cannot record the mode without a schema change, so recovery never leaves a run for `stepDone`.
  - DAG (`02` §6.2, reordered by the 2026-11-06 roster ruling): blueprint → roster (S1) → {brand kit text → logo marks ×3 → landing spec; build pack; WP76 slots:
    launch plan, SEO pack, email sequence, social pack, ads drafts}. The registry lists every step with its job type,
    employee, inputs and parents; WP76 steps are present as `pending_wp76` and finish as `skipped` with a reason until
    WP76 registers its generators.
  - Concurrency: global `maxParallelism` on the pool; per-owner cap 3 enforced in `stepDone`/`startLaunch` (enqueue
    only while the owner has fewer than 3 running crew tasks), because workpool has no per-key parallelism.
  - Idempotency: each step's task is keyed by its revision-0 job key; re-entering the launch never duplicates work.
  - Acceptance (fixture, convex-test with `@convex-dev/workpool/test` registered): a HydroTrail launch runs every
    WP75 step in order with at most 3 concurrent tasks per owner; a failed parent leaves children `queued`, not run;
    a parked step resumes on `resumeLaunch`; replaying `startLaunch` creates nothing new; the landing spec is ready
    in the fixture timeline before the 5-minute target (`02` §6.2).

- [x] `WP75-S3a` - Blueprint personalisation and brand kit text
  - Built 2026-11-06 (`docs/wp/wp75-progress.md` § WP75-S3a). The repair step waits for S4b (Owner Q6/Q7):
    until then a hard quality issue fails the step closed, and S4b plugs in through the runner's `repairArtifact`
    seam (`convex/crew/runner.ts`, default `noArtifactRepair`).
  - S4b note (S3a review): the seam's attempt contract is one gateway run starting at `CrewRepairInput.attempt`
    (`result.nextAttempt`); a repair that throws is settled one `UNKNOWN_OUTCOME_ATTEMPT_STRIDE` later. If S4b's
    repair needs more than one gateway run, it must report the highest attempt it used so the runner settles after
    it (`TODO(S4b)` in `runner.ts`).
  - Scope: `convex/ai/prompts/blueprintPersonalise.v1.ts`, `blueprintOwnIdea.v1.ts`, `brandKit.v1.ts`,
    `lib/workspace/crew/design/proMax.ts` + vendored data (MIT, attribution kept), `lib/workspace/crew/context.ts`
    (business context block), registry and lock entries, tests.
  - Blueprint: `draft` tier, job type `crew_blueprint`, structured output with the C-ART variant schema per source
    (library or own idea; own ideas carry no `market` and keep the "Not yet validated" label, D15). Inputs: the seed
    (`idea_crew_seeds` when WP71-S5 has run; the fixture seed until then) and the parsed wizard answers.
  - Brand kit: `draft` tier, job type `crew_brand_kit`, C-ART `brandKitSchema`. Before the call, TypeScript looks up
    Pro Max palettes, type pairs and a landing pattern for the idea's product type, filtered through the bans in `07`
    §4, and adds `typePairBrief()` (`07` §2B). After the call, S4a's checks run, including `failingTextPairs` (AA
    4.5:1 on every `BRAND_TEXT_PAIRS` pair); a failure goes to the one repair call (S4b).
  - Acceptance: specs pass `definePromptSpec` and the version lock; fixture runs store a valid blueprint and brand kit
    with their approvals; a kit with a failing pair is repaired once and then stored or failed per the ruled policy;
    no prompt text contains founder text outside a data block.

- [ ] `WP75-S3b` - Logo marks ×3 (Recraft) and the image gateway action
  - Scope: `convex/ai/imageActions.ts` (new internal action binding `runImageGateway`, `convex/ai/gateway.ts:1164`,
    to the real meter, with `gatewayEnv` widened to `RECRAFT_API_KEY` only), `convex/crew/logos.ts`, tests.
  - Same task and job key as the brand kit (`crew_brand_kit`); each render takes the next attempt number; media prompt
    ref `brand-logo-mark@1` (media refs are not registry specs; the prompt text is built in code from
    `brandKit.logo.markDescription` and the palette); provider `recraft`, size `1024x1024`, tier `image`.
  - No `styleId` by default: `RECRAFT_STYLE_ID` is Weekend MVP's own OG style and must not be applied to founder logos
    (progress Stop-and-ask 12).
  - Storage: PNG bytes → `ctx.storage.store` → `business_files` (`kind: logo`, `mime: image/png`, `bytes`,
    `alt` from `brandKit.logo.alt`, required in code, `sourceTaskId`). A URL result is refused (we never fetch a
    provider-supplied URL). The brand kit's `artifact_review` is raised only after all three marks are stored, so one
    card covers text and marks.
  - What "3 marks" means (three alternatives or one mark on three grounds) and where a pick is stored are open
    (progress Stop-and-ask 14).
  - Acceptance (fixture): three `ai_usage` rows settled with distinct attempt keys; three `business_files` rows with
    alt text; a failed render fails the brand kit step by its retry class with no orphan approval; a non-PNG reply is
    `invalid_output`.

- [ ] `WP75-S3c` - Landing spec with waitlist
  - Scope: `convex/ai/prompts/landingSpec.v1.ts`, `convex/crew/landing.ts`, tests.
  - `draft` tier, job type `crew_landing`, structured output `landingSpecDraftSchema` (the model never drafts proof
    slots). Code stores `withDefaultProofSlots(draft)` (`artifacts.ts:1347`), so proof exists only as bracketed
    placeholders with `placeholder: true`. Inputs: blueprint, brand kit (voice, direction, allowed layouts from
    `DIRECTION_LAYOUTS`), the curated `LANDING_ICONS` list. The waitlist section is required by the schema.
  - After the call: `checkLandingAgainstBrandKit(spec, kit)` plus S4a's checks; any issue goes to the one repair call.
  - Storage: `documents` kind `landing_spec`. The site version (`site_configs` + `site_versions`, status `ready`,
    `documentId`) is written only after Codex rules who writes it and which field holds the spec (progress
    Stop-and-ask 6). Until then the `artifact_review` subject is the document.
  - Acceptance (fixture): stored spec parses with `landingSpecSchema`, has a waitlist and only placeholder proof; a
    layout the direction forbids triggers exactly one repair; the approval exists.
  - Capacity note (S2b review): `crewWorkpool` runs at most `CREW_MAX_PARALLELISM` = 10 actions across all owners,
    with 3 per owner (`OWNER_CREW_CAP`). The "landing spec ready within 5 minutes" target moved here from S2b, so it
    needs the maths before S3c ships. Work out the blueprint, kit and landing-spec latencies on the critical path,
    then how many launches start at once at peak. Above about 3 concurrent launches, 10 slots queue launches
    behind each other. Raise the parallelism, or state the target as an uncontended one.

- [ ] `WP75-S3d` - Build pack (compile + personalise, standard v1)
  - Scope: `convex/ai/prompts/buildPackFull.v1.ts`, `buildPackLight.v1.ts`, `lib/workspace/crew/promptStandard.ts`
    (a TypeScript port of the per-prompt rules in `scripts/lib/prompt-standard.mjs`, applied per build prompt),
    `convex/crew/buildPack.ts`, tests.
  - `draft` tier, job type `crew_build_pack`, one spec per weight (`buildPackVariantSchemas`; the union does not
    compile as one grammar). Weight from the roster (`engineering.weight`). Inputs: the idea's four existing prompts
    (seed `buildPackSeeds`; fixture for HydroTrail until WP71-S5; own ideas start from the blueprint only), the brand
    kit's DESIGN.md export (`07` §2C) and the stack.
  - Every prompt must pass the ported standard v1 rules before the document is saved: `Do not build:` and
    `Done when:` lines, no billing, one login, at most three outside services (also enforced by the schema), no
    Next.js major pin, no code fence. A failing prompt triggers the one repair call (`02` §6.4). How the four-title v1
    standard maps onto eight prompts, and whether light packs may mention checkout, are open (progress
    Stop-and-ask 8).
  - Acceptance (fixture): HydroTrail full pack stores 8 numbered prompts (`buildPackPrompts`) that all pass the port;
    a course idea stores a light pack; a fixture prompt with billing triggers one repair; the port agrees with
    `lintPrompts` on the four HydroTrail idea prompts (shared fixtures).

- [x] `WP75-S4a` - Deterministic quality and "never fake it" checks
  - Scope: `lib/workspace/crew/checks/*.ts` (pure, no Convex imports), tests. Reusable by WP76.
  - Checks over every string in an artifact (JSON walk): never-fake-it patterns (testimonials, star ratings and
    "4.9/5", "trusted by", user and customer counts, "as seen in", press names, invented statistics); market numbers
    in own-idea artifacts (reuse the light-blueprint claim detector); copy-slop lexicon and triads (`07` §2B); heading
    lengths against display limits; no eyebrow; enums valid for the chosen direction (`checkLandingAgainstBrandKit`);
    brand contrast (`failingTextPairs`); build prompts (S3d port).
  - Output: `{ hard: Issue[], soft: Issue[] }` with paths that `safeIssuePath`-style redaction can show to the repair
    call as data.
  - Acceptance: table tests for every pattern with positives and negatives (no false positive on product units, years,
    bracketed placeholders, or "5k" race names); HydroTrail fixture artifacts pass clean.

- [ ] `WP75-S4b` - Quality prompt, the one repair call, and the policy prompt
  - Scope: `convex/ai/prompts/quality.v1.ts`, `convex/ai/prompts/landingPolicy.v1.ts`, `convex/crew/quality.ts`,
    runner wiring, tests.
  - After each generation: S4a checks, then one `fast`-tier `quality@1` call (structured issues list; same job key,
    next attempt; cost model `03` §3 "quality checks, one per artifact"). If any issue: one repair call on the same
    generator spec with the issues as a data block (next attempt). Repair tier (same `draft` spec vs a capped `deep`
    escalation spec with `purpose: "escalation"`) and the outcome after a failed repair are owner questions (progress
    Owner questions 6, 7).
  - Policy prompt for WP78-S1 (`fast` tier; scams, adult, weapons, medical claims, impersonation; `02` §9):
    spec, schema and fixture only in WP75. Which C-METER key form a publish-time call uses is open (progress
    Stop-and-ask 2); the contract shape is proposed to Codex for acknowledgement.
  - Acceptance (fixture): exactly one repair per failing artifact, never two; repair output is re-checked; the gateway's
    schema re-ask and the quality repair are counted separately and both use fresh attempt numbers; worst case per
    artifact is 4 calls; policy spec registered and locked.

- [x] `WP75-S5a` - Tenant renderer: fixed sections and art directions
  - Scope: `components/tenant-site/**` (server components; no client JS except the waitlist form), tests.
  - `LandingSpec` → fixed section components in `LANDING_SECTION_ORDER` (nav, hero, promises, how it works, app
    preview, waitlist, footer), each with the `SECTION_LAYOUTS` variants each `ART_DIRECTIONS` entry allows; proof slots
    are never rendered; platform-owned text (privacy line, footer year, "Made with Weekend MVP") is ours, not the
    model's.
  - AA contrast from the brand kit: text colours come only from the `BRAND_TEXT_PAIRS` pairs (accent never text);
    the renderer recomputes `contrastRatio` and falls back to ink-on-ground for any pair under 4.5:1; focus ring,
    borders and controls are computed to at least 3:1 (SC 1.4.11); browser surfaces themed per direction (`07` §4).
  - Type from `TYPE_PAIRS` (self-hosted OFL faces via `next/font/google`, `preload: false`, only the chosen pair
    applied); icons from `LANDING_ICONS` via `@phosphor-icons/react`; CSS-only motion with `prefers-reduced-motion`
    (D25, proposed); no eyebrow (D24, proposed). Sections use container queries so the same components serve the
    narrow workspace preview.
  - Acceptance: vitest + axe render of every direction × layout for the HydroTrail kit; a forced low-contrast kit
    renders the fallback pair; no `<script>` or `dangerouslySetInnerHTML` in rendered output (security test like
    `tests/security/wp28-templates-tenant.test.tsx`).

- [ ] `WP75-S5b` - Tenant route and waitlist form (preview mode until D5)
  - Scope: `app/site/[slug]/page.tsx`, `components/tenant-site/WaitlistForm.tsx`, tests.
  - The route keeps the WP28 rules (never reachable by URL, canonical from the slug, fail closed). It renders a
    `LandingSpec` document with S5a and keeps the WP27 `PreviewTemplateRenderer` for legacy specs. Discrimination
    needs `resolvePublishedSite` to return the document kind (Codex), or a parse-first fallback (progress
    Stop-and-ask 6).
  - Acceptance (review of S5a): the route runs `landingSpecSchema.safeParse` and `brandKitSchema.safeParse` on the stored
    documents before rendering and fails closed (404 or the legacy renderer) on a parse failure and when a render throws;
    `TenantSite` assumes parsed input.
  - Waitlist form posts to `/__lead` on the tenant host. Until D5's three controls ship (WP78-S4), it runs in preview
    mode: `/__lead` accepts synthetic leads only and refuses an email (`convex/platform/sites/leads.ts:83`), so the UX
    of preview mode is an owner question (progress Owner questions 5). `captureMode: "preview" | "real"` prop; real
    mode adds the versioned privacy notice under the form and sends its version (WP78 cross-lane request).
  - Acceptance: WP28 route security tests stay green; the form in preview mode never sends an email field; keyboard
    and screen-reader labels pass axe; status messages use a polite live region.

- [ ] `WP75-S5c` - CI render matrix
  - Scope: `tests/tenant-site/matrix.*`, CI step (Codex adds the workflow line).
  - Every direction × layout × 6 fixture brand kits (the spike businesses), desktop and mobile, rendered with
    Playwright and checked with axe, the Impeccable detector and the DESIGN.md lint (`07` §2A). Fixture mode only.
  - Waits on Codex dependencies and a CI step (progress Needs from Codex 3).
  - Acceptance: the matrix runs in CI, fails on any axe violation or detector hit, and costs no model calls.

- [ ] `WP75-S6a` - Team HQ (live status) and the Meet your co-founder handoff
  - Scope: `app/(launch-workspace)/dashboard/b/[projectId]/team/page.tsx`, `team/[employee]/page.tsx`,
    `components/workspace/team/**`, a public owner-scoped query `convex/crew/status.ts:getTeam`.
  - Live crew status by Convex subscription (status pill always has a text label), skipped roles with reasons ("Why
    this team?"), approvals Wren is routing, each employee's workstream panel with its output card (Looks good / Ask
    for changes from the WP72 kit, decisions through WP77 `decideApproval`).
  - Acceptance: renders behind the flag from fixture data; a status change re-renders without reload; a11y-check and a
    keyboard run-through pass.

- [ ] `WP75-S6b` - Brand kit and Brand Book
  - Scope: `brand/page.tsx`, `components/workspace/brand/**`, `lib/workspace/crew/designMd.ts` (deterministic DESIGN.md
    export from the brand kit, `07` §2C; derived on read, downloadable).
  - Palette with contrast ratios shown as text, type pair specimen, voice (say / don't say), logo marks (alt text
    shown), DESIGN.md download.
  - Acceptance: a11y-check; DESIGN.md export is byte-stable for the HydroTrail fixture.
  - Open item from S2b: a launch's kit can be built on the blueprint's first draft while its card is pending. If
    the founder later asks for changes on the blueprint, the kit stays built on the earlier draft; S6b (with WP77)
    needs a re-run or "built on an earlier blueprint" policy.

- [ ] `WP75-S6c` - Landing review (desktop and mobile preview)
  - Scope: a landing review page (proposed route `site`, added to `lib/workspace/routes.ts` and linked from Team HQ
    and the Landing workstream), `components/workspace/site/**`.
  - Renders the stored spec with S5a in a desktop frame and a 390px frame (container queries, no iframe), the form
    inert with a "Preview" label, proof slots listed separately as "Replace with real proof", and the
    `artifact_review` card. The `publish` card itself is WP78's flow.
  - Acceptance: a11y-check; both frames render the same spec; no network call from the preview form.

- [ ] `WP75-S6d` - Build pack page
  - Scope: `build-pack/page.tsx`, `components/workspace/buildpack/**` (reuse `components/workspace/kit/BuildPackPromptCard.tsx`).
  - Four phases, eight prompts (or the light pack's setup prompts), a copy button per prompt and "Copy all" built like
    `app/(marketing)/starter-kit/CopyPromptButton.tsx` (icon button, accessible name, polite status "Copied Prompt N
    for <Tool>."), copy text from `promptCopyText`. `productMd` shown as plain text and downloadable until a CommonMark
    renderer is available (progress Needs from Codex 10).
  - Acceptance: a11y-check; copy works by keyboard; the copied text equals `promptCopyText` for every prompt.

## Model routing

| Story | Author | Reviewer |
|---|---|---|
| S1 | Opus (data writes, authz); Sonnet for the Meet your co-founder list | Opus |
| S2a, S2b | Opus (pipeline, gateway, approvals) | Opus, independent |
| S3a–S3d | Opus (prompts, gateway, contracts) | Opus |
| S4a | Opus for the pattern logic; Sonnet for the table tests | Opus |
| S4b | Opus | Opus |
| S5a | Sonnet with `impeccable`, `design-taste-frontend`, `frontend-design` (`07` §2A) | Opus (security) + a11y-check |
| S5b | Opus (public route, lead path) | Opus, independent |
| S5c | Sonnet; Haiku for fixture wiring | Sonnet |
| S6a–S6d | Sonnet | Opus for S6a (approval decisions); Sonnet otherwise |
| Lock updates, route manifest entries, fixtures | Haiku | — |

## Out of scope

- Email, social, SEO, launch plan and ads generators (WP76; S2b leaves their slots).
- Change-round pricing and spend approvals (WP77-S2), Wren chat and cards (WP77-S3/S4).
- Publishing, takedown and real lead capture (WP78), tenant email (WP79), per-idea seeds and evals (WP71-S5, S6).
