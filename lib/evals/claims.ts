/**
 * WP41-S3. Layer 1: extract checkable factual claims from an idea page.
 *
 * One cheap call per page. The model lists the factual claims in The
 * Problem, Market Research and Competitive Landscape, each with a verbatim
 * quote and the numbered Sources entries that plausibly back it.
 *
 * Guard: every quote must appear verbatim in the page. A claim whose quote
 * does not is dropped and counted, so the verifier never checks a sentence
 * the page does not contain.
 */

import { hashKey, type JsonCache } from "./cache.ts";
import { callWithRetry, type EvalLlm } from "./llm.ts";
import { containsVerbatim } from "./text.ts";

export const EXTRACT_PROMPT_VERSION = "extract-v2";
/** Marker the fixture transport uses to route replies. */
export const EXTRACT_MARKER = "TASK: EXTRACT_CLAIMS";

export const CLAIM_TYPES = [
  "market_size",
  "growth_rate",
  "pricing",
  "search_volume",
  "community_size",
  "user_stat",
  "other",
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export type SourceRef = { id: number; title: string; url: string };

export type Claim = {
  id: string;
  quote: string;
  type: ClaimType;
  value: string;
  sourceIds: number[];
};

export type DroppedClaim = { quote: string; reason: string };

/** External links in ## Sources, numbered from 1 in page order. */
export function listSources(sourcesMarkdown: string | undefined): SourceRef[] {
  const out: SourceRef[] = [];
  const seen = new Set<string>();
  for (const m of (sourcesMarkdown ?? "").matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ id: out.length + 1, title: m[1].trim(), url: m[2] });
  }
  return out;
}

export function buildExtractMessages(args: {
  factualText: string;
  sources: SourceRef[];
  maxClaims: number;
}): { system: string; user: string } {
  const sourceList =
    args.sources.length > 0
      ? args.sources.map((s) => `[${s.id}] ${s.title} — ${s.url}`).join("\n")
      : "(none)";
  const system = `${EXTRACT_MARKER}
You audit startup idea pages for factual accuracy. List the checkable factual claims the page makes about the outside world: market sizes, growth rates, competitor prices and features, search volumes, community sizes, user or survey statistics, dated events.

Rules:
- Only claims about the world that a source could confirm or refute. Skip opinions, advice, and the page's own proposed pricing or plans.
- "quote" must be ONE unbroken span copied character for character from the page text, 8 to 300 characters. Never skip words, join separate parts, retype a number, or add a full stop the page does not have. Copy symbols such as → and — exactly.
- In competitor bullets, quote only the part that holds the fact (for example "Pricing: free with ads") and put the competitor's name in "value" (for example "SmartPosture: free with ads").
- "sourceIds" lists the numbered sources whose title or URL suggests they back the claim. Use [] when none plausibly does. Never guess a source for a claim it does not cover.
- Numbers and pricing first. At most ${args.maxClaims} claims.
- Reply with JSON only: {"claims":[{"quote":"...","type":"${CLAIM_TYPES.join("|")}","value":"the figure or fact, short","sourceIds":[1]}]}`;
  const user = `PAGE TEXT:\n${args.factualText}\n\nSOURCES:\n${sourceList}`;
  return { system, user };
}

type RawClaim = { quote?: unknown; type?: unknown; value?: unknown; sourceIds?: unknown };

/** Validate the model's JSON against the page. Never throws on bad items. */
export function validateClaims(
  json: unknown,
  args: { factualText: string; sourceCount: number; maxClaims: number },
): { claims: Claim[]; dropped: DroppedClaim[] } {
  const items = (json as { claims?: unknown })?.claims;
  if (!Array.isArray(items)) {
    return { claims: [], dropped: [{ quote: "", reason: "reply had no claims array" }] };
  }
  const claims: Claim[] = [];
  const dropped: DroppedClaim[] = [];
  const seen = new Set<string>();

  for (const item of items as RawClaim[]) {
    const quote = typeof item?.quote === "string" ? item.quote.trim() : "";
    if (!quote) {
      dropped.push({ quote: "", reason: "missing quote" });
      continue;
    }
    if (!containsVerbatim(args.factualText, quote)) {
      dropped.push({ quote, reason: "quote not found verbatim in the page" });
      continue;
    }
    const key = quote.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (claims.length >= args.maxClaims) {
      dropped.push({ quote, reason: "over the per-page claim limit" });
      continue;
    }
    const type = CLAIM_TYPES.includes(item.type as ClaimType) ? (item.type as ClaimType) : "other";
    const sourceIds = Array.isArray(item.sourceIds)
      ? [...new Set(item.sourceIds.map(Number))].filter(
          (n) => Number.isInteger(n) && n >= 1 && n <= args.sourceCount,
        )
      : [];
    claims.push({
      id: `c${claims.length + 1}`,
      quote,
      type,
      value: typeof item.value === "string" ? item.value.slice(0, 200) : "",
      sourceIds,
    });
  }
  return { claims, dropped };
}

export type ExtractResult = {
  claims: Claim[];
  dropped: DroppedClaim[];
  costUsd: number;
  cached: boolean;
};

export async function extractClaims(args: {
  llm: EvalLlm;
  model: string;
  slug: string;
  factualText: string;
  sources: SourceRef[];
  maxClaims: number;
  maxOutputTokens: number;
  cache?: JsonCache;
}): Promise<ExtractResult> {
  const key = hashKey(
    EXTRACT_PROMPT_VERSION,
    args.model,
    String(args.maxClaims),
    args.factualText,
    JSON.stringify(args.sources),
  );
  const validate = (json: unknown) =>
    validateClaims(json, {
      factualText: args.factualText,
      sourceCount: args.sources.length,
      maxClaims: args.maxClaims,
    });
  // The raw reply is cached, not the validated result, so a guard fix
  // re-applies to cached replies without paying for new calls.
  const hit = args.cache?.get<{ raw: unknown }>("extract", key);
  if (hit) return { ...validate(hit.raw), costUsd: 0, cached: true };

  const { system, user } = buildExtractMessages(args);
  const result = await callWithRetry(args.llm, {
    label: `extract ${args.slug}`,
    model: args.model,
    system,
    user,
    maxOutputTokens: args.maxOutputTokens,
    json: true,
  });
  args.cache?.set("extract", key, { raw: result.json });
  return { ...validate(result.json), costUsd: result.costUsd, cached: false };
}
