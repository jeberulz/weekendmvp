import {
  COVERAGE_FILTERS,
  FRESHNESS_FILTERS,
  IDEA_SORTS,
  RELEASE_GROUPS,
  SEVERITY_FILTERS,
  defaultIdeaFilter,
  type IdeaFilter,
  type ReleaseFilter,
} from "../contracts/commands";
import { EDITORIAL_LIMITS } from "../contracts/limits";
import { ID_PATTERN } from "../contracts/primitives";
import { CANDIDATE_STATES, PUBLICATION_STATES } from "../contracts/states";
import { CATEGORY_SLUGS } from "../contracts/taxonomy";
import { QUEUE_BUCKETS } from "../contracts/views";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function first(params: SearchParamsRecord, key: string): string | null {
  const value = params[key];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * URL → filter. Unknown or malformed values are ignored rather than
 * rejected, so a stale bookmark still opens a working list.
 */
export function parseIdeaFilter(scope: IdeaFilter["scope"], params: SearchParamsRecord): IdeaFilter {
  const filter = defaultIdeaFilter(scope);
  const search = first(params, "q");
  const run = first(params, "run");
  return {
    ...filter,
    bucket: scope === "queue" ? oneOf(QUEUE_BUCKETS, first(params, "bucket")) : null,
    decision: oneOf(CANDIDATE_STATES, first(params, "decision")),
    severity: oneOf(SEVERITY_FILTERS, first(params, "severity")),
    sourceAge: oneOf(FRESHNESS_FILTERS, first(params, "age")),
    engineRunId: run !== null && ID_PATTERN.test(run) ? run : null,
    category: oneOf(CATEGORY_SLUGS, first(params, "category")),
    search: search === null ? null : search.slice(0, EDITORIAL_LIMITS.searchChars),
    publication: oneOf(PUBLICATION_STATES, first(params, "publication")),
    coverage: oneOf(COVERAGE_FILTERS, first(params, "coverage")),
    staleEvidence: first(params, "stale") === "1",
    sort: oneOf(IDEA_SORTS, first(params, "sort")) ?? "updated_desc",
  };
}

export function parseCursor(params: SearchParamsRecord): string | null {
  const cursor = first(params, "cursor");
  return cursor !== null && cursor.length <= EDITORIAL_LIMITS.cursorChars && /^[A-Za-z0-9_-]+$/.test(cursor)
    ? cursor
    : null;
}

/** Display-only row offset for "Showing x–y"; never used to fetch. */
export function parseStart(params: SearchParamsRecord): number {
  const raw = Number(first(params, "start"));
  return Number.isInteger(raw) && raw >= 1 && raw <= 100_000 ? raw : 1;
}

export function parseReleaseFilter(params: SearchParamsRecord): ReleaseFilter {
  return { group: oneOf(RELEASE_GROUPS, first(params, "group")) ?? "all", ideaId: null };
}

/** Filter → query string, omitting defaults so URLs stay short and shareable. */
export function ideaFilterQuery(filter: IdeaFilter, overrides: Record<string, string | null> = {}): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value);
  };
  set("bucket", filter.bucket);
  set("decision", filter.decision);
  set("severity", filter.severity);
  set("age", filter.sourceAge);
  set("run", filter.engineRunId);
  set("category", filter.category);
  set("q", filter.search);
  set("publication", filter.publication);
  set("coverage", filter.coverage);
  if (filter.staleEvidence) params.set("stale", "1");
  if (filter.sort !== "updated_desc") params.set("sort", filter.sort);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** How many narrowing filters are active (bucket excluded: it is navigation). */
export function activeFilterCount(filter: IdeaFilter): number {
  return [
    filter.decision,
    filter.severity,
    filter.sourceAge,
    filter.engineRunId,
    filter.category,
    filter.search,
    filter.publication,
    filter.coverage,
    filter.staleEvidence ? "stale" : null,
  ].filter((value) => value !== null && value !== "").length;
}
