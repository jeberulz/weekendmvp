# PR #71 remediation — evidence contract and work split (WP46)

Date: 2026-10-01. Status: **frozen for WP46 implementation**. Changes need an
orchestrator ruling recorded in `docs/wp/wp46-progress.md`.

Inputs: [remediation plan](pr71-remediation-plan.md),
[review](../../reviews/2026-10-01-pr71-idea-engine.md). Types in this document
are mirrored in `lib/engine/evidence/contract.ts` (types and constants only).
Where the two disagree, the TypeScript file wins and this document is fixed.

## 1. Versions

| Constant | Value | Meaning |
|---|---|---|
| `RESEARCH_RECORD_CONTRACT_VERSION` | `2` | Record shape below. v1 records are legacy. |
| `PIPELINE_VERSION` | `2` | Evidence is accepted before editorial writing. |
| `EVIDENCE_CONTRACT_VERSION` | `1` | Evidence item shape inside a v2 record. |

A v1 record stays readable through an explicitly named legacy reader for
history only. `parseResearchRecord` (the publish path: compile, audit, eval)
throws `LegacyResearchRecordError` for v1 with a re-research instruction. No
code path upgrades a v1 record or marks its claims accepted.

## 2. Pipeline order (PIPELINE_VERSION 2)

```text
0 brief_normalization   paid  synthesis
1 market_stats          paid  search
2 competitors           paid  search
3 community_signals     paid  search (primary + optional supplement, 2 requests)
  source_acquisition    unpaid  bounded, deduplicated reads of market, competitor
                                and community citations (one acquirer per run)
4 evidence_extraction   paid  synthesis, schema-only candidate extraction
  evidence_acceptance   unpaid  deterministic acceptance → accepted bundle
  ── early-stop boundary: minimums fail → stop, no keyword or writer call ──
5 keywords_demand       paid  keywordData (fail closed, unchanged)
6 editorial_synthesis   paid  synthesis; input = brief + accepted bundle + keywords only
7 provenance_parse      unpaid  validate editorial output, build + parse v2 record
```

Rules:

- Every paid attempt goes through the existing reservation/settlement runner.
  Billed failures are settled. The $4.00 cap (`REPORT_COST_CAP_USD`) is
  unchanged.
- `evidence_extraction`: at most 2 billable attempts (one provider retry).
- `editorial_synthesis`: at most 2 billable attempts **in total**, counting
  provider retries and one regeneration after validation failure. The
  regeneration input repeats the same accepted bundle plus the list of
  validation issues. It is never more permissive.
- Minimums apply to **accepted** evidence: ≥2 market stats, ≥3 competitors
  each with ≥1 accepted price, ≥2 distinct accepted community quotes
  (distinct = different normalized quote text). Readable-page counts remain an
  acquisition precondition for the supplement search only.
- The editorial input never contains search answer prose, raw page text,
  rejected candidates, extraction-model prose, or prior narratives.

## 3. Source acquisition (WP46-S1 delivers, WP46-S3 wires)

`lib/engine/providers/sourceText.ts` keeps `SourceTextProvider.fetchText(url)`
and adds typed failures:

```ts
export type SourceFetchErrorCode =
  | "oversized" | "timeout" | "no_content" | "http_status" | "blocked_address"
  | "redirect_rejected" | "too_many_redirects" | "unsupported_encoding"
  | "network" | "invalid_url";
export class SourceFetchError extends Error { readonly code: SourceFetchErrorCode; readonly status?: number }
```

Named limits (final values recorded in WP46 progress): 2 MiB wire bytes,
2 MiB decoded bytes, 15 s whole-operation deadline including DNS, redirects
and body, 5 redirects, 4 concurrent reads per run. HEAD and statuses 204, 205
and 304, and empty bodies, are `no_content`.

`lib/engine/acquire.ts` (new):

```ts
export type SourceStatus =
  | "read" | "unreadable" | "oversized" | "timeout" | "no_content" | "blocked"
  | "http_error" | "unsupported_encoding" | "redirect_rejected";
export type SourceRead =
  | { url: string; status: "read"; text: string; retrievedAt: string; textSha256: string }
  | { url: string; status: Exclude<SourceStatus, "read">; detail: string };
export function createSourceAcquirer(options: {
  sourceText: SourceTextProvider;
  concurrency?: number;            // default SOURCE_LIMITS.concurrency (4)
  keyOf?: (url: string) => string; // dedupe key; default URL href
  now?: () => Date;
}): {
  read(url: string): Promise<SourceRead>;      // never rejects
  readMany(urls: string[]): Promise<Map<string, SourceRead>>;
  snapshot(): SourceRead[];                     // every distinct URL attempted
};
```

