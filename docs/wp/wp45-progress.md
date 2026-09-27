# WP45 Progress - Operator idea engine completion

Append-only progress log. Do not rely on chat history for project state.

## 2026-09-27 - Setup

- Branch/worktree: `codex/wp45-idea-engine-completion` in `.worktrees/idea-engine-audit-20260927`. Created from `85d1db483a38802e483c1187ceafa81c66ab9343`.
- Assignment: Complete the operator idea engine per `docs/plans/idea-engine/2026-09-27-completion-plan.md`. Stories run S1, then S2, then S3, then S4, then S5, then S6.
- File boundaries: `lib/engine/**`, engine scripts, engine tests, `engine/eval/**`, `engine/drafts/**` for private output, `ideas/SECTIONS.md`, tracked publish-idea skill copies, `.github/workflows/ci.yml`, `docs/plans/idea-engine/2026-09-27-completion-plan.md`, `docs/wp/wp45-stories.md`, `docs/wp/wp45-progress.md`, and the WP45 row in `docs/PROJECT_STRATEGY.md`.
- Required checks: per story, `npm run test:engine` after the story's regression tests. Final gate is `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate:idea-tags`, the new engine eval, `npm run build`, `npm run check:server-traces`, and `git diff --check`.
- Initial risks: F1 through F10 are the audit's confirmed defects. Line numbers are revalidated before S1 code because the plan cites the reviewed commit. Reddit approval is unresolved, so Reddit stays optional. Evidence-policy choices that the plan does not already state get escalated, not invented.
- Base check: `git fetch origin cursor/phase-7-skill-flip-d6b7` on 2026-09-27. The remote tip equals `85d1db483a38802e483c1187ceafa81c66ab9343`. No successor commit. The audit findings stay in force pending line-level revalidation.
- Docs: this log, `docs/wp/wp45-stories.md`, the WP45 registry row, and the existing completion plan. Product code unchanged.

## 2026-09-27 - Revalidation, providers

- Source: read-only map of `lib/engine/providers/**`, `cost.ts`, and the ledger in `pipeline.ts` at `85d1db4`.
- F8 still true. `send` in `lib/engine/providers/sourceText.ts` (289–306) reuses the full `RequestInit` on every redirect hop. The Reddit OAuth GET at 349–354 sends `authorization: bearer`. There is no origin check and no header strip. Existing SSRF tests refuse private redirects. They do not assert that the bearer stays on `oauth.reddit.com`.
- F9 still true, with one narrower edge. `settleFailure` in `pipeline.ts` (935–961) records cost only when the error is a `ProviderCallError` that already carries `cost`. Missing OpenAI usage becomes zero at `openai.ts` 125–128. `publicOnlyFetch` buffers the whole body at `sourceText.ts` 249–260. OpenAI, Perplexity, and DataForSEO fetches have no deadline. Source fetches already use `AbortSignal.timeout` at 15 seconds per hop.
- Product code unchanged. S2 and S3 stay blocked on S1.

## 2026-09-27 - WP45-S1

- Actions taken: Failing tests in `lib/engine/compile-safety.test.ts` went red on backslash-brace execution, line-start import/export, unsafe URLs, oversized fields, and a non-draft slug writing outside `engine/drafts`. The fix encodes prose braces and angle brackets as HTML entities, leaves compiler fences literal, parses the body with the installed MDX parser, refuses non-HTTP and credential URLs, bounds fields at 100000 characters, and defaults compilation to `engine/drafts`. `assertPromotionAllowed` throws for every current record.
- Decisions made: HTML entities replace backslash escapes. A preceding backslash cannot reopen `&#123;`. Line-start `>` stays a blockquote so verified quotes still match the auditor. v1 promotion has no success path.
- Checks run: `npx vitest run lib/engine` — 112 passed, 6 files.
- Result: S1 green. Public `content/ideas` and `ideas/manifest.json` were not left modified.
- Gotchas: `URL.href` leaves `(` and `{` raw, so link destinations are percent-encoded after the HTTP check. Prose escaping masks `](url)` so an ampersand in a URL is not turned into `&amp;`.
- Next: S2 failing tests for grounding, quote identity, v2 records, and authenticated redirects.

## 2026-09-27 - Revalidation, compile

- Source: read-only map of `lib/engine/compile.ts`, `compile-write.ts`, `scripts/engine-compile.mjs`, and `lib/mdx.tsx` at `85d1db4`.
- F1 still true. `escapeMdxProse` at `lib/engine/compile.ts` 93–95 prefixes every `{` and ignores a preceding backslash. A one-backslash or three-backslash prefix becomes an executable addition in `@mdx-js/mdx` 3.1.1 output (`children: ["\\", 12345 + 67890]`). A plain `{expr}` is escaped into text. `import` and `export` at the start of a line pass through as ESM. `Mdx` renders through `MDXRemote` at `lib/mdx.tsx` 195–199.
- F2 still true, with a narrower line cite. Public writes are the CLI default at `scripts/engine-compile.mjs` 91–100 for any slug that does not start with `engine-draft-`. `compile.ts` 654 stores `auditPassed: false` and nothing reads it. There is no promotion command. Seed exclusion at `scripts/seed-convex.mjs` 191–197 is prefix-only.

