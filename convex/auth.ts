import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { createOrUpdateAuthUser } from "./authUser";

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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      // The custom callback below is authoritative. This setting also makes
      // Auth.js reject implicit linking before any future callback changes.
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  callbacks: {
    createOrUpdateUser: createOrUpdateAuthUser,
    redirect: async ({ redirectTo }) => safeAuthRedirect(redirectTo),
  },
});
