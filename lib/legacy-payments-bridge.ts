import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed hand-off for the legacy ship·able payment log (WP63-S1).
 *
 * `payments.recordEvent` used to be a public mutation, so any visitor could
 * write `stripe_events` rows. The webhook route now signs each event and a
 * Node action in Convex verifies it before an internal mutation records it,
 * the same pattern WP24 uses for platform billing, with its own secret.
 *
 * A replayed payload is harmless: the log is idempotent by Stripe event id.
 * Only the signing secret can produce a new event. No payload field is a
 * credential, and none is ever used to grant access or decide eligibility.
 */

export const LEGACY_BRIDGE_MIN_SECRET_LENGTH = 32;
export const LEGACY_BRIDGE_MAX_PAYLOAD_LENGTH = 4_096;

export type LegacyBridgeErrorCode =
  | "BRIDGE_NOT_CONFIGURED"
  | "INVALID_BRIDGE_SIGNATURE"
  | "INVALID_BRIDGE_PAYLOAD";

export class LegacyBridgeError extends Error {
  readonly code: LegacyBridgeErrorCode;

  constructor(code: LegacyBridgeErrorCode) {
    super(code);
    this.name = "LegacyBridgeError";
    this.code = code;
  }
}

export type LegacyPaymentEvent = {
  stripeEventId: string;
  type: string;
  email?: string;
  customerId?: string;
  amount?: number;
  currency?: string;
  paymentLinkId?: string;
};

const FIELD_ORDER = [
  "stripeEventId",
  "type",
  "email",
  "customerId",
  "amount",
  "currency",
  "paymentLinkId",
] as const;

function assertSecret(secret: string | undefined): string {
  if (!secret || secret.length < LEGACY_BRIDGE_MIN_SECRET_LENGTH) {
    throw new LegacyBridgeError("BRIDGE_NOT_CONFIGURED");
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signLegacyPaymentEvent(
  event: LegacyPaymentEvent,
  secret: string | undefined,
): { payload: string; signature: string } {
  const key = assertSecret(secret);
  const ordered: Record<string, unknown> = {};
  for (const field of FIELD_ORDER) {
    if (event[field] !== undefined) ordered[field] = event[field];
  }
  const payload = JSON.stringify(ordered);
  if (payload.length > LEGACY_BRIDGE_MAX_PAYLOAD_LENGTH) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  return { payload, signature: sign(payload, key) };
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  return value;
}

function parseEvent(payload: string): LegacyPaymentEvent {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  const candidate = value as Record<string, unknown>;
  const allowed = new Set<string>(FIELD_ORDER);
  if (Object.keys(candidate).some((key) => !allowed.has(key))) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  const stripeEventId = candidate.stripeEventId;
  if (
    typeof stripeEventId !== "string" ||
    stripeEventId.length > 255 ||
    !/^evt_[A-Za-z0-9_]+$/.test(stripeEventId)
  ) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  const type = optionalString(candidate.type, 100);
  if (type === undefined || type.length === 0) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  const amount = candidate.amount;
  if (
    amount !== undefined &&
    (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0)
  ) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  const event: LegacyPaymentEvent = { stripeEventId, type };
  const email = optionalString(candidate.email, 320);
  if (email !== undefined) event.email = email;
  const customerId = optionalString(candidate.customerId, 255);
  if (customerId !== undefined) event.customerId = customerId;
  if (amount !== undefined) event.amount = amount;
  const currency = optionalString(candidate.currency, 16);
  if (currency !== undefined) event.currency = currency;
  const paymentLinkId = optionalString(candidate.paymentLinkId, 255);
  if (paymentLinkId !== undefined) event.paymentLinkId = paymentLinkId;
  return event;
}

/** Verifies the signature first, then parses. Throws `LegacyBridgeError`. */
export function verifyLegacyPaymentEvent(
  payload: string,
  signature: string,
  secret: string | undefined,
): LegacyPaymentEvent {
  const key = assertSecret(secret);
  if (payload.length > LEGACY_BRIDGE_MAX_PAYLOAD_LENGTH) {
    throw new LegacyBridgeError("INVALID_BRIDGE_PAYLOAD");
  }
  const expected = createHmac("sha256", key).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new LegacyBridgeError("INVALID_BRIDGE_SIGNATURE");
  }
  return parseEvent(payload);
}
