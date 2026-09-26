/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { COLLECTIONS_MAX, COLLECTION_ITEMS_MAX, COLLECTION_NAME_MAX } from "./platform/collections";
import { NOTE_MAX } from "./platform/notes";
import schema from "./schema";

// Stand-in for the subscription record (PRD 9.3): members in this set are
// Builder's Hub, everyone else is Free.
const stub = vi.hoisted(() => ({ hubOwners: new Set<string>() }));
vi.mock("./platform/planResolver", () => ({
  resolvePlan: async (_ctx: unknown, ownerId: string) => (stub.hubOwners.has(ownerId) ? "builders_hub" : "free"),
}));

const modules = import.meta.glob("./**/*.ts");

type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };
type T = TestConvex<typeof schema>;

async function seedUser(t: T, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

function asUser(t: T, member: Member) {
  return t.withIdentity({
    subject: `${member.userId}|${member.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${member.userId}`,
  });
}

async function seedIdea(t: T, slug: string, title = slug) {
  return await t.run(async (ctx) =>
    ctx.db.insert("ideas", {
      slug,
      title,
      description: `About ${title}`,
      publishedAt: 0,
      category: "saas",
      buildTime: "10",
      revenueGoal: "5k-month",
      applicationCategory: "BusinessApplication",
      tools: ["cursor", "claude"],
      audiences: [],
      scores: { opportunity: 8, pain: 7, timing: 6, builder_confidence: 9 },
      bodyMode: "mdx",
    }),
  );
}

async function hubMember(t: T, email: string) {
  const member = await seedUser(t, email);
  stub.hubOwners.add(member.userId);
  return { ...member, as: asUser(t, member) };
}

function code(error: unknown) {
  return error instanceof ConvexError ? (error.data as { code?: string; feature?: string }) : null;
}

afterEach(() => {
  stub.hubOwners.clear();
});

describe("WP44-S11 gates on Free", () => {
  test("every Builder's Hub write and view refuses a Free member on the server", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "free@example.test"));
    await seedIdea(t, "a");
    await seedIdea(t, "b");

    const refused = async (promise: Promise<unknown>) => code(await promise.catch((e: unknown) => e));
    expect(await refused(member.mutation(api.platform.collections.create, { name: "Fintech" }))).toEqual({
      code: "UPGRADE_REQUIRED",
      feature: "collections",
    });
    expect(await refused(member.mutation(api.platform.notes.save, { slug: "a", body: "Call Sam" }))).toEqual({
      code: "UPGRADE_REQUIRED",
      feature: "collections",
    });
    expect(await refused(member.query(api.platform.compare.ideas, { slugs: ["a", "b"] }))).toEqual({
      code: "UPGRADE_REQUIRED",
      feature: "compare",
    });
    expect(await refused(member.query(api.platform.promptPack.source, { slug: "a" }))).toEqual({
      code: "UPGRADE_REQUIRED",
      feature: "prompt_pack",
    });
    for (const feature of ["collections", "prompt_pack", "compare"] as const) {
      expect(await refused(member.query(api.platform.entitlements.check, { feature }))).toMatchObject({ feature });
    }
    // Reading and clearing are never gated, and a Free member simply has none.
    expect(await member.query(api.platform.collections.list, {})).toEqual([]);
    await member.mutation(api.platform.notes.save, { slug: "a", body: "   " });
    expect(await member.query(api.platform.notes.get, { slug: "a" })).toBeNull();
  });

  test("anonymous callers are refused", async () => {
    const t = convexTest(schema, modules);
    await seedIdea(t, "a");
    await expect(t.query(api.platform.collections.list, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(api.platform.notes.get, { slug: "a" })).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(api.platform.compare.ideas, { slugs: ["a", "a"] })).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(api.platform.promptPack.source, { slug: "a" })).rejects.toThrow("UNAUTHENTICATED");
  });
});

