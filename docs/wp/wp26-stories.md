# WP26 Stories - Durable Task Workflow And M3 Validation Reports

Branch: `codex/wp26-research-workflow`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Every story below passes its verification, the required
checks pass, an independent high-risk reviewer finds no remaining
critical/high/medium issue, and `docs/wp/wp26-progress.md` records honest
evidence. `S1` is a **named contract subgate**: it must pass its own
independent review and be recorded as passed in `docs/wp/wave-gate-report.md`
before WP27 may start, even if S2-S6 are still in progress.

## Ruled Inputs (do not re-litigate; see `docs/wp/RULINGS.md` 2026-08-06)

All provider gaps are now closed. `S2` is unblocked.

- Synthesis/scoring model: **`gpt-5.6-sol`** via the existing `OPENAI_API_KEY`
  ($5.00/1M input, $30.00/1M output as of 2026-08-06). `S2` must pin the
  **dated snapshot**, not the floating alias, so model drift cannot silently
  change report quality or cost. `gpt-5.6-terra` ($2/$12) is the documented
  downgrade only if the `S6` eval shows no quality delta.
- Search/community-signal source: **Perplexity Sonar Pro**, citation-only
  (cite and store source URLs; never store or republish full third-party page
  content beyond what a citation snippet needs). $3/1M input, $15/1M output,
  plus a $6-14 per 1K request fee depending on search context size.
- Keyword volume/competition/CPC: **DataForSEO** ($0.01/task + $0.0001/item).
  An LLM may never synthesize, estimate, or infer these values — a missing or
  failing keyword provider must fail the step closed, never fall back to a
  model guess.
- Per-report hard cost cap: $4.00. Enforced via pre-call reservation (see
  `S4`), not a post-hoc check, with a retry-once-then-refund policy on
  breach. **Reference budget:** a full run prices at roughly $0.52 (~$0.26
  synthesis + ~$0.20 Perplexity across three calls + ~$0.02 DataForSEO +
  brief normalization), or roughly $1.04 if every step takes its one allowed
  retry. `S4`'s worst-case per-call reservations should be calibrated against
  these figures; a run trending far above them signals a prompt or
  context-size regression, not merely an expensive report.
- Retention: cached research (citations, raw provider responses, generated
  report records) is kept indefinitely as an owned asset. No expiry job is
  in scope for WP26.

## Stories

- [x] `WP26-S1` - Versioned Validation Report and site-input contracts (contract subgate)
  - Scope: `convex/schema.ts` (additive only, serialized one-writer seam),
    `convex/platform/engine/{contracts,validators}.ts`, contract-only tests.
    No provider adapters, no workflow execution, no UI in this story.
  - Acceptance criteria:
    - A versioned `ValidationReport` document schema exists covering the v1
      engine scope from program-platform-plan.md §4.5 ("v1 engine scope"
      paragraph): Tier-1 scores + summaries, `competitive_analysis`,
      `go_to_market`, `community_analysis`, `keyword_list`, market insight
      (stats + CAGR, cited), `why_now`. Every cited claim carries a
      `citations: [url]` array; the schema fails closed if a scored/claimed
      section has zero citations where the plan requires them (mirrors the
      existing thin-research STOP rule).
    - A versioned "site-input" contract exists: the exact structured shape
      WP27's renderer will consume from a completed report. This is
      deliberately decoupled from the report's internal shape so WP27 can be
      built against a frozen interface rather than the live schema.
    - Both contracts declare a `schemaVersion`; a later incompatible change
      requires a new version, never an in-place breaking edit.
    - No destructive schema change to any WP22-frozen table. This story may
      only add new tables/fields.
  - Verification:
    - `npm run typecheck`, `npm run lint`, `npm test` pass.
    - Adversarial fixture tests: missing citations on a scored section fails
      closed; an unversioned or unknown `schemaVersion` is rejected; a
      report record cannot be constructed with a site-input shape that
      doesn't match the frozen contract.
    - Independent review of this story alone (it is the contract subgate)
      before any S2+ work is treated as unblocking WP27.

