/**
 * WP41-S3. Layer 2: check claims against the source the page cites.
 *
 * One call per (page, source), batching every claim mapped to that source.
 * The model sees only the passages of the source nearest each claim's
 * numbers and keywords, which keeps a call to a few thousand characters.
 *
 * Guard: a `supported` or `contradicted` verdict must quote evidence that
 * appears verbatim in the fetched source. Otherwise it is downgraded to
 * `not_found`, so the verifier cannot invent support or a contradiction.
 */

import { hashKey, type JsonCache } from "./cache.ts";
import type { Claim, SourceRef } from "./claims.ts";
import { callWithRetry, type EvalLlm } from "./llm.ts";
import { containsVerbatim, keywords, numberTokens } from "./text.ts";

export const VERIFY_PROMPT_VERSION = "verify-v2";
/** Marker the fixture transport uses to route replies. */
export const VERIFY_MARKER = "TASK: VERIFY_CLAIMS";

export type Verdict = "supported" | "contradicted" | "outdated" | "not_found";
export type ClaimStatus = Verdict | "unsourced" | "unverifiable";

export type ClaimCheck = {
  claimId: string;
  status: ClaimStatus;
  sourceId?: number;
  evidence?: string;
  note?: string;
};

export type PassageOptions = {
  windowChars: number;
  passagesPerClaim: number;
  maxChars: number;
};

type Window = { start: number; text: string };

function windows(text: string, size: number): Window[] {
  const step = Math.max(1, Math.floor(size / 2));
  const out: Window[] = [];
  for (let start = 0; start < text.length; start += step) {
    out.push({ start, text: text.slice(start, start + size) });
    if (start + size >= text.length) break;
  }
  return out;
}

function score(window: string, numbers: string[], words: string[]): number {
  const lower = window.toLowerCase();
  let s = 0;
  for (const n of numbers) if (lower.includes(n.toLowerCase())) s += 5;
  for (const w of words) if (lower.includes(w)) s += 1;
  return s;
}

/**
 * The passages of `text` most likely to confirm or refute the claims,
 * merged, in source order, within maxChars. Empty when nothing matches.
 */
export function selectPassages(text: string, claims: Claim[], options: PassageOptions): string[] {
  const all = windows(text, options.windowChars);
  const picked = new Map<number, Window>();
  for (const claim of claims) {
    const numbers = numberTokens(`${claim.quote} ${claim.value}`);
    const words = keywords(claim.quote);
    all
      .map((w) => ({ w, s: score(w.text, numbers, words) }))
      // A passage must share a number, or at least 3 content words.
      .filter((x) => x.s >= 3)
      .sort((a, b) => b.s - a.s || a.w.start - b.w.start)
      .slice(0, options.passagesPerClaim)
      .forEach((x) => picked.set(x.w.start, x.w));
  }
  const ordered = [...picked.values()].sort((a, b) => a.start - b.start);
  const out: string[] = [];
  let used = 0;
  for (const w of ordered) {
    const clean = w.text.replace(/\s+/g, " ").trim();
    if (used + clean.length > options.maxChars) break;
    out.push(clean);
    used += clean.length;
  }
  return out;
}

export function buildVerifyMessages(args: {
  source: SourceRef;
  claims: Claim[];
  passages: string[];
}): { system: string; user: string } {
  const system = `${VERIFY_MARKER}
You check whether a source supports claims made on a startup idea page. You see excerpts from one source.

For each claim, answer:
- "supported": the excerpts state the same fact or figure. Rounding, unit changes, and differences of 5% or less count as supported.
- "contradicted": the excerpts give a clearly different value for the SAME metric, the SAME product or market definition, and the SAME year or period. Example: page says a plan costs $15/month, source says that plan costs $30/month.
- "outdated": the excerpts cover the same metric but for a different year or forecast period, or a newer edition of the same forecast with different numbers. Example: page says "$2.7B by 2035", source says "$3.1B by 2036". The page likely quotes an older version.
- "not_found": the excerpts do not address the claim, or describe a different market or definition. When unsure, answer not_found.

"evidence" must be copied exactly from the excerpts, 10 to 300 characters. Required for supported, contradicted and outdated; use "" for not_found.
Reply with JSON only: {"results":[{"id":"c1","verdict":"supported|contradicted|outdated|not_found","evidence":"..."}]}`;
  const claimList = args.claims.map((c) => `${c.id}: ${c.quote}${c.value ? ` [figure: ${c.value}]` : ""}`).join("\n");
  const excerpts = args.passages.map((p, i) => `(${i + 1}) ${p}`).join("\n\n");
  const user = `SOURCE: ${args.source.title} — ${args.source.url}\n\nEXCERPTS:\n${excerpts}\n\nCLAIMS:\n${claimList}`;
  return { system, user };
}

/**
 * Output allowance for one verify call: a fixed overhead plus room for one
 * verdict with a quoted sentence per claim, capped by config. Sizing it to
 * the batch keeps the worst-case reservation (and so the cap) honest.
 */
export const VERIFY_TOKENS_BASE = 150;
export const VERIFY_TOKENS_PER_CLAIM = 120;
export function verifyOutputTokens(claimCount: number, cap: number): number {
  return Math.min(cap, VERIFY_TOKENS_BASE + VERIFY_TOKENS_PER_CLAIM * claimCount);
}

type RawResult = { id?: unknown; verdict?: unknown; evidence?: unknown };