describe("WP44-S11 collections and notes (Builder's Hub)", () => {
  test("create, rename, add, list, read back, remove", async () => {
    const t = convexTest(schema, modules);
    const hub = await hubMember(t, "hub@example.test");
    const ideaA = await seedIdea(t, "a", "Idea A");
    await seedIdea(t, "b", "Idea B");
    await t.run(async (ctx) => {
      await ctx.db.insert("idea_intents", { ownerId: hub.userId, ideaId: ideaA, saved: true, interested: false, updatedAt: 1 });
    });

    const { collectionId } = await hub.as.mutation(api.platform.collections.create, { name: "  Fintech   shortlist " });
    await hub.as.mutation(api.platform.collections.rename, { collectionId, name: "Weekend in Oct" });
    await hub.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "a" });
    await hub.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "b" });
    // Adding twice changes nothing.
    await hub.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "a" });
    await hub.as.mutation(api.platform.notes.save, { slug: "a", body: "  Ask two accountants first  " });

    expect(await hub.as.query(api.platform.collections.list, {})).toEqual([
      { collectionId, name: "Weekend in Oct", count: 2 },
    ]);
    expect(await hub.as.query(api.platform.collections.forIdea, { slug: "a" })).toEqual([collectionId]);
    const view = await hub.as.query(api.platform.collections.items, { collectionId });
    expect(view.items.map((item) => [item.card.slug, item.card.saved, item.note])).toEqual([
      ["b", false, null],
      ["a", true, "Ask two accountants first"],
    ]);
    expect((await hub.as.query(api.platform.dashboard.savedList, { limit: 10 })).items[0].note).toBe(
      "Ask two accountants first",
    );

    await hub.as.mutation(api.platform.collections.removeIdea, { collectionId, slug: "b" });
    expect((await hub.as.query(api.platform.collections.list, {}))[0].count).toBe(1);
    await hub.as.mutation(api.platform.collections.remove, { collectionId });
    expect(await hub.as.query(api.platform.collections.list, {})).toEqual([]);
    const leftovers = await t.run((ctx) => ctx.db.query("collection_items").collect());
    expect(leftovers).toEqual([]);
  });

  test("names, sizes and notes are bounded", async () => {
    const t = convexTest(schema, modules);
    const hub = await hubMember(t, "bounds@example.test");
    await seedIdea(t, "a");
    for (const name of ["", "   ", "x".repeat(COLLECTION_NAME_MAX + 1)]) {
      expect(code(await hub.as.mutation(api.platform.collections.create, { name }).catch((e: unknown) => e))).toEqual({
        code: "INVALID_NAME",
      });
    }
    expect(
      code(await hub.as.mutation(api.platform.notes.save, { slug: "a", body: "x".repeat(NOTE_MAX + 1) }).catch((e: unknown) => e)),
    ).toEqual({ code: "NOTE_TOO_LONG" });

    await t.run(async (ctx) => {
      for (let i = 1; i < COLLECTIONS_MAX; i++) {
        await ctx.db.insert("collections", { ownerId: hub.userId, name: `C${i}`, itemCount: 0, updatedAt: i });
      }
    });
    const { collectionId } = await hub.as.mutation(api.platform.collections.create, { name: "Last one" });
    expect(code(await hub.as.mutation(api.platform.collections.create, { name: "One too many" }).catch((e: unknown) => e))).toEqual({
      code: "COLLECTION_LIMIT",
    });
    await t.run((ctx) => ctx.db.patch("collections", collectionId, { itemCount: COLLECTION_ITEMS_MAX }));
    expect(code(await hub.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "a" }).catch((e: unknown) => e))).toEqual({
      code: "COLLECTION_FULL",
    });
  });

  test("collections and notes are private to their owner", async () => {
    const t = convexTest(schema, modules);
    const alice = await hubMember(t, "alice@example.test");
    const bob = await hubMember(t, "bob@example.test");
    await seedIdea(t, "a");
    const { collectionId } = await alice.as.mutation(api.platform.collections.create, { name: "Alice's" });
    await alice.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "a" });
    await alice.as.mutation(api.platform.notes.save, { slug: "a", body: "Alice only" });

    for (const attempt of [
      bob.as.query(api.platform.collections.items, { collectionId }),
      bob.as.mutation(api.platform.collections.rename, { collectionId, name: "Mine now" }),
      bob.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "a" }),
      bob.as.mutation(api.platform.collections.removeIdea, { collectionId, slug: "a" }),
      bob.as.mutation(api.platform.collections.remove, { collectionId }),
      alice.as.query(api.platform.collections.items, { collectionId: "not-an-id" }),
    ]) {
      expect(code(await attempt.catch((e: unknown) => e))).toEqual({ code: "RESOURCE_NOT_FOUND" });
    }
    expect(await bob.as.query(api.platform.collections.list, {})).toEqual([]);
    expect(await bob.as.query(api.platform.collections.forIdea, { slug: "a" })).toEqual([]);
    expect(await bob.as.query(api.platform.notes.get, { slug: "a" })).toBeNull();
    expect((await alice.as.query(api.platform.notes.get, { slug: "a" }))?.body).toBe("Alice only");
    expect((await alice.as.query(api.platform.collections.list, {}))[0].count).toBe(1);
  });

  test("after leaving Builder's Hub a member keeps reading, and can tidy up, but not add", async () => {
    const t = convexTest(schema, modules);
    const hub = await hubMember(t, "leaver@example.test");
    await seedIdea(t, "a");
    await seedIdea(t, "b");
    const { collectionId } = await hub.as.mutation(api.platform.collections.create, { name: "Kept" });
    await hub.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "a" });
    await hub.as.mutation(api.platform.notes.save, { slug: "a", body: "Still mine" });

    stub.hubOwners.clear();
    expect((await hub.as.query(api.platform.collections.items, { collectionId })).items).toHaveLength(1);
    expect((await hub.as.query(api.platform.notes.get, { slug: "a" }))?.body).toBe("Still mine");
    expect(code(await hub.as.mutation(api.platform.collections.addIdea, { collectionId, slug: "b" }).catch((e: unknown) => e))).toEqual({
      code: "UPGRADE_REQUIRED",
      feature: "collections",
    });
    expect(code(await hub.as.mutation(api.platform.notes.save, { slug: "a", body: "Edit" }).catch((e: unknown) => e))).toEqual({
      code: "UPGRADE_REQUIRED",
      feature: "collections",
    });
    await hub.as.mutation(api.platform.notes.save, { slug: "a", body: "" });
    await hub.as.mutation(api.platform.collections.removeIdea, { collectionId, slug: "a" });
    await hub.as.mutation(api.platform.collections.remove, { collectionId });
    expect(await hub.as.query(api.platform.collections.list, {})).toEqual([]);
    expect(await hub.as.query(api.platform.notes.get, { slug: "a" })).toBeNull();
  });
});

