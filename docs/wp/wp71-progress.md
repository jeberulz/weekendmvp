# WP71 Progress - AI gateway, prompt registry and evals harness

## 2026-11-05 - Setup

- Branch/worktree: `claude/wp71-ai-gateway` in `.worktrees/wp71-ai-gateway`, from `main` at `d67dc8e2`.
  G0 closed when #175 merged, and the owner gave the go for Phase 1.
- Assignment: WP71 (`04`), Claude lane, high.
- File boundaries are listed in `wp71-stories.md`. Metering is Codex's (WP70); until it merges, the gateway
  uses a stub with the C-METER signatures.
- Required checks: typecheck, lint, test, build.
- D23 ruled 2026-11-05 (owner: "Approve D23"): no model tool loops; S2 is unblocked.
- Needs from Codex: the optional env entries in `.env.example` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `RECRAFT_API_KEY`, `RECRAFT_STYLE_ID`, `AI_PROVIDER_MODE`), already requested as WP69 ask 8.

## 2026-11-05 - S1 provider adapters

- Files: `convex/ai/pricing.ts` and `convex/ai/providers/{types,mode,transport,anthropic,openaiImages,recraft,fixtures}.ts`,
  plus `tests/platform/ai-providers.test.ts` (42 tests).
- Independent Opus review: one blocking finding, now fixed. gpt-image-2 is billed per token ($5 / MTok text
  in, $30 / MTok image out), but the adapter charged only the flat table price. Now:
  - The reservation is the table price plus prompt bytes × the text rate.
  - Settle charges the larger of the table price and tokens × rates, with `estimated: false` when usage is
    present.
  - A settle can therefore go above the reservation. C-METER allows that (the actual cost is recorded), and
    S2 now flags it as an overrun.
- Non-blocking review fixes:
  - an explicit Anthropic `baseURL` with `maxRetries: 0`;
  - Recraft `image_format: "png"`, with a PNG signature check on both image adapters;
  - a signal aborted before the send gives `config` / billed `none`;
  - a client factory that throws gives `config` / billed `none`;
  - only `end_turn` and `stop_sequence` are usable (D23);
  - a malformed cache count counts as missing usage;
  - the Haiku long-context card is picked from the lane max;
  - the 9-minute timeout cap;
  - fixture `billedAs` is tagged "(fixture)".
- Open owner question: 5xx stays billed `possible`, so the worst case is charged. Could that lock Free users
  out after a provider outage? This is recorded on the board.
- Verify before live spend:
  - the Sonnet 5.5 cache-read rate (the skill says $0.20, the spike says $0.10; $0.20 is kept, which is
    conservative);
  - the gpt-image-2 token rates on OpenAI's live pricing page.
- Checks: see the S1 commit.

## 2026-11-05 - S2 gateway core

- Files:
  - `convex/ai/gateway.ts`: the pure, injectable core. `runTextGateway` and `runImageGateway`, plus the
    `MeterPort`, adapter and clock ports and an optional `onOverrun` hook.
  - `convex/ai/meterStub.ts`: an in-memory C-METER built from the contract's pure helpers, with no new
    contract fields.
  - `tests/platform/ai-gateway.test.ts`: 31 tests, in fixture mode or with fakes.
- Flow per attempt: spec → worst case → `reserve` → `markSent` → call → zod validate → exactly one
  `settle` or `fail`. If `settle` or `fail` itself throws, the row is left for the WP70 sweep.
- D23 rules:
  - One re-ask on a schema failure, with its own row. The re-ask note lists the failed paths and never
    echoes the reply.
  - `tool_use` and `pause_turn` fail at once with no re-ask, because neither is a finished answer and
    continuing would be a tool loop.
  - No tools, `tool_choice` or betas are ever sent.
- Overrun: the settle records the true cost, and the gap shows on `GatewayAttempt.overrun` and through
  `deps.onOverrun`.
- No Convex `internalAction` wrapper yet. Binding the ports to the stub would enforce no real budgets.
  The thin `"use node"` wrapper lands once WP70 ships the real `convex/ai/metering.ts` (and S3's
  registry).
- Orchestrator decisions on the author's contract questions:
  - A schema-failure attempt is recorded as `fail({ billed: "actual", costMicroUsd, errorClass:
    "schema_invalid" })`. It is charged the same as a settle, and the failure-rate alarm can see it.
  - The re-ask of an escalation does not count as a second daily escalation (`escalation: true` is sent
    on the first reserve only).
  - A replayed attempt key returns `duplicate_attempt` and sends nothing. Callers bump `attempt`; this
    is the idempotency rule.
- Contract questions for Codex (C-METER, through the `05` §5 change rule):
  - Optional usage token fields on `FailArgs`, so failed rows keep their token counts.
  - An optional overrun marker on `FinalizeResult` or `ai_usage`, so metering records rate-card drift itself.
- Known limit: the byte-based input bound can be up to about 4x the true token count, so a large prompt
  can be refused as over the lane ceiling. Revisit with `count_tokens` (or a calibrated ratio) in
  S3 or S4.
- Checks: see the S2 commit.
