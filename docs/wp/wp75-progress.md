# WP75 Progress - Crew engine: roster, launch workflow, brand, landing, build pack

## 2026-11-06 - Planned (Phase 2, no code)

- Branch and worktree: `claude/wp75-crew` at `.worktrees/wp75-crew`, from `origin/main` `d0f6e572`.
- Stories: `docs/wp/wp75-stories.md` (S1, S2a–b, S3a–d, S4a–b, S5a–c, S6a–d).
- WP76 dependency: WP76 starts after **S2b** merges (job runner + launch DAG with WP76 step slots). WP76 can also
  reuse S4a's checks.
- Needs from Codex: items 1–18 below (S3a added 16 and 17, S2b added 18); items 1, 3 and 4 block stories.

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
| S1 roster | **Built, not reviewed** (uncommitted on `claude/wp75-s1-roster`); story ticked | **Yes** | Codex 13 (recovery cron) before it ships | Opus (Sonnet UI) / Opus |
| S2a job runner | **Done**: review + re-check approved, fixes in `464931e7`, `b8c665e5` | **Yes** | Codex 13 (recovery cron) before S1 ships | Opus / Opus |
| S2b launch DAG | **Built, reviewed, fixes in** (uncommitted on `claude/wp75-s2b-dag`); story ticked | **Yes** | Codex 13 (recovery cron) and 18 (launch sweep) before it ships | Opus / Opus |
| S3a blueprint + brand text | **Built, not reviewed** (uncommitted on `claude/wp75-s3a-blueprint`); story ticked, repair waits for S4b | **Yes** | S4b repair through the `repairArtifact` seam (Owner Q6, Q7); seeds use HydroTrail fixture until WP71-S5 | Opus / Opus |
| S3b logo marks | Not started | Yes (fixture image adapter) | Stop-and-ask 11, 12, 14; Owner Q2, Q3 | Opus / Opus |
| S3c landing spec | Not started | Document only | Codex 1 for the site version write | Opus / Opus |
| S3d build pack | Not started | Yes for HydroTrail fixture | Owner Q8, Q9; WP71-S5 seeds | Opus / Opus |
| S4a deterministic checks | **Done**: three review rounds, precision-first final (`486e6516`), merged into `claude/wp75-crew` | **Yes** | — | Opus logic, Sonnet tests / Opus |
| S4b quality + repair + policy | Not started | Yes, after S2a + S4a | Owner Q6, Q7; Codex 11 | Opus / Opus |
| S5a renderer sections | **Built** (uncommitted, awaiting review) | **Yes** (fixture brand kits) | D24/D25 ruled 2026-11-06 (PR #222) | Sonnet / Opus + a11y-check |
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
15. ~~`lib/workspace/contracts/artifacts.ts` imports `./roster` with no extension (blocking the S3a lock).~~
    **Resolved in the Claude lane (2026-11-06):** `lib/workspace/contracts/**` is WP69, Claude lane. Lines 44-45 now
    import `./roster.ts`; import specifiers only, no contract change. It was the only extensionless relative import
    the S3a specs reach (`prompts.ts`, `artifacts.ts`, `roster.ts`, `crewShared.ts`). The three S3a lock entries
    were rewritten with plain `--write`; no existing entry moved.
16. Optional `documents.qualityIssues` (array of issue codes) so S3a's soft issues can be stored with the draft.
    Until then they are returned as `softIssueCodes` and dropped.
17. **`idea_crew_seeds.seedVersion` sorts as text in its index** (S3a; see § S3a review fixes). The newest-100
    read picks the highest version numerically, so this only bites past 100 rows for one slug. Fix: a numeric or
    zero-padded sort field in the index.
18. **A launch sweep, riding on 13's cron** (S2b review minor 4). It would re-advance every owner with a launch
    in progress (`advanceOwner`). It would also re-enqueue a running `task_steps` marker whose workpool work is
    gone. Today a throw inside `stepDone` strands that marker until the founder acts. Storing the workpool
    `workId` on the marker would make "work is gone" exact, but `task_steps` lives in Codex's `convex/schema.ts`,
    so S2b stores none. Without the `workId`, the sweep can treat a running marker with no open run for longer
    than `RUN_LEASE_MS` as gone.
    **Built 2026-11-07 (L1 launch sweep, Codex 18 board):** `internal.crew.launch.recoverStalledLaunches({})`.
    Codex wires it on #259's five-minute cron. See § L1 launch sweep at the end of this file.

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
11. ~~`crewJob` limit: per launch or per step (Stop-and-ask 10)?~~ Answered 2026-11-06: one token per founder
    action; built in S2b.
12. Free-ceiling accounting: $1.50 lifetime covers about two launches at the measured $0.57 median, one at p90
    $1.20. Is a launch's first draft charged to the free ceiling, or to a platform budget?
13. ~~Does the roster get an `artifact_review` card, or does the team just appear?~~ Answered 2026-11-06: the team
    just appears, no card (`docs/wp/RULINGS.md`, "WP75-S1 roster review card (Q13)").

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

- **PR #216 review (Codex), every match**: a pattern with a refinement is now tried at every match in a string, keeping the most severe finding per code, so a softened or skipped first match ("Join 50 hikers. Join 2,000 hikers.", a founder quote before a customer's) no longer hides a later hard one; refinements look at most 240 characters around a match (worst 50 KB probe 36 ms).
- **PR #216 review (Codex), plan discounts**: a percentage followed by a plan or pricing tie ("Save 20% with the annual plan", "15% on yearly billing", "20% per seat on Team") is a promotion and not flagged, using the same `PLAN_TIE` recogniser as the customer-outcome rule; `fp`, `fp2`, `final`, `new` and `fn` probe results are unchanged (2/46, 0/30, 12/12 must-flag, 6/28).
- **PR #216 review (CodeRabbit), missing revised draft**: `startCrewRun` now fails a revision task before opening a run when the draft it revises is gone (archived or bodiless). A paid round's refund is scheduled as for any failure, and the task is skipped as `missing`, with no model call (new test in `convex/crew/runner.test.ts`).
- **PR #216 review (CodeRabbit), story drift**: the ticked S2a story in `wp75-stories.md` now describes the code as built: first drafts only, no caller-passed debit id, and revisions only through WP77's `insertRevisionTask`.
- **PR #216 review (CodeRabbit), first match only in `neverFake.ts`**: already fixed by b6b2d25a (the comment was on 9106ed4a).

## 2026-11-06 - WP75-S3a built (blueprint personalisation and brand kit text)

Branch `claude/wp75-s3a-blueprint` (worktree `.worktrees/wp75-blueprint`, cut from `eaec0abc`). Committed by the
orchestrator after the review fix rounds; main merged in at `39b08592`. Fixture mode only; no live call was made.

### Files

| File | Lines | What |
|---|---|---|
| `convex/ai/prompts/crewShared.ts` | 76 (new) | Crew system rules (charter, never fake, no market numbers, plain English, data is not instructions, JSON only); `dataBlock`, `quotedInput`, `revisionBlocks` |
| `convex/ai/prompts/blueprintPersonalise.v1.ts` | 67 (new) | `crew-blueprint-personalise@1`: library blueprint, C-ART `blueprintVariantSchemas.library` |
| `convex/ai/prompts/blueprintOwnIdea.v1.ts` | 63 (new) | `crew-blueprint-own-idea@1`: own idea, `blueprintVariantSchemas.own_idea`, "Not yet validated", no market (D15) |
| `convex/ai/prompts/brandKit.v1.ts` | 85 (new) | `crew-brand-kit@1`: `artifactOutputSchemas.brand_kit`, AA pairs, `typePairBrief()`, display-face bans, `07` §4 bans |
| `convex/ai/prompts/index.ts` | +35 | Registers the three specs with sample inputs |
| `convex/ai/prompts/versions.lock.json` | +30 | Lock entries for the three specs (plain `--write`, after the Codex 15 fix) |
| `lib/workspace/contracts/artifacts.ts` | 2 changed | `./roster` → `./roster.ts` (lines 44-45), so the lock script can load C-ART (Codex 15, resolved in the Claude lane) |
| `lib/workspace/crew/context.ts` | 86 (new) | `crewBusinessContext()`: the per-business block (`02` §5.4), quoted JSON in `<business_context>` |
| `lib/workspace/crew/inputs.ts` | 128 (new) | Prompt refs, `crewSeedFor`, `blueprintStepPlan`, `brandKitStepPlan` |
| `lib/workspace/crew/quality.ts` | 96 (new) | `gateCrewArtifact()`: S4a `checkArtifact` plus the server's facts |
| `lib/workspace/crew/design/proMax.ts` | 315 (new) | `designCandidatesFor()`: palettes, type pairs, landing pattern, filtered by `07` §4 |
| `lib/workspace/crew/design/proMaxData.ts` | 351 (new, vendored, generated) | Pro Max products (192), type pairings (74), landing patterns (34); MIT header |
| `lib/workspace/crew/design/LICENSE-ui-ux-pro-max` | 21 (new) | MIT licence, Copyright (c) 2024 Next Level Builder |
| `lib/workspace/crew/retry.ts` | +12 | The calm quality notes (`FAILED_STEP_QUALITY_REASON`, refunded variant) |
| `convex/crew/generators.ts` | 190 (new) | `prepareCrewStep` (internal query), `runCrewGeneratorStep` (internal action) |
| `convex/crew/jobs.ts` | +62 / -6 | Quality gate in `finishCrewStep`; `rejected` result; `softIssueCodes`; `quality` on `startCrewRun` |
| `convex/crew/runner.ts` | +73 / -3 | `preflight`; the S4b repair seam (`CrewArtifactRepair`, `noArtifactRepair`) |
| `convex/_generated/api.d.ts` | +2 | `crew/generators` module (what codegen writes) |
| `convex/crew/generators.test.ts` | 385 (new) | convex-test, real registry and meter, fixture adapter |
| `tests/platform/workspace-crew-s3a.test.ts` | 253 (new) | Specs, founder-text blocks, context, inputs, gate, Pro Max bans |

Size: about 1,290 hand-written source lines and 640 test lines, vendored data and the lock aside. That is over the
1,500-line guide with tests. If the orchestrator wants two commits, the split is:
- **S3a-1 (blueprint):** `crewShared.ts`, both blueprint specs, `context.ts`, `quality.ts`, `retry.ts`, `jobs.ts`,
  `runner.ts`, `inputs.ts` without `brandKitStepPlan`, `generators.ts` with the brand kit branch refusing
  ("not built yet"), the blueprint tests.
- **S3a-2 (brand kit):** `brandKit.v1.ts`, `design/**`, `brandKitStepPlan`, the brand kit branch of `prepareCrewStep`,
  the brand kit and Pro Max tests, and its lock entry.
Both halves are finished here, so the split is only a commit boundary.

### Design

- **Prompts.** `draft` tier, effort `low`, thinking off between tools (`02` §5.2), `fallbacks: "none"`, one
  structured call per step with the C-ART schema as the output schema. Because the output schema is the C-ART
  schema, the fixture client already answers each spec with the HydroTrail instance (blueprint, own-idea light
  blueprint, brand kit) with no `FIXTURE_OUTPUTS_BY_REF` entry. The system block is identical for every business
  (cache layout `stable` + `per_business`, ttl 5m); the business arrives in the gateway's `businessContext` block.
- **Founder text.** Only inside tagged data blocks, as JSON with `<` and `>` escaped (`<`, `>`), so no
  input can close a block or open a new one. The runner's revision blocks pass through only with their exact
  envelope; anything else is quoted again. Tests cover each spec, the context block and a full fixture request.
- **Prompt choice.** By `projects.source`: a library business gets `crew-blueprint-personalise@1`, an own idea
  `crew-blueprint-own-idea@1`. The wizard answers must agree with the project (source and slug), else the step
  fails before any call.
- **Seed.** `idea_crew_seeds` (newest `seedVersion` for the slug) when the row parses as a library blueprint for that
  idea; the HydroTrail fixture seed for `hydrotrail`; otherwise none (the library idea record carries the facts).
  Seeds are read without an owner filter: they are per-idea platform content (Needs from Codex 6).
- **Own idea.** The input carries the wizard's preview outline (`ownIdeaBlueprintPreview`). The own-idea schema has
  no `market`, so a library-shaped reply fails the schema; the stored blueprint keeps `blueprintIsValidated() ===
  false`, which is what shows "Not yet validated".
- **Brand kit inputs.** The newest stored blueprint document for the project (owner-matched, not archived), the
  founder's answers (`name.chosen` is the kit's name), and the Pro Max candidates. A brand kit before any blueprint
  fails before any call.
