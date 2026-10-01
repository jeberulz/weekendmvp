# PR #71 remediation plan — Claude Opus 5.5 implementation handoff

Date: 2026-10-01. Status: **plan only; implementation has not started**.

PR: https://github.com/jeberulz/weekendmvp/pull/71

Reviewed code: `b258ebb3ff3ec7dc84a232a2505039a0b0741b12` on `cursor/phase-7-skill-flip-d6b7`.

Review: [2026-10-01-pr71-idea-engine.md](../../reviews/2026-10-01-pr71-idea-engine.md).

## Execution instruction for Claude Opus 5.5

Implement this plan as a scoped repair of PR #71. Read the review and actual current code before editing. Resolve all seven findings, retain the engine's useful existing architecture, and deliver reproducible evidence for a second independent review. Work through the checkpoints below; do not stop after making the original tests green.

The objective is trustworthy research output and a reliable publishing workflow. A GO must be earned by behavior and evidence. Do not promise it, weaken a gate to obtain it, silently accept an unresolved finding, or describe a skipped check as passing. Return the finished work to the owner for Codex review **before merge**.

Do not merge, publish content, seed production, deploy a production backend, retire credentials, or perform a history rewrite. Respect existing commit/push authorization; implementing this plan does not independently authorize a push. Keep production activation separate from code readiness.

## 1. Establish scope and working state

1. Read `docs/wp/AGENT_HANDOFF.md`, `AGENTS.md`, `AGENTS.workflow.md`, `.agentic-workflow.yml`, `docs/wp/RULINGS.md`, the Idea Engine `overview.md`, and this review. The active dashboard handoff contains permanent safety boundaries; it does not make this a dashboard implementation task.
2. Select the **Work Package** lane for implementation. Inspect the registry and existing Idea Engine work before choosing the appropriate existing WP or next available WP number. Do not overwrite or commandeer WP45 or any other in-progress package. Maintain its `docs/wp/wpNN-stories.md` and `wpNN-progress.md`, mapping story IDs to F1–F7 and the checkpoints here.
3. Fetch PR #71 and record its actual head and base. If it moved beyond the reviewed SHA, reconcile each finding with the new code; do not reapply an already-completed repair. Record that reconciliation.
4. Work on the PR branch or a repair branch based on its latest head, never `main`. Inspect existing worktrees and local changes before switching. Use isolation only where needed, follow the environment's managed-worktree tooling, and preserve other work. Do not merge an unrelated worktree or platform branch into this PR.
5. Read `convex/_generated/ai/guidelines.md` before F3 work. Read the relevant installed Next.js guides before modifying route or UI code. Use the installed dependency/API versions, not remembered framework behavior.
6. Record the baseline checks and reproduce each bug with an isolated regression. Retain meaningful failing assertions before implementing its fix. If a new contract prevents running the final tests on the old code, retain a small original-contract reproduction as the red evidence.

### Scope boundaries

In scope: evidence validation and staging; research-record compatibility; compiler/auditor consistency; bounded source transport; draft discovery and lifecycle integration; test coverage; saved evaluation artifacts; related operator documentation.

Likely files: `lib/engine/**`, `lib/engine-drafts.ts`, `scripts/{audit-idea-mdx,engine-research,engine-compile,engine-eval,seed-convex}.mjs`, `scripts/lib/idea-quality.mjs`, narrow catalogue modules in `convex/`, affected discovery consumers, engine records/drafts/evals, and the canonical publish-idea skill. Add focused pure modules where they reduce duplication. This is not permission to refactor all of those files.

Out of scope: phases 8–9, newsletter migration, Ideabrowser config/credential retirement, Stripe, customer billing, dashboard redesign, DNS, production data cleanup, and unrelated dependency upgrades. Avoid a Convex schema change unless the selected F3 solution demonstrably requires one; document that decision and its deployment implications before coding the shared schema seam.

## 2. Target design and clean-code rules

The pipeline should have explicit boundaries:

