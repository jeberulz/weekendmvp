import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { hasActiveSuperAdminBinding } from "../admin/superAdmin";
import { readMembershipState } from "../platform/membership/state";
import { requireCurrentPlatformUser, requireCurrentPlatformUserForMutation } from "../platform/authz";
import { drainAuth, OWNER_DRAINS, PROJECT_DRAINS } from "./purge";

/**
 * WP96: a signed-in founder deletes their own account and data.
 *
 * The request does the small, urgent part in one transaction (blocks sign-in,
 * removes the identity, writes the audit event). The rest runs in bounded
 * batches. Each batch deletes at most BATCH_BUDGET rows, then schedules the next.
 *
 * Kept on purpose: `ai_usage` and `ai_budgets` (the meter), financial and billing
 * rows, and `audit_events` with their `metadata` removed. The `users` row stays as
 * an empty shell, so those kept rows still point at something and totals do not move.
 * No schema change is needed: progress lives in the scheduled function's arguments.
 */

export const DELETE_CONFIRMATION = "DELETE";
const BATCH_BUDGET = 120;
const AUDIT_PAGE = 100;
const REQUEST_AUTH_ROWS = 25;

const blockerValidator = v.union(
  v.literal("super_admin"),
  v.literal("platform_owner"),
  v.literal("paid_subscription"),
);
export type DeletionBlocker = "super_admin" | "platform_owner" | "paid_subscription";

type ReadCtx = Pick<QueryCtx, "db">;

/** Accounts that must not be deleted by this path, and why. */
async function deletionBlockers(ctx: QueryCtx, user: Doc<"users">): Promise<DeletionBlocker[]> {
  const blockers: DeletionBlocker[] = [];
  // Seeds, spend settings and editorial records hang off the operator's account.
  if (await hasActiveSuperAdminBinding(ctx, user._id)) blockers.push("super_admin");
  if (user.platformOwnerAccess?.enabled === true) blockers.push("platform_owner");
  // Deleting here cannot cancel Stripe, so a plan that still renews must be cancelled first.
  // The membership module owns its tables, so ask it rather than reading them here.
  const { billing } = await readMembershipState(ctx, user._id);
  const subscribed = billing.term === "monthly" || billing.term === "annual";
  const live = billing.status === "active" || billing.status === "past_due";
  if (subscribed && live && billing.endsAt === null) blockers.push("paid_subscription");
  return blockers;
}

/** The deletion actions among the owner's most recent audit events. */
async function deletionActions(ctx: ReadCtx, ownerId: Id<"users">): Promise<{ requested: boolean; completed: boolean }> {
  const recent = await ctx.db.query("audit_events")
    .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", ownerId))
    .order("desc").take(50);
  return {
    requested: recent.some((event) => event.action === "account.deletion_requested"),
    completed: recent.some((event) => event.action === "account.deletion_completed"),
  };
}

async function deletionWasRequested(ctx: ReadCtx, ownerId: Id<"users">): Promise<boolean> {
  return (await deletionActions(ctx, ownerId)).requested;
}

/** What the settings screen shows before the member types anything. */
export const getDeletionState = query({
  args: {},
  returns: v.object({ blockers: v.array(blockerValidator), requested: v.boolean() }),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    return {
      blockers: await deletionBlockers(ctx, user),
      requested: user.accountClosureRequestedAt !== undefined && await deletionWasRequested(ctx, user._id),
    };
  },
});

async function removeEmailKeyedRows(ctx: MutationCtx, email: string | undefined): Promise<void> {
  if (email === undefined) return;
  const normalized = email.trim().toLowerCase();
  if (normalized === "") return;
  const rows = await ctx.db.query("subscriptions")
    .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", normalized)).take(10);
  for (const row of rows) await ctx.db.delete("subscriptions", row._id);
  const legacy = await ctx.db.query("subscriptions")
    .withIndex("by_email", (q) => q.eq("email", email)).take(10);
  for (const row of legacy) await ctx.db.delete("subscriptions", row._id);
  // Sign-in attempt counters are keyed by the address typed at sign-in.
  for (const identifier of new Set([email, normalized])) {
    const limits = await ctx.db.query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", identifier)).take(10);
    for (const row of limits) await ctx.db.delete("authRateLimits", row._id);
  }
}

/**
 * Starts deletion of the CALLER's account. The caller comes from the session,
 * never from an argument, so nobody can delete someone else.
 */
