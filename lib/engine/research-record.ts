/**
 * Operator research record for the idea engine (Mode A2).
 *
 * Two contracts live here:
 *   v1 (legacy)  writer output checked after the fact: ≥2 cited market
 *                stats, ≥3 competitors with pricing + URL, provider-only
 *                keyword metrics. Readable for history only
 *                (readLegacyResearchRecordV1).
 *   v2           evidence accepted before writing (WP46, evidence contract
 *                §8): parseResearchRecordV2 is a closed schema that
 *                re-validates every accepted item offline and binds the
 *                prose to it. A v1 record throws LegacyResearchRecordError.
 * Neither is ValidationReportPayload (Convex citation indices).
 */

import { CANDIDATE_LIMITS, revalidateAcceptedEvidence } from "./evidence/accept.ts";
import { canonicalSourceUrl, vendorKey } from "./evidence/citation.ts";
import {
  EVIDENCE_CONTRACT_VERSION,
  EVIDENCE_LIMITS,
  EVIDENCE_MINIMUMS,
  FACT_BEARING_FIELDS,
  PIPELINE_VERSION_V2,
  RESEARCH_RECORD_CONTRACT_VERSION_V2,
  type AcceptedEvidence,
  type EditorialFieldsV2,
  type EvidenceKind,
  type RejectedEvidence,
  type RejectionReason,
  type ResearchProvenanceV2,
  type ResearchRecordV2,
  type SourceAcquisition,
  type SourceRole,
  type SourceStatus,
  type YearOnePlanV2,
} from "./evidence/contract.ts";
import { normalizeExcerptForCompare } from "./evidence/quote.ts";
import { evidenceRefs, validateEditorialText } from "./evidence/tokens.ts";
import { validateYearOnePlan } from "./finance.ts";

export const RESEARCH_RECORD_CONTRACT_VERSION = 1 as const;

export type Citation = {
  url: string;
  title: string;
};

export type ResearchBrief = {
  title: string;
  slug: string;
  oneLiner: string;
  targetCustomer: string;
};

export type MarketStat = {
  claim: string;
  value: string;
  citation: Citation;
};

export type Competitor = {
  name: string;
  pricing: string;
  url: string;
  notes?: string;
};

export type CommunitySignal = {
  quote: string;
  citation: Citation;
  /**
   * True when the pipeline fetched the cited page and found the quote in it
   * verbatim (after whitespace/punctuation normalization). False when it
   * checked and did not find it. Absent on records made before the check.
   */
  verified?: boolean;
};

export type KeywordRow = {
  term: string;
  /** Monthly search volume from a keyword provider — never model-invented. */
  volume: number;
  competition: number;
  cpc: number;
  /** Only provider-sourced rows are legal. */
  source: "provider";
};

export type GoToMarket = {
  positioning: string;
  channels: string[];
  pricingNotes: string;
};

export type PricingTier = {
  name: string;
  price: string;
  includes: string;
};

export type UnitEconRow = {
  label: string;
  value: string;
};

/** One stage of the year-one acquisition funnel, e.g. 500 prospects. */
export type FunnelStage = {
  stage: string;
  count: number;
};

/**
 * Year-one revenue math. The compiler does the arithmetic (ARR and the
 * half-close-rate downside) so the page never carries model-invented totals.
 */
export type YearOnePlan = {
  funnel: FunnelStage[];
  /** Tier the paying accounts land on (must match a pricing tier name). */
  tier: string;
  payingAccounts: number;
  /** Monthly revenue per paying account in USD (seats already included). */
  monthlyRevenuePerAccount: number;
  /** Why the funnel numbers are plausible (sources, channel, cadence). */
  assumptions?: string;
};

/** One idea-specific table for the Project Setup prompt. */
export type DataTable = {
  table: string;
  columns: string;
};

/**
 * Optional editorial fields produced by synthesis for the MDX compiler.
 * Older records omit them; the compiler derives sensible fallbacks.
 */
export type EditorialFields = {
  /** Short product name (e.g. "CiteDraft"), not "an AI tool". */
  productName?: string;
  /** Explicit deferral: what NOT to build yet. */
  dontBuildYet?: string;
  /** Dense problem prose (≥280 words preferred). */
  problemNarrative?: string;
  /** Dense solution prose (≥200 words preferred). */
  solutionNarrative?: string;
  /** Competitive contrast prose (≥100 words preferred). */
  competitiveNarrative?: string;
  pricingTiers?: PricingTier[];
  unitEconomics?: UnitEconRow[];
  /** Stack guidance specific to this idea. */
  stackNotes?: string;
  /**
   * Short audience label for mid-sentence use (e.g. "small GitHub teams").
   * The full brief audience appears once, in the problem narrative.
   */
  audienceShort?: string;
  /** Visual direction + voice for the Branding prompt, specific to the buyer. */
  brandBrief?: string;
  yearOne?: YearOnePlan;
  /** Idea-specific tables (beyond workspaces/members/usage_events). */
  dataModel?: DataTable[];
};

export type ResearchScores = {
  opportunity?: number;
  pain?: number;
  /** Market timing. Distinct from execution feasibility. */
  timing?: number;
  builderConfidence?: number;
  execution?: number;
};

export type ProviderCall = {
  provider: string;
  operation: string;
  costUsd: number;
};

export type ResearchProvenance = {
  providerCalls: ProviderCall[];
  costUsd: number;
  ranAt: string;
};

export type ResearchRecord = {
  contractVersion: typeof RESEARCH_RECORD_CONTRACT_VERSION;
  brief: ResearchBrief;
  market: {
    stats: MarketStat[];
    summary: string;
  };
  competitors: Competitor[];
  community: {
    signals: CommunitySignal[];
    summary: string;
  };
  keywords: KeywordRow[];
  goToMarket: GoToMarket;
  whyNow: string;
  /**
   * Product workflow steps for the page's "How it works" list (HowTo schema).
   * Prefer `Title — description` so the compiler can emit named steps.
   * Optional for older records; the compiler refuses a record without it
   * rather than guessing steps.
   */
  howItWorks?: string[];
  scores?: ResearchScores;
  editorial?: EditorialFields;
  provenance: ResearchProvenance;
};

export const MIN_HOW_IT_WORKS_STEPS = 2;

export const MIN_MARKET_STATS = 2;
export const MIN_COMPETITORS = 3;

