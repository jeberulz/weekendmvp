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
