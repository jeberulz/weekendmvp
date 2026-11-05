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
  - `tests/platform/support/meterStub.ts`: an in-memory C-METER built from the contract's pure helpers,
    with no new contract fields. It moved out of `convex/` in the review fixes, so it can never be
    deployed. It checks `SettleArgs`/`FailArgs` integers and the `billed`/`errorClass` enums the way the
    real validators do.
  - `tests/platform/ai-gateway.test.ts`: 58 tests, in fixture mode or with fakes.
- Flow per attempt: spec → worst case → `reserve` → `markSent` → call → zod validate → one finalise
  (`settle` or `fail`). A throwing finalise is retried once with the same call, never switched to the
  other one. If the retry throws too, the run returns `internal` with the `usageId` and the row is left
  for the WP70 sweep.
- Every meter throw comes back as a result that keeps the attempts finalised so far:
  - `reserve` refused gives `meter_refused`;
  - any other `reserve` throw gives `internal`;
  - a throwing `caller.attemptKey` gives `config`.
- `markSent` returning `changed: false` means the row is already final (swept). Nothing is sent and
  nothing is finalised; the run fails with billed `none`.
- Status and charge on `GatewayAttempt` come from the `FinalizeResult` (`status`, `alreadyFinal`,
  `chargedMicroUsd` including `lateAdjustmentMicroUsd`), not from what the gateway asked for.
- Text cost cross-check: the reported usage is repriced with the S1 rate card. Settle and fail charge
  the larger of that and the adapter's figure, so an adapter that under-reports cannot under-charge.
- Run deadline: about 9 minutes (`GATEWAY_RUN_BUDGET_MS = MAX_TIMEOUT_MS`) across the call and its
  re-ask.
  - The re-ask timeout is the smaller of the request timeout and the time left.
  - There is no re-ask if the caller's signal aborted, or if under 30 s is left.
- D23 rules:
  - One re-ask on a schema failure, with its own row.
  - The re-ask note never echoes model-chosen text. A path segment prints only if it is an array index,
    or a key the output schema declares that matches `^[A-Za-z_][A-Za-z0-9_]{0,40}$`. Anything else
    (record keys, unknown keys) prints as `[key]`. Issue codes are printed; zod messages never are.
  - A finished reply that is not JSON re-asks (`(root): invalid_json`).
  - `max_tokens` and `model_context_window_exceeded` fail billed `actual` at their cost with no
    re-ask, because a re-ask would only hit the same ceiling.
  - `tool_use` and `pause_turn` fail at once with no re-ask, because neither is a finished answer and
    continuing would be a tool loop.
  - No tools, `tool_choice` or betas are ever sent. A test pins the exact key set of the sent params.
- Overrun: the finalise records the true cost, on settle and on a fail billed `actual`. The gap shows on
  `GatewayAttempt.overrun` and through `deps.onOverrun`; a throwing hook is ignored.
- No Convex `internalAction` wrapper yet. Binding the ports to the stub would enforce no real budgets.
  The thin `"use node"` wrapper lands once WP70 ships the real `convex/ai/metering.ts` (and S3's
  registry).
- Orchestrator decisions on the author's contract questions:
  - A schema-failure attempt is recorded as `fail({ billed: "actual", costMicroUsd, errorClass:
    "schema_invalid" })`. It is charged the same as a settle, and the failure-rate alarm can see it.
  - Escalation ruling (review fixes): an escalation counts once per logical escalation.
    `escalation: true` goes only on the first reserve of caller attempt 1. Neither a job retry
    (`caller.attempt > 1`) nor the re-ask counts again. C-JOBS bounds job retries.
  - A replayed attempt key returns `duplicate_attempt` and sends nothing. Callers bump `attempt`; this
    is the idempotency rule.
- Contract questions for Codex (C-METER, through the `05` §5 change rule):
  - Optional usage token fields on `FailArgs`, so failed rows keep their token counts.
  - An optional overrun marker on `FinalizeResult` or `ai_usage`, so metering records rate-card drift itself.
- Known limit: the byte-based input bound can be up to about 4x the true token count, so a large prompt
  can be refused as over the lane ceiling. Revisit with `count_tokens` (or a calibrated ratio) in
  S3 or S4.
- Checks (review fixes): `npm run typecheck` 0, `npx tsc --noEmit -p convex` 0, `npm run lint` 0
  (warnings only, none in S2 files), and `npx vitest run tests/platform/ai-gateway.test.ts
  tests/platform/ai-providers.test.ts` 0 with 100 tests (58 gateway + 42 providers).

## 2026-11-05 - S3 router, registry, prompt-version check, import boundary

