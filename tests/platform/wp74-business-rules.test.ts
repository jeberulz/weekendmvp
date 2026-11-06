import { describe, expect, test } from "vitest";

import { RESERVED_SUBDOMAINS } from "@/lib/tenant-host";
import { DISPOSABLE_EMAIL_DOMAINS, emailDomain, isDisposableEmailDomain } from "@/lib/workspace/disposable-domains";
import {
  TENANT_SLUG_BASE_MAX,
  TENANT_SLUG_MAX_ATTEMPTS,
  pickTenantSlug,
  tenantSlugBase,
  tenantSlugCandidate,
} from "@/lib/workspace/wizard/tenant-slug";

describe("WP74-S4 disposable email domains", () => {
  test("the starter list is curated: 50 to 150 lowercase domains", () => {
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeGreaterThanOrEqual(50);
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeLessThanOrEqual(150);
    for (const domain of DISPOSABLE_EMAIL_DOMAINS) {
      expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
  });

  test.each([
    "someone@mailinator.com",
    "someone@guerrillamail.com",
    "someone@10minutemail.com",
    "someone@yopmail.com",
    "someone@temp-mail.org",
    "mailinator.com",
  ])("%s is disposable", (value) => {
    expect(isDisposableEmailDomain(value)).toBe(true);
  });

  test.each([
    "someone@inbox.mailinator.com",
    "someone@a.b.yopmail.com",
    "someone@MAILINATOR.COM",
    "someone@Inbox.YopMail.Com.",
    "  someone@mailinator.com  ",
    "odd@name@mailinator.com",
  ])("%s is disposable (subdomain, case, trailing dot, spaces)", (value) => {
    expect(isDisposableEmailDomain(value)).toBe(true);
  });

  test.each([
    "someone@gmail.com",
    "someone@outlook.com",
    "founder@hydrotrail.co.uk",
    "team@acme-industries.com",
    "someone@gmail.tm",
    "someone@notmailinator.com",
    "someone@mailinator.com.evil.example",
    "someone@bücher.example",
    "someone@ＭＡＩＬ.example",
  ])("%s is not disposable", (value) => {
    expect(isDisposableEmailDomain(value)).toBe(false);
  });

  test("full-width letters fold with NFKC before matching", () => {
    expect(emailDomain("x@ＭＡＩＬＩＮＡＴＯＲ.ＣＯＭ")).toBe("mailinator.com");
    expect(isDisposableEmailDomain("x@ＭＡＩＬＩＮＡＴＯＲ.ＣＯＭ")).toBe(true);
  });

  test("no domain is never disposable and never throws", () => {
    for (const value of ["", "@", "someone@", "someone@.", "someone@a..b", "someone@ex ample.com"]) {
      expect(isDisposableEmailDomain(value)).toBe(false);
    }
  });
});

describe("WP74-S4 tenant slug", () => {
  test.each([
    ["HydroTrail", "hydrotrail"],
    ["Café Ünïcode!!", "cafe-unicode"],
    ["  Trail -- Water  ", "trail-water"],
    ["AI", "ai-business"],
    ["X", "x-business"],
    ["水の道", "business"],
    ["!!!", "business"],
  ])("%s has base %s", (name, base) => {
    expect(tenantSlugBase(name)).toBe(base);
  });

  test("the base is length-bounded so a suffix still fits a DNS label", () => {
    const base = tenantSlugBase(`${"a".repeat(47)} ${"b".repeat(30)}`);
    expect(base).toBe("a".repeat(47));
    expect(base.length).toBeLessThanOrEqual(TENANT_SLUG_BASE_MAX);
    expect(tenantSlugCandidate(base, TENANT_SLUG_MAX_ATTEMPTS).length).toBeLessThanOrEqual(63);
    expect(tenantSlugBase("c".repeat(80))).toBe("c".repeat(TENANT_SLUG_BASE_MAX));
  });

  test("candidates are deterministic: base, base-2, base-3", () => {
    expect([1, 2, 3].map((n) => tenantSlugCandidate("hydrotrail", n))).toEqual(["hydrotrail", "hydrotrail-2", "hydrotrail-3"]);
  });

  test("reserved names are never picked; the next suffix is", async () => {
    for (const reserved of ["support", "admin", "www", "billing"]) {
      expect(RESERVED_SUBDOMAINS.has(reserved)).toBe(true);
      await expect(pickTenantSlug(reserved, async () => false)).resolves.toBe(`${reserved}-2`);
    }
  });

  test("collisions take the first free suffix, the same way every time", async () => {
    const taken = new Set(["hydrotrail", "hydrotrail-2"]);
    const checked: string[] = [];
    const isTaken = async (slug: string) => {
      checked.push(slug);
      return taken.has(slug);
    };
    await expect(pickTenantSlug("HydroTrail", isTaken)).resolves.toBe("hydrotrail-3");
    expect(checked).toEqual(["hydrotrail", "hydrotrail-2", "hydrotrail-3"]);
    await expect(pickTenantSlug("HydroTrail", async (slug) => taken.has(slug))).resolves.toBe("hydrotrail-3");
  });

  test("gives up after the attempt limit", async () => {
    await expect(pickTenantSlug("HydroTrail", async () => true)).resolves.toBeNull();
  });
});
