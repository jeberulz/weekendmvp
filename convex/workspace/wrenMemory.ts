import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  deleteFact,
  editFact,
  editSummary,
  EMPTY_WREN_MEMORY,
  planWrenMemoryUpdate,
  wrenMemoryVersion,
  type FounderMemoryEdit,
  type WrenMemoryProposal,
  type WrenMemoryState,
} from "../../lib/workspace/wrenMemory";

/**
 * WP77-S5 — the only module that writes `wren_memory`.
 *
 * Two writers, both server-side and both through the pure rules in
 * `lib/workspace/wrenMemory.ts` (clean, bound, refuse, dedupe, no eviction):
 * - Wren, from `finishWrenTurn` (`convex/workspace/chat.ts`), in the same
 *   transaction as the `done` write: `applyWrenMemoryProposal`. A failed,
 *   stale or refused reply never reaches it, so it never writes memory. The
 *   sources a note must come from are read here, from the database, never
 *   taken from the action: this turn's founder message (the founder row paired
 *   with the reply by `createdAt`), the current memory and the founder's idea
 *   text. The summary is applied only if memory still has the version the
 *   turn loaded (`baseVersion`); otherwise it is refused `stale`, so a founder
 *   edit made during the turn is never overwritten.
 * - The founder, from the public mutations in `./memory.ts` (owner checked
 *   there by C-OPS and C-AUTHZ): `applyFounderMemoryEdit`, addressed by fact
 *   index plus the text the founder saw, so an edit to a list that moved
 *   returns `stale` and writes nothing.
 *
 * Every change writes one `audit_events` row with counts and indexes only:
 * never fact or summary text. A Wren reply whose proposals were all refused
 * writes one refusal row and no memory.
 *
 * This module writes `wren_memory` and `audit_events` and nothing else. It
 * never creates or decides an approval, schedules, runs an action or a
 * mutation, fetches, sends, posts or spends. The static scan
 * `tests/security/wp77-wren-tools-cards-only.test.mjs` holds that line.
 */

/** One reply's memory proposal as it reaches `finishWrenTurn` (bounded by the action, untrusted). */
export const wrenMemoryProposalValidator = v.object({
  remember: v.optional(v.array(v.string())),
  summary: v.optional(v.string()),
  /** `wrenMemoryVersion` of the memory the turn loaded (`loadWrenTurn`); absent reads as changed. */
  baseVersion: v.optional(v.string()),
});

type Business = { readonly ownerId: Id<"users">; readonly projectId: Id<"projects"> };
type MemoryRow = Doc<"wren_memory">;
type ChatRow = Doc<"chat_messages">;

/** This business's memory row, or null. Only the owner's row counts. */
export async function readWrenMemory(ctx: QueryCtx, business: Business): Promise<MemoryRow | null> {
  return await ctx.db.query("wren_memory")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", business.ownerId).eq("projectId", business.projectId))
    .first();
}

function stateOf(row: MemoryRow | null): WrenMemoryState {
  return row === null ? EMPTY_WREN_MEMORY : { facts: row.facts, summary: row.summary };
}

/** The version a turn records when it loads memory (`loadWrenTurn`). */
export function memoryVersionOf(row: MemoryRow | null): string {
  return wrenMemoryVersion(row === null ? null : stateOf(row));
}

/** The founder message this reply answers: same business, same owner, same `createdAt`. Empty when missing. */
async function founderMessageFor(ctx: QueryCtx, business: Business, reply: ChatRow): Promise<string> {
  const pair = await ctx.db.query("chat_messages")
    .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", business.projectId).eq("createdAt", reply.createdAt))
    .take(4);
  const founder = pair.find((row) => row.author === "founder" && row.ownerId === business.ownerId);
  return founder === undefined ? "" : founder.body;
}

/** The founder's own words about the business (summary sources): the idea text and the business name. */
async function businessTextFor(ctx: QueryCtx, business: Business): Promise<string[]> {
  const project = await ctx.db.get("projects", business.projectId);
  if (project === null || project.ownerId !== business.ownerId) return [];
  const workspace = project.workspace;
  return [project.title, workspace?.name ?? "", workspace?.ownIdeaText ?? ""].filter((text) => text.length > 0);
}

