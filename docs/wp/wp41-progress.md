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

## 2026-09-27 - WP41-S3 Layers 1-2 (built in fixture mode; live pick pending)

- Actions taken:
  - `lib/evals/claims.ts`: extraction prompt (factual sections + numbered Sources), JSON validation, verbatim-quote guard, 25-claim cap, cache.
  - `lib/evals/fetch-source.ts`: fetch with UA, 15 s timeout, 2 MB cap, cheerio text extraction (nav, header, footer, scripts dropped), `ok` / `http_error` / `unreadable` / `network_error`. Near-empty pages (script-rendered, bot walls) count as unreadable. Transient failures are not cached.
  - `lib/evals/verify.ts`: 600-char windows scored by shared figures and content words, top 3 per claim, 6k chars per call. No matching passage means `not_found` with no call. Evidence guard downgrades invented support or contradictions. Output allowance sized to the batch (150 + 120 per claim, capped at 1,500).
  - `lib/evals/layers.ts`: orchestration, busiest sources first up to 8 verify calls per page, per-claim combination (supported > contradicted > not_found > unverifiable), findings, per-page cost from the ledger, `estimatePageWorstCaseUsd`.
  - `lib/evals/cache.ts` (sha256, TTL, atomic writes), `lib/evals/text.ts` (normalisation shared by both guards), `lib/evals/fixture-replies.ts`, `callWithRetry` (one retry, never for budget or config errors).
  - `scripts/evals-run.mjs`: `--layers 1|2`, `--fixture|--live` (required above layer 0), `--estimate`, page concurrency 4, an incomplete layer run exits 1 on gating runs. Fixture runs use a memory cache so fixture source text never reaches a live run.
  - `evals/config.json`: `llm.extractor`, `llm.verifier` (null until the live pick) and a `claims` section. `evals/cache/` gitignored. `evals:run` and `evals:changed` now run with `--experimental-strip-types` so the TS layers can load; Layer 0 still imports no TS.
- Decisions made:
  - Not found is a warning, contradicted is a failure. Excerpts are a sample, and a figure may sit in a table the extraction missed. A contradiction carries quoted evidence.
  - A claim checked against several sources takes the best result: one supporting source outweighs a contradicting one.
  - Unreachable sources warn, not fail: many sites block bots.
- Checks run: `npm run typecheck` pass; `npm run lint` 0 errors; `npm test` pass (20 new vitest cases, 54 in `lib/evals`); `npm run build` pass; `git diff --check` clean. Fixture run on `phone-neck-score-app`: 5 claims, 1 source read, $0.0015 fixture spend. Fixture layer 1 across all 225 pages: 225 calls, 0 failures.
- Cost: `--estimate --all --layers 2` at fixture prices ($0.50 / $1.50 per 1M) is $5.60 worst case for all 225 pages, $0.025 per page. The ≤ $3 target needs a model near $0.25 per 1M input or less. Real runs cost less (outputs are shorter than the allowance), and warm runs cost $0.
- Gotchas:
  - This container still has no `OPENROUTER_API_KEY` and blocks outbound HTTPS. Source sites (e.g. grandviewresearch.com) are blocked too, not only openrouter.ai, so Layer 2 needs a broad network policy, not one allowed domain.
- Next: once the environment has the key and network access, pick and pin the extractor and verifier models, run the 4-page live check, record RULINGS, tick S3.

## 2026-09-27 - WP41-S3 live finish and WP41-S4 judge panel

- Environment: this session has `OPENROUTER_API_KEY` and outbound HTTPS. The account balance was briefly negative ($40.20 used of $40), then topped up to $49.80; live work resumed after that.
- S3 live:
  - `gpt-4.1-nano` trial: 47% of extracted quotes failed the verbatim guard. Switched to `gpt-4.1-mini` (the planned fallback): 18% after prompt tightening (`extract-v2`: one unbroken span, competitor name in `value`), mostly stitched competitor bullets. Dropped claims do not affect page status.
  - Guard fixes found live: leading and trailing punctuation is ignored (models close a clause with "."), and an ellipsis counts as elision when the parts sit in order within 400 characters.
  - Caches now hold the raw model reply, not the validated result, so guard fixes re-apply to cached replies for $0.
  - Mini called rounding and date-range differences "contradicted". Added a confirmer (`gemini-3.8-flash`): a contradiction stands only if the confirmer repeats it with verbatim evidence.
  - Real finding: `ai-landing-page-generator-ecommerce` (a reference page) cites "$715.5M → $2.7B ... 2025 to 2035, 14.3% CAGR" to Future Market Insights. The source now says $0.8B (2026) → $3.1B (2036), 14.3% for 2026-2036. Both verifier and confirmer flag it: the page is stale.
  - Also found: the page says CodeRabbit Pro is $15/dev/mo; CodeRabbit's pricing page shows $30 (the confirmer then did not repeat that one).
