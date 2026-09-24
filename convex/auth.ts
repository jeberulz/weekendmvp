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

const AUTH_REDIRECT_ORIGIN = "https://auth.weekendmvp.invalid";
const DEFAULT_AUTH_REDIRECT = "/dashboard";

/** Bound a same-origin path to the private dashboard namespace. */
function safeDashboardTarget(pathname: string, search: string, hash: string) {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return `${pathname}${search}${hash}`;
  }
  return null;
}

/**
 * Nested `returnTo` on the OAuth callback must stay inside `/dashboard`.
 * Anything else collapses to the bounded default.
 */
function safeCallbackReturnTo(value: string | null) {
  if (value === null || value === "") return DEFAULT_AUTH_REDIRECT;
  try {
    const nested = new URL(value, AUTH_REDIRECT_ORIGIN);
    if (nested.origin === AUTH_REDIRECT_ORIGIN) {
      return (
        safeDashboardTarget(nested.pathname, nested.search, nested.hash) ??
        DEFAULT_AUTH_REDIRECT
      );
    }
  } catch {
    // Use the bounded default below.
  }
  return DEFAULT_AUTH_REDIRECT;
}

/**
 * Post-auth redirects are limited to:
 * - `/dashboard` (and subpaths) — email magic-link landing
 * - `/auth/callback?returnTo=…` — Google OAuth handoff so Next middleware can
 *   consume the `code` on the only path `shouldHandleCode` allows
 *
 * External, protocol-relative, and sibling-path targets collapse to
 * `/dashboard`. Callback `returnTo` is re-validated independently so a
 * crafted callback URL cannot smuggle an open redirect.
 */
export function safeAuthRedirect(redirectTo: string) {
  try {
    const target = new URL(redirectTo, AUTH_REDIRECT_ORIGIN);
    if (target.origin !== AUTH_REDIRECT_ORIGIN) {
      return DEFAULT_AUTH_REDIRECT;
    }

    // Google OAuth: AuthCard sets redirectTo=/auth/callback?returnTo=…
    // Middleware only exchanges the OAuth code on that exact path. Dropping
    // the callback (as the old dashboard-only allowlist did) sent the browser
    // straight to /dashboard with an unconsumed code → anonymous bounce.
    if (target.pathname === "/auth/callback") {
      const returnTo = safeCallbackReturnTo(target.searchParams.get("returnTo"));
      return `/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
    }

    return (
      safeDashboardTarget(target.pathname, target.search, target.hash) ??
      DEFAULT_AUTH_REDIRECT
    );
  } catch {
    // Fall through to the only currently approved private destination.
  }
  return DEFAULT_AUTH_REDIRECT;
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
