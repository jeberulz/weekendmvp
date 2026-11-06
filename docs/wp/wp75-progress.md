# WP75 Progress - Crew engine: roster, launch workflow, brand, landing, build pack

## 2026-11-06 - Planned (Phase 2, no code)

- Branch and worktree: `claude/wp75-crew` at `.worktrees/wp75-crew`, from `origin/main` `d0f6e572`.
- Stories: `docs/wp/wp75-stories.md` (S1, S2a–b, S3a–d, S4a–b, S5a–c, S6a–d).
- WP76 dependency: WP76 starts after **S2b** merges (job runner + launch DAG with WP76 step slots). WP76 can also
  reuse S4a's checks.
- Needs from Codex: 12 items below; items 1, 3 and 4 block stories.

## 2026-11-06 - WP75-S2a built (job runner, one step)

Uncommitted in the worktree; the orchestrator reviews and commits. Fixture mode only, no live spend.

### Files

- `convex/crew/jobs.ts` (new, internal only): `insertCrewTask` / `createCrewTask`, `startCrewRun`,
  `finishCrewStep`, `settleCrewRun`, `resumeCrewTask`, plus the shared `runCrewStepArgs` and gateway-failure
  validators.
- `convex/crew/runner.ts` (new): `runCrewStepWith` (the body, with an injectable `runPrompt`) and the
  `runCrewStep` internal action.
- `lib/workspace/crew/retry.ts` (new, pure): retry classes, decisions, backoff, calm founder-facing reasons.
- `lib/workspace/crew/tasks.ts` (new, pure): job type to C-ART kind, `planCrewTask` (the C-JOBS round),
  `founderNoteBlock`.
- `convex/ai/providers/fixtureOutputs.ts` (new) and `convex/ai/providers/fixtures.ts` (the default fixture client
  falls back to it; a test responder still wins).
- `convex/_generated/api.d.ts`: the `crew/jobs` and `crew/runner` module entries, hand-added in codegen's form.
- Tests: `convex/crew/runner.test.ts` (convex-test, real meter, ledger, approvals and limiter),
  `convex/crew/retry.test.ts` (pure), `tests/platform/crew-fixture-outputs.test.ts`.

### Design

- **Round and key.** `planCrewTask` counts the lineage's non-failed, non-cancelled tasks (first draft included)
  read over the job-key prefix range. First draft = round 0; a revision must name the newest succeeded draft
  (else `CREW_TASK_STALE`); a busy draft returns the same live task for the same revision and refuses another
  (`CREW_TASK_BUSY`); round 3+ is `CREW_TASK_PAID_ROUND` (WP77-S2 inserts paid rounds); a broken lineage fails
  closed (`CREW_TASK_CONFLICT`). A released round reuses the key with `crew-task:{key}:retry:{n}`. Every inserted
  task is `creditCost: 0n`, no debit, and spends one `checkLimit(ctx, "crewJob", owner)`; a returned task spends
  none. The rule mirrors WP77's `nextChangeRound`, which is only on PR 210's branch (`convex/workspace/changeRounds.ts`
  is not on main); consolidate after it merges.
- **Attempts.** One `workflow_runs` row per execution (`run:{taskId}:{n}`, `type` = the job type). `attempt` starts
  as one past every number used by any task holding the key (the holders' runs, plus `ai_usage` rows under
  `{jobKey}:`), and the gateway's `nextAttempt` is stored back on settle or finish, never moving backwards. A run
  whose outcome is unknown (the gateway call threw, or a run is still `running` past an 11-minute lease) counts as
  start + 2 and settles as `indeterminate`. Tested: a re-ask, a retry and a later holder of the released key use
  attempts 1, 2, 3, 4 with no reuse.
- **Retries are executions, not a loop.** One gateway run can take most of an action's 10 minutes, so
  `settleCrewRun` schedules the retry (`runAfter(backoff, runCrewStep, args)`) in the same transaction that closes
  the run. `retryMode: "return"` hands the delay back instead, for S2b's workpool (`retry: false`). At most 4
  executions per task. Classes: `retryable_unbilled` 2 retries (5 s, 20 s); `indeterminate` 1 retry (30 s);
  `permanent` fails, refunds only when a `task-debit:{taskId}` row exists (refund scheduled in the same
  transaction); `parked` blocks the task, no retry; `closed` (meter `RESOURCE_NOT_FOUND` on a task that became
  terminal) marks the run `cancelled` and changes nothing else. `duplicate_attempt` is retried past the key.
  A `billed: actual` provider failure is permanent.
