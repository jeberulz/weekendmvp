import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireBusinessAccess, requireCurrentPlatformUser } from "../platform/authz";
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

/** Businesses the desk nav lists. A founder has one free business; paid plans add a few. */
export const MY_BUSINESSES_MAX = 10;
/** Projects read per owner to find them (businesses and older WP22 projects share the table). */
const OWNER_PROJECTS_READ_MAX = 100;

/**
 * L1-C5b — the signed-in founder's businesses, for the desk nav's link into
 * each business workspace. Dormant-safe: signed out, the workspace switched
 * off or the caller outside the cohort reads `[]` (the same denials as
 * `getWorkspaceAccess`), never an error. Only live (non-archived) projects
 * with a `workspace` object count; most recently updated first, at most
 * `MY_BUSINESSES_MAX`. Each row passes `requireBusinessAccess`, so the list
 * shows exactly the businesses the caller could open.
 */
export const myBusinesses = query({
  args: {},
  returns: v.array(v.object({ projectId: v.id("projects"), name: v.string() })),
  handler: async (ctx) => {
    let ownerId: Id<"users">;
    try {
      await assertFeatureEnabled(ctx, "workspace");
      ownerId = (await requireCurrentPlatformUser(ctx))._id;
    } catch (error) {
      if (isAccessDenial(error)) return [];
      throw error;
    }
    const projects = await ctx.db.query("projects")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(OWNER_PROJECTS_READ_MAX);
    const candidates = projects
      .filter((project) => project.workspace !== undefined && project.archivedAt === undefined)
      .slice(0, MY_BUSINESSES_MAX);
    const businesses = [];
    for (const candidate of candidates) {
      // C-AUTHZ for each row, the same owner check every business read uses (the WP68 boundary rule).
      const project = await requireBusinessAccess(ctx, candidate._id, "owner");
      businesses.push({ projectId: project._id, name: project.workspace?.name ?? project.title });
    }
    return businesses;
  },
});
