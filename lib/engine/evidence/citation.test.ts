import { describe, expect, it } from "vitest";

import {
  canonicalSourceUrl,
  citationRefusal,
  isComparisonPage,
  isSecondaryMarketPage,
  isFirstPartyHost,
  isVendorMarketplaceListing,
  sameSource,
  sourceHostLabel,
  strippedSourceUrl,
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

  it("P3-6: rejects signed and credential-bearing URLs, so they can never be cited or published", () => {
    for (const signed of [
      "https://bucket.s3.amazonaws.com/report.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=a&X-Amz-Signature=deadbeef",
      "https://storage.googleapis.com/b/report.pdf?X-Goog-Signature=abc&X-Goog-Expires=600",
      "https://d111.cloudfront.net/report.pdf?Expires=1700000000&Signature=abc&Key-Pair-Id=K1",
      "https://acct.blob.core.windows.net/c/report.pdf?sv=2022-11-02&se=2026-10-02&sig=abc",
      "https://example.com/report?token=abc",
      "https://example.com/report?access_token=abc",
      "https://example.com/report?auth=abc",
      "https://example.com/report?key=abc",
      "https://example.com/report?api_key=abc",
      "https://example.com/report?APIKEY=abc",
      "https://example.com/report?password=hunter2",
      "https://example.com/report?secret=abc",
      "https://example.com/report?id=7&csrf_token=abc",
      "https://example.com/report?client_secret=abc&id=7",
      "https://example.com/report?%74oken=abc",
    ]) {
      expect(canonicalSourceUrl(signed), signed).toBeNull();
    }
    // Ordinary identity-bearing parameters stay citable.
    expect(canonicalSourceUrl("https://news.ycombinator.com/item?id=4101")).toBe("https://news.ycombinator.com/item?id=4101");
    expect(canonicalSourceUrl("https://example.com/search?q=token+limits&page=2")).toBe("https://example.com/search?q=token+limits&page=2");
    expect(canonicalSourceUrl("https://example.com/report?pageToken=abc")).toBe("https://example.com/report?pageToken=abc");
  });

  it("P3-6: strips a rejected URL to origin and path for operator records", () => {
    expect(strippedSourceUrl("https://user:pw@Example.com/report.pdf?X-Amz-Signature=abc#top")).toBe("https://example.com/report.pdf");
    expect(strippedSourceUrl("javascript:alert(1)")).toBeNull();
    expect(strippedSourceUrl("not a url")).toBeNull();
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
  it("binds a Shopify app price only to that app's exact listing", () => {
    expect(isVendorMarketplaceListing("Instant", "https://apps.shopify.com/instant")).toBe(true);
    expect(isVendorMarketplaceListing("Replo", "https://apps.shopify.com/replo")).toBe(true);
    expect(isVendorMarketplaceListing("Instant", "https://apps.shopify.com/replo")).toBe(false);
    expect(isVendorMarketplaceListing("Instant", "https://apps.shopify.com/instant/reviews")).toBe(false);
    expect(isVendorMarketplaceListing("Instant", "https://www.g2.com/products/instant")).toBe(false);
  });

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
    expect(isComparisonPage("https://responsive.io/blog/responsive-pricing-compared-other-rfp-software")).toBe(true);
    expect(isComparisonPage("https://loopio.com/pricing")).toBe(false);
  });

  it("flags general blog and guide paths as secondary market sources", () => {
    expect(isSecondaryMarketPage("https://www.digitalapplied.com/blog/ai-code-review-automation-guide-2025")).toBe(true);
    expect(isSecondaryMarketPage("https://example.com/guides/landing-page-market")).toBe(true);
    expect(isSecondaryMarketPage("https://example.com/blog/best-landing-page-builders")).toBe(true);
    expect(isSecondaryMarketPage("https://dataintelo.com/report/ai-generated-code-review-tools-market")).toBe(false);
  });

  it("permits only a blog statistic whose own excerpt states original research", () => {
    const excerpt = "Our survey found 61% of security teams use security questionnaires.";
    expect(isSecondaryMarketPage("https://publisher.example/blog/survey-findings", excerpt)).toBe(false);
    expect(isSecondaryMarketPage("https://publisher.example/blog/survey-findings", "61% of security teams use security questionnaires.")).toBe(true);
    expect(isSecondaryMarketPage("https://publisher.example/blog/best-security-tools", excerpt)).toBe(true);
    expect(isSecondaryMarketPage("https://publisher.example/guides/survey-findings", excerpt)).toBe(true);
  });

  it("labels a source by its host", () => {
    expect(sourceHostLabel("https://www.g2.com/products/loopio/pricing")).toBe("g2.com");
    expect(sourceHostLabel("https://news.ycombinator.com/item?id=1")).toBe("news.ycombinator.com");
    expect(sourceHostLabel("nope")).toBe("");
  });
});

describe("R15: credential-like citation URLs are refused", () => {
  it.each([
    ["an opaque query value", "https://app.example/doc?st=abc123def456ghi789"],
    ["an OAuth-style code", "https://app.example/doc?code=4/0AbCdEfGhIjKlMnOp"],
    ["a JWT", "https://app.example/doc?s=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig"],
    ["a share token in the path", "https://app.example/share/AbCdEf0123456789XyZaBcDeF/doc"],
    ["a session matrix parameter", "https://app.example/doc;jsessionid=ABCDEF0123456789"],
    ["a value after a secret path name", "https://app.example/token/abc123/doc"],
    ["a long random path segment", "https://files.example.com/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"],
  ])("refuses %s (security probe-credential-urls)", (_label, url) => {
    expect(canonicalSourceUrl(url)).toBeNull();
    expect(citationRefusal(url)).toMatch(/credential/);
  });

  it("keeps ordinary identity and filter parameters, slugs and numeric ids", () => {
    for (const url of [
      "https://acme.example/pricing?plan=team",
      "https://forum.example/t/topic-title/88?page=2",
      "https://news.example.com/item?id=4101",
      "https://forum.example/t/topic-title/88?u=someone",
      "https://www.reddit.com/r/sales/comments/abc123/rfp_weekends/",
      "https://blog.example.com/why-we-rewrote-billing-1a2b3c4d5e6f",
      "https://example.com/search?q=best+rfp+software+for+small+teams",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      expect(canonicalSourceUrl(url), url).not.toBeNull();
      expect(citationRefusal(url), url).toBeNull();
    }
  });

  it("names why a citation was refused without repeating the secret", () => {
    const reason = citationRefusal("https://app.example/doc?st=abc123def456ghi789") ?? "";
    expect(reason).toContain("st");
    expect(reason).not.toContain("abc123def456ghi789");
    expect(citationRefusal("ftp://example.com/x")).toMatch(/http/);
    expect(citationRefusal("https://user:pw@example.com/")).toMatch(/userinfo/);
    expect(citationRefusal("https://x.example/a?X-Amz-Signature=abc")).toMatch(/credential/);
  });
});
