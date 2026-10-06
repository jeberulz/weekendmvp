/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("idea body access", () => {
  test("public projections omit stored bodies; only a current verified session reads one", async () => {
    const t = convexTest(schema, modules);
    const { userId, sessionId } = await t.run(async (ctx) => {
      await ctx.db.insert("ideas", {
        slug: "private-research", title: "Private research", description: "Public teaser",
        publishedAt: 100, category: "saas", buildTime: "8", revenueGoal: "1k",
        applicationCategory: "BusinessApplication", tools: ["cursor"], audiences: ["founders"],
        bodyMode: "convex", body: "SECRET COMPLETE RESEARCH BODY",
      });
      const userId = await ctx.db.insert("users", { email: "member@example.test", emailVerificationTime: Date.now() });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60_000 });
      return { userId, sessionId };
    });
    const slug = "private-research";
    for (const result of [
      await t.query(api.ideas.bySlug, { slug }),
      (await t.query(api.ideas.list, { limit: 10 })).page[0],
      (await t.query(api.ideas.byCategory, { category: "saas" }))[0],
      (await t.query(api.ideas.byTool, { tool: "cursor" }))[0],
      (await t.query(api.ideas.latest, {})),
    ]) {
      expect(result).toMatchObject({ slug, description: "Public teaser" });
      expect(result).not.toHaveProperty("body");
    }
    await expect(t.query(api.ideas.bySlugForMember, { slug })).rejects.toThrow("UNAUTHENTICATED");
    const member = t.withIdentity({
      subject: `${userId}|${sessionId}`, issuer: "https://local.test",
      tokenIdentifier: `https://local.test|${userId}`,
    });
    expect((await member.query(api.ideas.bySlugForMember, { slug }))?.body).toBe("SECRET COMPLETE RESEARCH BODY");
    await member.mutation(api.ideas.requireVerifiedMember, {});
    await t.run(async (ctx) => { await ctx.db.delete(sessionId); });
    await expect(member.query(api.ideas.bySlugForMember, { slug })).rejects.toThrow("UNAUTHENTICATED");
    await expect(member.mutation(api.ideas.requireVerifiedMember, {})).rejects.toThrow("UNAUTHENTICATED");
  });
});
