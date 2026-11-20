import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";
import { rowsInDays } from "./aggregate";
import { buildRangeView } from "./view";
import { RANGE_EDGE_PADDING_MS, resolveRange, utcDayKeyOf, type RangeId } from "./ranges";
import type { AiCostSource } from "./source";
import type { UsageRow } from "./types";

/**
 * WP93. The AI cost console's data access layer. Every page resolves it; the
 * middleware gate in front of `/admin/*` is never the only check.
 *
 * - Development with `EDITORIAL_FIXTURE_MODE=local-demo` exactly (the switch
 *   the middleware already honours for the admin area): fictional fixtures.
 *   Compiled out of production builds (`NODE_ENV` is inlined).
 * - Otherwise: live Convex reads with the signed-in session's token. Every
 *   query checks `requireSuperAdmin`; any refusal or failure is a 404.
 */

/** `usagePage` calls per range: 20 × 1,000 rows. Past this the range is cut off and the UI says so. */
export const RANGE_PAGES_MAX = 20;
export const RANGE_PAGE_SIZE = 1_000;
/** Businesses whose full launch cost is read per range (25 per call). */
export const LAUNCH_PROJECTS_MAX = 200;
/** Founders summarised per range (25 per call). */
export const OWNERS_MAX = 250;
const IDS_PER_CALL = 25;
export const TIMELINE_PAGE_SIZE = 100;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function liveSource(token: string, nowMs: number): AiCostSource {
  const dayKey = utcDayKeyOf(nowMs);
  return {
    mode: "live",
    nowMs,
    async readRange(id) {
      const range = resolveRange(id, nowMs);
      const startMs = range.startMs - RANGE_EDGE_PADDING_MS;
      const endMs = Math.min(range.endMs, nowMs + RANGE_EDGE_PADDING_MS);
      const rows: UsageRow[] = [];
      let cursor: string | null = null;
      let done = false;
      for (let page = 0; page < RANGE_PAGES_MAX && !done; page += 1) {
        const result: { page: UsageRow[]; isDone: boolean; continueCursor: string } = await fetchQuery(
          api.admin.aiCosts.usagePage,
          { startMs, endMs, paginationOpts: { numItems: RANGE_PAGE_SIZE, cursor } },
          { token },
        );
        rows.push(...result.page);
        cursor = result.continueCursor;
        done = result.isDone;
      }
      return {
        range,
        rows: rowsInDays(rows, range.dayKeys),
        truncated: !done,
        readUntilMs: done ? null : rows.at(-1)?.createdAt ?? null,
        rowCap: RANGE_PAGES_MAX * RANGE_PAGE_SIZE,
      };
    },
    async ownerSummaries(ownerIds) {
      const kept = ownerIds.slice(0, OWNERS_MAX);
      const batches = await Promise.all(chunks(kept, IDS_PER_CALL).map((ids) =>
        fetchQuery(api.admin.aiCosts.ownerSummaries, { ownerIds: ids as Id<"users">[], dayKey }, { token })));
      return { summaries: batches.flat(), truncated: ownerIds.length > kept.length };
    },
    async launchCosts(projectIds) {
      const kept = projectIds.slice(0, LAUNCH_PROJECTS_MAX);
      const batches = await Promise.all(chunks(kept, IDS_PER_CALL).map((ids) =>
        fetchQuery(api.admin.aiCosts.launchCosts, { projectIds: ids as Id<"projects">[] }, { token })));
      return { projects: batches.flat(), truncated: projectIds.length > kept.length };
    },
    async controlRoom() {
      return await fetchQuery(api.admin.aiCosts.controlRoom, { dayKey }, { token });
    },
    async timeline(ownerId, cursor) {
      const result = await fetchQuery(
        api.admin.aiCosts.ownerTimeline,
        { ownerId: ownerId as Id<"users"> | null, paginationOpts: { numItems: TIMELINE_PAGE_SIZE, cursor } },
        { token },
      );
      return { page: result.page, isDone: result.isDone, continueCursor: result.isDone ? null : result.continueCursor };
    },
  };
}

async function fixtureSource(nowMs: number): Promise<AiCostSource> {
  const { fixtureData, fixtureTimeline } = await import("./fixtures");
  const data = fixtureData(nowMs);
  return {
    mode: "fixture",
    nowMs,
    async readRange(id) {
      const range = resolveRange(id, nowMs);
      return { range, rows: rowsInDays(data.rows, range.dayKeys), truncated: false, readUntilMs: null, rowCap: RANGE_PAGES_MAX * RANGE_PAGE_SIZE };
    },
    async ownerSummaries(ownerIds) {
      const wanted = new Set(ownerIds);
      return { summaries: data.summaries.filter((summary) => wanted.has(summary.ownerId)), truncated: false };
    },
    async launchCosts(projectIds) {
      const wanted = new Set(projectIds);
      return { projects: data.projects.filter((project) => wanted.has(project.projectId)), truncated: false };
    },
    async controlRoom() {
      return data.controlRoom;
    },
    async timeline(ownerId, cursor) {
      const all = fixtureTimeline(data, ownerId);
      const start = cursor === null ? 0 : Number(cursor);
      const page = all.slice(start, start + TIMELINE_PAGE_SIZE);
      const next = start + page.length;
      return { page, isDone: next >= all.length, continueCursor: next >= all.length ? null : String(next) };
    },
  };
}

async function resolveSource(): Promise<AiCostSource | null> {
  const nowMs = Date.now();
  if (process.env.NODE_ENV !== "production" && process.env.EDITORIAL_FIXTURE_MODE === "local-demo") {
    return await fixtureSource(nowMs);
  }
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) return null;
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  const source = liveSource(token, nowMs);
  try {
    // A cheap super-admin read: anyone the backend cannot vouch for stops here.
    await source.controlRoom();
  } catch {
    // FORBIDDEN, an expired session or an unreachable backend: all refusals.
    return null;
  }
  return source;
}

/** Request-time only, deduplicated per request. A refusal is indistinguishable from a missing page. */
export const requireAiCostSource = cache(async (): Promise<AiCostSource> => {
  await connection();
  const source = await resolveSource();
  if (source === null) notFound();
  return source;
});

/** Everything the range-based screens show, computed once per request and range. */
export const loadRangeView = cache(async (rangeId: RangeId) => {
  const source = await requireAiCostSource();
  return await buildRangeView(source, rangeId);
});
