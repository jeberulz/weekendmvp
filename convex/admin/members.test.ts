/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { memberPage } from "../../lib/member-pages";
import { OWNER_DRAINS } from "../account/purge";

const modules = import.meta.glob("/convex/**/*.ts");

test("member directory protects identity, reports linked sign-ins and counts each visit once", async () => {
  const t = convexTest(schema, modules);
  const [owner, founder] = await t.run(async ctx => {
    async function member(email: string) {
      const id = await ctx.db.insert("users", { email });
      const session = await ctx.db.insert("authSessions", { userId: id, expirationTime: Date.now() + 60_000 });
      return { id, subject: `${id}|${session}` };
    }
    const owner = await member("owner@example.test");
    const founder = await member("founder@example.test");
    await ctx.db.insert("super_admins", { userId: owner.id, boundAt: 1, role: "super_admin", boundVia: "deployment_bootstrap" });
    await ctx.db.insert("authAccounts", { userId: founder.id, provider: "google", providerAccountId: "private-provider-id" });
    return [owner, founder];
  });
  const ops = t.withIdentity({ subject: owner.subject });
  const user = t.withIdentity({ subject: founder.subject });
  const list = api.admin.members.directory;
  await expect(t.query(list, { cursor: null })).rejects.toThrow("FORBIDDEN");
  await expect(user.query(list, { cursor: null })).rejects.toThrow("FORBIDDEN");
  await expect(user.query(api.admin.members.week, { since: 0 })).rejects.toThrow("FORBIDDEN");
  const report = { page: "/dashboard", key: "12345678-aaaa-bbbb-cccc-000000000000", focusedMs: 0 };
  await expect(t.mutation(api.admin.members.record, report)).rejects.toThrow();
  await expect(user.mutation(api.admin.members.record, { ...report, page: "/dashboard?token=abc" })).rejects.toThrow();
  await user.mutation(api.admin.members.record, report);
  await t.run(async ctx => {
    const row = await ctx.db.query("member_activity").unique();
    if (!row) throw Error("Missing visit");
    await ctx.db.patch("member_activity", row._id, { recent: row.recent.map(v => ({ ...v, started: Date.now() - 9000 })) });
  });
  for (const focusedMs of [5000, 3000, 5000, 0]) await user.mutation(api.admin.members.record, { ...report, focusedMs });
  const result = await ops.query(list, { cursor: null });
  expect(result.page.find(m => m.id === founder.id)).toMatchObject({ email: "founder@example.test", providers: ["google"], focusedMs: 5000, views: 1 });
  expect(JSON.stringify(result)).not.toContain("private-provider-id");
  expect(await ops.query(api.admin.members.week, { since: 0 })).toMatchObject({ signups: 2, active: 1 });
  await t.run(async ctx => { for (const drain of OWNER_DRAINS) await drain(ctx, founder.id, 10); });
  expect(await t.run(ctx => ctx.db.query("member_activity").first())).toBeNull();
  await t.run(async ctx => {
    for (let i = 0; i < 25; i++) await ctx.db.insert("users", { name: String(i) });
  });
  const first = await ops.query(list, { cursor: null });
  expect(first.page).toHaveLength(25);
  expect((await ops.query(list, { cursor: first.next })).page).toHaveLength(2);
});

test("product page analytics drop dynamic identifiers and exclude non-product routes", () => {
  expect(memberPage("/dashboard/b/private-business/team/private-employee")).toBe("/dashboard/b/[id]/team/[employee]");
  expect(memberPage("/ideas/example")).toBe("/ideas/[slug]");
  for (const path of ["/admin", "/preview/secret", "/auth/callback", "/dashboard/unknown", "/dashboard/b/id/landing-preview"]) expect(memberPage(path)).toBeNull();
});
