import type { AuthProviderMaterializedConfig } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

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
 * Normalize every new auth-owned email before lookup and storage. WP21's
 * production inventory found no legacy users, so no email backfill is needed;
 * keeping the legacy field optional still preserves compatibility on rollout.
 */
export function normalizeAuthEmail(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
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

    return await ctx.db.insert("users", {
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

  return args.existingUserId;
}
