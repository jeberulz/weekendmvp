# WP46 Progress - PR #71 idea-engine remediation

Append-only progress log. Do not rely on chat history for project state.

## 2026-10-01 - Setup (WP46-S0)

- Branch/worktree: `claude/wp46-pr71-remediation` in `.worktrees/wp46-pr71-remediation`, created from `origin/cursor/phase-7-skill-flip-d6b7` at `1c7240bdd30a4f6dff5d02eeab6d95fb36fc48df`. Upstream tracking removed so a bare `git push` cannot reach the PR branch.
- Assignment: implement `docs/plans/idea-engine/pr71-remediation-plan.md` (copied unchanged from the Codex review worktree, with the review it cites) using Claude Opus 5.5 workers under an orchestrator.
- PR #71 state (GitHub, 2026-10-01): head `1c7240bdd30a4f6dff5d02eeab6d95fb36fc48df`, base `7c4fdc3a4493a4a0e1452236912dca561fad0d6d` (`main`), open, mergeable.
- Reconciliation: the head moved one commit past the reviewed `b258ebb`. `1c7240b` makes `htmlToText` break lines at closing `tr`, `li`, `p`, `div` and at `br`, with a test. It narrows the F5 cross-row price mix-up but keeps numeric-membership grounding, so F5 stays open. F1–F4, F6 and F7 are untouched by it.
- WP number: WP45 is in progress on `codex/wp45-idea-engine-completion` (PR #83, branched from `85d1db4`, not merged into PR #71). WP46 is the next free number on every branch. WP45 files and branch are not touched.
- File boundaries and contract: `docs/plans/idea-engine/pr71-evidence-contract.md` and `lib/engine/evidence/contract.ts` (types only).
- Required checks: per story, targeted tests plus `npm run typecheck`; final gate per plan §11.
- Initial risks: live sources may block reads (fail closed, reported honestly); the extra extraction call must stay inside the $4 cap; F3 must not mutate production data; PR #83 overlap needs an owner decision.
- Docs: this log, `docs/wp/wp46-stories.md`, the contract, the WP46 registry row.

## 2026-10-01 - Baseline gate (WP46-S0)

- Revision: `bd3ed53` (PR head `1c7240b` plus WP46 docs and the types-only contract file). Node v22.23.1. Logs kept outside the repo; results below.
- `npm run typecheck` 0 · `npm run lint` 0 (0 errors, 35 warnings) · `npm test` 0 · `npm run validate:idea-tags` 0 · `npm run engine:eval` 0 (3/3 legacy gold pages) · `npm run build` 0 · `npm run check:server-traces` 0 · `npm audit --omit=dev --audit-level=high` 0 (0 vulnerabilities) · `git diff --check` 0.
- `git diff --check origin/main...HEAD` exit 2: trailing whitespace at `artifacts/quote-gate-live-verification.md:3-4` (pre-existing in the PR, as the review reported).
- Test totals measured per suite: og 91, links 6, redirects 38 + 76, auth 85, security 82 + 84, sitemap 7, convex 372, engine 109, home 34, platform 218 — **1,202 total**. The review reports 1,301 (108 engine) for `b258ebb`; engine differs by the one test `1c7240b` added, the other ~100 are unexplained by the code delta and are probably a counting difference. WP46 compares against the measured 1,202.
- Workers launched (Opus 5.5, separate worktrees from `bd3ed53`): T `claude/wp46-transport` (S1), D `claude/wp46-evidence-core` (S2), K `claude/wp46-catalogue` (S5).

## 2026-10-01 - WP46-S5 (F3) merged

- Worker K, branch `claude/wp46-catalogue` (`887e339`…`330b3e5`), merged as `a6d463d`. No schema, `_generated`, backfill or data change.
- Rule: `lib/engine-drafts.ts` (`isEngineDraftSlug`, `ENGINE_DRAFT_SLUG_END`, `publicIdeaPath`), imported directly by Convex. `convex/platform/catalogPolicy.ts` adds `excludeEngineDrafts` (`slug < "engine-draft-" || slug >= "engine-draft."`) and `inMemberCatalogue`. Enforced in `ideas.{list,byCategory,byRevenueGoal,byTool,byAudience,latest,relatedFor,allForSitemap,bySlug}`, `platform/ideas.{library,libraryPage}`, `legacyIdeas.explore`, `weekendPlans.{start,startPreview}`, `intake.startRepositoryIdea`, `preview/generate.generateFromBridge`, `promptPack.source`, `compare.ideas`; page, sitemap, MDX and seed guards stay.
- Pagination: native `.filter()` before `.paginate()`/`.take()`/`.first()`/`.collect()`; cursors untouched; short pages handled by existing `continueCursor` loops and `usePaginatedQuery`.
- Counts: discovery counts describe visible ideas; member-work counts include the member's own drafts, each labelled "Research retired" (`components/platform/RetiredResearch.tsx`).
- Red: new suite 10 failed / 2 passed before the fix; the review probe failed with `+ "engine-draft-ai-code-reviewer"` in `api.ideas.list`. A disposable local backend on the base code returned drafts from archive, `latest`, `byTool replit`, `byCategory`, `byRevenueGoal`, `allForSitemap`, `relatedFor` and `bySlug`.
- Green (worker, `330b3e5`): typecheck 0; convex tsc 0; lint 0 (35 warnings, unchanged); test:convex 384; test:sitemap 11; test:home 35; test:platform 229; test:auth 85; `npm test` 1,230; build 0; server traces 0; idea corpus 0.
- Local production check: anonymous local Convex on 3410/3411 (disposable copy in the session scratchpad, never 3210 or cloud), Next 3489. Seeded 3 drafts + 225 ideas, reran the ordinary seed; 228 rows stay stored. Archive, five hubs and sitemap had 0 drafts; `/ideas/ai-code-reviewer` 200 with a draft-free related rail; all draft pages, an unknown slug and `/build/engine-draft-ai-code-reviewer` 404. Processes stopped and the scratch backend deleted. The Convex CLI also cached `convex-local-backend` `precompiled-2026-09-28-5c7cb5b` (163 MB) in `~/.cache/convex/binaries`.
- Accessibility: code-level `jstack:a11y-check` review of the changed dashboard UI (no signed-in browser pass). One fix (`8d44711`).
- Open: the pre-existing unbounded `.collect()` in `byCategory`/`byRevenueGoal`/`byTool`/`byAudience`/`allForSitemap` is unchanged; `scripts/engine-compile.mjs` holds a third copy of the prefix; signed-in dashboard not browser-tested.
- Ruling recorded in `docs/wp/RULINGS.md` (2026-10-01, WP46-S5).

## 2026-10-01 - WP46-S1 (F4, F7, redirect credentials) merged

- Worker T, branch `claude/wp46-transport` (`7c571da`, `a64ee71`), merged into the integration branch. `pipeline.ts` untouched (S3 wires the acquirer).
- `lib/engine/providers/sourceText.ts`: `SOURCE_LIMITS` (2,097,152 wire bytes; 2,097,152 decoded bytes; 15,000 ms per whole read including DNS, every redirect and the body; 5 redirects; concurrency 4); `SourceFetchError` with the contract codes; `createPublicOnlyFetch({ lookup, limits })` as the hermetic seam with `publicOnlyFetch` as the public-only default; identity encoding only (any other Content-Encoding fails `unsupported_encoding`); HEAD/204/205/304 null bodies and empty bodies are `no_content`; one settle path for response errors, premature close, socket/request errors and abort; GET/HEAD-only redirects that drop Authorization/Cookie/Proxy-Authorization after an origin change and reject authenticated HTTPS→HTTP; blocked IP literals refused by the transport itself (Node skips a custom lookup for IP-literal hosts); `redactUrl`/`redactText` for diagnostics. SSRF helpers byte-identical. `htmlToText` made linear (640k chars of unclosed `<script` went from 38,160 ms to ~1 ms; 5,000-case randomized equivalence check).
- `lib/engine/acquire.ts`: `createSourceAcquirer` per contract §3 (dedupe by `keyOf`, shared in-flight reads, semaphore, `read` never rejects, status mapping, `retrievedAt`, `textSha256`, redacted `detail`, settled-only `snapshot()`).
- Red (original code, `bd3ed53`, 7/7 failing): 205 left the promise pending with an uncaught `TypeError: Response constructor: Invalid response status code 205`; status 999 the same with a `RangeError`; a 3 MiB stream resolved; a huge Content-Length stayed pending; a cross-origin redirect target received `authorization: bearer dummy-bearer-token`; an HTTPS→HTTP downgrade delivered the bearer; a 4-hop chain resolved after 613 ms under a 400 ms deadline; the child-process 205 smoke exited 1. Kept in `docs/reviews/evidence/wp46/s1-transport/` (paths sanitized, test file stored as `.txt` so it does not run).
- Green (worker): typecheck 0; eslint 0; transport + acquirer 60 tests; `npm run test:engine` 169 (was 109); mutation check of every guard; 3 parallel full runs stable.
- Limits/notes: HTTPS paths tested through a fake TLS shim; large HN/Reddit threads may hit the 2 MiB cap (watch in S7); `SourceAcquisition.roles` is filled by the pipeline; `sourceText.ts` is ~1.2k lines (split deferred).
- S5 red evidence also kept in `docs/reviews/evidence/wp46/s5-catalogue/` (sanitized).

## 2026-10-01 - WP46-S2 (evidence core) merged; contract rulings R1–R3

- Worker D, branch `claude/wp46-evidence-core` (`77e9014`…`570bb14`), merged as `ba4e7e1`: `lib/engine/evidence/{citation,quote,amount,accept,tokens}.ts` and `lib/engine/finance.ts`, 141 new tests (amount 33, quote 23, citation 12, accept 42, tokens 13, finance 18); `npm run test:engine` 250 on the worker branch. No existing file changed; no `contract.ts` additions.
- F5 matrix covered at the acceptance level: `$20,000/month`→`period_mismatch`; `$1.4 billion`→`amount_mismatch`; `$2024 billion`→`amount_mismatch`; Loopio `$30/month`→`ambiguous_attribution` (Loopio `$20,000/year` accepted as secondary); EUR vs USD→`currency_mismatch`; `$24/month`→`basis_mismatch` and `$24/user/month`→`qualifier_dropped`; `$1,400,000` vs `$1.4 million` accepted; coherent first-party price accepted; ambiguous comparative/unparseable unit with `verified: true` rejected; DeepRFP from rfp.ai→`vendor_not_in_context`.
- Red (original helpers, temporary file, 8/8 failing): `isGroundedFigure` accepted `$20,000/month`, `$1.4 billion` and `$2024 billion`; `isGroundedForCompetitor` credited Loopio with Qvidian's `$30/month`; `quoteAppearsIn` joined fragments across an ellipsis; `parseYearOne` turned 0.4 accounts into 0; `yearOneLines` gave a 1-account base a 1-account downside and a 0-account base a $1,200 downside.
- Rulings R1–R3 recorded in contract §12: ids include the typed claim (two claims in one sentence no longer collide); projection cues scope forward (a measured base value before "projected to reach" stays measured); quotes compare asymmetrically (`quoteMatchesExcerpt`). R1/R2 sent back to worker D on its branch.
- Known limits (worker): no European number formats or implied periods; a "billed annually" toggle stated before the price is not detected (human source review); pipe-table secondary prices reject; count amounts carry no noun; the figure guard allows bare years and most spelled-out counts; revalidation cannot catch a self-consistent fabricated excerpt with recomputed hashes, so the replay gate must check excerpts against stored source text.
- Test-only dependency note: `quote.test.ts` imports `@mdx-js/mdx`, which is transitive (via `next-mdx-remote-client`). Decision deferred to S4 (sole `package.json` writer in phase 2).

## 2026-10-01 - WP46-S2 follow-up (R1, R2) merged

- Worker D commit `fec922e` merged. `evidenceId(kind, sourceUrl, excerpt, claimKey)` now requires the claim key (`evidenceClaimKey`); a stat excerpt is exactly the sentence holding the amount; duplicates compare claims exactly.
- Projection: a cue or a later-than-retrieval year before a figure, or a later year directly after it, marks it projected; the claimed period kind must equal the derived one (a "projected" claim without a cue is now `period_mismatch`). A declared year must be the year attached to its own figure (a forecast horizon may be shared by projected figures).
- "Valued at USD 1.2 billion in 2024 … projected to reach USD 5.4 billion by 2032 … CAGR of 20.4%" yields three stats: measured 2024, projected 2032, projected 2032.
- Worker checks: typecheck 0; eslint 0; evidence + finance 155 tests; `npm run test:engine` 264. Red: 15 tests failed on the pre-change code.
- Known conservative limit: a cue earlier in a sentence marks every later figure ("forecast to hit $3B by 2028 from $1.2B in 2024" accepts $1.2B only as projected).

## 2026-10-01 - WP46-S3 part 1 merged

- Worker P commits `eabefe0` (mechanical split of `quality.test.ts` into `quality.pipeline.test.ts` 31, `quality.compile.test.ts` 8, `quality.sources.test.ts` 8; 47/47 tests and bodies identical; engine count 310 before and after) and `6d63e48` (record v2 parser) merged as `9e6410d`.
- `research-record.ts`: `parseResearchRecordV2` (closed schema at every level, re-validates every accepted item, resolves every id by kind, vendor-matched prices, distinct quotes, FACT_BEARING_FIELDS token/figure rule, finance-validated yearOne, explicit mode, models/attempts, `RESEARCH_RECORD_V2_LIMITS`), `LegacyResearchRecordError` (subclass of `ResearchRecordParseError`, re-research message), `readLegacyResearchRecordV1`. `parseResearchRecord` still delegates to the v1 reader until integration.
- Red (v1 parser): accepted `payingAccounts: 0.4` as 0; accepted a record whose quote was `verified: false` while `problemNarrative` and `market.summary` stated "47 PRs … team of 8 … 60% … 25%"; the committed `ai-code-reviewer.json` parses with 3 unverified signals and a narrative mentioning 47 PRs.
- Green: worker 484 engine tests (174 new); after merging with R1/R2 the integration branch runs 498 engine tests, typecheck 0. Ten-rule mutation check failed the suite each time.
- Ruling R4 recorded (contract §12): records prove consistency, not authenticity; the replay gate and S7 source inspection cover authenticity.
