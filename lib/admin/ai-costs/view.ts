/**
 * WP93. Builds the console's view model for one range from a data source.
 * Pure apart from the source's reads, so tests drive it with fixtures.
 */

import {
  byModelTier,
  byPrompt,
  efficiency,
  founderRows,
  overview,
  unitEconomics,
} from "./aggregate";
import type { RangeId } from "./ranges";
import type { AiCostSourceReads } from "./source";
import { standardPrice, whatIf } from "./whatif";

export async function buildRangeView(source: AiCostSourceReads, rangeId: RangeId) {
  const read = await source.readRange(rangeId);
  const { rows, range } = read;
  // Biggest spenders first, so a capped summary read keeps the founders that matter most.
  const ownerIds = founderRows(rows, []).map((row) => row.ownerId).filter((id): id is string => id !== null);
  const projectIds = [...new Set(rows.filter((row) => row.ownerId !== null).map((row) => row.projectId)
    .filter((id): id is string => id !== null))];
  const [owners, launches, control] = await Promise.all([
    source.ownerSummaries(ownerIds),
    source.launchCosts(projectIds),
    source.controlRoom(),
  ]);
  return {
    mode: source.mode,
    nowMs: source.nowMs,
    range,
    truncated: read.truncated,
    readUntilMs: read.readUntilMs,
    rowCap: read.rowCap,
    ownersTruncated: owners.truncated,
    launchesTruncated: launches.truncated,
    control,
    overview: overview(rows, range.dayKeys),
    unit: unitEconomics(rows, launches.projects, range.startMs, range.endMs),
    prompts: byPrompt(rows),
    models: byModelTier(rows),
    efficiency: efficiency(rows, range.days, standardPrice),
    whatIf: whatIf(rows),
    founders: founderRows(rows, owners.summaries),
  };
}

export type RangeView = Awaited<ReturnType<typeof buildRangeView>>;
