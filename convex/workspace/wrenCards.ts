import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  APPROVAL_REVIEW_ROUTES,
  approvalCardTitle,
  approvalReviewRoute,
  approvalSubjectLine,
  checkWrenCardProposals,
  type ApprovalSubjectFacts,
  type CheckedWrenCard,
  type WrenCardProposal,
  type WrenCardRefusal,
} from "../../lib/workspace/wrenCards";
import { isPendingApprovalStale } from "../../lib/workspace/contracts/approvals";
import { WREN_APPROVAL_SUBJECTS, type WrenApprovalKind } from "../../lib/workspace/contracts/wrenTools";
import {
  approvalKindValidator,
  approvalStatusValidator,
  createApprovalRecord,
  readSubjectState,
  subjectRefusal,
  type SubjectState,
} from "./approvals";

/**
 * WP77-S4 — Wren's tool handlers: they create or show cards and nothing else.
 *
 * The registry is closed (`lib/workspace/contracts/wrenTools.ts`) and every
 * proposal is checked twice: the reply schema (plain strings), then
 * `checkWrenCardProposals` (exact allowlist, per-tool fields, the 64-char
 * field limit, the per-turn cap). What is left is handled here, inside
 * `finishWrenTurn`, in the same transaction that writes the reply:
 *
 * - approval_card, in this order, writing nothing until the last step:
 *   1. the subject must be this founder's business, by S1's own
 *      `readSubjectState` (before any approval is read);
 *   2. its workflow status must be the pre-approval one: a `post` only on a
 *      `copy_ready` social post, a `send` only on a `draft` sequence;
 *   3. the subject's approval history (at most `APPROVAL_HISTORY_MAX` rows,
 *      fail closed past it) is searched for a card that can still be used:
 *      pending, not stale, and S1's `subjectRefusal` finds nothing (subject
 *      unchanged since the card, publishable, not linked to another
 *      approval); or approved with the same subject check. The newest such
 *      card is reused as it is: Wren never approves, revokes or replaces it;
 *   4. a subject row that links to an approval other than the reused card
 *      (`approvalId`, S1's `linkedApprovalId`) is refused: a fresh card on it
 *      could never pass `decideApproval`;
 *   5. only when no usable card exists, and the card's kind and table are
 *      still a `WREN_APPROVAL_SUBJECTS` pair (`isWrenApprovalSubject`, checked
 *      again at runtime right before the call, whatever the caller passed),
 *      is S1's `createApprovalRecord` called.
 *      Its supersede pass then closes only cards step 3 found dead (stale,
 *      changed subject), so a founder's still-valid approval is never
 *      cancelled from chat. The new card is always `pending`.
 * - explain_card / navigate_card: static copy and an in-app route keyed by
 *   an allowlisted name; no write at all.
 *
 * A turn that refused at least one proposal writes one `audit_events` row
 * (`approval.wren_card_refused`: indexes and codes only, no model text).
 *
 * No handler sends, posts, publishes, spends, debits, schedules, calls an
 * action or a connector, or calls `decideApproval`. The static scan
 * `tests/security/wp77-wren-tools-cards-only.test.mjs` fails the build if
 * this module or the chat modules ever reference one.
 *
 * Proposals are data: an id that came from injected text is still checked
 * against the business, and a refused card is dropped without a card write.
 *
 * Kill switches: `createApprovalRecord` checks the `workspace` switch only;
 * the kind's own switch (publish, email, social) is checked when the founder
 * decides and when the side effect runs. Checking it at card creation is a
 * follow-up for S1 (see `docs/wp/wp77-progress.md`).
 */

/** A proposed card as it reaches `finishWrenTurn` (the model's `cards` entry, strings only). */
export const wrenCardProposalValidator = v.object({
  tool: v.string(),
  kind: v.optional(v.string()),
  subjectTable: v.optional(v.string()),
  subjectId: v.optional(v.string()),
  topic: v.optional(v.string()),
  route: v.optional(v.string()),
});

const reviewRouteValidator = v.union(
  v.literal(APPROVAL_REVIEW_ROUTES[0]),
  v.literal(APPROVAL_REVIEW_ROUTES[1]),
  v.literal(APPROVAL_REVIEW_ROUTES[2]),
  v.literal(APPROVAL_REVIEW_ROUTES[3]),
);

/** What the thread shows for one card. Built by the server; no model text. */
export const wrenCardViewValidator = v.union(
  v.object({
    kind: v.literal("approval"),
    approvalId: v.id("approvals"),
    approvalKind: approvalKindValidator,
    status: approvalStatusValidator,
    title: v.string(),
    /** Which thing this card approves (version number, sequence title, post's first line). Plain text. */
    subject: v.string(),
    /** The workspace page where the founder reviews the subject. */
    reviewRoute: reviewRouteValidator,
  }),
  v.object({ kind: v.literal("explain"), topic: v.string() }),
  v.object({ kind: v.literal("navigate"), route: v.string() }),
);

export type WrenCardView = Infer<typeof wrenCardViewValidator>;

type Business = { readonly ownerId: Id<"users">; readonly projectId: Id<"projects"> };

