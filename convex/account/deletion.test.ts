/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
type T = TestConvex<typeof schema>;

const EMAIL_A = "founder-a@example.test";
const EMAIL_B = "founder-b@example.test";
const NAME_A = "Avery Founder";
const SECRET_TITLE = "Avery's secret pet-sitting marketplace";
const SECRET_CHAT = "my private launch worry about my landlord";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function asUser(t: T, userId: Id<"users">, sessionId: Id<"authSessions">) {
  return t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
}

type Seeded = { userId: Id<"users">; sessionId: Id<"authSessions">; projectId: Id<"projects">; ideaId: Id<"ideas"> };

/** One founder with a business and rows in every kind of table WP96 touches. */
async function seedFounder(t: T, input: { email: string; name: string; title: string; chat: string; ideaId?: Id<"ideas"> }): Promise<Seeded> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", { email: input.email, name: input.name, displayName: input.name, emailVerificationTime: now, stripeCustomerId: `cus_${input.email.slice(8, 9)}` });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + 3_600_000 });
    await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: now + 3_600_000 });
    const accountId = await ctx.db.insert("authAccounts", { userId, provider: "resend", providerAccountId: input.email, emailVerified: input.email });
    await ctx.db.insert("authVerificationCodes", { accountId, provider: "resend", code: `code-${input.email}`, expirationTime: now + 1000, emailVerified: input.email });

    const ideaId = input.ideaId ?? await ctx.db.insert("ideas", {
      slug: `idea-${userId}`, title: "Public idea", description: "A plain description", publishedAt: 0, category: "saas",
      buildTime: "10", revenueGoal: "5k-month", applicationCategory: "BusinessApplication", tools: ["cursor"],
      audiences: ["solo-founders"], bodyMode: "mdx",
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId: userId, source: "own_idea", title: input.title, status: "draft", idempotencyKey: `p:${userId}`, createdAt: now, updatedAt: now,
    });
    const storageId = await ctx.storage.store(new Blob(["logo bytes"]));
    const siteConfigId = await ctx.db.insert("site_configs", { ownerId: userId, projectId, status: "draft", createdAt: now, updatedAt: now });
    const taskId = await ctx.db.insert("tasks", { ownerId: userId, projectId, type: "crew_blueprint", status: "queued", title: input.title, idempotencyKey: `t:${userId}`, createdAt: now, updatedAt: now });
    const documentId = await ctx.db.insert("documents", { ownerId: userId, projectId, taskId, kind: "landing_spec", format: "json", title: input.title, body: input.title, storageId, createdAt: now, updatedAt: now });
    await ctx.db.insert("document_citations", { ownerId: userId, projectId, documentId, position: 0n, url: "https://example.test", title: "t", createdAt: now });
    await ctx.db.insert("site_versions", { ownerId: userId, projectId, siteConfigId, status: "ready", version: 1n, documentId, landingSpec: input.title, createdAt: now });
    await ctx.db.insert("leads", { ownerId: userId, projectId, siteConfigId, synthetic: true, email: "lead@example.test", createdAt: now });
    const approvalId = await ctx.db.insert("approvals", { ownerId: userId, projectId, kind: "artifact_review", subjectTable: "documents", subjectId: documentId, status: "pending", changeRound: 0n, createdAt: now, updatedAt: now });
    await ctx.db.insert("chat_messages", { ownerId: userId, projectId, author: "founder", body: input.chat, status: "done", cardApprovalIds: [approvalId], createdAt: now, updatedAt: now });
    await ctx.db.insert("wren_memory", { ownerId: userId, projectId, facts: [input.chat], summary: input.chat, updatedAt: now });
    const crewId = await ctx.db.insert("crew_members", { ownerId: userId, projectId, roleKey: "lead", displayName: "Wren", status: "done", hiredBy: "rule", autopilot: false, createdAt: now, updatedAt: now });
    await ctx.db.insert("workstreams", { ownerId: userId, projectId, employeeId: crewId, title: "w", status: "done", documentIds: [documentId], fileIds: [], createdAt: now, updatedAt: now });
    await ctx.db.insert("business_files", { ownerId: userId, projectId, storageId: await ctx.storage.store(new Blob(["x"])), kind: "logo", mime: "image/png", bytes: 1, alt: "logo", createdAt: now });
    await ctx.db.insert("sequences", { ownerId: userId, projectId, status: "draft", title: "s", createdAt: now, updatedAt: now });
    await ctx.db.insert("business_members", { ownerId: userId, projectId, userId, role: "owner", invitedBy: userId, createdAt: now });
    await ctx.db.insert("wizard_sessions", { ownerId: userId, ownIdeaText: input.title, step: "idea", answers: {}, startedAt: now, updatedAt: now, projectId });
    await ctx.db.insert("idea_intents", { ownerId: userId, ideaId, saved: true, interested: true, updatedAt: now });
    await ctx.db.insert("saved_ideas", { userId, ideaId, savedAt: now });
    await ctx.db.insert("idea_notes", { ownerId: userId, ideaId, body: input.chat, updatedAt: now });
    await ctx.db.insert("user_preferences", { ownerId: userId, tools: ["cursor"], updatedAt: now });
    await ctx.db.insert("subscriptions", { email: input.email, normalizedEmail: input.email, source: "test", automationIds: [], createdAt: now });
    await ctx.db.insert("account_beehiiv_sync", { userId, email: input.email, state: "synced", attempts: 1, updatedAt: now });

    // Rows that must survive.
    await ctx.db.insert("ai_usage", {
      ownerId: userId, projectId, taskId, attemptKey: `usage:${userId}`, promptRef: "fixture@1", provider: "fixture", model: "fixture",
      tier: "draft", feature: "ai", globalPool: "free", creditFunded: false, status: "settled", reservedMicroUsd: 500n, costMicroUsd: 321n,
      inputTokens: 10n, cacheReadTokens: 0n, cacheWriteTokens: 0n, outputTokens: 5n, estimated: false, latencyMs: 5,
      createdAt: now, dayKey: "2026-11-20", expiresAt: now + 1000,
    });
    await ctx.db.insert("ai_budgets", { ownerId: userId, freeLifetimeSpentMicroUsd: 321n, reservedMicroUsd: 0n, freeReservedMicroUsd: 0n, dayKey: "2026-11-20", daySpentMicroUsd: 321n, dayEscalations: 0n, updatedAt: now });
    const accountRowId = await ctx.db.insert("credit_accounts", { ownerId: userId, balance: 50n, createdAt: now, updatedAt: now });
    await ctx.db.insert("credit_ledger", { ownerId: userId, accountId: accountRowId, reason: "starter_grant", delta: 50n, balanceAfter: 50n, idempotencyKey: `starter:${userId}`, createdAt: now });
    await ctx.db.insert("audit_events", { ownerId: userId, projectId, actorType: "user", actorUserId: userId, action: "business.created", subjectType: "project", subjectId: projectId, metadata: JSON.stringify({ note: input.chat }), createdAt: now });
    return { userId, sessionId, projectId, ideaId };
  });
}

