/**
 * Operator research record for the idea engine (Mode A2).
 *
 * Fail-closed parse mirrors Mode A STOP: ≥2 cited market stats, ≥3
 * competitors with pricing + URL, keyword metrics from a provider only.
 * This is not ValidationReportPayload (Convex citation indices).
 */

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
  if (
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
 * Parse and validate a ResearchRecord. Throws ResearchRecordParseError on any
 * contract violation (unknown version, thin citations, guessed keywords).
 */
export function parseResearchRecord(input: unknown): ResearchRecord {
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
