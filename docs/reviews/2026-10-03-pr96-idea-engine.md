# PR #96 independent review — Idea Engine remediation

Date: 2026-10-03. Lane: Gate. Decision: **NO-GO for closing remediation or merging the Idea Engine stack for release.**

Reviewed [PR #96](https://github.com/jeberulz/weekendmvp/pull/96), head `5f024a12ba134254620ecd8f55a14b0dadd3b9f7`, against its actual base `1c7240bdd30a4f6dff5d02eeab6d95fb36fc48df`. This is a draft PR into PR #71's branch, not into `main`. The review covered the seven-fix plan, changed implementation, adversarial evidence inputs, compiler/auditor behavior, draft retirement, source transport, and local gates. Independent quality, compiler and security review supported this report.

The repairs materially improve isolation, transport safety and arithmetic verification. However, four reproducible defects remain. The representative live gate also produced **zero pages from three briefs**. Passing automated checks does not establish that this engine produces trustworthy, usable research.

## Findings

### R1 — [P1] Bind a statistic's subject to the assertion containing its amount

Location: `lib/engine/evidence/accept.ts:971–980`.

Synthetic source text:

> The AI code review market was worth $1.4 million in 2024, while the unrelated gaming market was worth $9.4 billion in 2025.

Submit a market-stat candidate with subject `AI code review market`, metric `market_size`, amount `$9.4 billion`, measured year `2025`, and the full sentence as supporting text. `acceptEvidence` accepts it. `revalidateAcceptedEvidence` also returns success. `renderEvidenceInline` emits:

> $9.4 billion (AI code review market, market size, 2025)

The subject test searches the entire sentence independently of the matched amount's assertion. Matching the number, year and subject words somewhere in the sentence is insufficient: these facts describe different markets. The incorrect claim therefore enters the trusted evidence bundle and its canonical rendering. This probe verifies acceptance, stored-evidence revalidation and rendering; it does not claim a complete generated live page was produced.

Required repair: associate subject, metric, amount and period with one supported assertion. Conservatively reject ambiguous multi-subject sentences if a reliable association cannot be established. Use the same rule at initial acceptance and stored-record revalidation. Add negative cross-subject/cross-metric examples and positive examples for both genuine assertions in the source.

### R2 — [P1] Do not turn denied or historical prices into current affirmative prices

Location: `lib/engine/evidence/accept.ts:1359–1367`.

With a CodeRabbit first-party source URL, each of these synthetic source texts accepts the candidate `$30/user/month`:

- `CodeRabbit does not cost $30/user/month.`
- `CodeRabbit used to cost $30/user/month.`

Both survive stored-evidence revalidation and render as `$30/user/month (CodeRabbit)`. The context check handles comparison, name and billing cues but never establishes that the price is an affirmative, current assertion. The same loss of qualification occurs with `Macroscope costs approximately $152/month at the historical average.`, which renders an exact-looking `$152/month (Macroscope)`.

These are synthetic parser probes, not claims about these vendors' actual prices. Retaining an excerpt containing the qualification does not repair a canonical claim that drops it.

Required repair: reject negated, historical, hypothetical and estimated price assertions under the current exact-price contract. If the product needs those categories, represent and label them explicitly throughout the contract, writer input, rendering and audit before accepting them. Add acceptance and revalidation regressions, including an affirmative price that remains valid. Avoid expanding a collection of keyword exceptions without an explicit supported assertion grammar.

### R3 — [P2] Scope billing qualifiers to the price they modify

Location: `lib/engine/evidence/amount.ts:1019–1027`.

Synthetic source text:

> CodeRabbit costs $30 per developer per month, or $24 per developer per month when billed annually.

The false candidate `$30/user/month, billed annually` is accepted and survives revalidation. The unqualified `$30/user/month` candidate is rejected as `qualifier_dropped`. `readPriceAt` applies `clauseQualifiers(clause)` to each price in the clause, so the second offer's annual condition contaminates the first offer.

This is already disclosed in the implementation's remaining-work section. Disclosure does not close F5: the accepted evidence still states incorrect commercial terms.

Required repair: bind billing qualifiers to their price expression, or reject ambiguous multi-price clauses. Test monthly-versus-annual offers in both orders, distinct plan names, and shared versus local qualifiers. Ensure revalidation produces the same result as acceptance.

### R4 — [P2] Make valid compiled seat prices round-trip through the auditor

Location: `lib/engine/page-format.ts:442`; producer: `lib/engine/compile.ts:474–475`.

Change the valid fixture's Crew tier to `$20/developer/month (billed annually)` and retain its five seats per account. Record validation and compilation succeed. The compiler emits:

```text
45 × $100/mo = $54,000 ARR — Crew accounts paying by month 12 (5 seats × $20/developer/month (billed annually))
```

The untouched output fails the deep audit with `Year-One Math is missing its computed ARR line` and cascading errors. `BASE_LINE_RE` excludes parentheses from the seat-price capture (`[^()]+?`), while `seatPriceText` deliberately preserves a valid tier's original wording. Parenthesized monthly billing fails too; comma-separated billing passes.

Required repair: render a canonical seat-price representation accepted by the reader, or make the reader handle the supported nested form. Add a real parse → compile → deep-audit test for every supported billing presentation. Preserve the independently verified arithmetic-mutation failures.

## Original seven-fix disposition

| Original issue | Independent assessment |
|---|---|
| F1: rejected evidence contaminates writer narrative | Original path is substantially repaired: acceptance precedes writing and writer input is constrained. Invalid evidence accepted under R1–R3 remains a separate source of false output. |
| F2: altered quotes/source pass audit | Original appended-text and changed-source mutations now fail. |
| F3: seeded drafts remain discoverable | Server-side retirement filters and new-work guards are implemented; private saved work is retained. Source review and the relevant automated suites passed. This review did not deploy or repeat the disposable live-backend experiment. |
| F4: unbounded source responses | Limits, concurrency control and deduplication verified, including an oversized-body probe. |
| F5: numeric matching ignores meaning | **Not closed.** R1–R3 still accept incorrect semantic claims. |
| F6: displayed arithmetic not checked | Original altered-ARR probe now fails; fractional accounts are rejected. R4 is a new supported-input round-trip defect. |
| F7: HTTP 205 crashes | Bodyless response and premature-close probes settle without crashing or hanging. |

Cross-origin credential stripping, authenticated HTTPS downgrade rejection, and JSON-LD escaping also passed independent checks. No additional actionable security defect was established by those checks; this is not a claim of exhaustive security coverage.

## Delivery and design gates

The committed live reports show all three representative briefs failing at `evidence_acceptance`: each has accepted prices for only one distinct vendor where three are required. None reached the writer, compilation, deep audit or final editorial/render inspection. The offline replay is useful but cannot substitute for this missing end-to-end evidence. No paid provider calls were made during this review.

The principal design mismatch is between the supported price contract and the actual markets: contact-sales competitors, usage pricing, marketplace listings, billing toggles and fragmented HTML price cards. Decide explicitly which are supported. Do not meet the three-vendor minimum by inventing prices, silently dropping billing conditions or counting several plans from one vendor as different vendors. Any revised contract needs its own positive and adversarial fixtures, versioning where persisted meaning changes, and representative live reruns.

A separate, documented product limitation remains: `ideaHomeExtract` returns `tiers: []` for every engine idea (`lib/home/highlights.ts:89`), while weekly eligibility requires a tier (`lib/home/library.ts:91`). Consequently no engine idea can enter the weekly featured pool, even if its compiled page has valid proposed tiers. The Index still lists it. This follows the recorded rule and is not counted as a fifth accidental defect; confirm that this restriction matches the intended release, or provide a typed compiler-generated tier source without reintroducing lossy MDX extraction.

For maintainability, concentrate the next change on a small supported evidence grammar, explicit rejection results and shared contract tests. Avoid another broad rewrite. Acceptance, persistence validation and presentation need one meaning-preserving contract. Add table-driven round-trip and adversarial tests at these boundaries; passing the same helper twice cannot independently establish semantic truth.

## Verification on the reviewed head

Portable offline reproductions and captured outputs are in [evidence/pr96](evidence/pr96). From the repository root, run:

```sh
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON docs/reviews/evidence/pr96/evidence-repro.mjs
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON docs/reviews/evidence/pr96/compiler-repro.mjs
```

These review probes assert the **current broken behavior** to reproduce the findings; they are not desired-behavior regression tests. The compiler probe also checks a clean baseline and a valid comma-separated control. It creates and cleans up its own temporary audit files. Neither probe makes network calls.

| Check | Result |
|---|---|
| Locked install | `npm ci --ignore-scripts` passed |
| TypeScript | Passed |
| ESLint | 0 errors, 35 warnings |
| Full `npm test` | **2,173 passed** |
| Production build | Passed |
| Server traces after build | Passed |
| Engine replay | Passed; 3 quotes, 3 statistics and 3 prices accepted; 2,713 words; 2 verified quotes; 0 unbound figures |
| Engine evaluation | 3/3 existing handwritten gold pages passed; not a live-generation result |
| Idea tags | 225/225 passed |
| Production dependency audit | 0 vulnerabilities reported |
| PR diff whitespace check | Passed |
| New targeted probes | R1–R4 reproduced |

Full-suite count: OG 91; links 6; redirects 38 + 76; auth 85; security 82 + 86; sitemap 11; Convex 390; engine 1,021; home 42; platform 245. Correction to the earlier review: its 1,301 baseline total was a counting error; the original baseline was 1,201, followed by 1,202 at PR #71's next commit.

At review completion, the GitHub head remained `5f024a1`. Vercel and CodeRabbit reported success. The repository's GitHub quality workflow targets pull requests into `main`, so it is not a full hosted-CI gate for this stacked PR. The combined stack still needs verification against the current integration target before merge. No production state was changed, no repository code was fixed, and no GitHub review comment was posted. Documentation updated: this gate report and its local reproduction evidence only.

## Conditions for a new GO review

1. Repair R1–R4 with focused regressions that fail on this reviewed revision and pass on the repaired one. Keep the original quote, arithmetic, retirement and transport protections passing.
2. Resolve the live evidence-contract mismatch explicitly, then run all three representative briefs on the same repaired revision. Retain sanitized run reports, source provenance, records, compiled drafts, deep-audit output and costs. Inspect the actual prose and rendered pages for fidelity and usefulness; a failed-closed run is a safety success, not a completed generation.
3. Confirm the weekly-feature limitation is acceptable for the planned release, or repair the typed highlight contract and verify eligibility without weakening its completeness checks.
4. Reconcile the stacked changes with the current integration target and rerun required checks. Return the exact commit and a mapping from each finding to its fix and evidence. Keep publication paused pending the independent GO review.