`detail` is short, redacted (no credentials, no query secrets, no local paths).

## 4. Evidence items (`lib/engine/evidence/contract.ts`)

Raw candidates and accepted evidence are different types. Only
`acceptEvidence` (and the record parser's re-validation) construct
`AcceptedEvidence`. A JSON boolean or a model flag never grants acceptance.

```ts
export type EvidenceKind = "community_quote" | "market_stat" | "competitor_price";

export type Amount = {
  /** Decimal digits as written, no separators: "1.4", "20000", "24.99". */
  value: string;
  magnitude: "none" | "thousand" | "million" | "billion" | "trillion";
  unit: "currency" | "percent" | "count";
  /** ISO 4217, only for unit "currency". "$" alone is USD. */
  currency?: "USD" | "EUR" | "GBP" | "CAD" | "AUD";
};

export type PriceTerms = {
  amount: Amount;                                  // unit "currency"
  period: "month" | "year" | "week" | "day" | "one_time";
  basis: "flat" | "per_user" | "per_workspace";
  qualifiers: PriceQualifier[];                    // sorted, unique
};
export type PriceQualifier =
  | "billed_annually" | "billed_monthly" | "starting_at" | "introductory" | "plus_usage";

type EvidenceBase = {
  id: string;            // `${q|s|p}_${sha256hex(kind\nsourceUrl\nexcerpt\nclaimKey).slice(0,12)}` (ruling R1, §12)
  kind: EvidenceKind;
  sourceUrl: string;     // canonical (§5), a search citation, read at acquisition
  sourceTitle: string;
  excerpt: string;       // contiguous span of the source text, original characters
  excerptSha256: string; // sha256hex(excerpt)
  retrievedAt: string;   // from the source read
  attribution: "first_party" | "secondary" | "community";
};

export type CommunityQuoteEvidence = EvidenceBase & { kind: "community_quote" }; // quote === excerpt
export type MarketStatEvidence = EvidenceBase & {
  kind: "market_stat";
  subject: string;
  metric: "market_size" | "growth_rate" | "spend" | "user_count" | "adoption" | "other";
  amount: Amount;
  period: { kind: "measured" | "projected"; year?: number; toYear?: number };
};
export type CompetitorPriceEvidence = EvidenceBase & {
  kind: "competitor_price";
  vendor: string;
  plan?: string;
  price: PriceTerms;
};
export type AcceptedEvidence = CommunityQuoteEvidence | MarketStatEvidence | CompetitorPriceEvidence;
```

Limits: quote excerpt 6–80 words and ≤480 characters; stat/price excerpt
≤600 characters. Accepted items per kind are capped (quotes ≤8, stats ≤8,
prices ≤12) in deterministic order.

Rejections are operator-only and never reach the writer or compiler:

```ts
export type RejectionReason =
  | "invalid_candidate" | "unknown_citation" | "source_unreadable" | "source_oversized"
  | "source_timeout" | "source_no_content" | "span_not_found" | "span_bounds"
  | "internal_ellipsis" | "unparseable_amount" | "amount_mismatch" | "unit_mismatch"
  | "currency_mismatch" | "period_mismatch" | "basis_mismatch" | "qualifier_dropped"
  | "metric_unit_mismatch" | "projection_as_measured" | "year_not_in_context"
  | "subject_not_in_context" | "vendor_not_in_context" | "ambiguous_attribution"
  | "duplicate" | "over_cap";
export type RejectedEvidence = {
  kind: EvidenceKind;
  reason: RejectionReason;
  sourceUrl?: string;
  /** ≤120 chars of the candidate's own claim text, for the operator report only. */
  candidate?: string;
  detail?: string;
};
```

## 5. Shared domain rules (`lib/engine/evidence/*.ts`)

- **Citation identity** (`citation.ts`): `canonicalSourceUrl(url)` → http(s)
  only, no userinfo, lowercase host, default port and fragment removed,
  `utm_*`/`fbclid`/`gclid`/`ref` removed, other query parameters kept (HN
  `item?id=` stays identity-bearing), trailing slash removed except root. No
  `www.` folding. Two URLs are the same source only when canonical forms are
  equal. `vendorKey(name)` and `isFirstPartyHost(vendor, url)` live here.
- **Quotes** (`quote.ts`): source matching is word-level (Unicode letters and
  digits, case and punctuation insensitive) and **contiguous**. Leading or
  trailing ellipses are truncation marks and are stripped; an internal
  ellipsis is rejected. The accepted excerpt is the source's own characters
  for the matched span. Rendered-quote comparison is strict: NFC, typographic
  quotes/apostrophes/dashes folded, whitespace collapsed, MDX escapes undone,
  case, digits, order and other punctuation preserved, then whole-string
  equality. One module owns both the compiler's quote escaping and the
  auditor's unescaping.
- **Amounts and prices** (`amount.ts`): a documented constrained grammar.
  `$1,400,000` equals `$1.4 million` (same currency and unit). A bare year is
  never an amount. Ranges, "up to", unsupported currencies and multiple price
  expressions in one claim are unparseable. Period, basis and qualifiers are
  read from the expression and its clause. Prices compare on every field.
- **Acceptance** (`accept.ts`): candidate → accepted/rejected against the
  acquired source text of the candidate's own canonical URL, which must be a
  search citation. Stats: claimed amount equals a parsed expression in the
  supporting sentence; metric/unit agree; projection cues in that sentence
  forbid `measured`; a declared year must appear in that sentence; a subject
  content word must appear in it. Prices: candidate price terms equal the
  source expression's terms (qualifiers present in the clause must be
  claimed); first-party when the vendor key matches the source host,
  otherwise the claimed vendor must be the nearest vendor named in the
  price's own clause and no other candidate vendor may share that clause.
  Quotes: contiguous span in the source. Ambiguity rejects.
