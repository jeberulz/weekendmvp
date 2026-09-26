/// <reference types="vite/client" />
import type { FunctionReturnType } from "convex/server";
import type { QueryCtx } from "./_generated/server";
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { normalizeEmail } from "./authEmail";
import { normalizeAuthEmail } from "./authUser";
import { normalizeMagicLinkEmail } from "./resendMagicLink";
import { offer, home } from "./platform/dashboard";
import { backfillNormalizedEmail } from "./subscriptions";
import { requireCurrentPlatformUser } from "./platform/authz";
import * as offers from "../lib/dashboard/offers";

// Inspect the real registered handler inside a transaction so a throwing clock
// spy does not intercept convex-test's own transaction timestamps.
const offerHandler = (offer as unknown as {
  _handler: (ctx: QueryCtx, args: { now: number }) => Promise<offers.Offer | null>;
})._handler;
const homeHandler = (home as unknown as {
  _handler: (ctx: QueryCtx, args: Record<string, never>) => Promise<FunctionReturnType<typeof api.platform.dashboard.home>>;
})._handler;

const modules = import.meta.glob("/convex/**/*.ts");
const DAY = 86_400_000;
async function setup(email = "member@example.test") {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    const user = await ctx.db.get("users", userId);
    const projectId = await ctx.db.insert("projects", {
      ownerId: userId, source: "own_idea", status: "draft", title: "Test", idempotencyKey: "r5-test", createdAt: 1, updatedAt: 1,
    });
    return { userId, sessionId, projectId, joinedAt: user!._creationTime };
  });
  return { t, ...data, member: t.withIdentity({
    subject: `${data.userId}|${data.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${data.userId}`,
  }) };
}

test("auth and subscription writes share NFKC trim lowercase normalization", async () => {
  const raw = "　Ｍｅｍｂｅｒ＠Ｅｘａｍｐｌｅ．ＴＥＳＴ　";
  expect(normalizeEmail(raw)).toBe("member@example.test");
  expect(normalizeAuthEmail(raw)).toBe(normalizeEmail(raw));
  expect(normalizeMagicLinkEmail(raw)).toBe(normalizeEmail(raw));
  const { t, member, joinedAt } = await setup();
  const id = await t.mutation(api.subscriptions.record, { email: raw, source: "subscribe", automationIds: [] });
  expect(await t.run((ctx) => ctx.db.get("subscriptions", id))).toMatchObject({
    email: "member@example.test", normalizedEmail: "member@example.test",
  });
  expect(await member.query(api.platform.dashboard.offer, { now: joinedAt + DAY })).toBeNull();
});

test("overflow suppresses only the kit and still returns a running promo", async () => {
  const { t, member, joinedAt } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 501; i++) await ctx.db.insert("subscriptions", {
      email: `other-${i}@example.test`, source: "subscribe", automationIds: [], createdAt: i,
    });
  });
  const live: offers.Promo = {
    id: "live", kind: "promo", eyebrow: "Webinar", title: "Build", body: "Join", items: [],
    cta: { label: "Read", href: "/events" }, startsAt: joinedAt, endsAt: joinedAt + 10 * DAY,
  };
  const realChooseOffer = offers.chooseOffer;
  const selector = vi.spyOn(offers, "chooseOffer").mockImplementation((args) => realChooseOffer({ ...args, promos: [live] }));
  try {
    expect(await member.query(api.platform.dashboard.offer, { now: joinedAt + 2 * DAY })).toEqual({
      id: "live", kind: "promo", eyebrow: "Webinar", title: "Build", body: "Join", items: [], cta: live.cta,
    });
    expect(selector).toHaveBeenLastCalledWith(expect.objectContaining({ kitClaimed: true }));
  } finally { selector.mockRestore(); }
});

test.each(["canonical", "normalized"])("%s indexed claims skip the global legacy scan", async (kind) => {
  const { t, member, joinedAt } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 501; i++) await ctx.db.insert("subscriptions", {
      email: `unrelated-${i}@example.test`, source: "subscribe", automationIds: [], createdAt: i,
    });
    await ctx.db.insert("subscriptions", {
      email: kind === "canonical" ? "member@example.test" : " MEMBER@Example.Test ",
      ...(kind === "normalized" ? { normalizedEmail: "member@example.test" } : {}),
      source: "subscribe", automationIds: [], createdAt: 502,
    });
  });
  await member.run(async (ctx) => {
    const queries = vi.spyOn(ctx.db, "query");
    try {
      expect(await offerHandler(ctx, { now: joinedAt + DAY })).toBeNull();
      expect(queries.mock.calls.filter(([table]) => table === "subscriptions"))
        .toHaveLength(kind === "canonical" ? 1 : 2);
    } finally { queries.mockRestore(); }
  });
});

