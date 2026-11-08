/**
 * WP90-S2 — the seed audit. Every `crew-idea-seed@2` result passes through
 * `auditSeedDraft` before anything is stored; a seed that fails is never
 * written, and the idea keeps its previous seed (or the generic fixture).
 *
 * Checks, in order (each failure is reported, none is repaired):
 * 1. The draft parses as `ideaSeedDraftSchema`: strict, bounded, and no market
 *    claim anywhere (`hasMarketClaim`, the D15 check).
 * 2. Every buyer quote (`landingSeeds.buyerWords`) appears verbatim in the
 *    source the model was shown, after normalising whitespace, quotes and
 *    dashes. A paraphrase is not a quote.
 * 3. Every competitor in `blueprint.market` is named in the source, or reads
 *    as a category ("Generic water reminder apps"), never as an invented
 *    brand. A category is a phrase with no capitalised word after its first.
 * 4. Unvalidated ideas carry no market block (dropped by `seedFromDraft`,
 *    owner ruling 2026-11-07), and `validated` comes from the idea's facts.
 *
 * Pure: no Convex imports, relative imports only.
 */
import {
  ideaSeedDraftSchema,
  seedFromDraft,
  type IdeaCrewSeed,
  type IdeaSeedDraft,
} from "../contracts/seeds";
import { sourceText, type SeedSource } from "./seedSource";

export const SEED_AUDIT_CODES = ["schema", "quote_not_in_source", "competitor_not_in_source"] as const;
export type SeedAuditCode = (typeof SEED_AUDIT_CODES)[number];

/** An audit finding. `path` names the field; values are never echoed (they are model text). */
export type SeedAuditIssue = { readonly code: SeedAuditCode; readonly path: string };

export type SeedAuditResult =
  | { readonly ok: true; readonly seed: IdeaCrewSeed }
  | { readonly ok: false; readonly issues: readonly SeedAuditIssue[] };

/** Lower case, straight quotes, plain hyphens, one space: so a verbatim quote matches across typography. */
export function normaliseForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/gu, "'")
    .replace(/[“”„‟″«»]/gu, '"')
    .replace(/[‐-―−]/gu, "-")
    .replace(/[*_`]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

/** The quote's words without its own wrapping quotation marks or end punctuation. */
function quoteCore(quote: string): string {
  return normaliseForMatch(quote)
    .replace(/^["']+|["']+$/gu, "")
    .replace(/[.!?,;:]+$/u, "")
    .trim();
}

/** A category, not a brand: no word after the first starts with a capital letter or digit. */
export function isCategoryName(name: string): boolean {
  const words = name.trim().split(/\s+/u);
  if (words.length < 2) return false;
  return words.slice(1).every((word) => !/^[\p{Lu}\p{N}]/u.test(word));
}

export function auditSeedDraft(candidate: unknown, source: SeedSource): SeedAuditResult {
  const parsed = ideaSeedDraftSchema.safeParse(candidate);
  if (!parsed.success) {
    const paths = [...new Set(parsed.error.issues.map((issue) => issue.path.filter((p) => typeof p !== "symbol").join(".") || "(root)"))];
    return { ok: false, issues: paths.map((path) => ({ code: "schema" as const, path })) };
  }
  const draft: IdeaSeedDraft = parsed.data;
  const haystack = normaliseForMatch(sourceText(source));
  const issues: SeedAuditIssue[] = [];

  draft.landingSeeds.buyerWords.forEach((item, index) => {
    const core = quoteCore(item.quote);
    if (core.length === 0 || !haystack.includes(core)) {
      issues.push({ code: "quote_not_in_source", path: `landingSeeds.buyerWords.${index}.quote` });
    }
  });

  (draft.blueprint.market?.competitors ?? []).forEach((competitor, index) => {
    const named = haystack.includes(normaliseForMatch(competitor.name));
    if (!named && !isCategoryName(competitor.name)) {
      issues.push({ code: "competitor_not_in_source", path: `blueprint.market.competitors.${index}.name` });
    }
  });

  if (issues.length > 0) return { ok: false, issues };
  try {
    return {
      ok: true,
      seed: seedFromDraft(draft, {
        ideaSlug: source.slug,
        researchLevel: source.researchLevel,
        auditPassed: source.auditPassed,
      }),
    };
  } catch {
    return { ok: false, issues: [{ code: "schema", path: "(seed)" }] };
  }
}
