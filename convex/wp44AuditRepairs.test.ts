/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import { expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { selectLibrary, searchMatch, type RankedCard } from "./platform/libraryResults";
const control = vi.hoisted(() => ({ plan: "free" }));
vi.mock("./platform/planResolver", () => ({ resolvePlan: async () => control.plan }));
const modules = import.meta.glob("/convex/**/*.ts");
async function setup(count: number) {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "audit@example.test" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9999999999999 });
    const ids = [];
    for (let i = 0; i < count; i++) {
      const ideaId = await ctx.db.insert("ideas", {
        slug: `idea-${i}`,
        title: "Common",
        description: "Invoice workflow",
        publishedAt: i,
        category: i === 0 ? "rare" : "saas",
        buildTime: "10",
        revenueGoal: "5k-month",
        applicationCategory: "BusinessApplication",
        tools: ["cursor", "claude", "v0", "bolt", "windsurf"],
        audiences: [],
        bodyMode: "mdx",
      });
      ids.push(ideaId);
      await ctx.db.insert("idea_intents", {
        ownerId: userId,
        ideaId,
        saved: i % 2 === 0,
        interested: i % 2 === 1,
        updatedAt: i,
      });
    }
    return { userId, sessionId, ids };
  });
  const member = t.withIdentity({
    subject: `${data.userId}|${data.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${data.userId}`,
  });
  return { t, member, ...data };
}
test("native catalogue/saves traverse 1005 records once and filters find an old match beyond every previous cap", async () => {
  control.plan = "free";
  const { member } = await setup(1005);
  const cards: RankedCard[] = [];
  let cursor: string | null = null;
  let done = false;
  while (!done) {
    const result: FunctionReturnType<typeof api.platform.ideas.libraryPage> = await member.query(
      api.platform.ideas.libraryPage,
      { paginationOpts: { numItems: 80, cursor } },
    );
    cards.push(...result.page);
    cursor = result.continueCursor;
    done = result.isDone;
  }
  expect(cards).toHaveLength(1005);
  expect(new Set(cards.map((card) => card.ideaId)).size).toBe(1005);
  const found = selectLibrary(cards, {
    view: "all",
    search: "com invo",
    category: "rare",
    tools: ["windsurf"],
    hours: "12",
    goal: "5k-month",
  });
  expect(found.items.map((card) => card.slug)).toEqual(["idea-0"]);
  expect(found.total).toBe(1);
  expect(found.facets.category.reduce((sum, row) => sum + row.count, 0)).toBe(1005);
  const all = selectLibrary([...cards, cards[0]], { view: "all", sort: "newest" });
  expect(all.total).toBe(1005);
  expect(all.items.at(-1)?.slug).toBe("idea-0");
  cursor = null;
  done = false;
  const saved = [];
  while (!done) {
    const result: FunctionReturnType<typeof api.platform.dashboard.savedPage> = await member.query(
      api.platform.dashboard.savedPage,
      { paginationOpts: { numItems: 80, cursor } },
    );
    saved.push(...result.page);
    cursor = result.continueCursor;
    done = result.isDone;
  }
  expect(saved).toHaveLength(1005);
  expect(new Set(saved.map((row) => row.card.ideaId)).size).toBe(1005);
  expect(saved.at(-1)?.card.slug).toBe("idea-0");
}, 30_000);
test("sparse Saved pages bound scans and traverse empty continuations past 1000 unsaved rows", async () => {
  const { t, member, userId } = await setup(1005);
  await t.run(async (ctx) => {
    const intents = await ctx.db
      .query("idea_intents")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", userId))
      .collect();
    for (const intent of intents) {
      await ctx.db.patch("idea_intents", intent._id, {
        saved: intent.updatedAt === 0,
        interested: false,
      });
    }
  });
  let cursor: string | null = null;
  let done = false;
  let emptyPages = 0;
  const slugs: string[] = [];
  let pages = 0;
  while (!done && pages < 10) {
    const result: FunctionReturnType<typeof api.platform.dashboard.savedPage> = await member.query(
      api.platform.dashboard.savedPage,
      { paginationOpts: { numItems: 50, cursor, maximumRowsRead: 5000 } },
    );
    if (!result.page.length && !result.isDone) emptyPages += 1;
    slugs.push(...result.page.map((row) => row.card.slug));
    if (!result.isDone) expect(result.continueCursor).not.toBe(cursor);
    cursor = result.continueCursor;
    done = result.isDone;
    pages += 1;
  }
  expect(done).toBe(true);
  expect(emptyPages).toBe(5);
  expect(slugs).toEqual(["idea-0"]);
}, 30_000);
test("search token prefix semantics, title preference and absent tokens", () => {
  expect(searchMatch({ title: "Invoice Chaser", description: "Automates reminders" }, "invo cha")).toBe(2);
  expect(searchMatch({ title: "Chaser", description: "Invoice reminders" }, "cha invo")).toBe(1);
  expect(searchMatch({ title: "Chaser", description: "Invoice reminders" }, "invo missing")).toBe(-1);
});
test("stale replacement preserves the newly active plan and repeated confirmed start is idempotent", async () => {
  control.plan = "free";
  const { member } = await setup(3);
  const a = await member.mutation(api.platform.weekendPlans.start, { slug: "idea-0" });
  const c = await member.mutation(api.platform.weekendPlans.start, {
    slug: "idea-2",
    replaceActive: true,
    expectedActivePlanId: a.planId,
  });
  await expect(
    member.mutation(api.platform.weekendPlans.start, {
      slug: "idea-1",
      replaceActive: true,
      expectedActivePlanId: a.planId,
    }),
  ).rejects.toThrow("PLAN_CHANGED");
  expect((await member.query(api.platform.weekendPlans.get, { planId: c.planId })).plan.status).toBe(
    "active",
  );
  expect(
    await member.mutation(api.platform.weekendPlans.start, {
      slug: "idea-2",
      replaceActive: true,
      expectedActivePlanId: a.planId,
    }),
  ).toEqual({ ...c, created: false });
});
test("paid invariants are independent of display windows, downgrade preserves work, archive history can be restored", async () => {
  control.plan = "builders_hub";
  const { member } = await setup(53);
  const plans = [];
  for (let i = 0; i < 51; i++)
    plans.push(await member.mutation(api.platform.weekendPlans.start, { slug: `idea-${i}` }));
  expect(await member.mutation(api.platform.weekendPlans.start, { slug: "idea-0" })).toEqual({
    ...plans[0],
    created: false,
  });
  expect((await member.query(api.platform.entitlements.mine, {})).usage).toEqual({
    activeWeekendPlans: 50,
    activeWeekendPlansCapped: true,
  });
  let cursor: string | null = null;
  const history = [];
  do {
    const result: FunctionReturnType<typeof api.platform.weekendPlans.history> = await member.query(
      api.platform.weekendPlans.history,
      { status: "active", paginationOpts: { numItems: 15, cursor } },
    );
    history.push(...result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor);
  expect(history).toHaveLength(51);
  control.plan = "free";
  await expect(
    member.mutation(api.platform.weekendPlans.start, {
      slug: "idea-52",
      replaceActive: true,
      expectedActivePlanId: plans[50].planId,
    }),
  ).rejects.toThrow("PLAN_LIMIT");
  for (const plan of plans) await member.mutation(api.platform.weekendPlans.archive, { planId: plan.planId });
  await member.mutation(api.platform.weekendPlans.restore, { planId: plans[0].planId });
  await expect(
    member.mutation(api.platform.weekendPlans.restore, { planId: plans[1].planId }),
  ).rejects.toThrow("PLAN_LIMIT");
  expect((await member.query(api.platform.weekendPlans.get, { planId: plans[0].planId })).plan.status).toBe(
    "active",
  );
  const archived = await member.query(api.platform.weekendPlans.history, {
    status: "archived",
    paginationOpts: { numItems: 60, cursor: null },
  });
  expect(archived.page).toHaveLength(50);
});
test("legacy API names retain response contracts and owner boundaries", async () => {
  control.plan = "free";
  const { t, member, ids } = await setup(2);
  const home = await member.query(api.platform.ideas.dashboardSummary, {});
  expect(Object.keys(home).sort()).toEqual(["creditBalance", "projects", "recentIntents", "userName"]);
  expect(home.recentIntents).toHaveLength(2);
  const result = await member.query(api.platform.ideas.explore, {
    view: "all",
    sort: "newest",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(result.page).toHaveLength(2);
  expect(typeof result.page[0].buildTime).toBe("string");
  expect(
    await member.mutation(api.platform.ideas.setIntent, { ideaId: ids[0], flag: "interested", value: true }),
  ).toMatchObject({ saved: true, interested: true });
  await expect(t.query(api.platform.ideas.dashboardSummary, {})).rejects.toThrow("UNAUTHENTICATED");
  await expect(
    t.mutation(api.platform.ideas.setIntent, { ideaId: ids[0], flag: "saved", value: false }),
  ).rejects.toThrow("UNAUTHENTICATED");
});
test("soft deletion hides collections/items/notes without erasing stored records", async () => {
  control.plan = "builders_hub";
  const { t, member } = await setup(1);
  const { collectionId } = await member.mutation(api.platform.collections.create, { name: "Keep" });
  await member.mutation(api.platform.collections.addIdea, { collectionId, slug: "idea-0" });
  await member.mutation(api.platform.collections.removeIdea, { collectionId, slug: "idea-0" });
  expect((await member.query(api.platform.collections.items, { collectionId })).items).toEqual([]);
  await member.mutation(api.platform.collections.addIdea, { collectionId, slug: "idea-0" });
  expect((await member.query(api.platform.collections.items, { collectionId })).collection.count).toBe(1);
  expect(await t.run((ctx) => ctx.db.query("collection_items").collect())).toHaveLength(1);
  await member.mutation(api.platform.notes.save, { slug: "idea-0", body: "Private note" });
  await member.mutation(api.platform.notes.save, { slug: "idea-0", body: "" });
  expect(await member.query(api.platform.notes.get, { slug: "idea-0" })).toBeNull();
  expect((await t.run((ctx) => ctx.db.query("idea_notes").collect()))[0]).toMatchObject({
    body: "Private note",
    deletedAt: expect.any(Number),
  });
  await member.mutation(api.platform.notes.save, { slug: "idea-0", body: "Restored note" });
  expect((await member.query(api.platform.notes.get, { slug: "idea-0" }))?.body).toBe("Restored note");
  await member.mutation(api.platform.collections.remove, { collectionId });
  expect(await member.query(api.platform.collections.list, {})).toEqual([]);
  await expect(member.query(api.platform.collections.items, { collectionId })).rejects.toThrow(
    "RESOURCE_NOT_FOUND",
  );
  expect((await t.run((ctx) => ctx.db.get("collections", collectionId)))?.deletedAt).toEqual(
    expect.any(Number),
  );
});

test("fresh route membership rejects missing, expired and revoked sessions", async () => {
  const { t, member, sessionId } = await setup(0);
  await expect(t.mutation(api.platform.dashboard.requireMember, {})).rejects.toThrow("UNAUTHENTICATED");
  expect(await member.mutation(api.platform.dashboard.requireMember, {})).toBeNull();
  await t.run((ctx) => ctx.db.patch("authSessions", sessionId, { expirationTime: 0 }));
  await expect(member.mutation(api.platform.dashboard.requireMember, {})).rejects.toThrow("UNAUTHENTICATED");
  await t.run((ctx) => ctx.db.delete("authSessions", sessionId));
  await expect(member.mutation(api.platform.dashboard.requireMember, {})).rejects.toThrow("UNAUTHENTICATED");
});

test("canonical retirement removes discovery/new plans but preserves existing saved research", async () => {
  control.plan = "free";
  const { t, member, ids } = await setup(1);
  await t.run((ctx) => ctx.db.patch("ideas", ids[0], { slug: "client-portal" }));
  const catalog = await member.query(api.platform.ideas.libraryPage, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(catalog.page).toEqual([]);
  expect(catalog.isDone).toBe(true);
  await expect(member.mutation(api.platform.weekendPlans.start, { slug: "client-portal" })).rejects.toThrow(
    "RESOURCE_NOT_FOUND",
  );
  expect(
    (await member.query(api.platform.dashboard.savedPage, { paginationOpts: { numItems: 20, cursor: null } }))
      .page[0].card.slug,
  ).toBe("client-portal");
});

test("save version fences a delayed older request even when the latest intent leaves state unchanged", async () => {
  const { t, member, ids } = await setup(1);
  await t.run(async (ctx) => {
    const row = await ctx.db.query("idea_intents").first();
    await ctx.db.patch("idea_intents", row!._id, { saved: false, interested: false });
  });
  // Requests were issued Save then Unsave. The older HTTP request reaches
  // Convex only after the newer one. Same-state writes must still increment.
  expect(
    await member.mutation(api.platform.dashboard.setSaved, {
      slug: "idea-0",
      saved: false,
      expectedVersion: 0,
    }),
  ).toEqual({ saved: false, version: 1 });
  await expect(
    member.mutation(api.platform.dashboard.setSaved, { slug: "idea-0", saved: true, expectedVersion: 0 }),
  ).rejects.toThrow("SAVE_CONFLICT");
  expect(await member.query(api.platform.dashboard.savedState, { slug: "idea-0" })).toEqual({
    saved: false,
    version: 1,
  });
  // An older frontend writer participates in the same fence without changing
  // its historical response shape or independent Interested semantics.
  await member.mutation(api.platform.ideas.setIntent, { ideaId: ids[0], flag: "interested", value: true });
  expect(await member.query(api.platform.dashboard.savedState, { slug: "idea-0" })).toEqual({
    saved: true,
    version: 2,
  });
  await expect(
    member.mutation(api.platform.dashboard.setSaved, { slug: "idea-0", saved: false, expectedVersion: 1 }),
  ).rejects.toThrow("SAVE_CONFLICT");
});

test("lost successful response is reconciled before reasserting the latest save choice", async () => {
  const { member } = await setup(1);
  // First request commits, but its response is lost to the client.
  await member.mutation(api.platform.dashboard.setSaved, { slug: "idea-0", saved: true, expectedVersion: 0 });
  await expect(
    member.mutation(api.platform.dashboard.setSaved, { slug: "idea-0", saved: false, expectedVersion: 0 }),
  ).rejects.toThrow("SAVE_CONFLICT");
  const current = await member.query(api.platform.dashboard.savedState, { slug: "idea-0" });
  expect(current).toEqual({ saved: true, version: 1 });
  expect(
    await member.mutation(api.platform.dashboard.setSaved, {
      slug: "idea-0",
      saved: false,
      expectedVersion: current!.version,
    }),
  ).toEqual({ saved: false, version: 2 });
  await expect(
    member.mutation(api.platform.dashboard.setSaved, { slug: "idea-0", saved: true, expectedVersion: -1 }),
  ).rejects.toThrow("INVALID_VERSION");
});

test("unsaving an absent intent writes a fence and unrelated accounts keep independent versions", async () => {
  const { t, member, userId } = await setup(1);
  await t.run(async (ctx) => {
    const row = await ctx.db.query("idea_intents").first();
    await ctx.db.delete("idea_intents", row!._id);
  });
  expect(
    await member.mutation(api.platform.dashboard.setSaved, {
      slug: "idea-0",
      saved: false,
      expectedVersion: 0,
    }),
  ).toEqual({ saved: false, version: 1 });
  const other = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { email: "other@example.test" });
    const session = await ctx.db.insert("authSessions", { userId: id, expirationTime: 9999999999999 });
    return { id, session };
  });
  const stranger = t.withIdentity({
    subject: `${other.id}|${other.session}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${other.id}`,
  });
  expect(await stranger.query(api.platform.dashboard.savedState, { slug: "idea-0" })).toEqual({
    saved: false,
    version: 0,
  });
  await stranger.mutation(api.platform.dashboard.setSaved, {
    slug: "idea-0",
    saved: true,
    expectedVersion: 0,
  });
  expect(await member.query(api.platform.dashboard.savedState, { slug: "idea-0" })).toEqual({
    saved: false,
    version: 1,
  });
  expect(userId).not.toBe(other.id);
});
