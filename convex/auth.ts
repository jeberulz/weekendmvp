import Google from "@auth/core/providers/google";
import { convexAuth, type Tokens } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { createOrUpdateAuthUser } from "./authUser";
import {
  emailMagicLinkProvider,
  normalizeMagicLinkEmail,
} from "./resendMagicLink";
import { validatedSiteOrigin } from "./siteUrl";

export function safeAuthRedirect(redirectTo: string) {
  try {
    const target = new URL(redirectTo, "https://auth.weekendmvp.invalid");
    if (
      target.origin === "https://auth.weekendmvp.invalid" &&
      (target.pathname === "/dashboard" ||
        target.pathname.startsWith("/dashboard/"))
    ) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // Fall through to the only currently approved private destination.
  }
  return "/dashboard";
}

export function absoluteAuthRedirect(redirectTo: string, siteUrl: string) {
  return new URL(
    safeAuthRedirect(redirectTo),
    validatedSiteOrigin(siteUrl),
  ).toString();
}

type SignInArgs = {
  provider?: string;
  params?: unknown;
  verifier?: string;
  refreshToken?: string;
  calledBy?: string;
};

function isParameterRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize both `signIn("email")` and provider-less email redemption. */
export function normalizeEmailSignInArgs(args: SignInArgs): SignInArgs {
  if (!isParameterRecord(args.params)) return args;

  const isEmailIssuanceOrRedemption =
    args.provider === "email" ||
    (args.provider === undefined &&
      args.params.code !== undefined &&
      args.params.email !== undefined);
  if (!isEmailIssuanceOrRedemption) return args;
  if (typeof args.params.email !== "string") {
    throw new Error("Unable to complete sign-in.");
  }

  return {
    ...args,
    params: {
      ...args.params,
      email: normalizeMagicLinkEmail(args.params.email),
    },
  };
}

const configuredAuth = convexAuth({
  providers: [
    Google({
      // The custom callback below is authoritative. This setting also makes
      // Auth.js reject implicit linking before any future callback changes.
      allowDangerousEmailAccountLinking: false,
    }),
    emailMagicLinkProvider,
  ],
  callbacks: {
    createOrUpdateUser: createOrUpdateAuthUser,
    redirect: async ({ redirectTo }) => {
      return absoluteAuthRedirect(redirectTo, process.env.SITE_URL ?? "");
    },
  },
});

export const { auth, signOut, store, isAuthenticated } = configuredAuth;

const generatedSignIn = configuredAuth.signIn;
type SignInResult = {
  redirect?: string;
  verifier?: string;
  tokens?: Tokens | null;
  started?: boolean;
};
type GeneratedSignIn094 = {
  _handler: (ctx: ActionCtx, args: SignInArgs) => Promise<SignInResult>;
};
const generatedSignInHandler = (
  generatedSignIn as unknown as GeneratedSignIn094
)._handler;

/**
 * Compatibility seam for the package-generated action in
 * `@convex-dev/auth@0.0.94` (pinned exactly in package.json). Keep these public
 * validators aligned with that version. The wrapper canonicalizes email before
 * the package can run its create/verify mutation, preventing variant accounts.
 */
export const signIn = action({
  args: {
    provider: v.optional(v.string()),
    params: v.optional(v.any()),
    verifier: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    calledBy: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SignInResult> => {
    return await generatedSignInHandler(ctx, normalizeEmailSignInArgs(args));
  },
});