- **Editorial tokens** (`tokens.ts`): editorial text references evidence as
  `[[ev:<id>]]`. Unknown ids, rejected ids and kind mismatches are errors.
  `FACT_BEARING_FIELDS` may contain no digits outside tokens except a bare
  year 1990–2039 not adjacent to a currency, percent or magnitude. Spelled
  percentages ("sixty percent") are flagged. `renderEvidenceInline(item)`
  produces the canonical text for a token.
- **Finance** (`lib/engine/finance.ts`): integer cents, safe-integer checks,
  `floor(baseAccounts / 2)` downside that may be zero, seats explicit.

`FACT_BEARING_FIELDS` (no free figures): `brief.oneLiner`, `market.summary`,
`community.summary`, `whyNow`, `competitors[].notes`,
`goToMarket.positioning`, `goToMarket.pricingNotes`,
`editorial.problemNarrative`, `editorial.solutionNarrative`,
`editorial.competitiveNarrative`. Proposal fields (figures allowed, rendered
as proposals or assumptions): `howItWorks`, `editorial.dontBuildYet`,
`stackNotes`, `brandBrief`, `pricingTiers`, `unitEconomics`, `yearOne`,
`dataModel`, `goToMarket.channels`.

## 6. Candidate extraction (model output, untrusted)

```json
{
  "quotes": [{ "sourceUrl": "", "text": "copied contiguous span" }],
  "marketStats": [{ "sourceUrl": "", "supportingText": "copied sentence",
    "subject": "", "metric": "market_size", "amountText": "$1.4 million",
    "year": 2024, "periodKind": "measured" }],
  "competitorPrices": [{ "vendor": "", "sourceUrl": "", "supportingText": "copied text",
    "plan": "", "priceText": "$24/user/month, billed annually" }]
}
```

Unknown keys, prose and any `verified` flag are ignored. Typed fields come
from parsing `amountText`/`priceText` and the supporting text with the shared
grammar, never from the model.

## 7. Writer input and output

Input: brief context, the accepted bundle (id, kind, typed fields, rendered
canonical text, bounded excerpt, source title/URL, attribution), and provider
keyword rows. Output (JSON):

