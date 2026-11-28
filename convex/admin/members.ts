import { ConvexError, v } from "convex/values";
import { memberPages } from "../../lib/member-pages";
import { mutation, query } from "../_generated/server";
import { currentAccount, requireSuperAdmin } from "./superAdmin";

export const record = mutation({
  args: { key: v.string(), page: v.string(), focusedMs: v.number() },
  returns: v.null(),
  handler: async (ctx, { key, page, focusedMs }) => {
    const now = Date.now();
    const account = await currentAccount(ctx, now);
    if (!account || account.user.accountClosureRequestedAt !== undefined) throw new ConvexError({ code: "UNAUTHENTICATED" });
    if (!/^[a-f0-9-]{36}$/.test(key) || !memberPages.includes(page) || !Number.isSafeInteger(focusedMs) || focusedMs < 0) {
      throw new ConvexError("Invalid visit");
    }
    const ownerId = account.user._id;
    const row = await ctx.db.query("member_activity").withIndex("by_ownerId", q => q.eq("ownerId", ownerId)).unique();
    const recent = row?.recent ?? [];
    const visit = recent.find(item => item.key === key);
    if (!visit && focusedMs > 0) return null; // A delayed heartbeat for an evicted visit.
    if (visit && (visit.page !== page || focusedMs <= visit.focusedMs)) return null;
    const elapsed = visit ? Math.min(focusedMs, Math.max(0, now - visit.started)) : 0;
    const snapshot = {
      ownerId, lastSeen: now, views: (row?.views ?? 0) + (visit ? 0 : 1),
      focusedMs: (row?.focusedMs ?? 0) + elapsed - (visit?.focusedMs ?? 0),
      recent: visit ? recent.map(item => item.key === key ? { ...item, focusedMs: elapsed } : item)
        : [{ key, page, started: now, focusedMs: 0 }, ...recent].slice(0, 20),
    };
    if (row) await ctx.db.patch("member_activity", row._id, snapshot);
    else await ctx.db.insert("member_activity", snapshot);
    return null;
  },
});

export const directory = query({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    await requireSuperAdmin(ctx);
    const result = await ctx.db.query("users").order("desc").paginate({ cursor, numItems: 25 });
    const members = result.page.filter(user => !user.isAnonymous && user.accountClosureRequestedAt === undefined);
    const page = await Promise.all(members.map(async user => {
      const [accounts, activity, events] = await Promise.all([
        ctx.db.query("authAccounts").withIndex("userIdAndProvider", q => q.eq("userId", user._id)).take(8),
        ctx.db.query("member_activity").withIndex("by_ownerId", q => q.eq("ownerId", user._id)).unique(),
        ctx.db.query("audit_events").withIndex("by_ownerId_and_createdAt", q => q.eq("ownerId", user._id)).order("desc").take(8),
      ]);
      return {
        id: user._id, name: user.name ?? user.displayName, email: user.email, joined: user._creationTime,
        providers: [...new Set(accounts.map(a => a.provider))],
        lastSeen: activity?.lastSeen, views: activity?.views ?? 0, focusedMs: activity?.focusedMs ?? 0,
        recent: activity?.recent.map(({ page, started, focusedMs }) => ({ page, started, focusedMs })) ?? [],
        events: events.map(({ action, createdAt, actorType }) => ({ action, createdAt, actorType })),
      };
    }));
    return { page, next: result.isDone ? null : result.continueCursor };
  },
});

export const week = query({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    await requireSuperAdmin(ctx);
    const [users, active] = await Promise.all([
      ctx.db.query("users").withIndex("by_creation_time", q => q.gte("_creationTime", since)).order("desc").take(501),
      ctx.db.query("member_activity").withIndex("by_lastSeen", q => q.gte("lastSeen", since)).take(501),
    ]);
    const signedUp = users.filter(u => !u.isAnonymous && u.accountClosureRequestedAt === undefined).length;
    return { signups: signedUp, signupsLimited: users.length === 501, active: active.length, activeLimited: active.length === 501 };
  },
});

/**
 * Public aggregate counts for the owner dashboard. Aggregates only: no
 * identities, emails or rows leave the database, so this is callable with
 * the deployment's admin key as well as from the signed-in admin page.
 * Mirrors `week`: exact up to 500 inspected accounts, `totalLimited` marks
 * the 500+ lower bound. A denormalized counter (or the aggregate component)
 * is the follow-up if signups approach that bound.
 */
export const totals = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").order("desc").take(501);
    const total = users.filter(user => !user.isAnonymous && user.accountClosureRequestedAt === undefined).length;
    return { total, totalLimited: users.length === 501 };
  },
});