/** Validate verdicts. Missing, malformed or unevidenced answers become not_found. */
export function validateVerdicts(
  json: unknown,
  claims: Claim[],
  source: SourceRef,
  sourceText: string,
): ClaimCheck[] {
  const raw = (json as { results?: unknown })?.results;
  const byId = new Map<string, RawResult>();
  if (Array.isArray(raw)) {
    for (const r of raw as RawResult[]) {
      if (typeof r?.id === "string" && !byId.has(r.id)) byId.set(r.id, r);
    }
  }
  return claims.map((claim) => {
    const r = byId.get(claim.id);
    const verdict = r?.verdict;
    const evidence = typeof r?.evidence === "string" ? r.evidence.trim() : "";
    if (verdict !== "supported" && verdict !== "contradicted" && verdict !== "outdated") {
      return {
        claimId: claim.id,
        status: "not_found",
        sourceId: source.id,
        ...(r ? {} : { note: "verifier gave no answer" }),
      };
    }
    if (!containsVerbatim(sourceText, evidence, 10)) {
      return {
        claimId: claim.id,
        status: "not_found",
        sourceId: source.id,
        note: `verifier said ${verdict} but its evidence is not in the source`,
      };
    }
    return { claimId: claim.id, status: verdict, sourceId: source.id, evidence };
  });
}

export async function verifyAgainstSource(args: {
  llm: EvalLlm;
  model: string;
  slug: string;
  source: SourceRef;
  sourceText: string;
  claims: Claim[];
  passages: PassageOptions;
  maxOutputTokens: number;
  cache?: JsonCache;
  /**
   * Second model that must agree before a contradiction stands. A
   * contradiction fails the page, so one cheap model's misread (rounding,
   * a different year range) must not be enough.
   */
  confirmer?: ConfirmerSpec;
}): Promise<{ checks: ClaimCheck[]; cached: boolean; called: boolean }> {
  const passages = selectPassages(args.sourceText, args.claims, args.passages);
  if (passages.length === 0) {
    // Nothing in the source shares a figure or enough words with any claim:
    // no call needed.
    return {
      checks: args.claims.map((c) => ({
        claimId: c.id,
        status: "not_found",
        sourceId: args.source.id,
        note: "no matching passage in the source",
      })),
      cached: false,
      called: false,
    };
  }

  const key = hashKey(
    VERIFY_PROMPT_VERSION,
    args.model,
    JSON.stringify(args.claims.map((c) => [c.id, c.quote, c.value])),
    hashKey(args.sourceText),
    JSON.stringify(args.passages),
  );
  // Evidence must be in the excerpts sent, which are all source text. The
  // raw reply is cached so a guard fix re-applies without new calls.
  const validate = (json: unknown) => validateVerdicts(json, args.claims, args.source, passages.join("\n"));
  const hit = args.cache?.get<{ raw: unknown }>("verify", key);
  if (hit) return { checks: await confirmContradictions(args, validate(hit.raw)), cached: true, called: false };

  const { system, user } = buildVerifyMessages({ source: args.source, claims: args.claims, passages });
  const result = await callWithRetry(args.llm, {
    label: `verify ${args.slug} [${args.source.id}]`,
    model: args.model,
    system,
    user,
    maxOutputTokens: verifyOutputTokens(args.claims.length, args.maxOutputTokens),
    json: true,
  });
  args.cache?.set("verify", key, { raw: result.json });
  return { checks: await confirmContradictions(args, validate(result.json)), cached: false, called: true };
}

export type ConfirmerSpec = {
  model: string;
  maxOutputTokens: number;
  reasoning?: "minimal" | "low" | "medium" | "high";
};

/**
 * Re-check each contradicted claim alone with the confirmer, on the
 * excerpts nearest that claim. Unconfirmed contradictions become not_found.
 */
async function confirmContradictions(
  args: Parameters<typeof verifyAgainstSource>[0],
  checks: ClaimCheck[],
): Promise<ClaimCheck[]> {
  const confirmer = args.confirmer;
  if (!confirmer) return checks;
  return Promise.all(
    checks.map(async (check) => {
      if (check.status !== "contradicted") return check;
      const claim = args.claims.find((c) => c.id === check.claimId);
      if (!claim) return check;
      const passages = selectPassages(args.sourceText, [claim], args.passages);
      const unconfirmed: ClaimCheck = {
        claimId: check.claimId,
        status: "not_found",
        sourceId: check.sourceId,
        note: `contradiction not confirmed by ${confirmer.model}`,
      };
      if (passages.length === 0) return unconfirmed;

      const key = hashKey(
        VERIFY_PROMPT_VERSION,
        "confirm",
        confirmer.model,
        claim.quote,
        claim.value,
        hashKey(args.sourceText),
        JSON.stringify(args.passages),
      );
      let raw = args.cache?.get<{ raw: unknown }>("confirm", key)?.raw;
      if (raw === undefined) {
        const { system, user } = buildVerifyMessages({ source: args.source, claims: [claim], passages });
        const result = await callWithRetry(args.llm, {
          label: `confirm ${args.slug} [${args.source.id}] ${claim.id}`,
          model: confirmer.model,
          system,
          user,
          maxOutputTokens: confirmer.maxOutputTokens,
          reasoning: confirmer.reasoning,
          json: true,
        });
        raw = result.json;
        args.cache?.set("confirm", key, { raw });
      }
      const [second] = validateVerdicts(raw, [claim], args.source, passages.join("\n"));
      if (second.status === "contradicted") return { ...check, note: `confirmed by ${confirmer.model}` };
      // The confirmer saw a different period or edition: stale, not wrong.
      if (second.status === "outdated") return { ...second, note: `outdated per ${confirmer.model}` };
      return unconfirmed;
    }),
  );
}