- [x] `WP26-S2` - Engine provider adapters behind a stable interface
  - Unblocked as of 2026-08-06: all three providers are ruled (see "Ruled
    Inputs" above and `docs/wp/RULINGS.md`).
  - Scope: `convex/platform/engine/providers/{openai,perplexity,keywordData}.ts`,
    a provider-agnostic interface each adapter implements, isolated fixture
    tests. Real network calls stay disabled outside fixtures per the
    manifest default until this story's own test-mode gate passes.
  - Acceptance criteria:
    - One typed interface per provider role (synthesis model, search/
      community source, keyword/demand data) so a future provider swap
      doesn't touch pipeline code, only the adapter.
    - The OpenAI adapter pins a dated model snapshot resolved at
      implementation time, not a floating alias, and the pinned ID is
      recorded in `docs/wp/wp26-progress.md`.
    - Adapters read API keys from server-side env only (never
      `NEXT_PUBLIC_*`); missing/malformed keys fail closed with an explicit
      configuration error, not a silent no-op. New keys
      (`PERPLEXITY_API_KEY`, DataForSEO credentials) are added to
      `.env.example` in the same change, per the WP20 environment-coverage
      gate; `OPENAI_API_KEY` already exists.
    - The keyword adapter never falls back to a model-generated estimate.
      A provider failure fails the step closed so `S3`'s retry and `S4`'s
      refund paths handle it, rather than silently degrading the report.
    - Fixture-mode adapters (recorded request/response pairs) let every
      later story's tests run deterministically with zero live spend.
      Recorded fixtures must be scrubbed of any credential or account
      identifier before being committed.
    - Per-call cost is estimated/recorded even in fixture mode, so S4's cost
      accounting has real numbers to sum. Cost estimation uses the published
      per-token and per-request rates in "Ruled Inputs", including
      Perplexity's per-1K-request search fee, which is separate from its
      token cost and is easy to omit.
  - Verification:
    - Fixture-only Vitest suite; no live API key required to pass.
    - Config-error tests for missing/malformed keys.
    - A test proving a failing keyword provider fails closed rather than
      returning synthesized keyword metrics.

- [ ] `WP26-S3` - Durable task/workflow execution (resume/retry/cancel/timeout/onComplete)
  - Scope: workflow mount/manager, `convex/platform/engine/tasks.ts`,
    `convex/platform/engine/steps/*.ts` (one file per pipeline step:
    brief normalization, market stats, competitors, community signals,
    keywords/demand, synthesis + scoring, report render — the 7-step
    pipeline from program-platform-plan.md §4.5).
  - Acceptance criteria:
    - Every external step (provider call) has a stable, server-derived
      idempotency key. A local/server-derived key alone is **not**
      sufficient: if the process crashes after a provider accepts a paid
      call but before the result is persisted, a resumed step must not
      blindly resend. For each provider role in S2, use the provider's own
      idempotency-key support where the API offers one (submit the same
      server-derived key; the provider returns the original result on
      retry), or, where a provider has no such support, reconcile before
      resending: query/poll for an existing in-flight or completed result
      under that key before issuing a new paid call.
    - A task run can be resumed after a crash/redeploy from its last
      completed step, not restarted from S1, and resume must not re-issue a
      paid call for a step whose provider-side result already exists per
      the reconciliation rule above.
    - A task run can be explicitly cancelled; a cancelled run stops issuing
      new provider calls and settles any in-flight one before finishing.
    - A task run that exceeds a configured per-step or total timeout fails
      that step closed (not hung) and is eligible for the S4 refund path.
    - A step that fails (provider error, timeout) retries **exactly once**
      per the ruled retry-once-then-refund policy: one retry attempt, and
      if that also fails, the step fails closed and the run becomes
      eligible for S4's refund path. A step must never retry zero times
      (silently giving up) or more than once (silently over-spending)
      regardless of workflow-runtime defaults.
    - `onComplete` transitions the report to its terminal state exactly
      once even under concurrent/duplicate completion signals.
    - No long-running Next.js request performs the actual pipeline work;
      the route that starts a run returns quickly and the run continues out
      of band.
  - Verification:
    - Convex tests for resume-after-crash (simulate partial completion),
      cancel-mid-run, timeout-fails-closed, and duplicate-onComplete
      idempotency.
    - A crash-window test: simulate "provider call accepted, result not yet
      persisted," then resume, and assert no second paid call is issued for
      that step (using S2's fixture adapters' recorded-call counters).
    - A retry-once test: first attempt fails, second (retry) succeeds — step
      completes, no third call attempted. A second retry-once test: both
      attempts fail — step fails closed after exactly two calls, not one,
      not three.
    - Runs entirely on S2's fixture-mode adapters; still zero live spend.

- [ ] `WP26-S4` - Cost cap enforcement and exact-once refund
  - Scope: `convex/platform/engine/cost.ts`, ledger integration with the
    WP24 credit/refund primitives (namespaced, not a new money path).
  - Acceptance criteria:
    - The $4.00 ruled cap is enforced by **pre-call reservation**, not a
      post-hoc running-total check: before issuing any paid call, estimate
      its maximum possible cost (worst-case token/data budget for that
      provider/step) and reject the call if `already-spent + estimated-max`
      would exceed $4.00, before the call is made. A running total checked
      only after each call completes is not acceptable — it allows a run to
      land at, e.g., $3.90 then still issue a call that lands at $4.90.
    - After each call, reconcile the reservation against actual billed
      usage (a call may cost less than its worst-case estimate); the
      running total used for the next reservation check is the true spent
      amount, not the reserved estimate.
    - S3's retry-once policy is included in cost accounting: the pre-call
      reservation check runs before both the first attempt and the retry
      attempt of a step, so a retry cannot push total spend past $4.00
      either.
    - A hard-failed or otherwise-failed run refunds the customer's spent
      credits exactly once (reuses WP24's exact-once ledger contract; no
      new money-mutation path is invented).
    - Cost telemetry per report is PII-redacted (no customer-identifying
      text in stored cost/telemetry rows) per the manifest's gate
      requirement.
  - Verification:
    - Convex tests: a call whose worst-case estimate would cross $4.00 is
      rejected pre-call even though the running actual-spend total is still
      under the cap; cap-breach mid-run refunds exactly once; concurrent
      failure-refund attempts do not double-refund; a retry-once step's
      second (retry) call is still subject to the pre-call reservation
      check; telemetry rows contain no free-text customer input.

- [ ] `WP26-S5` - Report compiler and renderer
  - Scope: `convex/platform/engine/compile.ts` (raw provider output ->
    versioned `ValidationReport`), a dashboard-rendered report view under
    `app/dashboard/**` reusing the WP23 shell (no new nav/shell owner).
  - Acceptance criteria:
    - The compiler enforces citation/competitor/score completeness
      (>=2 cited market stats, >=3 competitors with pricing, every scored
      section populated) before a report is marked complete; an incomplete
      compile fails closed rather than rendering a partial report as final.
    - The rendered report is owner-only (derives identity server-side, no
      caller-supplied owner ID), consistent with every other WP22-frozen
      surface.
    - No live site/tenant rendering in this story — that boundary stays
      with WP27.
  - Verification:
    - Convex/component tests for the completeness gate (each missing
      requirement fails closed individually).
    - Owner-isolation tests matching the WP22/WP23 pattern (two-owner
      denial, anonymous denial).

- [ ] `WP26-S6` - Fixed-corpus quality evaluation and worker gate evidence
  - Scope: `evals/` (or equivalent), fixed test-idea corpus, worker gate
    evidence in `docs/wp/wp26-progress.md`.
  - Acceptance criteria:
    - A fixed corpus of test ideas runs through the full pipeline
      (fixture-mode adapters) and produces reports meeting the plan's
      "exact or better" bar used elsewhere in the program: citation
      count/quality, >=3 competitors with pricing, >=2 cited market stats,
      section completeness.
    - Standard checks (`typecheck`, `lint`, `test`, `build`, prod dependency
      audit, diff/secret scan) all pass.
    - Worker prepares S6 evidence; the orchestrator/independent reviewer
      owns the final package-gate verdict, consistent with every prior WP
      in this program.
  - Verification:
    - Eval run against the fixed corpus with a documented pass bar.
    - Full standard check suite green.
  - **Known limit, not a gap to silently accept:** a fixture-mode eval only
    replays prerecorded provider responses. It proves the pipeline's
    orchestration, schema, cost, and refund logic are correct — it cannot
    prove the actual chosen OpenAI model and Perplexity configuration
    produce current, accurate citations, competitor pricing, or report
    quality, because fixtures never hit the real network. WP26's package
    gate passing on fixtures alone is not sufficient to claim "exact or
    better" quality against real provider output. See the credential-backed
    sandbox quality gate in `## After The Package Gate` below — that gate,
    not `S6`, is what actually validates provider quality before any real
    customer spend is authorized.

## After The Package Gate — Credential-Backed Quality Gate (separate, later, owner-approved)

Once `S1`-`S6` pass on fixtures, a **separate, later, explicitly
owner-approved** activation step is required before any real customer ever
triggers a live OpenAI/Perplexity call — this mirrors how WP21 (Google OAuth)
and WP24 (live Stripe) each split a development/code gate from a
credential-backed go-live gate:

- Run the same fixed corpus from `S6` through the real pipeline in an
  **isolated sandbox** (test API keys/accounts if the providers offer them,
  or tightly-capped production keys with a hard spend ceiling for the
  sandbox run itself) — not against production customer traffic.
- Judge the real output against the plan's "exact or better" bar used
  elsewhere in the program: citation count/quality, >=3 competitors with
  current pricing, >=2 cited market stats, section completeness — the same
  bar `S5`/`S6` enforce structurally, now checked against real content.
  Perplexity is a pipeline dependency, not a bar to relax if its answers
  turn out incomplete.
  Also verify the true per-report spend (real token/API pricing) stays
  under the $4.00 cap on this real corpus, not just the fixture-estimated
  cost. Compare it against the ~$0.52 reference budget in "Ruled Inputs":
  a real run landing several times higher means the estimate model in `S4`
  is wrong and its reservations need recalibrating before activation, even
  if the run technically stayed under the cap.
- Optionally benchmark `gpt-5.6-terra` against the ruled `gpt-5.6-sol` on the
  same corpus. If quality is indistinguishable, the ~$0.16/report saving is
  worth taking — but record it as a new `RULINGS.md` row, never an in-place
  edit of the model pin.
- Record the result and the owner's explicit approval to activate in
  `docs/wp/RULINGS.md` and `docs/wp/wave-gate-report.md` before flipping any
  "fixtures only" flag in production configuration.

## Out Of Scope

- Any live provider call outside isolated fixtures (manifest default; stays
  blocked until this WP's own test-mode gate explicitly authorizes it, and
  even then only in a later owner-approved activation window, mirroring
  WP21/WP24's development-vs-go-live split — see "After The Package Gate"
  above for exactly what that later step requires).
- WP27's renderer, preview route, and anonymous capability-token flow.
- Any change to WP22-frozen validators/authz/transitions beyond additive
  schema for this WP's own new tables.
- `middleware.ts`/`proxy.ts`, `package-lock.json`, webhook routes, and other
  one-writer seams unless explicitly serialized by the orchestrator.
- Production deployment, data mutation, or credential rotation of any kind.
- M1 (signal ingestion) and M2 (idea generation/scoring into `engine_ideas`)
  from program-platform-plan.md §4.5.1 — those are WP32, not WP26.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- No ruling gaps remain open. `S1` is complete and independently gated;
  `S2` through `S6` are unblocked and may proceed in order.
- `S5` implementation note carried from `S1`'s review:
  `document_citations.position` is `v.int64()` (bigint) in the frozen WP22
  schema, while `CitationRef` in `convex/platform/engine/contracts.ts` is a
  plain `number`. `S5` is the first story to write and compare these, so it
  owns the explicit bigint/number conversion at that boundary.
- The workflow execution runtime (how resume/retry/cancel/timeout/onComplete
  in S3 is actually implemented) is an implementation-time engineering
  choice, not an owner ruling. Vercel Workflow DevKit is a strong candidate
  given this project's Vercel deployment target and its native durable-step
  primitives — the WP26 worker should evaluate it against a Convex-native
  task/cron approach before committing, and record the choice and rationale
  in `docs/wp/wp26-progress.md`.
- S1 is deliberately the smallest, lowest-risk story and the only one that
  touches `convex/schema.ts`. Land and independently gate it first, in its
  own review pass, so WP27 is not blocked on the rest of WP26's timeline.