export type ResolvedWrenCards = {
  /** Approval cards to attach to the reply row (`cardApprovalIds`). */
  readonly approvalIds: readonly Id<"approvals">[];
  /** Explain and navigate cards that passed the allowlist (no write). */
  readonly displayCards: readonly Extract<CheckedWrenCard, { tool: "explain_card" | "navigate_card" }>[];
  readonly refused: readonly { readonly index: number; readonly code: WrenCardRefusal }[];
  /** Approval cards created by this turn (always pending). */
  readonly created: number;
};

type ApprovalCard = Extract<CheckedWrenCard, { tool: "approval_card" }>;
type FoundSubject = Extract<SubjectState, { found: true }>;

/** Approval rows of one subject read before reusing or raising a card. Past it, the card is refused. */
export const APPROVAL_HISTORY_MAX = 50;

/**
 * The runtime control on what Wren may raise: `kind` is an own key of
 * `WREN_APPROVAL_SUBJECTS` and `subjectTable` is in that kind's list. The
 * static scan's `card.*` rule only guards against regressions; this is the
 * check that holds even for a forged card object.
 */
export function isWrenApprovalSubject(kind: string, subjectTable: string): boolean {
  if (!Object.hasOwn(WREN_APPROVAL_SUBJECTS, kind)) return false;
  const tables: readonly string[] = WREN_APPROVAL_SUBJECTS[kind as WrenApprovalKind];
  return tables.includes(subjectTable);
}

/** The subject's workflow status allows a card of this kind (`post`: copy ready; `send`: draft). */
async function subjectStatusAllows(ctx: QueryCtx, card: ApprovalCard): Promise<boolean> {
  switch (card.subjectTable) {
    case "site_versions":
      // Publishable (`ready`, site not taken down) is S1's check, in `subjectRefusal` / `createApprovalRecord`.
      return true;
    case "sequences": {
      const id = ctx.db.normalizeId("sequences", card.subjectId);
      const row = id === null ? null : await ctx.db.get("sequences", id);
      return row !== null && row.status === "draft";
    }
    case "social_posts": {
      const id = ctx.db.normalizeId("social_posts", card.subjectId);
      const row = id === null ? null : await ctx.db.get("social_posts", id);
      return row !== null && row.status === "copy_ready";
    }
    default:
      return false;
  }
}

/** A card the founder can still use: fresh pending or approved, on an unchanged, unlinked-elsewhere subject. */
function isUsable(row: Doc<"approvals">, state: FoundSubject, now: number): boolean {
  if (row.status === "pending") {
    if (isPendingApprovalStale(row.createdAt, now)) return false;
  } else if (row.status !== "approved") {
    return false;
  }
  return subjectRefusal(state, row.kind, row.createdAt, row._id) === null;
}

/**
 * The newest usable card of this kind for the subject (see `isUsable`), or
 * null. `"limit"` past `APPROVAL_HISTORY_MAX` rows. Read only; the caller has
 * already proved the subject is this business's.
 */
async function liveCardFor(
  ctx: QueryCtx,
  business: Business,
  card: ApprovalCard,
  state: FoundSubject,
  now: number,
): Promise<Doc<"approvals"> | null | "limit"> {
  const history = await ctx.db.query("approvals")
    .withIndex("by_subjectId", (q) => q.eq("subjectId", card.subjectId))
    .take(APPROVAL_HISTORY_MAX + 1);
  if (history.length > APPROVAL_HISTORY_MAX) return "limit";
  let newest: Doc<"approvals"> | null = null;
  for (const row of history) {
    if (row.ownerId !== business.ownerId || row.projectId !== business.projectId) continue;
    if (row.kind !== card.kind || row.subjectTable !== card.subjectTable) continue;
    if (!isUsable(row, state, now)) continue;
    if (newest === null || row.createdAt > newest.createdAt) newest = row;
  }
  return newest;
}

/** Raises or reuses one approval card (see the file header); null when refused, with nothing written. Exported for tests. */
export async function raiseApprovalCard(
  ctx: MutationCtx,
  business: Business,
  card: ApprovalCard,
): Promise<{ approvalId: Id<"approvals">; created: boolean } | null> {
  // Early, so a forged kind cannot even reuse (attach) an existing card of that kind.
  if (!isWrenApprovalSubject(card.kind, card.subjectTable)) return null;
  const state = await readSubjectState(ctx, business.ownerId, business.projectId, card.subjectTable, card.subjectId);
  if (!state.found) return null;
  if (!(await subjectStatusAllows(ctx, card))) return null;
  const now = Date.now();
  const live = await liveCardFor(ctx, business, card, state, now);
  if (live === "limit") return null;
  if (state.linkedApprovalId !== undefined && state.linkedApprovalId !== live?._id) return null;
  if (live !== null) return { approvalId: live._id, created: false };
  // Again right before the write: the control that matters, whatever happened above.
  if (!isWrenApprovalSubject(card.kind, card.subjectTable)) return null;
  try {
    // Every pending or approved card of this subject is dead (stale or on a
    // changed subject), so `createApprovalRecord`'s supersede pass closes
    // only those. Every refusal it throws (the workspace off, a wrong table,
    // an unpublishable version) happens before it writes anything.
    const result = await createApprovalRecord(ctx, {
      ownerId: business.ownerId,
      projectId: business.projectId,
      kind: card.kind,
      subjectTable: card.subjectTable,
      subjectId: card.subjectId,
    });
    if (result.created) {
      await ctx.db.insert("audit_events", {
        ownerId: business.ownerId,
        projectId: business.projectId,
        actorType: "system",
        action: "approval.raised_by_wren",
        subjectType: "approval",
        subjectId: result.approvalId,
        metadata: JSON.stringify({ kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }),
        createdAt: now,
      });
    }
    return result;
  } catch (error) {
    if (error instanceof ConvexError) return null;
    throw error;
  }
}