```json
{
  "oneLiner": "", "marketSummary": "", "marketStatIds": ["s_…"],
  "competitors": [{ "name": "", "priceIds": ["p_…"], "notes": "" }],
  "communitySummary": "", "quoteIds": ["q_…"],
  "goToMarket": { "positioning": "", "channels": [], "pricingNotes": "" },
  "whyNow": "", "howItWorks": ["Title — description"],
  "scores": { "opportunity": 0, "pain": 0, "timing": 0, "builderConfidence": 0, "execution": 0 },
  "editorial": { "productName": "", "dontBuildYet": "", "problemNarrative": "",
    "solutionNarrative": "", "competitiveNarrative": "",
    "pricingTiers": [{ "name": "", "price": "$20/developer/month", "includes": "" }],
    "unitEconomics": [{ "label": "", "value": "" }], "stackNotes": "",
    "audienceShort": "", "brandBrief": "",
    "yearOne": { "funnel": [{ "stage": "", "count": 0 }], "tier": "",
      "payingAccounts": 0, "seatsPerAccount": 1, "assumptions": "" },
    "dataModel": [{ "table": "", "columns": "" }] }
}
```

Competitor `name` must equal the vendor of every referenced price. Selected
ids must be accepted ids of the right kind. Validation failures go back to
the writer once (§2) and otherwise fail the run.

## 8. Record v2 (`ResearchRecordV2`)

```ts
type ResearchRecordV2 = {
  contractVersion: 2;
  pipelineVersion: 2;
  mode: "live" | "fixture";
  brief: ResearchBrief;                                    // unchanged
  evidence: {
    contractVersion: 1;
    accepted: AcceptedEvidence[];
    rejected: RejectedEvidence[];                          // ≤200, operator-only
    sources: SourceAcquisition[];                          // one per distinct URL attempted
  };
  market: { summary: string; statIds: string[] };          // ≥2
  competitors: Array<{ name: string; priceIds: string[]; notes?: string }>; // ≥3
  community: { summary: string; quoteIds: string[] };      // ≥2 distinct
  keywords: KeywordRow[];                                  // provider only, unchanged
  goToMarket: GoToMarket;
  whyNow: string;
  howItWorks: string[];                                    // ≥2
  scores?: ResearchScores;
  editorial?: EditorialFieldsV2;                           // yearOne is YearOnePlanV2
  provenance: {
    providerCalls: ProviderCall[]; costUsd: number; ranAt: string;
    models: { synthesis: string; search: string; keywordData: string };
    attempts: Record<string, number>;
  };
};
type SourceAcquisition = {
  url: string; roles: Array<"market" | "competitors" | "community">;
  status: SourceStatus; detail?: string; retrievedAt?: string; textSha256?: string;
};
type YearOnePlanV2 = {
  funnel: Array<{ stage: string; count: number }>;  // integers ≥1, non-increasing, ≥2 stages
  tier: string;                                     // a pricingTiers name with a parseable price
  payingAccounts: number;                           // integer ≥1, equals the last funnel count
  seatsPerAccount: number;                          // integer ≥1; must be 1 for a flat tier
  assumptions?: string;
};
```

The parser re-validates every accepted item offline: id and digests
recompute, the source is listed as `read` with a matching `retrievedAt`, and
the typed claim re-derives from its own excerpt under §5. Every selected id
resolves to an accepted item of the right kind; competitor names match their
prices' vendors; fact-bearing fields pass the token rule; yearOne passes the
finance rules; `mode` is explicit. Editing a boolean, an amount, an id or an
excerpt fails the parse.

## 9. Compiler and auditor

The compiler renders every factual block from the validated representation:
quote blockquotes (`> "…"` / `>` / `> — [title](url)`, every line prefixed),
market signal rows, competitor price rows (secondary sources labeled with
their host), inline tokens and Year-One Math (via `finance.ts`). Assumptions
and proposals are labeled as such in the page.

The auditor (CLI exits nonzero on any error) parses each blockquote together
with its attribution, requires strict equality with a selected accepted quote
and the exact canonical source URL, counts distinct quote identities, checks
competitor rows and market rows against their evidence, recomputes Year-One
Math with `finance.ts` (accounts, per-account amount, ARR, tier, downside,
no duplicate totals), flags unbound figures in The Problem, Market Research
and Competitive Landscape, and refuses legacy records.

## 10. Run report

`engine:research` writes a redacted JSON report on success **and** failure
(`--report`, default `<out>.report.json`): pipeline/record versions, mode,
brief slug and SHA-256, start/end times, failed step and redacted error,
provider calls (billed failures included), cost, attempts per step, models,
source acquisition statuses, accepted counts per kind, and rejected
`{kind, reason, sourceUrl, detail}`. No secrets, page bodies or machine paths.