async function everyRowAsText(t: T): Promise<string> {
  return await t.run(async (ctx) => {
    const parts: string[] = [];
    for (const table of Object.keys(schema.tables)) {
      const rows = await ctx.db.query(table as never).collect();
      for (const row of rows) parts.push(`${table}:${JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    }
    return parts.join("\n");
  });
}

async function meterSnapshot(t: T) {
  return await t.run(async (ctx) => {
    const usage = await ctx.db.query("ai_usage").collect();
    const budgets = await ctx.db.query("ai_budgets").collect();
    return {
      usage: usage.map((row) => ({ ...row, reservedMicroUsd: row.reservedMicroUsd.toString(), costMicroUsd: row.costMicroUsd.toString() }))
        .map((row) => JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
      totalCost: usage.reduce((sum, row) => sum + row.costMicroUsd, 0n).toString(),
      budgets: budgets.map((row) => JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
    };
  });
}

describe("WP96 account deletion", () => {
  test("removes everything personal, keeps the meter and audit rows, and leaves other founders alone", async () => {
    const t = convexTest(schema, modules);
    const a = await seedFounder(t, { email: EMAIL_A, name: NAME_A, title: SECRET_TITLE, chat: SECRET_CHAT });
    const b = await seedFounder(t, { email: EMAIL_B, name: "Blake Founder", title: "Blake's business", chat: "blake chat", ideaId: a.ideaId });
    const before = await meterSnapshot(t);

    const result = await asUser(t, a.userId, a.sessionId).mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE" });
    expect(result).toEqual({ state: "started" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const text = await everyRowAsText(t);
    for (const needle of [EMAIL_A, NAME_A, SECRET_TITLE, SECRET_CHAT, "code-founder-a"]) {
      expect(text, `leftover: ${needle}`).not.toContain(needle);
    }
    // The other founder is untouched.
    for (const needle of [EMAIL_B, "Blake's business", "blake chat"]) expect(text).toContain(needle);
    expect(await t.run(async (ctx) => (await ctx.db.query("projects").collect()).map((p) => p._id))).toEqual([b.projectId]);

    // The meter did not move: every row is byte-for-byte the same.
    expect(await meterSnapshot(t)).toEqual(before);

    await t.run(async (ctx) => {
      const user = await ctx.db.get("users", a.userId);
      expect(user?.email).toBeUndefined();
      expect(user?.name).toBeUndefined();
      expect(user?.accountClosureRequestedAt).toBeDefined();
      expect(await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", a.userId)).collect()).toHaveLength(0);
      expect(await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", a.userId)).collect()).toHaveLength(0);
      // Financial rows stay.
      expect(await ctx.db.query("credit_ledger").withIndex("by_ownerId_and_idempotencyKey", (q) => q.eq("ownerId", a.userId)).collect()).toHaveLength(1);
      // Audit rows stay, without metadata, plus the two deletion events.
      const audit = await ctx.db.query("audit_events").withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", a.userId)).collect();
      const actions = audit.map((row) => row.action).sort();
      expect(actions).toEqual(["account.deletion_completed", "account.deletion_requested", "business.created"]);
      for (const row of audit) {
        if (row.action !== "account.deletion_completed") expect(row.metadata).toBeUndefined();
      }
      const completed = audit.find((row) => row.action === "account.deletion_completed");
      expect(completed?.metadata).toMatch(/^\{"deletedRows":\d+\}$/);
      // Files are gone from storage.
      expect(await ctx.db.system.query("_storage").collect()).toHaveLength(2); // only B's two files
    });
  });

  test("a user cannot delete someone else, and wrong input changes nothing", async () => {
    const t = convexTest(schema, modules);
    const a = await seedFounder(t, { email: EMAIL_A, name: NAME_A, title: SECRET_TITLE, chat: SECRET_CHAT });
    const b = await seedFounder(t, { email: EMAIL_B, name: "Blake Founder", title: "Blake's business", chat: "blake chat", ideaId: a.ideaId });
    const asB = asUser(t, b.userId, b.sessionId);
    const snapshot = await everyRowAsText(t);

    // No way to name a target: an extra argument is refused by validation.
    await expect(asB.mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE", ownerId: a.userId } as never)).rejects.toThrow();
    // Anonymous and wrong-confirmation calls fail before any write.
    await expect(t.mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE" })).rejects.toThrow("UNAUTHENTICATED");
    await expect(asB.mutation(api.account.deletion.requestDeletion, { confirmation: "delete" })).rejects.toThrow("CONFIRMATION_MISMATCH");
    await expect(asB.mutation(api.account.deletion.requestDeletion, { confirmation: "" })).rejects.toThrow("CONFIRMATION_MISMATCH");
    expect(await everyRowAsText(t)).toEqual(snapshot);

    // The internal step refuses an account that never asked.
    await t.mutation(internal.account.deletion.step, { ownerId: a.userId, deletedRows: 0 });
    expect(await everyRowAsText(t)).toEqual(snapshot);

    // B deleting B leaves A whole.
    await asB.mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const text = await everyRowAsText(t);
    expect(text).not.toContain(EMAIL_B);
    for (const needle of [EMAIL_A, NAME_A, SECRET_TITLE, SECRET_CHAT]) expect(text).toContain(needle);
  });

  test("works in bounded batches that schedule the next one", async () => {
    const t = convexTest(schema, modules);
    const a = await seedFounder(t, { email: EMAIL_A, name: NAME_A, title: SECRET_TITLE, chat: SECRET_CHAT });
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let n = 0; n < 260; n += 1) {
        await ctx.db.insert("chat_messages", { ownerId: a.userId, projectId: a.projectId, author: "wren", body: `message ${n} ${SECRET_CHAT}`, status: "done", cardApprovalIds: [], createdAt: now + n, updatedAt: now + n });
      }
      for (let n = 0; n < 3; n += 1) {
        await ctx.db.insert("projects", { ownerId: a.userId, source: "own_idea", title: `extra ${n} ${SECRET_TITLE}`, status: "draft", idempotencyKey: `extra:${n}`, createdAt: now, updatedAt: now });
      }
    });
    await asUser(t, a.userId, a.sessionId).mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE" });

    let calls = 0;
    let args: { ownerId: Id<"users">; deletedRows: number; auditCursor?: string | null } = { ownerId: a.userId, deletedRows: 0 };
    let sawPartial = false;
    for (; calls < 20; calls += 1) {
      const out = await t.mutation(internal.account.deletion.step, args);
      if (out.done) break;
      // A batch ended early, so something is still waiting for the next one.
      const left = await t.run(async (ctx) => (await ctx.db.query("chat_messages").collect()).length);
      if (left > 0) sawPartial = true;
      // Follow the chain by hand so the test can look between batches.
      const scheduled = await t.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect());
      expect(scheduled.length).toBeGreaterThan(0);
      args = { ...args, deletedRows: args.deletedRows + 1 };
    }
    expect(sawPartial).toBe(true);
    expect(calls).toBeGreaterThan(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const text = await everyRowAsText(t);
    expect(text).not.toContain(SECRET_CHAT);
    expect(text).not.toContain(SECRET_TITLE);
    // Running the chain again after it finished does nothing new.
    const events = await t.run(async (ctx) => (await ctx.db.query("audit_events").collect()).filter((e) => e.action === "account.deletion_completed").length);
    await t.mutation(internal.account.deletion.step, { ownerId: a.userId, deletedRows: 0 });
    const after = await t.run(async (ctx) => (await ctx.db.query("audit_events").collect()).filter((e) => e.action === "account.deletion_completed").length);
    expect(after).toBe(events);
  });

  test("refuses accounts that must not be deleted this way", async () => {
    const t = convexTest(schema, modules);
    const a = await seedFounder(t, { email: EMAIL_A, name: NAME_A, title: SECRET_TITLE, chat: SECRET_CHAT });
    const asA = asUser(t, a.userId, a.sessionId);
    const subscription = (cancelAtPeriodEnd: boolean) => t.run(async (ctx) => await ctx.db.insert("plan_subscriptions", {
      ownerId: a.userId, stripeSubscriptionId: `sub_${cancelAtPeriodEnd}`, stripeCustomerId: "cus_x", term: "monthly", status: "active",
      cancelAtPeriodEnd, snapshotAt: 1, updatedAt: 1, livemode: false,
    }));

    const renewing = await subscription(false);
    expect(await asA.query(api.account.deletion.getDeletionState, {})).toEqual({ blockers: ["paid_subscription"], requested: false });
    const snapshot = await everyRowAsText(t);
    await expect(asA.mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE" })).rejects.toThrow("DELETION_BLOCKED");
    expect(await everyRowAsText(t)).toEqual(snapshot);

    // Cancelled at period end: nothing more will be charged, so deletion may go ahead.
    await t.run(async (ctx) => await ctx.db.patch("plan_subscriptions", renewing, { cancelAtPeriodEnd: true }));
    expect((await asA.query(api.account.deletion.getDeletionState, {})).blockers).toEqual([]);

    await t.run(async (ctx) => await ctx.db.patch("users", a.userId, { platformOwnerAccess: { enabled: true, bypassAiBudget: false, updatedAt: 1 } }));
    expect((await asA.query(api.account.deletion.getDeletionState, {})).blockers).toEqual(["platform_owner"]);
    await expect(asA.mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE" })).rejects.toThrow("DELETION_BLOCKED");
  });

  test("takes back votes, keeps counts honest, and anonymises submitted ideas", async () => {
    const t = convexTest(schema, modules);
    const a = await seedFounder(t, { email: EMAIL_A, name: NAME_A, title: SECRET_TITLE, chat: SECRET_CHAT });
    const b = await seedFounder(t, { email: EMAIL_B, name: "Blake Founder", title: "Blake's business", chat: "blake chat", ideaId: a.ideaId });
    const keyA = `user:${a.userId}|${a.sessionId}`;
    const keyAOtherSession = `user:${a.userId}|someOtherSession`;
    const keyB = `user:${b.userId}|${b.sessionId}`;
    const ids = await t.run(async (ctx) => {
      const mine = await ctx.db.insert("idea_requests", { title: "Mine", normalizedTitle: "mine", problem: "p", submitterKey: keyA, voteCount: 2, status: "open" });
      const theirs = await ctx.db.insert("idea_requests", { title: "Theirs", normalizedTitle: "theirs", problem: "p", submitterKey: keyB, voteCount: 3, status: "open" });
      await ctx.db.insert("idea_request_votes", { requestId: mine, voterKey: keyB });
      await ctx.db.insert("idea_request_votes", { requestId: theirs, voterKey: keyA });
      await ctx.db.insert("idea_request_votes", { requestId: theirs, voterKey: keyAOtherSession });
      await ctx.db.insert("idea_request_votes", { requestId: theirs, voterKey: keyB });
      return { mine, theirs };
    });
    await asUser(t, a.userId, a.sessionId).mutation(api.account.deletion.requestDeletion, { confirmation: "DELETE" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.run(async (ctx) => {
      const votes = await ctx.db.query("idea_request_votes").collect();
      expect(votes.map((vote) => vote.voterKey)).toEqual([keyB, keyB]);
      expect((await ctx.db.get("idea_requests", ids.theirs))?.voteCount).toBe(1);
      const mine = await ctx.db.get("idea_requests", ids.mine);
      expect(mine?.submitterKey).toBe("deleted");
      expect(mine?.title).toBe("Mine");
      expect((await ctx.db.get("idea_requests", ids.theirs))?.submitterKey).toBe(keyB);
    });
  });
});
