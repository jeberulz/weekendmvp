import type { HomeData, IndexRow, SpotlightIdea } from "@/lib/home/types";

export const DASHBOARD_NEWEST_COUNT = 5;

/** The editorial half of the dashboard Home. Personal data comes from Convex. */
export type DashboardEditorial = {
  /** Live ideas in the library, the same number the homepage shows. */
  total: number;
  week: HomeData["week"];
  /** Idea of the week: the homepage's section 03 pick. */
  weekly: SpotlightIdea;
  /** Newest live ideas, the head of the homepage Index. */
  newest: IndexRow[];
};

export function toDashboardEditorial(data: HomeData): DashboardEditorial {
  return {
    total: data.totals.ideas,
    week: data.week,
    weekly: data.spotlight,
    newest: data.newest.slice(0, DASHBOARD_NEWEST_COUNT),
  };
}
