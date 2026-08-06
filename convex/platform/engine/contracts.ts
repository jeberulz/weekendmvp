import { ConvexError } from "convex/values";
import { assertGeneratedDocumentBody } from "../validators";

/**
 * WP26-S1 contract subgate. Defines the versioned JSON shapes stored in the
 * WP22-frozen `documents.body` field for `kind: "validation_report"` and
 * `kind: "site_copy"` — no new Convex tables or fields. Citation metadata
 * (url/title/publisher/publishedAt) lives in the WP22-frozen
 * `document_citations` child table, keyed by `documentId` and `position`;
 * every `citations` array here holds `position` indices into that table's
 * rows for the same document, never duplicated URLs.
 *
 * Pure contract module: no `ctx.db` access, no Convex functions. WP26-S5
 * (report compiler) is the first caller that will actually insert
 * `documents`/`document_citations` rows using these shapes.
 */

export const VALIDATION_REPORT_CONTRACT_VERSION = 1;
export const SITE_INPUT_CONTRACT_VERSION = 1;

/** A `document_citations.position` value for the same report document. */
export type CitationRef = number;

export type ScoreBlock = {
  value: number;
  reason: string;
};

export type MarketStat = {
  label: string;
  value: string;
  citations: CitationRef[];
};

export type Competitor = {
  name: string;
  pricing: string;
  citations: CitationRef[];
};

export type Keyword = {
  term: string;
  volume: number;
  competition: string;
  cpc: number;
};

/**
 * v1 engine scope per program-platform-plan.md §4.5 ("v1 engine scope"
 * paragraph): Tier-1 scores + summaries, competitive_analysis,
 * go_to_market, community_analysis, keyword_list, market insight (stats +
 * CAGR, cited), why_now. Deep sections beyond this v1 subset are explicitly
 * out of scope for the contract subgate.
 */
export type ValidationReportPayload = {
  contractVersion: 1;
  ideaTitle: string;
  summary: string;
  scores: {
    opportunity: ScoreBlock;
    pain: ScoreBlock;
    builderConfidence: ScoreBlock;
    execution: ScoreBlock;
  };
  marketInsight: {
    stats: MarketStat[];
    cagr: string;
    citations: CitationRef[];
  };
  competitiveAnalysis: {
    competitors: Competitor[];
    citations: CitationRef[];
  };
  goToMarket: {
    content: string;
  };
  communityAnalysis: {
    content: string;
    citations: CitationRef[];
  };
  keywordList: {
    keywords: Keyword[];
  };
  whyNow: {
    content: string;
    citations: CitationRef[];
  };
};

/**
 * The decoupled shape WP27's renderer consumes from a completed report.
 * Deliberately smaller than `ValidationReportPayload` so WP27 can build
 * against a frozen interface rather than the live research schema; WP27 may
 * refine its own rendering needs later as a new `contractVersion`, never an
 * in-place breaking edit to v1.
 */
export type SiteInputPayload = {
  contractVersion: 1;
  headline: string;
  subheadline: string;
  problemStatement: string;
  keyBenefits: string[];
  socialProof: Array<{ stat: string; citations: CitationRef[] }>;
  callToAction: { label: string };
};

const MIN_MARKET_STATS = 2;
const MIN_COMPETITORS = 3;

function fail(code: string, extra?: Record<string, unknown>): never {
  throw new ConvexError({ code, ...extra });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCitationRefArray(value: unknown): value is CitationRef[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "number" && Number.isInteger(entry) && entry >= 0)
  );
}

function isScoreBlock(value: unknown): value is ScoreBlock {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.value === "number" &&
    record.value >= 0 &&
    record.value <= 10 &&
    isNonEmptyString(record.reason)
  );
}

function isMarketStat(value: unknown): value is MarketStat {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isNonEmptyString(record.label) &&
    isNonEmptyString(record.value) &&
    isCitationRefArray(record.citations)
  );
}

function isCompetitor(value: unknown): value is Competitor {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isNonEmptyString(record.name) &&
    isNonEmptyString(record.pricing) &&
    isCitationRefArray(record.citations)
  );
}

function isKeyword(value: unknown): value is Keyword {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isNonEmptyString(record.term) &&
    typeof record.volume === "number" &&
    Number.isFinite(record.volume) &&
    record.volume >= 0 &&
    isNonEmptyString(record.competition) &&
    typeof record.cpc === "number" &&
    Number.isFinite(record.cpc) &&
    record.cpc >= 0
  );
}