async function writeMemory(ctx: MutationCtx, business: Business, row: MemoryRow | null, next: WrenMemoryState, now: number) {
  if (row === null) {
    await ctx.db.insert("wren_memory", {
      ownerId: business.ownerId,
      projectId: business.projectId,
      facts: [...next.facts],
      summary: next.summary,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.patch("wren_memory", row._id, { facts: [...next.facts], summary: next.summary, updatedAt: now });
}

/**
 * Applies one finished reply's memory proposal. The caller (`finishWrenTurn`)
 * has already proved the reply row is this owner's business and still
 * streaming. Returns whether memory changed.
 */
export async function applyWrenMemoryProposal(
  ctx: MutationCtx,
  business: Business,
  reply: ChatRow,
  proposal: WrenMemoryProposal & { readonly baseVersion?: string },
): Promise<boolean> {
  const proposed = (proposal.remember?.length ?? 0) > 0 || proposal.summary !== undefined;
  if (!proposed) return false;
  const row = await readWrenMemory(ctx, business);
  const plan = planWrenMemoryUpdate(stateOf(row), proposal, {
    founderMessage: await founderMessageFor(ctx, business, reply),
    businessText: proposal.summary === undefined ? [] : await businessTextFor(ctx, business),
    memoryUnchanged: proposal.baseVersion !== undefined && proposal.baseVersion === memoryVersionOf(row),
  });
  const changed = plan.added > 0 || plan.summaryChanged;
  const now = Date.now();
  if (changed) await writeMemory(ctx, business, row, plan.next, now);
  if (changed || plan.refused.length > 0 || plan.summaryRefused !== null) {
    // Counts, indexes and codes only: never the model's text.
    await ctx.db.insert("audit_events", {
      ownerId: business.ownerId,
      projectId: business.projectId,
      actorType: "system",
      action: changed ? "memory.updated_by_wren" : "memory.wren_note_refused",
      subjectType: "chat_message",
      subjectId: reply._id,
      metadata: JSON.stringify({
        added: plan.added,
        summaryChanged: plan.summaryChanged,
        factCount: plan.next.facts.length,
        refused: plan.refused.map(({ index, code }) => ({ index, code })),
        summaryRefused: plan.summaryRefused,
      }),
      createdAt: now,
    });
  }
  return changed;
}

export type FounderMemoryChange =
  | { readonly kind: "edit_fact"; readonly index: number; readonly expected: string; readonly text: string }
  | { readonly kind: "delete_fact"; readonly index: number; readonly expected: string }
  | { readonly kind: "edit_summary"; readonly expected: string; readonly text: string };

function auditActionFor(change: FounderMemoryChange, next: WrenMemoryState): string {
  switch (change.kind) {
    case "edit_fact":
      return "memory.fact_edited";
    case "delete_fact":
      return "memory.fact_deleted";
    case "edit_summary":
      return next.summary === "" ? "memory.summary_cleared" : "memory.summary_edited";
  }
}

/**
 * One founder edit. The caller (`./memory.ts`) has already run C-OPS and
 * C-AUTHZ for this owner. `stale` when the fact or summary no longer reads
 * what the founder saw; nothing is written then, or on a refusal.
 */
export async function applyFounderMemoryEdit(
  ctx: MutationCtx,
  business: Business,
  change: FounderMemoryChange,
): Promise<FounderMemoryEdit> {
  const row = await readWrenMemory(ctx, business);
  const current = stateOf(row);
  const result = change.kind === "edit_fact"
    ? editFact(current, change.index, change.expected, change.text)
    : change.kind === "delete_fact"
      ? deleteFact(current, change.index, change.expected)
      : editSummary(current, change.expected, change.text);
  if (result.kind !== "saved") return result;
  const now = Date.now();
  await writeMemory(ctx, business, row, result.next, now);
  // The index and the new count only: never the fact or summary text.
  await ctx.db.insert("audit_events", {
    ownerId: business.ownerId,
    projectId: business.projectId,
    actorType: "user",
    actorUserId: business.ownerId,
    action: auditActionFor(change, result.next),
    subjectType: "wren_memory",
    subjectId: business.projectId,
    metadata: JSON.stringify({
      ...(change.kind === "edit_summary" ? {} : { index: change.index }),
      factCount: result.next.facts.length,
    }),
    createdAt: now,
  });
  return result;
}
