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
- S3 review follow-up (gateway code by the S2 review-fix agent): `safeIssuePath` now dedupes nodes, and
  the cross-check reprices with the requested model.
- Checks (review fixes): `npm run typecheck` 0, `npx tsc --noEmit -p convex` 0, `npm run lint` 0
  (warnings only, none in S2 files), and `npx vitest run tests/platform/ai-gateway.test.ts
  tests/platform/ai-providers.test.ts` 0 with 100 tests (58 gateway + 42 providers).

## 2026-11-05 - S3 router, registry, prompt-version check, import boundary

- Files:
  - `convex/ai/router.ts`: `routeSpec(spec)` gives `{ provider, model, effort, thinking, maxTokens,
    maxInputTokens, mode }`.
    - The model comes from `TIER_MODELS[spec.tier]` and the input ceiling from `maxInputTokensForSpec`.
    - There is no override parameter, and unknown fields such as `model` are dropped.
    - It re-validates every spec: it snapshots the spec (each field read once) and runs
      `definePromptSpec`. A hand-built spec with an unknown tier or mode, `budget_tokens` in thinking, an
      over-cap `maxTokens`, no effort, or a non-plain `thinking` throws `PromptSpecError`.
  - `convex/ai/registry.ts`: `createPromptRegistry(entries)`, plus the default registry's `getSpec`,
    `getEntry`, `listSpecs` and `listEntries`. Errors are `PromptRegistryError` with the codes
    `MALFORMED_REF`, `UNKNOWN_REF`, `DUPLICATE_REF`, `DUPLICATE_CONTENT` and `UNCANONICAL_CONTENT`. The
    file also holds `promptContent` and `canonicalJson`.
  - `convex/ai/prompts/entry.ts`: `promptEntry(spec, { module, sampleInputs, internal })`, `SPEC_KEYS`,
    `snapshotSpec`, `validatedSpec` and `assertModulePath`.
  - `convex/ai/prompts/index.ts`: `PROMPT_ENTRIES`.
  - `convex/ai/prompts/registryProbe.ts`: `internal-registry-probe@2`, registered `internal: true`.
    Neither C-PROMPT nor `02` names a first real spec, so this is a minimal probe and not a crew prompt.
  - `convex/ai/prompts/versions.lock.json`: the committed lock. It holds `@1` (`retired: "hash format
    v2"`) and `@2` (hash format v3).
  - `scripts/check-prompt-versions.mjs`: the version check (`--write`, `--lock <path>`, `--base <ref>`,
    `--no-base`).
  - `tests/security/prompt-versions.test.mjs`: 41 tests (one runs only in CI).
  - `tests/security/ai-imports.test.mjs`: 11 tests.
  - `tests/platform/ai-registry.test.ts`: 30 tests.
- Snapshot before validating (review fixes, rounds 1 and 2):
  - The registry, `promptEntry` and `routeSpec` validate a plain-data copy, not the caller's object.
    The copy reads each known C-PROMPT field once, from own properties only. It deep-copies and freezes
    `thinking` and `cacheLayout`, and drops unknown fields.
  - A `thinking` / `cacheLayout` that is not a plain object throws `INVALID_THINKING` /
    `INVALID_CACHE_LAYOUT`. A plain object's prototype is `Object.prototype` or `null`; a class
    instance, an array, or a non-plain object nested inside either one does not qualify. Without this, a
    class instance passed through unfrozen, and the caller could mutate `route.thinking` afterwards.
  - The copy is what gets registered or routed. A getter cannot pass validation with one value and
    register another. Mutating the source after registration changes nothing.
