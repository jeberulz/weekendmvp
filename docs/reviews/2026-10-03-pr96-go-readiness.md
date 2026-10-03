# PR #96 GO-readiness repair and release gate

Date: 2026-10-03. Lane: WP54 work package, followed by release gate. PR: [#96](https://github.com/jeberulz/weekendmvp/pull/96), stacked into PR #71's branch. Repair branch: `codex/wp54-go-readiness`. Tested product code through `65755d9`; the final test-only type fix and evidence/report commit follow it. The original independent [review](2026-10-03-pr96-idea-engine.md) examined `5f024a1`.

**Decision: NO-GO for production activation or automated publication today.** The reviewed code defects are repaired and the deterministic gate is green, but the required same-revision three-brief live and human source-quality gate remains incomplete. The latest attempt stopped at the search provider with HTTP 401 `insufficient_quota`. It would be unsound to substitute older drafts or a fixture replay for that gate. PR #96 remains a draft for independent re-review; nothing in this work was merged, seeded, published or deployed to production.

## Review findings and actual repairs

| Finding | Repair and verification |
|---|---|
| R1: a statistic's subject could come from another assertion | Market-stat acceptance and stored revalidation now bind subject, metric, amount, period and year to the amount's assertion. Cross-subject and cross-metric probes that passed on the reviewed head fail; genuine two-claim sentences remain accepted. |
| R2: denied, historical, hypothetical or approximate prices appeared as current list prices | The current-offer grammar rejects these forms and retains valid affirmative prices. Initial acceptance and stored revalidation share it. |
| R3: annual-billing qualifiers leaked to a neighboring monthly offer | Offer-local qualifier binding handles both offer orders and distinct plans, rejecting unsupported qualifiers; regression tests cover acceptance and revalidation. |
| R4: valid parenthesized seat prices compiled but failed audit | Compiler and deep auditor agree on parenthesized monthly/annual terms while still checking seat multiplication and ARR; mutations still fail. |
| Live mismatch: three priced competitors were often unavailable | Contract v2 now models a verified first-party `contact_sales`, `usage_based` or `credit_pack` status separately from numeric prices. Three distinct sourced vendors remain required, including at least one numeric priced vendor. Official pricing and exact Shopify app listings are prioritized, and operator URL hints pass through the same public-only acquisition and evidence checks. |
| Source and prose quality exposed by live probes | Hacker News original posts precede child comments in bounded excerpts; public Discourse JSON posts are decoded to readable text. A copied statistic explicitly attributing another publisher is rejected, as are market figures cited from comparison roundups. The writer is directed toward original niche research, concrete buyer pain and supported numeric competitors. Compiler-generated homepage highlights now use validated proposed tiers, so eligible engine pages can enter the weekly feature pool. |
| Valid free-tier economics failed a later audit | The deep auditor accepts the exact short value `Free` for a proposed unit-economics row, still comparing the rendered row to the record and rejecting ordinary prose. A complete-page CLI regression covers it. |

The original F1–F7 protections from PR #96 remain in place: writer isolation from rejected evidence, quote/source mutation checks, server-side retirement of engine drafts, bounded public-only transport, meaning-preserving evidence claims, arithmetic audit, and settlement of bodyless HTTP responses. No independent security bypass was introduced by these repairs. This is a code review outcome, not a claim of exhaustive security assurance.

## Verification

- `npm test`: 2,209 passing tests, including the adversarial evidence, transport, compiler and deep-audit suites.
- `npm run typecheck`: passed after the production build completed. An initial parallel typecheck raced Next's generated `.next/types` and was rerun sequentially; a separate test-only nullable-field error was fixed.
- `npm run lint`: zero errors, 35 baseline warnings.
- `npm run build`: passed on Next 16.3.6; existing `middleware` deprecation notice.
- `npm run engine:replay`: fixture research → compile → deep audit passed. `npm run engine:eval`: 3/3 existing handwritten gold pages passed. Neither is a live-generation substitute.
- `npm run validate:idea-tags`: 225/225; `npm run check:server-traces`: passed; `npm audit --omit=dev --audit-level=high`: zero production vulnerabilities; `git diff --check` and diff against current `origin/main`: passed.
- Earlier combined-stack integration was tested against current `origin/main` at `b7c378f` with full tests, typecheck, build and server traces passing. The latest source/auditor changes have no merge conflict with that same main head by `git merge-tree --write-tree`. A final combined-stack run remains part of the independent GO gate after live evidence completes.

The saved [live evidence](evidence/wp54/live-go-20261003/source-inspection.md) distinguishes historical drafts from current accepted output. On `d378a93`, the code-reviewer brief produced a 3,445-word privately rendered draft with four directly relevant community quotes, three sourced competitors and two labelled broad-category projections. It passed the current deep audit after the narrow `Free` fix; all nine selected URLs and excerpts refetched unchanged. The RFP brief on that revision failed closed with only two distinct priced vendors, so DeepRFP's readable official pricing page was added as a fifth curated competitor URL. Shopify's earlier numeric-pricing draft is deliberately invalid under the new roundup-source rule and must be researched again from the original report source.

At clean `65755d9`, the next RFP attempt stopped before source acquisition with Perplexity HTTP 401 `insufficient_quota` after $0.0019 of normalization spend. A direct status-only provider probe confirmed that error type without logging the key. Thus there are **zero final-revision live records out of the required three**, and no permission to publish any saved preview. Earlier successful records cannot prove that the final source grammar and revised brief produce acceptable pages.

## Remaining GO conditions

1. Restore credit for the configured `PERPLEXITY_API_KEY` or replace it in the local secret store. Keep the key out of commits, logs and reports.
2. On one clean final revision, run the RFP, Shopify landing-page and code-reviewer briefs sequentially to avoid provider 429s. Each must stay under $4, produce a contract-v2 record, compile to a private `engine-draft-*` page, pass deep audit and static render, and have every selected statistic/price plus at least two quotes checked against the cited page and its original publisher. A genuine failure stays failed; do not hand-edit records to force a pass.
3. Inspect the prose for category fit, forecast labelling, buyer-pain relevance, plan-specific pricing and unsupported upstream attribution. Fix code or curated sources if a concrete defect recurs, then repeat the affected run on a clean revision. Require the normal human review before each eventual publication.
4. Re-run the final merge-stack gate and get an independent review of this updated PR. Then make the explicit release decision. PR #96 targets PR #71's branch, so merge order and PR #71's integration into `main` must be deliberate.

Docs updated: `docs/wp/wp54-stories.md`, `docs/wp/wp54-progress.md`, `docs/wp/RULINGS.md`, the evidence-contract and publish workflow guidance in earlier repair commits, this report and the private live evidence. Production activation is separate from this work package.
