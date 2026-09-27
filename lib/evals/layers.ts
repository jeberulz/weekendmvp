/**
 * WP41-S3. Runs Layer 1 (extract) and Layer 2 (verify) for one idea page
 * and turns the outcome into findings in the Layer 0 verdict's shape.
 *
 *   fail  claims.contradicted  a cited source says something different
 *   warn  claims.unsupported   most claims are unsourced or not found
 *   warn  sources.unreachable  many cited sources cannot be read
 *
 * "Not found" is a warning, not a failure: excerpts are a sample of the
 * source, and a figure may sit in a table the text extraction missed. A
 * contradiction needs quoted evidence from the source, so it can fail.
 */

import type { JsonCache } from "./cache.ts";
import { extractClaims, listSources, type Claim, type DroppedClaim, type SourceRef } from "./claims.ts";
import { fetchSource, type SourceDoc } from "./fetch-source.ts";
import type { EvalLlm } from "./llm.ts";
import {
  estimateInputTokens,
  worstCaseUsd,
  type Fetcher,
  type ModelRates,
} from "./providers/openrouter.ts";
import {
  type ConfirmerSpec,
  verifyAgainstSource,
  verifyOutputTokens,
  VERIFY_TOKENS_BASE,
  VERIFY_TOKENS_PER_CLAIM,
  type ClaimCheck,
  type ClaimStatus,
} from "./verify.ts";

export type ClaimsConfig = {
  maxPerPage: number;
  extractMaxOutputTokens: number;
  verifyMaxOutputTokens: number;
  windowChars: number;
  passagesPerClaim: number;
  maxPassageCharsPerCall: number;
  maxVerifyCallsPerPage: number;
  fetchTimeoutMs: number;
  maxSourceBytes: number;
  maxSourceTextChars: number;
  minClaimsForShareWarn: number;
  unsupportedShareWarn: number;
  unreachableShareWarn: number;
};

export type Section = { title: string; content: string };
export type Finding = { check: string; message: string };

export type CheckedClaim = Claim & { status: ClaimStatus; sourceId?: number; evidence?: string; note?: string };

export type ClaimLayerResult = {
  layers: 1 | 2;
  fails: Finding[];
  warns: Finding[];
  claims: CheckedClaim[];
  dropped: DroppedClaim[];
  sources: Array<SourceRef & { status?: SourceDoc["status"]; httpStatus?: number }>;
  metrics: {
    claims: number;
    dropped: number;
    supported: number;
    contradicted: number;
    notFound: number;
    unsourced: number;
    unverifiable: number;
    sourcesChecked: number;
    sourcesUnreachable: number;
    verifyCalls: number;
    costUsd: number;
    cachedExtract: boolean;
  };
};

export type RunClaimLayersArgs = {
  slug: string;
  sections: Section[];
  layers: 1 | 2;
  llm: EvalLlm;
  models: { extractor: string; verifier: string; confirmer?: ConfirmerSpec };
  config: ClaimsConfig;
  factualSections: string[];
  sourcesTitle: string;
  cache?: JsonCache;
  sourceFetch?: Fetcher;
};

export function factualText(sections: Section[], factualSections: string[]): string {
  return sections
    .filter((s) => factualSections.includes(s.title))
    .map((s) => `## ${s.title}\n${s.content.trim()}`)
    .join("\n\n");
}

