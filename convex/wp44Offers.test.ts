/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  OFFER_IDS,
  PROMOS,
  STARTER_KIT_OFFER,
  chooseOffer,
  isKitClaim,
  withDismissed,
  type Promo,
} from "../lib/dashboard/offers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const JOINED = Date.UTC(2026, 8, 1);

function promo(id: string, startsAt: number, endsAt: number): Promo {
  return {
    id,
    kind: "promo",
    eyebrow: "Live webinar",
    title: `Promo ${id}`,
    body: "Build with us.",
    items: [],
    cta: { label: "Save a seat", href: "https://events.example.com/webinar" },
    startsAt,
    endsAt,
  };
}

describe("WP44-S12 offer choice (fixed clock)", () => {
  const base = { joinedAt: JOINED, plan: "free" as const, kitClaimed: false, dismissed: [] as string[] };
  const live = promo("webinar-oct", JOINED, JOINED + 30 * DAY);

  test("first day: only the Starter Kit, even with a promo running", () => {
    expect(chooseOffer({ ...base, now: JOINED + HOUR, promos: [live] })?.id).toBe("starter-kit");
    expect(chooseOffer({ ...base, now: JOINED + HOUR, kitClaimed: true, promos: [live] })).toBeNull();
    expect(chooseOffer({ ...base, now: JOINED + DAY - 1, plan: "builders_hub", promos: [live] })).toBeNull();
  });

  test("after that: a running promo wins, else the unclaimed kit, else nothing", () => {
    const now = JOINED + 3 * DAY;
    expect(chooseOffer({ ...base, now, promos: [live] })?.id).toBe("webinar-oct");
    expect(chooseOffer({ ...base, now, promos: [] })?.id).toBe("starter-kit");
    expect(chooseOffer({ ...base, now, kitClaimed: true, promos: [] })).toBeNull();
    // A promo is the offer, without its window.
    expect(chooseOffer({ ...base, now, promos: [live] })).not.toHaveProperty("endsAt");
  });

  test("expired and future promos never show; the earliest ending shows first", () => {
    const now = JOINED + 10 * DAY;
    const expired = promo("gone", JOINED, JOINED + 9 * DAY);
    const future = promo("soon", JOINED + 11 * DAY, JOINED + 20 * DAY);
    const endsAtNow = promo("edge", JOINED, now);
    expect(chooseOffer({ ...base, now, kitClaimed: true, promos: [expired, future, endsAtNow] })).toBeNull();
    const later = promo("later", JOINED, JOINED + 40 * DAY);
    const sooner = promo("sooner", JOINED, JOINED + 12 * DAY);
    expect(chooseOffer({ ...base, now, promos: [later, sooner] })?.id).toBe("sooner");
  });

  test("dismissed cards stay gone; Builder's Hub gets promos but never the kit", () => {
    const now = JOINED + 3 * DAY;
    expect(chooseOffer({ ...base, now, dismissed: ["webinar-oct"], promos: [live] })?.id).toBe("starter-kit");
    expect(chooseOffer({ ...base, now, dismissed: ["webinar-oct", "starter-kit"], promos: [live] })).toBeNull();
    expect(chooseOffer({ ...base, now, plan: "builders_hub", promos: [live] })?.id).toBe("webinar-oct");
    expect(chooseOffer({ ...base, now, plan: "builders_hub", promos: [] })).toBeNull();
  });

  test("which subscriptions count as a kit claim", () => {
    expect(isKitClaim({ source: "subscribe", utm: { campaign: "starter-kit" } })).toBe(true);
    expect(isKitClaim({ source: "subscribe", utm: { campaign: "newsletter" } })).toBe(true);
    expect(isKitClaim({ source: "subscribe" })).toBe(true);
    expect(isKitClaim({ source: "subscribe", utm: { campaign: "shipable-workshop" } })).toBe(false);
    expect(isKitClaim({ source: "idea-page", utm: { campaign: "daily-ideas" } })).toBe(false);
  });

  test("the catalog is sound", () => {
    expect(withDismissed(["a", "b"], "a")).toEqual(["b", "a"]);
    expect(withDismissed(Array.from({ length: 50 }, (_, i) => `x${i}`), "new")).toHaveLength(50);
    expect(OFFER_IDS.has(STARTER_KIT_OFFER.id)).toBe(true);
    for (const offer of [STARTER_KIT_OFFER, ...PROMOS]) {
      expect(offer.cta.href.startsWith("/") || offer.cta.href.startsWith("https://"), offer.id).toBe(true);
      expect(JSON.stringify(offer), offer.id).not.toMatch(/Builder|hosting|credit/i);
    }
    for (const entry of PROMOS) expect(entry.startsAt, entry.id).toBeLessThan(entry.endsAt);
  });
});