/**
 * Validates a parsed `ValidationReportPayload` shape and enforces the
 * contract subgate's citation-completeness rule: `marketInsight` and
 * `competitiveAnalysis` fail closed below their minimum counts, and every
 * citation-bearing section (`marketInsight`, `competitiveAnalysis`,
 * `communityAnalysis`, `whyNow`) fails closed with zero citations. This
 * mirrors the existing thin-research STOP rule used by `/publish-idea`.
 * `keywordList` and `goToMarket` are not citation-bearing claims and are not
 * checked here.
 */
export function parseValidationReportPayload(
  body: string | undefined,
): ValidationReportPayload {
  if (!body) fail("INVALID_VALIDATION_REPORT_DOCUMENT");
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT");
  }
  if (typeof value !== "object" || value === null) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT");
  }
  const record = value as Record<string, unknown>;
  if (record.contractVersion !== VALIDATION_REPORT_CONTRACT_VERSION) {
    fail("UNSUPPORTED_VALIDATION_REPORT_CONTRACT_VERSION", {
      received: record.contractVersion,
    });
  }
  if (!isNonEmptyString(record.ideaTitle) || !isNonEmptyString(record.summary)) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT");
  }

  const scores = record.scores as Record<string, unknown> | undefined;
  if (
    typeof scores !== "object" ||
    scores === null ||
    !isScoreBlock(scores.opportunity) ||
    !isScoreBlock(scores.pain) ||
    !isScoreBlock(scores.builderConfidence) ||
    !isScoreBlock(scores.execution)
  ) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT", { field: "scores" });
  }

  const marketInsight = record.marketInsight as Record<string, unknown> | undefined;
  if (
    typeof marketInsight !== "object" ||
    marketInsight === null ||
    !Array.isArray(marketInsight.stats) ||
    !marketInsight.stats.every(isMarketStat) ||
    !isNonEmptyString(marketInsight.cagr) ||
    !isCitationRefArray(marketInsight.citations)
  ) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT", { field: "marketInsight" });
  }
  if ((marketInsight.stats as MarketStat[]).length < MIN_MARKET_STATS) {
    fail("THIN_MARKET_INSIGHT", { minimum: MIN_MARKET_STATS });
  }
  if ((marketInsight.citations as CitationRef[]).length === 0) {
    fail("UNCITED_VALIDATION_REPORT_SECTION", { field: "marketInsight" });
  }

  const competitiveAnalysis = record.competitiveAnalysis as
    | Record<string, unknown>
    | undefined;
  if (
    typeof competitiveAnalysis !== "object" ||
    competitiveAnalysis === null ||
    !Array.isArray(competitiveAnalysis.competitors) ||
    !competitiveAnalysis.competitors.every(isCompetitor) ||
    !isCitationRefArray(competitiveAnalysis.citations)
  ) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT", { field: "competitiveAnalysis" });
  }
  if ((competitiveAnalysis.competitors as Competitor[]).length < MIN_COMPETITORS) {
    fail("THIN_COMPETITIVE_ANALYSIS", { minimum: MIN_COMPETITORS });
  }
  if ((competitiveAnalysis.citations as CitationRef[]).length === 0) {
    fail("UNCITED_VALIDATION_REPORT_SECTION", { field: "competitiveAnalysis" });
  }

  const goToMarket = record.goToMarket as Record<string, unknown> | undefined;
  if (typeof goToMarket !== "object" || goToMarket === null || !isNonEmptyString(goToMarket.content)) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT", { field: "goToMarket" });
  }

  const communityAnalysis = record.communityAnalysis as
    | Record<string, unknown>
    | undefined;
  if (
    typeof communityAnalysis !== "object" ||
    communityAnalysis === null ||
    !isNonEmptyString(communityAnalysis.content) ||
    !isCitationRefArray(communityAnalysis.citations)
  ) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT", { field: "communityAnalysis" });
  }
  if ((communityAnalysis.citations as CitationRef[]).length === 0) {
    fail("UNCITED_VALIDATION_REPORT_SECTION", { field: "communityAnalysis" });
  }

  const keywordList = record.keywordList as Record<string, unknown> | undefined;
  if (
    typeof keywordList !== "object" ||
    keywordList === null ||
    !Array.isArray(keywordList.keywords) ||
    !keywordList.keywords.every(isKeyword)
  ) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT", { field: "keywordList" });
  }

  const whyNow = record.whyNow as Record<string, unknown> | undefined;
  if (
    typeof whyNow !== "object" ||
    whyNow === null ||
    !isNonEmptyString(whyNow.content) ||
    !isCitationRefArray(whyNow.citations)
  ) {
    fail("INVALID_VALIDATION_REPORT_DOCUMENT", { field: "whyNow" });
  }
  if ((whyNow.citations as CitationRef[]).length === 0) {
    fail("UNCITED_VALIDATION_REPORT_SECTION", { field: "whyNow" });
  }

  return value as ValidationReportPayload;
}

