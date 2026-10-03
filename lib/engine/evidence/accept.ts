/**
 * Deterministic evidence acceptance (WP54, contract §4–§6).
 *
 * Extraction candidates are untrusted model output. Only acceptEvidence (and
 * revalidateAcceptedEvidence, which rebuilds a stored item after re-deriving
 * every check) constructs AcceptedEvidence. A JSON boolean, a model "verified"
 * flag or a model-chosen id never grants acceptance.
 *
 * What acceptance proves, and what it does not: an accepted item proves that
 * the cited page (as fetched at `retrievedAt`) contains the excerpt, and that
 * the typed claim (amount, period, price terms, vendor) re-derives from that
 * excerpt under the shared grammar in amount.ts. It does not prove the page
 * is credible, current or independent, and it does not prove the claim is
 * true. Those stay human review tasks.
 *
 * Excerpts (all in the source's own characters):
 *   community_quote  the matched span itself (6–80 words, ≤480 chars)
 *   market_stat      the one sentence holding the amount (≤600 chars)
 *   competitor_price from the start of the supporting span's sentence to the
 *                    end of the price's clause (≤600; falls back to the
 *                    clause alone when the sentence is too long)
 *   competitor_availability one bounded pricing statement sentence (≤600)
 * Every stat/price check runs on that excerpt, so acceptance and offline
 * re-validation apply the identical rules to the identical text.
 *
 * Ids (contract §12, ruling R1) hash kind, URL, excerpt and the typed claim
 * (evidenceClaimKey), so several claims from one sentence keep separate ids.
 * The same claim twice from one excerpt (also an equal amount written
 * differently, e.g. "$1.2 billion" and "$1,200,000,000") is a "duplicate".
 *
 * Stat periods (ruling R2) must equal the period derived from the excerpt:
 * projected exactly when isProjectedAmount marks the figure or its declared
 * year is after the retrieval year; otherwise measured.
 *
 * Prices (ruling R5): a page on one known vendor's own host is never
 * evidence for another vendor's price (ambiguous_attribution), so a pricing
 * URL can back at most one competitor's first-party prices. A neutral page
 * (no known vendor's host) may still bind several vendors, each in its own
 * clause.
 *
 * Quotes (rulings R8 and R14): only from a source the community search
 * cited (SourceInput.roles; else unknown_citation), a whole prose sentence
 * (span_bounds when it starts or stops inside one; a line break starts a
 * sentence only after terminal punctuation or at a blank line) on one line
 * of the extracted text (span_bounds across a line break). Re-validation can
 * check the role and the line break; sentence edges need the page text
 * (acceptance only). Two quotes are distinct only when neither contains the
 * other.
 *
 * Binding is per claim (rulings R9 and R14): a comparison cue in a price's
 * sentence or the soft-wrapped line above it, including moved/migrated to,
 * replaced by, and after/over before a name (ambiguous_attribution); a
 * nearer brand-like name than the claimed vendor or its plan before the
 * price, or another name right after "for" behind it (ambiguous_attribution);
 * annual billing shown above a per-month price — a billing toggle or a
 * price-free billing line anywhere above, a billing phrase in its block —
 * with neither billing stated in the clause (qualifier_dropped; amount.ts
 * ambiguousBilling); a plan only on the price's own line or the line above
 * it, never after "everything in"/"all of"/"includes"/"from"/"than"
 * (otherwise dropped at acceptance, an issue at re-validation); a stat
 * subject of plain words (invalid_candidate) whose every word but a, an,
 * the, of, for, and, in, on and to is in the sentence
 * (subject_not_in_context), with a metric the sentence's words state
 * (metric_unit_mismatch). Acceptance applies the price rules to the page
 * text and to the stored excerpt; re-validation to the excerpt.
 * `vendorHints` (the pipeline passes the names its competitor citations
 * confirm) join the candidates' vendors for R5 and the other-vendor rule.
 *
 * Untrusted text (ruling R15): a citation title longer than
 * SOURCE_TITLE_MAX_CHARS, or holding a figure, a link, an email or a
 * format control, gives way to the source's host label (sourceTitleIssue);
 * an excerpt, stat subject, vendor or plan holding an invisible or
 * bidirectional format control (contract.ts FORMAT_CONTROL_RE) is
 * invalid_candidate; operator-only rejection records show such controls as
 * U+FFFD. Re-validation applies the same rules to stored items.
 */

import { createHash } from "node:crypto";

import {
  ambiguousBilling,
  amountsEqual,
  bindingWindowStart,
  clauseAround,
  comparePriceTerms,
  comparisonCueFor,
  comparisonRange,
  COUNT_NOUNS,
  formatAmount,
  formatPriceTerms,
  isProjectedAmount,
  lineAbove,
  lineAround,
  pageBillingCues,
  parseAmount,
  parsePriceTerms,
  priceExpressionsIn,
  proseSentenceAround,
  scanAmounts,
  sentenceAround,
  splitSentences,
  type PageBillingCues,
  type PriceExpression,
} from "./amount.ts";
import {
  canonicalSourceUrl,
  isComparisonPage,
  isFirstPartyHost,
  isVendorMarketplaceListing,
  sameSource,
  sourceHostLabel,
  strippedSourceUrl,
  vendorKey,
} from "./citation.ts";
import {
  EVIDENCE_ID_PREFIX,
  EVIDENCE_LIMITS,
  EVIDENCE_MINIMUMS,
  formatControlIn,
  SOURCE_TITLE_MAX_CHARS,
  withoutFormatControls,
  type AcceptedEvidence,
  type Amount,
  type CommunityQuoteEvidence,
  type CompetitorAvailability,
  type CompetitorAvailabilityCandidate,
  type CompetitorAvailabilityEvidence,
  type CompetitorPriceCandidate,
  type CompetitorPriceEvidence,
  type CurrencyCode,
  type EvidenceKind,
  type ExtractionCandidates,
  type MarketStatCandidate,
  type MarketStatEvidence,
  type MarketStatMetric,
  type PriceTerms,
  type QuoteCandidate,
  type RejectedEvidence,
  type RejectionReason,
  type SourceAcquisition,
  type SourceRole,
  type SourceStatus,
} from "./contract.ts";
import {
  distinctQuoteCount,
  findContiguousSpanIn,
  normalizeForSourceMatch,
  prepareSourceForMatch,
  wordCount,
  type PreparedSource,
} from "./quote.ts";
import { findUnboundFigures } from "./tokens.ts";

// ---------------------------------------------------------------------------
// Public types and limits
// ---------------------------------------------------------------------------

/** A URL a search step returned; candidates may cite only these. */
export type CitationInput = { url: string; title?: string };

/**
 * One acquired source, keyed by canonical URL in acceptEvidence's `sources`
 * map. `roles` are the searches that cited it (ruling R8: only a source the
 * community search cited can supply a community quote; no roles, no quotes).
 */
export type SourceInput = {
  status: SourceStatus;
  text?: string;
  retrievedAt?: string;
  textSha256?: string;
  roles?: ReadonlyArray<SourceRole>;
};

/** Input to acceptEvidence. `vendorHints` names other vendors seen in research. */
export type AcceptEvidenceInput = {
  candidates: ExtractionCandidates;
  citations: ReadonlyArray<CitationInput>;
  sources: ReadonlyMap<string, SourceInput>;
  vendorHints?: ReadonlyArray<string>;
};

/** Accepted items in deterministic order plus operator-only rejections. */
export type AcceptEvidenceResult = { accepted: AcceptedEvidence[]; rejected: RejectedEvidence[] };

/** Result of revalidateAcceptedEvidence. */
export type RevalidationResult = { ok: true; item: AcceptedEvidence } | { ok: false; issues: string[] };

/** Shape bounds for raw extraction output (parseExtractionCandidates). */
export const CANDIDATE_LIMITS = {
  perKind: 40,
  textChars: 2_000,
  claimChars: 240,
  nameChars: 120,
  urlChars: 2_048,
  minYear: 1900,
  maxYear: 2100,
} as const;

const KINDS: readonly EvidenceKind[] = ["community_quote", "market_stat", "competitor_price", "competitor_availability"];
const AVAILABILITY: readonly CompetitorAvailability[] = ["contact_sales", "usage_based", "credit_pack"];
const METRICS: readonly MarketStatMetric[] = [
  "market_size",
  "growth_rate",
  "spend",
  "user_count",
  "adoption",
  "other",
];
const CURRENCIES: readonly CurrencyCode[] = ["USD", "EUR", "GBP", "CAD", "AUD"];
const DETAIL_CHARS = 200;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** sha256 hex digest of the UTF-8 text. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** The typed claim an evidence id hashes (contract §12, ruling R1); accepted items fit it. */
export type EvidenceClaim =
  | { kind: "community_quote" }
  | { kind: "market_stat"; metric: MarketStatMetric; amount: Amount; period: MarketStatEvidence["period"] }
  | { kind: "competitor_price"; vendor: string; plan?: string; price: PriceTerms }
  | { kind: "competitor_availability"; vendor: string; availability: CompetitorAvailability };

/**
 * Ruling R1 claim key: "" for a quote;
 * metric|unit|currency|value|magnitude|periodKind|year|toYear for a stat;
 * vendorKey|plan|unit|currency|value|magnitude|period|basis|qualifiers for a
 * price (qualifiers sorted and comma-joined). Absent parts are "". Subject
 * text is not part of the key.
 */
export function evidenceClaimKey(claim: EvidenceClaim): string {
  if (claim.kind === "community_quote") return "";
  if (claim.kind === "market_stat") {
    const { amount, period } = claim;
    return [
      claim.metric,
      amount.unit,
      amount.currency ?? "",
      amount.value,
      amount.magnitude,
      period.kind,
      period.year ?? "",
      period.toYear ?? "",
    ].join("|");
  }
  if (claim.kind === "competitor_availability") return `${vendorKey(claim.vendor)}|${claim.availability}`;
  const { amount, period, basis, qualifiers } = claim.price;
  return [
    vendorKey(claim.vendor),
    claim.plan ?? "",
    amount.unit,
    amount.currency ?? "",
    amount.value,
    amount.magnitude,
    period,
    basis,
    [...qualifiers].sort().join(","),
  ].join("|");
}

/** Contract id (R1): `${q|s|p|a}_${sha256hex(kind\nsourceUrl\nexcerpt\nclaimKey).slice(0, 12)}`. */
export function evidenceId(kind: EvidenceKind, sourceUrl: string, excerpt: string, claimKey: string): string {
  return `${EVIDENCE_ID_PREFIX[kind]}_${sha256Hex(`${kind}\n${sourceUrl}\n${excerpt}\n${claimKey}`).slice(0, 12)}`;
}

function isIsoTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function yearOf(isoTime: string): number {
  return new Date(Date.parse(isoTime)).getUTCFullYear();
}

type Failure = { ok: false; reason: RejectionReason; detail: string };

function fail(reason: RejectionReason, detail: string): Failure {
  return { ok: false, reason, detail: clip(detail, DETAIL_CHARS) };
}

/** How close a failed comparison came; the closest failure is reported. */
const REASON_RANK: Partial<Record<RejectionReason, number>> = {
  unparseable_amount: 0,
  unit_mismatch: 1,
  currency_mismatch: 2,
  amount_mismatch: 3,
  period_mismatch: 4,
  basis_mismatch: 5,
  qualifier_dropped: 6,
  metric_unit_mismatch: 6,
  span_bounds: 7,
  projection_as_measured: 8,
  year_not_in_context: 8,
  subject_not_in_context: 8,
  vendor_not_in_context: 9,
  ambiguous_attribution: 10,
  unsupported_assertion: 11,
};

function closer(current: Failure | null, next: Failure): Failure {
  if (!current) return next;
  return (REASON_RANK[next.reason] ?? 0) > (REASON_RANK[current.reason] ?? 0) ? next : current;
}

// ---------------------------------------------------------------------------
// Candidate shape checks (parseExtractionCandidates)
// ---------------------------------------------------------------------------

type Read<T> = { ok: true; value: T } | { ok: false; error: string };

function readString(record: Record<string, unknown>, key: string, max: number): Read<string> {
  const value = record[key];
  if (typeof value !== "string") return { ok: false, error: `${key}: expected a string` };
  const trimmed = value.trim();
  if (trimmed === "") return { ok: false, error: `${key}: empty` };
  if (trimmed.length > max) return { ok: false, error: `${key}: longer than ${max} characters` };
  return { ok: true, value: trimmed };
}

