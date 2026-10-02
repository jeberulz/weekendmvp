/**
 * Curated homepage highlights for an idea (WP42 ruling, 2026-09-24).
 *
 * `/publish-idea` writes an optional `highlights` block into the idea's
 * manifest entry. `scripts/validate-idea-tags.mjs` enforces its shape at
 * publish time; this reader is lenient and drops anything malformed, so a bad
 * entry falls back to the MDX parser instead of breaking the homepage.
 *
 * An engine-compiled idea is different (ruling R15): `engine:compile`
 * generates its highlights from accepted evidence, and the homepage shows
 * those only. Parsing its page would drop billing terms from prices, lose
 * "(via host)" labels and read Year-One lines as tiers, so a part its
 * highlights do not provide stays empty and that tile hides.
 */
import { extractIdea } from "./extract";
import { isEngineIdea } from "./library";
import type { Competitor, IdeaExtract, ManifestIdea, MarketStat } from "./types";

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

function marketOf(highlights: IdeaHighlights): MarketStat[] | undefined {
  return highlights.stats?.map((s) => ({
    value: s.value,
    text: s.source ? `${s.label}, per ${s.source}` : s.label,
  }));
}

/** Curated highlights replace the parsed values they cover. */
export function applyHighlights(extract: IdeaExtract, highlights: IdeaHighlights | null): IdeaExtract {
  if (!highlights) return extract;
  return {
    ...extract,
    problem: highlights.problemQuote ?? extract.problem,
    market: marketOf(highlights) ?? extract.market,
    competitors: highlights.competitors ?? extract.competitors,
  };
}

/**
 * What the homepage shows for one manifest row and its MDX body. A
 * handwritten idea: the parsed page with curated highlights on top. An
 * engine idea (ruling R15): problem, market, competitors and tiers from its
 * generated highlights only (tiers never: highlights carry none); How it
 * works, the stack and the prompts still come from the page.
 */
export function ideaHomeExtract(idea: ManifestIdea, body: string): IdeaExtract {
  const parsed = extractIdea(body);
  const highlights = readHighlights(idea.highlights);
  if (!isEngineIdea(idea)) return applyHighlights(parsed, highlights);
  return {
    ...parsed,
    problem: highlights?.problemQuote ?? "",
    market: (highlights && marketOf(highlights)) ?? [],
    competitors: highlights?.competitors ?? [],
    tiers: [],
  };
}