```text
brief -> source acquisition -> candidate evidence extraction
      -> deterministic evidence acceptance -> accepted evidence bundle
      -> editorial synthesis -> validated research record
      -> deterministic compilation -> independent final artifact audit
      -> human source/quality check -> staged content
```

Apply these rules throughout:

- **Raw evidence and accepted evidence are different types.** A model-supplied `verified: true`, URL, or evidence ID cannot grant trust. Only validation code constructs an accepted item. Validate serialized records at every CLI boundary; TypeScript types alone are insufficient.
- **Writing consumes accepted evidence only.** Rejected facts, unchecked snippets, and prose from the candidate-extraction response must not leak into the editorial model input through summaries or fallbacks.
- **Keep guarantees precise.** A matching source proves that a source contains a claim, not that the source is credible or the claim universally true. Source credibility, implication and editorial judgment remain review tasks. An LLM judging another LLM is not deterministic factual proof.
- **Centralize domain rules, not everything.** Share quote normalization, citation identity, amount semantics and financial calculations. Keep fetching, record validation, rendering and CLI orchestration separate. Prefer small pure functions and explicit inputs/outputs over global state, boolean mode combinations, broad utility classes or plugin frameworks.
- **Use explicit failure states.** Distinguish unreadable source, oversized source, unsupported evidence, disputed/ambiguous attribution, and invalid record. Publishable status must exclude unresolved required evidence. Do not turn exceptions into empty successful results.
- **No new `any`, non-null assertions masking uncertainty, swallowed validation errors, or production debug logs.** CLI diagnostics are appropriate; redact credentials and unrelated machine details. Document invariant reasoning rather than restating code.
- **Keep costs and resource use bounded.** Every new model call and retry must go through reservation/settlement. Update step IDs, versioning, budgets and fixture responses if extraction becomes a separate paid step. Preserve the $4/run cap and record failed billed calls. Never hide extra calls behind a helper that bypasses accounting.
- **No unrelated dependency or architecture rewrite.** Reuse existing parsers where suitable. If adding an AST parser is the smallest reliable way to read rendered Markdown, justify its direct dependency and use a maintained installed-compatible version. Do not replace a working SSRF boundary with plain automatic-redirect `fetch`.
- **Tests assert behavior.** Pair known-valid examples with minimally altered invalid examples. Avoid snapshots that merely bless current bad output and assertions that only search source-code strings. New tests must run through `npm test`, not remain orphaned.

### Record/evidence contract

Define a small versioned evidence representation before implementing F1/F5. At minimum it should retain an evidence ID, source URL, bounded supporting excerpt, verification outcome/reason, retrieval time, and typed claim fields where applicable. Distinguish externally sourced facts, provider keyword metrics, proposed product assumptions, and deterministic derived calculations.

Use a source/excerpt digest where useful for replay and integrity checks. Hashes are not an authenticity proof, and changing a JSON boolean must not bypass the validator. Store enough bounded context for the validator and reviewer to understand entity/amount relationships. Do not commit complete third-party pages, access tokens, signed URLs, private cookies or machine-identifying logs. This must respect the existing citation/short-snippet storage policy.

If the contract changes incompatibly, version it explicitly. Legacy records may remain readable for historical purposes, but cannot silently acquire verified status or pass the new engine-publication gate. Give the operator a clear re-research/upgrade error. Do not bulk-rewrite gold pages or manually mark old claims verified.

## 3. Implementation sequence and checkpoints

| Checkpoint | Work | Required result before proceeding |
|---|---|---|
| A | Baseline, reproduction tests, evidence contract decision | Each finding has a concrete failing case; ownership and compatibility are documented |
| B | F4 + F7, including redirect hardening | Bounded, exception-safe source acquisition; existing SSRF tests remain green |
| C | F5 then F1 as one coherent evidence flow | Facts accepted before writing; rejected content never reaches the writer |
| D | F2 + F6 | Final MDX changes cannot invalidate quotes, attribution or arithmetic undetected |
| E | F3 | Existing seeded drafts disappear from discovery without losing member work |
| F | Integrated fixture replay, live evaluation, source inspection | All seven regressions fixed; final evidence and gates complete |

