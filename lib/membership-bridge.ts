import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WP64-S3. Signed hand-off from the membership routes to Convex
 * (`convex/platform/membership/provider.ts`), the same pattern as WP24 and
 * the S1 legacy bridge, with its own secret, `MEMBERSHIP_BILLING_BRIDGE_SECRET`.
 *
 * The signature proves the call came from our server. It never names the
 * owner: Convex reads the owner from the member's own auth token, which the
 * route forwards, so a replayed payload can only act for the member who sent
 * it, and every write it reaches is idempotent. S4 adds the webhook events.
 */

export const MEMBERSHIP_BRIDGE_MIN_SECRET_LENGTH = 32;
export const MEMBERSHIP_BRIDGE_MAX_PAYLOAD_LENGTH = 2_048;

const TERMS = ["monthly", "annual", "lifetime"] as const;
type Term = (typeof TERMS)[number];
/** Same rule as `IDEMPOTENCY_KEY_PATTERN` in the route contract. */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_:-]{16,80}$/;
/** A document id. Convex checks the table with `v.id("membership_orders")`. */
const ORDER_ID = /^[A-Za-z0-9_;]{1,64}$/;
const CHECKOUT_SESSION = /^cs_(test|live)_[A-Za-z0-9_]{1,250}$/;

export type MembershipBridgePayload =
  | { kind: "begin_checkout"; term: Term; idempotencyKey: string; livemode: boolean }
  | { kind: "attach_session"; orderId: string; checkoutSessionId: string };

export type MembershipBridgeErrorCode = "BRIDGE_NOT_CONFIGURED" | "INVALID_BRIDGE_SIGNATURE" | "INVALID_BRIDGE_PAYLOAD";

export class MembershipBridgeError extends Error {
  readonly code: MembershipBridgeErrorCode;

  constructor(code: MembershipBridgeErrorCode) {
    super(code);
    this.name = "MembershipBridgeError";
    this.code = code;
  }
}

function assertSecret(secret: string | undefined): string {
  if (!secret || secret.length < MEMBERSHIP_BRIDGE_MIN_SECRET_LENGTH) {
    throw new MembershipBridgeError("BRIDGE_NOT_CONFIGURED");
  }
  return secret;
}

/** Fixed key order, so the same payload always signs the same way. */
function serialize(payload: MembershipBridgePayload): string {
  return payload.kind === "begin_checkout"
    ? JSON.stringify({
        kind: payload.kind,
        term: payload.term,
        idempotencyKey: payload.idempotencyKey,
        livemode: payload.livemode,
      })
    : JSON.stringify({ kind: payload.kind, orderId: payload.orderId, checkoutSessionId: payload.checkoutSessionId });
}

export function signMembershipBridge(
  payload: MembershipBridgePayload,
  secret: string | undefined,
): { payload: string; signature: string } {
  const key = assertSecret(secret);
  const serialized = serialize(parse(serialize(payload)));
  return { payload: serialized, signature: createHmac("sha256", key).update(serialized).digest("base64url") };
}

function parse(payload: string): MembershipBridgePayload {
  if (payload.length > MEMBERSHIP_BRIDGE_MAX_PAYLOAD_LENGTH) throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort().join(",");
  if (candidate.kind === "begin_checkout") {
    if (
      keys !== "idempotencyKey,kind,livemode,term" ||
      !(TERMS as readonly unknown[]).includes(candidate.term) ||
      typeof candidate.idempotencyKey !== "string" ||
      !IDEMPOTENCY_KEY.test(candidate.idempotencyKey) ||
      typeof candidate.livemode !== "boolean"
    ) {
      throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
    }
    return {
      kind: "begin_checkout",
      term: candidate.term as Term,
      idempotencyKey: candidate.idempotencyKey,
      livemode: candidate.livemode,
    };
  }
  if (candidate.kind === "attach_session") {
    if (
      keys !== "checkoutSessionId,kind,orderId" ||
      typeof candidate.orderId !== "string" ||
      !ORDER_ID.test(candidate.orderId) ||
      typeof candidate.checkoutSessionId !== "string" ||
      !CHECKOUT_SESSION.test(candidate.checkoutSessionId)
    ) {
      throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
    }
    return { kind: "attach_session", orderId: candidate.orderId, checkoutSessionId: candidate.checkoutSessionId };
  }
  throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
}

/** Verifies the signature first, then parses. Throws `MembershipBridgeError`. */
export function verifyMembershipBridge(
  payload: string,
  signature: string,
  secret: string | undefined,
): MembershipBridgePayload {
  const key = assertSecret(secret);
  if (payload.length > MEMBERSHIP_BRIDGE_MAX_PAYLOAD_LENGTH) throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
  const expected = createHmac("sha256", key).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new MembershipBridgeError("INVALID_BRIDGE_SIGNATURE");
  }
  return parse(payload);
}