- S4:
  - `lib/evals/rubric.ts` + `evals/rubric.md` (`rubric-v1`), `lib/evals/judges.ts` (prompt, evidence guard, median, spread, findings, per-judge cache, estimate), fixture judge, runner `--layers 3`, report judge table.
  - Adapter fix found live: `gpt-5.6-luna` rejected the request because we always sent `temperature` and required every parameter. The client now sends only parameters the model list says the model accepts (temperature, JSON mode, reasoning effort) and still parses JSON from the reply.
- Measured live cost (4 pages: 3 reference + `phone-neck-score-app`): Layers 1-2 about $0.003 per page, judges about $0.010 per page. Projected cold full sweep of Layers 1-3: about $3. Repeat runs on unchanged pages: $0.
- Worst-case estimates (`--estimate --all`): Layers 1-2 $6.40, Layers 1-3 $12.15. Every call is reserved at its full output allowance, so these run far above real cost. The cap is per call, so a real sweep completes; the estimate message now says so. Allowances trimmed: 20 claims per page, extract 2,500 tokens, 6 verify calls per page, confirmer 1,000.
- Live judge results (median per dimension): `ai-rfp-response-assistant` fake_data 3 (warn), consistency spread 3 (review); `ai-code-reviewer` all 4-5; `ai-landing-page-generator-ecommerce` fake_data 3 with spread 2; `phone-neck-score-app` all 4-5. Seeded bad page (temporary, deleted): FAIL on Layer 0 (5 banned phrases, slop density, 88% duplication) and judges (slop 2, verbosity 2, fake_data 1, naming the invented "87.3%", "$4.2 trillion" and the fake testimonial).
- Checks run: `npm run typecheck` pass; `npm run lint` 0 errors (35 pre-existing warnings); `npm test` pass (73 vitest cases in `lib/evals`, 19 node tests); `npm run build` pass; `git diff --check` clean.
- Live spend this session: about $0.08.
- Next: `WP41-S5` gold set and calibration, then `WP41-S6` weekly sweep.

## 2026-09-27 - WP41-S5 gold set and calibration

- Actions taken:
  - `evals/gold/manifest.json`: 5 good published pages and 7 seeded bad copies of `ai-code-reviewer` in `evals/gold/pages/`. Each bad page breaks one thing and keeps the structure valid: slop (stock AI voice, no banned phrases, so only the judges can catch it), fake data (invented precise figures, fake testimonial), verbosity (six restating paragraphs), inconsistency (Pro price differs across sections, wrong MRR and margin math), vague (no names or numbers in Problem, Market, Competitive), not actionable (no steps, stack or business model), and a Layer 0 page (TBD price, `[insert ...]`, banned phrase).
  - `lib/evals/calibrate.ts` (scoring + report) with tests, `scripts/evals-calibrate.mjs` (`npm run evals:calibrate -- --fixture|--live [--report] [--json]`). Runs Layer 0 without the duplication index (seeded pages are copies by design) and the judge panel. Claim checks are excluded: they depend on live sources, not the rubric.
- First live run: 6/7 caught (86%), 0/5 false fails. The miss was `bad-vague`: specificity median 3. The judges followed the rubric, whose 3 anchor described exactly that page ("market, business model stay vague"). The page contract (`ideas/SECTIONS.md`) requires named competitors with pricing and cited market figures, so the rubric was wrong, not the judges.
- Decision: `rubric-v2` adds a specificity 2 anchor ("Competitive Landscape names no real competitors or prices, or Market Research gives no real figures, even if other sections are concrete") and moves 3 to "real competitors and figures, some sections generic". Recorded in `evals/rubric.md`.
- Second live run: **PASS**, 7/7 caught, 0/5 false fails, $0.12. Judges: Gemini 3.8 Flash 6/6 target hits, GPT-5.6 Luna 5/6, Claude Haiku 4.5 4/6 with 3 low scores discarded for missing verbatim quotes. No judge scored a good page at the fail threshold. The panel median carried the weaker judges, which is the reason for a three-model panel.
- Limitation: one calibration run per rubric version. Repeat runs hit the cache ($0) and return the same scores, so they do not measure run-to-run variance. A variance check needs a cache bypass and costs about $0.12 per run.
- Checks run: `npm run typecheck` pass; `npm run lint` 0 errors (35 pre-existing warnings); `npm test` pass (78 vitest cases in `lib/evals`); `npm run build` pass; `git diff --check` clean.
- Rule going forward: change a threshold, the rubric, a prompt or a judge model only if `npm run evals:calibrate -- --live` still passes, and commit the new `evals/results/calibration.md`.
- Next: `WP41-S6` weekly sweep.