type Member = { userId: Id<"users">; sessionId: Id<"authSessions">; joinedAt: number };

async function seedUser(t: TestConvex<typeof schema>, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    const user = await ctx.db.get("users", userId);
    return { userId, sessionId, joinedAt: user!._creationTime };
  });
}

function asUser(t: TestConvex<typeof schema>, member: Member) {
  return t.withIdentity({
    subject: `${member.userId}|${member.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${member.userId}`,
  });
}

async function subscribe(t: TestConvex<typeof schema>, email: string, campaign: string) {
  await t.run((ctx) =>
    ctx.db.insert("subscriptions", {
      email,
      source: "subscribe",
      automationIds: ["aut_1"],
      utm: { campaign },
      createdAt: 1,
    }),
  );
}

describe("WP44-S12 offer card on the server", () => {
  test("anonymous callers are refused", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.dashboard.offer, { now: JOINED })).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.mutation(api.platform.preferences.dismissOffer, { offerId: "starter-kit" })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });

  test("the kit shows until the member's email claims it, and the email never leaves", async () => {
    const t = convexTest(schema, modules);
    const claimed = await seedUser(t, "Claimed@Example.test");
    const fresh = await seedUser(t, "fresh@example.test");
    await subscribe(t, "claimed@example.test", "starter-kit");
    await subscribe(t, "fresh@example.test", "shipable-workshop");

    const later = claimed.joinedAt + 3 * DAY;
    expect(await asUser(t, claimed).query(api.platform.dashboard.offer, { now: later })).toBeNull();
    const offer = await asUser(t, fresh).query(api.platform.dashboard.offer, { now: fresh.joinedAt + HOUR });
    expect(offer?.id).toBe("starter-kit");
    expect(JSON.stringify(offer)).not.toContain("@");
  });

  test("dismissing hides the card for that member only, on every device", async () => {
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.test");
    const bob = await seedUser(t, "bob@example.test");
    const now = alice.joinedAt + 3 * DAY;

    await asUser(t, alice).mutation(api.platform.preferences.dismissOffer, { offerId: "starter-kit" });
    // Twice is the same as once.
    await asUser(t, alice).mutation(api.platform.preferences.dismissOffer, { offerId: "starter-kit" });
    expect(await asUser(t, alice).query(api.platform.dashboard.offer, { now })).toBeNull();
    expect((await asUser(t, bob).query(api.platform.dashboard.offer, { now }))?.id).toBe("starter-kit");

    const stored = await t.run((ctx) => ctx.db.query("user_preferences").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ ownerId: alice.userId, dismissed: ["starter-kit"] });
    // Setup is still unanswered: dismissing a card is not answering the questions.
    expect(await asUser(t, alice).query(api.platform.dashboard.home, {})).toMatchObject({
      setupDone: false,
      setupSkipped: false,
    });
  });

  test("only known offers can be dismissed", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "x@example.test"));
    await expect(member.mutation(api.platform.preferences.dismissOffer, { offerId: "anything-else" })).rejects.toThrow(
      "INVALID_OFFER",
    );
  });
});