/** Combine one claim's checks across its sources. */
export function combineChecks(checks: ClaimCheck[]): ClaimCheck | null {
  const pick = (status: ClaimStatus) => checks.find((c) => c.status === status);
  return (
    pick("supported") ??
    pick("contradicted") ??
    pick("not_found") ??
    pick("unverifiable") ??
    null
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function pageCost(llm: EvalLlm, slug: string, fromIndex: number): number {
  return llm
    .ledger()
    .slice(fromIndex)
    .filter((e) => e.label.split(" ")[1] === slug)
    .reduce((sum, e) => sum + e.costUsd, 0);
}

export async function runClaimLayers(args: RunClaimLayersArgs): Promise<ClaimLayerResult> {
  const { config } = args;
  const ledgerStart = args.llm.ledger().length;
  const text = factualText(args.sections, args.factualSections);
  const sources = listSources(args.sections.find((s) => s.title === args.sourcesTitle)?.content);

  const extracted = await extractClaims({
    llm: args.llm,
    model: args.models.extractor,
    slug: args.slug,
    factualText: text,
    sources,
    maxClaims: config.maxPerPage,
    maxOutputTokens: config.extractMaxOutputTokens,
    cache: args.cache,
  });

  const checks = new Map<string, ClaimCheck[]>();
  const sourceInfo = new Map<number, { status?: SourceDoc["status"]; httpStatus?: number }>();
  let verifyCalls = 0;

  if (args.layers === 2) {
    // Busiest sources first; the rest are over the per-page call budget.
    const bySource = new Map<number, Claim[]>();
    for (const claim of extracted.claims) {
      for (const id of claim.sourceIds) bySource.set(id, [...(bySource.get(id) ?? []), claim]);
    }
    const ranked = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0]);
    const inBudget = ranked.slice(0, config.maxVerifyCallsPerPage);
    const overBudget = ranked.slice(config.maxVerifyCallsPerPage);

    const add = (claimId: string, check: ClaimCheck) =>
      checks.set(claimId, [...(checks.get(claimId) ?? []), check]);

    for (const [id, claims] of overBudget) {
      for (const c of claims) add(c.id, { claimId: c.id, status: "unverifiable", sourceId: id, note: "over the per-page verify limit" });
    }

    await Promise.all(
      inBudget.map(async ([id, claims]) => {
        const source = sources[id - 1];
        const doc = await fetchSource(source.url, {
          fetchImpl: args.sourceFetch,
          cache: args.cache,
          timeoutMs: config.fetchTimeoutMs,
          maxBytes: config.maxSourceBytes,
          maxTextChars: config.maxSourceTextChars,
        });
        sourceInfo.set(id, { status: doc.status, httpStatus: doc.httpStatus });
        if (doc.status !== "ok") {
          const why = doc.httpStatus ? `${doc.status} ${doc.httpStatus}` : doc.detail ?? doc.status;
          for (const c of claims) add(c.id, { claimId: c.id, status: "unverifiable", sourceId: id, note: `source ${why}` });
          return;
        }
        const verified = await verifyAgainstSource({
          llm: args.llm,
          model: args.models.verifier,
          slug: args.slug,
          source,
          sourceText: doc.text,
          claims,
          passages: {
            windowChars: config.windowChars,
            passagesPerClaim: config.passagesPerClaim,
            maxChars: config.maxPassageCharsPerCall,
          },
          maxOutputTokens: config.verifyMaxOutputTokens,
          cache: args.cache,
          confirmer: args.models.confirmer,
        });
        if (verified.called) verifyCalls += 1;
        for (const check of verified.checks) add(check.claimId, check);
      }),
    );
  }

  const claims: CheckedClaim[] = extracted.claims.map((claim) => {
    if (claim.sourceIds.length === 0) return { ...claim, status: "unsourced" };
    if (args.layers === 1) return { ...claim, status: "not_found", note: "not verified (layer 1 only)" };
    const best = combineChecks(checks.get(claim.id) ?? []);
    return best
      ? { ...claim, status: best.status, sourceId: best.sourceId, evidence: best.evidence, note: best.note }
      : { ...claim, status: "unverifiable", note: "no check ran" };
  });

  const count = (s: ClaimStatus) => claims.filter((c) => c.status === s).length;
  const checkedSources = [...sourceInfo.values()];
  const unreachable = checkedSources.filter((s) => s.status !== "ok").length;

  const fails: Finding[] = [];
  const warns: Finding[] = [];

  for (const c of claims.filter((x) => x.status === "contradicted")) {
    const source = c.sourceId ? sources[c.sourceId - 1] : undefined;
    fails.push({
      check: "claims.contradicted",
      message: `"${clip(c.quote)}" but ${source ? host(source.url) : "the source"} says "${clip(c.evidence ?? "")}"`,
    });
  }

  const weak = args.layers === 2 ? count("not_found") + count("unsourced") : count("unsourced");
  if (claims.length >= config.minClaimsForShareWarn && weak / claims.length > config.unsupportedShareWarn) {
    const example = claims.find((c) => c.status === "unsourced" || (args.layers === 2 && c.status === "not_found"));
    warns.push({
      check: "claims.unsupported",
      message:
        (args.layers === 2
          ? `${weak} of ${claims.length} claims are unsourced (${count("unsourced")}) or not found in their cited source (${count("not_found")})`
          : `${weak} of ${claims.length} claims map to no source in ## Sources`) +
        (example ? `, e.g. "${clip(example.quote)}"` : ""),
    });
  }

  if (checkedSources.length > 0 && unreachable / checkedSources.length > config.unreachableShareWarn) {
    const bad = [...sourceInfo.entries()]
      .filter(([, s]) => s.status !== "ok")
      .slice(0, 3)
      .map(([id, s]) => `${host(sources[id - 1].url)} (${s.httpStatus ?? s.status})`);
    warns.push({
      check: "sources.unreachable",
      message: `${unreachable} of ${checkedSources.length} cited sources could not be read (${pct(unreachable / checkedSources.length)}): ${bad.join(", ")}`,
    });
  }

  return {
    layers: args.layers,
    fails,
    warns,
    claims,
    dropped: extracted.dropped,
    sources: sources.map((s) => ({ ...s, ...(sourceInfo.get(s.id) ?? {}) })),
    metrics: {
      claims: claims.length,
      dropped: extracted.dropped.length,
      supported: count("supported"),
      contradicted: count("contradicted"),
      notFound: count("not_found"),
      unsourced: count("unsourced"),
      unverifiable: count("unverifiable"),
      sourcesChecked: checkedSources.length,
      sourcesUnreachable: unreachable,
      verifyCalls,
      costUsd: pageCost(args.llm, args.slug, ledgerStart),
      cachedExtract: extracted.cached,
    },
  };
}