- Content hash: SHA-256 over canonical JSON, with keys sorted at every depth. The lock also keeps a hash
  per part, so a failure names what changed. The parts are:
  - `system`;
  - `task`: the `buildUser` source plus its output for the entry's `sampleInputs`;
  - `outputSchema`: `z.toJSONSchema` without `$schema`, as the gateway sends it;
  - `run`, which holds:
    - the router's full output: provider, resolved model, effort, thinking, maxTokens, `maxInputTokens`
      and mode (round 2);
    - tier, purpose, cacheLayout and fallbacks.
    With the router's output inside, a change to `TIER_MODELS` or a lane ceiling fails a locked version,
    just as a text change does;
  - `module` (round 1, added by the script): the source of the entry's `module` file and every repo-local
    runtime relative import, transitively.
    - Left out: type-only imports, packages, `node_modules` and, exactly, `lib/workspace/contracts/prompts.ts`
      (round 2 narrowed this from the whole `lib/workspace/contracts/` prefix). The probe imports only
      `definePromptSpec` from it at runtime, and what it decides for a spec is in `run`. Any other contract
      a spec imports at runtime is hashed.
    - Paths are repo-relative POSIX and sorted. Line endings and BOM are normalised. Comments count.
    - This catches helpers, constants on branches the sample never reaches, and `.refine()` /
      `.superRefine()` (JSON Schema cannot see a refinement).
    - A non-literal `import()` / `require()` in a spec module, or an import that leaves the repo or cannot
      be resolved, is refused.
    - Not hashed: data files a module reads at run time (`readFileSync`, `fetch`,
      `new URL(…, import.meta.url)`). Keep prompt text in source. Imports built with `eval` / `Function`
      are not hashed either; the import scan forbids both (round 3).
    - C-PROMPT imports (round 3): because C-PROMPT is not hashed, a spec module and every module it
      imports may take only `definePromptSpec` and types from it. Any other value import from it fails:
      a named import such as `TIER_MODELS`, a default or namespace import, `export *` or a named
      re-export, `import = require()`, and `import()` / `require()`. This holds with or without the
      `.ts` extension and in helpers, so an unhashed contract helper cannot change a locked spec.
  - Dependency bumps count: a zod upgrade that changes `toJSONSchema` output fails every locked prompt it
    touches and forces a version bump of each. That is noted in `prompts/index.ts`.
- Module identity (round 2): the script checks that the entry's `module` exports this exact spec.
  - Every C-PROMPT field must be equal. `thinking` and `cacheLayout` are compared as data, and
    `buildUser` and `outputSchema` must be the very same objects.
  - An entry in `index.ts` that spreads the module's spec and overrides `buildUser` (or anything else)
    gets `module_mismatch`, so it cannot borrow the module's hash.
- Rule this implies: a locked version's module is frozen, so keep each live version in its own module
  (`brandKit.v1.ts`, `brandKit.v2.ts`).
- Hash formats:
  - v2 added the `module` part. The probe was bumped to `@2`, and `@1` was kept with `retired: "hash
    format v2"`.
  - v3 (round 2): `run` includes the resolved model and ceilings. `origin/main` has no lock yet, so the
    in-branch `@2` entry was regenerated in place rather than bumped to `@3`. `@1` stays retired, and its
    entry is untouched.
- How the specs load under node: the registry, the prompts and the C-PROMPT import use explicit `.ts`
  extensions. Both tsconfigs already set `allowImportingTsExtensions`. The script imports the real
  registry under `node --experimental-strip-types`; Node 22.23 also runs it without the flag. The registry
  only compares content within one runtime, so a vitest or Convex bundle that prints `buildUser`
  differently does not matter.
- Check rules. These fail (exit 1):
  - content changed under the same ref;
  - a registered ref missing from the lock;
  - a new version at or below a locked version of the same id;
  - a locked ref no longer registered and without a `"retired": "<note>"`;
  - a retired ref registered again;
  - `module_mismatch`;
  - base check: an entry in the base lock that is missing here or differs in value. The comparison uses
    canonical JSON, and the one change allowed to a locked entry is adding `retired`. This closes "delete
    the lock entry and re-run `--write`": that route fails with `base_entry_changed`, and nothing is
    written.
  `--write` adds new refs only. It never rewrites an entry, and it writes nothing while any other problem
  stands.
