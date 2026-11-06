/**
 * Idea requests & voting (Idea 4).
 *
 * Public, purely additive backend for "request a research topic, vote for
 * the ones you want". Visitors submit a short title + one-line problem and
 * vote for requests; the public list is sorted by votes, then newest.
 *
 * What this file deliberately does NOT do:
 * - It does not touch the idea engine. `listForSuggest` only exposes the
 *   top requests in the shape Stage-0 Suggest can read later; wiring it
 *   into `docs/plans/idea-engine/PIPELINE.md` (Suggest dedupe, Brief,
 *   Research, Source Critic, compile, release) is a separate, operator-led
 *   next step. No request here ever becomes a published idea on its own.
 * - It does not touch crew, publishing, leads, tenant email, checkout or
 *   credits, and it does not send email.
 * - It stores no raw IP or email. A signed-in voter is `user:<subject>`
 *   from the Convex Auth identity; an anonymous voter is `anon:<id>` where
 *   `<id>` is a random id generated in the visitor's own browser
 *   (`lib/idea-requests.getOrCreateAnonymousId`). That id is self-asserted,
 *   so the one-vote-per-voter rule is a lightweight anti-stuffing control,
 *   not fraud-proof — the per-hour rate limits below are the other half.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  anonymousVoterKey,
  compareIdeaRequests,
  isValidAnonymousId,
  normalizeRequestTitle,
  signedInVoterKey,
  validateIdeaRequest,
} from "../lib/idea-requests";

/** Submissions per voter per hour — fail-closed, before any write. */
const MAX_SUBMITS_PER_HOUR = 3;
/** Votes per voter per hour — generous, but it caps a stuffing script. */
const MAX_VOTES_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;
/** The public list is small by design; never scan past this many rows. */
const LIST_SCAN_CAP = 200;

const publicRequestDoc = v.object({
  id: v.id("idea_requests"),
  title: v.string(),
  problem: v.string(),
  category: v.optional(v.string()),
  voteCount: v.number(),
  hasVoted: v.boolean(),
  createdAt: v.number(),
});

function listLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIST_LIMIT;
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.min(Math.trunc(limit), MAX_LIST_LIMIT));
}

/**
 * Resolve the caller's voter key. Signed-in identity wins over any
 * client-supplied anonymous id, so a signed-in visitor cannot vote twice
 * by also presenting an anonymous id.
 */
async function resolveVoterKey(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } },
  anonymousId: string | undefined,
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) return signedInVoterKey(identity.subject);
  if (isValidAnonymousId(anonymousId)) return anonymousVoterKey(anonymousId);
  return null;
}

async function recentSubmits(ctx: MutationCtx, voterKey: string, sinceMs: number): Promise<number> {
  const rows = await ctx.db
    .query("idea_requests")
    .withIndex("by_submitterKey", (q) => q.eq("submitterKey", voterKey))
    .take(40);
  return rows.filter((row) => row._creationTime >= sinceMs).length;
}

async function recentVotes(ctx: MutationCtx, voterKey: string, sinceMs: number): Promise<number> {
  const rows = await ctx.db
    .query("idea_request_votes")
    .withIndex("by_voterKey", (q) => q.eq("voterKey", voterKey))
    .take(40);
  return rows.filter((row) => row._creationTime >= sinceMs).length;
}

function toPublicRequest(
  row: Doc<"idea_requests">,
  hasVoted: boolean,
): {
  id: Id<"idea_requests">;
  title: string;
  problem: string;
  category: string | undefined;
  voteCount: number;
  hasVoted: boolean;
  createdAt: number;
} {
  return {
    id: row._id,
    title: row.title,
    problem: row.problem,
    category: row.category,
    voteCount: row.voteCount,
    hasVoted,
    createdAt: row._creationTime,
  };
}

/**
 * Top open requests, most votes first, newest first on ties. `hasVoted`
 * reflects the caller's voter key when one can be resolved, and is false
 * for an unidentified visitor.
 */
export const listTop = query({
  args: {
    limit: v.optional(v.number()),
    anonymousId: v.optional(v.string()),
  },
  returns: v.array(publicRequestDoc),
  handler: async (ctx, { limit, anonymousId }) => {
    const cap = listLimit(limit);
    if (cap === 0) return [];
    const voterKey = await resolveVoterKey(ctx, anonymousId);
    const rows = await ctx.db
      .query("idea_requests")
      .withIndex("by_status_voteCount", (q) => q.eq("status", "open"))
      .order("desc")
      .take(LIST_SCAN_CAP);
    const sorted = [...rows].sort((a, b) =>
      compareIdeaRequests(
        { voteCount: a.voteCount, createdAt: a._creationTime },
        { voteCount: b.voteCount, createdAt: b._creationTime },
      ),
    );
    const top = sorted.slice(0, cap);
    if (!voterKey) return top.map((row) => toPublicRequest(row, false));
    const voted = await Promise.all(
      top.map((row) =>
        ctx.db
          .query("idea_request_votes")
          .withIndex("by_requestId_and_voterKey", (q) =>
            q.eq("requestId", row._id).eq("voterKey", voterKey),
          )
          .unique(),
      ),
    );
    return top.map((row, i) => toPublicRequest(row, voted[i] !== null));
  },
});