/**
 * Upper bound on what one page can cost, before any call: one extraction
 * plus one verify call per source up to the per-page limit, every call at
 * its full output allowance. Ignores the cache, so a warm run costs less.
 */
const CONFIRMS_PER_PAGE = 2;

export function estimatePageWorstCaseUsd(args: {
  sections: Section[];
  layers: 1 | 2;
  config: ClaimsConfig;
  factualSections: string[];
  sourcesTitle: string;
  rates: { extractor: ModelRates; verifier: ModelRates; confirmer?: ModelRates };
  confirmer?: ConfirmerSpec;
}): number {
  const text = factualText(args.sections, args.factualSections);
  const sources = listSources(args.sections.find((s) => s.title === args.sourcesTitle)?.content);
  const PROMPT_CHARS = 2_000;
  let usd = worstCaseUsd(args.rates.extractor, {
    inputTokens: estimateInputTokens(["x".repeat(PROMPT_CHARS), text, JSON.stringify(sources)]),
    maxOutputTokens: args.config.extractMaxOutputTokens,
  });
  if (args.layers === 2) {
    const calls = Math.min(sources.length, args.config.maxVerifyCallsPerPage);
    if (calls > 0) {
      // Page totals, not calls x maxima: each claim is checked against at
      // most two sources, and only pulls its own excerpts into a call.
      const c = args.config;
      const claimSlots = 2 * c.maxPerPage;
      const excerptChars = Math.min(calls * c.maxPassageCharsPerCall, claimSlots * c.passagesPerClaim * c.windowChars);
      const inputTokens = estimateInputTokens([
        "x".repeat(calls * PROMPT_CHARS + excerptChars + claimSlots * 200),
      ]) + calls * 16;
      const outputTokens = Math.min(
        calls * verifyOutputTokens(c.maxPerPage, c.verifyMaxOutputTokens),
        calls * VERIFY_TOKENS_BASE + claimSlots * VERIFY_TOKENS_PER_CLAIM,
      );
      usd +=
        calls * args.rates.verifier.requestUsd +
        inputTokens * args.rates.verifier.promptUsd +
        outputTokens * args.rates.verifier.completionUsd;
    }
    // Contradictions are rare; allow two confirmations per page.
    if (args.confirmer && args.rates.confirmer && calls > 0) {
      const c = args.config;
      usd +=
        CONFIRMS_PER_PAGE *
        worstCaseUsd(args.rates.confirmer, {
          inputTokens: estimateInputTokens(["x".repeat(PROMPT_CHARS + c.passagesPerClaim * c.windowChars + 400)]),
          maxOutputTokens: args.confirmer.maxOutputTokens,
        });
    }
  }
  return usd;
}
