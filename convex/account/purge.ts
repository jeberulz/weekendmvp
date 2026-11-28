import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * WP96: the row-level drains behind account deletion.
 *
 * Every drain reads at most `limit` rows through an index, deletes them and says
 * whether the index range is now empty. Deleted rows leave the range, so a drain
 * needs no cursor: running it again simply takes the next rows.
 *
 * What is NOT drained, on purpose (see docs/wp/wp96-data-map.md):
 *   ai_usage, ai_budgets            the meter must keep adding up
 *   audit_events                    kept, with `metadata` removed (see deletion.ts)
 *   credit_accounts, credit_ledger, purchases, billing_*, plan_*, membership_*,
 *   workshop_*, founding_seats      financial records and late-webhook lookups
 *   idea_crew_seeds, idea_seed_*    operator-owned, not founder data
 */

export type DrainResult = { deleted: number; exhausted: boolean };

/** Documents and site versions can hold up to 256 KiB of text each. */
export const HEAVY_ROW_CAP = 20;

type Rows<T extends TableNames> = { _id: Id<T> }[];

async function removeRows<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  rows: Rows<T>,
  limit: number,
  beforeDelete?: (row: Rows<T>[number]) => Promise<void>,
): Promise<DrainResult> {
  for (const row of rows) {
    if (beforeDelete !== undefined) await beforeDelete(row);
    await ctx.db.delete(table, row._id);
  }
  return { deleted: rows.length, exhausted: rows.length < limit };
}

async function removeStoredFile(ctx: MutationCtx, storageId: Id<"_storage"> | undefined): Promise<void> {
  if (storageId === undefined) return;
  const stored = await ctx.db.system.get("_storage", storageId);
  if (stored !== null) await ctx.storage.delete(storageId);
}

export type ProjectDrain = (
  ctx: MutationCtx,
  ownerId: Id<"users">,
  projectId: Id<"projects">,
  limit: number,
) => Promise<DrainResult>;

