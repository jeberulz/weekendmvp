import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WP64-S3. Signed hand-off from the membership routes to Convex
 * (`convex/platform/membership/provider.ts`), the same pattern as WP24 and
 * the S1 legacy bridge, with its own secret, `MEMBERSHIP_BILLING_BRIDGE_SECRET`.
 *
 * The signature proves the call came from our server. It never names the
 * owner: Convex reads the owner from the member's own auth token, which the
 * route forwards, so a replayed payload can only act for the member who sent
 * it, and every write it reaches is idempotent.
 *
 * S4 adds the server-only kinds the webhook and reconcile routes send. They
 * carry no member auth, so each is stamped with `issuedAt` and Convex refuses
 * one older than `MEMBERSHIP_BRIDGE_MAX_AGE_MS`. Convex validators check the
 * event and snapshot shapes (`membership/events.ts`).
 *
 * S5 adds `open_portal`, a member kind like the first two: it carries the
 * member's auth and names no customer.
 */

export const MEMBERSHIP_BRIDGE_MIN_SECRET_LENGTH = 32;
export const MEMBERSHIP_BRIDGE_MAX_PAYLOAD_LENGTH = 4_096;
/** How long a signed server-only payload stays good. Covers clock drift between Vercel and Convex. */
export const MEMBERSHIP_BRIDGE_MAX_AGE_MS = 5 * 60 * 1000;

const TERMS = ["monthly", "annual", "lifetime"] as const;
type Term = (typeof TERMS)[number];
/** Same rule as `IDEMPOTENCY_KEY_PATTERN` in the route contract. */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_:-]{16,80}$/;
/** A document id. Convex checks the table with `v.id("membership_orders")`. */
const ORDER_ID = /^[A-Za-z0-9_;]{1,64}$/;
const CHECKOUT_SESSION = /^cs_(test|live)_[A-Za-z0-9_]{1,250}$/;

/** A plain JSON object. Convex validates its shape. */
type Snapshot = Record<string, unknown>;

export type MembershipBridgePayload =
  | { kind: "begin_checkout"; term: Term; idempotencyKey: string; livemode: boolean }
  | { kind: "attach_session"; orderId: string; checkoutSessionId: string }
  | { kind: "open_portal"; livemode: boolean }
  | { kind: "event"; issuedAt: number; event: Snapshot }
  | { kind: "subscription_snapshot"; issuedAt: number; livemode: boolean; subscription: Snapshot }
  | { kind: "release_expired_holds"; issuedAt: number }
  | { kind: "running_subscriptions"; issuedAt: number; livemode: boolean };

/** The kinds only our server sends. They act without a member session. */
export const MEMBERSHIP_SERVER_KINDS = ["event", "subscription_snapshot", "release_expired_holds", "running_subscriptions"] as const;

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
  switch (payload.kind) {
    case "begin_checkout":
      return JSON.stringify({
        kind: payload.kind,
        term: payload.term,
        idempotencyKey: payload.idempotencyKey,
        livemode: payload.livemode,
      });
    case "attach_session":
      return JSON.stringify({ kind: payload.kind, orderId: payload.orderId, checkoutSessionId: payload.checkoutSessionId });
    case "open_portal":
      return JSON.stringify({ kind: payload.kind, livemode: payload.livemode });
    case "event":
      return JSON.stringify({ kind: payload.kind, issuedAt: payload.issuedAt, event: payload.event });
    case "subscription_snapshot":
      return JSON.stringify({
        kind: payload.kind,
        issuedAt: payload.issuedAt,
        livemode: payload.livemode,
        subscription: payload.subscription,
      });
    case "release_expired_holds":
      return JSON.stringify({ kind: payload.kind, issuedAt: payload.issuedAt });
    case "running_subscriptions":
      return JSON.stringify({ kind: payload.kind, issuedAt: payload.issuedAt, livemode: payload.livemode });
  }
}

const isObject = (value: unknown): value is Snapshot =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isTime = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

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
  if (candidate.kind === "open_portal") {
    if (keys !== "kind,livemode" || typeof candidate.livemode !== "boolean") throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
    return { kind: "open_portal", livemode: candidate.livemode };
  }
  const { issuedAt } = candidate;
  if (!isTime(issuedAt)) throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
  if (candidate.kind === "event" && keys === "event,issuedAt,kind" && isObject(candidate.event)) {
    return { kind: "event", issuedAt, event: candidate.event };
  }
  if (
    candidate.kind === "subscription_snapshot" &&
    keys === "issuedAt,kind,livemode,subscription" &&
    typeof candidate.livemode === "boolean" &&
    isObject(candidate.subscription)
  ) {
    return { kind: "subscription_snapshot", issuedAt, livemode: candidate.livemode, subscription: candidate.subscription };
  }
  if (candidate.kind === "release_expired_holds" && keys === "issuedAt,kind") {
    return { kind: "release_expired_holds", issuedAt };
  }
  if (candidate.kind === "running_subscriptions" && keys === "issuedAt,kind,livemode" && typeof candidate.livemode === "boolean") {
    return { kind: "running_subscriptions", issuedAt, livemode: candidate.livemode };
  }
  throw new MembershipBridgeError("INVALID_BRIDGE_PAYLOAD");
}

/** True while a server-only payload is fresh. A payload from the future beyond the drift allowance is refused too. */
export function membershipBridgeFresh(issuedAt: number, now: number): boolean {
  return Math.abs(now - issuedAt) <= MEMBERSHIP_BRIDGE_MAX_AGE_MS;
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