export class ResearchRecordParseError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid ResearchRecord: ${issues.join("; ")}`);
    this.name = "ResearchRecordParseError";
    this.issues = issues;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** SQL identifier the Setup prompt can use as a table name. */
const TABLE_NAME_RE = /^[a-z][a-z0-9_]{1,40}$/;

export function parseYearOne(
  value: unknown,
  issues: string[],
): YearOnePlan | undefined {
  const path = "editorial.yearOne";
  const issuesBefore = issues.length;
  if (!isPlainObject(value)) {
    issues.push(`${path}: expected object`);
    return undefined;
  }
  const funnel: FunnelStage[] = [];
  if (!Array.isArray(value.funnel) || value.funnel.length < 2) {
    issues.push(`${path}.funnel: need ≥2 stages`);
  } else {
    value.funnel.forEach((row, i) => {
      if (
        !isPlainObject(row) ||
        !isNonEmptyString(row.stage) ||
        !isPositiveNum(row.count)
      ) {
        issues.push(`${path}.funnel[${i}]: need stage string and count > 0`);
        return;
      }
      funnel.push({ stage: row.stage.trim(), count: Math.round(row.count) });
    });
    for (let i = 1; i < funnel.length; i++) {
      if (funnel[i]!.count > funnel[i - 1]!.count) {
        issues.push(`${path}.funnel: stage counts must not grow (stage ${i})`);
        break;
      }
    }
  }
  if (!isNonEmptyString(value.tier)) issues.push(`${path}.tier: required`);
  if (!isPositiveNum(value.payingAccounts)) {
    issues.push(`${path}.payingAccounts: required number > 0`);
  }
  if (!isPositiveNum(value.monthlyRevenuePerAccount)) {
    issues.push(`${path}.monthlyRevenuePerAccount: required number > 0`);
  }
  const last = funnel[funnel.length - 1];
  if (
    last &&
    isPositiveNum(value.payingAccounts) &&
    Math.round(value.payingAccounts) > last.count
  ) {
    issues.push(`${path}.payingAccounts: exceeds the last funnel stage`);
  }
  // Any issue (a growing funnel, more payers than the last stage) means the
  // plan is dropped, never half-kept: callers that swallow issues must not
  // pass an invalid plan on to the final record parse.
  if (
    issues.length > issuesBefore ||
    funnel.length < 2 ||
    !isNonEmptyString(value.tier) ||
    !isPositiveNum(value.payingAccounts) ||
    !isPositiveNum(value.monthlyRevenuePerAccount)
  ) {
    return undefined;
  }
  return {
    funnel,
    tier: value.tier.trim(),
    payingAccounts: Math.round(value.payingAccounts),
    monthlyRevenuePerAccount: value.monthlyRevenuePerAccount,
    ...(isNonEmptyString(value.assumptions)
      ? { assumptions: value.assumptions.trim() }
      : {}),
  };
}

export function parseDataModel(
  value: unknown,
  issues: string[],
): DataTable[] | undefined {
  const path = "editorial.dataModel";
  if (!Array.isArray(value)) {
    issues.push(`${path}: must be an array when present`);
    return undefined;
  }
  const tables: DataTable[] = [];
  value.forEach((row, i) => {
    if (
      !isPlainObject(row) ||
      !isNonEmptyString(row.table) ||
      !isNonEmptyString(row.columns)
    ) {
      issues.push(`${path}[${i}]: need table and columns strings`);
      return;
    }
    const table = row.table.trim().toLowerCase();
    if (!TABLE_NAME_RE.test(table)) {
      issues.push(`${path}[${i}].table: '${table}' is not a SQL identifier`);
      return;
    }
    tables.push({ table, columns: row.columns.trim() });
  });
  return tables.length > 0 ? tables : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseCitation(
  value: unknown,
  path: string,
  issues: string[],
): Citation | null {
  if (!isPlainObject(value)) {
    issues.push(`${path}: citation must be an object`);
    return null;
  }
  if (!isNonEmptyString(value.url) || !isHttpUrl(value.url)) {
    issues.push(`${path}.url: required http(s) URL`);
    if (!isNonEmptyString(value.title)) {
      issues.push(`${path}.title: required non-empty string`);
    }
    return null;
  }
  if (!isNonEmptyString(value.title)) {
    issues.push(`${path}.title: required non-empty string`);
    return null;
  }
  return { url: value.url.trim(), title: value.title.trim() };
}

/**
 * Publish-path record parser. Until WP46 integration moves the compiler,
 * auditor and pipeline to contract v2, it still reads contract v1 (exactly
 * readLegacyResearchRecordV1). At integration it becomes the v2 entry point,
 * which throws LegacyResearchRecordError for v1 (evidence contract §1).
 */
export function parseResearchRecord(input: unknown): ResearchRecord {
  return readLegacyResearchRecordV1(input);
}

/**
 * HISTORY ONLY: read a contract v1 (legacy) record. A v1 record's evidence
 * was not accepted before its narrative was written, so nothing it returns
 * may be compiled, audited or published; use parseResearchRecordV2 there.
 * Throws ResearchRecordParseError on any v1 contract violation (unknown
 * version, thin citations, guessed keywords).
 */
export function readLegacyResearchRecordV1(input: unknown): ResearchRecord {
  const issues: string[] = [];

  if (!isPlainObject(input)) {
    throw new ResearchRecordParseError(["root: expected object"]);
  }

  if (input.contractVersion !== RESEARCH_RECORD_CONTRACT_VERSION) {
    throw new ResearchRecordParseError([
      `contractVersion: unsupported value ${JSON.stringify(input.contractVersion)} (expected ${RESEARCH_RECORD_CONTRACT_VERSION})`,
    ]);
  }

  // --- brief ---
  if (!isPlainObject(input.brief)) {
    issues.push("brief: required object");
  } else {
    for (const key of [
      "title",
      "slug",
      "oneLiner",
      "targetCustomer",
    ] as const) {
      if (!isNonEmptyString(input.brief[key])) {
        issues.push(`brief.${key}: required non-empty string`);
      }
    }
  }

  // --- market ---
  const marketStats: MarketStat[] = [];
  if (!isPlainObject(input.market)) {
    issues.push("market: required object");
  } else {
    if (!isNonEmptyString(input.market.summary)) {
      issues.push("market.summary: required non-empty string");
    }
    if (!Array.isArray(input.market.stats)) {
      issues.push("market.stats: required array");
    } else {
      input.market.stats.forEach((stat, i) => {
        const path = `market.stats[${i}]`;
        if (!isPlainObject(stat)) {
          issues.push(`${path}: expected object`);
          return;
        }
        if (!isNonEmptyString(stat.claim)) issues.push(`${path}.claim: required`);
        if (!isNonEmptyString(stat.value)) issues.push(`${path}.value: required`);
        const citation = parseCitation(stat.citation, `${path}.citation`, issues);
        if (
          citation &&
          isNonEmptyString(stat.claim) &&
          isNonEmptyString(stat.value)
        ) {
          marketStats.push({
            claim: stat.claim.trim(),
            value: stat.value.trim(),
            citation,
          });
        }
      });
      if (marketStats.length < MIN_MARKET_STATS) {
        issues.push(
          `market.stats: need ≥${MIN_MARKET_STATS} stats with URL citations (got ${marketStats.length})`,
        );
      }
    }
  }

  // --- competitors ---
  const competitors: Competitor[] = [];
  if (!Array.isArray(input.competitors)) {
    issues.push("competitors: required array");
  } else {
    input.competitors.forEach((row, i) => {
      const path = `competitors[${i}]`;
      if (!isPlainObject(row)) {
        issues.push(`${path}: expected object`);
        return;
      }
      if (!isNonEmptyString(row.name)) issues.push(`${path}.name: required`);
      if (!isNonEmptyString(row.pricing)) {
        issues.push(`${path}.pricing: required non-empty pricing`);
      }
      if (!isNonEmptyString(row.url) || !isHttpUrl(row.url)) {
        issues.push(`${path}.url: required http(s) URL`);
      }
      if (
        isNonEmptyString(row.name) &&
        isNonEmptyString(row.pricing) &&
        isNonEmptyString(row.url) &&
        isHttpUrl(row.url)
      ) {
        competitors.push({
          name: row.name.trim(),
          pricing: row.pricing.trim(),
          url: row.url.trim(),
          ...(isNonEmptyString(row.notes) ? { notes: row.notes.trim() } : {}),
        });
      }
    });
    if (competitors.length < MIN_COMPETITORS) {
      issues.push(
        `competitors: need ≥${MIN_COMPETITORS} with pricing + URL (got ${competitors.length})`,
      );
    }
  }

  // --- community ---
  const communitySignals: CommunitySignal[] = [];
  if (!isPlainObject(input.community)) {
    issues.push("community: required object");
  } else {
    if (!isNonEmptyString(input.community.summary)) {
      issues.push("community.summary: required non-empty string");
    }
    if (!Array.isArray(input.community.signals)) {
      issues.push("community.signals: required array");
    } else {
      input.community.signals.forEach((sig, i) => {
        const path = `community.signals[${i}]`;
        if (!isPlainObject(sig)) {
          issues.push(`${path}: expected object`);
          return;
        }
        if (!isNonEmptyString(sig.quote)) issues.push(`${path}.quote: required`);
        const citation = parseCitation(sig.citation, `${path}.citation`, issues);
        if (sig.verified !== undefined && typeof sig.verified !== "boolean") {
          issues.push(`${path}.verified: must be boolean when present`);
        }
        if (citation && isNonEmptyString(sig.quote)) {
          communitySignals.push({
            quote: sig.quote.trim(),
            citation,
            ...(typeof sig.verified === "boolean"
              ? { verified: sig.verified }
              : {}),
          });
        }
      });
    }
  }

  // --- keywords (provider metrics only) ---
  const keywords: KeywordRow[] = [];
  if (!Array.isArray(input.keywords)) {
    issues.push("keywords: required array");
  } else {
    input.keywords.forEach((row, i) => {
      const path = `keywords[${i}]`;
      if (!isPlainObject(row)) {
        issues.push(`${path}: expected object`);
        return;
      }
      if (!isNonEmptyString(row.term)) issues.push(`${path}.term: required`);

      if (row.source !== "provider") {
        issues.push(
          `${path}.source: keyword metrics must be provider-sourced (got ${JSON.stringify(row.source)}) — model-invented volume/cpc is forbidden`,
        );
      }
      if (!isFiniteNum(row.volume) || row.volume < 0) {
        issues.push(
          `${path}.volume: required finite non-negative number from provider`,
        );
      }
      if (!isFiniteNum(row.competition) || row.competition < 0) {
        issues.push(`${path}.competition: required finite non-negative number`);
      }
      if (!isFiniteNum(row.cpc) || row.cpc < 0) {
        issues.push(
          `${path}.cpc: required finite non-negative number from provider`,
        );
      }

      if (
        isNonEmptyString(row.term) &&
        row.source === "provider" &&
        isFiniteNum(row.volume) &&
        row.volume >= 0 &&
        isFiniteNum(row.competition) &&
        row.competition >= 0 &&
        isFiniteNum(row.cpc) &&
        row.cpc >= 0
      ) {
        keywords.push({
          term: row.term.trim(),
          volume: row.volume,
          competition: row.competition,
          cpc: row.cpc,
          source: "provider",
        });
      }
    });
  }

  // --- goToMarket ---
  let goToMarket: GoToMarket | null = null;
  if (!isPlainObject(input.goToMarket)) {
    issues.push("goToMarket: required object");
  } else {
    if (!isNonEmptyString(input.goToMarket.positioning)) {
      issues.push("goToMarket.positioning: required");
    }
    if (!isNonEmptyString(input.goToMarket.pricingNotes)) {
      issues.push("goToMarket.pricingNotes: required");
    }
    if (
      !Array.isArray(input.goToMarket.channels) ||
      !input.goToMarket.channels.every(isNonEmptyString)
    ) {
      issues.push("goToMarket.channels: required string[]");
    } else if (
      isNonEmptyString(input.goToMarket.positioning) &&
      isNonEmptyString(input.goToMarket.pricingNotes)
    ) {
      goToMarket = {
        positioning: input.goToMarket.positioning.trim(),
        pricingNotes: input.goToMarket.pricingNotes.trim(),
        channels: input.goToMarket.channels.map((c) => (c as string).trim()),
      };
    }
  }

  // --- whyNow ---
  if (!isNonEmptyString(input.whyNow)) {
    issues.push("whyNow: required non-empty string");
  }

  // --- optional howItWorks ---
  let howItWorks: string[] | undefined;
  if (input.howItWorks !== undefined) {
    if (
      !Array.isArray(input.howItWorks) ||
      !input.howItWorks.every(isNonEmptyString)
    ) {
      issues.push("howItWorks: must be string[] when present");
    } else if (input.howItWorks.length < MIN_HOW_IT_WORKS_STEPS) {
      issues.push(
        `howItWorks: need ≥${MIN_HOW_IT_WORKS_STEPS} steps when present (got ${input.howItWorks.length})`,
      );
    } else {
      howItWorks = input.howItWorks.map((step) => (step as string).trim());
    }
  }

  // --- optional editorial ---
  let editorial: EditorialFields | undefined;
  if (input.editorial !== undefined) {
    if (!isPlainObject(input.editorial)) {
      issues.push("editorial: must be an object when present");
    } else {
      const ed: EditorialFields = {};
      for (const key of [
        "productName",
        "dontBuildYet",
        "problemNarrative",
        "solutionNarrative",
        "competitiveNarrative",
        "stackNotes",
        "audienceShort",
        "brandBrief",
      ] as const) {
        const v = input.editorial[key];
        if (v !== undefined) {
          if (!isNonEmptyString(v)) {
            issues.push(`editorial.${key}: must be non-empty string when present`);
          } else {
            ed[key] = v.trim();
          }
        }
      }
      if (input.editorial.pricingTiers !== undefined) {
        if (!Array.isArray(input.editorial.pricingTiers)) {
          issues.push("editorial.pricingTiers: must be an array when present");
        } else {
          const tiers: PricingTier[] = [];
          input.editorial.pricingTiers.forEach((row, i) => {
            const path = `editorial.pricingTiers[${i}]`;
            if (!isPlainObject(row)) {
              issues.push(`${path}: expected object`);
              return;
            }
            if (
              !isNonEmptyString(row.name) ||
              !isNonEmptyString(row.price) ||
              !isNonEmptyString(row.includes)
            ) {
              issues.push(`${path}: need name, price, includes strings`);
              return;
            }
            tiers.push({
              name: row.name.trim(),
              price: row.price.trim(),
              includes: row.includes.trim(),
            });
          });
          if (tiers.length > 0) ed.pricingTiers = tiers;
        }
      }
      if (input.editorial.unitEconomics !== undefined) {
        if (!Array.isArray(input.editorial.unitEconomics)) {
          issues.push("editorial.unitEconomics: must be an array when present");
        } else {
          const rows: UnitEconRow[] = [];
          input.editorial.unitEconomics.forEach((row, i) => {
            const path = `editorial.unitEconomics[${i}]`;
            if (!isPlainObject(row)) {
              issues.push(`${path}: expected object`);
              return;
            }
            if (!isNonEmptyString(row.label) || !isNonEmptyString(row.value)) {
              issues.push(`${path}: need label and value strings`);
              return;
            }
            rows.push({ label: row.label.trim(), value: row.value.trim() });
          });
          if (rows.length > 0) ed.unitEconomics = rows;
        }
      }
      if (input.editorial.yearOne !== undefined) {
        const yearOne = parseYearOne(input.editorial.yearOne, issues);
        if (yearOne) ed.yearOne = yearOne;
      }
      if (input.editorial.dataModel !== undefined) {
        const dataModel = parseDataModel(input.editorial.dataModel, issues);
        if (dataModel) ed.dataModel = dataModel;
      }
      if (Object.keys(ed).length > 0) editorial = ed;
    }
  }

  // --- optional scores ---
  let scores: ResearchScores | undefined;
  if (input.scores !== undefined) {
    if (!isPlainObject(input.scores)) {
      issues.push("scores: must be an object when present");
    } else {
      scores = {};
      for (const key of [
        "opportunity",
        "pain",
        "timing",
        "builderConfidence",
        "execution",
      ] as const) {
        const v = input.scores[key];
        if (v !== undefined) {
          if (!isFiniteNum(v)) {
            issues.push(`scores.${key}: must be a finite number when present`);
          } else {
            scores[key] = v;
          }
        }
      }
      if (Object.keys(scores).length === 0) scores = undefined;
    }
  }

  // --- provenance ---
  let provenance: ResearchProvenance | null = null;
  if (!isPlainObject(input.provenance)) {
    issues.push("provenance: required object");
  } else {
    if (!isFiniteNum(input.provenance.costUsd) || input.provenance.costUsd < 0) {
      issues.push("provenance.costUsd: required finite non-negative number");
    }
    if (!isNonEmptyString(input.provenance.ranAt)) {
      issues.push("provenance.ranAt: required non-empty string");
    }
    const providerCalls: ProviderCall[] = [];
    if (!Array.isArray(input.provenance.providerCalls)) {
      issues.push("provenance.providerCalls: required array");
    } else {
      input.provenance.providerCalls.forEach((call, i) => {
        const path = `provenance.providerCalls[${i}]`;
        if (!isPlainObject(call)) {
          issues.push(`${path}: expected object`);
          return;
        }
        if (!isNonEmptyString(call.provider)) {
          issues.push(`${path}.provider: required`);
        }
        if (!isNonEmptyString(call.operation)) {
          issues.push(`${path}.operation: required`);
        }
        if (!isFiniteNum(call.costUsd) || call.costUsd < 0) {
          issues.push(`${path}.costUsd: required finite non-negative number`);
        }
        if (
          isNonEmptyString(call.provider) &&
          isNonEmptyString(call.operation) &&
          isFiniteNum(call.costUsd) &&
          call.costUsd >= 0
        ) {
          providerCalls.push({
            provider: call.provider.trim(),
            operation: call.operation.trim(),
            costUsd: call.costUsd,
          });
        }
      });
    }
    if (
      isFiniteNum(input.provenance.costUsd) &&
      input.provenance.costUsd >= 0 &&
      isNonEmptyString(input.provenance.ranAt) &&
      Array.isArray(input.provenance.providerCalls)
    ) {
      provenance = {
        costUsd: input.provenance.costUsd,
        ranAt: input.provenance.ranAt.trim(),
        providerCalls,
      };
    }
  }

  if (issues.length > 0) {
    throw new ResearchRecordParseError(issues);
  }

  const brief = input.brief as Record<string, string>;
  const market = input.market as Record<string, unknown>;
  const community = input.community as Record<string, unknown>;

  const record: ResearchRecord = {
    contractVersion: RESEARCH_RECORD_CONTRACT_VERSION,
    brief: {
      title: brief.title.trim(),
      slug: brief.slug.trim(),
      oneLiner: brief.oneLiner.trim(),
      targetCustomer: brief.targetCustomer.trim(),
    },
    market: {
      summary: (market.summary as string).trim(),
      stats: marketStats,
    },
    competitors,
    community: {
      summary: (community.summary as string).trim(),
      signals: communitySignals,
    },
    keywords,
    goToMarket: goToMarket!,
    whyNow: (input.whyNow as string).trim(),
    provenance: provenance!,
  };

  if (howItWorks) record.howItWorks = howItWorks;
  if (scores) record.scores = scores;
  if (editorial) record.editorial = editorial;

  return record;
}

// ===========================================================================
// Contract v2 (WP46, evidence contract §8)
// ===========================================================================

/**
 * Size bounds for a contract v2 record, beyond the evidence limits in
 * EVIDENCE_LIMITS / EVIDENCE_MINIMUMS. They keep a hostile or runaway record
 * from costing unbounded parse work; real pipeline output sits far below.
 */
export const RESEARCH_RECORD_V2_LIMITS = {
  /** Any single text field, after trimming. */
  textChars: 20_000,
  /** Names and identifiers: competitor names, keyword terms, provider/operation/model ids. */
  identifierChars: 200,
  /** brief.slug, which must also match RECORD_SLUG_PATTERN. */
  slugChars: 120,
  /** evidence.sources[].url and evidence.rejected[].sourceUrl. */
  urlChars: CANDIDATE_LIMITS.urlChars,
  /** evidence.sources[].detail and evidence.rejected[].detail. */
  detailChars: 200,
  /** evidence.sources: one entry per distinct URL a run attempted. */
  sources: 96,
  /** evidence.accepted: the per-kind caps summed. */
  acceptedItems:
    EVIDENCE_LIMITS.maxAccepted.community_quote +
    EVIDENCE_LIMITS.maxAccepted.market_stat +
    EVIDENCE_LIMITS.maxAccepted.competitor_price,
  /** evidence.rejected (operator-only). */
  rejected: EVIDENCE_LIMITS.maxRejectedStored,
  /** competitors: each needs its own accepted price, so at most the price cap. */
  competitors: EVIDENCE_LIMITS.maxAccepted.competitor_price,
  /** keywords: the keyword step sends at most 50 terms; 100 leaves headroom. */
  keywords: 100,
  channels: 12,
  howItWorksSteps: 12,
  pricingTiers: 8,
  unitEconomicsRows: 12,
  dataModelTables: 20,
  /** editorial.yearOne.funnel; validateYearOnePlan enforces the same 12. */
  yearOneFunnelStages: 12,
  /** provenance.providerCalls: every billed attempt, failures included. */
  providerCalls: 64,
  /** provenance.attempts: distinct step ids. */
  attemptSteps: 32,
} as const;

/** Same shape the pipeline normalizes to and the MDX auditor enforces. */
const RECORD_SLUG_PATTERN = /^[a-z0-9-]+$/;
const STEP_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const ISO_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
/** Any evidence-token-like text, valid or malformed. */
const TOKEN_LIKE_PATTERN = /\[\[\s*ev\s*:/i;
const PLAIN_KEY_PATTERN = /^[A-Za-z0-9_$-]{1,60}$/;

/** Mirrors the pipeline's MIN_CHANNELS: no canned channel fallback. */
const MIN_GTM_CHANNELS = 2;
const SCORE_MIN = 0;
const SCORE_MAX = 10;
/** The site's score contract publishes all four of these or none. */
const PUBLISHED_SCORE_KEYS = ["opportunity", "pain", "timing", "builderConfidence"] as const;
const SCORE_KEYS = [...PUBLISHED_SCORE_KEYS, "execution"] as const;

const ONE_LINER_PATH = "brief.oneLiner";
const FACT_BEARING_PATHS: ReadonlySet<string> = new Set(FACT_BEARING_FIELDS);

const ROOT_KEYS = [
  "contractVersion",
  "pipelineVersion",
  "mode",
  "brief",
  "evidence",
  "market",
  "competitors",
  "community",
  "keywords",
  "goToMarket",
  "whyNow",
  "howItWorks",
  "scores",
  "editorial",
  "provenance",
] as const;
const EDITORIAL_TEXT_KEYS = [
  "productName",
  "dontBuildYet",
  "problemNarrative",
  "solutionNarrative",
  "competitiveNarrative",
  "stackNotes",
  "audienceShort",
  "brandBrief",
] as const;
const EDITORIAL_KEYS = [...EDITORIAL_TEXT_KEYS, "pricingTiers", "unitEconomics", "yearOne", "dataModel"] as const;
const YEAR_ONE_KEYS = ["funnel", "tier", "payingAccounts", "seatsPerAccount", "assumptions"] as const;

const EVIDENCE_KINDS: readonly EvidenceKind[] = ["community_quote", "market_stat", "competitor_price"];
const SOURCE_ROLES: readonly SourceRole[] = ["market", "competitors", "community"];
/** Typed as a total record so a new contract status or reason fails to compile until listed. */
const SOURCE_STATUSES: Record<SourceStatus, true> = {
  read: true,
  unreadable: true,
  oversized: true,
  timeout: true,
  no_content: true,
  blocked: true,
  http_error: true,
  unsupported_encoding: true,
  redirect_rejected: true,
};
const REJECTION_REASONS: Record<RejectionReason, true> = {
  invalid_candidate: true,
  unknown_citation: true,
  source_unreadable: true,
  source_oversized: true,
  source_timeout: true,
  source_no_content: true,
  span_not_found: true,
  span_bounds: true,
  internal_ellipsis: true,
  unparseable_amount: true,
  amount_mismatch: true,
  unit_mismatch: true,
  currency_mismatch: true,
  period_mismatch: true,
  basis_mismatch: true,
  qualifier_dropped: true,
  metric_unit_mismatch: true,
  projection_as_measured: true,
  year_not_in_context: true,
  subject_not_in_context: true,
  vendor_not_in_context: true,
  ambiguous_attribution: true,
  duplicate: true,
  over_cap: true,
};

function isSourceStatus(value: unknown): value is SourceStatus {
  return typeof value === "string" && Object.hasOwn(SOURCE_STATUSES, value);
}

function isRejectionReason(value: unknown): value is RejectionReason {
  return typeof value === "string" && Object.hasOwn(REJECTION_REASONS, value);
}

function isIsoTime(value: unknown): value is string {
  return typeof value === "string" && ISO_TIME_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Short, single-line description of an untrusted value for an issue message. */
function describeValue(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return Array.isArray(value) ? "an array" : `a ${typeof value}`;
}

function childPath(path: string, key: string | number): string {
  if (typeof key === "number") return `${path}[${key}]`;
  const name = PLAIN_KEY_PATTERN.test(key) ? key : describeValue(key);
  return path === "" ? name : `${path}.${name}`;
}

function legacySlug(record: unknown): string | undefined {
  if (!isPlainObject(record) || !isPlainObject(record.brief)) return undefined;
  const slug = record.brief.slug;
  return typeof slug === "string" &&
    slug.length <= RESEARCH_RECORD_V2_LIMITS.slugChars &&
    RECORD_SLUG_PATTERN.test(slug)
    ? slug
    : undefined;
}

/**
 * A contract v1 (legacy) record reached a v2 boundary. v1 wrote its
 * narrative before (or without) accepting evidence, so it can never be
 * compiled or pass the engine audit, and nothing upgrades it in place: the
 * operator re-runs research. A subclass of ResearchRecordParseError, so any
 * caller that refuses invalid records refuses legacy ones too.
 */
export class LegacyResearchRecordError extends ResearchRecordParseError {
  /** The record's brief slug, when it is a plain slug. */
  readonly slug: string | undefined;

  constructor(record: unknown) {
    const slug = legacySlug(record);
    const message =
      `${slug ? `Research record "${slug}"` : "This research record"} is a contract v1 (legacy) record: ` +
      "its evidence was not accepted before writing. Legacy records cannot be compiled or pass the engine audit. " +
      "Re-run `npm run engine:research -- --brief <brief.json> --live` to produce a contract v2 record.";
    super([message]);
    this.name = "LegacyResearchRecordError";
    this.message = message;
    this.slug = slug;
  }
}

type V2Context = {
  issues: string[];
  /** Editorial text, checked for evidence tokens and figures once accepted ids are known. */
  texts: Array<{ path: string; text: string }>;
};

/** Reports every key outside `allowed` (the schema is closed at every level). */
function rejectUnknownKeys(
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
  ctx: V2Context,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) ctx.issues.push(`${childPath(path, key)}: unknown field`);
  }
}

function readObject(
  value: unknown,
  path: string,
  allowed: readonly string[],
  ctx: V2Context,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    ctx.issues.push(`${path}: required object`);
    return null;
  }
  rejectUnknownKeys(value, path, allowed, ctx);
  return value;
}

/** A trimmed non-empty string of at most `max` characters, or null (issue pushed). */
function readText(
  value: unknown,
  path: string,
  ctx: V2Context,
  max: number = RESEARCH_RECORD_V2_LIMITS.textChars,
): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    ctx.issues.push(`${path}: required non-empty string`);
    return null;
  }
  const text = value.trim();
  if (text.length > max) {
    ctx.issues.push(`${path}: at most ${max} characters (got ${text.length})`);
    return null;
  }
  return text;
}

/** readText, and queue the text for the evidence-token and figure rules. */
function readEditorialText(
  value: unknown,
  path: string,
  ctx: V2Context,
  max: number = RESEARCH_RECORD_V2_LIMITS.textChars,
): string | null {
  const text = readText(value, path, ctx, max);
  if (text !== null) ctx.texts.push({ path, text });
  return text;
}

/** An array within bounds; entries past `max` are reported and not read. */
function readArray(
  value: unknown,
  path: string,
  ctx: V2Context,
  bounds: { min?: number; max: number },
): unknown[] | null {
  if (!Array.isArray(value)) {
    ctx.issues.push(`${path}: required array`);
    return null;
  }
  const min = bounds.min ?? 0;
  if (value.length < min) ctx.issues.push(`${path}: need ≥${min} entries (got ${value.length})`);
  if (value.length > bounds.max) {
    ctx.issues.push(`${path}: at most ${bounds.max} entries (got ${value.length})`);
    return value.slice(0, bounds.max);
  }
  return value;
}

function readEditorialTextList(
  value: unknown,
  path: string,
  ctx: V2Context,
  bounds: { min: number; max: number },
): string[] | null {
  const list = readArray(value, path, ctx, bounds);
  if (!list) return null;
  const out: string[] = [];
  let ok = true;
  for (const [i, entry] of list.entries()) {
    const text = readEditorialText(entry, childPath(path, i), ctx);
    if (text === null) ok = false;
    else out.push(text);
  }
  return ok ? out : null;
}

// --- brief -----------------------------------------------------------------

function parseBriefV2(value: unknown, ctx: V2Context): ResearchBrief | null {
  const raw = readObject(value, "brief", ["title", "slug", "oneLiner", "targetCustomer"], ctx);
  if (!raw) return null;
  const title = readEditorialText(raw.title, "brief.title", ctx);
  let slug = readText(raw.slug, "brief.slug", ctx, RESEARCH_RECORD_V2_LIMITS.slugChars);
  if (slug !== null && !RECORD_SLUG_PATTERN.test(slug)) {
    ctx.issues.push(`brief.slug: must match ${RECORD_SLUG_PATTERN} (got ${describeValue(slug)})`);
    slug = null;
  }
  const oneLiner = readEditorialText(raw.oneLiner, ONE_LINER_PATH, ctx);
  const targetCustomer = readEditorialText(raw.targetCustomer, "brief.targetCustomer", ctx);
  if (title === null || slug === null || oneLiner === null || targetCustomer === null) return null;
  return { title, slug, oneLiner, targetCustomer };
}

// --- evidence ----------------------------------------------------------------

function parseRoles(value: unknown, path: string, ctx: V2Context): SourceRole[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > SOURCE_ROLES.length) {
    ctx.issues.push(`${path}: need 1–3 of market, competitors, community`);
    return null;
  }
  const roles: SourceRole[] = [];
  let ok = true;
  for (const [i, entry] of value.entries()) {
    const role = SOURCE_ROLES.find((r) => r === entry);
    if (!role) {
      ctx.issues.push(`${path}[${i}]: expected market, competitors or community`);
      ok = false;
    } else if (roles.includes(role)) {
      ctx.issues.push(`${path}[${i}]: repeated role`);
      ok = false;
    } else {
      roles.push(role);
    }
  }
  return ok ? roles : null;
}

function parseSource(value: unknown, path: string, ctx: V2Context): SourceAcquisition | null {
  const raw = readObject(value, path, ["url", "roles", "status", "detail", "retrievedAt", "textSha256"], ctx);
  if (!raw) return null;
  const before = ctx.issues.length;
  const url =
    typeof raw.url === "string" &&
    raw.url.length <= RESEARCH_RECORD_V2_LIMITS.urlChars &&
    canonicalSourceUrl(raw.url) === raw.url
      ? raw.url
      : null;
  if (url === null) ctx.issues.push(`${path}.url: must be a canonical http(s) URL (canonicalSourceUrl form)`);
  const roles = parseRoles(raw.roles, `${path}.roles`, ctx);
  const status = isSourceStatus(raw.status) ? raw.status : null;
  if (status === null) ctx.issues.push(`${path}.status: unknown status ${describeValue(raw.status)}`);

  if (status === "read") {
    if (raw.retrievedAt === undefined) ctx.issues.push(`${path}.retrievedAt: required for a read source`);
    else if (!isIsoTime(raw.retrievedAt)) ctx.issues.push(`${path}.retrievedAt: expected an ISO 8601 time`);
    if (raw.textSha256 === undefined) ctx.issues.push(`${path}.textSha256: required for a read source`);
    else if (typeof raw.textSha256 !== "string" || !SHA256_HEX_PATTERN.test(raw.textSha256)) {
      ctx.issues.push(`${path}.textSha256: expected 64 lowercase hex digits`);
    }
    if (raw.detail !== undefined) ctx.issues.push(`${path}.detail: only for a source that was not read`);
    const { retrievedAt, textSha256 } = raw;
    if (ctx.issues.length > before || !url || !roles || !isIsoTime(retrievedAt) || typeof textSha256 !== "string") {
      return null;
    }
    return { url, roles, status, retrievedAt, textSha256 };
  }

  if (raw.retrievedAt !== undefined) ctx.issues.push(`${path}.retrievedAt: only for a read source`);
  if (raw.textSha256 !== undefined) ctx.issues.push(`${path}.textSha256: only for a read source`);
  const detail =
    raw.detail === undefined ? undefined : readText(raw.detail, `${path}.detail`, ctx, RESEARCH_RECORD_V2_LIMITS.detailChars);
  if (ctx.issues.length > before || !url || !roles || status === null || detail === null) return null;
  return { url, roles, status, ...(detail !== undefined ? { detail } : {}) };
}

function parseSources(value: unknown, ctx: V2Context): SourceAcquisition[] | null {
  const list = readArray(value, "evidence.sources", ctx, { max: RESEARCH_RECORD_V2_LIMITS.sources });
  if (!list) return null;
  const sources: SourceAcquisition[] = [];
  const firstIndex = new Map<string, number>();
  for (const [i, entry] of list.entries()) {
    const source = parseSource(entry, `evidence.sources[${i}]`, ctx);
    if (!source) continue;
    const first = firstIndex.get(source.url);
    if (first !== undefined) {
      ctx.issues.push(`evidence.sources[${i}].url: repeats evidence.sources[${first}].url`);
      continue;
    }
    firstIndex.set(source.url, i);
    sources.push(source);
  }
  return sources;
}

/** Every vendor name the record mentions, for the other-vendor clause check. */
function vendorNamesOf(input: Record<string, unknown>): string[] {
  const names = new Set<string>();
  const add = (name: unknown) => {
    if (typeof name !== "string") return;
    const trimmed = name.trim();
    if (trimmed.length <= RESEARCH_RECORD_V2_LIMITS.identifierChars && vendorKey(trimmed).length >= 2) names.add(trimmed);
  };
  if (Array.isArray(input.competitors)) {
    for (const row of input.competitors.slice(0, RESEARCH_RECORD_V2_LIMITS.competitors)) {
      if (isPlainObject(row)) add(row.name);
    }
  }
  if (isPlainObject(input.evidence) && Array.isArray(input.evidence.accepted)) {
    for (const item of input.evidence.accepted.slice(0, RESEARCH_RECORD_V2_LIMITS.acceptedItems)) {
      if (isPlainObject(item) && item.kind === "competitor_price") add(item.vendor);
    }
  }
  return [...names];
}

function parseAccepted(
  value: unknown,
  sources: ReadonlyArray<SourceAcquisition>,
  vendors: ReadonlyArray<string>,
  ctx: V2Context,
): { items: AcceptedEvidence[]; byId: Map<string, AcceptedEvidence> } {
  const items: AcceptedEvidence[] = [];
  const byId = new Map<string, AcceptedEvidence>();
  const list = readArray(value, "evidence.accepted", ctx, { max: RESEARCH_RECORD_V2_LIMITS.acceptedItems });
  if (!list) return { items, byId };
  const counts: Record<EvidenceKind, number> = { community_quote: 0, market_stat: 0, competitor_price: 0 };
  const firstIndex = new Map<string, number>();
  for (const [i, entry] of list.entries()) {
    const path = `evidence.accepted[${i}]`;
    const id = isPlainObject(entry) && typeof entry.id === "string" ? entry.id : null;
    if (id !== null) {
      const first = firstIndex.get(id);
      if (first !== undefined) {
        ctx.issues.push(`${path}: duplicate evidence id ${describeValue(id)} (also evidence.accepted[${first}])`);
        continue;
      }
      firstIndex.set(id, i);
    }
    const result = revalidateAcceptedEvidence(entry, sources, { vendors });
    if (!result.ok) {
      const issues = result.issues.length > 0 ? result.issues : ["failed offline re-validation"];
      for (const issue of issues) ctx.issues.push(`${path}: ${issue}`);
      continue;
    }
    counts[result.item.kind] += 1;
    items.push(result.item);
    byId.set(result.item.id, result.item);
  }
  for (const kind of EVIDENCE_KINDS) {
    if (counts[kind] > EVIDENCE_LIMITS.maxAccepted[kind]) {
      ctx.issues.push(`evidence.accepted: ${counts[kind]} ${kind} items; at most ${EVIDENCE_LIMITS.maxAccepted[kind]}`);
    }
  }
  return { items, byId };
}

function parseRejected(value: unknown, ctx: V2Context): RejectedEvidence[] | null {
  const list = readArray(value, "evidence.rejected", ctx, { max: RESEARCH_RECORD_V2_LIMITS.rejected });
  if (!list) return null;
  const out: RejectedEvidence[] = [];
  for (const [i, entry] of list.entries()) {
    const path = `evidence.rejected[${i}]`;
    const raw = readObject(entry, path, ["kind", "reason", "sourceUrl", "candidate", "detail"], ctx);
    if (!raw) continue;
    const kind = EVIDENCE_KINDS.find((k) => k === raw.kind);
    if (!kind) ctx.issues.push(`${path}.kind: expected community_quote, market_stat or competitor_price`);
    const reason = isRejectionReason(raw.reason) ? raw.reason : null;
    if (reason === null) ctx.issues.push(`${path}.reason: unknown rejection reason ${describeValue(raw.reason)}`);
    const optional = (key: "sourceUrl" | "candidate" | "detail", max: number) =>
      raw[key] === undefined ? undefined : readText(raw[key], `${path}.${key}`, ctx, max);
    const sourceUrl = optional("sourceUrl", RESEARCH_RECORD_V2_LIMITS.urlChars);
    const candidate = optional("candidate", EVIDENCE_LIMITS.rejectedCandidateChars);
    const detail = optional("detail", RESEARCH_RECORD_V2_LIMITS.detailChars);
    if (!kind || reason === null || sourceUrl === null || candidate === null || detail === null) continue;
    out.push({
      kind,
      reason,
      ...(sourceUrl !== undefined ? { sourceUrl } : {}),
      ...(candidate !== undefined ? { candidate } : {}),
      ...(detail !== undefined ? { detail } : {}),
    });
  }
  return out;
}

type ParsedEvidence = {
  value: ResearchRecordV2["evidence"] | null;
  /** Accepted items that re-validated; references resolve only to these. */
  byId: ReadonlyMap<string, AcceptedEvidence>;
};

function parseEvidenceV2(value: unknown, vendors: ReadonlyArray<string>, ctx: V2Context): ParsedEvidence {
  const raw = readObject(value, "evidence", ["contractVersion", "accepted", "rejected", "sources"], ctx);
  if (!raw) return { value: null, byId: new Map() };
  const versionOk = raw.contractVersion === EVIDENCE_CONTRACT_VERSION;
  if (!versionOk) {
    ctx.issues.push(
      `evidence.contractVersion: expected ${EVIDENCE_CONTRACT_VERSION} (got ${describeValue(raw.contractVersion)})`,
    );
  }
  const sources = parseSources(raw.sources, ctx);
  const accepted = parseAccepted(raw.accepted, sources ?? [], vendors, ctx);
  const rejected = parseRejected(raw.rejected, ctx);
  if (!versionOk || !sources || !rejected) return { value: null, byId: accepted.byId };
  return {
    value: { contractVersion: EVIDENCE_CONTRACT_VERSION, accepted: accepted.items, rejected, sources },
    byId: accepted.byId,
  };
}

// --- references ----------------------------------------------------------------

type ResolvedIds = {
  /** Every distinct id string, in order (for the returned record). */
  ids: string[];
  /** Ids that resolve to an accepted item of the wanted kind, with their list index. */
  resolved: Array<{ index: number; item: AcceptedEvidence }>;
};

/** A list of evidence ids that must be distinct accepted items of one kind. */
function readEvidenceIds(
  value: unknown,
  path: string,
  kind: EvidenceKind,
  byId: ReadonlyMap<string, AcceptedEvidence>,
  ctx: V2Context,
  bounds: { min?: number; max: number },
): ResolvedIds | null {
  const list = readArray(value, path, ctx, bounds);
  if (!list) return null;
  const out: ResolvedIds = { ids: [], resolved: [] };
  const firstIndex = new Map<string, number>();
  for (const [i, entry] of list.entries()) {
    const at = childPath(path, i);
    if (typeof entry !== "string" || entry === "") {
      ctx.issues.push(`${at}: expected an evidence id`);
      continue;
    }
    const first = firstIndex.get(entry);
    if (first !== undefined) {
      ctx.issues.push(`${at}: duplicate id ${describeValue(entry)} (also ${childPath(path, first)})`);
      continue;
    }
    firstIndex.set(entry, i);
    out.ids.push(entry);
    const item = byId.get(entry);
    if (!item) ctx.issues.push(`${at}: ${describeValue(entry)} is not an accepted ${kind}`);
    else if (item.kind !== kind) ctx.issues.push(`${at}: ${describeValue(entry)} is a ${item.kind}, not a ${kind}`);
    else out.resolved.push({ index: i, item });
  }
  return out;
}

function parseMarketV2(
  value: unknown,
  byId: ReadonlyMap<string, AcceptedEvidence>,
  ctx: V2Context,
): ResearchRecordV2["market"] | null {
  const raw = readObject(value, "market", ["summary", "statIds"], ctx);
  if (!raw) return null;
  const summary = readEditorialText(raw.summary, "market.summary", ctx);
  const stats = readEvidenceIds(raw.statIds, "market.statIds", "market_stat", byId, ctx, {
    max: EVIDENCE_LIMITS.maxAccepted.market_stat,
  });
  if (stats && stats.resolved.length < EVIDENCE_MINIMUMS.marketStats) {
    ctx.issues.push(
      `market.statIds: need ≥${EVIDENCE_MINIMUMS.marketStats} distinct accepted market_stat ids (got ${stats.resolved.length})`,
    );
  }
  if (summary === null || !stats) return null;
  return { summary, statIds: stats.ids };
}

function parseCompetitorsV2(
  value: unknown,
  byId: ReadonlyMap<string, AcceptedEvidence>,
  ctx: V2Context,
): ResearchRecordV2["competitors"] | null {
  const list = readArray(value, "competitors", ctx, {
    min: EVIDENCE_MINIMUMS.pricedCompetitors,
    max: RESEARCH_RECORD_V2_LIMITS.competitors,
  });
  if (!list) return null;
  const out: ResearchRecordV2["competitors"] = [];
  const byLowerName = new Map<string, number>();
  const byVendorKey = new Map<string, number>();
  for (const [i, entry] of list.entries()) {
    const path = `competitors[${i}]`;
    const raw = readObject(entry, path, ["name", "priceIds", "notes"], ctx);
    if (!raw) continue;
    const name = readEditorialText(raw.name, `${path}.name`, ctx, RESEARCH_RECORD_V2_LIMITS.identifierChars);
    if (name !== null) {
      // Distinct by case and by vendor key, so "Loopio"/"LoopioHQ" cannot fill two slots.
      const key = vendorKey(name);
      const first = byLowerName.get(name.toLowerCase()) ?? (key ? byVendorKey.get(key) : undefined);
      if (first !== undefined) {
        ctx.issues.push(`${path}.name: repeats competitors[${first}].name`);
      } else {
        byLowerName.set(name.toLowerCase(), i);
        if (key) byVendorKey.set(key, i);
      }
    }
    const prices = readEvidenceIds(raw.priceIds, `${path}.priceIds`, "competitor_price", byId, ctx, {
      min: 1,
      max: EVIDENCE_LIMITS.maxAccepted.competitor_price,
    });
    if (prices && name !== null) {
      for (const { index, item } of prices.resolved) {
        if (item.kind === "competitor_price" && item.vendor.trim() !== name) {
          ctx.issues.push(`${path}.priceIds[${index}]: price ${describeValue(item.id)} is for ${item.vendor}, not ${name}`);
        }
      }
    }
    const notes = raw.notes === undefined ? undefined : readEditorialText(raw.notes, `${path}.notes`, ctx);
    if (name === null || !prices || notes === null) continue;
    out.push({ name, priceIds: prices.ids, ...(notes !== undefined ? { notes } : {}) });
  }
  return out;
}

function parseCommunityV2(
  value: unknown,
  byId: ReadonlyMap<string, AcceptedEvidence>,
  ctx: V2Context,
): ResearchRecordV2["community"] | null {
  const raw = readObject(value, "community", ["summary", "quoteIds"], ctx);
  if (!raw) return null;
  const summary = readEditorialText(raw.summary, "community.summary", ctx);
  const quotes = readEvidenceIds(raw.quoteIds, "community.quoteIds", "community_quote", byId, ctx, {
    max: EVIDENCE_LIMITS.maxAccepted.community_quote,
  });
  if (quotes) {
    // Distinct = different strict quote text; one quote from two pages counts once.
    const firstByText = new Map<string, number>();
    for (const { index, item } of quotes.resolved) {
      const text = normalizeExcerptForCompare(item.excerpt);
      const first = firstByText.get(text);
      if (first !== undefined) {
        ctx.issues.push(`community.quoteIds[${index}]: same quote text as community.quoteIds[${first}]`);
      } else {
        firstByText.set(text, index);
      }
    }
    if (firstByText.size < EVIDENCE_MINIMUMS.distinctQuotes) {
      ctx.issues.push(
        `community.quoteIds: need ≥${EVIDENCE_MINIMUMS.distinctQuotes} accepted community quotes with distinct text (got ${firstByText.size})`,
      );
    }
  }
  if (summary === null || !quotes) return null;
  return { summary, quoteIds: quotes.ids };
}

// --- keywords, go-to-market, scores --------------------------------------------

/** Provider-sourced keyword metrics, with the v1 rules and messages. */
function parseKeywordsV2(value: unknown, ctx: V2Context): KeywordRow[] | null {
  const list = readArray(value, "keywords", ctx, { max: RESEARCH_RECORD_V2_LIMITS.keywords });
  if (!list) return null;
  const rows: KeywordRow[] = [];
  for (const [i, entry] of list.entries()) {
    const path = `keywords[${i}]`;
    const raw = readObject(entry, path, ["term", "volume", "competition", "cpc", "source"], ctx);
    if (!raw) continue;
    const term = readEditorialText(raw.term, `${path}.term`, ctx, RESEARCH_RECORD_V2_LIMITS.identifierChars);
    if (raw.source !== "provider") {
      ctx.issues.push(
        `${path}.source: keyword metrics must be provider-sourced (got ${describeValue(raw.source)}) — model-invented volume/cpc is forbidden`,
      );
    }
    const { volume, competition, cpc } = raw;
    if (!isFiniteNonNegative(volume)) ctx.issues.push(`${path}.volume: required finite non-negative number from provider`);
    if (!isFiniteNonNegative(competition)) ctx.issues.push(`${path}.competition: required finite non-negative number`);
    if (!isFiniteNonNegative(cpc)) ctx.issues.push(`${path}.cpc: required finite non-negative number from provider`);
    if (
      term === null ||
      raw.source !== "provider" ||
      !isFiniteNonNegative(volume) ||
      !isFiniteNonNegative(competition) ||
      !isFiniteNonNegative(cpc)
    ) {
      continue;
    }
    rows.push({ term, volume, competition, cpc, source: "provider" });
  }
  return rows;
}

function parseGoToMarketV2(value: unknown, ctx: V2Context): GoToMarket | null {
  const raw = readObject(value, "goToMarket", ["positioning", "channels", "pricingNotes"], ctx);
  if (!raw) return null;
  const positioning = readEditorialText(raw.positioning, "goToMarket.positioning", ctx);
  const channels = readEditorialTextList(raw.channels, "goToMarket.channels", ctx, {
    min: MIN_GTM_CHANNELS,
    max: RESEARCH_RECORD_V2_LIMITS.channels,
  });
  const pricingNotes = readEditorialText(raw.pricingNotes, "goToMarket.pricingNotes", ctx);
  if (positioning === null || !channels || pricingNotes === null) return null;
  return { positioning, channels, pricingNotes };
}

function parseScoresV2(value: unknown, ctx: V2Context): ResearchScores | null {
  const raw = readObject(value, "scores", SCORE_KEYS, ctx);
  if (!raw) return null;
  const scores: ResearchScores = {};
  let ok = true;
  for (const key of SCORE_KEYS) {
    const score = raw[key];
    if (score === undefined) {
      if (key !== "execution") {
        ctx.issues.push(`scores.${key}: required when scores are present (the site publishes all four or none)`);
        ok = false;
      }
      continue;
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < SCORE_MIN || score > SCORE_MAX) {
      ctx.issues.push(`scores.${key}: expected a number from ${SCORE_MIN} to ${SCORE_MAX} (got ${describeValue(score)})`);
      ok = false;
      continue;
    }
    scores[key] = score;
  }
  return ok ? scores : null;
}

// --- editorial -------------------------------------------------------------------

function parsePricingTiersV2(value: unknown, ctx: V2Context): PricingTier[] | null {
  const list = readArray(value, "editorial.pricingTiers", ctx, { min: 1, max: RESEARCH_RECORD_V2_LIMITS.pricingTiers });
  if (!list) return null;
  const tiers: PricingTier[] = [];
  const firstByName = new Map<string, number>();
  for (const [i, entry] of list.entries()) {
    const path = `editorial.pricingTiers[${i}]`;
    const raw = readObject(entry, path, ["name", "price", "includes"], ctx);
    if (!raw) continue;
    const name = readEditorialText(raw.name, `${path}.name`, ctx);
    const price = readEditorialText(raw.price, `${path}.price`, ctx);
    const includes = readEditorialText(raw.includes, `${path}.includes`, ctx);
    if (name !== null) {
      const first = firstByName.get(name.toLowerCase());
      if (first !== undefined) ctx.issues.push(`${path}.name: repeats editorial.pricingTiers[${first}].name`);
      else firstByName.set(name.toLowerCase(), i);
    }
    if (name === null || price === null || includes === null) continue;
    tiers.push({ name, price, includes });
  }
  return tiers;
}

function parseUnitEconomicsV2(value: unknown, ctx: V2Context): UnitEconRow[] | null {
  const list = readArray(value, "editorial.unitEconomics", ctx, {
    min: 1,
    max: RESEARCH_RECORD_V2_LIMITS.unitEconomicsRows,
  });
  if (!list) return null;
  const rows: UnitEconRow[] = [];
  for (const [i, entry] of list.entries()) {
    const path = `editorial.unitEconomics[${i}]`;
    const raw = readObject(entry, path, ["label", "value"], ctx);
    if (!raw) continue;
    const label = readEditorialText(raw.label, `${path}.label`, ctx);
    const rowValue = readEditorialText(raw.value, `${path}.value`, ctx);
    if (label !== null && rowValue !== null) rows.push({ label, value: rowValue });
  }
  return rows;
}

/** Closed keys and text bounds here; identifier and shape rules in parseDataModel. */
function parseDataModelV2(value: unknown, ctx: V2Context): DataTable[] | null {
  const list = readArray(value, "editorial.dataModel", ctx, { min: 1, max: RESEARCH_RECORD_V2_LIMITS.dataModelTables });
  if (!list || list.length === 0) return null;
  const before = ctx.issues.length;
  for (const [i, entry] of list.entries()) {
    if (!isPlainObject(entry)) continue;
    const path = `editorial.dataModel[${i}]`;
    rejectUnknownKeys(entry, path, ["table", "columns"], ctx);
    if (typeof entry.columns === "string" && entry.columns.trim() !== "") {
      readEditorialText(entry.columns, `${path}.columns`, ctx);
    }
  }
  const tables = parseDataModel(list, ctx.issues);
  return ctx.issues.length > before || !tables ? null : tables;
}

/** Closed keys and text rules here; integer counts, funnel and tier math in validateYearOnePlan. */
function parseYearOneV2(value: unknown, tiers: ReadonlyArray<PricingTier>, ctx: V2Context): YearOnePlanV2 | null {
  const path = "editorial.yearOne";
  const raw = readObject(value, path, YEAR_ONE_KEYS, ctx);
  if (!raw) return null;
  const before = ctx.issues.length;
  if (Array.isArray(raw.funnel)) {
    for (const [i, row] of raw.funnel.slice(0, RESEARCH_RECORD_V2_LIMITS.yearOneFunnelStages).entries()) {
      if (!isPlainObject(row)) continue;
      rejectUnknownKeys(row, `${path}.funnel[${i}]`, ["stage", "count"], ctx);
      if (typeof row.stage === "string" && row.stage.trim() !== "") {
        ctx.texts.push({ path: `${path}.funnel[${i}].stage`, text: row.stage.trim() });
      }
    }
  }
  if (raw.assumptions !== undefined) readEditorialText(raw.assumptions, `${path}.assumptions`, ctx);
  // Only the v2 keys reach the finance rules (never a legacy monthlyRevenuePerAccount).
  const known: Record<string, unknown> = {};
  for (const key of YEAR_ONE_KEYS) if (Object.hasOwn(raw, key)) known[key] = raw[key];
  const { plan, issues } = validateYearOnePlan(known, tiers);
  ctx.issues.push(...issues);
  return ctx.issues.length > before || !plan ? null : plan;
}

function parseEditorialV2(value: unknown, ctx: V2Context): EditorialFieldsV2 | null {
  const raw = readObject(value, "editorial", EDITORIAL_KEYS, ctx);
  if (!raw) return null;
  const before = ctx.issues.length;
  const out: EditorialFieldsV2 = {};
  for (const key of EDITORIAL_TEXT_KEYS) {
    if (raw[key] === undefined) continue;
    const text = readEditorialText(raw[key], `editorial.${key}`, ctx);
    if (text !== null) out[key] = text;
  }
  const tiers = raw.pricingTiers === undefined ? undefined : parsePricingTiersV2(raw.pricingTiers, ctx);
  if (tiers) out.pricingTiers = tiers;
  if (raw.unitEconomics !== undefined) {
    const rows = parseUnitEconomicsV2(raw.unitEconomics, ctx);
    if (rows) out.unitEconomics = rows;
  }
  if (raw.dataModel !== undefined) {
    const tables = parseDataModelV2(raw.dataModel, ctx);
    if (tables) out.dataModel = tables;
  }
  if (raw.yearOne !== undefined) {
    if (raw.pricingTiers === undefined) {
      ctx.issues.push("editorial.yearOne: needs editorial.pricingTiers to name its tier");
    }
    const plan = parseYearOneV2(raw.yearOne, tiers ?? [], ctx);
    if (plan) out.yearOne = plan;
  }
  return ctx.issues.length > before ? null : out;
}

// --- provenance -----------------------------------------------------------------

function parseProviderCallsV2(value: unknown, ctx: V2Context): ProviderCall[] | null {
  const list = readArray(value, "provenance.providerCalls", ctx, { max: RESEARCH_RECORD_V2_LIMITS.providerCalls });
  if (!list) return null;
  const calls: ProviderCall[] = [];
  for (const [i, entry] of list.entries()) {
    const path = `provenance.providerCalls[${i}]`;
    const raw = readObject(entry, path, ["provider", "operation", "costUsd"], ctx);
    if (!raw) continue;
    const provider = readText(raw.provider, `${path}.provider`, ctx, RESEARCH_RECORD_V2_LIMITS.identifierChars);
    const operation = readText(raw.operation, `${path}.operation`, ctx, RESEARCH_RECORD_V2_LIMITS.identifierChars);
    const { costUsd } = raw;
    if (!isFiniteNonNegative(costUsd)) ctx.issues.push(`${path}.costUsd: expected a finite number ≥ 0`);
    if (provider !== null && operation !== null && isFiniteNonNegative(costUsd)) {
      calls.push({ provider, operation, costUsd });
    }
  }
  return calls;
}

function parseModelsV2(value: unknown, ctx: V2Context): ResearchProvenanceV2["models"] | null {
  const raw = readObject(value, "provenance.models", ["synthesis", "search", "keywordData"], ctx);
  if (!raw) return null;
  const max = RESEARCH_RECORD_V2_LIMITS.identifierChars;
  const synthesis = readText(raw.synthesis, "provenance.models.synthesis", ctx, max);
  const search = readText(raw.search, "provenance.models.search", ctx, max);
  const keywordData = readText(raw.keywordData, "provenance.models.keywordData", ctx, max);
  if (synthesis === null || search === null || keywordData === null) return null;
  return { synthesis, search, keywordData };
}

function parseAttemptsV2(value: unknown, ctx: V2Context): Record<string, number> | null {
  if (!isPlainObject(value)) {
    ctx.issues.push("provenance.attempts: required object");
    return null;
  }
  const before = ctx.issues.length;
  const keys = Object.keys(value);
  if (keys.length > RESEARCH_RECORD_V2_LIMITS.attemptSteps) {
    ctx.issues.push(`provenance.attempts: at most ${RESEARCH_RECORD_V2_LIMITS.attemptSteps} steps (got ${keys.length})`);
  }
  const attempts: Record<string, number> = {};
  for (const key of keys.slice(0, RESEARCH_RECORD_V2_LIMITS.attemptSteps)) {
    if (!STEP_ID_PATTERN.test(key)) {
      ctx.issues.push(`provenance.attempts: ${describeValue(key)} is not a step id`);
      continue;
    }
    const count = value[key];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      ctx.issues.push(`provenance.attempts.${key}: expected an integer ≥ 0 (got ${describeValue(count)})`);
      continue;
    }
    attempts[key] = count;
  }
  return ctx.issues.length > before ? null : attempts;
}

function parseProvenanceV2(value: unknown, ctx: V2Context): ResearchProvenanceV2 | null {
  const raw = readObject(value, "provenance", ["providerCalls", "costUsd", "ranAt", "models", "attempts"], ctx);
  if (!raw) return null;
  const providerCalls = parseProviderCallsV2(raw.providerCalls, ctx);
  const { costUsd, ranAt } = raw;
  if (!isFiniteNonNegative(costUsd)) ctx.issues.push("provenance.costUsd: expected a finite number ≥ 0");
  if (!isIsoTime(ranAt)) ctx.issues.push("provenance.ranAt: expected an ISO 8601 time");
  const models = parseModelsV2(raw.models, ctx);
  const attempts = parseAttemptsV2(raw.attempts, ctx);
  if (!providerCalls || !isFiniteNonNegative(costUsd) || !isIsoTime(ranAt) || !models || !attempts) return null;
  return { providerCalls, costUsd, ranAt, models, attempts };
}

// --- editorial text rules -------------------------------------------------------

/** "competitors[2].notes" → "competitors[].notes", the FACT_BEARING_FIELDS form. */
function isFactBearingPath(path: string): boolean {
  return FACT_BEARING_PATHS.has(path.replace(/\[\d+\]/g, "[]"));
}

/**
 * Fact-bearing fields may carry figures only through tokens of accepted
 * evidence; every other field may hold figures (proposals and assumptions)
 * but any token must still resolve. brief.oneLiner becomes the manifest
 * description verbatim, so it may hold no token at all.
 */
function checkEditorialTexts(ctx: V2Context, accepted: ReadonlyMap<string, AcceptedEvidence>): void {
  for (const { path, text } of ctx.texts) {
    if (path === ONE_LINER_PATH && (evidenceRefs(text).length > 0 || TOKEN_LIKE_PATTERN.test(text))) {
      ctx.issues.push(
        `${ONE_LINER_PATH}: evidence tokens are not allowed here; the one-liner is the manifest description, so state it without citations`,
      );
    }
    ctx.issues.push(...validateEditorialText({ path, text, factBearing: isFactBearingPath(path), accepted }));
  }
}

/**
 * Parse a contract v2 research record (evidence contract §8) into a fresh,
 * normalized copy (editorial strings trimmed; evidence excerpts kept
 * byte-for-byte). The schema is closed: an unknown key at any level fails,
 * so a stray `verified` flag or a v1 `market.stats` cannot ride along.
 *
 * Throws LegacyResearchRecordError for contractVersion 1 and
 * ResearchRecordParseError, listing every issue found, for anything else
 * invalid. The checks:
 * - versions 2/2, evidence.contractVersion 1, mode "live" | "fixture";
 * - evidence.sources: canonical distinct URLs, 1–3 known roles, a known
 *   status; "read" carries an ISO retrievedAt and a 64-hex textSha256 and
 *   no detail; other statuses carry neither, and an optional detail;
 * - evidence.accepted: every item re-validates offline
 *   (revalidateAcceptedEvidence, with every vendor name in the record),
 *   ids are unique, per-kind caps hold; evidence.rejected entries are
 *   well-formed and bounded;
 * - market.statIds, competitors[].priceIds and community.quoteIds resolve
 *   to distinct accepted items of the right kind; each competitor's prices
 *   are its own (vendor === name); ≥2 stats, ≥3 competitors with distinct
 *   names (by case and vendor key), ≥2 quotes with distinct text;
 * - keywords as v1; goToMarket with ≥2 channels; ≥2 how-it-works steps;
 *   scores all four of opportunity/pain/timing/builderConfidence in 0–10
 *   (execution optional) or absent; editorial.yearOne through
 *   validateYearOnePlan against editorial.pricingTiers;
 * - FACT_BEARING_FIELDS carry figures only via accepted evidence tokens,
 *   brief.oneLiner carries no token, and every token anywhere resolves.
 * Bounds: RESEARCH_RECORD_V2_LIMITS and EVIDENCE_LIMITS.
 *
 * Re-validation proves internal consistency, not authenticity: the record
 * holds no page text, so an excerpt edited together with its claim, digest
 * and id still parses. Replaying against the source text is a separate gate.
 */
export function parseResearchRecordV2(input: unknown): ResearchRecordV2 {
  if (!isPlainObject(input)) throw new ResearchRecordParseError(["root: expected an object"]);
  if (input.contractVersion === RESEARCH_RECORD_CONTRACT_VERSION) throw new LegacyResearchRecordError(input);
  if (input.contractVersion !== RESEARCH_RECORD_CONTRACT_VERSION_V2) {
    throw new ResearchRecordParseError([
      `contractVersion: unsupported value ${describeValue(input.contractVersion)} (expected ${RESEARCH_RECORD_CONTRACT_VERSION_V2})`,
    ]);
  }

  const ctx: V2Context = { issues: [], texts: [] };
  rejectUnknownKeys(input, "", ROOT_KEYS, ctx);
  if (input.pipelineVersion !== PIPELINE_VERSION_V2) {
    ctx.issues.push(`pipelineVersion: expected ${PIPELINE_VERSION_V2} (got ${describeValue(input.pipelineVersion)})`);
  }
  const mode = input.mode === "live" || input.mode === "fixture" ? input.mode : null;
  if (mode === null) ctx.issues.push(`mode: expected "live" or "fixture" (got ${describeValue(input.mode)})`);

  const brief = parseBriefV2(input.brief, ctx);
  const evidence = parseEvidenceV2(input.evidence, vendorNamesOf(input), ctx);
  const market = parseMarketV2(input.market, evidence.byId, ctx);
  const competitors = parseCompetitorsV2(input.competitors, evidence.byId, ctx);
  const community = parseCommunityV2(input.community, evidence.byId, ctx);
  const keywords = parseKeywordsV2(input.keywords, ctx);
  const goToMarket = parseGoToMarketV2(input.goToMarket, ctx);
  const whyNow = readEditorialText(input.whyNow, "whyNow", ctx);
  const howItWorks = readEditorialTextList(input.howItWorks, "howItWorks", ctx, {
    min: MIN_HOW_IT_WORKS_STEPS,
    max: RESEARCH_RECORD_V2_LIMITS.howItWorksSteps,
  });
  const scores = input.scores === undefined ? undefined : parseScoresV2(input.scores, ctx);
  const editorial = input.editorial === undefined ? undefined : parseEditorialV2(input.editorial, ctx);
  const provenance = parseProvenanceV2(input.provenance, ctx);
  checkEditorialTexts(ctx, evidence.byId);

  if (ctx.issues.length > 0) throw new ResearchRecordParseError(ctx.issues);
  if (
    mode === null ||
    !brief ||
    !evidence.value ||
    !market ||
    !competitors ||
    !community ||
    !keywords ||
    !goToMarket ||
    whyNow === null ||
    !howItWorks ||
    scores === null ||
    editorial === null ||
    !provenance
  ) {
    // Every null above pushed an issue, so this is a parser defect: fail closed.
    throw new ResearchRecordParseError(["record: incomplete after parsing (parser defect)"]);
  }
  return {
    contractVersion: RESEARCH_RECORD_CONTRACT_VERSION_V2,
    pipelineVersion: PIPELINE_VERSION_V2,
    mode,
    brief,
    evidence: evidence.value,
    market,
    competitors,
    community,
    keywords,
    goToMarket,
    whyNow,
    howItWorks,
    ...(scores ? { scores } : {}),
    ...(editorial && Object.keys(editorial).length > 0 ? { editorial } : {}),
    provenance,
  };
}
