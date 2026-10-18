/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  DEFAULT_EVENT_KEY,
  RESERVATION_MS,
  SESSION_GRACE_MS,
} from "./live/workshopCheckout";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type T = TestConvex<typeof schema>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

function setup() {
  return convexTest(schema, modules);
}

let emails = 0;
async function seedUser(t: T) {
  emails += 1;
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: `workshop${emails}@example.test`,
      emailVerificationTime: 1,
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: 9_999_999_999_999,
    });
    return { userId, sessionId } satisfies Member;
  });
}

function asUser(t: T, member: Member) {
  return t.withIdentity({
    subject: `${member.userId}|${member.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${member.userId}`,
  });
}

async function seedSeats(t: T) {
  await t.mutation(internal.live.workshopCheckout.seedSeats, {
    eventKey: DEFAULT_EVENT_KEY,
    apply: true,
  });
}

function begin(
  t: T,
  member: Member,
  idempotencyKey: string,
  lookupKey = "weekendmvp_buildalong_20261114_early",
) {
  return asUser(t, member).mutation(internal.live.workshopCheckout.begin, {
    eventKey: DEFAULT_EVENT_KEY,
    lookupKey,
    idempotencyKey,
    livemode: false,
  });
}

const seat = (t: T, seatNumber: number) =>
  t.run((ctx) =>
    ctx.db
      .query("workshop_seats")
      .withIndex("by_eventKey_and_seatNumber", (q) =>
        q.eq("eventKey", DEFAULT_EVENT_KEY).eq("seatNumber", seatNumber),
      )
      .unique(),
  );

describe("live workshop seat holds", () => {
  test("a retry on a reused hold renews reservedUntil and sessionExpiresAt", async () => {
    const t = setup();
    await seedSeats(t);
    const member = await seedUser(t);
    const key = "live_workshop_retry_key_012345";

    const first = await begin(t, member, key);
    expect(first).toMatchObject({ ok: true, seatNumber: 1 });
    if (!first.ok) throw new Error("expected first hold");

    const heldAfterFirst = await seat(t, 1);
    expect(heldAfterFirst?.status).toBe("reserved");
    const originalUntil = heldAfterFirst!.reservedUntil!;

    // Simulate time advancing within the hold window (retry before expiry).
    const later = originalUntil - 10 * 60 * 1000;
    expect(later).toBeGreaterThan(Date.now() - RESERVATION_MS);

    // Patch the clock forward by shrinking reservedUntil toward "soon", then
    // retry — begin must renew to now + RESERVATION_MS (Stripe needs ≥30m).
    await t.run(async (ctx) => {
      await ctx.db.patch(heldAfterFirst!._id, {
        reservedUntil: Date.now() + 5 * 60 * 1000,
      });
    });

    const before = Date.now();
    const second = await begin(t, member, key);
    const after = Date.now();
    expect(second).toMatchObject({ ok: true, seatNumber: 1, orderId: first.orderId });
    if (!second.ok) throw new Error("expected renewed hold");

    expect(second.reservedUntil).toBeGreaterThanOrEqual(before + RESERVATION_MS);
    expect(second.reservedUntil).toBeLessThanOrEqual(after + RESERVATION_MS);
    expect(second.sessionExpiresAt).toBe(second.reservedUntil - SESSION_GRACE_MS);
    // Stripe minimum is 30 minutes; 31m grace path must clear that.
    expect(second.sessionExpiresAt - before).toBeGreaterThanOrEqual(30 * 60 * 1000);

    const heldAfterSecond = await seat(t, 1);
    expect(heldAfterSecond?.reservedUntil).toBe(second.reservedUntil);
  });

  test("a second attempt with a different key renews the same live hold", async () => {
    const t = setup();
    await seedSeats(t);
    const member = await seedUser(t);

    const first = await begin(t, member, "live_workshop_hold_a_0123456");
    expect(first).toMatchObject({ ok: true, seatNumber: 1 });
    if (!first.ok) throw new Error("expected first");

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("workshop_seats")
        .withIndex("by_eventKey_and_seatNumber", (q) =>
          q.eq("eventKey", DEFAULT_EVENT_KEY).eq("seatNumber", 1),
        )
        .unique();
      await ctx.db.patch(row!._id, { reservedUntil: Date.now() + 2 * 60 * 1000 });
    });

    const before = Date.now();
    const second = await begin(t, member, "live_workshop_hold_b_0123456");
    expect(second).toMatchObject({ ok: true, seatNumber: 1, orderId: first.orderId });
    if (!second.ok) throw new Error("expected reuse");
    expect(second.reservedUntil).toBeGreaterThanOrEqual(before + RESERVATION_MS);
    expect(second.sessionExpiresAt).toBe(second.reservedUntil - SESSION_GRACE_MS);
  });
});