## 2026-09-27 - WP45-S1

- Actions taken: Failing tests in `lib/engine/compile-safety.test.ts` went red first (7 failed, 2 already held). The fix encodes braces and angle brackets as character references, keeps blockquote markers, parses the body with `@mdx-js/mdx`, and refuses expression, JSX, and ESM nodes. `scripts/engine-compile.mjs` now defaults every slug to `engine/drafts/` and refuses `content/ideas` plus `ideas/manifest.json`. `assertPromotionAllowed` refuses every current record. Prose fields over 100000 characters throw.
- Decisions made: Character references instead of adding backslashes. A second backslash was the F1 bug. Line-start `>` stays a blockquote so the deep auditor can still see quotes. 100000 characters is the field cap. It sits above the current drafts, which are about 25KB.
- Checks run: `npx vitest run lib/engine/compile-safety.test.ts lib/engine/compile.test.ts` passed 22. `npm run test:engine` passed 112.
- Result: S1 checks passed. Public idea files were not modified.
- Gotchas: Escaping every `>` removed blockquotes and the quote auditor reported zero verified quotes. The encoder now leaves a `>` that starts a line.
- Next: S2, replayable evidence and source-safe fetches.

## 2026-09-27 - WP45-S2 partial

- Actions taken: `isGroundedFigure` now compares money amount, scale, and billing period. `$20 billion` no longer matches `$20 per seat`. `$20 per year` no longer matches `$20 per month`. `$0`, `Free`, and `Custom quote` no longer pass when the source does not say them. `send` refuses an authenticated cross-origin redirect and an HTTPS downgrade, after the private-address check. The deep auditor matches a quote only when the normalized text is equal and the displayed URL has the same canonical source key. Two Reddit URLs for one thread share `reddit:<id>`. Source reads stop at 1048576 bytes.
- Checks run: `npx vitest run lib/engine` — 117 passed, 6 files. The copied-quote auditor test failed first with only the word-count error, then passed after the URL check.
- Result: S2 is not done. v2 records, freshness windows, percent versus count, date and geography, deleted-page invalidation, and provider deadlines are still open. S2 stays unchecked.
- Decisions made: Authenticated cross-origin redirects are refused, not stripped and followed. The 2200-word floor stays. Freshness durations are not in the plan, so none were invented.
- Next: v2 record with a v1 read adapter that still cannot be promoted, then the remaining typed-claim cases.

## 2026-09-27 - Revalidation, evidence and eval

- F3 still true before the typed-claim check. Digit tokens, an empty token list, and search-answer text were the grounding inputs. `$20` matched `$20 billion`.
- F4 still true. There is no `accept`, `needs_research`, or `reject` outcome in `lib/engine/`. That is S4.
- F5 still true, and narrower. `engine:eval` checks four metrics on three legacy gold pages. It does not measure generated research. A 3/3 gold result is not engine quality. All three current drafts fail the deep audit.
- F6 still true before the quote bind. The auditor matched quote text in either direction and did not bind the displayed URL. Two rows from one thread could satisfy the verified count.
- F7 still true before the v2 record. Provenance was provider calls, cost, and `ranAt`. On-disk records are still contract v1.
- F10 still true. Generic tiers and the 2200-word floor are unchanged on purpose. S4 owns that policy change. The floor was not lowered.

## 2026-09-27 - WP45-S2

- Actions taken: Typed claims compare money scale, billing period, percent, year, and geography. A scale letter must be a whole word, so `$20 by Friday` is not `$20 billion`. Quotes match the full normalised text and the canonical source key. One Reddit thread is one evidence unit. A fetched page that does not contain the figure is dropped. A page that cannot be read does not verify the figure. New fixture runs write contract v2 with `run`, `sources`, and `claims`. v1 records still parse. Promotion still refuses both. Source reads stop at 1048576 bytes. Authenticated cross-origin redirects and HTTPS downgrades are refused.
- Decisions made: Freshness windows are an implementation choice, not a ruling. Prices 90 days, community quotes 365 days, market stats 540 days, keywords 30 days. Reverse with the word freshness. Authenticated cross-origin redirects are refused rather than followed without the bearer.
- Checks run: `npx vitest run lib/engine` passed 119 tests in 7 files.
- Result: S2 checks passed. No live provider call. Public idea files were not modified.
- Gotchas: A partial page map used by older tests hid market URLs, so those tests now spread `fixturePageMap()` and override only the community pages.
- Next: S3, provider cost reservations and non-Reddit discovery.

## 2026-09-27 - PR #83 review fixes (S1/S2 defects)

