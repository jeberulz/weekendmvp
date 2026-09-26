/** Pure whole-catalog selection. Call only after native pagination is complete. */
import type { Infer } from "convex/values";
import type { ideaCardValidator } from "./ideaCards";
import {
  effectiveSort,
  hoursBucket,
  HOURS_BUCKETS,
  MAX_SEARCH_LENGTH,
  MAX_TOOL_FILTERS,
  type LibraryView,
  type LibrarySort,
  type HoursBucket,
} from "./libraryFilters";
export type RankedCard = Infer<typeof ideaCardValidator> & { recommendationRank: number };
export type LibrarySelection = {
  view: LibraryView;
  search?: string;
  category?: string;
  tools?: string[];
  hours?: HoursBucket;
  goal?: string;
  sort?: Exclude<LibrarySort, "recommended">;
  publishedAfter?: number;
  unsavedOnly?: boolean;
  limit?: number;
};
const words = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
/** Every query token must prefix a word. Title hits precede description-only hits. */
export function searchMatch(card: Pick<RankedCard, "title" | "description">, search: string): number {
  const tokens = words(search.trim().slice(0, MAX_SEARCH_LENGTH));
  if (!tokens.length) return 0;
  const title = words(card.title);
  if (tokens.every((token) => title.some((word) => word.startsWith(token)))) return 2;
  const all = [...title, ...words(card.description)];
  return tokens.every((token) => all.some((word) => word.startsWith(token))) ? 1 : -1;
}
export function selectLibrary(cards: readonly RankedCard[], args: LibrarySelection) {
  const search = (args.search ?? "").trim();
  const tools = (args.tools ?? []).slice(0, MAX_TOOL_FILTERS);
  // Deduplicate defensively when a reactive page split is being reconciled.
  const unique = [...new Map(cards.map((card) => [card.ideaId, card])).values()];
  const base = unique.filter(
    (card) =>
      (!search || searchMatch(card, search) >= 0) &&
      (args.view !== "new" || args.publishedAfter === undefined || card.publishedAt >= args.publishedAfter) &&
      (!args.unsavedOnly || !card.saved),
  );
  const matches = {
    category: (card: RankedCard) => !args.category || card.category === args.category,
    tools: (card: RankedCard) => !tools.length || tools.some((tool) => card.tools.includes(tool)),
    hours: (card: RankedCard) => !args.hours || hoursBucket(card.buildTime) === args.hours,
    goal: (card: RankedCard) => !args.goal || card.revenueGoal === args.goal,
  };
  type Dimension = keyof typeof matches;
  const dimensions = Object.keys(matches) as Dimension[];
  const passes = (card: RankedCard, except?: Dimension) =>
    dimensions.every((key) => key === except || matches[key](card));
  const counts = (dimension: Dimension, keys: (card: RankedCard) => string[]) => {
    const count = new Map<string, number>();
    for (const card of base.filter((card) => passes(card, dimension))) {
      for (const key of new Set(keys(card))) count.set(key, (count.get(key) ?? 0) + 1);
    }
    return [...count]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  const hours = counts("hours", (card) => [hoursBucket(card.buildTime)]);
  const facets = {
    category: counts("category", (card) => [card.category]),
    tools: counts("tools", (card) => card.tools),
    hours: HOURS_BUCKETS.map((value) => ({
      value,
      count: hours.find((item) => item.value === value)?.count ?? 0,
    })),
    goal: counts("goal", (card) => [card.revenueGoal]),
  };
  const sort = effectiveSort(args.view, args.sort, search !== "");
  const items = base
    .filter((card) => passes(card))
    .sort((a, b) => {
      const rank =
        sort === "recommended"
          ? b.recommendationRank - a.recommendationRank
          : sort === "score"
            ? (b.score ?? 0) - (a.score ?? 0)
            : sort === "relevance"
              ? searchMatch(b, search) - searchMatch(a, search)
              : 0;
      return rank || b.publishedAt - a.publishedAt || a.slug.localeCompare(b.slug);
    });
  return {
    items: args.limit === undefined ? items : items.slice(0, Math.max(0, args.limit)),
    total: items.length,
    truncated: false,
    facets,
  };
}
