/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { signLegacyPaymentEvent, type LegacyPaymentEvent } from "../lib/legacy-payments-bridge";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const SECRET = "legacy-bridge-test-secret-0123456789abcdef";

const EVENT: LegacyPaymentEvent = {
  stripeEventId: "evt_1ABC",
  type: "checkout.session.completed",
  email: "buyer@example.test",
  customerId: "cus_A1",
  amount: 900,
  currency: "usd",
  paymentLinkId: "plink_1",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

async function rows(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => await ctx.db.query("stripe_events").collect());
}

async function errorCode(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return (error as { data?: { code?: unknown } }).data?.code ?? String(error);
  }
  return "no error";
}

describe("payments.recordEvent (legacy public mutation, until the contract step)", () => {
  test("records an event once and acknowledges a duplicate", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(api.payments.recordEvent, EVENT)).toEqual({ duplicate: false });
    expect(await t.mutation(api.payments.recordEvent, EVENT)).toEqual({ duplicate: true });
    expect(await rows(t)).toHaveLength(1);
  });
});

describe("payments.recordEventInternal", () => {
  test("records an event once and acknowledges a duplicate", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.payments.recordEventInternal, EVENT)).toEqual({
      duplicate: false,
    });
    expect(await t.mutation(internal.payments.recordEventInternal, EVENT)).toEqual({
      duplicate: true,
    });
    const stored = await rows(t);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ ...EVENT });
    expect(stored[0].rawPayload).toBeUndefined();
  });

  test("does not accept a raw payload", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.payments.recordEventInternal, {
        ...EVENT,
        rawPayload: "{}",
      } as unknown as LegacyPaymentEvent),
    ).rejects.toThrow();
    expect(await rows(t)).toHaveLength(0);
  });
});

describe("paymentsBridge.accept", () => {
  test("records a correctly signed event once", async () => {
    vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", SECRET);
    const t = convexTest(schema, modules);
    const bridge = signLegacyPaymentEvent(EVENT, SECRET);
    expect(await t.action(api.paymentsBridge.accept, bridge)).toEqual({ duplicate: false });
    expect(await t.action(api.paymentsBridge.accept, bridge)).toEqual({ duplicate: true });
    const stored = await rows(t);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ ...EVENT });
  });

  test("a forged signature writes nothing", async () => {
    vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", SECRET);
    const t = convexTest(schema, modules);
    const forged = signLegacyPaymentEvent(EVENT, "forged-bridge-test-secret-0123456789abcdef");
    expect(await errorCode(() => t.action(api.paymentsBridge.accept, forged))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
    expect(await rows(t)).toHaveLength(0);
  });

  test("a tampered payload writes nothing", async () => {
    vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", SECRET);
    const t = convexTest(schema, modules);
    const bridge = signLegacyPaymentEvent(EVENT, SECRET);
    const payload = bridge.payload.replace("evt_1ABC", "evt_2XYZ");
    expect(await errorCode(() => t.action(api.paymentsBridge.accept, { ...bridge, payload }))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
    expect(await rows(t)).toHaveLength(0);
  });

  test("an unset or short secret fails closed", async () => {
    const t = convexTest(schema, modules);
    const bridge = signLegacyPaymentEvent(EVENT, SECRET);
    for (const secret of ["", "short"]) {
      vi.stubEnv("LEGACY_PAYMENTS_BRIDGE_SECRET", secret);
      expect(await errorCode(() => t.action(api.paymentsBridge.accept, bridge))).toBe(
        "BRIDGE_NOT_CONFIGURED",
      );
    }
    expect(await rows(t)).toHaveLength(0);
  });
});