F3 may be delegated independently after reading the shared contracts. A security reviewer and final independent reviewer are useful. Never have multiple writers editing `pipeline.ts`, `research-record.ts`, the auditor, Convex schema/generated files, or lockfiles simultaneously. Keep delegation scoped to independent review, gate runs or isolated packages under repository rules.

## 4. F4 — Bound source downloads and concurrency

Primary area: `lib/engine/providers/sourceText.ts`, with the caller's source-fetch scheduling.

### Implementation

1. Define named limits with brief rationale. Suggested starting values: **2 MiB wire bytes per response, 2 MiB decoded bytes, four concurrent source requests, 15 seconds for the complete fetch operation including redirects, and the existing five-redirect maximum**. Tune only with evidence, keep finite limits, and record the final values. Avoid a new operator-facing configuration surface unless necessary.
2. Check Content-Length early when valid, but count actual streamed bytes regardless. Stop before retaining a chunk that exceeds the cap. Abort/destroy the request and response, release buffers/listeners, and reject with a typed size error. Do not download the complete body before checking it.
3. Decide compressed-content behavior explicitly. Request identity encoding if sufficient. If decoding gzip/br/deflate, bound decoded output as well as wire bytes; never decompress an unbounded body in memory. Unsupported encodings must fail clearly rather than yield misleading source text.
4. Bound concurrent citation reads across the acquisition stage. Deduplicate/cache identical reads within a run, including supplement searches. A URL appearing in market, competitor and community packs must not create unnecessary parallel downloads.
5. Use an operation deadline that covers DNS resolution, redirects and body transfer. A redirect must not reset the entire allowance. Ensure request cancellation cleans up underlying sockets and queued work.
6. Preserve address validation for the original URL, every redirect and the socket's DNS result. Retain private-address, IPv6 mapped-address and DNS-rebinding defenses.
7. Fix the related redirect credential issue in this change: strip Authorization/Cookie and other sensitive headers when the origin changes; reject authenticated HTTPS-to-HTTP downgrades. Never copy userinfo or bearer credentials into diagnostics. Only documented safe methods may follow redirects.

### Required tests

- Valid body below cap; exact cap; one byte over; huge declared Content-Length rejected before buffering.
- Oversized chunked body without Content-Length; misleading small Content-Length; stream exceeding the cap in a single chunk. Verify the underlying request/response is terminated.
- Compressed expansion if supported, otherwise deterministic unsupported-encoding failure.
- Maximum active requests never exceeds the selected concurrency; queued calls settle after cancellation.
- Slow body, stalled DNS and redirect chain time out under the whole-operation deadline.
- Existing private/metadata/IPv6/DNS-rebinding cases remain rejected.
- Cross-origin redirect receives no dummy bearer/cookie; authenticated downgrade rejects; allowed same-origin redirect still works.

Use a hermetic low-level transport seam or local test server with a test-only injected connection strategy. Do not weaken production SSRF checks to make local tests work.

## 5. F7 — Settle all transport failures safely

Primary area: the response completion path in `sourceText.ts`.

### Implementation

1. Respect null-body semantics for HEAD and statuses 204, 205 and 304. Handle no-content sources as unreadable for evidence purposes, never as verified content.
2. Catch response/header construction and decoding errors inside asynchronous callbacks and reject the returned promise. Do not install a process-wide uncaught-exception handler as the fix.
3. Handle response abort, premature close, socket error and timeout exactly once. Remove listeners and release buffers without creating an unhandled rejection or leaving a promise pending.
4. The pipeline may continue past a failed optional source only when enough other genuinely accepted evidence remains. The minimum evidence gate still fails closed.

### Required tests