## 11. Work split and single-writer boundaries

| Phase | Story | Owner | Exclusive files |
|---|---|---|---|
| 1 | S1 transport (F4, F7, redirects) | worker T | `lib/engine/providers/sourceText.ts`, `lib/engine/acquire.ts`, new transport/acquire tests; existing SSRF blocks in `quality.sources.test.ts` / `providers.test.ts` only if unavoidable |
| 1 | S2 evidence core | worker D | `lib/engine/evidence/{amount,quote,citation,accept,tokens}.ts`, `lib/engine/finance.ts`, their tests; `contract.ts` types may be extended, not changed |
| 1 | S5 catalogue (F3) | worker K | `convex/**` (no schema change without a ruling), `lib/engine-drafts.ts`, `scripts/seed-convex.mjs`, discovery consumers in `app/**`, `components/**`, `lib/home/**`, catalogue tests |
| 2 | S3 evidence-first pipeline (F5, F1) | worker P | `lib/engine/{pipeline,pipeline-steps,research-record,cost,providers}.ts`, `lib/engine/providers/{fixtures,pricing,types}.ts`, `scripts/engine-research.mjs`, `engine/briefs/**`, pipeline/record tests, `quality.pipeline.test.ts`, `quality.sources.test.ts` |
| 2 | S4 compiler and auditor (F2, F6) | worker A | `lib/engine/{compile,compile-write}.ts`, `scripts/{audit-idea-mdx,engine-compile,engine-eval}.mjs`, `scripts/lib/idea-quality.mjs`, compile/audit tests, `quality.compile.test.ts`, `package.json` scripts and lockfile if a parser dependency is justified |
| 3 | S6 integration, replay gate, docs, skill | worker I | cross-cutting cleanup after phases 1–2 merge |

## 12. Orchestrator rulings after freeze

- **R1 (2026-10-01, from S2): evidence id includes the typed claim.** Hashing
  only kind, URL and excerpt gave two claims from one sentence the same id, so
  "valued at X in 2024 and projected to reach Y by 2032" kept one stat.
  `claimKey` is `""` for quotes; `metric|unit|currency|value|magnitude|periodKind|year|toYear`
  for stats; `vendorKey|plan|unit|currency|value|magnitude|period|basis|qualifiers`
  for prices (qualifiers comma-joined, sorted). Subject text is excluded.
- **R2 (2026-10-01, from S2): projection cues scope forward.** A cue
  (expected, projected, forecast, will reach, anticipated, …) marks amounts
  that come **after** it in the same sentence. An amount is also projected
  when a "by/through/until/in <year>" phrase with a year later than the
  retrieval year directly follows it, or when its declared year is later
  than the retrieval year. "Valued at X in 2024 and projected to reach Y by
  2032, a CAGR of Z" gives X measured, Y and Z projected.
- **R3 (2026-10-01, from S2): compare quotes asymmetrically.** Rendered MDX
  uses `normalizeQuoteForCompare` (unescapes); record excerpts use
  `normalizeExcerptForCompare` (no unescape). `quoteMatchesExcerpt(mdx,
  excerpt)` is the one call the auditor uses.
- Known limitation kept: count amounts carry no noun; only the subject check
  binds "users" vs "developers".
- **R4 (2026-10-01, from S3 part 1): the record proves consistency, not
  authenticity.** A record holds no page text, so an excerpt replaced together
  with its claim, digest and id still parses. Authenticity comes from the
  deterministic replay gate (fixture sources) and, for live records, from the
  source inspection in S7 against the recorded `textSha256`/`retrievedAt`.
  `quality.test.ts` was split by owner: `quality.pipeline.test.ts` and
  `quality.sources.test.ts` (S3), `quality.compile.test.ts` (S4).

- **R5 (2026-10-01, from S4): a vendor's own site is not evidence for a
  rival's price.** A competitor price whose source is first-party for a
  different candidate vendor is rejected (`ambiguous_attribution`) at
  acceptance and in revalidation. Neutral secondary sources keep the clause
  binding rules. This removes the conflict between accepted secondary prices
  and the auditor's rule that a first-party pricing URL backs one competitor.

Phase 2 starts after S1 and S2 merge into `claude/wp46-pr71-remediation`.
Workers use their own `.worktrees/wp46-*` checkout and branch, commit locally,
never push, never merge, and never touch another worker's files. The
orchestrator merges.
