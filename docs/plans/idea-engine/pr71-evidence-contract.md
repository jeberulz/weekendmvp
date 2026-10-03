# PR #71 remediation — evidence contract and work split (WP54)

Date: 2026-10-01. Status: **frozen for WP54 implementation**. Changes need an
orchestrator ruling recorded in `docs/wp/wp54-progress.md`.

Inputs: [remediation plan](pr71-remediation-plan.md),
[review](../../reviews/2026-10-01-pr71-idea-engine.md). Types in this document
are mirrored in `lib/engine/evidence/contract.ts` (types and constants only).
Where the two disagree, the TypeScript file wins and this document is fixed.

## 1. Versions

| Constant | Value | Meaning |
|---|---|---|
| `RESEARCH_RECORD_CONTRACT_VERSION` | `2` | Record shape below. v1 records are legacy. |
| `PIPELINE_VERSION` | `2` | Evidence is accepted before editorial writing. |
| `EVIDENCE_CONTRACT_VERSION` | `2` | Current evidence shape inside a v2 record; version 1 remains readable without availability items. |

A v1 record stays readable through an explicitly named legacy reader for
history only. `parseResearchRecord` (the publish path: compile, audit, eval)
throws `LegacyResearchRecordError` for v1 with a re-research instruction. No
code path upgrades a v1 record or marks its claims accepted.

## 2. Pipeline order (PIPELINE_VERSION 2)

```text
0 brief_normalization   paid  synthesis
1 market_stats          paid  search
2 competitors           paid  search (primary + up to two diversity supplements; three attempts total)
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
- `editorial_synthesis`: at most 3 billable attempts **in total** (ruling
  R13; originally 2), counting provider retries and regenerations after
  validation failure. Each regeneration repeats the same accepted bundle plus
  the list of validation issues. It is never more permissive.
- Minimums apply to **accepted** evidence: ≥2 market stats, ≥3 distinct
  competitors with price or first-party availability evidence (≥1 with a
  numeric price), ≥2 distinct accepted community quotes
  (distinct = different normalized quote text). Readable-page counts remain an
  acquisition precondition for the supplement search only.
- The editorial input never contains search answer prose, raw page text,
  rejected candidates, extraction-model prose, or prior narratives.

## 3. Source acquisition (WP54-S1 delivers, WP54-S3 wires)

`lib/engine/providers/sourceText.ts` keeps `SourceTextProvider.fetchText(url)`
and adds typed failures:

```ts
export type SourceFetchErrorCode =
  | "oversized" | "timeout" | "no_content" | "http_status" | "blocked_address"
  | "redirect_rejected" | "too_many_redirects" | "unsupported_encoding"
  | "network" | "invalid_url";
