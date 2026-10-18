import { describe, expect, it } from "vitest";

import {
  LOVABLE_AFFILIATE_URL,
  isLovableOutboundUrl,
  resolveLovableAffiliateHref,
} from "./lovable";

describe("lovable affiliate helpers", () => {
  it("exports the Impact vanity URL John approved", () => {
    expect(LOVABLE_AFFILIATE_URL).toBe("https://lovablelabs.pxf.io/m4320e");
  });

  it("detects lovable.dev apex, www, docs, and paths", () => {
    expect(isLovableOutboundUrl("https://lovable.dev")).toBe(true);
    expect(isLovableOutboundUrl("https://www.lovable.dev/pricing")).toBe(true);
    expect(
      isLovableOutboundUrl(
        "https://docs.lovable.dev/introduction/subscription-plans",
      ),
    ).toBe(true);
    expect(isLovableOutboundUrl("http://lovable.dev/partners")).toBe(true);
  });

  it("rejects non-Lovable hosts and relative paths", () => {
    expect(isLovableOutboundUrl("https://lovable911.dev")).toBe(false);
    expect(isLovableOutboundUrl("https://lovablexperts.com")).toBe(false);
    expect(isLovableOutboundUrl("https://bolt.new")).toBe(false);
    expect(isLovableOutboundUrl("/build-with/lovable")).toBe(false);
    expect(isLovableOutboundUrl(undefined)).toBe(false);
  });

  it("rewrites every Lovable destination to the plain affiliate URL (no deep link)", () => {
    expect(resolveLovableAffiliateHref("https://lovable.dev/pricing")).toBe(
      LOVABLE_AFFILIATE_URL,
    );
    expect(
      resolveLovableAffiliateHref("https://docs.lovable.dev/introduction"),
    ).toBe(LOVABLE_AFFILIATE_URL);
    expect(resolveLovableAffiliateHref("https://bolt.new")).toBe(
      "https://bolt.new",
    );
  });
});
