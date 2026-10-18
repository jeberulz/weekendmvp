import { createHmac, timingSafeEqual } from "node:crypto";

export const LIVE_BRIDGE_MIN_SECRET_LENGTH = 32;
export const LIVE_BRIDGE_MAX_PAYLOAD_LENGTH = 4_096;
export const LIVE_BRIDGE_MAX_AGE_MS = 5 * 60 * 1000;

export type LiveBridgeErrorCode =
  | "BRIDGE_NOT_CONFIGURED"
  | "INVALID_BRIDGE_SIGNATURE"
  | "INVALID_BRIDGE_PAYLOAD";

export class LiveBridgeError extends Error {
  readonly code: LiveBridgeErrorCode;

  constructor(code: LiveBridgeErrorCode) {
    super(code);
    this.name = "LiveBridgeError";
    this.code = code;
  }
}

export type LiveBridgePayload =
  | {
      kind: "begin_checkout";
      eventKey: string;
      lookupKey: string;
      idempotencyKey: string;
      livemode: boolean;
    }
  | {
      kind: "attach_session";
      orderId: string;
      checkoutSessionId: string;
      priceId?: string;
    }
  | {
      kind: "mark_paid";
      issuedAt: number;
      checkoutSessionId: string;
      stripeEventId: string;
      priceId?: string;
    }
  | { kind: "mark_expired"; issuedAt: number; checkoutSessionId: string }
  | {
      kind: "mark_refunded";
      issuedAt: number;
      checkoutSessionId: string;
      stripeEventId: string;
    }
  | { kind: "release_expired_holds"; issuedAt: number; eventKey?: string };

function assertSecret(secret: string | undefined): string {
  if (!secret || secret.length < LIVE_BRIDGE_MIN_SECRET_LENGTH) {
    throw new LiveBridgeError("BRIDGE_NOT_CONFIGURED");
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signLiveWorkshopEvent(
  event: LiveBridgePayload,
  secret: string | undefined,
): { payload: string; signature: string } {
  const key = assertSecret(secret);
  const payload = JSON.stringify(event);
  if (payload.length > LIVE_BRIDGE_MAX_PAYLOAD_LENGTH) {
    throw new LiveBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  return { payload, signature: sign(payload, key) };
}

export function verifyLiveWorkshopEvent(
  payload: string,
  signature: string,
  secret: string | undefined,
): LiveBridgePayload {
  const key = assertSecret(secret);
  if (payload.length > LIVE_BRIDGE_MAX_PAYLOAD_LENGTH) {
    throw new LiveBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  const expected = sign(payload, key);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new LiveBridgeError("INVALID_BRIDGE_SIGNATURE");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new LiveBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) {
    throw new LiveBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  return parsed as LiveBridgePayload;
}

export function assertFresh(issuedAt: number, now = Date.now()): void {
  if (!Number.isFinite(issuedAt) || Math.abs(now - issuedAt) > LIVE_BRIDGE_MAX_AGE_MS) {
    throw new LiveBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
}
