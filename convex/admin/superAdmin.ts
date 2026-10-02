import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { env, internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { normalizeEmail } from "../authEmail";
import { appendEditorialAudit } from "../editorial/audit";

/**
 * WP46-E4a: the editorial subset of WP38 (owner ruling 2026-08-06) — one
 * server-verified `super_admin`, bootstrapped from deployment configuration
 * and bound to its Convex Auth user ID.
 *
 * - Authorization reads the binding for the current session's user ID. It
 *   never compares emails and never takes a user, role or capability from
 *   the caller.
 * - Only the internal mutations below write `super_admins`. An operator runs
 *   them with deployment credentials (`npx convex run`); no client can.
 * - Revocation keeps the row: the history stays, the capability ends.
 */

type ReadCtx = Pick<QueryCtx, "auth" | "db">;

export type Account = {
  user: Doc<"users">;
  session: Doc<"authSessions">;
  /** The active super-admin binding, if this account holds one. */
  binding: Doc<"super_admins"> | null;
};

/** Bootstrap keeps this at one; anything past the bound is investigated, not truncated. */
const MAX_ACTIVE_BINDINGS = 10;

async function activeBindingFor(ctx: ReadCtx, userId: Id<"users">): Promise<Doc<"super_admins"> | null> {
  return await ctx.db
    .query("super_admins")
    .withIndex("by_userId_and_revokedAt", (q) => q.eq("userId", userId).eq("revokedAt", undefined))
    .first();
}

async function activeBindings(ctx: ReadCtx): Promise<Doc<"super_admins">[]> {
  const rows = await ctx.db
    .query("super_admins")
    .withIndex("by_role_and_revokedAt", (q) => q.eq("role", "super_admin").eq("revokedAt", undefined))
    .take(MAX_ACTIVE_BINDINGS + 1);
  if (rows.length > MAX_ACTIVE_BINDINGS) {
    throw new ConvexError({ code: "INVARIANT", message: "Too many active super-admin bindings; investigate before changing them." });
  }
  return rows;
}

/** Revocation is the emergency control, so it never stops at the bound above. Run it again if it ends this many. */
const REVOKE_BATCH = 1_000;

async function activeBindingsToRevoke(ctx: ReadCtx): Promise<Doc<"super_admins">[]> {
  return await ctx.db
    .query("super_admins")
    .withIndex("by_role_and_revokedAt", (q) => q.eq("role", "super_admin").eq("revokedAt", undefined))
    .take(REVOKE_BATCH);
}

/**
 * The signed-in account behind this request, from the verified token and
 * the stored session, or `null`. Pass `now` (mutations only) to also enforce
 * the session's stored expiry; queries must not read the clock.
 */
export async function currentAccount(ctx: ReadCtx, now?: number): Promise<Account | null> {
  const [rawUserId, rawSessionId] = await Promise.all([getAuthUserId(ctx), getAuthSessionId(ctx)]);
  const userId = rawUserId ? ctx.db.normalizeId("users", rawUserId) : null;
  const sessionId = rawSessionId ? ctx.db.normalizeId("authSessions", rawSessionId) : null;
  if (userId === null || sessionId === null) return null;
  const [user, session] = await Promise.all([ctx.db.get("users", userId), ctx.db.get("authSessions", sessionId)]);
  if (user === null || user.isAnonymous === true || session === null || session.userId !== userId) return null;
  if (now !== undefined && session.expirationTime <= now) return null;
  return { user, session, binding: await activeBindingFor(ctx, userId) };
}

/** WP38's narrow helper for admin modules: the bound super-admin, or one generic refusal. */
export async function requireSuperAdmin(
  ctx: ReadCtx,
  now?: number,
): Promise<Account & { binding: Doc<"super_admins"> }> {
  const account = await currentAccount(ctx, now);
  if (account === null || account.binding === null) throw new ConvexError({ code: "FORBIDDEN" });
  return { ...account, binding: account.binding };
}

/* Operator functions (internal) ---------------------------------------------- */

const OPERATOR = { id: "deployment-operator", kind: "system" as const, label: "Deployment operator (bootstrap)" };

const refusalReason = v.union(
  v.literal("not_configured"),
  v.literal("no_verified_account"),
  v.literal("ambiguous_account"),
  v.literal("another_account_bound"),
);

const REFUSAL_DETAIL = {
  not_configured: "Bootstrap refused: no owner email is configured for this deployment.",
  no_verified_account: "Bootstrap refused: no verified, signed-in account uses the configured email yet.",
  ambiguous_account: "Bootstrap refused: more than one account matches the configured email.",
  another_account_bound: "Bootstrap refused: another account already holds the capability. Revoke it first.",
} as const;

/**
 * Bind the super-admin capability to the verified account whose email is
 * configured in `SUPER_ADMIN_BOOTSTRAP_EMAIL`. Idempotent. Refusals are
 * returned (and recorded), never silently ignored; nothing echoes the email.
 *
 *   npx convex env set SUPER_ADMIN_BOOTSTRAP_EMAIL <owner email>
 *   npx convex run admin/superAdmin:bootstrapOwner
 */
export const bootstrapOwner = internalMutation({
  args: {},
  returns: v.union(
    v.object({ outcome: v.literal("bound"), boundAt: v.number() }),
    v.object({ outcome: v.literal("already_bound"), boundAt: v.number() }),
    v.object({ outcome: v.literal("refused"), reason: refusalReason }),
  ),
  handler: async (ctx) => {
    const now = Date.now();
    const refuse = async (reason: keyof typeof REFUSAL_DETAIL) => {
      await appendEditorialAudit(
        ctx,
        {
          actor: OPERATOR,
          action: "settings.changed",
          outcome: "failed",
          ideaId: null,
          revisionId: null,
          revisionNumber: null,
          releaseId: null,
          reason: null,
          detail: REFUSAL_DETAIL[reason],
          code: reason.toUpperCase(),
        },
        now,
      );
      return { outcome: "refused" as const, reason };
    };

    const configured = env.SUPER_ADMIN_BOOTSTRAP_EMAIL?.trim() ?? "";
    if (!configured.includes("@")) return refuse("not_configured");
    const email = normalizeEmail(configured);

    const matches = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .take(2);
    if (matches.length > 1) return refuse("ambiguous_account");
    const user = matches[0];
    if (!user || user.isAnonymous === true || user.emailVerificationTime === undefined) {
      return refuse("no_verified_account");
    }
    // A real sign-in created this account: it has at least one provider account.
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .first();
    if (account === null) return refuse("no_verified_account");

    const active = await activeBindings(ctx);
    const existing = active.find((binding) => binding.userId === user._id);
    if (existing) return { outcome: "already_bound" as const, boundAt: existing.boundAt };
    if (active.length > 0) return refuse("another_account_bound");

    await ctx.db.insert("super_admins", {
      userId: user._id,
      role: "super_admin",
      boundAt: now,
      boundVia: "deployment_bootstrap",
    });
    await appendEditorialAudit(
      ctx,
      {
        actor: OPERATOR,
        action: "settings.changed",
        outcome: "succeeded",
        ideaId: null,
        revisionId: null,
        revisionNumber: null,
        releaseId: null,
        reason: null,
        detail: "Super-admin capability bound to the account configured for this deployment.",
        code: null,
      },
      now,
    );
    return { outcome: "bound" as const, boundAt: now };
  },
});

/**
 * End every active binding. The rows stay as history; the editorial
 * workspace closes for the account at its next request.
 *
 *   npx convex run admin/superAdmin:revokeSuperAdmin '{"reason":"…"}'
 */
export const revokeSuperAdmin = internalMutation({
  args: { reason: v.string() },
  returns: v.object({ revoked: v.number() }),
  handler: async (ctx, args) => {
    const reason = args.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Give a reason of 3 to 500 characters." });
    }
    const now = Date.now();
    const active = await activeBindingsToRevoke(ctx);
    for (const binding of active) {
      await ctx.db.patch("super_admins", binding._id, { revokedAt: now, revokedReason: reason });
    }
    await appendEditorialAudit(
      ctx,
      {
        actor: OPERATOR,
        action: "settings.changed",
        outcome: "succeeded",
        ideaId: null,
        revisionId: null,
        revisionNumber: null,
        releaseId: null,
        reason,
        detail: `Super-admin capability revoked (${active.length} active binding${active.length === 1 ? "" : "s"}).`,
        code: null,
      },
      now,
    );
    return { revoked: active.length };
  },
});

/** Runbook check: is bootstrap configured, and is the capability bound? No emails or IDs. */
export const bindingStatus = internalQuery({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    activeBindings: v.number(),
    boundAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const active = await activeBindings(ctx);
    return {
      configured: (env.SUPER_ADMIN_BOOTSTRAP_EMAIL?.trim() ?? "").includes("@"),
      activeBindings: active.length,
      boundAt: active[0]?.boundAt ?? null,
    };
  },
});
