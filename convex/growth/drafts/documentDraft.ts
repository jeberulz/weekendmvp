import { v, type Infer } from "convex/values";
import type { ZodType } from "zod";

import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { approvalStatusValidator } from "../../workspace/approvals";
import { approvalExpiresAt } from "../../../lib/workspace/contracts/approvals";

/**
 * L1-C1 / L1-C6 — the shared read behind the owner-only draft queries for
 * one-document artifacts (`brandKitDraft`, `blueprintDraft`). The same rules
 * the Social page's read uses (`socialPackDraft`, WP76-S2a):
 * - the document is the business's newest written non-archived document of
 *   the kind (a revision supersedes its draft with a newer one, so the newest
 *   `createdAt` wins and a later edit to an older document never puts it
 *   ahead of its revision);
 * - the card is that document's newest `artifact_review` card in this
 *   business, or null.
 * Nothing here reads the clock: the client treats a pending card past
 * `expiresAt` as expired.
 */

type Ctx = Pick<QueryCtx, "db">;

export type Business = { readonly ownerId: Id<"users">; readonly projectId: Id<"projects"> };

const inBusiness = (row: { ownerId: Id<"users">; projectId?: Id<"projects"> }, business: Business): boolean =>
  row.ownerId === business.ownerId && row.projectId === business.projectId;

/** Documents of one kind read per business, newest updated first. One per draft or revision. */
export const DRAFT_DOCUMENTS_READ_MAX = 20;

/** Cards read per document. */
const CARDS_PER_DOCUMENT_MAX = 20;

/** The document's newest `artifact_review` card: the page's approve / ask-for-changes actions need its id. */
export const reviewCardValidator = v.union(
  v.null(),
  v.object({
    approvalId: v.id("approvals"),
    status: approvalStatusValidator,
    changeRound: v.int64(),
    /** Queries never read the clock; the client treats a pending card past this time as expired. */
    expiresAt: v.number(),
  }),
);
export type ReviewCard = Infer<typeof reviewCardValidator>;

export async function newestDraftDocument(
  ctx: Ctx,
  business: Business,
  kind: Doc<"documents">["kind"],
): Promise<Doc<"documents"> | null> {
  const rows = await ctx.db.query("documents")
    .withIndex("by_projectId_and_kind_and_updatedAt", (q) => q.eq("projectId", business.projectId).eq("kind", kind))
    .order("desc")
    .take(DRAFT_DOCUMENTS_READ_MAX);
  return rows
    .filter((row) => inBusiness(row, business) && row.archivedAt === undefined)
    .reduce<Doc<"documents"> | null>((newest, row) => (newest === null || row.createdAt > newest.createdAt ? row : newest), null);
}

export async function newestReviewCard(ctx: Ctx, business: Business, documentId: Id<"documents">): Promise<ReviewCard> {
  // Newest first, so the newest card within the cap is the one seen.
  const card = (await ctx.db.query("approvals")
    .withIndex("by_subjectId", (q) => q.eq("subjectId", documentId))
    .order("desc")
    .take(CARDS_PER_DOCUMENT_MAX))
    .find((row) => row.kind === "artifact_review" && row.subjectTable === "documents" && inBusiness(row, business)) ?? null;
  return card === null
    ? null
    : { approvalId: card._id, status: card.status, changeRound: card.changeRound, expiresAt: approvalExpiresAt(card.createdAt) };
}

/** Parses a stored JSON body with a C-ART schema; anything that does not parse is null, never other text. */
export function parseDraftBody<T>(body: string | undefined, schema: ZodType<T>): T | null {
  if (body === undefined) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
