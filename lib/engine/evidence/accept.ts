/**
 * Deterministic evidence acceptance (WP46, contract §4–§6).
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
 *   market_stat      the sentence(s) from the start of the supporting span
 *                    to the end of the sentence holding the amount (≤600)
 *   competitor_price from the start of the supporting span's sentence to the
 *                    end of the price's clause (≤600; falls back to the
 *                    clause alone when the sentence is too long)
 * Every stat/price check runs on that excerpt, so acceptance and offline
 * re-validation apply the identical rules to the identical text. Because the
 * evidence id hashes (kind, url, excerpt), two claims that share an excerpt
 * (two figures in one sentence, two plans in one clause) share an id; the
 * first accepted wins and the rest are rejected as "duplicate".
 */

import { createHash } from "node:crypto";

import {
  amountsEqual,
  comparePriceTerms,
  formatAmount,
  formatPriceTerms,
  hasProjectionCue,
  parseAmount,
  parsePriceTerms,
  priceExpressionsIn,
  scanAmounts,
  sentenceAround,
  splitSentences,
  type PriceExpression,
} from "./amount.ts";
import {
  canonicalSourceUrl,
  isComparisonPage,
  isFirstPartyHost,
  sameSource,
  sourceHostLabel,
  vendorKey,
} from "./citation.ts";
import {
  EVIDENCE_ID_PREFIX,
  EVIDENCE_LIMITS,
  EVIDENCE_MINIMUMS,
  type AcceptedEvidence,
  type Amount,
  type CommunityQuoteEvidence,
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
  type SourceStatus,
} from "./contract.ts";
import {
  findContiguousSpanIn,
  normalizeExcerptForCompare,
  normalizeForSourceMatch,
  prepareSourceForMatch,
  wordCount,
  type PreparedSource,
} from "./quote.ts";

// ---------------------------------------------------------------------------
// Public types and limits
// ---------------------------------------------------------------------------

/** A URL a search step returned; candidates may cite only these. */
export type CitationInput = { url: string; title?: string };

