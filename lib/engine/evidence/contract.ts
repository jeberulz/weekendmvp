/**
 * Evidence contract for research records v2 (WP54, PR #71 remediation).
 *
 * Types and constants only. `docs/plans/idea-engine/pr71-evidence-contract.md`
 * explains the rules; this file is the source of truth for the shapes.
 *
 * Candidates are untrusted model output. Only the deterministic acceptance
 * code (and the record parser's offline re-validation) may construct an
 * `AcceptedEvidence` value; a JSON boolean or a model flag never does.
 */

import type {
  DataTable,
  GoToMarket,
  KeywordRow,
  PricingTier,
  ProviderCall,
  ResearchBrief,
  ResearchScores,
  UnitEconRow,
} from "../research-record.ts";

export const RESEARCH_RECORD_CONTRACT_VERSION_V2 = 2 as const;
export const PIPELINE_VERSION_V2 = 2 as const;
export const EVIDENCE_CONTRACT_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Source acquisition
// ---------------------------------------------------------------------------

export type SourceStatus =
  | "read"
  | "unreadable"
  | "oversized"
  | "timeout"
  | "no_content"
  | "blocked"
  | "http_error"
  | "unsupported_encoding"
  | "redirect_rejected";

export type SourceRole = "market" | "competitors" | "community";

/** One distinct URL the run tried to read. Bodies are never stored. */
export type SourceAcquisition = {
  url: string;
  roles: SourceRole[];
  status: SourceStatus;
  /** Short, redacted reason when status is not "read". */
  detail?: string;
  /** ISO time of a successful read. */
  retrievedAt?: string;
  /** sha256 hex of the extracted source text, for replay checks. */
  textSha256?: string;
};

// ---------------------------------------------------------------------------
// Amounts and prices
// ---------------------------------------------------------------------------

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export type Magnitude = "none" | "thousand" | "million" | "billion" | "trillion";

export type Amount = {
  /** Decimal digits as written, without separators: "1.4", "20000", "24.99". */
  value: string;
  magnitude: Magnitude;
  unit: "currency" | "percent" | "count";
  /** Present only when unit is "currency". A bare "$" is USD. */
  currency?: CurrencyCode;
};

export type PricePeriod = "month" | "year" | "week" | "day" | "one_time";

export type PriceBasis = "flat" | "per_user" | "per_workspace";

export type PriceQualifier =
  | "billed_annually"
  | "billed_monthly"
  | "starting_at"
  | "introductory"
  | "plus_usage";

export type PriceTerms = {
  /** unit is always "currency". */
  amount: Amount;
  period: PricePeriod;
  basis: PriceBasis;
  /** Sorted and unique. */
  qualifiers: PriceQualifier[];
};

// ---------------------------------------------------------------------------
// Evidence items
// ---------------------------------------------------------------------------

export type EvidenceKind = "community_quote" | "market_stat" | "competitor_price";

/**
 * Id prefix per kind:
 * `${prefix}_${sha256hex(kind\nsourceUrl\nexcerpt\nclaimKey).slice(0, 12)}`, where
 * claimKey serializes the typed claim (contract §12, ruling R1).
 */
export const EVIDENCE_ID_PREFIX: Record<EvidenceKind, "q" | "s" | "p"> = {
  community_quote: "q",
  market_stat: "s",
  competitor_price: "p",
};

export type EvidenceAttribution = "first_party" | "secondary" | "community";

export type EvidenceBase = {
  id: string;
  kind: EvidenceKind;
  /** Canonical citation URL; a search citation that was read at acquisition. */
  sourceUrl: string;
  sourceTitle: string;
  /** Contiguous span of the source text, in the source's own characters. */
  excerpt: string;
  /** sha256 hex of `excerpt`. */
  excerptSha256: string;
  /** Copied from the source read. */
  retrievedAt: string;
  attribution: EvidenceAttribution;
};

/** The quote is the excerpt. */
export type CommunityQuoteEvidence = EvidenceBase & {
  kind: "community_quote";
  attribution: "community";
};

