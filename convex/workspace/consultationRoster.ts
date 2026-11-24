import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** The same hired people can be named in a capability answer and addressed in an actual relay. */
export async function readConsultationRoster(ctx: Pick<QueryCtx, "db">, project: Doc<"projects">) {
  const rows = await ctx.db.query("crew_members")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", project.ownerId).eq("projectId", project._id))
    .take(32);
  return rows.filter((row) => row.status !== "skipped" && row.roleKey !== "lead");
}