/** One acquired source, keyed by canonical URL in acceptEvidence's `sources` map. */
export type SourceInput = {
  status: SourceStatus;
  text?: string;
  retrievedAt?: string;
  textSha256?: string;
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

const KINDS: readonly EvidenceKind[] = ["community_quote", "market_stat", "competitor_price"];
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

/** Contract id: `${q|s|p}_${sha256hex(kind + "\n" + sourceUrl + "\n" + excerpt).slice(0, 12)}`. */
export function evidenceId(kind: EvidenceKind, sourceUrl: string, excerpt: string): string {
  return `${EVIDENCE_ID_PREFIX[kind]}_${sha256Hex(`${kind}\n${sourceUrl}\n${excerpt}`).slice(0, 12)}`;
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

function itemFailure<T>(record: Record<string, unknown>, error: string, claim: string): ItemRead<T> {
  const sourceUrl = textField(record, "sourceUrl");
  return {
    ok: false,
    error,
    ...(sourceUrl ? { sourceUrl: clip(sourceUrl, 300) } : {}),
    ...(claim ? { candidate: clip(claim, EVIDENCE_LIMITS.rejectedCandidateChars) } : {}),
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
  const candidates: ExtractionCandidates = { quotes: [], marketStats: [], competitorPrices: [] };
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
};

type Context = {
  citations: Map<string, string>;
  sources: Map<string, SourceInput>;
  prepared: Map<string, PreparedSource>;
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

function createContext(input: AcceptEvidenceInput): Context {
  const citations = new Map<string, string>();
  for (const citation of input.citations) {
    const url = canonicalSourceUrl(citation.url);
    if (!url) continue;
    const title = typeof citation.title === "string" ? clip(citation.title.trim(), 200) : "";
    if (!citations.has(url) || (citations.get(url) === "" && title !== "")) citations.set(url, title);
  }
  const sources = new Map<string, SourceInput>();
  for (const [key, source] of input.sources) {
    const url = canonicalSourceUrl(key);
    if (url && !sources.has(url)) sources.set(url, source);
  }
  const vendors = [
    ...new Set(
      [...input.candidates.competitorPrices.map((c) => c.vendor), ...(input.vendorHints ?? [])]
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => vendorKey(v).length >= 2),
    ),
  ];
  return { citations, sources, prepared: new Map(), vendors };
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
    },
  };
}

function baseFields(kind: EvidenceKind, source: ReadSource, excerpt: string) {
  return {
    id: evidenceId(kind, source.url, excerpt),
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

function acceptQuote(candidate: QuoteCandidate, context: Context): { ok: true; item: AcceptedEvidence } | Failure {
  const resolved = resolveSource(context, candidate.sourceUrl);
  if (!resolved.ok) return resolved;
  const span = findContiguousSpanIn(candidate.text, resolved.source.prepared);
  if (!span.ok) return fail(span.reason, spanDetail(span.reason));
  const issue = quoteBoundsIssue(span.text);
  if (issue) return fail("span_bounds", issue);
  const item: CommunityQuoteEvidence = {
    ...baseFields("community_quote", resolved.source, span.text),
    kind: "community_quote",
    attribution: "community",
  };
  return { ok: true, item };
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

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function subjectContentWords(subject: string): string[] {
  return tokens(subject).filter((w) => w.length >= 4 && /\p{L}/u.test(w) && !SUBJECT_STOPWORDS.has(w));
}

function subjectIssue(subject: string, sentence: string): string | null {
  const wanted = subjectContentWords(subject);
  if (wanted.length === 0) return `subject "${clip(subject, 60)}" has no specific content word`;
  const present = new Set(tokens(sentence).map(stem));
  return wanted.some((w) => present.has(stem(w))) ? null : `no word of the subject "${clip(subject, 60)}" is in the sentence`;
}

const MAGNITUDE_AFTER_YEAR_RE = /^[ \u00A0]?(?:thousand|million|billion|trillion|bn|mn|tn|[kKmMbBtT](?![\p{L}\p{N}]))/iu;

/** True when the declared year appears in the sentence (as a range end or single year when projected). */
function yearMentioned(sentence: string, year: number, kind: "measured" | "projected"): boolean {
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}$€£.,])${year}(?![\p{N}%]|[.,]\d)`, "gu");
  for (const m of sentence.matchAll(re)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (MAGNITUDE_AFTER_YEAR_RE.test(sentence.slice(end, end + 12))) continue;
    if (kind === "measured") return true;
    const rangeStart =
      /(?:^|[^\p{L}])(?:from|since|between|starting)\s+$/iu.test(sentence.slice(0, start)) ||
      /^\s*(?:-|–|—|to|through|until|and)\s*(?:19|20)\d{2}/iu.test(sentence.slice(end));
    if (!rangeStart) return true;
  }
  return false;
}

/**
 * The stat rules applied to an excerpt: some sentence of the excerpt holds an
 * amount equal to the claim, and in that sentence: metric/unit agree, no
 * projection cue when "measured", the declared year appears, and a subject
 * content word appears. A "measured" year after `referenceYear` is a projection.
 */
function checkStatExcerpt(excerpt: string, claim: StatClaim, referenceYear: number): StatCheck {
  if (!metricAllowsUnit(claim.metric, claim.amount.unit)) {
    return fail("metric_unit_mismatch", `${claim.metric} cannot be a ${claim.amount.unit} amount`);
  }
  if (claim.periodKind === "measured" && claim.year !== undefined && claim.year > referenceYear) {
    return fail("projection_as_measured", `${claim.year} is after the retrieval year ${referenceYear}`);
  }
  const amounts = scanAmounts(excerpt);
  const sentences = splitSentences(excerpt).filter((s) =>
    amounts.some((a) => a.numberStart >= s.start && a.numberStart < s.end && amountsEqual(a.amount, claim.amount)),
  );
  if (sentences.length === 0) {
    const found = amounts.map((a) => formatAmount(a.amount));
    return fail(
      "amount_mismatch",
      found.length > 0
        ? `excerpt has ${found.slice(0, 4).join(", ")}, not ${formatAmount(claim.amount)}`
        : `excerpt has no amount equal to ${formatAmount(claim.amount)}`,
    );
  }
  let failure: Failure | null = null;
  for (const sentence of sentences) {
    if (claim.periodKind === "measured" && hasProjectionCue(sentence.text, referenceYear)) {
      failure ??= fail("projection_as_measured", "the sentence is a forecast; label the figure projected");
      continue;
    }
    if (claim.year !== undefined && !yearMentioned(sentence.text, claim.year, claim.periodKind)) {
      failure ??= fail("year_not_in_context", `${claim.year} does not appear in the sentence as that period`);
      continue;
    }
    const subject = subjectIssue(claim.subject, sentence.text);
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
  return failure ?? fail("amount_mismatch", "no sentence supports the amount");
}

/** Excerpt range for a stat: span's first sentence through the amount's sentence. */
function statExcerptRange(text: string, spanStart: number, amountIndex: number): { start: number; end: number } | null {
  const first = sentenceAround(text, spanStart);
  const own = sentenceAround(text, amountIndex);
  const start = Math.min(first.start, own.start);
  if (own.end - start <= EVIDENCE_LIMITS.excerptMaxChars) return { start, end: own.end };
  if (own.end - own.start <= EVIDENCE_LIMITS.excerptMaxChars) return { start: own.start, end: own.end };
  return null;
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
    const range = statExcerptRange(source.text, span.start, found.numberStart);
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
    const item: MarketStatEvidence = {
      ...baseFields("market_stat", source, excerpt),
      kind: "market_stat",
      attribution: "secondary",
      subject: candidate.subject,
      metric: candidate.metric,
      amount,
      period: check.period,
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

/** Character ranges where `name` (or an alias) appears as a whole word sequence. */
function nameMentions(text: string, name: string): Mention[] {
  const form = normalizeForSourceMatch(text);
  const out: Mention[] = [];
  for (const alias of nameAliases(name)) {
    const wanted = normalizeForSourceMatch(alias).words;
    if (wanted.length === 0) continue;
    for (let i = 0; i + wanted.length <= form.words.length; i += 1) {
      if (!wanted.every((w, j) => form.words[i + j] === w)) continue;
      const first = form.map[i];
      const last = form.map[i + wanted.length - 1];
      if (first && last) out.push({ start: first.start, end: last.end });
    }
  }
  return out;
}

type Attribution = { ok: true; attribution: "first_party" | "secondary" } | Failure;

/**
 * Who a price in `text` belongs to. No other known vendor may be named in
 * the price's clause. A first-party host (not a comparison page) needs no
 * name; otherwise the claimed vendor must be named before the price in its
 * clause (with no other vendor there, it is the nearest one).
 */
function attributeVendor(
  text: string,
  expression: PriceExpression,
  vendor: string,
  sourceUrl: string,
  vendors: ReadonlyArray<string>,
): Attribution {
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
  const firstParty = isFirstPartyHost(vendor, sourceUrl);
  if (firstParty && !isComparisonPage(sourceUrl)) return { ok: true, attribution: "first_party" };
  const priceOffset = expression.start - expression.clauseStart;
  if (!claimed.some((m) => m.end <= priceOffset)) {
    return fail("vendor_not_in_context", `${clip(vendor, 40)} is not named before the price in its clause`);
  }
  return { ok: true, attribution: firstParty ? "first_party" : "secondary" };
}

type PriceClaim = { vendor: string; terms: PriceTerms };

/** The price rules applied to an excerpt: an equal price expression with a valid attribution. */
function checkPriceExcerpt(
  excerpt: string,
  claim: PriceClaim,
  sourceUrl: string,
  vendors: ReadonlyArray<string>,
): Attribution {
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
    const attribution = attributeVendor(excerpt, expression, claim.vendor, sourceUrl, vendors);
    if (attribution.ok) return attribution;
    failure = closer(failure, attribution);
  }
  return failure ?? fail("unparseable_amount", "excerpt has no supported price expression");
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

function planMentioned(plan: string, excerpt: string): boolean {
  return nameMentions(excerpt, plan).length > 0;
}

function acceptPrice(candidate: CompetitorPriceCandidate, context: Context): { ok: true; item: AcceptedEvidence } | Failure {
  const vendor = candidate.vendor;
  if (vendorKey(vendor).length < 2) return fail("invalid_candidate", "vendor name is too short to identify");
  const terms = parsePriceTerms(candidate.priceText);
  if (!terms) return fail("unparseable_amount", `"${clip(candidate.priceText, 60)}" is not one supported price expression`);
  const resolved = resolveSource(context, candidate.sourceUrl);
  if (!resolved.ok) return resolved;
  const source = resolved.source;
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
    const range = priceExcerptRange(source.text, span.start, expression);
    if (!range) {
      failure = closer(failure, fail("span_bounds", `price clause exceeds ${EVIDENCE_LIMITS.excerptMaxChars} characters`));
      continue;
    }
    const excerpt = source.text.slice(range.start, range.end);
    const check = checkPriceExcerpt(excerpt, { vendor, terms }, source.url, context.vendors);
    if (!check.ok) {
      failure = closer(failure, check);
      continue;
    }
    const plan = candidate.plan?.trim();
    const item: CompetitorPriceEvidence = {
      ...baseFields("competitor_price", source, excerpt),
      kind: "competitor_price",
      attribution: check.attribution,
      vendor,
      ...(plan && planMentioned(plan, excerpt) ? { plan } : {}),
      price: terms,
    };
    return { ok: true, item };
  }
  return failure ?? fail("unparseable_amount", "supporting text has no supported price expression");
}

// ---------------------------------------------------------------------------
// Acceptance
// ---------------------------------------------------------------------------

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
  const url = typeof sourceUrl === "string" ? (canonicalSourceUrl(sourceUrl) ?? clip(sourceUrl.trim(), 300)) : "";
  return {
    kind,
    reason,
    ...(url ? { sourceUrl: url } : {}),
    ...(claim.trim() ? { candidate: clip(claim.trim(), EVIDENCE_LIMITS.rejectedCandidateChars) } : {}),
    detail: clip(detail, DETAIL_CHARS),
  };
}

/**
 * Accept or reject every candidate against the acquired text of its own
 * canonical citation. Deterministic: quotes, then stats, then prices, each in
 * candidate order. A repeated id is "duplicate"; more than
 * EVIDENCE_LIMITS.maxAccepted of a kind is "over_cap".
 */
export function acceptEvidence(input: AcceptEvidenceInput): AcceptEvidenceResult {
  const context = createContext(input);
  const accepted: AcceptedEvidence[] = [];
  const rejected: RejectedEvidence[] = [];
  const ids = new Map<string, string>();
  const counts: Record<EvidenceKind, number> = { community_quote: 0, market_stat: 0, competitor_price: 0 };

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
    if (ids.has(item.id)) {
      rejected.push(rejection(kind, "duplicate", sourceUrl, claim, `same source and excerpt as accepted ${item.id}`));
      return;
    }
    if (counts[kind] >= EVIDENCE_LIMITS.maxAccepted[kind]) {
      rejected.push(rejection(kind, "over_cap", sourceUrl, claim, `more than ${EVIDENCE_LIMITS.maxAccepted[kind]} accepted`));
      return;
    }
    ids.set(item.id, kind);
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

/**
 * Offline re-validation of one stored accepted item (the record parser's
 * check): full shape, id and excerpt digest recompute, its source is listed
 * as "read" with the same retrievedAt, and the typed claim re-derives from
 * the item's OWN excerpt under the acceptance rules. `vendors` (for example
 * every competitor name in the record) feeds the other-vendor clause check.
 * Returns a freshly built item; unknown fields are reported, never kept.
 */
export function revalidateAcceptedEvidence(
  item: unknown,
  sources: ReadonlyArray<SourceAcquisition>,
  options: { vendors?: ReadonlyArray<string> } = {},
): RevalidationResult {
  if (!isPlainObject(item)) return { ok: false, issues: ["expected an object"] };
  const issues: string[] = [];
  const kind = KINDS.find((k) => k === item.kind);
  if (!kind) return { ok: false, issues: ["kind: expected community_quote, market_stat or competitor_price"] };

  const extra = Object.keys(item).filter((k) => !ALLOWED_KEYS[kind].has(k));
  if (extra.length > 0) issues.push(`unexpected field ${extra.join(", ")}`);

  const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl : "";
  if (!sourceUrl || canonicalSourceUrl(sourceUrl) !== sourceUrl) issues.push("sourceUrl: must be a canonical http(s) URL");
  if (!nonEmptyString(item.sourceTitle, 300)) issues.push("sourceTitle: required");
  const maxExcerpt = kind === "community_quote" ? EVIDENCE_LIMITS.quoteMaxChars : EVIDENCE_LIMITS.excerptMaxChars;
  const excerpt = typeof item.excerpt === "string" ? item.excerpt : "";
  if (excerpt.trim() === "" || excerpt.length > maxExcerpt) issues.push(`excerpt: required, at most ${maxExcerpt} characters`);
  if (item.excerptSha256 !== sha256Hex(excerpt)) issues.push("excerptSha256: does not match the excerpt");
  if (item.id !== evidenceId(kind, sourceUrl, excerpt)) issues.push("id: does not match kind, sourceUrl and excerpt");
  const retrievedAt = typeof item.retrievedAt === "string" && isIsoTime(item.retrievedAt) ? item.retrievedAt : "";
  if (!retrievedAt) issues.push("retrievedAt: expected an ISO time");

  const listed = sources.filter((s) => sameSource(s.url, sourceUrl));
  const read = listed.find((s) => s.status === "read");
  if (listed.length === 0) issues.push("source: not listed in evidence.sources");
  else if (!read) issues.push(`source: listed as ${listed[0]?.status ?? "unknown"}, not read`);
  else if (read.retrievedAt !== retrievedAt) issues.push("source: retrievedAt differs from the source read");

  const base = {
    id: String(item.id),
    sourceUrl,
    sourceTitle: typeof item.sourceTitle === "string" ? item.sourceTitle : "",
    excerpt,
    excerptSha256: sha256Hex(excerpt),
    retrievedAt,
  };
  const referenceYear = retrievedAt ? yearOf(retrievedAt) : 0;

  if (kind === "community_quote") {
    if (item.attribution !== "community") issues.push("attribution: quotes are community");
    const bounds = quoteBoundsIssue(excerpt);
    if (bounds) issues.push(`excerpt: ${bounds}`);
    return issues.length > 0
      ? { ok: false, issues }
      : { ok: true, item: { ...base, kind, attribution: "community" } };
  }

  if (kind === "market_stat") {
    if (item.attribution !== "secondary") issues.push("attribution: market stats are secondary");
    if (!nonEmptyString(item.subject, CANDIDATE_LIMITS.claimChars)) issues.push("subject: required");
    const metric = METRICS.find((m) => m === item.metric);
    if (!metric) issues.push("metric: invalid");
    const amount = readStoredAmount(item.amount, issues, "amount");
    const period = readStoredPeriod(item.period, issues);
    if (issues.length > 0 || !metric || !amount || !period || typeof item.subject !== "string") {
      return { ok: false, issues };
    }
    const check = checkStatExcerpt(
      excerpt,
      {
        subject: item.subject,
        metric,
        amount,
        periodKind: period.kind,
        ...(period.year !== undefined ? { year: period.year } : {}),
        ...(period.toYear !== undefined ? { year: period.toYear } : {}),
      },
      referenceYear,
    );
    if (!check.ok) return { ok: false, issues: [`claim: ${check.reason} (${check.detail})`] };
    if (!samePeriod(check.period, period)) return { ok: false, issues: ["period: does not re-derive from the excerpt"] };
    return {
      ok: true,
      item: { ...base, kind, attribution: "secondary", subject: item.subject, metric, amount, period },
    };
  }

  const attribution = item.attribution === "first_party" || item.attribution === "secondary" ? item.attribution : null;
  if (!attribution) issues.push("attribution: prices are first_party or secondary");
  if (!nonEmptyString(item.vendor, CANDIDATE_LIMITS.nameChars) || vendorKey(String(item.vendor)).length < 2) {
    issues.push("vendor: required");
  }
  if (item.plan !== undefined && !nonEmptyString(item.plan, CANDIDATE_LIMITS.nameChars)) issues.push("plan: invalid");
  const price = readStoredPrice(item.price, issues);
  if (issues.length > 0 || !attribution || !price || typeof item.vendor !== "string") return { ok: false, issues };
  const check = checkPriceExcerpt(excerpt, { vendor: item.vendor, terms: price }, sourceUrl, options.vendors ?? []);
  if (!check.ok) return { ok: false, issues: [`claim: ${check.reason} (${check.detail})`] };
  if (check.attribution !== attribution) {
    return { ok: false, issues: [`attribution: re-derives as ${check.attribution}, stored ${attribution}`] };
  }
  const plan = typeof item.plan === "string" ? item.plan : undefined;
  if (plan !== undefined && !planMentioned(plan, excerpt)) return { ok: false, issues: ["plan: not named in the excerpt"] };
  return {
    ok: true,
    item: { ...base, kind, attribution, vendor: item.vendor, ...(plan !== undefined ? { plan } : {}), price },
  };
}

// ---------------------------------------------------------------------------
// Minimums
// ---------------------------------------------------------------------------

/**
 * EVIDENCE_MINIMUMS over accepted items: ≥2 stats, ≥3 distinct vendors (by
 * vendorKey) with an accepted price, ≥2 distinct quotes (strict excerpt form).
 */
export function checkEvidenceMinimums(accepted: ReadonlyArray<AcceptedEvidence>): {
  ok: boolean;
  shortfalls: string[];
} {
  const stats = accepted.filter((e) => e.kind === "market_stat").length;
  const vendors = new Set(
    accepted.flatMap((e) => (e.kind === "competitor_price" ? [vendorKey(e.vendor)] : [])).filter(Boolean),
  );
  const quotes = new Set(
    accepted.flatMap((e) => (e.kind === "community_quote" ? [normalizeExcerptForCompare(e.excerpt)] : [])),
  );
  const shortfalls: string[] = [];
  if (stats < EVIDENCE_MINIMUMS.marketStats) {
    shortfalls.push(`market stats: ${stats} accepted, need ${EVIDENCE_MINIMUMS.marketStats}`);
  }
  if (vendors.size < EVIDENCE_MINIMUMS.pricedCompetitors) {
    shortfalls.push(`priced competitors: ${vendors.size} vendors with an accepted price, need ${EVIDENCE_MINIMUMS.pricedCompetitors}`);
  }
  if (quotes.size < EVIDENCE_MINIMUMS.distinctQuotes) {
    shortfalls.push(`community quotes: ${quotes.size} distinct accepted, need ${EVIDENCE_MINIMUMS.distinctQuotes}`);
  }
  return { ok: shortfalls.length === 0, shortfalls };
}
