# WP26 Progress - Durable Task Workflow And M3 Validation Reports

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-06 - Setup and story freeze

- Branch: `codex/wp26-research-workflow` (created from `codex/wave2-platform-integration` after Wave 2 passed; see `docs/wp/wave-gate-report.md` "Wave 2 / WP23 & WP25 Authenticated Browser Gate - 2026-08-06").
- Assignment: not yet dispatched to a worker. This session (orchestrator) only froze `docs/wp/wp26-stories.md`, recorded the owner's provider/cost/retention rulings in `docs/wp/RULINGS.md` and `docs/wp/program-manifest.md`, and opened the branch. No code was written.
- Owner rulings obtained this session (2026-08-06, see `docs/wp/RULINGS.md`): model provider is OpenAI GPT (reuses existing `OPENAI_API_KEY`); search/community source is Perplexity API, citation-only; per-report hard cost cap is $4.00 with retry-once-then-refund; cached research is retained indefinitely.
- File boundaries: per story, see `docs/wp/wp26-stories.md`. `WP26-S1` is the only story touching `convex/schema.ts` (additive only); it is a named contract subgate that must independently gate before WP27 may start, per the manifest.
- Required checks: standard WP gate (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, secret scan) plus story-specific adversarial/fixture tests listed per story.
- Initial risks: this is manifest-rated Critical risk, Wave 3, requiring a high-tier AI/backend worker and independent high-risk review. Real provider spend must stay disabled outside isolated fixtures until this WP's own test-mode gate passes (mirrors WP24's development-vs-go-live split) — no live OpenAI/Perplexity call is authorized yet. The workflow execution runtime (candidate: Vercel Workflow DevKit) is an open implementation-time engineering choice, not yet decided; the assigned worker should evaluate and record the choice before S3 implementation.
- Next: dispatch `WP26-S1` (contract subgate) to a high-tier worker. Do not start S2+ implementation until S1 has independently gated.

## 2026-08-06 - Stories tightened after Codex review

