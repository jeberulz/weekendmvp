# WP71 Stories - AI gateway, prompt registry and evals harness

Branch: `claude/wp71-ai-gateway`
Lane: Work Package (Claude lane, high), inside the WP67 Program/Migration lane
Registry: `docs/PROJECT_STRATEGY.md` (Launch Workspace Program, WP71)
Plan: `docs/plans/launch-workspace/04-build-plan.md` (WP71), `02-architecture.md` §5,
`03-ai-cost-model.md`; contracts C-PROMPT, C-METER, C-ART, C-JOBS in `lib/workspace/contracts/`
Owns: `convex/ai/{gateway,router,registry,pricing}.ts`, `convex/ai/providers/**`, `convex/ai/prompts/**`,
`convex/crew/seeds.ts`, `evals/crew/**`, `scripts/check-prompt-versions.mjs`, `scripts/crew-seeds.mjs`,
`tests/security/ai-imports.test.*`. Not owned: `convex/ai/metering.ts`, `convex/ai/budgets.ts` (Codex, WP70).
Definition of done (`04` WP71 acceptance): a fixture-mode gateway call writes a settled `ai_usage` row through
Codex's metering; CI graders run; no live call is possible with the kill switch on.

Standing rules:
- Ship dormant.
- Fixture mode is the default, and tests never call a live API.
- Provider SDKs are imported only in `convex/ai/providers/`.
- Live spend needs the owner's OK.
- Until WP70 merges, C-METER is a stub behind the contract's signatures.

## Stories

- [x] `WP71-S1` - Provider adapters
  - Scope: `convex/ai/providers/{anthropic,openaiImages,recraft,types,fixtures}.ts`, `convex/ai/pricing.ts`, tests
  - Acceptance criteria:
    - Each adapter has injectable `fetch` (or an injectable SDK client for Anthropic), an `AbortSignal`
      timeout, and returns a `ProviderCost` result (`billedAs`, `estimated`, `units`), modelled on
      `lib/engine/providers/*`.
    - `AI_PROVIDER_MODE` is `fixture` unless set to `live`; fixture mode needs no key and makes no network
      call.
    - The rate cards are dated and give integer micro-USD (rounded up). When the provider returns no
      usage, a conservative fallback is used.
    - The Anthropic adapter sets effort and thinking explicitly, sends structured output via
      `output_config.format` from the spec's JSON Schema, and reports cache read/write tokens and the stop
      reason (refusal is surfaced).
  - Verification: vitest on the adapters with a fake fetch/client; `npm run typecheck`

- [ ] `WP71-S2` - Gateway action (D23 ruled 2026-11-05: single calls, no tool loops)
  - Scope: `convex/ai/gateway.ts`, a C-METER stub, tests
  - Acceptance criteria:
    - The `02` §5.1 flow runs in order: spec, reserve, call, validate, settle.
    - One re-ask on schema failure, with its own reservation.
    - A refusal settles as failed.
    - When the provider may have billed, the worst case is charged.
    - No tool loop (D23).
    - A settle above the reservation is recorded at the true cost and flagged as an overrun (for example
      gpt-image-2 output tokens above the table price), so a rate-card drift is visible.
  - Verification: a fixture-mode end-to-end test, reserve → settle and reserve → fail

- [ ] `WP71-S3` - Router, registry, prompt-version CI, import boundary
  - Scope: `convex/ai/{router,registry}.ts`, `convex/ai/prompts/**`, `scripts/check-prompt-versions.mjs`,
    `tests/security/ai-imports.test.ts`
  - Acceptance criteria:
    - The tier comes from the spec.
    - The registry maps `id@version` to a spec.
    - The CI script fails on a text or schema change with no version bump.
    - The security test fails if a provider SDK is imported outside `convex/ai/providers`.

- [ ] `WP71-S4` - Cache layout helper
  - Acceptance criteria:
    - The system, business and task blocks carry breakpoints (`02` §5.4).
    - A manual live test proves the second call reads the cache. It is run only with the owner's OK.

- [ ] `WP71-S5` - Seed precompute
  - Scope: `convex/crew/seeds.ts`, `scripts/crew-seeds.mjs`
  - Acceptance criteria:
    - The Batch API writes `idea_crew_seeds`.
    - The fixture run passes.
    - The live run (5 spike ideas, then the library, ≈ $15) needs the owner's OK.

- [ ] `WP71-S6` - Eval harness
  - Scope: `evals/crew/**`
  - Acceptance criteria:
    - The deterministic graders run in CI in fixture mode (`02` §5.7).
    - The live judge runner has a spend cap.
    - Results are written to files.