/**
 * Checks and handles one reply's proposed cards (see the file header). The
 * caller has already proved the reply row (`messageId`) is this owner's
 * business.
 */
export async function resolveWrenCards(
  ctx: MutationCtx,
  business: Business,
  messageId: Id<"chat_messages">,
  proposals: readonly WrenCardProposal[],
): Promise<ResolvedWrenCards> {
  const check = checkWrenCardProposals(proposals);
  const refused = [...check.refused];
  const approvalIds: Id<"approvals">[] = [];
  const displayCards: Extract<CheckedWrenCard, { tool: "explain_card" | "navigate_card" }>[] = [];
  let created = 0;
  for (const { index, card } of check.accepted) {
    if (card.tool !== "approval_card") {
      displayCards.push(card);
      continue;
    }
    const raised = await raiseApprovalCard(ctx, business, card);
    if (raised === null) {
      refused.push({ index, code: "subject_refused" });
      continue;
    }
    if (!approvalIds.includes(raised.approvalId)) approvalIds.push(raised.approvalId);
    if (raised.created) created += 1;
  }
  if (refused.length > 0) {
    // Codes and positions only: never the model's values.
    await ctx.db.insert("audit_events", {
      ownerId: business.ownerId,
      projectId: business.projectId,
      actorType: "system",
      action: "approval.wren_card_refused",
      subjectType: "chat_message",
      subjectId: messageId,
      metadata: JSON.stringify({
        refused: [...refused].sort((a, b) => a.index - b.index).map(({ index, code }) => ({ index, code })),
        proposed: proposals.length,
        created,
      }),
      createdAt: Date.now(),
    });
  }
  return { approvalIds, displayCards, refused, created };
}

/** Server-read facts for an approval card's subject line; null fields when the row is not this business's. */
async function subjectFacts(ctx: QueryCtx, business: Business, approval: Doc<"approvals">): Promise<ApprovalSubjectFacts> {
  // Same chain as S1's `inBusiness`: this business, and not archived (for any table that has the column).
  const ours = (row: { ownerId: Id<"users">; projectId: Id<"projects">; archivedAt?: number } | null) =>
    row !== null && row.ownerId === business.ownerId && row.projectId === business.projectId &&
    row.archivedAt === undefined;
  switch (approval.subjectTable) {
    case "site_versions": {
      const id = ctx.db.normalizeId("site_versions", approval.subjectId);
      const row = id === null ? null : await ctx.db.get("site_versions", id);
      return { table: "site_versions", version: row !== null && ours(row) ? row.version : null };
    }
    case "sequences": {
      const id = ctx.db.normalizeId("sequences", approval.subjectId);
      const row = id === null ? null : await ctx.db.get("sequences", id);
      return { table: "sequences", title: row !== null && ours(row) ? row.title : null };
    }
    case "social_posts": {
      const id = ctx.db.normalizeId("social_posts", approval.subjectId);
      const row = id === null ? null : await ctx.db.get("social_posts", id);
      if (row === null || !ours(row) || row.documentId === undefined) return { table: "social_posts", text: null };
      const document = await ctx.db.get("documents", row.documentId);
      const readable = document !== null && ours(document) &&
        (document.format === "markdown" || document.format === "text");
      return { table: "social_posts", text: readable ? document.body ?? null : null };
    }
    default:
      return { table: "other" };
  }
}

/** The thread's view of a reply's approval cards: only cards of this business, in order. */
export async function approvalCardViews(
  ctx: QueryCtx,
  business: Business,
  approvalIds: readonly Id<"approvals">[],
): Promise<WrenCardView[]> {
  const views: WrenCardView[] = [];
  for (const approvalId of approvalIds) {
    const approval = await ctx.db.get("approvals", approvalId);
    if (approval === null || approval.ownerId !== business.ownerId || approval.projectId !== business.projectId) continue;
    views.push({
      kind: "approval",
      approvalId: approval._id,
      approvalKind: approval.kind,
      status: approval.status,
      title: approvalCardTitle(approval.kind, approval.subjectTable),
      subject: approvalSubjectLine(await subjectFacts(ctx, business, approval)),
      reviewRoute: approvalReviewRoute(approval.subjectTable),
    });
  }
  return views;
}