function readOptionalString(record: Record<string, unknown>, key: string, max: number): Read<string | undefined> {
  const value = record[key];
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return { ok: true, value: undefined };
  }
  return readString(record, key, max);
}

function textField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

type ItemRead<T> = { ok: true; value: T } | { ok: false; error: string; sourceUrl?: string; candidate?: string };

/**
 * A rejected candidate's URL as operator records may keep it: canonical, or
 * stripped to origin and path when it has no canonical form (credentials,
 * signatures, userinfo), or nothing (review P3-6: a secret never lands in a
 * record or report). Never cut short: a record drops an over-long URL
 * instead of storing a wrong one.
 */
function recordableUrl(url: string): string | undefined {
  return canonicalSourceUrl(url) ?? strippedSourceUrl(url) ?? undefined;
}

function itemFailure<T>(record: Record<string, unknown>, error: string, claim: string): ItemRead<T> {
  const sourceUrl = recordableUrl(textField(record, "sourceUrl"));
  return {
    ok: false,
    error: withoutFormatControls(error),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(claim ? { candidate: clip(withoutFormatControls(claim), EVIDENCE_LIMITS.rejectedCandidateChars) } : {}),
  };
}

function firstError(...reads: Array<Read<unknown>>): string | null {
  for (const r of reads) if (!r.ok) return r.error;
  return null;
}

function readQuoteCandidate(item: unknown): ItemRead<QuoteCandidate> {
  if (!isPlainObject(item)) return { ok: false, error: "expected an object" };
  const sourceUrl = readString(item, "sourceUrl", CANDIDATE_LIMITS.urlChars);
  const text = readString(item, "text", CANDIDATE_LIMITS.textChars);
  const error = firstError(sourceUrl, text);
  if (error || !sourceUrl.ok || !text.ok) return itemFailure(item, error ?? "invalid", textField(item, "text"));
  return { ok: true, value: { sourceUrl: sourceUrl.value, text: text.value } };
}

function readYear(record: Record<string, unknown>): Read<number | undefined> {
  const value = record.year;
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < CANDIDATE_LIMITS.minYear ||
    value > CANDIDATE_LIMITS.maxYear
  ) {
    return { ok: false, error: `year: expected an integer ${CANDIDATE_LIMITS.minYear}–${CANDIDATE_LIMITS.maxYear}` };
  }
  return { ok: true, value };
}

function readEnum<T extends string>(record: Record<string, unknown>, key: string, allowed: readonly T[]): Read<T> {
  const value = record[key];
  const match = allowed.find((a) => a === value);
  return match ? { ok: true, value: match } : { ok: false, error: `${key}: expected one of ${allowed.join(", ")}` };
}

function readStatCandidate(item: unknown): ItemRead<MarketStatCandidate> {
  if (!isPlainObject(item)) return { ok: false, error: "expected an object" };
  const sourceUrl = readString(item, "sourceUrl", CANDIDATE_LIMITS.urlChars);
  const supportingText = readString(item, "supportingText", CANDIDATE_LIMITS.textChars);
  const subject = readString(item, "subject", CANDIDATE_LIMITS.claimChars);
  const metric = readEnum(item, "metric", METRICS);
  const amountText = readString(item, "amountText", CANDIDATE_LIMITS.claimChars);
  const year = readYear(item);
  const periodKind = readEnum(item, "periodKind", ["measured", "projected"] as const);
  const error = firstError(sourceUrl, supportingText, subject, metric, amountText, year, periodKind);
  if (error || !sourceUrl.ok || !supportingText.ok || !subject.ok || !metric.ok || !amountText.ok || !year.ok || !periodKind.ok) {
    return itemFailure(item, error ?? "invalid", `${textField(item, "subject")}: ${textField(item, "amountText")}`);
  }
  return {
    ok: true,
    value: {
      sourceUrl: sourceUrl.value,
      supportingText: supportingText.value,
      subject: subject.value,
      metric: metric.value,
      amountText: amountText.value,
      ...(year.value !== undefined ? { year: year.value } : {}),
      periodKind: periodKind.value,
    },
  };
}

function readPriceCandidate(item: unknown): ItemRead<CompetitorPriceCandidate> {
  if (!isPlainObject(item)) return { ok: false, error: "expected an object" };
  const vendor = readString(item, "vendor", CANDIDATE_LIMITS.nameChars);
  const sourceUrl = readString(item, "sourceUrl", CANDIDATE_LIMITS.urlChars);
  const supportingText = readString(item, "supportingText", CANDIDATE_LIMITS.textChars);
  const plan = readOptionalString(item, "plan", CANDIDATE_LIMITS.nameChars);
  const priceText = readString(item, "priceText", CANDIDATE_LIMITS.claimChars);
  const error = firstError(vendor, sourceUrl, supportingText, plan, priceText);
  if (error || !vendor.ok || !sourceUrl.ok || !supportingText.ok || !plan.ok || !priceText.ok) {
    return itemFailure(item, error ?? "invalid", `${textField(item, "vendor")}: ${textField(item, "priceText")}`);
  }
  return {
    ok: true,
    value: {
      vendor: vendor.value,
      sourceUrl: sourceUrl.value,
      supportingText: supportingText.value,
      ...(plan.value !== undefined ? { plan: plan.value } : {}),
      priceText: priceText.value,
    },
  };
}

function readAvailabilityCandidate(item: unknown): ItemRead<CompetitorAvailabilityCandidate> {
  if (!isPlainObject(item)) return { ok: false, error: "expected an object" };
  const vendor = readString(item, "vendor", CANDIDATE_LIMITS.nameChars);
  const sourceUrl = readString(item, "sourceUrl", CANDIDATE_LIMITS.urlChars);
  const supportingText = readString(item, "supportingText", CANDIDATE_LIMITS.textChars);
  const availability = readEnum(item, "availability", AVAILABILITY);
  const error = firstError(vendor, sourceUrl, supportingText, availability);
  if (error || !vendor.ok || !sourceUrl.ok || !supportingText.ok || !availability.ok) {
    return itemFailure(item, error ?? "invalid", `${textField(item, "vendor")}: ${textField(item, "availability")}`);
  }
  return { ok: true, value: { vendor: vendor.value, sourceUrl: sourceUrl.value, supportingText: supportingText.value, availability: availability.value } };
}

function readList<T>(
  root: Record<string, unknown>,
  key: string,
  kind: EvidenceKind,
  read: (item: unknown) => ItemRead<T>,
  out: T[],
  rejected: RejectedEvidence[],
): void {
  const value = root[key];
  if (!Array.isArray(value)) {
    rejected.push({ kind, reason: "invalid_candidate", detail: `${key}: expected an array` });
    return;
  }
  value.slice(0, CANDIDATE_LIMITS.perKind).forEach((item, index) => {
    const r = read(item);
    if (r.ok) {
      out.push(r.value);
      return;
    }
    rejected.push({
      kind,
      reason: "invalid_candidate",
      ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
      ...(r.candidate ? { candidate: r.candidate } : {}),
      detail: clip(`${key}[${index}]: ${r.error}`, DETAIL_CHARS),
    });
  });
  if (value.length > CANDIDATE_LIMITS.perKind) {
    rejected.push({
      kind,
      reason: "invalid_candidate",
      detail: `${key}: ${value.length - CANDIDATE_LIMITS.perKind} candidates beyond the ${CANDIDATE_LIMITS.perKind}-item limit were ignored`,
    });
  }
}

/**
 * JSON shape checks for the extraction step's output. Unknown keys, prose
 * and any "verified" flag are ignored; each list is bounded to
 * CANDIDATE_LIMITS.perKind items. Nothing here checks a claim against a source.
 */
export function parseExtractionCandidates(raw: unknown): {
  candidates: ExtractionCandidates;
  rejected: RejectedEvidence[];
} {
  const candidates: ExtractionCandidates = { quotes: [], marketStats: [], competitorPrices: [], competitorAvailability: [] };
  const rejected: RejectedEvidence[] = [];
  if (!isPlainObject(raw)) {
    for (const kind of KINDS) {
      rejected.push({ kind, reason: "invalid_candidate", detail: "extraction output is not a JSON object" });
    }
    return { candidates, rejected };
  }
  readList(raw, "quotes", "community_quote", readQuoteCandidate, candidates.quotes, rejected);
  readList(raw, "marketStats", "market_stat", readStatCandidate, candidates.marketStats, rejected);
  readList(raw, "competitorPrices", "competitor_price", readPriceCandidate, candidates.competitorPrices, rejected);
  if (raw.competitorAvailability !== undefined) {
    readList(raw, "competitorAvailability", "competitor_availability", readAvailabilityCandidate, candidates.competitorAvailability!, rejected);
  }
  return { candidates, rejected };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

type ReadSource = {
  url: string;
  title: string;
  text: string;
  retrievedAt: string;
  referenceYear: number;
  prepared: PreparedSource;
  roles: ReadonlyArray<SourceRole>;
};

type Context = {
  citations: Map<string, string>;
  sources: Map<string, SourceInput>;
  prepared: Map<string, PreparedSource>;
  /** Each read page's billing cues, read once (amount.ts pageBillingCues). */
  billing: Map<string, PageBillingCues>;
  vendors: string[];
};

const STATUS_REASON: Record<Exclude<SourceStatus, "read">, RejectionReason> = {
  unreadable: "source_unreadable",
  oversized: "source_oversized",
  timeout: "source_timeout",
  no_content: "source_no_content",
  blocked: "source_unreadable",
  http_error: "source_unreadable",
  unsupported_encoding: "source_unreadable",
  redirect_rejected: "source_unreadable",
};

/** Links, emails and domain paths a citation title or stat subject may not carry (rulings R9, R15). */
const TEXT_LINK_RE =
  /[a-z][a-z0-9+.-]*:\/\/|(?<![\p{L}\p{N}])www\.|mailto:|[^\s@]+@[^\s@]+\.[^\s@]+|[\p{L}\p{N}-]+\.\p{L}{2,}\/\S*/iu;

/**
 * Ruling R15: why a citation title cannot be shown, or null. A title is a
 * hostile page's own words, and the page shows it next to evidence: at most
 * SOURCE_TITLE_MAX_CHARS characters, no format control, no figure (the R6
 * detector: bare years and R13 names are fine) and no link or email.
 * Acceptance shows the source's host label instead; the record parser
 * refuses a stored title that breaks the rule.
 */
export function sourceTitleIssue(title: string): string | null {
  if (title.length > SOURCE_TITLE_MAX_CHARS) {
    return `title has ${title.length} characters; at most ${SOURCE_TITLE_MAX_CHARS} allowed`;
  }
  const control = formatControlIn(title);
  if (control) return `title holds the format control ${control}`;
  if (findUnboundFigures(title).length > 0) return "title holds a figure";
  if (TEXT_LINK_RE.test(title)) return "title holds a link or an email";
  return null;
}

/** A citation title as acceptance keeps it: one line, and "" (the host label stands in) when it breaks R15. */
function acceptableTitle(title: unknown): string {
  if (typeof title !== "string") return "";
  const line = title.replace(/\s+/g, " ").trim();
  return sourceTitleIssue(line) === null ? line : "";
}

function createContext(input: AcceptEvidenceInput): Context {
  const citations = new Map<string, string>();
  for (const citation of input.citations) {
    const url = canonicalSourceUrl(citation.url);
    if (!url) continue;
    const title = acceptableTitle(citation.title);
    if (!citations.has(url) || (citations.get(url) === "" && title !== "")) citations.set(url, title);
  }
  const sources = new Map<string, SourceInput>();
  for (const [key, source] of input.sources) {
    const url = canonicalSourceUrl(key);
    if (url && !sources.has(url)) sources.set(url, source);
  }
  const vendors = [
    ...new Set(
      [...input.candidates.competitorPrices.map((c) => c.vendor), ...(input.candidates.competitorAvailability ?? []).map((c) => c.vendor), ...(input.vendorHints ?? [])]
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => vendorKey(v).length >= 2),
    ),
  ];
  return { citations, sources, prepared: new Map(), billing: new Map(), vendors };
}

