import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

/** Set when the founder's plan has no business left: `projectId` is their live business, if any. */
export type WizardBusinessLimit = { readonly limit: number; readonly projectId: string | null };

export type WizardAccess = { readonly ideaTitle: string | null; readonly businessLimit: WizardBusinessLimit | null };

/**
 * Server-side gate for every `/start/*` page (WP74-S1), mirroring the WP72
 * workspace gate. Calls `workspace/wizard:getWizardAccess` with the caller's
 * session and answers `notFound()` unless it says allowed.
 *
 * The public "Build this idea" CTA therefore links to `/signup?returnTo=`
 * (`buildHref`), never to `/start/*` directly.
 *
 * Every refusal is the same 404: no backend, signed out, a token read that
 * fails, the workspace switched off (C-OPS), a closed cohort, an unknown or
 * removed library idea, or a backend error. Next.js control-flow errors pass
 * through `unstable_rethrow`. Cached per request.
 *
 * Under `cacheComponents` a route-level `notFound()` can stream a 200 shell;
 * the hard 404 status needs middleware coverage of `/start` (Codex).
 */
export const requireWizardAccess = cache(async (ideaSlug: string | null): Promise<WizardAccess> => {
  await connection();
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) notFound();
  let access;
  try {
    const token = await convexAuthNextjsToken();
    if (!token) notFound();
    access = await fetchQuery(
      api.workspace.wizard.getWizardAccess,
      ideaSlug === null ? {} : { ideaSlug },
      { token },
    );
  } catch (error) {
    unstable_rethrow(error);
    notFound();
  }
  if (!access.allowed) notFound();
  return { ideaTitle: access.ideaTitle, businessLimit: access.businessLimit };
});