export type MarketStatMetric =
  | "market_size"
  | "growth_rate"
  | "spend"
  | "user_count"
  | "adoption"
  | "other";

export type MarketStatEvidence = EvidenceBase & {
  kind: "market_stat";
  subject: string;
  metric: MarketStatMetric;
  amount: Amount;
  period: { kind: "measured" | "projected"; year?: number; toYear?: number };
};

export type CompetitorPriceEvidence = EvidenceBase & {
  kind: "competitor_price";
  attribution: "first_party" | "secondary";
  vendor: string;
  plan?: string;
  price: PriceTerms;
};

export type AcceptedEvidence =
  | CommunityQuoteEvidence
  | MarketStatEvidence
  | CompetitorPriceEvidence;

export const EVIDENCE_LIMITS = {
  quoteMinWords: 6,
  quoteMaxWords: 80,
  quoteMaxChars: 480,
  excerptMaxChars: 600,
  maxAccepted: { community_quote: 8, market_stat: 8, competitor_price: 12 },
  maxRejectedStored: 200,
  rejectedCandidateChars: 120,
} as const;

export const EVIDENCE_MINIMUMS = {
  marketStats: 2,
  pricedCompetitors: 3,
  distinctQuotes: 2,
} as const;

// ---------------------------------------------------------------------------
// Rejections (operator-only; never reach the writer or the compiler)
// ---------------------------------------------------------------------------

export type RejectionReason =
  | "invalid_candidate"
  | "unknown_citation"
  | "source_unreadable"
  | "source_oversized"
  | "source_timeout"
  | "source_no_content"
  | "span_not_found"
  | "span_bounds"
  | "internal_ellipsis"
  | "unparseable_amount"
  | "amount_mismatch"
  | "unit_mismatch"
  | "currency_mismatch"
  | "period_mismatch"
  | "basis_mismatch"
  | "qualifier_dropped"
  | "metric_unit_mismatch"
  | "projection_as_measured"
  | "year_not_in_context"
  | "subject_not_in_context"
  | "vendor_not_in_context"
  | "ambiguous_attribution"
  | "duplicate"
  | "over_cap";

export type RejectedEvidence = {
  kind: EvidenceKind;
  reason: RejectionReason;
  sourceUrl?: string;
  /** At most `EVIDENCE_LIMITS.rejectedCandidateChars` of the candidate's claim. */
  candidate?: string;
  detail?: string;
};

// ---------------------------------------------------------------------------
// Candidate extraction (untrusted model output, after JSON shape checks)
// ---------------------------------------------------------------------------

export type QuoteCandidate = { sourceUrl: string; text: string };

export type MarketStatCandidate = {
  sourceUrl: string;
  supportingText: string;
  subject: string;
  metric: MarketStatMetric;
  amountText: string;
  year?: number;
  periodKind: "measured" | "projected";
};

export type CompetitorPriceCandidate = {
  vendor: string;
  sourceUrl: string;
  supportingText: string;
  plan?: string;
  priceText: string;
};

export type ExtractionCandidates = {
  quotes: QuoteCandidate[];
  marketStats: MarketStatCandidate[];
  competitorPrices: CompetitorPriceCandidate[];
};

// ---------------------------------------------------------------------------
// Editorial references
// ---------------------------------------------------------------------------

/**
 * `[[ev:<id>]]` inside editorial text. Not global: build a `g` copy with
 * `new RegExp(EVIDENCE_TOKEN_RE.source, "g")` so no caller shares lastIndex.
 */
export const EVIDENCE_TOKEN_RE = /\[\[ev:([qsp]_[0-9a-f]{12})\]\]/;

/**
 * Ruling R15: invisible and bidirectional format controls no record text
 * may hold — U+061C, U+200B–U+200F, U+202A–U+202E, U+2060–U+2064,
 * U+2066–U+2069 and U+FEFF — since they can reorder or hide what a reader
 * sees (an excerpt that renders "$500" while holding "005$").
 */
