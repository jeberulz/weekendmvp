"use node";

import { createHmac, timingSafeEqual } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { action, env } from "../../_generated/server";
import { PLATFORM_BILLING_PURPOSE } from "./catalog";
import type { PlatformProviderEvent } from "./events";

type BridgePayload =
  | {
      kind: "attach_session";
      purchaseId: string;
      checkoutSessionId: string;
    }
  | PlatformProviderEvent;

function verifyBridgeSignature(payload: string, signature: string): void {
  const secret = env.PLATFORM_BILLING_BRIDGE_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConvexError({ code: "BILLING_BRIDGE_NOT_CONFIGURED" });
  }
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_SIGNATURE" });
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_SIGNATURE" });
  }
}

function parseBridgePayload(payload: string): BridgePayload {
  if (payload.length > 4_096) {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
  }
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
  }
  if (!value || typeof value !== "object" || !("kind" in value)) {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === "attach_session") {
    if (
      typeof candidate.purchaseId !== "string" ||
      typeof candidate.checkoutSessionId !== "string"
    ) {
      throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
    }
    return {
      kind: "attach_session",
      purchaseId: candidate.purchaseId,
      checkoutSessionId: candidate.checkoutSessionId,
    };
  }
  if (
    !["checkout_paid", "checkout_failed", "refund", "dispute"].includes(
      String(candidate.kind),
    ) ||
    candidate.purpose !== PLATFORM_BILLING_PURPOSE ||
    typeof candidate.eventId !== "string"
  ) {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
  }
  for (const field of [
    "purchaseId",
    "checkoutSessionId",
    "paymentIntentId",
    "currency",
  ] as const) {
    if (candidate[field] !== undefined && typeof candidate[field] !== "string") {
      throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
    }
  }
  if (
    candidate.amountMinor !== undefined &&
    (typeof candidate.amountMinor !== "number" ||
      !Number.isSafeInteger(candidate.amountMinor))
  ) {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
  }
  if (
    candidate.fullRefund !== undefined &&
    typeof candidate.fullRefund !== "boolean"
  ) {
    throw new ConvexError({ code: "INVALID_BILLING_BRIDGE_PAYLOAD" });
  }
  return candidate as PlatformProviderEvent;
}

export const accept = action({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args): Promise<unknown> => {
    verifyBridgeSignature(args.payload, args.signature);
    const payload = parseBridgePayload(args.payload);
    if (payload.kind === "attach_session") {
      const purchaseId = payload.purchaseId as Id<"purchases">;
      return await ctx.runMutation(internal.platform.billing.checkout.attachSession, {
        purchaseId,
        checkoutSessionId: payload.checkoutSessionId,
      });
    }
    return await ctx.runMutation(internal.platform.billing.events.process, payload);
  },
});
