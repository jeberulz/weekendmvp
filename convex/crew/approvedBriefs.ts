import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertApproved } from "../workspace/approvals";

export type BriefKind = "blueprint" | "brand_kit";

/** Blueprint (or brand kit) documents looked at for an approved one, newest first. */
const APPROVED_BLUEPRINT_SCAN_MAX = 20;
/** Cards read per blueprint document. */
export const APPROVALS_PER_DOCUMENT_MAX = 20;

/**
 * A blueprint (or brand kit) document of the project whose `artifact_review`
 * card is approved and still valid for it (`assertApproved`: same business and
 * owner, unchanged since the card).
 */
export async function isApprovedBlueprint(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
  row: Doc<"documents">,
  kind: BriefKind = "blueprint",
): Promise<boolean> {
  if (row.projectId !== project._id || row.kind !== kind) return false;
  if (row.ownerId !== project.ownerId || row.archivedAt !== undefined || row.body === undefined) return false;
  const cards = await ctx.db.query("approvals").withIndex("by_subjectId", (q) => q.eq("subjectId", row._id)).take(APPROVALS_PER_DOCUMENT_MAX);
  for (const card of cards) {
    if (card.kind !== "artifact_review" || card.status !== "approved" || card.subjectTable !== "documents") continue;
    try {
      await assertApproved(ctx, card._id, {
        kind: "artifact_review",
        projectId: project._id,
        ownerId: project.ownerId,
        subjectTable: "documents",
        subjectId: row._id,
      });
      return true;
    } catch {
      // Not valid for this document (changed since, wrong business): try the next card.
    }
  }
  return false;
}

/**
 * The newest blueprint the founder approved (`isApprovedBlueprint`). A draft
 * is never the brand kit's brief (S3a review minor 1).
 */
export async function approvedBlueprint(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
  kind: BriefKind = "blueprint",
): Promise<Doc<"documents"> | null> {
  const rows = await ctx.db
    .query("documents")
    .withIndex("by_projectId_and_kind_and_updatedAt", (q) => q.eq("projectId", project._id).eq("kind", kind))
    .order("desc")
    .take(APPROVED_BLUEPRINT_SCAN_MAX);
  for (const row of rows) {
    if (await isApprovedBlueprint(ctx, project, row, kind)) return row;
  }
  return null;
}

/** WP76-S1a: the newest brand kit the founder approved (`approvedBlueprint` for the brand kit kind). */
export async function approvedBrandKit(
  ctx: Pick<QueryCtx, "db">,
  project: Pick<Doc<"projects">, "_id" | "ownerId">,
): Promise<Doc<"documents"> | null> {
  return await approvedBlueprint(ctx, project, "brand_kit");
}
