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
- [ ] `WP41-S3` - Layer 1 claim extraction + Layer 2 source verification with an on-disk URL cache
- [ ] `WP41-S4` - Layer 3 judge panel (3 model families via OpenRouter), rubric, median aggregation, disagreement flag
- [ ] `WP41-S5` - Gold set (3 reference pages + seeded bad copies) and `evals:calibrate`
- [ ] `WP41-S6` - Weekly scheduled sweep (cached, link liveness), baseline report PR, publish-idea skill uses the full gate

## Out Of Scope

- Fixing the existing failing pages (that is backlog work driven by the report).
- Storing eval results in Convex or an admin dashboard.
- Perplexity-backed verification of unsourced claims (future opt-in `--deep`).

## Notes

- Gate policy, judge provider, and budget are recorded in `docs/wp/RULINGS.md` (2026-09-24 rows).
- A page that is edited must pass the gate even if its failures predate the edit. Touching a page means fixing it.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