export class SourceFetchError extends Error { readonly code: SourceFetchErrorCode; readonly status?: number }
```

Named limits (final values recorded in WP54 progress): 2 MiB body bytes
(`maxBodyBytes`, renamed from `maxWireBytes`) plus a 4 MiB connection-byte
cap (`maxSocketBytes`: status lines, headers, chunk framing and body), 2 MiB
decoded bytes, 15 s whole-operation deadline including DNS, redirects
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
  price's own clause and no other candidate vendor may share that clause; a
  page on another known vendor's own host is never evidence for the price
  (ruling R5, §12). Quotes: contiguous span in the source. Ambiguity rejects.
- **Editorial tokens** (`tokens.ts`): editorial text references evidence as
  `[[ev:<id>]]`. Unknown ids, rejected ids and kind mismatches are errors.
  `FACT_BEARING_FIELDS` may contain no digits outside tokens except a bare
  year 1990–2039 not adjacent to a currency, percent or magnitude. Spelled
  percentages ("sixty percent") are flagged. `renderEvidenceInline(item)`
  produces the canonical text for a token.
- **Finance** (`lib/engine/finance.ts`): integer cents, safe-integer checks,
  `floor(baseAccounts / 2)` downside that may be zero, seats explicit.

Writer text rules (rulings R6 and R13 supersede the original split between
fact-bearing and proposal fields): every writer free-text field listed in
`WRITER_TEXT_FIELDS` (`lib/engine/evidence/contract.ts`) carries no free
figures, number words two and up, percent, currency or quoted spans; facts
enter only through evidence tokens; standard and version names on the R13
allowlist are names, not figures. The only numeric slots are
`NUMERIC_PROPOSAL_FIELDS` (tier price and includes, unit-economics values,
Year-One counts and seats, data model), and the page labels them as
proposals or assumptions. `FACT_BEARING_FIELDS` remains as a deprecated
alias of the same list.

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
    contractVersion: 1 | 2;                               // new runs write 2
    accepted: AcceptedEvidence[];
    rejected: RejectedEvidence[];                          // ≤200, operator-only
    sources: SourceAcquisition[];                          // one per distinct URL attempted
  };
  market: { summary: string; statIds: string[] };          // ≥2
  competitors: Array<{ name: string; priceIds: string[]; availabilityId?: string; notes?: string }>; // ≥3; ≥1 priced
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
quote blockquotes (`> "…"` / `>` / `> — [title](url)`), market signal rows,
competitor price rows (secondary sources labelled "(via host)"), evidence
tokens as linked canonical renderings, Year-One Math (via `finance.ts`), the
Sources list (exactly the used evidence sources) and the manifest highlights
block. Proposals and assumptions (How it works, what not to build, stack,
channels, pricing, unit economics, Year-One) carry labels on the page.
Compiled text is escaped once with the shared `escapeMdxText`, which also
stops GFM autolinks. Fixture-mode records compile only to `engine-draft-*` or
temp slugs, and the manifest stub records the research mode. Compiled pages
carry an `engine: true` frontmatter marker; the auditor applies the deep bar
when that marker, an `engine:*` manifest source, an `engine-draft-` slug or
`--record` says so (the site's loader reads only `title` and `publishedAt`).

The auditor (CLI exits nonzero on any error) refuses legacy and invalid
records and fixture records behind public slugs; parses each blockquote with
its attribution (strict quote equality, exact source URL and title, distinct
quote identities); checks competitor, market, keyword, tier and
unit-economics rows against the record; allows links only to used evidence
sources with their title or an item rendering as text; refuses quoted spans
outside verified quote blocks; runs the figure guard on every section with
node-level allowlists (linked renderings, verified rows, tier and
unit-economics values, Year-One lines, bare years, names) and on prompt
fences; refuses fenced code, footnotes, images and link definitions outside
the prompt section; recomputes Year-One Math and refuses other revenue
totals anywhere; and checks manifest highlights against the record. These
checks are guards on the final artifact, not proof that prose is true
(ruling R4, R6).

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
- **R5 (2026-10-01, from S4 via integration): a vendor's own site is not
  evidence for a rival's price.** A competitor_price candidate whose source
  URL is first-party for a different known vendor (any candidate vendor or
  vendor hint; at re-validation, any vendor named in the record) is rejected
  as `ambiguous_attribution`, with a detail naming the other vendor's site.
  Acceptance and offline re-validation apply the same rule
  (`lib/engine/evidence/accept.ts`), so a stored item that breaks it fails
  the record parse. Pages that are no known vendor's own site keep the
  clause binding rules above. This removes the conflict S4 reported: the
  auditor refuses a pricing URL that backs one competitor first-party and
  another as a secondary price, and acceptance can no longer produce that.
  Known limit: a host whose owner is not among the known vendors is treated
  as a neutral page.

- **R6 (2026-10-01, from the final review P1-1): writer text carries no free
  figures.** Every writer free-text field is figure-free except inside
  evidence tokens: `brief.oneLiner`, `market.summary`, `community.summary`,
  `whyNow`, `competitors[].notes`, `goToMarket.positioning`,
  `goToMarket.pricingNotes`, `goToMarket.channels[]`, `howItWorks[]`,
  `editorial.{productName, audienceShort, problemNarrative, solutionNarrative,
  competitiveNarrative, dontBuildYet, stackNotes, brandBrief}`,
  `unitEconomics[].label`, `yearOne.funnel[].stage` and `yearOne.assumptions`.
  The only numeric proposal slots are `pricingTiers[].price`,
  `pricingTiers[].includes`, `unitEconomics[].value`, the yearOne counts and
  seats, and `dataModel` columns; the page labels them as proposals or
  assumptions. A figure is, after NFKC normalisation: any Unicode decimal
  digit run (`\p{Nd}`) that is not part of a letter-adjacent name (B2B,
  GPT-4o) and is not a bare year 1990–2039 away from a currency, percent or
  magnitude; a standalone number word two–nineteen, twenty–ninety (with
  compounds), hundred, thousand, million, billion, trillion, dozen(s); or
  percent/per cent. A double-quoted span (straight or typographic quotes,
  « ») of three or more words in writer text is an error: quotations reach
  the page only through quote evidence. It remains a guard, not proof.
- **R7 (2026-10-01, from P2-4): a token renders its claim, not only its
  figure.** `renderEvidenceInline` names the subject and metric of a stat and
  the vendor (and plan) of a price; the compiler and auditor always call it
  rather than duplicating text. `competitors[].notes` may cite only that
  competitor's own prices; fields may restrict token kinds.
- **R8 (2026-10-01, from P2-6/P3-15): quotes are whole statements from
  community sources.** A community quote must come from a source cited by the
  community search, start at a sentence start and end at a sentence end,
  and not cross a line break of the extracted source text (comments and
  blocks are separated by line breaks). Two quotes are distinct only when
  neither normalized text contains the other.
- **R9 (2026-10-01, from P2-3/P2-5): binding is per claim.** A price clause
  with a comparison cue (unlike, than, instead of, rather than, versus/vs,
  compared, alternative(s), competitor(s), switch from) is rejected; a plan
  name binds only on the price's own line or the line directly above it and
  never after "everything in"/"all of"/"includes"; when the price's block
  shows both monthly and annual billing cues and the clause states neither,
  the price is rejected as ambiguous billing. A stat subject is figure-free,
  link-free and markup-free, and every subject content word must occur in
  the amount's sentence; the metric must agree with cue words in that
  sentence.
- **R10 (2026-10-01, from S-P2b, P2-2, P2-7, P2-9, P3-11): the page holds
  only audited facts.** The auditor fails: any body link whose target is not
  a used evidence source; a link to an evidence source whose text is neither
  that source's title nor an inline rendering of one of its items; an
  attribution title other than the source title; a double-quoted span of
  three or more words outside verified quote blocks; any figure outside the
  allowlisted blocks in any section (evidence renderings, keyword rows, tier
  rows equal to the record, unit-economics values, the Year-One block, bare
  years, names); fenced code, footnotes or HTML outside the prompt section;
  figures in prompt fences other than record values and renderings; a
  Year-One-style line or a money total beside revenue wording outside the
  Year-One block; a relabelled evidence row; a Sources list that differs from
  the used evidence sources; manifest highlights on an engine row that are
  not generated from the record. Compiled text is escaped so bare URLs and
  emails cannot autolink.
- **R11 (2026-10-01, from P2-8): fixture output stays out of publishing.**
  The fixture brief's slug matches no published idea; `engine-compile` and
  the auditor refuse a `mode: "fixture"` record unless the page slug is an
  `engine-draft-*` or temp slug (or an explicit test-only flag); the
  manifest stub records the research mode.
- **R12 (2026-10-01, from P3-7): the run report names the code revision.**
  `ResearchRunReport.codeRevision = { sha: string | null; dirty: boolean | null }`.

- **R13 (2026-10-02, from the re-reviews): realistic writer text, one rule
  set.** Standard and version names are not figures — one allowlist in
  `tokens.ts` shared by parser and auditor: SOC 1/2/3, ISO and ISO/IEC
  numbers, PCI DSS / WCAG / OAuth / TLS / SSL / HTTP versions, IPv4/IPv6,
  24/7, Microsoft/Office 365, US tax forms (Form 1099, W-2, W-9), and
  version numbers after a curated list of software names (Next.js, React,
  Node, Postgres/PostgreSQL, MySQL, Python, Ruby, Rails, Django, Vue,
  Angular, Svelte, Tailwind, TypeScript, Swift, Kotlin, Java, PHP, iOS,
  Android, macOS, Windows, Ubuntu, Claude, GPT, Gemini, Llama, Mistral).
  Digits inside snake_case identifiers are names. Otherwise R6 stands, and
  it gains: quoted spans in single typographic quotes, single guillemets,
  corner brackets and straight single quotes at word boundaries; any
  currency symbol outside a token; and sub-/top-/under-/over-/up-to-N
  hyphen forms. The parser also applies the auditor's revenue-total and
  quoted-span rules to the numeric proposal slots, so a run regenerates or
  fails at parse, never only at the final audit. The writer gets up to three
  billable attempts in total (same rules each time, plus the issue list);
  the pinned worst case stays under $4.00.
- **R14 (2026-10-02): binding follows the page's structure.** A line break
  starts a sentence only after terminal punctuation or at a blank line, and
  HN/Reddit comment bodies are joined by blank lines. On every page the
  claimed vendor (or its own plan name) must be the nearest brand-like name
  before the price in its clause; a nearer capitalised brand token that is
  not a plan or common word rejects the claim; vendor hints include
  candidate vendors and names from citation titles and hosts; the cue list
  adds moved/move to, migrated/migrate to, after, over and replaced by.
  Billing toggles are page-scoped: a standalone toggle line (only billing
  words such as Monthly, Yearly, Annually, Billed monthly/yearly, optionally
  "save N%") anywhere above a per-month price requires an explicit billing
  qualifier in that price's clause; ordinary feature lines that mention
  "annual" do not count; a plan named after "from", "upgrade from" or
  "than" never binds.
- **R15 (2026-10-02): untrusted text and URLs.** Citation titles must be at
  most 120 characters, figure-free, link-free and free of bidi or invisible
  format controls, otherwise the source's host label is used; the parser
  enforces it. Excerpts and any record text containing bidi or invisible
  format controls (U+061C, U+200B–U+200F, U+202A–U+202E, U+2060–U+2064,
  U+2066–U+2069, U+FEFF) are rejected. A citation whose path or query holds
  an opaque credential-like value (the `redactUrl` detectors) is refused,
  and the run report lists each refused citation by host and reason. For
  engine rows the homepage uses generated highlights only (no MDX-parser
  fallback), the MDX parser skips Year-One lines, and plain-text extraction
  unescapes compiled MDX.

- **R13–R15 implementation notes (2026-10-03, accepted).** The R14
  line-break rule applies to quote sentences only; stats and prices treat
  each line as its own sentence so a claim never binds across table lines.
  "after", "over" and "replace(d)" are cues only directly before a
  capitalised brand ("$30/month after the free trial" stays valid), and a
  different brand right after "for" behind a price rejects it. A brand-like
  word is any capitalised word not on the common-word, plan and pricing
  vocabulary lists and not an all-caps abbreviation; this fails closed (e.g.
  "GitHub App: $24/month" is rejected). Price-less lines that state annual
  billing ("All plans are billed annually.") count page-wide like toggles;
  another plan's billing qualifier counts only within the price's own block
  (its line and three lines above). The quoted-span rule also covers
  data-model column text. Credential-like URL values are 16+ characters
  mixing letters and digits that do not read as a slug, so opaque ids such
  as Google Docs ids and UUID paths are refused too. The run report carries
  `refusedCitations` (host and reason only).

- **R16 (2026-10-03, from the compiler fixer's timing work): bounded audit
  input.** Every regex the auditor and base bar own runs in linear time
  (timing tests in `lib/engine/audit.redos.test.ts`). The third-party MDX
  parser is quadratic on some character runs, so the auditor refuses an MDX
  file larger than 64 KiB before parsing it (the largest published idea page
  is about 25 KB; compiled engine pages are about 20 KB).

- **R16 implementation notes (2026-10-03).** The 64 KiB cap is checked from
  the file size (`auditIdeaFile`: CLI `--file`, `--slug`, `--all`) and the
  body's byte length (`auditEngineArtifact`) before anything is read or
  parsed. The cap alone does not bound the parser: within one block (lines
  with no blank line between them) it resolves emphasis, strikethrough and
  link brackets in quadratic time, and its GFM table step is quadratic in
  the page's table lines. Just under 64 KiB, alternating delimiters ("*_",
  "_a*") took it 15-41 s (the audit CLI 19 s on the security reviewer's
  probe), strikethrough pairs ("~_") as long, a run of "]" about 40 s, and
  256 small tables 25 s; compiled engine text cannot produce these (its
  escaped forms parse in about 0.1 s). So `auditComplexityError` also
  refuses, in one linear pass before parsing, a block with more than 1,024
  unescaped emphasis or strikethrough delimiters (`*`, `_`, `~`), more than
  1,024 unescaped brackets or more than 16 KiB, and a page with more than
  1,024 lines that hold an unescaped `|`. On the published pages the largest
  block is about 3.2 KB with at most 124 delimiters and 52 brackets, and no
  page has more than 20 lines with a `|`, so `npm run audit:idea -- --all`
  keeps every verdict (196/225). Within these bounds the slowest page
  measured takes about 1 s through the audit CLI (lists in 16 KiB blocks); a
  refused page returns in about 0.2 s.

- **R13 amendment (2026-10-03, round 6, accepted by the orchestrator).** A
  number after a versioned software name, or after PCI DSS / WCAG / OAuth /
  TLS / SSL / SAML / SCIM, is a version only when it has at most two integer
  digits with optional decimal parts (15, 3.5, 24.04, 22.11.0); a software
  version followed by a count noun (optionally after one or two count
  modifiers: "Node 22 active users", "React 19 developers") is a figure.
  Fixed-number standards (SOC 2, ISO 27001, Form 1099, Microsoft 365, 24/7)
  match exactly. SAML and SCIM versions and "two-factor" join the allowlist
  ("two factors" still counts). The writer instruction lists exactly these
  names, built from the same constants, and tells the writer to drop any
  other number in a name (Claude Sonnet 4.5, Redis 7, Fortune 500). A live
  brief's title and audience may hold no figure (the writer echoes both);
  the CLI refuses such a brief before the first paid call.

- **R17 (2026-10-03, PR #96 GO repair): availability is evidence, not a price.**
  Evidence contract version 2 adds `competitor_availability` with a first-party
  citation, a source excerpt and exactly one status: `contact_sales`,
  `usage_based` or `credit_pack`. Acceptance requires the vendor's own
  non-comparison page, an explicit cue in a single bounded sentence, pricing
  context and no other known vendor named there. Stored items re-derive the
  status and hash; version 1 records without this kind stay readable. The
  minimum is three distinct vendors with accepted price or availability,
  including at least one vendor with an accepted numeric price. A competitor
  row has numeric `priceIds` or one `availabilityId`, never both. The compiler
  and final auditor render and verify the status as a linked statement, without
  implying a numeric price. Shopify app prices count as secondary only when
  the listing slug exactly identifies the vendor. Generated homepage
  highlights may show these availability labels; proposed product tiers come
  from validated `editorial.pricingTiers`, not parsed MDX or competitor prices.
  The per-report cost cap and pre-editorial fail-closed gate are unchanged.

- **R18 (2026-10-03, live Shopify evidence):** A Shopify single-app listing
  also identifies a vendor when the listing slug and longer product name begin
  with the same distinctive brand token of at least four characters. Generic
  category tokens (for example `page`, `landing`, `builder`) cannot identify a
  vendor. The price must still pass exact amount, billing and comparison checks;
  attribution remains secondary and the final page names Shopify as the source.

- **Acquisition clarification (2026-10-03, live RFP probe):** The conditional
  competitor supplement counts distinct official pricing pages or single-app
  marketplace listings. A vendor-owned comparison page, blog, glossary or
  third-party profile is not a pricing-source slot merely because its domain
  belongs to a vendor. The three-attempt search budget remains unchanged.

- **R17 acquisition amendment (2026-10-03, first live GO probe).** When the
  initial competitor search cites fewer than three distinct vendor-owned
  sites, one supplement search seeks other official pricing domains and the
  missing pricing pages of named vendors. The competitor step permits at most
  three billable attempts total, including any provider retries; worst-case
  total run reservation is $3.972 under the unchanged $4 cap. A competitor
  source excerpt reserves room for one explicit availability sentence as well
  as numeric-price passages. The extractor copies one offer into each
  `priceText` even if its supporting passage describes multiple billing
  alternatives; it never combines alternatives into a fabricated term.

- **Acquisition/extraction clarification (2026-10-03, later live probes).** The
  final competitor search, after an initial supplement, may seek a fourth
  distinct official pricing source as a buffer because citation does not imply
  a parseable offer. A transient failure of this optional search does not
  discard three already cited sources. It excludes only vendor domains already
  represented by an official pricing page; a vendor seen only in a blog may
  still be targeted for its missing pricing page. Within the bounded extraction prompt, canonical
  pricing pages precede competitor blogs and roundups. An availability excerpt
  favors a plan-specific price or quote statement over a site-wide contact
  button. These are source-acquisition priorities, not evidence shortcuts:
  every chosen item still needs exact retrieved-page binding and the same
  three-vendor, one-numeric-vendor minimum. First-party comparison-page prices
  and availability are rejected before the writer, matching the artifact
  audit's existing roundup-link rule. Search, extraction and editorial prompts
  prioritize the product's niche and concrete buyer pain over adjacent markets
  or maker commentary.

Phase 2 starts after S1 and S2 merge into `claude/wp54-pr71-remediation`.
Workers use their own `.worktrees/wp46-*` checkout and branch (named before the WP54 renumbering), commit locally,
never push, never merge, and never touch another worker's files. The
orchestrator merges.
