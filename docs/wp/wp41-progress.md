# WP41 Progress - Content quality evals engine for idea pages

Append-only progress log. Do not rely on chat history for project state.

## 2026-09-24 - Setup

- Branch/worktree: `claude/tender-carson-s0bvo8` (no worktree)
- Assignment: build a layered content-quality gate for the 225 idea pages. S1 = Layer 0 deterministic checks + CI gate.
- File boundaries (S1): `scripts/lib/quality/`, `scripts/evals-run.mjs`, `evals/`, `tests/evals/`, `package.json`, `.github/workflows/ci.yml`, `ideas/SECTIONS.md`, `.claude/skills/publish-idea/SKILL.md`, `CLAUDE.md`, `docs/wp/RULINGS.md`, this WP's docs.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Initial risks:
  - The factual sections cite sources only in the trailing `## Sources` list, not inline. An "unsourced number" check that blocks would fail most pages, reference pages included. So it warns instead of failing.
  - 31 pages already fail the structural auditor. The gate must block only new or edited pages, or CI goes red on day one.
  - Heuristic checks give false positives. Every threshold was set from corpus percentiles, not guessed.

## 2026-09-24 - Corpus baseline for thresholds (225 pages)

Measured before writing checks (headings and code excluded from prose):

| Metric | p50 | p90 | max |
|---|---|---|---|
| Watch-list slop words per 1k words | 0.00 | 1.22 | 3.09 |
| Banned slop phrases per page | 0 | 0 | 1 (2 pages) |
| Avg sentence length (words) | 15.5 | 23.4 | 28.4 |
| Share of sentences over 35 words | 3% | 18% | 29% |
| Filler words per 1k | 1.4 | 3.0 | 5.0 |
| Numeric claims in Problem/Market/Competitive | 24 | 40 | 80 |
| Share of those with no inline link or named source | 32% | 71% | 100% |
| Largest 8-gram overlap with any single other page | 0.1% | 0.4% | 1.6% |

Takeaways: the corpus is light on stock AI phrasing and has no copied pages. The real weakness is numbers with no source nearby. Reference page `ai-landing-page-generator-ecommerce` scored 21 of 21 on this first rough measure (14 of 21 under the final check), which is why that check warns rather than fails.

## 2026-09-24 - WP41-S1 Layer 0 checks + CI gate

- Actions taken:
  - `scripts/lib/quality/`: `parse`, `lexicon` (banned phrases, watch density, filler), `verbosity`, `numbers` (claims classed linked / named / listed / unsourced, plus hedge markers), `sources`, `integrity` (placeholders, model chatter), `dupes` (8-word shingle index), `verdict` (findings → pass / warn / fail), `report` (ranked backlog).
  - `scripts/evals-run.mjs` with `--slug`, `--changed [--base]`, `--all [--report] [--strict]`, `--json`. Only `--all` is report-only.
  - `scripts/audit-idea-mdx.mjs`: extracted `auditIdeaSource(raw, slug)` so the verdict can audit a string. `auditIdeaFile` behaviour unchanged (194/225 before and after).
  - `evals/config.json` + `evals/slop-lexicon.json` hold every threshold and phrase.
  - `tests/evals/quality.test.mjs`: 18 tests, wired as `npm run test:evals` inside `npm test`.
  - CI: checkout `fetch-depth: 2`, new step `npm run evals:changed -- --base HEAD^1`.
  - Docs: publish-idea skill Step 7 (removed the stale "no audit script" line), `ideas/SECTIONS.md` Enforcement, `CLAUDE.md`, three RULINGS rows.
  - Baseline: `evals/results/report.md` committed. `evals/results/latest.json` is gitignored (290 KB, regenerated each run).
- Decisions made:
  - `numbers.unsourced` warns, never fails: reference page `ai-landing-page-generator-ecommerce` has 14 unsourced numbers, and the page contract cites in a trailing Sources list, not inline. Layer 2 will verify.
  - Site-relative links in `## Sources` are cross-links, not citations, and are skipped (one page links `/ideas/...`).
  - Placeholder and slop checks skip fenced code, so build prompts may still say `TODO` or `[your product]`.
