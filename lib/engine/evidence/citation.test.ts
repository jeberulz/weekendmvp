import { describe, expect, it } from "vitest";

import {
  canonicalSourceUrl,
  isComparisonPage,
  isFirstPartyHost,
  sameSource,
  sourceHostLabel,
  vendorKey,
} from "./citation.ts";

describe("canonicalSourceUrl", () => {
  it("keeps Hacker News item ids identity-bearing: item?id=1 is not item?id=2", () => {
    expect(canonicalSourceUrl("https://news.ycombinator.com/item?id=1")).toBe("https://news.ycombinator.com/item?id=1");
    expect(sameSource("https://news.ycombinator.com/item?id=1", "https://news.ycombinator.com/item?id=2")).toBe(false);
  });

  it("treats the same host with a different path as a different source", () => {
    expect(sameSource("https://tianpan.co/forum/t/thread-a/863", "https://tianpan.co/forum/t/thread-b/1035")).toBe(false);
    expect(sameSource("https://loopio.com/pricing", "https://loopio.com/")).toBe(false);
  });

  it("drops tracking parameters and keeps the others verbatim and in order", () => {
    expect(
      canonicalSourceUrl("https://example.com/report?utm_source=x&id=7&UTM_Medium=y&fbclid=a&q=a%20b&gclid=g&ref=hn"),
    ).toBe("https://example.com/report?id=7&q=a%20b");
    expect(canonicalSourceUrl("https://example.com/a?utm_campaign=z")).toBe("https://example.com/a");
    expect(sameSource("https://example.com/a?ref=producthunt", "https://example.com/a")).toBe(true);
    expect(sameSource("https://example.com/a?refresh=1", "https://example.com/a")).toBe(false);
  });

  it("rejects URLs carrying userinfo", () => {
    expect(canonicalSourceUrl("https://user:secret@example.com/page")).toBeNull();
    expect(canonicalSourceUrl("https://token@example.com/page")).toBeNull();
  });

  it("ignores the default port and the fragment", () => {
    expect(canonicalSourceUrl("https://Example.COM:443/Pricing/#plans")).toBe("https://example.com/Pricing");
    expect(sameSource("http://example.com:80/a", "http://example.com/a#top")).toBe(true);
    expect(sameSource("https://example.com:8443/a", "https://example.com/a")).toBe(false);
  });

  it("removes a trailing slash except on the root and never folds www", () => {
    expect(canonicalSourceUrl("https://loopio.com/pricing/")).toBe("https://loopio.com/pricing");
    expect(canonicalSourceUrl("https://loopio.com")).toBe("https://loopio.com/");
    expect(canonicalSourceUrl("https://loopio.com/")).toBe("https://loopio.com/");
    expect(sameSource("https://www.loopio.com/pricing", "https://loopio.com/pricing")).toBe(false);
  });

  it("accepts only http(s) URLs", () => {
    for (const bad of ["ftp://example.com/a", "javascript:alert(1)", "mailto:a@example.com", "not a url", "", "   "]) {
      expect(canonicalSourceUrl(bad)).toBeNull();
    }
    expect(sameSource("not a url", "not a url")).toBe(false);
  });
});

describe("vendor keys and first-party hosts", () => {
  it("builds comparable vendor keys", () => {
    expect(vendorKey("RFP.ai")).toBe("rfp");
    expect(vendorKey("AutoRFP.ai")).toBe("autorfp");
    expect(vendorKey("DeepRFP")).toBe("deeprfp");
    expect(vendorKey("LoopioHQ")).toBe("loopio");
    expect(vendorKey("Loopio, Inc.")).toBe("loopio");
    expect(vendorKey("Qodo AI")).toBe("qodo");
    expect(vendorKey("CodeRabbit")).toBe("coderabbit");
  });

  it("recognizes a vendor on its own registrable host", () => {
    expect(isFirstPartyHost("Loopio", "https://loopio.com/pricing")).toBe(true);
    expect(isFirstPartyHost("Loopio", "https://app.loopio.co.uk/plans")).toBe(true);
    expect(isFirstPartyHost("RFP.ai", "https://rfp.ai/")).toBe(true);
    expect(isFirstPartyHost("CodeRabbit", "https://www.coderabbit.ai/pricing")).toBe(true);
    expect(isFirstPartyHost("Qodo AI", "https://www.qodo.ai/pricing/")).toBe(true);
  });

  it("does not treat DeepRFP as first-party on rfp.ai, or apps on a marketplace host", () => {
    expect(isFirstPartyHost("DeepRFP", "https://rfp.ai/")).toBe(false);
    expect(isFirstPartyHost("PageFly", "https://apps.shopify.com/pagefly")).toBe(false);
    expect(isFirstPartyHost("Loopio", "https://www.g2.com/products/loopio/pricing")).toBe(false);
    expect(isFirstPartyHost("Loopio", "https://loopio.example.com/")).toBe(false);
    expect(isFirstPartyHost("Loopio", "http://192.168.0.1/loopio")).toBe(false);
  });

  it("flags comparison and roundup paths", () => {
    expect(isComparisonPage("https://loopio.com/blog/loopio-vs-responsive")).toBe(true);
    expect(isComparisonPage("https://loopio.com/alternatives/")).toBe(true);
    expect(isComparisonPage("https://loopio.com/pricing")).toBe(false);
  });

  it("labels a source by its host", () => {
    expect(sourceHostLabel("https://www.g2.com/products/loopio/pricing")).toBe("g2.com");
    expect(sourceHostLabel("https://news.ycombinator.com/item?id=1")).toBe("news.ycombinator.com");
    expect(sourceHostLabel("nope")).toBe("");
  });
});
