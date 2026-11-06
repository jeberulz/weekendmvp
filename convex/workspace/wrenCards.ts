import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  approvalCardTitle,
  checkWrenCardProposals,
  type CheckedWrenCard,
  type WrenCardProposal,
  type WrenCardRefusal,
} from "../../lib/workspace/wrenCards";
import { approvalKindValidator, approvalStatusValidator, createApprovalRecord } from "./approvals";

/**
 * WP77-S4 — Wren's tool handlers: they create or show cards and nothing else.
 *
 * The registry is closed (`lib/workspace/contracts/wrenTools.ts`) and every
 * proposal is checked twice: the gateway's schema (bounded strings), then
 * `checkWrenCardProposals` (exact allowlist, per-tool fields, the per-turn
 * cap). What is left is handled here, inside `finishWrenTurn`, in the same
 * transaction that writes the reply:
 *
 * - approval_card: only a subject of THIS founder's business, through S1's
 *   `createApprovalRecord` (its kind → table rules, business chain and
 *   publishable check). It never touches an existing card: if the subject
 *   already has a pending or approved card of that kind, that card's id is
 *   attached and nothing is written. Only when the subject has no live card
 *   is a new one created, and it is always `pending`. So S1's supersede path
 *   (which cancels older cards) can never run from chat, and Wren can never
 *   approve, revoke or replace a founder's card.
 * - explain_card / navigate_card: static copy and an in-app route keyed by
 *   an allowlisted name; no write at all.
 *
 * No handler sends, posts, publishes, spends, debits, schedules, calls an
 * action or a connector, or calls `decideApproval`. The static scan
 * `tests/security/wp77-wren-tools-cards-only.test.mjs` fails the build if
 * this module or the chat modules ever reference one.
 *
 * Proposals are data: an id that came from injected text is still checked
 * against the business, and a refused card is dropped without a write.
 */

/** A proposed card as it reaches `finishWrenTurn` (the model's `cards` entry, schema-checked strings). */
export const wrenCardProposalValidator = v.object({
  tool: v.string(),
  kind: v.optional(v.string()),
  subjectTable: v.optional(v.string()),
  subjectId: v.optional(v.string()),
  topic: v.optional(v.string()),
  route: v.optional(v.string()),
});

/** What the thread shows for one card. Built by the server; no model text. */
export const wrenCardViewValidator = v.union(
  v.object({
    kind: v.literal("approval"),
    approvalId: v.id("approvals"),
    approvalKind: approvalKindValidator,
    status: approvalStatusValidator,
    title: v.string(),
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

/** The newest pending or approved card of this kind for the subject, or null. Read only. */
async function liveCardFor(ctx: QueryCtx, business: Business, card: ApprovalCard): Promise<Doc<"approvals"> | null> {
  let newest: Doc<"approvals"> | null = null;
  for await (const row of ctx.db.query("approvals").withIndex("by_subjectId", (q) => q.eq("subjectId", card.subjectId))) {
    if (
      (row.status === "pending" || row.status === "approved") &&
      row.ownerId === business.ownerId &&
      row.projectId === business.projectId &&
      row.kind === card.kind &&
      row.subjectTable === card.subjectTable &&
      (newest === null || row.createdAt > newest.createdAt)
    ) newest = row;
  }
  return newest;
}

async function raiseApprovalCard(
  ctx: MutationCtx,
  business: Business,
  card: ApprovalCard,
): Promise<{ approvalId: Id<"approvals">; created: boolean } | null> {
  const live = await liveCardFor(ctx, business, card);
  if (live !== null) return { approvalId: live._id, created: false };
  try {
    // No live card exists, so `createApprovalRecord` only inserts one pending
    // row: its supersede loop has nothing to close. Every refusal it throws
    // (another business, a missing or wrong-table id, an unpublishable
    // version, the workspace off) happens before it writes anything.
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
        createdAt: Date.now(),
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
 * caller has already proved the reply row is this owner's business.
 */
export async function resolveWrenCards(
  ctx: MutationCtx,
  business: Business,
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
  return { approvalIds, displayCards, refused, created };
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
    });
  }
  return views;
}