- Checks run:
  - `npm run typecheck` pass; `npm run lint` 0 errors (35 pre-existing warnings in other files; new files clean); `npm test` pass (incl. 18 new); `npm run build` pass; `git diff --check` clean.
  - Gate simulation: an edit adding "delve" and "Pricing is TBD" to `phone-neck-score-app` → FAIL, exit 1. A new page copied from another → FAIL on duplication, exit 1. The WP40 publish batch (`--base 2449200^1`) → 0 fail, 4 warn, 7 pass.
- Result: baseline on 225 pages is 31 fail (all structural debt), 112 warn, 82 pass. Top warnings: unsourced numbers (98 pages), long sentences (29 + 24), homepage-only sources (11), slop density (6).
- Gotchas:
  - `--changed` diffs the working tree, so uncommitted and untracked pages count locally. In CI the tree equals HEAD.
  - On a push to `main` with several commits, only the last commit's pages are checked. PRs are the real gate.
- Next: `WP41-S2` OpenRouter provider, fixture mode, `EVALS_MAX_USD` cap. Needs `OPENROUTER_API_KEY`.

## 2026-09-24 - WP41-S2 OpenRouter provider, fixture mode, hard cost cap

- Actions taken:
  - `lib/evals/errors.ts`: `EvalConfigError`, `EvalCallError` (with `billing`: none / billed / unknown), `BudgetExceededError`. Separate from the engine's frozen provider-role types.
  - `lib/evals/budget.ts`: micro-dollar budget. Reserve worst case before a call, refuse if spent + open reservations would cross the cap, settle to the actual charge, release unbilled calls. `readCapUsd`: `EVALS_MAX_USD` may lower the cap, never raise it past the $10 ruling.
  - `lib/evals/providers/openrouter.ts`: raw-`fetch` adapter, key read at call time, `temperature` 0 by default, JSON mode with `provider.require_parameters`, 120 s timeout, status mapping (401/402/400/404 not retryable; 408/429/5xx retryable), empty reply fails closed. Prices come from the live `GET /models` list; variable-priced routers are rejected.
  - `lib/evals/providers/fixtures.ts`: fetch-shaped fixture for `/models` and `/chat/completions`.
  - `lib/evals/llm.ts`: the only path Layers 1-3 will use. Price lookup (once per run) → reserve → call → settle → ledger entry, including for failures. JSON replies are parsed, and a non-JSON reply fails after being charged.
  - `scripts/evals-ping.mjs` (`npm run evals:ping`): `--fixture`, `--live [--models]`, `--live --list [filter]`.
  - `evals/config.json` `llm` section (`judges: []` until S4), `.env.example`, `CLAUDE.md`, `test:evals` now also runs `vitest run lib/evals`.
- Decisions made:
  - No hard-coded rate card. The engine pins prices in `pricing.ts`, but the judges are not chosen yet and OpenRouter prices move. Reading `/models` at run time means a stale price can never under-reserve.
  - A call with an unknown outcome (network error, timeout, unreadable 200) is charged at worst case. A call rejected with an error status is charged $0. OpenRouter's reported `usage.cost` wins over the token estimate.
  - Worst-case input tokens use 3 characters per token plus 16 per message, which over-reserves. If a provider still reports more than the reservation, the real figure is recorded and the next reservation sees it.
- Checks run: `npm run typecheck` pass; `npm run lint` 0 errors; `npm test` pass (34 new vitest cases); `npm run build` pass; `git diff --check` clean. `npm run evals:ping -- --fixture` → 3 OK, $0.000048. `--live` with no pinned judges exits 2 with guidance. `EVALS_MAX_USD=50` refused.
- Gotchas:
  - This cloud container's network policy denies `openrouter.ai` (proxy 403), so live mode could not be exercised here. It failed closed as designed: "OpenRouter model list returned 403", $0 spent. Live verification needs `openrouter.ai` allowed and `OPENROUTER_API_KEY` set.
  - Judge model IDs are not pinned. Pick them with `npm run evals:ping -- --live --list <filter>` and record a RULINGS row at S4.
- Next: `WP41-S3` claim extraction + source verification.