- Base resolution and CI (round 2 blocker). `actions/checkout@v4` is depth 1 with no `origin/main`, so the
  base check used to skip itself in CI. The script now handles this itself:
  - The base is chosen in this order:
    - `--base <ref>`;
    - on a pull request (`GITHUB_BASE_REF`), `origin/$GITHUB_BASE_REF`;
    - on a push, the event's `before` sha from `$GITHUB_EVENT_PATH`;
    - otherwise `origin/main`.
  - New-branch pushes, where `before` is all zeros: the script compares with the repository's default
    branch (`event.repository.default_branch`, else `main`) and fetches it. It does not skip, so a fresh
    branch cannot rewrite main's entries either.
  - When the ref is not present and `CI` is set (anything except empty, `0` or `false`), the script runs
    one `git fetch --depth=1 --no-tags origin <branch-or-sha>` and reads `FETCH_HEAD`. The checkout
    persists credentials, so no secret is needed. A ref starting with `-` is refused.
  - Outcomes:

    | Outcome | Locally | With `CI` set |
    |---|---|---|
    | The base has no lock file at that path (today's `main`) | Notice, pass | Notice, pass |
    | The base cannot be read, even after the fetch | Notice, base check skipped | Fails: `base_unavailable` |
    | The base lock does not parse | Notice, base check skipped | Fails: `base_unreadable` |

  - Bootstrap rule (round 3): "missing passes" is there only because `main` has no lock until this PR
    merges. Once `main` has a lock, "missing" must fail in CI. That follow-up is noted in the script
    header. The lock path (`convex/ai/prompts/versions.lock.json`) is fixed: moving it is a contract
    change, because until "missing" fails, a moved lock would read as "missing" at the old path and pass.

  - The tests inject the env, the event file and the git runner, so no test runs real git for the base or
    touches the network. CLI subprocess tests run with `--no-base` and with the CI variables stripped.
    One exception: "CI: the real base check passes on the committed tree" runs only when `CI` is set. It
    runs the CLI with the real env and no `--no-base`, so `npm test` in CI performs the real base check
    (with its one shallow fetch) without waiting for the Codex CLI step. Round 3 tightened it so the
    output must be exactly two lines: "compared with the base lock at …" or the exact bootstrap notice,
    then "N prompt version(s) match the lock". Stderr must be empty, so a skipped base check or any other
    notice fails. It also checks that the lock's bytes are unchanged.
- The proof that it fails, with no real file changed:
  - in-memory mutated entries;
  - temp module trees (a helper constant on an unreached branch, a `.refine()` change, a transitive import,
    a non-excluded contract, and changes that must not count);
  - the `index.ts` override cases;
  - fake git and env for each base outcome (PR, push, new branch, fetch, local skip, CI failure, missing
    lock);
  - the C-PROMPT import rule, in synthetic sources and in a temp tree where a helper imports `TIER_MODELS`
    without the `.ts` extension (round 3);
  - a regression test that mutates `TIER_MODELS.fast`, then the probe's `TIER_MAX_INPUT_TOKENS` lane. Each
    change gives `changed_without_bump` on `run` for `@2`, and both are restored in `finally` (round 3);
  - CLI runs on temp lock copies.
- Import boundary (`tests/security/ai-imports.test.mjs`):
  - Files: round 2 replaced the fixed root list. The scan now takes every `ts/tsx/mts/cts/js/jsx/mjs/cjs`
    file from `git ls-files --cached --others --exclude-standard`, falling back to a filesystem walk
    without git. So `tests/` and the root config files are scanned now.
  - Skipped paths (round 3): `SKIP_DIRS` (`node_modules`, `.next`, `.turbo`, `.vercel`, `dist`, `build`,
    `coverage`, `.git`, `.worktrees`, `.claude`) matches the first path segment only. `_generated` is
    exactly `convex/_generated/`. Before this, a match at any depth hid `app/build/[slug]/page.tsx`, and
    would have hidden a future `convex/crew/build/sdk.ts`. Both are scanned now, and tests cover both.
  - It uses the TypeScript parser, so comments never count.
  - SDK imports in every form count, type-only included. Flagged: `@anthropic-ai/*`, `openai`,
    `@openai/*`, `@ai-sdk/*`, `ai`, and any package with "recraft" in its name.
  - Loaders the scan cannot follow fail outside `convex/ai/providers/` unless allowlisted with a reason:
    - a non-literal `import()` / `require()`;
    - `require.<member>`;
    - `require` used as a value (round 2);
    - `createRequire(...)` on any owner;
    - any import of `module` / `node:module` (round 2; covers aliased, destructured and
      `(await import("node:module")).createRequire`);
    - `process.getBuiltinModule` in any form (round 2);
    - `eval` in any form (round 3): direct, `(0, eval)`, `globalThis.eval`, `globalThis["eval"]`;
    - the `Function` constructor (round 3): `Function(...)`, `new Function(...)`, `globalThis.Function`.
      `Function` as a type is not flagged;
    - a `.require` / `._load` member on any owner, called or not (round 3): `module.require`,
      `process.mainModule.require`, `module.parent.require`, `module["require"]`,
      `module.constructor._load`;
    - any use of `module.constructor` (round 3).
    The repo has no uses of the round-3 forms outside comments and strings, so no allowlist entries were
    added for them.
  - Package aliases (round 3): the test reads `package.json` (read only). It fails on any dependency,
    nested `overrides` / `resolutions` included, whose value is `npm:<provider SDK>`, because
    `import "llm"` would hide an `npm:openai` alias from the scan.
  - Hosts: a full provider host in any literal, plus a provider domain fragment (`anthropic.com`,
    `openai.com`, `recraft.ai`) in a `+` chain or a template with substitutions. Plain docs links do not
    count.
  - Allowlists: every entry carries a reason, and a stale entry fails.
    - SDK:
      - `tests/platform/ai-gateway.test.ts` and `tests/platform/ai-providers.test.ts`: they build SDK
        replies and errors.
    - Hosts:
      - `lib/og/providers/{openai,recraft}.mjs`: OG pipeline, pre-WP;
      - `lib/engine/providers/openai.ts`: WP26-S2, which D11 keeps;
      - `tests/platform/ai-providers.test.ts`: it asserts the endpoints;
      - `tests/security/ai-imports.test.mjs`: its own fixtures, which hold hosts as string data.
    - Loaders:
      - `lib/og/fonts.mjs`;
      - `tests/editorial/scripts/verify-convex-bundle.mjs` (WP46) and
        `tests/sitemap/gsc-not-indexed.test.mjs`: `node:module` and `createRequire`;
      - the WP54 engine tests and harness, `scripts/engine-{compile,research}.mjs` and
        `scripts/editorial-{submit-engine,import-legacy}.mjs`: fixed-path dynamic imports;
      - `scripts/check-prompt-versions.mjs`: the module identity check.
  - Every form has a synthetic-source test.
- Deviation: the story names `tests/security/ai-imports.test.ts`. It ships as `.mjs` so the existing
  `test:security` glob runs it without a `package.json` change.
- WP70 wrapper rule (`02` §5.1): the `internalAction` wrapper must take a `promptRef` and resolve it
  through `getSpec(promptRef)`, then `routeSpec(spec)`. It must never take a spec object or a model from
  the caller.
  - Today `gateway.ts` still calls `modelForSpec` and `maxInputTokensForSpec` directly. They give the same
    answers, but they do not re-validate.
  - `gateway.ts` was not edited in S3.
- C-PROMPT contract note, for later through the `05` change rule (not changed here): `TIER_MODELS` and
  the other tier tables, plus the nested objects of a `definePromptSpec` result (`thinking`,
  `cacheLayout`), are not frozen at runtime. The registry and router freeze their own copies, and the
  `run` hash now catches a changed table value for locked prompts.
- Needs from Codex (owner of `package.json` and `.github/**`):
  1. A `"check:prompt-versions": "node --experimental-strip-types scripts/check-prompt-versions.mjs"`
     script.
  2. A CI step running it. The `test:security` glob already runs the unit tests, but only the CLI step
     runs the real base check, with its self-fetch.
  3. Optional: `fetch-depth: 0` or a `git fetch origin main` step. The script now fetches the base itself
     in CI, so this only saves one shallow fetch and is not needed for correctness.
- Checks (after round 3):
  - `npm run typecheck`: exit 0.
  - `npx tsc --noEmit -p convex`: exit 0.
  - `npm run lint`: exit 0, with 37 warnings that predate S3. The S3 files are clean.
  - `npm run test:security`: exit 0. Node: 203 tests, 202 passed, 1 skipped (the CI-only test). Vitest: 121 passed in 5 files.
  - `CI=1 GITHUB_BASE_REF=main npm run test:security`: exit 0. Node: 203 passed, 0 skipped. The CI-only test ran
    and passed on the bootstrap notice.
  - `npx vitest run tests/platform/ai-registry.test.ts`: exit 0, 30 passed.
  - `node --experimental-strip-types scripts/check-prompt-versions.mjs`: exit 0, with a notice that
    `origin/main` has no lock yet.
  - The lock is unchanged in round 3, and no spec module changed.
  - Docs updated: this entry. `wp71-stories.md` already had S3 ticked.

## 2026-11-06 - S2 follow-up: gateway action bound to the real meter (G1 blocker)

- Gap (independent G1 review): `gateway.ts` had only the injectable core; nothing bound `MeterPort` to
  WP70's `internal.ai.metering.*`, so no fixture call could write an `ai_usage` row through the real
  meter. Its header wrongly said the wrapper lands with WP70.
- Changed:
  - `convex/ai/gatewayActions.ts` (new, `"use node"`: the SDK's credential chain imports Node
    built-ins). `runPrompt` is an `internalAction` with full `args` and `returns` validators.
    - It takes a `promptRef`, inputs, the owner/project/task/debit ids and an attempt-key form
      (`job`, `chat`, `eval`). It never takes a spec or a model. `getSpec(promptRef)` resolves the spec;
      the gateway routes it.
    - `meterPortFor` binds `reserve`, `markSent`, `settle` and `fail` to `ctx.runMutation`. Each copies
      only the fields the mutation validates. `reserve` passes only this run's ids. The other three only
      touch rows this run reserved.
    - `gatewayEnv` passes only `AI_PROVIDER_MODE` and `ANTHROPIC_API_KEY` from `process.env` to the
      adapter. Fixture mode stays the default.
    - The output comes back as `outputJson`. Callers re-parse it with the spec's schema.
    - `runPromptWithMeter` is the same body with the adapter, clock and env injectable, for tests.
  - `convex/ai/gateway.ts`:
    - Review P2-1: the meter's gate codes now classify as `meter_refused`. The meter throws them bare,
      as `{ code: "AI_DISABLED" }` or `WORKSPACE_DISABLED` / `RESOURCE_NOT_FOUND`, with no `message`.
      `gatewayErrorDataOf` uses the contract's existing `isGatewayErrorData`, so no contract change was
      needed. The `meter_refused` failure now carries `GatewayErrorData`.
    - A gate refusal from `markSent` also ends `meter_refused`. That covers a kill switch flipped after
      `reserve`, a cancelled task and a refunded debit. The row is failed `billed: "none"`, charged 0,
      and nothing is sent.
    - `resolveText` now takes the model, effort, thinking, max tokens, mode and input ceiling from
      `routeSpec`, which re-validates the spec. It no longer calls `modelForSpec` or
      `maxInputTokensForSpec`. The stale "lands with WP70" comments are fixed.
  - `tests/platform/support/meterStub.ts`: the stub now runs the real meter's gate shapes in `reserve`
    (before the attempt-key lookup) and in `markSent`. Owner calls get `{ code: "AI_DISABLED" }`.
    Ownerless calls get `WORKSPACE_DISABLED` or `{ code, scope }`. It also has a `workspaceEnabled`
    option. The old stub refusal carried a `message` the real meter never sends, which hid P2-1.
  - `convex/_generated/api.d.ts`: registers `ai/gatewayActions`. Added by hand: codegen needs a
    deployment, so it was not run here.
- Tests:
  - `tests/platform/ai-gateway-action.test.ts` (new, 9 tests, convex-test, real meter, real ledger,
    `internal-registry-probe@2`):
    - G1 path. A wizard workspace business, a queued task and a credit debit (`grantStarter`, then
      `debitTask`) go through the registered action. One `ai_usage` row goes reserved → sent → settled,
      `billed: "actual"`, credit-funded, paid pool. The owner budget and the paid global counter hold
      the cost, with nothing in flight. A replay of the same attempt key returns `duplicate_attempt`,
      with no provider call and no second charge.
    - Ownerless eval path (CI graders): it settles in the free pool with no owner budget.
    - An unknown ref or a bad key form returns `config` and reserves nothing.
    - Two schema failures: one re-ask, both rows failed at their actual cost. `refundFailedTask` refunds
      once, and the second call is a duplicate. A further attempt against the refunded debit is
      refused (`RESOURCE_NOT_FOUND`) with no provider call. It is still refused with the task set back
      to running.
    - A 529 that may have billed charges the reservation, with no re-ask.
    - A refusal fails at its actual cost.
    - Kill switch on, with `AI_PROVIDER_MODE=live`, a fake key and a stubbed global `fetch`: refused, no
      fetch, no `ai_usage` row. The workspace switch off behaves the same.
    - Positive control: with the switch off, the same live setup reaches the stubbed fetch once, at the
      Anthropic base URL, and fails `auth` unbilled. No network was reached.
    - Switch flipped between `reserve` and `markSent`, on the real meter: the row fails unbilled, nothing
      is sent, and nothing is left reserved.
  - `tests/platform/ai-gateway.test.ts`: the kill-switch test now expects the real bare shape. New
    tests cover the workspace switch (`WORKSPACE_DISABLED`) and a gate closing between `reserve` and
    `markSent`.
  - A mutation check passed. With `gatewayErrorDataOf` restored to require `message`, 6 of these tests
    fail.
- Checks:
  - `npm run typecheck`: exit 0.
  - `npx tsc --noEmit -p convex`: exit 0.
  - `npm run lint`: exit 0, with 37 warnings that predate this change. The touched files are clean.
  - `npx vitest run tests/platform/ai-gateway-action.test.ts tests/platform/ai-gateway.test.ts convex/ai/metering.test.ts`:
    exit 0, 82 passed in 3 files.
  - `npm run test:security`: exit 0. Node: 203 tests, 202 passed, 1 skipped (the CI-only test). Vitest: 121 passed.
  - `npm test`: exit 0, with no timeouts.
  - `node --experimental-strip-types scripts/check-prompt-versions.mjs`: exit 0. 1 version matches the
    lock. No prompt spec was added or changed.
  - `npm run build`: not run. Nothing outside `convex/`, `tests/` and `docs/` changed.
- Docs updated: this entry, and the S2 follow-up line in `wp71-stories.md`.
- Open, not done here:
  - The registry marks `internal-registry-probe@2` `internal: true`, but the action does not refuse
    internal specs. The tests need the probe on the job path, and no crew spec exists yet. The crew
    pipeline (C-JOBS) should pick refs from a non-internal list, or the action should refuse internal
    refs outside the `eval` form once a crew spec lands.
  - Images (`runImageGateway`) have no action yet. They land with the media pipeline.
  - Message Batches (S5) still have no action. The `precompute:` key form is left out until then.
- Needs from Codex:
  1. WP70 / C-OPS: throw the meter's gate refusals as `{ code, scope?, message }`, the same shape as
     `firstReserveFailure`. Today `AI_DISABLED` from `assertSwitchOpen` / `settingsForCall` has no
     `message`, and for owner calls no `scope`. The gateway now copes, but callers that show the message
     get nothing.
  2. C-METER contract text (`05` change rule, additive): say that `reserve` and `markSent` may throw
     `WorkspaceGateErrorData` (`AI_DISABLED`, `WORKSPACE_DISABLED`, `RESOURCE_NOT_FOUND`), not only
     `MeterErrorData`. The `reserve` doc says only `ConvexError<MeterErrorData>`.
  3. WP70-S4: the `sweepStale` cron in `convex/crons.ts`. The gateway leaves a row unfinalised only
     when `settle` or `fail` throws twice, and only the sweep finalises it.
  4. Optional: a `npx convex codegen` run on a dev deployment, to regenerate `convex/_generated/api.d.ts`
     properly. The hand edit adds only `ai/gatewayActions`.
- Review fixes (independent review of `fd3d1205`):
  - Fixed:
    - P2-1, internal specs on the credit-funded path. The registered `runPrompt` now reads the
      registry entry (`getEntry`, which already exposes `internal`, so the registry needed no change).
      It refuses an internal ref with `config`, before any reserve, unless the key form is `eval` with
      no `ownerId`, `taskId` or `creditDebitId`. `runPromptWithMeter` takes a test-only
      `allowInternal` dependency, which the registered action never sets. No spec was added to the
      registry or the lock.
    - P2-2, re-ask key collision. Text runs return `nextAttempt`: the highest attempt this run reserved
      a row for, plus one. It counts a row left unfinalised and a row taken back at `markSent`. When
      nothing was reserved it is the first attempt. `gatewayRunResultValidator` has the new field. The
      meter's "attemptKey reused for a different call" (`METER_ATTEMPT_KEY_REUSED`, matched as a
      substring because `runMutation` can wrap it) now maps to `duplicate_attempt` with no `usageId`
      (now optional), not `internal`. The meter stub throws the same `Error` for a known key reached
      by a different call.
    - P3-1, replay after a terminal task. The action header tells C-JOBS that such a replay is
      `meter_refused` (`RESOURCE_NOT_FOUND`), not deduped, and must not trigger a refund on its own.
    - P3-3, SDK env in live mode. `defaultAnthropicClientFactory` sets `webhookKey: null`,
      `logLevel: "off"`, a silent logger and `openTelemetry: { propagation: false, traces: false }`.
      SDK 1.5.0 then reads none of `ANTHROPIC_WEBHOOK_SIGNING_KEY`, `ANTHROPIC_LOG` or
      `ANTHROPIC_OPEN_TELEMETRY*`. It still reads `ANTHROPIC_CUSTOM_HEADERS`, and no option turns that
      off: `defaultHeaders` is merged over it, so env-only names survive. A `stripUnlistedHeaders`
      middleware drops every header outside the SDK's own set and the key. `gatewayEnv`'s doc now
      says this.
    - P3-4, key forms tied to ownership. `eval` with an `ownerId`, `projectId`, `taskId` or
      `creditDebitId` is refused with `config`. `projectId` was added to the reviewer's list, because
      `eval` is ownerless. `job` without both `ownerId` and `taskId` is refused, as is an `attempt`
      that is not a positive integer.
  - Tests added:
    - `ai-gateway-action.test.ts`, now 16 tests. The job-path tests now call `runPromptWithMeter`
      with `allowInternal`. New tests:
      - the registered action refuses the probe on the job and chat paths, with zero reserves and
        untouched budgets;
      - the registered action runs the probe on the ownerless eval path;
      - an eval key with each of the four ids is refused;
      - a job key without its task or owner, and attempt 0, are refused;
      - a run on attempt 1 that re-asks returns `nextAttempt: 3`. A retry on 2 is `duplicate_attempt`
        with no `usageId` and no provider call. A retry on 3 settles;
      - a replay after the task `succeeded` is `meter_refused`, with no send, no new row and no refund;
      - the live SDK client, with the env set, ignores `ANTHROPIC_LOG`, `ANTHROPIC_BASE_URL` and the
        OpenTelemetry vars. It strips the custom headers (`x-injected`, `anthropic-beta`,
        `traceparent`) and never writes to `console`. Fetch is stubbed, so nothing reaches the network.
    - `ai-gateway.test.ts`, 5 new tests:
      - a reused key is a duplicate without a `usageId`, and the retry on `nextAttempt` runs;
      - any other plain reserve error still ends `internal`;
      - an unfinalised re-ask row counts in `nextAttempt`;
      - a row taken back at `markSent` counts too;
      - `nextAttempt` is the first attempt when nothing was reserved.
  - Checks:
    - `npm run typecheck`: exit 0.
    - `npx tsc --noEmit -p convex`: exit 0.
    - `npm run lint`: exit 0, 0 errors, and the same 37 warnings that predate this change. None are in
      the touched files.
    - `npx vitest run tests/platform/ai-gateway-action.test.ts tests/platform/ai-gateway.test.ts convex/ai/metering.test.ts`:
      exit 0, 94 passed in 3 files.
    - `npm run test:security`: exit 0. Node: 203 tests, 202 passed, 1 skipped. Vitest: 121 passed.
    - `npm test`: exit 0, with no timeouts.
    - `node --no-warnings --experimental-strip-types scripts/check-prompt-versions.mjs`: exit 0.
      1 version matches the lock.
  - Still open:
    - WP70-S4: the `sweepStale` cron (Codex), for rows left unfinalised.
    - Codex: send a `message` (and `scope`) with the gate errors (item 1 above).
    - Real codegen of `convex/_generated/api.d.ts`. An isolated anonymous local Convex deploy (ports
      3340/3341) succeeded on `fd3d1205`, with all functions ready. The checked-in file is still the
      hand edit.
    - A `chat` key with no `ownerId` is not refused yet. The reviewer did not raise it.