/**
 * Stage-0 Suggest read shape — the engine's Suggest step can read the
 * most-voted open requests from here later. This query does not write
 * anything and is not called by the engine today; see the file header.
 */
export const listForSuggest = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      requestId: v.id("idea_requests"),
      title: v.string(),
      normalizedTitle: v.string(),
      problem: v.string(),
      category: v.optional(v.string()),
      voteCount: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { limit }) => {
    const cap = listLimit(limit);
    if (cap === 0) return [];
    const rows = await ctx.db
      .query("idea_requests")
      .withIndex("by_status_voteCount", (q) => q.eq("status", "open"))
      .order("desc")
      .take(LIST_SCAN_CAP);
    return [...rows]
      .sort((a, b) =>
        compareIdeaRequests(
          { voteCount: a.voteCount, createdAt: a._creationTime },
          { voteCount: b.voteCount, createdAt: b._creationTime },
        ),
      )
      .slice(0, cap)
      .map((row) => ({
        requestId: row._id,
        title: row.title,
        normalizedTitle: row.normalizedTitle,
        problem: row.problem,
        category: row.category,
        voteCount: row.voteCount,
        createdAt: row._creationTime,
      }));
  },
});

/**
 * Submit a request. An identical open request (same normalised title)
 * dedupes: the existing request is returned instead of a duplicate row.
 * Anonymous visitors must present their stored anonymous id; a missing or
 * malformed id is rejected rather than silently treated as a new voter.
 */
export const submit = mutation({
  args: {
    title: v.string(),
    problem: v.string(),
    category: v.optional(v.string()),
    anonymousId: v.optional(v.string()),
  },
  returns: v.object({
    requestId: v.id("idea_requests"),
    deduped: v.boolean(),
    voteCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const validated = validateIdeaRequest({
      title: args.title,
      problem: args.problem,
      category: args.category,
    });
    if (!validated.ok) {
      throw new ConvexError(`VALIDATION: ${validated.errors.join(" ")}`);
    }
    const voterKey = await resolveVoterKey(ctx, args.anonymousId);
    if (!voterKey) {
      throw new ConvexError("UNAUTHENTICATED: sign in or enable local storage to submit a request.");
    }
    const normalizedTitle = normalizeRequestTitle(validated.title);
    const existing = await ctx.db
      .query("idea_requests")
      .withIndex("by_normalizedTitle", (q) => q.eq("normalizedTitle", normalizedTitle))
      .first();
    if (existing && (existing.status === "open" || existing.status === "in_research")) {
      return { requestId: existing._id, deduped: true, voteCount: existing.voteCount };
    }
    const since = Date.now() - HOUR_MS;
    if ((await recentSubmits(ctx, voterKey, since)) >= MAX_SUBMITS_PER_HOUR) {
      throw new ConvexError("RATE_LIMITED: too many requests submitted — try again in an hour.");
    }
    const requestId = await ctx.db.insert("idea_requests", {
      title: validated.title,
      normalizedTitle,
      problem: validated.problem,
      category: validated.category ?? undefined,
      submitterKey: voterKey,
      voteCount: 0,
      status: "open",
    });
    return { requestId, deduped: false, voteCount: 0 };
  },
});

/**
 * Toggle one vote for one request. Exactly one vote row per
 * (request, voter) is enforced by the `by_requestId_and_voterKey` lookup
 * below plus the denormalised `voteCount` update in the same mutation.
 */
export const toggleVote = mutation({
  args: {
    requestId: v.id("idea_requests"),
    anonymousId: v.optional(v.string()),
  },
  returns: v.object({
    voted: v.boolean(),
    voteCount: v.number(),
  }),
  handler: async (ctx, { requestId, anonymousId }) => {
    const voterKey = await resolveVoterKey(ctx, anonymousId);
    if (!voterKey) {
      throw new ConvexError("UNAUTHENTICATED: sign in or enable local storage to vote.");
    }
    const request = await ctx.db.get("idea_requests", requestId);
    if (!request) throw new ConvexError("NOT_FOUND: that request no longer exists.");
    if (request.status !== "open" && request.status !== "in_research") {
      throw new ConvexError("CLOSED: voting is closed for this request.");
    }
    const existing = await ctx.db
      .query("idea_request_votes")
      .withIndex("by_requestId_and_voterKey", (q) =>
        q.eq("requestId", requestId).eq("voterKey", voterKey),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const voteCount = Math.max(0, request.voteCount - 1);
      await ctx.db.patch(requestId, { voteCount });
      return { voted: false, voteCount };
    }
    const since = Date.now() - HOUR_MS;
    if ((await recentVotes(ctx, voterKey, since)) >= MAX_VOTES_PER_HOUR) {
      throw new ConvexError("RATE_LIMITED: too many votes — try again in an hour.");
    }
    await ctx.db.insert("idea_request_votes", { requestId, voterKey });
    const voteCount = request.voteCount + 1;
    await ctx.db.patch(requestId, { voteCount });
    return { voted: true, voteCount };
  },
});
