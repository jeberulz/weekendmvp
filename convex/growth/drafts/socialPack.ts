import { v, type Infer } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireBusinessAccess } from "../../platform/authz";
import { approvalStatusValidator } from "../../workspace/approvals";
import { approvalExpiresAt } from "../../../lib/workspace/contracts/approvals";
import {
  SOCIAL_DAYS,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_KINDS,
  socialPackSchema,
  socialPostsInOrder,
  type SocialPack,
} from "../../../lib/workspace/contracts/artifacts";

/**
 * WP76-S2a — the owner-only read of the launch's social pack for the Social
 * page (S2b). The pack lives only in its `social_pack` document: S2a writes
 * no `social_posts` rows (owner ruling "Ship now, rows later", 2026-11-07;
 * S2c writes them once `social_posts` has a day field). Nothing here posts.
 *
 * The document read is the business's newest non-archived `social_pack`
 * document (a revision supersedes its draft with a newer one). Its body is
 * parsed with the C-ART schema; one that does not parse reads `unavailable`,
 * never as other text. The card is that document's newest `artifact_review`
 * card, the same shape the Email page reads (`emailSequenceDraft`).
 */

type Business = { readonly ownerId: Id<"users">; readonly projectId: Id<"projects"> };

const inBusiness = (row: { ownerId: Id<"users">; projectId?: Id<"projects"> }, business: Business): boolean =>
  row.ownerId === business.ownerId && row.projectId === business.projectId;

/** Social pack documents read per business, newest first. One per draft or revision. */
export const SOCIAL_PACK_DOCUMENTS_READ_MAX = 20;

/** Cards read per document. */
const CARDS_PER_DOCUMENT_MAX = 20;

function parseSocialPackBody(body: string | undefined): SocialPack | null {
  if (body === undefined) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = socialPackSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const socialPostViewValidator = v.object({
  day: v.union(...SOCIAL_DAYS.map((day) => v.literal(day))),
  kind: v.union(...SOCIAL_POST_KINDS.map((kind) => v.literal(kind))),
  format: v.union(...SOCIAL_POST_FORMATS.map((format) => v.literal(format))),
  hook: v.string(),
  caption: v.string(),
  shortCaption: v.string(),
  imageText: v.string(),
  imageAlt: v.optional(v.string()),
  pollOptions: v.optional(v.array(v.string())),
  /** Stored without `#`; the page adds it for display. */
  hashtags: v.array(v.string()),
});

const socialPackDraftView = v.union(
  v.object({ state: v.literal("none") }),
  /** The newest document does not parse as a social pack: shown as unavailable. */
  v.object({ state: v.literal("unavailable") }),
  v.object({
    state: v.literal("ready"),
    /** The seven posts, Friday (launch day) to Thursday. */
    posts: v.array(socialPostViewValidator),
    /** The document's newest `artifact_review` card: the page's approve / ask-for-changes actions need its id. */
    card: v.union(
      v.null(),
      v.object({
        approvalId: v.id("approvals"),
        status: approvalStatusValidator,
        changeRound: v.int64(),
        /** Queries never read the clock; the client treats a pending card past this time as expired. */
        expiresAt: v.number(),
      }),
    ),
  }),
);

/**
 * The business's social pack for the Social page: the seven posts in day
 * order and the document's card. Owner only; the workspace and AI must be on.
 * No ids beyond the card's.
 */
export const socialPackDraft = query({
  args: { projectId: v.id("projects") },
  returns: socialPackDraftView,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    await assertFeatureEnabled(ctx, "ai");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const business: Business = { ownerId: project.ownerId, projectId: project._id };

    const rows = await ctx.db.query("documents")
      .withIndex("by_projectId_and_kind_and_updatedAt", (q) => q.eq("projectId", project._id).eq("kind", "social_pack"))
      .order("desc")
      .take(SOCIAL_PACK_DOCUMENTS_READ_MAX);
    // Newest written first: a later edit to an older document never puts it ahead of its revision.
    const document = rows
      .filter((row) => inBusiness(row, business) && row.archivedAt === undefined)
      .reduce<Doc<"documents"> | null>((newest, row) => (newest === null || row.createdAt > newest.createdAt ? row : newest), null);
    if (document === null) return { state: "none" as const };
    const pack = parseSocialPackBody(document.body);
    if (pack === null) return { state: "unavailable" as const };

    const posts: Infer<typeof socialPostViewValidator>[] = socialPostsInOrder(pack).map(({ day, post }) => ({
      day,
      kind: post.kind,
      format: post.format,
      hook: post.hook,
      caption: post.caption,
      shortCaption: post.shortCaption,
      imageText: post.imageText,
      ...(post.imageAlt === undefined ? {} : { imageAlt: post.imageAlt }),
      ...(post.pollOptions === undefined ? {} : { pollOptions: [...post.pollOptions] }),
      hashtags: [...post.hashtags],
    }));

    // Newest first, so the newest card within the cap is the one seen.
    const card = (await ctx.db.query("approvals")
      .withIndex("by_subjectId", (q) => q.eq("subjectId", document._id))
      .order("desc")
      .take(CARDS_PER_DOCUMENT_MAX))
      .find((row) => row.kind === "artifact_review" && row.subjectTable === "documents" && inBusiness(row, business)) ?? null;
    return {
      state: "ready" as const,
      posts,
      card: card === null
        ? null
        : { approvalId: card._id, status: card.status, changeRound: card.changeRound, expiresAt: approvalExpiresAt(card.createdAt) },
    };
  },
});
