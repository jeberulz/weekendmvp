/**
 * Curated homepage highlights for an idea (WP42 ruling, 2026-09-24).
 *
 * `/publish-idea` writes an optional `highlights` block into the idea's
 * manifest entry. `scripts/validate-idea-tags.mjs` enforces its shape at
 * publish time; this reader is lenient and drops anything malformed, so a bad
 * entry falls back to the MDX parser instead of breaking the homepage.
 */
import type { Competitor, IdeaExtract, MarketStat } from "./types";

export type IdeaHighlights = {
  problemQuote?: string;
  stats?: { value: string; label: string; source?: string }[];
  competitors?: Competitor[];
};

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function readHighlights(raw: unknown): IdeaHighlights | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const out: IdeaHighlights = {};
  if (isText(h.problemQuote)) out.problemQuote = h.problemQuote.trim();
  if (Array.isArray(h.stats)) {
    const stats = h.stats
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .filter((s) => isText(s.value) && isText(s.label))
      .map((s) => ({
        value: String(s.value).trim(),
        label: String(s.label).trim(),
        ...(isText(s.source) ? { source: String(s.source).trim() } : {}),
      }))
      .slice(0, 3);
    if (stats.length) out.stats = stats;
  }
  if (Array.isArray(h.competitors)) {
    const competitors = h.competitors
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .filter((c) => isText(c.name))
      .map((c) => ({ name: String(c.name).trim(), price: isText(c.price) ? String(c.price).trim() : "" }))
      .slice(0, 5);
    if (competitors.length) out.competitors = competitors;
  }
  return Object.keys(out).length ? out : null;
}

/** Curated highlights replace the parsed values they cover. */
export function applyHighlights(extract: IdeaExtract, highlights: IdeaHighlights | null): IdeaExtract {
  if (!highlights) return extract;
  const market: MarketStat[] | undefined = highlights.stats?.map((s) => ({
    value: s.value,
    text: s.source ? `${s.label}, per ${s.source}` : s.label,
  }));
  return {
    ...extract,
    problem: highlights.problemQuote ?? extract.problem,
    market: market ?? extract.market,
    competitors: highlights.competitors ?? extract.competitors,
  };
}
