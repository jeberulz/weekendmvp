import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

export type WorkspaceProject = {
  readonly _id: Id<"projects">;
  readonly name: string;
  /** The co-founder's name from the wizard. Callers default to "Wren" only when this is missing. */
  readonly partnerName?: string;
  /** The switcher sub-line, e.g. "Web app". */
  readonly subline?: string;
  /** The signed-in owner's display name, name or email. */
  readonly viewerName?: string;
};

/**
 * Server-side gate for every `/dashboard/b/[projectId]` layout and page
 * (WP72-S1). Calls `workspace/access:getWorkspaceAccess` with the caller's
 * session and answers with `notFound()` unless it says allowed.
 *
 * The runtime C-OPS `workspace` feature (`ops_settings.workspaceEnabled`)
 * and cohort are checked by the Convex query, together with C-AUTHZ
 * ownership.
 *
 * Every refusal is the same 404: no backend, signed out, a token read that
 * fails, a malformed or unknown id, someone else's business, the workspace
 * switched off, a closed cohort, or a backend error. Next.js
 * control-flow errors (prerender and dynamic bails, `notFound()` itself) pass
 * through `unstable_rethrow` untouched. Cached per request so the layout and
 * the page share one round trip.
 */
export const requireWorkspaceAccess = cache(async (projectId: string): Promise<WorkspaceProject> => {
  await connection();
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) notFound();
  let access;
  try {
    const token = await convexAuthNextjsToken();
    if (!token) notFound();
    // The id is an untrusted URL segment; Convex's `v.id("projects")` rejects
    // anything malformed, and that rejection lands in the catch below.
    access = await fetchQuery(
      api.workspace.access.getWorkspaceAccess,
      { projectId: projectId as Id<"projects"> },
      { token },
    );
  } catch (error) {
    // First, so Next.js control flow (including the notFound() above) escapes.
    unstable_rethrow(error);
    notFound();
  }
  if (!access.allowed) notFound();
  return access.project;
});

/**
 * The businesses for the switcher: `myBusinesses` (each row owner-checked on
 * the server), always including the current one. Any failure falls back to the
 * current business alone, which the gate above has already authorised, so the
 * switcher never shows a business the caller cannot open.
 */
export const listMyBusinesses = cache(
  async (current: WorkspaceProject): Promise<readonly { readonly id: string; readonly name: string }[]> => {
    const fallback = [{ id: current._id, name: current.name }];
    try {
      const token = await convexAuthNextjsToken();
      if (!token) return fallback;
      const rows = await fetchQuery(api.workspace.access.myBusinesses, {}, { token });
      const listed = rows.map((row) => ({ id: row.projectId, name: row.name }));
      return listed.some((row) => row.id === current._id) ? listed : [...fallback, ...listed];
    } catch (error) {
      unstable_rethrow(error);
      return fallback;
    }
  },
);