function resolveSource(context: Context, sourceUrl: string): { ok: true; source: ReadSource } | Failure {
  const url = canonicalSourceUrl(sourceUrl);
  if (!url) return fail("unknown_citation", "not an http(s) URL without credentials");
  const title = context.citations.get(url);
  if (title === undefined) return fail("unknown_citation", "URL is not among the search citations");
  const source = context.sources.get(url);
  if (!source) return fail("source_unreadable", "source was not acquired");
  if (source.status !== "read") {
    return fail(STATUS_REASON[source.status] ?? "source_unreadable", `source status: ${source.status}`);
  }
  if (typeof source.text !== "string" || source.text.trim() === "") {
    return fail("source_no_content", "source text is empty");
  }
  if (typeof source.retrievedAt !== "string" || !isIsoTime(source.retrievedAt)) {
    return fail("source_unreadable", "source has no valid retrievedAt");
  }
  if (source.textSha256 !== undefined && source.textSha256 !== sha256Hex(source.text)) {
    return fail("source_unreadable", "source text does not match its textSha256");
  }
  let prepared = context.prepared.get(url);
  if (!prepared) {
    prepared = prepareSourceForMatch(source.text);
    context.prepared.set(url, prepared);
  }
  return {
    ok: true,
    source: {
      url,
      title: title || sourceHostLabel(url) || url,
      text: source.text,
      retrievedAt: source.retrievedAt,
      referenceYear: yearOf(source.retrievedAt),
      prepared,
      roles: Array.isArray(source.roles) ? source.roles : [],
    },
  };
}

function baseFields(claim: EvidenceClaim, source: ReadSource, excerpt: string) {
  return {
    id: evidenceId(claim.kind, source.url, excerpt, evidenceClaimKey(claim)),
    sourceUrl: source.url,
    sourceTitle: source.title,
    excerpt,
    excerptSha256: sha256Hex(excerpt),
    retrievedAt: source.retrievedAt,
  };
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

function quoteBoundsIssue(excerpt: string): string | null {
  const words = wordCount(excerpt);
  if (words < EVIDENCE_LIMITS.quoteMinWords || words > EVIDENCE_LIMITS.quoteMaxWords) {
    return `quote has ${words} words; ${EVIDENCE_LIMITS.quoteMinWords}–${EVIDENCE_LIMITS.quoteMaxWords} allowed`;
  }
  if (excerpt.length > EVIDENCE_LIMITS.quoteMaxChars) {
    return `quote has ${excerpt.length} characters; at most ${EVIDENCE_LIMITS.quoteMaxChars} allowed`;
  }
  return null;
}

/** Line breaks of extracted source text (comments and blocks end at one). */
const LINE_BREAK_RE = /[\n\r\v\f\u0085\u2028\u2029]/;
/** What may stand between a sentence start and a quote: whitespace, opening quote marks, brackets, bullets. */
const QUOTE_OPENERS_RE = /^[\s"'“”‘’„‚«‹([{*•·‣>\-–—]*$/u;
/** What may stand between a quote and its sentence end: whitespace, closing quote marks and brackets. */
const QUOTE_CLOSERS_RE = /^[\s"'“”‘’»›)\]}*]*$/u;

const NOT_COMMUNITY_DETAIL =
  "not cited by the community search; community quotes come only from pages the community search cited (ruling R8)";
const LINE_BREAK_DETAIL = "the quote crosses a line break of the source text; each comment or block is its own statement (ruling R8)";

function quoteLineBreakIssue(excerpt: string): string | null {
  return LINE_BREAK_RE.test(excerpt) ? LINE_BREAK_DETAIL : null;
}

/**
 * Rulings R8 and R14, against the source text: the span [start, end) holds
 * no line break, begins at a sentence start (only whitespace, opening quote
 * marks, brackets or a bullet before it in its sentence) and ends at a
 * sentence end (only whitespace, closing quote marks or brackets after it).
 * Sentences are prose sentences (amount.ts proseSentenceAround): a line
 * break starts one only after terminal punctuation or at a blank line, so
 * the second line of a soft-wrapped sentence, or a line after a <br> inside
 * one, is no whole sentence. Needs the source text, so offline
 * re-validation can check only the line-break part on the excerpt.
 */
function quoteShapeIssue(text: string, start: number, end: number): string | null {
  const lineBreak = quoteLineBreakIssue(text.slice(start, end));
  if (lineBreak) return lineBreak;
  const sentenceStart = proseSentenceAround(text, start).start;
  if (sentenceStart > start || !QUOTE_OPENERS_RE.test(text.slice(sentenceStart, start))) {
    return "the quote does not begin at a sentence start; quote whole sentences (rulings R8, R14)";
  }
  const sentenceEnd = proseSentenceAround(text, Math.max(start, end - 1)).end;
  if (sentenceEnd < end || !QUOTE_CLOSERS_RE.test(text.slice(end, sentenceEnd))) {
    return "the quote stops before its sentence end; quote whole sentences (rulings R8, R14)";
  }
  return null;
}

function acceptQuote(candidate: QuoteCandidate, context: Context): { ok: true; item: AcceptedEvidence } | Failure {
  const resolved = resolveSource(context, candidate.sourceUrl);
  if (!resolved.ok) return resolved;
  if (!resolved.source.roles.includes("community")) return fail("unknown_citation", NOT_COMMUNITY_DETAIL);
  const span = findContiguousSpanIn(candidate.text, resolved.source.prepared);
  if (!span.ok) return fail(span.reason, spanDetail(span.reason));
  const control = formatControlIn(span.text);
  if (control) return fail("invalid_candidate", controlDetail("the quote", control));
  const shape = quoteShapeIssue(resolved.source.text, span.start, span.end);
  if (shape) return fail("span_bounds", shape);
  const issue = quoteBoundsIssue(span.text);
  if (issue) return fail("span_bounds", issue);
  const item: CommunityQuoteEvidence = {
    ...baseFields({ kind: "community_quote" }, resolved.source, span.text),
    kind: "community_quote",
    attribution: "community",
  };
  return { ok: true, item };
}

/** Ruling R15: the detail for text that holds an invisible or bidirectional format control. */
function controlDetail(what: string, control: string): string {
  return `${what} holds the invisible or bidirectional format control ${control} (ruling R15)`;
}

function spanDetail(reason: "span_not_found" | "internal_ellipsis" | "span_bounds"): string {
  if (reason === "internal_ellipsis") return "an ellipsis inside the text would join separate fragments";
  if (reason === "span_bounds") return "candidate text has no words";
  return "text is not a contiguous span of the fetched source";
}

// ---------------------------------------------------------------------------
// Market stats
// ---------------------------------------------------------------------------

type StatClaim = {
  subject: string;
  metric: MarketStatMetric;
  amount: Amount;
  periodKind: "measured" | "projected";
  year?: number;
};

type StatCheck = { ok: true; period: MarketStatEvidence["period"] } | Failure;

function metricAllowsUnit(metric: MarketStatMetric, unit: Amount["unit"]): boolean {
  if (metric === "market_size" || metric === "spend") return unit === "currency";
  if (metric === "growth_rate" || metric === "adoption") return unit === "percent";
  if (metric === "user_count") return unit === "count";
  return true;
}

const SUBJECT_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "these", "those", "into", "over", "under",
  "about", "than", "then", "also", "only", "just", "more", "most", "some", "such", "other", "their",
  "there", "which", "where", "when", "what", "will", "would", "could", "should", "have", "been",
  "being", "were", "they", "them", "your", "ours", "each", "every", "across", "among", "within",
  "between", "through", "during", "including", "based", "using", "used", "global", "worldwide",
  "world", "market", "markets", "size", "sized", "industry", "industries", "sector", "sectors",
  "segment", "segments", "revenue", "revenues", "value", "valued", "values", "valuation", "growth",
  "grow", "growing", "rate", "rates", "share", "shares", "total", "overall", "annual", "annually",
  "report", "reports", "research", "estimate", "estimated", "estimates", "projected", "projection",
  "forecast", "forecasts", "expected", "billion", "million", "thousand", "trillion", "percent",
  "year", "years", "yearly", "number", "numbers", "amount", "figure", "figures", "data",
  "statistic", "statistics", "average", "cagr", "approximately", "around", "roughly", "nearly",
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

/**
 * A light stem for words of four letters or more, so word forms match:
 * companies/company, teams/team, using/used/uses, reviewing/reviewed,
 * questionnaires/questionnaire. Shorter words always match exactly.
 */
function lightStem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith("ed") && !w.endsWith("eed")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 2 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

function subjectContentWords(subject: string): string[] {
  return tokens(subject).filter((w) => w.length >= 4 && /\p{L}/u.test(w) && !SUBJECT_STOPWORDS.has(w));
}

/** Ruling R14: the only subject words a stat's sentence may lack. */
const SUBJECT_OPTIONAL_WORDS: ReadonlySet<string> = new Set(["a", "an", "the", "of", "for", "and", "in", "on", "to"]);

/**
 * Rulings R9 and R14: the subject names something specific (at least one
 * content word of four letters or more that is no stopword), and every
 * subject word but a, an, the, of, for, and, in, on and to occurs in the
 * amount's sentence — short qualifiers such as US, EU, no or only exactly,
 * longer words in any light-stem form — so neither a broad sentence nor an
 * added qualifier ("projected", "global") can stand for another subject.
 */
function subjectIssue(subject: string, sentence: string): string | null {
  if (subjectContentWords(subject).length === 0) return `subject "${clip(subject, 60)}" has no specific content word`;
  const sentenceWords = tokens(sentence);
  const exact = new Set(sentenceWords);
  const stems = new Set(sentenceWords.filter((w) => w.length >= 4).map(lightStem));
  const present = (w: string): boolean => exact.has(w) || (w.length >= 4 && stems.has(lightStem(w)));
  const missing = [...new Set(tokens(subject).filter((w) => !SUBJECT_OPTIONAL_WORDS.has(w) && !present(w)))];
  if (missing.length === 0) return null;
  const words = missing
    .slice(0, 4)
    .map((w) => `"${w}"`)
    .join(", ");
  return `the sentence lacks ${words} of the subject "${clip(subject, 60)}"; every subject word must be in it (rulings R9, R14)`;
}

/** Markdown, MDX or quotation characters a stat subject may not carry (ruling R9). */
const SUBJECT_MARKUP_RE = /[<>[\]{}*_`|#~\\"“”„«»]/u;

/**
 * Rulings R9 and R15: a stat subject is plain words. It is extraction-model
 * text that the page shows next to the figure, so it may carry no figure
 * (the R6 detector), no link, email or domain path, no markup or quotation,
 * and no invisible or bidirectional format control.
 */
function subjectShapeIssue(subject: string): string | null {
  const control = formatControlIn(subject);
  if (control) return controlDetail("the subject", control);
  if (findUnboundFigures(subject).length === 0 && !TEXT_LINK_RE.test(subject) && !SUBJECT_MARKUP_RE.test(subject)) {
    return null;
  }
  return `subject must be plain words (no figures, links, emails or markup): "${clip(subject, 80)}" (ruling R9)`;
}

const COUNT_NOUN_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${COUNT_NOUNS.join("|")})(?![\\p{L}\\p{N}])`, "iu");

/** Ruling R9: the words a sentence must use for each metric (null: no requirement). */
const METRIC_CUES: Record<MarketStatMetric, { label: string; re: RegExp } | null> = {
  market_size: {
    label: "market size (market, valued, worth, size or revenue)",
    re: /(?<![\p{L}])(?:markets?|valued|valuation|worth|size|sized|sizes|revenues?)(?![\p{L}])/iu,
  },
  growth_rate: { label: "growth rate (CAGR, grow, grew or growth)", re: /(?<![\p{L}])(?:cagr|grow|grows|growing|grown|grew|growth)(?![\p{L}])/iu },
  spend: { label: "spend (spend, spending, spent or budget)", re: /(?<![\p{L}])(?:spend|spends|spending|spent|budgets?)(?![\p{L}])/iu },
  adoption: {
    label: "adoption (adopt, use, using or share)",
    re: /(?<![\p{L}])(?:adopt|adopts|adopted|adopting|adoption|use|uses|used|using|share|shares)(?![\p{L}])/iu,
  },
  user_count: { label: "user count (a counted noun such as users or teams)", re: COUNT_NOUN_RE },
  other: null,
};

/** Ruling R9: why the sentence does not state the claimed metric, or null. */
function metricIssue(metric: MarketStatMetric, sentence: string): string | null {
  const cue = METRIC_CUES[metric];
  return cue && !cue.re.test(sentence) ? `the sentence does not state ${cue.label} (ruling R9)` : null;
}

const MAGNITUDE_AFTER_YEAR_RE = /^[ \u00A0]?(?:thousand|million|billion|trillion|bn|mn|tn|[kKmMbBtT](?![\p{L}\p{N}]))/iu;

type Span = { start: number; end: number };

/** Occurrences of a four-digit year in the sentence (not numbers like "2024 billion"). */
function yearOccurrences(sentence: string, year: number): Span[] {
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}$€£.,])${year}(?![\p{N}%]|[.,]\d)`, "gu");
  const out: Span[] = [];
  for (const m of sentence.matchAll(re)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!MAGNITUDE_AFTER_YEAR_RE.test(sentence.slice(end, end + 12))) out.push({ start, end });
  }
  return out;
}

/** "from 2025 …", "between 2025 and …", "2025–2034": the start of a period, not a target. */
function isRangeStartYear(sentence: string, occurrence: Span): boolean {
  return (
    /(?:^|[^\p{L}])(?:from|since|between|starting)\s+$/iu.test(sentence.slice(0, occurrence.start)) ||
    /^\s*(?:-|–|—|to|through|until|and)\s*(?:19|20)\d{2}/iu.test(sentence.slice(occurrence.end))
  );
}

const ATTACHED_YEAR_RE =
  /^\s*[(,]?\s*(?:(?:in|by|through|until|till|for|during|as of)\s+)?((?:19|20)\d{2})(?![\p{N}%]|[.,]\d)/iu;

/** The year written right after an amount ("in 2024", "by 2032", "(2034)"), or null. */
function attachedYear(sentence: string, amount: Span): { year: number; start: number } | null {
  const m = ATTACHED_YEAR_RE.exec(sentence.slice(amount.end, amount.end + 24));
  if (!m) return null;
  const end = amount.end + m[0].length;
  if (MAGNITUDE_AFTER_YEAR_RE.test(sentence.slice(end, end + 12))) return null;
  return { year: Number(m[1]), start: end - 4 };
}

/**
 * Why a declared year does not belong to the figure `amounts[target]`, or
 * null. The year must equal the figure's own attached year when it has one.
 * Otherwise some occurrence must be free (attached to no figure) or attached
 * to this figure; a projected claim may also share a later-than-retrieval
 * horizon attached to another figure ("Y by 2032, a CAGR of Z"). A projected
 * claim's year may not be only a range start ("from 2025 to 2034").
 */
function yearIssue(
  sentence: string,
  amounts: Span[],
  target: number,
  year: number,
  kind: "measured" | "projected",
  referenceYear: number,
): string | null {
  const figure = amounts[target];
  if (!figure) return "no figure to date";
  const own = attachedYear(sentence, figure);
  if (own && own.year !== year) return `the figure is tied to ${own.year}, not ${year}`;
  const owners = new Map<number, number>();
  amounts.forEach((amount, index) => {
    const attached = attachedYear(sentence, amount);
    if (attached) owners.set(attached.start, index);
  });
  for (const occurrence of yearOccurrences(sentence, year)) {
    if (kind === "projected" && isRangeStartYear(sentence, occurrence)) continue;
    const owner = owners.get(occurrence.start);
    if (owner === undefined || owner === target || (kind === "projected" && year > referenceYear)) return null;
  }
  return `${year} does not appear in the sentence as this figure's period`;
}

