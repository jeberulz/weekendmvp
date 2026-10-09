// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  LEGACY_BRIDGE_MAX_PAYLOAD_LENGTH,
  LegacyBridgeError,
  signLegacyPaymentEvent,
  verifyLegacyPaymentEvent,
  type LegacyBridgeErrorCode,
  type LegacyPaymentEvent,
} from "@/lib/legacy-payments-bridge";

const SECRET = "legacy-bridge-test-secret-0123456789abcdef";
const OTHER_SECRET = "another-bridge-test-secret-0123456789abcd";

const EVENT: LegacyPaymentEvent = {
  stripeEventId: "evt_1ABC",
  type: "checkout.session.completed",
  email: "buyer@example.test",
  customerId: "cus_A1",
  amount: 900,
  currency: "usd",
  paymentLinkId: "plink_1",
};

function codeOf(run: () => unknown): LegacyBridgeErrorCode | "no error" {
  try {
    run();
  } catch (error) {
    if (error instanceof LegacyBridgeError) return error.code;
    throw error;
  }
  return "no error";
}

/** A payload with a valid signature, so only the shape is under test. */
function signedRaw(payload: string, secret = SECRET) {
  return { payload, signature: createHmac("sha256", secret).update(payload).digest("base64url") };
}

describe("legacy payment bridge: signature", () => {
  test("a signed event verifies and comes back unchanged", () => {
    const { payload, signature } = signLegacyPaymentEvent(EVENT, SECRET);
    expect(verifyLegacyPaymentEvent(payload, signature, SECRET)).toEqual(EVENT);
  });

  test("optional fields that were not sent stay absent", () => {
    const minimal = { stripeEventId: "evt_min", type: "checkout.session.completed" };
    const { payload, signature } = signLegacyPaymentEvent(minimal, SECRET);
    expect(verifyLegacyPaymentEvent(payload, signature, SECRET)).toEqual(minimal);
  });

  test("a changed payload fails", () => {
    const { payload, signature } = signLegacyPaymentEvent(EVENT, SECRET);
    const changed = payload.replace("buyer@example.test", "someone@example.test");
    expect(codeOf(() => verifyLegacyPaymentEvent(changed, signature, SECRET))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
  });

  test("a changed, empty or wrong-length signature fails", () => {
    const { payload, signature } = signLegacyPaymentEvent(EVENT, SECRET);
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    for (const bad of [flipped, "", signature.slice(0, -4), `${signature}AAAA`]) {
      expect(codeOf(() => verifyLegacyPaymentEvent(payload, bad, SECRET))).toBe(
        "INVALID_BRIDGE_SIGNATURE",
      );
    }
  });

  test("a signature made with another secret fails", () => {
    const { payload, signature } = signLegacyPaymentEvent(EVENT, OTHER_SECRET);
    expect(codeOf(() => verifyLegacyPaymentEvent(payload, signature, SECRET))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
  });

  test("an unset or short secret fails closed on both sides", () => {
    const { payload, signature } = signLegacyPaymentEvent(EVENT, SECRET);
    for (const secret of [undefined, "", "short"]) {
      expect(codeOf(() => verifyLegacyPaymentEvent(payload, signature, secret))).toBe(
        "BRIDGE_NOT_CONFIGURED",
      );
      expect(codeOf(() => signLegacyPaymentEvent(EVENT, secret))).toBe("BRIDGE_NOT_CONFIGURED");
    }
  });

  test("the signature is checked before the payload is read", () => {
    const garbage = "not json at all";
    expect(codeOf(() => verifyLegacyPaymentEvent(garbage, "AAAA", SECRET))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
  });
});

describe("legacy payment bridge: payload shape (validly signed)", () => {
  const bad: Record<string, string> = {
    "not json": "{nope",
    "an array": "[]",
    "a string": '"evt_1"',
    "an unknown key": JSON.stringify({ ...EVENT, rawPayload: "{}" }),
    "an event id without the evt_ prefix": JSON.stringify({ ...EVENT, stripeEventId: "cs_123" }),
    "an event id with illegal characters": JSON.stringify({ ...EVENT, stripeEventId: "evt_1 2" }),
    "a missing type": JSON.stringify({ stripeEventId: "evt_1" }),
    "an empty type": JSON.stringify({ stripeEventId: "evt_1", type: "" }),
    "a negative amount": JSON.stringify({ ...EVENT, amount: -1 }),
    "a fractional amount": JSON.stringify({ ...EVENT, amount: 9.5 }),
    "a string amount": JSON.stringify({ ...EVENT, amount: "900" }),
    "a non-string email": JSON.stringify({ ...EVENT, email: 7 }),
    "an over-long email": JSON.stringify({ ...EVENT, email: "a".repeat(400) }),
  };

  for (const [name, payload] of Object.entries(bad)) {
    test(`rejects ${name}`, () => {
      const { signature } = signedRaw(payload);
      expect(codeOf(() => verifyLegacyPaymentEvent(payload, signature, SECRET))).toBe(
        "INVALID_BRIDGE_PAYLOAD",
      );
    });
  }

  test("rejects an oversized payload on both sides", () => {
    const huge = JSON.stringify({ ...EVENT, email: "a".repeat(LEGACY_BRIDGE_MAX_PAYLOAD_LENGTH) });
    const { signature } = signedRaw(huge);
    expect(codeOf(() => verifyLegacyPaymentEvent(huge, signature, SECRET))).toBe(
      "INVALID_BRIDGE_PAYLOAD",
    );
    expect(
      codeOf(() =>
        signLegacyPaymentEvent(
          { ...EVENT, paymentLinkId: "p".repeat(LEGACY_BRIDGE_MAX_PAYLOAD_LENGTH) },
          SECRET,
        ),
      ),
    ).toBe("INVALID_BRIDGE_PAYLOAD");
  });
});
