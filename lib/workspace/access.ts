import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

export type WorkspaceProject = { readonly _id: Id<"projects">; readonly name: string };

/**
 * Server-side gate for every `/dashboard/b/[projectId]` layout and page
 * (WP72-S1). Calls `workspace/access:getWorkspaceAccess` with the caller's
 * session and answers with `notFound()` unless it says allowed.
 *
 * Every refusal is the same 404: no backend, signed out, a malformed or
 * unknown id, someone else's business, the workspace switched off, a closed
 * cohort, or a backend error. Cached per request so the layout and the page
 * share one round trip.
 */
export const requireWorkspaceAccess = cache(async (projectId: string): Promise<WorkspaceProject> => {
  await connection();
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) notFound();
  const token = await convexAuthNextjsToken();
  if (!token) notFound();
  let access;
  try {
    // The id is an untrusted URL segment; Convex's `v.id("projects")` rejects
    // anything malformed, and that rejection lands in the catch below.
    access = await fetchQuery(
      api.workspace.access.getWorkspaceAccess,
      { projectId: projectId as Id<"projects"> },
      { token },
    );
  } catch (error) {
    unstable_rethrow(error);
    notFound();
  }
  if (!access.allowed) notFound();
  return access.project;
});