export function serializeValidationReportPayload(
  payload: ValidationReportPayload,
): string {
  if (payload.contractVersion !== VALIDATION_REPORT_CONTRACT_VERSION) {
    fail("UNSUPPORTED_VALIDATION_REPORT_CONTRACT_VERSION", {
      received: payload.contractVersion,
    });
  }
  // Round-trip through the reader so a payload that fails to parse can never
  // be persisted, even if it was constructed by hand rather than parsed.
  const body = JSON.stringify(payload);
  parseValidationReportPayload(body);
  return assertGeneratedDocumentBody(body);
}

/**
 * Cross-checks every `CitationRef` referenced anywhere in a validation
 * report against the actual number of `document_citations` rows stored for
 * that document. `citationCount` is the caller's `document_citations` row
 * count for this `documentId` (0-indexed positions `0..citationCount-1`).
 * Fails closed on any out-of-range reference — a report can never claim a
 * citation that was not actually stored.
 */
export function assertValidationReportCitationsInRange(
  payload: ValidationReportPayload,
  citationCount: number,
): void {
  const allRefs = [
    ...payload.marketInsight.citations,
    ...payload.marketInsight.stats.flatMap((stat) => stat.citations),
    ...payload.competitiveAnalysis.citations,
    ...payload.competitiveAnalysis.competitors.flatMap(
      (competitor) => competitor.citations,
    ),
    ...payload.communityAnalysis.citations,
    ...payload.whyNow.citations,
  ];
  for (const ref of allRefs) {
    if (ref < 0 || ref >= citationCount) {
      fail("CITATION_REF_OUT_OF_RANGE", { ref, citationCount });
    }
  }
}

/**
 * Cross-checks every `CitationRef` referenced in a site-input document
 * against the actual number of `document_citations` rows stored for that
 * document. Mirrors `assertValidationReportCitationsInRange` for the
 * site-input contract.
 */
export function assertSiteInputCitationsInRange(
  payload: SiteInputPayload,
  citationCount: number,
): void {
  const allRefs = payload.socialProof.flatMap((entry) => entry.citations);
  for (const ref of allRefs) {
    if (ref < 0 || ref >= citationCount) {
      fail("CITATION_REF_OUT_OF_RANGE", { ref, citationCount });
    }
  }
}

export function parseSiteInputPayload(body: string | undefined): SiteInputPayload {
  if (!body) fail("INVALID_SITE_INPUT_DOCUMENT");
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    fail("INVALID_SITE_INPUT_DOCUMENT");
  }
  if (typeof value !== "object" || value === null) {
    fail("INVALID_SITE_INPUT_DOCUMENT");
  }
  const record = value as Record<string, unknown>;
  if (record.contractVersion !== SITE_INPUT_CONTRACT_VERSION) {
    fail("UNSUPPORTED_SITE_INPUT_CONTRACT_VERSION", {
      received: record.contractVersion,
    });
  }
  if (
    !isNonEmptyString(record.headline) ||
    !isNonEmptyString(record.subheadline) ||
    !isNonEmptyString(record.problemStatement)
  ) {
    fail("INVALID_SITE_INPUT_DOCUMENT");
  }
  if (
    !Array.isArray(record.keyBenefits) ||
    record.keyBenefits.length === 0 ||
    !record.keyBenefits.every((entry) => isNonEmptyString(entry))
  ) {
    fail("INVALID_SITE_INPUT_DOCUMENT", { field: "keyBenefits" });
  }
  if (
    !Array.isArray(record.socialProof) ||
    !record.socialProof.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        isNonEmptyString((entry as Record<string, unknown>).stat) &&
        isCitationRefArray((entry as Record<string, unknown>).citations),
    )
  ) {
    fail("INVALID_SITE_INPUT_DOCUMENT", { field: "socialProof" });
  }
  const callToAction = record.callToAction as Record<string, unknown> | undefined;
  if (
    typeof callToAction !== "object" ||
    callToAction === null ||
    !isNonEmptyString(callToAction.label)
  ) {
    fail("INVALID_SITE_INPUT_DOCUMENT", { field: "callToAction" });
  }
  return value as SiteInputPayload;
}

export function serializeSiteInputPayload(payload: SiteInputPayload): string {
  if (payload.contractVersion !== SITE_INPUT_CONTRACT_VERSION) {
    fail("UNSUPPORTED_SITE_INPUT_CONTRACT_VERSION", {
      received: payload.contractVersion,
    });
  }
  const body = JSON.stringify(payload);
  parseSiteInputPayload(body);
  return assertGeneratedDocumentBody(body);
}
