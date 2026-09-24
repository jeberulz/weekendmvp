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

export type ResearchScores = {
  opportunity?: number;
  pain?: number;
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
  scores?: ResearchScores;
  provenance: ResearchProvenance;
};

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
  let ok = true;
  if (!isNonEmptyString(value.url) || !isHttpUrl(value.url)) {
    issues.push(`${path}.url: required http(s) URL`);
    ok = false;
  }
  if (!isNonEmptyString(value.title)) {
    issues.push(`${path}.title: required non-empty string`);
    ok = false;
  }
  if (!ok) return null;
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
        if (citation && isNonEmptyString(sig.quote)) {
          communitySignals.push({
            quote: sig.quote.trim(),
            citation,
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

  if (scores) record.scores = scores;

  return record;
}