/** Child rows of one business, children first. The `projects` row goes last. */
export const PROJECT_DRAINS: readonly ProjectDrain[] = [
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "chat_messages", await ctx.db.query("chat_messages")
    .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "wren_memory", await ctx.db.query("wren_memory")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "approvals", await ctx.db.query("approvals")
    .withIndex("by_projectId_and_status", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "workstreams", await ctx.db.query("workstreams")
    .withIndex("by_projectId_and_employeeId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "launch_plan_items", await ctx.db.query("launch_plan_items")
    .withIndex("by_projectId_and_order", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "crew_members", await ctx.db.query("crew_members")
    .withIndex("by_projectId_and_roleKey", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "roster_plans", await ctx.db.query("roster_plans")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "business_files", await ctx.db.query("business_files")
    .withIndex("by_projectId_and_kind", (q) => q.eq("projectId", projectId)).take(limit), limit,
  (row) => removeStoredFile(ctx, (row as Doc<"business_files">).storageId)),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "provider_jobs", await ctx.db.query("provider_jobs")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "business_members", await ctx.db.query("business_members")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "business_email_settings", await ctx.db.query("business_email_settings")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "lead_email_tokens", await ctx.db.query("lead_email_tokens")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "email_sends", await ctx.db.query("email_sends")
    .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "enrollments", await ctx.db.query("enrollments")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "sequence_steps", await ctx.db.query("sequence_steps")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "sequences", await ctx.db.query("sequences")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "social_posts", await ctx.db.query("social_posts")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "social_accounts", await ctx.db.query("social_accounts")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "ad_campaigns", await ctx.db.query("ad_campaigns")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "outbound_messages", await ctx.db.query("outbound_messages")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "outbound_lists", await ctx.db.query("outbound_lists")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "lead_retention_jobs", await ctx.db.query("lead_retention_jobs")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "leads", await ctx.db.query("leads")
    .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "site_versions", await ctx.db.query("site_versions")
    .withIndex("by_projectId_and_status_and_createdAt", (q) => q.eq("projectId", projectId)).take(Math.min(limit, HEAVY_ROW_CAP)),
  Math.min(limit, HEAVY_ROW_CAP), (row) => removeStoredFile(ctx, (row as Doc<"site_versions">).storageId)),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "site_configs", await ctx.db.query("site_configs")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "document_citations", await ctx.db.query("document_citations")
    .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "documents", await ctx.db.query("documents")
    .withIndex("by_projectId_and_updatedAt", (q) => q.eq("projectId", projectId)).take(Math.min(limit, HEAVY_ROW_CAP)),
  Math.min(limit, HEAVY_ROW_CAP), (row) => removeStoredFile(ctx, (row as Doc<"documents">).storageId)),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "workflow_runs", await ctx.db.query("workflow_runs")
    .withIndex("by_projectId_and_status_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "task_steps", await ctx.db.query("task_steps")
    .withIndex("by_projectId_and_status_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "tasks", await ctx.db.query("tasks")
    .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "submissions", await ctx.db.query("submissions")
    .withIndex("by_projectId_and_status_and_createdAt", (q) => q.eq("projectId", projectId)).take(limit), limit),
  async (ctx, ownerId, projectId, limit) => removeRows(ctx, "briefs", await ctx.db.query("briefs")
    .withIndex("by_ownerId_and_projectId_and_revision", (q) => q.eq("ownerId", ownerId).eq("projectId", projectId)).take(limit), limit),
];

export type OwnerDrain = (ctx: MutationCtx, ownerId: Id<"users">, limit: number) => Promise<DrainResult>;

/** Prefix range that covers every session of one user in `user:<userId>|<sessionId>` keys. */
export function voterKeyRange(ownerId: Id<"users">): { from: string; to: string } {
  // "|" is 0x7C and "}" is 0x7D, so [from, to) holds exactly the keys that start `user:<id>|`.
  return { from: `user:${ownerId}|`, to: `user:${ownerId}}` };
}

export const ANONYMISED_SUBMITTER_KEY = "deleted";

/** Rows the founder owns outside any business. */
export const OWNER_DRAINS: readonly OwnerDrain[] = [
  async (ctx, ownerId, limit) => removeRows(ctx, "member_activity", await ctx.db.query("member_activity")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "wizard_sessions", await ctx.db.query("wizard_sessions")
    .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "founder_signals", await ctx.db.query("founder_signals")
    .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "wizard_idea_improvements", await ctx.db.query("wizard_idea_improvements")
    .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "idea_intents", await ctx.db.query("idea_intents")
    .withIndex("by_ownerId_and_ideaId", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "user_preferences", await ctx.db.query("user_preferences")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "weekend_plans", await ctx.db.query("weekend_plans")
    .withIndex("by_ownerId_and_status_and_updatedAt", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "collection_items", await ctx.db.query("collection_items")
    .withIndex("by_ownerId_and_ideaId", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "collections", await ctx.db.query("collections")
    .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "idea_notes", await ctx.db.query("idea_notes")
    .withIndex("by_ownerId_and_ideaId", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "saved_ideas", await ctx.db.query("saved_ideas")
    .withIndex("by_user", (q) => q.eq("userId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "workspace_cohort", await ctx.db.query("workspace_cohort")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "business_members", await ctx.db.query("business_members")
    .withIndex("by_userId", (q) => q.eq("userId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "account_closure_jobs", await ctx.db.query("account_closure_jobs")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => removeRows(ctx, "account_beehiiv_sync", await ctx.db.query("account_beehiiv_sync")
    .withIndex("by_user", (q) => q.eq("userId", ownerId)).take(limit), limit),
  async (ctx, ownerId, limit) => {
    const cap = Math.min(limit, HEAVY_ROW_CAP);
    return removeRows(ctx, "preview_capabilities", await ctx.db.query("preview_capabilities")
      .withIndex("by_claimedByUserId_and_createdAt", (q) => q.eq("claimedByUserId", ownerId)).take(cap), cap);
  },
  // A founder's votes on public idea requests: take the vote back, keep the count honest.
  async (ctx, ownerId, limit) => {
    const { from, to } = voterKeyRange(ownerId);
    const votes = await ctx.db.query("idea_request_votes")
      .withIndex("by_voterKey", (q) => q.gte("voterKey", from).lt("voterKey", to)).take(limit);
    for (const vote of votes) {
      const request = await ctx.db.get("idea_requests", vote.requestId);
      if (request !== null) {
        await ctx.db.patch("idea_requests", request._id, { voteCount: Math.max(0, request.voteCount - 1) });
      }
      await ctx.db.delete("idea_request_votes", vote._id);
    }
    return { deleted: votes.length, exhausted: votes.length < limit };
  },
  // Their own suggestions stay as public text, without their identity.
  async (ctx, ownerId, limit) => {
    const { from, to } = voterKeyRange(ownerId);
    const requests = await ctx.db.query("idea_requests")
      .withIndex("by_submitterKey", (q) => q.gte("submitterKey", from).lt("submitterKey", to)).take(limit);
    for (const request of requests) {
      await ctx.db.patch("idea_requests", request._id, { submitterKey: ANONYMISED_SUBMITTER_KEY });
    }
    return { deleted: requests.length, exhausted: requests.length < limit };
  },
];

export type AuthDrainResult = DrainResult;

/** Sign-in records for one user: codes and accounts first, then sessions with their refresh tokens. */
export async function drainAuth(ctx: MutationCtx, userId: Id<"users">, limit: number): Promise<AuthDrainResult> {
  let deleted = 0;
  const accounts = await ctx.db.query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).take(limit);
  for (const account of accounts) {
    const codes = await ctx.db.query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id)).take(limit);
    for (const code of codes) await ctx.db.delete("authVerificationCodes", code._id);
    deleted += codes.length;
    if (codes.length >= limit) return { deleted, exhausted: false };
    await ctx.db.delete("authAccounts", account._id);
    deleted += 1;
  }
  if (accounts.length >= limit) return { deleted, exhausted: false };

  const sessions = await ctx.db.query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId)).take(limit);
  for (const session of sessions) {
    const tokens = await ctx.db.query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id)).take(limit);
    for (const token of tokens) await ctx.db.delete("authRefreshTokens", token._id);
    deleted += tokens.length;
    if (tokens.length >= limit) return { deleted, exhausted: false };
    await ctx.db.delete("authSessions", session._id);
    deleted += 1;
  }
  return { deleted, exhausted: sessions.length < limit };
}
