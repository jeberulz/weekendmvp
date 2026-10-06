import { normalizeEmail } from "./authEmail";
import type { AuthProviderMaterializedConfig } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

export const AUTH_ACCOUNT_COLLISION_MESSAGE =
  "Unable to use this sign-in method. Sign in with the method already connected to this email.";

export type CreateOrUpdateAuthUserArgs = {
  existingUserId: Id<"users"> | null;
  type: "oauth" | "credentials" | "email" | "phone" | "verification";
  provider: AuthProviderMaterializedConfig;
  profile: Record<string, unknown> & {
    email?: string;
    phone?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
  };
  shouldLink?: boolean;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/**
 * Google's OpenID claims as the profile Convex Auth hands to
 * `createOrUpdateAuthUser`. Convex Auth's default mapping drops Google's
 * `email_verified`, so a Google account never recorded a verified email and
 * could not be bound as the editorial super-admin (WP46). Google signs that
 * claim; only an explicit `true` counts. The account id stays `sub`, as before,
 * and accounts are still never linked across providers (see below).
 */
export function googleProfile(claims: Record<string, unknown>) {
  if (typeof claims.sub !== "string" || claims.sub === "") {
    throw new Error("Unable to complete sign-in.");
  }
  return {
    id: claims.sub,
    ...(typeof claims.name === "string" ? { name: claims.name } : {}),
    ...(typeof claims.email === "string" ? { email: claims.email } : {}),
    ...(typeof claims.picture === "string" ? { image: claims.picture } : {}),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
  };
}

/**
 * Normalize every new auth-owned email before lookup and storage. WP21's
 * production inventory found no legacy users, so no email backfill is needed;
 * keeping the legacy field optional still preserves compatibility on rollout.
 */
export function normalizeAuthEmail(value: string) {
  return normalizeEmail(value);
}

async function enqueueAccountBeehiiv(ctx: MutationCtx, userId: Id<"users">, email: string) {
  const existing = await ctx.db.query("account_beehiiv_sync")
    .withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  if (existing) return;
  await ctx.db.insert("account_beehiiv_sync", {
    userId, email, state: "pending", attempts: 0, updatedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.accountBeehiiv.sync, { userId });
}

/**
 * Convex Auth normally auto-links trusted methods that share an email. The
 * owner explicitly ruled that linking must require a future verified,
 * signed-in flow, so a new provider account may never claim an existing user.
 */
export async function createOrUpdateAuthUser(
  ctx: MutationCtx,
  args: CreateOrUpdateAuthUserArgs,
): Promise<Id<"users">> {
  // Email issuance proves only inbox reachability is being requested. It must
  // not reserve the email on a user or reveal whether another provider owns it.
  // The package reuses this placeholder through its canonical authAccount.
  if (args.type === "email") {
    if (args.existingUserId === null) {
      return await ctx.db.insert("users", {});
    }
    const existingPlaceholder = await ctx.db.get(
      "users",
      args.existingUserId,
    );
    if (existingPlaceholder === null) {
      throw new Error("Unable to complete sign-in.");
    }
    return args.existingUserId;
  }

  const email =
    typeof args.profile.email === "string"
      ? normalizeAuthEmail(args.profile.email)
      : undefined;
  const phone = optionalString(args.profile.phone);
  const name = optionalString(args.profile.name);
  const image = optionalString(args.profile.image);

  const emailOwner = email
    ? await ctx.db
        .query("users")
        .withIndex("email", (query) => query.eq("email", email))
        .unique()
    : null;

  if (args.existingUserId === null) {
    if (emailOwner !== null) {
      throw new Error(AUTH_ACCOUNT_COLLISION_MESSAGE);
    }

    const userId = await ctx.db.insert("users", {
      ...(email ? { email } : {}),
      ...(args.profile.emailVerified === true
        ? { emailVerificationTime: Date.now() }
        : {}),
      ...(phone ? { phone } : {}),
      ...(args.profile.phoneVerified === true
        ? { phoneVerificationTime: Date.now() }
        : {}),
      ...(name ? { name } : {}),
      ...(image ? { image } : {}),
    });
    if (email && args.profile.emailVerified === true) {
      await enqueueAccountBeehiiv(ctx, userId, email);
    }
    return userId;
  }

  if (emailOwner !== null && emailOwner._id !== args.existingUserId) {
    throw new Error(AUTH_ACCOUNT_COLLISION_MESSAGE);
  }

  const existingUser = await ctx.db.get("users", args.existingUserId);
  if (existingUser === null) {
    throw new Error("Unable to complete sign-in.");
  }

  await ctx.db.patch("users", args.existingUserId, {
    ...(email ? { email } : {}),
    ...(args.profile.emailVerified === true
      ? { emailVerificationTime: Date.now() }
      : {}),
    ...(phone ? { phone } : {}),
    ...(args.profile.phoneVerified === true
      ? { phoneVerificationTime: Date.now() }
      : {}),
    ...(name ? { name } : {}),
    ...(image ? { image } : {}),
  });

  if (email && args.profile.emailVerified === true && !existingUser.emailVerificationTime) {
    await enqueueAccountBeehiiv(ctx, args.existingUserId, email);
  }

  return args.existingUserId;
}