export const FORMAT_CONTROL_RE = /[\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u;

/** The first format control in `text`, as "U+202E", or null (ruling R15). */
export function formatControlIn(text: string): string | null {
  const m = FORMAT_CONTROL_RE.exec(text);
  const code = m?.[0].codePointAt(0);
  return code === undefined ? null : `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** `text` with each format control shown as U+FFFD, for operator-only records (ruling R15). */
export function withoutFormatControls(text: string): string {
  return text.replace(new RegExp(FORMAT_CONTROL_RE.source, "gu"), "\uFFFD");
}

/** Ruling R15: the longest citation title a record shows; a longer one gives way to the host label. */
export const SOURCE_TITLE_MAX_CHARS = 120;

/**
 * Ruling R6: every writer free-text field of a v2 record. Each carries no
 * figure outside evidence tokens (a bare year 1990–2039 and the R13
 * standard and version names aside) and no quoted span of three or more
 * words in any quotation style (tokens.ts states the exact detectors).
 * `[]` marks an array element (of objects or of strings).
 * One list drives the record parser and the final-artifact auditor.
 * `editorial.pricingTiers[].name` is listed because the ruling's only
 * numeric slots (NUMERIC_PROPOSAL_FIELDS) do not include tier names.
 */
export const WRITER_TEXT_FIELDS = [
  "brief.oneLiner",
  "market.summary",
  "community.summary",
  "whyNow",
  "competitors[].notes",
  "goToMarket.positioning",
  "goToMarket.pricingNotes",
  "goToMarket.channels[]",
  "howItWorks[]",
  "editorial.productName",
  "editorial.audienceShort",
  "editorial.problemNarrative",
  "editorial.solutionNarrative",
  "editorial.competitiveNarrative",
  "editorial.dontBuildYet",
  "editorial.stackNotes",
  "editorial.brandBrief",
  "editorial.pricingTiers[].name",
  "editorial.unitEconomics[].label",
  "editorial.yearOne.funnel[].stage",
  "editorial.yearOne.assumptions",
] as const;

export type WriterTextField = (typeof WRITER_TEXT_FIELDS)[number];

/**
 * Ruling R6: the only writer slots that may hold figures. They are product
 * proposals and planning assumptions, and the page labels them as such.
 * They carry no evidence tokens.
 */
export const NUMERIC_PROPOSAL_FIELDS = [
  "editorial.pricingTiers[].price",
  "editorial.pricingTiers[].includes",
  "editorial.unitEconomics[].value",
  "editorial.yearOne.funnel[].count",
  "editorial.yearOne.payingAccounts",
  "editorial.yearOne.seatsPerAccount",
  "editorial.dataModel[].columns",
] as const;

/**
 * Ruling R7: the evidence kinds each writer text field may cite with
 * `[[ev:<id>]]`. [] means no tokens at all; any field not listed in
 * WRITER_TEXT_FIELDS takes no tokens either. `competitors[].notes` may
 * cite only that competitor's own price ids (its `priceIds`).
 */
export const WRITER_FIELD_TOKEN_KINDS: Readonly<Record<WriterTextField, ReadonlyArray<EvidenceKind>>> = {
  "brief.oneLiner": [],
  "market.summary": ["market_stat"],
  "community.summary": ["community_quote"],
  whyNow: ["market_stat", "community_quote"],
  "competitors[].notes": ["competitor_price"],
  "goToMarket.positioning": [],
  "goToMarket.pricingNotes": ["competitor_price"],
  "goToMarket.channels[]": [],
  "howItWorks[]": [],
  "editorial.productName": [],
  "editorial.audienceShort": [],
  "editorial.problemNarrative": ["community_quote", "market_stat", "competitor_price"],
  "editorial.solutionNarrative": [],
  "editorial.competitiveNarrative": ["competitor_price"],
  "editorial.dontBuildYet": [],
  "editorial.stackNotes": [],
  "editorial.brandBrief": [],
  "editorial.pricingTiers[].name": [],
  "editorial.unitEconomics[].label": [],
  "editorial.yearOne.funnel[].stage": [],
  "editorial.yearOne.assumptions": [],
};

/**
 * @deprecated Same list as WRITER_TEXT_FIELDS (ruling R6 widened the old
 * fact-bearing list to every writer text field). Kept so existing imports
 * keep compiling; new code should import WRITER_TEXT_FIELDS.
 */
export const FACT_BEARING_FIELDS = WRITER_TEXT_FIELDS;

// ---------------------------------------------------------------------------
// Record v2
// ---------------------------------------------------------------------------

export type YearOnePlanV2 = {
  /** Integer counts ≥ 1, non-increasing, at least two stages. */
  funnel: Array<{ stage: string; count: number }>;
  /** A pricingTiers name whose price parses under the shared grammar. */
  tier: string;
  /** Integer ≥ 1 and equal to the last funnel stage count. */
  payingAccounts: number;
  /** Integer ≥ 1; must be 1 when the tier price is flat. */
  seatsPerAccount: number;
  assumptions?: string;
};

export type EditorialFieldsV2 = {
  productName?: string;
  dontBuildYet?: string;
  problemNarrative?: string;
  solutionNarrative?: string;
  competitiveNarrative?: string;
  pricingTiers?: PricingTier[];
  unitEconomics?: UnitEconRow[];
  stackNotes?: string;
  audienceShort?: string;
  brandBrief?: string;
  yearOne?: YearOnePlanV2;
  dataModel?: DataTable[];
};

export type ResearchMode = "live" | "fixture";

/**
 * Ruling R12: the code that produced a run. `sha` is the git commit
 * (40 or 64 lowercase hex); `dirty` is true when the working tree had
 * changes or untracked files. Both are null when git was unavailable.
 */
export type CodeRevision = { sha: string | null; dirty: boolean | null };

export type ResearchProvenanceV2 = {
  providerCalls: ProviderCall[];
  costUsd: number;
  ranAt: string;
  models: { synthesis: string; search: string; keywordData: string };
  /** Billable attempts per pipeline step id. */
  attempts: Record<string, number>;
  /** Ruling R12; absent on records written before it. */
  codeRevision?: CodeRevision;
};

export type ResearchRecordV2 = {
  contractVersion: typeof RESEARCH_RECORD_CONTRACT_VERSION_V2;
  pipelineVersion: typeof PIPELINE_VERSION_V2;
  mode: ResearchMode;
  brief: ResearchBrief;
  evidence: {
    contractVersion: typeof EVIDENCE_CONTRACT_VERSION;
    accepted: AcceptedEvidence[];
    rejected: RejectedEvidence[];
    sources: SourceAcquisition[];
  };
  market: { summary: string; statIds: string[] };
  competitors: Array<{ name: string; priceIds: string[]; notes?: string }>;
  community: { summary: string; quoteIds: string[] };
  keywords: KeywordRow[];
  goToMarket: GoToMarket;
  whyNow: string;
  howItWorks: string[];
  scores?: ResearchScores;
  editorial?: EditorialFieldsV2;
  provenance: ResearchProvenanceV2;
};

// ---------------------------------------------------------------------------
// Run report (written by engine:research on success and failure)
// ---------------------------------------------------------------------------

export type ResearchRunReport = {
  ok: boolean;
  pipelineVersion: number;
  recordContractVersion: number;
  mode: ResearchMode;
  briefSlug: string;
  briefSha256: string;
  startedAt: string;
  finishedAt: string;
  failedStep?: string;
  /** Redacted. */
  error?: string;
  providerCalls: ProviderCall[];
  costUsd: number;
  attempts: Record<string, number>;
  models: { synthesis: string; search: string; keywordData: string };
  /** Ruling R12: the code revision that ran (nulls when git was unavailable). */
  codeRevision: CodeRevision;
  sources: SourceAcquisition[];
  /** Ruling R15: search citations never read or stored, by host and reason (no path or query). */
  refusedCitations: Array<{ host: string; reason: string }>;
  evidence: {
    accepted: Record<EvidenceKind, number>;
    rejected: Array<Pick<RejectedEvidence, "kind" | "reason" | "sourceUrl" | "detail">>;
  };
};
