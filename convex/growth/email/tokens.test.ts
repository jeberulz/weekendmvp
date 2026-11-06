import { describe, expect, it } from "vitest";
import { hashLeadToken, isLeadToken, newLeadToken } from "./tokens";

describe("lead capability tokens", () => {
  it("mints high-entropy URL-safe values without personal data", () => {
    const first = newLeadToken();
    const second = newLeadToken();
    expect(first).toHaveLength(43);
    expect(isLeadToken(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(isLeadToken("bad/token")).toBe(false);
    expect(isLeadToken("a".repeat(4096))).toBe(false);
  });

  it("stores purpose-separated digests, never the raw capability", async () => {
    const token = newLeadToken();
    const optIn = await hashLeadToken("opt_in", token);
    const unsubscribe = await hashLeadToken("unsubscribe", token);
    expect(optIn).toMatch(/^[a-f0-9]{64}$/);
    expect(optIn).not.toContain(token);
    expect(unsubscribe).not.toBe(optIn);
    await expect(hashLeadToken("opt_in", "invalid")).rejects.toThrow("INVALID_LEAD_TOKEN");
  });
});