- Source: human NO-GO on `b1ab02a` (PR #83). Seven inline findings.
- Actions taken: Removed duplicate `canonicalSourceKey`/`extractAttributedQuotes` imports so `node --check scripts/audit-idea-mdx.mjs` starts; `idea-quality.mjs` re-exports from `quote-binding.mjs`. Narrowed `run.mode`/`run.status` before the typed v2 result; `Program` cast goes through `unknown`. Claim verification uses claim+value with currency, scale, year, geography and subject words; supporting passages are sliced around the match and must themselves support the figure. Community page evidence is merged into `sources`; v2 parse rejects duplicate/dangling evidence IDs and verified claims without excerpts. `assertSafeMdx` validates every link/image/definition URL. Quote extraction uses the MDX AST so `R&amp;D` decodes. Fixture market snippets include claim subject language.
- Checks run: `npm run test:engine` 125 pass; `npm run typecheck` pass; `npm run lint` 0 errors; `npm test` pass; `npm run build` pass; `node --check scripts/audit-idea-mdx.mjs` pass; fixture `engine:research` → v2 with 7 sources / 0 dangling → `engine:compile` → `audit:idea --record` (word-count floor only, expected for short fixture).
- Result: Reviewed S1/S2 defects fixed. S3–S6 still open. Draft PR stays draft. No merge/live activation.
- Next: S3 conservative cost reservations/timeouts/bounded alternative-source discovery.

## 2026-09-27 — PR83 final review repair started

- Lane: existing WP45 Work Package, S2 repair; isolated `codex/review-pr83` worktree at `3100f29`, targeted push to PR83 authorized by owner.
- Remaining findings: lexical claim verification combines unrelated/negated facts; quote extraction truncates at hyphens and dashes.
- Boundaries: evidence helper/regressions, quote helper/regressions and WP45 documentation. Provider/model implementation stays with concurrent S3–S6; model routing and verification recommendations will be documented here.

## 2026-09-27 — PR83 final review repair completed

- Subject/value corroboration now operates inside source statements, rejects negation/uncertainty before clause splitting, retains substantive subject tokens, refuses ambiguous extra values and preserves the actual supporting statement. Successful claim reasons explicitly identify lexical corroboration and the remaining semantic-review requirement. This is not a general-purpose truth or entailment verifier.
- Quote extraction preserves dash/ranges, soft/hard breaks and multiple paragraphs. Only a distinct final attribution paragraph supplies the URL; multiple destinations or unsupported block children (lists, nested quotations, code) cannot silently bind a partial quote.
- Regression evidence: initial claim suite had 13 of 14 failing tests; initial quote suite had 7 of 9 failing tests; three additional unsupported-block regressions also failed before their fix. No existing fixture, test expectation or quality threshold was weakened.
- Independent review ran 34 focused tests and found no blocking regression; its additional unsupported-block finding was fixed and tested. Final engine suite includes both regression files.
- Verification: full `npm test`, typecheck, lint (0 errors, 36 warnings), build, server traces and tagging (225/225) passed. Final focused engine (155 tests) and typecheck reruns passed after quote hardening. `git diff --check` passed.
- Fixture research and compilation succeeded to `/tmp`; deep audit has exactly the existing 1538 < 2200 word-count failure. It is not a publishable fixture. No quality floor was lowered. No live provider calls, public content changes, deployment or merge.
- Added `docs/plans/idea-engine/2026-09-27-model-verification-handoff.md`: retain current writer baseline, evaluate Astra as an independent verifier, add per-role accounting and held-out evaluation on the S3–S6 branch. Provider implementation was not changed here. A more capable model alone cannot establish production readiness.
- Release boundary remains S3–S6 plus the documented live-smoke and hash-bound human publication gates. This repair does not authorize go-live.

## 2026-09-27 - WP45-S3

- Actions taken: Reservation ledger now bills step worst-case when usage is missing or a paid call fails without a parseable charge. `401`/`402`/`403` do not retry. Paid provider fetches use a 30s abort. Live CLI preflight prints key names only. A failed run writes `engine/reports/{slug}.failure.json` after redacting Bearer/Basic/`sk-`/`pplx-`/`ib_`. Community reads that miss the 2-page floor get one extra search that excludes Reddit. Batch cap is `$32`.
- Decisions made: Design A. Pipeline `settleFailure` is the ledger. Adapters attach a reserved marker. The step budget overwrites the dollar amount so a scoring call cannot be billed as a 4k-token brief. Discovery does not lower the quote bar. Reddit stays optional (`unconfigured` without OAuth).
- Checks run: `npm run test:engine` 145 pass. `npm run typecheck` after the `never`/env-map fixes.
- Result: S3 checks passed. No live spend. No commit. Draft PR #83 still draft.
- Gotchas: The old unreadable-source test expected `0/2` cited pages. Discovery adds two HN/forum citations, so the fail message is now `0/4`.
- Next: S4 outcomes (`accept` / `needs_research` / `reject`) and editorial policy. Do not merge #83.

## 2026-09-27 - WP45-S3 batch ledger

- Actions taken: Live CLI now reads `engine/reports/batch-spend.json`, refuses a run whose $4 reservation would pass $32, and adds actual or failed-run spend after the call. Fixture mode does not touch the file.
- Checks run: `npx vitest run lib/engine/resilience.test.ts lib/engine/pipeline.test.ts` plus `npm run typecheck`.
- Result: The batch cap is enforced on the operator path, not only in a helper.
- Next: S4. Do not merge #83.
