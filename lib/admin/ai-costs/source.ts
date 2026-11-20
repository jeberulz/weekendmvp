/**
 * WP93. The reads the console needs, whatever answers them (live Convex or
 * local fixtures). No `server-only` here so tests can build fakes.
 */

import type { ResolvedRange, RangeId } from "./ranges";
import type { ControlRoom, OwnerSummary, ProjectCost, TimelineRow, UsageRow } from "./types";

export type RangeRead = {
  readonly range: ResolvedRange;
  readonly rows: readonly UsageRow[];
  /** True when the row cap stopped the read before the range ended. */
  readonly truncated: boolean;
  /** Newest row read, when truncated: the range is complete only up to here. */
  readonly readUntilMs: number | null;
  readonly rowCap: number;
};

export type AiCostSource = {
  readonly mode: "fixture" | "live";
  readonly nowMs: number;
  readRange(id: RangeId): Promise<RangeRead>;
  ownerSummaries(ownerIds: readonly string[]): Promise<{ summaries: OwnerSummary[]; truncated: boolean }>;
  launchCosts(projectIds: readonly string[]): Promise<{ projects: ProjectCost[]; truncated: boolean }>;
  controlRoom(): Promise<ControlRoom>;
  timeline(ownerId: string | null, cursor: string | null): Promise<{ page: TimelineRow[]; isDone: boolean; continueCursor: string | null }>;
};


export type AiCostSourceReads = Omit<AiCostSource, "timeline">;