- HTTP 205 yields no uncaught exception and settles promptly. Test the actual transport callback path; constructing a mocked Fetch Response bypasses the original bug.
- HEAD/204/304, empty 200, malformed headers/status where applicable, partial-body abort and socket error all settle.
- Child-process smoke for the 205 reproduction exits normally; test timeout catches hanging promises.
- One failed source plus sufficient valid evidence can proceed; insufficient valid sources stops with a useful error and no later paid call.

## 6. F5 — Ground whole claims, not numbers

Primary areas: the new evidence module, `pipeline.ts`, `research-record.ts`, fixtures and quality tests.

### Implementation

1. Replace bare-token membership as an acceptance criterion. Candidate evidence must identify a coherent source span and typed fields: subject/entity, metric, amount, currency/unit/magnitude, measurement date/period, and billing period/basis when relevant.
2. Validate the quoted supporting span against the fetched source text. Validate the amount and qualifiers together within its meaningful row/sentence/context. An extractor's assertion that a source says something is not sufficient.
3. Prefer bounded first-party pricing evidence. Any supported secondary-source fallback must identify itself, bind the named vendor to its own pricing statement, and remain visible to the operator. A roundup mentioning several vendors is not evidence that every price belongs to every vendor.
4. Preserve distinctions such as annual billing versus monthly billing, per-user versus per-workspace, introductory versus ongoing rates, starting prices versus fixed prices, and USD versus other currencies. Support a constrained documented grammar and reject ambiguity. Do not attempt a universal pricing-language parser.
5. Numeric normalization may accept `$1,400,000` and `$1.4 million` as equivalent with the same currency, subject and period. Converting annual price to monthly equivalent must be explicit derived arithmetic, retaining the annual-billing qualification; it cannot become a claim about a monthly plan.
6. Distinguish measured market statistics from source years, user counts, pricing numbers and projections. Prevent a year such as 2024 from grounding a market size. Do not silently turn projected market size into observed revenue.
7. Remove the fallback that credits a price merely because a sentence mentions both the vendor and that number. Require association to the correct entity. If the relationship cannot be validated, reject/research again rather than defaulting to true.
8. Fix the RFP.ai/DeepRFP source mix-up through genuine source identification and re-research. Never invent a unique URL solely to satisfy the duplicate-URL check.

### Required test matrix

| Source | Candidate | Expected |
|---|---|---|
| `$20,000/year` | `$20,000/month` | Reject |
| `$1.4 million` | `$1.4 billion` | Reject |
| `Published in 2024` | `$2024 billion` | Reject |
| Loopio `$20,000/year`; Qvidian `$30/month` in one sentence/table | Loopio `$30/month` | Reject |
| `EUR 30/user/month` | `USD 30/account/month` | Reject |
| `$24/user/month, billed annually` | `$24/month` with qualifier/basis lost | Reject |
| Explicit `$1,400,000` for the same metric/year | `$1.4 million` | Accept |
| Unchanged coherent vendor price and plan qualifiers | Same structured claim | Accept |
| Ambiguous comparative sentence or unparseable unit | Claim marked verified | Reject |

Run at least the first four through the complete fixture research pipeline, not only a helper. Assert a rejected claim cannot enter the returned publishable record. Include missing source, wrong citation and tampered evidence-ID cases.

## 7. F1 — Verify evidence before editorial synthesis

Primary areas: `pipeline.ts`, `pipeline-steps.ts`, provider fixtures, record parsing and compilation.

### Implementation