/**
 * The stat rules applied to an excerpt (acceptance and re-validation alike).
 * Some amount of the excerpt equals the claim, and for that amount: metric
 * and unit agree in the amount's assertion; the claimed period kind equals the derived one (ruling R2:
 * projected when isProjectedAmount marks it or the declared year is after
 * the retrieval year, otherwise measured); a declared year belongs to this
 * figure (see yearIssue); and a subject content word appears in the sentence.
 */
function checkStatExcerpt(excerpt: string, claim: StatClaim, referenceYear: number): StatCheck {
  if (!metricAllowsUnit(claim.metric, claim.amount.unit)) {
    return fail("metric_unit_mismatch", `${claim.metric} cannot be a ${claim.amount.unit} amount`);
  }
  const shape = subjectShapeIssue(claim.subject);
  if (shape) return fail("invalid_candidate", shape);
  const control = formatControlIn(excerpt);
  if (control) return fail("invalid_candidate", controlDetail("the supporting sentence", control));
  const laterDeclaredYear = claim.year !== undefined && claim.year > referenceYear;
  const amounts = scanAmounts(excerpt);
  let matched = false;
  let failure: Failure | null = null;
  for (const sentence of splitSentences(excerpt)) {
    const inSentence = amounts.filter((a) => a.numberStart >= sentence.start && a.numberStart < sentence.end);
    for (const found of inSentence) {
      if (!amountsEqual(found.amount, claim.amount)) continue;
      matched = true;
      const assertion = clauseAround(sentence.text, found.numberStart - sentence.start);
      const inAssertion = inSentence.filter((a) => a.numberStart >= sentence.start + assertion.start && a.numberStart < sentence.start + assertion.end);
      const spans = inAssertion.map((a) => ({ start: Math.max(0, a.start - sentence.start - assertion.start), end: a.end - sentence.start - assertion.start }));
      const index = inAssertion.indexOf(found);
      const metric = metricIssue(claim.metric, assertion.text);
      if (metric) {
        failure ??= fail("metric_unit_mismatch", metric);
        continue;
      }
      const span = spans[index] ?? { start: 0, end: 0 };
      const projected = laterDeclaredYear || isProjectedAmount(assertion.text, span, referenceYear);
      if (claim.periodKind === "measured" && projected) {
        failure ??= fail(
          "projection_as_measured",
          laterDeclaredYear
            ? `${claim.year} is after the retrieval year ${referenceYear}`
            : "a projection cue or a later year marks this figure; label it projected",
        );
        continue;
      }
      if (claim.periodKind === "projected" && !projected) {
        failure ??= fail("period_mismatch", "no projection cue before the figure and no later year after it; label it measured");
        continue;
      }
      const yearProblem =
        claim.year === undefined ? null : yearIssue(assertion.text, spans, index, claim.year, claim.periodKind, referenceYear);
      if (yearProblem) {
        failure ??= fail("year_not_in_context", yearProblem);
        continue;
      }
      const subject = subjectIssue(claim.subject, assertion.text);
      if (subject) {
        failure ??= fail("subject_not_in_context", subject);
        continue;
      }
      const period: MarketStatEvidence["period"] =
        claim.periodKind === "measured"
          ? { kind: "measured", ...(claim.year !== undefined ? { year: claim.year } : {}) }
          : { kind: "projected", ...(claim.year !== undefined ? { toYear: claim.year } : {}) };
      return { ok: true, period };
    }
  }
  if (!matched) {
    const found = amounts.map((a) => formatAmount(a.amount));
    return fail(
      "amount_mismatch",
      found.length > 0
        ? `excerpt has ${found.slice(0, 4).join(", ")}, not ${formatAmount(claim.amount)}`
        : `excerpt has no amount equal to ${formatAmount(claim.amount)}`,
    );
  }
  return failure ?? fail("amount_mismatch", "no sentence supports the amount");
}

/** Excerpt range for a stat: the one sentence holding the amount, if it fits. */
function statExcerptRange(text: string, amountIndex: number): { start: number; end: number } | null {
  const own = sentenceAround(text, amountIndex);
  return own.end - own.start <= EVIDENCE_LIMITS.excerptMaxChars ? { start: own.start, end: own.end } : null;
}

function acceptStat(candidate: MarketStatCandidate, context: Context): { ok: true; item: AcceptedEvidence } | Failure {
  const amount = parseAmount(candidate.amountText);
  if (!amount) return fail("unparseable_amount", `"${clip(candidate.amountText, 60)}" is not one supported amount`);
  const claim: StatClaim = {
    subject: candidate.subject,
    metric: candidate.metric,
    amount,
    periodKind: candidate.periodKind,
    ...(candidate.year !== undefined ? { year: candidate.year } : {}),
  };
  if (!metricAllowsUnit(claim.metric, amount.unit)) {
    return fail("metric_unit_mismatch", `${claim.metric} cannot be a ${amount.unit} amount`);
  }
  const shape = subjectShapeIssue(claim.subject);
  if (shape) return fail("invalid_candidate", shape);
  const resolved = resolveSource(context, candidate.sourceUrl);
  if (!resolved.ok) return resolved;
  const source = resolved.source;
  const span = findContiguousSpanIn(candidate.supportingText, source.prepared);
  if (!span.ok) return fail(span.reason, spanDetail(span.reason));
  const inSpan = scanAmounts(source.text, span.start, span.end);
  const equal = inSpan.filter((a) => amountsEqual(a.amount, amount));
  if (equal.length === 0) {
    const found = inSpan.map((a) => formatAmount(a.amount));
    return fail(
      "amount_mismatch",
      found.length > 0
        ? `supporting text has ${found.slice(0, 4).join(", ")}, not ${formatAmount(amount)}`
        : `supporting text has no amount equal to ${formatAmount(amount)}`,
    );
  }
  let failure: Failure | null = null;
  for (const found of equal) {
    const range = statExcerptRange(source.text, found.numberStart);
    if (!range) {
      failure = closer(failure, fail("span_bounds", `supporting sentence exceeds ${EVIDENCE_LIMITS.excerptMaxChars} characters`));
      continue;
    }
    const excerpt = source.text.slice(range.start, range.end);
    const check = checkStatExcerpt(excerpt, claim, source.referenceYear);
    if (!check.ok) {
      failure = closer(failure, check);
      continue;
    }
    const typed = { kind: "market_stat" as const, metric: candidate.metric, amount, period: check.period };
    const item: MarketStatEvidence = {
      ...baseFields(typed, source, excerpt),
      ...typed,
      attribution: "secondary",
      subject: candidate.subject,
    };
    return { ok: true, item };
  }
  return failure ?? fail("amount_mismatch", "no supporting sentence");
}

// ---------------------------------------------------------------------------
// Competitor prices
// ---------------------------------------------------------------------------

type Mention = { start: number; end: number };

const NAME_SUFFIX_RE = /(?:\.(?:ai|io|com|co|app|dev|so|net|org)|\s+ai|[\s,]+(?:inc|ltd|llc|corp)\.?)$/iu;

/** The vendor name, plus its suffix-free form when that is still distinctive. */
function nameAliases(name: string): string[] {
  const aliases = [name.trim()];
  const stripped = name.trim().replace(NAME_SUFFIX_RE, "").trim();
  if (stripped !== aliases[0] && vendorKey(stripped).length >= 4) aliases.push(stripped);
  return aliases;
}