## 2026-10-01 - WP41-S6 weekly sweep, PR gate, first full baseline

- Actions taken:
  - `.github/workflows/content-evals-weekly.yml`: Mondays 06:00 UTC + manual (`layers` 0/2/3). Restores and saves `evals/cache`, sweeps every page with `--layers 3 --live --check-links`, opens or updates one PR from `evals/weekly-report` with `evals/results/report.md`. Report-only. Falls back to Layer 0 + links without the secret.
  - `ci.yml` job `content-evals`: on PRs that change idea pages, `npm run evals:changed -- --base HEAD^1 --layers 3 --live`; skips with a notice without the secret.
  - `lib/evals/links.ts` + `--check-links`: every Sources link once per run (8 concurrent, 3 per host, one retry for network blips). dead = 404/410/unreachable; blocked = 401/403/429; error = other. `sources.dead` warns.
  - Report: run line (spend, calls, failed calls, incomplete pages, link totals), claim totals table. `latest.json` stores the run metadata.
  - publish-idea skill Step 7 now requires `--layers 3 --live --check-links`; `ideas/SECTIONS.md`, `CLAUDE.md`, RULINGS updated.
- First full live sweep (verify-v1): 1,519 model calls, $3.33, 0 incomplete pages. 57 contradicted claims on 46 pages.
- Finding from the sweep: a spot check of 8 contradictions found 3 false (same figure over a shifted forecast period; values within rounding). Fix `verify-v2`: contradicted needs the same metric, definition and period with a value more than ~5% off; a newer edition or another period is the new `outdated` verdict, which warns (`claims.outdated`) and never fails. A confirmer that sees a different period also turns a contradiction into `outdated`.
- Second sweep (verify-v2; extraction, judges and links from cache): 611 calls, $0.35. Contradictions 27 on 23 pages, outdated 31. Spot check of 10: 8 clearly real (CodeRabbit Pro now $30 on two pages; AI companion market $600M not $18.35B; dance-tech CAGR 12.4% not 20%; $148B not $285B by 2032; no-code market $32-50B not $65B), 1 borderline (forecast end year), 1 false ($294.7B vs $292.71B, within rounding; both models still called it). Precision about 80-90%.
- Warm re-run: 65 seconds, 6 calls (retries of earlier judge failures), $0.03.
- Total live spend this step: about $3.70.
- Baseline (committed `evals/results/report.md`): 59 fail, 166 warn, 0 pass.
  - Fails: structure 31 (unchanged debt), claims.contradicted 23 pages, judges 7 pages (`fake_data` 5, `specificity` 3, `consistency` 1).
  - Top warnings: judges.disagree 189, claims.unsupported 182, numbers.unsourced 98, judges.fake_data (median 3) 78, sources.unreachable 66, sources.dead 61 (78 dead links of 1,563; 290 more bot-walled), claims.outdated 29.
  - Corpus judge medians: specificity 5, slop 5, verbosity 4, fake_data 4, consistency 5, actionability 5. The writing is not the problem; the data is.
  - No page passes outright: almost every page carries at least one warning, mostly unsourced claims.
- Known limits and follow-ups:
  - `judges.disagree` fires on 189 pages, too noisy to act on. Candidate: raise `disagreeSpread` to 3, but only through `npm run evals:calibrate -- --live`.
  - A within-rounding contradiction can still slip through. A deterministic numeric tolerance check on contradicted claims would close it.
  - 1,557 of 2,936 extracted claims are unsourced: the biggest lever for content quality is inline citations, which the page contract does not require yet.
- Checks run: `npm run typecheck` pass; `npm run lint` 0 errors (35 pre-existing warnings); `npm test` pass (83 vitest in `lib/evals`, 20 node tests); `npm run build` pass; workflow YAML parses; `git diff --check` clean.
- Owner actions to switch it on: `OPENROUTER_API_KEY` repository secret; Settings -> Actions -> General -> "Allow GitHub Actions to create and approve pull requests"; a monthly spend limit on the OpenRouter key.