1. Separate candidate extraction from editorial writing. If extraction needs a model, use a bounded schema-only call through the existing provider interface. Its prose and verification flags are never trusted.
2. Validate community quotations and typed market/competitor claims against acquired sources. Apply minimums to accepted evidence, not citation count or readable-page count alone. Readability is an acquisition check, not verification.
3. Construct an explicit accepted-evidence bundle. Pass only this bundle, provider keyword metrics and the brief to the writing step. Do not include raw search answer prose, rejected source passages, extraction-generated summaries, or old unverified narratives as hidden context.
4. Have editorial output reference accepted evidence IDs for external factual claims. The compiler should render quantitative assertions and attributed quotations from their validated representation. Product suggestions and proposed business assumptions must be distinguishable from measured facts.
5. Reject unknown references and mismatched fact values at record parsing and compilation. Do not allow speculative editorial numbers to masquerade as source-backed market/customer facts. If prose contains factual material that cannot be bound reliably, reject/regenerate or surface it as unresolved; do not claim a regex can prove arbitrary prose truthful.
6. A failed claim must not return via `problemNarrative`, `community.summary`, `market.summary`, competitor notes, `whyNow`, prompts or fallback text. Review every consumer of those fields, not just blockquote generation.
7. Update pipeline versioning, provider-call accounting, cost reservations and test fixtures for the new order. Stop before optional costly downstream work when accepted evidence minimums cannot be met. Keep retries bounded and no more permissive on their second attempt.
8. Rebuild affected committed drafts from new valid records. Do not simply delete the incriminating paragraph or flip `verified` booleans in the existing JSON.

### Required tests

- Mixed input: at least two valid quotations plus the rejected `47 PRs / team of 8` and `60% / 25%` claims. Inspect the writing provider's captured input to prove rejected content and old narratives are absent.
- The complete research → parse → compile → audit flow either produces clean output without these assertions or fails closed. Check narrative, summaries and generated prompts as well as blockquotes.
- A mocked writer attempts to reference a rejected/unknown evidence ID or invent a metric: validation rejects it before a publishable record is written.
- A writer paraphrases an accepted qualitative claim without changing its factual meaning: legitimate output remains possible. Do not ban ordinary prose to make the test easy.
- Missing source provider and legacy unverified records cannot take a publishable shortcut. Fixture mode remains hermetic and explicitly marked.
- Too little accepted evidence stops before editorial synthesis; no keyword/model call occurs after the configured early-stop boundary.
- Any extra extraction call and retry is reflected in provenance and cannot exceed the existing cost cap.

## 8. F2 — Audit exact quotes and source identity

Primary areas: `scripts/audit-idea-mdx.mjs`, shared quote/evidence helpers, compiler and tests.

### Implementation

1. Parse Markdown blockquotes with their attribution links as one unit. Support the actual compiler's GFM format, multiline quotations and escaped characters. Do not lose URLs while stripping Markdown.
2. Require normalized complete-quote equality with an accepted record quotation for the initial repair. If excerpts are necessary, represent explicit verified excerpt spans; never use bidirectional substring matching.
3. Normalize only nonsemantic presentation differences such as supported whitespace/typographic quotation conventions. Preserve negation, numbers, order and meaningful punctuation. Ellipses may not join fragments into a different assertion.
4. Require the correct citation URL and evidence identity. URL normalization may handle explicit safe equivalences, but must preserve identity-bearing query values such as HN `item?id=`. Do not equate two pages because they share a hostname.
5. Reject missing, malformed or ambiguous attribution. Count distinct accepted quotation identities toward minimums; repeating the same quote does not create more evidence.
6. Use the same quote/source rules for persisted records and generated MDX. Operator prose polishing cannot edit the factual quotation block without creating and verifying new evidence.

### Required tests

- Original valid quote passes; appended fabricated sentence fails.
- Wrong URL fails even when the quote remains unchanged; same host/different thread fails; missing attribution fails.
- Changed number, inserted negation, reordered fragments and unsupported ellipsis fail.
- Supported Unicode/whitespace differences and legitimate multiline formatting pass.
- Duplicate reuse does not inflate the minimum verified-quote count.
- Run the reported mutations against a complete compiler-generated page and assert the **CLI exits nonzero**, not just an internal helper result.

## 9. F6 — Share exact financial calculations and validate the rendered result

Primary areas: record/year-one validation, a small pure financial calculation module, compiler and auditor.

### Implementation