/** A possessive word ("Loopio's", "Loopio’s") ends in an apostrophe and "s". */
const POSSESSIVE_END_RE = /['’]s$/iu;

/**
 * Character ranges where `name` (or an alias) appears as a whole word
 * sequence; the last word may be possessive ("Loopio's plan").
 */
function nameMentions(text: string, name: string): Mention[] {
  const form = normalizeForSourceMatch(text);
  const out: Mention[] = [];
  for (const alias of nameAliases(name)) {
    const wanted = normalizeForSourceMatch(alias).words;
    if (wanted.length === 0) continue;
    for (let i = 0; i + wanted.length <= form.words.length; i += 1) {
      const matches = wanted.every((w, j) => {
        const word = form.words[i + j];
        if (word === w) return true;
        const at = form.map[i + j];
        return j === wanted.length - 1 && word === `${w}s` && at !== undefined && POSSESSIVE_END_RE.test(text.slice(at.start, at.end));
      });
      if (!matches) continue;
      const first = form.map[i];
      const last = form.map[i + wanted.length - 1];
      if (first && last) out.push({ start: first.start, end: last.end });
    }
  }
  return out;
}

// --- Ruling R14: brand-like names around a price ------------------------------------

/**
 * Words that may stand capitalised near a price without naming a vendor
 * (ruling R14): function words and sentence openers, pricing, plan and
 * billing vocabulary, and the generic nouns of SaaS pricing pages.
 * All-caps abbreviations (SSO, API, SOC, RFP) are never brand-like either.
 */
const COMMON_NAME_WORDS: ReadonlySet<string> = new Set([
  // function words, pronouns, determiners and openers
  "a", "an", "the", "this", "that", "these", "those", "our", "your", "their", "its", "his", "her", "my", "we", "you",
  "they", "it", "he", "she", "us", "them", "all", "any", "each", "every", "some", "most", "many", "more", "much", "few",
  "both", "either", "neither", "no", "none", "one", "other", "another", "such", "own", "same", "and", "or", "but", "nor",
  "so", "yet", "for", "with", "without", "within", "from", "into", "at", "on", "in", "of", "to", "by", "as", "via",
  "per", "plus", "than", "then", "there", "here", "where", "when", "while", "if", "once", "only", "just", "also",
  "even", "still", "now", "today", "new", "up", "out", "off", "over", "under", "after", "before", "about", "around",
  "between", "through", "during", "including", "includes", "include", "included", "except", "everything",
  "anything", "nothing", "something", "everyone", "anyone", "yes", "please", "why", "what", "how", "who", "which",
  "note", "notes", "ready", "looking", "introducing", "meet", "welcome", "home", "hi", "hello", "faq", "faqs",
  // verbs that open pricing sentences
  "is", "are", "was", "were", "be", "been", "has", "have", "had", "do", "does", "did", "can", "could", "will",
  "would", "should", "may", "might", "must", "get", "gets", "pay", "pays", "paid", "cost", "costs", "charge",
  "charges", "start", "starts", "starting", "begin", "begins", "try", "buy", "choose", "pick", "go", "see", "view",
  "learn", "read", "save", "saves", "saving", "savings", "upgrade", "upgrades", "downgrade", "cancel", "contact",
  "talk", "call", "book", "request", "schedule", "sign", "join", "subscribe", "renew", "renews", "offer", "offers",
  "need", "needs", "want", "wants", "use", "uses", "add", "adds", "keep", "keeps", "help", "helps", "make",
  "makes", "run", "runs", "work", "works", "unlock", "unlocks", "explore", "discover", "compare", "billed", "bill",
  // pricing, billing and plan vocabulary
  "pricing", "price", "prices", "priced", "plan", "plans", "tier", "tiers", "package", "packages", "bundle",
  "bundles", "edition", "editions", "option", "options", "addon", "addons", "add", "extra", "extras", "additional",
  "billing", "month", "months", "monthly", "year", "years", "yearly", "annual", "annually", "week", "weekly", "day",
  "daily", "user", "users", "seat", "seats", "member", "members", "editor", "editors", "admin", "admins", "agent",
  "agents", "license", "licenses", "licence", "licences", "workspace", "workspaces", "account", "accounts", "team",
  "teams", "organization", "organizations", "organisation", "organisations", "org", "orgs", "company", "companies",
  "business", "businesses", "enterprise", "enterprises", "individual", "individuals", "personal", "starter",
  "basic", "essential", "essentials", "standard", "pro", "professional", "premium", "advanced", "growth", "scale",
  "startup", "startups", "small", "medium", "large", "free", "freemium", "trial", "trials", "demo", "custom",
  "unlimited", "ultimate", "elite", "lite", "light", "core", "max", "launch", "hobby", "hobbyist", "creator",
  "creators", "studio", "solo", "duo", "agency", "agencies", "partner", "partners", "nonprofit", "nonprofits",
  "education", "student", "students", "developer", "developers", "open", "source", "community", "platinum", "gold",
  "silver", "bronze", "beginner", "express", "flex", "flexible", "fixed", "total", "value", "best", "top",
  "popular", "recommended", "special", "limited", "discount", "discounts", "deal", "deals", "sale", "sales",
  "early", "beta", "intro", "introductory", "promo", "base", "usage", "overage", "overages", "credit", "credits",
  "token", "tokens", "minute", "minutes", "hour", "hours", "project", "projects", "repository", "repositories",
  "repo", "repos", "review", "reviews", "feature", "features", "support", "priority", "security", "compliance",
  "storage", "integration", "integrations", "access", "analytics", "report", "reports", "reporting", "dashboard",
  "dashboards", "library", "libraries", "answer", "answers", "questionnaire", "questionnaires", "proposal",
  "proposals", "response", "responses", "product", "products", "solution", "solutions", "service", "services",
  "platform", "app", "apps", "tool", "tools", "software", "saas", "cloud", "hosted", "managed", "self",
  // currencies and taxes
  "usd", "eur", "gbp", "cad", "aud", "dollar", "dollars", "euro", "euros", "pound", "pounds", "excl", "incl",
  "vat", "tax", "taxes",
  // months and weekdays
  "january", "february", "march", "april", "june", "july", "august", "september", "october", "november",
  "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "monday",
  "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]);

/** A word as it may stand for a name: letters, digits and the joiners of names such as RFP.ai, AT&T or Loopio's. */
const NAME_TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}.&'’+]*/gu;

/** The name a token stands for: no possessive, no trailing joiner. */
function bareName(token: string): string {
  return token.replace(POSSESSIVE_END_RE, "").replace(/[.&'’+]+$/u, "");
}

/**
 * Ruling R14: a capitalised token that may be a vendor or product name —
 * a capital letter somewhere (Qvidian, iCIMS, RFPForge), not a common word
 * (COMMON_NAME_WORDS), not an all-caps abbreviation, not a number.
 */
function isBrandLike(token: string): boolean {
  const bare = bareName(token);
  if (bare.length < 2 || !/\p{Lu}/u.test(bare) || /^\p{N}/u.test(bare)) return false;
  if (/^[\p{Lu}\p{N}]{2,6}s?$/u.test(bare)) return false;
  return !COMMON_NAME_WORDS.has(bare.toLowerCase());
}

type KnownMention = Mention & { claimed: boolean; name: string };

/** Mentions in `text` of the claimed vendor and its plan (claimed) and of every other known vendor. */
function knownMentions(text: string, vendor: string, plan: string | undefined, vendors: ReadonlyArray<string>): KnownMention[] {
  const out: KnownMention[] = nameMentions(text, vendor).map((m) => ({ ...m, claimed: true, name: vendor }));
  if (plan) out.push(...nameMentions(text, plan).map((m) => ({ ...m, claimed: true, name: plan })));
  const claimedKey = vendorKey(vendor);
  for (const other of vendors) {
    if (vendorKey(other) === claimedKey) continue;
    out.push(...nameMentions(text, other).map((m) => ({ ...m, claimed: false, name: other })));
  }
  return out;
}

/** What a token at [start, end) of a text names: a known mention (claimed ones first), a brand-like word, or nothing. */
function nameAt(token: string, start: number, end: number, known: ReadonlyArray<KnownMention>): { claimed: boolean; name: string } | null {
  const overlapping = known.filter((k) => k.start < end && start < k.end);
  const hit = overlapping.find((k) => k.claimed) ?? overlapping[0];
  if (hit) return { claimed: hit.claimed, name: hit.name };
  return isBrandLike(token) ? { claimed: false, name: bareName(token) } : null;
}

/**
 * Ruling R14: the nearest brand-like name before a price in its binding
 * window (its clause, plus a soft-wrapped line above it: amount.ts
 * bindingWindowStart) — the claimed vendor or its plan (claimed), another
 * name, or null when none stands there.
 */
function nearestNameBefore(
  text: string,
  expression: PriceExpression,
  vendor: string,
  plan: string | undefined,
  vendors: ReadonlyArray<string>,
): { claimed: boolean; name: string } | null {
  const start = bindingWindowStart(text, expression);
  const window = text.slice(start, expression.start);
  const known = knownMentions(window, vendor, plan, vendors);
  const words = [...window.matchAll(new RegExp(NAME_TOKEN_RE.source, NAME_TOKEN_RE.flags))];
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i];
    if (!word) continue;
    const at = word.index ?? 0;
    const name = nameAt(word[0], at, at + word[0].length, known);
    if (name) return name;
  }
  return null;
}

/** "for" (and a determiner) right after a price, then the word it is for. */
const FOR_AFTER_PRICE_RE =
  /^[ \t\u00A0,]*for[ \t\u00A0]+(?:(?:the|a|an|its|their|our|your|each|every)[ \t\u00A0]+)?([\p{L}\p{N}][\p{L}\p{N}.&'’+]*)/iu;

/** Ruling R14: a name other than the vendor's right after "for" behind the price ("$30/month for Qvidian"), or null. */
function nameAfterFor(
  text: string,
  expression: PriceExpression,
  vendor: string,
  plan: string | undefined,
  vendors: ReadonlyArray<string>,
): string | null {
  const tail = text.slice(expression.end, expression.clauseEnd);
  const m = FOR_AFTER_PRICE_RE.exec(tail);
  const token = m?.[1];
  if (!m || !token) return null;
  const at = m[0].length - token.length;
  const name = nameAt(token, at, at + token.length, knownMentions(tail, vendor, plan, vendors));
  return name && !name.claimed ? name.name : null;
}

/** "after", "over" and replace(d) count as comparison cues only before a name ("chose Loopio over Qvidian"). */
const NAME_CUE_RE =
  /(?<![\p{L}\p{N}])(after|over|replac(?:e|es|ed|ing))[ \t\u00A0]+(?:(?:the|a|an)[ \t\u00A0]+)?([\p{L}\p{N}][\p{L}\p{N}.&'’+]*)/giu;

/** Ruling R14: the after/over/replace cue before a name in a price's comparison range, or null. */
function nameCueFor(text: string, expression: PriceExpression, vendors: ReadonlyArray<string>): string | null {
  const range = comparisonRange(text, expression);
  const sentence = text.slice(range.start, range.end);
  for (const m of sentence.matchAll(new RegExp(NAME_CUE_RE.source, NAME_CUE_RE.flags))) {
    const cue = m[1];
    const token = m[2];
    if (!cue || !token) continue;
    const at = (m.index ?? 0) + m[0].length - token.length;
    const known = vendors.flatMap((v) => nameMentions(sentence, v)).some((k) => k.start < at + token.length && at < k.end);
    if (known || isBrandLike(token)) return cue.toLowerCase();
  }
  return null;
}

type Attribution = { ok: true; attribution: "first_party" | "secondary" } | Failure;

/**
 * Ruling R5: a vendor's own site is not evidence for a rival's price. When
 * the source is first-party for another known vendor (any page on its host,
 * comparison pages included), a price claimed for `vendor` from it is
 * ambiguous_attribution, whatever the clause says. Sources that are no known
 * vendor's own site keep the clause binding rules in attributeVendor.
 * Acceptance and offline re-validation both apply it (checkPriceExcerpt), so
 * a stored item that breaks it fails the record parse.
 */
function rivalSiteFailure(vendor: string, sourceUrl: string, vendors: ReadonlyArray<string>): Failure | null {
  const claimedKey = vendorKey(vendor);
  for (const other of vendors) {
    if (vendorKey(other) === claimedKey || !isFirstPartyHost(other, sourceUrl)) continue;
    return fail(
      "ambiguous_attribution",
      `the source is ${clip(other, 40)}'s own site (${sourceHostLabel(sourceUrl)}); a vendor's own site is not evidence for ${clip(vendor, 40)}'s price (ruling R5)`,
    );
  }
  return null;
}

/**
 * Who a price in `text` belongs to. No other known vendor may be named in
 * the price's clause. A first-party host (not a comparison page) needs no
 * name; otherwise the claimed vendor must be named before the price in its
 * clause. On every page (ruling R14) the nearest brand-like name before the
 * price — in its clause or a soft-wrapped line above — must be the claimed
 * vendor or its plan, and no other name may follow the price after "for".
 * `plan` is the plan that binds (planBinds), so acceptance and re-validation
 * read the same names. Callers apply rivalSiteFailure (ruling R5) first.
 */
function attributeVendor(
  text: string,
  expression: PriceExpression,
  claim: { vendor: string; plan?: string },
  sourceUrl: string,
  vendors: ReadonlyArray<string>,
): Attribution {
  const { vendor, plan } = claim;
  const clause = text.slice(expression.clauseStart, expression.clauseEnd);
  const claimed = nameMentions(clause, vendor);
  const claimedKey = vendorKey(vendor);
  for (const other of vendors) {
    if (vendorKey(other) === claimedKey) continue;
    const overlapsClaimed = (m: Mention) => claimed.some((c) => m.start < c.end && c.start < m.end);
    const mentions = nameMentions(clause, other).filter((m) => !overlapsClaimed(m));
    if (mentions.length > 0) {
      return fail("ambiguous_attribution", `the price's clause also names ${clip(other, 40)}`);
    }
  }
  if (isVendorMarketplaceListing(vendor, sourceUrl)) return { ok: true, attribution: "secondary" };
  const nearest = nearestNameBefore(text, expression, vendor, plan, vendors);
  const nearer = (): Failure | null => {
    if (nearest && !nearest.claimed) {
      return fail(
        "ambiguous_attribution",
        `the nearest name before the price is "${clip(nearest.name, 40)}", not ${clip(vendor, 40)} (ruling R14)`,
      );
    }
    const after = nameAfterFor(text, expression, vendor, plan, vendors);
    return after
      ? fail("ambiguous_attribution", `the price is "for ${clip(after, 40)}", not for ${clip(vendor, 40)} (ruling R14)`)
      : null;
  };
  const firstParty = isFirstPartyHost(vendor, sourceUrl);
  if (firstParty && !isComparisonPage(sourceUrl)) return nearer() ?? { ok: true, attribution: "first_party" };
  const priceOffset = expression.start - expression.clauseStart;
  if (!claimed.some((m) => m.end <= priceOffset)) {
    return fail("vendor_not_in_context", `${clip(vendor, 40)} is not named before the price in its clause`);
  }
  return nearer() ?? { ok: true, attribution: firstParty ? "first_party" : "secondary" };
}

type PriceClaim = { vendor: string; terms: PriceTerms };

/** A price evidence item represents a current, exact offer, not speculation or history. */
function priceAssertionFailure(text: string, expression: PriceExpression): Failure | null {
  const assertion = text.slice(expression.clauseStart, expression.clauseEnd);
  if (/\b(?:not|never|without|no longer|isn't|aren't|doesn't|didn't|won't|can't)\b/iu.test(assertion)) {
    return fail("unsupported_assertion", "the source denies the price or describes an absence, not a current offer");
  }
  if (/\b(?:used to|formerly|previously|historically|historical|discontinued|old price|was priced|were priced)\b/iu.test(assertion)) {
    return fail("unsupported_assertion", "the source describes a historical price, not a current offer");
  }
  if (/\b(?:if|might|could|would|may|hypothetically|potentially)\b/iu.test(assertion)) {
    return fail("unsupported_assertion", "the source makes the price conditional or hypothetical");
  }
  if (/\b(?:about|around|roughly|approximately|approx|estimated|estimate|average)\b|[~≈]/iu.test(assertion)) {
    return fail("unsupported_assertion", "the source gives an approximate or modelled price, not an exact offer");
  }
  return null;
}

/**
 * Rulings R9 and R14, for one price expression of `text` (the source page
 * at acceptance, the excerpt at re-validation): a comparison cue in the
 * price's sentence binds no price (ambiguous_attribution) — the R9 words,
 * moved/migrated to, replaced by, and after/over before a name — and a page
 * that shows annual billing above a per-month price without the clause
 * saying which is ambiguous billing (qualifier_dropped).
 */
function priceContextFailure(
  text: string,
  expression: PriceExpression,
  vendors: ReadonlyArray<string>,
  cues?: PageBillingCues,
): Failure | null {
  const assertion = priceAssertionFailure(text, expression);
  if (assertion) return assertion;
  const cue = comparisonCueFor(text, expression) ?? nameCueFor(text, expression, vendors);
  if (cue) {
    return fail(
      "ambiguous_attribution",
      `the price's sentence compares vendors ("${cue}"); a comparison binds no price (rulings R9, R14)`,
    );
  }
  const billing = ambiguousBilling(text, expression, cues ?? pageBillingCues(text));
  return billing ? fail("qualifier_dropped", billing) : null;
}

type PriceCheck =
  | { ok: true; attribution: "first_party" | "secondary"; expression: PriceExpression; plan: string | undefined }
  | Failure;

/**
 * The price rules applied to an excerpt (acceptance and re-validation alike):
 * not from another known vendor's own site (ruling R5), an equal price
 * expression whose sentence compares no vendors and whose billing is not
 * ambiguous (rulings R9, R14), with a valid attribution (R14 names). Returns
 * the expression it bound and the claimed plan when it binds there
 * (planBinds), else undefined.
 */
function checkPriceExcerpt(
  excerpt: string,
  claim: PriceClaim & { plan?: string },
  sourceUrl: string,
  vendors: ReadonlyArray<string>,
): PriceCheck {
  const nameControl = priceNameControl(claim);
  if (nameControl) return nameControl;
  const control = formatControlIn(excerpt);
  if (control) return fail("invalid_candidate", controlDetail("the price's sentence", control));
  const rivalSite = rivalSiteFailure(claim.vendor, sourceUrl, vendors);
  if (rivalSite) return rivalSite;
  const expressions = priceExpressionsIn(excerpt);
  if (expressions.length === 0) {
    return fail("unparseable_amount", "excerpt has no supported price expression");
  }
  let failure: Failure | null = null;
  for (const expression of expressions) {
    const mismatch = comparePriceTerms(claim.terms, expression.terms);
    if (mismatch) {
      failure = closer(failure, fail(mismatch, `source says ${formatPriceTerms(expression.terms)}`));
      continue;
    }
    const context = priceContextFailure(excerpt, expression, vendors);
    if (context) {
      failure = closer(failure, context);
      continue;
    }
    const plan = claim.plan !== undefined && planBinds(claim.plan, excerpt, expression) ? claim.plan : undefined;
    const attribution = attributeVendor(excerpt, expression, { vendor: claim.vendor, ...(plan ? { plan } : {}) }, sourceUrl, vendors);
    if (attribution.ok) return { ok: true, attribution: attribution.attribution, expression, plan };
    failure = closer(failure, attribution);
  }
  return failure ?? fail("unparseable_amount", "excerpt has no supported price expression");
}

/**
 * A plan mention right after these words is another plan, not this price's
 * plan: its features ("everything in", "all of", "includes") or the plan it
 * replaces or beats ("from", "upgrade from", "than"; ruling R14).
 */
const PLAN_CONTEXT_RE =
  /(?:^|[^\p{L}])(?:(?:everything|all|anything)[ \t\u00A0]+(?:in|of|from)|includes|including|included[ \t\u00A0]+in|from|than)[ \t\u00A0]+(?:the[ \t\u00A0]+)?$/iu;

/**
 * Rulings R9 and R14: a plan name binds to a price only on the price's own
 * line or the nearest non-blank line above it, and never right after
 * "everything in", "all of", "includes", "from", "upgrade from" or "than"
 * ("Pro — Everything in Starter, plus SSO. $24/user/month" and "Upgrade
 * from Starter: $24/user/month" are Pro prices). Read on the excerpt, so
 * acceptance and re-validation agree.
 */
function planBinds(plan: string, excerpt: string, expression: PriceExpression): boolean {
  const own = lineAround(excerpt, expression.start);
  const lines = [own, lineAbove(excerpt, own.start)].filter((l): l is { start: number; end: number } => l !== null);
  for (const line of lines) {
    const text = excerpt.slice(line.start, line.end);
    for (const mention of nameMentions(text, plan)) {
      if (!PLAN_CONTEXT_RE.test(text.slice(0, mention.start))) return true;
    }
  }
  return false;
}

/** Excerpt range for a price: span's sentence start through the price's clause end. */
function priceExcerptRange(text: string, spanStart: number, expression: PriceExpression): { start: number; end: number } | null {
  const sentenceStart = sentenceAround(text, spanStart).start;
  const start = Math.min(sentenceStart, expression.clauseStart);
  const end = expression.clauseEnd;
  if (end - start <= EVIDENCE_LIMITS.excerptMaxChars) return { start, end };
  if (end - expression.clauseStart <= EVIDENCE_LIMITS.excerptMaxChars) return { start: expression.clauseStart, end };
  return null;
}

/** Ruling R15: a vendor or plan name that holds a format control, as a failure, or null. */
function priceNameControl(claim: { vendor: string; plan?: string }): Failure | null {
  const vendor = formatControlIn(claim.vendor);
  if (vendor) return fail("invalid_candidate", controlDetail("the vendor name", vendor));
  const plan = claim.plan === undefined ? null : formatControlIn(claim.plan);
  return plan ? fail("invalid_candidate", controlDetail("the plan name", plan)) : null;
}

function acceptPrice(candidate: CompetitorPriceCandidate, context: Context): { ok: true; item: AcceptedEvidence } | Failure {
  const vendor = candidate.vendor;
  const nameControl = priceNameControl({ vendor, ...(candidate.plan !== undefined ? { plan: candidate.plan } : {}) });
  if (nameControl) return nameControl;
  if (vendorKey(vendor).length < 2) return fail("invalid_candidate", "vendor name is too short to identify");
  const terms = parsePriceTerms(candidate.priceText);
  if (!terms) return fail("unparseable_amount", `"${clip(candidate.priceText, 60)}" is not one supported price expression`);
  const resolved = resolveSource(context, candidate.sourceUrl);
  if (!resolved.ok) return resolved;
  const source = resolved.source;
  // Checked before the span, so a rival's price from a vendor's own site is
  // always reported as R5, not as whichever term mismatch came first.
  const rivalSite = rivalSiteFailure(vendor, source.url, context.vendors);
  if (rivalSite) return rivalSite;
  const span = findContiguousSpanIn(candidate.supportingText, source.prepared);
  if (!span.ok) return fail(span.reason, spanDetail(span.reason));
  const expressions = priceExpressionsIn(source.text, span.start, span.end);
  if (expressions.length === 0) {
    return fail("unparseable_amount", "supporting text has no supported price expression");
  }
  let failure: Failure | null = null;
  for (const expression of expressions) {
    const mismatch = comparePriceTerms(terms, expression.terms);
    if (mismatch) {
      failure = closer(failure, fail(mismatch, `source says ${formatPriceTerms(expression.terms)}`));
      continue;
    }
    // Rulings R9 and R14 on the whole page first: the price's full sentence,
    // a soft-wrapped line above it and every line above it (billing), which
    // the stored excerpt may not include.
    let cues = context.billing.get(source.url);
    if (!cues) {
      cues = pageBillingCues(source.text);
      context.billing.set(source.url, cues);
    }
    const sourceContext = priceContextFailure(source.text, expression, context.vendors, cues);
    if (sourceContext) {
      failure = closer(failure, sourceContext);
      continue;
    }
    const plan = candidate.plan?.trim() || undefined;
    const pageNames = attributeVendor(source.text, expression, { vendor, ...(plan ? { plan } : {}) }, source.url, context.vendors);
    if (!pageNames.ok) {
      failure = closer(failure, pageNames);
      continue;
    }
    const range = priceExcerptRange(source.text, span.start, expression);
    if (!range) {
      failure = closer(failure, fail("span_bounds", `price clause exceeds ${EVIDENCE_LIMITS.excerptMaxChars} characters`));
      continue;
    }
    const excerpt = source.text.slice(range.start, range.end);
    const check = checkPriceExcerpt(excerpt, { vendor, terms, ...(plan ? { plan } : {}) }, source.url, context.vendors);
    if (!check.ok) {
      failure = closer(failure, check);
      continue;
    }
    const typed = {
      kind: "competitor_price" as const,
      vendor,
      ...(check.plan ? { plan: check.plan } : {}),
      price: terms,
    };
    const item: CompetitorPriceEvidence = {
      ...baseFields(typed, source, excerpt),
      ...typed,
      attribution: check.attribution,
    };
    return { ok: true, item };
  }
  return failure ?? fail("unparseable_amount", "supporting text has no supported price expression");
}

const AVAILABILITY_CUES: Record<CompetitorAvailability, RegExp> = {
  contact_sales: /\b(?:contact sales|talk to sales|custom (?:quote|pricing)|get (?:a )?quote|pricing on request)\b/iu,
  usage_based: /\b(?:usage[- ]based pricing|pay[- ]as[- ]you[- ]go|per KB(?: of diff)? reviewed|per commit processed)\b/iu,
  credit_pack: /\b(?:credit packs?|packs? of \d[\d,]* credits)\b/iu,
};

function availabilityExcerptIssue(excerpt: string, vendor: string, availability: CompetitorAvailability, sourceUrl: string, vendors: ReadonlyArray<string>): Failure | null {
  const control = formatControlIn(excerpt);
  if (control) return fail("invalid_candidate", controlDetail("the pricing statement", control));
  if (!isFirstPartyHost(vendor, sourceUrl) || isComparisonPage(sourceUrl)) {
    return fail("ambiguous_attribution", "a pricing-availability statement requires the vendor's own non-comparison page");
  }
  for (const other of vendors) {
    if (vendorKey(other) !== vendorKey(vendor) && nameMentions(excerpt, other).length > 0) {
      return fail("ambiguous_attribution", `the pricing statement also names ${clip(other, 40)}`);
    }
  }
  if (!/(?:price|pricing|plan|quote|billing|usage|credit)/iu.test(new URL(sourceUrl).pathname + " " + excerpt)) {
    return fail("unsupported_assertion", "the statement is not in pricing context");
  }
  if (!AVAILABILITY_CUES[availability].test(excerpt)) {
    return fail("unsupported_assertion", `the excerpt does not state ${availability.replace(/_/g, " ")}`);
  }
  return null;
}

function acceptAvailability(candidate: CompetitorAvailabilityCandidate, context: Context): { ok: true; item: AcceptedEvidence } | Failure {
  if (formatControlIn(candidate.vendor) || vendorKey(candidate.vendor).length < 2) return fail("invalid_candidate", "invalid vendor name");
  const resolved = resolveSource(context, candidate.sourceUrl);
  if (!resolved.ok) return resolved;
  const source = resolved.source;
  const rival = rivalSiteFailure(candidate.vendor, source.url, context.vendors);
  if (rival) return rival;
  const span = findContiguousSpanIn(candidate.supportingText, source.prepared);
  if (!span.ok) return fail(span.reason, spanDetail(span.reason));
  const sentence = sentenceAround(source.text, span.start);
  if (span.end > sentence.end || sentence.end - sentence.start > EVIDENCE_LIMITS.excerptMaxChars) {
    return fail("span_bounds", "pricing statement must fit in one sentence of at most 600 characters");
  }
  const excerpt = source.text.slice(sentence.start, sentence.end);
  const issue = availabilityExcerptIssue(excerpt, candidate.vendor, candidate.availability, source.url, context.vendors);
  if (issue) return issue;
  const claim = { kind: "competitor_availability" as const, vendor: candidate.vendor, availability: candidate.availability };
  const item: CompetitorAvailabilityEvidence = { ...baseFields(claim, source, excerpt), ...claim, attribution: "first_party" };
  return { ok: true, item };
}

// ---------------------------------------------------------------------------
// Acceptance
// ---------------------------------------------------------------------------

/**
 * Two accepted items state the same claim at the same place: equal ids, or
 * the same kind, URL and excerpt with an equal claim (amounts compared
 * exactly, so "$1.2 billion" and "$1,200,000,000" are the same figure).
 */
function sameClaim(a: AcceptedEvidence, b: AcceptedEvidence): boolean {
  if (a.id === b.id) return true;
  if (a.kind !== b.kind || a.sourceUrl !== b.sourceUrl || a.excerpt !== b.excerpt) return false;
  if (a.kind === "market_stat" && b.kind === "market_stat") {
    return (
      a.metric === b.metric &&
      amountsEqual(a.amount, b.amount) &&
      a.period.kind === b.period.kind &&
      a.period.year === b.period.year &&
      a.period.toYear === b.period.toYear
    );
  }
  if (a.kind === "competitor_price" && b.kind === "competitor_price") {
    return (
      vendorKey(a.vendor) === vendorKey(b.vendor) &&
      (a.plan ?? "") === (b.plan ?? "") &&
      comparePriceTerms(a.price, b.price) === null
    );
  }
  if (a.kind === "competitor_availability" && b.kind === "competitor_availability") {
    return vendorKey(a.vendor) === vendorKey(b.vendor) && a.availability === b.availability;
  }
  return true;
}

function rawField(raw: unknown, key: string): string {
  return isPlainObject(raw) ? textField(raw, key) : "";
}

function rejection(
  kind: EvidenceKind,
  reason: RejectionReason,
  sourceUrl: unknown,
  claim: string,
  detail: string,
): RejectedEvidence {
  const url = typeof sourceUrl === "string" ? (recordableUrl(sourceUrl) ?? "") : "";
  // Operator-only text from untrusted candidates: format controls shown as U+FFFD (ruling R15).
  const candidate = withoutFormatControls(claim.trim());
  return {
    kind,
    reason,
    ...(url ? { sourceUrl: url } : {}),
    ...(candidate ? { candidate: clip(candidate, EVIDENCE_LIMITS.rejectedCandidateChars) } : {}),
    detail: clip(withoutFormatControls(detail), DETAIL_CHARS),
  };
}

/**
 * Accept or reject every candidate against the acquired text of its own
 * canonical citation. Deterministic: quotes, then stats, then prices, each in
 * candidate order. The same claim again at the same place (equal id, or an
 * equal claim with the same URL and excerpt) is "duplicate"; more than
 * EVIDENCE_LIMITS.maxAccepted of a kind is "over_cap".
 */
export function acceptEvidence(input: AcceptEvidenceInput): AcceptEvidenceResult {
  const context = createContext(input);
  const accepted: AcceptedEvidence[] = [];
  const rejected: RejectedEvidence[] = [];
  const counts: Record<EvidenceKind, number> = { community_quote: 0, market_stat: 0, competitor_price: 0, competitor_availability: 0 };

  const settle = (
    kind: EvidenceKind,
    sourceUrl: unknown,
    claim: string,
    outcome: { ok: true; item: AcceptedEvidence } | Failure,
  ) => {
    if (!outcome.ok) {
      rejected.push(rejection(kind, outcome.reason, sourceUrl, claim, outcome.detail));
      return;
    }
    const { item } = outcome;
    const twin = accepted.find((other) => sameClaim(other, item));
    if (twin) {
      rejected.push(rejection(kind, "duplicate", sourceUrl, claim, `same claim at the same place as accepted ${twin.id}`));
      return;
    }
    if (counts[kind] >= EVIDENCE_LIMITS.maxAccepted[kind]) {
      rejected.push(rejection(kind, "over_cap", sourceUrl, claim, `more than ${EVIDENCE_LIMITS.maxAccepted[kind]} accepted`));
      return;
    }
    counts[kind] += 1;
    accepted.push(item);
  };

  // The shape checks run again here, so a caller that skipped
  // parseExtractionCandidates still cannot pass malformed candidates through.
  for (const raw of input.candidates.quotes) {
    const read = readQuoteCandidate(raw);
    const outcome = read.ok ? acceptQuote(read.value, context) : fail("invalid_candidate", read.error);
    settle("community_quote", rawField(raw, "sourceUrl"), rawField(raw, "text"), outcome);
  }
  for (const raw of input.candidates.marketStats) {
    const read = readStatCandidate(raw);
    const outcome = read.ok ? acceptStat(read.value, context) : fail("invalid_candidate", read.error);
    settle("market_stat", rawField(raw, "sourceUrl"), `${rawField(raw, "subject")}: ${rawField(raw, "amountText")}`, outcome);
  }
  for (const raw of input.candidates.competitorPrices) {
    const read = readPriceCandidate(raw);
    const outcome = read.ok ? acceptPrice(read.value, context) : fail("invalid_candidate", read.error);
    settle("competitor_price", rawField(raw, "sourceUrl"), `${rawField(raw, "vendor")}: ${rawField(raw, "priceText")}`, outcome);
  }
  for (const raw of input.candidates.competitorAvailability ?? []) {
    const read = readAvailabilityCandidate(raw);
    const outcome = read.ok ? acceptAvailability(read.value, context) : fail("invalid_candidate", read.error);
    settle("competitor_availability", rawField(raw, "sourceUrl"), `${rawField(raw, "vendor")}: ${rawField(raw, "availability")}`, outcome);
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------------------
// Offline re-validation (record parser)
// ---------------------------------------------------------------------------

const COMMON_KEYS = ["id", "kind", "sourceUrl", "sourceTitle", "excerpt", "excerptSha256", "retrievedAt", "attribution"];
const ALLOWED_KEYS: Record<EvidenceKind, ReadonlySet<string>> = {
  community_quote: new Set(COMMON_KEYS),
  market_stat: new Set([...COMMON_KEYS, "subject", "metric", "amount", "period"]),
  competitor_price: new Set([...COMMON_KEYS, "vendor", "plan", "price"]),
  competitor_availability: new Set([...COMMON_KEYS, "vendor", "availability"]),
};
const MAGNITUDES = ["none", "thousand", "million", "billion", "trillion"] as const;
const UNITS = ["currency", "percent", "count"] as const;
const PERIODS = ["month", "year", "week", "day", "one_time"] as const;
const BASES = ["flat", "per_user", "per_workspace"] as const;
const QUALIFIERS = ["billed_annually", "billed_monthly", "introductory", "plus_usage", "starting_at"] as const;

function nonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value === value.trim() && value.length <= max;
}

function isYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= CANDIDATE_LIMITS.minYear &&
    value <= CANDIDATE_LIMITS.maxYear
  );
}

function readStoredAmount(value: unknown, issues: string[], path: string): Amount | null {
  if (!isPlainObject(value)) {
    issues.push(`${path}: expected an object`);
    return null;
  }
  const extra = Object.keys(value).filter((k) => !["value", "magnitude", "unit", "currency"].includes(k));
  if (extra.length > 0) issues.push(`${path}: unexpected field ${extra.join(", ")}`);
  const magnitude = MAGNITUDES.find((m) => m === value.magnitude);
  const unit = UNITS.find((u) => u === value.unit);
  if (typeof value.value !== "string" || !/^\d{1,30}(?:\.\d{1,30})?$/.test(value.value)) {
    issues.push(`${path}.value: expected decimal digits`);
  }
  if (!magnitude) issues.push(`${path}.magnitude: invalid`);
  if (!unit) issues.push(`${path}.unit: invalid`);
  const currency = CURRENCIES.find((c) => c === value.currency);
  if (unit === "currency" && !currency) issues.push(`${path}.currency: required for a currency amount`);
  if (unit !== "currency" && value.currency !== undefined) issues.push(`${path}.currency: only for currency amounts`);
  if (typeof value.value !== "string" || !magnitude || !unit) return null;
  if (unit === "currency") return currency ? { value: value.value, magnitude, unit, currency } : null;
  return { value: value.value, magnitude, unit };
}

function readStoredPeriod(value: unknown, issues: string[]): MarketStatEvidence["period"] | null {
  if (!isPlainObject(value)) {
    issues.push("period: expected an object");
    return null;
  }
  const extra = Object.keys(value).filter((k) => !["kind", "year", "toYear"].includes(k));
  if (extra.length > 0) issues.push(`period: unexpected field ${extra.join(", ")}`);
  if (value.kind === "measured") {
    if (value.toYear !== undefined) issues.push("period.toYear: only for projected figures");
    if (value.year !== undefined && !isYear(value.year)) issues.push("period.year: invalid");
    return isYear(value.year) ? { kind: "measured", year: value.year } : { kind: "measured" };
  }
  if (value.kind === "projected") {
    if (value.year !== undefined) issues.push("period.year: projected figures use toYear");
    if (value.toYear !== undefined && !isYear(value.toYear)) issues.push("period.toYear: invalid");
    return isYear(value.toYear) ? { kind: "projected", toYear: value.toYear } : { kind: "projected" };
  }
  issues.push("period.kind: expected measured or projected");
  return null;
}

function readStoredPrice(value: unknown, issues: string[]): PriceTerms | null {
  if (!isPlainObject(value)) {
    issues.push("price: expected an object");
    return null;
  }
  const extra = Object.keys(value).filter((k) => !["amount", "period", "basis", "qualifiers"].includes(k));
  if (extra.length > 0) issues.push(`price: unexpected field ${extra.join(", ")}`);
  const amount = readStoredAmount(value.amount, issues, "price.amount");
  if (amount && amount.unit !== "currency") issues.push("price.amount: must be a currency amount");
  const period = PERIODS.find((p) => p === value.period);
  const basis = BASES.find((b) => b === value.basis);
  if (!period) issues.push("price.period: invalid");
  if (!basis) issues.push("price.basis: invalid");
  const raw = Array.isArray(value.qualifiers) ? value.qualifiers : null;
  const qualifiers = raw ? raw.map((q) => QUALIFIERS.find((x) => x === q)) : null;
  if (!qualifiers || qualifiers.some((q) => q === undefined)) {
    issues.push("price.qualifiers: expected known qualifiers");
    return null;
  }
  const known = qualifiers.filter((q): q is (typeof QUALIFIERS)[number] => q !== undefined);
  const canonical = QUALIFIERS.filter((q) => known.includes(q));
  if (canonical.length !== known.length || canonical.some((q, i) => q !== known[i])) {
    issues.push("price.qualifiers: must be sorted and unique");
  }
  if (!amount || amount.unit !== "currency" || !period || !basis) return null;
  return { amount, period, basis, qualifiers: known };
}

function samePeriod(a: MarketStatEvidence["period"], b: MarketStatEvidence["period"]): boolean {
  return a.kind === b.kind && a.year === b.year && a.toYear === b.toYear;
}

/** A stored item's typed claim after shape checks (attribution included). */
type StoredClaim =
  | { kind: "community_quote" }
  | {
      kind: "market_stat";
      subject: string;
      metric: MarketStatMetric;
      amount: Amount;
      period: MarketStatEvidence["period"];
    }
  | {
      kind: "competitor_price";
      attribution: "first_party" | "secondary";
      vendor: string;
      plan?: string;
      price: PriceTerms;
    }
  | { kind: "competitor_availability"; vendor: string; availability: CompetitorAvailability };

/** Shape-check the typed claim fields of a stored item; null (with issues) when invalid. */
function readStoredClaim(kind: EvidenceKind, item: Record<string, unknown>, issues: string[]): StoredClaim | null {
  if (kind === "community_quote") {
    if (item.attribution !== "community") issues.push("attribution: quotes are community");
    return { kind };
  }
  if (kind === "market_stat") {
    if (item.attribution !== "secondary") issues.push("attribution: market stats are secondary");
    const subject = nonEmptyString(item.subject, CANDIDATE_LIMITS.claimChars) ? item.subject : null;
    if (subject === null) issues.push("subject: required");
    const metric = METRICS.find((m) => m === item.metric);
    if (!metric) issues.push("metric: invalid");
    const amount = readStoredAmount(item.amount, issues, "amount");
    const period = readStoredPeriod(item.period, issues);
    return subject !== null && metric && amount && period ? { kind, subject, metric, amount, period } : null;
  }
  if (kind === "competitor_availability") {
    if (item.attribution !== "first_party") issues.push("attribution: availability statements must be first_party");
    const vendor = nonEmptyString(item.vendor, CANDIDATE_LIMITS.nameChars) && vendorKey(item.vendor).length >= 2 ? item.vendor : null;
    if (vendor === null) issues.push("vendor: required");
    const availability = AVAILABILITY.find((v) => v === item.availability);
    if (!availability) issues.push("availability: invalid");
    return vendor && availability ? { kind, vendor, availability } : null;
  }
  const attribution = item.attribution === "first_party" || item.attribution === "secondary" ? item.attribution : null;
  if (!attribution) issues.push("attribution: prices are first_party or secondary");
  const vendor =
    nonEmptyString(item.vendor, CANDIDATE_LIMITS.nameChars) && vendorKey(item.vendor).length >= 2 ? item.vendor : null;
  if (vendor === null) issues.push("vendor: required");
  const planValid = item.plan === undefined || nonEmptyString(item.plan, CANDIDATE_LIMITS.nameChars);
  if (!planValid) issues.push("plan: invalid");
  const price = readStoredPrice(item.price, issues);
  if (!attribution || vendor === null || !planValid || !price) return null;
  const plan = typeof item.plan === "string" ? item.plan : undefined;
  return { kind, attribution, vendor, ...(plan !== undefined ? { plan } : {}), price };
}

/** Re-derive a stored claim from its own excerpt with the acceptance rules. */
function rederivationIssues(
  claim: StoredClaim,
  excerpt: string,
  sourceUrl: string,
  referenceYear: number,
  vendors: ReadonlyArray<string>,
): string[] {
  if (claim.kind === "community_quote") {
    const issues: string[] = [];
    const bounds = quoteBoundsIssue(excerpt);
    if (bounds) issues.push(`excerpt: ${bounds}`);
    const lineBreak = quoteLineBreakIssue(excerpt);
    if (lineBreak) issues.push(`excerpt: ${lineBreak}`);
    const control = formatControlIn(excerpt);
    if (control) issues.push(`excerpt: ${controlDetail("the quote", control)}`);
    return issues;
  }
  if (claim.kind === "market_stat") {
    const { period } = claim;
    const year = period.kind === "measured" ? period.year : period.toYear;
    const check = checkStatExcerpt(
      excerpt,
      {
        subject: claim.subject,
        metric: claim.metric,
        amount: claim.amount,
        periodKind: period.kind,
        ...(year !== undefined ? { year } : {}),
      },
      referenceYear,
    );
    if (!check.ok) return [`claim: ${check.reason} (${check.detail})`];
    return samePeriod(check.period, period) ? [] : ["period: does not re-derive from the excerpt"];
  }
  if (claim.kind === "competitor_availability") {
    const issue = availabilityExcerptIssue(excerpt, claim.vendor, claim.availability, sourceUrl, vendors);
    return issue ? [`claim: ${issue.reason} (${issue.detail})`] : [];
  }
  const check = checkPriceExcerpt(
    excerpt,
    { vendor: claim.vendor, terms: claim.price, ...(claim.plan !== undefined ? { plan: claim.plan } : {}) },
    sourceUrl,
    vendors,
  );
  if (!check.ok) return [`claim: ${check.reason} (${check.detail})`];
  const issues: string[] = [];
  if (check.attribution !== claim.attribution) {
    issues.push(`attribution: re-derives as ${check.attribution}, stored ${claim.attribution}`);
  }
  if (claim.plan !== undefined && check.plan === undefined) {
    issues.push("plan: not named on the price's own line or the line above it (rulings R9, R14)");
  }
  return issues;
}

/**
 * Offline re-validation of one stored accepted item (the record parser's
 * check): full shape, the excerpt digest and the R1 id (kind, URL, excerpt
 * and claim key) recompute, its source is listed as "read" with the same
 * retrievedAt, and the typed claim re-derives from the item's OWN excerpt
 * under the acceptance rules (R2 period derivation included). Every failing
 * check is reported, so a tampered claim with a stale id shows both. `vendors`
 * (e.g. every competitor name in the record) feeds the other-vendor clause
 * check. Returns a freshly built item; unknown fields are reported, never kept.
 */
export function revalidateAcceptedEvidence(
  item: unknown,
  sources: ReadonlyArray<SourceAcquisition>,
  options: { vendors?: ReadonlyArray<string> } = {},
): RevalidationResult {
  if (!isPlainObject(item)) return { ok: false, issues: ["expected an object"] };
  const issues: string[] = [];
  const kind = KINDS.find((k) => k === item.kind);
  if (!kind) return { ok: false, issues: ["kind: expected a known evidence kind"] };

  const extra = Object.keys(item).filter((k) => !ALLOWED_KEYS[kind].has(k));
  if (extra.length > 0) issues.push(`unexpected field ${extra.join(", ")}`);

  const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl : "";
  if (!sourceUrl || canonicalSourceUrl(sourceUrl) !== sourceUrl) issues.push("sourceUrl: must be a canonical http(s) URL");
  if (!nonEmptyString(item.sourceTitle, 300)) issues.push("sourceTitle: required");
  else if (item.sourceTitle !== sourceHostLabel(sourceUrl)) {
    // Ruling R15: a stored title follows the acceptance rule, or is the host label acceptance falls back to.
    const titleIssue = sourceTitleIssue(item.sourceTitle);
    if (titleIssue) issues.push(`sourceTitle: ${titleIssue} (ruling R15)`);
  }
  const maxExcerpt = kind === "community_quote" ? EVIDENCE_LIMITS.quoteMaxChars : EVIDENCE_LIMITS.excerptMaxChars;
  const excerpt = typeof item.excerpt === "string" ? item.excerpt : "";
  if (excerpt.trim() === "" || excerpt.length > maxExcerpt) issues.push(`excerpt: required, at most ${maxExcerpt} characters`);
  if (item.excerptSha256 !== sha256Hex(excerpt)) issues.push("excerptSha256: does not match the excerpt");
  const retrievedAt = typeof item.retrievedAt === "string" && isIsoTime(item.retrievedAt) ? item.retrievedAt : "";
  if (!retrievedAt) issues.push("retrievedAt: expected an ISO time");

  const listed = sources.filter((s) => sameSource(s.url, sourceUrl));
  const read = listed.find((s) => s.status === "read");
  if (listed.length === 0) issues.push("source: not listed in evidence.sources");
  else if (!read) issues.push(`source: listed as ${listed[0]?.status ?? "unknown"}, not read`);
  else if (read.retrievedAt !== retrievedAt) issues.push("source: retrievedAt differs from the source read");
  if (kind === "community_quote" && read && !read.roles.includes("community")) {
    issues.push(`source: ${NOT_COMMUNITY_DETAIL}`);
  }

  const claim = readStoredClaim(kind, item, issues);
  if (!claim) return { ok: false, issues };
  if (item.id !== evidenceId(kind, sourceUrl, excerpt, evidenceClaimKey(claim))) {
    issues.push("id: does not match kind, sourceUrl, excerpt and claim");
  }
  const referenceYear = retrievedAt ? yearOf(retrievedAt) : 0;
  issues.push(...rederivationIssues(claim, excerpt, sourceUrl, referenceYear, options.vendors ?? []));
  if (issues.length > 0) return { ok: false, issues };

  const base = {
    id: String(item.id),
    sourceUrl,
    sourceTitle: String(item.sourceTitle),
    excerpt,
    excerptSha256: sha256Hex(excerpt),
    retrievedAt,
  };
  if (claim.kind === "community_quote") return { ok: true, item: { ...base, kind: claim.kind, attribution: "community" } };
  if (claim.kind === "market_stat") return { ok: true, item: { ...base, ...claim, attribution: "secondary" } };
  if (claim.kind === "competitor_availability") return { ok: true, item: { ...base, ...claim, attribution: "first_party" } };
  return { ok: true, item: { ...base, ...claim } };
}

// ---------------------------------------------------------------------------
// Minimums
// ---------------------------------------------------------------------------

/**
 * EVIDENCE_MINIMUMS over accepted items: ≥2 stats, ≥3 distinct vendors (by
 * vendorKey) with a price or first-party availability statement, ≥1 vendor
 * with a numeric price, and ≥2 distinct quotes, where two quotes
 * are distinct only when neither contains the other (ruling R8,
 * distinctQuoteCount).
 */
export function checkEvidenceMinimums(accepted: ReadonlyArray<AcceptedEvidence>): {
  ok: boolean;
  shortfalls: string[];
} {
  const stats = accepted.filter((e) => e.kind === "market_stat").length;
  const pricedVendors = new Set(
    accepted.flatMap((e) => (e.kind === "competitor_price" ? [vendorKey(e.vendor)] : [])).filter(Boolean),
  );
  const vendors = new Set(accepted.flatMap((e) => (e.kind === "competitor_price" || e.kind === "competitor_availability" ? [vendorKey(e.vendor)] : [])).filter(Boolean));
  const quotes = distinctQuoteCount(accepted.flatMap((e) => (e.kind === "community_quote" ? [e.excerpt] : [])));
  const shortfalls: string[] = [];
  if (stats < EVIDENCE_MINIMUMS.marketStats) {
    shortfalls.push(`market stats: ${stats} accepted, need ${EVIDENCE_MINIMUMS.marketStats}`);
  }
  if (pricedVendors.size < EVIDENCE_MINIMUMS.pricedCompetitors) {
    shortfalls.push(`priced competitors: ${pricedVendors.size} vendors with an accepted price, need ${EVIDENCE_MINIMUMS.pricedCompetitors}`);
  }
  if (vendors.size < EVIDENCE_MINIMUMS.competitors) {
    shortfalls.push(`competitors: ${vendors.size} vendors with accepted price or availability, need ${EVIDENCE_MINIMUMS.competitors}`);
  }
  if (quotes < EVIDENCE_MINIMUMS.distinctQuotes) {
    shortfalls.push(`community quotes: ${quotes} distinct accepted, need ${EVIDENCE_MINIMUMS.distinctQuotes}`);
  }
  return { ok: shortfalls.length === 0, shortfalls };
}
