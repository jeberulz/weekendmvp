import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const MAX_ATTEMPTS = 5;
const BASE_RETRY_MS = 60_000;
const LEASE_MS = 10 * 60_000;

type Env = Record<string, string | undefined>;
type Outcome = { state: "synced" | "skipped"; result: string };

class SyncFailure extends Error {
  constructor(readonly retryable: boolean, readonly reason: string) {
    super(reason);
  }
}

function requireConfig(env: Env) {
  const key = env.BEEHIIV_API_KEY?.trim();
  const publicationId = env.BEEHIIV_PUBLICATION_ID?.trim();
  const automationId = env.BEEHIIV_ACCOUNT_AUTOMATION_ID?.trim();
  const field = env.BEEHIIV_ACCOUNT_FIELD?.trim();
  if (!key || !publicationId || (!automationId && !field)) throw new SyncFailure(false, "configuration_required");
  return { key, publicationId, automationId, field };
}

// Beehiiv can accept a subscription while dropping an unknown custom field.
async function checkFieldResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!body?.data?.id || body.warnings?.length) throw new SyncFailure(false, "field_confirmation_required");
}

/** Pure HTTP seam; no provider body, email or key is put into errors/logs. */
export async function syncBeehiivAccount(email: string, env: Env, transport: typeof fetch = fetch): Promise<Outcome> {
  const { key, publicationId, automationId, field } = requireConfig(env);
  const base = `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}`;
  const customFields = field ? [{ name: field, value: "true" }] : undefined;
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  let lookup: Response;
  try {
    lookup = await transport(`${base}/subscriptions/by_email/${encodeURIComponent(email)}`, { headers, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new SyncFailure(true, "lookup_unavailable");
  }
  if (lookup.status !== 404 && !lookup.ok) {
    throw new SyncFailure(lookup.status === 429 || lookup.status >= 500, "lookup_failed");
  }

  if (lookup.status === 404) {
    let created: Response;
    try {
      created = await transport(`${base}/subscriptions`, {
        method: "POST", headers, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          email, reactivate_existing: false, send_welcome_email: false,
          double_opt_override: "on", automation_ids: automationId ? [automationId] : undefined, custom_fields: customFields,
          utm_source: "platform_account", utm_medium: "account_creation",
        }),
      });
    } catch {
      // A timed-out write may have succeeded. A retry could enroll twice.
      throw new SyncFailure(false, "create_outcome_unknown");
    }
    if (!created.ok) throw new SyncFailure(created.status === 429, "create_failed");
    if (field) await checkFieldResponse(created);
    return { state: "synced", result: "new_double_opt_in" };
  }

  let payload: unknown;
  try { payload = await lookup.json(); } catch { throw new SyncFailure(true, "lookup_invalid"); }
  const data = typeof payload === "object" && payload !== null && "data" in payload
    ? (payload as { data: unknown }).data : null;
  const status = typeof data === "object" && data !== null && "status" in data
    ? (data as { status: unknown }).status : null;
  if (typeof status !== "string") throw new SyncFailure(true, "lookup_invalid");
  const pendingConfirmation = status === "validating" || status === "pending";
  if (status !== "active" && !(field && pendingConfirmation)) return { state: "skipped", result: "existing_not_active" };

  if (field) {
    const id = data && typeof data === "object" && "id" in data ? data.id : null;
    if (typeof id !== "string" || !id.startsWith("sub_")) throw new SyncFailure(true, "lookup_invalid");
    let update: Response;
    try {
      update = await transport(`${base}/subscriptions/${encodeURIComponent(id)}`, {
        method: "PATCH", headers, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ custom_fields: customFields }),
      });
    } catch {
      throw new SyncFailure(true, "field_update_unavailable");
    }
    if (!update.ok) throw new SyncFailure(update.status === 429 || update.status >= 500, "field_update_failed");
    await checkFieldResponse(update);
    if (pendingConfirmation) return { state: "synced", result: "existing_pending_marked" };
  }

  if (!automationId) return { state: "synced", result: "existing_active_marked" };
  let journey: Response;
  try {
    journey = await transport(`${base}/automations/${encodeURIComponent(automationId)}/journeys`, {
      method: "POST", headers, signal: AbortSignal.timeout(15_000), body: JSON.stringify({ email }),
    });
  } catch {
    throw new SyncFailure(false, "journey_outcome_unknown");
  }
  if (!journey.ok) throw new SyncFailure(journey.status === 429, "journey_failed");
  return { state: "synced", result: "existing_active_enrolled" };
}