1. Create one pure calculation that returns the base account count, monthly revenue basis, ARR and downside values from a validated plan. The compiler formats this output; the auditor independently extracts displayed values and compares them with the calculation.
2. Use integer cents or a documented exact decimal representation for money. Avoid silent floating-point or presentation rounding changes. Validate finite values, safe ranges and overflow before multiplication.
3. Require integer funnel/account counts and positive base paying accounts. Reject `0.4` rather than rounding it to zero. Funnel counts must be non-increasing and the final paying-account stage must agree with the plan; label an earlier stage honestly if it is trials rather than payers.
4. Adopt an explicit downside policy: integer accounts are `floor(baseAccounts / 2)` and may be zero. Remove the minimum-one clamp. Explain rounding for odd counts; downside may never exceed base revenue.
5. Validate tier identity and monthly revenue basis. If a `$20/developer/month` tier becomes `$100/account/month`, represent the five paid seats explicitly so the compiler/auditor can derive the amount. Treat the seat count and conversion funnel as assumptions, not measured market facts. Unsupported mixed-tier pricing must be modeled explicitly or rejected, not guessed.
6. Compare the actual rendered account count, monthly amount, ARR, tier and downside against the record. A correct hidden JSON record does not excuse wrong visible text. Reject conflicting or duplicate financial totals in the audited financial section.
7. Keep the record-to-MDX workflow editable for ordinary prose, while requiring regeneration or validation for factual/math blocks. Update the skill to make that distinction clear.

### Required tests

- `45 × $100/month` yields `$54,000 ARR`; downside is `22 × $100 × 12 = $26,400` under the documented rounding policy.
- `$24.99/month` retains cents and produces the exact appropriate total.
- Changing ARR to `$5,400,000` fails; independently mutate accounts, price, tier and downside and require failures.
- A one-account base has a zero-account downside; `0.4`, zero/negative base counts, NaN/Infinity and unsafe magnitudes reject.
- Per-seat assumptions resolve to their named tier; inconsistent revenue-per-account rejects.
- Test both helpers and the end-to-end CLI audit of mutated MDX. Preserve legitimate formatting variations deliberately supported by the renderer.

## 10. F3 — Make draft retirement work with existing data

Primary areas: `lib/engine-drafts.ts`, public Convex discovery queries, `convex/platform/catalogPolicy.ts`, member catalogue queries, seed/route integration, relevant tests.

### Implementation

1. Inventory every discovery path: public `/startup-ideas`, category/tool/audience/revenue hubs, related ideas, homepage manifest discovery, dashboard catalogue/search/facets, sitemap, and entry points for creating new plans. Identify which use Convex, the manifest, or generated slug lists.
2. Define one documented visibility predicate for this purpose. Engine-draft slugs are not discoverable or eligible for new public research entry points. Reuse a shared pure prefix rule where runtime boundaries permit it. Do not redefine all non-manifest legacy rows as drafts without evidence.
3. Enforce the rule server-side for discovery; UI filtering alone leaves API consumers and counts inconsistent. Keep the existing direct-page/sitemap/seed guards as defense in depth.
4. Preserve pagination semantics. Do not replace native pagination with an unbounded `.collect()`, a fixed first-N scan, or an invented cursor. If filtering an underlying page produces no visible items with `isDone: false`, consumers must continue correctly using the original continuation information. Preserve split/status metadata and native pagination options. Do not accidentally make later valid ideas unreachable.
5. Test ordering, search, facets and totals, not just one list endpoint. Decide and document whether counts describe visible results or another explicit domain; they must not advertise hidden drafts as readable ideas.
6. Preserve existing saves, notes, collections and weekend plans. Direct private access needed to retain historical member work must remain owner-scoped. If a saved draft no longer has readable research, present an honest unavailable/retired state without linking to a blocked page. Do not delete the member's work or silently archive plans.
7. Prefer runtime visibility enforcement that works immediately for already-seeded rows without production mutation. If stored visibility/backfill is unavoidable, supply an internal, bounded, dry-run-first reconciliation path, exact affected-row inventory, idempotency, rollback procedure and backend-before-frontend rollout instructions. Execute only against a disposable local backend during implementation.
8. Resolve the documentation conflict explicitly: the September 24 ruling kept these drafts public; this PR intends to retire them. Preserve that historical ruling and describe the new scoped behavior and deployment boundary. Do not silently rewrite history or claim production retirement happened during a code review.