export const requestDeletion = mutation({
  args: { confirmation: v.string() },
  returns: v.object({ state: v.union(v.literal("started"), v.literal("already_requested")) }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUserForMutation(ctx);
    if (args.confirmation.trim() !== DELETE_CONFIRMATION) {
      throw new ConvexError({ code: "CONFIRMATION_MISMATCH" });
    }
    const blockers = await deletionBlockers(ctx, user);
    if (blockers.length > 0) throw new ConvexError({ code: "DELETION_BLOCKED", blockers });

    const now = Date.now();
    const already = user.accountClosureRequestedAt !== undefined && await deletionWasRequested(ctx, user._id);
    if (!already) {
      await ctx.db.insert("audit_events", {
        ownerId: user._id, actorType: "user", actorUserId: user._id,
        action: "account.deletion_requested", subjectType: "user", subjectId: user._id,
        createdAt: now,
      });
    }
    // Everything that identifies the founder goes now. The marker also stops new businesses.
    await removeEmailKeyedRows(ctx, user.email);
    await ctx.db.patch("users", user._id, {
      name: undefined, image: undefined, email: undefined, emailVerificationTime: undefined,
      phone: undefined, phoneVerificationTime: undefined, displayName: undefined,
      tokenIdentifier: undefined, signupSrc: undefined,
      accountClosureRequestedAt: user.accountClosureRequestedAt ?? now,
    });
    // Sign-in records next, so the account cannot be used again while the rest runs.
    await drainAuth(ctx, user._id, REQUEST_AUTH_ROWS);
    await ctx.scheduler.runAfter(0, internal.account.deletion.step, { ownerId: user._id, deletedRows: 0 });
    return { state: already ? "already_requested" as const : "started" as const };
  },
});

async function scheduleNext(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  deletedRows: number,
  auditCursor: string | null,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.account.deletion.step, {
    ownerId, deletedRows, auditCursor,
  });
}

/**
 * One bounded batch. Internal: an operator can also run it by hand to resume a
 * chain that stopped (`npx convex run account/deletion:step '{"ownerId":"..."}'`).
 */
export const step = internalMutation({
  args: {
    ownerId: v.id("users"),
    deletedRows: v.number(),
    auditCursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx, args) => {
    const { ownerId } = args;
    const user = await ctx.db.get("users", ownerId);
    // Only a requested, already-emptied account is ever purged. Anything else is a stray call.
    if (user === null || user.accountClosureRequestedAt === undefined || user.email !== undefined) {
      return { done: true };
    }
    const actions = await deletionActions(ctx, ownerId);
    if (!actions.requested || actions.completed) return { done: true };

    let budget = BATCH_BUDGET;
    let deleted = args.deletedRows;
    const spend = (rows: number) => { budget -= rows; deleted += rows; };

    // 1. Businesses, one at a time, children first.
    for (;;) {
      const project = (await ctx.db.query("projects")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).take(1))[0];
      if (project === undefined) break;
      for (const drain of PROJECT_DRAINS) {
        if (budget <= 0) break;
        const result = await drain(ctx, ownerId, project._id, budget);
        spend(result.deleted);
        if (!result.exhausted) { budget = 0; break; }
      }
      if (budget <= 0) {
        await scheduleNext(ctx, ownerId, deleted, args.auditCursor ?? null);
        return { done: false };
      }
      await ctx.db.delete("projects", project._id);
      spend(1);
    }

    // 2. Everything else the founder owns.
    for (const drain of OWNER_DRAINS) {
      if (budget <= 0) break;
      const result = await drain(ctx, ownerId, budget);
      spend(result.deleted);
      if (!result.exhausted) { budget = 0; break; }
    }
    if (budget <= 0) {
      await scheduleNext(ctx, ownerId, deleted, args.auditCursor ?? null);
      return { done: false };
    }

    // 3. Any sign-in rows the request did not reach.
    const auth = await drainAuth(ctx, ownerId, budget);
    spend(auth.deleted);
    if (!auth.exhausted || budget <= 0) {
      await scheduleNext(ctx, ownerId, deleted, args.auditCursor ?? null);
      return { done: false };
    }

    // 4. Audit rows stay. Only their free-form `metadata` goes.
    const page = await ctx.db.query("audit_events")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", ownerId))
      .paginate({ cursor: args.auditCursor ?? null, numItems: Math.min(budget, AUDIT_PAGE) });
    for (const event of page.page) {
      if (event.metadata !== undefined) {
        await ctx.db.patch("audit_events", event._id, { metadata: undefined });
        spend(1);
      }
    }
    if (!page.isDone) {
      await scheduleNext(ctx, ownerId, deleted, page.continueCursor);
      return { done: false };
    }

    await ctx.db.insert("audit_events", {
      ownerId, actorType: "system", action: "account.deletion_completed",
      subjectType: "user", subjectId: ownerId,
      metadata: JSON.stringify({ deletedRows: deleted }), createdAt: Date.now(),
    });
    return { done: true };
  },
});