describe("WP44-S11 compare and prompt pack (Builder's Hub)", () => {
  test("compare takes 2 to 4 ideas, in the order asked", async () => {
    const t = convexTest(schema, modules);
    const hub = await hubMember(t, "compare@example.test");
    for (const slug of ["a", "b", "c", "d", "e"]) await seedIdea(t, slug, `Idea ${slug}`);

    const rows = await hub.as.query(api.platform.compare.ideas, { slugs: ["c", "a", "c", "missing"] });
    expect(rows.map((row) => row.slug)).toEqual(["c", "a"]);
    expect(rows[0]).toMatchObject({ title: "Idea c", score: 7.5, buildTime: 10, revenueGoal: "5k-month", saved: false });
    for (const slugs of [["a"], ["a", "b", "c", "d", "e"]]) {
      expect(code(await hub.as.query(api.platform.compare.ideas, { slugs }).catch((e: unknown) => e))).toMatchObject({
        code: "COMPARE_SIZE",
      });
    }
  });

  test("the prompt pack source names the idea for the download route", async () => {
    const t = convexTest(schema, modules);
    const hub = await hubMember(t, "pack@example.test");
    await seedIdea(t, "a", "Idea A");
    expect(await hub.as.query(api.platform.promptPack.source, { slug: "a" })).toEqual({
      slug: "a",
      title: "Idea A",
      description: "About Idea A",
      category: "saas",
      buildTime: 10,
      tools: ["cursor", "claude"],
    });
    expect(code(await hub.as.query(api.platform.promptPack.source, { slug: "gone" }).catch((e: unknown) => e))).toEqual({
      code: "RESOURCE_NOT_FOUND",
    });
    await expect(hub.as.query(api.platform.entitlements.check, { feature: "prompt_pack" })).resolves.toBeNull();
  });
});