### Required tests

- Seed the three existing engine drafts and ordinary ideas into a disposable fixture; rerun the ordinary seed without drafts. Confirm stored draft documents still exist but discovery APIs no longer return them.
- Query public archive, relevant hubs, related ideas, dashboard browse/search and affected counts after that reseed.
- Fill the first underlying page with hidden drafts and put a valid idea later. Traverse all pages: the valid idea remains reachable, no duplicate/skipped visible rows, and termination is correct.
- Existing member saves/plans/notes remain accessible to their owner; another user remains denied; no new broken research CTA is created.
- Unknown/engine-draft direct pages stay unavailable, sitemap/static slug output excludes drafts, and normal ideas still render.
- Verify with a local production build and an isolated backend, not the shared 3210 service or production. Record the exact environment and reset/cleanup procedure.

## 11. Integrated validation and real output quality

### Deterministic checks first

Run each story's targeted tests, then the full configured gate once the integrated code is stable:

```bash
npm run typecheck
npm run lint
npm test
npm run validate:idea-tags
npm run engine:eval
npm run build
npm run check:server-traces
npm audit --omit=dev --audit-level=high
git diff --check
```

Also run an explicit diff check against the PR merge base so preexisting-in-PR whitespace is not missed. The reviewed PR has two such lines in `artifacts/quote-gate-live-verification.md`; fix them without reformatting unrelated documents.

The 1,301-test baseline must not be shrunk to hide failures. Test count may change legitimately; explain removals/replacements. `engine:eval` currently audits handwritten gold pages and is **not** evidence of successful new engine output. Include a separate deterministic research → compile → deep-audit replay gate with saved bounded evidence. No live API keys in CI.

### Final live evaluation

After deterministic gates pass, run the representative `code-reviewer`, `rfp-assistant` and `landing-page-generator-ecommerce` briefs through the final code. Preserve each configured $4/run cap and bounded retries; record actual spend, source failures and attempts. Do not run an open-ended loop until one lucky sample passes.

Keep outputs in `engine/drafts/` with `engine-draft-*` slugs and explicit record paths. Never overwrite the published gold MDX, add evaluation drafts to the public manifest, seed them, or publish them just to test the engine. Record an auditable command for each research, compile and audit invocation.

For each brief, record: code SHA; brief hash; pipeline/record versions; provider/model identifiers; timestamp; cost and attempts; accepted/rejected evidence counts and reasons; record/output paths; compile result; deep-audit result; source-review result; and known limitations. Commit only appropriately bounded, redacted evidence if committing is authorized. Record the code revision separately from any later documentation/evidence-only commit.

Use **three successful representative briefs** as this repair's target, rather than silently treating one as sufficient. This is deliberately stronger than the older phase-7 document's one-brief minimum and addresses the two known failing samples. If that target cannot be met, finish all independent fixes, explain the remaining failure honestly, and return for review with that gate open. Do not invent an owner waiver or lower the source bar.

A provider outage or an inaccessible forum is a legitimate fail-closed outcome, but it is not a successful production-readiness example. Distinguish environmental limitations from implementation defects. Missing credentials leave live verification unverified; they do not justify fixture output being labeled live.

### Human/source inspection

For all three outputs, inspect every published competitor-price row and quantitative market claim against its cited source, plus at least two community quotations and all prior failed signals. Record source/claim agreement and any important qualification. A source excerpt matching does not establish that a vendor blog is independent customer evidence; label source type honestly.

Read the complete generated idea as an editor and prospective builder:

