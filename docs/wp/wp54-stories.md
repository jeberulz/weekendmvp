# WP54 Stories - PR #71 idea-engine remediation

Branch: `claude/wp54-pr71-remediation` (from PR #71 head `1c7240bd`; never pushed by this package)
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: findings F1–F7 from `docs/reviews/2026-10-01-pr71-idea-engine.md` are fixed per `docs/plans/idea-engine/pr71-remediation-plan.md`, each with a regression that failed on the reviewed code and passes now; the configured gate passes; three representative live briefs are run and source-checked, or the live gate is reported open; `docs/reviews/2026-10-01-pr71-remediation-results.md` is ready for an independent Codex review. No merge, push, publication, seed, deploy or production activation.

Contract and file ownership: `docs/plans/idea-engine/pr71-evidence-contract.md`.

## Stories

- [x] `WP54-S0` - Baseline, reconciliation and evidence contract (Checkpoint A)
  - Scope: WP54 docs, `docs/plans/idea-engine/pr71-evidence-contract.md`, `lib/engine/evidence/contract.ts` (types only)
  - Acceptance criteria:
    - PR head and base recorded; commits after the reviewed SHA reconciled per finding
    - Baseline gate recorded on the PR head
    - Every finding has a concrete failing reproduction before its fix lands (recorded in the owning story)
    - Evidence contract, versions, legacy behavior and single-writer file ownership frozen
  - Verification:
    - `npm run typecheck`, `git diff --check`

- [x] `WP54-S1` - Bounded, exception-safe source acquisition (F4, F7, redirect credentials) (Checkpoint B)
  - Scope: `lib/engine/providers/sourceText.ts`, `lib/engine/acquire.ts`, transport/acquire tests
  - Acceptance criteria:
    - Streamed wire bytes and decoded bytes are capped; oversized Content-Length rejects before buffering; the request/response is destroyed
    - Compressed responses are bounded after decoding, or unsupported encodings fail clearly
    - At most 4 concurrent reads per run; identical URLs are read once per run, including supplement searches
    - One 15 s deadline covers DNS, redirects and body; queued and cancelled reads settle
    - HEAD/204/205/304 and empty bodies settle as `no_content`; construction, abort, premature close and socket errors reject exactly once
    - Cross-origin redirects strip Authorization/Cookie; authenticated HTTPS→HTTP downgrades reject; same-origin redirects still work
    - Existing private/metadata/IPv6/DNS-rebinding refusals stay green
  - Verification:
    - Hermetic transport tests in `npm test`; child-process 205 smoke exits normally

- [x] `WP54-S2` - Evidence core: amounts, quotes, citations, acceptance, tokens, finance (F5, F2, F6 domain rules)
  - Scope: `lib/engine/evidence/{amount,quote,citation,accept,tokens}.ts`, `lib/engine/finance.ts`, tests
  - Acceptance criteria:
    - The plan's F5 matrix passes at the acceptance-function level (reject 7, accept 2 as specified)
    - Quote source matching is contiguous; internal ellipses reject; rendered-quote comparison is strict
    - Canonical URLs keep identity-bearing query values (HN `item?id=`)
    - Finance uses integer cents, rejects fractional/unsafe inputs, and computes `floor(base/2)` downside
  - Verification:
    - `npx vitest run lib/engine/evidence lib/engine/finance.test.ts`

- [x] `WP54-S3` - Evidence-first pipeline and record v2 (F5, F1) (Checkpoint C)
  - Scope: pipeline, step table, record parser, fixtures, research CLI and run report
  - Acceptance criteria:
    - Candidates are extracted and accepted before keywords and editorial writing; minimums apply to accepted evidence
    - The writer's captured input contains no rejected claims, search answer prose or old narratives
    - Unknown/rejected evidence ids, unbound figures in fact-bearing fields and invented metrics fail before a record is written
    - The first four F5 matrix rows fail closed through the complete fixture pipeline
    - Legacy v1 records cannot be compiled or audited as engine output; the operator gets a re-research error
    - Extra extraction and regeneration calls are reserved, settled, versioned and capped at $4.00
  - Verification:
    - `npm run test:engine`

- [x] `WP54-S4` - Compiler and final artifact auditor (F2, F6) (Checkpoint D)
  - Scope: compiler, compile CLI, auditor, eval script, audit tests
  - Acceptance criteria:
    - Blockquote and attribution parse as one unit; strict equality with a selected accepted quote and its exact source URL
    - Appended sentence, wrong URL, same host/other thread, missing attribution, changed number, negation, reordering and unsupported ellipsis all fail
    - Year-One Math is rendered from and audited against `finance.ts`; mutated ARR/accounts/price/tier/downside fail
    - The auditor CLI exits nonzero on each mutation of a complete compiled page
  - Verification:
    - `npm run test:engine`; CLI tests

- [x] `WP54-S5` - Existing engine drafts leave discovery without losing member work (F3) (Checkpoint E)
  - Scope: Convex discovery queries, catalogue policy, discovery consumers, seed/route guards, tests
  - Acceptance criteria:
    - Seeded drafts stay stored but disappear from public archive, hubs, related ideas, homepage discovery, dashboard catalogue/search/facets and counts
    - Native pagination semantics survive a first page full of hidden drafts
    - Owner saves/plans/notes survive with an honest unavailable state; other users stay denied
    - Direct draft pages and sitemap stay excluded; no production mutation
  - Verification:
    - `npm run test:convex`; local production build against an isolated backend

- [x] `WP54-S6` - Integration, deterministic replay gate, docs and skill (Checkpoint F, deterministic)
  - Scope: cross-cutting cleanup, replay gate, engine docs, `.claude/skills/publish-idea/SKILL.md`
  - Acceptance criteria:
    - research → compile → deep-audit replay runs hermetically inside `npm test`
    - The full configured gate passes; warnings reported
    - Docs and skill describe actual behavior only
  - Verification:
    - typecheck, lint, test, validate:idea-tags, engine:eval, build, check:server-traces, npm audit, diff checks

- [ ] `WP54-S7` - Live evaluation and source inspection (Checkpoint F, live)
  - Status (2026-10-03): later supervised probes did produce private drafts, but human review found source/attribution errors, which are documented in `docs/reviews/evidence/wp54/live-go-20261003/source-inspection.md`. The final same-revision rerun is blocked by the search provider's `401 insufficient_quota`. **Live gate remains open**; the earlier zero-page result is preserved in `docs/reviews/evidence/wp54/live/s7-failure-check.md` and the original results report §8.
  - Scope: three representative briefs, engine drafts/records/reports, eval report
  - Acceptance criteria:
    - Each brief runs once under the $4 cap with bounded retries; cost, attempts and failures recorded
    - Every competitor price and quantitative market claim, plus ≥2 quotes per output, checked against its cited source
    - Drafts rendered through a non-publishable harness; public guard untouched
  - Verification:
    - Auditable commands per research/compile/audit invocation

- [x] `WP54-S8` - Results report and return package
  - Status (2026-10-03): `docs/reviews/2026-10-01-pr71-remediation-results.md` written from evidence; open items explicit (live gate open).
  - Scope: `docs/reviews/2026-10-01-pr71-remediation-results.md`, WP54 docs
  - Acceptance criteria:
    - Every required results field filled from evidence; open items explicit
  - Verification:
    - `git diff --check`

## Out Of Scope

- Phases 8–9, newsletter migration, Ideabrowser credential retirement, Stripe, billing, dashboard redesign, DNS, production data cleanup, unrelated dependency upgrades
- WP45 / PR #83 files and branch (`codex/wp45-idea-engine-completion`); its stories stay with that package
- Merge, push, publication, seed, deploy, production activation, history rewrite

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- PR #83 (WP45) overlaps S1–S3 in intent. It branches from an older PR #71 head (`85d1db4`) and was not merged into PR #71. The owner decides how the two packages reconcile.

## PR #96 GO-readiness follow-up (2026-10-03)

Branch: `codex/wp54-go-readiness`, based on PR #96 head `5f024a1`. The owner asked to repair the independent review findings and prepare the Idea Engine for a weekend GO. This extends WP54; it does not authorize publishing or production activation. The review and offline reproductions are in `docs/reviews/2026-10-03-pr96-idea-engine.md` and `docs/reviews/evidence/pr96/`.

- [x] `WP54-S9` — Correct evidence assertions (review R1–R3). Files: `lib/engine/evidence/{accept,amount}.ts`, their tests and contract docs. Accept a stat only when subject/metric/amount/period belong to the same assertion. Refuse denied, historical, hypothetical or approximate current prices. Scope billing qualifiers to the offer they modify or reject ambiguity. Every review probe goes red on the old revision and green on the fix; valid single-assertion, annual/monthly and multi-stat controls remain accepted; stored-record revalidation agrees.
- [x] `WP54-S10` — Compiler/auditor agreement (R4). Files: `lib/engine/{compile,page-format}.ts`, compiler/audit tests. Supported parenthesized billing terms compile and pass deep audit, with price/seat/ARR fully checked. Mutated totals and terms still fail.
- [ ] `WP54-S11` — Reach viable live evidence without false prices. Files: evidence/record/pipeline/compile/audit, source text and tests only as required by an explicit revised contract. Establish a sourced representation for competitors whose public pricing is unavailable and distinguish this from numeric prices; retain a minimum of three distinct verified vendors and a meaningful numeric-price floor. Improve extraction/source fidelity only where live failures show it is necessary. Never infer price from marketing copy or loosen source/subject binding to clear the gate. Keep the per-report $4 cap and bounded retries. Implementation and offline verification are done; the final live evidence check is still open with S7/S12.
- [ ] `WP54-S12` — Finish integration and GO gate. Files: typed homepage highlights and tests if needed, docs, scripts and saved live reports. Decide weekly feature eligibility from a verified compiler-generated tier source. Run typecheck, lint, all tests, replay, eval, tags, build, server traces, audit and diff checks. Run three representative live briefs under the existing cap; preserve sanitized source/record/report artifacts, compile and deep-audit each, inspect every price/stat and at least two quotes, then render them in a non-publishing preview. Reconcile PR #96 with its merge target and assess the combined stack. Report explicit GO/NO-GO and any remaining limitations. No publication, seed or production deployment in this story.
- [ ] `WP54-S13` — Clarify year-one tier selection in the editorial writer. Files: `lib/engine/pipeline.ts`, targeted pipeline tests, gate evidence and docs. The writer must put only the exact selected pricing-tier name in `yearOne.tier`, with no price or billing suffix. Preserve strict parser/finance validation and bounded retries; prove that an embellished name is still rejected, then rerun the failed code-reviewer brief on a clean revision. This responds to the funded-account live run that exhausted three writer attempts on `Solo Maintainer — $15/developer/month`.
- [ ] `WP54-S14` — Exclude general blog guides as market-stat publishers. Files: evidence source classification, acceptance/revalidation tests, contract docs and gate evidence. A marketing `blog` or `guide` page may help discover a report, but its market-size figure cannot stand in for original market research. Reject the source at both initial acceptance and stored revalidation; keep original report URLs eligible. The live code-reviewer draft selected an unsupported market projection from a broad automation guide even though its other selected figures came from a research report.
- [ ] `WP54-S15` — Use the second already-budgeted extraction attempt for a competitor-only shortfall. Files: pipeline, fixture tests, contract docs and gate evidence. When the first pass accepts enough market stats and quotes but too few cited competitors or no numeric priced vendor, ask only for missing competitor offers from the already-read pages. Preserve first-pass evidence, dedupe verified items, honor per-kind caps and the unchanged $4 worst-case budget, and fail closed if the retry still lacks three vendors and one numeric price. This addresses a funded-account RFP run that read multiple official pricing pages but extracted no parseable numeric offer.