- **Pro Max lookup (`07` §2B).** Deterministic TypeScript over the vendored CSVs (local copies byte-identical to
  upstream commit `b7d5353e`, except `products.csv`, taken from upstream). Product type: keyword-phrase overlap with
  the blueprint's words (two or more), else a default per `profile.ideaKind` and `buyer`. Palettes map Background to
  ground and Foreground to ink; any palette below 4.5:1 on a `BRAND_TEXT_PAIRS` pair is dropped and recorded (for
  HydroTrail the "Water & Hydration Reminder" palette itself fails, `#0284C7` on `#F0F9FF`). Type pairs: only our
  14 curated ids, ranked by moods of Pro Max pairings that share a family and whose display face is not in
  `BANNED_DISPLAY_FAMILIES`; ties break by a stable hash of the product type so businesses do not all get the same
  first pairs. Landing pattern: 6 of the 34 are allowed (`hero-features-cta`, `minimal-single-column`,
  `funnel-3-step-conversion`, `product-demo-features`, `hero-centric-design`, `lead-magnet-form`); the other 28 are
  banned with a reason (fake proof, competitor or price tables, metric or card grids, effects the renderer cannot
  draw). The fallback is `minimal-single-column`.
- **Quality gate.** `finishCrewStep` is the authority: after `parseModelOutput`, `gateCrewArtifact` runs S4a's
  `checkArtifact` with `ownIdea` from the project and `brandName` from `projects.workspace.name` (a server fact, so
  a model-written name can never widen the "{name} costs $79" exemption). For a library blueprint, `ideaSlug` is
  code-owned (set to the project's slug, then re-parsed), because `rosterInputFromWizard` requires it to match. A
  hard issue fails the step closed: no document, no card, task failed, the calm quality note on the workstream, the
  debit refunded if there was one; the result is `{kind: "rejected", refundScheduled, issueCodes}` (codes only,
  never messages). Soft issues never block and come back as `softIssueCodes`.
- **S4b seam.** `CrewRunnerDeps.repairArtifact` (default `noArtifactRepair`, returns null). The runner pre-checks a
  gated kind's parsed draft and calls the seam only on hard issues; the seam's result is what `finishCrewStep`
  sees. Not built: Owner Q6, Q7.
- **Preflight.** When `prepareCrewStep` cannot build inputs, the generator still opens a run and settles it as a
  `config` failure before any provider call, so the usual guards and notes apply.

### Plan vs reality

- The story says a failing kit "is repaired once and then stored or failed per the ruled policy". Q6/Q7 are not
  ruled, so the kit fails closed with no repair; the `repairArtifact` seam is in place. The orchestrator ticked
  the story with that note: the repair step waits for S4b.
- C-ART's extensionless `./roster` import stopped the lock script (`node --experimental-strip-types`). It was
  first logged as Codex 15, then fixed in the Claude lane (WP69 owns `lib/workspace/contracts/**`): import
  specifiers only, and the S3a lock entries rewritten.
- `documents` has no field for soft issues (Codex 16).

### Needs from Codex (S3a)

- 16 (optional), above; 6 still applies to seeds. 15 is resolved in the Claude lane.
- 17 (before seed writers land): `idea_crew_seeds.seedVersion` sorts as text in its index ("v10" sorts before "v9"). The
  read takes the newest 100 rows and picks the highest version numerically, so this only bites past 100 rows for one
  slug. Fix: a numeric or zero-padded sort field in the index.

### Checks

| Check | Exit |
|---|---|
| `git diff --check` | 0 |
| `npm run typecheck` | 0 |
| `npx tsc -p convex --noEmit` | 0 |
| `npm run lint` | 0 (37 warnings, none in S3a files) |
| `npm run check:prompt-versions` | 0: 6 prompt versions match the lock (plain command, no hook) |
| `npx vitest run` new and related (`generators`, `runner`, `workspace-crew-s3a`, `crew-fixture-outputs`, `ai-registry`) | 0 (108 tests) |
| `npm run test:convex` | 0 (79 files, 1,089 tests) |
| `npm run test:platform` | 0 (76 files, 2,021 tests) |
| `npm run test:prompts` | 0 (2 files, 24 tests) |
| `npm run test:security` | 0 (node 219 pass, 1 CI-only skip; vitest 5 files, 121 tests) |
| `npm run build` | 0 |

Once C-ART loaded, `tests/security/prompt-versions.test.mjs` reached a test it had never run before: "the run part
carries the router's resolved model and input ceiling" read `listEntries()[0]` and expected the probe's fast tier.
`crew-blueprint-own-idea@1` now sorts first, so the test reads the probe through its existing `probeEntries()` helper
instead (one line, test only; the WP77-S3 note in that file already reads the probe alone).

- Docs updated: this file (S3a section, Status row, Needs from Codex 15 resolved and 16). Stories: S3a ticked, with the S4b repair note.

## 2026-11-06 - S3a review fixes (independent Opus review of `e65d97a4`: no blockers, 2 majors, minors)

Uncommitted in `.worktrees/wp75-blueprint`. Fixture mode only.

### Majors

- **M1, a library blueprint's `market` was model-written and unchecked.** S4a skips the market subtree as research
  (`isResearchedMarketPath`), but the model wrote it, even with no seed. Route taken: **`market` is code-owned**, like
  `ideaSlug`. The quality context now carries the seed's market (`seedMarket`, read by `qualityContextFor` from the
  same platform seed the prompt saw, or the HydroTrail fixture seed). With a seed, the stored `market` is the seed's;
  with no seed (or a seed with no market), `market` is dropped. Dropping, not checking, because C-ART's library
  variant makes `market` optional, and market text with no research behind it is invented whatever the checks say;
  running `checkNeverFake` / `checkMarketNumbers` on it would still store unresearched copy that happens to pass.
  The "Trusted by 10,000 hikers; a $4 billion market growing 20% a year." repro is now dropped (stored without
  `market`), and a seeded run stores the seed's market even when the model wrote different text (convex-test and
  pure tests).
- **M2, a short business name whitelisted competitor prices.** `marketNumbers.ts` matched the brand as a suffix of
  the captured name (`endsWith`). It now matches whole words only: the whole captured name (spacing aside) equals
  the brand, or its last N whole words equal the brand's N words. Brands "a", "gonia", "Agonia", "Pata" and
  "HydroTrail" leave "Patagonia charges $200 for this. Ours is $79." hard; a business really named "Patagonia" is
  clean (its own price, per the S4a ruling). "Today HydroTrail costs $79" stays the business's own. Every existing
  S4a test is green.

### Minors

1. The brand kit reads the newest blueprint whose `artifact_review` card is approved and still valid for it
   (`assertApproved`); a draft is never used. With none approved, preflight fails as `config` before any call. No
   prompt change was needed: `brandKit.v1` already says "approved", which is now true.
2. Seeds: `platformSeedRow` (in `jobs.ts`, shared by the generator and the gate) reads only platform rows
   (`projectId` unset) and picks the newest `seedVersion` with `compareSeedVersions` (numbers as numbers, no `Intl`).
   Tested with v9 / v10 plus a newer business-tied v11 that is ignored.
