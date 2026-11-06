import { describe, expect, it } from "vitest";
import { tenantSendAllowance, utcSendMonth } from "./caps";

describe("tenant send caps", () => {
  it("enforces Free's 50 lifetime enqueues, including after paid use", () => {
    expect(tenantSendAllowance("free", { lifetime: 49, month: 49 })).toMatchObject({
      allowed: true, warnSoftCap: false, limit: 50,
    });
    expect(tenantSendAllowance("free", { lifetime: 50, month: 1 })).toMatchObject({
      allowed: false, warnSoftCap: false, limit: 50,
    });
  });

  it("warns and continues at paid monthly thresholds", () => {
    expect(tenantSendAllowance("builders_hub", { lifetime: 5_000, month: 5_000 })).toMatchObject({
      allowed: true, warnSoftCap: true, limit: 5_000,
    });
    expect(tenantSendAllowance("growth", { lifetime: 20_000, month: 20_000 })).toMatchObject({
      allowed: true, warnSoftCap: true, limit: 20_000,
    });
  });

  it("uses UTC months and refuses corrupted counts", () => {
    expect(utcSendMonth(Date.parse("2026-11-01T00:00:00Z"))).toBe("2026-11");
    expect(utcSendMonth(Date.parse("2026-10-31T23:59:59Z"))).toBe("2026-10");
    expect(() => tenantSendAllowance("free", { lifetime: 1, month: 2 }))
      .toThrow("INVALID_TENANT_SEND_COUNTS");
  });
});