export const claim = internalMutation({
  args: { userId: v.id("users") },
  returns: v.union(v.object({ email: v.string() }), v.null()),
  handler: async (ctx, { userId }) => {
    const row = await ctx.db.query("account_beehiiv_sync").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!row || row.state === "synced" || row.state === "skipped" || row.state === "failed") return null;
    if (row.state === "processing") {
      if (Date.now() - row.updatedAt >= LEASE_MS - 30_000) {
        await ctx.db.patch(row._id, { state: "failed", result: "worker_outcome_unknown", updatedAt: Date.now() });
      }
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user?.emailVerificationTime || user.accountClosureRequestedAt !== undefined || user.isAnonymous || user.email !== row.email) {
      await ctx.db.patch(row._id, { state: "skipped", result: "account_ineligible", updatedAt: Date.now() });
      return null;
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch(row._id, { state: "failed", result: "retry_limit", updatedAt: Date.now() });
      return null;
    }
    await ctx.db.patch(row._id, { state: "processing", attempts: row.attempts + 1, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(LEASE_MS, internal.accountBeehiiv.sync, { userId });
    return { email: row.email };
  },
});

export const finish = internalMutation({
  args: {
    userId: v.id("users"),
    outcome: v.union(v.literal("synced"), v.literal("skipped"), v.literal("retry"), v.literal("failed")),
    result: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, outcome, result }) => {
    const row = await ctx.db.query("account_beehiiv_sync").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!row || row.state !== "processing") return null;
    const retry = outcome === "retry" && row.attempts < MAX_ATTEMPTS;
    await ctx.db.patch(row._id, {
      state: retry ? "pending" : outcome === "retry" ? "failed" : outcome,
      result: retry ? result : outcome === "retry" ? `${result}:retry_limit` : result,
      updatedAt: Date.now(),
    });
    if (retry) await ctx.scheduler.runAfter(BASE_RETRY_MS * 2 ** (row.attempts - 1), internal.accountBeehiiv.sync, { userId });
    return null;
  },
});

/** Operator recovery after fixing configuration or a read-only lookup outage. */
export const retryFailed = internalMutation({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const row = await ctx.db.query("account_beehiiv_sync").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!row || row.state !== "failed" || !(
      row.result === "configuration_required" || row.result?.startsWith("lookup_")
    )) return false;
    await ctx.db.patch(row._id, { state: "pending", attempts: 0, result: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.accountBeehiiv.sync, { userId });
    return true;
  },
});

export const sync = internalAction({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const claimed: { email: string } | null = await ctx.runMutation(internal.accountBeehiiv.claim, { userId });
    if (!claimed) return null;
    try {
      const outcome = await syncBeehiivAccount(claimed.email, process.env);
      await ctx.runMutation(internal.accountBeehiiv.finish, { userId, outcome: outcome.state, result: outcome.result });
    } catch (error) {
      const failure = error instanceof SyncFailure ? error : new SyncFailure(true, "unexpected_failure");
      await ctx.runMutation(internal.accountBeehiiv.finish, {
        userId, outcome: failure.retryable ? "retry" : "failed", result: failure.reason,
      });
    }
    return null;
  },
});

/** Inspect one page before opting into writes. Never replay a possibly successful provider write. */
export const reconcileAccounts = internalMutation({
  args: { paginationOpts: paginationOptsValidator, apply: v.optional(v.boolean()) },
  handler: async (ctx, { paginationOpts, apply }) => {
    const { page, isDone, continueCursor } = await ctx.db.query("users").paginate({
      ...paginationOpts, numItems: Math.min(50, paginationOpts.numItems),
    });
    const counts = { missing: 0, configurationFailed: 0, ineligible: 0, unchanged: 0 };
    for (const user of page) {
      if (!user.email || !user.emailVerificationTime || user.isAnonymous || user.accountClosureRequestedAt !== undefined) {
        counts.ineligible++;
        continue;
      }
      const row = await ctx.db.query("account_beehiiv_sync").withIndex("by_user", q => q.eq("userId", user._id)).unique();
      if (row && (row.state !== "failed" || row.result !== "configuration_required" || row.email !== user.email)) {
        counts.unchanged++;
        continue;
      }
      if (row) counts.configurationFailed++;
      else counts.missing++;
      if (!apply) continue;
      const pending = { state: "pending" as const, attempts: 0, updatedAt: Date.now() };
      if (row) await ctx.db.patch("account_beehiiv_sync", row._id, { ...pending, result: undefined });
      else await ctx.db.insert("account_beehiiv_sync", { ...pending, userId: user._id, email: user.email });
      await ctx.scheduler.runAfter((counts.missing + counts.configurationFailed) * 1500, internal.accountBeehiiv.sync, { userId: user._id });
    }
    return { counts, isDone, continueCursor };
  },
});