- **Finish, one mutation.** Guards: run and task still `running`; workspace on and business live (a parking code
  parks, anything else fails). Re-parses the output with `parseModelOutput` (a revision passes the stored draft, so a
  landing spec keeps its proof slots); a C-ART failure or an oversized body fails the task with no document or card.
  Then the `documents` row (`format: json`, `schemaVersion: "1"`, `promptRef`, `contentSha256`,
  `supersedesDocumentId` for a revision), task `succeeded`, run `succeeded`, `createApprovalRecord`
  (`artifact_review`, subject `documents`, `changeRound` = the task's round), employee `needs_you`, workstream
  `needs_review` with `documentIds` and `askApprovalId`.
- **Revision inputs.** The runner adds `previousArtifact` (the revised draft's stored JSON) and `revisionNote`
  (`founderNoteBlock`: control characters dropped, `& < >` escaped, capped at 2,000, wrapped as data) to the prompt
  inputs. Specs read only the keys they use.
- **Crew statuses.** `crew_members` has no failed or blocked status, so a failed or parked step sets the employee
  `needs_you` and puts the reason on the workstream (`status` `failed` / `blocked`, calm `blocker` text). Resume
  sets both back to `queued`.
- **Fixture outputs.** The fixture client never sees the prompt ref, so the registry recognises a registered spec
  by its system block plus output schema, then falls back by C-ART schema (object kinds, the landing draft, blueprint
  and build-pack variants and unions), else the old smallest-instance reply. `FIXTURE_OUTPUTS_BY_REF` is empty
  until S3/S4b register non-artifact specs. Only `fixtures.ts` imports the module (tested); live mode builds the SDK
  client and never calls it (tested with a fake client).
- **Generic step.** Nothing assumes step order or that the first step is the roster: `crew_blueprint` is a step
  type like the others (owner ruling, blueprint first).
- **Proof spec.** The runner is proved end to end with a test-only, non-internal spec in the test's mocked registry
  (`test-crew-brand-kit@1`, output = the C-ART brand kit schema, `per_business` cache layout). No production prompt
  was added; the lock is unchanged.

### Needs from Codex (S2a)

- Item 9 (`crewJob` semantics) stays open: S2a spends one token per inserted task, so a launch of about ten steps
  hits the 10-an-hour limit by itself (Stop-and-ask 10, Owner Q11). S2b must not ship until this is ruled.
- Item 8 (`crew_members` `failed` / `blocked`): S2a uses `needs_you` plus the workstream blocker; adding the statuses
  later is a small change in `setCrewStatus`.
- Item 7 is not needed: `workflow_runs` holds attempt, errorCode and idempotencyKey.
- `convex/_generated/api.d.ts` was edited by hand for the two new modules; a `npx convex codegen` run should
  produce the same lines.

### Checks

- `npm run typecheck` 0; `npx tsc --noEmit -p convex` 0; `npm run lint` 0 (0 errors; no warnings in S2a files).
- `npm run check:prompt-versions` 1 against the default base `origin/main` (`2d324f3f`): four `wren-*` entries are
  in main's lock but not this branch's, because main moved past this branch's base `d0f6e572`. No lock or prompt
  file changed in S2a; `--base HEAD` exits 0 (1 prompt version matches). Clears on a rebase.
- `node --experimental-strip-types --test tests/security/*.test.mjs` 1: 207 pass, 1 fail, the known
  `convex/workspace/business.ts:createBusiness missing capability guard` (WP74 item (a)).
- Vitest half of `test:security` 0 (121 tests).
- `test:convex` 0 (915), `test:platform` 0 (1,291), `test:prompts` 0 (24), `test:engine` 0 (1,076).
- `npm run build` 0. `git diff --check` clean.

## 2026-11-06 - S2a review fixes

The independent review asked for changes. Everything is uncommitted in the worktree, and the run is fixture only.
Where an item below disagrees with the S2a section above, this section wins: revisions, resume, the note and the
debit changed.

| Finding | What changed |
|---|---|
| M1: parked and closed runs spent the run cap | Only runs whose `errorCode` spends the retry budget count: `retryable_unbilled` and `indeterminate` (`spendsRetryBudget`, `lib/workspace/crew/retry.ts:55`). The cap is `MAX_RETRY_BUDGET_RUNS` = 2 + 1 + 1 (`convex/crew/jobs.ts:88`, checked at `:605`). Past `RUN_SCAN_MAX` rows, the task fails closed. Test: park and resume ×5, then success. |
| M2: a task could stay `running` for ever | Runner (`convex/crew/runner.ts:164-178`): a throw from `finishCrewStep` or `settleCrewRun` settles the run as indeterminate at the gateway's `nextAttempt`. New `internal.crew.jobs.recoverStaleCrewRuns` (`jobs.ts:853`). It pages `workflow_runs.by_status_and_createdAt` for `running` rows past the 11-minute lease, at most 50 a page, then schedules the next page with the same cutoff. Each stale run closes as indeterminate (attempt + 2). The task fails when the retry decision says so; otherwise it stays `running` for its re-invoker (superseded by round 2, N1: recovery always fails the task). Tests: finish throws once and the retry finishes; two orphans (the first recovered, the second fails the task); paging. |
| M3: a second revision inserter | `insertCrewTask` / `createCrewTask` insert first drafts only (`planFirstDraft`, `lib/workspace/crew/tasks.ts:74`). Revisions come only from WP77 (`decideApproval` → `insertRevisionTask`, or a paid round's debit site); S2a runs them. `startCrewRun` reads the note with WP77's `revisionNoteFor` (`jobs.ts:627`). `revisionNote` is gone from the args. The mirror rule and its comment are deleted. The lineage type and status sets come from `lib/workspace/changeRounds.ts`. Test: a WP77 revision runs end to end. The old card is `changes_requested` in the transaction that queued the round, so only the new card is pending. |
| m1: unchecked status writes | Every task status write goes through `setTaskStatus` → `assertTaskTransition` (`jobs.ts:462`). Resume is blocked → running at start. An exhausted task fails from running, after the start transition. Recovery fails a running task. No forbidden transition is written, so Codex needs to add none. |
| m2: raw `previousArtifact` | `previousDraftBlock` (`tasks.ts:146`) escapes the draft into a `<previous_draft>` data block and never truncates it. The draft may use at most half the spec's input bound (superseded by round 2, N3: half the lane's tokens in UTF-8 bytes, 20,000 at the fast tier). A larger draft fails the step as `config` (permanent) before any provider call. Tests: a body with `</founder_note>`, and a 100k draft with 0 provider calls. |
| m3: every `duplicate_attempt` treated as retryable | Only `key_reused_for_different_call` is `retryable_unbilled`. A same-call replay (`usageId`) or a bare one is `indeterminate`. Both are tested in `retry.test.ts`. |
| m4: caller-supplied `creditDebitId` | Removed from the args. `startCrewRun` reads `task-debit:{taskId}` (`debitOf`, `jobs.ts:359`) and returns it to the runner. Tested on a debited task and on the paid round. |
| m5: "credits were returned" on an archived business | `failTask` (`jobs.ts:474`) schedules `refundFailedTask` only when a debit exists and neither the task nor the project is archived. The blocker matches what happens: refunded, `FAILED_STEP_ARCHIVED_REASON` (credits not returned automatically), or the plain reason. Today an archived business's credits stay spent, because `refundFailedTask` throws `RESOURCE_NOT_FOUND` there. Policy is a Need below. |
| m6: rebill on resume | Documented: a step parked at finish (workspace switched off, or a budget code) is re-run on resume. Credits are never debited twice: the debit is per task, and the task keeps its one `task-debit:{taskId}`. Provider cost does repeat, because the earlier output is not kept. Each execution is a new attempt with its own `ai_usage` row. |
| m7: wrong comment at the insert | `insertCrewTask` now checks `assertFeatureEnabledForOwner(ctx, "workspace", owner)` first (`jobs.ts:402`). Tested (`WORKSPACE_DISABLED`). |
| Nit: fixture registry | Indexes are built eagerly. A registration error is kept and rethrown on every `outputFor` call (`convex/ai/providers/fixtureOutputs.ts:145-163`). Tested on repeated lookups. |
| Nit: founder note | Drops C0/C1 controls, bidi marks, embeddings, isolates and U+2028/9. Uses a well-formed slice that never ends on a lone surrogate (`tasks.ts:97-127`; a local helper, because `lib/workspace/plainText.ts` is not on main). |
| Nit: attempts | `attemptSuffix` parses `^[1-9][0-9]{0,15}$` as a safe integer (`jobs.ts:257`). `nextAttemptForJobKey` fails closed with `CREW_ATTEMPTS_EXHAUSTED` past the scan caps or attempt 1,000,000 (`jobs.ts:274`). |
| Nit: `retryClass` validator | A union of the five literals (`jobs.ts:147`). |
| Nit: BUDGET_EXHAUSTED copy | "Paused: the AI allowance available to you is used up for now. Resume this step when more is available." It no longer says "tomorrow". |
| Test gaps | Added tests: a paid round end to end (two free rounds via `decideApproval`, the spend card approved, then `assertPaidRevisionApproved` + `insertRevisionTask` + `debitTask`; the run passes the server-read debit, with no refund); finish with the workspace off (parks); finish with the business archived (fails, no refund, archived copy); and a retry after a cancel (skipped, no second call). |

**Resume.** `resumeCrewTask` is removed. A resume is `runCrewStep` with `resume: true`: a blocked task starts again
only then, and the flag is dropped from any retry that execution schedules.

**Declined or changed from the ask.**

- `nextChangeRound` is not imported. S2a no longer computes a revision round, so it has no call to make; it imports
  `LineageTask` and the round status sets instead.
- Titles: S2a keeps `CREW_STEP_ARTIFACTS` ("SEO pack", "Landing page"). WP77's `revisionTitle` in
  `convex/workspace/changeRounds.ts` builds the task title from the job type ("Seo pack, change round N",
  "Landing, change round N"). That is WP77's lane, so it is reported to the orchestrator rather than edited.
  Suggested fix: use `crewDocumentTitle` from `lib/workspace/crew/tasks.ts`. Document titles come from S2a, so
  they are already right.

**Re-invoker until the cron lands.** Nothing calls `recoverStaleCrewRuns` on a schedule yet, and crons are Codex's
file. Until they are, the next `startCrewRun` closes a stale run after the lease, and S2b's workpool `onComplete`
is the documented re-invoker for a task left `running` (round 2: in schedule mode only the cron reaches an
orphan, so Need 13 is required before S1 ships).

### Needs from Codex (S2a review fixes)

- 13 below: a cron calling `internal.crew.jobs.recoverStaleCrewRuns` (no args; for example every 5 minutes).
- 14 below: a refund policy for a failed, debited step on an archived business.

### Checks (review fixes)

| Check | Exit | Notes |
|---|---|---|
| `npm run typecheck` | 0 | |
| `npx tsc --noEmit -p convex` | 0 | |
| `npm run lint` | 0 | 0 errors; no warnings in S2a files |
| `npm run check:prompt-versions` | 0 | 3 match the lock at `origin/main` |
| `test:security`, node half | 0 | 215 pass, 1 skipped |
| `test:security`, vitest half | 0 | 121 tests |
| `test:convex` | 0 | 1,041 tests; `convex/crew` has 82 |
| `test:platform` | 0 | 1,406 tests |
| `test:prompts` | 0 | 24 tests |
| `npm run build` | 0 | |
| `git diff --check` | clean | |

### Round 2 (re-check: approved with should-fix)

This round is uncommitted, on top of `464931e7`. The re-check confirmed M1, M3 and every minor; this round covers its four
findings.

| Finding | What changed |
|---|---|
| N1 (should-fix): recovery left the task `running` with no open run | `recoverStaleCrewRuns` (`convex/crew/jobs.ts:909`) now fails every recovered task with the calm "interrupted" note (`FAILED_STEP_INTERRUPTED_REASON` / `..._REFUNDED_REASON`, `lib/workspace/crew/retry.ts:223`). It does this whether or not the budget would allow a retry, because recovery cannot run one: the step inputs are not stored. A debit is refunded by the usual rule (`failTask`, `jobs.ts:492`). Failing frees the round. One exception: a task with another execution still inside its lease is left to that execution. |
| N3: the previous-draft bound counted UTF-16 units | `previousDraftBlock` (`lib/workspace/crew/tasks.ts:154`) measures the whole block in UTF-8 bytes (`utf8ByteLength`, `:143`), the gateway's unit. The bound is half the lane's input tokens, read as bytes (`convex/crew/runner.ts:85`): 20,000 at the fast tier. The old 4-bytes-per-token factor was 4× too generous, because the gateway counts one token per byte. |
| N2: a paid task with no debit ran on the free budget | `startCrewRun` (`jobs.ts:652`) fails a task with `creditCost > 0` and no `task-debit:{taskId}` before any run row or provider call. It skips as `unpaid` and shows `FAILED_STEP_UNPAID_REASON` ("Nothing was charged"). It fails rather than parks, because no later event would record the debit; the round is freed, so the founder can ask again. |
| N4: start and recovery disagreed on abandoned runs | Both use `mayRetryAfterAbandoned` (`jobs.ts:561`), the `indeterminate` decision over the task's other runs. Start now collects closed runs' codes first (`jobs.ts:625`): `runsOf` is newest first, so it is not history order. The first version of this fix missed that; probe R3 caught it. When the budget says no, start fails the task with the same "interrupted" note and opens no run. |

**Recording the retry mode: declined.** `workflow_runs` has no field for it. The only free-form fields are
`idempotencyKey`, an identity key that dedupes executions, and `errorCode`, which is overwritten on close and read
as a retry class. Hiding the mode in either would be fragile, so every recovered run is treated the same way.
S2b's `stepDone` re-enqueues after `RUN_LEASE_MS` on an action failure. Whichever of that and recovery comes first
settles the run, and the other finds nothing to do. Both stories in `docs/wp/wp75-stories.md` now say this: S1
uses schedule mode, S2a re-invokes its own retries and the recovery cron catches dead actions; S2b uses
`retryMode: "return"` with `stepDone` as the re-invoker.

**Tests added** (`convex/crew/runner.test.ts`, `convex/crew/retry.test.ts`):

- An orphan in schedule mode: recovery fails it with the interrupted note and schedules nothing. A second pass finds
  nothing; a re-invoke finds the task `terminal`. The round is free, so a new first draft runs under the same key at
  the next unused attempt. With a debit, the refund is scheduled.
- Recovery leaves a task alone while a sibling run is inside its lease.
- Three abandoned runs:
  - seeded, then closed by start: the task fails, 0 provider calls, no new run;
  - the same history through recovery: the same runs, the same failed task, the same note;
  - three sequential starts with each run abandoned: `run`, `run`, `exhausted`, and only 2 runs.
- A paid task with no debit: `unpaid`, 0 provider calls, no run, no usage row, no refund.
- A CJK previous draft: 8,000 characters (about 24,000 bytes) is refused by bytes, with 0 provider calls. A pure
  test checks the byte count.

**Reviewer probes** (`scratchpad/s2areview`, run with `vitest.probe.config.ts`). R2, R3, R6 and R7 now fail, and
each of those probes asserted the old buggy behaviour. The other 9 pass.

### Checks (round 2)

| Check | Exit | Notes |
|---|---|---|
| `npm run typecheck` | 0 | |
| `npx tsc --noEmit -p convex` | 0 | |
| `npm run lint` | 0 | 0 errors; no warnings in S2a files |
| `npm run check:prompt-versions` | 1 | Drift only. `origin/main` moved to `2318762d`, past this branch's merge base (`2d324f3f`), with newer `wren-chat` / `wren-plan-turn` lock entries. No lock or prompt file changed here. `--base HEAD` exits 0 (3 match). Clears when main is merged. |
| `npm run test:security` | 0 | node half: 215 pass, 1 skipped; vitest half: 121 tests |
| `npm run test:convex` | 0 | 1,045 tests; `convex/crew` has 86 |
| `npm run test:platform` | 0 | 1,406 tests |
| `npm run test:prompts` | 0 | 24 tests |
| `npm run build` | 0 | |
| `git diff --check` | clean | |

## Status

| Story | State | Runs in fixture mode now? | Waits on | Author / reviewer |
|---|---|---|---|---|
| S1 roster | Not started | Yes, after S2a + S3a blueprint | S2a, S3a (ruled: blueprint first) | Opus (Sonnet UI) / Opus |
| S2a job runner | Built, awaiting review and commit | **Yes** | — | Opus / Opus |
| S2b launch DAG | Not started | Yes, after S2a | S2a | Opus / Opus |
| S3a blueprint + brand text | Not started | Yes, after S2a | Seeds use HydroTrail fixture until WP71-S5 | Opus / Opus |
| S3b logo marks | Not started | Yes (fixture image adapter) | Stop-and-ask 11, 12, 14; Owner Q2, Q3 | Opus / Opus |
| S3c landing spec | Not started | Document only | Codex 1 for the site version write | Opus / Opus |
| S3d build pack | Not started | Yes for HydroTrail fixture | Owner Q8, Q9; WP71-S5 seeds | Opus / Opus |
| S4a deterministic checks | Not started | **Yes, no dependencies** | — | Opus logic, Sonnet tests / Opus |
| S4b quality + repair + policy | Not started | Yes, after S2a + S4a | Owner Q6, Q7; Codex 11 | Opus / Opus |
| S5a renderer sections | Not started | **Yes** (fixture brand kits) | D24/D25 rulings (Owner Q10) | Sonnet / Opus + a11y-check |
| S5b tenant route + waitlist | Not started | No | Codex 1, 2; Owner Q5 | Opus / Opus |
| S5c CI render matrix | Not started | No | Codex 3 | Sonnet, Haiku / Sonnet |
| S6a Team HQ | Not started | After S1–S2 | S1, S2a | Sonnet / Opus |
| S6b Brand kit + Brand Book | Not started | After S3a | S3a, S3b | Sonnet / Sonnet |
| S6c landing review | Not started | After S3c, S5a | Codex 1 (route data) | Sonnet / Sonnet |
| S6d build pack page | Not started | After S3d | S3d; Codex 10 optional | Sonnet / Sonnet |

**Start first:** S2a, with S4a in parallel. S2a is the critical path for every generator and for WP76; it needs no
schema change and no owner answer. S4a is pure TypeScript with no dependencies. S5a can run in parallel on a
separate Sonnet session if capacity allows.

## Stop-and-ask (reality vs plan or contract)

Options are listed; none is resolved here.

1. **Resolved 2026-11-06: (A) blueprint first** (`docs/wp/RULINGS.md`). **Roster needs a blueprint profile that does not exist at Meet your co-founder.** C-WIZARD
   `rosterInputFromWizard(answers, blueprint)` (`lib/workspace/contracts/wizard.ts:326`) needs a full Blueprint with
   `profile`. The wizard's blueprint preview is "Display only; never stored" (`lib/workspace/wizard/defaults.ts:30`),
   the light blueprint drops `profile` (`lib/workspace/wizard/light-blueprint.ts`), and `createBusiness`
   (`convex/workspace/business.ts`) stores no blueprint document. Own ideas have no profile at all.
   Options: (A) run blueprint personalisation first and plan the roster from its `profile` (one draft call before
   the team appears; Meet your co-founder shows "putting your team together"); (B) a default profile per idea kind
   with a later re-plan; (C) map library ideas from manifest category and classify own ideas with a `fast` call.
2. **The publish-time policy check has no C-METER key form.** Key forms are `job`, `chat`, `eval`, `wizard`
   (`convex/ai/gatewayActions.ts:107-133`); `job` needs `ownerId` and `taskId` (:448-450) and no task exists at
   publish. Options: (A) add a `policy:` form (contract change, Codex); (B) run the check inside the landing job
   and store the verdict on the document, re-run only on new versions; (C) WP78 inserts a `crew_*` task for the check.
3. **Resolved in S2a (fixture-output registry).** **A fixture launch cannot produce valid artifacts.** The registered fixture client replies with the smallest
   schema instance (`convex/ai/providers/fixtures.ts:119`, `sampleFromJsonSchema`), which fails C-ART refinements.
   Plan: a fixture-output registry keyed by `promptRef` (S2a). It touches `convex/ai/providers/`, which WP71 created;
   confirm Claude lane may edit it.
4. **`@convex-dev/workflow` cannot use `crewWorkpool`.** Workflow 0.4.4 runs its own internal workpool
   (`workpoolOptions`); `crewWorkpool` is mounted separately (`convex/convex.config.ts:62-63`). Workpool has no
   per-key parallelism, so "3 concurrent jobs per owner" (`02` §6.2) must be app-level. Options: (A) DAG on
   `crewWorkpool` with `onComplete` (planned in S2b); (B) use workflow and leave `crewWorkpool` unused; (C) both
   (workflow steps enqueue onto the pool).
5. **Resolved in S2a (`workflow_runs`, no schema change).** **`tasks` has no attempt, error or start fields.** `convex/schema.ts:480-504` has `jobKey` and
   `by_ownerId_and_jobKey` only. Plan: one `workflow_runs` row per execution (`attempt` int64, `errorCode`,
   `idempotencyKey`, `by_taskId_and_createdAt`; `convex/schema.ts:695-716`). Alternative: Codex adds optional task
   fields (Codex 7).
6. **Who writes `site_versions`, and where is the spec?** `site_versions` has optional `documentId` and an optional
   string `landingSpec` (`convex/schema.ts:582-600`); the WP77 scanner allows only `status`, `publishedAt`,
   `retiredAt` patches. `resolvePublished` returns `document.body` only (`convex/platform/sites/read.ts` ~:119) and
   `app/site/[slug]/page.tsx` parses it as a WP27 render spec. Options: (A) Codex helper writes config + version
   from a `landing_spec` document (`documentId`), read returns the kind; (B) WP75 writes rows directly under a
   ruling; (C) store the spec in `site_versions.landingSpec`.
7. **Waitlist "preview mode" is undefined.** `/__lead` (`middleware.ts:181`) accepts synthetic leads only and refuses
   personal data (`convex/platform/sites/leads.ts:83`); its comment says a form that rejects real submissions is
   worse than none. Options: (A) preview mode shows the form only in the workspace preview, not on a public URL;
   (B) a public form that says "Waitlist opens soon" and sends nothing; (C) hold publish until D5's controls ship.
8. **Standard v1 targets four idea prompts; the build pack has eight.** `lintPrompts`
   (`scripts/lib/prompt-standard.mjs:143`) requires exactly Project Setup, Core Feature, Landing Page, Branding
   Package. The light pack is "checkout and hosting setup only" (`lib/workspace/contracts/artifacts.ts:1885`), which
   v1's billing rule forbids. Options: (A) apply the per-prompt rules (Done when, Do not build, no Next pin, no fence,
   services ≤ 3) to every prompt and the setup rules to Phase 1; (B) a v2 standard for build packs; (C) allow checkout
   in the light pack only.
9. **The idea's four prompts are not in Convex.** `idea_crew_seeds` is empty until WP71-S5 runs (~$15, owner OK).
   Own ideas have no prompts. S3d uses the HydroTrail fixture until then and builds own-idea packs from the blueprint.
10. **`crewJob` limit is 10 per hour** (`convex/platform/limits.ts:13`). A launch has ~10 WP75 steps, plus WP76's five
    and change rounds. Options: (A) check once per launch / per founder action, not per step; (B) raise the limit;
    (C) count only founder-triggered revisions.
11. **No registered image gateway action.** `runImageGateway` exists (`convex/ai/gateway.ts:1164`) but no Convex
    action binds it to the meter; `gatewayEnv` passes the Anthropic key only (`gatewayActions.ts:259-264`). Plan: new
    `convex/ai/imageActions.ts` (S3b) and widen the env to `RECRAFT_API_KEY`.
12. **`RECRAFT_STYLE_ID` is Weekend MVP's own OG brand style.** Applying it would give every founder our look. Plan:
    no style ID for founder logos unless the owner rules otherwise.
13. **Hero image.** `03` §3 costs one hero image per launch; plan S3 and the renderer do not render one
    (`brandKitSchema` has `heroArt` direction only, `artifacts.ts:887`). Options: render one (S3b) or drop it from the
    cost model.
14. **"Logo ×3" meaning.** `brandKitSchema` holds one `logo.markDescription` / `alt`. Three alternatives need a field
    for the chosen mark; one mark in three variants (colour, mono, reversed) needs none. No field records a pick.
15. **`npm run test:security` is red on main** until WP74 item (a) lands (Codex scanner allowlist,
    `PRE_BUSINESS_CONTROLS`). Every WP75 PR inherits a red security check.
16. **Quality check: model or code?** `03` §3 costs a Haiku quality call per artifact; plan S4 says deterministic
    checks. Planned: both (S4a then `quality@1`). Repair tier also differs: same `draft` spec vs a `deep` escalation
    (which C-PROMPTS limits to realtime; `lib/workspace/contracts/prompts.ts`).
17. **`idea_crew_seeds.ownerId` is required** (`convex/schema/workspace.ts:214-229`), but D22 makes seeds ownerless.
18. **Branch name.** The WP67 board lists `claude/wp75-crew-engine`; the worktree is `claude/wp75-crew`.
19. **Wren cards.** Posting the artifact card to chat needs WP77-S3's chat module. Until then the approval row is the
    card.
20. **CI matrix tooling is absent.** No Playwright, `@axe-core/playwright`, DESIGN.md lint or Impeccable detector in
    `package.json`; CI (`.github/workflows/ci.yml`) has no render step.

## Audit (main at `d0f6e572`)

Owner: C = Codex, Cl = Claude. Blocking = blocks a WP75 story as planned.

### Tables and fields

| Item | Exists | Where | Owner | Blocking | Story |
|---|---|---|---|---|---|
| `projects` + workspace object | Yes | `convex/schema.ts`; written by `convex/workspace/business.ts` | C (schema), Cl (WP74 writer) | No | S1 |
| `roster_plans` (`hired` string[], `skipped[{roleKey, reason}]`, `rulesVersion`) | Yes | `convex/schema/workspace.ts:82-92` | C | No | S1 |
| `crew_members` (queued/working/needs_you/done/skipped) | Yes; no failed/blocked | `convex/schema/workspace.ts:94-106` | C | No (use needs_you + reason) | S1, S2a |
| `workstreams` | Yes | `convex/schema/workspace.ts:108-122` | C | No | S1, S2a |
| `approvals` (+ optional `subjectVersion` :147, unused by `approvals.ts`) | Yes | `convex/schema/workspace.ts:139-159` | C | No | S2a |
| `chat_messages` | Yes | `convex/schema/workspace.ts:161` | C | No (cards wait on WP77-S3) | S2a |
| `business_files` (`alt` optional) | Yes | `convex/schema/workspace.ts:185-197` | C | No (alt required in code) | S3b |
| `idea_crew_seeds` (`ownerId` required) | Yes; empty | `convex/schema/workspace.ts:214-229` | C | No (fixture) | S3a, S3d |
| `business_members` | Yes | `convex/schema/workspace.ts:231` | C | No | S1 |
| `tasks` (`jobKey`, `by_ownerId_and_jobKey` :498; no attempt/error) | Yes | `convex/schema.ts:480-504` | C | No (workflow_runs) | S2a |
| `task_steps` | Yes | `convex/schema.ts:506` | C | No | S2a |
| `documents` (`taskId`, `promptRef`, `schemaVersion`, `contentSha256`, `supersedesDocumentId`) | Yes | `convex/schema.ts:523-546` | C | No | S2a–S3d |
| `site_configs` | Yes | `convex/schema.ts:562-580` | C | Writer unclear | S3c, S5b |
| `site_versions` (`documentId`, `landingSpec` optional; insert-only) | Yes | `convex/schema.ts:582-600` | C | **Yes** (Codex 1) | S3c, S5b, S6c |
| `leads` | Yes | `convex/schema.ts:602` | C | No | S5b |
| `workflow_runs` (`attempt` int64, `errorCode`, `idempotencyKey`) | Yes | `convex/schema.ts:695-716` | C | No | S2a |
| `TASK_TYPE_VALUES` / `STEP_TYPE_VALUES` incl. `crew_*` | Yes | `convex/platform/validators.ts:47-65`, `:80-99` | C | No | S2a |
| `DOCUMENT_KIND_VALUES` (every artifact kind) | Yes | `convex/platform/validators.ts:113-130` | C | No | S2a–S3d |
| `WORKFLOW_TYPE_VALUES` (same list; no `crew_launch`) | Yes | `convex/platform/validators.ts:184` | C | No (run rows typed by job) | S2a |
| `assertGeneratedDocumentBody` (256 KiB) | Yes | `convex/platform/validators.ts:225-237` | C | No | S2a |

### Contract helpers

| Item | Exists | Where | Owner | Blocking | Story |
|---|---|---|---|---|---|
| `jobKey` / `parseJobKey` / `JOB_SUBJECT_RULE` | Yes | `lib/workspace/contracts/jobs.ts:594`, `:625-638`, `:648` | C | No | S2a |
| `CREDIT_ACTIONS` (brand kit 11, landing 5, build pack 8) | Yes | `jobs.ts:272` | C | No | S2a (WP77-S2 prices) |
| `REGENERATE_ACTION_BY_JOB_TYPE`, `PRICE_TBD_JOB_TYPES` | Yes | `jobs.ts:76`, `:92` | C | No | S2a |
| `jobAttemptKey` | Yes | `lib/workspace/contracts/metering.ts:304-309` | C | No | S2a |
| `FREE_LIFETIME_CEILING` $1.50, daily $1.00, deep escalations 3/day | Yes | `metering.ts` | C | No (Owner Q12) | S2a |
| `TIER_MODELS`, `TIER_MAX_TOKENS`, escalation rule | Yes | `lib/workspace/contracts/prompts.ts:55` | Cl (WP71) | No | S3a–S4b |
| `runPrompt` (text, one schema re-ask) | Yes | `convex/ai/gatewayActions.ts:617-621` | Cl (WP71) | No | S2a |
| Image gateway action | **No** (`runImageGateway` only, `convex/ai/gateway.ts:1164`) | — | Cl | Yes for S3b (WP75 builds it) | S3b |
| Prompt registry (only `registryProbeSpec`) + `versions.lock.json` | Yes | `convex/ai/prompts/index.ts` | Cl | No | S3a–S4b |
| Meter reserve (task must be queued/running) | Yes | `convex/ai/metering.ts:80-87` | Cl (WP71) | No | S2a |
| `createApprovalRecord` / `createApproval` / `decideApproval` / `assertApproved` | Yes | `convex/workspace/approvals.ts:466`, `:532`, `:589`, `:373` | Cl (WP77) | No | S2a, S6a |
| `artifact_review` subjects `documents` / `site_versions` | Yes | `lib/workspace/contracts/approvals.ts:128` | Cl (WP77) | No | S2a |
| `planRoster`, `renderTeamMd`, `ROSTER_RULES_VERSION` | Yes | `convex/crew/roles.ts:279`, `:423`, `:20` | Cl | No | S1 |
| `rosterProfileSchema`, `rosterInputSchema` | Yes | `lib/workspace/contracts/roster.ts` | C | No | S1 |
| `rosterInputFromWizard` (needs profile) | Yes | `lib/workspace/contracts/wizard.ts:326` | C | **Yes** (Owner Q1) | S1 |
| `brandKitSchema`, `BRAND_TEXT_PAIRS`, `failingTextPairs` | Yes | `artifacts.ts:887`, `:1014`, `:1024` | C | No | S3a, S5a |
| `ART_DIRECTIONS`, `TYPE_PAIRS`, `typePairBrief`, `SECTION_LAYOUTS`, `DIRECTION_LAYOUTS`, `LANDING_ICONS` | Yes | `artifacts.ts:546`, `:584-685`, `:687`, `:714`, `:726`, `:778` | C | No | S3a, S3c, S5a |
| `LANDING_SECTION_ORDER`, `proofSlotSchema`, `withDefaultProofSlots`, `checkLandingAgainstBrandKit` | Yes | `artifacts.ts:275`, `:1251`, `:1347`, `:1374` | C | No | S3c, S5a |
| `BUILD_PHASES`, light pack, `buildPackSchema`, `promptCopyText` | Yes | `artifacts.ts:1824`, `:1885`, `:1902`, `:1926` | C | No (Owner Q8) | S3d, S6d |
| `debitTask` / `refundFailedTask` (no `debitJob`) | Yes | `convex/platform/billing/ledger.ts:213`, `:236` | C | No (WP77-S2) | S2a |
| `checkLimit("crewJob")` 10/h | Yes | `convex/platform/limits.ts:13` | C | No (Owner Q11) | S2a |
| `assertFeatureEnabled` | Yes | `convex/ops/settings.ts` | C | No | all |
| `recordSynthetic` lead path | Yes | `convex/platform/sites/leads.ts:83` | C | No (Owner Q5) | S5b |
| `resolvePublished` (body only) | Yes | `convex/platform/sites/read.ts` ~:119 | C | Partly (Codex 2) | S5b |
| Standard v1 linter (4 titles) | Yes | `scripts/lib/prompt-standard.mjs:143` | Cl | No (port in S3d) | S3d |

### Env vars, packages, providers, CI

| Item | Exists | Where | Owner | Blocking | Story |
|---|---|---|---|---|---|
| `AI_PROVIDER_MODE` (live only when exactly `"live"`) | Read in code; not in Convex env block | `convex/ai/providers/mode.ts`; `convex/convex.config.ts:10-52` | C (env), owner (value) | Live G2 only | G2 |
| `ANTHROPIC_API_KEY` | Read via `PROVIDER_KEY_ENV`; not in env block | `mode.ts:37-41` | C / owner | Live G2 only | G2 |
| `RECRAFT_API_KEY` | Same; not passed by `gatewayEnv` | `mode.ts:37-41`, `gatewayActions.ts:259-264` | C / Cl | Live G2 only | S3b, G2 |
| `RECRAFT_STYLE_ID` | OG scripts read it; the Convex provider only passes a caller-given `styleId` (comment names it) | `scripts/generate-og-cards.mjs`, `convex/ai/providers/recraft.ts:12`, `:68` | owner | No (do not use) | S3b |
| Recraft provider (1024² only, `b64_json`) | Yes | `convex/ai/providers/recraft.ts` | Cl (WP71) | No | S3b |
| `@convex-dev/workpool` ^0.4.15 (+ `./test`) | Yes | `package.json:93` | C | No | S2b |
| `@convex-dev/workflow` ^0.4.4 | Yes; cannot use `crewWorkpool` | `package.json:92` | C | No (Stop-and-ask 4) | S2b |
| `@phosphor-icons/react` | Yes | `package.json:95` | C | No | S5a |
| `convex-test`, `vitest-axe`, `jsdom` | Yes | `package.json:74`, `:83`, `:78` | C | No | all tests |
| Playwright, `@axe-core/playwright`, DESIGN.md lint, Impeccable detector | **No** | — | C | **Yes** (Codex 3) | S5c |
| CommonMark renderer | No (`next-mdx-remote-client` / `remark-gfm` only) | `package.json` | C | No (plain text) | S6d |
| CI steps: audit, typecheck, lint, test, check:prompt-versions, validate:idea-tags, build, server traces | Yes; no render matrix | `.github/workflows/ci.yml` | C | Yes for S5c | S5c |
| Security scanners (WP68 boundaries, WP77 site versions insert-only) | Yes; WP68 red on main | `tests/security/wp68-workspace-boundaries.test.mjs:71` | C | Red gate (Codex 4) | all |

### Routes and UI

| Item | Exists | Where | Owner | Blocking | Story |
|---|---|---|---|---|---|
| Workspace routes (no landing/site route) | Yes | `lib/workspace/routes.ts:82-97` | Cl | No (add `site` in S6c) | S6c |
| `MeetCofounder` ("puts your team together in the next step") | Yes | `components/workspace/wizard/MeetCofounder.tsx` | Cl | No | S1 |
| `BuildPackPromptCard` | Yes | `components/workspace/kit/BuildPackPromptCard.tsx` | Cl | No | S6d |
| Tenant route (WP27 renderer) | Yes | `app/site/[slug]/page.tsx` | Cl | Partly (Codex 1–2) | S5b |
| `components/tenant-site/**` | No | — | Cl | No | S5a |

## Needs from Codex

1. **`site_versions` writer and spec field (blocking S3c's site write, S5b, S6c).** A helper or ruling: who inserts
   `site_configs` + `site_versions` (status `ready`) for a crew landing, and whether the spec lives in the
   `landing_spec` document (`documentId`) or in `site_versions.landingSpec`.
2. `resolvePublishedSite` returns the document kind (or the parsed spec type) so the tenant route branches without
   parse-guessing. Non-blocking: S5b can parse `landingSpecSchema` first and fall back to WP27.
3. **Render-matrix dependencies and CI step (blocking S5c).** Playwright + browsers, `@axe-core/playwright`, a
   DESIGN.md lint, the Impeccable detector, and a CI job that runs `tests/tenant-site/matrix.*` in fixture mode.
4. **WP74 item (a): scanner allowlist (`requireOwnedWizardSession`, `PRE_BUSINESS_CONTROLS`).** Until then
   `npm run test:security` is red on main and on every WP75 PR.
5. Convex env entries for `AI_PROVIDER_MODE`, `ANTHROPIC_API_KEY`, `RECRAFT_API_KEY` if the typed env block
   restricts `process.env` (`convex/convex.config.ts:10-52`). Needed for live G2, not fixture work.
6. `idea_crew_seeds.ownerId` optional (D22: seeds are ownerless).
7. Optional `tasks` fields (`attempt`, `errorCode`, `startedAt`), only if Codex prefers them to the planned
   `workflow_runs` rows.
8. Optional `crew_members` status `failed` / `blocked` (else WP75 uses `needs_you` with a reason).
9. `crewJob` limit semantics: per launch, per founder action or per step (`convex/platform/limits.ts:13`).
10. A CommonMark renderer dependency for `productMd` (optional; S6d shows plain text otherwise).
11. Acknowledge the policy prompt contract (input: landing spec + brand kit text; output: `{ verdict: allow | review |
    block, categories[], reasons[] }`) and the key form for a publish-time call (Stop-and-ask 2), for WP78-S1.
12. `debitJob` for paid change rounds (WP77-S2's need). S2a now reads `task-debit:{taskId}` on the server, so any
    debit helper must keep that key.
13. **A cron for `internal.crew.jobs.recoverStaleCrewRuns`** (S2a review M2): no args, every few minutes. Until then
    the next start after the lease, and S2b's workpool `onComplete`, are the re-invokers.
14. **Archived-business refunds** (S2a review m5): `refundFailedTask` throws `RESOURCE_NOT_FOUND` on an archived
    task or project, so a failed, debited step's credits stay spent. Rule it: refund anyway, refund on unarchive,
    or keep them spent. S2a schedules no refund there and says so on the workstream.

## Owner questions

1. ~~Roster profile source: A, B or C (Stop-and-ask 1).~~ Answered 2026-11-06: A, blueprint first.
2. "Logo ×3": three alternative marks, or one mark in three variants? If alternatives, how is the pick stored?
3. Recraft style for founder logos: none (planned), a neutral house style, or one per art direction?
4. Hero image: render one per launch (cost model) or drop it?
5. Waitlist preview mode before D5: A, B or C (Stop-and-ask 7).
6. After a failed repair: store the artifact with a "needs your eyes" flag, or fail the step?
7. Repair tier: same `draft` spec (planned) or a capped `deep` escalation?
8. Light build pack: may it mention checkout, against v1's no-billing rule?
9. Standard v1 for eight prompts: per-prompt rules on all, setup rules on Phase 1 (planned), or a v2?
10. D24 (no eyebrow) and D25 (CSS-only motion): rule them, so S5a builds against accepted decisions.
11. `crewJob` limit: per launch or per step (Stop-and-ask 10)?
12. Free-ceiling accounting: $1.50 lifetime covers about two launches at the measured $0.57 median, one at p90
    $1.20. Is a launch's first draft charged to the free ceiling, or to a platform budget?
13. Does the roster get an `artifact_review` card, or does the team just appear?

## Live spend G2 needs (each needs an owner OK first)

| Item | Estimate | Purpose |
|---|---|---|
| WP75 live run on 5 ideas | ~$3 | DoD: stays within the spike's cost |
| 20 live test launches | ~$12–15 | G2: median ≤ $0.75, p90 ≤ $1.20 |
| Recraft logo measurement | ~$1.25 | Recraft not yet measured in `03` |
| WP71-S4 cache test | small | Confirms cached system prefix savings |
| WP71-S5 seeds | ~$15 | Real per-idea seeds and the idea's four prompts |
| WP71-S6 eval judge runs | TBD | G2 eval thresholds |
| Production keys + `AI_PROVIDER_MODE=live`, kill-switch tests, cohort allowlist | — | Owner sets keys; Codex sets env |

## Docs

- Docs updated: `docs/wp/wp75-stories.md`, `docs/wp/wp75-progress.md` (new); S2a: story ticked, S2a section added.
- Not changed: plan docs, RULINGS, WP67 board (branch-name fix is the orchestrator's).
- Checks: docs only; `git diff --check` run.

## 2026-11-06 - S4a deterministic quality checks (branch `claude/wp75-checks`)

Done: `WP75-S4a` (pure TypeScript, no Convex, no model call, no I/O). Code in `lib/workspace/crew/checks/`, tests in
`tests/platform/workspace-crew-checks-*.test.ts` (so `npm run test:platform` runs them).

### API (S4b and WP76 call this)

- `checkArtifact(kind, artifact, { ownIdea?, brandKit?, buildPackStandard? })` returns `{ hard, soft }`, each a list of
  `{ code, path, message, severity }`. `hasHardIssues`, `isClean`, `mergeResults`.
- `toRepairIssues(result, max = 40)` is the repair call's data block: hard first, paths redacted by `formatIssuePath`
  (index as `[n]`, identifier keys as `.key`, any other key as `.*`), messages quote at most 48 single-line characters.
  The story names a `safeIssuePath`; none exists in the repo, so `formatIssuePath` is the redaction.
- Policy: hard issues trigger the one repair; soft issues ride along when a repair happens and otherwise only show.
- Individual checks are exported for reuse (`checkNeverFake`, `checkMarketNumbers`, `checkSlop`, `checkLandingSpec`,
  `checkLandingLayouts`, `checkBrandKit`, `checkBuildPackStandard`, `checkBuildPrompt`).

### Checks

| Check | Codes | Severity | Applies to |
|---|---|---|---|
| Never fake it | `fake_testimonial`, `fake_rating`, `fake_review`, `fake_social_count`, `fake_trusted_by`, `fake_logo_wall`, `fake_press`, `fake_credential`, `fake_stat` | hard | every kind (copy strings) |
| Unsourced evidence ("studies show") | `unsupported_evidence` | soft | every kind |
| Market numbers in own ideas (wraps the WP74 `hasMarketClaim`; strips placeholders and product measures first) | `own_idea_market_number` | hard | own-idea blueprint, brand kit, landing, email, social, SEO (not roster, launch plan, ads, build pack) |
| Slop lexicon, banned phrases | `slop_phrase` | hard | every kind except build pack and roster |
| Slop, weak words, "not just X but Y", triads as a whole line, 2+ em dashes in one string | `slop_weak_phrase`, `slop_triad`, `slop_em_dash_stack` | soft | same |
| Heading and title length vs `LIMITS` | `heading_too_long` | hard | landing |
| Heading and title length vs display targets (`DISPLAY_TARGETS`: headline 70 chars/12 words, heading 50/9, item title 40/7) | `heading_long_for_display` | soft | landing |
| No eyebrow, kicker, overline field; no section number or "Step 1" heading (D24) | `eyebrow_field`, `section_number` | hard | landing |
| All-caps heading | `all_caps_heading` | soft | landing |
| No emoji | `emoji_in_copy` | hard | landing |
| Proof slots are placeholders, bracketed | `proof_not_placeholder`, `proof_not_bracketed` | hard | landing |
| Waitlist present | `waitlist_missing` | hard | landing |
| Layout allowed by the kit's direction (wraps `checkLandingAgainstBrandKit`) | `layout_not_allowed` | hard | landing, when `brandKit` given |
| Alt text opens with "image of" | `alt_redundant` | soft | landing, brand kit |
| AA contrast via `failingTextPairs`; malformed hex guarded | `low_contrast`, `invalid_hex` | hard | brand kit |
| Type pair suits the direction; theme mode matches palette | `type_pair_direction`, `theme_mode_mismatch` | hard | brand kit |
| Prompt standard v1, per prompt (TypeScript port of `scripts/lib/prompt-standard.mjs`) | `done_when`, `do_not_build`, `next_pin`, `code_fence`, `setup_billing`, `setup_services`, `setup_auth`, `setup_auth_rls`, `setup_tables`, `setup_structure`, `billing`, `stack_services` | hard (billing: see below) | build pack |
| Body repeats the labels | `duplicate_label` | soft | build pack |

Not walked as copy: `proofSlots`, `voice.dontSay` and `voice.dontSayWhy` (deliberately bad copy), any `doNotBuild`
line (it names what is left out), and enum or colour fields (`hex`, `layout`, `kind`, ...).

### Prompt standard v1 and the open owner questions (8, 9)

`checkBuildPrompt(prompt, { role, billing })` and `checkBuildPackStandard(pack, { setupPromptNumbers, billing })` take
both rulings as options, so S3d does not change code when the owner rules:

- Default ruling (planned option A): per-prompt rules (Done when, Do not build, no Next major pin, no code fence) on all
  eight prompts; the Project Setup rules (no billing, one login, 3 services, 3+ tables, 8+ lines) on prompt 3
  (scaffold, first), which is the prompt the schema names as Project Setup. Billing is hard in that prompt and soft
  elsewhere. A light pack has no setup prompt and billing is off, so a checkout prompt passes.
- A v2 or "checkout allowed in light only" ruling is `setupPromptNumbers` and `billing`. Nothing else to change.
- The port has parity tests against `lintPrompts` on shared fixtures and on every enforced idea's real prompts. The
  title rule (four titles) and the Branding Package rule do not apply to a build pack and are not ported.

### Tests

242 tests in 5 files: positive and negative tables for every pattern (including no false positive on product units,
years, bracketed placeholders, "5k" race names, "first 50 on the waitlist", "Product Hunt launch"), HydroTrail
fixtures clean across all ten kinds plus the own-idea blueprint and the light pack, realistic bad artifacts failing,
and `lintPrompts` parity for each shared rule.

### Plan vs reality

- No slop lexicon exists in the repo (only the phrase list in `07` §2B). S4a wrote it (`slop.ts`); the lists are the
  owner's to tune.
- No `safeIssuePath` exists (see above). No Convex file needed it.
- `LEADING_SECTION_NUMBER` and the emoji regex in `artifacts.ts` are not exported, so `landing.ts` repeats them
  (two lines each). Codex could export them; then the copies go.
- S3d's story puts the standard port at `lib/workspace/crew/promptStandard.ts`. It lives in
  `lib/workspace/crew/checks/promptStandard.ts` (exported from the checks index); S3d can re-export it from the story's
  path or import it directly.
- The never-fake patterns are strict by design ("5-star", "Join 50 hikers" and "trusted by" always fail). A founder who
  has real proof adds it after review.

### Docs

- Docs updated: `docs/wp/wp75-stories.md` (S4a ticked), this file.

## 2026-11-06 - S4a review fixes (branch `claude/wp75-checks`, on `319d0c07`)

An independent review found 2 Blockers, 8 Majors, 9 Minors and nits. All are fixed except the two declined below.
Where this section and the S4a section above disagree, this section wins.

### Ruling: the own-idea market check (orchestrator, Claude lane)

D15 bans market numbers, competitor prices and keyword data for own ideas. It does not ban the founder's own price or
product facts. So in own-idea mode `own_idea_market_number` does **not** flag the business's own price ("$79
pre-order", "$29/month"), product facts ("100% recycled nylon"), promotions ("20% off the launch price", "free shipping
over $50") or waitlist caps ("join the first 100 hikers"). It still flags market size and magnitudes, TAM/SAM/SOM, CAGR,
CPC, growth rates, search volume and keyword data, revenue metrics (MRR/ARR/GMV), shares and ratios of a population,
spending data, competitor prices, and any number in a sentence about an industry, a survey or an average.
`marketNumbers.ts` now has its own rules for this; it still calls the WP74 `hasMarketClaim` for the industry/survey
sentences. `launch_plan` and `ads_drafts` are now market-checked (their copy is public; budgets are integers and are
not walked).

### Decisions

- **Hard patterns aim at precision; uncertain ones are soft.** New soft codes, shown but never repaired on their own:
  `possible_testimonial` (a signed line without quote marks, "Sarah from Denver: ...", a sentence signed
  "— @handle"), `founder_quote` (a quote attributed to the founder), `possible_social_count` ("Join 50 hikers": under
  100, no "already"), `unverified_comparison` ("30% more water than a 1 L bottle": a comparison with a stated
  baseline). Bare "next-level" is soft; "take X to the next level" stays hard. "Tapestry" is hard only as the metaphor.
- **Never fake it skips** the build pack (its prompts are instructions: "rate each trail 1 to 5 stars") and a library
  blueprint's whole `market` subtree (it describes other businesses, which D15 allows). The review asked for
  `fake_stat` and `fake_social_count` only; the whole subtree is skipped because "trusted by" or a rating there is
  about a competitor too.
- **Malformed input** returns hard `invalid_shape` (new `shape.ts`) instead of throwing. The walk is capped at 64 levels
  and 20,000 nodes and stops on a cycle; an artifact past a cap is `invalid_shape`.
- **Context**: `checkArtifact(kind, artifact, { ownIdea, ... })` now requires `ownIdea`. A blueprint still reads its
  own `source`, which wins over the context.
- **Prompt standard**: billing severity is per prompt kind (`billing: { setup?, standard? }`); the defaults live in
  `DEFAULT_SETUP_PROMPT_NUMBERS` and `DEFAULT_BILLING` (owner Q8 and Q9 stay open). A setup prompt number no pack of
  that weight can have throws a `RangeError` (a caller bug). `setup_structure` counts lines as `lintPrompts` does
  (Do not build and Done when included); an 8-line boundary parity test was added. Messages name prompts by number
  ("Prompt 3"), never by the model's title.
- **Repair data**: `snippet()` also strips `<`, `>`, `{`, `}` and invisible format characters; the market message
  quotes the matched words, not the start of the field. Results keep one issue per code and path.
- **Text is normalised before matching** (NFKC, invisible characters removed, Cyrillic/Greek lookalikes mapped inside
  mixed-script words, I/l/O inside numbers). Only for matching; the artifact is never rewritten.
- **Regex cost**: number starts and lookbehinds are bounded; every 50 KB adversarial input in the review probes and in
  extra probes runs in under 50 ms (worst 35 ms, was 2.7 s).
- **Scarcity** ("Only 3 left", "only 12 spots remain") is not proof and stays out of S4a. Candidate for the S4b
  `quality@1` prompt.

### Declined or left as known trade-offs

- "Get 2x more done ..." stays hard: a bare multiplier outcome reads as a claim even when hedged later.
- "Our 5-Star Pack" (a product name) stays hard: telling it from "5-star support" needs the business's own product
  names, which the checks do not get. A 5-star hygiene, safety or energy rating is no longer flagged.
- Still missed (not on the review's cheap list): "Our customers save an average of 6 hours a week", "Students double
  their freelance income", and a quote-less "... — @trailmike" (soft only). Left to S4b.

### Probes (reviewer's scripts, re-run unchanged)

| Probe | Before | After |
|---|---|---|
| Honest copy, hard flags (`fp.ts`, library / own idea) | 9/46 / 19/46 | 2/46 / 2/46 |
| Honest copy, hard flags (`fp2.ts`) | 23/30 | 0/30 |
| Faked proof missed (`fn.ts`) | 19/28 | 6/28 (2 scarcity, left to S4b; 2 flagged soft only; 2 not on the cheap list) |
| 50 KB adversarial timing (`redos.ts`) | 2.7 s worst | under 50 ms |
| Malformed, deep, cyclic input (`redos.ts`) | 9 throws | 0 throws (`invalid_shape`) |

### Docs

- Docs updated: this file. Stories unchanged (S4a stays ticked).

### Re-review fixes (on `542db70b`)

The re-review confirmed the Blockers and Majors above were fixed and found four new Majors the fixes introduced
(N1-N4), three Minors (N5-N7) and a test gap. All are fixed. Where this part disagrees with the lines above, this
part wins (the two "still missed" outcome claims above are now hard).

- **N1, "#1" is a ranking only before a ranking noun or a chart** ("the #1 hydration pack", "#1 rated", "our #1
  pick", "#1 on Product Hunt"). "Our #1 priority", "No. 1 Market Street", "No. 1 tip" and "our no. 1 rule" pass.
- **N2, own-idea market fallback**: the "industry / average / study / report" sentence fallback skips any sentence
  about the business or its customer (we, our, us, your). "Study guide" and similar, "reported issues" and "at the
  market (on Saturday)" are not market context. "Industry surveys put pack returns at 12%" stays hard.
- **N3, founder quotes**: soft only when the attribution names no business ("Ana, the founder") or names this brand.
  `CheckContext` takes an optional `brandName`. A founder or owner of another named business ("Jane, owner of Bloom
  Florist") is a hard testimonial, and with no `brandName`, any named business stays hard (a signed line stays soft).
  The S3 and S4b callers should pass the brand name.
- **N4, comparisons**: soft only when the baseline is a product ("than a 1 L bottle", "than our first prototype").
  People as the subject ("Hikers drink 40% more") or a baseline of before, without, they did or other people stays
  hard.
- **N5**: a landing spec's hero and footer must be objects, and its waitlist and optional sections must be objects when
  present (`invalid_shape`). A brand kit passed as context with no known direction returns `invalid_shape` at
  `brandKit` instead of throwing. A missing waitlist with a brand kit reports `waitlist_missing`.
- **N6**: in own ideas, "[Name] sells / charges / costs ... money" is a competitor price when the text also sets the
  business against it (ours, our, we). "Pro costs $9" and the brand's own name (`brandName`) stay clean.
- **N7**: the index header now says callers go through `checkArtifact` (shape and bounded-walk guards). The single
  checks are exported for tests and composing, and look only at the part of an over-limit input they reach.
- **Test gap**: rows that only the "rating out of 5" and "as seen in" patterns catch. A marker-based copy of the
  mutation probe finds no pattern that can be removed or flipped without a test failing.
- **Cheap misses fixed**: an outcome claimed for customers ("Students double their income", "Our customers save an
  average of 6 hours") is hard. Promotions such as "Students get 20% off" are not matched.

Left as is: "Join 99 happy customers" stays soft (a count under 100 after "join" may be true). The library blueprint's
`market` subtree stays unwalked (D15 allows researched market data). The number normaliser maps "Intel I5" to
"Intel 15" for matching only; no hard flag follows from it.

| Probe | Before (`542db70b`) | After |
|---|---|---|
| Ordinary copy hard-flagged as a ranking (`new.ts`) | 4/4 | 0/4 |
| Own-idea allowed lines hard-flagged (`new.ts`) | 5/5 | 0/5 |
| Own-idea must-flag lines missed (`new.ts`) | 1/12 (Camelbak price) | 0/12 |
| Soft downgrades that hid fakes (`new.ts`, B2B quotes and outcome comparisons) | 5/5 soft | 5/5 hard |
| Malformed landing spec (`new.ts`) | 2 throws | 0 (`invalid_shape`) |
| Honest copy, hard flags (`fp.ts`, `fp2.ts`) | 2/46, 0/30 | 2/46, 0/30 (declined lines) |
| Faked proof missed (`fn.ts`) | 6/28 | 4/28 (2 scarcity, 2 soft only) |
| Mutation: patterns removable or flippable | 2 (`mutate3.ts`) | 0 (`mutate4.ts`, marker-based copy) |
| 50 KB adversarial timing (`redos*.ts` plus new-pattern probe) | 36 ms worst | 50 ms worst |

- Docs updated: this file. Stories unchanged.

### Final-review fixes (on `8931c27b`): precision first

The final check confirmed N1-N7 and the test gap, and found that the new rules brought their own false positives
and one dodge. This round changes the principle: **a hard flag costs a paid repair, so a heuristic that cannot be
made precise in one line is soft**, and semantic fakes are the S4b `quality@1` prompt's job. Where this part
disagrees with the lines above, this part wins.

- **F1, "our/we" no longer hides market data.** The own-idea sentence fallback has two tiers. Data words (industry,
  sector, survey, study, research, report forms, statistics, according to, census, "the average {person}") are never
  skipped, so "According to our survey, hikers pay £60" and "Our research shows the average hiker pays $120" are
  hard. Rival and market words (competitors, rivals, elsewhere, market, average) are skipped only when the money
  belongs to an "our/your" noun or "we charge" ("On average our loaves cost £4", "Our average order is $25"). One
  deliberate change from the brief: competitor(s), rival(s) and elsewhere sit in the second tier, so "Unlike
  competitors, our pack costs $79" stays clean. All six dodge lines are hard either way.
- **F2, named competitor price**: "[Name] sells / charges / costs ... money" (either case) is hard only with an explicit
  contrast with our side in the same or the next sentence (ours, we charge/sell, our price, vs, cheaper than, for
  less), never for the brand name. Product names with a price ("Trail Pack costs $79 and we ship it free", "Rye Loaf
  costs £5 and our croissants cost £2") are clean. Without a contrast it is not flagged (S4b's job).
- **F3, comparisons**: hard only when the baseline is people or a past self (before, without, they did, other /
  most / the average {people}, last year). The subject no longer matters. "Than on the Starter plan", "than the
  in-store price" and "than most bottles" are soft `unverified_comparison`.
- **F4, rankings**: hard for "rated / ranked / voted / named #1", "#1-selling", "#1 rated", "#1 on {chart}" and
  "the UK's #1". A bare "#1 {noun}" ("The #1 app for hikers") is soft `possible_ranking`: it cannot be told apart from
  "The #1 tool you need is a good map". Pick, favourite, recommended and gear are dropped; at most one word sits
  between "#1" and the noun.
- **F5, customer outcomes**: soft `unverified_outcome`, except an explicit money or time saving on average with no
  plan, price, course or launch tie ("Our customers save an average of 6 hours": hard). Tied outcomes ("save on
  average 10% with the annual plan", "three projects in the course") are not flagged. "Lose" is dropped
  (physiology: "Runners lose on average 500 ml").
- **Soft gap, S4b item**: a quote attributed "— Jane, founder" with no business named stays soft `founder_quote`. The
  S4b quality prompt should judge whether it is the founder's own words or a customer's.

Now soft, so `fn.ts` counts them as missed: "The #1 hydration pack for ultrarunners" (`possible_ranking`) and
"Students double their freelance income" (`unverified_outcome`).

| Probe (reviewer's scripts, run as is) | Before (`8931c27b`) | After |
|---|---|---|
| `fp.ts` hard flags (library / own idea) | 2/46 / 2/46 | 2/46 / 2/46 (the two declines) |
| `fp2.ts` hard flags | 0/30 | 0/30 |
| `final.ts` honest lines with a hard flag (F2-F5) | 16 | 0 |
| `final.ts` rank honest lines with a hard flag | 5/9 | 0/9 (1 soft) |
| `final.ts` F1 dodge lines hard | 0/6 | 6/6 |
| `final.ts` named-competitor fakes hard | 4/5 | 5/5 |
| `final.ts` comparison fakes hard | 4/4 | 4/4 |
| `new.ts` must-flag list hard | 12/12 | 12/12 |
| `fn.ts` faked proof missed (hard) | 4/28 | 6/28 (2 scarcity, 4 soft) |
| Mutation (`mutate4.ts`): patterns removable or flippable | 0 | 0 |
| Timing: `final.ts` SLOW lines (over 30 ms) | 0 | 0 |
| Timing: extra 50-57 KB probes, worst single check | 50 ms | 44-46 ms |

- Docs updated: this file. Stories unchanged.
