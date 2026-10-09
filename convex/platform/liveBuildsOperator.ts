import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  MAX_DURATION_MIN,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DURATION_MIN,
  endOf,
  joinOpensAt,
  liveBuildStatusValidator,
  liveStatusAt,
  readHttpsUrl,
} from "./liveBuildRules";

/**
 * WP64-S8. Operator-only writes for live builds. Internal, so only a deploy
 * key reaches them (`npx convex run`, see `docs/runbooks/wp64-live-builds.md`).
 * There is no admin UI. They return ids and statuses, never a link.
 *
 * Each write schedules `advance` for the moment the join link opens and the
 * moment the session ends. `advance` recomputes the status from the row, so
 * a job left over from an earlier time does nothing.
 */

function text(value: string, max: number, code: string, allowEmpty = false): string {
  const trimmed = value.trim();
  if ((!allowEmpty && trimmed.length === 0) || trimmed.length > max) throw new ConvexError({ code });
  return trimmed;
}

function timing(startsAt: number, durationMin: number, now: number) {
  if (!Number.isSafeInteger(startsAt) || startsAt <= now) throw new ConvexError({ code: "INVALID_START" });
  if (!Number.isInteger(durationMin) || durationMin < MIN_DURATION_MIN || durationMin > MAX_DURATION_MIN) {
    throw new ConvexError({ code: "INVALID_DURATION" });
  }
}

function link(value: string): string {
  const url = readHttpsUrl(value);
  if (url === null) throw new ConvexError({ code: "INVALID_LINK" });
  return url;
}

async function scheduleFlips(ctx: MutationCtx, id: Id<"live_builds">, session: { startsAt: number; durationMin: number }, now: number) {
  for (const at of [joinOpensAt(session), endOf(session)]) {
    if (at > now) await ctx.scheduler.runAt(at, internal.platform.liveBuildsOperator.advance, { id });
  }
}

async function editable(ctx: MutationCtx, id: Id<"live_builds">): Promise<Doc<"live_builds">> {
  const row = await ctx.db.get("live_builds", id);
  if (row === null) throw new ConvexError({ code: "LIVE_BUILD_NOT_FOUND" });
  if (row.status === "canceled") throw new ConvexError({ code: "LIVE_BUILD_CANCELED" });
  return row;
}

const result = v.object({ id: v.id("live_builds"), status: liveBuildStatusValidator });

export const create = internalMutation({
  args: {
    title: v.string(),
    summary: v.string(),
    startsAt: v.number(),
    durationMin: v.number(),
    joinUrl: v.optional(v.string()),
  },
  returns: result,
  handler: async (ctx, args) => {
    const now = Date.now();
    timing(args.startsAt, args.durationMin, now);
    const session = { startsAt: args.startsAt, durationMin: args.durationMin };
    const status = liveStatusAt(session, now);
    const id = await ctx.db.insert("live_builds", {
      title: text(args.title, MAX_TITLE_LENGTH, "INVALID_TITLE"),
      summary: text(args.summary, MAX_SUMMARY_LENGTH, "INVALID_SUMMARY", true),
      ...session,
      status,
      ...(args.joinUrl === undefined ? {} : { joinUrl: link(args.joinUrl) }),
      createdAt: now,
      updatedAt: now,
    });
    await scheduleFlips(ctx, id, session, now);
    return { id, status };
  },
});

/** Change the details or move the time. A new time must be in the future. `joinUrl: null` clears the link. */
export const update = internalMutation({
  args: {
    id: v.id("live_builds"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    durationMin: v.optional(v.number()),
    joinUrl: v.optional(v.union(v.string(), v.null())),
  },
  returns: result,
  handler: async (ctx, args) => {
    const now = Date.now();
    const row = await editable(ctx, args.id);
    const moved = args.startsAt !== undefined || args.durationMin !== undefined;
    const session = { startsAt: args.startsAt ?? row.startsAt, durationMin: args.durationMin ?? row.durationMin };
    if (moved) timing(session.startsAt, session.durationMin, now);
    const status = liveStatusAt({ ...session, status: row.status }, now);
    await ctx.db.patch("live_builds", args.id, {
      ...(args.title === undefined ? {} : { title: text(args.title, MAX_TITLE_LENGTH, "INVALID_TITLE") }),
      ...(args.summary === undefined ? {} : { summary: text(args.summary, MAX_SUMMARY_LENGTH, "INVALID_SUMMARY", true) }),
      ...session,
      status,
      ...(args.joinUrl === undefined ? {} : { joinUrl: args.joinUrl === null ? undefined : link(args.joinUrl) }),
      updatedAt: now,
    });
    if (moved) await scheduleFlips(ctx, args.id, session, now);
    return { id: args.id, status };
  },
});

/** Add or clear the replay. It shows only after the session ends. Replays need captions or a transcript (O8). */
export const setReplay = internalMutation({
  args: { id: v.id("live_builds"), replayUrl: v.union(v.string(), v.null()) },
  returns: result,
  handler: async (ctx, args) => {
    const row = await editable(ctx, args.id);
    await ctx.db.patch("live_builds", args.id, {
      replayUrl: args.replayUrl === null ? undefined : link(args.replayUrl),
      updatedAt: Date.now(),
    });
    return { id: args.id, status: row.status };
  },
});

/** Hides the session from members. Announce the make-up session or the extension separately (S9). */
export const cancel = internalMutation({
  args: { id: v.id("live_builds") },
  returns: result,
  handler: async (ctx, args) => {
    await editable(ctx, args.id);
    await ctx.db.patch("live_builds", args.id, { status: "canceled", updatedAt: Date.now() });
    return { id: args.id, status: "canceled" as const };
  },
});

/** Scheduled by the writes above. Recomputes the status from the row and the server clock. */
export const advance = internalMutation({
  args: { id: v.id("live_builds") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("live_builds", args.id);
    if (row === null) return null;
    const next = liveStatusAt(row, Date.now());
    if (next !== row.status) await ctx.db.patch("live_builds", args.id, { status: next, updatedAt: Date.now() });
    return null;
  },
});