test("unbackfilled compatibility emails use the same NFKC lookup", async () => {
  const { t, member, joinedAt } = await setup();
  await t.run((ctx) => ctx.db.insert("subscriptions", {
    email: "　ＭＥＭＢＥＲ＠Ｅｘａｍｐｌｅ．ＴＥＳＴ　", source: "subscribe", automationIds: [], createdAt: 1,
  }));
  expect(await member.query(api.platform.dashboard.offer, { now: joinedAt + DAY })).toBeNull();
});

test("bounded internal backfill is resumable, dry-run safe, idempotent and preserves event emails", async () => {
  expect(backfillNormalizedEmail.isInternal).toBe(true);
  const { t, member, joinedAt } = await setup("missing@example.test");
  const ids = await t.run(async (ctx) => {
    const ids = [];
    for (let i = 0; i < 605; i++) ids.push(await ctx.db.insert("subscriptions", {
      email: `　ＵＳＥＲ${i}＠Example.Test　`, source: "subscribe", automationIds: [], createdAt: i,
      ...(i === 0 ? { normalizedEmail: "wrong@example.test" } : {}),
    }));
    return ids;
  });
  const before = await t.run((ctx) => ctx.db.get("subscriptions", ids[0]));
  const dryRun = await t.mutation(internal.subscriptions.backfillNormalizedEmail, { cursor: null });
  expect(dryRun).toMatchObject({ scanned: 100, needsUpdate: 100, updated: 0, isDone: false });
  expect(await t.run((ctx) => ctx.db.get("subscriptions", ids[0]))).toEqual(before);
  const first = await t.mutation(internal.subscriptions.backfillNormalizedEmail, { cursor: null, dryRun: false });
  expect(first).toMatchObject({ scanned: 100, updated: 100, isDone: false });
  expect(await t.mutation(internal.subscriptions.backfillNormalizedEmail, { cursor: null, dryRun: false }))
    .toMatchObject({ scanned: 100, needsUpdate: 0, updated: 0 });
  let cursor = first.continueCursor;
  let done = false;
  let total = first.updated;
  while (!done) {
    const page = await t.mutation(internal.subscriptions.backfillNormalizedEmail, { cursor, dryRun: false });
    expect(page.scanned).toBeLessThanOrEqual(100);
    total += page.updated;
    cursor = page.continueCursor;
    done = page.isDone;
  }
  expect(total).toBe(605);
  expect(await t.run((ctx) => ctx.db.get("subscriptions", ids[0]))).toEqual({ ...before, normalizedEmail: "user0@example.test" });
  expect(await t.run((ctx) => ctx.db.query("subscriptions").withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", undefined)).first())).toBeNull();
  expect(await member.query(api.platform.dashboard.offer, { now: joinedAt + DAY })).toEqual(offers.STARTER_KIT_OFFER);
});

test("member reads never read a clock while expired sessions cannot mutate or pass HTTP membership", async () => {
  const { t, member, sessionId, projectId } = await setup();
  await t.run((ctx) => ctx.db.patch("authSessions", sessionId, { expirationTime: 1 }));
  // convex-test supplies an identity directly; a real expired JWT is rejected
  // by Convex before a query runs. This isolates the clock-free query helper.
  await member.run(async (ctx) => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Query read wall clock"); });
    try {
      expect((await requireCurrentPlatformUser(ctx)).email).toBe("member@example.test");
      expect(await homeHandler(ctx, {})).toMatchObject({ plan: "free" });
      expect(await offerHandler(ctx, { now: 0 })).toEqual(offers.STARTER_KIT_OFFER);
      expect(clock).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });
  await expect(member.mutation(api.platform.dashboard.requireMember, {})).rejects.toThrow("UNAUTHENTICATED");
  await expect(member.mutation(api.platform.dashboard.setSaved, { slug: "missing", saved: true })).rejects.toThrow("UNAUTHENTICATED");
  await expect(member.mutation(api.platform.weekendPlans.start, { slug: "missing" })).rejects.toThrow("UNAUTHENTICATED");
  await expect(member.mutation(api.platform.billing.checkout.prepare, { projectId, packId: "unknown", idempotencyKey: "test" })).rejects.toThrow("UNAUTHENTICATED");
  await t.run((ctx) => ctx.db.delete("authSessions", sessionId));
  await expect(member.query(api.platform.dashboard.home, {})).rejects.toThrow("UNAUTHENTICATED");
  await expect(member.query(api.platform.projects.getOwned, { projectId })).rejects.toThrow("UNAUTHENTICATED");
  await expect(member.mutation(api.platform.dashboard.requireMember, {})).rejects.toThrow("UNAUTHENTICATED");
});
