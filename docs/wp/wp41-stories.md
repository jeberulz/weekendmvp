# WP41 Stories - Content quality evals engine for idea pages

Branch: `claude/tender-carson-s0bvo8` (session-assigned branch; overrides the `codex/` prefix for this WP)
Lane: Work Package
Registry: Weekend MVP idea corpus (`content/ideas/*.mdx`)
Definition of done: every new or edited idea page is scored by a layered quality gate (deterministic checks → claim extraction → source verification → multi-model judge panel) that blocks bad pages in CI, and a weekly sweep reports a ranked fix backlog for the existing corpus, for under $10 per full sweep.

## Stories

- [x] `WP41-S1` - Layer 0 deterministic quality checks + CI gate
  - Scope: `scripts/lib/quality/*.mjs`, `scripts/evals-run.mjs`, `evals/config.json`, `evals/slop-lexicon.json`, `evals/results/`, `tests/evals/`, `package.json`, `.github/workflows/ci.yml`, `ideas/SECTIONS.md`, `.claude/skills/publish-idea/SKILL.md`, `CLAUDE.md`
  - Acceptance criteria:
    - Checks run with no network and no API key: structure (reuses `scripts/audit-idea-mdx.mjs`), banned slop phrases + slop density, verbosity (sentence length, long-sentence share, filler, repeated sentences, word ceiling), unsourced and hedged numeric claims in the factual sections, source hygiene (distinct domains, duplicates, placeholder hosts, homepage-only links, Ideabrowser share), placeholder / LLM-leakage text, cross-page near-duplication.
    - Thresholds live in `evals/config.json` and `evals/slop-lexicon.json`, not in code.
    - `npm run evals:run -- --slug {slug}` exits 1 on any `fail`.
    - `npm run evals:changed` checks only idea MDX added or modified vs a base ref and exits 1 on any `fail`.
    - `npm run evals:run -- --all --report` writes `evals/results/latest.json` + `evals/results/report.md` (ranked backlog) and exits 0 (report-only for the existing corpus).
    - CI runs the changed-page gate on every PR and push to `main`.
    - Unit tests cover every check and the verdict logic.
  - Verification:
    - `npm run test:evals`
    - `npm run evals:run -- --slug phone-neck-score-app`
    - `npm run evals:run -- --all --report`
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`

- [x] `WP41-S2` - OpenRouter provider + fixture mode + hard cost cap (`EVALS_MAX_USD`, default 10)
  - Scope: `lib/evals/` (`errors.ts`, `budget.ts`, `llm.ts`, `providers/openrouter.ts`, `providers/fixtures.ts`, tests), `scripts/evals-ping.mjs`, `package.json`, `.env.example`, `evals/config.json` (`llm` section), `CLAUDE.md`
  - Acceptance criteria:
    - Raw `fetch` adapter for OpenRouter chat completions (no SDK), matching `lib/engine/providers/openai.ts`: injectable transport, key read at call time, fails closed on a missing key, bad status, or empty reply.
    - Prices come from OpenRouter's live model list at run time, never from a hard-coded rate card. A model that is missing or has no fixed price fails closed before any spend.
    - Every call reserves its worst-case cost before it is sent. A call that would push spend plus open reservations over the cap is refused without a request. Settlement uses OpenRouter's reported `usage.cost`, else a token estimate. A call whose outcome is unknown (network error, timeout) is charged at worst case.
    - `EVALS_MAX_USD` may lower the cap but not raise it above the $10 ruling. Invalid values fail closed.
    - Fixture mode needs no key and no network, and runs the real adapter and budget code.
    - `npm run evals:ping -- --fixture` works in CI with no key. `npm run evals:ping -- --live --list <filter>` lists OpenRouter models with prices for choosing judges. `--live` pings pinned or named models and prints the spend.
  - Verification:
    - `npm run test:evals`
    - `npm run evals:ping -- --fixture`
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- [x] `WP41-S3` - Layer 1 claim extraction + Layer 2 source verification with an on-disk URL cache
  - Scope: `lib/evals/` (`claims.ts`, `verify.ts`, `fetch-source.ts`, `cache.ts`, `text.ts`, `layers.ts`, `fixture-replies.ts`, `llm.ts` retry helper, tests), `scripts/evals-run.mjs`, `scripts/lib/quality/report.mjs`, `evals/config.json`, `.gitignore`, `package.json`, docs
  - Acceptance criteria:
    - Layer 1: one call per page lists factual claims with verbatim quotes and the numbered sources that back them. Quotes not found verbatim in the page are dropped and counted.
    - Layer 2: each cited source is fetched once (text only, gitignored cache), and one call per (page, source) checks the claims mapped to it against the nearest excerpts. `supported` and `contradicted` need evidence found verbatim in the source, or they become `not_found`.
    - Findings: fail `claims.contradicted`; warn `claims.unsupported`, `sources.unreachable`, `claims.error`.
    - Unchanged pages re-run from cache for $0. `--estimate` prints the worst case before any spend. CI stays Layer 0.
    - `--fixture` runs the full pipeline with no key and no network.
    - Live: extractor and verifier models picked from live prices, tested on the 3 reference pages plus `phone-neck-score-app`, pinned in `evals/config.json`, recorded in RULINGS.
  - Verification:
    - `npm run test:evals`, `npm run evals:run -- --slug phone-neck-score-app --layers 2 --fixture`
    - Live run on 4 pages, a repeat run at $0, `--estimate --all` ≤ $3
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- [x] `WP41-S4` - Layer 3 judge panel (3 model families via OpenRouter), rubric, median aggregation, disagreement flag
  - Scope: `lib/evals/rubric.ts`, `lib/evals/judges.ts`, `evals/rubric.md`, `lib/evals/providers/openrouter.ts` (supported-parameter filtering, reasoning effort), `lib/evals/llm.ts`, `lib/evals/fixture-replies.ts`, `scripts/evals-run.mjs`, `scripts/evals-ping.mjs`, `scripts/lib/quality/report.mjs`, `evals/config.json`, tests, docs
  - Acceptance criteria:
    - Three judges from different families score six anchored dimensions (specificity, slop, verbosity, fake_data, consistency, actionability). A score of 3 or lower needs a verbatim page quote or it is discarded.
    - Page score per dimension is the median of valid scores. Fail at 2 or below, warn at 3, flag a spread of 2 or more for human review, warn when fewer than 2 judges scored.
    - One failing judge does not stop the panel. Judgements cache on page text + rubric version + model + reasoning.
    - `--layers 3` runs Layers 1-3; `--estimate` includes judges; the report gains a judge-score table.
    - Live: reference pages score 3 or higher on every dimension; a seeded bad page fails.
  - Verification:
    - `npm run test:evals`, fixture and live runs on the 3 reference pages plus `phone-neck-score-app`, seeded bad page
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- [x] `WP41-S5` - Gold set (3 reference pages + seeded bad copies) and `evals:calibrate`
  - Scope: `evals/gold/` (manifest + 7 seeded pages), `lib/evals/calibrate.ts` + tests, `scripts/evals-calibrate.mjs`, `evals/results/calibration.md`, rubric (`rubric-v2`), `package.json`, docs
  - Acceptance criteria:
    - Gold set: 5 good published pages (the 3 SECTIONS.md reference pages, `phone-neck-score-app`, `contractor-ai-receptionist`) and 7 seeded bad copies of `ai-code-reviewer`, one per judge dimension plus one Layer 0 page.
    - `npm run evals:calibrate -- --live` runs Layer 0 and the judges on every gold page and passes only when at least 90% of bad pages fail with their expected checks and no good page fails. Per-judge target hits, good-page alarms, discarded scores and distance from the median are reported.
    - Live run passes; `evals/results/calibration.md` committed as the baseline.
  - Verification:
    - `npm run test:evals`, `npm run evals:calibrate -- --fixture`, `npm run evals:calibrate -- --live --report`
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- [ ] `WP41-S6` - Weekly scheduled sweep (cached, link liveness), baseline report PR, publish-idea skill uses the full gate

## Out Of Scope

- Fixing the existing failing pages (that is backlog work driven by the report).
- Storing eval results in Convex or an admin dashboard.
- Perplexity-backed verification of unsourced claims (future opt-in `--deep`).

## Notes

- Gate policy, judge provider, and budget are recorded in `docs/wp/RULINGS.md` (2026-09-24 rows).
- A page that is edited must pass the gate even if its failures predate the edit. Touching a page means fixing it.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
