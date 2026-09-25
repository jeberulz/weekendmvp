/**
 * The Ideas library's state lives in the URL (PRD FR-8), so a filtered view
 * can be shared, bookmarked and restored with the back button. Pure, and
 * imported relatively so tests can load it without the `@/` alias.
 */
import {
  HOURS_BUCKETS,
  LIBRARY_SORTS,
  LIBRARY_VIEWS,
  MAX_SEARCH_LENGTH,
  MAX_TOOL_FILTERS,
  NEW_WINDOW_DAYS,
  type HoursBucket,
  type LibraryView,
} from "../../../convex/platform/libraryFilters";

export const IDEAS_PATH = "/dashboard/explore";
export const SAVED_PATH = "/dashboard/saved";

type PickedSort = (typeof LIBRARY_SORTS)[number];

export type LibraryParams = {
  view: LibraryView;
  q: string;
  category?: string;
  tools: string[];
  hours?: HoursBucket;
  goal?: string;
  sort?: PickedSort;
};

type ParamSource = { get(key: string): string | null };

const includes = <T extends string>(list: readonly T[], value: string | null): value is T =>
  value !== null && (list as readonly string[]).includes(value);

export function parseLibraryParams(source: ParamSource): LibraryParams {
  const view = source.get("view");
  const hours = source.get("hours");
  const sort = source.get("sort");
  const tools = (source.get("tools") ?? "")
    .split(",")
    .map((tool) => tool.trim())
    .filter((tool, i, all) => tool !== "" && all.indexOf(tool) === i)
    .slice(0, MAX_TOOL_FILTERS);
  return {
    view: includes(LIBRARY_VIEWS, view) ? view : "all",
    q: (source.get("q") ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    category: source.get("category")?.trim() || undefined,
    tools,
    hours: includes(HOURS_BUCKETS, hours) ? hours : undefined,
    goal: source.get("goal")?.trim() || undefined,
    sort: includes(LIBRARY_SORTS, sort) ? sort : undefined,
  };
}

/** Query-string pairs for `params`, defaults left out. Order is stable. */
export function libraryEntries(params: LibraryParams): [string, string][] {
  const entries: [string, string][] = [];
  if (params.view !== "all") entries.push(["view", params.view]);
  if (params.q) entries.push(["q", params.q]);
  if (params.category) entries.push(["category", params.category]);
  if (params.tools.length > 0) entries.push(["tools", params.tools.join(",")]);
  if (params.hours) entries.push(["hours", params.hours]);
  if (params.goal) entries.push(["goal", params.goal]);
  if (params.sort) entries.push(["sort", params.sort]);
  return entries;
}

export function libraryHref(params: LibraryParams, patch: Partial<LibraryParams> = {}): string {
  const next = { ...params, ...patch };
  const query = new URLSearchParams(libraryEntries(next)).toString();
  return query ? `${IDEAS_PATH}?${query}` : IDEAS_PATH;
}

/** A stable key for "the same result set", ignoring view-only changes. */
export function libraryKey(params: LibraryParams): string {
  return new URLSearchParams(libraryEntries(params)).toString();
}

export function hasFilters(params: LibraryParams): boolean {
  return Boolean(params.q || params.category || params.tools.length || params.hours || params.goal);
}

export const VIEW_LABEL: Record<LibraryView, string> = {
  all: "All",
  for_you: "For you",
  new: "New",
};

export const SORT_LABEL: Record<PickedSort, string> = {
  relevance: "Best match",
  newest: "Newest",
  score: "Highest score",
};

export const HOURS_LABEL: Record<HoursBucket, string> = {
  "8": "Up to 8 hrs",
  "12": "9 to 12 hrs",
  "16": "13 to 16 hrs",
  more: "More than 16 hrs",
};

/**
 * The New tab's lower bound: UTC midnight, NEW_WINDOW_DAYS ago. Rounded to
 * the day so every visit that day shares one cached Convex query.
 */
export function newSince(now: Date): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return midnight - NEW_WINDOW_DAYS * 86_400_000;
}