3. The brand kit's `name` is code-owned: the gate sets it to `projects.workspace.name` and re-parses.
4. Tests that kill the surviving mutations: preflight asserts `runPrompt` is never invoked and checks the settled
   failure (`{kind: "config", message}`) and run `errorCode`; a Healthcare App blueprint (pattern "Social
   Proof-Focused", banned) falls back to `minimal-single-column`; a model-written kit name "Patagonia" does not widen
   the exemption when the workspace name is HydroTrail; the type-pair order differs from list order for HydroTrail
   and between product types. The tie-break and landing-fallback tests were confirmed to fail with the protection
   removed.
5. Repair-throw numbering: the seam now passes `CrewRepairInput.attempt` (`result.nextAttempt`) and documents its
   contract: at most one gateway run starting there, so a throw settled one `UNKNOWN_OUTCOME_ATTEMPT_STRIDE` later
   covers it. A `TODO(S4b)` in `runner.ts` and an S4b note on the S3a story say what to do if the repair needs
   more than one run (report the highest attempt used). Returning attempts from a seam with no implementation was
   judged too invasive.

Soft issues not being stored stays Codex 16.

### Files

- `lib/workspace/crew/checks/marketNumbers.ts`: whole-word own-name match (`isOwnName`), replacing `nameKey().endsWith`.
- `lib/workspace/crew/quality.ts`: `seedMarket` and code-owned `market`; `normaliseBrandKit` (code-owned `name`).
- `lib/workspace/crew/inputs.ts`: `compareSeedVersions`, `newestPlatformSeed`.
- `convex/crew/jobs.ts`: `platformSeedRow`, `qualityContextFor` (async, adds `seedMarket`), validator updated.
- `convex/crew/generators.ts`: `approvedBlueprint` (approved and valid card), `platformSeedRow`.
- `convex/crew/runner.ts`: `CrewRepairInput.attempt`, the attempt contract and `TODO(S4b)`.
- Tests: `convex/crew/generators.test.ts` (17), `tests/platform/workspace-crew-s3a.test.ts` (31),
  `tests/platform/workspace-crew-checks-market-slop.test.ts` (+1 regression test).
- Docs: this note; `wp75-stories.md` S3a S4b note.

### Round 2 (Opus re-check: M1, minors 2, 3 and 5 and the four test gaps confirmed; one major and minors left)

- **Major, a rival whose last words equal the brand was exempt.** The tail rule let "Pokemon Go" (brand "Go"),
  "Disney Plus", "Trail Pro", "Trader Joe's", "McDonald's" (brand "S") and "Rei Patagonia" through. `isOwnName`
  now exempts a captured name only when it is the whole brand (spacing, case, apostrophes and NFKC folded), or the
  brand after a closed list of sentence-start words (today, now, right now, currently, here, so, yes, still, then,
  and, but, at launch; the tail of a phrase counts, because the capture can start mid-phrase). An apostrophe stays
  inside its word, so "Joe's" is one word and never yields a separate "s". Tests: every rival above is hard with its
  brand, exactly as with a neutral brand; "Today HydroTrail costs $79", "Hydro Trail costs $79" and "Today Hydro
  Trail costs $79" are clean for HydroTrail; "Big Trail Pack charges $79" with brand "Pack" is now hard. Every S4a
  test is green.
- **Minor 1, seed window.** `platformSeedRow` reads the index newest first (`order("desc")`), so per-business rows
  crowd only the old end, and returns `overflow` when the bounded read (100) was full with no platform row; the
  generator then refuses as `config` ("the idea's research seed could not be read") before any call. Residual: the
  index orders `seedVersion` as text, so with more than 100 rows a numerically newer version that sorts lower as
  text ("v10" below "v9") could fall outside the window. WP71-S5 writes a handful of rows per idea, so this is noted,
  not fixed (a numeric sort key would need a schema field, which is Codex's).
- **Minor 2, one seed per step.** No schema change was needed. `prepareCrewStep` returns the seed row's `_id`;
  `runCrewStepArgs` carries it as `seedId` (so scheduled retries keep it); `startCrewRun` and `finishCrewStep` take
  it; `qualityContextFor` re-reads exactly that row by id. A row that is gone, or is no longer a platform row for
  the idea, drops `market`; it never falls back to another row or to the HydroTrail fixture. With no `seedId` (the
  prompt read no stored row) the gate uses the same fallback the prompt did.
- **Minor 3, approval at finish.** `approvedBlueprint` moved to `jobs.ts`. `prepareCrewStep` returns the brief's
  document id; `runCrewStepArgs.briefDocumentId` carries it, and `finishCrewStep` re-checks that exact document is
  still an approved blueprint (`isApprovedBlueprint`, the same `assertApproved` test) before a kit is stored. Only
  generator runs carry a brief: a direct S2a `runCrewStep` with its own inputs briefs no blueprint and is not
  re-checked (re-checking every brand kit run broke 10 S2a runner tests, which run a kit with no blueprint). Path taken: the existing permanent-failure path (`closeRun` permanent,
  `failTask`: no document, the usual calm note, a debit refunded), returning `{kind: "failed"}`. It matches what a
  preflight `config` failure ends as (errorCode `permanent`, same note), and a quality rejection would have told the
  founder the draft was poor, which it was not.
- **Minor 4, the `assertApproved` gap.** New test: the blueprint document is edited after its card was approved;
  the kit's preflight fails as `config` with no call.
- Mutation checks, each confirmed to fail a new test: `assertApproved` made a no-op; the seed read ascending; no
  re-check at finish; the gate re-reading the newest seed instead of `seedId`; a vanished row falling back to the
  fixture.

Files (round 2): `lib/workspace/crew/checks/marketNumbers.ts`; `convex/crew/jobs.ts` (`seedId`, `briefDocumentId`,
`platformSeedRow` overflow and order, `stepSeedRow`, `isApprovedBlueprint`, `approvedBlueprint`, the finish
re-check); `convex/crew/generators.ts` (seed read result, `seedId`, `briefDocumentId`); `convex/crew/runner.ts`
(passes both); tests: `convex/crew/generators.test.ts` (23, +6),
`tests/platform/workspace-crew-checks-market-slop.test.ts` (+1 test, one case changed to hard).

## 2026-11-06 - WP75-S5a built (tenant renderer: sections and art directions)

Uncommitted in `.worktrees/wp75-renderer` (branch `claude/wp75-s5a-renderer`, from `origin/main` `2e1ecf4a`). D24 and D25 ruled 2026-11-06 by the owner (recorded in PR #222, pending merge).

### Files (about 1,280 lines)

- `components/tenant-site/`: `TenantSite.tsx` (root), `sections.tsx` (nav, hero, promises, how it works, app preview, waitlist shell, footer), `theme.ts` (colours, AA), `styles.ts` (generated stylesheet), `fonts.ts` (loaders), `icons.tsx`, `platform-text.ts`, `tenant-site.module.css`, `index.ts`.
- Tests: `tests/platform/wp75-tenant-renderer.test.tsx` (jsdom + axe, 79 direction x section x layout cases + structure), `tests/platform/wp75-tenant-theme.test.ts` (contrast, fallbacks, 400 seeded random kits, font loaders vs `TYPE_PAIRS`), `tests/security/wp75-tenant-renderer.test.tsx` (hostile text, links, colours; proof slots; platform text), `tests/platform/tenant-site-helpers.tsx`.

### Design choices

- **Colours.** `deriveTheme(kit)` re-grades every `BRAND_TEXT_PAIRS` pair with `contrastRatio`. A pair under 4.5:1 is drawn as ink on ground; if ink on ground fails, black or white on ground, and `degraded` is set. Text is only ink, primary (links) and ground (buttons, dark band); the accent draws underlines, marks, icons and focus, never text. No muted text colour (it would need its own pair): hierarchy is size and weight. The tinted `surface` backs off until ink and the link colour stay AA on it. Focus ring (light zones, dark band), control borders, button border and icons are computed to 3:1 against every zone they sit on. Selection uses the button pair, or system `Highlight` when that pair fell back to ground on ground.
- **Applying colours.** One generated `<style>` with one rule scoped to `.tsr-{hash of the values}` (custom properties plus `color-scheme`), and optional `html:has(.tsr-x)` for the document scrollbar when `themeDocument` is set. Chosen over `style={{"--x": v}}` because `::selection`, scrollbar and `color-scheme` of the page cannot be reached from an element's custom property, and it keeps every `style=` attribute out of the DOM. Safety: each value must match a strict allow-list (lowercase `#rrggbb`, system keyword, weight, our font stacks) and the finished sheet a character allow-list with no quote, angle bracket or ampersand; a miss throws. Hex comes through `safeHex`, enum fields through closed lists. A hostile kit renders neutral colours and the default direction. No CSP exists today; a future `style-src` with nonces would need this `<style>` to take one.
- **Fonts.** `next/font` cannot choose a family at render time and its loaders must be literal module-scope calls, so `fonts.ts` holds one literal loader per family (27) and a `TENANT_FONTS` map from pair id to classes and variables. `preload: false`, `subsets: ["latin"]`; only the chosen pair's classes go on the root. A test checks each family's weights against `TYPE_PAIRS` and each variable against its loader. No italic faces are loaded (several heading faces have none): emphasis is an accent underline, `font-synthesis: none`.
- **Directions.** Six worlds in `tenant-site.module.css` via `data-direction` (measure, heading scale, tracking, border weight, plate art, one motion moment each: editorial underline draw, warm utility card rise, bold headline wipe, quiet technical grid fade, handmade plate settle, dense product frame rise). All motion is inside `prefers-reduced-motion: no-preference` and nothing starts hidden without it. Sections size from the container (`container: tsr / inline-size`, `cqi`, `@container`).
- **Images.** The contract has no image URL (`ImageSpec` is a description and alt), so image slots draw a brand-coloured plate in `role="img"` with the alt as label; the description is never shown. Hero product-moment text sits beside the `role="img"` node so it stays readable.
- **Platform text** lives in `platform-text.ts`: skip link, "Highlights" (the screen-reader h2 for promises, which has no heading field), the privacy line and link, "Made with Weekend MVP", the new-tab hint, the preview-form note. The footer year is a required `platform.year` prop, so the component reads no clock.
- **Waitlist.** `waitlistSlot` takes S5b's form. Default is a disabled shell (`data-waitlist-slot="placeholder"`, no `<form>`, nothing posts). `waitlistClasses` exports the themed class names for S5b's client form.
- **Fail closed.** CTA targets must be a present in-page anchor or `isSafeHttpsUrl`, else the label renders as plain text; a layout the direction does not allow renders as the direction's first allowed one.

### Plan vs reality

- `LANDING_SECTION_ORDER` has no nav; the nav is always first, with its one layout, as `SECTION_LAYOUTS` implies.
- `package.json` `test:security` lists vitest files by name, so `tests/security/wp75-tenant-renderer.test.tsx` does not run under `npm run test:security` yet (run directly: 26 pass). Codex request below.
- Not viewed in a browser: no route exists until S5b. A throwaway probe route (removed) proved `next build` compiles the loaders and prerenders the page with no font preload links.

### Open items

1. **Codex:** add `tests/security/wp75-tenant-renderer.test.tsx` to `test:security`.
2. **Font CSS weight.** All 27 loaders' `@font-face` rules ship with any page that imports the renderer: about 100 KB of CSS (275 faces) in the probe build. Only the chosen pair's files download, but the CSS does not shrink. Fix in S5b/S5c: one module per pair, loaded on demand.
3. **Duplicate ids** (`#top`, `#main`, `tsr-*`) if S6c shows the desktop and 390px frames on one page, and nested `<main>` inside the workspace `<main>`. S6c should render one frame or add an embedded mode.
4. **Live a11y pass** (real contrast, focus visibility, 200% zoom, reduced motion) belongs to S5c with Playwright; jsdom checks structure only.
5. Italic emphasis for the faces that have italics is a possible later polish.

### Checks

`git diff --check` 0; `npm run typecheck` 0; `npm run lint` 0 (no warnings in new files); new vitest files 116 pass; `npm run test:security` 0; `npm run test:platform` 0 (2,087 tests); `npm run build` 0.

### S5a review fixes (Opus review: 0 blockers, 1 major, 4 minors, nits)

- **Major, button border.** `buttonBorder` now uses `firstPassing([button background, body text], light zones, 3)`; the dark band is left out because `.inverse .btn` sets its own border. Repro kit (ground `#f2eee6`, ink `#111111`, primary `#a9c4ce`) is a named test; the 400-kit loop also asserts btn-border, icon, icon-inverse, focus-inverse, control-inverse (3:1) and link on surface (4.5:1). Reverting the fix makes the loop fail.
- **Stylesheet.** `tenantStyle` checks `mode` against `THEME_MODES` and the heading weight (integer 100 to 900), and a `DENIED` pattern (`url`, `@`, `!`, backslash, import, expression) runs next to the character allow-list. Direct tests with forged vars, names, mode, weight and font stack all throw.
- **Icons.** Lookup checks `LANDING_ICONS` first, so prototype keys render no icon; tested.
- **Unparsed input.** Security test comment corrected; `TenantSite` doc says callers pass schema-parsed values; S5b acceptance line added to the stories.
- **Render-level contrast.** A low-contrast kit renders `--t-link` equal to `--t-ink` in the generated `<style>` (tested).
- **Nits.** Duplicate width/height and dead `type_led .plate` rule removed; unsafe CTA is a bare `<span>`; `--t-hw` default dropped from `.root`; disabled shell button is dashed with a 3:1 border and surface fill; D24/D25 wording fixed; S5a story unticked (the coordinator ticks it on commit).

## 2026-11-06 - WP75-S1 built (roster at Meet your co-founder)

Branch `claude/wp75-s1-roster` (worktree `.worktrees/wp75-roster`, cut from `origin/main` `3a592f6e`). Uncommitted; the
orchestrator reviews and commits. Fixture mode only; no live call was made. Owner Q13 ruled today: no roster card, the
team just appears (`docs/wp/RULINGS.md`).

### Files (about 830 source lines, 640 test lines)

| File | What |
|---|---|
| `convex/crew/roster.ts` (new, 208) | Public `startLaunch`, `retryLaunch` (mutations) and `launchStatus` (query); each checks `workspace`, then `ai`, then `requireBusinessAccess(owner)` |
| `convex/crew/launchRoster.ts` (new, 240) | Helpers, no registered functions: the launch's roster task, `planLaunchRoster`, `writeLaunchRoster`, reads |
| `convex/crew/jobs.ts` (+16) | `finishCrewStep`: a launch's first-draft blueprint plans and writes the roster in the same transaction |
| `lib/workspace/crew/launch.ts` (new, 138) | Pure: workstream titles, `rosterMemberRows`, the `LaunchView` states, `readyLaunchView`, `pendingLaunchView` |
| `components/workspace/wizard/MeetCofounder.tsx` (+202) | `CofounderTeam` (the four states), `LiveCofounderTeam` (calls `startLaunch`, reads `launchStatus`, inside `QuietErrorBoundary`), `launchErrorMessage` |
| `components/workspace/wizard/WizardFlow.tsx` (+10) | Passes the live team to Meet your co-founder with the business's `projectId` |
| `convex/_generated/api.d.ts` (+4) | `crew/launchRoster` and `crew/roster`, hand-added in codegen's form and order |
| `convex/crew/roster.test.ts` (new, 17 tests) | convex-test, real registry, meter, ledger, approvals and limiter; signed-in callers |
| `tests/platform/wp75-meet-cofounder-team.test.tsx` (new, 10 tests) | jsdom + axe on every state |

### Design

- **Where the roster hook lives: inside `finishCrewStep`**, so the blueprint and the team commit in one transaction.
  The roster is planned before any write. If it cannot be planned (the session's answers are unusable or do not match
  the blueprint), the blueprint step fails closed (permanent): no blueprint document, no card, no roster, and Meet
  your co-founder shows the retry. So a succeeded launch blueprint always has its team. A scheduled follow-up
  mutation was rejected: it would leave a window, and a failure state, in which the blueprint exists but the team
  does not.
- **How the launch's blueprint is identified, with no schema change.** `startLaunch` inserts the business's
  `crew_roster` task (`crew:{projectId}:crew_roster:main:0`, `queued`, `creditCost: 0`) next to the blueprint's first
  draft. That task is the launch. `finishCrewStep` writes the roster only for a first-draft blueprint (round 0, not a
  revision, the revision-0 key) whose business has that roster task still open. A blueprint that no launch started
  (S3a's tests, direct S2a runs) and every blueprint revision plan nothing.
- **Idempotency.** A roster task that is already `succeeded`, or an existing `roster_plans` row, writes nothing. A
  replayed finish is `stale` (the run is closed) and a re-delivered step is `skipped: terminal`. A role that already
  has a member row keeps it, and a member with a workstream keeps it. Both are tested.
- **One token per founder action.** Only `insertCrewTask` checks `crewJob`, once per inserted task. A launch inserts
  one such task (the blueprint's first draft). The roster task is inserted directly, and the roster is written by the
  blueprint's finish, so neither spends a token. If the first draft already exists (so the insert returns it and
  spends nothing), `startLaunch` calls `checkLimit` itself, once. `limits.ts` is unchanged, and S2b still moves the
  check. Tested with the limiter's `getValue`: twice `startLaunch` = 1; reload after failure = 1; retry = 2.
- **Retry: a separate `retryLaunch`.** `startLaunch` runs on mount, so if it also retried, a page reload after a
  failure would spend a token without the founder asking. `startLaunch` therefore only ever starts or reports.
  `retryLaunch` is the Retry button:
  - after a failed (or cancelled) blueprint, it inserts a new first draft through `insertCrewTask` (one token, the
    `:retry:{n}` idempotency key), then schedules it;
  - on a paused (`blocked`) blueprint, it resumes it with `resume: true` (one token, via `checkLimit`);
  - while the blueprint is queued or running, or once the team exists, it writes and spends nothing;
  - before any launch, it refuses `LAUNCH_NOT_STARTED`.
- **Runner mode.** The step is scheduled as `internal.crew.generators.runCrewGeneratorStep({ taskId })`, which is
  S3a's generator path with no `retryMode`, so it runs in schedule mode. S2a's `settleCrewRun` re-invokes its own
  retries; the recovery cron (Codex 13) catches dead actions.
- **Roster writes.**
  - The roster task goes queued → running → succeeded through `assertTaskTransition`.
  - `roster_plans` stores `ROSTER_RULES_VERSION`, the hired keys and the skipped `{roleKey, reason}`.
  - There are 13 `crew_members` rows: hired roles are `queued` and named by employee, skipped roles are `skipped` and
    named by role; every row is `hiredBy: rule` with `autopilot: false`.
  - There is one `workstreams` row per hired specialist (8 for HydroTrail; Wren, the Crew Lead, owns none). The titles
    are in `WORKSTREAM_TITLES`.
  - The `roster_plan` document is `json`, schema version 1, and holds the full `RosterPlan`.
  - The Crew Lead is named for the founder's partner (`partnerNameFromWizard`).
  - No approval (Q13).
- **`launchStatus`** returns only `not_started`, `assembling`, `failed {paused}` or `ready {hired[{roleKey,
  employeeName, roleLabel, reason}], skipped[{roleKey, roleLabel, reason}]}`. It returns no ids and no prompt or model
  text. `roleKey` is the list key.
- **UI.**
  - An always-mounted `role="status"` polite region announces each state (the WP77-S6 pattern).
  - The Retry button reads "Try again", with the accessible name "Try again: put your team together", and is described
    by the failure text. While it works it is `aria-disabled` and keeps focus.
  - The hired and skipped roles are `ul` lists under h4 headings (h2, then h3 "Your team", then h4), and skipped roles
    say "Skipped" in text.
  - A failed read (AI switched off, say) falls back to a calm line inside `QuietErrorBoundary`, never a crashed page.

### Plan vs reality

- The story lists the `crew_roster` task among the roster transaction's writes. As built, `startLaunch` inserts it as
  `queued`, and the blueprint's finish moves it to `succeeded` in the roster transaction, with no gateway call and
  revision 0. The end state is the same. The early insert is what identifies the launch without a schema field.
- The story says "a second call returns the existing roster and launch". It does, and a second call never retries a
  failed blueprint: that is `retryLaunch`'s job, as explained above.
- A paused (parked) blueprint is shown as the failed state with `paused: true`, and Retry resumes it. S2b's
  `resumeLaunch` covers the rest of the DAG.
- Edge case: when `startLaunch` finds a first-draft blueprint that already succeeded outside a launch, it plans the team
  from that stored blueprint at once (tested).
- Not viewed in a browser: the screen needs a Convex backend, and this session is fixture-only with no `convex dev`.
  jsdom + axe covers its structure. Contrast uses existing `home-*` pairs (ink-2 on card, clay-ink on clay).

### a11y-check (changed UI: the Meet your co-founder team section)

| Item | Result |
|---|---|
| Icon-only buttons have `aria-label` | Pass: none. Retry has visible text and a fuller accessible name |
| Decorative icons have `aria-hidden` | Pass: the spinner is `aria-hidden`, and `motion-reduce:animate-none` |
| CSS/mask logos | N/A |
| Form inputs have labels | N/A |
| Images have `alt` | N/A |
| External links | N/A |
| Focus rings visible | Pass: `BTN_SECONDARY` carries the kit's `FOCUS` outline (`home-orange-ink`) |
| No colour-only indicators | Pass: "Skipped" is in text under its own heading; the dashed border only reinforces it |
| Heading hierarchy | Pass: h1 (wizard), h2, h3 "Your team", h4 Hired / Skipped for now |
| Keyboard | Pass: one native button, still focusable while `aria-disabled`; no overlays |
| State changes announced | Pass: an always-mounted polite `role="status"`; refusals in `role="alert"` |
| axe (jsdom, contrast rule off as in WP74's tests) | 0 violations in every state |

### Needs from Codex (S1)

- None new. The scanner (`tests/security/wp68-workspace-boundaries.test.mjs`) accepts `startLaunch`, `retryLaunch`
  and `launchStatus` as they are (6/6 pass).
- 13 (the `recoverStaleCrewRuns` cron) is still required before S1 ships. In schedule mode only the cron reaches a
  blueprint whose action died; until it runs, that launch stays "putting your team together".
- `npx convex codegen` should reproduce the two hand-added `api.d.ts` lines.

### Checks (after the last code edit)

| Check | Exit | Notes |
|---|---|---|
| `git diff --check` | 0 | Re-run after this doc edit: 0 |
| `npm run typecheck` | 0 | |
| `npx tsc -p convex --noEmit` | 0 | |
| `npm run lint` | 0 | 0 errors, 37 warnings, none in S1 files |
| `npm run check:prompt-versions` | 0 | 6 match the lock at `origin/main` |
| `npm run test:security` | 0 | node 219 pass, 1 skipped; vitest 121 |
| `npm run test:convex` | 0 | 81 files, 1,125 tests (`roster.test.ts` 17) |
| `npm run test:platform` | 0 | 79 files, 2,144 tests (`wp75-meet-cofounder-team` 10) |
| `npm run build` | 0 | |

- Docs updated: this section; the Status row; Owner Q13 answered; `wp75-stories.md` S1 ticked; the `RULINGS.md` Q13 row.

### S1 review fixes (Opus review: 0 blockers, 1 major, 7 minors, nits)

Still uncommitted on `claude/wp75-s1-roster`. Fixture mode only.

**Dormant until switched on.** `startLaunch`, `retryLaunch` and `launchStatus` each check
`assertFeatureEnabled("workspace")`, then `assertFeatureEnabled("ai")`, before `requireBusinessAccess`. Nothing runs
until both features are on. **Ship gate** (now in `wp75-stories.md` S1): do not switch S1 on in production until Codex
Need 13 (the `recoverStaleCrewRuns` cron) is registered.

| Finding | Fix |
|---|---|
| MAJOR: no test of `retryLaunch` authorization once a launch exists | Five new cases (non-owner, signed out, archived, workspace off, AI off), each after a launch whose blueprint failed. `retryLaunch`, `startLaunch` and `launchStatus` all refuse; tasks, scheduled functions and tokens are unchanged |
| Minor 1: `retryLaunch` while running | Tested: it returns `assembling` and writes, schedules and spends nothing |
| Minor 2: `writeLaunchRoster` idempotency | Direct test: a succeeded roster task with its plan row returns `"exists"`, and every row is unchanged |
| Minor 3: a revision must never plan a roster | Tested: a stored first draft, an open roster task, then a round-1 revision (`revisionOfTaskId`) that finishes. No `roster_plans` row and no members; the roster task stays `queued` |
| Minor 4: repeat failures burning tokens | Route below. Tests: a terminal case (three retries, no token, no rows, no schedule), a free retry once the answers are fixed, and a free heal |
| Minor 5: no way out when `startLaunch` is refused | Not started plus a refusal hides the spinner and "putting your team together" and shows "Try again". Try again calls `startLaunch` again (new `onStart` prop). The refusal is tied to the launch state it happened in, so it clears once the launch moves on |
| Minor 6: focus lost after Try again (WCAG 2.4.3) | The h3 "Your team" has `tabIndex={-1}`. When the clicked button unmounts it gets focus, but only if focus was left on `body`, so it never takes focus the founder moved. Tested both ways |
| Minor 7: plan from the approved blueprint | `launchBlueprintBody` prefers S3a's `approvedBlueprint` (the newest approved one) and falls back to the first draft's document. Tested: an approved course revision gives the course team; with no approval, the first draft's team |
| Nit: `planLaunchRoster` session checks | Now `launchWizardAnswers`: the session must be the owner's, linked to this project (`projectId`) and not abandoned, with valid answers |
| Nit: ship gate | Added to the ticked S1 story |

**Minor 4, the route taken: a free re-plan, plus an honest terminal state.** `LaunchView.failed` gains `retryable`.
- A succeeded blueprint with an open roster task is re-planned at no cost: no token and no gateway call, because the plan is deterministic. This applies to both `retryLaunch` and a later `startLaunch`, and the plan comes from the approved blueprint, else the first draft.
  - If the team plans, it is written.
  - If it does not, nothing is written, and `launchStatus` says `retryable: false`. The page then shows "trying again will not change it" with no button.
- When the business's wizard answers are unusable, no new or resumed blueprint could plan a team. `retryLaunch` therefore spends and writes nothing, and `launchStatus` says `retryable: false`.
  - Before this fix, each click spent a token and made a model call that would fail closed again.
- A plan row beside an open roster task heals:
  - `writeLaunchRoster` now returns `"written" | "healed" | "exists"`;
  - it keeps the existing row and finishes the task;
  - it adds only the missing members, workstreams and document.
- A succeeded roster task with no document reads `failed`, `retryable: false`, never an empty team.
- A first `startLaunch` that finds a succeeded first draft still spends its one token, because the launch is the founder's action.

**One existing test changed.** `tests/platform/wp74-business-ui.test.tsx` ("a reload with ?session=…") expected no
calls at all. Before this round, the team section crashed quietly inside `QuietErrorBoundary` against that test's
mocked query, so its `startLaunch` never ran. It now renders, and it makes the one idempotent `startLaunch` the design
calls for. The test still asserts no wizard call, and now asserts exactly one `crew/roster:startLaunch`.

**Files changed this round:**
- `convex/crew/roster.ts`, `convex/crew/launchRoster.ts`, `lib/workspace/crew/launch.ts`;
- `components/workspace/wizard/MeetCofounder.tsx`;
- `convex/crew/roster.test.ts` (17 → 29 tests), `tests/platform/wp75-meet-cofounder-team.test.tsx` (10 → 17, including 3 `LiveCofounderTeam` tests with a mocked `convex/react`), and `tests/platform/wp74-business-ui.test.tsx`;
- this note and `wp75-stories.md`.

a11y-check, re-run on the changed section:
- the new terminal state is text only;
- the not-started refusal reuses the same labelled button with `aria-describedby`;
- the heading focus target is `focus:outline-none`, like the h2 above it, and is reached only programmatically;
- axe shows 0 violations in every state, the two new ones included.

**Re-check round (narrow Opus re-check: ready to commit; 1 minor, 4 test gaps).**
- Minor: a heal now writes only the team the stored row already holds.
  - `rosterPlanMatchesRow` compares the rules version, the hired keys in order, and the skipped keys and reasons in order.
  - `launchRosterPlan` (used by `finishCrewStep` and the stored-blueprint path) returns null when a fresh plan does not match an existing `roster_plans` row.
  - `writeLaunchRoster` refuses such a plan as `"conflict"`: no writes, and the task stays open. `launchStatus` then reads `retryable: false`.
  - Tested: a HydroTrail row with an approved course revision is a conflict, and the founder's retry writes nothing. Once the course approval is withdrawn, the row's own plan heals it, and the members, workstreams and `launchStatus` all match the row.
- Test gaps, now covered. I removed each guard in turn and confirmed that exactly one test fails, then restored the code:
  - the `launchWizardAnswers` checks (a session owned by someone else, one linked to another project, an abandoned session);
  - the first-draft fallback's owner, project and kind checks;
  - the focus check (focus the founder moved elsewhere after Try again stays there);
  - the roster document dedupe (a heal with the document present adds no second one).
- Files: `convex/crew/launchRoster.ts`, `convex/crew/roster.ts`, `convex/crew/jobs.ts` (now calls `launchRosterPlan`), `convex/crew/roster.test.ts` (29 → 37 tests) and `tests/platform/wp75-meet-cofounder-team.test.tsx` (17 → 18).

Checks after the last code edit (all exit 0):
- `git diff --check`;
- `npm run typecheck`;
- `npx tsc -p convex --noEmit`;
- `npm run lint` (0 errors, 37 warnings, none in S1 files);
- `npm run check:prompt-versions` (6 match);
- `npm run test:security` (node 219 pass, 1 skipped; vitest 121);
- `npm run test:convex` (81 files, 1,145 tests);
- `npm run test:platform` (79 files, 2,152 tests);
- `npm run build`.

## 2026-11-06 - WP75-S2b built (launch DAG on `crewWorkpool`)

Branch `claude/wp75-s2b-dag`, cut from `origin/main` `40aa7ce4`. Uncommitted, awaiting review. Story ticked.

### Files

- `convex/crew/steps.ts` (new): the step registry and the DAG rule as pure functions (`evaluateLaunch`,
  `readySteps`, `stepDoneDecision`).
- `convex/crew/workpool.ts` (new): the `crewWorkpool` client.
- `convex/crew/launch.ts` (new): `stepDone`, `advanceOwner`, `resumeLaunch`, `launchProgress`.
- `convex/crew/jobs.ts`: no `crewJob` token at insert; `ensureLaunchStepTasks`; `resumeParkedTask`;
  `abandonCrewTask`; the launch-brief rule.
- `convex/crew/generators.ts`: the brand kit briefs from the launch's draft blueprint (ruling below).
- `convex/crew/roster.ts`: `startLaunch` and `retryLaunch` spend their one token and advance through the pool.
- `convex/workspace/approvals.ts`: free change rounds spend one `crewJob` token.
- `convex/_generated/api.d.ts`: the three new modules, added by hand.
- Tests: `launch.test.ts` (13, new), `steps.test.ts` (15, new), `generators.test.ts` (+10),
  `roster.test.ts`, `runner.test.ts` and `changeRounds.test.ts` (+3).

### Design

- **The blueprint moves onto the workpool.** It is the DAG's first pool step. This gives one re-invoker for
  every step, puts a burst of sign-ups behind the global throttle, and retries a dead action instead of leaving
  it for the cron. S1's behaviour is unchanged: tokens, states, retry rules and the `launchStatus` shape.
  - Only S1's mechanism assertions changed. They used to read `_scheduled_functions`; they now read the enqueue
    markers (`task_steps`). S1's `world()` registers the workpool.
  - Three S1 tests now also see the brand kit enqueued once the team exists: a heal, a free re-plan and a replay.
    That is the DAG continuing. No blueprint runs again.
- **The enqueue marker.** A step handed to the pool gets one `task_steps` row on its task:
  - it is created `running`, with `position` set to its registry index and `type` to its job type;
  - it settles `succeeded` or `failed` together with the task;
  - a parked task keeps its marker, and a resume reuses it.
- **The pending-step rule.** These steps are slots: logo marks and the landing spec (`pending_story`, S3b and
  S3c), the build pack (`pending_story`, S3d), and WP76's five steps (`pending_wp76`).
  - A slot has no task row. It reads as `skipped`, with a plain reason taken from the registry; nothing is stored.
  - A child runs only when every parent has succeeded or is a slot whose own parents are done. A parent that is
    failed, running, queued or paused blocks it.
  - Step tasks are inserted when the roster is written (in the blueprint's finish, and healed by
    `advanceOwner`), only for hired employees, and only while nothing holds the step's revision-0 key.
  - A step whose employee the roster skipped finishes `skipped` with the roster's reason, and so does every
    step below it.
- **`maxParallelism` is 10, global** (`convex/crew/workpool.ts`):
  - each step is one `draft`-tier call that can take most of an action's 10 minutes, so a sign-up burst queues
    instead of spiking spend;
  - with the per-owner cap of 3, it still runs three or four launches side by side;
  - it leaves action concurrency for Wren and the wizard, well under the README's suggested 20 (free) or
    100 (Pro).
- **The per-owner cap is 3, and nothing is stranded.**
  - An owner's in-flight count is their running crew tasks plus queued tasks with a running marker, across all
    their businesses.
  - `advanceOwner` is the only thing that enqueues a fresh step. It fills slots oldest launch first, and it
    skips a launch that has a paused step.
  - A ready step waits only while 3 are in flight. Every in-flight step ends in a `stepDone`, because the
    workpool always calls `onComplete`.
  - Every `stepDone` that settles, parks or abandons a step calls `advanceOwner` again.
  - `startLaunch` advances too, on every page mount, which covers a switch that was off and the deploy itself.
- **`stepDone`** (`stepDoneDecision`):
  - `retry`: re-enqueue after the runner's `delayMs`;
  - `skipped: in_flight`: re-enqueue after `RUN_LEASE_MS`;
  - action failure: re-enqueue after `RUN_LEASE_MS`. After 3 in a row, the task fails as interrupted
    (`abandonCrewTask`).
  - Otherwise the task's own status decides:
    - terminal settles (`skipped: terminal`, `failed`, `rejected`, `closed` and the rest);
    - blocked parks.
  - A task that `recoverStaleCrewRuns` has already failed is terminal, so the step settles failed and its
    children stay queued.
  - Refinement: a late or duplicate delivery that finds its task already succeeded settles as succeeded.
- **The `crewJob` move.** The charge is gone from `insertCrewTask`. Each founder action is charged exactly once:
  - `startLaunch`'s first call;
  - `retryLaunch`'s new draft, or its resume;
  - `resumeLaunch`, only when it resumes something;
  - each free change round, and each retried free round (`checkLimit` runs before the card moves, so with AI off
    or no token left the card stays `pending`).

  The DAG's own steps spend none. A paid round's token is spent at its task's start, the `debitJob` site
  (Codex 12). There is no hire path yet; a future hire spends one token.
- **The resume edge.** `resumeLaunch` resumes parked steps in registry order, as many as the owner's free slots
  allow. A step that does not fit stays parked. With no free slot it spends no token.
- **The launch brief** (ruling below). In a launch, the brand kit briefs from that launch's own first-draft
  blueprint when all of these hold:
  - the draft's card is `pending` (inside its TTL) or `approved`;
  - the document is unchanged since the card was created;
  - the card is not `changes_requested`, `expired` or `cancelled`.

  `prepareCrewStep` and `finishCrewStep` both check this. Outside a launch, S3a's approved-only rule is
  unchanged.
- **`launchProgress`** is a new, additive, read-only query: each step's key, title, state and skip reason. It has
  no ids. `launchStatus` is unchanged.

### Plan vs reality

- The story's acceptance line "runs every WP75 step in order" holds only for the built steps (blueprint, roster
  and brand kit text). The others are slots, as described above.
- The check that "the landing spec is ready in the fixture timeline before 5 minutes" moves to S3c.
- The story's `enqueueAction(internal.crew.runner.runCrewStep, …)` is now `runCrewGeneratorStep`, so the server
  builds every step's inputs (the S3a hand-off).
- `stepDone` is an internal mutation that the workpool calls. The WP68 scanner accepts both new public
  functions, `resumeLaunch` and `launchProgress`.
- `convex-test` caveat: draining the pool moves the fake clock hours ahead. After a drain, the token tests
  compare the stored limiter state, or reset the window before counting a new action.

### Open items

- **Brand kit re-run policy (S6b, WP77).** If the founder later asks for changes on the blueprint, the kit stays
  built on the earlier draft. A policy is needed for re-running the kit, or flagging it, after a blueprint
  revision.
- A change round (WP77) runs off the pool, through the scheduler. It counts toward the owner's in-flight total
  but is not throttled by the cap. Since the review fixes, its finish frees the slot (minor 3 below).
- **A throw in `stepDone` strands the marker** (review minor 4). The running marker stays, so the step counts as
  in flight and is never enqueued again. The fix is a sweep on Codex 13's cron (Codex 18). No `workId` is stored,
  because `task_steps` is Codex's schema. **Fixed 2026-11-07** by the L1 launch sweep, for a queued task and for a
  running task between executions (§ at the end of this file).

### Needs from Codex (S2b)

Codex 12 (the paid round's token at the debit) and Codex 13 (the recovery cron) still apply. Codex 18 (the
launch sweep on 13's cron) was added by the review fixes.

### Checks (after the last edit)

- `git diff --check`: 0.
- `npm run typecheck`: 0.
- `npx tsc -p convex --noEmit`: 0.
- `npm run lint`: 0 (0 errors, warnings only in untouched files).
- `npm run check:prompt-versions`: 0.
- `npm run test:security`: 0 (node 220 pass; vitest 121).
- `npm run test:convex`: 0 (84 files, 1,197 tests).
- `npm run test:platform`: 0 on the re-run (80 files, 2,160 tests). The first run timed out once in
  `wp74-keyboard.test.tsx`, a UI test this story does not touch. That file passes alone, and the full re-run
  passed.
- `npm run build`: 0.

### S2b review fixes (independent Opus review: 0 blockers, 1 major, 5 minors, nits)

**M1: a step that failed after the roster can be tried again.**
- Once the team exists, `retryLaunch` calls `retryFailedLaunchSteps` in `launch.ts`.
- It inserts a new first draft for each failed or cancelled pool step whose parents are all done. The draft uses
  the same job key with a `:retry:n` idempotency key.
- It spends one `crewJob` token per click, however many steps it retries, then advances under the cap.
- A brand kit is retried only when a brief exists for it now (`approvedBlueprint`, or the S2b launch rule).
  Otherwise it is not retryable, its reason is "The blueprint changed. Approve it, or finish its changes, before
  the brand kit can try again.", and the click spends nothing.
- A step that is queued, running or paused is left alone. A paused step is resumed by `resumeLaunch`.
- `launchProgress` now returns a top-level `retryable`. Each failed step also gets `retryable` and a plain reason,
  so the UI can offer Try again.
- The `ensureLaunchStepTasks` comment in `jobs.ts` now points at this path.

**Minors**
1. New integration test: the action dies before it opens a run, three times. The kit task and its marker are
   `failed`, no run is opened, the brand workstream shows the "interrupted" note, and no ledger rows are written
   (the step is unpaid). Mutation-checked: raising `MAX_ACTION_FAILURES` to 4, or dropping the
   `abandonCrewTask` call, each fails it.
2. New tests for the hired filter in `ensureLaunchStepTasks` (lead only → 0, with brand → 1, again → 0) and for
   the paused-launch skip in `advanceOwner`. A paused kit holds a built `build_pack` with no marker, and the pack
   is enqueued once the kit is no longer paused.
3. **Revisions free their slot.** `setTaskStatus` in `jobs.ts` is the one place a task's status changes. When a
   revision (`revisionOfTaskId`) leaves `running`, it schedules `internal.crew.launch.advanceAfterRevision`.
   That covers finish, fail, park and cancel. The call is scheduled, not imported, which avoids an import cycle.
   Test: three running revisions fill the cap; one is abandoned; the waiting launch runs. Mutation-checked:
   with the hook disabled, it fails.
4. **A throw in `stepDone` strands its marker.** This is documented as an open item and as Needs from Codex 18,
   a sweep on Codex 13's cron. No `workId` is stored, because `task_steps` is Codex's schema.
5. **A full cap.** `resumeLaunch` returns `waitingForSlot`. With no free slot it returns
   `{ resumed: 0, paused: n, waitingForSlot: true }`, spends nothing, and the step reads `paused`.
   - A retry while the cap is full inserts the step and spends one token. `launchProgress` shows the step as
     `queued`, with "Waiting for a free slot: your team is busy with other work.", and not as failed. It runs
     once a slot frees.
   - Both cases are tested.

**Nits**
- `ownerInFlight` now ignores archived tasks.
- `stepDone` settles an archived task's marker as `failed`. Tested: an archived kit's marker settles, and the
  next launch runs.
- Tested: `resumeLaunch` and `launchProgress` refuse an archived business.
- A slot under a parent that is not done reads `waiting`, with the reason "Waiting on the brand kit." (the roster
  reads as "the team"). It no longer reads "skipped". The `steps.test` and `launch.test` expectations were
  updated.
- The S3c story now notes the capacity maths for `maxParallelism` 10 against the 5-minute target.

**Files:** `convex/crew/launch.ts`, `convex/crew/roster.ts`, `convex/crew/jobs.ts`, `convex/crew/steps.ts`,
`convex/crew/launch.test.ts`, `convex/crew/steps.test.ts`, `docs/wp/wp75-progress.md` (this section, Status row,
open items, Needs 18), `docs/wp/wp75-stories.md` (the S3c note). The coordinator's `wp74-keyboard.test.tsx`
timeout edit is left in place.

**Checks (after the last code edit):** every check exited 0.

| Check | Result |
|---|---|
| `git diff --check` | 0 |
| `npm run typecheck` | 0 |
| `npx tsc -p convex --noEmit` | 0 |
| `npm run lint` | 0 (0 errors, 43 warnings in untouched files) |
| `npm run check:prompt-versions` | 0 |
| `npm run test:security` | 0 (node 220 pass; vitest 121) |
| `npm run test:convex` | 0 (84 files, 1,209 tests) |
| `npm run test:platform` | 0 (80 files, 2,160 tests) |
| `npm run build` | 0 |

### S2b re-check (narrow Opus re-check: ready to commit; 0 blockers, 0 majors)

Every finding from the review was confirmed fixed by mutation. Open follow-ups, none blocking:
- `launchProgress` calls `failedLaunchSteps` without `now`, so a blueprint card past its 7-day TTL (before the
  expiry cron is wired) shows the kit as retryable while Try again spends and does nothing. Fix: pass the clock
  the same way the mutation does, or wire the expiry cron.
- No test covers the `archivedAt` filter in `ownerInFlight` (`launch.ts:182`, `:190`). No code archives tasks today.
- A built step that is `waiting` (for example the kit before its task is inserted) has no reason; slots say
  "Waiting on the …". A cosmetic gap for S6a's Team HQ.
- If the founder asks for changes on the blueprint between a retry's mutation and its preflight, the retry spends
  its token and fails at preflight. Accepted.

### S2b PR #239 review fix (Codex P2: launchProgress missed the pre-roster retry)

Before the team existed, `launchProgress` read only `failedLaunchSteps`, which leaves out the blueprint, so a failed
first blueprint showed `retryable: false` while `launchStatus` (and `retryLaunch`) said a retry would help. One rule
now serves both: `openLaunchRetry` in `convex/crew/launch.ts` (moved there with `planFromSucceededBlueprint`, since
`roster.ts` imports `launch.ts`).
- A failed, cancelled or missing blueprint is retryable only while the wizard answers are usable. A succeeded
  blueprint with no stored team is retryable only while the team still plans. A paused one is retryable (resumed).
- In `launchProgress`, the failure sits on the blueprint step, or on the roster step when the blueprint succeeded
  (that step reads `failed`, not `waiting`). A retryable one gives `STEP_FAILED_REASON`, a stuck one
  `LAUNCH_STUCK_REASON`, and the top-level `retryable` includes it.
- Tests (`launch.test.ts`): a failed blueprint (usable, then unusable answers); a succeeded blueprint with no team
  (plans, then cannot); the paused blueprint agrees with `launchStatus`. Mutation probe: with the new read removed,
  all three fail.

## 2026-11-07 - L1 launch sweep built (Needs from Codex 18)

Branch `claude/l1-launch-sweep`, worktree `.worktrees/l1-launch-sweep`, from `origin/main` `4bc5d1ac`. First
build committed as `bb78d0d7`; main merged in at `82ebb24b`. This entry describes the code after the review fixes
(§ Review fixes below).

### What strands a step

The workpool is durable: a deploy or a crash does not lose pool work, and the pool always calls `onComplete`. What
strands a step is a throw inside `stepDone` (or the `advanceOwner` it calls). The mutation rolls back, so its
re-enqueue or settle never lands. The running marker stays with no work behind it and holds a slot for good. No
`workId` is stored on the marker, so the sweep infers "the work is gone" from inactivity.

### Entry point

- `internal.crew.launch.recoverStalledLaunches({})`. Args are optional (`cursor`, `limit`), so the cron calls it with
  none. It is safe alongside `recoverStaleCrewRuns` in the same tick.
- It reads one page of `projects` and nothing else: at most `LAUNCH_SWEEP_PAGE_MAX` (20), paginated on the default
  `by_creation_time` index.
- It schedules `internal.crew.launch.recoverStalledOwner({ ownerId })` with `ctx.scheduler.runAfter(0, …)` once for
  each distinct owner with a live business that has a workspace. A page that is not the last schedules the next
  page with its cursor.
- So one call reads at most a page of projects and schedules at most a page of jobs, whatever the owners hold. One
  owner's throw, or one owner hitting a transaction limit, fails that owner's job alone.
- An owner whose businesses span pages is scheduled once per page. The owner job is idempotent, and a test covers
  it.
- The page returns `{ businesses, owners, isDone }`.

### Per owner (`recoverStalledOwner`)

1. Gates come first: `assertFeatureEnabledForOwner` for `workspace` and `ai`, which covers the switch, the kill
   switch and the cohort. If a gate is off, nothing is written (`gated`).
2. For each pool step of the owner's live launches:
   - **Leftover marker on a terminal task** (`settled`). A `running` marker on a `succeeded`, `failed` or
     `cancelled` task, still for `LEFTOVER_MARKER_MS` (one lease), is settled with `settleMarker`. Its late
     `stepDone` then reads as superseded, and the sweep advances the owner itself.
   - **Stranded marker.** All of these must hold:
     - the task is live and `queued` or `running` (never parked or terminal);
     - its newest marker is `running`;
     - the task has no `running` run, and at most `RUN_SCAN_MAX` runs (all read);
     - nothing on the task, the marker or any run has moved for `STRANDED_MARKER_MS` (2 hours).

     Every enqueue moves a reused marker's `updatedAt` to now, so a `stepDone` re-enqueue counts as activity.
   - **Queued task** (`requeued`). The marker is settled `failed`, and `advanceOwner` enqueues the step again under
     a new marker. This never counts toward the bound, and a queued task is never failed by the sweep.
   - **Running task with no open run** (`reinvoked`). This is a step between executions: in return mode
     `settleCrewRun` closes the run and leaves the task `running` for `stepDone` to re-enqueue the retry. If that
     `stepDone` threw, nothing else ever acts, because `recoverStaleCrewRuns` reads only open runs.
     - The marker is settled `failed`, and the step is re-enqueued at once under a new marker, as `stepDone` would
       have.
     - The task already counts toward the cap, so no slot is added.
     - There is no task transition: the task stays `running`, and the marker goes `running` → `failed` through
       `assertStepTransition`.
     - The retry budget is applied where it always is: `startCrewRun` fails the task closed before any gateway call
       when `MAX_RETRY_BUDGET_RUNS` (or `mayRetryAfterAbandoned`) is spent.
   - **Bound** (`abandoned`). After `LAUNCH_SWEEP_REQUEUES_MAX` (2) re-invokes of one running task, the next strand
     fails the task as interrupted (`abandonCrewTask`). Refunds follow the usual rule, and DAG first drafts carry
     no debit.
     - Re-invokes are counted without a schema field. A task never returns to `queued` (`taskTransitions`), and
       outside the sweep only an enqueue from `queued` creates a marker; `stepDone` and a resume reuse the running
       one. So a marker created after the task's first run is a sweep re-invoke.
3. Then `advanceOwner` runs in its own subtransaction (`internal.crew.launch.advanceSweptOwner`), with its own
   try/catch. It is the only enqueuer of fresh work, under `OWNER_CREW_CAP` and the revision-0 key rules. It enqueues
   requeued steps and re-advances an owner left with ready steps and a free slot.
   - If it throws, it rolls back alone (`advanceFailed`), and the settles and re-invokes before it still commit.
     The next sweep, or any `stepDone`, advances again.

### Thresholds, and why

- **`STRANDED_MARKER_MS` = 2 hours, for queued and running tasks alike.**
  - Without a `workId`, "gone" and "late" look the same. Work is late whenever the pool is backlogged: every
    launch step shares `crewWorkpool`'s global cap (`CREW_MAX_PARALLELISM`, 10), and a step action may live 10
    minutes. So a busy beta can queue a step for 20 to 60 minutes.
  - At the first build's 33 minutes, a healthy backlog would be superseded and sent to the back of the queue. It
    could also be abandoned at about 99 minutes, because queued strands counted toward the bound. That was review
    M1.
  - The running case uses the same threshold, not a shorter one. Its next execution (`stepDone`'s re-enqueue)
    waits in the same FIFO pool, so a backlog delays it just as much. A false positive there also counts toward
    the bound.
  - A real strand needs a `stepDone` throw, which is rare. Two hours of one held slot is the price of never failing
    a healthy step.
- **`LAUNCH_SWEEP_REQUEUES_MAX` = 2 re-invokes, for running tasks only.** A queued task has spent nothing (no run),
  so a backlog only moves it in the queue: it is superseded again and again, never failed, and runs exactly once
  (tested over 5 rounds).
- **`LEFTOVER_MARKER_MS` = `RUN_LEASE_MS` (11 minutes).** `stepDone` settles a terminal task's marker promptly.
  Settling earlier would still be safe, because the late `stepDone` reads as superseded.

### The marker fence (work that was only late)

- The enqueue marker's id travels with the work (`runCrewGeneratorStep` / `runCrewStep` arg `markerId`) and in
  `stepDone`'s context (`markerId`, optional).
- Once that marker is no longer `running`, `startCrewRun` skips with the reason `superseded`, and `stepDone` does
  nothing. `stepDoneDecision` maps `skipped: superseded` to a no-op `superseded` decision.
- So work stuck in a backlog past the threshold never runs the step a second time: the step runs once, under the
  newer marker. No run, gateway call, meter row or ledger row comes from the superseded work.
- It is not free: superseded work loses its place in the queue. That is why the threshold is 2 hours.
- The exact fix needs a schema field (see Needs from Codex).
- One marker read serves both sides: `launchTaskMarkers` (`jobs.ts`, newest first, at most
  `LAUNCH_MARKERS_READ_MAX` = 20) is used by the fence and by `launch.ts`.
- **Rollout edge, option (a).** Work and callbacks enqueued before this deploy carry no `markerId`.
  - A read-only production inventory by Codex (2026-11-07) found 0 projects and 0 tasks, so no such work or
    callback can exist in production today. The guard is kept anyway, since it is cheap.
  - `isSupersededLaunchWork` (`jobs.ts`) reads the task's markers instead. A task with no marker is not DAG work
    (S2a direct runs, WP77 revisions) and runs as before. Otherwise the work acts only while the task holds exactly
    one marker and it is `running`.
  - Outside the sweep, a task holds one marker, settled only with the task. So a second marker, or a settled one
    on a live task, means the sweep replaced it, and the newer marker owns the step.
  - Tests cover:
    - a legacy `stepDone` (re-enqueue, abandon and cancel deliveries);
    - a legacy `startCrewRun` after a replacement;
    - a legacy callback after a settle with the cap full;
    - a legacy callback that still acts before any replacement.

### Indexes read (all existing)

| Table | Index |
|---|---|
| `projects` | default `by_creation_time` (the page), `by_ownerId_and_updatedAt` (`ownerProjects`) |
| `task_steps` | `by_projectId_and_status_and_createdAt`, `by_taskId_and_position` |
| `tasks` | `by_projectId_and_status_and_createdAt`, `by_ownerId_and_jobKey` |
| `workflow_runs` | `by_taskId_and_createdAt` |
| `workspace_cohort` | `by_ownerId` (inside the gate) |

### Needs from Codex

- **`workId: v.optional(v.string())` on `task_steps`** (not blocking L1). This is the exact fix for review M1.
  - Store the `WorkId` that `crewWorkpool.enqueueAction` returns on the marker, and treat a marker as stranded only
    when `crewWorkpool.status(ctx, workId)` says the work finished.
  - Then a backlog is never mistaken for a strand, and the threshold can drop to about one lease.
- **An ops signal for failed owner jobs** (follow-up). The alert helpers live only in Codex-owned files
  (`convex/ops/**`, `convex/growth/email/**`, `convex/crons.ts`).
  - Today a failed owner job is a failed scheduled function in the Convex dashboard and logs, and the next tick
    retries it. `advanceFailed` is on the owner job's return value only.
- **A global launch-state index** (not blocking). Each tick schedules a job for every owner with a live workspace
  business, because no index is keyed on launch state. When the owner count grows, add a global index on
  `task_steps` `["status", "updatedAt"]` (or `tasks` `["status", "createdAt"]`). The page could then schedule only
  owners with running markers or queued tasks.

### Known limits

- `ownerProjects` (existing S2b code) takes 20 businesses before it filters out archived ones. So an owner with
  many archived businesses can lose a live one from the sweep and from `advanceOwner`. This is left as it is (shared
  with the cap logic) and noted for a later fix.
- A task with more than `RUN_SCAN_MAX` runs is never judged. That cannot happen while the retry budget holds, and
  `startCrewRun` refuses such a task anyway; the code comments say so.
- A marker stranded for real holds its slot for up to 2 hours before the sweep acts.

### Review fixes (adversarial review: 0 blockers, 1 major, 4 minors, nits)

- **M1, backlog superseded and then abandoned.**
  - The threshold went from 33 minutes to 2 hours, for both cases.
  - Queued strands no longer count toward the bound; only running re-invokes do.
  - The doc wording that late work is harmless is gone. It now says the step loses its place in the queue.
  - Test: a backlog repeated 5 times is never failed, and the step runs exactly once.
- **m1, a throwing `advanceOwner` rolled back the recovery.** `advanceOwner` now runs in its own nested
  subtransaction with its own try/catch. Test: the advance throws, and the queued settle and the running re-invoke
  still commit; the next sweep advances.
- **m2, an unbounded page.** The page reads only `projects` and schedules one owner job per distinct owner. Tests:
  every test now runs the owner jobs the page scheduled. One runs them through the real scheduler, where a failed
  owner job leaves the other owner's job successful. Pagination tests cover an owner spanning two pages, and the
  continuation's owner job.
- **m3, leftover markers on terminal tasks.** These are now settled after one lease. Tests: settled once and not
  before; a late `stepDone` (new and legacy) does nothing; no running marker is left. The overlap test also settles
  the leftover marker that recovery leaves.
- **m4, outdated docs.** The `launch.ts` header, `STRANDED_MARKER_MS`, `recoverStalledOwner` and
  `recoverStalledLaunches` docs now describe the real trigger (a `stepDone` throw) and the running path.
- **Nits.**
  - There is now one shared marker read (`launchTaskMarkers` / `LAUNCH_MARKERS_READ_MAX`). It reads newest first;
    before, it read the oldest 20, which could miss the newest marker on a task with more than 20.
  - The `RUN_SCAN_MAX` skip is commented.
  - `ownerProjects` take-before-filter is noted above.
- **Test gap, a real strand.** A rate-limit failure makes the runner return a retry, and `stepDone`'s re-enqueue
  throws: inline, then on its scheduled retry. The task is left `running` with a closed run and a running marker.
  The sweep leaves it alone 1 ms before the threshold and re-invokes it at the threshold. The step then runs once
  more and the launch completes.

### Tests

- `convex/crew/launchSweep.test.ts`: 29 tests. The `sweep` helper runs one page, then the owner jobs it
  scheduled. They cover:
  - requeue once, then the launch completes;
  - a backlog fence, and a backlog repeated 5 times (never failed, the step runs once);
  - the late `stepDone` fence;
  - a running task between executions:
    - re-invoked exactly once under a new marker, keeping its slot, then the launch completes;
    - within the lease and under the threshold, untouched;
    - with an open run, untouched;
    - a late `stepDone` (with or without `markerId`) and the lost re-invoke's late start do nothing after it;
    - re-invokes that keep stranding are bounded at 2, then the task fails as interrupted;
    - a real strand from a `stepDone` throw;
    - a spent retry budget fails it closed at its start, with no gateway call, metering row or ledger row;
  - the rollout cases above;
  - open-run, parked, finished, leftover-terminal and archived (business and task) cases;
  - AI off, the workspace off, and out of cohort, with the other owner still running;
  - an owner job that throws (real scheduler), and a throwing advance;
  - a stall with a free slot, and the cap of 3;
  - two sweeps in a row, and sweeps interleaved with `recoverStaleCrewRuns` pages (row counts for tasks, markers,
    runs, `ai_usage`, `credit_ledger`, the limiter and the enqueue count);
  - pagination: one continuation, a small limit, and an owner spanning two pages.
- `convex/crew/steps.test.ts`: 1 new test (`superseded`).
- Mutation-checked (first build). Each of these fails at least one test:
  - the open-run check removed;
  - the queued-only check loosened;
  - the threshold set to 0;
  - the requeue bound removed;
  - the AI gate removed;
  - the `startCrewRun` fence removed;
  - the `stepDone` fence removed;
  - the legacy guard removed;
  - running tasks taken out of scope;
  - a running task re-enqueued under its old marker.
- Mutation-checked (review fixes). Each of these fails at least one test:
  - queued strands counted toward the bound (and abandoned);
  - `advanceOwner` run inline, not isolated;
  - the leftover settle removed.

### Checks (after the last code edit)

- `npm run typecheck`: 0.
- `npm run lint`: 0 (0 errors, 43 warnings, all in untouched files).
- `npm test`: 0. `test:convex` ran 93 files and 1,356 tests; `test:platform` ran 86 files and 2,324 tests.
- `npm run check:prompt-versions`: 0 (8 versions match the lock).
- `git diff --check`: 0.
- `npm run build`: not run (per the brief).

Docs updated: this file, the `launch.ts` header and sweep docs, and the `jobs.ts` fence doc. Stories: not needed
(board item, not a story).