- Files:
  - `convex/ai/router.ts`: `routeSpec(spec)` gives `{ provider, model, effort, thinking, maxTokens,
    maxInputTokens, mode }`. The model comes from `TIER_MODELS[spec.tier]` and the input ceiling from
    `maxInputTokensForSpec`. There is no override parameter, and an extra `model` field on the object is
    ignored. An unknown tier or mode throws `PromptSpecError` (`INVALID_TIER` / `INVALID_MODE`).
  - `convex/ai/registry.ts`: `createPromptRegistry(entries)`, plus the default registry's `getSpec`,
    `getEntry`, `listSpecs` and `listEntries`. Errors are `PromptRegistryError` with the codes
    `MALFORMED_REF`, `UNKNOWN_REF`, `DUPLICATE_REF`, `DUPLICATE_CONTENT` and `UNCANONICAL_CONTENT`. Every
    entry is re-validated with `definePromptSpec`. This file also holds `promptContent` and `canonicalJson`.
  - `convex/ai/prompts/entry.ts`: `promptEntry(spec, { sampleInputs, internal })`.
  - `convex/ai/prompts/index.ts`: `PROMPT_ENTRIES`.
  - `convex/ai/prompts/registryProbe.ts`: `internal-registry-probe@1`, registered `internal: true`.
    Neither C-PROMPT nor `02` names a first real spec, so this is a minimal probe and not a crew prompt.
  - `convex/ai/prompts/versions.lock.json`: the committed lock.
  - `scripts/check-prompt-versions.mjs`: the version check (`--write`, `--lock <path>`).
  - `tests/security/prompt-versions.test.mjs`: 14 tests.
  - `tests/security/ai-imports.test.mjs`: 5 tests.
  - `tests/platform/ai-registry.test.ts`: 21 tests.
- Content hash: SHA-256 over canonical JSON, with keys sorted at every depth. The lock also keeps a hash
  per part, so a failure names what changed. The hashed content is:
  - `system`;
  - `task`: the `buildUser` source plus its output for the entry's `sampleInputs`, so a constant the
    template reads is caught too;
  - `outputSchema`: `z.toJSONSchema` without `$schema`, as the gateway sends it;
  - `run`: tier, effort, thinking, maxTokens, mode, purpose, cacheLayout and fallbacks. This goes beyond
    "text or schema", so that an `id@version` names one exact call shape, and so that a version that only
    changes run settings is not refused as duplicate content.
- How the specs load under node: the registry, the prompts and the C-PROMPT import use explicit `.ts`
  extensions. Both tsconfigs already set `allowImportingTsExtensions`. The script imports the real
  registry under `node --experimental-strip-types`; Node 22.23 also runs it without the flag.
  `buildUser` source text is taken from that runtime. The registry's duplicate-content check compares
  within one runtime, so a vitest or Convex bundle that prints source differently does not matter.
- Check rules. These fail (exit 1):
  - content changed under the same ref;
  - a registered ref missing from the lock;
  - a new version at or below a locked version of the same id;
  - a locked ref no longer registered and without a `"retired": "<note>"`;
  - a retired ref registered again.
  `--write` adds new refs only. It never rewrites a hash, and it writes nothing while any other problem
  stands.
- The proof that it fails uses in-memory mutated entries (system, task, template constant, schema and run
  settings) plus CLI runs on temp lock copies. No real file is changed.
- Import boundary:
  - It scans `convex/`, `lib/`, `app/`, `components/` and `scripts/` with the TypeScript parser, so
    comments never count. It covers `import`, `export from`, `import =`, `require`, `import()`,
    `import("x")` types and type-only imports.
  - SDKs checked: `@anthropic-ai/*`, `openai`, `@ai-sdk/*`, `ai`, and any package with "recraft" in its
    name. There are no SDK hits outside `convex/ai/providers/`, so the SDK allowlist is empty.
  - Provider hosts are checked as string or template literals anywhere, not only inside `fetch(`. Every
    existing call passes an endpoint constant, so this is the stricter check.
  - Host allowlist, with the files not moved:
    - `lib/og/providers/openai.mjs` and `lib/og/providers/recraft.mjs`: the OG card pipeline, pre-WP;
    - `lib/engine/providers/openai.ts`: WP26-S2, which D11 keeps.
  - A stale allowlist entry fails the test.
- Deviation: the story names `tests/security/ai-imports.test.ts`. It ships as `.mjs` so the existing
  `test:security` glob runs it without a `package.json` change.
- Not wired yet: `gateway.ts` still calls `modelForSpec` and `maxInputTokensForSpec` directly, which give
  the same answers. It was left alone while its independent review runs. When WP70 lands the
  `internalAction` wrapper, it should take `promptRef`, then `getSpec`, then `routeSpec`.
- Needs from Codex (owner of `package.json` and `.github/**`):
  1. A `"check:prompt-versions": "node --experimental-strip-types scripts/check-prompt-versions.mjs"`
     script.
  2. A CI step running it. The `test:security` glob already runs it through
     `tests/security/prompt-versions.test.mjs`, so this is for a clearer CI signal, not for coverage.
- Checks:
  - `npm run typecheck`: exit 0.
  - `npx tsc --noEmit -p convex`: exit 0.
  - `npm run lint`: exit 0, with 37 warnings that predate S3. The new files are clean.
  - `npm run test:security`: exit 0. Node: 170 passed. Vitest: 121 passed in 5 files.
  - `npx vitest run tests/platform/ai-registry.test.ts tests/platform/ai-gateway.test.ts`: exit 0, 79
    passed.
  - Docs updated: `wp71-stories.md` (S3 ticked) and this entry.
