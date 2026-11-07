import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

export type WizardAccess =
  | { readonly kind: "allowed"; readonly ideaTitle: string | null }
  /** L1-C9: signed in, workspace on, but not on the allowlist yet. */
  | { readonly kind: "not-invited" };

/**
 * Server-side gate for every `/start/*` page (WP74-S1), mirroring the WP72
 * workspace gate. Calls `workspace/wizard:getWizardAccess` with the caller's
 * session and answers `notFound()` unless it says allowed.
 *
 * The public "Build this idea" CTA therefore links to `/signup?returnTo=`
 * (`buildHref`), never to `/start/*` directly.
 *
 * Every refusal is the same 404: no backend, signed out, a token read that
 * fails, the workspace switched off (C-OPS), an unknown or removed library
 * idea, or a backend error. Next.js control-flow errors pass through
 * `unstable_rethrow`. Cached per request.
 *
 * L1-C9: one refusal is not a 404. In `allowlist` mode the public CTAs show
 * to signed-out visitors, so a new account that is not on the list lands
 * here. After a refusal the gate asks `buildCta:awaitingInvite`; when it says
 * yes the page renders "not in the beta yet" (`kind: "not-invited"`). That
 * second read only runs on a refusal, and any failure in it keeps the 404.
 *
 * Under `cacheComponents` a route-level `notFound()` can stream a 200 shell;
 * the hard 404 status needs middleware coverage of `/start` (Codex).
 */
export const requireWizardAccess = cache(async (ideaSlug: string | null): Promise<WizardAccess> => {
  await connection();
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) notFound();
  let access;
  let token: string;
  try {
    const sessionToken = await convexAuthNextjsToken();
    if (!sessionToken) notFound();
    token = sessionToken;
    access = await fetchQuery(
      api.workspace.wizard.getWizardAccess,
      ideaSlug === null ? {} : { ideaSlug },
      { token },
    );
  } catch (error) {
    unstable_rethrow(error);
    notFound();
  }
  if (access.allowed) return { kind: "allowed", ideaTitle: access.ideaTitle };
  if (await awaitingInvite(token)) return { kind: "not-invited" };
  notFound();
});

async function awaitingInvite(token: string): Promise<boolean> {
  try {
    return (await fetchQuery(api.buildCta.awaitingInvite, {}, { token })) === true;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}
