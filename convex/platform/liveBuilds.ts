import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireCurrentPlatformUser } from "./authz";
import { getEntitlements } from "./entitlements";

/**
 * WP64-S8. The live builds hub for members. Read-only and clock-free: the
 * stored status decides what opens (see `liveBuildRules.ts`).
 *
 * Everyone signed in sees the schedule and the titles. The join link goes
 * only to Builder's Hub members while a session is open, the replay only
 * after it ends. Free members get flags (`hasJoinLink`, `hasReplay`) so the
 * page can offer the upgrade sheet instead. Canceled sessions are not listed.
 */

const UPCOMING_READ = 6;
const PAST_READ = 12;

const sessionValidator = v.object({
  id: v.id("live_builds"),
  title: v.string(),
  summary: v.string(),
  startsAt: v.number(),
  durationMin: v.number(),
  status: v.union(v.literal("scheduled"), v.literal("open"), v.literal("ended")),
  hasJoinLink: v.boolean(),
  hasReplay: v.boolean(),
  joinUrl: v.union(v.string(), v.null()),
  replayUrl: v.union(v.string(), v.null()),
});

function toSession(row: Doc<"live_builds">, entitled: boolean) {
  const status = row.status === "open" ? "open" : row.status === "ended" ? "ended" : "scheduled";
  const hasJoinLink = status === "open" && row.joinUrl !== undefined;
  const hasReplay = status === "ended" && row.replayUrl !== undefined;
  return {
    id: row._id,
    title: row.title,
    summary: row.summary,
    startsAt: row.startsAt,
    durationMin: row.durationMin,
    status,
    hasJoinLink,
    hasReplay,
    joinUrl: entitled && hasJoinLink ? (row.joinUrl ?? null) : null,
    replayUrl: entitled && hasReplay ? (row.replayUrl ?? null) : null,
  } as const;
}

export const list = query({
  args: {},
  returns: v.object({
    entitled: v.boolean(),
    upcoming: v.array(sessionValidator),
    past: v.array(sessionValidator),
  }),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const [{ limits }, open, scheduled, ended] = await Promise.all([
      getEntitlements(ctx, user._id),
      ctx.db
        .query("live_builds")
        .withIndex("by_status_and_startsAt", (q) => q.eq("status", "open"))
        .take(UPCOMING_READ),
      ctx.db
        .query("live_builds")
        .withIndex("by_status_and_startsAt", (q) => q.eq("status", "scheduled"))
        .take(UPCOMING_READ),
      ctx.db
        .query("live_builds")
        .withIndex("by_status_and_startsAt", (q) => q.eq("status", "ended"))
        .order("desc")
        .take(PAST_READ),
    ]);
    const entitled = limits.liveBuilds;
    return {
      entitled,
      upcoming: [...open, ...scheduled].slice(0, UPCOMING_READ).map((row) => toSession(row, entitled)),
      past: ended.map((row) => toSession(row, entitled)),
    };
  },
});
