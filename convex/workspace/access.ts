import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireBusinessAccess } from "../platform/authz";
import { assertFeatureEnabled } from "../ops/settings";

/**
 * WP72-S1 route gate for `/dashboard/b/[projectId]/*`.
 *
 * Read-only and dormant: it answers `{ allowed: false }` unless the caller is
 * signed in, the `workspace` feature is on for the caller's cohort (C-OPS) and
 * the caller owns the business (C-AUTHZ). Every denial has the same shape, so a
 * missing project, someone else's project, a closed cohort and a switched-off
 * workspace cannot be told apart.
 */

/** Guard codes that mean "no access". Anything else is a real fault and rethrows. */
const DENIAL_CODES: ReadonlySet<string> = new Set([
  "UNAUTHENTICATED",
  "RESOURCE_NOT_FOUND",
  "WORKSPACE_DISABLED",
]);

function isAccessDenial(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const data: unknown = error.data;
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    typeof data.code === "string" &&
    DENIAL_CODES.has(data.code)
  );
}

export const workspaceAccessValidator = v.union(
  v.object({
    allowed: v.literal(true),
    project: v.object({ _id: v.id("projects"), name: v.string() }),
  }),
  v.object({ allowed: v.literal(false) }),
);

export const getWorkspaceAccess = query({
  args: { projectId: v.id("projects") },
  returns: workspaceAccessValidator,
  handler: async (ctx, args) => {
    try {
      // Feature and cohort first, so a closed workspace never touches the project.
      await assertFeatureEnabled(ctx, "workspace");
      const project = await requireBusinessAccess(ctx, args.projectId, "owner");
      return {
        allowed: true as const,
        project: { _id: project._id, name: project.workspace?.name ?? project.title },
      };
    } catch (error) {
      if (isAccessDenial(error)) return { allowed: false as const };
      throw error;
    }
  },
});