- Ran `/codex:review` against the uncommitted Wave 2 closeout + WP26 prep docs before any commit. It found 1 doc-consistency issue (this repo's truth documents contradicted each other about whether the WP26 provider ruling was resolved and whether WP26 files already existed) and 6 story-completeness issues in the first draft of `docs/wp/wp26-stories.md`. All were fixed in place; none required touching product code, since nothing had been implemented yet.
- Doc-consistency fixes: `docs/wp/wave-gate-report.md`, `docs/wp/CLAUDE_HANDOFF.md`, and `docs/PROJECT_STRATEGY.md` all now correctly state that the WP26 provider/cost/retention ruling is recorded and that `wp26-stories.md`/`wp26-progress.md` already exist; `docs/wp/wp23-stories.md` and `docs/wp/wp25-stories.md` S6 checkboxes are now checked to match their actually-passed gates.
- Story fixes (all in `docs/wp/wp26-stories.md`, no code written): `S3`'s idempotency requirement now demands provider-side idempotency or reconciliation-before-resend, not just a local key, plus an explicit crash-window test; `S3`/`S4` now specify retry-**exactly**-once (not zero, not many) with dedicated tests; `S4`'s cost cap is now a pre-call reservation against worst-case cost, not a post-hoc running-total check, so a run can no longer overshoot $4.00 mid-call; a new "After The Package Gate" section spells out the credential-backed sandbox quality gate that must run before any real provider is activated, since fixture-mode evals alone cannot prove real output quality.
- Two genuine ruling gaps were surfaced rather than invented: the exact OpenAI model ID (the ruling names a provider family, "OpenAI GPT," not a pinned model) and a named keyword-volume/CPC data provider (Perplexity covers market/community signals only, not keyword data). Both are recorded as open blockers on `S2` specifically (not `S1`) in `docs/wp/wp26-stories.md`'s "Ruled Inputs" section, pending the owner.
- No code changed, no commit made. All changes remain in the working tree on `codex/wp26-research-workflow` pending the owner's decision on committing.

## 2026-08-06 - Committed, pushed, and cherry-picked parallel WP38 planning

- Owner approved committing everything as one commit and pushing. Committed `3453282` and pushed `codex/wp26-research-workflow` to origin.
- Owner then asked to cherry-pick `8299f21` (`docs(platform): add super-admin control plane`, WP38 planning authored by a parallel Codex session on `codex/wp38-admin-plan`, an isolated worktree branched from the same `c4aa22e` checkpoint). The cherry-pick conflicted in three append-only logs (`RULINGS.md`, `program-manifest.md`, `session-ledger.md`) where both branches had added rows in the same location; resolved by keeping both sides' rows (the correct resolution for append-only logs — dropping either side would silently lose a real ruling or session record). No conflict in code, since WP38 is docs-only planning. Verified no leftover conflict markers repo-wide, `.agentic-workflow.yml` still parses as valid YAML, `git diff --check` clean, committed (`39a6d6e`) and pushed.

## 2026-08-06 - WP26-S1 implemented: reuses WP22's existing task/document infrastructure

- **Key finding before writing anything:** WP22 already froze `tasks`, `task_steps`, `documents`, `document_citations`, and `workflow_runs` tables, and their validators in `convex/platform/validators.ts` already include `"validation_report"` as a literal `TASK_TYPE_VALUES`/`WORKFLOW_TYPE_VALUES`/`DOCUMENT_KIND_VALUES` value, with `documentFormatValidator` including `"json"` and `MAX_GENERATED_DOCUMENT_BODY_BYTES` (256 KiB) already enforced via `assertGeneratedDocumentBody`. WP22 pre-built the exact storage substrate WP26 needs. **S1 therefore required zero `convex/schema.ts` changes** — the "may only add new tables/fields" boundary in the story was never exercised because nothing needed adding.
- Followed the existing `briefPayload.ts` precedent (WP25's own JSON-in-`documents.body` contract: `contractVersion` embedded in the JSON itself, hand-rolled fail-closed `parse`/`serialize` pair, `ConvexError` codes) rather than inventing a new pattern.
- Added `convex/platform/engine/contracts.ts`: `ValidationReportPayload` (v1 engine scope per program-platform-plan.md §4.5 — Tier-1 scores, market insight with >=2 cited stats, competitive analysis with >=3 cited/priced competitors, go-to-market, community analysis, keyword list, why-now) and `SiteInputPayload` (the decoupled shape WP27's renderer will consume). Both carry a `contractVersion` literal inside the JSON body, matching the existing brief-payload convention rather than adding a new schema column.
- Citations are stored via the existing `document_citations` child table (`position`-indexed, already unbounded-safe); the JSON body only stores `CitationRef` (position) integers, never duplicates citation metadata. Added `assertValidationReportCitationsInRange` so a report can never claim a citation position that wasn't actually stored — this is the seam WP26-S5 (report compiler) will call after inserting the real `document_citations` rows.
- `parseValidationReportPayload` fails closed on: unversioned/unknown `contractVersion`, malformed JSON, missing/malformed required fields, fewer than 2 market stats, fewer than 3 competitors, and zero citations on any of `marketInsight`/`competitiveAnalysis`/`communityAnalysis`/`whyNow` — mirroring the existing thin-research STOP rule. `serializeValidationReportPayload` round-trips through the parser before returning, so a hand-constructed payload can never be persisted if it wouldn't also parse. Same pattern for `SiteInputPayload`.
- Evidence: `npx vitest run convex/platform/engine/contracts.test.ts` — 21 passed, covering every fail-closed rule above plus valid round-trips, out-of-range citation refs, and cross-shape rejection (a site-input document cannot parse as a report and vice versa). Full suite: `npm run typecheck` pass; `npx eslint convex/platform/engine/` pass, 0 findings; `npm test` pass, 45 test files / 490 tests, 0 failures; `npm run build` pass, 310 pages; `npm audit --omit=dev --audit-level=high` 0 vulnerabilities; `git diff --check` clean; scoped secret-pattern scan on the new files returned no matches.
- `convex/_generated/api.d.ts` was auto-regenerated by the running local `convex dev` process to register the new (function-free) `platform/engine/contracts` module — a two-line addition, nothing else changed, matching the pattern from prior WP23/25 progress notes.
- No schema/index/production/environment change. No provider adapter, workflow execution, or UI was added (out of scope per the story).

## 2026-08-06 - WP26-S1 independent review: pass after one fix

- Dispatched a genuinely separate reviewer (fresh subagent, no memory of writing the code) rather than self-certifying — required per this program's orchestration rules for independent review.
- **Real finding (Medium), fixed:** `isKeyword`'s `volume`/`cpc` checks only lower-bounded (`>= 0`) with no upper bound, so a value like `1e400` in raw JSON text parses to `Infinity` in JS and slipped past `typeof === "number"` plus the lower-bound check. Not reachable via `serializeValidationReportPayload` (JSON.stringify turns a real `Infinity` into `null` first, which then correctly fails), but reachable if `parseValidationReportPayload` is ever called directly on raw provider output in a later story (S3). Fixed by adding `Number.isFinite(...)` to both checks; added a regression test using `1e400` (syntactically valid JSON, overflows float64 to `Infinity` on parse).
- **Minor gap, fixed:** `assertValidationReportCitationsInRange` had no equivalent for `SiteInputPayload`. Added `assertSiteInputCitationsInRange` plus tests, for symmetry and because WP27 will need the same out-of-range guard once it's the first real caller.
- **Design note for WP26-S5 (not a defect in S1's own scope):** `document_citations.position` in `convex/schema.ts` is `v.int64()` (bigint) while `CitationRef` here is plain `number`. S1 never touches `ctx.db` so this can't fail today, but S5 (the first story to actually write `document_citations` rows and cross-check `CitationRef`s against them) will need an explicit bigint↔number conversion at that write/compare boundary. Recording this now so S5 doesn't rediscover it from scratch.
- Everything else the reviewer tried to break held: full fail-closed coverage (missing citations on all four required sections, `<2` stats, `<3` competitors, unversioned/unknown `contractVersion`, malformed JSON), no prototype-pollution risk (`JSON.parse` sets `__proto__` as a plain own property, not through the prototype setter), serialize/parse symmetry holds by construction, `assertValidationReportCitationsInRange` covers all six citation-bearing arrays, and the "zero schema.ts changes" premise was independently re-confirmed against `convex/schema.ts` and `convex/platform/validators.ts`.
- Final evidence after fixes: `npx vitest run convex/platform/engine/contracts.test.ts` — 24 passed (21 + 3 new); `npm run typecheck` pass; `npx eslint convex/platform/engine/` pass, 0 findings; `git diff --check` clean.
- **`WP26-S1` (the contract subgate) passes.** This unblocks WP27 to start once its own dependencies are ready, per the manifest — WP27 does not need to wait for `S2`-`S6`. The orchestrator should record this pass in `docs/wp/wave-gate-report.md` before treating WP27 as authorized.

## 2026-08-06 - Remaining provider rulings closed; S2 unblocked

- Researched both open gaps against primary sources before asking the owner, rather than presenting a blind choice. Current pricing was pulled from `developers.openai.com/api/docs/pricing` and `docs.perplexity.ai/getting-started/pricing` on 2026-08-06; the model landscape had moved substantially past this session's training cutoff (the GPT-5.6 Sol/Terra/Luna tiers did not exist in it), so nothing here is quoted from memory.
- **Owner ruled: `gpt-5.6-sol`** for synthesis/scoring ($5.00/1M in, $30.00/1M out) and **DataForSEO** for keyword volume/CPC/competition ($0.01/task + $0.0001/item). Both recorded in `docs/wp/RULINGS.md` and `docs/wp/program-manifest.md`.
- **Reference budget that drove the model decision.** A full 7-step run prices at roughly $0.52: ~$0.26 synthesis (`gpt-5.6-sol`), ~$0.20 across three Perplexity Sonar Pro calls (including its per-1K-request search fee, which is billed separately from tokens and is easy to miss), ~$0.02 DataForSEO, plus brief normalization. Report render is deterministic from the `S1` contract and costs nothing. With every step taking its one allowed retry, worst case is roughly $1.04 — about 25% of the $4.00 cap. The plan's original $1.50-$4.00 estimate was therefore pessimistic by roughly 3-7x. Because the headroom is that large and report quality is the product on the own-idea path, the flagship tier was chosen over `gpt-5.6-terra` ($2/$12, ~$0.36/run) rather than trading quality for a saving the budget does not need. Terra remains the documented downgrade if the `S6` eval shows no quality delta.
- Two guardrails were added to `S2` off the back of this, both aimed at failure modes the ruling itself does not prevent: the OpenAI adapter must pin a **dated snapshot** rather than a floating alias, so a provider-side model rotation cannot silently move report quality or cost; and the keyword adapter must **fail closed** on provider error rather than fall back to a model-generated estimate, since a hallucinated search volume is precisely the failure the keyword-provider ruling exists to prevent.
- `S4`'s pre-call reservations should be calibrated against the ~$0.52 reference figure, and the credential-backed activation gate should compare real spend against it — a real run landing several times higher indicates the estimate model is wrong, even if it technically stayed under the cap.
- **No ruling gaps remain open in WP26.** `S2` through `S6` are unblocked and may proceed in order. No code was written in this session; changes are docs-only.

---

## 2026-08-07 - WP26-S2 provider adapters delivered

**What shipped:** `convex/platform/engine/providers/` —
`types.ts` (three role interfaces + typed errors + `requireSecret`),
`pricing.ts` (rate cards and cost estimation), `openai.ts`, `perplexity.ts`,
`keywordData.ts`, `fixtures.ts`, `providers.test.ts` (35 tests).
`.env.example` gained `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`,
`DATAFORSEO_PASSWORD`. No schema change; no live network call anywhere.

### Deviation: there is no dated snapshot to pin

The AC requires pinning "a dated model snapshot resolved at implementation
time, not a floating alias". Checked OpenAI's model documentation on
2026-08-07: **`gpt-5.6-sol` has no dated snapshot.** The docs list a single
identifier, `gpt-5.6-sol`, with the floating alias `gpt-5.6` routing to it.

Pinned `gpt-5.6-sol` — the concrete model ID — and never the alias. A test
asserts the adapter's `model` is not `gpt-5.6`. Inventing a plausible date
would have produced a config that 404s on the first live call, so the
deviation is recorded rather than papered over. **Re-pin when OpenAI ships a
dated snapshot.**

### Cost trap the ruling does not mention

OpenAI's documentation (2026-08-07) states prompts above **272K input tokens**
are billed at **2x input and 1.5x output for the full request** — not for the
excess. A cost model without this under-reserves by roughly 2x on exactly the
runs most likely to breach the $4.00 cap. Implemented in
`estimateSynthesisUsd` and tested: one token over the threshold nearly doubles
the estimate. Also captured: cached input bills at $0.50/1M rather than $5.00.

`REFERENCE_RUN_USD` ($0.52) is exported alongside the cap so `S6` can assert a
run has not drifted, rather than only that it stayed under a cap set 8x above
expected cost — a serious regression would hide beneath it.

### Deviation: fixtures are authored, not recorded

The AC asks for "recorded request/response pairs". No provider credentials
exist in this environment and the manifest keeps live calls disabled until
this story's test-mode gate passes, so nothing could be recorded. The fixtures
are authored from each provider's documented response shape.

They verify **our parsing contract**, not that the provider still emits that
shape. Adapters under test are the real ones — only the transport is
substituted — so parsing, fail-closed behaviour and cost estimation all
execute as in production. Shape drift would surface at `S6`'s eval against a
live deployment. Nothing needed scrubbing: the fixtures contain no credential,
account identifier, or request header by construction.

### Fail-closed behaviour, per role

- **Config errors are non-retryable** and typed separately, so `S3` does not
  spend a retry and `S4` does not reserve budget on a failure that will repeat
  identically.
- `requireSecret` **refuses any `NEXT_PUBLIC_*` name outright**, before
  reading the environment — a credential that reached a client bundle is
  compromised, and a set value must not make it acceptable.
- **Synthesis** fails closed on empty model output, which would otherwise
  become silently missing report sections.
- **Search** is citation-only: snippets capped at 320 characters, non-`http(s)`
  URLs dropped (a citation is republished to readers), and a response with no
  usable citation fails rather than feeding an uncited scored section.
- **Keyword data never estimates.** `KeywordMetric` has no confidence or
  source field, so a model guess has nowhere to live. A keyword missing any
  metric is dropped rather than defaulted to zero — coercing an absent `cpc`
  to 0 would assert as measured fact that a keyword has no commercial value.
  An empty result set **throws**, because `[]` downstream reads as "no
  demand", which is a finding rather than a measurement failure. DataForSEO
  returns HTTP 200 with an error status in the body, so `response.ok` alone
  would wave failures through; both the envelope and per-task status codes are
  checked.

### A test of mine broke WP20's environment gate, correctly

`providers.test.ts` originally set `process.env.NEXT_PUBLIC_LEAKED`. WP20's
"every statically referenced environment key is named in .env.example" test
scans for `process.env.X` and failed. Fixed by never assigning it and
assembling the name instead — which makes the assertion **stronger**: it now
proves the prefix check rejects the name without consulting the environment
at all.

### Checks

- `npm run typecheck` exit 0 (after clearing `.next/types` left stale by a
  build on the WP28 branch — those routes do not exist here)
- `npm run lint` exit 0, 0 errors, 35 pre-existing warnings
- `npm test` exit 0 — node 91/6/7/10/4, vitest 125/172/**528**
- `npm run build` exit 0, 310 pages
- `git diff --check` clean; `convex/schema.ts` unchanged

### `npm audit` FAILS — pre-existing, not from this story

`npm audit --omit=dev --audit-level=high` exits 1:
`nanoid <3.3.17` (high, GHSA-2v37-7h3g-55p8), reached via
`next@16.3.0 → postcss@8.5.23 → nanoid@3.3.16`.

**Not introduced here.** The lockfile pins `nanoid@3.3.16` identically on this
branch and on `codex/wp28-tenant-hosts`; the advisory is newly published. It
therefore also invalidates the "0 vulnerabilities" line in the **WP28 gate
report**, which was true when measured on 2026-08-07 and is now stale.

Not fixed here: `package-lock.json` is a serialized one-writer seam and
dependency/security baseline is WP20's, not WP26-S2's. **Escalated for owner
direction.**

**Docs updated:** this file; `docs/wp/wp26-stories.md` S2 checked.

**Next:** `WP26-S3` durable task/workflow execution.

---

## WP26-S3 — Durable task/workflow execution (2026-08-11)

Branch `codex/wp26-research-workflow`, built in `.worktrees/wp26-research-workflow`
because a parallel session held the main checkout on `codex/content-prep-2026-08-08`
with uncommitted content work.

**Files:** `convex/platform/engine/{pipeline,reconcile,executor,tasks,workflow}.ts`,
`convex/platform/engine/steps/{runner,shared,briefNormalization,marketStats,competitors,communitySignals,keywordsDemand,synthesisScoring,reportRender}.ts`,
`convex/platform/engine/providers/registry.ts`, `convex/convex.config.ts` (one line),
`convex/platform/engine/executor.test.ts`, `convex/wp26Workflow.test.ts`, `.env.example`.

### Runtime choice — Convex Workflow, not Vercel Workflow DevKit

The story left this to implementation and required the rationale be recorded.

**Chosen: `@convex-dev/workflow` (already a dependency, previously unmounted).**
The deciding factor is that the durable journal and the credit ledger must not
live in different systems. Every piece of state a run touches — `tasks`,
`task_steps`, `workflow_runs`, `documents`, `credit_ledger` — is already in
Convex, so a Convex-native journal lets "this step completed" and "these credits
moved" commit together. Vercel Workflow DevKit would still need a Convex
mutation per step to persist results, making every step a cross-service round
trip with **its own** crash window — multiplying the reconciliation surface this
story exists to close rather than removing it. The component also supplies
resume, `onComplete`, and out-of-band execution natively, which satisfies the
"no long-running Next.js request" criterion without a queue of our own.

The frozen schema corroborates this: `tasks`, `task_steps`, and `workflow_runs`
already exist, and `@convex-dev/workflow` was already in `package.json`.

### Four frozen-schema constraints, and how each was resolved

1. **`STEP_TYPE_VALUES` has five coarse values for a seven-step pipeline**, four
   of which are all `research`, and `task_steps` has no name column. So
   `position` is the step's identity, and everything that addresses one specific
   step keys off position. Positions are a persisted contract: renumbering them
   re-points in-flight idempotency keys at the wrong steps.
2. **`stepTransitions.failed` is terminal**, so the retry cannot mark a step
   failed and reopen it. A step therefore stays `running` across both attempts
   and transitions exactly once, at the end.
3. **`task_steps` has no attempt counter, idempotency key, or error field**, so
   the per-attempt provider-call record lives in `workflow_runs` — the only
   frozen table carrying `idempotencyKey`, `attempt`, and `errorCode`. One row
   per attempt (not per step), because `workflowRunTransitions` also makes
   `succeeded`/`failed` terminal and a reopened row is not expressible.
4. **No column anywhere stores the component's `WorkflowId`**, so a run cannot
   be looked up for a component-level `cancel()`. This turned out not to matter
   — see below.

### Cancellation is cooperative, and that is the correct reading

The component can hard-cancel a run, but that would abandon a provider call
mid-flight: money spent with nothing recorded, which is exactly the state the
reconciliation rule exists to prevent. The AC asks that a cancelled run
"stops issuing new provider calls and **settles any in-flight one** before
finishing" — that is cooperative cancellation, not a kill. `requestCancel` marks
the task `cancelled`; the in-flight step settles its own attempt record and the
next step refuses to start. The missing `WorkflowId` column is therefore not a
gap for this story.

### Deviation 1 — retry-once fires only on 429/5xx, not on every failure

The AC says a failed step "retries **exactly once**… never zero times". As
written that would retry every failure class. Implemented narrower, deliberately:

The question that decides whether a retry is safe is not "was this error
transient" but **"do we know the provider did not bill us"**. Three classes:

| Class | Examples | Retry? |
|---|---|---|
| `retryable-unbilled` | 429, 5xx | **yes**, exactly once |
| `indeterminate` | our timeout, network drop after send, unparseable 200, a 200 whose content was unusable | no — may already be billed |
| `permanent` | 4xx other than 429, `ProviderConfigError` | no — a retry reproduces it |

Retrying an `indeterminate` failure spends the customer's money twice for one
step. Retrying a `permanent` one spends the retry budget to reproduce the same
error. Note this also means S2's `retryable: boolean` is **not** sufficient for
this decision and is deliberately not consulted: S2 marks an unparseable 200
`retryable: true`, but that response was billed. A test pins that distinction.

Worth noting the retry policy is narrower than it looks in practice: under a
provider that dedupes on an idempotency key, a resend returns the *same*
unusable response, so retrying a billed-but-useless result never helps either.

### Deviation 2 — a third reconciliation branch the AC does not name

The AC offers two safe answers for a resumed step with an unsettled paid call:
reuse the provider's idempotency key, or look the result up under that key.
**A provider that offers neither exists.** Perplexity chat completions and
DataForSEO's synchronous `live` endpoints have no documented idempotency-key
header and no "fetch the result of call K" lookup. For those, both named
strategies are unavailable and resending is definitely wrong.

So the third branch is **fail closed and do not resend** — costing one
already-spent call and routing the run to S4's refund path, which is what the
program's "money changes only from server-verified, idempotent events" boundary
demands.

`PROVIDER_REPLAY_SAFETY` accordingly ships with **every role set to `"none"`**.
This is the fail-safe default, not a placeholder: wrongly assuming a provider
dedupes double-charges on every crash, while wrongly assuming it does not costs
one call and refunds the customer. Only the first is a money bug. OpenAI is the
strongest promotion candidate and the executor already submits a stable key for
it; promotion is one line plus evidence, and belongs to the credential-backed
activation gate, which is the only place the claim can actually be verified.

Note this makes resume conservative but not broken: the workflow journal still
resumes every *completed* step: only the one step that was mid-call when the
process died fails.

### ESCALATION — a cancelled run can never be refunded

`assertTaskRefundEligible` (WP22-frozen) requires `status === "failed"`, and
`taskTransitions.cancelled` is terminal with no path to `failed`. So a run
cancelled after it has already spent provider money **cannot be refunded under
the frozen contract**. S3 does not invent a money path, so this is left as-is
and raised for S4 / owner direction. Options: allow refund from `cancelled`,
require cancellation to route through `failed`, or rule that mid-run
cancellation forfeits spend.

### Trap 12 — a self-referencing Convex module silently degrades the whole `api` type

`workflow.ts` calls `internal.platform.engine.workflow.validationReport` from
inside its own module. Without an explicit handler return-type annotation,
TypeScript resolves that module's exports to `any` — and the damage is **not
local**: `ideas.test.ts`, `billing.test.ts`, and `platformIdeas.test.ts` all
started failing with `TS7006/TS7031` implicit-any errors in code S3 never
touched. Annotating the handler's return type fixed all of them at once. The
Convex guidelines mention the annotation for `ctx.runQuery` in-file calls; the
blast radius is what was surprising.

### Checks

- `npm run typecheck` exit 0
- `npm run lint` exit 0, 0 errors, 35 pre-existing warnings
- `npm test` exit 0 — node 91/6/7/10/4, vitest: redirects 25, auth 38,
  **convex 164 → 215** (+51: 29 executor, 22 run/step state)
- `npm run build` exit 0, 310 pages (unchanged)
- `git diff --check` clean; `convex/schema.ts` unchanged
- Executor guards mutation-tested: dropping the attempt ceiling, loosening
  `< MAX_ATTEMPTS` to `<=`, treating a missing HTTP status as retryable, and
  bypassing the fail-closed branch each fail a test.

**Correction to the S2 entry:** it records `vitest 125/172/528`. The Convex
figure is wrong — the suite measures 164 at S2's tree and 215 with S3's tests.
No tests were lost; all 12 pre-existing Convex files still pass.

### `npm audit` still FAILS — unchanged from S2, still escalated

`nanoid <3.3.17` (high, GHSA-2v37-7h3g-55p8) via `next@16.3.0 → postcss`.
Identical to the S2 finding; not introduced or worsened by S3, and still not
fixed because `package-lock.json` is a serialized one-writer seam owned by WP20.

**Docs updated:** this file; `docs/wp/wp26-stories.md` S3 checked.

**Next:** `WP26-S4` cost cap enforcement and exact-once refund — which consumes
this story's `reserve()` seam (already invoked before every attempt, including
the retry) and must resolve the cancelled-run refund escalation above.

---

## WP26-S4 — Cost cap enforcement and exact-once refund (2026-08-12)

**Files:** `convex/platform/engine/cost.ts` (new), `pipeline.ts` (per-step
budgets), `executor.ts` (`billedOnFailure`), `steps/runner.ts` (reserve +
reconcile), `steps/*.ts` (return provider cost), `workflow.ts` (debit/refund),
`cost.test.ts`, `wp26Cost.test.ts`.

### The cap is a pre-call reservation, not a running-total check

Before every attempt, `assertReservation` compares
`already-spent + this call's worst case` against $4.00. The AC is explicit that
a post-hoc check is not acceptable — it lets a run sit at $3.90 and still issue
a call that lands at $4.90 — and a test encodes exactly that scenario, asserting
both that actual spend is under the cap and that the call is still refused.

**Worst case comes from a declared per-step budget**, not from the request about
to be sent, because the check has to happen *before* the request exists. That
makes the budget a ceiling the step is obliged to respect: a step that sent more
than it reserved would spend money the cap never saw.

**Spend is accumulated in micro-USD integers, rounding up.** Summing a dozen
binary floats and comparing against a boundary is how a run lands at
`4.0000000000001` and the cap either leaks or fires spuriously. Every conversion
rounds up, so a reservation is never optimistic.

The configured budgets total ~$0.63 worst-case per run, ~$1.26 if every step
takes its retry — comfortably inside the cap and close to the ruling's $0.52
reference. A test pins the budgets against 4x that reference rather than only
against the cap, because the cap sits ~8x above expected spend and could never
notice a regression that merely doubled the bill.

### Cost telemetry lives in `audit_events` — a noted schema gap

**The frozen schema has no cost column anywhere**: not on `tasks`, `task_steps`,
`workflow_runs`, or `documents`. Spend still has to be durable, or a resumed run
restarts its budget at zero and buys a second $4.00 of calls.

`audit_events` is the one append-only table built for "a system or provider did
something worth recording", so each settled attempt appends one row with
`actorType: "provider"`, `subjectId: <taskId>`, and a metadata object whose
every value is a number. There is no free-text field, so **no customer input can
reach a cost row by construction** — the PII-redaction criterion is structural
rather than a rule someone must remember.

Two costs of this choice, both handled: the sum is a scan over the project's
events since the task started (bounded, and it **throws rather than
under-counting** if it ever hits its ceiling), and an unparseable row throws
instead of counting as $0 — spend we know happened but can no longer measure is
not free.

**Escalated:** a first-class `costMicroUsd` column or an `engine_costs` table
would be cleaner than borrowing the audit log. That is a `convex/schema.ts`
change, which is a serialized one-writer seam, so it needs an owner ruling
rather than a unilateral amendment.

### A failure we cannot prove was unbilled is charged its full reservation

`billedOnFailure` (in `executor.ts`, which mints the codes) splits failures into
`unbilled` — a provider error status, a config error, a rejected reservation —
and `billed-unknown`: our timeout, a dropped connection, an unusable 200, or the
unsettled-attempt case. The second class is charged its full worst-case
reservation. Assuming zero would let a run that timed out three times keep
issuing calls against a budget it had already spent.

Falls out of S3's classification: **only the last attempt of a step can be
`billed-unknown`**, because every class that permits a retry is one we know was
not billed. Recording spend for the final attempt alone is therefore complete,
not a shortcut.

### Credits: debit at start, refund on failure, no new money path

`debitTask` and `refundFailedTask` were built by WP24 and had **never been
called by anything**. S4 wires them; it invents no money mutation.

The debit runs inside the same mutation as `createRun`, so insufficient credits
roll the whole start back — no task row, no workflow, nothing to reconcile.
Debiting after enqueueing would let a run start spending provider money against
an account that could not pay. A control test asserts the funded path really
does create and charge, so the "no credits, no task" test cannot pass vacuously.

Refund exactness comes from WP24's ledger key (`task-refund:<debitId>`), so
duplicate and concurrent refunds are both no-ops. A cap breach mid-run reaches
the same path: the reservation throws, the step fails closed, the run fails,
`onComplete` refunds once.

### OPEN — the report's credit price is not ruled

`VALIDATION_REPORT_CREDITS = 15n` comes from the plan's pricing table (§6.3),
which writes it as **"~15 credits"**. A tilde is not a ruling. It is a
server-side constant so no caller can supply an amount, but **the exact price
needs an owner ruling before activation.**

### ESCALATION restated — a cancelled run still cannot be refunded

Unchanged from S3 and now pinned by a test that documents the behaviour rather
than hiding it: `assertTaskRefundEligible` admits only `failed`, `cancelled` is
terminal, so **a customer who cancels mid-run forfeits their credits.** S4 does
not invent a path around a frozen money contract. Needs an owner ruling.

### Scope note — the reservation is a query, and that is only safe sequentially

`assertReservation` reads without writing, which is sound because a run's steps
execute strictly sequentially (`workflow.ts` awaits each in turn). **If steps
are ever parallelised, this must become a mutation that writes a reservation
row**, or two concurrent steps will both read the same pre-spend total and both
pass. Recorded in the module doc as well as here.

### Checks

- `npm run typecheck` exit 0
- `npm run lint` exit 0, 0 errors, 35 pre-existing warnings
- `npm test` exit 0 — node 91/6/7/10/4, vitest: redirects 25, auth 38,
  **convex 215 → 251** (+36: 17 cap arithmetic, 19 spend/refund)
- `npm run build` exit 0, 310 pages (unchanged)
- `git diff --check` clean; `convex/schema.ts` unchanged
- Cap guards mutation-tested: replacing the pre-call check with a post-hoc one
  (4 failures), rejecting exactly-at-cap, rounding down instead of up,
  double-counting a redelivered settle, and treating an unreadable cost row as
  free each fail a test.

### `npm audit` still FAILS — unchanged, still escalated

`nanoid <3.3.17` (high, GHSA-2v37-7h3g-55p8) via `next@16.3.0 → postcss`.
Identical to S2/S3; not introduced or worsened here. `package-lock.json` is a
serialized one-writer seam owned by WP20.

**Docs updated:** this file; `docs/wp/wp26-stories.md` S4 checked.

**Next:** `WP26-S5` report compiler and renderer.