- Is there a specific buyer, costly problem and narrow weekend-sized first version?
- Are proposed product features clearly proposals, and revenue/funnel numbers clearly assumptions?
- Are prices current to the recorded retrieval date with currencies, billing bases and caveats intact?
- Do the build prompts match the actual product workflow, data model, authentication/ownership needs and pricing model?
- Is the writing useful without generic padding or duplicated prose? Keep the existing 2,200-word gate, but do not pad to reach it.
- Does the evidence support the claim actually made, without conflating vendor marketing, user anecdotes and measured research?

Render the resulting MDX through the actual MDX component or a disposable local preview harness. The public route deliberately blocks engine drafts: do not disable that guard for a screenshot. Use the local production build to verify normal public pages and draft rejection, and a nonpublishable harness to inspect new draft content. Check all eight headings, How-it-works, attribution links, financial lines, responsive layout and accessibility of any changed UI.

If code changes after a live run, rerun the affected evidence path and all relevant gates. If changes affect shared research/verification behavior, the prior three-brief results no longer certify the new revision. Documentation-only corrections do not require paid reruns.

## 12. Documentation and return package

Update the applicable WP stories/progress, engine contract/pipeline docs, eval report and canonical `.claude/skills/publish-idea/SKILL.md`. Ensure the local `.agents` skill copy/symlink follows the documented source of truth; do not force-track ignored tooling or modify the global home-directory skill.

The skill must describe actual behavior: accepted evidence before writing, incomplete evidence refusal, exact quotation attribution, auditable finances, legacy-record handling, draft visibility, human source checks and deployment order. Remove claims stronger than the implementation. Keep developer-only evidence details out of the public reader's UX.

Produce `docs/reviews/2026-10-01-pr71-remediation-results.md` (or a clearly dated successor) containing:

| Required field | What to include |
|---|---|
| Revision | Reviewed baseline, repaired code SHA and actual PR head |
| F1–F7 mapping | Root cause, exact repair, changed files, regression test names and results |
| Original red evidence | How each reproduction failed before the fix |
| Contract changes | New record/pipeline versions and legacy behavior |
| Security | Size/deadline/concurrency limits, SSRF preservation, redirects and exception-path evidence |
| Catalogue | Seeded-data reproduction, pagination, owner-data preservation, rollout/rollback |
| Checks | Commands, exit codes, test totals, warnings and artifact paths |
| Live matrix | All three briefs, attempts/cost, evidence paths, source-review outcome |
| Editorial assessment | Source credibility, factual caveats and weekend MVP feasibility |
| Remaining work | Explicit unresolved items; no empty “all good” claim without evidence |

The implementation summary returned to the owner should say which findings are fixed, which remain open, where to inspect the diff, how to replay the evidence, and what has not been run. Include whether anything was committed/pushed and confirm no merge or production activation occurred.

## 13. Final acceptance checklist

- [ ] F1: rejected evidence cannot leak through prose, summaries, prompts or fallbacks.
- [ ] F2: altered quotations and wrong attributions fail the final artifact audit.
- [ ] F3: previously seeded drafts are hidden from discovery; pagination and member work survive.
- [ ] F4: streamed bytes, decoded bytes where supported, concurrency and operation time are bounded.
- [ ] F5: currency/unit/magnitude/period/entity mismatches fail; valid equivalents pass.
- [ ] F6: visible base/downside math and tier assumptions match validated record calculations.
- [ ] F7: bodyless/error/abort paths settle without a crash or hanging promise.
- [ ] Related redirect credential and fractional-account edge cases are covered.
- [ ] New tests run in `npm test`; original bug reproductions now fail safely.
- [ ] The complete configured gate passes, with warnings and any limits reported honestly.
- [ ] Three final representative live outputs pass research, compilation, deep audit and source/quality inspection, or the remaining gate is explicitly open.
- [ ] Documentation and replayable evidence match the final code revision.
- [ ] No unrelated scope, production mutation, automatic publication or merge.
- [ ] Owner receives the results for an independent Codex review before deciding whether to merge.

Completing this checklist makes the change ready for a new review. The next reviewer still decides GO/NO-GO from the final code and evidence.
